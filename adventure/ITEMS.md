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
| Flammenstab | v6 | häufig | 0.88 | 49 / 128 | Magischer Krit, Krit-Schaden | Krit-Schaden |
| Froststab | v6 | häufig | 0.84 | 47 / 122 | Magischer Krit, Angriffstempo | Angriffstempo |
| Naturstab | v6 | normal | 0.78 | 44 / 114 | Lebensraub, Magischer Krit | Lebensraub |
| Schattenstab | v6 | normal | 0.86 | 48 / 125 | Magischer Krit, Lebensraub | Lebensraub |
| Arkanstab | v6 | normal | 0.9 | 50 / 131 | Magischer Krit, Vielseitigkeit | Magischer Krit |
| Blitzstab | v6 | normal | 0.85 | 48 / 124 | Angriffstempo, Magischer Krit | Angriffstempo |
| Seelenstab | v6 | normal | 0.82 | 46 / 119 | Lebensraub, Krit-Schaden | Lebensraub |
| Mondstab | v6 | normal | 0.8 | 45 / 116 | Vielseitigkeit, Magischer Krit | Vielseitigkeit |
| Sonnenstab | v6 | normal | 0.88 | 49 / 128 | Magischer Krit, Krit-Schaden | Krit-Schaden |
| Donnerzepter | v6 | selten | 0.92 | 52 / 134 | Magischer Krit, Angriffstempo | Angriffstempo |
| Weltenbaumstab | v6 | selten | 0.84 | 47 / 122 | Lebensraub, Magischer Krit | Lebensraub |
| Urzeitstab | v6 | sehr selten | 1.05 | 59 / 153 | Magischer Krit, Krit-Schaden | Magischer Krit |
| Breitschwert | v0 | häufig | 1.06 | 59 / 154 | Schaden, Physischer Krit | Schaden |
| Säbel | v7 | häufig | 0.95 | 53 / 138 | Physischer Krit, Angriffstempo | Angriffstempo |
| Falchion | v7 | normal | 1.05 | 59 / 153 | Schaden, Physischer Krit | Schaden |
| Katana | v7 | normal | 1.02 | 57 / 149 | Physischer Krit, Krit-Schaden | Krit-Schaden |
| Krummdolch | v1 | häufig | 0.82 | 46 / 119 | Physischer Krit, Angriffstempo | Physischer Krit |
| Wurfdolch | v1 | häufig | 0.8 | 45 / 116 | Angriffstempo, Physischer Krit | Angriffstempo |
| Stilett | v1 | häufig | 0.84 | 47 / 122 | Physischer Krit, Krit-Schaden | Physischer Krit |
| Keule | v2 | häufig | 1.12 | 63 / 163 | Schaden, Vielseitigkeit | Schaden |
| Flegel | v2 | normal | 1.1 | 62 / 160 | Schaden, Krit-Schaden | Krit-Schaden |
| Wurfbeil | v3 | häufig | 1.05 | 59 / 153 | Angriffstempo, Schaden | Schaden |
| Bartaxt | v3 | normal | 1.16 | 65 / 169 | Lebensraub, Schaden | Lebensraub |
| Pike | v4 | häufig | 1.1 | 62 / 160 | Vielseitigkeit, Schaden | Vielseitigkeit |
| Streithammer | v5 | normal | 1.24 | 69 / 181 | Schaden, Krit-Schaden | Krit-Schaden |
| Kriegskeule | v12 | normal | 1.2 | 67 / 175 | Schaden, Vielseitigkeit | Schaden |
| Sense | v9 | normal | 1.18 | 66 / 172 | Lebensraub, Krit-Schaden | Lebensraub |
| Partisane | v11 | normal | 1.2 | 67 / 175 | Vielseitigkeit, Krit-Schaden | Vielseitigkeit |
| Glefe | v11 | selten | 1.22 | 68 / 178 | Schaden, Vielseitigkeit | Schaden |
| Doppelaxt | v10 | selten | 1.28 | 72 / 186 | Schaden, Lebensraub | Lebensraub |
| Henkersbeil | v3 | sehr selten | 1.28 | 72 / 186 | Schaden, Krit-Schaden | Krit-Schaden |
| Richtschwert | v8 | selten | 1.3 | 73 / 189 | Schaden, Krit-Schaden | Schaden |
| Kriegssense | v9 | selten | 1.3 | 73 / 189 | Schaden, Lebensraub | Lebensraub |
| Zweihandaxt | v10 | sehr selten | 1.34 | 75 / 195 | Schaden, Lebensraub | Schaden |
| Feuerstab | v6 | häufig | 0.88 | 49 / 128 | Magischer Krit, Krit-Schaden | Krit-Schaden |
| Eisstab | v6 | häufig | 0.84 | 47 / 122 | Magischer Krit, Angriffstempo | Angriffstempo |
| Giftstab | v6 | normal | 0.8 | 45 / 116 | Lebensraub, Magischer Krit | Lebensraub |
| Lichtstab | v6 | normal | 0.86 | 48 / 125 | Magischer Krit, Vielseitigkeit | Vielseitigkeit |
| Dunkelstab | v6 | normal | 0.84 | 47 / 122 | Lebensraub, Magischer Krit | Lebensraub |
| Donnerstab | v6 | normal | 0.85 | 48 / 124 | Angriffstempo, Magischer Krit | Angriffstempo |
| Glutstab | v6 | normal | 0.87 | 49 / 127 | Magischer Krit, Krit-Schaden | Krit-Schaden |
| Rankenstab | v6 | normal | 0.78 | 44 / 114 | Lebensraub, Magischer Krit | Lebensraub |
| Weisheitsstab | v6 | normal | 0.82 | 46 / 119 | Vielseitigkeit, Magischer Krit | Vielseitigkeit |
| Sternenstab | v6 | normal | 0.9 | 50 / 131 | Magischer Krit, Krit-Schaden | Magischer Krit |
| Lebensstab | v6 | häufig | 0.72 | 40 / 105 | Lebensraub, Vielseitigkeit | Lebensraub |
| Zeitstab | v6 | selten | 0.88 | 49 / 128 | Angriffstempo, Magischer Krit | Angriffstempo |
| Blutstab | v6 | normal | 0.86 | 48 / 125 | Lebensraub, Krit-Schaden | Lebensraub |
| Chaosstab | v6 | selten | 0.92 | 52 / 134 | Krit-Schaden, Magischer Krit | Krit-Schaden |
| Drachenstab | v6 | sehr selten | 1.0 | 56 / 146 | Magischer Krit, Krit-Schaden | Magischer Krit |

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
| Magier-Helm | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | häufig | 0.62 | 26 / 68 | Magischer Krit, Vielseitigkeit | Magischer Krit |
| Hexen-Helm | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.66 | 28 / 72 | Magischer Krit, Lebenspunkte, Vielseitigkeit | Magischer Krit |
| Heiler-Helm | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.7 | 29 / 76 | Lebenspunkte, Vielseitigkeit | Lebenspunkte |
| Arkan-Helm | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.74 | 31 / 81 | Magischer Krit, Angriffstempo | Magischer Krit |
| Runen-Helm | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.68 | 29 / 74 | Vielseitigkeit, Magischer Krit | Vielseitigkeit |
| Astral-Helm | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.78 | 33 / 85 | Magischer Krit, Lebenspunkte | Lebenspunkte |
| Nebel-Helm | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.6 | 25 / 66 | Ausweichen, Vielseitigkeit | Ausweichen |
| Geister-Helm | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.72 | 30 / 79 | Ausweichen, Magischer Krit | Ausweichen |
| Schatten-Helm | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.8 | 34 / 87 | Magischer Krit, Angriffstempo | Angriffstempo |
| Phönix-Helm | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr selten | 0.92 | 39 / 100 | Lebenspunkte, Magischer Krit, Vielseitigkeit | Lebenspunkte |
| Sternenseiden-Helm | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr selten | 0.95 | 40 / 104 | Magischer Krit, Vielseitigkeit | Magischer Krit |
| Stahl-Helm | Platte | Verteidiger | häufig | 1.62 | 68 / 177 | Rüstung, Block | Block |
| Bronze-Helm | Platte | Verteidiger | normal | 1.5 | 63 / 164 | Rüstung, Block, Lebenspunkte | Rüstung |
| Knochen-Helm | Platte | Verteidiger | selten | 1.45 | 61 / 158 | Rüstung, Lebenspunkte | Rüstung |
| Obsidian-Helm | Platte | Verteidiger | sehr selten | 1.8 | 76 / 197 | Rüstung, Physischer Krit | Rüstung |
| Mithril-Helm | Platte | Verteidiger | sehr selten | 1.7 | 71 / 186 | Rüstung, Angriffstempo, Ausweichen | Rüstung |
| Titan-Helm | Platte | Verteidiger | sehr selten | 1.95 | 82 / 213 | Rüstung, Lebenspunkte, Block | Rüstung |
| Sternenstahl-Helm | Platte | Verteidiger | sehr selten | 1.85 | 78 / 202 | Rüstung, Magischer Krit, Vielseitigkeit | Rüstung |
| Ketten-Helm | Leder | Kämpfer, Verteidiger | häufig | 1.05 | 44 / 115 | Rüstung, Ausweichen | Rüstung |
| Schuppen-Helm | Leder | Kämpfer, Verteidiger | normal | 1.08 | 45 / 118 | Rüstung, Ausweichen | Ausweichen |
| Eisenholz-Helm | Leder | Kämpfer, Verteidiger | normal | 1.0 | 42 / 109 | Rüstung, Ausweichen, Vielseitigkeit | Vielseitigkeit |
| Wolfsleder-Helm | Leder | Kämpfer, Verteidiger | normal | 1.02 | 43 / 111 | Ausweichen, Angriffstempo | Angriffstempo |
| Bärenfell-Helm | Leder | Kämpfer, Verteidiger | normal | 1.1 | 46 / 120 | Lebenspunkte, Rüstung | Lebenspunkte |
| Drachenschuppen-Helm | Leder | Kämpfer, Verteidiger | selten | 1.15 | 48 / 126 | Ausweichen, Rüstung | Ausweichen |
| Samt-Helm | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | häufig | 0.66 | 28 / 72 | Magischer Krit, Vielseitigkeit | Magischer Krit |
| Brokat-Helm | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.72 | 30 / 79 | Vielseitigkeit, Magischer Krit | Vielseitigkeit |
| Mond-Helm | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.74 | 31 / 81 | Magischer Krit, Ausweichen | Ausweichen |
| Phönixfeder-Helm | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr selten | 0.94 | 39 / 103 | Lebenspunkte, Magischer Krit | Lebenspunkte |
| Urwelt-Helm | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr selten | 0.96 | 40 / 105 | Magischer Krit, Vielseitigkeit | Magischer Krit |

