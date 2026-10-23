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
        fab.innerHTML =
            '<svg class="assistant-fab-icon" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">' +
                '<circle cx="50" cy="50" r="38" stroke="white" stroke-width="3" fill="none" opacity="0.9"/>' +
                '<path d="M50 12 C40 30, 40 70, 50 88" stroke="white" stroke-width="2" fill="none" opacity="0.9"/>' +
                '<path d="M50 12 C60 30, 60 70, 50 88" stroke="white" stroke-width="2" fill="none" opacity="0.9"/>' +
                '<line x1="12" y1="50" x2="88" y2="50" stroke="white" stroke-width="2" opacity="0.9"/>' +
                '<path d="M18 26 C34 36, 66 36, 82 26" stroke="white" stroke-width="2" fill="none" opacity="0.7"/>' +
                '<path d="M18 74 C34 64, 66 64, 82 74" stroke="white" stroke-width="2" fill="none" opacity="0.7"/>' +
            '</svg>';
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
            // Quick action chips
            '<div class="assistant-chips" id="assistant-chips"></div>' +
            // Chat view
            '<div class="assistant-messages" id="assistant-messages"></div>' +
            '<div class="assistant-typing" id="assistant-typing">' +
                '<div class="assistant-typing-dot"></div>' +
                '<div class="assistant-typing-dot"></div>' +
                '<div class="assistant-typing-dot"></div>' +
                '<span class="assistant-typing-label">Thinking</span>' +
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
                        '<div class="assistant-settings-info-value">Sonnet</div>' +
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
                if (SQT.App && SQT.App.toast) SQT.App.toast('API key removed');
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
        document.getElementById('assistant-typing').classList.remove('visible');
        document.getElementById('assistant-input-bar').style.display = 'none';
        document.getElementById('assistant-settings').style.display = 'none';
        document.getElementById('assistant-no-key').style.display = 'flex';
        document.getElementById('assistant-settings-btn').style.display = 'none';
        document.getElementById('assistant-chips').style.display = 'none';
    },

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

    _showSettings: function() {
        document.getElementById('assistant-messages').style.display = 'none';
        document.getElementById('assistant-typing').classList.remove('visible');
        document.getElementById('assistant-input-bar').style.display = 'none';
        document.getElementById('assistant-no-key').style.display = 'none';
        document.getElementById('assistant-settings').style.display = 'block';
        document.getElementById('assistant-settings-btn').style.display = 'flex';
        document.getElementById('assistant-chips').style.display = 'none';
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

    _getChipContext: function() {
        var activeGame = SQT.Storage.getActiveGame();
        // Live game — show halftime chips for all live game states
        if (activeGame && !activeGame.result) {
            return 'halftime';
        }
        // Check for post-game: most recent game ended within 24 hours
        var season = SQT.Storage.getActiveSeason();
        if (season) {
            var games = SQT.Storage.getGamesBySeason(season.id);
            if (games.length > 0) {
                var latest = games[games.length - 1];
                if (latest.result && latest.date) {
                    var gameDate = new Date(latest.date);
                    var now = new Date();
                    var hoursSince = (now - gameDate) / (1000 * 60 * 60);
                    if (hoursSince < 24) {
                        return 'postgame';
                    }
                }
            }
        }
        return 'season';
    },

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

    // ---- Messaging ----
    _sendMessage: function() {
        var input = document.getElementById('assistant-input');
        var text = input.value.trim();
        if (!text) return;
        if (this._currentRequest) return; // Already streaming

        input.value = '';
        document.getElementById('assistant-send-btn').disabled = true;

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
        aiMsgEl.classList.add('streaming');
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
                aiMsgEl.classList.remove('streaming');
                document.getElementById('assistant-typing').classList.remove('visible');
                document.getElementById('assistant-send-btn').disabled = false;

                if (!fullText || fullText.trim().length === 0) {
                    // Empty response — remove the blank bubble and show error
                    if (aiMsgEl.parentNode) {
                        aiMsgEl.parentNode.removeChild(aiMsgEl);
                    }
                    self._addErrorMessage({ type: 'empty', message: 'No response received. Try rephrasing or asking a simpler question.' });
                    self._scrollToBottom();
                    return;
                }

                // Store in message history
                self._messages.push({ role: 'assistant', content: fullText });

                // Final render with chart parsing
                self._renderFinalMessage(aiMsgEl, fullText);
                self._scrollToBottom();
            },
            onError: function(err) {
                self._currentRequest = null;
                self._streamingEl = null;
                aiMsgEl.classList.remove('streaming');
                document.getElementById('assistant-typing').classList.remove('visible');
                document.getElementById('assistant-send-btn').disabled = false;

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

        // Add action buttons (Copy + Share)
        var plainText = fullText.replace(/```chart[\s\S]*?```/g, '').trim();
        var escapedText = plainText.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        html += '<div class="assistant-action-btns">' +
            '<button class="assistant-copy-btn" data-text="' + escapedText + '">Copy</button>' +
            '<button class="assistant-share-btn" data-text="' + escapedText + '">Share</button>' +
            '</div>';

        el.innerHTML = html;

        // Bind copy button
        var copyBtn = el.querySelector('.assistant-copy-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', function() {
                var textToCopy = this.getAttribute('data-text');
                navigator.clipboard.writeText(textToCopy).then(function() {
                    copyBtn.textContent = 'Copied!';
                    setTimeout(function() { copyBtn.textContent = 'Copy'; }, 1500);
                }).catch(function() {
                    // Fallback for older browsers
                    var ta = document.createElement('textarea');
                    ta.value = textToCopy;
                    ta.style.position = 'fixed';
                    ta.style.left = '-9999px';
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                    copyBtn.textContent = 'Copied!';
                    setTimeout(function() { copyBtn.textContent = 'Copy'; }, 1500);
                });
            });
        }

        // Bind share button
        var shareBtn = el.querySelector('.assistant-share-btn');
        if (shareBtn) {
            var self = this;
            shareBtn.addEventListener('click', function() {
                var textToShare = this.getAttribute('data-text');
                self._shareAsImage(textToShare, shareBtn);
            });
        }

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
        wrapEl._chartInstance = chart;

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
        var safeTitle = (spec.title || 'Chart').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        overlay.innerHTML =
            '<button class="assistant-chart-overlay-close">\u2715</button>' +
            '<div class="assistant-chart-overlay-title">' + safeTitle + '</div>' +
            '<canvas></canvas>';
        document.body.appendChild(overlay);

        // Close handlers
        var closeOverlay = function() {
            if (overlay._chartInstance) {
                overlay._chartInstance.destroy();
                overlay._chartInstance = null;
            }
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        };
        overlay.querySelector('.assistant-chart-overlay-close').addEventListener('click', closeOverlay);
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) closeOverlay();
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

        overlay._chartInstance = new Chart(ctx, {
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
                            for (var j = self._messages.length - 1; j >= 0; j--) {
                                if (self._messages[j].role === 'user') {
                                    self._messages.splice(j, 1);
                                    break;
                                }
                            }
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

    _extractShareStats: function(text) {
        var stats = {};

        // Try to extract score (patterns like "54-48", "Win 54-48", "Lost 42-50")
        var scoreMatch = text.match(/(\d{1,3})\s*[-\u2013]\s*(\d{1,3})/);
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
            var boldPlayer = text.match(/\*\*#?(\d+\s+[A-Za-z]+ [A-Za-z]+)\*\*\s*[\u2014\-:]\s*([^\n]+)/);
            if (boldPlayer) {
                stats.potgName = '#' + boldPlayer[1];
                stats.potgStats = boldPlayer[2].substring(0, 40);
            }
        } else {
            stats.potgName = potgMatch[1].trim();
            // Try to find the stat line after the POTG name
            var escapedName = stats.potgName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            var potgLine = text.match(new RegExp(escapedName + '[\\s\u2014\\-:]*([^\\n]+)', 'i'));
            if (potgLine) stats.potgStats = potgLine[1].substring(0, 50);
        }

        return stats;
    },

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
        html += '<div style="width:32px;height:32px;background:rgba(255,255,255,0.2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;">\uD83C\uDFC0</div>';
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
            html += '<div style="font-size:9px;color:#c41230;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;margin-bottom:3px;">\u2B50 Player of the Game</div>';
            html += '<div style="font-size:14px;font-weight:700;color:#1a1a2e;">' +
                stats.potgName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>';
            if (stats.potgStats) {
                html += '<div style="font-size:11px;color:#6a6a78;">' +
                    stats.potgStats.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>';
            }
            html += '</div>';
        }

        // Written content — strip chart blocks, convert markdown-bold and clean up
        var bodyText = text.replace(/```chart[\s\S]*?```/g, '').trim();
        // Escape HTML first
        bodyText = bodyText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        // Convert **bold** to styled <b> tags
        bodyText = bodyText.replace(/\*\*([^*]+)\*\*/g, '<b style="color:#1a1a2e;">$1</b>');
        // Convert newlines
        bodyText = bodyText.replace(/\n/g, '<br>');

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

    _shareAsImage: function(text, btn) {
        if (typeof html2canvas === 'undefined') {
            if (SQT.App && SQT.App.toast) SQT.App.toast('Share not available \u2014 try again');
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
