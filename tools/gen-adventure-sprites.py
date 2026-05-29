#!/usr/bin/env python3
"""
Generator für die Pixelart-Sprites des Idle-Abenteuerspiels (abenteuer.html).

Zeichnet alle Grafiken deterministisch (fester Seed) auf ein kleines Raster und
skaliert sie mit Nearest-Neighbour hoch -> scharfer Pixellook, keine externen
Asset-Dateien nötig. Ergebnis landet in ../adventure-assets/.

Aufruf:   python3 tools/gen-adventure-sprites.py
Benötigt: Pillow  (pip install Pillow)
"""

import os
import random

from PIL import Image, ImageDraw

# ---------------------------------------------------------------------------
# Grundlagen
# ---------------------------------------------------------------------------
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "adventure-assets"))
os.makedirs(OUT, exist_ok=True)

SEED = 1337
ICON_GRID = 24          # Item-Icons: 24x24 Raster
ICON_SCALE = 4          # -> 96x96 px Ausgabe
CHAR_GRID_W = 32        # Charakter: 32x40 Raster
CHAR_GRID_H = 40
CHAR_SCALE = 6          # -> 192x240 px Ausgabe
TRANSPARENT = (0, 0, 0, 0)


def new_buf(w, h):
    return Image.new("RGBA", (w, h), TRANSPARENT)


def save(img, scale, name):
    out = img.resize((img.width * scale, img.height * scale), Image.NEAREST)
    out.save(os.path.join(OUT, name))
    print("  ->", name, out.size)


def shade(color, f):
    """Helligkeit anpassen (f<1 dunkler, f>1 heller), Alpha bleibt."""
    r, g, b = color[:3]
    a = color[3] if len(color) == 4 else 255
    return (
        max(0, min(255, int(r * f))),
        max(0, min(255, int(g * f))),
        max(0, min(255, int(b * f))),
        a,
    )


# Materialpaletten (für Varianten)
METALS = {
    "iron":   (170, 178, 190, 255),
    "steel":  (200, 208, 220, 255),
    "bronze": (196, 142, 78, 255),
    "gold":   (222, 184, 92, 255),
    "dark":   (96, 102, 120, 255),
}
LEATHERS = {
    "brown":  (132, 92, 56, 255),
    "tan":    (170, 130, 84, 255),
    "red":    (150, 64, 56, 255),
    "green":  (86, 110, 64, 255),
    "purple": (104, 78, 132, 255),
}
GEMS = {
    "ruby":   (210, 48, 64, 255),
    "saph":   (60, 110, 220, 255),
    "emer":   (52, 190, 120, 255),
    "amet":   (170, 92, 220, 255),
    "topaz":  (236, 196, 70, 255),
}

VARIANT_COUNT = 4  # Anzahl Varianten je Slot-Typ


# ---------------------------------------------------------------------------
# Zeichen-Helfer (arbeiten auf dem kleinen Raster via ImageDraw)
# ---------------------------------------------------------------------------
def rect(d, x0, y0, x1, y1, color):
    d.rectangle([x0, y0, x1, y1], fill=color)


def outline_rect(d, x0, y0, x1, y1, fill, line):
    d.rectangle([x0, y0, x1, y1], fill=fill, outline=line)


# --- Item-Icons -------------------------------------------------------------
def draw_sword(d, metal):
    base = METALS[metal]
    hi, lo = shade(base, 1.25), shade(base, 0.7)
    guard = METALS["gold"]
    grip = LEATHERS["brown"]
    # Klinge (diagonal)
    for i in range(13):
        x = 5 + i
        y = 17 - i
        rect(d, x, y, x + 1, y + 1, base)
        rect(d, x, y, x, y, hi)
        rect(d, x + 1, y + 1, x + 1, y + 1, lo)
    # Spitze
    rect(d, 18, 4, 19, 5, hi)
    # Parierstange
    rect(d, 3, 16, 9, 17, guard)
    rect(d, 3, 16, 9, 16, shade(guard, 1.2))
    # Griff
    rect(d, 4, 18, 6, 21, grip)
    # Knauf
    rect(d, 3, 21, 7, 22, guard)


