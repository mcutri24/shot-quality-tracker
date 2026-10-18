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
        fab.innerHTML = '<div class="assistant-fab-inner">' +
            '<svg class="assistant-fab-basketball" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
                '<defs>' +
                    '<radialGradient id="ballGrad" cx="38%" cy="35%" r="60%">' +
                        '<stop offset="0%" stop-color="#f4952a"/>' +
                        '<stop offset="50%" stop-color="#e8751a"/>' +
                        '<stop offset="100%" stop-color="#c45a10"/>' +
                    '</radialGradient>' +
                '</defs>' +
                '<circle cx="50" cy="50" r="44" fill="url(#ballGrad)" stroke="#8b3a08" stroke-width="2"/>' +
                '<path d="M50 6 C38 28, 38 72, 50 94" stroke="#4a2006" stroke-width="2.5" fill="none"/>' +
                '<path d="M50 6 C62 28, 62 72, 50 94" stroke="#4a2006" stroke-width="2.5" fill="none"/>' +
                '<line x1="6" y1="50" x2="94" y2="50" stroke="#4a2006" stroke-width="2.5"/>' +
                '<path d="M14 22 C32 34, 68 34, 86 22" stroke="#4a2006" stroke-width="2.5" fill="none"/>' +
                '<path d="M14 78 C32 66, 68 66, 86 78" stroke="#4a2006" stroke-width="2.5" fill="none"/>' +
            '</svg>' +
            '<svg class="assistant-fab-sparkle assistant-fab-sparkle-1" width="10" height="10" viewBox="0 0 24 24"><path d="M12 0 L14 9 L24 12 L14 15 L12 24 L10 15 L0 12 L10 9 Z" fill="#ffd700"/></svg>' +
            '<svg class="assistant-fab-sparkle assistant-fab-sparkle-2" width="7" height="7" viewBox="0 0 24 24"><path d="M12 0 L14 9 L24 12 L14 15 L12 24 L10 15 L0 12 L10 9 Z" fill="#ffd700"/></svg>' +
            '<svg class="assistant-fab-sparkle assistant-fab-sparkle-3" width="8" height="8" viewBox="0 0 24 24"><path d="M12 0 L14 9 L24 12 L14 15 L12 24 L10 15 L0 12 L10 9 Z" fill="#ffd700"/></svg>' +
        '</div>';
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
    },

    _showChatView: function() {
        document.getElementById('assistant-messages').style.display = 'flex';
        document.getElementById('assistant-typing').classList.remove('visible');
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
        document.getElementById('assistant-typing').classList.remove('visible');
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
