/*
 * Mastermind rules engine.
 *
 * Pure functions only -- no DOM, no storage, no side effects. Everything that
 * decides what is legal or what a guess scores lives here so it can be tested
 * in isolation (see tests.html).
 */
(function (global) {
    'use strict';

    /* ---------------------------------------------------------------- colors */

    // Eight pegs, separated by hue AND lightness so they stay distinguishable in
    // greyscale. Each carries a glyph for the colorblind-assist mode.
    var COLORS = [
        { id: 0, name: 'Red',    hex: '#e8402a', glyph: '●' }, // ●
        { id: 1, name: 'Amber',  hex: '#f5a623', glyph: '▲' }, // ▲
        { id: 2, name: 'Yellow', hex: '#f5e04a', glyph: '■' }, // ■
        { id: 3, name: 'Green',  hex: '#3fbf5f', glyph: '◆' }, // ◆
        { id: 4, name: 'Cyan',   hex: '#33c8d9', glyph: '★' }, // ★
        { id: 5, name: 'Blue',   hex: '#3d6ff0', glyph: '✚' }, // ✚
        { id: 6, name: 'Purple', hex: '#9a5cf0', glyph: '⬟' }, // ⬟
        { id: 7, name: 'Pink',   hex: '#f562b0', glyph: '✖' }  // ✖
    ];

    /* ----------------------------------------------------------- difficulties */

    // Repeated colors are always allowed -- that is the classic rule.
    var PRESETS = {
        easy:    { key: 'easy',    label: 'Easy',    slots: 4, colors: 6, guesses: 12 },
        classic: { key: 'classic', label: 'Classic', slots: 4, colors: 6, guesses: 10 },
        hard:    { key: 'hard',    label: 'Hard',    slots: 5, colors: 8, guesses: 10 },
        expert:  { key: 'expert',  label: 'Expert',  slots: 5, colors: 8, guesses: 8  }
    };

    var PRESET_ORDER = ['easy', 'classic', 'hard', 'expert'];
    var DEFAULT_DIFFICULTY = 'classic';

    function getPreset(key) {
        return PRESETS[key] || PRESETS[DEFAULT_DIFFICULTY];
    }

    /* -------------------------------------------------------------- scoring */

    /**
     * Score a guess against the secret code.
     *
     *   exact -- right color in the right slot   (black key peg)
     *   color -- right color in the wrong slot   (white key peg)
     *
     * The duplicate-safe way: count exact matches first, then take the multiset
     * intersection of the two rows and subtract the exacts. Counting whites by
     * "is this color present somewhere" is the classic bug -- it over-counts
     * whenever a color repeats.
     */
    function score(guess, code) {
        var exact = 0;
        var i;
        var guessCounts = {};
        var codeCounts = {};

        for (i = 0; i < code.length; i++) {
            if (guess[i] === code[i]) {
                exact++;
            }
            guessCounts[guess[i]] = (guessCounts[guess[i]] || 0) + 1;
            codeCounts[code[i]] = (codeCounts[code[i]] || 0) + 1;
        }

        var total = 0;
        for (var c in guessCounts) {
            if (Object.prototype.hasOwnProperty.call(guessCounts, c) &&
                Object.prototype.hasOwnProperty.call(codeCounts, c)) {
                total += Math.min(guessCounts[c], codeCounts[c]);
            }
        }

        return { exact: exact, color: total - exact };
    }

    /** True when every slot in the row has a peg in it. */
    function isComplete(row, slots) {
        if (!row || row.length !== slots) { return false; }
        for (var i = 0; i < slots; i++) {
            if (row[i] === null || row[i] === undefined) { return false; }
        }
        return true;
    }

    function isSolved(result, slots) {
        return result.exact === slots;
    }

    /* ---------------------------------------------------------------- share */

    // Wordle's vocabulary, because players already hold it.
    var SHARE_EXACT = '🟩'; // green square  - right colour, right slot
    var SHARE_COLOR = '🟨'; // yellow square - right colour, wrong slot
    var SHARE_NONE = '⬛'; // black square  - no match

    /**
     * One row of the share grid, always exactly `slots` symbols long.
     *
     * Greens first, then yellows, then blanks -- the same canonical order the
     * board renders key pegs in. That ordering is what makes the grid read as
     * progress: green accumulates from the left as a guess closes in, and the
     * solved row is a solid green bar.
     */
    function shareRow(result, slots) {
        var row = '';
        for (var i = 0; i < slots; i++) {
            if (i < result.exact) {
                row += SHARE_EXACT;
            } else if (i < result.exact + result.color) {
                row += SHARE_COLOR;
            } else {
                row += SHARE_NONE;
            }
        }
        return row;
    }

    /* ------------------------------------------------------------------ rng */

    /** mulberry32 -- small, fast, deterministic. Returns a () => [0,1) function. */
    function mulberry32(seed) {
        var a = seed >>> 0;
        return function () {
            a = (a + 0x6D2B79F5) >>> 0;
            var t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    /** FNV-1a over a string, for turning a date key into a seed. */
    function hashString(str) {
        var h = 2166136261 >>> 0;
        for (var i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 16777619) >>> 0;
        }
        return h >>> 0;
    }

    /** Cryptographically random floats when available, Math.random otherwise. */
    function systemRandom() {
        var crypto = global.crypto || global.msCrypto;
        if (crypto && crypto.getRandomValues) {
            return function () {
                var buf = new Uint32Array(1);
                crypto.getRandomValues(buf);
                return buf[0] / 4294967296;
            };
        }
        return Math.random;
    }

    /* ------------------------------------------------------------- the code */

    /** Build a secret code of preset.slots pegs drawn from preset.colors. */
    function makeCode(preset, rng) {
        var random = rng || systemRandom();
        var code = [];
        for (var i = 0; i < preset.slots; i++) {
            code.push(Math.floor(random() * preset.colors) % preset.colors);
        }
        return code;
    }

    /* ---------------------------------------------------------------- daily */

    /** YYYY-MM-DD in UTC, so the puzzle rolls over at the same instant for everyone. */
    function todayKey(date) {
        var d = date || new Date();
        return d.getUTCFullYear() + '-' +
            pad2(d.getUTCMonth() + 1) + '-' +
            pad2(d.getUTCDate());
    }

    function pad2(n) { return n < 10 ? '0' + n : String(n); }

    /** Days since 2024-01-01 UTC -- the human-facing "Daily #N". */
    function dailyNumber(dateKey) {
        var parts = dateKey.split('-');
        var t = Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        var epoch = Date.UTC(2024, 0, 1);
        return Math.floor((t - epoch) / 86400000) + 1;
    }

    /** The same date + difficulty always yields the same code, anywhere. */
    function dailyCode(dateKey, difficulty) {
        var preset = getPreset(difficulty);
        return makeCode(preset, mulberry32(hashString(dateKey + ':' + difficulty)));
    }

    /** Yesterday's key, used to decide whether a daily streak survives. */
    function previousDayKey(dateKey) {
        var parts = dateKey.split('-');
        var t = Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return todayKey(new Date(t - 86400000));
    }

    /* --------------------------------------------------------------- export */

    global.Mastermind = {
        COLORS: COLORS,
        PRESETS: PRESETS,
        PRESET_ORDER: PRESET_ORDER,
        DEFAULT_DIFFICULTY: DEFAULT_DIFFICULTY,
        getPreset: getPreset,
        score: score,
        isComplete: isComplete,
        isSolved: isSolved,
        shareRow: shareRow,
        SHARE_EXACT: SHARE_EXACT,
        SHARE_COLOR: SHARE_COLOR,
        SHARE_NONE: SHARE_NONE,
        mulberry32: mulberry32,
        hashString: hashString,
        systemRandom: systemRandom,
        makeCode: makeCode,
        todayKey: todayKey,
        dailyNumber: dailyNumber,
        dailyCode: dailyCode,
        previousDayKey: previousDayKey
    };
})(typeof window !== 'undefined' ? window : this);
