// ============================================================
// SECTION: SPRITE DATA
// ============================================================

const SPRITES = {

  // SQUID - top row alien, 8x8, 2 frames
  SQUID: {
    width: 8,
    height: 8,
    frames: [
      // Frame 0: tentacles spread
      [
        0,0,0,1,1,0,0,0,
        0,0,1,1,1,1,0,0,
        0,1,1,1,1,1,1,0,
        1,1,0,1,1,0,1,1,
        1,1,1,1,1,1,1,1,
        0,0,1,0,0,1,0,0,
        0,1,0,1,1,0,1,0,
        1,0,1,0,0,1,0,1,
      ],
      // Frame 1: tentacles inward
      [
        0,0,0,1,1,0,0,0,
        0,0,1,1,1,1,0,0,
        0,1,1,1,1,1,1,0,
        1,1,0,1,1,0,1,1,
        1,1,1,1,1,1,1,1,
        0,1,0,1,1,0,1,0,
        1,0,0,0,0,0,0,1,
        0,1,0,0,0,0,1,0,
      ],
    ],
  },

  // CRAB - middle row alien, 11x8, 2 frames
  CRAB: {
    width: 11,
    height: 8,
    frames: [
      // Frame 0: claws up
      [
        0,0,1,0,0,0,0,0,1,0,0,
        0,0,0,1,0,0,0,1,0,0,0,
        0,0,1,1,1,1,1,1,1,0,0,
        0,1,1,0,1,1,1,0,1,1,0,
        1,1,1,1,1,1,1,1,1,1,1,
        1,0,1,1,1,1,1,1,1,0,1,
        1,0,1,0,0,0,0,0,1,0,1,
        0,0,0,1,1,0,1,1,0,0,0,
      ],
      // Frame 1: claws down
      [
        0,0,1,0,0,0,0,0,1,0,0,
        1,0,0,1,0,0,0,1,0,0,1,
        1,0,1,1,1,1,1,1,1,0,1,
        1,1,1,0,1,1,1,0,1,1,1,
        1,1,1,1,1,1,1,1,1,1,1,
        0,1,1,1,1,1,1,1,1,1,0,
        0,0,1,0,0,0,0,0,1,0,0,
        0,1,0,0,0,0,0,0,0,1,0,
      ],
    ],
  },

  // OCTOPUS - bottom row alien, 12x8, 2 frames
  OCTOPUS: {
    width: 12,
    height: 8,
    frames: [
      // Frame 0: legs spread
      [
        0,0,0,0,1,1,1,1,0,0,0,0,
        0,1,1,1,1,1,1,1,1,1,1,0,
        1,1,1,1,1,1,1,1,1,1,1,1,
        1,1,1,0,0,1,1,0,0,1,1,1,
        1,1,1,1,1,1,1,1,1,1,1,1,
        0,0,0,1,1,0,0,1,1,0,0,0,
        0,0,1,1,0,1,1,0,1,1,0,0,
        1,1,0,0,0,0,0,0,0,0,1,1,
      ],
      // Frame 1: legs together
      [
        0,0,0,0,1,1,1,1,0,0,0,0,
        0,1,1,1,1,1,1,1,1,1,1,0,
        1,1,1,1,1,1,1,1,1,1,1,1,
        1,1,1,0,0,1,1,0,0,1,1,1,
        1,1,1,1,1,1,1,1,1,1,1,1,
        0,0,1,1,1,0,0,1,1,1,0,0,
        0,1,1,0,0,1,1,0,0,1,1,0,
        0,0,1,1,0,0,0,0,1,1,0,0,
      ],
    ],
  },

  // PLAYER ship - 13x8, 1 frame
  PLAYER: {
    width: 13,
    height: 8,
    frames: [
      [
        0,0,0,0,0,0,1,0,0,0,0,0,0,
        0,0,0,0,0,1,1,1,0,0,0,0,0,
        0,0,0,0,0,1,1,1,0,0,0,0,0,
        0,1,1,1,1,1,1,1,1,1,1,1,0,
        1,1,1,1,1,1,1,1,1,1,1,1,1,
        1,1,1,1,1,1,1,1,1,1,1,1,1,
        1,1,1,1,1,1,1,1,1,1,1,1,1,
        1,1,1,1,1,1,1,1,1,1,1,1,1,
      ],
    ],
  },

  // UFO mystery ship - 16x7, 1 frame
  UFO: {
    width: 16,
    height: 7,
    frames: [
      [
        0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,
        0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,
        0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
        0,1,0,1,0,1,0,1,1,0,1,0,1,0,1,0,
        1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
        0,0,1,1,1,0,0,1,1,0,0,1,1,1,0,0,
        0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,
      ],
    ],
  },

  // ALIEN_EXPLOSION - 13x8, 1 frame (the "poof" when alien is hit)
  ALIEN_EXPLOSION: {
    width: 13,
    height: 8,
    frames: [
      [
        0,0,0,0,1,0,0,0,1,0,0,0,0,
        1,0,0,0,0,1,0,1,0,0,0,0,1,
        0,1,0,0,0,0,1,0,0,0,0,1,0,
        0,0,1,0,0,0,0,0,0,0,1,0,0,
        1,1,0,0,0,0,0,0,0,0,0,1,1,
        0,0,1,0,0,0,0,0,0,0,1,0,0,
        0,1,0,0,1,0,0,0,1,0,0,1,0,
        1,0,0,1,0,0,0,0,0,1,0,0,1,
      ],
    ],
  },

  // PLAYER_EXPLOSION - 16x8, 2 frames (alternating explosion animation)
  PLAYER_EXPLOSION: {
    width: 16,
    height: 8,
    frames: [
      // Frame 0
      [
        0,0,0,0,1,0,0,1,0,0,0,1,0,0,0,0,
        0,0,1,0,0,1,0,0,0,1,0,0,0,1,0,0,
        0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,
        0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,
        0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
        1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
        1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
        0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
      ],
      // Frame 1
      [
        0,1,0,0,0,0,1,0,0,1,0,0,0,0,1,0,
        0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,
        1,0,0,0,0,1,0,0,1,0,1,0,0,0,0,1,
        0,0,0,1,1,1,1,0,1,1,1,1,0,0,0,0,
        0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
        1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
        1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
        0,1,0,1,1,1,1,1,1,1,1,1,1,0,1,0,
      ],
    ],
  },

  // SHIELD template - 22x16 (arch/bunker with bite from bottom corners)
  SHIELD: {
    width: 22,
    height: 16,
    frames: [
      [
        0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,
        0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,
        0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
        0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
        1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
        1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
        1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
        1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
        1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
        1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
        1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
        1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
        1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,
        1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,
        1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,
        1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,
      ],
    ],
  },

  // BULLET - player bullet, 1x4
  BULLET: {
    width: 1,
    height: 4,
    frames: [
      [1, 1, 1, 1],
    ],
  },

  // ALIEN_BULLET variants - squiggly and plunger types, 3x7
  ALIEN_BULLET_SQUIGGLY: {
    width: 3,
    height: 7,
    frames: [
      [
        0,1,0,
        1,0,0,
        0,1,0,
        0,0,1,
        0,1,0,
        1,0,0,
        0,1,0,
      ],
      [
        0,1,0,
        0,0,1,
        0,1,0,
        1,0,0,
        0,1,0,
        0,0,1,
        0,1,0,
      ],
    ],
  },

  ALIEN_BULLET_PLUNGER: {
    width: 3,
    height: 7,
    frames: [
      [
        0,1,0,
        0,1,0,
        0,1,0,
        0,1,0,
        0,1,0,
        0,1,0,
        1,1,1,
      ],
      [
        0,1,0,
        1,1,0,
        0,1,0,
        0,1,1,
        0,1,0,
        1,1,0,
        0,1,0,
      ],
    ],
  },
};

