# Item-Übersicht – Dämmerpfad

> **Automatisch generiert** aus den Daten-Dateien (Single Source of Truth).
> Nicht von Hand editieren – Datendatei ändern und `node adventure/tools/gen-items-doc.mjs` neu ausführen.

## 🧙 Klassen & Ausrüstung

Die bei der Erstellung gewählte **Klasse** ist dauerhaft und bestimmt, welche Rüstung, Waffen und Schilde getragen werden dürfen und welche Schadensschule zählt.

| Klasse | Schule | Rüstung | Waffen | Schild | Schadens-× | Heil-× |
|---|---|---|---|---|---|---|
| ✨ Heiler | magisch | Stoff | Zauberstäbe | ❌ | 0.65× | 1.6× |
| ⚔️ Kämpfer | physisch | Stoff, Leder | physische Waffen | ❌ | 1× | 1× |
| 🛡️ Verteidiger | physisch | Stoff, Leder, Platte | physische Waffen | ✅ | 0.7× | 1× |
| 🔮 Hexer | magisch | Stoff | Zauberstäbe | ❌ | 0.8× | 1.5× |

Rüstung gibt es in **3 Materialien**: **Stoff** (kaum Rüstung, magisch), **Leder** (mehr Rüstung, physisch), **Platte** (sehr viel Rüstung, wenig Schaden).
Waffen: **physische Waffen** (Schwert/Dolch/…) für Kämpfer & Verteidiger, **Zauberstäbe** nur für Heiler & Hexer. **Schilde** kann nur der Verteidiger tragen. Schmuck (Amulett/Ringe) ist klassenunabhängig.

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

| Typ | Variante | Fund | StatMult | Schaden (Gew./Epis.) | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|---|---|
| Schwert | v0 | sehr häufig | 1.0 | 56 / 146 | Schaden, Physischer Krit | Schaden |
| Langschwert | v0 | häufig | 1.08 | 60 / 157 | Schaden, Physischer Krit | Schaden |
| Dolch | v1 | sehr häufig | 0.85 | 48 / 124 | Physischer Krit, Krit-Schaden, Angriffstempo | Physischer Krit |
| Rapier | v1 | häufig | 0.92 | 52 / 134 | Physischer Krit, Angriffstempo | Angriffstempo |
| Streitkolben | v2 | häufig | 1.2 | 67 / 175 | Schaden, Vielseitigkeit | Schaden |
| Morgenstern | v2 | selten | 1.22 | 68 / 178 | Schaden, Krit-Schaden | Krit-Schaden |
| Axt | v3 | häufig | 1.1 | 62 / 160 | Schaden, Lebensraub | Lebensraub |
| Kriegsbeil | v3 | normal | 1.15 | 64 / 167 | Lebensraub, Schaden | Lebensraub |
| Speer | v4 | häufig | 1.05 | 59 / 153 | Vielseitigkeit, Angriffstempo | Vielseitigkeit |
| Hellebarde | v4 | normal | 1.18 | 66 / 172 | Vielseitigkeit, Schaden | Schaden |
| Kriegshammer | v5 | normal | 1.25 | 70 / 182 | Schaden, Krit-Schaden | Krit-Schaden |
| Flammenklinge | v0 | sehr selten | 1.32 | 74 / 192 | Schaden, Krit-Schaden | Krit-Schaden |
| Drachenlanze | v4 | extrem selten | 1.36 | 76 / 198 | Vielseitigkeit, Krit-Schaden | Krit-Schaden |
| Zweihänder | v5 | extrem selten | 1.45 | 81 / 211 | Schaden, Krit-Schaden | Schaden |
| Kristallstab | v6 | sehr häufig | 0.85 | 48 / 124 | Magischer Krit, Krit-Schaden, Angriffstempo | Magischer Krit |
| Heilstab | v6 | sehr häufig | 0.7 | 39 / 102 | Lebensraub, Lebenspunkte, Magischer Krit | Lebensraub |
| Runenstab | v6 | sehr häufig | 0.8 | 45 / 116 | Angriffstempo, Magischer Krit, Vielseitigkeit | Angriffstempo |
| Zepter | v6 | häufig | 0.9 | 50 / 131 | Magischer Krit, Krit-Schaden | Krit-Schaden |
| Nekromantenstab | v6 | normal | 0.88 | 49 / 128 | Lebensraub, Magischer Krit | Lebensraub |
| Sturmstab | v6 | normal | 0.86 | 48 / 125 | Angriffstempo, Magischer Krit | Angriffstempo |
| Erzmagierstab | v6 | sehr selten | 1.0 | 56 / 146 | Magischer Krit, Krit-Schaden | Magischer Krit |

### 🛡️ Rüstung

#### Kopf  ·  Primär: Rüstung

