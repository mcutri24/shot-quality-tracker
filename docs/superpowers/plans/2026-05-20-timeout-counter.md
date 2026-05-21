# Timeout Counter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sticky pip strip to the tracker screen that lets a coach tap to mark/undo timeout usage for their team, persisted immediately to the game object.

**Architecture:** `SQT.Game.startGame()` seeds `game.timeouts = { fullUsed: 0, shortUsed: 0 }`. A new `_renderTimeoutBar()` method in `SQT.Tracker` renders the pip strip HTML into `#timeout-bar` and binds click handlers. The strip sits between the tap-flow area and the bottom action bar in a flex-column layout, so it is always on screen. Quarter switches re-render the bar to add/remove the OT pip.

**Tech Stack:** Vanilla JS ES5 (var/function), HTML, CSS. No build step. No test framework — verification is browser DevTools + manual tap.

---

## File Map

| File | Change |
|------|--------|
| `js/game.js` | Add `timeouts: { fullUsed: 0, shortUsed: 0 }` to `startGame()` |
| `index.html` | Insert `<div id="timeout-bar"></div>` in `#tracking-screen` |
| `css/screens.css` | Add pip strip styles |
| `js/tracker.js` | Add `_renderTimeoutBar()`, call it in `start()` and on quarter switch |
| `sw.js` | Bump cache `sqt-v35` → `sqt-v36` |

---

### Task 1: Add `timeouts` field to new game object

**Files:**
- Modify: `js/game.js:50-61`

- [ ] **Step 1: Verify the absence**

  Open DevTools console on the app. Start a game, then run:
  ```js
  SQT.App.currentGame.timeouts
  ```
  Expected: `undefined`

- [ ] **Step 2: Add the field**

  In `js/game.js`, inside `startGame()`, add `timeouts` after `possessions: []`:

  ```js
          var game = {
              id: SQT.Storage.uuid(),
              seasonId: active.id,
              opponent: opponent,
              date: date,
              location: location,
              possessions: [],
              timeouts: { fullUsed: 0, shortUsed: 0 },
              finalScoreUs: null,
              finalScoreThem: null,
              result: null,
              createdAt: new Date().toISOString()
          };
  ```

- [ ] **Step 3: Verify**

  Hard-reload the app. Start a new game, then in DevTools:
  ```js
  SQT.App.currentGame.timeouts
  ```
  Expected: `{ fullUsed: 0, shortUsed: 0 }`

  Also confirm a resumed game that lacks `timeouts` is not broken (the `_renderTimeoutBar` guard handles this — see Task 4).

- [ ] **Step 4: Commit**

  ```bash
  git add js/game.js
  git commit -m "feat(game): seed timeouts field on new game object"
  ```

---

### Task 2: Add timeout bar placeholder to HTML

**Files:**
- Modify: `index.html:143-151`

The tracking screen layout is a flex column. `#tap-flow-area` has `flex: 1` and `.tracking-bottom` has `flex-shrink: 0`. Insert `#timeout-bar` between them so it stays on screen regardless of tap-flow height.

- [ ] **Step 1: Verify no element exists**

  In DevTools console:
  ```js
  document.getElementById('timeout-bar')
  ```
  Expected: `null`

- [ ] **Step 2: Insert the div**

  In `index.html`, add the new div immediately after the closing `</div>` of `#tap-flow-area` and before `.tracking-bottom`:

  ```html
          <div class="tap-flow" id="tap-flow-area">
              <!-- Dynamic content rendered by tracker.js -->
          </div>
          <div id="timeout-bar"></div>
          <div class="tracking-bottom">
  ```

- [ ] **Step 3: Verify**

  Reload. In DevTools:
  ```js
  document.getElementById('timeout-bar')
  ```
  Expected: `<div id="timeout-bar"></div>` (empty, no styles yet)

- [ ] **Step 4: Commit**

  ```bash
  git add index.html
  git commit -m "feat(html): add #timeout-bar placeholder in tracking screen"
  ```

---

### Task 3: Style the pip strip

**Files:**
- Modify: `css/screens.css` (append after the `.tracking-bottom` block, around line 517)

