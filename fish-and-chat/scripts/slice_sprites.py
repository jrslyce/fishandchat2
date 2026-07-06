#!/usr/bin/env python3
"""Slice Gemini-generated 2x3 icon sheets into individual transparent sprite PNGs.

Usage: uv run scripts/slice_sprites.py  (run from fish-and-chat/)

Reads assets-src/sprites/sheet-*.png, background-removes + crops + downscales
each cell, and writes public/images/sprites/<id>.png. Also (re)generates
src/assets/spriteManifest.ts mapping id -> URL.
"""
import numpy as np
from PIL import Image
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "assets-src" / "sprites"
OUT_DIR = ROOT / "public" / "images" / "sprites"
MANIFEST_PATH = ROOT / "src" / "assets" / "spriteManifest.ts"

ROWS, COLS = 2, 3
MAX_SIDE = 256
CROP_PAD = 12
BG_MIN_CHANNEL = 235  # min(r,g,b) threshold for "near white"
BG_MAX_SAT_SPREAD = 18  # max(r,g,b) - min(r,g,b) spread allowed for "low saturation"

# Sheet filename -> ids in row-major order (top-left, top-middle, top-right,
# bottom-left, bottom-middle, bottom-right). None marks an unused/empty cell.
SHEETS: dict[str, list[str | None]] = {
    "sheet-01-fish-common.png": [
        "sunny-perch", "pond-minnow", "mudskip-carp",
        "blue-gill", "speckled-dace", "copper-trout",
    ],
    "sheet-02-fish-uncommon.png": [
        "lantern-catfish", "jade-koi", "pebble-bass",
        "silver-shad", "moonlit-eel", "coral-clownfish",
    ],
    "sheet-03-fish-rare.png": [
        "glassfin-pike", "sapphire-tuna", "stardust-guppy",
        "starlit-anglerfish", "golden-arowana", "aurora-jelly",
    ],
    "sheet-04-fish-legendary.png": [
        "prism-koi", "void-leviathan-pup", "tidecaller-marlin",
        "nebula-ray", "chrono-carp", "void-bass",
    ],
    "sheet-05-fish-legendary2-trash.png": [
        "quantum-leviathan", "old-boot", "tin-can",
        "driftwood", "soggy-hat", "tangled-line",
    ],
    "sheet-06-trash2-bait-special.png": [
        "glass-bottle", "pleb-bait", "marshmallows",
        "nightcrawlers", "neon-super-lure", "lucky-ducky",
    ],
    "sheet-07-special-upgrades.png": [
        "treasure", "carbon-rod", "led-bobber",
        "turbo-bot-chip", "heavy-duty-basket", "tackle-apron",
    ],
    "sheet-08-upgrades2-fishbots-material.png": [
        "salvage-magnet", "insulated-cooler", "sonar-scanner",
        "fishbot-mk1", "fishbot-mk2", "rubber",
    ],
    "sheet-09-materials.png": [
        "metal", "wood", "fabric",
        "fiber", "glass", None,
    ],
}


def is_background(px: np.ndarray) -> np.ndarray:
    r, g, b = px[..., 0].astype(int), px[..., 1].astype(int), px[..., 2].astype(int)
    mn = np.minimum(np.minimum(r, g), b)
    mx = np.maximum(np.maximum(r, g), b)
    return (mn >= BG_MIN_CHANNEL) & ((mx - mn) <= BG_MAX_SAT_SPREAD)


def remove_background(cell: Image.Image) -> Image.Image:
    cell = cell.convert("RGBA")
    arr = np.array(cell)
    bg_mask = is_background(arr)

    h, w = bg_mask.shape
    reached = np.zeros((h, w), dtype=bool)
    stack = []
    for x in range(w):
        stack.append((0, x)); stack.append((h - 1, x))
    for y in range(h):
        stack.append((y, 0)); stack.append((y, w - 1))

    while stack:
        y, x = stack.pop()
        if y < 0 or y >= h or x < 0 or x >= w:
            continue
        if reached[y, x] or not bg_mask[y, x]:
            continue
        reached[y, x] = True
        stack.append((y + 1, x)); stack.append((y - 1, x))
        stack.append((y, x + 1)); stack.append((y, x - 1))

    alpha = arr[..., 3].copy()
    alpha[reached] = 0
    # Second pass: enclosed background pockets not connected to the border
    # (e.g. gaps inside a handle) also get keyed out.
    enclosed = bg_mask & ~reached
    alpha[enclosed] = 0

    arr[..., 3] = alpha
    return Image.fromarray(arr, "RGBA")


def tight_crop(img: Image.Image) -> Image.Image:
    arr = np.array(img)
    alpha = arr[..., 3]
    ys, xs = np.where(alpha > 0)
    if len(xs) == 0:
        return img
    x0, x1 = max(xs.min() - CROP_PAD, 0), min(xs.max() + CROP_PAD, arr.shape[1] - 1)
    y0, y1 = max(ys.min() - CROP_PAD, 0), min(ys.max() + CROP_PAD, arr.shape[0] - 1)
    return img.crop((x0, y0, x1 + 1, y1 + 1))


def downscale(img: Image.Image) -> Image.Image:
    w, h = img.size
    longest = max(w, h)
    if longest <= MAX_SIDE:
        return img
    scale = MAX_SIDE / longest
    return img.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest_entries: list[tuple[str, str]] = []
    total_written = 0

    for sheet_name, ids in SHEETS.items():
        sheet_path = SRC_DIR / sheet_name
        if not sheet_path.exists():
            print(f"MISSING sheet: {sheet_path}")
            continue
        sheet = Image.open(sheet_path).convert("RGBA")
        w, h = sheet.size
        cell_w, cell_h = w / COLS, h / ROWS

        for i, sprite_id in enumerate(ids):
            if sprite_id is None:
                continue
            row, col = divmod(i, COLS)
            box = (
                round(col * cell_w), round(row * cell_h),
                round((col + 1) * cell_w), round((row + 1) * cell_h),
            )
            cell = sheet.crop(box)
            cell = remove_background(cell)
            cell = tight_crop(cell)
            cell = downscale(cell)

            out_path = OUT_DIR / f"{sprite_id}.png"
            quantized = cell.quantize(colors=256, method=Image.Quantize.FASTOCTREE)
            quantized.save(out_path, optimize=True)
            total_written += 1
            manifest_entries.append((sprite_id, f"/images/sprites/{sprite_id}.png"))
            print(f"wrote {out_path.relative_to(ROOT)} ({cell.size[0]}x{cell.size[1]})")

    manifest_entries.sort(key=lambda e: e[0])
    lines = [
        "// GENERATED by scripts/slice_sprites.py — do not edit by hand.",
        "export const SPRITE_MANIFEST: Record<string, string> = {",
    ]
    for sprite_id, url in manifest_entries:
        lines.append(f"  '{sprite_id}': '{url}',")
    lines.append("};")
    lines.append("")
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text("\n".join(lines))

    print(f"\nTotal sprites written: {total_written}")
    print(f"Manifest: {MANIFEST_PATH.relative_to(ROOT)} ({len(manifest_entries)} entries)")


if __name__ == "__main__":
    main()
