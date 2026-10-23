# Quick Action Chips & Share as Image — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add context-aware quick action chips to the AI assistant panel and a share-as-image button that copies a branded card to the clipboard.

**Architecture:** Two independent features added to the existing `SQT.Assistant` module in `js/assistant.js`. Quick action chips are a new DOM container between the header and messages area, populated dynamically based on game context. Share as image uses html2canvas to render a hidden branded card element as a PNG and copy it to the clipboard via the `ClipboardItem` API.

**Tech Stack:** Vanilla JS (ES5, matching existing codebase), html2canvas v1.4.1 (vendored), CSS, Service Worker caching.

---

### Task 1: Vendor html2canvas Library

**Files:**
- Create: `lib/html2canvas.min.js`
- Modify: `sw.js` (line 1, line 24)
- Modify: `index.html` (line 236)

- [ ] **Step 1: Download html2canvas**

Run:
```bash
curl -L "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js" -o "c:/Users/mcutr/Claude Code Project/Shot_Quality_App/lib/html2canvas.min.js"
```

Verify it downloaded (~40KB file):
```bash
ls -la "c:/Users/mcutr/Claude Code Project/Shot_Quality_App/lib/html2canvas.min.js"
```

- [ ] **Step 2: Add script tag to index.html**

In `index.html`, after the Chart.js script tag (line 236), add:

```html
<script defer src="lib/html2canvas.min.js"></script>
```

The full script block should read:
```html
<script defer src="lib/chart.min.js"></script>
<script defer src="lib/html2canvas.min.js"></script>
<script defer src="js/assistant-context.js"></script>
```

- [ ] **Step 3: Add to service worker cache**

In `sw.js`, add `'./lib/html2canvas.min.js'` to the ASSETS array after `'./lib/chart.min.js'` (line 24):

```javascript
    './lib/chart.min.js',
    './lib/html2canvas.min.js'
];
```

- [ ] **Step 4: Commit**

```bash
git add lib/html2canvas.min.js index.html sw.js
git commit -m "chore: vendor html2canvas library for share-as-image feature"
```

---

### Task 2: Add Quick Action Chips — CSS

**Files:**
- Modify: `css/assistant.css` (after line 31, after `.assistant-fab.hidden`)

- [ ] **Step 1: Add chip container and chip styles**

In `css/assistant.css`, after the `.assistant-fab.hidden` rule (line 31), add:

```css
/* --- Quick Action Chips --- */
.assistant-chips {
    display: flex;
    gap: 8px;
    padding: 8px 12px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
}

.assistant-chips::-webkit-scrollbar {
    display: none;
}

.assistant-chip {
    flex-shrink: 0;
    padding: 6px 14px;
    border-radius: 16px;
    font-size: 11px;
    white-space: nowrap;
    background: var(--bg-card);
    border: 1px solid var(--border);
    color: var(--text-secondary);
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
}

.assistant-chip:active {
    background: var(--bg-input);
    color: var(--text-primary);
}

.assistant-chip.featured {
    background: linear-gradient(135deg, #c41230, #a01028);
    color: #fff;
    border: none;
}

.assistant-chip.featured:active {
    background: linear-gradient(135deg, #a01028, #800c1e);
    color: #fff;
}
```

- [ ] **Step 2: Commit**

```bash
git add css/assistant.css
git commit -m "style: add CSS for quick action chips"
```

---

### Task 3: Add Quick Action Chips — JavaScript

**Files:**
- Modify: `js/assistant.js`

This task adds: chip data definitions, context detection, DOM creation, chip rendering on panel open, and chip tap handler.

- [ ] **Step 1: Add chip definitions after the `_streamingEl` property (line 11)**

After line 11 (`_streamingEl: null,`), add the chip data:

