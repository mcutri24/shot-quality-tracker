# AI Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a floating AI assistant panel to the Shot Quality Tracker that lets coaches ask questions about live game and season data, powered by Claude Haiku with inline Chart.js visualizations.

**Architecture:** Three new JS files (assistant.js for UI, assistant-api.js for Anthropic API streaming, assistant-context.js for data serialization) plus Chart.js as a vendored library. All files load with `defer` and attach to the `SQT` namespace. The assistant reads localStorage data (read-only) and renders in a floating panel that overlays existing screens. Zero coupling with tracking code.

**Tech Stack:** Vanilla ES5 (matching existing codebase), Anthropic Messages API with streaming, Chart.js v4.x for visualizations.

**Spec:** `docs/superpowers/specs/2026-10-17-ai-assistant-design.md`

**Codebase conventions:**
- ES5 only: `var` not `const`/`let`, no arrow functions, no template literals, no destructuring
- All modules attach to global `SQT` namespace (`window.SQT = SQT`)
- DOM manipulation via `document.getElementById()`, `document.createElement()`, `innerHTML`
- Screen navigation via `SQT.App.showScreen(id)` toggling `.active` class
- CSS variables defined in `css/variables.css` (e.g., `--accent: #c41230`, `--bg-card: #1c1c20`)
- Service worker precache list in `sw.js` with version string `sqt-v42`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `js/assistant-context.js` | Reads localStorage, builds JSON context payloads for Claude (game data, season data, roster, plays). Pure data — no DOM, no API calls. |
| `js/assistant-api.js` | Anthropic Messages API client. Builds message arrays, handles streaming via fetch/ReadableStream, maps HTTP errors to user-friendly error types. No DOM. |
| `js/assistant.js` | All UI: FAB button, chat panel, message rendering, settings view, chart rendering, full-screen chart overlay. Orchestrates context + API modules. |
| `css/assistant.css` | All assistant styles. Separate file to avoid touching existing CSS. |
| `lib/chart.min.js` | Chart.js v4.x library (vendored, ~200KB unminified or ~65KB gzipped). |

**Modifications to existing files:**
- `index.html` — Add `<link>` for `css/assistant.css` and `<script defer>` tags for the 3 new JS files + Chart.js
- `sw.js` — Bump cache version to `sqt-v43`, add new files to ASSETS array

---

## Task 1: Vendor Chart.js and Update Service Worker

**Files:**
- Create: `lib/chart.min.js`
- Modify: `sw.js`
- Modify: `index.html`

- [ ] **Step 1: Download Chart.js v4 UMD bundle**

Run:
```bash
mkdir -p lib && curl -L "https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js" -o lib/chart.min.js
```

Verify it downloaded (should be ~200KB):
```bash
ls -la lib/chart.min.js
```

- [ ] **Step 2: Add new assets to service worker precache list**

In `sw.js`, update the cache version and add new files to the ASSETS array:

```js
var CACHE_NAME = 'sqt-v43';
var ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icons/na-logo.png',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './css/variables.css',
    './css/screens.css',
    './css/components.css',
    './css/assistant.css',
    './js/storage.js',
    './js/roster.js',
    './js/plays.js',
    './js/game.js',
    './js/tracker.js',
    './js/dashboard.js',
    './js/export.js',
    './js/app.js',
    './js/assistant-context.js',
    './js/assistant-api.js',
    './js/assistant.js',
    './lib/chart.min.js'
];
```

- [ ] **Step 3: Add script and CSS tags to index.html**

In `index.html`, add the CSS link after the existing stylesheet links (line 14):

```html
<link rel="stylesheet" href="css/assistant.css">
```

Add script tags after the existing scripts block (after line 234, before the export button binding script):

```html
<script defer src="lib/chart.min.js"></script>
<script defer src="js/assistant-context.js"></script>
<script defer src="js/assistant-api.js"></script>
<script defer src="js/assistant.js"></script>
```

- [ ] **Step 4: Verify the app still loads**

Open the app in a browser. Confirm:
- Home screen renders normally
- No console errors from missing files (the new JS files don't exist yet, but `defer` means they won't block)
- Service worker update triggers in DevTools > Application

- [ ] **Step 5: Commit**

```bash
git add lib/chart.min.js sw.js index.html
git commit -m "feat: vendor Chart.js and prepare SW cache for assistant"
```

---

## Task 2: Data Context Module (`assistant-context.js`)

This module reads game/season data from localStorage and formats it for Claude. It has no DOM dependencies and no API calls — pure data transformation.

**Files:**
- Create: `js/assistant-context.js`

- [ ] **Step 1: Create the context module**

Create `js/assistant-context.js` with the following content:

```js
/**
 * Data context builder for AI assistant.
 * Reads localStorage via SQT.Storage and builds JSON payloads for Claude.
 */
var SQT = window.SQT || {};

SQT.AssistantContext = {
    /**
     * Build context for the current app state.
     * Returns { mode, systemPrompt, dataContext }
     * mode: 'live-game' | 'season'
     */
    build: function() {
        var activeGame = SQT.Storage.getActiveGame();
        var isLiveGame = activeGame && !activeGame.result;

        if (isLiveGame) {
            return this._buildLiveGameContext(activeGame);
        }
        return this._buildSeasonContext();
    },

    _buildLiveGameContext: function(game) {
        var season = SQT.Storage.getActiveSeason();
        var seasonId = season ? season.id : null;
        var roster = SQT.Storage.getRoster(seasonId);
        var plays = SQT.Storage.getPlays(seasonId);

        var stats = this._computeGameStats(game);

        var dataContext = '## CURRENT LIVE GAME DATA\n\n' +
            'Opponent: ' + game.opponent + '\n' +
            'Location: ' + game.location + '\n' +
            'Date: ' + game.date + '\n' +
            'Possessions: ' + stats.totalPoss + '\n' +
            'Points: ' + stats.totalPts + '\n' +
            'PPP: ' + stats.ppp + '\n' +
            'FG%: ' + stats.fgPct + '\n' +
            'Current quarter: ' + this._getCurrentQuarter(game) + '\n\n' +
            '### Roster\n' + JSON.stringify(roster.map(function(p) {
                return { number: p.number, name: p.name, id: p.id };
            })) + '\n\n' +
            '### Plays\n' + JSON.stringify(plays.map(function(p) {
                return { name: p.name, id: p.id };
            })) + '\n\n' +
            '### All Possessions\n' + JSON.stringify(game.possessions || []) + '\n\n' +
            '### Timeouts\n' + JSON.stringify(game.timeouts || {}) + '\n\n' +
            '### Fouls\n' + JSON.stringify(game.fouls || {});

        return {
            mode: 'live-game',
            systemPrompt: this._systemPrompt('live-game', game.opponent),
            dataContext: dataContext
        };
    },

    _buildSeasonContext: function() {
        var season = SQT.Storage.getActiveSeason();
        if (!season) {
            return {
                mode: 'season',
                systemPrompt: this._systemPrompt('season', null),
                dataContext: 'No active season. The coach needs to create a season first.'
            };
        }

        var seasonId = season.id;
        var games = SQT.Storage.getGamesBySeason(seasonId);
        var roster = SQT.Storage.getRoster(seasonId);
        var plays = SQT.Storage.getPlays(seasonId);

        // Build per-game summaries
        var gameSummaries = [];
        for (var i = 0; i < games.length; i++) {
            var g = games[i];
            var stats = this._computeGameStats(g);
            gameSummaries.push({
                id: g.id,
                opponent: g.opponent,
                date: g.date,
                location: g.location,
                result: g.result || 'in-progress',
                finalScoreUs: g.finalScoreUs,
                finalScoreThem: g.finalScoreThem,
                possessions: stats.totalPoss,
                points: stats.totalPts,
                ppp: stats.ppp,
                fgPct: stats.fgPct,
                threePct: stats.threePct,
                ftPct: stats.ftPct,
                turnovers: stats.turnovers
            });
        }

        // Include full possession data for all games (season-level analysis needs it)
        var allPossessions = [];
        for (var j = 0; j < games.length; j++) {
            var gp = games[j];
            if (gp.possessions) {
                for (var k = 0; k < gp.possessions.length; k++) {
                    var poss = gp.possessions[k];
                    allPossessions.push({
                        gameId: gp.id,
                        opponent: gp.opponent,
                        date: gp.date,
                        result: gp.result,
                        quarter: poss.quarter,
                        playerId: poss.playerId,
                        playerNumber: poss.playerNumber,
                        playerName: poss.playerName,
                        shotType: poss.shotType,
                        playName: poss.playName,
                        result_poss: poss.result,
                        points: poss.points,
                        grade: poss.grade,
                        and1: poss.and1 || false,
                        ftMade: poss.ftMade || 0,
                        ftAttempts: poss.ftAttempts || 0
                    });
                }
            }
        }

        var dataContext = '## SEASON DATA: ' + season.name + '\n\n' +
            '### Game Summaries (' + games.length + ' games)\n' +
            JSON.stringify(gameSummaries, null, 1) + '\n\n' +
            '### Roster\n' + JSON.stringify(roster.map(function(p) {
                return { number: p.number, name: p.name, id: p.id };
            })) + '\n\n' +
            '### Plays\n' + JSON.stringify(plays.map(function(p) {
                return { name: p.name, id: p.id };
            })) + '\n\n' +
            '### All Possessions (' + allPossessions.length + ' total)\n' +
            JSON.stringify(allPossessions);

        return {
            mode: 'season',
            systemPrompt: this._systemPrompt('season', null),
            dataContext: dataContext
        };
    },

    _computeGameStats: function(game) {
        var poss = game.possessions || [];
        var totalPts = 0, fgMade = 0, fgAtt = 0, threeMade = 0, threeAtt = 0;
        var ftMade = 0, ftAtt = 0, turnovers = 0;

        for (var i = 0; i < poss.length; i++) {
            var p = poss[i];
            totalPts += p.points || 0;

            if (p.shotType === 'turnover') {
                turnovers++;
                continue;
            }
            if (p.shotType === 'free_throws') {
                ftMade += p.ftMade || 0;
                ftAtt += p.ftAttempts || 0;
                continue;
            }

            // Field goals
            if (p.result === 'made' || p.result === 'missed') {
                fgAtt++;
                if (p.result === 'made') fgMade++;
            }
            if (p.shotType === 'open_3' || p.shotType === 'contested_3') {
                if (p.result === 'made' || p.result === 'missed') {
                    threeAtt++;
                    if (p.result === 'made') threeMade++;
                }
            }

            // And-1 free throws
            if (p.and1) {
                ftMade += p.and1FtMade || 0;
                ftAtt += p.and1FtAttempts || 0;
            }
        }

        var totalPoss = poss.length;
        return {
            totalPoss: totalPoss,
            totalPts: totalPts,
            ppp: totalPoss > 0 ? (totalPts / totalPoss).toFixed(2) : '0.00',
            fgPct: fgAtt > 0 ? (fgMade / fgAtt * 100).toFixed(1) + '%' : '0.0%',
            threePct: threeAtt > 0 ? (threeMade / threeAtt * 100).toFixed(1) + '%' : '0.0%',
            ftPct: ftAtt > 0 ? (ftMade / ftAtt * 100).toFixed(1) + '%' : '0.0%',
            turnovers: turnovers
        };
    },

    _getCurrentQuarter: function(game) {
        var poss = game.possessions || [];
        if (poss.length === 0) return 'Q1';
        return poss[poss.length - 1].quarter || 'Q1';
    },

    _systemPrompt: function(mode, opponent) {
        var base = 'You are a basketball analytics assistant for the Newark Academy Minutemen coaching staff. ' +
            'You have access to detailed possession-level data from games tracked with the Shot Quality Tracker app.\n\n' +
            '## Data Model\n' +
            '- Each possession has: player, shotType, result (made/missed/foul/turnover), points, grade (gold/silver/bronze), play name, quarter\n' +
            '- Shot types: open_layup, contested_layup, open_mid, contested_mid, open_3, contested_3, free_throws, turnover\n' +
            '- PPP = Points Per Possession (total points / total possessions). League-average college PPP is ~1.0. Above 1.1 is good, above 1.2 is excellent.\n' +
            '- Grades reflect shot quality: gold = great look, silver = decent, bronze = poor shot selection\n' +
            '- "Open" shots mean the shooter was not closely guarded. "Contested" means a defender was nearby.\n\n' +
            '## Response Guidelines\n' +
            '- Be concise and direct. Coaches need quick answers, especially during games.\n' +
            '- Lead with the key insight, then supporting data.\n' +
            '- Use player numbers (e.g., #11 Davis) for quick identification.\n' +
            '- Bold important stats and player names using **markdown**.\n' +
            '- When trends or comparisons would benefit from a visual, include a chart specification.\n\n' +
            '## Chart Specifications\n' +
            'When a chart would help, include a JSON code block tagged as ```chart with this schema:\n' +
            '{\n' +
            '  "type": "bar" | "line" | "doughnut" | "horizontalBar",\n' +
            '  "title": "Chart Title",\n' +
            '  "labels": ["Label1", "Label2"],\n' +
            '  "datasets": [{\n' +
            '    "label": "Dataset Name",\n' +
            '    "data": [1.2, 0.8],\n' +
            '    "colors": ["#4CAF50", "#f44336"]\n' +
            '  }]\n' +
            '}\n' +
            'Use colors: #4CAF50 (green/good), #ffeb3b (yellow/average), #f44336 (red/poor), #c41230 (accent/crimson), #94a3b8 (neutral).\n' +
            'Only include charts when they genuinely add value — not for every response.\n';

        if (mode === 'live-game') {
            base += '\n## Current Context\n' +
                'You are assisting during a LIVE GAME against ' + (opponent || 'an opponent') + '. ' +
                'The coach is on the bench and needs quick, actionable insights. ' +
                'Keep responses short (2-4 sentences for simple questions). ' +
                'For halftime-style analysis, provide more detail with charts.';
        } else {
            base += '\n## Current Context\n' +
                'You are helping with SEASON-LEVEL ANALYSIS. ' +
                'The coach has time for deeper analysis. You can provide longer, more detailed responses with charts and comparisons. ' +
                'Look for trends across games, player development arcs, and strategic patterns.';
        }

        return base;
    }
};