The strip matches the `.tracking-bottom` visual treatment (same blurred background, border-top). Each pip button is 44×44 px for touch compliance.

- [ ] **Step 1: Append CSS**

  After the `.bottom-btn:active` rule (around line 517 in `screens.css`), add:

  ```css
  /* ---- Timeout pip strip ---- */
  #timeout-bar {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      padding: 4px 16px;
      background: rgba(21, 21, 23, 0.85);
      -webkit-backdrop-filter: blur(12px);
      backdrop-filter: blur(12px);
      border-top: 1px solid rgba(46, 46, 54, 0.6);
      min-height: 52px;
  }
  .to-bar-inner {
      display: flex;
      width: 100%;
      align-items: center;
      justify-content: space-between;
  }
  .to-group {
      display: flex;
      align-items: center;
      gap: 4px;
  }
  .to-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin-right: 4px;
      text-transform: uppercase;
  }
  .to-label.to-full  { color: var(--gold); }
  .to-label.to-short { color: #3b82f6; }
  .to-pip {
      width: 44px;
      height: 44px;
      border-radius: 4px;
      border: none;
      transition: background 0.15s ease, transform 0.1s ease;
      flex-shrink: 0;
  }
  .to-pip:active { transform: scale(0.88); }
  .to-pip-full              { background: var(--gold); }
  .to-pip-full.to-pip-used  { background: #475569; }
  .to-pip-short             { background: #3b82f6; }
  .to-pip-short.to-pip-used { background: #475569; }
  ```

- [ ] **Step 2: Visual smoke test**

  Temporarily paste this in DevTools console while on the tracking screen:
  ```js
  var bar = document.getElementById('timeout-bar');
  bar.innerHTML = '<div class="to-bar-inner"><div class="to-group"><span class="to-label to-full">FULL</span><button class="to-pip to-pip-full"></button><button class="to-pip to-pip-full"></button><button class="to-pip to-pip-full to-pip-used"></button></div><div class="to-group"><span class="to-label to-short">30s</span><button class="to-pip to-pip-short"></button><button class="to-pip to-pip-short to-pip-used"></button></div></div>';
  ```
  Expected: amber strip appears above the bottom buttons with 3 full pips (3rd grey) and 2 short pips (2nd grey). Tap feedback (scale) on press.

- [ ] **Step 3: Clear test HTML**

  Reload the page — the injected HTML clears automatically.

- [ ] **Step 4: Commit**

  ```bash
  git add css/screens.css
  git commit -m "feat(css): add timeout pip strip styles"
  ```

---

### Task 4: Implement `_renderTimeoutBar()` in tracker.js

**Files:**
- Modify: `js/tracker.js` — add method to `SQT.Tracker` object

Add the method before the `_esc` method (near the bottom of the object, around line 963). Insert after the closing brace of `_shotLabel`.

