/*
 * Sound and haptics. Every tone is synthesized with WebAudio -- no asset files,
 * nothing to download.
 *
 * The AudioContext is created lazily on the first user gesture because browsers
 * refuse to start one before then, and every call no-ops while muted.
 */
(function (global) {
    'use strict';

    var ctx = null;
    var enabled = true;

    function setEnabled(on) {
        enabled = !!on;
    }

    function ensureContext() {
        if (!enabled) { return null; }
        var Ctor = global.AudioContext || global.webkitAudioContext;
        if (!Ctor) { return null; }
        if (!ctx) {
            try {
                ctx = new Ctor();
            } catch (e) {
                return null;
            }
        }
        if (ctx.state === 'suspended' && ctx.resume) {
            ctx.resume();
        }
        return ctx;
    }

    /**
     * One shaped tone.
     * freq -> start frequency, endFreq -> optional glide target.
     */
    function tone(opts) {
        var ac = ensureContext();
        if (!ac) { return; }

        var now = ac.currentTime + (opts.delay || 0);
        var duration = opts.duration || 0.1;
        var osc = ac.createOscillator();
        var gain = ac.createGain();

        osc.type = opts.type || 'sine';
        osc.frequency.setValueAtTime(opts.freq, now);
        if (opts.endFreq) {
            osc.frequency.exponentialRampToValueAtTime(opts.endFreq, now + duration);
        }

        var peak = opts.gain === undefined ? 0.18 : opts.gain;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(peak, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(now);
        osc.stop(now + duration + 0.02);
    }

    /** Short filtered noise burst -- the "thunk" of a peg seating in its well. */
    function noise(opts) {
        var ac = ensureContext();
        if (!ac) { return; }

        var now = ac.currentTime + (opts.delay || 0);
        var duration = opts.duration || 0.06;
        var frames = Math.max(1, Math.floor(ac.sampleRate * duration));
        var buffer = ac.createBuffer(1, frames, ac.sampleRate);
        var data = buffer.getChannelData(0);
        for (var i = 0; i < frames; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
        }

        var src = ac.createBufferSource();
        src.buffer = buffer;

        var filter = ac.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = opts.freq || 900;
        filter.Q.value = 1.2;

        var gain = ac.createGain();
        gain.gain.value = opts.gain === undefined ? 0.15 : opts.gain;

        src.connect(filter);
        filter.connect(gain);
        gain.connect(ac.destination);
        src.start(now);
    }

    function vibrate(pattern) {
        if (global.navigator && global.navigator.vibrate) {
            try { global.navigator.vibrate(pattern); } catch (e) { /* ignore */ }
        }
    }

    /* ---------------------------------------------------------- the palette */

    var Sfx = {
        setEnabled: setEnabled,
        unlock: ensureContext,

        /** Peg dropped into a slot. */
        place: function () {
            noise({ freq: 1100, duration: 0.05, gain: 0.12 });
            tone({ freq: 420, endFreq: 300, duration: 0.07, type: 'triangle', gain: 0.1 });
            vibrate(8);
        },

        /** Peg lifted back out. */
        lift: function () {
            tone({ freq: 300, endFreq: 460, duration: 0.06, type: 'triangle', gain: 0.08 });
        },

        /** Row committed. */
        submit: function () {
            noise({ freq: 480, duration: 0.09, gain: 0.18 });
            tone({ freq: 180, endFreq: 120, duration: 0.14, type: 'sine', gain: 0.14 });
            vibrate(14);
        },

        /** One key peg landing. Called per peg with an increasing index. */
        key: function (index, isExact) {
            tone({
                freq: isExact ? 880 : 620,
                duration: 0.05,
                type: 'square',
                gain: 0.05,
                delay: 0.06 * index
            });
        },

        win: function () {
            var notes = [523.25, 659.25, 783.99, 1046.5];
            for (var i = 0; i < notes.length; i++) {
                tone({ freq: notes[i], duration: 0.26, type: 'triangle', gain: 0.16, delay: i * 0.1 });
            }
            vibrate([18, 60, 18, 60, 40]);
        },

        lose: function () {
            tone({ freq: 320, endFreq: 150, duration: 0.5, type: 'sawtooth', gain: 0.1 });
            tone({ freq: 240, endFreq: 110, duration: 0.6, type: 'sine', gain: 0.09, delay: 0.06 });
            vibrate([60, 40, 120]);
        },

        /** Generic UI affordance. */
        click: function () {
            tone({ freq: 660, duration: 0.04, type: 'square', gain: 0.06 });
        },

        /** Rejected action -- e.g. submitting an incomplete row. */
        deny: function () {
            tone({ freq: 220, endFreq: 180, duration: 0.12, type: 'square', gain: 0.08 });
            vibrate([30, 30, 30]);
        }
    };

    global.MastermindSfx = Sfx;
})(typeof window !== 'undefined' ? window : this);
