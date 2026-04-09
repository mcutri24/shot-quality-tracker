/**
 * Roster CRUD — add, edit, remove players.
 */
var SQT = window.SQT || {};

SQT.Roster = {
    players: [],

    init: function() {
        this.players = SQT.Storage.getRoster();
        this._render();
        this._bind();
    },

    _bind: function() {
        var self = this;
        var addBtn = document.getElementById('roster-add-btn');
        var numInput = document.getElementById('roster-num-input');
        var nameInput = document.getElementById('roster-name-input');

        addBtn.addEventListener('click', function() {
            self._addPlayer();
        });

        nameInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') self._addPlayer();
        });
        numInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') nameInput.focus();
        });
    },

    _addPlayer: function() {
        var numInput = document.getElementById('roster-num-input');
        var nameInput = document.getElementById('roster-name-input');
        var num = numInput.value.trim();
        var name = nameInput.value.trim();

        if (!num) { numInput.focus(); return; }
        if (!name) { nameInput.focus(); return; }

        // Check duplicate number
        for (var i = 0; i < this.players.length; i++) {
            if (this.players[i].number === num) {
                SQT.App.toast('Jersey #' + num + ' already exists');
                return;
            }
        }

        this.players.push({
            id: SQT.Storage.uuid(),
            number: num,
            name: name
        });

        // Sort by jersey number
        this.players.sort(function(a, b) {
            return parseInt(a.number) - parseInt(b.number);
        });

        SQT.Storage.saveRoster(this.players);
        numInput.value = '';
        nameInput.value = '';
        numInput.focus();
        this._render();
    },

    editPlayer: function(playerId) {
        var player = null;
        for (var i = 0; i < this.players.length; i++) {
            if (this.players[i].id === playerId) { player = this.players[i]; break; }
        }
        if (!player) return;

        var newName = prompt('Edit name for #' + player.number, player.name);
        if (newName !== null && newName.trim()) {
            player.name = newName.trim();
            SQT.Storage.saveRoster(this.players);
            this._render();
        }
    },

    deletePlayer: function(playerId) {
        this.players = this.players.filter(function(p) { return p.id !== playerId; });
        SQT.Storage.saveRoster(this.players);
        this._render();
    },

    _render: function() {
        var list = document.getElementById('roster-list');
        if (this.players.length === 0) {
            list.innerHTML = '<div class="roster-empty">No players yet. Add your roster below.</div>';
            return;
        }

        var html = '';
        for (var i = 0; i < this.players.length; i++) {
            var p = this.players[i];
            html += '<div class="roster-item" data-id="' + p.id + '">' +
                '<div class="jersey">' + p.number + '</div>' +
                '<div class="player-info">' +
                    '<div class="player-name">' + this._esc(p.name) + '</div>' +
                    '<div class="player-number">#' + p.number + '</div>' +
                '</div>' +
                '<div class="roster-actions">' +
                    '<button class="edit-btn" data-id="' + p.id + '">&#9998;</button>' +
                    '<button class="delete-btn" data-id="' + p.id + '">&#10005;</button>' +
                '</div>' +
            '</div>';
        }
        list.innerHTML = html;

        // Bind edit/delete
        var self = this;
        var editBtns = list.querySelectorAll('.edit-btn');
        var delBtns = list.querySelectorAll('.delete-btn');
        for (var e = 0; e < editBtns.length; e++) {
            editBtns[e].addEventListener('click', function() {
                self.editPlayer(this.getAttribute('data-id'));
            });
        }
        for (var d = 0; d < delBtns.length; d++) {
            delBtns[d].addEventListener('click', function() {
                self.deletePlayer(this.getAttribute('data-id'));
            });
        }
    },

    _esc: function(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};

window.SQT = SQT;
