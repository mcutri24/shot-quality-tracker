/**
 * Plays CRUD — add, edit, remove offensive plays.
 */
var SQT = window.SQT || {};

SQT.Plays = {
    plays: [],

    init: function() {
        SQT.Storage.initDefaultPlays();
        this.plays = SQT.Storage.getPlays();
        this._render();
        this._bind();
    },

    _bind: function() {
        var self = this;
        var addBtn = document.getElementById('plays-add-btn');
        var nameInput = document.getElementById('plays-name-input');

        addBtn.addEventListener('click', function() {
            self._addPlay();
        });

        nameInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') self._addPlay();
        });
    },

    _addPlay: function() {
        var nameInput = document.getElementById('plays-name-input');
        var name = nameInput.value.trim();

        if (!name) { nameInput.focus(); return; }

        // Check duplicate name
        for (var i = 0; i < this.plays.length; i++) {
            if (this.plays[i].name.toLowerCase() === name.toLowerCase()) {
                SQT.App.toast('Play "' + name + '" already exists');
                return;
            }
        }

        this.plays.push({
            id: SQT.Storage.uuid(),
            name: name,
            color: null,
            order: this.plays.length,
            isDefault: false
        });

        SQT.Storage.savePlays(this.plays);
        nameInput.value = '';
        nameInput.focus();
        this._render();
    },

    editPlay: function(playId) {
        var play = null;
        for (var i = 0; i < this.plays.length; i++) {
            if (this.plays[i].id === playId) { play = this.plays[i]; break; }
        }
        if (!play) return;
        if (play.isDefault) {
            SQT.App.toast('Cannot edit default plays');
            return;
        }

        var newName = prompt('Edit play name:', play.name);
        if (newName !== null && newName.trim()) {
            play.name = newName.trim();
            SQT.Storage.savePlays(this.plays);
            this._render();
        }
    },

    _movePlay: function(idx, direction) {
        var newIdx = idx + direction;
        if (newIdx < 0 || newIdx >= this.plays.length) return;
        var temp = this.plays[idx];
        this.plays[idx] = this.plays[newIdx];
        this.plays[newIdx] = temp;
        SQT.Storage.savePlays(this.plays);
        this._render();
    },

    deletePlay: function(playId) {
        // Prevent deleting defaults
        for (var i = 0; i < this.plays.length; i++) {
            if (this.plays[i].id === playId && this.plays[i].isDefault) {
                SQT.App.toast('Cannot delete default plays');
                return;
            }
        }
        this.plays = this.plays.filter(function(p) { return p.id !== playId; });
        SQT.Storage.savePlays(this.plays);
        this._render();
    },

    _render: function() {
        var list = document.getElementById('plays-list');
        if (this.plays.length === 0) {
            list.innerHTML = '<div class="roster-empty">No plays yet. Add your plays below.</div>';
            return;
        }

        var html = '';
        for (var i = 0; i < this.plays.length; i++) {
            var p = this.plays[i];
            var colorStyle = '';
            if (p.color === 'blue') colorStyle = 'color:#4a9eff;border-color:#4a9eff;';
            else if (p.color === 'orange') colorStyle = 'color:#f97316;border-color:#f97316;';

            var badge = '';
            if (p.isDefault) badge = '<span style="font-size:10px;color:var(--text-muted);margin-left:6px;">DEFAULT</span>';

            html += '<div class="roster-item" data-id="' + p.id + '">' +
                '<div class="play-icon" style="' + colorStyle + '">' + this._esc(p.name.charAt(0)) + '</div>' +
                '<div class="player-info">' +
                    '<div class="player-name">' + this._esc(p.name) + badge + '</div>' +
                '</div>' +
                '<div class="roster-actions">';

            if (!p.isDefault) {
                html += '<button class="move-btn move-up" data-idx="' + i + '"' + (i === 0 ? ' disabled style="opacity:0.3"' : '') + '>&#9650;</button>' +
                    '<button class="move-btn move-down" data-idx="' + i + '"' + (i === this.plays.length - 1 ? ' disabled style="opacity:0.3"' : '') + '>&#9660;</button>' +
                    '<button class="edit-btn" data-id="' + p.id + '">&#9998;</button>' +
                    '<button class="delete-btn" data-id="' + p.id + '">&#10005;</button>';
            }

            html += '</div></div>';
        }
        list.innerHTML = html;

        // Bind edit/delete/move
        var self = this;
        var editBtns = list.querySelectorAll('.edit-btn');
        var delBtns = list.querySelectorAll('.delete-btn');
        var upBtns = list.querySelectorAll('.move-up');
        var downBtns = list.querySelectorAll('.move-down');
        for (var e = 0; e < editBtns.length; e++) {
            editBtns[e].addEventListener('click', function() {
                self.editPlay(this.getAttribute('data-id'));
            });
        }
        for (var d = 0; d < delBtns.length; d++) {
            delBtns[d].addEventListener('click', function() {
                if (confirm('Delete this play?')) {
                    self.deletePlay(this.getAttribute('data-id'));
                }
            });
        }
        for (var u = 0; u < upBtns.length; u++) {
            upBtns[u].addEventListener('click', function() {
                var idx = parseInt(this.getAttribute('data-idx'));
                self._movePlay(idx, -1);
            });
        }
        for (var dn = 0; dn < downBtns.length; dn++) {
            downBtns[dn].addEventListener('click', function() {
                var idx = parseInt(this.getAttribute('data-idx'));
                self._movePlay(idx, 1);
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