| Typ | Material | Tragbar | Fund | StatMult | Rüstung (Gew./Epis.) | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|---|---|---|
| Stoff-Helm | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr häufig | 0.55 | 23 / 60 | Magischer Krit, Vielseitigkeit, Lebenspunkte | Magischer Krit |
| Leder-Helm | Leder | Kämpfer, Verteidiger | sehr häufig | 0.95 | 40 / 104 | Ausweichen, Physischer Krit, Angriffstempo | Physischer Krit |
| Platte-Helm | Platte | Verteidiger | sehr häufig | 1.6 | 67 / 175 | Rüstung, Block, Lebenspunkte | Rüstung |
| Seiden-Helm | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.72 | 30 / 79 | Magischer Krit, Vielseitigkeit, Lebenspunkte | Magischer Krit |
| Drachenleder-Helm | Leder | Kämpfer, Verteidiger | selten | 1.12 | 47 / 122 | Ausweichen, Angriffstempo, Physischer Krit | Ausweichen |
| Drachenplatten-Helm | Platte | Verteidiger | sehr selten | 1.9 | 80 / 207 | Rüstung, Lebenspunkte, Block | Rüstung |

#### Schultern  ·  Primär: Rüstung

| Typ | Material | Tragbar | Fund | StatMult | Rüstung (Gew./Epis.) | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|---|---|---|
| Stoff-Schulterplatten | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr häufig | 0.55 | 23 / 60 | Magischer Krit, Vielseitigkeit, Lebenspunkte | Magischer Krit |
| Leder-Schulterplatten | Leder | Kämpfer, Verteidiger | sehr häufig | 0.95 | 40 / 104 | Ausweichen, Physischer Krit, Angriffstempo | Physischer Krit |
| Platte-Schulterplatten | Platte | Verteidiger | sehr häufig | 1.6 | 67 / 175 | Rüstung, Block, Lebenspunkte | Rüstung |
| Seiden-Schulterplatten | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.72 | 30 / 79 | Magischer Krit, Vielseitigkeit, Lebenspunkte | Magischer Krit |
| Drachenleder-Schulterplatten | Leder | Kämpfer, Verteidiger | selten | 1.12 | 47 / 122 | Ausweichen, Angriffstempo, Physischer Krit | Ausweichen |
| Drachenplatten-Schulterplatten | Platte | Verteidiger | sehr selten | 1.9 | 80 / 207 | Rüstung, Lebenspunkte, Block | Rüstung |

#### Brust  ·  Primär: Rüstung

| Typ | Material | Tragbar | Fund | StatMult | Rüstung (Gew./Epis.) | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|---|---|---|
| Stoff-Brustpanzer | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr häufig | 0.55 | 23 / 60 | Magischer Krit, Vielseitigkeit, Lebenspunkte | Magischer Krit |
| Leder-Brustpanzer | Leder | Kämpfer, Verteidiger | sehr häufig | 0.95 | 40 / 104 | Ausweichen, Physischer Krit, Angriffstempo | Physischer Krit |
| Platte-Brustpanzer | Platte | Verteidiger | sehr häufig | 1.6 | 67 / 175 | Rüstung, Block, Lebenspunkte | Rüstung |
| Seiden-Brustpanzer | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.72 | 30 / 79 | Magischer Krit, Vielseitigkeit, Lebenspunkte | Magischer Krit |
| Drachenleder-Brustpanzer | Leder | Kämpfer, Verteidiger | selten | 1.12 | 47 / 122 | Ausweichen, Angriffstempo, Physischer Krit | Ausweichen |
| Drachenplatten-Brustpanzer | Platte | Verteidiger | sehr selten | 1.9 | 80 / 207 | Rüstung, Lebenspunkte, Block | Rüstung |

#### Hände  ·  Primär: Rüstung

| Typ | Material | Tragbar | Fund | StatMult | Rüstung (Gew./Epis.) | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|---|---|---|
| Stoff-Handschuhe | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr häufig | 0.55 | 23 / 60 | Magischer Krit, Vielseitigkeit, Lebenspunkte | Magischer Krit |
| Leder-Handschuhe | Leder | Kämpfer, Verteidiger | sehr häufig | 0.95 | 40 / 104 | Ausweichen, Physischer Krit, Angriffstempo | Physischer Krit |
| Platte-Handschuhe | Platte | Verteidiger | sehr häufig | 1.6 | 67 / 175 | Rüstung, Block, Lebenspunkte | Rüstung |
| Seiden-Handschuhe | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.72 | 30 / 79 | Magischer Krit, Vielseitigkeit, Lebenspunkte | Magischer Krit |
| Drachenleder-Handschuhe | Leder | Kämpfer, Verteidiger | selten | 1.12 | 47 / 122 | Ausweichen, Angriffstempo, Physischer Krit | Ausweichen |
| Drachenplatten-Handschuhe | Platte | Verteidiger | sehr selten | 1.9 | 80 / 207 | Rüstung, Lebenspunkte, Block | Rüstung |