#### Schultern  ·  Primär: Rüstung

| Typ | Material | Tragbar | Fund | StatMult | Rüstung (Gew./Epis.) | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|---|---|---|
| Stoff-Schulterplatten | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr häufig | 0.55 | 23 / 60 | Magischer Krit, Vielseitigkeit, Lebenspunkte | Magischer Krit |
| Leder-Schulterplatten | Leder | Kämpfer, Verteidiger | sehr häufig | 0.95 | 40 / 104 | Ausweichen, Physischer Krit, Angriffstempo | Physischer Krit |
| Platte-Schulterplatten | Platte | Verteidiger | sehr häufig | 1.6 | 67 / 175 | Rüstung, Block, Lebenspunkte | Rüstung |
| Seiden-Schulterplatten | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.72 | 30 / 79 | Magischer Krit, Vielseitigkeit, Lebenspunkte | Magischer Krit |
| Drachenleder-Schulterplatten | Leder | Kämpfer, Verteidiger | selten | 1.12 | 47 / 122 | Ausweichen, Angriffstempo, Physischer Krit | Ausweichen |
| Drachenplatten-Schulterplatten | Platte | Verteidiger | sehr selten | 1.9 | 80 / 207 | Rüstung, Lebenspunkte, Block | Rüstung |
| Magier-Schulterplatten | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | häufig | 0.62 | 26 / 68 | Magischer Krit, Vielseitigkeit | Magischer Krit |
| Hexen-Schulterplatten | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.66 | 28 / 72 | Magischer Krit, Lebenspunkte, Vielseitigkeit | Magischer Krit |
| Heiler-Schulterplatten | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.7 | 29 / 76 | Lebenspunkte, Vielseitigkeit | Lebenspunkte |
| Arkan-Schulterplatten | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.74 | 31 / 81 | Magischer Krit, Angriffstempo | Magischer Krit |
| Runen-Schulterplatten | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.68 | 29 / 74 | Vielseitigkeit, Magischer Krit | Vielseitigkeit |
| Astral-Schulterplatten | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.78 | 33 / 85 | Magischer Krit, Lebenspunkte | Lebenspunkte |
| Nebel-Schulterplatten | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.6 | 25 / 66 | Ausweichen, Vielseitigkeit | Ausweichen |
| Geister-Schulterplatten | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.72 | 30 / 79 | Ausweichen, Magischer Krit | Ausweichen |
| Schatten-Schulterplatten | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.8 | 34 / 87 | Magischer Krit, Angriffstempo | Angriffstempo |
| Phönix-Schulterplatten | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr selten | 0.92 | 39 / 100 | Lebenspunkte, Magischer Krit, Vielseitigkeit | Lebenspunkte |
| Sternenseiden-Schulterplatten | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr selten | 0.95 | 40 / 104 | Magischer Krit, Vielseitigkeit | Magischer Krit |
| Stahl-Schulterplatten | Platte | Verteidiger | häufig | 1.62 | 68 / 177 | Rüstung, Block | Block |
| Bronze-Schulterplatten | Platte | Verteidiger | normal | 1.5 | 63 / 164 | Rüstung, Block, Lebenspunkte | Rüstung |
| Knochen-Schulterplatten | Platte | Verteidiger | selten | 1.45 | 61 / 158 | Rüstung, Lebenspunkte | Rüstung |
| Obsidian-Schulterplatten | Platte | Verteidiger | sehr selten | 1.8 | 76 / 197 | Rüstung, Physischer Krit | Rüstung |
| Mithril-Schulterplatten | Platte | Verteidiger | sehr selten | 1.7 | 71 / 186 | Rüstung, Angriffstempo, Ausweichen | Rüstung |
| Titan-Schulterplatten | Platte | Verteidiger | sehr selten | 1.95 | 82 / 213 | Rüstung, Lebenspunkte, Block | Rüstung |
| Sternenstahl-Schulterplatten | Platte | Verteidiger | sehr selten | 1.85 | 78 / 202 | Rüstung, Magischer Krit, Vielseitigkeit | Rüstung |
| Ketten-Schulterplatten | Leder | Kämpfer, Verteidiger | häufig | 1.05 | 44 / 115 | Rüstung, Ausweichen | Rüstung |
| Schuppen-Schulterplatten | Leder | Kämpfer, Verteidiger | normal | 1.08 | 45 / 118 | Rüstung, Ausweichen | Ausweichen |
| Eisenholz-Schulterplatten | Leder | Kämpfer, Verteidiger | normal | 1.0 | 42 / 109 | Rüstung, Ausweichen, Vielseitigkeit | Vielseitigkeit |
| Wolfsleder-Schulterplatten | Leder | Kämpfer, Verteidiger | normal | 1.02 | 43 / 111 | Ausweichen, Angriffstempo | Angriffstempo |
| Bärenfell-Schulterplatten | Leder | Kämpfer, Verteidiger | normal | 1.1 | 46 / 120 | Lebenspunkte, Rüstung | Lebenspunkte |
| Drachenschuppen-Schulterplatten | Leder | Kämpfer, Verteidiger | selten | 1.15 | 48 / 126 | Ausweichen, Rüstung | Ausweichen |
| Samt-Schulterplatten | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | häufig | 0.66 | 28 / 72 | Magischer Krit, Vielseitigkeit | Magischer Krit |
| Brokat-Schulterplatten | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.72 | 30 / 79 | Vielseitigkeit, Magischer Krit | Vielseitigkeit |
| Mond-Schulterplatten | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.74 | 31 / 81 | Magischer Krit, Ausweichen | Ausweichen |
| Phönixfeder-Schulterplatten | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr selten | 0.94 | 39 / 103 | Lebenspunkte, Magischer Krit | Lebenspunkte |
| Urwelt-Schulterplatten | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr selten | 0.96 | 40 / 105 | Magischer Krit, Vielseitigkeit | Magischer Krit |

