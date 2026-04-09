/**
 * Bootstrap — screen navigation, state management, init.
 */
var SQT = window.SQT || {};

SQT.App = {
    currentScreen: 'home',
    currentGame: null,  // Active game object during tracking

    init: function() {
        // Initialize modules
        SQT.Roster.init();

        // Bind home screen buttons
        this._bindHome();

        // Show home
        this.showScreen('home');
        this._updateSeasonRecord();

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
            self.showScreen('setup');
            if (SQT.Game) SQT.Game.initSetup();
        });
        document.getElementById('btn-roster').addEventListener('click', function() {
            self.showScreen('roster');
        });
        document.getElementById('btn-history').addEventListener('click', function() {
            self.showScreen('history');
            if (SQT.Game) SQT.Game.renderHistory();
        });
        document.getElementById('btn-season').addEventListener('click', function() {
            self.showScreen('dashboard');
            if (SQT.Dashboard) SQT.Dashboard.showSeason();
        });

        // Back buttons
        document.getElementById('roster-back').addEventListener('click', function() {
            self.showScreen('home');
        });
        document.getElementById('setup-back').addEventListener('click', function() {
            self.showScreen('home');
        });
        document.getElementById('history-back').addEventListener('click', function() {
            self.showScreen('home');
            self._updateSeasonRecord();
        });
    },

    _updateSeasonRecord: function() {
        var games = SQT.Storage.getGames();
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

    // ---- Toast ----
    toast: function(msg) {
        var el = document.getElementById('toast');
        el.textContent = msg;
        el.classList.add('visible');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(function() {
            el.classList.remove('visible');
        }, 2000);
    }
};

// Boot
document.addEventListener('DOMContentLoaded', function() {
    SQT.App.init();
});

window.SQT = SQT;
