/**
 * Bootstrap — screen navigation, state management, season manager, init.
 */
var SQT = window.SQT || {};

SQT.App = {
    currentScreen: 'home',
    currentGame: null,  // Active game object during tracking

    init: function() {
        // Run migration for existing data
        SQT.Storage.migrate();

        // Initialize modules
        SQT.Roster.init();
        SQT.Plays.init();

        // Bind home screen buttons
        this._bindHome();

        // Show home
        this.showScreen('home');
        this._updateSeasonRecord();
        this._updateSeasonName();

        console.log('Shot Quality Tracker initialized');
    },

    // ---- Screen Navigation ----
    showScreen: function(screenId) {
        var screens = document.querySelectorAll('.screen');
        for (var i = 0; i < screens.length; i++) {
            screens[i].classList.remove('active');
        }
        var el = document.getElementById(screenId + '-screen');
        if (el) {
            el.classList.add('active');
            this.currentScreen = screenId;
        }
    },

    // ---- Home Screen ----
    _bindHome: function() {
        var self = this;
        document.getElementById('btn-new-game').addEventListener('click', function() {
            var active = SQT.Storage.getActiveSeason();
            if (!active) {
                SQT.App.toast('Create a season first');
                self.showScreen('seasons');
                self._renderSeasons();
                return;
            }
            self.showScreen('setup');
            if (SQT.Game) SQT.Game.initSetup();
        });
        document.getElementById('btn-roster').addEventListener('click', function() {
            self.showScreen('roster');
        });
        document.getElementById('btn-plays').addEventListener('click', function() {
            self.showScreen('plays');
        });
        document.getElementById('btn-history').addEventListener('click', function() {
            self.showScreen('history');
            if (SQT.Game) SQT.Game.renderHistory();
        });
        document.getElementById('btn-season').addEventListener('click', function() {
            self.showScreen('dashboard');
            if (SQT.Dashboard) SQT.Dashboard.showSeason();
        });
        document.getElementById('btn-seasons-mgr').addEventListener('click', function() {
            self.showScreen('seasons');
            self._renderSeasons();
        });

        // Back buttons
        document.getElementById('roster-back').addEventListener('click', function() {
            self.showScreen('home');
        });
        document.getElementById('plays-back').addEventListener('click', function() {
            self.showScreen('home');
        });
        document.getElementById('setup-back').addEventListener('click', function() {
            self.showScreen('home');
        });
        document.getElementById('history-back').addEventListener('click', function() {
            self.showScreen('home');
            self._updateSeasonRecord();
        });
        document.getElementById('seasons-back').addEventListener('click', function() {
            self.showScreen('home');
            self._updateSeasonRecord();
            self._updateSeasonName();
        });

        // New season button
        document.getElementById('btn-new-season').addEventListener('click', function() {
            self._createNewSeason();
        });
    },

    _updateSeasonName: function() {
        var el = document.getElementById('home-season-name');
        var active = SQT.Storage.getActiveSeason();
        if (active) {
            el.textContent = active.name;
            el.style.display = 'block';
        } else {
            el.textContent = 'No active season';
            el.style.display = 'block';
        }
    },

    _updateSeasonRecord: function() {
        var active = SQT.Storage.getActiveSeason();
        var games = active ? SQT.Storage.getGamesBySeason(active.id) : [];
        var wins = 0, losses = 0, totalPts = 0, totalPoss = 0;
        for (var i = 0; i < games.length; i++) {
            var g = games[i];
            if (g.result === 'W') wins++;
            else if (g.result === 'L') losses++;
            if (g.possessions) {
                totalPoss += g.possessions.length;
                for (var j = 0; j < g.possessions.length; j++) {
                    totalPts += g.possessions[j].points || 0;
                }
            }
        }
        document.getElementById('season-wins').textContent = wins;
        document.getElementById('season-losses').textContent = losses;
        var ppp = totalPoss > 0 ? (totalPts / totalPoss).toFixed(2) : '—';
        document.getElementById('season-ppp').textContent = 'Season PPP: ' + ppp;
    },

    // ---- Season Manager ----
    _renderSeasons: function() {
        var self = this;
        var seasons = SQT.Storage.getSeasons();
        var activeId = (SQT.Storage.getActiveSeason() || {}).id;
        var content = document.getElementById('seasons-content');

        // Sort: active first, then newest
        seasons.sort(function(a, b) {
            if (a.id === activeId) return -1;
            if (b.id === activeId) return 1;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        if (seasons.length === 0) {
            content.innerHTML = '<div class="history-empty">No seasons yet. Create your first season below!</div>';
            return;
        }

        var html = '';
        for (var i = 0; i < seasons.length; i++) {
            var s = seasons[i];
            var isActive = s.id === activeId;
            var games = SQT.Storage.getGamesBySeason(s.id);
            var wins = 0, losses = 0;
            for (var j = 0; j < games.length; j++) {
                if (games[j].result === 'W') wins++;
                else if (games[j].result === 'L') losses++;
            }
            var statusBadge = isActive
                ? '<span class="season-badge active">ACTIVE</span>'
                : (s.endedAt ? '<span class="season-badge ended">ENDED</span>' : '<span class="season-badge">INACTIVE</span>');

            html += '<div class="season-item' + (isActive ? ' active' : '') + '" data-id="' + s.id + '">' +
                '<div class="season-info">' +
                    '<div class="season-name">' + this._esc(s.name) + ' ' + statusBadge + '</div>' +
                    '<div class="season-meta">' + games.length + ' game' + (games.length !== 1 ? 's' : '') + ' &bull; ' + wins + 'W-' + losses + 'L</div>' +
                '</div>' +
                '<div class="season-actions">';

            if (isActive) {
                html += '<button class="btn-sm btn-end-season" data-id="' + s.id + '">End Season</button>';
            } else {
                html += '<button class="btn-sm btn-activate-season" data-id="' + s.id + '">Set Active</button>';
                html += '<button class="btn-sm btn-delete-season" data-id="' + s.id + '" style="color:var(--red);">Delete</button>';
            }

            html += '</div></div>';
        }
        content.innerHTML = html;

        // Bind actions
        var items = content.querySelectorAll('.season-item');
        for (var k = 0; k < items.length; k++) {
            items[k].addEventListener('click', function(ev) {
                if (ev.target.closest('.season-actions')) return;
                var sid = this.getAttribute('data-id');
                // View this season's stats
                SQT.App.showScreen('dashboard');
                SQT.Dashboard.showSeason(sid);
            });
        }

        var endBtns = content.querySelectorAll('.btn-end-season');
        for (var e = 0; e < endBtns.length; e++) {
            endBtns[e].addEventListener('click', function(ev) {
                ev.stopPropagation();
                if (confirm('End this season? You can still view its stats later.')) {
                    var sid = this.getAttribute('data-id');
                    var seasons2 = SQT.Storage.getSeasons();
                    for (var s2 = 0; s2 < seasons2.length; s2++) {
                        if (seasons2[s2].id === sid) {
                            seasons2[s2].endedAt = new Date().toISOString();
                            seasons2[s2].isActive = false;
                        }
                    }
                    SQT.Storage.saveSeasons(seasons2);
                    localStorage.removeItem(SQT.Storage.ACTIVE_SEASON_KEY);
                    SQT.App.toast('Season ended');
                    self._renderSeasons();
                }
            });
        }

        var actBtns = content.querySelectorAll('.btn-activate-season');
        for (var a = 0; a < actBtns.length; a++) {
            actBtns[a].addEventListener('click', function(ev) {
                ev.stopPropagation();
                var sid = this.getAttribute('data-id');
                var seasons2 = SQT.Storage.getSeasons();
                for (var s2 = 0; s2 < seasons2.length; s2++) {
                    seasons2[s2].isActive = (seasons2[s2].id === sid);
                    if (seasons2[s2].id === sid) {
                        seasons2[s2].endedAt = null;
                    }
                }
                SQT.Storage.saveSeasons(seasons2);
                SQT.Storage.setActiveSeason(sid);
                SQT.App.toast('Season activated');
                self._renderSeasons();
            });
        }

        var delBtns = content.querySelectorAll('.btn-delete-season');
        for (var d = 0; d < delBtns.length; d++) {
            delBtns[d].addEventListener('click', function(ev) {
                ev.stopPropagation();
                var sid = this.getAttribute('data-id');
                var seasonGames = SQT.Storage.getGamesBySeason(sid);
                var msg = 'Delete this season';
                if (seasonGames.length > 0) {
                    msg += ' and its ' + seasonGames.length + ' game' + (seasonGames.length !== 1 ? 's' : '') + '?';
                } else {
                    msg += '?';
                }
                msg += ' This cannot be undone.';
                if (confirm(msg)) {
                    // Delete games for this season
                    var allGames = SQT.Storage.getGames();
                    SQT.Storage.saveGames(allGames.filter(function(g) { return g.seasonId !== sid; }));
                    // Delete season
                    var seasons2 = SQT.Storage.getSeasons();
                    SQT.Storage.saveSeasons(seasons2.filter(function(s2) { return s2.id !== sid; }));
                    SQT.App.toast('Season deleted');
                    self._renderSeasons();
                }
            });
        }
    },

    _createNewSeason: function() {
        var name = prompt('Season name (e.g. 2026-2027 NA Season):');
        if (!name || !name.trim()) return;

        var seasons = SQT.Storage.getSeasons();
        // Deactivate all
        for (var i = 0; i < seasons.length; i++) {
            seasons[i].isActive = false;
        }

        var newSeason = {
            id: SQT.Storage.uuid(),
            name: name.trim(),
            createdAt: new Date().toISOString(),
            endedAt: null,
            isActive: true
        };
        seasons.push(newSeason);
        SQT.Storage.saveSeasons(seasons);
        SQT.Storage.setActiveSeason(newSeason.id);

        SQT.App.toast('Season created!');
        this._renderSeasons();
    },

    // ---- Toast ----
    toast: function(msg) {
        var el = document.getElementById('toast');
        el.textContent = msg;
        el.classList.add('visible');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(function() {
            el.classList.remove('visible');
        }, 2000);
    },

    _esc: function(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};

// Boot
document.addEventListener('DOMContentLoaded', function() {
    SQT.App.init();
});

window.SQT = SQT;