window.SQT = SQT;
```

- [ ] **Step 2: Verify the module loads without errors**

Open the app in a browser. In the console, run:
```js
SQT.AssistantContext.build()
```

Expected: Returns an object with `mode`, `systemPrompt`, and `dataContext` properties. If no active season, `dataContext` will say "No active season."

- [ ] **Step 3: Commit**

```bash
git add js/assistant-context.js
git commit -m "feat: add assistant data context builder module"
```

---

## Task 3: API Client Module (`assistant-api.js`)

Handles Anthropic Messages API calls with streaming. No DOM manipulation — returns data via callbacks.

**Files:**
- Create: `js/assistant-api.js`

- [ ] **Step 1: Create the API module**

Create `js/assistant-api.js` with the following content:

```js
/**
 * Anthropic Messages API client for the AI assistant.
 * Handles streaming responses via fetch + ReadableStream.
 */
var SQT = window.SQT || {};

SQT.AssistantAPI = {
    API_URL: 'https://api.anthropic.com/v1/messages',
    MODEL: 'claude-3-5-haiku-latest',
    MAX_TOKENS: 4096,
    TIMEOUT_MS: 30000,
    API_KEY_STORAGE: 'sqt_api_key',

    // ---- API Key Management ----
    getApiKey: function() {
        try {
            return localStorage.getItem(this.API_KEY_STORAGE) || '';
        } catch (e) {
            return '';
        }
    },

    setApiKey: function(key) {
        try {
            localStorage.setItem(this.API_KEY_STORAGE, key);
        } catch (e) {
            console.error('Failed to save API key:', e);
        }
    },

    removeApiKey: function() {
        try {
            localStorage.removeItem(this.API_KEY_STORAGE);
        } catch (e) {
            console.error('Failed to remove API key:', e);
        }
    },

    hasApiKey: function() {
        return this.getApiKey().length > 0;
    },

    /**
     * Verify an API key works by sending a minimal request.
     * Returns a promise that resolves to { valid: true } or { valid: false, error: string }.
     */
    verifyKey: function(key) {
        var self = this;
        return fetch(self.API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': key,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: self.MODEL,
                max_tokens: 10,
                messages: [{ role: 'user', content: 'Hi' }]
            })
        }).then(function(response) {
            if (response.ok) {
                return { valid: true };
            }
            if (response.status === 401) {
                return { valid: false, error: 'Invalid API key' };
            }
            return { valid: false, error: 'API error (' + response.status + ')' };
        }).catch(function() {
            return { valid: false, error: 'Network error — check your connection' };
        });
    },

    /**
     * Send a message to Claude and stream the response.
     *
     * @param {Object} opts
     * @param {string} opts.systemPrompt - System prompt text
     * @param {Array}  opts.messages     - Array of { role, content } message objects
     * @param {Function} opts.onToken    - Called with each text chunk as it arrives
     * @param {Function} opts.onDone     - Called with the full response text when complete
     * @param {Function} opts.onError    - Called with { type, message } on error
     *
     * @returns {Object} { abort: Function } — call abort() to cancel the request
     */
    sendMessage: function(opts) {
        var self = this;
        var apiKey = this.getApiKey();
        var aborted = false;
        var controller = new AbortController();

        if (!apiKey) {
            setTimeout(function() {
                opts.onError({ type: 'no-key', message: 'No API key set' });
            }, 0);
            return { abort: function() {} };
        }

        var timeoutId = setTimeout(function() {
            aborted = true;
            controller.abort();
            opts.onError({ type: 'timeout', message: 'Request timed out' });
        }, self.TIMEOUT_MS);

        var fullText = '';

        fetch(self.API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: self.MODEL,
                max_tokens: self.MAX_TOKENS,
                system: opts.systemPrompt,
                messages: opts.messages,
                stream: true
            }),
            signal: controller.signal
        }).then(function(response) {
            clearTimeout(timeoutId);

            if (!response.ok) {
                return response.text().then(function(body) {
                    var errorType = 'server-error';
                    var errorMsg = 'Something went wrong';

                    if (response.status === 401) {
                        errorType = 'invalid-key';
                        errorMsg = 'API key is invalid or expired';
                    } else if (response.status === 429) {
                        errorType = 'rate-limited';
                        errorMsg = 'Too many requests — try again in a moment';
                    } else if (response.status === 529 || response.status === 503) {
                        errorType = 'overloaded';
                        errorMsg = 'API is temporarily overloaded';
                    }

                    opts.onError({ type: errorType, message: errorMsg });
                });
            }

            var reader = response.body.getReader();
            var decoder = new TextDecoder();
            var buffer = '';

            function processStream() {
                return reader.read().then(function(result) {
                    if (result.done || aborted) {
                        if (!aborted) {
                            opts.onDone(fullText);
                        }
                        return;
                    }

                    buffer += decoder.decode(result.value, { stream: true });
                    var lines = buffer.split('\n');
                    buffer = lines.pop(); // Keep incomplete line in buffer

                    for (var i = 0; i < lines.length; i++) {
                        var line = lines[i].trim();
                        if (line.indexOf('data: ') !== 0) continue;
                        var jsonStr = line.substring(6);
                        if (jsonStr === '[DONE]') continue;

                        try {
                            var event = JSON.parse(jsonStr);
                            if (event.type === 'content_block_delta' &&
                                event.delta && event.delta.type === 'text_delta') {
                                var text = event.delta.text;
                                fullText += text;
                                opts.onToken(text);
                            }
                        } catch (e) {
                            // Skip unparseable lines
                        }
                    }

                    return processStream();
                });
            }

            return processStream();
        }).catch(function(err) {
            clearTimeout(timeoutId);
            if (aborted) return;

            if (err.name === 'AbortError') {
                opts.onError({ type: 'timeout', message: 'Request timed out' });
            } else {
                opts.onError({ type: 'network', message: 'No internet connection' });
            }
        });

        return {
            abort: function() {
                aborted = true;
                clearTimeout(timeoutId);
                controller.abort();
            }
        };
    }
};

window.SQT = SQT;
```

- [ ] **Step 2: Verify the module loads**

Open the app in a browser. In the console, run:
```js
typeof SQT.AssistantAPI.sendMessage === 'function'
```

Expected: `true`

- [ ] **Step 3: Commit**

```bash
git add js/assistant-api.js
git commit -m "feat: add Anthropic API client with streaming support"
```

---

## Task 4: Assistant CSS (`css/assistant.css`)

All styles for the FAB button, chat panel, messages, settings view, and chart overlay.

**Files:**
- Create: `css/assistant.css`

- [ ] **Step 1: Create the assistant stylesheet**

Create `css/assistant.css` with the following content:

```css
/* ===== AI ASSISTANT ===== */

/* --- FAB Button --- */
.assistant-fab {
    position: fixed;
    bottom: 16px;
    right: 16px;
    width: 52px;
    height: 52px;
    background: var(--accent);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(196, 18, 48, 0.4);
    z-index: 40;
    font-size: 24px;
    line-height: 1;
    transition: transform 0.15s ease, opacity 0.15s ease;
    touch-action: manipulation;
}

.assistant-fab:active {
    transform: scale(0.92);
}

.assistant-fab.hidden {
    display: none;
}