#### Brust  ·  Primär: Rüstung

| Typ | Material | Tragbar | Fund | StatMult | Rüstung (Gew./Epis.) | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|---|---|---|
| Stoff-Brustpanzer | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr häufig | 0.55 | 23 / 60 | Magischer Krit, Vielseitigkeit, Lebenspunkte | Magischer Krit |
| Leder-Brustpanzer | Leder | Kämpfer, Verteidiger | sehr häufig | 0.95 | 40 / 104 | Ausweichen, Physischer Krit, Angriffstempo | Physischer Krit |
| Platte-Brustpanzer | Platte | Verteidiger | sehr häufig | 1.6 | 67 / 175 | Rüstung, Block, Lebenspunkte | Rüstung |
| Seiden-Brustpanzer | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.72 | 30 / 79 | Magischer Krit, Vielseitigkeit, Lebenspunkte | Magischer Krit |
| Drachenleder-Brustpanzer | Leder | Kämpfer, Verteidiger | selten | 1.12 | 47 / 122 | Ausweichen, Angriffstempo, Physischer Krit | Ausweichen |
| Drachenplatten-Brustpanzer | Platte | Verteidiger | sehr selten | 1.9 | 80 / 207 | Rüstung, Lebenspunkte, Block | Rüstung |
| Magier-Brustpanzer | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | häufig | 0.62 | 26 / 68 | Magischer Krit, Vielseitigkeit | Magischer Krit |
| Hexen-Brustpanzer | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.66 | 28 / 72 | Magischer Krit, Lebenspunkte, Vielseitigkeit | Magischer Krit |
| Heiler-Brustpanzer | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.7 | 29 / 76 | Lebenspunkte, Vielseitigkeit | Lebenspunkte |
| Arkan-Brustpanzer | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.74 | 31 / 81 | Magischer Krit, Angriffstempo | Magischer Krit |
| Runen-Brustpanzer | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.68 | 29 / 74 | Vielseitigkeit, Magischer Krit | Vielseitigkeit |
| Astral-Brustpanzer | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.78 | 33 / 85 | Magischer Krit, Lebenspunkte | Lebenspunkte |
| Nebel-Brustpanzer | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.6 | 25 / 66 | Ausweichen, Vielseitigkeit | Ausweichen |
| Geister-Brustpanzer | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.72 | 30 / 79 | Ausweichen, Magischer Krit | Ausweichen |
| Schatten-Brustpanzer | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.8 | 34 / 87 | Magischer Krit, Angriffstempo | Angriffstempo |
| Phönix-Brustpanzer | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr selten | 0.92 | 39 / 100 | Lebenspunkte, Magischer Krit, Vielseitigkeit | Lebenspunkte |
| Sternenseiden-Brustpanzer | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr selten | 0.95 | 40 / 104 | Magischer Krit, Vielseitigkeit | Magischer Krit |
| Stahl-Brustpanzer | Platte | Verteidiger | häufig | 1.62 | 68 / 177 | Rüstung, Block | Block |
| Bronze-Brustpanzer | Platte | Verteidiger | normal | 1.5 | 63 / 164 | Rüstung, Block, Lebenspunkte | Rüstung |
| Knochen-Brustpanzer | Platte | Verteidiger | selten | 1.45 | 61 / 158 | Rüstung, Lebenspunkte | Rüstung |
| Obsidian-Brustpanzer | Platte | Verteidiger | sehr selten | 1.8 | 76 / 197 | Rüstung, Physischer Krit | Rüstung |
| Mithril-Brustpanzer | Platte | Verteidiger | sehr selten | 1.7 | 71 / 186 | Rüstung, Angriffstempo, Ausweichen | Rüstung |
| Titan-Brustpanzer | Platte | Verteidiger | sehr selten | 1.95 | 82 / 213 | Rüstung, Lebenspunkte, Block | Rüstung |
| Sternenstahl-Brustpanzer | Platte | Verteidiger | sehr selten | 1.85 | 78 / 202 | Rüstung, Magischer Krit, Vielseitigkeit | Rüstung |
| Ketten-Brustpanzer | Leder | Kämpfer, Verteidiger | häufig | 1.05 | 44 / 115 | Rüstung, Ausweichen | Rüstung |
| Schuppen-Brustpanzer | Leder | Kämpfer, Verteidiger | normal | 1.08 | 45 / 118 | Rüstung, Ausweichen | Ausweichen |
| Eisenholz-Brustpanzer | Leder | Kämpfer, Verteidiger | normal | 1.0 | 42 / 109 | Rüstung, Ausweichen, Vielseitigkeit | Vielseitigkeit |
| Wolfsleder-Brustpanzer | Leder | Kämpfer, Verteidiger | normal | 1.02 | 43 / 111 | Ausweichen, Angriffstempo | Angriffstempo |
| Bärenfell-Brustpanzer | Leder | Kämpfer, Verteidiger | normal | 1.1 | 46 / 120 | Lebenspunkte, Rüstung | Lebenspunkte |
| Drachenschuppen-Brustpanzer | Leder | Kämpfer, Verteidiger | selten | 1.15 | 48 / 126 | Ausweichen, Rüstung | Ausweichen |
| Samt-Brustpanzer | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | häufig | 0.66 | 28 / 72 | Magischer Krit, Vielseitigkeit | Magischer Krit |
| Brokat-Brustpanzer | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.72 | 30 / 79 | Vielseitigkeit, Magischer Krit | Vielseitigkeit |
| Mond-Brustpanzer | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.74 | 31 / 81 | Magischer Krit, Ausweichen | Ausweichen |
| Phönixfeder-Brustpanzer | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr selten | 0.94 | 39 / 103 | Lebenspunkte, Magischer Krit | Lebenspunkte |
| Urwelt-Brustpanzer | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr selten | 0.96 | 40 / 105 | Magischer Krit, Vielseitigkeit | Magischer Krit |