```javascript
    _streamingEl: null,    // The message element currently being streamed into

    // ---- Quick Action Chip Definitions ----
    _chips: {
        halftime: [
            { icon: '\u26A1', label: 'Halftime Report', featured: true, prompt: 'Give me a halftime report with key takeaways \u2014 what\u2019s working, what\u2019s not, and what adjustments should we make in the second half. Lead with the most important thing the team needs to hear.' },
            { icon: '\uD83D\uDD25', label: 'Who\u2019s Hot?', prompt: 'Who\u2019s playing well right now? Show me the top performers by points, efficiency, and shot quality grades.' },
            { icon: '\uD83C\uDFAF', label: 'Shot Selection', prompt: 'Break down our shot selection so far \u2014 are we taking good shots? Show grade distribution (gold/silver/bronze) and shot type mix. Also break down which plays are producing the best and worst looks.' },
            { icon: '\u26A0\uFE0F', label: 'Turnover Check', prompt: 'How many turnovers do we have? Who\u2019s turning it over and when? Are there patterns \u2014 certain quarters, plays, or situations where we\u2019re giving it away?' }
        ],
        postgame: [
            { icon: '\uD83D\uDCCB', label: 'Game Recap', featured: true, prompt: 'Give me a complete game recap with key takeaways \u2014 top performers, what worked, what didn\u2019t, and what we should focus on in practice this week.' },
            { icon: '\u2B50', label: 'Player Breakdown', prompt: 'Give me a full player-by-player breakdown for this game \u2014 points, FG%, shot quality, turnovers, and key moments for each player who saw the floor. Highlight the positives AND the areas to improve for each. At the top, name the Player of the Game and why.' },
            { icon: '\uD83C\uDFAF', label: 'Shot Selection', prompt: 'Break down our shot selection for this game \u2014 grade distribution, shot type mix, open vs contested looks. Also break down which plays produced the best and worst shot quality. Were we running the right stuff?' },
            { icon: '\u26A0\uFE0F', label: 'Turnover Check', prompt: 'How many turnovers did we have? Who turned it over and when? Break down any patterns \u2014 certain quarters, plays, or situations. How many points did turnovers likely cost us?' }
        ],
        season: [
            { icon: '\uD83D\uDCCA', label: 'Season Summary', featured: true, prompt: 'Give me an overall season summary \u2014 record, scoring trends, team strengths and weaknesses, and how we\u2019ve progressed over the course of the season.' },
            { icon: '\uD83D\uDC65', label: 'Player Breakdown', prompt: 'Give me a full player breakdown for the season \u2014 rank players by impact, showing points, efficiency, and shot quality. Highlight who our best and worst performers are. Also call out which players have been hot recently or shown the most improvement over the season.' },
            { icon: '\uD83C\uDFAF', label: 'Shot Selection & Trends', prompt: 'Break down our shooting for the season \u2014 FG%, 3PT%, FT%, and shot quality grades overall and how they\u2019ve trended recently. Are we taking better or worse shots as the season goes on? Show the overall numbers and the recent trend (last 3-5 games).' },
            { icon: '\uD83C\uDFC0', label: 'Play Breakdown', prompt: 'Rank all our plays by effectiveness this season \u2014 PPP, frequency, shot quality grades, and conversion rate. Separate set plays from transition and offensive rebounds since those aren\u2019t designed plays. For set plays, call out which ones have been working more recently vs earlier in the season. Which plays should we run more and which should we consider cutting?' }
        ]
    },
```

- [ ] **Step 2: Add context detection method**

After the `_getCurrentQuarter` method (around line 320), add:

```javascript
    _getChipContext: function() {
        var activeGame = SQT.Storage.getActiveGame();
        // Live game — check if halftime or later
        if (activeGame && !activeGame.result) {
            var quarter = this._getCurrentQuarter(activeGame);
            var qNum = parseInt(quarter.replace(/\D/g, ''), 10) || 1;
            if (quarter === 'OT' || qNum >= 2) {
                return 'halftime';
            }
            return 'halftime'; // Show halftime chips for all live game states
        }
        // Check for post-game: most recent game has a result
        var season = SQT.Storage.getActiveSeason();
        if (season) {
            var games = SQT.Storage.getGamesBySeason(season.id);
            if (games.length > 0) {
                var latest = games[games.length - 1];
                if (latest.result) {
                    return 'postgame';
                }
            }
        }
        return 'season';
    },
```