/* --- Backdrop --- */
.assistant-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 45;
    opacity: 0;
    transition: opacity 0.2s ease;
    pointer-events: none;
}

.assistant-backdrop.visible {
    opacity: 1;
    pointer-events: auto;
}

/* --- Chat Panel --- */
.assistant-panel {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 70vh;
    max-height: 600px;
    background: var(--bg-secondary);
    border-top-left-radius: 16px;
    border-top-right-radius: 16px;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.5);
    z-index: 50;
    display: flex;
    flex-direction: column;
    transform: translateY(100%);
    transition: transform 0.25s ease;
}

.assistant-panel.open {
    transform: translateY(0);
}

/* --- Panel Header --- */
.assistant-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
}

.assistant-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
}

.assistant-header-icon {
    font-size: 16px;
    line-height: 1;
}

.assistant-header-title {
    font-weight: 600;
    font-size: 14px;
}

.assistant-header-right {
    display: flex;
    align-items: center;
    gap: 12px;
}

.assistant-context-badge {
    font-size: 11px;
    color: var(--text-muted);
    background: var(--bg-card);
    padding: 3px 8px;
    border-radius: 10px;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.assistant-header-btn {
    background: none;
    color: var(--text-secondary);
    font-size: 16px;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.assistant-close-btn {
    font-size: 20px;
}

/* --- Messages Area --- */
.assistant-messages {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    -webkit-overflow-scrolling: touch;
}

.assistant-msg {
    max-width: 85%;
    padding: 10px 14px;
    border-radius: 12px;
    font-size: 13px;
    line-height: 1.5;
    word-wrap: break-word;
}

.assistant-msg-user {
    align-self: flex-end;
    max-width: 75%;
    background: var(--accent);
    color: #fff;
    border-bottom-right-radius: 2px;
}

.assistant-msg-ai {
    align-self: flex-start;
    background: var(--bg-card);
    color: var(--text-primary);
    border-bottom-left-radius: 2px;
}

.assistant-msg-ai strong {
    color: #fff;
}

/* Markdown-like bold in responses */
.assistant-msg-ai b {
    color: #fff;
    font-weight: 600;
}

/* --- Typing Indicator --- */
.assistant-typing {
    align-self: flex-start;
    padding: 10px 14px;
    background: var(--bg-card);
    border-radius: 12px;
    border-bottom-left-radius: 2px;
    display: none;
}

.assistant-typing.visible {
    display: flex;
    gap: 4px;
    align-items: center;
}

.assistant-typing-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--text-muted);
    animation: assistantBounce 1.2s infinite;
}

.assistant-typing-dot:nth-child(2) { animation-delay: 0.2s; }
.assistant-typing-dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes assistantBounce {
    0%, 60%, 100% { transform: translateY(0); }
    30% { transform: translateY(-4px); }
}

/* --- Input Bar --- */
.assistant-input-bar {
    padding: 10px 12px;
    border-top: 1px solid var(--border);
    display: flex;
    gap: 8px;
    flex-shrink: 0;
}

.assistant-input-bar input {
    flex: 1;
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 8px 14px;
    color: var(--text-primary);
    font-size: 13px;
}

.assistant-input-bar input::placeholder {
    color: var(--text-muted);
}

.assistant-send-btn {
    width: 36px;
    height: 36px;
    background: var(--accent);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 16px;
    flex-shrink: 0;
}

.assistant-send-btn:disabled {
    background: var(--bg-card);
    color: var(--text-muted);
}

/* --- Inline Charts --- */
.assistant-chart-wrap {
    margin: 8px 0 4px;
    background: var(--bg-secondary);
    border-radius: 8px;
    padding: 8px;
}

.assistant-chart-wrap canvas {
    width: 100% !important;
    max-height: 180px;
}

.assistant-chart-expand {
    display: block;
    font-size: 11px;
    color: var(--text-muted);
    text-decoration: underline;
    margin-top: 4px;
    cursor: pointer;
    background: none;
    text-align: left;
    padding: 0;
}

/* --- Full-Screen Chart Overlay --- */
.assistant-chart-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    z-index: 60;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
}

.assistant-chart-overlay canvas {
    width: 100% !important;
    max-width: 500px;
    max-height: 60vh;
}

.assistant-chart-overlay-close {
    position: absolute;
    top: 16px;
    right: 16px;
    background: none;
    color: #fff;
    font-size: 28px;
    padding: 8px;
}

.assistant-chart-overlay-title {
    color: #fff;
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 16px;
}

/* --- Error States --- */
.assistant-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 40px 20px;
    flex: 1;
}

.assistant-error-icon {
    font-size: 36px;
    margin-bottom: 12px;
}

.assistant-error-title {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 6px;
}

.assistant-error-text {
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 16px;
    line-height: 1.5;
}

.assistant-error-btn {
    background: var(--accent);
    color: #fff;
    padding: 8px 24px;
    border-radius: 20px;
    font-size: 13px;
}

.assistant-error-btn.secondary {
    background: var(--bg-card);
    color: var(--text-secondary);
}

/* --- Settings View --- */
.assistant-settings {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: none;
}

.assistant-settings.visible {
    display: block;
}

.assistant-settings-label {
    display: block;
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.assistant-settings-key-row {
    display: flex;
    gap: 8px;
    margin-bottom: 6px;
}

.assistant-settings-key-row input {
    flex: 1;
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 14px;
    color: var(--text-primary);
    font-size: 13px;
    font-family: monospace;
}

.assistant-settings-toggle-vis {
    width: 40px;
    height: 40px;
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    flex-shrink: 0;
}

.assistant-settings-status {
    font-size: 11px;
    margin-bottom: 16px;
}

.assistant-settings-status.valid {
    color: var(--green);
}

.assistant-settings-status.invalid {
    color: var(--red);
}

.assistant-settings-status.checking {
    color: var(--text-muted);
}

.assistant-settings-help {
    background: var(--bg-card);
    border-radius: 8px;
    padding: 12px 14px;
    margin-bottom: 16px;
}

.assistant-settings-help-title {
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 6px;
}

.assistant-settings-help ol {
    margin: 0;
    padding-left: 18px;
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.8;
}

.assistant-settings-privacy {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--border);
}

.assistant-settings-info {
    display: flex;
    gap: 10px;
    margin-top: 16px;
}

.assistant-settings-info-card {
    flex: 1;
    background: var(--bg-card);
    border-radius: 8px;
    padding: 10px 12px;
    text-align: center;
}

.assistant-settings-info-label {
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    margin-bottom: 4px;
}

.assistant-settings-info-value {
    font-size: 13px;
    font-weight: 600;
}

.assistant-remove-key-btn {
    width: 100%;
    margin-top: 20px;
    padding: 10px;
    background: transparent;
    border: 1px solid rgba(239, 68, 68, 0.5);
    color: var(--red);
    border-radius: 8px;
    font-size: 13px;
}
```

- [ ] **Step 2: Verify styles load**

Open the app. Inspect the page — confirm `css/assistant.css` is loaded in the `<head>` (no 404). No visual changes to the app since no assistant DOM elements exist yet.

- [ ] **Step 3: Commit**

```bash
git add css/assistant.css
git commit -m "feat: add assistant CSS styles"
```

---

## Task 5: Assistant UI Module (`assistant.js`) — Part 1: FAB, Panel Shell, Settings

The main UI module. This task builds the FAB button, panel structure, and settings view. Chat functionality is added in the next task.

**Files:**
- Create: `js/assistant.js`

- [ ] **Step 1: Create the assistant UI module with FAB and panel shell**

Create `js/assistant.js` with the following content:

```js
/**
 * AI Assistant UI — FAB button, chat panel, settings, message rendering, charts.
 */