def draw_helmet(d, metal):
    base = METALS[metal]
    hi, lo = shade(base, 1.25), shade(base, 0.68)
    # Helmkuppel
    d.ellipse([5, 4, 18, 16], fill=base)
    rect(d, 5, 11, 18, 17, base)
    # Schattierung
    d.ellipse([6, 5, 12, 12], fill=hi)
    rect(d, 5, 16, 18, 18, lo)
    # Visierschlitz
    rect(d, 7, 12, 16, 13, shade(base, 0.4))
    # Helmkamm
    rect(d, 11, 2, 12, 5, METALS["gold"])


def draw_chest(d, metal):
    base = METALS[metal]
    hi, lo = shade(base, 1.2), shade(base, 0.7)
    # Brustpanzer
    outline_rect(d, 5, 5, 18, 18, base, lo)
    # Schulterwölbung
    d.ellipse([3, 5, 9, 11], fill=base)
    d.ellipse([14, 5, 20, 11], fill=base)
    # Mittelgrat + Glanz
    rect(d, 11, 6, 12, 17, hi)
    rect(d, 7, 7, 9, 9, hi)
    # Nieten
    for ny in (8, 12, 16):
        rect(d, 6, ny, 6, ny, METALS["gold"])
        rect(d, 17, ny, 17, ny, METALS["gold"])


def draw_shoulders(d, metal):
    base = METALS[metal]
    hi, lo = shade(base, 1.22), shade(base, 0.68)
    # zwei Schulterplatten
    d.ellipse([2, 8, 11, 16], fill=base)
    d.ellipse([12, 8, 21, 16], fill=base)
    d.ellipse([3, 9, 7, 12], fill=hi)
    d.ellipse([14, 9, 18, 12], fill=hi)
    rect(d, 2, 15, 21, 16, lo)
    # Stacheln
    rect(d, 5, 5, 6, 8, METALS["gold"])
    rect(d, 17, 5, 18, 8, METALS["gold"])


def draw_gloves(d, leather):
    base = LEATHERS[leather]
    hi, lo = shade(base, 1.2), shade(base, 0.7)
    metal = METALS["steel"]
    # Handschuh
    rect(d, 6, 8, 16, 18, base)
    rect(d, 6, 8, 16, 9, hi)
    # Finger
    for fx in (7, 10, 13):
        rect(d, fx, 5, fx + 1, 8, base)
    rect(d, 5, 9, 6, 13, base)  # Daumen
    # Stulpe (Metall)
    rect(d, 6, 16, 16, 19, metal)
    rect(d, 6, 18, 16, 19, lo)


def draw_legs(d, metal):
    base = METALS[metal]
    hi, lo = shade(base, 1.2), shade(base, 0.7)
    leather = LEATHERS["brown"]
    # Gürtel
    rect(d, 5, 5, 18, 7, leather)
    rect(d, 10, 5, 13, 7, METALS["gold"])
    # zwei Beinschienen
    rect(d, 6, 7, 10, 19, base)
    rect(d, 13, 7, 17, 19, base)
    rect(d, 6, 7, 7, 19, hi)
    rect(d, 13, 7, 14, 19, hi)
    rect(d, 9, 7, 10, 19, lo)
    rect(d, 16, 7, 17, 19, lo)


def draw_boots(d, leather):
    base = LEATHERS[leather]
    hi, lo = shade(base, 1.2), shade(base, 0.65)
    metal = METALS["steel"]
    # Schaft
    rect(d, 7, 4, 12, 14, base)
    rect(d, 7, 4, 8, 14, hi)
    # Fuß
    rect(d, 5, 14, 16, 18, base)
    rect(d, 5, 17, 16, 18, lo)
    # Metallkappe
    rect(d, 13, 14, 16, 18, metal)
    # Schnalle
    rect(d, 8, 8, 11, 9, metal)