- [ ] **Step 3: Add chips container to the panel DOM in `_createDOM`**

In the `_createDOM` method, the panel innerHTML is built as a single string. Find the line that starts the chat view section — the messages div (line 59):

```javascript
            // Chat view
            '<div class="assistant-messages" id="assistant-messages"></div>' +
```

Insert the chips container **before** it:

```javascript
            // Quick action chips
            '<div class="assistant-chips" id="assistant-chips"></div>' +
            // Chat view
            '<div class="assistant-messages" id="assistant-messages"></div>' +
```

- [ ] **Step 4: Add chip rendering method**

After the `_getChipContext` method, add:

```javascript
    _renderChips: function() {
        var container = document.getElementById('assistant-chips');
        container.innerHTML = '';
        var context = this._getChipContext();
        var chips = this._chips[context] || this._chips.season;
        var self = this;

        for (var i = 0; i < chips.length; i++) {
            (function(chip) {
                var btn = document.createElement('button');
                btn.className = 'assistant-chip' + (chip.featured ? ' featured' : '');
                btn.textContent = chip.icon + ' ' + chip.label;
                btn.addEventListener('click', function() {
                    self._sendChipPrompt(chip.prompt);
                });
                container.appendChild(btn);
            })(chips[i]);
        }
    },

    _sendChipPrompt: function(prompt) {
        if (this._currentRequest) return; // Already streaming
        var input = document.getElementById('assistant-input');
        input.value = prompt;
        this._sendMessage();
    },
```

- [ ] **Step 5: Call `_renderChips` when the chat view is shown**

In the `_showChatView` method, add a call to `_renderChips()` at the end, just before the input focus timeout:

```javascript
    _showChatView: function() {
        document.getElementById('assistant-messages').style.display = 'flex';
        document.getElementById('assistant-typing').classList.remove('visible');
        document.getElementById('assistant-input-bar').style.display = 'flex';
        document.getElementById('assistant-settings').style.display = 'none';
        document.getElementById('assistant-no-key').style.display = 'none';
        document.getElementById('assistant-settings-btn').style.display = 'flex';
        document.getElementById('assistant-chips').style.display = 'flex';
        this._isSettingsView = false;

        // Render context-aware chips
        this._renderChips();

        // Focus input
        var input = document.getElementById('assistant-input');
        setTimeout(function() { input.focus(); }, 300);
    },
```

- [ ] **Step 6: Hide chips in non-chat views**

In `_showNoKeyView`, add after the existing display:none lines:

```javascript
        document.getElementById('assistant-chips').style.display = 'none';
```

In `_showSettings`, add after the existing display:none lines:

```javascript
        document.getElementById('assistant-chips').style.display = 'none';
```

- [ ] **Step 7: Commit**

```bash
git add js/assistant.js
git commit -m "feat: add context-aware quick action chips to AI assistant"
```

---

### Task 4: Add Share Button and Image Generation — CSS

**Files:**
- Modify: `css/assistant.css`

- [ ] **Step 1: Update copy button area to support two buttons side by side**

Find the existing `.assistant-copy-btn` block (around line 175) and add the share button styles after the `.assistant-copy-btn:active` rule:

```css
/* --- Action Buttons Row (Copy + Share) --- */
.assistant-action-btns {
    display: flex;
    gap: 8px;
    margin-top: 8px;
}

.assistant-action-btns .assistant-copy-btn,
.assistant-action-btns .assistant-share-btn {
    margin-top: 0;
}

.assistant-share-btn {
    display: block;
    padding: 4px 12px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    color: var(--text-muted);
    font-size: 11px;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
}

.assistant-share-btn:active {
    background: rgba(255, 255, 255, 0.2);
    color: var(--text-primary);
}
```

