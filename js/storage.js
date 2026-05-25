/**
 * localStorage persistence for roster, games, and seasons.
 */
var SQT = window.SQT || {};

SQT.Storage = {
    ROSTER_KEY: 'sqt_roster',
    GAMES_KEY: 'sqt_games',
    SEASONS_KEY: 'sqt_seasons',
    ACTIVE_SEASON_KEY: 'sqt_active_season',
    ACTIVE_GAME_KEY: 'sqt_active_game',
    LIVE_GAME_KEY: 'sqt_live_game',
    PLAYS_KEY: 'sqt_plays',

    // ---- Roster (season-scoped) ----
    _rosterKey: function(seasonId) {
        var sid = seasonId || localStorage.getItem(this.ACTIVE_SEASON_KEY);
        return sid ? 'sqt_roster_' + sid : this.ROSTER_KEY;
    },

    getRoster: function(seasonId) {
        try {
            var data = localStorage.getItem(this._rosterKey(seasonId));
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    },

    saveRoster: function(roster, seasonId) {
        try {
            localStorage.setItem(this._rosterKey(seasonId), JSON.stringify(roster));
        } catch (e) {
            console.error('saveRoster storage error:', e);
            if (window.SQT && SQT.App) SQT.App.toast('Storage full — data may not be saved');
        }
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
        try {
            localStorage.setItem(this.GAMES_KEY, JSON.stringify(games));
            return true;
        } catch (e) {
            console.error('saveGames error:', e);
            if (window.SQT && SQT.App) SQT.App.toast('Storage full — clear old data');
            return false;
        }
    },

    saveGame: function(game) {
        // During live tracking, write only the single game to a dedicated key
        var activeId = localStorage.getItem(this.ACTIVE_GAME_KEY);
        if (activeId && game.id === activeId) {
            try {
                localStorage.setItem(this.LIVE_GAME_KEY, JSON.stringify(game));
            } catch (e) {
                console.error('saveGame (live) storage error:', e);
                if (window.SQT && SQT.App) SQT.App.toast('Storage full — possession may not be saved');
            }
            return;
        }
        // Non-live save: merge into full games list
        this._mergeGameToList(game);
    },

    // Flush live game data into the full games list (call on game end)
    flushLiveGame: function() {
        var data = localStorage.getItem(this.LIVE_GAME_KEY);
        if (!data) return true;
        try {
            var game = JSON.parse(data);
            var merged = this._mergeGameToList(game);
            if (merged !== false) {
                localStorage.removeItem(this.LIVE_GAME_KEY);
            }
            return merged !== false;
        } catch (e) {
            console.error('flushLiveGame parse/save error:', e);
            if (window.SQT && SQT.App) SQT.App.toast('Error saving game data — please screenshot before closing');
            return false;
        }
    },

    _mergeGameToList: function(game) {
        var games = this.getGames();
        var found = false;
        for (var i = 0; i < games.length; i++) {
            if (games[i].id === game.id) { games[i] = game; found = true; break; }
        }
        if (!found) games.push(game);
        return this.saveGames(games);  // propagate success/failure
    },

    deleteGame: function(gameId) {
        var games = this.getGames();
        this.saveGames(games.filter(function(g) { return g.id !== gameId; }));
    },

    _recoverOrphanedLiveGame: function() {
        var liveData = localStorage.getItem(this.LIVE_GAME_KEY);
        if (!liveData) return;
        try {
            var liveGame = JSON.parse(liveData);
            if (!liveGame || !liveGame.id) return; // guard against partial/corrupt JSON
            var activeId = localStorage.getItem(this.ACTIVE_GAME_KEY);
            if (!activeId) {
                // ACTIVE_GAME_KEY was wiped but live game still exists — restore it
                localStorage.setItem(this.ACTIVE_GAME_KEY, liveGame.id);
            } else if (activeId !== liveGame.id) {
                // Mismatch: live key belongs to a different game ID
                // If the live game is already in sqt_games with a result, it's a stale key
                var games = this.getGames();
                var removed = false;
                for (var i = 0; i < games.length; i++) {
                    if (games[i].id === liveGame.id && games[i].result) {
                        localStorage.removeItem(this.LIVE_GAME_KEY);
                        removed = true;
                        break;
                    }
                }
                if (!removed) {
                    // If we get here, live key is for an in-progress game with different ID — leave it, next save will overwrite
                    console.warn('_recoverOrphanedLiveGame: activeId mismatch, no result found for live game', liveGame.id);
                }
            }
        } catch (e) {
            console.error('_recoverOrphanedLiveGame error:', e);
        }
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
        try {
            localStorage.setItem(this.SEASONS_KEY, JSON.stringify(seasons));
        } catch (e) {
            console.error('saveSeasons storage error:', e);
            if (window.SQT && SQT.App) SQT.App.toast('Storage full — data may not be saved');
        }
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

    getActiveGame: function() {
        var id = localStorage.getItem(this.ACTIVE_GAME_KEY);
        if (!id) return null;
        // Check live game key first (most up-to-date during tracking)
        var liveData = localStorage.getItem(this.LIVE_GAME_KEY);
        if (liveData) {
            try {
                var liveGame = JSON.parse(liveData);
                if (liveGame.id === id) return liveGame;
            } catch (e) {}
        }
        var games = this.getGames();
        for (var i = 0; i < games.length; i++) {
            if (games[i].id === id) return games[i];
        }
        return null;
    },

    setActiveGame: function(id) {
        if (id) {
            localStorage.setItem(this.ACTIVE_GAME_KEY, id);
        } else {
            var flushed = this.flushLiveGame();
            if (flushed !== false) { // treat undefined as success (backward compat with pre-boolean callers)
                localStorage.removeItem(this.ACTIVE_GAME_KEY);
            }
        }
    },

    // ---- Plays (season-scoped) ----
    _playsKey: function(seasonId) {
        var sid = seasonId || localStorage.getItem(this.ACTIVE_SEASON_KEY);
        return sid ? 'sqt_plays_' + sid : this.PLAYS_KEY;
    },

    getPlays: function(seasonId) {
        try {
            var data = localStorage.getItem(this._playsKey(seasonId));
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    },

    savePlays: function(plays, seasonId) {
        try {
            localStorage.setItem(this._playsKey(seasonId), JSON.stringify(plays));
        } catch (e) {
            console.error('savePlays storage error:', e);
            if (window.SQT && SQT.App) SQT.App.toast('Storage full — data may not be saved');
        }
    },

    initDefaultPlays: function(seasonId) {
        var plays = this.getPlays(seasonId);
        if (plays.length > 0) return;
        var defaults = [
            { id: this.uuid(), name: 'Transition', color: 'blue', order: 0, isDefault: true },
            { id: this.uuid(), name: 'No Play', color: 'orange', order: 1, isDefault: true }
        ];
        this.savePlays(defaults, seasonId);
    },

    // One-time migration: tag existing games with a default season
    migrate: function() {
        var seasons = this.getSeasons();
        if (seasons.length === 0) {
            var games = this.getGames();
            if (games.length === 0) return;

            var defaultSeason = {
                id: this.uuid(),
                name: 'Default Season',
                createdAt: new Date().toISOString(),
                endedAt: null,
                isActive: true
            };
            this.saveSeasons([defaultSeason]);
            this.setActiveSeason(defaultSeason.id);

            for (var i = 0; i < games.length; i++) {
                if (!games[i].seasonId) games[i].seasonId = defaultSeason.id;
            }
            this.saveGames(games);
        }

        // Migrate global roster/plays to season-scoped keys
        this._migrateRosterPlays();
        // NEW: recover any orphaned live-game state from abnormal shutdowns
        this._recoverOrphanedLiveGame();
    },

    _migrateRosterPlays: function() {
        if (localStorage.getItem('sqt_roster_migrated')) return;
        var sid = localStorage.getItem(this.ACTIVE_SEASON_KEY);
        if (!sid) return;

        // Move global roster to active season if season key doesn't exist yet
        var globalRoster = localStorage.getItem(this.ROSTER_KEY);
        if (globalRoster && !localStorage.getItem('sqt_roster_' + sid)) {
            localStorage.setItem('sqt_roster_' + sid, globalRoster);
        }

        var globalPlays = localStorage.getItem(this.PLAYS_KEY);
        if (globalPlays && !localStorage.getItem('sqt_plays_' + sid)) {
            localStorage.setItem('sqt_plays_' + sid, globalPlays);
        }

        localStorage.setItem('sqt_roster_migrated', '1');
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
