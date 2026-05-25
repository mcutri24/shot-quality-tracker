# Shot Quality Tracker — Project Reference

> **For new sessions:** Read this file first. It covers the full app — purpose, architecture, all features, data model, and known state. The session-specific summary at `docs/superpowers/2026-05-25-session-summary.md` covers the most recent implementation work.

---

## What This Is

A PWA (Progressive Web App) for tracking basketball offensive possessions during live games. Built for the **Newark Academy Minutemen** coaching staff. Coaches use it on their phone during games to log every possession — who had the ball, what play was run, what the result was, and a quality grade — then review analytics after.

**Repo:** https://github.com/mcutri24/shot-quality-tracker
**Deployed:** GitHub Pages (or equivalent)
**Service worker cache:** `sqt-v40` (as of 2026-05-25)

---

## Tech Stack

- **Vanilla ES5 JavaScript** — no build step, no npm, no modules
- **Global `SQT` namespace** — all modules attach to `window.SQT`
- **localStorage** — all persistence, no backend
- **Single HTML file** (`index.html`) — screen-based navigation via CSS `active` class
- **Service worker** (`sw.js`) — PWA offline caching, cache-first strategy
- **ES5 rules:** no `const`/`let`, no arrow functions, no template literals, no destructuring

---

## File Structure

```
Shot_Quality_App/
├── index.html              # All screens as static DOM, script tags at bottom
├── sw.js                   # Service worker — cache version sqt-v40
├── manifest.json           # PWA manifest
├── css/
│   ├── variables.css       # CSS custom properties (colors, spacing, typography)
│   ├── screens.css         # Screen-level layout and screen-specific components
│   └── components.css      # Shared component styles (buttons, badges, cards, etc.)
├── js/
│   ├── storage.js          # All localStorage read/write — loaded first
│   ├── roster.js           # Player CRUD
│   ├── plays.js            # Offensive play CRUD
│   ├── game.js             # Game lifecycle (start, end, reopen, history)
│   ├── tracker.js          # Live tracking UI — step flow, timeout bar, foul widget
│   ├── dashboard.js        # Post-game analytics tabs
│   ├── export.js           # CSV + JSON export/import
│   └── app.js              # App init, screen routing, home bindings, resume logic
├── icons/
│   ├── na-logo.png         # Newark Academy seal
│   └── icon-192.png        # PWA icon
└── docs/superpowers/
    ├── PROJECT.md          # This file — full project reference
    ├── 2026-05-25-session-summary.md  # Latest session detail
    ├── plans/              # Implementation plans (per-feature task lists)
    └── specs/              # Design specs (per-feature decisions)
```

---

## Screens

Navigation is CSS-only: `showScreen(id)` removes `active` from all `.screen` elements and adds it to `#<id>-screen`.

| Screen ID | Purpose |
|-----------|---------|
| `home` | Dashboard — season record, main menu |
| `setup` | New game form (opponent, date, home/away) |
| `tracking` | Live possession tracking |
| `postgame` | Enter final score after game ends |
| `history` | Game list for current season |
| `dashboard` | Per-game analytics |
| `seasons` | Season manager — create seasons, restore backup |
| `roster` | Add/edit/reorder players |
| `plays` | Add/edit/reorder offensive plays |

---

## Data Model

All data lives in localStorage under these keys:

| Key | Type | Contents |
|-----|------|----------|
| `sqt_seasons` | JSON array | All season objects |
| `sqt_active_season` | string | ID of current season |
| `sqt_games` | JSON array | Completed games for active season |
| `sqt_active_game` | string | ID of in-progress game |
| `sqt_live_game` | JSON object | Full game object being tracked right now |
| `sqt_archive_<seasonId>` | JSON array | Completed games for older seasons (one key per season) |
| `sqt_roster` | JSON array | Players (shared across all seasons) |
| `sqt_plays` | JSON array | Offensive plays (shared across all seasons) |

### Season Object
```js
{ id, name, createdAt }
```

### Game Object
```js
{
  id,
  seasonId,
  opponent,
  date,           // YYYY-MM-DD
  location,       // 'Home' | 'Away'
  possessions,    // array of possession objects
  timeouts: { fullUsed: 0, shortUsed: 0 },
  fouls: {},      // sparse map { [playerId]: count }
  finalScoreUs,   // null until savePostGame()
  finalScoreThem,
  result,         // null | 'W' | 'L' | 'T'
  createdAt
}
```

### Possession Object
```js
{
  id,             // UUID
  playerId,
  playerName,
  playerNumber,
  shotType,       // see Shot Types below
  playId,         // UUID of the offensive play
  playName,       // display name (mutable — group by playId)
  result,         // 'made' | 'missed' | 'foul' | 'turnover'
  points,         // calculated: 0, 1, 2, or 3
  grade,          // 'gold' | 'silver' | 'bronze'
  quarter,        // 1–4 | 'OT'
  and1,           // true if And-1 shot
  and1FtMade,     // 0 or 1
  and1FtAttempts, // always 1 when and1 is true
  timestamp
}
```

### Player Object
```js
{ id, number, name }
```

### Play Object
```js
{ id, name }
```

---

## Shot Types

| id | Label | Points (made) | Notes |
|----|-------|--------------|-------|
| `layup` | Layup | 2 | |
| `midrange` | Mid-Range | 2 | |
| `three` | 3-Pointer | 3 | |
| `ft` | Free Throws | per FT made | Result = number of FTs made (0–5) |
| `and1` | And-1 | 2 + FT | Requires FT made/attempt entry |
| `turnover` | Turnover | 0 | Auto-grade bronze, skip grade step |

---

## Possession Tracking Flow (5 Steps)

The tracker uses a step-based state machine in `SQT.Tracker`:

```
Step 1: Player select (grid of players)
Step 2: Shot type select
Step 3: Play select (offensive play)
Step 4: Result select (made / missed / foul)
Step 5: Grade select (gold / silver / bronze)
```

Special cases:
- **Free throws:** Step 4 replaced by FT count entry (0–N made / N attempted)
- **Turnovers:** Step 4 skipped (auto-result = missed), Step 5 skipped (auto-grade = bronze)
- **And-1:** After result=made, shows FT entry before grade

---

## Timeout Bar

Shown at bottom of tracking screen, above the action buttons.

- **Regular game (Q1–Q4):** 3 full timeouts, 2 thirty-second timeouts
- **OT:** 4 full timeouts, 2 thirty-second timeouts
- Displayed as pip rows — filled pips = used, empty = remaining
- Labels: "FULL" and "30"
- Tapping a pip toggles used/unused and saves immediately
- On quarter switch, used counts are clamped to new total and persisted

---

## Foul Tracking

- **Long-press (~500ms)** on a player card during Step 1 opens the foul widget
- Widget shows: player name/number, current count, [−] and [+] buttons
- Foul count badge appears on player card top-left corner
- Badge colors: gold (1–2 fouls), orange (3), red (4–5)
- 5 fouls: card dims to 45% opacity
- Counts stored in `game.fouls[playerId]` (sparse map, defaults to 0)
- Not yet surfaced in the dashboard (stored for future use)

---

## Dashboard Tabs (Per-Game Analytics)

Accessible during live tracking and from game history.

| Tab | Shows |
|-----|-------|
| By Player | PPP, FG%, FT%, 3PT%, assists, turnovers per player |
| By Type | Points/possessions/PPP breakdown by shot type |
| By Play | PPP and possession count per offensive play (grouped by playId UUID) |
| By Quarter | PPP and volume per quarter |
| By Grade | Gold/silver/bronze breakdown with PPP |
| W / L | Season-level comparison: PPP and record in wins vs losses |

Each tab supports drill-down — tapping a row shows possession-level detail.

Export options: CSV (Excel-compatible) or JSON (full game object).

---

## Season Management

- Multiple seasons supported; one is active at a time
- Creating a new season auto-archives the current season's games to `sqt_archive_<seasonId>`
- Archived games are merged back on read via `getGamesBySeason()` — live copy wins on conflict
- Season stats (W/L record, PPP) shown on home screen
- JSON backup: export all data → `.json` file; restore from `.json` file on Seasons screen

---

## Key `storage.js` Functions

| Function | What it does |
|----------|-------------|
| `saveGame(game)` | If game is active, writes to `sqt_live_game`; otherwise merges into `sqt_games` |
| `setActiveGame(id)` | Sets `sqt_active_game`; if `id=null`, flushes live game to `sqt_games` and clears live key |
| `flushLiveGame()` | Reads `sqt_live_game`, merges into `sqt_games`, clears live key — returns true/false |
| `getActiveGame()` | Returns live game object (from `sqt_live_game`) or null |
| `getGamesBySeason(sid)` | Returns live list + archive for season; live copy wins on conflict |
| `archiveSeason(sid)` | Moves games from `sqt_games` to `sqt_archive_<sid>` |
| `deleteGame(id)` | Removes from `sqt_games` AND searches all `sqt_archive_*` keys |
| `saveGames(arr)` | Writes to `sqt_games`; returns false on QuotaExceededError |

---

## app.js Responsibilities

- `init()` — called on DOMContentLoaded; registers SW, calls `_bindHome()`, calls `_resumeGame()`, updates home screen
- `_bindHome()` — binds ALL static button listeners (runs once at startup)
- `_resumeGame()` — if `sqt_active_game` exists on load, shows resume banner; user can tap to return to tracking
- `showScreen(id)` — switches active screen
- `_updateSeasonRecord()` — updates W/L record and PPP on home screen

---

## Game Lifecycle

```
startGame()       → creates game object, saves to storage, calls Tracker.start()
Tracker.start()   → installs visibilitychange handler, pushes history state for back gesture
[tracking...]
Game.endGame()    → shows postgame screen (score entry), does NOT save yet
← Back button     → returns to tracking (game still active)
savePostGame()    → sets result, calls setActiveGame(null) to flush, cleans up handlers
reopenGame(id)    → clears result, deletes from storage, re-saves as active, restarts tracker
```

---

## Service Worker

Cache-first strategy. Cache name must be bumped whenever any file changes so phones pick up updates.

**Current version:** `sqt-v40`

Previous bumps:
- `sqt-v36` — timeout counter release
- `sqt-v37` — foul tracking release
- `sqt-v38` — (intermediate)
- `sqt-v39` — Plan A (storage & data integrity)
- `sqt-v40` — Plan B (tracking UX)

---

## Known Minor Issues (non-blocking)

1. **Reopen button on abandoned games** — `history-reopen-btn` renders on all history items including ones with `result: null`. Guard in `reopenGame()` handles it gracefully.
2. **`reopenGame()` double-write** — `saveGame()` is called before `setActiveGame()`, so game briefly exists in both `sqt_games` and `sqt_live_game`. Flushes correctly on save.
3. **`postgame-back` no null guard** — shows empty tracking screen if tapped with no active game. Unreachable in normal use.

---

## Context for New Sessions

- The app is used by a high school basketball coach during live games on their phone
- Simplicity and speed of interaction are the top priority — every extra tap costs attention during a game
- No backend, no accounts, no internet required during games
- Design decisions are logged in `docs/superpowers/specs/`
- Implementation plans are logged in `docs/superpowers/plans/`
- All subagent work uses the `superpowers:subagent-driven-development` skill with spec + code quality review per task
