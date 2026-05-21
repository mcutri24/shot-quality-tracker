# Timeout Counter — Design Spec

**Date:** 2026-05-20
**Status:** Approved
**Scope:** Add a per-game timeout counter to the live tracker screen (NJ HS basketball rules)

---

## 1. Background

NJ high school basketball rules grant each team **5 timeouts per game**:
- 3 full timeouts (amber)
- 2 thirty-second timeouts (blue)
- 1 additional full timeout per overtime period

The app currently has no way to track how many timeouts have been used. Coaches need a fast, glanceable counter they can update with a single tap during live play.

---

## 2. Scope

- **Counter only.** No logging, no per-quarter breakdown, no analytics.
- **Own team only.** Opponent timeouts are not tracked.
- **Existing games.** A game started before this feature is deployed will load with `timeouts` missing; the code treats missing as `{ fullUsed: 0, shortUsed: 0 }` (safe default).

---

## 3. Data Model

### 3.1 Game object

`SQT.Storage.startGame()` initialises the game object. Add:

```js
timeouts: { fullUsed: 0, shortUsed: 0 }
```

Full game object shape after change:

```js
{
  id, seasonId, opponent, date, location,
  possessions: [],
  timeouts: { fullUsed: 0, shortUsed: 0 },   // NEW
  finalScoreUs: null, finalScoreThem: null,
  result: null, createdAt
}
```

### 3.2 Totals by quarter context

| Quarter | Full TOs available | 30s TOs available |
|---------|--------------------|-------------------|
| Q1–Q4   | 3                  | 2                 |
| OT      | 4 (3 + 1 extra)    | 2                 |

The totals are computed at render time:

```js
var fullTotal  = (self.currentQuarter === 'OT') ? 4 : 3;
var shortTotal = 2;
```

Switching from OT back to Q4 (if the user corrects the quarter) re-renders the bar and clamps `fullUsed` to 3 if it was 4. This prevents an over-used count from persisting after an OT quarter correction.

---

## 4. UI

### 4.1 Placement

A **sticky pip strip** fixed to the bottom of `#tracking-screen`, always visible regardless of how long the tap flow grows. The strip sits above the existing navigation chrome (if any).

### 4.2 Visual layout

```
[ FULL  ■ ■ ■ ]   [ 30s  ■ ■ ]
```

- **FULL** label (amber, `#f59e0b`)  followed by 3 amber square pips
- **30s** label (blue, `#3b82f6`) followed by 2 blue square pips
- Used pips render grey (`#475569`); available pips render at full colour
- Pips are square (`border-radius: 2px`), minimum 44×44 logical pixels touch target

### 4.3 Rendering function

`SQT.Tracker._renderTimeoutBar()` — called on:
1. Tracker screen load (game resume or new game start)
2. Every quarter tab switch (so OT correctly adds/removes the 4th amber pip)

The function reads `self.game.timeouts` (defaulting to `{ fullUsed: 0, shortUsed: 0 }` if absent) and rebuilds the strip HTML each call.

---

## 5. Interaction

### 5.1 Tap behaviour

| Pip state | Tap result |
|-----------|-----------|
| Lit (available) | → Grey (used). Increment `fullUsed` or `shortUsed`. |
| Grey (used) | → Lit (available). Decrement `fullUsed` or `shortUsed`. |

Tapping a lit pip that is the *last* available one still works (marks it used). Tapping when already at 0 used is a no-op (nothing to undo).

### 5.2 Persistence

After each tap: `SQT.Storage.saveGame(self.game)`. No toast, no confirmation.

### 5.3 Count clamping

```js
game.timeouts.fullUsed  = Math.max(0, Math.min(fullTotal,  game.timeouts.fullUsed));
game.timeouts.shortUsed = Math.max(0, Math.min(shortTotal, game.timeouts.shortUsed));
```

Clamping is applied on load and whenever `fullTotal` changes (OT switch).

---

## 6. Implementation Notes

- The pip strip is appended to the `#tracking-screen` container with `position: fixed; bottom: 0` (or an equivalent sticky pattern matching existing app chrome).
- Touch targets: each pip `<button>` must be at least 44 × 44 px (padding + min-width/height).
- No new dependencies; vanilla JS and inline styles consistent with the rest of the app.
- `_renderTimeoutBar()` should guard against `self.game` being null (not started yet).

---

## 7. Out of Scope

- Opponent timeout tracking
- Per-quarter timeout log
- Timeout-used analytics on the dashboard
- Notifications when timeouts run low
