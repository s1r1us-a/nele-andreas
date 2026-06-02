# Talentbäume – Review & Überarbeitung (WoW-Vorbild)

> Analyse der vier Klassen-Talentbäume mit Verbesserungsvorschlägen nach
> World-of-Warcraft-Vorbild – **und** deren Umsetzung in den Datendateien.
> Quellen: `js/data/talents.js` (Bäume), `js/data/classes.js` (Grundfähigkeiten),
> Kampfwirkung in `js/core/duel.js` + `js/core/tower.js#computePlayerStats`.

Die Überarbeitung bleibt **bewusst im bestehenden System**: keine neuen Aktiv-Typen,
keine Procs/Bedingungseffekte, keine Engine-Änderung. Verbessert wurden **Struktur,
Balance, Flavor und die Profilschärfe der aktiven Fähigkeiten** innerhalb der
vorhandenen Bausteine (`heal · burst · drain · critBoost · dmgBoost · dmgReduce ·
lifesteal`). Layout bleibt 10 Stufen × 3 Optionen, Aktiv-Stufen auf 5 & 9.

---

## 1. Befund: Was am alten Design schwach war

1. **Keine Build-Identität.** Die drei Optionen je Stufe gehörten keinem durchgehenden
   Pfad an (z. B. Schurke Stufe 4: Schaden / Leben / Tempo – drei Themen ohne roten
   Faden). In WoW „geht man eine Säule herunter" und wird dafür belohnt – das fehlte
   völlig. Talente waren austauschbare Einzel-Stat-Picks statt Strategie.

2. **Ungleichwertige Optionen (EV-Schieflage).** Flache Werte dominierten die
   Prozent-Optionen, besonders früh:
   - `+0,06 critPhys` verdoppelt fast die Krit-Chance (Basis 0,05).
   - `+8 % Schaden` wirkt auf das **kleine** Gear-`b.damage` und bringt early kaum etwas.
   - `+0,25 critDamage` allein ≈ **1,4 % DPS** – die mit Abstand schwächste Wahl.
   → Die Wahl war oft „offensichtlich", keine echte Entscheidung.

3. **Profillose Aktive.** Die Aktiv-Stufen boten häufig „mehr vom selben Stat", und fast
   **alle Cooldowns waren 30 s** – kein Entscheidungsdruck zwischen kurzem Nuke und
   langer Defensive.

4. **Inkonsistenter Hexer-Drain.** Die Talent-Drains (`hexer_a5_ritual`,
   `hexer_a9_fresser`) hatten **kein `dur`/`tickMs`** → fielen in `duel.js` durch die
   Kanal-Logik und wirkten als Einmal-Burst, während die Grundfähigkeit `seelenraub` ein
   echter Kanal ist. Verwässerte die Hexer-Identität.

---

## 2. Leitidee: „Säulen = Spezialisierungen"

Jede Stufe behält 3 Optionen, aber **Spalte 1 / 2 / 3 gehört durchgehend derselben
Spezialisierung an**. Wer konsequent dieselbe Spalte wählt, baut einen kohärenten,
WoW-artigen Spec; die Aktiv-Stufen (5/9) und der Schlussstein (10) verstärken genau
diese Säule. Die Dateistruktur bleibt identisch – nur Reihenfolge, Werte, Namen/Icons
wurden angepasst. Bei den anderen drei Klassen **bleiben alle Talent-IDs erhalten**,
daher bleiben bestehende Spielstände kompatibel (siehe `isValidChoice`).

> **Hinweis Schurke:** Der frühere **Kämpfer** wurde zum **Schurken** umgestaltet
> (neuer Talentbaum mit eigenen IDs `schurke_*` und neuer Grundfähigkeit
> *Kaltblütigkeit*). Altstände werden in `migrateSlot` automatisch auf die neue
> Klassen-Id gehoben; nicht mehr gültige Kämpfer-Talente werden erkannt und die
> Punkte erstattet (kein manueller Respec nötig).

