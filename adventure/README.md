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
      materials.js          #   Crafting-Materialien + Aufwert-/Reroll-/Salvage-Kosten
      character-options.js  #   Geschlecht/Frisuren/Farben
    core/                   # Spiel-Logik
      state.js              #   State, Laden/Speichern, Migration (Version 4)
      loot.js               #   Seltenheits-Gewichtung
      items.js              #   Item-Generierung, Affixe, Procs, Wert, Verkauf, Equip, Sperre, Pending-Loot
      crafting.js           #   Schmiede: Zerlegen, Aufwerten, Verzaubern, Konvertieren
      character.js          #   XP/Level, Gesamt-Stats, Kampfwerte
      avatar.js             #   gezeichneter SVG-Avatar
      expedition.js         #   Abenteuer auf Zeit (offline-sicher)
      combat.js             #   Boss-Kampf-Engine + Duell-Arena (Live-PvP) gleicher Look
      duel.js               #   Live-PvP: Lobby + host-autoritative 1-gegen-1-Engine (RTDB)
    ui/                     # Darstellung & Interaktion
      dom.js                #   DOM-Helfer, Toast, Formatierung
      tooltip.js            #   Item-Tooltip + Vergleich
      render.js             #   Render der Tabs (inkl. Zerlege-Modus + Pending-Loot-Banner)
      forge.js              #   Schmiede-Tab: Material-Bestand, Aufwerten/Verzaubern + Aufwert-Animation
      trade.js              #   Handel-UI (Items + Material-Kategorie)
      modals.js             #   Slot-Picker, Vorschau, Boss-Liste/Farm, Statistik, Editor, Dev, Duell-Lobby
```

## Schmiede & Materialien (Crafting)

Aktive Item-Progression statt reinem RNG-Loot:
- **Zerlegen** (♻️-Modus im Inventar, wie der Verkaufsmodus): Items → Materialien.
  Gewonnene Materialien erscheinen als Floating-Text (wie Coins).
- **Aufwerten** (`upgradeLevel` 0→10): +6 % Hauptwert & +4 % je Affix pro Stufe.
  Schreibt in `item.stat`/`item.affixes` (gesichert in `item.base`) → fließt
  automatisch in Kampfkraft, Auto-Treffer UND Fähigkeits-Schaden/-Heilung.
- **Verzaubern**: würfelt die Affixe neu (Aufwertungsstufe bleibt erhalten).
- **Konvertieren**: 10 niedrigere → 1 höhere Material-Stufe (Dust-Sink).
- Materialien (Arkanstaub ✨ / Magiesplitter 🔹 / Uressenz 🟠 / Urstoff 💠) sind
  über das Handelsfenster in einer eigenen Kategorie **handelbar**.
- Alle Crafting-Zahlen liegen zentral in `data/materials.js`.

## Klassen-Sets (Tier-Sets, WoW-Stil)

Pro Klasse ein einzigartiges 7-teiliges Set mit gestaffelten **Set-Boni**
(2/4/6/7 Teile) und komplett abgehobener Optik. **Rein additiv** – die
bestehende Kampf-/Item-/Schmiede-Logik bleibt unverändert.

- **Definitionen:** `data/sets.js` (Klassenbindung, Material, `themeKey`,
  Affix-Fokus, Boni, Kosten, Tribut-Belohnung). Reine Daten.
- **Logik:** `core/sets.js` – `applySetBonuses()` (additiv, prozentual +
  flach, respektiert vorhandene Caps), Tribut-Siegel-Währung,
  `createSetPiece()`/`buySetPiece()`. Einziger Eingriff in Bestand: **eine
  Zeile** in `core/character.js` (`applySetBonuses(state, b)` in
  `recomputeTotals`, nach `applyTalents`).
- **Optik:** `core/set-art.js` (geteilt von Icon & Avatar) rendert je Theme
  Schultern/Helm-Aufsatz/Brust-Emblem: `molten` (Verteidiger – Glut/Hörner/
  Flammen-Flügel), `bloodshadow` (Schurke – rote Klingen/Kapuze), `void`
  (Hexer – Geweih/glühende Augen), `holy` (Heiler – Halo/Federn). Andockung in
  `core/item-art.js` (`buildItemSVG(..., setTheme)`) und `core/avatar.js`.
- **Beschaffung:** Set-Händler-Tab „⚜️ Sets" (`ui/setshop.js`). Bosssiege geben
  **Tribut-Siegel** (`combat.js`), dafür kauft man die 7 Set-Teile. Set-Teile
  sind **Legendär** → nutzen die vorhandene **Transzendenz** und sind damit
  unbegrenzt aufwertbar (keine Schmiede-Änderung nötig).
- **Previews:** `node --import ./adventure/tools/firebase-stub-loader.mjs
  adventure/tools/gen-set-previews.mjs` erzeugt Schaubild-SVGs unter
  `assets/set-previews/` (Avatar + alle Set-Teile, gleiche Builder wie im Spiel).

## Ausstehende Beute (kein Item-Verlust bei vollem Inventar)

Boss- und Turm-Siege legen Beute über `giveLoot()` ab: ist das Inventar voll,
wandert das Item in `state.pendingLoot` statt verloren zu gehen (Boss) bzw. das
Inventar zu überfüllen (Turm). Sobald Platz frei wird, rücken die Items beim
nächsten Render automatisch nach (`claimPendingLoot()` in `renderAll`); ein
Banner im Abenteuer-Tab zeigt die wartende Menge.

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

## Live-PvP-Duell (`core/duel.js`)

Über den ⚔️🆚-Knopf in der Topbar fordern sich Nele & Andreas live in **derselben
Arena** wie der Bosskampf heraus – nur steht statt des Bosses der echte Gegner.
Lobby (Code, Gold-Wetteinsatz, Bereit, Countdown) und Sync laufen über separate
RTDB-Knoten `duel/lobbies|combat|abil|heroes/<id>` (stören den Koop-Turm nicht).

- **Host-autoritär:** Der Lobby-Ersteller simuliert den 1-gegen-1-Kampf (RNG nur
  beim Host → kein Desync) und schreibt pro Schlagabtausch einen Snapshot nach
  `duel/combat/<id>`. Beide Clients rendern ausschließlich daraus (`applyDuelSnapshot`
  in `combat.js`).
- **Aktionen:** Heiltrank/Fähigkeit werden als Anfrage in `duel/abil/<id>` geschrieben
  und vom Host angewendet (Cooldowns als Restzeit übertragen → driftfrei).
- **Einsatz:** Beide setzen Gold; der Sieger bekommt den Pott (jeder Client verrechnet
  den Netto-Betrag auf dem eigenen Spielstand). Im Duell zählen feste 3 Heiltränke je
  Seite – echte Heiltränke werden nicht verbraucht. Bilanz in `stats.duelWins/Losses`.
- **Wichtig:** Die Firebase-Schreibregeln müssen den `duel/…`-Namensraum (lesen/schreiben
  für eingeloggte Spieler) genauso erlauben wie `tower/…`.
