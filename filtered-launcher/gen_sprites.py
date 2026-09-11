"""Generates this mod's sprites (two families - plain and Advanced - three
segments each) by taking the actual vanilla Launcher art
(base_launcher_up.png / _left.png / _right.png - copied from the installed
game's dist/img/launcher*.png, included here so this script is reproducible
without a game install path hardcoded into it), drawing a crossbar + "F"
mark into the sprite's own transparent interior using only colors already
in the vanilla sprite (its black outline and gray frame band - no new
colors added), and, for the Advanced family only, stamping a few small red
marks on top of that same icon - same design, just with the red accent
that distinguishes it from the plain one.

Run once with `python3 gen_sprites.py` from this folder; not needed at
runtime, not referenced by main.js or modinfo.json - only its output
(filteredLauncherUp/Left/Right.png and
advancedFilteredLauncherUp/Left/Right.png) is. Re-run any time after
editing the coordinates below, or swap in different base_*.png files
entirely.
"""

from PIL import Image

BLACK = (0, 0, 0, 255)
GRAY = (122, 122, 122, 255)  # matches the vanilla sprite's own frame band
RED = (200, 30, 30, 255)  # Advanced-only accent - not present in the vanilla sprite

# "F", 3 wide x 5 tall, as (col, row) offsets from a top-left anchor.
F_GLYPH = [
    (0, 0), (1, 0), (2, 0),  # top bar
    (0, 1),
    (0, 2), (1, 2),  # middle bar
    (0, 3),
    (0, 4),
]


def draw_mark(img, bar_row, bar_cols, f_anchor):
    px = img.load()
    for x in range(bar_cols[0], bar_cols[1] + 1):
        px[x, bar_row] = GRAY
        px[x, bar_row + 1] = GRAY
    fx, fy = f_anchor
    for dx, dy in F_GLYPH:
        px[fx + dx, fy + dy] = BLACK


def stamp_dots(img, dots, color, size=2):
    px = img.load()
    for x, y in dots:
        for dx in range(size):
            for dy in range(size):
                px[x + dx, y + dy] = color


# All three sprites share the same 10x10 transparent interior box (cols
# 4-13) at the rows listed below - the vertical shaft stub both Left and
# Right converge into, and the whole body of Up - so the same bar/glyph
# coordinates line up on all three without needing to hand-fit the
# diagonal part of Left/Right. The red-dot spots (Advanced only) sit on the
# sprite's gray frame band instead, well clear of the bar/F.
SEGMENTS = [
    ("base_launcher_up.png", "Up", dict(bar_row=8, bar_cols=(3, 14), f_anchor=(7, 4)), [(3, 1), (13, 1), (1, 7)]),
    ("base_launcher_left.png", "Left", dict(bar_row=11, bar_cols=(3, 14), f_anchor=(7, 9)), [(2, 1), (11, 6), (2, 15)]),
    ("base_launcher_right.png", "Right", dict(bar_row=11, bar_cols=(3, 14), f_anchor=(7, 9)), [(13, 1), (3, 6), (13, 15)]),
]

for base_file, suffix, mark_args, red_dots in SEGMENTS:
    plain = Image.open(base_file).convert("RGBA")
    draw_mark(plain, **mark_args)
    plain.save(f"filteredLauncher{suffix}.png")

    advanced = plain.copy()
    stamp_dots(advanced, red_dots, RED)
    advanced.save(f"advancedFilteredLauncher{suffix}.png")

print("done")
