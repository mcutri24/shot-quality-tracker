/**
 * Tap-tap-tap possession logging flow.
 * Step 1: Player → Step 2: Shot Type → Step 3: Result → Step 4: Grade
 * Special flows: Turnover (auto-miss), Free Throws (made X of Y)
 */
var SQT = window.SQT || {};

SQT.Tracker = {
    game: null,
    currentQuarter: 'Q1',
    step: 1,         // 1=player, 2=shot, 3=result, 4=grade
    pending: null,    // Partial possession being built

    SHOT_TYPES: [
        { id: 'open_layup',      label: 'Open Layup',        points: 2 },
        { id: 'contested_layup', label: 'Contested Layup',   points: 2 },
        { id: 'open_mid',        label: 'Open Mid-Range',    points: 2 },
        { id: 'contested_mid',   label: 'Contested Mid-Range', points: 2 },
        { id: 'open_3',          label: 'Open 3',            points: 3 },
        { id: 'contested_3',     label: 'Contested 3',       points: 3 },
        { id: 'free_throws',     label: 'Free Throws',       points: 0, special: 'ft' },
        { id: 'turnover',        label: 'Turnover',          points: 0, special: 'to' }
    ],

    start: function(game) {
        this.game = game;
        this.currentQuarter = 'Q1';
        this.step = 1;
        this.pending = null;
        this._renderTrackingTop();
        this._renderStep();
        this._bindTrackingUI();
    },

    _bindTrackingUI: function() {
        var self = this;

        // Quarter selector
        var qBtns = document.querySelectorAll('.quarter-selector button');
        for (var i = 0; i < qBtns.length; i++) {
            qBtns[i].addEventListener('click', function() {
                for (var j = 0; j < qBtns.length; j++) qBtns[j].classList.remove('active');
                this.classList.add('active');
                self.currentQuarter = this.textContent.trim();
            });
        }

        // Dashboard toggle
        document.getElementById('tracking-dashboard-btn').addEventListener('click', function() {
            SQT.App.showScreen('dashboard');
            if (SQT.Dashboard) SQT.Dashboard.showGame(self.game, true);
        });

        // Undo button
        document.getElementById('tracking-undo-btn').addEventListener('click', function() {
            self._undo();
        });

        // End game button
        document.getElementById('tracking-end-btn').addEventListener('click', function() {
            if (confirm('End this game?')) {
                SQT.Game.endGame();
            }
        });
    },

    _renderTrackingTop: function() {
        if (!this.game) return;
        document.getElementById('tracking-game-info').textContent =
            (this.game.location === 'Away' ? '@ ' : 'vs ') + this.game.opponent;
        this._updateMiniStats();
    },

    _updateMiniStats: function() {
        var poss = this.game.possessions;
        var total = poss.length;
        var pts = 0;
        var fgm = 0, fga = 0;
        for (var i = 0; i < poss.length; i++) {
            pts += poss[i].points || 0;
            if (poss[i].shotType !== 'free_throws' && poss[i].shotType !== 'turnover') {
                fga++;
                if (poss[i].result === 'made') fgm++;
            }
        }
        var ppp = total > 0 ? (pts / total).toFixed(2) : '—';
        var fgPct = fga > 0 ? Math.round(fgm / fga * 100) + '%' : '—';

        document.getElementById('mini-poss').textContent = total;
        document.getElementById('mini-ppp').textContent = ppp;
        document.getElementById('mini-fg').textContent = fgPct;
    },

    _renderStep: function() {
        var area = document.getElementById('tap-flow-area');
        switch (this.step) {
            case 1: this._renderPlayerSelect(area); break;
            case 2: this._renderShotSelect(area); break;
            case 3: this._renderResultSelect(area); break;
            case 'ft': this._renderFTSelect(area); break;
            case 4: this._renderGradeSelect(area); break;
        }
    },

    // Step 1: Player select
    _renderPlayerSelect: function(area) {
        var roster = SQT.Roster.players;
        if (roster.length === 0) {
            area.innerHTML = '<div class="tap-prompt">No players in roster. Go back and add players first.</div>';
            return;
        }
        var html = '<div class="tap-prompt"><span class="step-label">Step 1:</span> Select Player</div>';
        html += '<div class="player-grid">';
        for (var i = 0; i < roster.length; i++) {
            var p = roster[i];
            html += '<button class="player-btn" data-id="' + p.id + '" data-num="' + p.number + '" data-name="' + this._esc(p.name) + '">' +
                '<span class="num">' + p.number + '</span>' +
                '<span class="name">' + this._esc(p.name) + '</span>' +
            '</button>';
        }
        html += '</div>';
        area.innerHTML = html;

        var self = this;
        var btns = area.querySelectorAll('.player-btn');
        for (var b = 0; b < btns.length; b++) {
            btns[b].addEventListener('click', function() {
                self.pending = {
                    id: SQT.Storage.uuid(),
                    quarter: self.currentQuarter,
                    playerId: this.getAttribute('data-id'),
                    playerNumber: this.getAttribute('data-num'),
                    playerName: this.getAttribute('data-name'),
                    timestamp: new Date().toISOString()
                };
                self.step = 2;
                self._renderStep();
            });
        }
    },

    // Step 2: Shot type select
    _renderShotSelect: function(area) {
        var html = '<div class="tap-prompt"><span class="step-label">Step 2:</span> Shot Type — #' + this.pending.playerNumber + ' ' + this.pending.playerName + '</div>';
        html += '<div class="shot-grid">';
        for (var i = 0; i < this.SHOT_TYPES.length; i++) {
            var s = this.SHOT_TYPES[i];
            var cls = 'shot-btn';
            if (s.special === 'to') cls += ' turnover';
            if (s.special === 'ft') cls += ' free-throw';
            html += '<button class="' + cls + '" data-idx="' + i + '">' + s.label + '</button>';
        }
        html += '</div>';
        area.innerHTML = html;

        var self = this;
        var btns = area.querySelectorAll('.shot-btn');
        for (var b = 0; b < btns.length; b++) {
            btns[b].addEventListener('click', function() {
                var idx = parseInt(this.getAttribute('data-idx'));
                var shot = self.SHOT_TYPES[idx];
                self.pending.shotType = shot.id;
                self.pending.shotLabel = shot.label;
                self.pending.basePoints = shot.points;

                if (shot.special === 'to') {
                    // Turnover: auto-miss, skip to grade
                    self.pending.result = 'missed';
                    self.pending.points = 0;
                    self.step = 4;
                } else if (shot.special === 'ft') {
                    // Free throws: special screen
                    self.step = 'ft';
                } else {
                    self.step = 3;
                }
                self._renderStep();
            });
        }
    },

    // Step 3: Result (Made / Missed)
    _renderResultSelect: function(area) {
        var html = '<div class="tap-prompt"><span class="step-label">Step 3:</span> Result — ' + this.pending.shotLabel + '</div>';
        html += '<div class="result-grid">';
        html += '<button class="result-btn made">MADE</button>';
        html += '<button class="result-btn missed">MISSED</button>';
        html += '</div>';
        area.innerHTML = html;

        var self = this;
        area.querySelector('.result-btn.made').addEventListener('click', function() {
            self.pending.result = 'made';
            self.pending.points = self.pending.basePoints;
            self.step = 4;
            self._renderStep();
        });
        area.querySelector('.result-btn.missed').addEventListener('click', function() {
            self.pending.result = 'missed';
            self.pending.points = 0;
            self.step = 4;
            self._renderStep();
        });
    },

    // Free throw sub-screen
    _renderFTSelect: function(area) {
        var html = '<div class="tap-prompt"><span class="step-label">Free Throws</span> — #' + this.pending.playerNumber + '</div>';
        html += '<div class="ft-screen">';
        html += '<div class="ft-counters">';
        html += '<div class="ft-counter"><div class="ft-val" id="ft-made-val">0</div><div class="ft-btns"><button id="ft-made-minus">−</button><button id="ft-made-plus">+</button></div><div class="ft-label" style="font-size:12px;color:var(--text-secondary);margin-top:4px;">Made</div></div>';
        html += '<div class="ft-of">of</div>';
        html += '<div class="ft-counter"><div class="ft-val" id="ft-att-val">0</div><div class="ft-btns"><button id="ft-att-minus">−</button><button id="ft-att-plus">+</button></div><div class="ft-label" style="font-size:12px;color:var(--text-secondary);margin-top:4px;">Attempts</div></div>';
        html += '</div>';
        html += '<button class="btn btn-primary btn-lg" id="ft-confirm" style="margin-top:16px;">Confirm</button>';
        html += '</div>';
        area.innerHTML = html;

        var made = 0, att = 0;
        var madeEl = document.getElementById('ft-made-val');
        var attEl = document.getElementById('ft-att-val');

        function update() {
            if (made > att) att = made;
            madeEl.textContent = made;
            attEl.textContent = att;
        }

        document.getElementById('ft-made-plus').addEventListener('click', function() { made++; update(); });
        document.getElementById('ft-made-minus').addEventListener('click', function() { if (made > 0) made--; update(); });
        document.getElementById('ft-att-plus').addEventListener('click', function() { att++; update(); });
        document.getElementById('ft-att-minus').addEventListener('click', function() { if (att > 0) att--; update(); });

        var self = this;
        document.getElementById('ft-confirm').addEventListener('click', function() {
            if (att === 0) { SQT.App.toast('Enter FT attempts'); return; }
            self.pending.result = made + '/' + att;
            self.pending.ftMade = made;
            self.pending.ftAttempts = att;
            self.pending.points = made;
            self.step = 4;
            self._renderStep();
        });
    },

    // Step 4: Grade
    _renderGradeSelect: function(area) {
        var label = this.pending.shotLabel;
        if (this.pending.shotType === 'free_throws') {
            label = 'FT: ' + this.pending.result;
        } else if (this.pending.shotType === 'turnover') {
            label = 'Turnover';
        } else {
            label += ' — ' + (this.pending.result === 'made' ? 'Made' : 'Missed');
        }

        var html = '<div class="tap-prompt"><span class="step-label">Step ' + (this.pending.shotType === 'turnover' ? '3' : '4') + ':</span> Possession Grade — ' + label + '</div>';
        html += '<div class="grade-grid">';
        html += '<button class="grade-btn gold" data-grade="gold">Gold</button>';
        html += '<button class="grade-btn silver" data-grade="silver">Silver</button>';
        html += '<button class="grade-btn bronze" data-grade="bronze">Bronze</button>';
        html += '</div>';
        area.innerHTML = html;

        var self = this;
        var btns = area.querySelectorAll('.grade-btn');
        for (var b = 0; b < btns.length; b++) {
            btns[b].addEventListener('click', function() {
                self.pending.grade = this.getAttribute('data-grade');
                self._logPossession();
            });
        }
    },

    _logPossession: function() {
        // Clean up pending and add to game
        delete this.pending.shotLabel;
        delete this.pending.basePoints;
        this.game.possessions.push(this.pending);
        SQT.Storage.saveGame(this.game);

        // Reset for next possession
        this.pending = null;
        this.step = 1;
        this._updateMiniStats();
        this._renderStep();
    },

    _undo: function() {
        if (this.step !== 1) {
            // Go back a step
            if (this.step === 2) this.step = 1;
            else if (this.step === 3) this.step = 2;
            else if (this.step === 'ft') this.step = 2;
            else if (this.step === 4) {
                if (this.pending.shotType === 'turnover') this.step = 2;
                else if (this.pending.shotType === 'free_throws') this.step = 'ft';
                else this.step = 3;
            }
            this._renderStep();
            return;
        }
        // On step 1: undo last logged possession
        if (this.game.possessions.length > 0) {
            this.game.possessions.pop();
            SQT.Storage.saveGame(this.game);
            this._updateMiniStats();
            SQT.App.toast('Last possession undone');
        }
    },

    _esc: function(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};

window.SQT = SQT;
