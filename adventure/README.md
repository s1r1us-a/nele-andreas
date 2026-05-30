# Dämmerpfad – Entwickler-README

Eigenständiges Idle-/Abenteuer-RPG im WoW-Stil. Vanilla JavaScript (ES-Module),
**kein Build-Step**, **keine Framework-Abhängigkeiten**, Persistenz über `localStorage`.

## Starten

ES-Module brauchen `http://` (nicht `file://`). Im Repo-Wurzelverzeichnis:

```bash
python3 -m http.server 8000
# dann im Browser öffnen:
#   http://localhost:8000/abenteuer.html
```

## Projektstruktur

```
abenteuer.html              # schlanke Shell im Root (Einstieg): lädt CSS und main.js
adventure/                  # gesamtes Beiwerk des Spiels gebündelt
  assets/                   # Sprites (Bosse, Items, Hintergründe, Charakter)
  css/style.css             # gesamtes Styling
  README.md                 # diese Datei
  BOSSE.md                  # auto-generierte Boss-Übersicht
  tools/
    gen-adventure-sprites.py  # erzeugt die Sprites in adventure/assets/
    gen-bosse-doc.mjs         # erzeugt adventure/BOSSE.md
  js/
    main.js                 # Einstieg: Init, Game-Loop, Tabs, Events, Tastenkürzel
    data/                   # reine Daten/Konstanten (keine Logik)
      tuning.js             #   zentrale Balance-Zahlen (inkl. ASSETS-Pfad)
      rarities.js           #   Seltenheiten inkl. „Mythisch"
      affixes.js            #   Affix-Definitionen, Pools, Anzeige
      slots.js              #   Ausrüstungsslots / Paper-Doll
      bosses.js             #   Gebiete, Mechaniken, 40 Bosse + Endlos-Skalierung
      expeditions.js        #   Expeditions-Dauern
      character-options.js  #   Geschlecht/Frisuren/Farben
    core/                   # Spiel-Logik
      state.js              #   State, Laden/Speichern, Migration (Version 4)
      loot.js               #   Seltenheits-Gewichtung
      items.js              #   Item-Generierung, Affixe, Procs, Wert, Verkauf, Equip, Sperre
      character.js          #   XP/Level, Gesamt-Stats, Kampfwerte
      avatar.js             #   gezeichneter SVG-Avatar
      expedition.js         #   Abenteuer auf Zeit (offline-sicher)
      combat.js             #   Boss-Kampf-Engine (Mechaniken, Phasen, Enrage, Procs, Farm)
    ui/                     # Darstellung & Interaktion
      dom.js                #   DOM-Helfer, Toast, Formatierung
      tooltip.js            #   Item-Tooltip + Vergleich
      render.js             #   Render der vier Tabs
      modals.js             #   Slot-Picker, Vorschau, Boss-Liste/Farm, Statistik, Editor, Dev
```

> Nur der Einstiegspunkt `abenteuer.html` liegt im Root (wie alle anderen Mini-Apps
> des Repos). Alles andere Spiel-spezifische steckt im Ordner `adventure/`.

## Doku & Sprites neu generieren

```bash
# Boss-Übersicht (adventure/BOSSE.md) aus den Daten erzeugen:
node adventure/tools/gen-bosse-doc.mjs

# Sprites (adventure/assets/) neu zeichnen – benötigt Pillow:
python3 adventure/tools/gen-adventure-sprites.py
```

## Balance an einem Ort

Alle wichtigen Stellschrauben liegen in `adventure/js/data/tuning.js`
(Inventargröße, Heil-%, Enrage-Runde/-Rampe, Endlos-Faktoren, Farm-Multiplikatoren)
sowie `data/bosses.js` (Roster) und `data/affixes.js` (Sekundär-Stats).
