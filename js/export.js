/**
 * Export game data as JSON, CSV, or Excel-compatible CSV.
 */
var SQT = window.SQT || {};

SQT.Export = {
    // Export current game or season as JSON
    exportJSON: function(game) {
        var data;
        if (game) {
            data = game;
        } else {
            var allGames = [];
            var seasons = SQT.Storage.getSeasons();
            for (var si = 0; si < seasons.length; si++) {
                var seasonGames = SQT.Storage.getGamesBySeason(seasons[si].id);
                for (var gi = 0; gi < seasonGames.length; gi++) {
                    allGames.push(seasonGames[gi]);
                }
            }
            data = { season: true, games: allGames };
        }
        var json = JSON.stringify(data, null, 2);
        var blob = new Blob([json], { type: 'application/json' });
        var name = game ? (game.opponent + '_' + game.date) : 'season_data';
        this._download(blob, name + '.json');
    },

    // Export as CSV (Excel-compatible with BOM for Unicode)
    exportCSV: function(game) {
        var possessions;
        var name;
        if (game) {
            possessions = game.possessions || [];
            name = game.opponent + '_' + game.date;
        } else {
            // Season: active season's games only
            var activeSeason = SQT.Storage.getActiveSeason();
            var games = activeSeason ? SQT.Storage.getGamesBySeason(activeSeason.id) : [];
            possessions = [];
            for (var g = 0; g < games.length; g++) {
                var gm = games[g];
                if (gm.possessions) {
                    for (var p = 0; p < gm.possessions.length; p++) {
                        var poss = Object.assign({}, gm.possessions[p]);
                        poss.opponent = gm.opponent;
                        poss.gameDate = gm.date;
                        poss.gameResult = gm.result || '';
                        possessions.push(poss);
                    }
                }
            }
            name = 'season_data';
        }

        if (possessions.length === 0) {
            SQT.App.toast('No data to export');
            return;
        }

        // Build CSV
        var headers = ['Quarter', 'Player #', 'Player Name', 'Shot Type', 'Result', 'Points', 'Grade', 'Play', 'And-1', 'FT Made', 'FT Attempts'];
        if (!game) {
            headers = ['Opponent', 'Date', 'Game Result'].concat(headers);
        }

        var rows = [headers.join(',')];
        for (var i = 0; i < possessions.length; i++) {
            var d = possessions[i];
            var shotLabel = this._shotLabel(d.shotType);
            var resultLabel = d.shotType === 'turnover' ? 'Turnover' :
                              d.shotType === 'free_throws' ? (d.ftMade + '/' + d.ftAttempts + ' FT') :
                              (d.result === 'made' ? 'Made' : 'Missed');
            var gradeLabel = d.grade ? d.grade.charAt(0).toUpperCase() + d.grade.slice(1) : '';

            var row = [
                d.quarter,
                d.playerNumber,
                this._csvEsc(d.playerName),
                shotLabel,
                resultLabel,
                d.points || 0,
                gradeLabel,
                this._csvEsc(d.playName || ''),
                d.and1 ? 'Yes' : '',
                d.ftMade !== undefined ? d.ftMade : '',
                d.ftAttempts !== undefined ? d.ftAttempts : ''
            ];
            if (!game) {
                row = [this._csvEsc(d.opponent), d.gameDate, d.gameResult].concat(row);
            }
            rows.push(row.join(','));
        }

        // Add summary section
        rows.push('');
        rows.push('--- Summary ---');
        var totalPoss = possessions.length;
        var totalPts = 0, fgm = 0, fga = 0, tos = 0;
        var grades = { gold: 0, silver: 0, bronze: 0 };
        for (var s = 0; s < possessions.length; s++) {
            totalPts += possessions[s].points || 0;
            if (possessions[s].shotType !== 'free_throws' && possessions[s].shotType !== 'turnover') {
                fga++;
                if (possessions[s].result === 'made') fgm++;
            }
            if (possessions[s].shotType === 'turnover') tos++;
            if (possessions[s].grade) grades[possessions[s].grade]++;
        }
        rows.push('Total Possessions,' + totalPoss);
        rows.push('Total Points,' + totalPts);
        rows.push('PPP,' + (totalPoss > 0 ? (totalPts / totalPoss).toFixed(2) : '0'));
        rows.push('FG%,' + (fga > 0 ? Math.round(fgm / fga * 100) + '%' : '—'));
        rows.push('FGM/FGA,' + fgm + '/' + fga);
        rows.push('Turnovers,' + tos);
        rows.push('TO%,' + (totalPoss > 0 ? Math.round(tos / totalPoss * 100) + '%' : '0%'));
        rows.push('Gold Possessions,' + grades.gold + ',' + (totalPoss > 0 ? Math.round(grades.gold / totalPoss * 100) + '%' : ''));
        rows.push('Silver Possessions,' + grades.silver + ',' + (totalPoss > 0 ? Math.round(grades.silver / totalPoss * 100) + '%' : ''));
        rows.push('Bronze Possessions,' + grades.bronze + ',' + (totalPoss > 0 ? Math.round(grades.bronze / totalPoss * 100) + '%' : ''));

        // BOM for Excel Unicode support
        var csv = '\uFEFF' + rows.join('\r\n');
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        this._download(blob, name + '.csv');
    },

    importJSON: function() {
        var self = this;
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.style.display = 'none';
        document.body.appendChild(input);
        input.addEventListener('change', function() {
            var file = this.files[0];
            if (!file) { document.body.removeChild(input); return; }
            var reader = new FileReader();
            reader.onload = function(e) {
                document.body.removeChild(input);
                try {
                    var data = JSON.parse(e.target.result);
                    self._processImport(data);
                } catch (err) {
                    SQT.App.toast('Invalid JSON file');
                }
            };
            reader.onerror = function() {
                document.body.removeChild(input);
                SQT.App.toast('Error reading file');
            };
            reader.readAsText(file);
        });
        input.click();
    },

    _processImport: function(data) {
        var games = [];
        if (Array.isArray(data)) {
            games = data;
        } else if (data && data.season === true && Array.isArray(data.games)) {
            games = data.games;
        } else if (data && data.id && Array.isArray(data.possessions)) {
            games = [data];
        } else {
            SQT.App.toast('Unrecognized backup format');
            return;
        }
        // Filter to valid game objects
        var valid = [];
        for (var i = 0; i < games.length; i++) {
            if (games[i].id && Array.isArray(games[i].possessions)) {
                valid.push(games[i]);
            }
        }
        if (valid.length === 0) {
            SQT.App.toast('No valid games found in file');
            return;
        }
        // Merge into sqt_games (dedup by id)
        var existing = SQT.Storage.getGames();
        var existingIds = {};
        for (var j = 0; j < existing.length; j++) existingIds[existing[j].id] = true;
        var imported = 0;
        for (var k = 0; k < valid.length; k++) {
            if (!existingIds[valid[k].id]) {
                existing.push(valid[k]);
                imported++;
            }
        }
        SQT.Storage.saveGames(existing);
        SQT.App.toast('Imported ' + imported + ' game' + (imported !== 1 ? 's' : ''));
        if (SQT.App.currentScreen === 'history' && SQT.Game) SQT.Game.renderHistory();
    },

    _shotLabel: function(type) {
        var map = {
            'open_layup': 'Open Layup', 'contested_layup': 'Contested Layup',
            'open_mid': 'Open Mid-Range', 'contested_mid': 'Contested Mid-Range',
            'open_3': 'Open 3', 'contested_3': 'Contested 3',
            'free_throws': 'Free Throws', 'turnover': 'Turnover'
        };
        return map[type] || type;
    },

    _csvEsc: function(str) {
        if (!str) return '';
        // Prefix formula-injection characters to prevent Excel formula execution
        if ('=+-@'.indexOf(str.charAt(0)) >= 0) {
            str = "'" + str;
        }
        // Wrap in quotes if field contains comma, quote, or newline characters
        if (str.indexOf(',') >= 0 || str.indexOf('"') >= 0 || str.indexOf('\n') >= 0 || str.indexOf('\r') >= 0) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    },

    _download: function(blob, filename) {
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.download = filename;
        link.href = url;
        // Append to DOM before clicking — required by Firefox
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
};

window.SQT = SQT;
