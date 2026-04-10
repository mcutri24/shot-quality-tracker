/**
 * Dashboard — real-time stats computation and 4 tab views.
 */
var SQT = window.SQT || {};

SQT.Dashboard = {
    game: null,
    possessions: [],
    isLive: false,   // true if came from tracking screen
    currentTab: 'player',

    showGame: function(game, fromTracking) {
        this.game = game;
        this.possessions = game.possessions || [];
        this.isLive = !!fromTracking;
        this._renderDashboard();
    },

    showSeason: function() {
        this.game = null;
        this.isLive = false;
        // Aggregate all possessions from all games
        var games = SQT.Storage.getGames();
        var all = [];
        for (var i = 0; i < games.length; i++) {
            if (games[i].possessions) {
                all = all.concat(games[i].possessions);
            }
        }
        this.possessions = all;
        this._renderDashboard();
    },

    _renderDashboard: function() {
        // Top bar
        var title = this.game ? (this.game.opponent + ' — Dashboard') : 'Season Stats';
        document.getElementById('dashboard-title').textContent = title;

        // Back button behavior
        var self = this;
        var backBtn = document.getElementById('dashboard-back');
        backBtn.onclick = function() {
            if (self.isLive) {
                SQT.App.showScreen('tracking');
            } else if (self.game) {
                SQT.App.showScreen('history');
                SQT.Game.renderHistory();
            } else {
                SQT.App.showScreen('home');
            }
        };

        // Tabs
        this.currentTab = 'player';
        this._bindTabs();
        this._renderTab();
    },

    _bindTabs: function() {
        var self = this;
        var tabs = document.querySelectorAll('#dashboard-screen .dashboard-tabs button');
        for (var i = 0; i < tabs.length; i++) {
            tabs[i].addEventListener('click', function() {
                for (var j = 0; j < tabs.length; j++) tabs[j].classList.remove('active');
                this.classList.add('active');
                self.currentTab = this.getAttribute('data-tab');
                self._renderTab();
            });
        }
        // Set first tab active
        tabs[0].classList.add('active');
    },

    _renderTab: function() {
        var content = document.getElementById('dashboard-content');
        var poss = this.possessions;

        // Summary bar
        var totalPoss = poss.length;
        var totalPts = 0, fgm = 0, fga = 0;
        for (var i = 0; i < poss.length; i++) {
            totalPts += poss[i].points || 0;
            if (poss[i].shotType !== 'free_throws' && poss[i].shotType !== 'turnover') {
                fga++;
                if (poss[i].result === 'made') fgm++;
            }
        }
        var ppp = totalPoss > 0 ? (totalPts / totalPoss).toFixed(2) : '—';
        var fgPct = fga > 0 ? Math.round(fgm / fga * 100) + '%' : '—';

        var summaryHtml = '<div class="summary-bar">' +
            '<div class="summary-stat"><div class="val">' + totalPoss + '</div><div class="lbl">Poss</div></div>' +
            '<div class="summary-stat"><div class="val">' + totalPts + '</div><div class="lbl">Points</div></div>' +
            '<div class="summary-stat"><div class="val highlight">' + ppp + '</div><div class="lbl">PPP</div></div>' +
            '<div class="summary-stat"><div class="val">' + fgPct + '</div><div class="lbl">FG%</div></div>' +
        '</div>';

        switch (this.currentTab) {
            case 'player': content.innerHTML = summaryHtml + this._byPlayer(poss); break;
            case 'type':   content.innerHTML = summaryHtml + this._byType(poss); break;
            case 'quarter': content.innerHTML = summaryHtml + this._byQuarter(poss); break;
            case 'grade':  content.innerHTML = summaryHtml + this._byGrade(poss); break;
        }
    },

    _byPlayer: function(poss) {
        // Group by player
        var players = {};
        for (var i = 0; i < poss.length; i++) {
            var p = poss[i];
            var key = p.playerNumber;
            if (!players[key]) {
                players[key] = { num: p.playerNumber, name: p.playerName, poss: 0, pts: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0, to: 0, ftm: 0, fta: 0, gold: 0, silver: 0, bronze: 0 };
            }
            var pl = players[key];
            pl.poss++;
            pl.pts += p.points || 0;
            if (p.shotType === 'turnover') {
                pl.to++;
            } else if (p.shotType === 'free_throws') {
                pl.ftm += p.ftMade || 0;
                pl.fta += p.ftAttempts || 0;
            } else {
                pl.fga++;
                if (p.result === 'made') pl.fgm++;
                // 3-pointers
                if (p.shotType === 'open_3' || p.shotType === 'contested_3') {
                    pl.fg3a++;
                    if (p.result === 'made') pl.fg3m++;
                }
            }
            if (p.grade === 'gold') pl.gold++;
            else if (p.grade === 'silver') pl.silver++;
            else if (p.grade === 'bronze') pl.bronze++;
        }

        var rows = Object.keys(players).map(function(k) { return players[k]; });
        rows.sort(function(a, b) { return parseInt(a.num) - parseInt(b.num); });

        var html = '<div style="overflow-x:auto"><table class="stat-table"><thead><tr>' +
            '<th>Player</th><th class="num-col">Poss</th><th class="num-col">PTS</th><th class="num-col">PPP</th>' +
            '<th class="num-col">FG</th><th class="num-col">FG%</th>' +
            '<th class="num-col">3PT</th><th class="num-col">3P%</th>' +
            '<th class="num-col">FT</th><th class="num-col">FT%</th>' +
            '<th class="num-col">TO</th><th class="num-col">G/S/B</th></tr></thead><tbody>';
        for (var r = 0; r < rows.length; r++) {
            var d = rows[r];
            var fg = d.fgm + '/' + d.fga;
            var fgPct = d.fga > 0 ? Math.round(d.fgm / d.fga * 100) + '%' : '—';
            var fg3 = d.fg3m + '/' + d.fg3a;
            var fg3Pct = d.fg3a > 0 ? Math.round(d.fg3m / d.fg3a * 100) + '%' : '—';
            var ft = d.ftm + '/' + d.fta;
            var ftPct = d.fta > 0 ? Math.round(d.ftm / d.fta * 100) + '%' : '—';
            var playerPpp = d.poss > 0 ? (d.pts / d.poss).toFixed(2) : '—';
            html += '<tr><td>#' + d.num + ' ' + d.name + '</td>' +
                '<td class="num-col">' + d.poss + '</td>' +
                '<td class="num-col">' + d.pts + '</td>' +
                '<td class="num-col highlight">' + playerPpp + '</td>' +
                '<td class="num-col">' + fg + '</td>' +
                '<td class="num-col">' + fgPct + '</td>' +
                '<td class="num-col">' + fg3 + '</td>' +
                '<td class="num-col">' + fg3Pct + '</td>' +
                '<td class="num-col">' + ft + '</td>' +
                '<td class="num-col">' + ftPct + '</td>' +
                '<td class="num-col">' + d.to + '</td>' +
                '<td class="num-col">' + d.gold + '/' + d.silver + '/' + d.bronze + '</td></tr>';
        }
        html += '</tbody></table></div>';
        return html;
    },

    _byType: function(poss) {
        var types = {};
        var openCount = 0, contestedCount = 0, totalShots = 0;
        var shotTypeOrder = ['open_layup', 'contested_layup', 'open_mid', 'contested_mid', 'open_3', 'contested_3', 'free_throws', 'turnover'];
        var labels = {
            'open_layup': 'Open Layup', 'contested_layup': 'Contested Layup',
            'open_mid': 'Open Mid-Range', 'contested_mid': 'Contested Mid-Range',
            'open_3': 'Open 3', 'contested_3': 'Contested 3',
            'free_throws': 'Free Throws', 'turnover': 'Turnover'
        };

        for (var i = 0; i < poss.length; i++) {
            var p = poss[i];
            if (!types[p.shotType]) {
                types[p.shotType] = { att: 0, made: 0, pts: 0, poss: 0 };
            }
            var t = types[p.shotType];
            t.att++;
            t.poss++;
            t.pts += p.points || 0;
            if (p.shotType !== 'free_throws' && p.shotType !== 'turnover') {
                if (p.result === 'made') t.made++;
                totalShots++;
                if (p.shotType.indexOf('open') === 0) openCount++;
                else contestedCount++;
            }
        }

        // Open vs Contested summary
        var openPct = totalShots > 0 ? Math.round(openCount / totalShots * 100) : 0;
        var contestedPct = totalShots > 0 ? Math.round(contestedCount / totalShots * 100) : 0;
        var distHtml = '<div style="margin-bottom:12px;padding:10px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;">' +
            '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">OPEN vs CONTESTED (FG only)</div>' +
            '<div style="display:flex;height:24px;border-radius:4px;overflow:hidden;background:var(--bg-input);">' +
            '<div style="width:' + openPct + '%;background:var(--green);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:#fff;min-width:' + (openPct > 0 ? '30px' : '0') + ';">' + (openPct > 0 ? openPct + '%' : '') + '</div>' +
            '<div style="width:' + contestedPct + '%;background:var(--red);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:#fff;min-width:' + (contestedPct > 0 ? '30px' : '0') + ';">' + (contestedPct > 0 ? contestedPct + '%' : '') + '</div>' +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-secondary);margin-top:4px;">' +
            '<span>Open: ' + openCount + '</span><span>Contested: ' + contestedCount + '</span></div></div>';

        var html = distHtml + '<table class="stat-table"><thead><tr>' +
            '<th>Type</th><th class="num-col">Att</th><th class="num-col">%Tot</th><th class="num-col">Made</th>' +
            '<th class="num-col">FG%</th><th class="num-col">PTS</th><th class="num-col">PPP</th></tr></thead><tbody>';

        var totalPoss = poss.length;
        for (var s = 0; s < shotTypeOrder.length; s++) {
            var key = shotTypeOrder[s];
            var d = types[key];
            if (!d) continue;
            var pctOfTotal = totalPoss > 0 ? Math.round(d.att / totalPoss * 100) + '%' : '—';
            var fgPct = (key !== 'free_throws' && key !== 'turnover' && d.att > 0) ? Math.round(d.made / d.att * 100) + '%' : '—';
            var typePpp = d.poss > 0 ? (d.pts / d.poss).toFixed(2) : '—';
            var madeStr = (key === 'free_throws' || key === 'turnover') ? '—' : d.made.toString();
            html += '<tr><td>' + labels[key] + '</td>' +
                '<td class="num-col">' + d.att + '</td>' +
                '<td class="num-col">' + pctOfTotal + '</td>' +
                '<td class="num-col">' + madeStr + '</td>' +
                '<td class="num-col">' + fgPct + '</td>' +
                '<td class="num-col">' + d.pts + '</td>' +
                '<td class="num-col highlight">' + typePpp + '</td></tr>';
        }
        html += '</tbody></table>';
        return html;
    },

    _byQuarter: function(poss) {
        var quarters = {};
        var qOrder = ['Q1', 'Q2', 'Q3', 'Q4', 'OT'];
        for (var i = 0; i < poss.length; i++) {
            var p = poss[i];
            var q = p.quarter || 'Q1';
            if (!quarters[q]) {
                quarters[q] = { poss: 0, pts: 0, fgm: 0, fga: 0, gold: 0, to: 0, open: 0, totalFG: 0 };
            }
            var qd = quarters[q];
            qd.poss++;
            qd.pts += p.points || 0;
            if (p.shotType === 'turnover') qd.to++;
            if (p.shotType !== 'free_throws' && p.shotType !== 'turnover') {
                qd.fga++;
                qd.totalFG++;
                if (p.result === 'made') qd.fgm++;
                if (p.shotType.indexOf('open') === 0) qd.open++;
            }
            if (p.grade === 'gold') qd.gold++;
        }

        var html = '<table class="stat-table"><thead><tr>' +
            '<th>Qtr</th><th class="num-col">Poss</th><th class="num-col">PTS</th><th class="num-col">PPP</th>' +
            '<th class="num-col">FG%</th><th class="num-col">Open%</th><th class="num-col">Gold%</th><th class="num-col">TO</th></tr></thead><tbody>';
        for (var qi = 0; qi < qOrder.length; qi++) {
            var qk = qOrder[qi];
            var d = quarters[qk];
            if (!d) continue;
            var qPpp = d.poss > 0 ? (d.pts / d.poss).toFixed(2) : '—';
            var qFg = d.fga > 0 ? Math.round(d.fgm / d.fga * 100) + '%' : '—';
            var qOpen = d.totalFG > 0 ? Math.round(d.open / d.totalFG * 100) + '%' : '—';
            var qGold = d.poss > 0 ? Math.round(d.gold / d.poss * 100) + '%' : '—';
            html += '<tr><td>' + qk + '</td>' +
                '<td class="num-col">' + d.poss + '</td>' +
                '<td class="num-col">' + d.pts + '</td>' +
                '<td class="num-col highlight">' + qPpp + '</td>' +
                '<td class="num-col">' + qFg + '</td>' +
                '<td class="num-col">' + qOpen + '</td>' +
                '<td class="num-col">' + qGold + '</td>' +
                '<td class="num-col">' + d.to + '</td></tr>';
        }
        html += '</tbody></table>';
        return html;
    },

    _byGrade: function(poss) {
        var grades = { gold: { poss: 0, pts: 0, fgm: 0, fga: 0 }, silver: { poss: 0, pts: 0, fgm: 0, fga: 0 }, bronze: { poss: 0, pts: 0, fgm: 0, fga: 0 } };
        var totalPoss = poss.length;
        for (var i = 0; i < poss.length; i++) {
            var p = poss[i];
            var g = grades[p.grade];
            if (!g) continue;
            g.poss++;
            g.pts += p.points || 0;
            if (p.shotType !== 'free_throws' && p.shotType !== 'turnover') {
                g.fga++;
                if (p.result === 'made') g.fgm++;
            }
        }

        var html = '<table class="stat-table"><thead><tr>' +
            '<th>Grade</th><th class="num-col">Poss</th><th class="num-col">%Tot</th><th class="num-col">FG</th>' +
            '<th class="num-col">FG%</th><th class="num-col">PTS</th><th class="num-col">PPP</th></tr></thead><tbody>';
        var order = ['gold', 'silver', 'bronze'];
        var labels = { gold: 'Gold', silver: 'Silver', bronze: 'Bronze' };
        for (var gi = 0; gi < order.length; gi++) {
            var key = order[gi];
            var d = grades[key];
            var pctTot = totalPoss > 0 ? Math.round(d.poss / totalPoss * 100) + '%' : '—';
            var fg = d.fgm + '/' + d.fga;
            var fgPct = d.fga > 0 ? Math.round(d.fgm / d.fga * 100) + '%' : '—';
            var gPpp = d.poss > 0 ? (d.pts / d.poss).toFixed(2) : '—';
            html += '<tr><td style="color:var(--' + key + ')">' + labels[key] + '</td>' +
                '<td class="num-col">' + d.poss + '</td>' +
                '<td class="num-col">' + pctTot + '</td>' +
                '<td class="num-col">' + fg + '</td>' +
                '<td class="num-col">' + fgPct + '</td>' +
                '<td class="num-col">' + d.pts + '</td>' +
                '<td class="num-col highlight">' + gPpp + '</td></tr>';
        }
        html += '</tbody></table>';
        return html;
    }
};

window.SQT = SQT;
