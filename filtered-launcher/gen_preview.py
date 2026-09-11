"""Generates preview.png (512x512) for the Steam Workshop listing.

Everything here is either the mod's own real sprite art (the same
filteredLauncher*.png / advancedFilteredLauncher*.png produced by
gen_sprites.py, which are themselves the actual vanilla Launcher sprite
with a hand-drawn bar+"F" mark - see that script's own docstring) or
simple flat shapes drawn with plain PIL primitives (rectangles,
polygons, radial gradients) - no AI-generated imagery anywhere. Same
technique/convention as this repo's other mods (toggle-grab,
grabber-safe-resize): real in-game sprite, blown up with NEAREST to
keep the pixel-art look crisp, on a dark radial-glow background, with a
small hand-drawn diagram underneath explaining the mechanic.

Run once with `python3 gen_preview.py` from this folder, after
gen_sprites.py has produced the sprite files it reads. Not needed at
runtime.
"""

from PIL import Image, ImageDraw

W, H = 512, 512

BG_TOP = (18, 22, 34)
BG_BOTTOM = (8, 9, 14)
NEUTRAL_GLOW = (190, 195, 205)
RED_GLOW = (210, 70, 60)
ALLOWED = (235, 205, 60)      # matches a typical "gold"-ish allowed resource
ALLOWED2 = (90, 190, 230)     # liquid/gas accent for the Advanced side
BLOCKED = (120, 110, 100)
GREEN_ARROW = (110, 220, 120)
RED_X = (220, 70, 60)
TILE_OUTLINE = (200, 200, 210)


def vertical_gradient(size, top, bottom):
    w, h = size
    img = Image.new("RGB", size)
    px = img.load()
    for y in range(h):
        t = y / (h - 1)
        row = tuple(int(top[c] + (bottom[c] - top[c]) * t) for c in range(3))
        for x in range(w):
            px[x, y] = row
    return img


def radial_glow(size, center, radius, color, max_alpha=140):
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    px = layer.load()
    cx, cy = center
    for y in range(max(0, cy - radius), min(size[1], cy + radius)):
        for x in range(max(0, cx - radius), min(size[0], cx + radius)):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if d <= radius:
                a = int(max_alpha * (1 - d / radius) ** 1.6)
                if a > 0:
                    px[x, y] = (*color, a)
    return layer


def scaled_sprite(path, factor):
    im = Image.open(path).convert("RGBA")
    return im.resize((im.width * factor, im.height * factor), Image.NEAREST)


def paste_centered(base, sprite, cx, cy):
    x = cx - sprite.width // 2
    y = cy - sprite.height // 2
    base.alpha_composite(sprite, (x, y))


def draw_arrow_up(draw, cx, tip_y, length=34, width=10, color=GREEN_ARROW):
    head_h = 14
    head_w = width * 2
    shaft_top = tip_y + head_h
    shaft_bottom = tip_y + length
    draw.rectangle(
        [cx - width // 2, shaft_top, cx + width // 2, shaft_bottom],
        fill=color,
    )
    draw.polygon(
        [
            (cx, tip_y),
            (cx - head_w // 2, shaft_top),
            (cx + head_w // 2, shaft_top),
        ],
        fill=color,
    )


def draw_x(draw, cx, cy, r=11, width=5, color=RED_X):
    draw.line([(cx - r, cy - r), (cx + r, cy + r)], fill=color, width=width)
    draw.line([(cx - r, cy + r), (cx + r, cy - r)], fill=color, width=width)


def draw_lane(base, cx, arrow_tip_y, allowed_colors, blocked=True):
    draw = ImageDraw.Draw(base)
    draw_arrow_up(draw, cx, arrow_tip_y, length=40, width=12)

    slot_y = arrow_tip_y + 14 + 40 + 22
    slots = list(allowed_colors) + ([("blocked", BLOCKED)] if blocked else [])
    spacing = 48
    start_x = cx - spacing * (len(slots) - 1) // 2
    for i, (kind, color) in enumerate(slots):
        sx = start_x + i * spacing
        sq = 30
        draw.rectangle(
            [sx - sq // 2, slot_y, sx + sq // 2, slot_y + sq],
            fill=color,
            outline=(0, 0, 0),
            width=2,
        )
        if kind == "blocked":
            draw_x(draw, sx, slot_y + sq // 2)


def build():
    base = vertical_gradient((W, H), BG_TOP, BG_BOTTOM).convert("RGBA")

    base.alpha_composite(radial_glow((W, H), (150, 165), 150, NEUTRAL_GLOW))
    base.alpha_composite(radial_glow((W, H), (362, 165), 150, RED_GLOW))

    plain = scaled_sprite("filteredLauncherUp.png", 9)
    advanced = scaled_sprite("advancedFilteredLauncherUp.png", 9)
    paste_centered(base, plain, 150, 165)
    paste_centered(base, advanced, 362, 165)

    draw_lane(base, 150, 300, [("allowed", ALLOWED)], blocked=True)
    draw_lane(base, 362, 300, [("allowed", ALLOWED), ("allowed2", ALLOWED2)], blocked=True)

    base.convert("RGB").save("preview.png")
    print("done -> preview.png", base.size)


if __name__ == "__main__":
    build()
