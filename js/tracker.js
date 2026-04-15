/**
 * Tap-tap-tap possession logging flow.
 * Step 1: Player → Step 2: Shot Type → Step 3: Result → Step 4: Play → Step 5: Grade
 * Special flows: Turnover (auto-miss, skip result), Free Throws (made X of Y)
 */
var SQT = window.SQT || {};

SQT.Tracker = {
    game: null,
    currentQuarter: 'Q1',
    step: 1,         // 1=player, 2=shot, 3=result, 4=play, 5=grade
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

        // Quarter selector — use onclick to avoid stacking handlers
        var qBtns = document.querySelectorAll('.quarter-selector button');
        for (var i = 0; i < qBtns.length; i++) {
            qBtns[i].onclick = function() {
                for (var j = 0; j < qBtns.length; j++) qBtns[j].classList.remove('active');
                this.classList.add('active');
                self.currentQuarter = this.textContent.trim();
            };
        }

        // Dashboard toggle
        document.getElementById('tracking-dashboard-btn').onclick = function() {
            SQT.App.showScreen('dashboard');
            if (SQT.Dashboard) SQT.Dashboard.showGame(self.game, true);
        };

        // Undo button
        document.getElementById('tracking-undo-btn').onclick = function() {
            self._undo();
        };

        // Play List button
        document.getElementById('tracking-playlist-btn').onclick = function() {
            self._showPlayList();
        };

        // End game button
        document.getElementById('tracking-end-btn').onclick = function() {
            if (confirm('End this game?')) {
                SQT.Game.endGame();
            }
        };
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

        var ids = ['mini-poss', 'mini-pts', 'mini-ppp', 'mini-fg'];
        var vals = [total, pts, ppp, fgPct];
        for (var u = 0; u < ids.length; u++) {
            var el = document.getElementById(ids[u]);
            if (el.textContent !== String(vals[u])) {
                el.textContent = vals[u];
                el.classList.remove('bump');
                void el.offsetWidth; // force reflow
                el.classList.add('bump');
            }
        }
    },

    _renderStep: function() {
        var area = document.getElementById('tap-flow-area');
        switch (this.step) {
            case 1: this._renderPlayerSelect(area); break;
            case 2: this._renderShotSelect(area); break;
            case 3: this._renderResultSelect(area); break;
            case 'ft': this._renderFTSelect(area); break;
            case 4: this._renderPlaySelect(area); break;
            case 5: this._renderGradeSelect(area); break;
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
                    // Turnover: auto-miss, skip to play select
                    self.pending.result = 'missed';
                    self.pending.points = 0;
                    self.step = 4; // play select
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
            self.step = 4; // play select
            self._renderStep();
        });
        area.querySelector('.result-btn.missed').addEventListener('click', function() {
            self.pending.result = 'missed';
            self.pending.points = 0;
            self.step = 4; // play select
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
            self.step = 4; // play select
            self._renderStep();
        });
    },

    // Step 4: Play select
    _renderPlaySelect: function(area) {
        var plays = SQT.Storage.getPlays();
        var stepNum = this.pending.shotType === 'turnover' ? '3' : '4';
        var html = '<div class="tap-prompt"><span class="step-label">Step ' + stepNum + ':</span> Offensive Play</div>';
        html += '<div class="play-select-grid">';
        for (var i = 0; i < plays.length; i++) {
            var p = plays[i];
            var cls = 'play-select-btn';
            if (p.color === 'blue') cls += ' play-blue';
            else if (p.color === 'orange') cls += ' play-orange';
            html += '<button class="' + cls + '" data-id="' + p.id + '" data-name="' + this._esc(p.name) + '">' + this._esc(p.name) + '</button>';
        }
        html += '</div>';
        area.innerHTML = html;

        var self = this;
        var btns = area.querySelectorAll('.play-select-btn');
        for (var b = 0; b < btns.length; b++) {
            btns[b].addEventListener('click', function() {
                self.pending.playId = this.getAttribute('data-id');
                self.pending.playName = this.getAttribute('data-name');
                self.step = 5; // grade
                self._renderStep();
            });
        }
    },

    // Step 5: Grade
    _renderGradeSelect: function(area) {
        var label = this.pending.shotLabel;
        if (this.pending.shotType === 'free_throws') {
            label = 'FT: ' + this.pending.result;
        } else if (this.pending.shotType === 'turnover') {
            label = 'Turnover';
        } else {
            label += ' — ' + (this.pending.result === 'made' ? 'Made' : 'Missed');
        }

        var gradeStepNum = this.pending.shotType === 'turnover' ? '4' : '5';
        var html = '<div class="tap-prompt"><span class="step-label">Step ' + gradeStepNum + ':</span> Possession Grade — ' + label + '</div>';
        html += '<div class="grade-grid">';
        html += '<button class="grade-btn gold" data-grade="gold"><svg class="grade-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>Gold</button>';
        html += '<button class="grade-btn silver" data-grade="silver"><svg class="grade-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="6"/><path d="M8 14l-2 8 6-3 6 3-2-8"/></svg>Silver</button>';
        html += '<button class="grade-btn bronze" data-grade="bronze"><svg class="grade-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="6"/><path d="M8 14l-2 8 6-3 6 3-2-8"/></svg>Bronze</button>';
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
                // Play select → back to result (or shot type for turnover, or FT)
                if (this.pending.shotType === 'turnover') this.step = 2;
                else if (this.pending.shotType === 'free_throws') this.step = 'ft';
                else this.step = 3;
            }
            else if (this.step === 5) this.step = 4; // Grade → back to play select
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

    // ---- Play List ----
    _showPlayList: function() {
        var self = this;
        var poss = this.game.possessions;

        var overlay = document.createElement('div');
        overlay.className = 'playlist-overlay';

        var html = '<div class="top-bar">' +
            '<button class="back-btn" id="playlist-close">&larr; Back</button>' +
            '<span class="title">Play List (' + poss.length + ')</span>' +
            '<span style="width:50px"></span></div>';
        html += '<div class="playlist-items">';

        if (poss.length === 0) {
            html += '<div class="roster-empty">No possessions logged yet.</div>';
        } else {
            for (var i = poss.length - 1; i >= 0; i--) {
                var p = poss[i];
                var shotLabel = self._shotLabel(p.shotType);
                var resultText, resultClass;
                if (p.shotType === 'turnover') {
                    resultText = 'TO';
                    resultClass = 'missed';
                } else if (p.shotType === 'free_throws') {
                    resultText = p.ftMade + '/' + p.ftAttempts + ' FT';
                    resultClass = p.ftMade > 0 ? 'made' : 'missed';
                } else {
                    resultText = p.result === 'made' ? 'Made' : 'Miss';
                    resultClass = p.result;
                }
                var gradeLabel = p.grade ? p.grade.charAt(0).toUpperCase() + p.grade.slice(1) : '';

                var initials = (p.playerName || '').split(' ').map(function(w) { return w.charAt(0); }).join('').toUpperCase();
                html += '<div class="playlist-item" data-idx="' + i + '">' +
                    '<div class="pl-num">' + (i + 1) + '</div>' +
                    '<div class="pl-detail">' +
                        '<span class="pl-player">#' + p.playerNumber + ' ' + initials + '</span> ' +
                        '<span class="pl-shot">' + shotLabel + '</span>' +
                        '<div style="font-size:11px;color:var(--text-muted);">' + p.quarter + (p.playName ? ' &bull; ' + self._esc(p.playName) : '') + '</div>' +
                    '</div>' +
                    '<span class="pl-result ' + resultClass + '">' + resultText + '</span>' +
                    '<span class="pl-grade ' + (p.grade || '') + '">' + gradeLabel + '</span>' +
                    '<button class="pl-edit" data-idx="' + i + '">Edit</button>' +
                '</div>';
            }
        }
        html += '</div>';
        overlay.innerHTML = html;
        document.body.appendChild(overlay);

        document.getElementById('playlist-close').addEventListener('click', function() {
            document.body.removeChild(overlay);
        });

        var editBtns = overlay.querySelectorAll('.pl-edit');
        for (var e = 0; e < editBtns.length; e++) {
            editBtns[e].addEventListener('click', function(ev) {
                ev.stopPropagation();
                var idx = parseInt(this.getAttribute('data-idx'));
                document.body.removeChild(overlay);
                self._editPossession(idx);
            });
        }
    },

    _editPossession: function(idx) {
        var self = this;
        var p = this.game.possessions[idx];
        if (!p) return;

        var overlay = document.createElement('div');
        overlay.className = 'edit-poss-overlay';

        var shotOptions = '';
        for (var i = 0; i < this.SHOT_TYPES.length; i++) {
            var s = this.SHOT_TYPES[i];
            var sel = (s.id === p.shotType) ? ' selected' : '';
            shotOptions += '<option value="' + s.id + '"' + sel + '>' + s.label + '</option>';
        }

        var resultOptions = '<option value="made"' + (p.result === 'made' ? ' selected' : '') + '>Made</option>' +
            '<option value="missed"' + (p.result === 'missed' ? ' selected' : '') + '>Missed</option>';

        var gradeOptions = '<option value="gold"' + (p.grade === 'gold' ? ' selected' : '') + '>Gold</option>' +
            '<option value="silver"' + (p.grade === 'silver' ? ' selected' : '') + '>Silver</option>' +
            '<option value="bronze"' + (p.grade === 'bronze' ? ' selected' : '') + '>Bronze</option>';

        var plays = SQT.Storage.getPlays();
        var playOptions = '';
        for (var pl2 = 0; pl2 < plays.length; pl2++) {
            var selPlay = (plays[pl2].id === p.playId) ? ' selected' : '';
            playOptions += '<option value="' + plays[pl2].id + '"' + selPlay + '>' + this._esc(plays[pl2].name) + '</option>';
        }

        var playerOptions = '';
        var roster = SQT.Roster.players;
        for (var r = 0; r < roster.length; r++) {
            var pl = roster[r];
            var sel2 = (pl.id === p.playerId) ? ' selected' : '';
            playerOptions += '<option value="' + pl.id + '"' + sel2 + '>#' + pl.number + ' ' + this._esc(pl.name) + '</option>';
        }

        overlay.innerHTML = '<div class="edit-poss-box">' +
            '<h3>Edit Possession #' + (idx + 1) + '</h3>' +
            '<div class="edit-field"><label>Player</label><select id="edit-player">' + playerOptions + '</select></div>' +
            '<div class="edit-field"><label>Shot Type</label><select id="edit-shot">' + shotOptions + '</select></div>' +
            '<div class="edit-field"><label>Result</label><select id="edit-result">' + resultOptions + '</select></div>' +
            '<div class="edit-field"><label>Play</label><select id="edit-play">' + playOptions + '</select></div>' +
            '<div class="edit-field"><label>Grade</label><select id="edit-grade">' + gradeOptions + '</select></div>' +
            '<div class="edit-poss-actions">' +
                '<button class="btn" id="edit-cancel">Cancel</button>' +
                '<button class="btn btn-danger" id="edit-delete">Delete</button>' +
                '<button class="btn btn-primary" id="edit-save">Save</button>' +
            '</div></div>';

        document.body.appendChild(overlay);

        overlay.addEventListener('click', function(ev) {
            if (ev.target === overlay) document.body.removeChild(overlay);
        });
        document.getElementById('edit-cancel').addEventListener('click', function() {
            document.body.removeChild(overlay);
            self._showPlayList();
        });
        document.getElementById('edit-delete').addEventListener('click', function() {
            self.game.possessions.splice(idx, 1);
            SQT.Storage.saveGame(self.game);
            self._updateMiniStats();
            document.body.removeChild(overlay);
            SQT.App.toast('Possession deleted');
            self._showPlayList();
        });
        document.getElementById('edit-save').addEventListener('click', function() {
            var selPlayer = document.getElementById('edit-player');
            var playerId = selPlayer.value;
            var playerOpt = selPlayer.options[selPlayer.selectedIndex].text;
            var numMatch = playerOpt.match(/#(\d+)\s+(.*)/);

            p.playerId = playerId;
            if (numMatch) {
                p.playerNumber = numMatch[1];
                p.playerName = numMatch[2];
            }

            var newShot = document.getElementById('edit-shot').value;
            p.shotType = newShot;
            p.result = document.getElementById('edit-result').value;
            p.grade = document.getElementById('edit-grade').value;

            var selPlayEl = document.getElementById('edit-play');
            p.playId = selPlayEl.value;
            p.playName = selPlayEl.options[selPlayEl.selectedIndex].text;

            // Recalculate points
            if (newShot === 'turnover') {
                p.result = 'missed';
                p.points = 0;
            } else if (newShot === 'free_throws') {
                p.points = p.ftMade || 0;
            } else {
                var shotDef = null;
                for (var s = 0; s < self.SHOT_TYPES.length; s++) {
                    if (self.SHOT_TYPES[s].id === newShot) { shotDef = self.SHOT_TYPES[s]; break; }
                }
                p.points = (p.result === 'made' && shotDef) ? shotDef.points : 0;
            }

            SQT.Storage.saveGame(self.game);
            self._updateMiniStats();
            document.body.removeChild(overlay);
            SQT.App.toast('Possession updated');
            self._showPlayList();
        });
    },

    _shotLabel: function(type) {
        var map = {
            'open_layup': 'Open Layup', 'contested_layup': 'Contested Layup',
            'open_mid': 'Open Mid', 'contested_mid': 'Contested Mid',
            'open_3': 'Open 3', 'contested_3': 'Contested 3',
            'free_throws': 'Free Throws', 'turnover': 'Turnover'
        };
        return map[type] || type;
    },

    _esc: function(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};

window.SQT = SQT;
