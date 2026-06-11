# Talentbäume – Review & Überarbeitung (WoW-Vorbild)

> Analyse der vier Klassen-Talentbäume mit Verbesserungsvorschlägen nach
> World-of-Warcraft-Vorbild – **und** deren Umsetzung in den Datendateien.
> Quellen: `js/data/talents.js` (Bäume), `js/data/classes.js` (Grundfähigkeiten),
> Kampfwirkung in `js/core/duel.js` + `js/core/tower.js#computePlayerStats`.

Die Überarbeitung der **24 aktiven Talent-Fähigkeiten** (Stufe 5 & 9) zielt auf
**Nicht-Redundanz, Klassenidentität und je eine eigene, aufwendige Animation**. Die
Mechaniken stammen weiter aus den vorhandenen Bausteinen (`heal · burst · drain ·
critBoost · dmgBoost · dmgReduce · lifesteal · hot · dot · absorb · cleanse · deathsave ·
reflect · vulnerability · avatar · stun`); **neu** hinzugekommen ist genau **ein**
Aktiv-Typ `echo` (Soforttreffer + verzögertes Echo, für *Arkanschlag*). Layout bleibt
10 Stufen × 3 Optionen, Aktiv-Stufen auf 5 & 9. **Alle Talent-IDs bleiben erhalten** –
bestehende Spielstände sind kompatibel; nur Name/Icon/Wirkung/Animation je Aktive ändern sich.

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

3. **Redundante Aktive über die Klassen hinweg.** Es gab **3× nahezu identische
   Wiederbelebung** (`deathsave`: Verteidiger/Heiler/Hexer), **2× Lebensraub-Buff**,
   **2× identische Betäubung**, **2× Schadensreduktion** (plus Grundfähigkeit Schildwall),
   beim Schurken **zwei gleiche DoTs** und **vier austauschbare „X % Sofortschaden"-Bursts**.
   Verschiedene Klassen fühlten sich in den Aktiv-Stufen gleich an.

4. **Verwaiste Animations-Einträge.** Im `ABILITY_VFX`-Register lagen ~16 Signaturen aus
   einer früheren Talent-Iteration, deren IDs es nicht mehr gab → mehrere Aktive fielen
   auf generische Effekte zurück und hatten **keine eigene Animation**.

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

## 3. Aktive Fähigkeiten – Redesign (Vorher → Nachher)

Ziel: jede Mechanik hat **genau einen klaren Platz**. Es gibt jetzt **nur noch eine
Wiederbelebung** (Verteidiger), **einen Lebensraub-Buff** (Hexer), **eine Talent-
Schadensreduktion** (Verteidiger) und **eine Betäubung** (Schurke). Die vier generischen
Bursts wurden zu Echo-, Kanal- und Meteorschauer-Effekten ausdifferenziert.

