# Boss-Übersicht – Idle Abenteuer

> **Automatisch generiert** aus `adventure/js/data/bosses.js` (Single Source of Truth).
> Nicht von Hand editieren – stattdessen die Datendatei ändern und `node tools/gen-bosse-doc.mjs` neu ausführen.

Bosse sind das Fortschritts-Gate: Wer einen Boss besiegt, schaltet den nächsten frei und erhält
**Gold + XP + einen garantierten Gegenstand**. Jeder Boss ist **deutlich härter** als der Vorgänger
(~×1,45 HP/Angriff pro Stufe). Zusätzlich erzwingt ein **Soft-Enrage** ab Runde 45 (bzw. 22 bei der
`enrage`/Raserei-Mechanik) hohen Schaden – ohne Item-Grind sind späte Bosse nicht besiegbar.

- **Gold pro Sieg:** `recPower × 1.5 + 40`
- **XP pro Sieg:** `recPower × 0.9 + 40` (Niederlage: 15 % als Trost-XP)
- **Garantierter Drop:** episch (Boss 1–22) · legendär (23–34) · mythisch (35+)
- **Erstkill-Bonus:** zusätzliches Gold + Heiltrank beim ersten Sieg
- **Farmen:** besiegte Bosse erneut für Loot farmbar (reduzierte Belohnung)

## Mechaniken

| Key | Effekt |
|-----|--------|
| `wut` | 😡 Unter 30 % HP: Angriff +50 %. |
| `dornen` | 🌵 Reflektiert 15 % erlittenen Schaden. |
| `gift` | ☠️ Stapelndes Gift, Schaden pro Runde. |
| `berserk` | 💢 Angriff +3 % kumulativ pro Runde. |
| `betaeubung` | 😵 12 % Chance, dich eine Runde auszusetzen. |
| `regen` | ➕ Heilt alle 3 Runden 4 % max HP. |
| `eispanzer` | 🛡️ Alle 5 Runden 2 Runden −60 % Schaden. |
| `ruestungsbruch` | 🔨 Senkt deine Rüstung pro Treffer. |
| `feueratem` | 🔥 Alle 4 Runden Großschlag, ignoriert Rüstung. |
| `lebensentzug` | 🩸 Heilt sich um 40 % des Schadens. |
| `hinrichtung` | ⚔️ +100 % Schaden, wenn du unter 25 % HP bist. |
| `frost` | ❄️ Verlangsamt deinen Angriffstakt. |
| `enrage` | ⏱️ Früher harter Enrage – erzwingt hohen DPS. |
| `add_spawn` | 👹 Ruft Diener, die mit der Zeit mehr Schaden machen. |
| `schildphase` | ✨ Wird periodisch kurz unverwundbar. |
| `fluch` | 🟣 Senkt zeitweise deine Krit-Chance & Tempo. |
| `verbrennung` | 🔥 Starker stapelnder Brand-Schaden. |
| `schwaechung` | 💔 Reduziert deine Heilung & Lebensraub. |
| `teilung` | ➗ Bei 50 % HP: Wutausbruch, Angriff stark erhöht. |
| `eskalation` | 📈 Je weniger HP, desto mehr Schaden. |

## Gebiete

0. Blühende Wiesen · 1. Dunkelwald · 2. Tiefe Höhlen · 3. Vulkanschlund · 4. Frostgipfel · 5. Versunkene Tiefen · 6. Schattenreich · 7. Aschewüste · 8. Himmelszitadelle · 9. Die Leere

## Roster (40 Bosse + endlose Skalierung)