def draw_cloak(d, leather):
    base = LEATHERS[leather]
    hi, lo = shade(base, 1.2), shade(base, 0.68)
    # Umhang trapezförmig
    for y in range(5, 20):
        w = 3 + (y - 5)
        rect(d, 12 - w // 2, y, 12 + w // 2, y, base)
    rect(d, 11, 5, 12, 19, hi)
    rect(d, 5, 18, 19, 19, lo)
    # Kragenspange
    rect(d, 9, 4, 14, 6, METALS["gold"])


def draw_amulet(d, gem):
    chain = METALS["gold"]
    g = GEMS[gem]
    hi = shade(g, 1.4)
    # Kette
    for i in range(7):
        rect(d, 5 + i, 4 + i, 5 + i, 4 + i, chain)
        rect(d, 18 - i, 4 + i, 18 - i, 4 + i, chain)
    # Anhänger-Fassung
    d.ellipse([8, 11, 16, 19], fill=chain)
    # Edelstein
    d.ellipse([9, 12, 15, 18], fill=g)
    rect(d, 10, 13, 11, 14, hi)


def draw_ring(d, gem):
    band = METALS["gold"]
    g = GEMS[gem]
    hi = shade(g, 1.4)
    # Ringband (äußere Ellipse füllen, innere ausstanzen)
    d.ellipse([6, 8, 18, 20], fill=band)
    d.ellipse([9, 11, 15, 17], fill=TRANSPARENT)
    d.ellipse([7, 9, 13, 14], outline=shade(band, 1.3))
    # Stein oben
    d.ellipse([9, 4, 15, 11], fill=g)
    rect(d, 10, 6, 11, 7, hi)


def draw_shield(d, metal):
    base = METALS[metal]
    hi, lo = shade(base, 1.2), shade(base, 0.68)
    rim = METALS["gold"]
    # Wappenschild-Form
    pts = [(11, 3), (19, 6), (19, 13), (11, 21), (3, 13), (3, 6)]
    d.polygon(pts, fill=base, outline=rim)
    # Glanz
    d.polygon([(11, 4), (8, 6), (8, 12), (11, 16)], fill=hi)
    d.polygon([(11, 16), (15, 12), (15, 6)], fill=lo)
    # Buckel
    d.ellipse([9, 9, 13, 13], fill=rim)


ICON_DRAWERS = {
    "waffe":     (draw_sword, list(METALS.keys())),
    "kopf":      (draw_helmet, list(METALS.keys())),
    "brust":     (draw_chest, list(METALS.keys())),
    "schultern": (draw_shoulders, list(METALS.keys())),
    "haende":    (draw_gloves, list(LEATHERS.keys())),
    "beine":     (draw_legs, list(METALS.keys())),
    "fuesse":    (draw_boots, list(LEATHERS.keys())),
    "umhang":    (draw_cloak, list(LEATHERS.keys())),
    "amulett":   (draw_amulet, list(GEMS.keys())),
    "ring":      (draw_ring, list(GEMS.keys())),
    "schild":    (draw_shield, list(METALS.keys())),
}


def gen_icons():
    print("Item-Icons:")
    for slot, (drawer, mats) in ICON_DRAWERS.items():
        for v in range(VARIANT_COUNT):
            buf = new_buf(ICON_GRID, ICON_GRID)
            d = ImageDraw.Draw(buf)
            mat = mats[v % len(mats)]
            drawer(d, mat)
            save(buf, ICON_SCALE, f"icon_{slot}_{v}.png")


# --- Charakter --------------------------------------------------------------
def draw_character(tier):
    """tier 0..3: zunehmend bessere Ausrüstung (Farbe/Details)."""
    buf = new_buf(CHAR_GRID_W, CHAR_GRID_H)
    d = ImageDraw.Draw(buf)
    cx = CHAR_GRID_W // 2

    skin = (224, 178, 142, 255)
    skin_lo = shade(skin, 0.85)
    hair = (78, 52, 36, 255)

    armor_by_tier = [
        LEATHERS["brown"],
        METALS["iron"],
        METALS["steel"],
        METALS["gold"],
    ]
    armor = armor_by_tier[tier]
    a_hi, a_lo = shade(armor, 1.2), shade(armor, 0.7)
    pants = shade(LEATHERS["brown"], 0.9)

    # Kopf
    rect(d, cx - 4, 4, cx + 3, 11, skin)
    rect(d, cx + 2, 5, cx + 3, 11, skin_lo)
    # Haare
    rect(d, cx - 5, 2, cx + 4, 5, hair)
    rect(d, cx - 5, 5, cx - 4, 8, hair)
    rect(d, cx + 3, 5, cx + 4, 8, hair)
    # Augen
    rect(d, cx - 2, 7, cx - 2, 8, (40, 40, 60, 255))
    rect(d, cx + 1, 7, cx + 1, 8, (40, 40, 60, 255))

    # Torso (Rüstung)
    rect(d, cx - 6, 12, cx + 5, 24, armor)
    rect(d, cx - 6, 12, cx - 5, 24, a_hi)
    rect(d, cx + 4, 12, cx + 5, 24, a_lo)
    # Schulterplatten ab tier1
    if tier >= 1:
        d.ellipse([cx - 9, 11, cx - 4, 16], fill=armor)
        d.ellipse([cx + 3, 11, cx + 8, 16], fill=armor)
    # Brustemblem ab tier2
    if tier >= 2:
        d.ellipse([cx - 2, 15, cx + 2, 20], fill=METALS["gold"])
    # Gürtel
    rect(d, cx - 6, 22, cx + 5, 24, shade(LEATHERS["brown"], 1.1))
    rect(d, cx - 1, 22, cx + 1, 24, METALS["gold"])

    # Arme
    rect(d, cx - 9, 13, cx - 7, 23, skin)
    rect(d, cx + 6, 13, cx + 8, 23, skin)
    # Handschuhe
    rect(d, cx - 9, 21, cx - 7, 24, armor)
    rect(d, cx + 6, 21, cx + 8, 24, armor)

    # Beine
    rect(d, cx - 5, 24, cx - 1, 34, pants)
    rect(d, cx + 1, 24, cx + 5, 34, pants)
    # Stiefel
    rect(d, cx - 6, 33, cx - 1, 37, shade(LEATHERS["brown"], 0.7))
    rect(d, cx + 1, 33, cx + 6, 37, shade(LEATHERS["brown"], 0.7))

    # Schwert in der Hand (rechts) ab tier0
    sw = METALS["steel"] if tier >= 2 else METALS["iron"]
    for i in range(10):
        rect(d, cx + 7 + i // 3, 22 - i, cx + 8 + i // 3, 23 - i, sw)
    rect(d, cx + 6, 22, cx + 10, 23, METALS["gold"])  # Parierstange

    save(buf, CHAR_SCALE, f"char_tier{tier}.png")


def gen_characters():
    print("Charaktere:")
    for t in range(4):
        draw_character(t)


# --- Bosse ------------------------------------------------------------------
BOSS_GRID = 40
BOSS_SCALE = 5  # -> 200x200 px


def _eyes(d, xs, y, color=(255, 60, 60, 255), glow=(255, 180, 120, 255)):
    for x in xs:
        rect(d, x, y, x + 1, y + 1, color)
        rect(d, x, y, x, y, glow)


def draw_boss_goblin(d):
    skin = (96, 150, 70, 255); hi = shade(skin, 1.25); lo = shade(skin, 0.7)
    # Körper
    d.ellipse([12, 20, 28, 36], fill=skin)
    rect(d, 13, 26, 27, 36, skin)
    # Kopf
    d.ellipse([10, 6, 30, 24], fill=skin)
    d.ellipse([12, 8, 20, 16], fill=hi)
    # Ohren
    d.polygon([(10, 12), (3, 8), (9, 18)], fill=skin)
    d.polygon([(30, 12), (37, 8), (31, 18)], fill=skin)
    # Augen + Zähne
    _eyes(d, [15, 23], 13)
    rect(d, 16, 19, 24, 21, (40, 30, 20, 255))
    rect(d, 17, 21, 18, 22, (240, 240, 220, 255))
    rect(d, 22, 21, 23, 22, (240, 240, 220, 255))
    # Arme
    rect(d, 6, 22, 12, 26, lo); rect(d, 28, 22, 34, 26, lo)
    # Keule
    rect(d, 32, 10, 35, 24, LEATHERS["brown"])
    d.ellipse([30, 6, 38, 14], fill=shade(LEATHERS["brown"], 1.1))
    # Beine
    rect(d, 14, 35, 19, 39, lo); rect(d, 21, 35, 26, 39, lo)


def draw_boss_spider(d):
    body = (54, 44, 64, 255); hi = shade(body, 1.4); leg = shade(body, 0.7)
    # Hinterleib + Kopf
    d.ellipse([12, 14, 30, 34], fill=body)
    d.ellipse([15, 8, 27, 20], fill=body)
    d.ellipse([17, 10, 22, 14], fill=hi)
    # Beine (je 4 pro Seite)
    for i, yy in enumerate((16, 20, 24, 28)):
        d.line([(13, yy), (3, yy - 4 + i*2)], fill=leg, width=2)
        d.line([(29, yy), (39, yy - 4 + i*2)], fill=leg, width=2)
    # Augen (mehrere rote)
    _eyes(d, [17, 20, 23], 11)
    _eyes(d, [18, 22], 14)
    # Reißzähne
    rect(d, 19, 19, 19, 21, (220, 220, 220, 255))
    rect(d, 22, 19, 22, 21, (220, 220, 220, 255))


def draw_boss_troll(d):
    skin = (120, 110, 96, 255); hi = shade(skin, 1.2); lo = shade(skin, 0.7)
    # Massiger Körper
    rect(d, 11, 18, 29, 37, skin)
    d.ellipse([9, 16, 31, 30], fill=skin)
    # Kopf
    d.ellipse([13, 4, 27, 20], fill=skin)
    d.ellipse([15, 6, 21, 12], fill=hi)
    # Hörner
    d.polygon([(13, 6), (9, 1), (15, 4)], fill=(230, 225, 210, 255))
    d.polygon([(27, 6), (31, 1), (25, 4)], fill=(230, 225, 210, 255))
    # Augen + Unterbiss
    _eyes(d, [16, 23], 10, color=(255, 210, 80, 255))
    rect(d, 17, 16, 18, 18, (240, 240, 220, 255))
    rect(d, 22, 16, 23, 18, (240, 240, 220, 255))
    # Riesige Arme/Fäuste
    rect(d, 4, 20, 11, 26, lo); d.ellipse([3, 24, 12, 33], fill=skin)
    rect(d, 29, 20, 36, 26, lo); d.ellipse([28, 24, 37, 33], fill=skin)
    # Beine
    rect(d, 13, 36, 19, 39, lo); rect(d, 21, 36, 27, 39, lo)


def draw_boss_dragon(d):
    body = (170, 60, 40, 255); hi = shade(body, 1.3); lo = shade(body, 0.65)
    belly = (230, 170, 90, 255)
    # Körper
    d.ellipse([12, 16, 30, 36], fill=body)
    rect(d, 16, 30, 26, 36, belly)
    # Flügel
    d.polygon([(12, 18), (2, 8), (4, 24)], fill=lo)
    d.polygon([(30, 18), (40, 8), (38, 24)], fill=lo)
    d.polygon([(12, 18), (4, 12), (6, 22)], fill=body)
    d.polygon([(30, 18), (38, 12), (36, 22)], fill=body)
    # Hals + Kopf
    rect(d, 19, 8, 25, 18, body)
    d.ellipse([18, 2, 30, 14], fill=body)
    d.polygon([(28, 6), (37, 6), (28, 12)], fill=hi)  # Schnauze
    # Hörner + Auge
    d.polygon([(20, 3), (18, -1), (23, 3)], fill=(240, 230, 210, 255))
    _eyes(d, [24], 6, color=(255, 230, 90, 255))
    # Feuer-Glut am Maul
    rect(d, 36, 8, 38, 10, (255, 200, 80, 255))
    # Beine
    rect(d, 14, 35, 18, 39, lo); rect(d, 23, 35, 27, 39, lo)


def draw_boss_golem(d):
    ice = (170, 210, 235, 255); hi = (225, 240, 250, 255); lo = shade(ice, 0.75)
    # Blockiger Körper
    rect(d, 11, 16, 29, 36, ice)
    rect(d, 11, 16, 14, 36, hi)
    rect(d, 26, 16, 29, 36, lo)
    # Kopf
    rect(d, 15, 5, 25, 16, ice)
    rect(d, 15, 5, 17, 16, hi)
    # Eiskristalle (Schultern/Kopf)
    d.polygon([(13, 16), (9, 6), (17, 14)], fill=hi)
    d.polygon([(27, 16), (31, 6), (23, 14)], fill=hi)
    d.polygon([(20, 5), (18, -2), (22, -2)], fill=hi)
    # Augen
    _eyes(d, [17, 22], 9, color=(80, 200, 255, 255), glow=(200, 240, 255, 255))
    # Arme
    rect(d, 5, 18, 11, 24, ice); rect(d, 29, 18, 35, 24, ice)
    d.ellipse([3, 22, 11, 30], fill=ice); d.ellipse([29, 22, 37, 30], fill=ice)
    # Beine
    rect(d, 13, 35, 19, 39, lo); rect(d, 21, 35, 27, 39, lo)
    # Riss-Linien
    d.line([(20, 16), (20, 34)], fill=lo)


BOSS_DRAWERS = [draw_boss_goblin, draw_boss_spider, draw_boss_troll,
                draw_boss_dragon, draw_boss_golem]


def gen_bosses():
    print("Bosse:")
    for i, drawer in enumerate(BOSS_DRAWERS):
        buf = new_buf(BOSS_GRID, BOSS_GRID)
        d = ImageDraw.Draw(buf)
        drawer(d)
        save(buf, BOSS_SCALE, f"boss_{i}.png")


# --- Hintergründe -----------------------------------------------------------
def gen_backgrounds():
    print("Hintergründe:")
    zones = [
        # (name, himmel oben, himmel unten, boden)
        ("wiese",   (150, 200, 240), (200, 230, 250), (96, 150, 70)),
        ("wald",    (120, 160, 150), (160, 190, 170), (60, 96, 56)),
        ("hoehle",  (40, 36, 56),    (70, 60, 90),     (52, 46, 64)),
        ("vulkan",  (90, 40, 40),    (160, 80, 50),    (70, 40, 38)),
        ("eis",     (170, 200, 230), (210, 230, 245),  (200, 220, 240)),
    ]
    W, H = 320, 180
    for i, (name, top, bot, ground) in enumerate(zones):
        img = Image.new("RGBA", (W, H), (0, 0, 0, 255))
        d = ImageDraw.Draw(img)
        # Himmel-Verlauf
        for y in range(H):
            t = y / H
            col = tuple(int(top[c] + (bot[c] - top[c]) * t) for c in range(3))
            d.line([(0, y), (W, y)], fill=col + (255,))
        # ferne Berge / Strukturen
        rng = random.Random(SEED + i)
        hill = shade(ground + (255,), 1.25)
        for hx in range(0, W + 40, 60):
            hh = rng.randint(30, 70)
            d.polygon([(hx - 30, H - 40), (hx, H - 40 - hh), (hx + 30, H - 40)],
                      fill=hill)
        # Boden
        rect(d, 0, H - 40, W, H, ground + (255,))
        rect(d, 0, H - 40, W, H - 36, shade(ground + (255,), 1.3))
        # Boden-Pixel-Tupfer
        for _ in range(120):
            px_ = rng.randint(0, W - 1)
            py = rng.randint(H - 38, H - 2)
            d.point((px_, py), fill=shade(ground + (255,), rng.choice([0.8, 1.2])))
        img.save(os.path.join(OUT, f"bg_zone_{i}.png"))
        print("  -> bg_zone_%d.png (%s)" % (i, name), img.size)


# ---------------------------------------------------------------------------
def main():
    random.seed(SEED)
    print("Schreibe nach:", OUT)
    gen_icons()
    gen_characters()
    gen_bosses()
    gen_backgrounds()
    print("Fertig.")


if __name__ == "__main__":
    main()
