# Item-Übersicht – Idle Abenteuer

> **Automatisch generiert** aus den Daten-Dateien (Single Source of Truth).
> Nicht von Hand editieren – Datendatei ändern und `node adventure/tools/gen-items-doc.mjs` neu ausführen.

## 🧙 Klassen & Rüstungsmaterialien

Die bei der Erstellung gewählte **Klasse** ist dauerhaft und bestimmt, welche Rüstungsmaterialien getragen werden dürfen und welche Schadensschule zählt.

| Klasse | Schule | Tragbare Materialien | Schadens-× | Heil-× |
|---|---|---|---|---|
| ✨ Heiler | magisch | Stoff | 0.65× | 1.6× |
| ⚔️ Kämpfer | physisch | Stoff, Leder | 1× | 1× |
| 🛡️ Verteidiger | physisch | Stoff, Leder, Platte | 0.7× | 1× |

Rüstung gibt es in **3 Materialien**: **Stoff** (kaum Rüstung, magisch), **Leder** (mehr Rüstung, physisch), **Platte** (sehr viel Rüstung, wenig Schaden).

## ✨ Seltenheiten

Seltenheit hebt den Primärwert (Multiplikator), die Affix-Anzahl und ab Episch die Roll-Qualität; Legendär/Mythisch tragen zusätzlich einen Proc-Effekt.

| Seltenheit | Wert-× | Drop-Gewicht | Affixe | Basis-Goldwert |
|---|---|---|---|---|
| Gewöhnlich | 1× | 60 | 0 | 0 |
| Ungewöhnlich | 1.4× | 25 | 1 | 1000 |
| Seltene | 1.9× | 10 | 2 | 2000 |
| Epische | 2.6× | 4 | 2–3 | 3000 |
| Legendäre | 3.5× | 1 | 3 | 4000 |
| Mythische | 4.7× | 0.18 | 4 | 5000 |

## 📋 Alle Gegenstände (Beispielwerte @ Gegenstandsstufe 50, Qualität 100 %)

Der **Primärwert** (Schaden bzw. Rüstung) skaliert mit Gegenstandsstufe und Seltenheit. Hier je Typ der Wert bei Stufe 50 für **Gewöhnlich** und **Episch** zum Vergleich.

### ⚔️ Waffen

#### Waffe  ·  Primär: Schaden

| Typ | Variante | StatMult | Schaden (Gew./Epis.) | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|---|
| Schwert | v0 | 1.0 | 56 / 146 | Schaden, Physischer Krit | Schaden |
| Dolch | v1 | 0.85 | 48 / 124 | Physischer Krit, Krit-Schaden, Angriffstempo | Physischer Krit |
| Streitkolben | v2 | 1.2 | 67 / 175 | Schaden, Vielseitigkeit | Schaden |
| Axt | v3 | 1.1 | 62 / 160 | Schaden, Lebensraub | Lebensraub |
| Speer | v4 | 1.05 | 59 / 153 | Vielseitigkeit, Angriffstempo | Vielseitigkeit |
| Kriegshammer | v5 | 1.25 | 70 / 182 | Schaden, Krit-Schaden | Krit-Schaden |

### 🛡️ Rüstung

#### Kopf  ·  Primär: Rüstung

| Typ | Material | Tragbar | StatMult | Rüstung (Gew./Epis.) | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|---|---|
| Stoff-Helm | Stoff | Heiler, Kämpfer, Verteidiger | 0.55 | 23 / 60 | Magischer Krit, Vielseitigkeit, Lebenspunkte | Magischer Krit |
| Leder-Helm | Leder | Kämpfer, Verteidiger | 0.95 | 40 / 104 | Ausweichen, Physischer Krit, Angriffstempo | Physischer Krit |
| Platte-Helm | Platte | Verteidiger | 1.45 | 61 / 158 | Rüstung, Block, Lebenspunkte | Rüstung |

#### Schultern  ·  Primär: Rüstung

| Typ | Material | Tragbar | StatMult | Rüstung (Gew./Epis.) | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|---|---|
| Stoff-Schulterplatten | Stoff | Heiler, Kämpfer, Verteidiger | 0.55 | 23 / 60 | Magischer Krit, Vielseitigkeit, Lebenspunkte | Magischer Krit |
| Leder-Schulterplatten | Leder | Kämpfer, Verteidiger | 0.95 | 40 / 104 | Ausweichen, Physischer Krit, Angriffstempo | Physischer Krit |
| Platte-Schulterplatten | Platte | Verteidiger | 1.45 | 61 / 158 | Rüstung, Block, Lebenspunkte | Rüstung |

