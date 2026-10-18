/**
 * Data context builder for AI assistant.
 * Reads localStorage via SQT.Storage and builds JSON payloads for Claude.
 */
var SQT = window.SQT || {};

SQT.AssistantContext = {
    /**
     * Build context for the current app state.
     * Returns { mode, systemPrompt, dataContext }
     * mode: 'live-game' | 'season'
     */
    build: function() {
        var activeGame = SQT.Storage.getActiveGame();
        var isLiveGame = activeGame && !activeGame.result;

        if (isLiveGame) {
            return this._buildLiveGameContext(activeGame);
        }
        return this._buildSeasonContext();
    },

    _buildLiveGameContext: function(game) {
        var season = SQT.Storage.getActiveSeason();
        var seasonId = season ? season.id : null;
        var roster = SQT.Storage.getRoster(seasonId);
        var plays = SQT.Storage.getPlays(seasonId);

        var stats = this._computeGameStats(game);

        var dataContext = '## CURRENT LIVE GAME DATA\n\n' +
            'Opponent: ' + game.opponent + '\n' +
            'Location: ' + game.location + '\n' +
            'Date: ' + game.date + '\n' +
            'Possessions: ' + stats.totalPoss + '\n' +
            'Points: ' + stats.totalPts + '\n' +
            'PPP: ' + stats.ppp + '\n' +
            'FG%: ' + stats.fgPct + '\n' +
            'Current quarter: ' + this._getCurrentQuarter(game) + '\n\n' +
            '### Roster\n' + JSON.stringify(roster.map(function(p) {
                return { number: p.number, name: p.name, id: p.id };
            })) + '\n\n' +
            '### Plays\n' + JSON.stringify(plays.map(function(p) {
                return { name: p.name, id: p.id };
            })) + '\n\n' +
            '### All Possessions\n' + JSON.stringify(game.possessions || []) + '\n\n' +
            '### Timeouts\n' + JSON.stringify(game.timeouts || {}) + '\n\n' +
            '### Fouls\n' + JSON.stringify(game.fouls || {});

        return {
            mode: 'live-game',
            systemPrompt: this._systemPrompt('live-game', game.opponent),
            dataContext: dataContext
        };
    },

    _buildSeasonContext: function() {
        var season = SQT.Storage.getActiveSeason();
        if (!season) {
            return {
                mode: 'season',
                systemPrompt: this._systemPrompt('season', null),
                dataContext: 'No active season. The coach needs to create a season first.'
            };
        }

        var seasonId = season.id;
        var games = SQT.Storage.getGamesBySeason(seasonId);
        var roster = SQT.Storage.getRoster(seasonId);
        var plays = SQT.Storage.getPlays(seasonId);

        // Build per-game summaries
        var gameSummaries = [];
        for (var i = 0; i < games.length; i++) {
            var g = games[i];
            var stats = this._computeGameStats(g);
            gameSummaries.push({
                id: g.id,
                opponent: g.opponent,
                date: g.date,
                location: g.location,
                result: g.result || 'in-progress',
                finalScoreUs: g.finalScoreUs,
                finalScoreThem: g.finalScoreThem,
                possessions: stats.totalPoss,
                points: stats.totalPts,
                ppp: stats.ppp,
                fgPct: stats.fgPct,
                threePct: stats.threePct,
                ftPct: stats.ftPct,
                turnovers: stats.turnovers
            });
        }

        // Include possession data (cap at most recent 15 games to avoid token limits)
        var maxGamesForPossessions = 15;
        var startIdx = games.length > maxGamesForPossessions ? games.length - maxGamesForPossessions : 0;
        var allPossessions = [];
        for (var j = startIdx; j < games.length; j++) {
            var gp = games[j];
            if (gp.possessions) {
                for (var k = 0; k < gp.possessions.length; k++) {
                    var poss = gp.possessions[k];
                    allPossessions.push({
                        gameId: gp.id,
                        opponent: gp.opponent,
                        date: gp.date,
                        result: gp.result,
                        quarter: poss.quarter,
                        playerId: poss.playerId,
                        playerNumber: poss.playerNumber,
                        playerName: poss.playerName,
                        shotType: poss.shotType,
                        playName: poss.playName,
                        result_poss: poss.result,
                        points: poss.points,
                        grade: poss.grade,
                        and1: poss.and1 || false,
                        ftMade: poss.ftMade || 0,
                        ftAttempts: poss.ftAttempts || 0
                    });
                }
            }
        }

        var dataContext = '## SEASON DATA: ' + season.name + '\n\n' +
            '### Game Summaries (' + games.length + ' games)\n' +
            JSON.stringify(gameSummaries, null, 1) + '\n\n' +
            '### Roster\n' + JSON.stringify(roster.map(function(p) {
                return { number: p.number, name: p.name, id: p.id };
            })) + '\n\n' +
            '### Plays\n' + JSON.stringify(plays.map(function(p) {
                return { name: p.name, id: p.id };
            })) + '\n\n' +
            '### All Possessions (' + allPossessions.length + ' total)\n' +
            JSON.stringify(allPossessions);

        return {
            mode: 'season',
            systemPrompt: this._systemPrompt('season', null),
            dataContext: dataContext
        };
    },

    _computeGameStats: function(game) {
        var poss = game.possessions || [];
        var totalPts = 0, fgMade = 0, fgAtt = 0, threeMade = 0, threeAtt = 0;
        var ftMade = 0, ftAtt = 0, turnovers = 0;

        for (var i = 0; i < poss.length; i++) {
            var p = poss[i];
            totalPts += p.points || 0;

            if (p.shotType === 'turnover') {
                turnovers++;
                continue;
            }
            if (p.shotType === 'free_throws') {
                ftMade += p.ftMade || 0;
                ftAtt += p.ftAttempts || 0;
                continue;
            }

            // Field goals
            if (p.result === 'made' || p.result === 'missed') {
                fgAtt++;
                if (p.result === 'made') fgMade++;
            }
            if (p.shotType === 'open_3' || p.shotType === 'contested_3') {
                if (p.result === 'made' || p.result === 'missed') {
                    threeAtt++;
                    if (p.result === 'made') threeMade++;
                }
            }

            // And-1 free throws
            if (p.and1) {
                ftMade += p.and1FtMade || 0;
                ftAtt += p.and1FtAttempts || 0;
            }
        }

        var totalPoss = poss.length;
        return {
            totalPoss: totalPoss,
            totalPts: totalPts,
            ppp: totalPoss > 0 ? (totalPts / totalPoss).toFixed(2) : '0.00',
            fgPct: fgAtt > 0 ? (fgMade / fgAtt * 100).toFixed(1) + '%' : '0.0%',
            threePct: threeAtt > 0 ? (threeMade / threeAtt * 100).toFixed(1) + '%' : '0.0%',
            ftPct: ftAtt > 0 ? (ftMade / ftAtt * 100).toFixed(1) + '%' : '0.0%',
            turnovers: turnovers
        };
    },

    _getCurrentQuarter: function(game) {
        var poss = game.possessions || [];
        if (poss.length === 0) return 'Q1';
        return poss[poss.length - 1].quarter || 'Q1';
    },

    _systemPrompt: function(mode, opponent) {
        var base = 'You are a basketball analytics assistant for the Newark Academy Minutemen coaching staff. ' +
            'You have access to detailed possession-level data from games tracked with the Shot Quality Tracker app.\n\n' +
            '## Data Model\n' +
            '- Each possession has: player, shotType, result (made/missed/foul/turnover), points, grade (gold/silver/bronze), play name, quarter\n' +
            '- Shot types: open_layup, contested_layup, open_mid, contested_mid, open_3, contested_3, free_throws, turnover\n' +
            '- PPP = Points Per Possession (total points / total possessions). League-average college PPP is ~1.0. Above 1.1 is good, above 1.2 is excellent.\n' +
            '- Grades reflect shot quality: gold = great look, silver = decent, bronze = poor shot selection\n' +
            '- "Open" shots mean the shooter was not closely guarded. "Contested" means a defender was nearby.\n\n' +
            '## Response Guidelines\n' +
            '- Be concise and direct. Coaches need quick answers, especially during games.\n' +
            '- Lead with the key insight, then supporting data.\n' +
            '- Use player numbers (e.g., #11 Davis) for quick identification.\n' +
            '- Bold important stats and player names using **markdown**.\n' +
            '- When trends or comparisons would benefit from a visual, include a chart specification.\n\n' +
            '## Chart Specifications\n' +
            'When a chart would help, include a JSON code block tagged as ```chart with this schema:\n' +
            '{\n' +
            '  "type": "bar" | "line" | "doughnut" | "horizontalBar",\n' +
            '  "title": "Chart Title",\n' +
            '  "labels": ["Label1", "Label2"],\n' +
            '  "datasets": [{\n' +
            '    "label": "Dataset Name",\n' +
            '    "data": [1.2, 0.8],\n' +
            '    "colors": ["#4CAF50", "#f44336"]\n' +
            '  }]\n' +
            '}\n' +
            'Use colors: #4CAF50 (green/good), #ffeb3b (yellow/average), #f44336 (red/poor), #c41230 (accent/crimson), #94a3b8 (neutral).\n' +
            'Only include charts when they genuinely add value — not for every response.\n';

        if (mode === 'live-game') {
            base += '\n## Current Context\n' +
                'You are assisting during a LIVE GAME against ' + (opponent || 'an opponent') + '. ' +
                'The coach is on the bench and needs quick, actionable insights. ' +
                'Keep responses short (2-4 sentences for simple questions). ' +
                'For halftime-style analysis, provide more detail with charts.';
        } else {
            base += '\n## Current Context\n' +
                'You are helping with SEASON-LEVEL ANALYSIS. ' +
                'The coach has time for deeper analysis. You can provide longer, more detailed responses with charts and comparisons. ' +
                'Look for trends across games, player development arcs, and strategic patterns.';
        }

        return base;
    }
};

window.SQT = SQT;