#### Beine  ·  Primär: Rüstung

| Typ | Material | Tragbar | Fund | StatMult | Rüstung (Gew./Epis.) | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|---|---|---|
| Stoff-Beinschienen | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr häufig | 0.55 | 23 / 60 | Magischer Krit, Vielseitigkeit, Lebenspunkte | Magischer Krit |
| Leder-Beinschienen | Leder | Kämpfer, Verteidiger | sehr häufig | 0.95 | 40 / 104 | Ausweichen, Physischer Krit, Angriffstempo | Physischer Krit |
| Platte-Beinschienen | Platte | Verteidiger | sehr häufig | 1.6 | 67 / 175 | Rüstung, Block, Lebenspunkte | Rüstung |
| Seiden-Beinschienen | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.72 | 30 / 79 | Magischer Krit, Vielseitigkeit, Lebenspunkte | Magischer Krit |
| Drachenleder-Beinschienen | Leder | Kämpfer, Verteidiger | selten | 1.12 | 47 / 122 | Ausweichen, Angriffstempo, Physischer Krit | Ausweichen |
| Drachenplatten-Beinschienen | Platte | Verteidiger | sehr selten | 1.9 | 80 / 207 | Rüstung, Lebenspunkte, Block | Rüstung |

#### Füße  ·  Primär: Rüstung

| Typ | Material | Tragbar | Fund | StatMult | Rüstung (Gew./Epis.) | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|---|---|---|
| Stoff-Stiefel | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr häufig | 0.55 | 23 / 60 | Magischer Krit, Vielseitigkeit, Lebenspunkte | Magischer Krit |
| Leder-Stiefel | Leder | Kämpfer, Verteidiger | sehr häufig | 0.95 | 40 / 104 | Ausweichen, Physischer Krit, Angriffstempo | Physischer Krit |
| Platte-Stiefel | Platte | Verteidiger | sehr häufig | 1.6 | 67 / 175 | Rüstung, Block, Lebenspunkte | Rüstung |
| Seiden-Stiefel | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.72 | 30 / 79 | Magischer Krit, Vielseitigkeit, Lebenspunkte | Magischer Krit |
| Drachenleder-Stiefel | Leder | Kämpfer, Verteidiger | selten | 1.12 | 47 / 122 | Ausweichen, Angriffstempo, Physischer Krit | Ausweichen |
| Drachenplatten-Stiefel | Platte | Verteidiger | sehr selten | 1.9 | 80 / 207 | Rüstung, Lebenspunkte, Block | Rüstung |

#### Umhang  ·  Primär: Rüstung

| Typ | Material | Tragbar | Fund | StatMult | Rüstung (Gew./Epis.) | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|---|---|---|
| Stoff-Umhang | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr häufig | 0.55 | 23 / 60 | Magischer Krit, Vielseitigkeit, Lebenspunkte | Magischer Krit |
| Leder-Umhang | Leder | Kämpfer, Verteidiger | sehr häufig | 0.95 | 40 / 104 | Ausweichen, Physischer Krit, Angriffstempo | Physischer Krit |
| Platte-Umhang | Platte | Verteidiger | sehr häufig | 1.6 | 67 / 175 | Rüstung, Block, Lebenspunkte | Rüstung |
| Seiden-Umhang | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.72 | 30 / 79 | Magischer Krit, Vielseitigkeit, Lebenspunkte | Magischer Krit |
| Drachenleder-Umhang | Leder | Kämpfer, Verteidiger | selten | 1.12 | 47 / 122 | Ausweichen, Angriffstempo, Physischer Krit | Ausweichen |
| Drachenplatten-Umhang | Platte | Verteidiger | sehr selten | 1.9 | 80 / 207 | Rüstung, Lebenspunkte, Block | Rüstung |

#### Schild  ·  Primär: Rüstung

| Typ | Material | Tragbar | Fund | StatMult | Rüstung (Gew./Epis.) | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|---|---|---|
| Holzschild | – | alle | sehr häufig | 0.85 | 36 / 93 | Rüstung, Ausweichen | Ausweichen |
| Rundschild | – | alle | sehr häufig | 1.0 | 42 / 109 | Rüstung, Dornen | Dornen |
| Buckler | – | alle | sehr häufig | 0.9 | 38 / 98 | Ausweichen, Block | Ausweichen |
| Wappenschild | – | alle | häufig | 1.05 | 44 / 115 | Rüstung, Block | Block |
| Turmschild | – | alle | häufig | 1.1 | 46 / 120 | Rüstung, Block | Block |
| Spiegelschild | – | alle | häufig | 1.0 | 42 / 109 | Block, Ausweichen | Block |
| Dornenschild | – | alle | normal | 1.02 | 43 / 111 | Dornen, Rüstung | Dornen |
| Pavese | – | alle | normal | 1.15 | 48 / 126 | Rüstung, Lebenspunkte | Lebenspunkte |
| Drachenschild | – | alle | normal | 1.08 | 45 / 118 | Rüstung, Dornen | Rüstung |
| Bollwerk | – | alle | selten | 1.22 | 51 / 133 | Rüstung, Lebenspunkte | Lebenspunkte |
| Aegis | – | alle | sehr selten | 1.2 | 50 / 131 | Block, Ausweichen | Block |
| Titanenschild | – | alle | extrem selten | 1.32 | 55 / 144 | Rüstung, Lebenspunkte | Rüstung |