var SQT = window.SQT || {};

SQT.Assistant = {
    _isOpen: false,
    _isSettingsView: false,
    _messages: [],       // { role: 'user'|'assistant', content: string }
    _currentRequest: null, // { abort: Function } for in-flight API call
    _streamingEl: null,    // The message element currently being streamed into

    // ---- Initialization ----
    init: function() {
        this._createDOM();
        this._bindEvents();
    },

    _createDOM: function() {
        // FAB button
        var fab = document.createElement('button');
        fab.className = 'assistant-fab';
        fab.id = 'assistant-fab';
        fab.setAttribute('aria-label', 'Open AI Assistant');
        fab.textContent = '\uD83C\uDFC0'; // 🏀
        document.body.appendChild(fab);

        // Backdrop
        var backdrop = document.createElement('div');
        backdrop.className = 'assistant-backdrop';
        backdrop.id = 'assistant-backdrop';
        document.body.appendChild(backdrop);

        // Panel
        var panel = document.createElement('div');
        panel.className = 'assistant-panel';
        panel.id = 'assistant-panel';
        panel.innerHTML =
            '<div class="assistant-header">' +
                '<div class="assistant-header-left">' +
                    '<span class="assistant-header-icon">\uD83C\uDFC0</span>' +
                    '<span class="assistant-header-title">Game Assistant</span>' +
                '</div>' +
                '<div class="assistant-header-right">' +
                    '<span class="assistant-context-badge" id="assistant-context-badge"></span>' +
                    '<button class="assistant-header-btn" id="assistant-settings-btn" style="display:none;" aria-label="Settings">\u2699\uFE0F</button>' +
                    '<button class="assistant-header-btn assistant-close-btn" id="assistant-close-btn" aria-label="Close">\u2715</button>' +
                '</div>' +
            '</div>' +
            // Chat view
            '<div class="assistant-messages" id="assistant-messages"></div>' +
            '<div class="assistant-typing" id="assistant-typing">' +
                '<div class="assistant-typing-dot"></div>' +
                '<div class="assistant-typing-dot"></div>' +
                '<div class="assistant-typing-dot"></div>' +
            '</div>' +
            '<div class="assistant-input-bar" id="assistant-input-bar">' +
                '<input type="text" id="assistant-input" placeholder="Ask about the game..." autocomplete="off">' +
                '<button class="assistant-send-btn" id="assistant-send-btn" aria-label="Send">\u2191</button>' +
            '</div>' +
            // Settings view (hidden by default)
            '<div class="assistant-settings" id="assistant-settings">' +
                '<label class="assistant-settings-label">Anthropic API Key</label>' +
                '<div class="assistant-settings-key-row">' +
                    '<input type="password" id="assistant-key-input" placeholder="sk-ant-..." autocomplete="off">' +
                    '<button class="assistant-settings-toggle-vis" id="assistant-toggle-vis">\uD83D\uDC41</button>' +
                '</div>' +
                '<div class="assistant-settings-status" id="assistant-key-status"></div>' +
                '<div class="assistant-settings-help">' +
                    '<div class="assistant-settings-help-title">How to get an API key:</div>' +
                    '<ol>' +
                        '<li>Go to console.anthropic.com</li>' +
                        '<li>Create a free account</li>' +
                        '<li>Go to API Keys \u2192 Create Key</li>' +
                        '<li>Copy and paste the key above</li>' +
                    '</ol>' +
                    '<div class="assistant-settings-privacy">Your key is stored locally on this device only. It is never sent anywhere except directly to Anthropic\'s API.</div>' +
                '</div>' +
                '<div class="assistant-settings-info">' +
                    '<div class="assistant-settings-info-card">' +
                        '<div class="assistant-settings-info-label">Model</div>' +
                        '<div class="assistant-settings-info-value">Haiku</div>' +
                    '</div>' +
                    '<div class="assistant-settings-info-card">' +
                        '<div class="assistant-settings-info-label">Status</div>' +
                        '<div class="assistant-settings-info-value" id="assistant-status-value">--</div>' +
                    '</div>' +
                '</div>' +
                '<button class="assistant-remove-key-btn" id="assistant-remove-key-btn">Remove API Key</button>' +
            '</div>' +
            // No-key error view
            '<div class="assistant-error" id="assistant-no-key" style="display:none;">' +
                '<div class="assistant-error-icon">\uD83D\uDD11</div>' +
                '<div class="assistant-error-title">API Key Required</div>' +
                '<div class="assistant-error-text">Add your Anthropic API key to<br>enable the AI assistant.</div>' +
                '<button class="assistant-error-btn" id="assistant-setup-key-btn">Set Up API Key</button>' +
                '<div class="assistant-settings-help" style="margin-top:16px;text-align:left;">' +
                    '<div class="assistant-settings-help-title">Quick setup:</div>' +
                    '<ol>' +
                        '<li>Go to console.anthropic.com</li>' +
                        '<li>Create account \u2192 API Keys</li>' +
                        '<li>Create key \u2192 paste here</li>' +
                    '</ol>' +
                '</div>' +
            '</div>';
        document.body.appendChild(panel);
    },

    _bindEvents: function() {
        var self = this;

        // FAB
        document.getElementById('assistant-fab').addEventListener('click', function() {
            self.open();
        });

        // Close
        document.getElementById('assistant-close-btn').addEventListener('click', function() {
            self.close();
        });
        document.getElementById('assistant-backdrop').addEventListener('click', function() {
            self.close();
        });

        // Settings toggle
        document.getElementById('assistant-settings-btn').addEventListener('click', function() {
            self._toggleSettings();
        });

        // Send message
        document.getElementById('assistant-send-btn').addEventListener('click', function() {
            self._sendMessage();
        });
        document.getElementById('assistant-input').addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                self._sendMessage();
            }
        });

        // Setup key button (from no-key view)
        document.getElementById('assistant-setup-key-btn').addEventListener('click', function() {
            self._showSettings();
        });

        // Toggle password visibility
        document.getElementById('assistant-toggle-vis').addEventListener('click', function() {
            var input = document.getElementById('assistant-key-input');
            if (input.type === 'password') {
                input.type = 'text';
            } else {
                input.type = 'password';
            }
        });

        // Key input — verify on blur
        document.getElementById('assistant-key-input').addEventListener('blur', function() {
            var key = this.value.trim();
            if (key) {
                self._verifyAndSaveKey(key);
            }
        });

        // Remove key
        document.getElementById('assistant-remove-key-btn').addEventListener('click', function() {
            if (confirm('Remove your API key? The assistant will stop working until you add a new one.')) {
                SQT.AssistantAPI.removeApiKey();
                document.getElementById('assistant-key-input').value = '';
                document.getElementById('assistant-key-status').textContent = '';
                document.getElementById('assistant-status-value').textContent = '--';
                self._showSettings();
                SQT.App.toast('API key removed');
            }
        });
    },

    // ---- Open / Close ----
    open: function() {
        this._isOpen = true;
        document.getElementById('assistant-panel').classList.add('open');
        document.getElementById('assistant-backdrop').classList.add('visible');
        document.getElementById('assistant-fab').classList.add('hidden');

        // Update context badge
        this._updateContextBadge();

        // Check for API key
        if (!SQT.AssistantAPI.hasApiKey()) {
            this._showNoKeyView();
        } else {
            this._showChatView();
        }
    },

    close: function() {
        this._isOpen = false;
        document.getElementById('assistant-panel').classList.remove('open');
        document.getElementById('assistant-backdrop').classList.remove('visible');
        document.getElementById('assistant-fab').classList.remove('hidden');

        // Cancel any in-flight request
        if (this._currentRequest) {
            this._currentRequest.abort();
            this._currentRequest = null;
        }

        // Reset to chat view if in settings
        this._isSettingsView = false;
    },

    // ---- View Management ----
    _showNoKeyView: function() {
        document.getElementById('assistant-messages').style.display = 'none';
        document.getElementById('assistant-typing').style.display = 'none';
        document.getElementById('assistant-input-bar').style.display = 'none';
        document.getElementById('assistant-settings').style.display = 'none';
        document.getElementById('assistant-no-key').style.display = 'flex';
        document.getElementById('assistant-settings-btn').style.display = 'none';
    },

    _showChatView: function() {
        document.getElementById('assistant-messages').style.display = 'flex';
        document.getElementById('assistant-typing').style.display = 'none';
        document.getElementById('assistant-input-bar').style.display = 'flex';
        document.getElementById('assistant-settings').style.display = 'none';
        document.getElementById('assistant-no-key').style.display = 'none';
        document.getElementById('assistant-settings-btn').style.display = 'flex';
        this._isSettingsView = false;

        // Focus input
        var input = document.getElementById('assistant-input');
        setTimeout(function() { input.focus(); }, 300);
    },

    _showSettings: function() {
        document.getElementById('assistant-messages').style.display = 'none';
        document.getElementById('assistant-typing').style.display = 'none';
        document.getElementById('assistant-input-bar').style.display = 'none';
        document.getElementById('assistant-no-key').style.display = 'none';
        document.getElementById('assistant-settings').style.display = 'block';
        document.getElementById('assistant-settings-btn').style.display = 'flex';
        this._isSettingsView = true;

        // Populate current key
        var key = SQT.AssistantAPI.getApiKey();
        document.getElementById('assistant-key-input').value = key;
        if (key) {
            document.getElementById('assistant-key-status').textContent = '\u2713 Key saved';
            document.getElementById('assistant-key-status').className = 'assistant-settings-status valid';
            document.getElementById('assistant-status-value').textContent = 'Active';
            document.getElementById('assistant-status-value').style.color = 'var(--green)';
        } else {
            document.getElementById('assistant-key-status').textContent = '';
            document.getElementById('assistant-status-value').textContent = '--';
            document.getElementById('assistant-status-value').style.color = '';
        }
    },

    _toggleSettings: function() {
        if (this._isSettingsView) {
            if (SQT.AssistantAPI.hasApiKey()) {
                this._showChatView();
            } else {
                this._showNoKeyView();
            }
        } else {
            this._showSettings();
        }
    },

    _verifyAndSaveKey: function(key) {
        var statusEl = document.getElementById('assistant-key-status');
        var statusVal = document.getElementById('assistant-status-value');
        statusEl.textContent = 'Verifying...';
        statusEl.className = 'assistant-settings-status checking';

        SQT.AssistantAPI.verifyKey(key).then(function(result) {
            if (result.valid) {
                SQT.AssistantAPI.setApiKey(key);
                statusEl.textContent = '\u2713 Key verified \u2014 connected to Anthropic';
                statusEl.className = 'assistant-settings-status valid';
                statusVal.textContent = 'Active';
                statusVal.style.color = 'var(--green)';
            } else {
                statusEl.textContent = '\u2717 ' + result.error;
                statusEl.className = 'assistant-settings-status invalid';
                statusVal.textContent = 'Error';
                statusVal.style.color = 'var(--red)';
            }
        });
    },

    _updateContextBadge: function() {
        var badge = document.getElementById('assistant-context-badge');
        var activeGame = SQT.Storage.getActiveGame();
        if (activeGame && !activeGame.result) {
            var prefix = activeGame.location === 'Away' ? '@ ' : 'vs ';
            var quarter = this._getCurrentQuarter(activeGame);
            badge.textContent = prefix + activeGame.opponent + ' \u00B7 ' + quarter;
            document.getElementById('assistant-input').placeholder = 'Ask about the game...';
        } else {
            badge.textContent = 'Season';
            document.getElementById('assistant-input').placeholder = 'Ask about the season...';
        }
    },

    _getCurrentQuarter: function(game) {
        var poss = game.possessions || [];
        if (poss.length === 0) return 'Q1';
        return poss[poss.length - 1].quarter || 'Q1';
    },

    // ---- Messaging ----
    _sendMessage: function() {
        var input = document.getElementById('assistant-input');
        var text = input.value.trim();
        if (!text) return;
        if (this._currentRequest) return; // Already streaming

        input.value = '';

        // Add user message to UI
        this._addMessage('user', text);

        // Build context
        var context = SQT.AssistantContext.build();

        // Build messages array — include conversation history
        var apiMessages = [];
        // Add data context as first user message
        apiMessages.push({ role: 'user', content: 'Here is the current data:\n\n' + context.dataContext });
        apiMessages.push({ role: 'assistant', content: 'I have the data loaded. What would you like to know?' });

        // Add conversation history
        for (var i = 0; i < this._messages.length; i++) {
            apiMessages.push({
                role: this._messages[i].role,
                content: this._messages[i].content
            });
        }

        // Show typing indicator
        document.getElementById('assistant-typing').classList.add('visible');

        // Create streaming message element
        var aiMsgEl = this._createMessageEl('assistant', '');
        document.getElementById('assistant-messages').appendChild(aiMsgEl);
        this._streamingEl = aiMsgEl;
        var streamedText = '';

        var self = this;

        this._currentRequest = SQT.AssistantAPI.sendMessage({
            systemPrompt: context.systemPrompt,
            messages: apiMessages,
            onToken: function(token) {
                document.getElementById('assistant-typing').classList.remove('visible');
                streamedText += token;
                self._updateStreamingMessage(aiMsgEl, streamedText);
            },
            onDone: function(fullText) {
                self._currentRequest = null;
                self._streamingEl = null;
                document.getElementById('assistant-typing').classList.remove('visible');

                // Store in message history
                self._messages.push({ role: 'assistant', content: fullText });

                // Final render with chart parsing
                self._renderFinalMessage(aiMsgEl, fullText);
                self._scrollToBottom();
            },
            onError: function(err) {
                self._currentRequest = null;
                self._streamingEl = null;
                document.getElementById('assistant-typing').classList.remove('visible');

                // Remove the empty streaming element
                if (aiMsgEl.parentNode) {
                    aiMsgEl.parentNode.removeChild(aiMsgEl);
                }

                // Show error inline
                self._addErrorMessage(err);
                self._scrollToBottom();
            }
        });

        this._scrollToBottom();
    },

    _addMessage: function(role, content) {
        if (role === 'user') {
            this._messages.push({ role: 'user', content: content });
        }
        var el = this._createMessageEl(role, content);
        document.getElementById('assistant-messages').appendChild(el);
        this._scrollToBottom();
    },

    _createMessageEl: function(role, content) {
        var div = document.createElement('div');
        div.className = 'assistant-msg ' + (role === 'user' ? 'assistant-msg-user' : 'assistant-msg-ai');
        if (role === 'user') {
            div.textContent = content;
        }
        return div;
    },

    _updateStreamingMessage: function(el, text) {
        // Simple markdown: bold
        el.innerHTML = this._renderMarkdown(text);
        this._scrollToBottom();
    },

    _renderFinalMessage: function(el, fullText) {
        // Parse out chart blocks
        var parts = this._parseCharts(fullText);
        var html = '';
        for (var i = 0; i < parts.length; i++) {
            var part = parts[i];
            if (part.type === 'text') {
                html += this._renderMarkdown(part.content);
            } else if (part.type === 'chart') {
                html += '<div class="assistant-chart-wrap" data-chart=\'' +
                    JSON.stringify(part.config).replace(/'/g, '&#39;') +
                    '\'><canvas></canvas>' +
                    '<button class="assistant-chart-expand">Tap chart to expand \u2197</button>' +
                    '</div>';
            }
        }
        el.innerHTML = html;

        // Render charts
        var chartWraps = el.querySelectorAll('.assistant-chart-wrap');
        for (var c = 0; c < chartWraps.length; c++) {
            this._renderChart(chartWraps[c]);
        }
    },

    _renderMarkdown: function(text) {
        // Escape HTML
        var safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        // Bold: **text**
        safe = safe.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
        // Newlines
        safe = safe.replace(/\n/g, '<br>');
        return safe;
    },

    _parseCharts: function(text) {
        var parts = [];
        var regex = /```chart\s*\n([\s\S]*?)```/g;
        var lastIndex = 0;
        var match;

        while ((match = regex.exec(text)) !== null) {
            // Text before chart
            if (match.index > lastIndex) {
                parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
            }
            // Parse chart JSON
            try {
                var config = JSON.parse(match[1].trim());
                parts.push({ type: 'chart', config: config });
            } catch (e) {
                // If JSON is invalid, treat as text
                parts.push({ type: 'text', content: match[0] });
            }
            lastIndex = match.index + match[0].length;
        }

        // Remaining text
        if (lastIndex < text.length) {
            parts.push({ type: 'text', content: text.substring(lastIndex) });
        }

        if (parts.length === 0) {
            parts.push({ type: 'text', content: text });
        }

        return parts;
    },

    // ---- Chart Rendering ----
    _renderChart: function(wrapEl) {
        if (typeof Chart === 'undefined') return; // Chart.js not loaded

        var configStr = wrapEl.getAttribute('data-chart');
        if (!configStr) return;

        try {
            var spec = JSON.parse(configStr);
        } catch (e) {
            return;
        }

        var canvas = wrapEl.querySelector('canvas');
        var ctx = canvas.getContext('2d');

        var chartType = spec.type === 'horizontalBar' ? 'bar' : spec.type;
        var isHorizontal = spec.type === 'horizontalBar';

        var datasets = [];
        for (var i = 0; i < (spec.datasets || []).length; i++) {
            var ds = spec.datasets[i];
            datasets.push({
                label: ds.label || '',
                data: ds.data || [],
                backgroundColor: ds.colors || '#c41230',
                borderColor: ds.colors || '#c41230',
                borderWidth: chartType === 'line' ? 2 : 0,
                fill: chartType === 'line' ? 'origin' : undefined,
                tension: 0.3,
                pointRadius: chartType === 'line' ? 3 : 0
            });
        }

        var chartConfig = {
            type: chartType,
            data: {
                labels: spec.labels || [],
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                indexAxis: isHorizontal ? 'y' : 'x',
                animation: { duration: 400 },
                plugins: {
                    title: {
                        display: !!spec.title,
                        text: spec.title || '',
                        color: '#a0a0aa',
                        font: { size: 12 }
                    },
                    legend: { display: false }
                },
                scales: chartType !== 'doughnut' ? {
                    x: {
                        ticks: { color: '#6a6a74', font: { size: 10 } },
                        grid: { color: '#2e2e36' }
                    },
                    y: {
                        ticks: { color: '#6a6a74', font: { size: 10 } },
                        grid: { color: '#2e2e36' }
                    }
                } : undefined
            }
        };

        var chart = new Chart(ctx, chartConfig);

        // Bind expand button
        var expandBtn = wrapEl.querySelector('.assistant-chart-expand');
        if (expandBtn) {
            var self = this;
            expandBtn.addEventListener('click', function() {
                self._showChartOverlay(spec);
            });
        }
    },

    _showChartOverlay: function(spec) {
        // Remove existing overlay
        var existing = document.querySelector('.assistant-chart-overlay');
        if (existing) existing.parentNode.removeChild(existing);

        var overlay = document.createElement('div');
        overlay.className = 'assistant-chart-overlay';
        overlay.innerHTML =
            '<button class="assistant-chart-overlay-close">\u2715</button>' +
            '<div class="assistant-chart-overlay-title">' + (spec.title || 'Chart') + '</div>' +
            '<canvas></canvas>';
        document.body.appendChild(overlay);

        // Close handlers
        overlay.querySelector('.assistant-chart-overlay-close').addEventListener('click', function() {
            overlay.parentNode.removeChild(overlay);
        });
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) overlay.parentNode.removeChild(overlay);
        });

        // Render chart at full size
        var canvas = overlay.querySelector('canvas');
        var ctx = canvas.getContext('2d');

        var chartType = spec.type === 'horizontalBar' ? 'bar' : spec.type;
        var isHorizontal = spec.type === 'horizontalBar';

        var datasets = [];
        for (var i = 0; i < (spec.datasets || []).length; i++) {
            var ds = spec.datasets[i];
            datasets.push({
                label: ds.label || '',
                data: ds.data || [],
                backgroundColor: ds.colors || '#c41230',
                borderColor: ds.colors || '#c41230',
                borderWidth: chartType === 'line' ? 2 : 0,
                fill: chartType === 'line' ? 'origin' : undefined,
                tension: 0.3,
                pointRadius: chartType === 'line' ? 4 : 0
            });
        }

        new Chart(ctx, {
            type: chartType,
            data: {
                labels: spec.labels || [],
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                indexAxis: isHorizontal ? 'y' : 'x',
                animation: false,
                plugins: {
                    title: { display: false },
                    legend: { display: false }
                },
                scales: chartType !== 'doughnut' ? {
                    x: {
                        ticks: { color: '#a0a0aa', font: { size: 12 } },
                        grid: { color: '#2e2e36' }
                    },
                    y: {
                        ticks: { color: '#a0a0aa', font: { size: 12 } },
                        grid: { color: '#2e2e36' }
                    }
                } : undefined
            }
        });
    },

    _addErrorMessage: function(err) {
        var msg = '';
        var btnText = '';
        var action = null;
        var self = this;

        if (err.type === 'no-key') {
            msg = '\uD83D\uDD11 No API key set. Add one in Settings.';
            btnText = 'Open Settings';
            action = function() { self._showSettings(); };
        } else if (err.type === 'invalid-key') {
            msg = '\u26A0\uFE0F ' + err.message + '. Check your key in Settings.';
            btnText = 'Update Key';
            action = function() { self._showSettings(); };
        } else if (err.type === 'network') {
            msg = '\uD83D\uDCE1 ' + err.message + '. Game tracking continues to work offline.';
            btnText = 'Retry';
        } else if (err.type === 'rate-limited') {
            msg = '\u23F3 ' + err.message;
            btnText = 'Retry';
        } else if (err.type === 'timeout') {
            msg = '\u23F1\uFE0F ' + err.message;
            btnText = 'Retry';
        } else {
            msg = '\u26A0\uFE0F ' + (err.message || 'Something went wrong');
            btnText = 'Retry';
        }

        var div = document.createElement('div');
        div.className = 'assistant-msg assistant-msg-ai';
        div.style.color = 'var(--text-secondary)';
        div.style.fontSize = '12px';
        div.innerHTML = msg;

        if (btnText) {
            var btn = document.createElement('button');
            btn.style.cssText = 'display:block;margin-top:8px;background:var(--bg-input);color:var(--text-primary);border:1px solid var(--border);border-radius:12px;padding:4px 12px;font-size:12px;cursor:pointer;';
            btn.textContent = btnText;
            if (action) {
                btn.addEventListener('click', action);
            } else {
                btn.addEventListener('click', function() {
                    // Retry: re-send the last user message
                    if (self._messages.length > 0) {
                        var lastUserMsg = null;
                        for (var i = self._messages.length - 1; i >= 0; i--) {
                            if (self._messages[i].role === 'user') {
                                lastUserMsg = self._messages[i].content;
                                break;
                            }
                        }
                        if (lastUserMsg) {
                            // Remove the last user message from history (it will be re-added)
                            self._messages.pop();
                            // Remove the error message element
                            if (div.parentNode) div.parentNode.removeChild(div);
                            document.getElementById('assistant-input').value = lastUserMsg;
                            self._sendMessage();
                        }
                    }
                });
            }
            div.appendChild(btn);
        }

        document.getElementById('assistant-messages').appendChild(div);
    },

    _scrollToBottom: function() {
        var container = document.getElementById('assistant-messages');
        container.scrollTop = container.scrollHeight;
    }
};