| Klasse · Stufe | Fähigkeit | Vorher (kind) | Nachher (kind · Werte) | Warum |
|---|---|---|---|---|
| Schurke 5 | **Tödliche Toxine** | dot | dot 55 %/s · 8 s | Signatur-Gift bleibt |
| Schurke 5 | **Beutejagd** | lifesteal | **critBoost** +35 % / 8 s | entfernt Lebensraub-Dopplung |
| Schurke 5 | **Klingensturm** | burst | **dot** 90 %/0,6 s · 2,4 s | rotierender Mehrfachtreffer statt flachem Burst |
| Schurke 9 | **Aderlass** | dot | **vulnerability** +30 % / 9 s · 160 % Treffer | kein 2. DoT mehr; Wunde aufreißen |
| Schurke 9 | **Meuchelstoß** | stun | stun 350 % + 3 s | einzige physische Betäubung |
| Schurke 9 | **Schattentanz** | dmgReduce | **dmgBoost** +55 % / 9 s | entfernt dmgReduce-Dopplung |
| Verteidiger 5 | **Schildwurf** | vulnerability | vulnerability +30 % + 150 % | unverändert |
| Verteidiger 5 | **Vergeltung** | reflect | reflect 45 % / 8 s | unverändert |
| Verteidiger 5 | **Letzte Bastion** | heal | **absorb** 45 % / 10 s | Schild statt Heilung (entzerrt heal) |
| Verteidiger 9 | **Avatar des Wächters** | avatar | avatar +40 % / −40 % · 8 s | unverändert |
| Verteidiger 9 | **Letzter Wall** | deathsave | deathsave 30 % | **einzige Wiederbelebung im Spiel** |
| Verteidiger 9 | **Unbeugsam** | dmgReduce | dmgReduce −70 % / 9 s | einzige Talent-Schadensreduktion |
| Heiler 5 | **Verjüngung** | hot | hot 8 %/s · 8 s | unverändert |
| Heiler 5 | **Arkanschlag** | burst | **echo** 160 % + 100 % nach 0,5 s | Doppel-Detonation (neuer Typ) |
| Heiler 5 | **Schutzschild** | absorb | absorb 40 % / 10 s | unverändert |
| Heiler 9 | **Engelsgeist** | deathsave | **hot** 18 %/s · 6 s | Notfall-Regen statt 2. Wiederbelebung |
| Heiler 9 | **Sternenregen** | burst | **dot** 85 %/s · 6 s | Meteorschauer statt flachem Burst |
| Heiler 9 | **Reinigung** | cleanse | cleanse +25 % Heilung | unverändert |
| Hexer 5 | **Verderbnis** | drain | drain 70 %/s · 6 s | unverändert |
| Hexer 5 | **Aderlass-Ritual** | drain | drain 65 %/s · 4 s | unverändert |
| Hexer 5 | **Schattenblitz** | stun | **burst** 260 % | entfernt Betäubungs-Dopplung |
| Hexer 9 | **Chaosregen** | burst | **dot** 80 %/s · 7 s | Teufelsregen statt flachem Burst |
| Hexer 9 | **Seelenfresser** | deathsave | **drain** 95 %/s · 6 s | großer Kanal statt 3. Wiederbelebung |
| Hexer 9 | **Blutritual** | lifesteal | lifesteal +30 % / 8 s | einziger Lebensraub-Buff im Spiel |

> **Grundfähigkeiten** (`classes.js`) bleiben unverändert.

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
| **5** | **Tödliche Toxine** dot 55 %/s · 8 s | **Beutejagd** +35 % Krit / 8 s | **Klingensturm** Kanal 90 %/0,6 s · 2,4 s |
| 6 | Meistergift +9 % Krit | Freibeuter +7 % Lebensraub | Abgehärtet +18 % Leben |
| 7 | Auslöschen +6 % Krit · +25 % Krit-Schaden | Klingentanz +10 % Tempo | Schattenklinge +18 % Schaden |
| 8 | Aufschlitzen +6 % Krit · +30 % Krit-Schaden | Räuberblut +8 % Lebensraub | Meucheltechnik +18 % Schaden |
| **9** | **Aderlass** Verwundbar +30 % / 9 s · 160 % | **Meuchelstoß** burst 350 % + 3 s Betäubung | **Schattentanz** +55 % Schaden / 9 s |
| 10 | Großmeuchler +18 % Schaden · +12 % Krit · +30 % Krit-Schaden | Freibeuterkönig +15 % Schaden · +12 % Tempo · +10 % Lebensraub | Meister der Schatten +25 % Schaden · +15 % Leben |

### 🛡️ Verteidiger — Bollwerk · Rächer · Ausweicher
| St. | Säule 1 (Bollwerk) | Säule 2 (Rächer) | Säule 3 (Ausweicher) |
|---|---|---|---|
| 1 | Panzerung +12 % Rüstung | Dornenhaut +6 Dornen | Konstitution +12 % Leben |
| 2 | Schwere Rüstung +10 Block | Vergeltung +8 Dornen | Ausweichen +6 % Ausweichen |
| 3 | Standhaft +12 Block | Stachelpanzer +10 Dornen | Hohe Konstitution +18 % Leben |
| 4 | Festung +18 % Rüstung | Gegenwehr +12 % Schaden · +6 Dornen | Wendigkeit +7 % Ausweichen |
| **5** | **Schildwurf** Verwundbar +30 % + 150 % | **Vergeltung** Reflektiert 45 % / 8 s | **Letzte Bastion** Schild 45 % / 10 s |
| 6 | Bollwerk +22 % Rüstung | Klingenwall +14 Dornen | Titanenhaut +22 % Leben |
| 7 | Bastion +18 Block | Dornenfeld +16 Dornen | Schattenschritt +8 % Ausweichen |
| 8 | Unbeugsamer Block +20 Block | Vergeltungsdornen +20 Dornen | Koloss +28 % Leben |
| **9** | **Avatar des Wächters** +40 % Sch / −40 % · 8 s | **Letzter Wall** Todesrettung 30 % | **Unbeugsam** −70 % Schaden / 9 s |
| 10 | Festungswall +25 % Rüstung · +20 Block | Dornengott +15 % Rüstung · +12 % Schaden · +24 Dornen | Unerschütterlich +30 % Leben · +20 % Rüstung · +6 % Ausweichen |