### 💍 Schmuck

#### Amulett  ·  Primär: Rüstung

| Typ | Variante | Fund | StatMult | Rüstung (Gew./Epis.) | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|---|---|
| Kriegsamulett | v0 | sehr häufig | 1.0 | 42 / 109 | Schaden, Krit-Schaden | Krit-Schaden |
| Lebensamulett | v1 | sehr häufig | 1.0 | 42 / 109 | Lebenspunkte, Lebensraub | Lebenspunkte |
| Schutzamulett | v2 | sehr häufig | 1.0 | 42 / 109 | Rüstung, Vielseitigkeit | Vielseitigkeit |
| Krit-Amulett | v3 | sehr häufig | 1.0 | 42 / 109 | Physischer Krit, Krit-Schaden | Physischer Krit |
| Tempo-Amulett | v4 | sehr häufig | 1.0 | 42 / 109 | Angriffstempo, Ausweichen | Angriffstempo |
| Räuber-Amulett | v5 | häufig | 1.0 | 42 / 109 | Lebensraub, Physischer Krit | Lebensraub |
| Magie-Amulett | v5 | häufig | 1.0 | 42 / 109 | Magischer Krit, Krit-Schaden | Magischer Krit |
| Glücks-Amulett | v3 | häufig | 1.0 | 42 / 109 | Ausweichen, Physischer Krit | Ausweichen |
| Titanen-Amulett | v2 | häufig | 1.0 | 42 / 109 | Lebenspunkte, Rüstung | Lebenspunkte |
| Drachenauge | v3 | selten | 1.05 | 44 / 115 | Krit-Schaden, Physischer Krit | Krit-Schaden |
| Phönix-Anhänger | v1 | sehr selten | 1.05 | 44 / 115 | Lebenspunkte, Lebensraub | Lebensraub |

#### Ring 1 & 2  ·  Primär: Rüstung

| Typ | Variante | Fund | StatMult | Rüstung (Gew./Epis.) | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|---|---|
| Siegelring | v0 | sehr häufig | 1.0 | 42 / 109 | Physischer Krit, Krit-Schaden | Physischer Krit |
| Bluttropfen-Ring | v1 | sehr häufig | 1.0 | 42 / 109 | Lebensraub, Lebenspunkte | Lebensraub |
| Wächterring | v2 | sehr häufig | 1.0 | 42 / 109 | Rüstung, Ausweichen | Ausweichen |
| Macht-Ring | v3 | sehr häufig | 1.0 | 42 / 109 | Schaden, Krit-Schaden | Krit-Schaden |
| Vitalring | v4 | sehr häufig | 1.0 | 42 / 109 | Lebenspunkte, Rüstung | Lebenspunkte |
| Talisman | v5 | häufig | 1.0 | 42 / 109 | Vielseitigkeit, Angriffstempo | Vielseitigkeit |
| Arkan-Ring | v5 | häufig | 1.0 | 42 / 109 | Magischer Krit, Krit-Schaden | Magischer Krit |
| Jäger-Ring | v0 | häufig | 1.0 | 42 / 109 | Physischer Krit, Angriffstempo | Angriffstempo |
| Bollwerk-Ring | v2 | häufig | 1.0 | 42 / 109 | Rüstung, Lebenspunkte | Rüstung |
| Sturm-Ring | v4 | selten | 1.04 | 44 / 114 | Angriffstempo, Physischer Krit | Angriffstempo |
| Drachenring | v3 | sehr selten | 1.05 | 44 / 115 | Krit-Schaden, Schaden | Krit-Schaden |

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

**Summe:** 97 Basis-Typen × 6 Seltenheiten = 582 Item-Ausprägungen.

> Sprites sind prozedural (SVG, Variante 0–6). Mehrere Typen können sich eine Silhouette teilen –
> sie unterscheiden sich über Name, Primärwert (StatMult), Affix-Fokus und Fund-Häufigkeit.
> Die **Fund**-Spalte spiegelt das Typ-Gewicht: Top-Typen (z. B. Zweihänder, Drachenplatten, Titanenschild) sind selten.
