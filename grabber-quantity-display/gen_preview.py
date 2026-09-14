"""Generates preview.png (512x512) for the Steam Workshop listing.

Same technique as this repo's other mods (toggle-grab, grabber-safe-resize,
filtered-launcher): the real in-game Grabber sprite (dist/img/grabber_icon.png
from the vanilla game, extracted from app.asar), blown up with NEAREST to
keep the pixel-art look crisp, on a dark radial-glow background, with a
small hand-drawn diagram underneath explaining the mechanic - a partially
filled grid turning into the "held/capacity" number this mod adds. No
AI-generated imagery.

Run once with `python3 gen_preview.py` from this folder (grabber_icon.png
must sit next to it). Not needed at runtime.
"""

from PIL import Image, ImageDraw, ImageFont

W, H = 512, 512

BG_TOP = (18, 22, 34)
BG_BOTTOM = (8, 9, 14)
NEUTRAL_GLOW = (190, 195, 205)
YELLOW_GLOW = (255, 231, 0)
FILLED = (255, 231, 0)      # matches the in-game #ffe700 highlight color
EMPTY = (40, 44, 56)
GRID_OUTLINE = (150, 155, 165)
ARROW_COLOR = (140, 200, 235)


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


def draw_grid(draw, cx, cy, cols, rows, cell, filled_mask):
    w = cols * cell
    h = rows * cell
    x0 = cx - w // 2
    y0 = cy - h // 2
    for r in range(rows):
        for c in range(cols):
            x = x0 + c * cell
            y = y0 + r * cell
            color = FILLED if filled_mask[r][c] else EMPTY
            draw.rectangle([x, y, x + cell - 2, y + cell - 2], fill=color, outline=GRID_OUTLINE, width=1)
    return x0, y0, w, h


def draw_arrow_right(draw, cy, tip_x, length=54, width=12, color=ARROW_COLOR):
    head_w = 20
    head_h = width * 2
    shaft_left = tip_x - length
    shaft_right = tip_x - head_w
    draw.rectangle(
        [shaft_left, cy - width // 2, shaft_right, cy + width // 2],
        fill=color,
    )
    draw.polygon(
        [
            (tip_x, cy),
            (shaft_right, cy - head_h // 2),
            (shaft_right, cy + head_h // 2),
        ],
        fill=color,
    )


def build():
    base = vertical_gradient((W, H), BG_TOP, BG_BOTTOM).convert("RGBA")

    base.alpha_composite(radial_glow((W, H), (256, 150), 160, NEUTRAL_GLOW))

    sprite = scaled_sprite("grabber_icon.png", 8)
    paste_centered(base, sprite, 256, 150)

    draw = ImageDraw.Draw(base, "RGBA")

    # Partially filled 6x6 grid representing material held in the Grabber.
    mask = [
        [1, 1, 0, 1, 1, 0],
        [1, 1, 1, 1, 1, 1],
        [0, 1, 1, 1, 1, 0],
        [1, 1, 1, 1, 0, 1],
        [1, 0, 1, 1, 1, 1],
        [0, 1, 1, 0, 1, 1],
    ]
    filled_count = sum(sum(row) for row in mask)
    total = sum(len(row) for row in mask)

    grid_cx = 150
    grid_cy = 340
    draw_grid(draw, grid_cx, grid_cy, 6, 6, 26, mask)

    draw_arrow_right(draw, grid_cy, 300, length=60, width=14)

    # Glow behind the new quantity readout to draw the eye to it.
    base.alpha_composite(radial_glow((W, H), (395, 340), 110, YELLOW_GLOW, max_alpha=110))
    draw = ImageDraw.Draw(base, "RGBA")

    label = f"{filled_count}/{total}"
    font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 64)
    bbox = draw.textbbox((0, 0), label, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((395 - tw / 2 - bbox[0], grid_cy - th / 2 - bbox[1]), label, font=font, fill=FILLED)

    base.convert("RGB").save("preview.png")
    print("done -> preview.png", base.size)


if __name__ == "__main__":
    build()