// Initialize after DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Delay init slightly so existing modules initialize first
    setTimeout(function() {
        if (SQT.Assistant) SQT.Assistant.init();
    }, 100);
});

window.SQT = SQT;
```

- [ ] **Step 2: Test the FAB button and panel**

Open the app in a browser. Verify:
1. The 🏀 FAB button appears in the bottom-right corner
2. Tapping FAB opens the panel (slides up) and hides the FAB
3. Tapping ✕ or the backdrop closes the panel and shows the FAB
4. Since no API key is set, the "API Key Required" view shows
5. Tapping "Set Up API Key" shows the settings view
6. Entering a test key and blurring the field triggers verification

- [ ] **Step 3: Test with a real API key**

In the settings view, paste a real Anthropic API key. Verify:
1. Status shows "Verifying..." then "✓ Key verified — connected to Anthropic"
2. The "Status" card shows "Active" in green
3. Closing and reopening the panel shows the chat view with input bar
4. The ⚙️ gear icon is now visible in the header
5. The context badge shows "Season" (or game info if a live game is active)

- [ ] **Step 4: Test sending a message**

With a valid API key, type a question and send it. Verify:
1. User message appears right-aligned in crimson
2. Typing indicator shows briefly
3. Response streams in token by token
4. Response has markdown bold rendered properly
5. Scrolls to bottom as new content arrives

- [ ] **Step 5: Commit**

```bash
git add js/assistant.js
git commit -m "feat: add assistant UI with FAB, chat panel, settings, and streaming"
```

---

## Task 6: Integration Testing and Polish

Final pass — test all flows end-to-end and fix any issues.

**Files:**
- May modify: `js/assistant.js`, `js/assistant-api.js`, `js/assistant-context.js`, `css/assistant.css`

- [ ] **Step 1: Test live game context**

Start a new game (or resume an existing one). Open the assistant. Verify:
1. Context badge shows "vs [Opponent] · Q1" (or current quarter)
2. Input placeholder says "Ask about the game..."
3. Ask "Who's hot right now?" — assistant should reference player data from the current game
4. Ask "What play is working best?" — assistant should analyze play effectiveness

- [ ] **Step 2: Test season context**

Go to the home screen (no active game). Open the assistant. Verify:
1. Context badge shows "Season"
2. Input placeholder says "Ask about the season..."
3. Ask "Show me our PPP by play this season" — assistant should reference all season game data
4. If assistant returns a chart block, verify the chart renders inline

- [ ] **Step 3: Test chart rendering**

Ask a question that should produce a chart (e.g., "Show me a bar chart of PPP by player"). Verify:
1. Chart renders inline in the message bubble
2. "Tap chart to expand ↗" link appears below the chart
3. Tapping the link opens a full-screen overlay with the chart
4. Tapping ✕ or outside the chart closes the overlay

- [ ] **Step 4: Test error states**

Test each error condition:
1. **No key:** Remove the API key in settings, close and reopen panel → "API Key Required" screen
2. **No internet:** Disable network in DevTools, send a message → "No Connection" error message
3. **Invalid key:** Set a fake key like "sk-invalid", send a message → "Key Not Working" error
4. **Cancel:** Open panel, start typing, close panel mid-stream → no errors, clean state

- [ ] **Step 5: Test tracking isolation**

While the assistant is open:
1. Navigate to the tracking screen (if in a game)
2. Verify the tracking UI renders correctly behind the dimmed backdrop
3. Close the assistant → tracking screen fully functional
4. Log a few possessions → open assistant → ask about the new data → data is current

- [ ] **Step 6: Test service worker update**

In DevTools > Application > Service Workers:
1. Verify the new service worker (`sqt-v43`) is active
2. Check the cache — confirm `lib/chart.min.js`, `js/assistant.js`, `js/assistant-api.js`, `js/assistant-context.js`, and `css/assistant.css` are all cached
3. Go offline → refresh → app loads, assistant FAB appears (but API calls will fail with "No Connection")

- [ ] **Step 7: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration polish for AI assistant"
```

---

## Summary

| Task | What it builds | Key files |
|------|---------------|-----------|
| 1 | Vendor Chart.js, update SW and HTML | `lib/chart.min.js`, `sw.js`, `index.html` |
| 2 | Data context builder | `js/assistant-context.js` |
| 3 | Anthropic API client with streaming | `js/assistant-api.js` |
| 4 | Assistant CSS styles | `css/assistant.css` |
| 5 | Full assistant UI (FAB, panel, settings, chat, charts) | `js/assistant.js` |
| 6 | Integration testing and polish | All assistant files |