#### Hände  ·  Primär: Rüstung

| Typ | Material | Tragbar | Fund | StatMult | Rüstung (Gew./Epis.) | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|---|---|---|
| Stoff-Handschuhe | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr häufig | 0.55 | 23 / 60 | Magischer Krit, Vielseitigkeit, Lebenspunkte | Magischer Krit |
| Leder-Handschuhe | Leder | Kämpfer, Verteidiger | sehr häufig | 0.95 | 40 / 104 | Ausweichen, Physischer Krit, Angriffstempo | Physischer Krit |
| Platte-Handschuhe | Platte | Verteidiger | sehr häufig | 1.6 | 67 / 175 | Rüstung, Block, Lebenspunkte | Rüstung |
| Seiden-Handschuhe | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.72 | 30 / 79 | Magischer Krit, Vielseitigkeit, Lebenspunkte | Magischer Krit |
| Drachenleder-Handschuhe | Leder | Kämpfer, Verteidiger | selten | 1.12 | 47 / 122 | Ausweichen, Angriffstempo, Physischer Krit | Ausweichen |
| Drachenplatten-Handschuhe | Platte | Verteidiger | sehr selten | 1.9 | 80 / 207 | Rüstung, Lebenspunkte, Block | Rüstung |
| Magier-Handschuhe | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | häufig | 0.62 | 26 / 68 | Magischer Krit, Vielseitigkeit | Magischer Krit |
| Hexen-Handschuhe | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.66 | 28 / 72 | Magischer Krit, Lebenspunkte, Vielseitigkeit | Magischer Krit |
| Heiler-Handschuhe | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.7 | 29 / 76 | Lebenspunkte, Vielseitigkeit | Lebenspunkte |
| Arkan-Handschuhe | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.74 | 31 / 81 | Magischer Krit, Angriffstempo | Magischer Krit |
| Runen-Handschuhe | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.68 | 29 / 74 | Vielseitigkeit, Magischer Krit | Vielseitigkeit |
| Astral-Handschuhe | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.78 | 33 / 85 | Magischer Krit, Lebenspunkte | Lebenspunkte |
| Nebel-Handschuhe | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.6 | 25 / 66 | Ausweichen, Vielseitigkeit | Ausweichen |
| Geister-Handschuhe | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.72 | 30 / 79 | Ausweichen, Magischer Krit | Ausweichen |
| Schatten-Handschuhe | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.8 | 34 / 87 | Magischer Krit, Angriffstempo | Angriffstempo |
| Phönix-Handschuhe | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr selten | 0.92 | 39 / 100 | Lebenspunkte, Magischer Krit, Vielseitigkeit | Lebenspunkte |
| Sternenseiden-Handschuhe | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr selten | 0.95 | 40 / 104 | Magischer Krit, Vielseitigkeit | Magischer Krit |
| Stahl-Handschuhe | Platte | Verteidiger | häufig | 1.62 | 68 / 177 | Rüstung, Block | Block |
| Bronze-Handschuhe | Platte | Verteidiger | normal | 1.5 | 63 / 164 | Rüstung, Block, Lebenspunkte | Rüstung |
| Knochen-Handschuhe | Platte | Verteidiger | selten | 1.45 | 61 / 158 | Rüstung, Lebenspunkte | Rüstung |
| Obsidian-Handschuhe | Platte | Verteidiger | sehr selten | 1.8 | 76 / 197 | Rüstung, Physischer Krit | Rüstung |
| Mithril-Handschuhe | Platte | Verteidiger | sehr selten | 1.7 | 71 / 186 | Rüstung, Angriffstempo, Ausweichen | Rüstung |
| Titan-Handschuhe | Platte | Verteidiger | sehr selten | 1.95 | 82 / 213 | Rüstung, Lebenspunkte, Block | Rüstung |
| Sternenstahl-Handschuhe | Platte | Verteidiger | sehr selten | 1.85 | 78 / 202 | Rüstung, Magischer Krit, Vielseitigkeit | Rüstung |
| Ketten-Handschuhe | Leder | Kämpfer, Verteidiger | häufig | 1.05 | 44 / 115 | Rüstung, Ausweichen | Rüstung |
| Schuppen-Handschuhe | Leder | Kämpfer, Verteidiger | normal | 1.08 | 45 / 118 | Rüstung, Ausweichen | Ausweichen |
| Eisenholz-Handschuhe | Leder | Kämpfer, Verteidiger | normal | 1.0 | 42 / 109 | Rüstung, Ausweichen, Vielseitigkeit | Vielseitigkeit |
| Wolfsleder-Handschuhe | Leder | Kämpfer, Verteidiger | normal | 1.02 | 43 / 111 | Ausweichen, Angriffstempo | Angriffstempo |
| Bärenfell-Handschuhe | Leder | Kämpfer, Verteidiger | normal | 1.1 | 46 / 120 | Lebenspunkte, Rüstung | Lebenspunkte |
| Drachenschuppen-Handschuhe | Leder | Kämpfer, Verteidiger | selten | 1.15 | 48 / 126 | Ausweichen, Rüstung | Ausweichen |
| Samt-Handschuhe | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | häufig | 0.66 | 28 / 72 | Magischer Krit, Vielseitigkeit | Magischer Krit |
| Brokat-Handschuhe | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.72 | 30 / 79 | Vielseitigkeit, Magischer Krit | Vielseitigkeit |
| Mond-Handschuhe | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.74 | 31 / 81 | Magischer Krit, Ausweichen | Ausweichen |
| Phönixfeder-Handschuhe | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr selten | 0.94 | 39 / 103 | Lebenspunkte, Magischer Krit | Lebenspunkte |
| Urwelt-Handschuhe | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr selten | 0.96 | 40 / 105 | Magischer Krit, Vielseitigkeit | Magischer Krit |

