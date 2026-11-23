#!/usr/bin/env python3
"""
Downscales embedded texture images inside binary glTF (.glb) files using Pillow
while keeping all geometry, skinning, accessor, and animation bufferViews intact.
"""

from __future__ import annotations

import argparse
import io
import json
import os
import struct
import sys
from PIL import Image

GLTF_MAGIC = 0x46546C67
CHUNK_JSON = 0x4E4F534A
CHUNK_BIN = 0x004E4942


def tint_warm_lantern(img: Image.Image) -> Image.Image:
    rgb = img.convert("RGB")
    pixels = list(rgb.getdata())
    tinted = []
    for r, g, b in pixels:
        lo = min(r, g, b)
        hi = max(r, g, b)
        # Convert neutral frosted-white glass pane areas into warm honey-amber glow
        if lo > 185 and (hi - lo) < 34:
            t = min(1.0, (lo - 185) / 60.0)
            nr = int(r * (1.0 - 0.15 * t) + 255 * (0.15 * t))
            ng = int(g * (1.0 - 0.25 * t) + 206 * (0.25 * t))
            nb = int(b * (1.0 - 0.68 * t) + 96 * (0.68 * t))
            tinted.append((min(255, nr), min(255, ng), min(255, nb)))
        else:
            tinted.append((r, g, b))
    out = Image.new("RGB", rgb.size)
    out.putdata(tinted)
    return out


def base_color_image_indices(gltf: dict) -> set[int]:
    textures = gltf.get("textures", [])
    indices: set[int] = set()
    for mat in gltf.get("materials", []):
        pbr = mat.get("pbrMetallicRoughness", {})
        bc = pbr.get("baseColorTexture")
        if bc and isinstance(bc.get("index"), int):
            tex_idx = bc["index"]
            if 0 <= tex_idx < len(textures) and isinstance(textures[tex_idx].get("source"), int):
                indices.add(textures[tex_idx]["source"])
    return indices


def optimize_glb(
    src: str,
    dst: str,
    max_size: int,
    quality: int,
    warm_lantern: bool,
    matte_only: bool = False,
) -> tuple[int, int]:
    raw = open(src, "rb").read()
    magic, version, total_len = struct.unpack_from("<III", raw, 0)
    if magic != GLTF_MAGIC or version != 2:
        raise ValueError(f"Unsupported GLB header in {src}: magic={hex(magic)} version={version}")

    offset = 12
    json_bytes = b""
    bin_bytes = b""
    while offset < len(raw):
        chunk_len, chunk_type = struct.unpack_from("<II", raw, offset)
        chunk_data = raw[offset + 8 : offset + 8 + chunk_len]
        if chunk_type == CHUNK_JSON:
            json_bytes = chunk_data
        elif chunk_type == CHUNK_BIN:
            bin_bytes = chunk_data
        offset += 8 + chunk_len

    gltf = json.loads(json_bytes.decode("utf-8"))
    images = gltf.get("images", [])
    buffer_views = gltf.get("bufferViews", [])
    bv_to_img: dict[int, int] = {}
    for idx, img_def in enumerate(images):
        if isinstance(img_def.get("bufferView"), int):
            bv_to_img[img_def["bufferView"]] = idx

    bc_images = base_color_image_indices(gltf)
    if matte_only:
        for mat in gltf.get("materials", []):
            mat.pop("normalTexture", None)
            mat.pop("occlusionTexture", None)
            pbr = mat.get("pbrMetallicRoughness")
            if isinstance(pbr, dict):
                pbr.pop("metallicRoughnessTexture", None)
                pbr["metallicFactor"] = 0.0
                pbr["roughnessFactor"] = 0.85

    out_bin = bytearray()
    for bv_idx, bv in enumerate(buffer_views):
        start = bv.get("byteOffset", 0)
        length = bv["byteLength"]
        data = bin_bytes[start : start + length]

        if bv_idx in bv_to_img:
            img_idx = bv_to_img[bv_idx]
            if matte_only and img_idx not in bc_images:
                pil_img = Image.new("RGB", (1, 1), (128, 128, 128))
            else:
                pil_img = Image.open(io.BytesIO(data))
                if warm_lantern and img_idx in bc_images:
                    pil_img = tint_warm_lantern(pil_img)
                if pil_img.mode not in ("RGB", "L"):
                    pil_img = pil_img.convert("RGB")
                pil_img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
            buf = io.BytesIO()
            pil_img.save(buf, format="JPEG", quality=quality, optimize=True)
            data = buf.getvalue()
            images[img_idx]["mimeType"] = "image/jpeg"

        while len(out_bin) % 4 != 0:
            out_bin.append(0)
        bv["byteOffset"] = len(out_bin)
        bv["byteLength"] = len(data)
        out_bin.extend(data)

    while len(out_bin) % 4 != 0:
        out_bin.append(0)

    if gltf.get("buffers"):
        gltf["buffers"][0]["byteLength"] = len(out_bin)

    new_json = bytearray(json.dumps(gltf, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
    while len(new_json) % 4 != 0:
        new_json.extend(b" ")

    total = 12 + 8 + len(new_json) + 8 + len(out_bin)
    os.makedirs(os.path.dirname(os.path.abspath(dst)), exist_ok=True)
    with open(dst, "wb") as f:
        f.write(struct.pack("<III", GLTF_MAGIC, 2, total))
        f.write(struct.pack("<II", len(new_json), CHUNK_JSON))
        f.write(new_json)
        f.write(struct.pack("<II", len(out_bin), CHUNK_BIN))
        f.write(out_bin)

    return len(raw), total


def main() -> int:
    parser = argparse.ArgumentParser(description="Downscale embedded textures inside a GLB file.")
    parser.add_argument("src", help="Source GLB file path")
    parser.add_argument("dst", help="Destination GLB file path")
    parser.add_argument("--max-size", type=int, default=512, help="Max width/height for embedded textures (default: 512)")
    parser.add_argument("--quality", type=int, default=86, help="JPEG quality 1-95 (default: 86)")
    parser.add_argument("--warm-lantern", action="store_true", help="Tint neutral white lantern panes warm honey-amber")
    parser.add_argument(
        "--matte-only",
        action="store_true",
        help="Strip normal/occlusion/metallicRoughness maps and collapse unused textures to 1x1 JPEG",
    )
    args = parser.parse_args()

    before, after = optimize_glb(args.src, args.dst, args.max_size, args.quality, args.warm_lantern, args.matte_only)
    print(f"{args.dst}: {before/1048576:.2f} MB -> {after/1024:.1f} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
