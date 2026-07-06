#!/usr/bin/env python3
"""Generate flat-color clothing overlay patches for the player voxel character.

These are NOT full skin textures — each output is just one body part's
*overlay*-layer island, sized to exactly match the rectangles in
src/entities/character/skinLayout.ts, so compositeSkin.ts can drawImage()
them straight onto the composited skin at the right (x, y). Solid color +
simple two-tone shading (a lighter top, darker bottom) rather than generative
art — placement needs to be pixel-exact, which is a precision-drawing task,
not a generative one (see plan-character.md ground rules).

Run from fish-and-chat/: python3 scripts/make_clothing_textures.py
"""
from PIL import Image, ImageDraw
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "images" / "clothing"

# Head overlay island layout (relative to its own 32x16 top-left origin),
# derived from the same box-unwrap math as skinLayout.ts / PlayerObject.ts:
#   top:    (8,0)-(16,8)
#   bottom: (16,0)-(24,8)
#   left:   (0,8)-(8,16)
#   front:  (8,8)-(16,16)   <- the face; a hat must not fully cover this
#   right:  (16,8)-(24,16)
#   back:   (24,8)-(32,16)
HEAD_W, HEAD_H = 32, 16
BODY_W, BODY_H = 24, 16
LIMB_W, LIMB_H = 16, 16


def shade(color, factor):
    r, g, b = color
    return (max(0, min(255, int(r * factor))), max(0, min(255, int(g * factor))), max(0, min(255, int(b * factor))))


def make_hat(name: str, color: tuple[int, int, int], forehead_coverage: float = 0.4) -> None:
    """Fills top/left/right/back fully; front only down to `forehead_coverage` of its height, leaving the face visible."""
    img = Image.new("RGBA", (HEAD_W, HEAD_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    light = shade(color, 1.15)
    dark = shade(color, 0.8)

    draw.rectangle([8, 0, 15, 7], fill=light)  # top
    draw.rectangle([16, 0, 23, 7], fill=dark)  # bottom (brim underside)
    draw.rectangle([0, 8, 7, 15], fill=color)  # left
    draw.rectangle([16, 8, 23, 15], fill=color)  # right
    draw.rectangle([24, 8, 31, 15], fill=dark)  # back
    front_bottom = 8 + max(1, round((HEAD_H - 8) * forehead_coverage)) - 1
    draw.rectangle([8, 8, 15, front_bottom], fill=color)  # front, forehead only

    img.save(OUT_DIR / f"{name}.png")


def make_full_wrap(name: str, w: int, h: int, color: tuple[int, int, int]) -> None:
    """Fills the whole island — for body/arm/leg overlays that wrap fully around the limb (no face to protect)."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    light = shade(color, 1.15)
    dark = shade(color, 0.85)
    third = h // 3
    draw.rectangle([0, 0, w - 1, third - 1], fill=light)
    draw.rectangle([0, third, w - 1, h - third - 1], fill=color)
    draw.rectangle([0, h - third, w - 1, h - 1], fill=dark)
    img.save(OUT_DIR / f"{name}.png")


def make_leg_band(name: str, color: tuple[int, int, int], row_start: int, row_end: int) -> None:
    """Fills only rows [row_start, row_end) of the 16-tall leg overlay island — used to split pants (upper/thigh) from shoes (lower/ankle) sharing the same rectangle."""
    img = Image.new("RGBA", (LIMB_W, LIMB_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    light = shade(color, 1.15)
    dark = shade(color, 0.85)
    band_h = row_end - row_start
    split = row_start + max(1, band_h // 2)
    draw.rectangle([0, row_start, LIMB_W - 1, split - 1], fill=light)
    draw.rectangle([0, split, LIMB_W - 1, row_end - 1], fill=dark)
    img.save(OUT_DIR / f"{name}.png")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    make_hat("red-beanie-head", (196, 46, 46), forehead_coverage=0.35)
    make_hat("straw-hat-head", (222, 186, 111), forehead_coverage=0.55)
    make_hat("party-hat-head", (233, 92, 190), forehead_coverage=0.3)

    make_full_wrap("flannel-jacket-body", BODY_W, BODY_H, (139, 58, 58))
    make_full_wrap("flannel-jacket-arm", LIMB_W, LIMB_H, (139, 58, 58))
    make_full_wrap("rain-slicker-body", BODY_W, BODY_H, (235, 196, 33))
    make_full_wrap("rain-slicker-arm", LIMB_W, LIMB_H, (235, 196, 33))

    # Pants: upper 10 rows of the leg overlay (thigh down to shin).
    make_leg_band("overalls-leg", (61, 90, 128), row_start=0, row_end=11)
    make_leg_band("cargo-pants-leg", (91, 107, 78), row_start=0, row_end=11)

    # Shoes: lower rows of the leg overlay (ankle/foot) — drawn after pants
    # by the compositor since both target the same rect; each only paints
    # its own row range so they don't clobber each other.
    make_leg_band("rubber-boots-leg", (72, 72, 78), row_start=11, row_end=16)
    make_leg_band("sneakers-leg", (230, 230, 230), row_start=11, row_end=16)

    print(f"Wrote {len(list(OUT_DIR.glob('*.png')))} clothing textures to {OUT_DIR}")


if __name__ == "__main__":
    main()
