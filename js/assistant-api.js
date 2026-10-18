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
