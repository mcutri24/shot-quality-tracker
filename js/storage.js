/**
 * localStorage persistence for roster and games.
 */
var SQT = window.SQT || {};

SQT.Storage = {
    ROSTER_KEY: 'sqt_roster',
    GAMES_KEY: 'sqt_games',

    // ---- Roster ----
    getRoster: function() {
        try {
            var data = localStorage.getItem(this.ROSTER_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    },

    saveRoster: function(roster) {
        localStorage.setItem(this.ROSTER_KEY, JSON.stringify(roster));
    },

    // ---- Games ----
    getGames: function() {
        try {
            var data = localStorage.getItem(this.GAMES_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    },

    saveGames: function(games) {
        localStorage.setItem(this.GAMES_KEY, JSON.stringify(games));
    },

    saveGame: function(game) {
        var games = this.getGames();
        var idx = -1;
        for (var i = 0; i < games.length; i++) {
            if (games[i].id === game.id) { idx = i; break; }
        }
        if (idx >= 0) {
            games[idx] = game;
        } else {
            games.push(game);
        }
        this.saveGames(games);
    },

    deleteGame: function(gameId) {
        var games = this.getGames();
        this.saveGames(games.filter(function(g) { return g.id !== gameId; }));
    },

    // ---- Utility ----
    uuid: function() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    }
};

window.SQT = SQT;