- [ ] **Step 2: Commit**

```bash
git add css/assistant.css
git commit -m "style: add CSS for share-as-image button"
```

---

### Task 5: Add Share Button — JavaScript (Button + Hidden Card Rendering)

**Files:**
- Modify: `js/assistant.js` — `_renderFinalMessage` method and new methods

- [ ] **Step 1: Update `_renderFinalMessage` to wrap Copy and Share in a button row**

In the `_renderFinalMessage` method, find the copy button HTML block (around line 458-462). Replace it with a button row that includes both Copy and Share:

Replace this block:
```javascript
        // Add copy button
        var plainText = fullText.replace(/```chart[\s\S]*?```/g, '').trim();
        html += '<button class="assistant-copy-btn" data-text="' +
            plainText.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;') +
            '">Copy</button>';
```

With:
```javascript
        // Add action buttons (Copy + Share)
        var plainText = fullText.replace(/```chart[\s\S]*?```/g, '').trim();
        var escapedText = plainText.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        html += '<div class="assistant-action-btns">' +
            '<button class="assistant-copy-btn" data-text="' + escapedText + '">Copy</button>' +
            '<button class="assistant-share-btn" data-text="' + escapedText + '">Share</button>' +
            '</div>';
```

- [ ] **Step 2: Update the copy button binding to find it inside the new wrapper**

The existing copy button binding code (around line 467) should still work since it queries `.assistant-copy-btn` inside `el`. No changes needed.

- [ ] **Step 3: Add share button binding after the copy button binding**

After the copy button binding block (after the closing `}` around line 488), add the share button binding:

```javascript
        // Bind share button
        var shareBtn = el.querySelector('.assistant-share-btn');
        if (shareBtn) {
            var self = this;
            shareBtn.addEventListener('click', function() {
                var textToShare = this.getAttribute('data-text');
                self._shareAsImage(textToShare, shareBtn);
            });
        }
```

- [ ] **Step 4: Add the `_shareAsImage` method**

Add this new method before the `_scrollToBottom` method:

```javascript
    _shareAsImage: function(text, btn) {
        if (typeof html2canvas === 'undefined') {
            if (SQT.App && SQT.App.toast) SQT.App.toast('Share not available — try again');
            return;
        }

        btn.textContent = 'Creating...';
        btn.disabled = true;

        // Build the image card as a hidden DOM element
        var card = this._buildShareCard(text);
        document.body.appendChild(card);

        var self = this;
        html2canvas(card, {
            backgroundColor: null,
            scale: 2,
            useCORS: true,
            logging: false
        }).then(function(canvas) {
            document.body.removeChild(card);
            canvas.toBlob(function(blob) {
                self._copyImageToClipboard(blob, btn);
            }, 'image/png');
        }).catch(function() {
            document.body.removeChild(card);
            btn.textContent = 'Share';
            btn.disabled = false;
            if (SQT.App && SQT.App.toast) SQT.App.toast('Could not create image');
        });
    },

    _copyImageToClipboard: function(blob, btn) {
        if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
            navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]).then(function() {
                btn.textContent = 'Image Copied!';
                btn.disabled = false;
                setTimeout(function() { btn.textContent = 'Share'; }, 1500);
            }).catch(function() {
                // Fallback: download the image
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = 'shot-quality-report.png';
                a.click();
                URL.revokeObjectURL(url);
                btn.textContent = 'Saved!';
                btn.disabled = false;
                setTimeout(function() { btn.textContent = 'Share'; }, 1500);
            });
        } else {
            // No ClipboardItem support — download instead
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'shot-quality-report.png';
            a.click();
            URL.revokeObjectURL(url);
            btn.textContent = 'Saved!';
            btn.disabled = false;
            setTimeout(function() { btn.textContent = 'Share'; }, 1500);
        }
    },
```

- [ ] **Step 5: Commit**