#### Beine  ·  Primär: Rüstung

| Typ | Material | Tragbar | Fund | StatMult | Rüstung (Gew./Epis.) | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|---|---|---|
| Stoff-Beinschienen | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr häufig | 0.55 | 23 / 60 | Magischer Krit, Vielseitigkeit, Lebenspunkte | Magischer Krit |
| Leder-Beinschienen | Leder | Kämpfer, Verteidiger | sehr häufig | 0.95 | 40 / 104 | Ausweichen, Physischer Krit, Angriffstempo | Physischer Krit |
| Platte-Beinschienen | Platte | Verteidiger | sehr häufig | 1.6 | 67 / 175 | Rüstung, Block, Lebenspunkte | Rüstung |
| Seiden-Beinschienen | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.72 | 30 / 79 | Magischer Krit, Vielseitigkeit, Lebenspunkte | Magischer Krit |
| Drachenleder-Beinschienen | Leder | Kämpfer, Verteidiger | selten | 1.12 | 47 / 122 | Ausweichen, Angriffstempo, Physischer Krit | Ausweichen |
| Drachenplatten-Beinschienen | Platte | Verteidiger | sehr selten | 1.9 | 80 / 207 | Rüstung, Lebenspunkte, Block | Rüstung |
| Magier-Beinschienen | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | häufig | 0.62 | 26 / 68 | Magischer Krit, Vielseitigkeit | Magischer Krit |
| Hexen-Beinschienen | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.66 | 28 / 72 | Magischer Krit, Lebenspunkte, Vielseitigkeit | Magischer Krit |
| Heiler-Beinschienen | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.7 | 29 / 76 | Lebenspunkte, Vielseitigkeit | Lebenspunkte |
| Arkan-Beinschienen | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.74 | 31 / 81 | Magischer Krit, Angriffstempo | Magischer Krit |
| Runen-Beinschienen | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.68 | 29 / 74 | Vielseitigkeit, Magischer Krit | Vielseitigkeit |
| Astral-Beinschienen | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.78 | 33 / 85 | Magischer Krit, Lebenspunkte | Lebenspunkte |
| Nebel-Beinschienen | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.6 | 25 / 66 | Ausweichen, Vielseitigkeit | Ausweichen |
| Geister-Beinschienen | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.72 | 30 / 79 | Ausweichen, Magischer Krit | Ausweichen |
| Schatten-Beinschienen | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.8 | 34 / 87 | Magischer Krit, Angriffstempo | Angriffstempo |
| Phönix-Beinschienen | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr selten | 0.92 | 39 / 100 | Lebenspunkte, Magischer Krit, Vielseitigkeit | Lebenspunkte |
| Sternenseiden-Beinschienen | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr selten | 0.95 | 40 / 104 | Magischer Krit, Vielseitigkeit | Magischer Krit |
| Stahl-Beinschienen | Platte | Verteidiger | häufig | 1.62 | 68 / 177 | Rüstung, Block | Block |
| Bronze-Beinschienen | Platte | Verteidiger | normal | 1.5 | 63 / 164 | Rüstung, Block, Lebenspunkte | Rüstung |
| Knochen-Beinschienen | Platte | Verteidiger | selten | 1.45 | 61 / 158 | Rüstung, Lebenspunkte | Rüstung |
| Obsidian-Beinschienen | Platte | Verteidiger | sehr selten | 1.8 | 76 / 197 | Rüstung, Physischer Krit | Rüstung |
| Mithril-Beinschienen | Platte | Verteidiger | sehr selten | 1.7 | 71 / 186 | Rüstung, Angriffstempo, Ausweichen | Rüstung |
| Titan-Beinschienen | Platte | Verteidiger | sehr selten | 1.95 | 82 / 213 | Rüstung, Lebenspunkte, Block | Rüstung |
| Sternenstahl-Beinschienen | Platte | Verteidiger | sehr selten | 1.85 | 78 / 202 | Rüstung, Magischer Krit, Vielseitigkeit | Rüstung |
| Ketten-Beinschienen | Leder | Kämpfer, Verteidiger | häufig | 1.05 | 44 / 115 | Rüstung, Ausweichen | Rüstung |
| Schuppen-Beinschienen | Leder | Kämpfer, Verteidiger | normal | 1.08 | 45 / 118 | Rüstung, Ausweichen | Ausweichen |
| Eisenholz-Beinschienen | Leder | Kämpfer, Verteidiger | normal | 1.0 | 42 / 109 | Rüstung, Ausweichen, Vielseitigkeit | Vielseitigkeit |
| Wolfsleder-Beinschienen | Leder | Kämpfer, Verteidiger | normal | 1.02 | 43 / 111 | Ausweichen, Angriffstempo | Angriffstempo |
| Bärenfell-Beinschienen | Leder | Kämpfer, Verteidiger | normal | 1.1 | 46 / 120 | Lebenspunkte, Rüstung | Lebenspunkte |
| Drachenschuppen-Beinschienen | Leder | Kämpfer, Verteidiger | selten | 1.15 | 48 / 126 | Ausweichen, Rüstung | Ausweichen |
| Samt-Beinschienen | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | häufig | 0.66 | 28 / 72 | Magischer Krit, Vielseitigkeit | Magischer Krit |
| Brokat-Beinschienen | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.72 | 30 / 79 | Vielseitigkeit, Magischer Krit | Vielseitigkeit |
| Mond-Beinschienen | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.74 | 31 / 81 | Magischer Krit, Ausweichen | Ausweichen |
| Phönixfeder-Beinschienen | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr selten | 0.94 | 39 / 103 | Lebenspunkte, Magischer Krit | Lebenspunkte |
| Urwelt-Beinschienen | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr selten | 0.96 | 40 / 105 | Magischer Krit, Vielseitigkeit | Magischer Krit |