| # | Name | Gebiet | HP | Angriff | Kraft | Mechaniken | Phasen |
|---|------|--------|----|---------|-------|------------|--------|
| 0 | Grollzahn der Goblin | Blühende Wiesen | 800 | 16 | 70 | wut | – |
| 1 | Borkenschreck der Waldgeist | Blühende Wiesen | 1.7k | 23 | 150 | dornen | – |
| 2 | Königin Summbrand | Blühende Wiesen | 3.6k | 33 | 320 | gift | – |
| 3 | Schattenrudel-Alpha | Blühende Wiesen | 7.7k | 48 | 680 | berserk | – |
| 4 | Webmutter Schwarzbein | Dunkelwald | 16k | 68 | 1.4k | gift, dornen | – |
| 5 | Nachtmar der Schrecken | Dunkelwald | 34k | 96 | 3.1k | betaeubung | – |
| 6 | Gorrak der Höhlentroll | Dunkelwald | 71k | 136 | 6.6k | regen | – |
| 7 | Kristallweber | Dunkelwald | 150k | 194 | 14k | eispanzer | – |
| 8 | Erzfresser | Tiefe Höhlen | 316k | 275 | 29.8k | ruestungsbruch, wut | – |
| 9 | Pyraxis der Lavadrache | Tiefe Höhlen | 664k | 390 | 63.6k | feueratem | – |
| 10 | Magmaherz der Elementar | Tiefe Höhlen | 963k | 540 | 92.8k | lebensentzug | – |
| 11 | Aschefürst Zinnober | Tiefe Höhlen | 1.4 Mio | 760 | 135k | hinrichtung, berserk | – |
| 12 | Frostherz der Golem | Vulkanschlund | 2.02 Mio | 1.1k | 198k | eispanzer, regen | – |
| 13 | Eiskönigin Glacira | Vulkanschlund | 2.94 Mio | 1.5k | 289k | frost | – |
| 14 | Sturmtitan Boreas | Vulkanschlund | 4.26 Mio | 2.2k | 422k | berserk, betaeubung | – |
| 15 | Schattendrache Nyx | Vulkanschlund | 6.18 Mio | 3.1k | 616k | feueratem, lebensentzug | – |
| 16 | Der Vergessene Wächter | Frostgipfel | 8.96 Mio | 4.4k | 899k | regen, eispanzer, dornen | – |
| 17 | Weltenfresser | Frostgipfel | 13 Mio | 6.2k | 1.31 Mio | hinrichtung, dornen, berserk | – |
| 18 | Tiefenleviathan Abyssal | Versunkene Tiefen | 18.84 Mio | 8.9k | 1.92 Mio | enrage, schildphase | 50%: wut |
| 19 | Korallentyrann Murlok | Versunkene Tiefen | 27.3 Mio | 12.6k | 2.8 Mio | add_spawn | – |
| 20 | Versunkener König Na.this | Versunkene Tiefen | 39.6 Mio | 17.9k | 4.09 Mio | fluch, frost | – |
| 21 | Gezeitenfürst Maelstrom | Versunkene Tiefen | 57.5 Mio | 25.4k | 5.97 Mio | verbrennung, lebensentzug | 40%: enrage |
| 22 | Schattenweber Umbral | Schattenreich | 83.3 Mio | 36k | 8.71 Mio | schwaechung, gift | – |
| 23 | Albtraumfürst Mordeth | Schattenreich | 120.8 Mio | 51.2k | 12.72 Mio | teilung | 50%: berserk |
| 24 | Leerenpriester Vex | Schattenreich | 175.2 Mio | 72.7k | 18.57 Mio | eskalation, fluch | 60%: verbrennung; 30%: enrage |
| 25 | Seelenschnitter Grimm | Schattenreich | 254 Mio | 103.2k | 27.11 Mio | schildphase, hinrichtung | – |
| 26 | Ascheboss Cinderon | Aschewüste | 368 Mio | 146.5k | 39.58 Mio | add_spawn, berserk | 50%: feueratem |
| 27 | Magmakoloss Vulcanar | Aschewüste | 534 Mio | 208.1k | 57.79 Mio | fluch, frost | – |
| 28 | Glutdämon Infernox | Aschewüste | 774 Mio | 295.5k | 84.37 Mio | verbrennung, lebensentzug | 40%: enrage; 20%: hinrichtung |
| 29 | Pyroklast der Verbrenner | Aschewüste | 1.12 Mrd | 419.6k | 123.18 Mio | enrage, dornen, verbrennung | – |
| 30 | Himmelsrichter Solarius | Himmelszitadelle | 1.63 Mrd | 595.8k | 179.84 Mio | teilung, eskalation | 50%: enrage |
| 31 | Sturmgott Tempest | Himmelszitadelle | 2.36 Mrd | 846.1k | 262.5 Mio | schwaechung, ruestungsbruch, gift | – |
| 32 | Lichtbringer Auriel | Himmelszitadelle | 3.42 Mrd | 1.2 Mio | 383.25 Mio | add_spawn, feueratem | 60%: berserk; 30%: enrage |
| 33 | Titanenwächter Aegis | Himmelszitadelle | 4.96 Mrd | 1.71 Mio | 559.54 Mio | eskalation, hinrichtung, berserk | – |
| 34 | Voidfürst Nihil | Die Leere | 7.19 Mrd | 2.42 Mio | 816.93 Mio | schildphase, regen, lebensentzug | 50%: enrage |
| 35 | Entropiebestie Chaos | Die Leere | 10.42 Mrd | 3.44 Mio | 1.19 Mrd | fluch, verbrennung, frost | – |
| 36 | Der Namenlose | Die Leere | 15.11 Mrd | 4.88 Mio | 1.74 Mrd | teilung, dornen, eskalation | 60%: enrage; 30%: hinrichtung |
| 37 | Sternenfresser Astaroth | Die Leere | 21.91 Mrd | 6.94 Mio | 2.54 Mrd | enrage, hinrichtung, schwaechung | – |
| 38 | Urzeit-Drache Bahamut | Die Leere | 31.77 Mrd | 9.85 Mio | 3.71 Mrd | add_spawn, eskalation, berserk, gift | 50%: feueratem; 20%: enrage |
| 39 | Erzdämon der Ewigkeit | Die Leere | 46.07 Mrd | 13.99 Mio | 5.42 Mrd | enrage, teilung, hinrichtung, dornen, eskalation | 70%: verbrennung; 40%: add_spawn; 20%: schildphase |

Ab Boss #40 skaliert der letzte Boss endlos weiter: HP ×1.6ⁿ, Angriff ×1.55ⁿ, Kraft ×1.6ⁿ.

> Sprites/Hintergründe: Es existieren `boss_0..4.png` und `bg_zone_0..4.png`. Mehrere Bosse/Gebiete
> teilen sich vorhandene Grafiken (Felder `area`/`spr`/`bg`). Eigene Grafiken können später ergänzt werden.