```bash
git add js/assistant.js
git commit -m "feat: add share button with image generation and clipboard copy"
```

---

### Task 6: Build the Branded Image Card (`_buildShareCard`)

**Files:**
- Modify: `js/assistant.js` — add `_buildShareCard` and `_extractShareStats` methods

- [ ] **Step 1: Add stat extraction helper**

Add this method before `_shareAsImage`:

```javascript
    _extractShareStats: function(text) {
        var stats = {};

        // Try to extract score (patterns like "54-48", "Win 54-48", "Lost 42-50")
        var scoreMatch = text.match(/(\d{1,3})\s*[-–]\s*(\d{1,3})/);
        if (scoreMatch) {
            stats.scoreUs = scoreMatch[1];
            stats.scoreThem = scoreMatch[2];
        }

        // Win or loss
        var winMatch = text.match(/\b(win|won|victory|W)\b/i);
        var lossMatch = text.match(/\b(loss|lost|defeat|fell|L)\b/i);
        if (winMatch) stats.result = 'WIN';
        else if (lossMatch) stats.result = 'LOSS';

        // FG%
        var fgMatch = text.match(/FG[%:]?\s*(\d{1,3}(?:\.\d)?)\s*%?/i);
        if (!fgMatch) fgMatch = text.match(/(\d{1,3}(?:\.\d)?)\s*%?\s*FG/i);
        if (fgMatch) stats.fgPct = fgMatch[1] + '%';

        // 3PT%
        var threePtMatch = text.match(/3(?:PT|pt|P|p)[%:]?\s*(\d{1,3}(?:\.\d)?)\s*%?/i);
        if (!threePtMatch) threePtMatch = text.match(/(\d{1,3}(?:\.\d)?)\s*%?\s*(?:from|from the)\s*(?:3|three)/i);
        if (threePtMatch) stats.threePct = threePtMatch[1] + '%';

        // Turnovers
        var toMatch = text.match(/(\d{1,2})\s*turnovers?/i);
        if (!toMatch) toMatch = text.match(/turnovers?[:\s]*(\d{1,2})/i);
        if (toMatch) stats.turnovers = toMatch[1];

        // Player of the Game — look for bolded player or "Player of the Game" mention
        var potgMatch = text.match(/Player of the Game[:\s]*\*?\*?([#\d]+ [A-Z][a-z]+ [A-Z][a-z]+)/i);
        if (!potgMatch) potgMatch = text.match(/Player of the Game[:\s]*\*?\*?#?(\d+\s+\w+\s+\w+)/i);
        if (!potgMatch) {
            // Fallback: first bolded player with stats
            var boldPlayer = text.match(/\*\*#?(\d+\s+[A-Za-z]+ [A-Za-z]+)\*\*\s*[—\-:]\s*([^\n]+)/);
            if (boldPlayer) {
                stats.potgName = '#' + boldPlayer[1];
                stats.potgStats = boldPlayer[2].substring(0, 40);
            }
        } else {
            stats.potgName = potgMatch[1].trim();
            // Try to find the stat line after the POTG name
            var potgLine = text.match(new RegExp(stats.potgName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s—\\-:]*([^\\n]+)', 'i'));
            if (potgLine) stats.potgStats = potgLine[1].substring(0, 50);
        }

        return stats;
    },
```

- [ ] **Step 2: Add the `_buildShareCard` method**

Add this method after `_extractShareStats`:

```javascript
    _buildShareCard: function(text) {
        var stats = this._extractShareStats(text);
        var badge = document.getElementById('assistant-context-badge');
        var contextLabel = badge ? badge.textContent : '';

        // Determine if this is a game-specific or general report
        var hasGameStats = stats.scoreUs && stats.scoreThem;

        var card = document.createElement('div');
        card.style.cssText = 'position:fixed;left:-9999px;top:0;width:380px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';

        var html = '';

        // ---- CRIMSON HEADER ----
        html += '<div style="background:linear-gradient(135deg,#c41230,#8a0e24);padding:16px 18px;">';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;">';
        html += '<div style="display:flex;align-items:center;gap:10px;">';
        html += '<div style="width:32px;height:32px;background:rgba(255,255,255,0.2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;">🏀</div>';
        html += '<div><div style="color:#fff;font-size:14px;font-weight:700;">Newark Academy</div>';
        html += '<div style="color:rgba(255,255,255,0.7);font-size:11px;">Minutemen Basketball</div></div>';
        html += '</div>';
        if (contextLabel) {
            html += '<div style="color:rgba(255,255,255,0.6);font-size:11px;text-align:right;">' +
                contextLabel.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>';
        }
        html += '</div>';

        // Score bar (only for game-specific reports)
        if (hasGameStats) {
            var resultColor = stats.result === 'WIN' ? '#4CAF50' : (stats.result === 'LOSS' ? '#f44336' : '#fff');
            html += '<div style="text-align:center;margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.15);">';
            html += '<div style="font-size:32px;font-weight:800;color:#fff;">' + stats.scoreUs +
                '<span style="color:rgba(255,255,255,0.4);margin:0 8px;">-</span>' + stats.scoreThem + '</div>';
            if (stats.result) {
                html += '<div style="font-size:11px;font-weight:600;color:' + resultColor + ';margin-top:2px;">' + stats.result + '</div>';
            }
            html += '</div>';
        }
        html += '</div>';

        // ---- WHITE BODY ----
        html += '<div style="background:#ffffff;padding:16px 18px;">';

        // Stat boxes (only if we have stats)
        if (stats.fgPct || stats.threePct || stats.turnovers) {
            html += '<div style="display:flex;gap:8px;margin-bottom:14px;">';
            if (stats.fgPct) {
                html += '<div style="flex:1;background:#f5f5f7;border-radius:8px;padding:10px;text-align:center;">';
                html += '<div style="font-size:9px;color:#8a8a98;text-transform:uppercase;letter-spacing:0.5px;">FG%</div>';
                html += '<div style="font-size:20px;font-weight:700;color:#2a8a2a;">' + stats.fgPct + '</div>';
                html += '</div>';
            }
            if (stats.threePct) {
                html += '<div style="flex:1;background:#f5f5f7;border-radius:8px;padding:10px;text-align:center;">';
                html += '<div style="font-size:9px;color:#8a8a98;text-transform:uppercase;letter-spacing:0.5px;">3PT%</div>';
                html += '<div style="font-size:20px;font-weight:700;color:#b8860b;">' + stats.threePct + '</div>';
                html += '</div>';
            }
            if (stats.turnovers) {
                html += '<div style="flex:1;background:#f5f5f7;border-radius:8px;padding:10px;text-align:center;">';
                html += '<div style="font-size:9px;color:#8a8a98;text-transform:uppercase;letter-spacing:0.5px;">TO\'s</div>';
                html += '<div style="font-size:20px;font-weight:700;color:#c41230;">' + stats.turnovers + '</div>';
                html += '</div>';
            }
            html += '</div>';
        }

        // Player of the Game callout
        if (stats.potgName) {
            html += '<div style="background:#fdf2f4;border:1px solid #e8c0c8;border-radius:8px;padding:10px 14px;margin-bottom:14px;">';
            html += '<div style="font-size:9px;color:#c41230;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;margin-bottom:3px;">⭐ Player of the Game</div>';
            html += '<div style="font-size:14px;font-weight:700;color:#1a1a2e;">' +
                stats.potgName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>';
            if (stats.potgStats) {
                html += '<div style="font-size:11px;color:#6a6a78;">' +
                    stats.potgStats.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>';
            }
            html += '</div>';
        }

        // Written content — convert markdown-bold and bullets
        var bodyText = text
            .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            // Re-apply bold tags after escaping (they got escaped too)
            .replace(/&lt;b&gt;/g, '<b style="color:#1a1a2e;">').replace(/&lt;\/b&gt;/g, '</b>')
            .replace(/\n/g, '<br>');

        html += '<div style="font-size:12px;line-height:1.7;color:#2a2a3a;">' + bodyText + '</div>';
        html += '</div>';

        // ---- FOOTER ----
        html += '<div style="background:#f5f5f7;padding:9px 18px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #e8e8ec;">';
        html += '<div style="font-size:9px;color:#8a8a98;">Shot Quality Tracker</div>';
        html += '<div style="font-size:9px;color:#8a8a98;">AI-Generated Analysis</div>';
        html += '</div>';

        card.innerHTML = html;
        return card;
    },
```