#### Füße  ·  Primär: Rüstung

| Typ | Material | Tragbar | Fund | StatMult | Rüstung (Gew./Epis.) | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|---|---|---|
| Stoff-Stiefel | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr häufig | 0.55 | 23 / 60 | Magischer Krit, Vielseitigkeit, Lebenspunkte | Magischer Krit |
| Leder-Stiefel | Leder | Kämpfer, Verteidiger | sehr häufig | 0.95 | 40 / 104 | Ausweichen, Physischer Krit, Angriffstempo | Physischer Krit |
| Platte-Stiefel | Platte | Verteidiger | sehr häufig | 1.6 | 67 / 175 | Rüstung, Block, Lebenspunkte | Rüstung |
| Seiden-Stiefel | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.72 | 30 / 79 | Magischer Krit, Vielseitigkeit, Lebenspunkte | Magischer Krit |
| Drachenleder-Stiefel | Leder | Kämpfer, Verteidiger | selten | 1.12 | 47 / 122 | Ausweichen, Angriffstempo, Physischer Krit | Ausweichen |
| Drachenplatten-Stiefel | Platte | Verteidiger | sehr selten | 1.9 | 80 / 207 | Rüstung, Lebenspunkte, Block | Rüstung |
| Magier-Stiefel | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | häufig | 0.62 | 26 / 68 | Magischer Krit, Vielseitigkeit | Magischer Krit |
| Hexen-Stiefel | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.66 | 28 / 72 | Magischer Krit, Lebenspunkte, Vielseitigkeit | Magischer Krit |
| Heiler-Stiefel | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.7 | 29 / 76 | Lebenspunkte, Vielseitigkeit | Lebenspunkte |
| Arkan-Stiefel | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.74 | 31 / 81 | Magischer Krit, Angriffstempo | Magischer Krit |
| Runen-Stiefel | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.68 | 29 / 74 | Vielseitigkeit, Magischer Krit | Vielseitigkeit |
| Astral-Stiefel | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.78 | 33 / 85 | Magischer Krit, Lebenspunkte | Lebenspunkte |
| Nebel-Stiefel | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.6 | 25 / 66 | Ausweichen, Vielseitigkeit | Ausweichen |
| Geister-Stiefel | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.72 | 30 / 79 | Ausweichen, Magischer Krit | Ausweichen |
| Schatten-Stiefel | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.8 | 34 / 87 | Magischer Krit, Angriffstempo | Angriffstempo |
| Phönix-Stiefel | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr selten | 0.92 | 39 / 100 | Lebenspunkte, Magischer Krit, Vielseitigkeit | Lebenspunkte |
| Sternenseiden-Stiefel | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr selten | 0.95 | 40 / 104 | Magischer Krit, Vielseitigkeit | Magischer Krit |
| Stahl-Stiefel | Platte | Verteidiger | häufig | 1.62 | 68 / 177 | Rüstung, Block | Block |
| Bronze-Stiefel | Platte | Verteidiger | normal | 1.5 | 63 / 164 | Rüstung, Block, Lebenspunkte | Rüstung |
| Knochen-Stiefel | Platte | Verteidiger | selten | 1.45 | 61 / 158 | Rüstung, Lebenspunkte | Rüstung |
| Obsidian-Stiefel | Platte | Verteidiger | sehr selten | 1.8 | 76 / 197 | Rüstung, Physischer Krit | Rüstung |
| Mithril-Stiefel | Platte | Verteidiger | sehr selten | 1.7 | 71 / 186 | Rüstung, Angriffstempo, Ausweichen | Rüstung |
| Titan-Stiefel | Platte | Verteidiger | sehr selten | 1.95 | 82 / 213 | Rüstung, Lebenspunkte, Block | Rüstung |
| Sternenstahl-Stiefel | Platte | Verteidiger | sehr selten | 1.85 | 78 / 202 | Rüstung, Magischer Krit, Vielseitigkeit | Rüstung |
| Ketten-Stiefel | Leder | Kämpfer, Verteidiger | häufig | 1.05 | 44 / 115 | Rüstung, Ausweichen | Rüstung |
| Schuppen-Stiefel | Leder | Kämpfer, Verteidiger | normal | 1.08 | 45 / 118 | Rüstung, Ausweichen | Ausweichen |
| Eisenholz-Stiefel | Leder | Kämpfer, Verteidiger | normal | 1.0 | 42 / 109 | Rüstung, Ausweichen, Vielseitigkeit | Vielseitigkeit |
| Wolfsleder-Stiefel | Leder | Kämpfer, Verteidiger | normal | 1.02 | 43 / 111 | Ausweichen, Angriffstempo | Angriffstempo |
| Bärenfell-Stiefel | Leder | Kämpfer, Verteidiger | normal | 1.1 | 46 / 120 | Lebenspunkte, Rüstung | Lebenspunkte |
| Drachenschuppen-Stiefel | Leder | Kämpfer, Verteidiger | selten | 1.15 | 48 / 126 | Ausweichen, Rüstung | Ausweichen |
| Samt-Stiefel | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | häufig | 0.66 | 28 / 72 | Magischer Krit, Vielseitigkeit | Magischer Krit |
| Brokat-Stiefel | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.72 | 30 / 79 | Vielseitigkeit, Magischer Krit | Vielseitigkeit |
| Mond-Stiefel | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.74 | 31 / 81 | Magischer Krit, Ausweichen | Ausweichen |
| Phönixfeder-Stiefel | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr selten | 0.94 | 39 / 103 | Lebenspunkte, Magischer Krit | Lebenspunkte |
| Urwelt-Stiefel | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr selten | 0.96 | 40 / 105 | Magischer Krit, Vielseitigkeit | Magischer Krit |

#### Umhang  ·  Primär: Rüstung

