# Boss-Übersicht – Idle Abenteuer

Referenz aller Bosse im Abenteuerspiel (`abenteuer.html`, `BOSS_DEFS`). Bosse sind
das Fortschritts-Gate: Wer einen Boss besiegt, schaltet den nächsten frei und erhält
**Gold + XP + einen garantierten epischen Gegenstand**. Frühe Bosse droppen schwächere
Epics als späte (Item-Level skaliert mit dem Boss-Index).

- **Gold pro Sieg:** `recPower × 1.5 + 40`
- **XP pro Sieg:** `recPower × 0.9 + 40` (Niederlage: 15 % davon als Trost-XP)
- **Garantierter Drop:** mindestens **episch**, Item-Level ≥ `Boss-Index × 5`
- **Boss-Crit:** 12 % Chance auf doppelten Schaden (universell)

## Mechaniken

| Key | Effekt |
|-----|--------|
| `wut` | Unter 30 % Boss-HP steigt der Angriff um 50 %. |
| `dornen` | Reflektiert 15 % des erhaltenen Schadens an den Helden. |
| `gift` | Baut pro Treffer Gift-Stacks auf; jede Runde Schaden = 2 × Stacks. |
| `berserk` | Angriff wächst kumulativ um 3 % pro Runde. |
| `betaeubung` | 12 % Chance, dass der Held eine Runde aussetzt. |
| `regen` | Heilt alle 3 Runden 4 % der maximalen HP. |
| `eispanzer` | Alle 5 Runden 2 Runden lang Schild: eingehender Schaden −60 %. |
| `ruestungsbruch` | Senkt die Helden-Rüstung pro Treffer dauerhaft (im Kampf). |
| `feueratem` | Alle 4 Runden Großschlag (Angriff × 2,2), ignoriert Rüstung. |
| `lebensentzug` | Heilt den Boss um 40 % des ausgeteilten Schadens. |
| `hinrichtung` | +100 % Schaden, wenn der Held unter 25 % HP ist. |
| `frost` | Verlangsamt den Helden-Angriffstakt für einige Runden. |

## Roster

| # | Name | Gebiet | HP | Angriff | recPower | Mechanik |
|---|------|--------|----|---------|----------|----------|
| 0 | Grollzahn der Goblin | Blühende Wiesen | 800 | 16 | 70 | wut |
| 1 | Borkenschreck der Waldgeist | Blühende Wiesen | 1.400 | 22 | 120 | dornen |
| 2 | Königin Summbrand | Blühende Wiesen | 2.200 | 28 | 190 | gift |
| 3 | Webmutter Schwarzbein | Dunkelwald | 3.400 | 36 | 290 | gift |
| 4 | Schattenrudel-Alpha | Dunkelwald | 5.000 | 46 | 420 | berserk |
| 5 | Nachtmar der Schrecken | Dunkelwald | 7.200 | 58 | 600 | betaeubung |
| 6 | Gorrak der Höhlentroll | Tiefe Höhlen | 10.500 | 72 | 850 | regen |
| 7 | Kristallweber | Tiefe Höhlen | 15.000 | 90 | 1.200 | eispanzer |
| 8 | Erzfresser | Tiefe Höhlen | 21.000 | 112 | 1.650 | ruestungsbruch |
| 9 | Pyraxis der Lavadrache | Vulkanschlund | 30.000 | 140 | 2.300 | feueratem |
| 10 | Magmaherz der Elementar | Vulkanschlund | 42.000 | 172 | 3.100 | lebensentzug |
| 11 | Aschefürst Zinnober | Vulkanschlund | 58.000 | 210 | 4.200 | hinrichtung |
| 12 | Frostherz der Golem | Frostgipfel | 80.000 | 255 | 5.600 | eispanzer |
| 13 | Eiskönigin Glacira | Frostgipfel | 110.000 | 310 | 7.500 | frost |
| 14 | Sturmtitan Boreas | Frostgipfel | 150.000 | 380 | 10.000 | berserk |
| 15 | Schattendrache Nyx | Vulkanschlund | 210.000 | 460 | 13.500 | feueratem + lebensentzug |
| 16 | Der Vergessene Wächter | Tiefe Höhlen | 290.000 | 560 | 18.000 | regen + eispanzer + dornen |
| 17 | Weltenfresser | Frostgipfel | 400.000 | 690 | 24.000 | hinrichtung + dornen + berserk |
| 18+ | Weltenfresser +N | Frostgipfel +N | ×1,55ⁿ | ×1,55ⁿ | ×1,55ⁿ | wie #17 |

Ab Boss #18 skaliert der letzte Boss endlos mit Faktor **1,55ⁿ** weiter (sanfter als die
frühere 1,8-Skalierung, damit Level- und Gear-Fortschritt mithalten können).

> Sprites/Hintergründe: Es existieren `boss_0..4.png` und `bg_zone_0..4.png`. Mehrere
> Bosse teilen sich Sprites/Gebiete (Felder `spr`/`bg` in `BOSS_DEFS`). Eigene Grafiken
> können später ergänzt werden.
