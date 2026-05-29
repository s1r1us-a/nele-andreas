# Item-Übersicht – Idle Abenteuer

> **Automatisch generiert** aus `adventure/js/data/itemTypes.js` (Single Source of Truth).
> Nicht von Hand editieren – Datendatei ändern und `node adventure/tools/gen-items-doc.mjs` neu ausführen.

Jeder Slot bietet **6 Item-Typen** mit eigenem Stat-Archetyp. Jeder Typ existiert in allen **6 Seltenheiten**:
Gewöhnlich · Ungewöhnlich · Seltene · Epische · Legendäre · Mythische.

- **StatMult** verschiebt den Primär-Stat (Schaden/Rüstung); <1 = mehr Fokus auf Affixe.
- **Affix-Bias** = Sekundär-Stats, die der Typ bevorzugt rollt.
- **Flavor (Episch+)** = ab Episch garantiert vorhandener Archetyp-Affix.
- Seltenheit hebt Werte (Multiplikator), Affix-Anzahl und ab Episch die Roll-Qualität; Legendär/Mythisch tragen zusätzlich einen Proc-Effekt.

## ⚔️ Waffen

### Waffe  ·  Primär: Schaden

| Typ | Variante | StatMult | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|
| Schwert | v0 | 1.0 | Schaden, Krit-Chance | Schaden |
| Dolch | v1 | 0.85 | Krit-Chance, Krit-Schaden, Angriffstempo | Krit-Chance |
| Streitkolben | v2 | 1.2 | Schaden, Vielseitigkeit | Schaden |
| Axt | v3 | 1.1 | Schaden, Lebensraub | Lebensraub |
| Speer | v4 | 1.05 | Vielseitigkeit, Angriffstempo | Vielseitigkeit |
| Kriegshammer | v5 | 1.25 | Schaden, Krit-Schaden | Krit-Schaden |

## 🛡️ Rüstung

### Kopf  ·  Primär: Rüstung

| Typ | Variante | StatMult | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|
| Platten-Helm | v0 | 1.1 | Rüstung, Block | Rüstung |
| Ketten-Helm | v1 | 1.0 | Rüstung, Lebenspunkte, Vielseitigkeit | Lebenspunkte |
| Leder-Helm | v2 | 0.9 | Ausweichen, Angriffstempo | Ausweichen |
| Schuppen-Helm | v3 | 1.05 | Rüstung, Block | Block |
| Gewand-Helm | v4 | 0.9 | Vielseitigkeit, Lebenspunkte | Vielseitigkeit |
| Drachen-Helm | v5 | 1.05 | Rüstung, Angriffstempo | Angriffstempo |

### Schultern  ·  Primär: Rüstung

| Typ | Variante | StatMult | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|
| Platten-Schulterplatten | v0 | 1.1 | Rüstung, Block | Rüstung |
| Ketten-Schulterplatten | v1 | 1.0 | Rüstung, Lebenspunkte, Vielseitigkeit | Lebenspunkte |
| Leder-Schulterplatten | v2 | 0.9 | Ausweichen, Angriffstempo | Ausweichen |
| Schuppen-Schulterplatten | v3 | 1.05 | Rüstung, Block | Block |
| Gewand-Schulterplatten | v4 | 0.9 | Vielseitigkeit, Lebenspunkte | Vielseitigkeit |
| Drachen-Schulterplatten | v5 | 1.05 | Rüstung, Angriffstempo | Angriffstempo |

### Brust  ·  Primär: Rüstung

| Typ | Variante | StatMult | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|
| Platten-Brustpanzer | v0 | 1.1 | Rüstung, Block | Rüstung |
| Ketten-Brustpanzer | v1 | 1.0 | Rüstung, Lebenspunkte, Vielseitigkeit | Lebenspunkte |
| Leder-Brustpanzer | v2 | 0.9 | Ausweichen, Angriffstempo | Ausweichen |
| Schuppen-Brustpanzer | v3 | 1.05 | Rüstung, Block | Block |
| Gewand-Brustpanzer | v4 | 0.9 | Vielseitigkeit, Lebenspunkte | Vielseitigkeit |
| Drachen-Brustpanzer | v5 | 1.05 | Rüstung, Angriffstempo | Angriffstempo |

### Hände  ·  Primär: Rüstung

| Typ | Variante | StatMult | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|
| Platten-Handschuhe | v0 | 1.1 | Rüstung, Block | Rüstung |
| Ketten-Handschuhe | v1 | 1.0 | Rüstung, Lebenspunkte, Vielseitigkeit | Lebenspunkte |
| Leder-Handschuhe | v2 | 0.9 | Ausweichen, Angriffstempo | Ausweichen |
| Schuppen-Handschuhe | v3 | 1.05 | Rüstung, Block | Block |
| Gewand-Handschuhe | v4 | 0.9 | Vielseitigkeit, Lebenspunkte | Vielseitigkeit |
| Drachen-Handschuhe | v5 | 1.05 | Rüstung, Angriffstempo | Angriffstempo |