- [ ] **Step 1: Write the method**

  Add this method to `SQT.Tracker` (after `_shotLabel`, before `_esc`):

  ```js
      _renderTimeoutBar: function() {
          var self = this;
          var bar = document.getElementById('timeout-bar');
          if (!bar || !this.game) return;

          // Normalise: legacy games won't have this field
          if (!this.game.timeouts) {
              this.game.timeouts = { fullUsed: 0, shortUsed: 0 };
          }
          var to = this.game.timeouts;

          var fullTotal  = (this.currentQuarter === 'OT') ? 4 : 3;
          var shortTotal = 2;

          // Clamp used counts (handles OT→regulation switch)
          to.fullUsed  = Math.max(0, Math.min(fullTotal,  to.fullUsed));
          to.shortUsed = Math.max(0, Math.min(shortTotal, to.shortUsed));

          var html = '<div class="to-bar-inner">';

          // Full timeouts group
          html += '<div class="to-group">';
          html += '<span class="to-label to-full">FULL</span>';
          for (var f = 0; f < fullTotal; f++) {
              var fu = (f < to.fullUsed);
              html += '<button class="to-pip to-pip-full' + (fu ? ' to-pip-used' : '') + '"' +
                      ' data-type="full"' +
                      ' aria-label="Full timeout ' + (f + 1) + (fu ? ' used' : '') + '">' +
                      '</button>';
          }
          html += '</div>';

          // 30-second timeouts group
          html += '<div class="to-group">';
          html += '<span class="to-label to-short">30s</span>';
          for (var s = 0; s < shortTotal; s++) {
              var su = (s < to.shortUsed);
              html += '<button class="to-pip to-pip-short' + (su ? ' to-pip-used' : '') + '"' +
                      ' data-type="short"' +
                      ' aria-label="30s timeout ' + (s + 1) + (su ? ' used' : '') + '">' +
                      '</button>';
          }
          html += '</div>';

          html += '</div>';
          bar.innerHTML = html;

          // Bind tap handlers — rebuild each render, old listeners removed with innerHTML replace
          var pips = bar.querySelectorAll('.to-pip');
          for (var i = 0; i < pips.length; i++) {
              pips[i].addEventListener('click', function() {
                  var type   = this.getAttribute('data-type');
                  var isUsed = this.classList.contains('to-pip-used');
                  var fTotal = (self.currentQuarter === 'OT') ? 4 : 3;
                  var sTotal = 2;

                  if (type === 'full') {
                      self.game.timeouts.fullUsed = isUsed
                          ? Math.max(0, self.game.timeouts.fullUsed - 1)
                          : Math.min(fTotal, self.game.timeouts.fullUsed + 1);
                  } else {
                      self.game.timeouts.shortUsed = isUsed
                          ? Math.max(0, self.game.timeouts.shortUsed - 1)
                          : Math.min(sTotal, self.game.timeouts.shortUsed + 1);
                  }

                  SQT.Storage.saveGame(self.game);
                  self._renderTimeoutBar();
              });
          }
      },
  ```

- [ ] **Step 2: Verify method exists (pre-wire)**

  Reload. In DevTools console (while on tracking screen with a game active):
  ```js
  SQT.Tracker._renderTimeoutBar()
  ```
  Expected: bar renders with 3 amber pips + 2 blue pips, all lit. No errors.

- [ ] **Step 3: Verify tap toggles a pip**

  Still in DevTools — after rendering:
  ```js
  // Tap the first full pip programmatically
  document.querySelector('.to-pip-full').click();
  SQT.App.currentGame.timeouts
  ```
  Expected: `{ fullUsed: 1, shortUsed: 0 }` — first pip turns grey.

  ```js
  // Tap it again to undo
  document.querySelector('.to-pip-full').click();
  SQT.App.currentGame.timeouts
  ```
  Expected: `{ fullUsed: 0, shortUsed: 0 }` — first pip turns amber again.

- [ ] **Step 4: Verify OT adds 4th amber pip**

  ```js
  SQT.Tracker.currentQuarter = 'OT';
  SQT.Tracker._renderTimeoutBar();
  document.querySelectorAll('.to-pip-full').length
  ```
  Expected: `4`

  ```js
  // Reset quarter
  SQT.Tracker.currentQuarter = 'Q4';
  SQT.Tracker._renderTimeoutBar();
  document.querySelectorAll('.to-pip-full').length
  ```
  Expected: `3`

- [ ] **Step 5: Verify OT→Q4 clamp**

  ```js
  SQT.App.currentGame.timeouts.fullUsed = 4; // simulate 4 used in OT
  SQT.Tracker.currentQuarter = 'Q4';
  SQT.Tracker._renderTimeoutBar();
  SQT.App.currentGame.timeouts.fullUsed
  ```
  Expected: `3` (clamped to regulation max)

- [ ] **Step 6: Commit**

  ```bash
  git add js/tracker.js
  git commit -m "feat(tracker): implement _renderTimeoutBar with pip toggle"
  ```

---

### Task 5: Wire `_renderTimeoutBar()` into `start()` and quarter switch

**Files:**
- Modify: `js/tracker.js:39-68` (`start` method)
- Modify: `js/tracker.js:71-85` (`_bindTrackingUI` quarter handler)