| Typ | Material | Tragbar | Fund | StatMult | Rüstung (Gew./Epis.) | Affix-Bias | Flavor (Episch+) |
|---|---|---|---|---|---|---|---|
| Stoff-Umhang | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr häufig | 0.55 | 23 / 60 | Magischer Krit, Vielseitigkeit, Lebenspunkte | Magischer Krit |
| Leder-Umhang | Leder | Kämpfer, Verteidiger | sehr häufig | 0.95 | 40 / 104 | Ausweichen, Physischer Krit, Angriffstempo | Physischer Krit |
| Platte-Umhang | Platte | Verteidiger | sehr häufig | 1.6 | 67 / 175 | Rüstung, Block, Lebenspunkte | Rüstung |
| Seiden-Umhang | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.72 | 30 / 79 | Magischer Krit, Vielseitigkeit, Lebenspunkte | Magischer Krit |
| Drachenleder-Umhang | Leder | Kämpfer, Verteidiger | selten | 1.12 | 47 / 122 | Ausweichen, Angriffstempo, Physischer Krit | Ausweichen |
| Drachenplatten-Umhang | Platte | Verteidiger | sehr selten | 1.9 | 80 / 207 | Rüstung, Lebenspunkte, Block | Rüstung |
| Magier-Umhang | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | häufig | 0.62 | 26 / 68 | Magischer Krit, Vielseitigkeit | Magischer Krit |
| Hexen-Umhang | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.66 | 28 / 72 | Magischer Krit, Lebenspunkte, Vielseitigkeit | Magischer Krit |
| Heiler-Umhang | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.7 | 29 / 76 | Lebenspunkte, Vielseitigkeit | Lebenspunkte |
| Arkan-Umhang | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.74 | 31 / 81 | Magischer Krit, Angriffstempo | Magischer Krit |
| Runen-Umhang | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.68 | 29 / 74 | Vielseitigkeit, Magischer Krit | Vielseitigkeit |
| Astral-Umhang | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.78 | 33 / 85 | Magischer Krit, Lebenspunkte | Lebenspunkte |
| Nebel-Umhang | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.6 | 25 / 66 | Ausweichen, Vielseitigkeit | Ausweichen |
| Geister-Umhang | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.72 | 30 / 79 | Ausweichen, Magischer Krit | Ausweichen |
| Schatten-Umhang | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | selten | 0.8 | 34 / 87 | Magischer Krit, Angriffstempo | Angriffstempo |
| Phönix-Umhang | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr selten | 0.92 | 39 / 100 | Lebenspunkte, Magischer Krit, Vielseitigkeit | Lebenspunkte |
| Sternenseiden-Umhang | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr selten | 0.95 | 40 / 104 | Magischer Krit, Vielseitigkeit | Magischer Krit |
| Stahl-Umhang | Platte | Verteidiger | häufig | 1.62 | 68 / 177 | Rüstung, Block | Block |
| Bronze-Umhang | Platte | Verteidiger | normal | 1.5 | 63 / 164 | Rüstung, Block, Lebenspunkte | Rüstung |
| Knochen-Umhang | Platte | Verteidiger | selten | 1.45 | 61 / 158 | Rüstung, Lebenspunkte | Rüstung |
| Obsidian-Umhang | Platte | Verteidiger | sehr selten | 1.8 | 76 / 197 | Rüstung, Physischer Krit | Rüstung |
| Mithril-Umhang | Platte | Verteidiger | sehr selten | 1.7 | 71 / 186 | Rüstung, Angriffstempo, Ausweichen | Rüstung |
| Titan-Umhang | Platte | Verteidiger | sehr selten | 1.95 | 82 / 213 | Rüstung, Lebenspunkte, Block | Rüstung |
| Sternenstahl-Umhang | Platte | Verteidiger | sehr selten | 1.85 | 78 / 202 | Rüstung, Magischer Krit, Vielseitigkeit | Rüstung |
| Ketten-Umhang | Leder | Kämpfer, Verteidiger | häufig | 1.05 | 44 / 115 | Rüstung, Ausweichen | Rüstung |
| Schuppen-Umhang | Leder | Kämpfer, Verteidiger | normal | 1.08 | 45 / 118 | Rüstung, Ausweichen | Ausweichen |
| Eisenholz-Umhang | Leder | Kämpfer, Verteidiger | normal | 1.0 | 42 / 109 | Rüstung, Ausweichen, Vielseitigkeit | Vielseitigkeit |
| Wolfsleder-Umhang | Leder | Kämpfer, Verteidiger | normal | 1.02 | 43 / 111 | Ausweichen, Angriffstempo | Angriffstempo |
| Bärenfell-Umhang | Leder | Kämpfer, Verteidiger | normal | 1.1 | 46 / 120 | Lebenspunkte, Rüstung | Lebenspunkte |
| Drachenschuppen-Umhang | Leder | Kämpfer, Verteidiger | selten | 1.15 | 48 / 126 | Ausweichen, Rüstung | Ausweichen |
| Samt-Umhang | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | häufig | 0.66 | 28 / 72 | Magischer Krit, Vielseitigkeit | Magischer Krit |
| Brokat-Umhang | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.72 | 30 / 79 | Vielseitigkeit, Magischer Krit | Vielseitigkeit |
| Mond-Umhang | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | normal | 0.74 | 31 / 81 | Magischer Krit, Ausweichen | Ausweichen |
| Phönixfeder-Umhang | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr selten | 0.94 | 39 / 103 | Lebenspunkte, Magischer Krit | Lebenspunkte |
| Urwelt-Umhang | Stoff | Heiler, Kämpfer, Verteidiger, Hexer | sehr selten | 0.96 | 40 / 105 | Magischer Krit, Vielseitigkeit | Magischer Krit |

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
| Lederschild | – | alle | sehr häufig | 0.82 | 34 / 90 | Ausweichen, Rüstung | Ausweichen |
| Eisenschild | – | alle | sehr häufig | 1.02 | 43 / 111 | Rüstung, Block | Rüstung |
| Bronzeschild | – | alle | häufig | 0.98 | 41 / 107 | Rüstung, Block | Rüstung |
| Kite-Schild | – | alle | häufig | 1.06 | 45 / 116 | Rüstung, Block | Block |
| Tropfenschild | – | alle | häufig | 1.0 | 42 / 109 | Rüstung, Ausweichen | Ausweichen |
| Sechseckschild | – | alle | häufig | 1.08 | 45 / 118 | Block, Rüstung | Block |
| Stachelschild | – | alle | häufig | 1.04 | 44 / 114 | Dornen, Rüstung | Dornen |
| Igelschild | – | alle | normal | 1.0 | 42 / 109 | Dornen, Ausweichen | Dornen |
| Rabenschild | – | alle | häufig | 1.0 | 42 / 109 | Ausweichen, Block | Ausweichen |
| Sonnenschild | – | alle | normal | 1.06 | 45 / 116 | Rüstung, Lebenspunkte | Lebenspunkte |
| Mondschild | – | alle | normal | 1.02 | 43 / 111 | Ausweichen, Rüstung | Ausweichen |
| Grabschild | – | alle | normal | 1.1 | 46 / 120 | Dornen, Rüstung | Dornen |
| Phalanx | – | alle | normal | 1.18 | 50 / 129 | Rüstung, Lebenspunkte | Lebenspunkte |
| Wachturm-Schild | – | alle | selten | 1.15 | 48 / 126 | Rüstung, Block | Rüstung |
| Festungsschild | – | alle | selten | 1.2 | 50 / 131 | Rüstung, Lebenspunkte | Lebenspunkte |
| Drachenhornschild | – | alle | selten | 1.18 | 50 / 129 | Dornen, Rüstung | Dornen |
| Titanenwall | – | alle | extrem selten | 1.3 | 55 / 142 | Rüstung, Lebenspunkte | Rüstung |

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
| Wolfs-Amulett | v0 | sehr häufig | 1.0 | 42 / 109 | Schaden, Angriffstempo | Schaden |
| Bären-Amulett | v2 | sehr häufig | 1.0 | 42 / 109 | Lebenspunkte, Rüstung | Lebenspunkte |
| Adler-Amulett | v4 | sehr häufig | 1.0 | 42 / 109 | Physischer Krit, Ausweichen | Physischer Krit |
| Schlangen-Amulett | v5 | häufig | 1.0 | 42 / 109 | Lebensraub, Physischer Krit | Lebensraub |
| Rubinkette | v0 | sehr häufig | 1.0 | 42 / 109 | Schaden, Krit-Schaden | Krit-Schaden |
| Saphirkette | v1 | sehr häufig | 1.0 | 42 / 109 | Magischer Krit, Lebenspunkte | Magischer Krit |
| Smaragdkette | v2 | sehr häufig | 1.0 | 42 / 109 | Lebenspunkte, Lebensraub | Lebenspunkte |
| Erd-Amulett | v2 | häufig | 1.0 | 42 / 109 | Rüstung, Lebenspunkte | Rüstung |
| Sturm-Amulett | v4 | häufig | 1.0 | 42 / 109 | Angriffstempo, Physischer Krit | Angriffstempo |
| Helden-Amulett | v3 | häufig | 1.0 | 42 / 109 | Schaden, Lebenspunkte | Schaden |
| Seelenstein | v6 | häufig | 1.0 | 42 / 109 | Lebensraub, Magischer Krit | Lebensraub |
| Herzstein | v6 | häufig | 1.0 | 42 / 109 | Lebenspunkte, Vielseitigkeit | Lebenspunkte |
| Blutstein | v7 | häufig | 1.0 | 42 / 109 | Lebensraub, Schaden | Lebensraub |
| Wind-Amulett | v8 | häufig | 1.0 | 42 / 109 | Angriffstempo, Ausweichen | Angriffstempo |
| Sonnenmedaillon | v9 | häufig | 1.0 | 42 / 109 | Vielseitigkeit, Magischer Krit | Vielseitigkeit |
| Sternmedaillon | v10 | normal | 1.0 | 42 / 109 | Magischer Krit, Krit-Schaden | Krit-Schaden |
| Mondmedaillon | v11 | normal | 1.0 | 42 / 109 | Ausweichen, Vielseitigkeit | Ausweichen |
| Drachenherz | v10 | sehr selten | 1.05 | 44 / 115 | Lebenspunkte, Schaden | Lebenspunkte |
| Weltenstein | v9 | sehr selten | 1.05 | 44 / 115 | Vielseitigkeit, Magischer Krit | Vielseitigkeit |

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
| Eisenring | v2 | sehr häufig | 1.0 | 42 / 109 | Rüstung, Lebenspunkte | Rüstung |
| Goldring | v0 | sehr häufig | 1.0 | 42 / 109 | Schaden, Krit-Schaden | Krit-Schaden |
| Silberreif | v4 | sehr häufig | 1.0 | 42 / 109 | Ausweichen, Angriffstempo | Ausweichen |
| Rubinring | v0 | sehr häufig | 1.0 | 42 / 109 | Schaden, Physischer Krit | Physischer Krit |
| Saphirreif | v1 | sehr häufig | 1.0 | 42 / 109 | Magischer Krit, Lebenspunkte | Magischer Krit |
| Smaragdring | v2 | sehr häufig | 1.0 | 42 / 109 | Lebenspunkte, Lebensraub | Lebensraub |
| Schutz-Ring | v2 | häufig | 1.0 | 42 / 109 | Rüstung, Ausweichen | Ausweichen |
| Flink-Ring | v4 | häufig | 1.0 | 42 / 109 | Angriffstempo, Ausweichen | Angriffstempo |
| Raub-Ring | v5 | häufig | 1.0 | 42 / 109 | Lebensraub, Physischer Krit | Lebensraub |
| Berserker-Ring | v3 | häufig | 1.0 | 42 / 109 | Schaden, Lebensraub | Schaden |
| Weisen-Ring | v5 | häufig | 1.0 | 42 / 109 | Vielseitigkeit, Magischer Krit | Vielseitigkeit |
| Zwillingsring | v6 | häufig | 1.0 | 42 / 109 | Physischer Krit, Angriffstempo | Angriffstempo |
| Paar-Ring | v7 | häufig | 1.0 | 42 / 109 | Schaden, Krit-Schaden | Krit-Schaden |
| Doppelstein-Ring | v8 | häufig | 1.0 | 42 / 109 | Magischer Krit, Krit-Schaden | Magischer Krit |
| Wappensiegel | v9 | häufig | 1.0 | 42 / 109 | Rüstung, Schaden | Schaden |
| Macht-Siegel | v10 | normal | 1.0 | 42 / 109 | Schaden, Krit-Schaden | Krit-Schaden |
| Ahnen-Siegel | v11 | normal | 1.0 | 42 / 109 | Vielseitigkeit, Lebenspunkte | Vielseitigkeit |
| Drachen-Siegel | v11 | sehr selten | 1.05 | 44 / 115 | Krit-Schaden, Schaden | Krit-Schaden |
| Ewigkeitsring | v8 | sehr selten | 1.05 | 44 / 115 | Vielseitigkeit, Lebenspunkte | Vielseitigkeit |

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

**Summe:** 404 Basis-Typen × 6 Seltenheiten = 2424 Item-Ausprägungen.

> Sprites sind prozedural (SVG, Variante 0–6). Mehrere Typen können sich eine Silhouette teilen –
> sie unterscheiden sich über Name, Primärwert (StatMult), Affix-Fokus und Fund-Häufigkeit.
> Die **Fund**-Spalte spiegelt das Typ-Gewicht: Top-Typen (z. B. Zweihänder, Drachenplatten, Titanenschild) sind selten.
