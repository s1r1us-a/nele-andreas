# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A two-user personal web app for "Nele & Andreas" (a couple). Each page is a single self-contained HTML file with inline `<style>` and inline `<script type="module">` — there is **no build step, no bundler, no package manager, and no test suite**. UI text is in German.

To run locally, serve the folder over HTTP (Firebase Auth + the ES-module imports won't work over `file://`):

```bash
python3 -m http.server 8000
# then open http://localhost:8000/index.html
```

## Pages (each one is a complete app)

- `index.html` — landing page: heart-click "Moment" counter, daily/total stats, navigation to all other pages, auth gate, theme application, booster banner, live game-invite banners.
- `profil.html` — own/visited profile, badges, frames, password/email change, comments.
- `shop.html` — buy themes, badges, frames, boosters, lootboxes.
- `stats.html` — aggregate stats from RTDB (`moments/daily`, `moments/clicks`, `stats/<user>`).
- `momente-archiv.html` — view/edit/delete entries in `saved_moments/`.
- `quiz.html` — each user authors questions for the *other* user; answers tracked per played-version.
- `farm.html` — the largest page (~6.5 kloc): farm simulation with beds, animals, bakery, weaving, mine, forge, beehive, trading & gifting with the partner.
- `ourhome.html` — shared multiplayer "room" with realtime positions, lights, knocks, outfits.
- `game.html` — Connect Four ("Vier Gewinnt") with coin bets.
- `battleship.html` — Battleship ("Schiffe Versenken") with coin bets.
- `zombiedefense.html` — single-/coop-player tower defense, saves to `game/zombie/save/<userKey>`.
- `aquarium.html`, `marienkaefer.html` — smaller mini-games.
- `princess-theme.css` — shared stylesheet for the `prinzesschen` theme (linked only from `index.html`). Other themes live in inline `<style>` blocks scoped by `html[data-theme="..."]`.

## Firebase is the only backend

Every page initializes the **same** Firebase project (`nele-und-andreas`, RTDB in `europe-west1`) inline. The API key is embedded — this is a public client-side config and is not a secret to remove. When adding a new page or restructuring auth, re-use the exact config block and use `getApps().length ? getApp() : initializeApp(...)` to avoid the "duplicate app" warning (see `ourhome.html:622`, `zombiedefense.html:1490`, `quiz.html`).

### User identity convention

There are exactly two users, identified by email and mapped to a lowercase `userKey`:

```js
raederich@outlook.com  → "andreas"   // display name "Andreas"
nele.busse@web.de      → "nele"      // display name "Nele"
```

This mapping is duplicated inline in nearly every page (`displayName()` in `index.html:1094`, `profil.html:647`, `shop.html:1297`; `EMAIL_KEY_MAP` in `zombiedefense.html:1495`; inline conditions in `farm.html:2899`, `aquarium.html:1387`, etc.). When touching auth, update **all** copies.

### RTDB layout (the de-facto schema)

```
coins/<userKey>                            number
stats/<userKey>/{coinsEarned,coinsSpent,…}
moments/
  count                                    total clicks
  andreas | nele                           per-user totals
  lastClick                                { name, time }
  daily/<YYYY-MM-DD>/<userKey>             daily counters (Europe/Berlin date)
  clicks/<YYYY-MM-DD>/<ts>_<userKey>       individual click log
saved_moments/<id>                         archived moments
shop/<userKey>/{owned, activeTheme, equippedBadge, equippedFrame, badges, frames, lootbox}
boosters/<userKey>/{active_coins, active_moments, inventory}
farm/<userKey>                             whole farm save blob (inventory, beds, animals, oven, loom, beehive, mineSlots, forgeSlots, favs)
gifts/<userKey>/pending/<giftId>
trades/<tradeId>                           queried by orderByChild('toUser')
quiz/<userKey>/{version, questions, <other>_played_version}
quiz/highscore/<hsKey>                     e.g. hs_andreas_on_nele
game/andreas_vs_nele                       Connect Four match state
battleship/andreas_vs_nele                 Battleship match state
game/ourhome/{positions, online, locks, lights, lampStates, knock, roomMap, outfits}
game/zombie/{save,chests,positions,online}/<userKey>
comments/<profileKey>/<commentId>
```

Dates use **`Europe/Berlin` local date** via the `getGermanDate()` helper (see `index.html:1272`). Don't use UTC for daily buckets.

### Mutation patterns

- Coin/moment increments: always `runTransaction(ref, c => (c||0) + n)` — never `set()` on a counter.
- Whole-blob saves (farm): `set(ref(db, 'farm/<userKey>'), data)` written from one big `saveFarmData()`.
- Live data: `onValue(...)` listeners; the index page also has an optimistic `window._pending` overlay that adds in-flight client increments to the displayed count before the RTDB roundtrip (`index.html:1297-1316`).

## Cross-page conventions

- **Visit mode**: `?user=<key>` on `profil.html` and `farm.html` switches to read-only view of the other person's data. Mutating code paths must check `isVisitMode` and bail (the farm shows a "Nur ansehen" toast; see `farm.html:2522,4405,…`). When adding a feature to `farm.html`, audit it for visit-mode guards.
- **Themes**: applied by setting `document.documentElement.dataset.theme`. The active theme is read from `shop/<userKey>/activeTheme` on auth. Built-in themes (in inline `<style>` per page): `aurora`, `cosmic`, `royal`, `rainbow`, `neon`, `prinzesschen`, `schattenfuerstin`. Adding a new theme requires updating every theme-aware page's inline CSS — or extending `princess-theme.css`-style external sheet usage.
- **Low-FX mode**: `farm.html:2487-2497` applies `body.low-fx` when `navigator.hardwareConcurrency < 4` or `prefers-reduced-motion`. New animations should have a `body.low-fx` override that disables them.
- **Boosters**: `boosters/<userKey>/active_{coins,moments}` carries `{activatedAt, durationMs}`. Active is `Date.now() < activatedAt + durationMs`. Coin/moment earn paths multiply by 2 when active (`index.html:1455-1456`).
- **The two game banners on `index.html`** (`game/andreas_vs_nele`, `battleship/andreas_vs_nele`) auto-show when the *other* user has created a waiting invite; mirror this pattern when adding new PvP games.

## Editing these files

- HTML files are very large (farm 6.5 kloc, zombie 12 kloc, ourhome 4.7 kloc). Don't `Read` them whole — use `grep`/`Read` with offsets to navigate. Inline `<script type="module">` typically starts past the markup; search for `initializeApp` to find it.
- Many pages duplicate identical code (Firebase config, `displayName`, theme application). Cross-cutting changes must be applied to all copies — don't assume a helper exists.
- Don't introduce a build step, framework, or package.json unless explicitly asked; the project is deliberately a pile of static HTML files served straight from GitHub.

## Git / workflow

Commit style follows Conventional-Commits-ish prefixes seen in history: `feat(farm): …`, `fix(farm): …`, `refactor(farm): …`, `perf(farm): …`. Plain German subject lines are also acceptable for farm/UI tweaks. Work happens on `claude/<topic>-<slug>` branches that are merged to `main` via PR — never push directly to `main`.