- [ ] **Step 1: Call in `start()`**

  In `SQT.Tracker.start()`, add the call after `this._renderStep()`:

  ```js
      start: function(game) {
          this.game = game;
          this.step = 1;
          this.pending = null;
          this.plays = SQT.Storage.getPlays();

          history.pushState({ sqtTracking: true }, '');

          var lastQ = 'Q1';
          if (game.possessions && game.possessions.length > 0) {
              lastQ = game.possessions[game.possessions.length - 1].quarter || 'Q1';
          }
          this.currentQuarter = lastQ;

          this._renderTrackingTop();
          this._renderMomentumDots();
          this._renderStep();
          this._renderTimeoutBar();   // <-- ADD THIS LINE
          this._bindTrackingUI();

          var qBtns = document.querySelectorAll('.quarter-selector button');
          for (var i = 0; i < qBtns.length; i++) {
              qBtns[i].classList.remove('active');
              if (qBtns[i].textContent.trim() === lastQ) {
                  qBtns[i].classList.add('active');
              }
          }
      },
  ```

- [ ] **Step 2: Call on quarter switch**

  In `_bindTrackingUI()`, inside the quarter button `onclick` handler, add `self._renderTimeoutBar()` after `self._showQuarterSplash(newQ)`:

  ```js
          var qBtns = document.querySelectorAll('.quarter-selector button');
          for (var i = 0; i < qBtns.length; i++) {
              qBtns[i].onclick = function() {
                  var newQ = this.textContent.trim();
                  if (newQ === self.currentQuarter) return;
                  for (var j = 0; j < qBtns.length; j++) qBtns[j].classList.remove('active');
                  this.classList.add('active');
                  self.currentQuarter = newQ;
                  self._showQuarterSplash(newQ);
                  self._renderTimeoutBar();   // <-- ADD THIS LINE
              };
          }
  ```

- [ ] **Step 3: End-to-end verification**

  1. Hard-reload app.
  2. Start a new game (any opponent).
  3. Confirm pip strip appears immediately with 3 amber + 2 blue pips.
  4. Tap 2 amber pips — confirm first 2 turn grey. Tap 1 blue pip — confirm it turns grey.
  5. Kill and re-open the app (or `SQT.App.showScreen('home'); SQT.App.showScreen('tracking'); SQT.Tracker.start(SQT.Storage.getActiveGame());`).
  6. Confirm resumed game shows the same used state (2 grey amber, 1 grey blue).
  7. Switch to OT — confirm 4 amber pips appear.
  8. Switch back to Q4 — confirm 3 amber pips (clamped if 4th was used during test, resets to 3).

- [ ] **Step 4: Commit**

  ```bash
  git add js/tracker.js
  git commit -m "feat(tracker): wire _renderTimeoutBar into start() and quarter switch"
  ```

---

### Task 6: Bump SW cache

**Files:**
- Modify: `sw.js:1`

Service worker caches all app assets. Bumping the cache name forces clients to fetch the new files on next reload.

- [ ] **Step 1: Bump version**

  In `sw.js` line 1, change:
  ```js
  var CACHE_NAME = 'sqt-v35';
  ```
  to:
  ```js
  var CACHE_NAME = 'sqt-v36';
  ```

- [ ] **Step 2: Verify**

  In DevTools → Application → Service Workers, confirm new SW registers and old SW becomes redundant after clicking "Skip waiting".

- [ ] **Step 3: Commit**

  ```bash
  git add sw.js
  git commit -m "chore(sw): bump cache to sqt-v36 for timeout counter release"
  ```

---

## Self-Review Checklist

- [x] All spec requirements covered:
  - `timeouts` field on game → Task 1
  - Sticky pip strip UI → Tasks 2, 3
  - 3 full / 2 short pips, OT adds 4th full → Task 4
  - Tap toggles used/available → Task 4
  - Persists via `saveGame` on every tap → Task 4
  - Re-render on quarter switch + OT clamp → Tasks 4, 5
  - Legacy game safe default → Task 4 (`if (!this.game.timeouts)` guard)
- [x] No TBDs, no placeholders
- [x] Type/name consistency: `fullUsed`, `shortUsed`, `fullTotal`, `shortTotal`, `_renderTimeoutBar` — consistent throughout all tasks
- [x] Touch targets: 44×44px pip buttons per CSS in Task 3
