/**
 * Game lifecycle — new game setup, quarter management, final score, W/L.
 */
var SQT = window.SQT || {};

SQT.Game = {
    initSetup: function() {
        // Default date to today
        var dateInput = document.getElementById('setup-date');
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
        // Bind location toggle
        var toggleBtns = document.querySelectorAll('#setup-screen .toggle-group button');
        for (var i = 0; i < toggleBtns.length; i++) {
            toggleBtns[i].addEventListener('click', function() {
                for (var j = 0; j < toggleBtns.length; j++) toggleBtns[j].classList.remove('active');
                this.classList.add('active');
            });
        }
    },

    startGame: function() {
        var opponent = document.getElementById('setup-opponent').value.trim();
        if (!opponent) {
            SQT.App.toast('Enter opponent name');
            return;
        }

        var active = SQT.Storage.getActiveSeason();
        if (!active) {
            SQT.App.toast('Create a season first');
            return;
        }

        var date = document.getElementById('setup-date').value;
        var locationBtn = document.querySelector('#setup-screen .toggle-group button.active');
        var location = locationBtn ? locationBtn.textContent.trim() : 'Home';

        var game = {
            id: SQT.Storage.uuid(),
            seasonId: active.id,
            opponent: opponent,
            date: date,
            location: location,
            possessions: [],
            finalScoreUs: null,
            finalScoreThem: null,
            result: null,
            createdAt: new Date().toISOString()
        };

        SQT.App.currentGame = game;
        SQT.Storage.saveGame(game);
        SQT.Storage.setActiveGame(game.id);

        // Clear setup form
        document.getElementById('setup-opponent').value = '';

        SQT.App.showScreen('tracking');
        if (SQT.Tracker) SQT.Tracker.start(game);
    },

    endGame: function() {
        SQT.App.showScreen('postgame');
        var game = SQT.App.currentGame;
        if (game) {
            document.getElementById('postgame-opponent').textContent = 'vs ' + game.opponent;
            document.getElementById('postgame-us-label').textContent = 'NA';
            document.getElementById('postgame-them-label').textContent = game.opponent;

            // Auto-populate NA score from tracked possessions
            var totalPts = 0;
            if (game.possessions) {
                for (var i = 0; i < game.possessions.length; i++) {
                    totalPts += game.possessions[i].points || 0;
                }
            }
            document.getElementById('score-us').value = totalPts;
            document.getElementById('score-them').value = '';
        }
    },

    savePostGame: function() {
        var game = SQT.App.currentGame;
        if (!game) return;

        var scoreUs = parseInt(document.getElementById('score-us').value) || 0;
        var scoreThem = parseInt(document.getElementById('score-them').value) || 0;

        game.finalScoreUs = scoreUs;
        game.finalScoreThem = scoreThem;
        game.result = scoreUs > scoreThem ? 'W' : 'L';

        SQT.Storage.saveGame(game);
        SQT.Storage.setActiveGame(null);
        SQT.App.currentGame = null;

        // Reset score inputs
        document.getElementById('score-us').value = '';
        document.getElementById('score-them').value = '';

        SQT.App.showScreen('home');
        SQT.App._updateSeasonRecord();
        SQT.App.toast('Game saved!');
    },

    // seasonId param: if provided, show that season's games; otherwise active season
    renderHistory: function(seasonId) {
        var sid = seasonId;
        if (!sid) {
            var active = SQT.Storage.getActiveSeason();
            sid = active ? active.id : null;
        }
        var games = sid ? SQT.Storage.getGamesBySeason(sid) : [];
        var list = document.getElementById('history-list');

        // Sort newest first
        games.sort(function(a, b) {
            return new Date(b.date) - new Date(a.date);
        });

        if (games.length === 0) {
            list.innerHTML = '<div class="history-empty">No games yet. Start a new game!</div>';
            return;
        }

        var html = '';
        for (var i = 0; i < games.length; i++) {
            var g = games[i];
            var poss = g.possessions ? g.possessions.length : 0;
            var pts = 0;
            if (g.possessions) {
                for (var j = 0; j < g.possessions.length; j++) {
                    pts += g.possessions[j].points || 0;
                }
            }
            var ppp = poss > 0 ? (pts / poss).toFixed(2) : '—';
            var score = (g.finalScoreUs !== null) ? g.finalScoreUs + '-' + g.finalScoreThem : '—';
            var badge = g.result || '?';

            html += '<div class="history-item" data-id="' + g.id + '">' +
                '<div class="result-badge ' + badge + '">' + badge + '</div>' +
                '<div class="game-details">' +
                    '<div class="game-opp">' + this._esc(g.opponent) + '</div>' +
                    '<div class="game-meta">' + (g.date || '') + ' &bull; ' + (g.location || '') + '</div>' +
                '</div>' +
                '<div style="text-align:right">' +
                    '<div class="game-score">' + score + '</div>' +
                    '<div class="game-ppp">PPP: ' + ppp + '</div>' +
                '</div>' +
                '<button class="history-delete-btn" data-id="' + g.id + '" style="background:none;color:var(--red);font-size:18px;padding:4px 8px;flex-shrink:0;">&#10005;</button>' +
            '</div>';
        }
        list.innerHTML = html;

        // Bind delete buttons
        var self = this;
        var delBtns = list.querySelectorAll('.history-delete-btn');
        for (var d = 0; d < delBtns.length; d++) {
            delBtns[d].addEventListener('click', function(ev) {
                ev.stopPropagation();
                var gameId = this.getAttribute('data-id');
                if (confirm('Delete this game? This cannot be undone.')) {
                    SQT.Storage.deleteGame(gameId);
                    self.renderHistory(sid);
                    SQT.App.toast('Game deleted');
                }
            });
        }

        // Bind clicks to view game dashboard
        var items = list.querySelectorAll('.history-item');
        for (var k = 0; k < items.length; k++) {
            items[k].addEventListener('click', function() {
                var gameId = this.getAttribute('data-id');
                var allGames = SQT.Storage.getGames();
                for (var m = 0; m < allGames.length; m++) {
                    if (allGames[m].id === gameId) {
                        SQT.App.showScreen('dashboard');
                        if (SQT.Dashboard) SQT.Dashboard.showGame(allGames[m]);
                        return;
                    }
                }
            });
        }
    },

    _esc: function(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};

window.SQT = SQT;