- [ ] **Step 3: Fix the markdown escaping order in `_buildShareCard`**

The body text processing needs to handle escaping before bold conversion. Replace the bodyText block with:

```javascript
        // Written content — strip chart blocks, convert markdown-bold and clean up
        var bodyText = text.replace(/```chart[\s\S]*?```/g, '').trim();
        // Escape HTML first
        bodyText = bodyText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        // Convert **bold** to styled <b> tags
        bodyText = bodyText.replace(/\*\*([^*]+)\*\*/g, '<b style="color:#1a1a2e;">$1</b>');
        // Convert newlines
        bodyText = bodyText.replace(/\n/g, '<br>');
```

- [ ] **Step 4: Commit**

```bash
git add js/assistant.js
git commit -m "feat: add branded image card builder with stat extraction"
```

---

### Task 7: Bump Service Worker Cache and Final Integration

**Files:**
- Modify: `sw.js` (line 1)

- [ ] **Step 1: Bump SW cache version**

In `sw.js`, change:
```javascript
var CACHE_NAME = 'sqt-v52';
```
To:
```javascript
var CACHE_NAME = 'sqt-v53';
```

- [ ] **Step 2: Commit all changes**

```bash
git add sw.js
git commit -m "chore: bump SW cache to v53 for quick actions + share as image"
```

- [ ] **Step 3: Push to remote**

```bash
git push
```

---

### Task 8: Manual Testing Checklist

No code changes — verify the features work on the target device (iPhone 14, Safari).

- [ ] **Step 1: Clear Safari cache on iPhone**

Settings → Safari → Clear History and Website Data (or Settings → Safari → Advanced → Website Data → Remove All)

- [ ] **Step 2: Test Quick Action Chips — Season Context**

1. Open the app, open the AI assistant
2. Verify 4 chips appear: Season Summary (crimson), Player Breakdown, Shot Selection & Trends, Play Breakdown
3. Tap "Season Summary" — verify it sends the prompt and gets a response
4. Verify chips remain visible above the chat after the response
5. Tap another chip — verify it sends a second prompt in the same conversation

- [ ] **Step 3: Test Quick Action Chips — Halftime Context**

1. Start a new game
2. Log a few possessions in Q1, switch to Q2
3. Open the AI assistant
4. Verify halftime chips appear: Halftime Report (crimson), Who's Hot?, Shot Selection, Turnover Check

- [ ] **Step 4: Test Quick Action Chips — Post-Game Context**

1. End a game and save the final score
2. Go back to the home screen
3. Open the AI assistant
4. Verify post-game chips appear: Game Recap (crimson), Player Breakdown, Shot Selection, Turnover Check

- [ ] **Step 5: Test Share as Image**

1. Get an AI response (use any chip)
2. Verify both "Copy" and "Share" buttons appear below the response
3. Tap "Share" — verify "Creating..." appears briefly, then "Image Copied!"
4. Open iMessage, long-press in the text field, tap Paste
5. Verify a branded image card appears with crimson header, stats, and text
6. Verify the image looks correct — white background, readable text, stat boxes if applicable

- [ ] **Step 6: Test Share Fallback**

1. For a season summary response (no game-specific stats), tap Share
2. Verify the image card uses the fallback layout — crimson header without score, white body with text only