#### Brust  ·  Primär: Rüstung

| Typ | Material | Tragbar | StatMult | Rüstung (Gew./Epis.) | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|---|---|
| Stoff-Brustpanzer | Stoff | Heiler, Kämpfer, Verteidiger | 0.55 | 23 / 60 | Magischer Krit, Vielseitigkeit, Lebenspunkte | Magischer Krit |
| Leder-Brustpanzer | Leder | Kämpfer, Verteidiger | 0.95 | 40 / 104 | Ausweichen, Physischer Krit, Angriffstempo | Physischer Krit |
| Platte-Brustpanzer | Platte | Verteidiger | 1.45 | 61 / 158 | Rüstung, Block, Lebenspunkte | Rüstung |

#### Hände  ·  Primär: Rüstung

| Typ | Material | Tragbar | StatMult | Rüstung (Gew./Epis.) | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|---|---|
| Stoff-Handschuhe | Stoff | Heiler, Kämpfer, Verteidiger | 0.55 | 23 / 60 | Magischer Krit, Vielseitigkeit, Lebenspunkte | Magischer Krit |
| Leder-Handschuhe | Leder | Kämpfer, Verteidiger | 0.95 | 40 / 104 | Ausweichen, Physischer Krit, Angriffstempo | Physischer Krit |
| Platte-Handschuhe | Platte | Verteidiger | 1.45 | 61 / 158 | Rüstung, Block, Lebenspunkte | Rüstung |

#### Beine  ·  Primär: Rüstung

| Typ | Material | Tragbar | StatMult | Rüstung (Gew./Epis.) | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|---|---|
| Stoff-Beinschienen | Stoff | Heiler, Kämpfer, Verteidiger | 0.55 | 23 / 60 | Magischer Krit, Vielseitigkeit, Lebenspunkte | Magischer Krit |
| Leder-Beinschienen | Leder | Kämpfer, Verteidiger | 0.95 | 40 / 104 | Ausweichen, Physischer Krit, Angriffstempo | Physischer Krit |
| Platte-Beinschienen | Platte | Verteidiger | 1.45 | 61 / 158 | Rüstung, Block, Lebenspunkte | Rüstung |

#### Füße  ·  Primär: Rüstung

| Typ | Material | Tragbar | StatMult | Rüstung (Gew./Epis.) | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|---|---|
| Stoff-Stiefel | Stoff | Heiler, Kämpfer, Verteidiger | 0.55 | 23 / 60 | Magischer Krit, Vielseitigkeit, Lebenspunkte | Magischer Krit |
| Leder-Stiefel | Leder | Kämpfer, Verteidiger | 0.95 | 40 / 104 | Ausweichen, Physischer Krit, Angriffstempo | Physischer Krit |
| Platte-Stiefel | Platte | Verteidiger | 1.45 | 61 / 158 | Rüstung, Block, Lebenspunkte | Rüstung |

#### Umhang  ·  Primär: Rüstung

| Typ | Material | Tragbar | StatMult | Rüstung (Gew./Epis.) | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|---|---|
| Stoff-Umhang | Stoff | Heiler, Kämpfer, Verteidiger | 0.55 | 23 / 60 | Magischer Krit, Vielseitigkeit, Lebenspunkte | Magischer Krit |
| Leder-Umhang | Leder | Kämpfer, Verteidiger | 0.95 | 40 / 104 | Ausweichen, Physischer Krit, Angriffstempo | Physischer Krit |
| Platte-Umhang | Platte | Verteidiger | 1.45 | 61 / 158 | Rüstung, Block, Lebenspunkte | Rüstung |

#### Schild  ·  Primär: Rüstung

| Typ | Material | Tragbar | StatMult | Rüstung (Gew./Epis.) | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|---|---|
| Turmschild | – | alle | 1.1 | 46 / 120 | Rüstung, Block | Block |
| Rundschild | – | alle | 1.0 | 42 / 109 | Rüstung, Dornen | Dornen |
| Buckler | – | alle | 0.9 | 38 / 98 | Ausweichen, Block | Ausweichen |
| Pavese | – | alle | 1.15 | 48 / 126 | Rüstung, Lebenspunkte | Lebenspunkte |
| Spiegelschild | – | alle | 1.0 | 42 / 109 | Block, Ausweichen | Block |
| Drachenschild | – | alle | 1.05 | 44 / 115 | Rüstung, Dornen | Rüstung |

