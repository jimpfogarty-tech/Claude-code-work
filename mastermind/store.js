/*
 * Persistence for Mastermind: settings, per-difficulty stats, and the
 * in-progress daily puzzle.
 *
 * Everything lives under one localStorage key. Reads are defensive -- a private
 * window, a cleared profile, or a half-written value must never stop the game
 * from starting, so every failure falls back to defaults.
 */
(function (global) {
    'use strict';

    var KEY = 'fogarty.mastermind.v1';
    var M = global.Mastermind;

    function defaults() {
        return {
            settings: {
                difficulty: M.DEFAULT_DIFFICULTY,
                sound: true,
                colorblind: false
            },
            stats: {},   // keyed by difficulty
            daily: null  // { date, difficulty, rows, finished, won }
            // plus dailyStreak / dailyMaxStreak / dailyLastDate at the top level
        };
    }

    function emptyStats() {
        return {
            played: 0,
            wins: 0,
            streak: 0,
            maxStreak: 0,
            totalWinGuesses: 0,
            distribution: {}  // guessesUsed -> count, wins only
        };
    }

    var cache = null;

    function read() {
        if (cache) { return cache; }
        var base = defaults();
        try {
            var raw = global.localStorage && global.localStorage.getItem(KEY);
            if (raw) {
                var parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    if (parsed.settings) {
                        base.settings.difficulty = M.PRESETS[parsed.settings.difficulty]
                            ? parsed.settings.difficulty
                            : base.settings.difficulty;
                        base.settings.sound = parsed.settings.sound !== false;
                        base.settings.colorblind = parsed.settings.colorblind === true;
                    }
                    if (parsed.stats && typeof parsed.stats === 'object') {
                        base.stats = parsed.stats;
                    }
                    if (parsed.daily && typeof parsed.daily === 'object') {
                        base.daily = parsed.daily;
                    }
                    base.dailyStreak = parsed.dailyStreak || 0;
                    base.dailyMaxStreak = parsed.dailyMaxStreak || 0;
                    base.dailyLastDate = parsed.dailyLastDate || null;
                }
            }
        } catch (e) {
            // Corrupt or unavailable storage -- defaults are fine.
        }
        cache = base;
        return cache;
    }

    function write() {
        try {
            if (global.localStorage) {
                global.localStorage.setItem(KEY, JSON.stringify(read()));
            }
        } catch (e) {
            // Quota or private mode. The session still plays, it just won't persist.
        }
    }

    /* ------------------------------------------------------------- settings */

    function getSettings() {
        return read().settings;
    }

    function setSetting(name, value) {
        read().settings[name] = value;
        write();
    }

    /* ---------------------------------------------------------------- stats */

    function getStats(difficulty) {
        var all = read().stats;
        if (!all[difficulty]) {
            all[difficulty] = emptyStats();
        }
        var s = all[difficulty];
        // Backfill anything a previous version didn't write.
        var blank = emptyStats();
        for (var k in blank) {
            if (s[k] === undefined) { s[k] = blank[k]; }
        }
        return s;
    }

    /** Record one finished solo/daily game. */
    function recordGame(difficulty, won, guessesUsed) {
        var s = getStats(difficulty);
        s.played += 1;
        if (won) {
            s.wins += 1;
            s.streak += 1;
            s.maxStreak = Math.max(s.maxStreak, s.streak);
            s.totalWinGuesses += guessesUsed;
            s.distribution[guessesUsed] = (s.distribution[guessesUsed] || 0) + 1;
        } else {
            s.streak = 0;
        }
        write();
        return s;
    }

    function averageWinGuesses(stats) {
        return stats.wins ? stats.totalWinGuesses / stats.wins : 0;
    }

    /* ---------------------------------------------------------------- daily */

    function getDaily() {
        return read().daily;
    }

    /** Save the daily board so a reload resumes rather than restarts. */
    function saveDaily(state) {
        read().daily = state;
        write();
    }

    function getDailyStreak() {
        var d = read();
        return {
            streak: d.dailyStreak || 0,
            maxStreak: d.dailyMaxStreak || 0,
            lastDate: d.dailyLastDate || null
        };
    }

    /**
     * Advance the daily streak for `dateKey`. Consecutive UTC days extend it,
     * a gap resets it to 1, and a loss breaks it outright. Calling twice for the
     * same date is a no-op, so a re-render can't inflate the count.
     */
    function recordDaily(dateKey, won) {
        var d = read();
        if (d.dailyLastDate === dateKey) {
            return getDailyStreak();
        }
        if (!won) {
            d.dailyStreak = 0;
        } else if (d.dailyLastDate === M.previousDayKey(dateKey)) {
            d.dailyStreak = (d.dailyStreak || 0) + 1;
        } else {
            d.dailyStreak = 1;
        }
        d.dailyMaxStreak = Math.max(d.dailyMaxStreak || 0, d.dailyStreak);
        d.dailyLastDate = dateKey;
        write();
        return getDailyStreak();
    }

    /* --------------------------------------------------------------- export */

    global.MastermindStore = {
        getSettings: getSettings,
        setSetting: setSetting,
        getStats: getStats,
        recordGame: recordGame,
        averageWinGuesses: averageWinGuesses,
        getDaily: getDaily,
        saveDaily: saveDaily,
        getDailyStreak: getDailyStreak,
        recordDaily: recordDaily
    };
})(typeof window !== 'undefined' ? window : this);