| Klasse | Säule 1 | Säule 2 | Säule 3 |
|---|---|---|---|
| **🗡️ Schurke** | **Meucheln** – Krit & Krit-Schaden, Gift-Burst | **Gesetzloser** – Tempo & Lebensraub, Sustain | **Täuschung** – Schatten-Schaden, Ausweichen & Leben |
| **🛡️ Verteidiger** | **Bollwerk** – Rüstung & Block, Defensive | **Rächer** – Dornen & Schaden, Konter | **Ausweicher** – Ausweichen & Leben, Heilung |
| **✨ Heiler** | **Lichtwirker** – Leben & Heilung | **Sternenmagier** – Schaden % & Magie-Krit | **Bewahrer** – Vielseitigkeit & Rüstung, Utility |
| **🔮 Hexer** | **Verderbnis** – Schaden % & Magie-Krit | **Seelensauger** – Lebensraub, Drain-Kanal | **Schattenweber** – Krit-Schaden & Leben |

### Begleitende Balance-Prinzipien
- **EV-Angleichung:** Frühe `%Schaden`-Knoten leicht angehoben (z. B. Schurke-`Schattenschritt`
  `+10 %`); reine `critDamage`-Knoten **immer an Krit-Chance gekoppelt**
  (z. B. `Verstümmeln` = `+4 % Krit · +15 % Krit-Schaden`), damit sie sich lohnen.
- **CD-Spreizung** statt 4×30 s: **Nukes 20–24 s**, **Buffs 24–26 s**,
  **starke Defensiven 28–32 s** → echte Tempo-Entscheidungen.
- **Aktiv-Rollen pro Stufe getrennt:** Spalte 1 = Nuke/Defensive der Säule,
  Spalte 2 = Sustain, Spalte 3 = Ramp/Utility – nie dreimal dasselbe.
- **Schlusssteine** (Stufe 10) klar als stärkster Knoten ihrer Säule aufgewertet.
- Soft-Clamps (`applyTalents`: critPhys/critMagic ≤ 0,9 · attackSpeed ≤ 0,75) bleiben;
  Voll-Krit-Builds streifen die Grenze erst spät.

---

## 3. Aktive Fähigkeiten – Vorher → Nachher