### ✨ Heiler — Lichtwirker · Sternenmagier · Bewahrer
| St. | Säule 1 (Lichtwirker) | Säule 2 (Sternenmagier) | Säule 3 (Bewahrer) |
|---|---|---|---|
| 1 | Lebenskraft +12 % Leben | Arkane Kraft +10 % Schaden | Innere Ruhe +5 % Vielseitigkeit |
| 2 | Aderlass +5 % Lebensraub | Zaubermacht +12 % Schaden | Vielseitig +6 % Vielseitigkeit |
| 3 | Hohe Lebenskraft +18 % Leben | Konzentration +8 % Magie-Krit | Magieschild +15 % Rüstung |
| 4 | Lebensquell +7 % Lebensraub | Lichtmagie +15 % Schaden | Harmonie +8 % Vielseitigkeit |
| **5** | **Verjüngung** HoT 8 %/s · 8 s | **Arkanschlag** Echo 160 % + 100 % | **Schutzschild** Schild 40 % / 10 s |
| 6 | Unsterblichkeit +20 % Leben | Erleuchtung +10 % Magie-Krit | Gleichmut +10 % Vielseitigkeit |
| 7 | Lebensbrunnen +9 % Lebensraub | Hohe Magie +18 % Schaden | Geistschild +18 % Rüstung |
| 8 | Ewiges Leben +25 % Leben | Arkanmeister +6 % Magie-Krit · +30 % Krit-Schaden | Bewahrung +12 % Vielseitigkeit |
| **9** | **Engelsgeist** HoT 18 %/s · 6 s | **Sternenregen** Sternfall-DoT 85 %/s · 6 s | **Reinigung** Reinigt + 25 % Heilung |
| 10 | Hohepriester +30 % Leben · +12 % Lebensraub | Avatar des Lichts +25 % Schaden · +12 % Magie-Krit | Hüter der Zeit +12 % Schaden · +15 % Rüstung · +12 % Vielseitigkeit |

### 🔮 Hexer — Verderbnis · Seelensauger · Schattenweber
| St. | Säule 1 (Verderbnis) | Säule 2 (Seelensauger) | Säule 3 (Schattenweber) |
|---|---|---|---|
| 1 | Verderbnis +10 % Schaden | Seelendurst +5 % Lebensraub | Verderbtes Blut +12 % Leben |
| 2 | Schattenmacht +12 % Schaden | Aderlass +6 % Lebensraub | Verfall +25 % Krit-Schaden |
| 3 | Fluch der Schwäche +8 % Magie-Krit | Lebensentzug +7 % Lebensraub | Hexenblut +15 % Leben |
| 4 | Finstere Gewalt +15 % Schaden | Blutpakt +8 % Lebensraub | Seelenfeuer +5 % Magie-Krit · +25 % Krit-Schaden |
| **5** | **Verderbnis** Kanal 70 %/s · 6 s | **Aderlass-Ritual** Kanal 65 %/s · 4 s | **Schattenblitz** burst 260 % |
| 6 | Dunkle Magie +18 % Schaden | Vampirismus +9 % Lebensraub | Verdammnis +5 % Magie-Krit · +30 % Krit-Schaden |
| 7 | Seelenbrand +18 % Schaden | Zähes Blut +10 % Lebensraub | Qual +40 % Krit-Schaden |
| 8 | Schattenmeister +20 % Schaden | Blutmagie +10 % Lebensraub | Hexenmeister +6 % Magie-Krit · +25 % Krit-Schaden |
| **9** | **Chaosregen** Teufelsregen-DoT 80 %/s · 7 s | **Seelenfresser** Kanal 95 %/s · 6 s | **Blutritual** +30 % Lebensraub / 8 s |
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
