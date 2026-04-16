/**
 * Export game data as JSON, CSV, or Excel-compatible CSV.
 */
var SQT = window.SQT || {};

SQT.Export = {
    // Export current game or season as JSON
    exportJSON: function(game) {
        var data = game || { season: true, games: SQT.Storage.getGames() };
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
                        var poss = {};
                        for (var k in gm.possessions[p]) {
                            poss[k] = gm.possessions[p][k];
                        }
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
        if (str.indexOf(',') >= 0 || str.indexOf('"') >= 0) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    },

    _download: function(blob, filename) {
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.download = filename;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    }
};

window.SQT = SQT;