| Klasse · Stufe | Fähigkeit | Vorher | Nachher | Rolle |
|---|---|---|---|---|
| Schurke 5 | Ausweiden | burst (war „Wirbelsturm") | **burst 240 % · CD 20 s** | Nuke (Meucheln) |
| Schurke 5 | Beutejagd | dmgBoost (war „Kampfrausch") | **lifesteal +30 % / 8 s** | Sustain (Gesetzloser) |
| Schurke 5 | Schattentanz | critBoost (war „Schlachtwut") | **dmgBoost +40 % / 8 s** | Ramp (Täuschung) |
| Schurke 9 | Todesstoß | burst (war „Hinrichtung") | **burst 400 % · CD 24 s** | Execute-Nuke |
| Schurke 9 | Verschwinden | dmgBoost (war „Berserkermodus") | **dmgReduce −60 % / 9 s** | Defensive (Täuschung) |
| Verteidiger 5 | Schildschlag | burst 200 % · CD 22 s | **burst 200 % · CD 20 s** | Konter (Rächer) |
| Verteidiger 9 | Schildwucht | burst 300 % · CD 30 s | **burst 300 % · CD 24 s** | Konter-Nuke |
| Heiler 5 | Arkanschlag | burst 260 % · CD 22 s | **burst 250 % · CD 20 s** | Nuke (Sternenmagier) |
| Heiler 9 | Sternenregen | burst 400 % · CD 30 s | **burst 380 % · CD 24 s** | Nuke |
| Hexer 5 | Aderlass-Ritual | **Einmal-Burst** 250 % | **Kanal 65 %/s · 4 s** (heilt) | Drain (Seelensauger) |
| Hexer 5 | Schattenblitz | lifesteal (war „Blutrausch") | **burst 250 % · CD 20 s** | Nuke (Verderbnis/Weber) |
| Hexer 9 | Seelenfresser | **Einmal-Burst** 400 % | **Kanal 80 %/s · 5 s** (heilt) | Drain |

> **Grundfähigkeiten** (`classes.js`): leichte CD-Differenzierung statt überall 30 s –
> Kaltblütigkeit 28 s, Seelenraub 26 s, Schildwall 32 s (sehr starke Defensive), Heilkreis 30 s.

---

## 4. Überarbeitete Bäume im Überblick

Lesart: **[ Säule 1 · Säule 2 · Säule 3 ]**. Aktiv-Stufen sind **fett** markiert.

### 🗡️ Schurke — Meucheln · Gesetzloser · Täuschung
| St. | Säule 1 (Meucheln) | Säule 2 (Gesetzloser) | Säule 3 (Täuschung) |
|---|---|---|---|
| 1 | Tödliche Gifte +6 % Krit | Flinke Klingen +6 % Tempo | Schattenschritt +10 % Schaden |
| 2 | Verstümmeln +4 % Krit · +15 % Krit-Schaden | Säbelhieb +7 % Tempo | Hinterhältig +12 % Schaden |
| 3 | Scharfe Klingen +7 % Krit | Beutezug +5 % Lebensraub | Zähigkeit +12 % Leben |
| 4 | Tödliche Präzision +5 % Krit · +20 % Krit-Schaden | Schwertkunst +9 % Tempo | Finsternis +15 % Schaden |
| **5** | **Ausweiden** burst 240 % | **Beutejagd** +30 % Lebensraub | **Schattentanz** +40 % Schaden |
| 6 | Meistergift +9 % Krit | Freibeuter +7 % Lebensraub | Abgehärtet +18 % Leben |
| 7 | Auslöschen +6 % Krit · +25 % Krit-Schaden | Klingentanz +10 % Tempo | Schattenklinge +18 % Schaden |
| 8 | Aufschlitzen +6 % Krit · +30 % Krit-Schaden | Räuberblut +8 % Lebensraub | Meucheltechnik +18 % Schaden |
| **9** | **Todesstoß** burst 400 % | **Tötungsrausch** +40 % Lebensraub | **Verschwinden** −60 % Schaden / 9 s |
| 10 | Großmeuchler +18 % Schaden · +12 % Krit · +30 % Krit-Schaden | Freibeuterkönig +15 % Schaden · +12 % Tempo · +10 % Lebensraub | Meister der Schatten +25 % Schaden · +15 % Leben |

### 🛡️ Verteidiger — Bollwerk · Rächer · Ausweicher
| St. | Säule 1 (Bollwerk) | Säule 2 (Rächer) | Säule 3 (Ausweicher) |
|---|---|---|---|
| 1 | Panzerung +12 % Rüstung | Dornenhaut +6 Dornen | Konstitution +12 % Leben |
| 2 | Schwere Rüstung +10 Block | Vergeltung +8 Dornen | Ausweichen +6 % Ausweichen |
| 3 | Standhaft +12 Block | Stachelpanzer +10 Dornen | Hohe Konstitution +18 % Leben |
| 4 | Festung +18 % Rüstung | Gegenwehr +12 % Schaden · +6 Dornen | Wendigkeit +7 % Ausweichen |
| **5** | **Trotzschlag** −55 % Schaden / 8 s | **Schildschlag** burst 200 % | **Letzte Bastion** Heilung 35 % |
| 6 | Bollwerk +22 % Rüstung | Klingenwall +14 Dornen | Titanenhaut +22 % Leben |
| 7 | Bastion +18 Block | Dornenfeld +16 Dornen | Schattenschritt +8 % Ausweichen |
| 8 | Unbeugsamer Block +20 Block | Vergeltungsdornen +20 Dornen | Koloss +28 % Leben |
| **9** | **Unbeugsam** −70 % Schaden / 9 s | **Schildwucht** burst 300 % | **Standhalten** Heilung 50 % |
| 10 | Festungswall +25 % Rüstung · +20 Block | Dornengott +15 % Rüstung · +12 % Schaden · +24 Dornen | Unerschütterlich +30 % Leben · +20 % Rüstung · +6 % Ausweichen |

### ✨ Heiler — Lichtwirker · Sternenmagier · Bewahrer
| St. | Säule 1 (Lichtwirker) | Säule 2 (Sternenmagier) | Säule 3 (Bewahrer) |
|---|---|---|---|
| 1 | Lebenskraft +12 % Leben | Arkane Kraft +10 % Schaden | Innere Ruhe +5 % Vielseitigkeit |
| 2 | Aderlass +5 % Lebensraub | Zaubermacht +12 % Schaden | Vielseitig +6 % Vielseitigkeit |
| 3 | Hohe Lebenskraft +18 % Leben | Konzentration +8 % Magie-Krit | Magieschild +15 % Rüstung |
| 4 | Lebensquell +7 % Lebensraub | Lichtmagie +15 % Schaden | Harmonie +8 % Vielseitigkeit |
| **5** | **Lichtblitz** Heilung 40 % | **Arkanschlag** burst 250 % | **Macht-Infusion** +45 % Schaden |
| 6 | Unsterblichkeit +20 % Leben | Erleuchtung +10 % Magie-Krit | Gleichmut +10 % Vielseitigkeit |
| 7 | Lebensbrunnen +9 % Lebensraub | Hohe Magie +18 % Schaden | Geistschild +18 % Rüstung |
| 8 | Ewiges Leben +25 % Leben | Arkanmeister +6 % Magie-Krit · +30 % Krit-Schaden | Bewahrung +12 % Vielseitigkeit |
| **9** | **Segen des Lichts** Heilung 60 % | **Sternenregen** burst 380 % | **Arkane Klarheit** +70 % Krit / 8 s |
| 10 | Hohepriester +30 % Leben · +12 % Lebensraub | Avatar des Lichts +25 % Schaden · +12 % Magie-Krit | Hüter der Zeit +12 % Schaden · +15 % Rüstung · +12 % Vielseitigkeit |

### 🔮 Hexer — Verderbnis · Seelensauger · Schattenweber
| St. | Säule 1 (Verderbnis) | Säule 2 (Seelensauger) | Säule 3 (Schattenweber) |
|---|---|---|---|
| 1 | Verderbnis +10 % Schaden | Seelendurst +5 % Lebensraub | Verderbtes Blut +12 % Leben |
| 2 | Schattenmacht +12 % Schaden | Aderlass +6 % Lebensraub | Verfall +25 % Krit-Schaden |
| 3 | Fluch der Schwäche +8 % Magie-Krit | Lebensentzug +7 % Lebensraub | Hexenblut +15 % Leben |
| 4 | Finstere Gewalt +15 % Schaden | Blutpakt +8 % Lebensraub | Seelenfeuer +5 % Magie-Krit · +25 % Krit-Schaden |
| **5** | **Schattenbrand** +45 % Schaden | **Aderlass-Ritual** Kanal 65 %/s · 4 s | **Schattenblitz** burst 250 % |
| 6 | Dunkle Magie +18 % Schaden | Vampirismus +9 % Lebensraub | Verdammnis +5 % Magie-Krit · +30 % Krit-Schaden |
| 7 | Seelenbrand +18 % Schaden | Zähes Blut +10 % Lebensraub | Qual +40 % Krit-Schaden |
| 8 | Schattenmeister +20 % Schaden | Blutmagie +10 % Lebensraub | Hexenmeister +6 % Magie-Krit · +25 % Krit-Schaden |
| **9** | **Schattenexplosion** burst 400 % | **Seelenfresser** Kanal 80 %/s · 5 s | **Blutritual** +40 % Lebensraub / 8 s |
| 10 | Seelenherr +25 % Schaden · +12 % Magie-Krit | Blutkönig +15 % Schaden · +28 % Lebensraub | Dämonenfürst +18 % Schaden · +15 % Leben · +40 % Krit-Schaden |

---

## 5. Weiterführende Ideen (bewusst NICHT umgesetzt)

Diese erfordern Engine-Erweiterungen und sind hier nur als Ausblick festgehalten:

- **Bedingungseffekte** im WoW-Stil: „Hinrichtung verursacht doppelten Schaden unter
  30 % Gegner-HP", „unter 35 % eigenem Leben +20 % Rüstung". Bräuchte HP-Checks in
  `strike`/`applyDuelAbility`.
- **Procs/Trigger**: „Bei Krit: nächster Schlag +X", „Nach Aktiv-Einsatz: Tempo-Schub".
  Bräuchte ein Event-/Buff-Hooks-System in der Kampfschleife.
- **Fähigkeits-modifizierende Talente**: ein Passiv, das eine konkrete Aktive verändert
  (z. B. „Wirbelsturm trifft 2×"). Bräuchte eine Verknüpfung Passiv → Aktiv.
- **Mehr als 2 Aktiv-Stufen** für eine vollere Rotation (mehr Kampf-Knöpfe).
