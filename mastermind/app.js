/*
 * Fogarty Mastermind -- screens, modes and input.
 *
 * The rules live in rules.js; this file is everything that touches the DOM.
 */
(function () {
    'use strict';

    var M = window.Mastermind;
    var Store = window.MastermindStore;
    var Sfx = window.MastermindSfx;

    var $ = function (id) { return document.getElementById(id); };

    /* ------------------------------------------------------------- state -- */

    var settings = Store.getSettings();

    var state = {
        mode: 'solo',
        difficulty: settings.difficulty,
        preset: M.getPreset(settings.difficulty),
        code: [],
        rows: [],          // { guess: [], result: { exact, color } }
        rowIndex: 0,
        finished: false,
        won: false,
        dateKey: null,     // daily only
        versus: null
    };

    var armedColor = null;   // colour picked from the palette, ready to place
    var editor = null;       // the row editor for the active guess
    var suppressClick = false;

    /* --------------------------------------------------------- utilities -- */

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) { node.className = className; }
        if (text !== undefined) { node.textContent = text; }
        return node;
    }

    function colorName(id) {
        return M.COLORS[id] ? M.COLORS[id].name : 'Empty';
    }

    function announce(message) {
        $('live-region').textContent = message;
    }

    var toastTimer = null;
    function toast(message) {
        var node = $('toast');
        node.textContent = message;
        node.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { node.hidden = true; }, 1900);
    }

    function showScreen(id) {
        var screens = document.querySelectorAll('.screen');
        for (var i = 0; i < screens.length; i++) {
            screens[i].classList.toggle('is-active', screens[i].id === id);
        }
    }

    /* ------------------------------------------------------- peg factory -- */

    function makePeg(colorId, masked) {
        var peg = el('div', 'peg' + (masked ? ' is-masked' : ''));
        if (!masked) { peg.setAttribute('data-color', String(colorId)); }
        var glyph = el('span', 'peg-glyph', masked ? '?' : M.COLORS[colorId].glyph);
        peg.appendChild(glyph);
        return peg;
    }

    function makeSlot(index, interactive) {
        var slot = document.createElement(interactive ? 'button' : 'div');
        slot.className = 'slot';
        slot.setAttribute('data-index', String(index));
        if (interactive) {
            slot.type = 'button';
            slot.setAttribute('aria-label', 'Slot ' + (index + 1) + ', empty');
        }
        return slot;
    }

    /* ------------------------------------------------------- row editor -- */

    /**
     * Wraps one editable row of slots: placing, lifting, and the visual hints
     * for where the next peg will land.
     */
    function createRowEditor(rowEl, slots, onChange) {
        var values = [];
        for (var i = 0; i < slots; i++) { values.push(null); }
        var target = null;

        function slotEl(index) {
            return rowEl.querySelector('.slot[data-index="' + index + '"]');
        }

        function nextEmpty() {
            for (var i = 0; i < slots; i++) {
                if (values[i] === null) { return i; }
            }
            return null;
        }

        function isComplete() {
            return M.isComplete(values, slots);
        }

        function paint(index, animate) {
            var node = slotEl(index);
            if (!node) { return; }
            var existing = node.querySelector('.peg');
            if (existing) { node.removeChild(existing); }
            if (values[index] !== null) {
                var peg = makePeg(values[index], false);
                if (!animate) { peg.style.animation = 'none'; }
                node.appendChild(peg);
                node.setAttribute('aria-label',
                    'Slot ' + (index + 1) + ', ' + colorName(values[index]) + '. Activate to remove.');
            } else {
                node.setAttribute('aria-label', 'Slot ' + (index + 1) + ', empty');
            }
        }

        function refreshHints() {
            var next = nextEmpty();
            for (var i = 0; i < slots; i++) {
                var node = slotEl(i);
                if (!node) { continue; }
                node.classList.toggle('is-target', target === i);
                node.classList.toggle('is-next', target === null && next === i);
            }
            onChange(values, isComplete());
        }

        function place(colorId, index) {
            var at = index;
            if (at === null || at === undefined) {
                at = target !== null ? target : nextEmpty();
            }
            if (at === null) { return false; }
            values[at] = colorId;
            target = null;
            paint(at, true);
            refreshHints();
            Sfx.place();
            return true;
        }

        function clear(index) {
            if (values[index] === null) { return false; }
            values[index] = null;
            target = index;
            paint(index, false);
            refreshHints();
            Sfx.lift();
            return true;
        }

        function clearAll() {
            for (var i = 0; i < slots; i++) {
                values[i] = null;
                paint(i, false);
            }
            target = null;
            refreshHints();
        }

        function removeLast() {
            for (var i = slots - 1; i >= 0; i--) {
                if (values[i] !== null) { return clear(i); }
            }
            return false;
        }

        function setTarget(index) {
            target = target === index ? null : index;
            refreshHints();
        }

        rowEl.addEventListener('click', function (event) {
            var node = event.target.closest ? event.target.closest('.slot') : null;
            if (!node || !rowEl.contains(node)) { return; }
            if (suppressClick) { suppressClick = false; return; }
            Sfx.unlock();
            var index = Number(node.getAttribute('data-index'));
            if (values[index] !== null) {
                clear(index);
            } else if (armedColor !== null) {
                place(armedColor, index);
            } else {
                setTarget(index);
            }
        });

        refreshHints();

        return {
            values: values,
            place: place,
            clear: clear,
            clearAll: clearAll,
            removeLast: removeLast,
            isComplete: isComplete,
            nextEmpty: nextEmpty,
            rowEl: rowEl
        };
    }

    /* --------------------------------------------------------- palette -- */

    function renderPalette(container, colorCount) {
        container.innerHTML = '';
        for (var i = 0; i < colorCount; i++) {
            var swatch = el('button', 'swatch');
            swatch.type = 'button';
            swatch.setAttribute('data-color', String(i));
            swatch.setAttribute('aria-label', M.COLORS[i].name + ' peg, key ' + (i + 1));
            swatch.title = M.COLORS[i].name + ' (' + (i + 1) + ')';
            var glyph = el('span', 'peg-glyph', M.COLORS[i].glyph);
            swatch.appendChild(glyph);
            var hint = el('span', 'swatch-key', String(i + 1));
            swatch.appendChild(hint);
            container.appendChild(swatch);
        }
    }

    function setArmed(colorId, container) {
        armedColor = colorId;
        var swatches = container.querySelectorAll('.swatch');
        for (var i = 0; i < swatches.length; i++) {
            swatches[i].classList.toggle('is-armed',
                Number(swatches[i].getAttribute('data-color')) === colorId);
        }
    }

    /**
     * Wire a palette to an editor: tap to place, drag to aim. Taps are handled
     * on `click` so keyboard activation works too; pointer handlers only take
     * over once a real drag starts.
     */
    function bindPalette(container, getEditor) {
        var drag = null;

        container.addEventListener('click', function (event) {
            var swatch = event.target.closest ? event.target.closest('.swatch') : null;
            if (!swatch) { return; }
            if (suppressClick) { suppressClick = false; return; }
            Sfx.unlock();
            var colorId = Number(swatch.getAttribute('data-color'));
            setArmed(colorId, container);
            var ed = getEditor();
            if (ed && ed.nextEmpty() !== null) {
                ed.place(colorId, null);
            } else if (ed) {
                Sfx.deny();
            }
        });

        container.addEventListener('pointerdown', function (event) {
            var swatch = event.target.closest ? event.target.closest('.swatch') : null;
            if (!swatch || event.button === 2) { return; }
            drag = {
                colorId: Number(swatch.getAttribute('data-color')),
                startX: event.clientX,
                startY: event.clientY,
                moved: false,
                ghost: null,
                pointerId: event.pointerId
            };
        });

        window.addEventListener('pointermove', function (event) {
            if (!drag || event.pointerId !== drag.pointerId) { return; }
            var dx = event.clientX - drag.startX;
            var dy = event.clientY - drag.startY;
            if (!drag.moved && (dx * dx + dy * dy) < 100) { return; }

            if (!drag.moved) {
                drag.moved = true;
                Sfx.unlock();
                drag.ghost = el('div', 'drag-ghost');
                drag.ghost.setAttribute('data-color', String(drag.colorId));
                document.body.appendChild(drag.ghost);
            }
            drag.ghost.style.left = event.clientX + 'px';
            drag.ghost.style.top = event.clientY + 'px';

            var ed = getEditor();
            if (!ed) { return; }
            var over = slotUnderPoint(ed, event.clientX, event.clientY);
            var slots = ed.rowEl.querySelectorAll('.slot');
            for (var i = 0; i < slots.length; i++) {
                slots[i].classList.toggle('is-target', slots[i] === over);
            }
        });

        window.addEventListener('pointerup', function (event) {
            if (!drag || event.pointerId !== drag.pointerId) { return; }
            var finished = drag;
            drag = null;
            if (finished.ghost) { document.body.removeChild(finished.ghost); }
            if (!finished.moved) { return; }

            suppressClick = true;
            setTimeout(function () { suppressClick = false; }, 0);

            var ed = getEditor();
            if (!ed) { return; }
            var over = slotUnderPoint(ed, event.clientX, event.clientY);
            var slots = ed.rowEl.querySelectorAll('.slot');
            for (var i = 0; i < slots.length; i++) { slots[i].classList.remove('is-target'); }

            setArmed(finished.colorId, container);
            if (over) {
                ed.place(finished.colorId, Number(over.getAttribute('data-index')));
            } else if (ed.nextEmpty() !== null) {
                ed.place(finished.colorId, null);
            }
        });

        window.addEventListener('pointercancel', function () {
            if (drag && drag.ghost) { document.body.removeChild(drag.ghost); }
            drag = null;
        });
    }

    /** Which slot of the active row sits under this point, if any. */
    function slotUnderPoint(ed, x, y) {
        var node = document.elementFromPoint(x, y);
        var slot = node && node.closest ? node.closest('.slot') : null;
        return slot && ed.rowEl.contains(slot) ? slot : null;
    }

    /* ------------------------------------------------------------ board -- */

    function buildBoard() {
        var preset = state.preset;

        var secretPegs = $('secret-pegs');
        secretPegs.innerHTML = '';
        for (var s = 0; s < preset.slots; s++) {
            var well = makeSlot(s, false);
            well.appendChild(makePeg(null, true));
            secretPegs.appendChild(well);
        }
        $('secret').classList.remove('is-open');
        $('secret-shield').style.display = '';

        var rowsEl = $('rows');
        rowsEl.innerHTML = '';
        for (var r = 0; r < preset.guesses; r++) {
            rowsEl.appendChild(buildRow(r));
        }

        renderPalette($('palette'), preset.colors);
        setArmed(null, $('palette'));
        activateRow(0);
    }

    function buildRow(index) {
        var row = el('div', 'row is-future');
        row.setAttribute('data-row', String(index));
        row.appendChild(el('span', 'row-num', String(index + 1)));

        var pegs = el('div', 'row-pegs');
        for (var i = 0; i < state.preset.slots; i++) {
            pegs.appendChild(makeSlot(i, false));
        }
        row.appendChild(pegs);

        var keys = el('div', 'keys');
        keys.style.gridTemplateColumns = 'repeat(' + Math.ceil(state.preset.slots / 2) + ', auto)';
        for (var k = 0; k < state.preset.slots; k++) {
            keys.appendChild(el('span', 'key-peg'));
        }
        row.appendChild(keys);
        return row;
    }

    /** Make row `index` the editable one. Rebuilds its slots as buttons. */
    function activateRow(index) {
        var rowsEl = $('rows');
        var row = rowsEl.querySelector('.row[data-row="' + index + '"]');
        if (!row) { return; }

        row.classList.remove('is-future');
        row.classList.add('is-active');

        // Swap in a fresh container so no editor listener from a previous
        // occupant of this row survives.
        var pegs = el('div', 'row-pegs');
        for (var i = 0; i < state.preset.slots; i++) {
            pegs.appendChild(makeSlot(i, true));
        }
        row.replaceChild(pegs, row.querySelector('.row-pegs'));

        editor = createRowEditor(pegs, state.preset.slots, function (values, complete) {
            $('btn-submit').disabled = !complete;
        });

        state.rowIndex = index;
        updateCounter();
        row.scrollIntoView({ block: 'nearest' });
    }

    function updateCounter() {
        $('guess-counter').textContent =
            'Guess ' + (state.rowIndex + 1) + ' of ' + state.preset.guesses;
    }

    /** Draw a finished guess into its row, with the key pegs animating in. */
    function renderFinishedRow(index, guess, result, animate) {
        var row = $('rows').querySelector('.row[data-row="' + index + '"]');
        if (!row) { return; }

        row.classList.remove('is-active', 'is-future');
        row.classList.add('is-done');

        // A fresh container: the row is read-only now, and this drops the
        // editor's click listener along with the old nodes.
        var pegs = el('div', 'row-pegs');
        for (var i = 0; i < guess.length; i++) {
            var slot = makeSlot(i, false);
            var peg = makePeg(guess[i], false);
            peg.style.animation = 'none';
            slot.appendChild(peg);
            slot.setAttribute('aria-label', 'Slot ' + (i + 1) + ', ' + colorName(guess[i]));
            pegs.appendChild(slot);
        }
        row.replaceChild(pegs, row.querySelector('.row-pegs'));

        var keys = row.querySelector('.keys').children;
        for (var k = 0; k < keys.length; k++) {
            var cls = 'key-peg';
            if (k < result.exact) {
                cls += ' is-exact';
            } else if (k < result.exact + result.color) {
                cls += ' is-color';
            }
            keys[k].className = cls;
            if (animate && k < result.exact + result.color) {
                keys[k].classList.add('is-new');
                keys[k].style.animationDelay = (k * 0.07) + 's';
                Sfx.key(k, k < result.exact);
            }
        }

        row.setAttribute('aria-label',
            'Guess ' + (index + 1) + ': ' + result.exact + ' exact, ' + result.color + ' colour only');
    }

    /* ------------------------------------------------------------- play -- */

    function submitGuess() {
        if (state.finished || !editor) { return; }
        if (!editor.isComplete()) {
            Sfx.deny();
            editor.rowEl.parentNode.classList.add('is-shake');
            setTimeout(function () {
                editor.rowEl.parentNode.classList.remove('is-shake');
            }, 320);
            announce('Fill every slot before checking.');
            return;
        }

        Sfx.unlock();
        Sfx.submit();

        var guess = editor.values.slice();
        var result = M.score(guess, state.code);
        state.rows.push({ guess: guess, result: result });

        renderFinishedRow(state.rowIndex, guess, result, true);
        announce('Guess ' + (state.rowIndex + 1) + ': ' +
            result.exact + ' exact, ' + result.color + ' right colour wrong place.');

        editor = null;
        $('btn-submit').disabled = true;

        if (M.isSolved(result, state.preset.slots)) {
            finishGame(true);
        } else if (state.rows.length >= state.preset.guesses) {
            finishGame(false);
        } else {
            activateRow(state.rowIndex + 1);
        }

        if (state.mode === 'daily') { persistDaily(); }
    }

    function revealSecret() {
        var wells = $('secret-pegs').children;
        for (var i = 0; i < wells.length; i++) {
            wells[i].innerHTML = '';
            var peg = makePeg(state.code[i], false);
            peg.style.animation = 'none';
            wells[i].appendChild(peg);
            wells[i].setAttribute('aria-label', 'Secret slot ' + (i + 1) + ', ' + colorName(state.code[i]));
        }
        $('secret').classList.add('is-open');
        setTimeout(function () { $('secret-shield').style.display = 'none'; }, 560);
    }

    function finishGame(won) {
        state.finished = true;
        state.won = won;
        revealSecret();
        setTimeout(won ? Sfx.win : Sfx.lose, 260);

        if (state.mode === 'solo') {
            Store.recordGame(state.difficulty, won, state.rows.length);
        } else if (state.mode === 'daily') {
            Store.recordGame(state.difficulty, won, state.rows.length);
            Store.recordDaily(state.dateKey, won);
            persistDaily();
        } else if (state.mode === 'versus') {
            var v = state.versus;
            var penalty = won ? state.rows.length : state.preset.guesses + 1;
            v.scores[v.breaker] += penalty;
        }

        announce(won
            ? 'Cracked in ' + state.rows.length + ' guesses.'
            : 'Out of guesses. The code is revealed.');

        setTimeout(showResult, 900);
    }

    /* ----------------------------------------------------------- results -- */

    function showResult() {
        var isVersus = state.mode === 'versus';
        var title = $('result-title');
        var text = $('result-text');

        if (isVersus) {
            var v = state.versus;
            title.textContent = state.won
                ? v.names[v.breaker] + ' cracked it'
                : v.names[v.breaker] + ' ran out of rows';
            text.textContent = state.won
                ? 'Solved in ' + state.rows.length + ' ' + plural(state.rows.length, 'guess', 'guesses') +
                  ' - that is ' + state.rows.length + ' ' + plural(state.rows.length, 'point', 'points') + '.'
                : 'No solve, so that is ' + (state.preset.guesses + 1) + ' points. Lowest total wins.';
        } else {
            title.textContent = state.won ? 'Cracked it' : 'Out of guesses';
            text.textContent = state.won
                ? 'Solved in ' + state.rows.length + ' of ' + state.preset.guesses + '.'
                : 'The code is revealed above. Next one is yours.';
        }

        var codeEl = $('result-code');
        codeEl.innerHTML = '';
        for (var i = 0; i < state.code.length; i++) {
            var well = makeSlot(i, false);
            var peg = makePeg(state.code[i], false);
            well.appendChild(peg);
            codeEl.appendChild(well);
        }

        var statsEl = $('result-stats');
        statsEl.innerHTML = '';
        if (isVersus) {
            var vs = state.versus;
            statsEl.appendChild(makeStat(vs.scores[0], vs.names[0]));
            statsEl.appendChild(makeStat(vs.scores[1], vs.names[1]));
            statsEl.appendChild(makeStat(Math.min(vs.round + 1, vs.rounds) + '/' + vs.rounds, 'Round'));
            statsEl.appendChild(makeStat(state.won ? state.rows.length : '-', 'This round'));
        } else {
            renderStatTiles(statsEl, Store.getStats(state.difficulty));
        }

        var share = $('share-preview');
        if (isVersus) {
            share.hidden = true;
            $('result-share').hidden = true;
        } else {
            share.hidden = false;
            $('result-share').hidden = false;
            share.textContent = buildShareText();
        }

        var again = $('result-again');
        if (isVersus) {
            again.textContent = state.versus.round + 1 >= state.versus.rounds
                ? 'See final score'
                : 'Next round';
            again.hidden = false;
        } else if (state.mode === 'daily') {
            again.hidden = true;
        } else {
            again.textContent = 'Play again';
            again.hidden = false;
        }

        openDialog('dialog-result');
    }

    function plural(n, one, many) { return n === 1 ? one : many; }

    function makeStat(value, label) {
        var wrap = el('div', 'stat');
        wrap.appendChild(el('span', 'stat-value', String(value)));
        wrap.appendChild(el('span', 'stat-label', label));
        return wrap;
    }

    function renderStatTiles(container, stats) {
        var winPct = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
        var avg = Store.averageWinGuesses(stats);
        container.appendChild(makeStat(stats.played, 'Played'));
        container.appendChild(makeStat(winPct + '%', 'Win rate'));
        container.appendChild(makeStat(avg ? avg.toFixed(1) : '-', 'Avg guesses'));
        container.appendChild(makeStat(stats.streak, 'Streak'));
    }

    /* ------------------------------------------------------------- share -- */

    function buildShareText() {
        var header = state.mode === 'daily'
            ? 'Fogarty Mastermind - Daily #' + M.dailyNumber(state.dateKey)
            : 'Fogarty Mastermind';
        var line = (state.won ? state.rows.length : 'X') + '/' + state.preset.guesses +
            ' - ' + state.preset.label;

        var grid = [];
        for (var i = 0; i < state.rows.length; i++) {
            var r = state.rows[i].result;
            var row = '';
            for (var k = 0; k < state.preset.slots; k++) {
                if (k < r.exact) { row += '🔴'; }          // red circle - exact
                else if (k < r.exact + r.color) { row += '⚪'; } // white circle - colour only
                else { row += '⬛'; }                            // black square - no match
            }
            grid.push(row);
        }

        var url = location.origin + location.pathname;
        return header + '\n' + line + '\n\n' + grid.join('\n') + '\n\n' + url;
    }

    function copyShare() {
        var text = buildShareText();
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () {
                toast('Copied to clipboard');
            }, function () { fallbackCopy(text); });
        } else {
            fallbackCopy(text);
        }
    }

    function fallbackCopy(text) {
        var area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        document.body.removeChild(area);
        toast(ok ? 'Copied to clipboard' : 'Copy failed - select the text above');
    }

    /* ----------------------------------------------------------- dialogs -- */

    var openDialogId = null;

    function openDialog(id) {
        var dialogs = document.querySelectorAll('.dialog');
        for (var i = 0; i < dialogs.length; i++) {
            dialogs[i].hidden = dialogs[i].id !== id;
        }
        $('overlay').hidden = false;
        openDialogId = id;
        var focusTarget = $(id).querySelector('.primary-btn:not([hidden]), .ghost-btn');
        if (focusTarget) { focusTarget.focus(); }
    }

    function closeDialog() {
        $('overlay').hidden = true;
        openDialogId = null;
    }

    var confirmAction = null;
    function askConfirm(title, text, onYes) {
        $('confirm-title').textContent = title;
        $('confirm-text').textContent = text;
        confirmAction = onYes;
        openDialog('dialog-confirm');
    }

    /* -------------------------------------------------------------- daily -- */

    /** Stored shape: { date, byDifficulty: { <key>: { rows, finished, won } } }. */
    function loadDailyRecord() {
        var today = M.todayKey();
        var record = Store.getDaily();
        if (!record || record.date !== today || !record.byDifficulty) {
            record = { date: today, byDifficulty: {} };
        }
        return record;
    }

    function persistDaily() {
        var record = loadDailyRecord();
        record.byDifficulty[state.difficulty] = {
            rows: state.rows,
            finished: state.finished,
            won: state.won
        };
        Store.saveDaily(record);
    }

    /* --------------------------------------------------------- game start -- */

    function startGame(options) {
        state.mode = options.mode;
        state.difficulty = options.difficulty || state.difficulty;
        state.preset = M.getPreset(state.difficulty);
        state.code = options.code;
        state.rows = [];
        state.rowIndex = 0;
        state.finished = false;
        state.won = false;
        state.dateKey = options.dateKey || null;

        armedColor = null;
        buildBoard();
        updateTopbar();

        // Replay any saved history (daily resume).
        if (options.history && options.history.length) {
            for (var i = 0; i < options.history.length; i++) {
                var entry = options.history[i];
                state.rows.push(entry);
                renderFinishedRow(i, entry.guess, entry.result, false);
            }
            if (options.finished) {
                state.finished = true;
                state.won = !!options.won;
                revealSecret();
                $('btn-submit').disabled = true;
                editor = null;
                var lastRow = $('rows').querySelector('.row.is-active');
                if (lastRow) { lastRow.classList.remove('is-active'); }
            } else {
                activateRow(state.rows.length);
            }
        }

        showScreen('screen-game');
    }

    function updateTopbar() {
        var modeName = { solo: 'Solo', daily: 'Daily Challenge', versus: 'Pass & Play' }[state.mode];
        if (state.mode === 'daily') {
            modeName += ' #' + M.dailyNumber(state.dateKey);
        }
        $('game-mode').textContent = modeName;

        var sub = state.preset.label + ' · ' + state.preset.slots + ' pegs, ' +
            state.preset.colors + ' colours';
        if (state.mode === 'versus') {
            var v = state.versus;
            sub = v.names[v.breaker] + ' is breaking · round ' + (v.round + 1) + ' of ' + v.rounds;
        }
        $('game-sub').textContent = sub;

        var scoreEl = $('versus-score');
        if (state.mode === 'versus') {
            var vs = state.versus;
            scoreEl.hidden = false;
            scoreEl.textContent = vs.names[0] + ' ' + vs.scores[0] + ' – ' + vs.scores[1] + ' ' + vs.names[1];
        } else {
            scoreEl.hidden = true;
        }
    }

    function startSolo() {
        startGame({
            mode: 'solo',
            difficulty: state.difficulty,
            code: M.makeCode(M.getPreset(state.difficulty))
        });
    }

    function startDaily() {
        var today = M.todayKey();
        var record = loadDailyRecord();
        var saved = record.byDifficulty[state.difficulty];
        startGame({
            mode: 'daily',
            difficulty: state.difficulty,
            dateKey: today,
            code: M.dailyCode(today, state.difficulty),
            history: saved ? saved.rows : null,
            finished: saved ? saved.finished : false,
            won: saved ? saved.won : false
        });
        if (saved && saved.finished) {
            setTimeout(showResult, 400);
        }
    }

    /* -------------------------------------------------------- pass & play -- */

    var setcodeEditor = null;

    function startVersus() {
        state.versus = {
            round: 0,
            rounds: 4,
            scores: [0, 0],
            names: ['Player 1', 'Player 2'],
            maker: 0,
            breaker: 1
        };
        beginVersusRound();
    }

    function beginVersusRound() {
        var v = state.versus;
        v.maker = v.round % 2;
        v.breaker = 1 - v.maker;
        showHandoff(v.names[v.maker], 'You are setting the code.', function () {
            showSetCode();
        });
    }

    function showHandoff(who, what, next) {
        $('handoff-title').textContent = 'Pass to ' + who;
        $('handoff-sub').textContent = what;
        var v = state.versus;
        $('handoff-score').textContent = 'Round ' + (v.round + 1) + ' of ' + v.rounds +
            ' · ' + v.names[0] + ' ' + v.scores[0] + ' – ' + v.scores[1] + ' ' + v.names[1] +
            ' · lowest total wins';
        $('handoff-continue').onclick = function () {
            Sfx.unlock();
            Sfx.click();
            next();
        };
        showScreen('screen-handoff');
    }

    function showSetCode() {
        var v = state.versus;
        var preset = M.getPreset(state.difficulty);
        $('setcode-title').textContent = v.names[v.maker] + ' — set the code';
        $('setcode-sub').textContent = preset.slots + ' pegs from ' + preset.colors +
            ' colours. Repeats are allowed.';

        var row = $('setcode-row');
        row.innerHTML = '';
        for (var i = 0; i < preset.slots; i++) {
            row.appendChild(makeSlot(i, true));
        }

        armedColor = null;
        renderPalette($('setcode-palette'), preset.colors);
        setArmed(null, $('setcode-palette'));

        setcodeEditor = createRowEditor(row, preset.slots, function (values, complete) {
            $('setcode-confirm').disabled = !complete;
        });

        showScreen('screen-setcode');
    }

    function confirmSetCode() {
        if (!setcodeEditor || !setcodeEditor.isComplete()) { return; }
        var code = setcodeEditor.values.slice();
        var v = state.versus;
        showHandoff(v.names[v.breaker], 'Crack the code. Good luck.', function () {
            startGame({ mode: 'versus', difficulty: state.difficulty, code: code });
        });
    }

    function nextVersusStep() {
        var v = state.versus;
        v.round += 1;
        if (v.round >= v.rounds) {
            showVersusFinal();
        } else {
            beginVersusRound();
        }
    }

    function showVersusFinal() {
        var v = state.versus;
        var title = $('result-title');
        var text = $('result-text');
        if (v.scores[0] === v.scores[1]) {
            title.textContent = 'Dead heat';
            text.textContent = 'Both players finished on ' + v.scores[0] + '. Run it back.';
        } else {
            var winner = v.scores[0] < v.scores[1] ? 0 : 1;
            title.textContent = v.names[winner] + ' wins';
            text.textContent = v.names[winner] + ' needed fewer guesses across the match.';
        }

        $('result-code').innerHTML = '';
        var statsEl = $('result-stats');
        statsEl.innerHTML = '';
        statsEl.appendChild(makeStat(v.scores[0], v.names[0]));
        statsEl.appendChild(makeStat(v.scores[1], v.names[1]));
        $('share-preview').hidden = true;
        $('result-share').hidden = true;
        $('result-again').textContent = 'New match';
        $('result-again').hidden = false;
        state.versus = null;
        openDialog('dialog-result');
    }

    /* ---------------------------------------------------------- menu wiring */

    function renderDifficultyPicker() {
        var picker = $('difficulty-picker');
        picker.innerHTML = '';
        M.PRESET_ORDER.forEach(function (key) {
            var preset = M.PRESETS[key];
            var button = el('button', null, preset.label);
            button.type = 'button';
            button.setAttribute('role', 'radio');
            button.setAttribute('data-difficulty', key);
            button.setAttribute('aria-checked', String(key === state.difficulty));
            button.addEventListener('click', function () {
                Sfx.unlock();
                Sfx.click();
                state.difficulty = key;
                Store.setSetting('difficulty', key);
                renderDifficultyPicker();
                updateDifficultyHint();
                updateDailyBadge();
            });
            picker.appendChild(button);
        });
    }

    function updateDifficultyHint() {
        var p = M.getPreset(state.difficulty);
        $('difficulty-hint').textContent =
            p.slots + ' pegs · ' + p.colors + ' colours · ' + p.guesses +
            ' guesses · repeats allowed';
    }

    function updateDailyBadge() {
        var today = M.todayKey();
        var badge = $('daily-badge');
        badge.textContent = '#' + M.dailyNumber(today);

        var record = loadDailyRecord();
        var saved = record.byDifficulty[state.difficulty];
        var streak = Store.getDailyStreak();

        if (saved && saved.finished) {
            badge.classList.add('is-done');
            $('daily-desc').textContent = saved.won
                ? 'Solved today in ' + saved.rows.length + '. Streak: ' + streak.streak + '.'
                : 'Today\'s code beat you. Come back tomorrow.';
        } else {
            badge.classList.remove('is-done');
            $('daily-desc').textContent = streak.streak
                ? 'One code a day, same for everyone. Streak: ' + streak.streak + '.'
                : 'One code a day, the same for everyone.';
        }
    }

    function showStatsDialog() {
        var stats = Store.getStats(state.difficulty);
        var daily = Store.getDailyStreak();
        $('stats-scope').textContent = M.getPreset(state.difficulty).label +
            ' · best streak ' + stats.maxStreak +
            ' · daily streak ' + daily.streak + ' (best ' + daily.maxStreak + ')';

        var grid = $('stats-grid');
        grid.innerHTML = '';
        renderStatTiles(grid, stats);

        var hist = $('stats-histogram');
        hist.innerHTML = '';
        var preset = M.getPreset(state.difficulty);
        var max = 1;
        var n;
        for (n = 1; n <= preset.guesses; n++) {
            max = Math.max(max, stats.distribution[n] || 0);
        }
        for (n = 1; n <= preset.guesses; n++) {
            var count = stats.distribution[n] || 0;
            var row = el('div', 'hist-row');
            if (state.finished && state.won && state.rows.length === n) {
                row.classList.add('is-latest');
            }
            row.appendChild(el('span', null, String(n)));
            var bar = el('span', 'hist-bar', String(count));
            bar.style.width = Math.max(8, (count / max) * 100) + '%';
            row.appendChild(bar);
            hist.appendChild(row);
        }

        openDialog('dialog-stats');
    }

    /* --------------------------------------------------------- settings -- */

    function applySound(on) {
        settings.sound = on;
        Store.setSetting('sound', on);
        Sfx.setEnabled(on);
        $('btn-sound').textContent = on ? 'Sound on' : 'Sound off';
        $('btn-sound').setAttribute('aria-pressed', String(on));
        $('game-sound').textContent = on ? '🔊' : '🔇';
        $('game-sound').setAttribute('aria-pressed', String(on));
    }

    function applyColorblind(on) {
        settings.colorblind = on;
        Store.setSetting('colorblind', on);
        document.body.classList.toggle('cb', on);
        $('btn-colorblind').textContent = on ? 'Symbols on' : 'Symbols off';
        $('btn-colorblind').setAttribute('aria-pressed', String(on));
    }

    /* ------------------------------------------------------------ events -- */

    function goMenu() {
        state.versus = null;
        editor = null;
        closeDialog();
        renderDifficultyPicker();
        updateDifficultyHint();
        updateDailyBadge();
        showScreen('screen-menu');
    }

    function leaveGame() {
        if (state.finished || state.rows.length === 0) {
            goMenu();
            return;
        }
        askConfirm('Leave this game?',
            state.mode === 'versus'
                ? 'The match will be abandoned.'
                : 'This round will be lost. It won\'t count as a loss.',
            goMenu);
    }

    function bindEvents() {
        // Menu
        var cards = document.querySelectorAll('.mode-card');
        for (var i = 0; i < cards.length; i++) {
            cards[i].addEventListener('click', function () {
                Sfx.unlock();
                Sfx.click();
                var mode = this.getAttribute('data-mode');
                if (mode === 'solo') { startSolo(); }
                else if (mode === 'daily') { startDaily(); }
                else { startVersus(); }
            });
        }

        $('btn-stats').addEventListener('click', showStatsDialog);
        $('btn-help').addEventListener('click', function () { openDialog('dialog-help'); });
        $('btn-sound').addEventListener('click', function () {
            applySound(!settings.sound);
            Sfx.unlock();
            Sfx.click();
        });
        $('btn-colorblind').addEventListener('click', function () {
            applyColorblind(!settings.colorblind);
        });

        // Game
        $('game-back').addEventListener('click', leaveGame);
        $('game-help').addEventListener('click', function () { openDialog('dialog-help'); });
        $('game-sound').addEventListener('click', function () { applySound(!settings.sound); });
        $('btn-submit').addEventListener('click', submitGuess);
        $('btn-clear').addEventListener('click', function () {
            if (editor) { editor.clearAll(); Sfx.lift(); }
        });
        bindPalette($('palette'), function () { return editor; });

        // Codemaker
        bindPalette($('setcode-palette'), function () { return setcodeEditor; });
        $('setcode-clear').addEventListener('click', function () {
            if (setcodeEditor) { setcodeEditor.clearAll(); Sfx.lift(); }
        });
        $('setcode-random').addEventListener('click', function () {
            if (!setcodeEditor) { return; }
            var code = M.makeCode(M.getPreset(state.difficulty));
            setcodeEditor.clearAll();
            for (var i = 0; i < code.length; i++) {
                setcodeEditor.place(code[i], i);
            }
        });
        $('setcode-confirm').addEventListener('click', confirmSetCode);
        $('setcode-quit').addEventListener('click', function () {
            askConfirm('Abandon the match?', 'Scores so far will be discarded.', goMenu);
        });

        // Dialogs
        $('result-share').addEventListener('click', copyShare);
        $('result-menu').addEventListener('click', goMenu);
        $('result-again').addEventListener('click', function () {
            closeDialog();
            if (state.mode === 'versus') {
                if (state.versus) { nextVersusStep(); } else { startVersus(); }
            } else {
                startSolo();
            }
        });
        $('stats-close').addEventListener('click', closeDialog);
        $('help-close').addEventListener('click', closeDialog);
        $('confirm-no').addEventListener('click', closeDialog);
        $('confirm-yes').addEventListener('click', function () {
            var action = confirmAction;
            confirmAction = null;
            closeDialog();
            if (action) { action(); }
        });
        $('overlay').addEventListener('click', function (event) {
            // Click outside the dialog closes anything that isn't a result.
            if (event.target === $('overlay') && openDialogId !== 'dialog-result') {
                closeDialog();
            }
        });

        document.addEventListener('keydown', onKeyDown);
    }

    function onKeyDown(event) {
        if (event.metaKey || event.ctrlKey || event.altKey) { return; }

        if (openDialogId) {
            if (event.key === 'Escape' && openDialogId !== 'dialog-result') {
                closeDialog();
            }
            return;
        }

        var active = document.querySelector('.screen.is-active');
        if (!active) { return; }

        var target = null;
        var container = null;
        if (active.id === 'screen-game' && editor) {
            target = editor;
            container = $('palette');
        } else if (active.id === 'screen-setcode' && setcodeEditor) {
            target = setcodeEditor;
            container = $('setcode-palette');
        }

        if (event.key === 'Escape') {
            if (active.id === 'screen-game') { leaveGame(); }
            return;
        }

        if (!target) { return; }

        if (event.key === 'Enter') {
            if (active.id === 'screen-game') {
                event.preventDefault();
                submitGuess();
            } else if (target.isComplete()) {
                event.preventDefault();
                confirmSetCode();
            }
            return;
        }

        if (event.key === 'Backspace' || event.key === 'Delete') {
            event.preventDefault();
            target.removeLast();
            return;
        }

        if (/^[1-8]$/.test(event.key)) {
            var colorId = Number(event.key) - 1;
            if (colorId < M.getPreset(state.difficulty).colors) {
                event.preventDefault();
                Sfx.unlock();
                setArmed(colorId, container);
                if (target.nextEmpty() !== null) {
                    target.place(colorId, null);
                } else {
                    Sfx.deny();
                }
            }
        }
    }

    /* -------------------------------------------------------------- init -- */

    function init() {
        applySound(settings.sound);
        applyColorblind(settings.colorblind);
        renderDifficultyPicker();
        updateDifficultyHint();
        updateDailyBadge();
        bindEvents();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
