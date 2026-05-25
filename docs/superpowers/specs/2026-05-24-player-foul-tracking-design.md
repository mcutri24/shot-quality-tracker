# Player Foul Tracking — Design Spec

## Goal

Add per-player foul tracking to the live tracker screen. Coaches need to know each player's foul count during a game (5 fouls = fouled out in NJ HS basketball). The interaction must be fast and non-disruptive — the coach is already managing possession tracking and timeout counts.

## Context

- Fouls happen independently of possessions, mostly on defense
- The tracker screen has a 5-step possession flow; Step 1 is the player select grid
- The existing undo button handles possessions only — foul adjustments use their own subtract mechanism
- The fire/ice streak badges are already positioned `top-right` on player cards (`position: absolute; top: 2px; right: 4px`)

---

## Data Model

Add a `fouls` field to the game object in `SQT.Game.startGame()`:

```js
fouls: {}   // { [playerId]: count }  — sparse map, only players with fouls present
```

**Reads:** `game.fouls[playerId] || 0` — missing keys default to zero, so legacy games with no `fouls` field work without migration.

**Writes:** On every widget + or − tap, update the in-memory game object and call `SQT.Storage.saveGame(game)` immediately.

**End of game:** `fouls` is included in the game object flushed to the full games list. Not surfaced in the dashboard yet — stored for future use.

---

## Gesture: Long-Press on Player Card

- **Single tap** → unchanged, fires immediately, starts possession tracking (Step 1 → Step 2)
- **Long-press (~500ms hold)** → foul widget appears on that card
- Long-press is only active during **Step 1** (player select). Steps 2–5 are unaffected.
- No delay added to single-tap. Long-press detection uses `touchstart`/`touchend` timing or `pointerdown` + timer, cancelled if the finger moves significantly (to avoid triggering on scroll).

---

## Foul Widget

When long-press triggers, an overlay appears **on the held player card only**. All other cards remain visible and interactive.

**Widget layout (in-card overlay):**

```
┌─────────────────────────┐
│  #3 SMITH               │
│   [−]   2   [+]         │
│       FOULS             │
└─────────────────────────┘
```

- Background: `rgba(12,12,14,0.92)` covering the card
- Player name + number shown at top
- Current foul count in the center (large, amber if 1–3, red if 4+)
- `[−]` button: dark background, decrements count (min 0), saves, closes
- `[+]` button: crimson background (`var(--accent)`), increments count (max 5), saves, closes
- Tap anywhere outside the widget → closes with no change
- Widget does not appear if triggered mid-possession (Steps 2–5)

---

## Badge Design

Foul count badge on the player card:

- **Position:** `top-left` corner (`position: absolute; top: -7px; left: -7px`) — opposite corner from the fire/ice badge (`top-right`). No overlap possible even when both are present.
- **Shape:** 20×20px filled circle, font-size 11px, font-weight 700

| Foul count | Badge color | Text color | Card style |
|-----------|-------------|------------|------------|
| 0 | none | — | unchanged |
| 1–2 | `var(--gold)` (#f59e0b) | black | unchanged |
| 3 | `var(--orange)` (#f97316) | white | unchanged |
| 4 | `var(--red)` (#ef4444) | white | unchanged (no border change) |
| 5 | `var(--red)` (#ef4444) | white | entire card `opacity: 0.45`, dimmed |

The `player-hot` / `player-cold` border/glow on the card is **not changed** by fouls — streak state and foul state are fully independent.

---

## Implementation Scope

**Files to change:**

| File | Change |
|------|--------|
| `js/game.js` | Add `fouls: {}` to game object in `startGame()` |
| `js/tracker.js` | Add foul badge rendering inside `_renderPlayerSelect()`; add long-press listener logic; add `_showFoulWidget()` method |
| `css/screens.css` | Add `.foul-badge`, `.foul-widget` styles |
| `sw.js` | Bump cache version |

**No changes to:**
- `index.html` — no new DOM elements needed (widget is injected dynamically)
- `js/storage.js` — no schema change needed (sparse map reads as zero for missing keys)
- Dashboard / history screens — foul data stored but not displayed yet

---

## Edge Cases

- **Legacy games** (no `fouls` field): `game.fouls[pid] || 0` returns 0 — no crash, no migration
- **OT:** Foul limit stays at 5 per player regardless of quarter
- **Subtract below 0:** `[−]` button disabled (or clamped) when count is already 0
- **Add above 5:** `[+]` button disabled (or clamped) when count is already 5
- **Scroll vs long-press:** Cancel long-press timer if `pointermove` exceeds ~8px before 500ms
- **Widget on Step 2–5:** Long-press listener only attached during Step 1 renders — no risk of widget appearing mid-possession