### Beine  ·  Primär: Rüstung

| Typ | Variante | StatMult | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|
| Platten-Beinschienen | v0 | 1.1 | Rüstung, Block | Rüstung |
| Ketten-Beinschienen | v1 | 1.0 | Rüstung, Lebenspunkte, Vielseitigkeit | Lebenspunkte |
| Leder-Beinschienen | v2 | 0.9 | Ausweichen, Angriffstempo | Ausweichen |
| Schuppen-Beinschienen | v3 | 1.05 | Rüstung, Block | Block |
| Gewand-Beinschienen | v4 | 0.9 | Vielseitigkeit, Lebenspunkte | Vielseitigkeit |
| Drachen-Beinschienen | v5 | 1.05 | Rüstung, Angriffstempo | Angriffstempo |

### Füße  ·  Primär: Rüstung

| Typ | Variante | StatMult | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|
| Platten-Stiefel | v0 | 1.1 | Rüstung, Block | Rüstung |
| Ketten-Stiefel | v1 | 1.0 | Rüstung, Lebenspunkte, Vielseitigkeit | Lebenspunkte |
| Leder-Stiefel | v2 | 0.9 | Ausweichen, Angriffstempo | Ausweichen |
| Schuppen-Stiefel | v3 | 1.05 | Rüstung, Block | Block |
| Gewand-Stiefel | v4 | 0.9 | Vielseitigkeit, Lebenspunkte | Vielseitigkeit |
| Drachen-Stiefel | v5 | 1.05 | Rüstung, Angriffstempo | Angriffstempo |

### Umhang  ·  Primär: Rüstung

| Typ | Variante | StatMult | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|
| Platten-Umhang | v0 | 1.1 | Rüstung, Block | Rüstung |
| Ketten-Umhang | v1 | 1.0 | Rüstung, Lebenspunkte, Vielseitigkeit | Lebenspunkte |
| Leder-Umhang | v2 | 0.9 | Ausweichen, Angriffstempo | Ausweichen |
| Schuppen-Umhang | v3 | 1.05 | Rüstung, Block | Block |
| Gewand-Umhang | v4 | 0.9 | Vielseitigkeit, Lebenspunkte | Vielseitigkeit |
| Drachen-Umhang | v5 | 1.05 | Rüstung, Angriffstempo | Angriffstempo |

### Schild  ·  Primär: Rüstung

| Typ | Variante | StatMult | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|
| Turmschild | v0 | 1.1 | Rüstung, Block | Block |
| Rundschild | v1 | 1.0 | Rüstung, Dornen | Dornen |
| Buckler | v2 | 0.9 | Ausweichen, Block | Ausweichen |
| Pavese | v3 | 1.15 | Rüstung, Lebenspunkte | Lebenspunkte |
| Spiegelschild | v4 | 1.0 | Block, Ausweichen | Block |
| Drachenschild | v5 | 1.05 | Rüstung, Dornen | Rüstung |

## 💍 Schmuck

### Amulett  ·  Primär: Rüstung

| Typ | Variante | StatMult | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|
| Kriegsamulett | v0 | 1.0 | Schaden, Krit-Schaden | Krit-Schaden |
| Lebensamulett | v1 | 1.0 | Lebenspunkte, Lebensraub | Lebenspunkte |
| Schutzamulett | v2 | 1.0 | Rüstung, Vielseitigkeit | Vielseitigkeit |
| Krit-Amulett | v3 | 1.0 | Krit-Chance, Krit-Schaden | Krit-Chance |
| Tempo-Amulett | v4 | 1.0 | Angriffstempo, Ausweichen | Angriffstempo |
| Räuber-Amulett | v5 | 1.0 | Lebensraub, Krit-Chance | Lebensraub |

### Ring 1 & 2  ·  Primär: Rüstung

| Typ | Variante | StatMult | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|
| Siegelring | v0 | 1.0 | Krit-Chance, Krit-Schaden | Krit-Chance |
| Bluttropfen-Ring | v1 | 1.0 | Lebensraub, Lebenspunkte | Lebensraub |
| Wächterring | v2 | 1.0 | Rüstung, Ausweichen | Ausweichen |
| Macht-Ring | v3 | 1.0 | Schaden, Krit-Schaden | Krit-Schaden |
| Vitalring | v4 | 1.0 | Lebenspunkte, Rüstung | Lebenspunkte |
| Talisman | v5 | 1.0 | Vielseitigkeit, Angriffstempo | Vielseitigkeit |

---

**Summe:** 66 Basis-Typen × 6 Seltenheiten = 396 Item-Ausprägungen.

> Sprites: `icon_<slot>_<variante>.png` (0–5). Waffen besitzen je Variante eine eigene Form
> (Schwert/Dolch/Streitkolben/Axt/Speer/Kriegshammer); übrige Slots unterscheiden sich per Material-Farbe.
