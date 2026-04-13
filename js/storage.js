/**
 * localStorage persistence for roster, games, and seasons.
 */
var SQT = window.SQT || {};

SQT.Storage = {
    ROSTER_KEY: 'sqt_roster',
    GAMES_KEY: 'sqt_games',
    SEASONS_KEY: 'sqt_seasons',
    ACTIVE_SEASON_KEY: 'sqt_active_season',

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

    // ---- Seasons ----
    getSeasons: function() {
        try {
            var data = localStorage.getItem(this.SEASONS_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    },

    saveSeasons: function(seasons) {
        localStorage.setItem(this.SEASONS_KEY, JSON.stringify(seasons));
    },

    getActiveSeason: function() {
        var id = localStorage.getItem(this.ACTIVE_SEASON_KEY);
        if (!id) return null;
        var seasons = this.getSeasons();
        for (var i = 0; i < seasons.length; i++) {
            if (seasons[i].id === id) return seasons[i];
        }
        return null;
    },

    setActiveSeason: function(id) {
        localStorage.setItem(this.ACTIVE_SEASON_KEY, id);
    },

    getGamesBySeason: function(seasonId) {
        var games = this.getGames();
        return games.filter(function(g) { return g.seasonId === seasonId; });
    },

    // One-time migration: tag existing games with a default season
    migrate: function() {
        var seasons = this.getSeasons();
        if (seasons.length > 0) return; // already migrated

        var games = this.getGames();
        if (games.length === 0) {
            // No games, no migration needed — user will create first season
            return;
        }

        // Create a default season for existing data
        var defaultSeason = {
            id: this.uuid(),
            name: 'Default Season',
            createdAt: new Date().toISOString(),
            endedAt: null,
            isActive: true
        };
        this.saveSeasons([defaultSeason]);
        this.setActiveSeason(defaultSeason.id);

        // Tag all existing games
        for (var i = 0; i < games.length; i++) {
            if (!games[i].seasonId) {
                games[i].seasonId = defaultSeason.id;
            }
        }
        this.saveGames(games);
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
