/**
 * Dashboard — real-time stats computation and 4 tab views.
 */
var SQT = window.SQT || {};

SQT.Dashboard = {
    game: null,
    possessions: [],
    isLive: false,   // true if came from tracking screen
    currentTab: 'player',
    viewingSeasonId: null, // track which season we're viewing

    showGame: function(game, fromTracking) {
        this.game = game;
        this.possessions = game.possessions || [];
        this.isLive = !!fromTracking;
        this.viewingSeasonId = null;
        this._renderDashboard();
    },

    showSeason: function(seasonId) {
        this.game = null;
        this.isLive = false;

        var sid = seasonId;
        if (!sid) {
            var active = SQT.Storage.getActiveSeason();
            sid = active ? active.id : null;
        }
        this.viewingSeasonId = sid;

        // Aggregate possessions from season's games
        var games = sid ? SQT.Storage.getGamesBySeason(sid) : [];
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
        var title;
        if (this.game) {
            title = this.game.opponent + ' — Dashboard';
        } else if (this.viewingSeasonId) {
            var seasons = SQT.Storage.getSeasons();
            var sName = 'Season Stats';
            for (var i = 0; i < seasons.length; i++) {
                if (seasons[i].id === this.viewingSeasonId) {
                    sName = seasons[i].name;
                    break;
                }
            }
            title = sName;
        } else {
            title = 'Season Stats';
        }
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
        var totalPts = 0, fgm = 0, fga = 0, fg3m = 0, fg3a = 0, ftm = 0, fta = 0;
        for (var i = 0; i < poss.length; i++) {
            totalPts += poss[i].points || 0;
            if (poss[i].shotType === 'free_throws') {
                ftm += poss[i].ftMade || 0;
                fta += poss[i].ftAttempts || 0;
            } else if (poss[i].shotType !== 'turnover') {
                fga++;
                if (poss[i].result === 'made') fgm++;
                if (poss[i].shotType === 'open_3' || poss[i].shotType === 'contested_3') {
                    fg3a++;
                    if (poss[i].result === 'made') fg3m++;
                }
            }
        }
        var ppp = totalPoss > 0 ? (totalPts / totalPoss).toFixed(2) : '—';
        var fgPct = fga > 0 ? Math.round(fgm / fga * 100) + '%' : '—';
        var fg3Pct = fg3a > 0 ? Math.round(fg3m / fg3a * 100) + '%' : '—';
        var ftPct = fta > 0 ? Math.round(ftm / fta * 100) + '%' : '—';

        var summaryHtml = '<div class="summary-hero"><div class="val highlight">' + ppp + '</div><div class="lbl">PPP</div></div>' +
            '<div class="summary-bar">' +
            '<div class="summary-stat"><div class="val">' + totalPoss + '</div><div class="lbl">Poss</div></div>' +
            '<div class="summary-stat"><div class="val">' + totalPts + '</div><div class="lbl">Points</div></div>' +
            '<div class="summary-stat"><div class="val">' + fgPct + '</div><div class="lbl">FG%</div></div>' +
            '<div class="summary-stat"><div class="val">' + fg3Pct + '</div><div class="lbl">3PT%</div></div>' +
            '<div class="summary-stat"><div class="val">' + ftPct + '</div><div class="lbl">FT%</div></div>' +
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
            html += '<tr class="player-row" data-num="' + d.num + '" style="cursor:pointer;"><td>#' + d.num + ' ' + d.name + ' &#9656;</td>' +
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

        // Bind player row clicks after render
        var self = this;
        var allPoss = poss;
        setTimeout(function() {
            var rows2 = document.querySelectorAll('.player-row');
            for (var pr = 0; pr < rows2.length; pr++) {
                rows2[pr].addEventListener('click', function() {
                    var num = this.getAttribute('data-num');
                    self._showPlayerDrillDown(num, allPoss);
                });
            }
        }, 0);

        return html;
    },

    _showPlayerDrillDown: function(playerNum, poss) {
        // Filter possessions for this player
        var playerPoss = [];
        var playerName = '';
        for (var i = 0; i < poss.length; i++) {
            if (poss[i].playerNumber === playerNum) {
                playerPoss.push(poss[i]);
                if (!playerName) playerName = poss[i].playerName;
            }
        }

        var overlay = document.createElement('div');
        overlay.className = 'player-drill-overlay';

        var html = '<div class="top-bar">' +
            '<button class="back-btn" id="drill-close">&larr; Back</button>' +
            '<span class="title">#' + playerNum + ' ' + playerName + '</span>' +
            '<span style="width:50px"></span></div>';
        html += '<div class="player-drill-content">';

        // Shot type breakdown
        var shotTypes = {};
        var openCount = 0, contestedCount = 0, totalFG = 0;
        var labels = {
            'open_layup': 'Open Layup', 'contested_layup': 'Contested Layup',
            'open_mid': 'Open Mid-Range', 'contested_mid': 'Contested Mid-Range',
            'open_3': 'Open 3', 'contested_3': 'Contested 3',
            'free_throws': 'Free Throws', 'turnover': 'Turnover'
        };
        var order = ['open_layup', 'contested_layup', 'open_mid', 'contested_mid', 'open_3', 'contested_3', 'free_throws', 'turnover'];

        for (var j = 0; j < playerPoss.length; j++) {
            var p = playerPoss[j];
            if (!shotTypes[p.shotType]) {
                shotTypes[p.shotType] = { att: 0, made: 0, pts: 0 };
            }
            var st = shotTypes[p.shotType];
            st.att++;
            st.pts += p.points || 0;
            if (p.shotType !== 'free_throws' && p.shotType !== 'turnover') {
                totalFG++;
                if (p.result === 'made') st.made++;
                if (p.shotType.indexOf('open') === 0) openCount++;
                else contestedCount++;
            }
        }

        // Open vs Contested bar
        var openPct = totalFG > 0 ? Math.round(openCount / totalFG * 100) : 0;
        var contestedPct = totalFG > 0 ? Math.round(contestedCount / totalFG * 100) : 0;
        html += '<div style="margin-bottom:12px;padding:10px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;">' +
            '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">OPEN vs CONTESTED</div>' +
            '<div style="display:flex;height:28px;border-radius:4px;overflow:hidden;background:var(--bg-input);">' +
            '<div style="width:' + openPct + '%;background:var(--green);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:#fff;min-width:' + (openPct > 0 ? '36px' : '0') + ';">' + (openPct > 0 ? openPct + '%' : '') + '</div>' +
            '<div style="width:' + contestedPct + '%;background:var(--red);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:#fff;min-width:' + (contestedPct > 0 ? '36px' : '0') + ';">' + (contestedPct > 0 ? contestedPct + '%' : '') + '</div>' +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-secondary);margin-top:4px;">' +
            '<span>Open: ' + openCount + '</span><span>Contested: ' + contestedCount + '</span></div></div>';

        // Shot type table
        html += '<div style="overflow-x:auto"><table class="stat-table"><thead><tr>' +
            '<th>Shot Type</th><th class="num-col">Att</th><th class="num-col">%Tot</th>' +
            '<th class="num-col">Made</th><th class="num-col">FG%</th>' +
            '<th class="num-col">PTS</th><th class="num-col">PPP</th></tr></thead><tbody>';

        var totalPoss = playerPoss.length;
        for (var s = 0; s < order.length; s++) {
            var key = order[s];
            var d = shotTypes[key];
            if (!d) continue;
            var pctOfTotal = totalPoss > 0 ? Math.round(d.att / totalPoss * 100) + '%' : '—';
            var fgPct2 = (key !== 'free_throws' && key !== 'turnover' && d.att > 0) ? Math.round(d.made / d.att * 100) + '%' : '—';
            var typePpp = d.att > 0 ? (d.pts / d.att).toFixed(2) : '—';
            var madeStr = (key === 'free_throws' || key === 'turnover') ? '—' : d.made.toString();
            html += '<tr><td>' + labels[key] + '</td>' +
                '<td class="num-col">' + d.att + '</td>' +
                '<td class="num-col">' + pctOfTotal + '</td>' +
                '<td class="num-col">' + madeStr + '</td>' +
                '<td class="num-col">' + fgPct2 + '</td>' +
                '<td class="num-col">' + d.pts + '</td>' +
                '<td class="num-col highlight">' + typePpp + '</td></tr>';
        }
        html += '</tbody></table></div>';

        // Aggregated by category table
        var cats = {
            layups: { label: 'Layups', att: 0, made: 0, pts: 0 },
            midrange: { label: 'Mid-Range', att: 0, made: 0, pts: 0 },
            threes: { label: '3-Pointers', att: 0, made: 0, pts: 0 },
            ft: { label: 'Free Throws', att: 0, made: 0, pts: 0, ftm: 0, fta: 0 },
            to: { label: 'Turnovers', att: 0, made: 0, pts: 0 }
        };
        for (var ci = 0; ci < playerPoss.length; ci++) {
            var cp = playerPoss[ci];
            var cat = null;
            if (cp.shotType === 'open_layup' || cp.shotType === 'contested_layup') cat = cats.layups;
            else if (cp.shotType === 'open_mid' || cp.shotType === 'contested_mid') cat = cats.midrange;
            else if (cp.shotType === 'open_3' || cp.shotType === 'contested_3') cat = cats.threes;
            else if (cp.shotType === 'free_throws') cat = cats.ft;
            else if (cp.shotType === 'turnover') cat = cats.to;
            if (!cat) continue;
            cat.att++;
            cat.pts += cp.points || 0;
            if (cp.shotType === 'free_throws') {
                cat.ftm += cp.ftMade || 0;
                cat.fta += cp.ftAttempts || 0;
            } else if (cp.shotType !== 'turnover') {
                if (cp.result === 'made') cat.made++;
            }
        }

        html += '<div style="margin-top:16px;font-size:13px;font-weight:600;color:var(--text-secondary);margin-bottom:6px;">AGGREGATED BY CATEGORY</div>';
        html += '<table class="stat-table"><thead><tr>' +
            '<th>Category</th><th class="num-col">Att</th><th class="num-col">%Tot</th><th class="num-col">Made</th>' +
            '<th class="num-col">FG%</th><th class="num-col">PTS</th><th class="num-col">PPP</th></tr></thead><tbody>';

        var catOrder = ['layups', 'midrange', 'threes', 'ft', 'to'];
        for (var co = 0; co < catOrder.length; co++) {
            var ck = catOrder[co];
            var cd = cats[ck];
            if (cd.att === 0) continue;
            var cPctTot = totalPoss > 0 ? Math.round(cd.att / totalPoss * 100) + '%' : '—';
            var cFgPct, cMadeStr;
            if (ck === 'ft') {
                cMadeStr = cd.ftm + '/' + cd.fta;
                cFgPct = cd.fta > 0 ? Math.round(cd.ftm / cd.fta * 100) + '%' : '—';
            } else if (ck === 'to') {
                cMadeStr = '—';
                cFgPct = '—';
            } else {
                cMadeStr = cd.made.toString();
                cFgPct = cd.att > 0 ? Math.round(cd.made / cd.att * 100) + '%' : '—';
            }
            var cPpp = cd.att > 0 ? (cd.pts / cd.att).toFixed(2) : '—';
            html += '<tr><td>' + cd.label + '</td>' +
                '<td class="num-col">' + cd.att + '</td>' +
                '<td class="num-col">' + cPctTot + '</td>' +
                '<td class="num-col">' + cMadeStr + '</td>' +
                '<td class="num-col">' + cFgPct + '</td>' +
                '<td class="num-col">' + cd.pts + '</td>' +
                '<td class="num-col highlight">' + cPpp + '</td></tr>';
        }
        html += '</tbody></table>';

        // Grade breakdown
        var grades = { gold: 0, silver: 0, bronze: 0 };
        for (var g = 0; g < playerPoss.length; g++) {
            if (playerPoss[g].grade) grades[playerPoss[g].grade]++;
        }
        html += '<div style="margin-top:12px;display:flex;gap:8px;">';
        html += '<div class="summary-stat" style="border-color:var(--gold)"><div class="val" style="color:var(--gold)">' + grades.gold + '</div><div class="lbl">Gold</div></div>';
        html += '<div class="summary-stat" style="border-color:var(--silver)"><div class="val" style="color:var(--silver)">' + grades.silver + '</div><div class="lbl">Silver</div></div>';
        html += '<div class="summary-stat" style="border-color:var(--bronze)"><div class="val" style="color:var(--bronze)">' + grades.bronze + '</div><div class="lbl">Bronze</div></div>';
        html += '</div>';

        html += '</div>';
        overlay.innerHTML = html;
        document.body.appendChild(overlay);

        var closeBtn = overlay.querySelector('.back-btn');
        closeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        });
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

        // Aggregated 5-category table
        var cats = {
            layups: { label: 'Layups', att: 0, made: 0, pts: 0 },
            midrange: { label: 'Mid-Range', att: 0, made: 0, pts: 0 },
            threes: { label: '3-Pointers', att: 0, made: 0, pts: 0 },
            ft: { label: 'Free Throws', att: 0, made: 0, pts: 0, ftm: 0, fta: 0 },
            to: { label: 'Turnovers', att: 0, made: 0, pts: 0 }
        };
        for (var ci = 0; ci < poss.length; ci++) {
            var cp = poss[ci];
            var cat = null;
            if (cp.shotType === 'open_layup' || cp.shotType === 'contested_layup') cat = cats.layups;
            else if (cp.shotType === 'open_mid' || cp.shotType === 'contested_mid') cat = cats.midrange;
            else if (cp.shotType === 'open_3' || cp.shotType === 'contested_3') cat = cats.threes;
            else if (cp.shotType === 'free_throws') cat = cats.ft;
            else if (cp.shotType === 'turnover') cat = cats.to;
            if (!cat) continue;
            cat.att++;
            cat.pts += cp.points || 0;
            if (cp.shotType === 'free_throws') {
                cat.ftm += cp.ftMade || 0;
                cat.fta += cp.ftAttempts || 0;
            } else if (cp.shotType !== 'turnover') {
                if (cp.result === 'made') cat.made++;
            }
        }

        html += '<div style="margin-top:16px;font-size:13px;font-weight:600;color:var(--text-secondary);margin-bottom:6px;">AGGREGATED BY CATEGORY</div>';
        html += '<table class="stat-table"><thead><tr>' +
            '<th>Category</th><th class="num-col">Att</th><th class="num-col">%Tot</th><th class="num-col">Made</th>' +
            '<th class="num-col">FG%</th><th class="num-col">PTS</th><th class="num-col">PPP</th></tr></thead><tbody>';

        var catOrder = ['layups', 'midrange', 'threes', 'ft', 'to'];
        for (var co = 0; co < catOrder.length; co++) {
            var ck = catOrder[co];
            var cd = cats[ck];
            if (cd.att === 0) continue;
            var cPctTot = totalPoss > 0 ? Math.round(cd.att / totalPoss * 100) + '%' : '—';
            var cFgPct, cMadeStr;
            if (ck === 'ft') {
                cMadeStr = cd.ftm + '/' + cd.fta;
                cFgPct = cd.fta > 0 ? Math.round(cd.ftm / cd.fta * 100) + '%' : '—';
            } else if (ck === 'to') {
                cMadeStr = '—';
                cFgPct = '—';
            } else {
                cMadeStr = cd.made.toString();
                cFgPct = cd.att > 0 ? Math.round(cd.made / cd.att * 100) + '%' : '—';
            }
            var cPpp = cd.att > 0 ? (cd.pts / cd.att).toFixed(2) : '—';
            html += '<tr><td>' + cd.label + '</td>' +
                '<td class="num-col">' + cd.att + '</td>' +
                '<td class="num-col">' + cPctTot + '</td>' +
                '<td class="num-col">' + cMadeStr + '</td>' +
                '<td class="num-col">' + cFgPct + '</td>' +
                '<td class="num-col">' + cd.pts + '</td>' +
                '<td class="num-col highlight">' + cPpp + '</td></tr>';
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
                quarters[q] = { poss: 0, pts: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, gold: 0, to: 0, open: 0, totalFG: 0 };
            }
            var qd = quarters[q];
            qd.poss++;
            qd.pts += p.points || 0;
            if (p.shotType === 'turnover') qd.to++;
            else if (p.shotType === 'free_throws') {
                qd.ftm += p.ftMade || 0;
                qd.fta += p.ftAttempts || 0;
            } else {
                qd.fga++;
                qd.totalFG++;
                if (p.result === 'made') qd.fgm++;
                if (p.shotType.indexOf('open') === 0) qd.open++;
                if (p.shotType === 'open_3' || p.shotType === 'contested_3') {
                    qd.fg3a++;
                    if (p.result === 'made') qd.fg3m++;
                }
            }
            if (p.grade === 'gold') qd.gold++;
        }

        var html = '<div style="overflow-x:auto"><table class="stat-table"><thead><tr>' +
            '<th>Qtr</th><th class="num-col">Poss</th><th class="num-col">PTS</th><th class="num-col">PPP</th>' +
            '<th class="num-col">FG%</th><th class="num-col">3P%</th><th class="num-col">FT%</th>' +
            '<th class="num-col">Open%</th><th class="num-col">Gold%</th><th class="num-col">TO</th></tr></thead><tbody>';
        for (var qi = 0; qi < qOrder.length; qi++) {
            var qk = qOrder[qi];
            var d = quarters[qk];
            if (!d) continue;
            var qPpp = d.poss > 0 ? (d.pts / d.poss).toFixed(2) : '—';
            var qFg = d.fga > 0 ? Math.round(d.fgm / d.fga * 100) + '%' : '—';
            var q3p = d.fg3a > 0 ? Math.round(d.fg3m / d.fg3a * 100) + '%' : '—';
            var qFt = d.fta > 0 ? Math.round(d.ftm / d.fta * 100) + '%' : '—';
            var qOpen = d.totalFG > 0 ? Math.round(d.open / d.totalFG * 100) + '%' : '—';
            var qGold = d.poss > 0 ? Math.round(d.gold / d.poss * 100) + '%' : '—';
            html += '<tr><td>' + qk + '</td>' +
                '<td class="num-col">' + d.poss + '</td>' +
                '<td class="num-col">' + d.pts + '</td>' +
                '<td class="num-col highlight">' + qPpp + '</td>' +
                '<td class="num-col">' + qFg + '</td>' +
                '<td class="num-col">' + q3p + '</td>' +
                '<td class="num-col">' + qFt + '</td>' +
                '<td class="num-col">' + qOpen + '</td>' +
                '<td class="num-col">' + qGold + '</td>' +
                '<td class="num-col">' + d.to + '</td></tr>';
        }
        html += '</tbody></table></div>';
        return html;
    },

    _byGrade: function(poss) {
        var grades = {
            gold: { poss: 0, pts: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0 },
            silver: { poss: 0, pts: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0 },
            bronze: { poss: 0, pts: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0 }
        };
        var totalPoss = poss.length;
        for (var i = 0; i < poss.length; i++) {
            var p = poss[i];
            var g = grades[p.grade];
            if (!g) continue;
            g.poss++;
            g.pts += p.points || 0;
            if (p.shotType === 'free_throws') {
                g.ftm += p.ftMade || 0;
                g.fta += p.ftAttempts || 0;
            } else if (p.shotType !== 'turnover') {
                g.fga++;
                if (p.result === 'made') g.fgm++;
                if (p.shotType === 'open_3' || p.shotType === 'contested_3') {
                    g.fg3a++;
                    if (p.result === 'made') g.fg3m++;
                }
            }
        }

        var html = '<div style="overflow-x:auto"><table class="stat-table"><thead><tr>' +
            '<th>Grade</th><th class="num-col">Poss</th><th class="num-col">%Tot</th><th class="num-col">FG</th>' +
            '<th class="num-col">FG%</th><th class="num-col">3P%</th><th class="num-col">FT%</th>' +
            '<th class="num-col">PTS</th><th class="num-col">PPP</th></tr></thead><tbody>';
        var order = ['gold', 'silver', 'bronze'];
        var labels = { gold: 'Gold', silver: 'Silver', bronze: 'Bronze' };
        for (var gi = 0; gi < order.length; gi++) {
            var key = order[gi];
            var d = grades[key];
            var pctTot = totalPoss > 0 ? Math.round(d.poss / totalPoss * 100) + '%' : '—';
            var fg = d.fgm + '/' + d.fga;
            var fgPct = d.fga > 0 ? Math.round(d.fgm / d.fga * 100) + '%' : '—';
            var g3Pct = d.fg3a > 0 ? Math.round(d.fg3m / d.fg3a * 100) + '%' : '—';
            var gFtPct = d.fta > 0 ? Math.round(d.ftm / d.fta * 100) + '%' : '—';
            var gPpp = d.poss > 0 ? (d.pts / d.poss).toFixed(2) : '—';
            html += '<tr><td style="color:var(--' + key + ')">' + labels[key] + '</td>' +
                '<td class="num-col">' + d.poss + '</td>' +
                '<td class="num-col">' + pctTot + '</td>' +
                '<td class="num-col">' + fg + '</td>' +
                '<td class="num-col">' + fgPct + '</td>' +
                '<td class="num-col">' + g3Pct + '</td>' +
                '<td class="num-col">' + gFtPct + '</td>' +
                '<td class="num-col">' + d.pts + '</td>' +
                '<td class="num-col highlight">' + gPpp + '</td></tr>';
        }
        html += '</tbody></table></div>';
        return html;
    }
};

window.SQT = SQT;