### 💍 Schmuck

#### Amulett  ·  Primär: Rüstung

| Typ | Variante | StatMult | Rüstung (Gew./Epis.) | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|---|
| Kriegsamulett | v0 | 1.0 | 42 / 109 | Schaden, Krit-Schaden | Krit-Schaden |
| Lebensamulett | v1 | 1.0 | 42 / 109 | Lebenspunkte, Lebensraub | Lebenspunkte |
| Schutzamulett | v2 | 1.0 | 42 / 109 | Rüstung, Vielseitigkeit | Vielseitigkeit |
| Krit-Amulett | v3 | 1.0 | 42 / 109 | Physischer Krit, Krit-Schaden | Physischer Krit |
| Tempo-Amulett | v4 | 1.0 | 42 / 109 | Angriffstempo, Ausweichen | Angriffstempo |
| Räuber-Amulett | v5 | 1.0 | 42 / 109 | Lebensraub, Physischer Krit | Lebensraub |

#### Ring 1 & 2  ·  Primär: Rüstung

| Typ | Variante | StatMult | Rüstung (Gew./Epis.) | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|---|
| Siegelring | v0 | 1.0 | 42 / 109 | Physischer Krit, Krit-Schaden | Physischer Krit |
| Bluttropfen-Ring | v1 | 1.0 | 42 / 109 | Lebensraub, Lebenspunkte | Lebensraub |
| Wächterring | v2 | 1.0 | 42 / 109 | Rüstung, Ausweichen | Ausweichen |
| Macht-Ring | v3 | 1.0 | 42 / 109 | Schaden, Krit-Schaden | Krit-Schaden |
| Vitalring | v4 | 1.0 | 42 / 109 | Lebenspunkte, Rüstung | Lebenspunkte |
| Talisman | v5 | 1.0 | 42 / 109 | Vielseitigkeit, Angriffstempo | Vielseitigkeit |

## 🔧 Sekundärwerte (Affixe)

`Basis` + `pro Stufe` × Gegenstandsstufe, dann × Seltenheits-Multiplikator und Roll (0,75–1,30). `%`-Werte sind Anteile.

| Affix | Typ | Basis | pro Stufe | Obergrenze |
|---|---|---|---|---|
| Physischer Krit | % | 3.00% | 0.150% | 50% |
| Magischer Krit | % | 3.00% | 0.150% | 50% |
| Krit-Schaden | % | 15.00% | 0.600% | 200% |
| Lebenspunkte | flach | 12 | 1.4 | – |
| Angriffstempo | % | 3.00% | 0.120% | 40% |
| Rüstung | flach | 3 | 0.5 | – |
| Schaden | flach | 4 | 0.6 | – |
| Lebensraub | % | 2.00% | 0.100% | 40% |
| Ausweichen | % | 2.00% | 0.080% | 35% |
| Block | flach | 2 | 0.4 | – |
| Vielseitigkeit | % | 2.00% | 0.090% | 30% |
| Dornen | flach | 3 | 0.5 | – |

## 💰 Wertigkeit & Verkauf

- **Gegenstandswert** = `Seltenheitsrang × 1000 + Primärwert + Affix-Score` (Affix-Score: %-Affixe × 100, flache × 0,5, Proc +40).
- **Verkaufspreis** = `max(1, (Primärwert + Affix-Score × 2) × (Seltenheitsrang + 1) × 0,6)`.
- **Kampfkraft** eines Items gewichtet alle Werte (z. B. Krit ×200, Schaden ×1,5, Rüstung ×1) zu einer Vergleichszahl.

---

**Summe:** 45 Basis-Typen × 6 Seltenheiten = 270 Item-Ausprägungen.

> Sprites: `icon_<slot>_<variante>.png` (0–5). Waffen besitzen je Variante eine eigene Form
> (Schwert/Dolch/Streitkolben/Axt/Speer/Kriegshammer); Rüstung nutzt 3 Material-Varianten (Stoff v4, Leder v2, Platte v0).