/**
 * Draws a sprite onto a canvas context.
 * @param {CanvasRenderingContext2D} ctx - The canvas 2D context.
 * @param {object} sprite - A sprite object from SPRITES (has width, height, frames).
 * @param {number} frameIndex - Which animation frame to draw (0-based).
 * @param {number} x - Top-left X position in canvas pixels.
 * @param {number} y - Top-left Y position in canvas pixels.
 * @param {number} scale - Size of each pixel block (e.g., 3 means each sprite pixel is 3x3 canvas pixels).
 * @param {string} color - CSS color string for filled pixels.
 */
function drawSprite(ctx, sprite, frameIndex, x, y, scale, color) {
  const frame = sprite.frames[frameIndex % sprite.frames.length];
  ctx.fillStyle = color;
  for (let row = 0; row < sprite.height; row++) {
    for (let col = 0; col < sprite.width; col++) {
      if (frame[row * sprite.width + col]) {
        ctx.fillRect(
          x + col * scale,
          y + row * scale,
          scale,
          scale
        );
      }
    }
  }
}


// ============================================================
// SECTION: AUDIO ENGINE
// ============================================================

const AudioEngine = {
  ctx: null,
  masterGain: null,
  masterVolume: 0.3,
  muted: false,
  ufoOscillators: null,

  /**
   * Lazily initialise the AudioContext. Call on first user interaction.
   */
  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.masterVolume;
    this.masterGain.connect(this.ctx.destination);

    // Resume if suspended (browser autoplay policy)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  /**
   * Ensure context is ready before playing a sound.
   */
  _ensureCtx() {
    if (!this.ctx) this.init();
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  /**
   * Player shoot sound: short descending frequency sweep ~1000Hz -> 200Hz over 100ms.
   */
  playShoot() {
    this._ensureCtx();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(1000, now);
    osc.frequency.linearRampToValueAtTime(200, now + 0.1);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.1);
  },

  /**
   * Alien/general explosion: white noise burst with quick decay (~200ms).
   */
  playExplosion() {
    this._ensureCtx();
    const now = this.ctx.currentTime;
    const duration = 0.2;

    // Create white noise buffer
    const bufferSize = Math.ceil(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.connect(gain);
    gain.connect(this.masterGain);

    source.start(now);
    source.stop(now + duration);
  },

  /**
   * The classic 4-note bass step sequence. noteIndex 0-3 cycles through
   * descending tones approximating the original arcade (~55, 49, 43, 37 Hz).
   * Each note ~60ms, square wave.
   */
  playAlienStep(noteIndex) {
    this._ensureCtx();
    const frequencies = [55, 49, 43, 37];
    const freq = frequencies[noteIndex % 4];
    const now = this.ctx.currentTime;
    const duration = 0.06;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.setValueAtTime(0, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration + 0.01);
  },

  /**
   * Start a continuous oscillating warble for the UFO (mystery ship).
   * Uses two detuned oscillators in the 400-500Hz range with an LFO
   * modulating frequency. Returns reference; call stopUFOSound() to end.
   */
  playUFOSound() {
    this._ensureCtx();
    if (this.ufoOscillators) {
      this.stopUFOSound();
    }

    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const outputGain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(440, now);

    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(447, now);

    // LFO modulates both oscillator frequencies
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(6, now);
    lfoGain.gain.setValueAtTime(30, now);

    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);
    lfoGain.connect(osc2.frequency);

    outputGain.gain.setValueAtTime(0.25, now);

    osc1.connect(outputGain);
    osc2.connect(outputGain);
    outputGain.connect(this.masterGain);

    osc1.start(now);
    osc2.start(now);
    lfo.start(now);

    this.ufoOscillators = { osc1, osc2, lfo, outputGain };
    return this.ufoOscillators;
  },

  /**
   * Stop the UFO warble sound.
   */
  stopUFOSound() {
    if (this.ufoOscillators) {
      const now = this.ctx.currentTime;
      const { osc1, osc2, lfo, outputGain } = this.ufoOscillators;
      outputGain.gain.setValueAtTime(outputGain.gain.value, now);
      outputGain.gain.linearRampToValueAtTime(0, now + 0.05);
      osc1.stop(now + 0.06);
      osc2.stop(now + 0.06);
      lfo.stop(now + 0.06);
      this.ufoOscillators = null;
    }
  },

  /**
   * Player death: longer noise burst (~500ms) with pitch sweep down.
   */
  playDeath() {
    this._ensureCtx();
    const now = this.ctx.currentTime;
    const duration = 0.5;

    // Noise component
    const bufferSize = Math.ceil(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.3, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noiseSource.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    // Tonal sweep component (pitch sweep down)
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + duration);

    oscGain.gain.setValueAtTime(0.3, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    noiseSource.start(now);
    noiseSource.stop(now + duration);
    osc.start(now);
    osc.stop(now + duration);
  },

  /**
   * Level complete: ascending tone sweep to celebrate.
   */
  playLevelUp() {
    this._ensureCtx();
    const now = this.ctx.currentTime;
    const duration = 0.6;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(600, now + 0.15);
    osc.frequency.linearRampToValueAtTime(500, now + 0.2);
    osc.frequency.linearRampToValueAtTime(900, now + 0.4);
    osc.frequency.linearRampToValueAtTime(1200, now + duration);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.setValueAtTime(0.3, now + duration - 0.1);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration);
  },

  /**
   * Mute or unmute all audio via the master gain node.
   * @param {boolean} muted - True to mute, false to unmute.
   */
  setMuted(muted) {
    this.muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : this.masterVolume;
    }
  },

  /**
   * Toggle mute state and return new muted state.
   * @returns {boolean} The new muted state.
   */
  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  },
};
