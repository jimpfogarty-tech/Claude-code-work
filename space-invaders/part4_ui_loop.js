// ============================================================================
//  SPACE INVADERS - PART 4: COLLISION DETECTION, UI, AND MAIN GAME LOOP
// ============================================================================

// ============================================================================
//  SECTION: COLLISION DETECTION
// ============================================================================

const CollisionSystem = {
    update(s) {
        const scale = CONFIG.PIXEL_SCALE || 1;

        // 1. Player bullet vs aliens
        if (s.player.bullet) {
            const b = s.player.bullet;
            const hitResult = AlienFormation.checkHit(s.aliens, b.x + 1.5, b.y);
            if (hitResult) {
                GameState.score += hitResult.points;
                s.player.bullet = null;

                // Emit explosion particles at the alien position
                const alien = hitResult.alien;
                const sprData = SPRITES[alien.type];
                const cx = alien.x + (sprData.width * scale) / 2;
                const cy = alien.y + (sprData.height * scale) / 2;
                let pColor = CONFIG.COLORS.explosion;
                switch (alien.type) {
                    case 'squid':   pColor = CONFIG.COLORS.squid; break;
                    case 'crab':    pColor = CONFIG.COLORS.crab; break;
                    case 'octopus': pColor = CONFIG.COLORS.octopus; break;
                }
                ParticleSystem.emit(s.particles, cx, cy, pColor, 12);

                // Check for extra life
                if (!GameState.extraLifeAwarded && GameState.score >= CONFIG.EXTRA_LIFE_SCORE) {
                    GameState.extraLifeAwarded = true;
                    GameState.lives++;
                }
            }
        }

        // 2. Player bullet vs UFO
        if (s.player.bullet && s.ufo.active) {
            const b = s.player.bullet;
            const ufoPoints = UFOSystem.checkHit(s.ufo, b.x + 1.5, b.y);
            if (ufoPoints !== null) {
                GameState.score += ufoPoints;
                s.player.bullet = null;

                // Emit red particles at UFO position
                const ufoW = SPRITES.ufo.width * scale;
                const cx = s.ufo.x + ufoW / 2;
                const cy = CONFIG.UFO_Y + (SPRITES.ufo.height * scale) / 2;
                ParticleSystem.emit(s.particles, cx, cy, CONFIG.COLORS.ufo, 20);

                // Check for extra life
                if (!GameState.extraLifeAwarded && GameState.score >= CONFIG.EXTRA_LIFE_SCORE) {
                    GameState.extraLifeAwarded = true;
                    GameState.lives++;
                }
            }
        }

        // 3. Player bullet vs shields
        if (s.player.bullet) {
            const b = s.player.bullet;
            if (ShieldSystem.checkCollision(s.shields, b.x, b.y, 3, 12, true)) {
                s.player.bullet = null;
            }
        }

        // 4. Alien bullets vs player
        if (s.player.alive) {
            const pw = CONFIG.PLAYER_WIDTH;
            const ph = CONFIG.PLAYER_HEIGHT;
            for (let i = s.alienBullets.length - 1; i >= 0; i--) {
                const b = s.alienBullets[i];
                // Bounding box collision: bullet is 3x12
                if (b.x + 3 > s.player.x && b.x < s.player.x + pw &&
                    b.y + 12 > s.player.y && b.y < s.player.y + ph) {
                    PlayerSystem.kill(s);
                    s.alienBullets.splice(i, 1);

                    // Emit green particles at player position
                    const cx = s.player.x + pw / 2;
                    const cy = s.player.y + ph / 2;
                    ParticleSystem.emit(s.particles, cx, cy, CONFIG.COLORS.player, 18);
                    break;
                }
            }
        }

        // 5. Alien bullets vs shields
        for (let i = s.alienBullets.length - 1; i >= 0; i--) {
            const b = s.alienBullets[i];
            if (ShieldSystem.checkCollision(s.shields, b.x, b.y, 3, 12, false)) {
                s.alienBullets.splice(i, 1);
            }
        }

        // 6. Aliens reach bottom => instant game over
        if (AlienFormation.hasReachedBottom(s.aliens)) {
            GameState.lives = 0;
            GameState.phase = 'gameOver';
            GameState.saveHighScore();
        }

        // 7. Update high score
        if (GameState.score > GameState.highScore) {
            GameState.highScore = GameState.score;
        }
    }
};

// ============================================================================
//  SECTION: HUD AND UI SCREENS
// ============================================================================

/**
 * Helper: draw text with convenience parameters.
 */
function drawText(ctx, text, x, y, size, color, align) {
    ctx.font = size + 'px "Press Start 2P", "Courier New", monospace';
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(text, x, y);
}

const UI = {
    // Demo aliens for the title screen
    _demoAliens: null,
    _demoAnimFrame: 0,
    _demoStepTimer: 0,
    _demoDirection: 1,

    _initDemoAliens() {
        this._demoAliens = [];
        const types = ['squid', 'crab', 'crab', 'octopus', 'octopus'];
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 8; col++) {
                this._demoAliens.push({
                    type: types[row],
                    x: 80 + col * 60,
                    y: 60 + row * 45,
                    baseX: 80 + col * 60
                });
            }
        }
        this._demoDirection = 1;
        this._demoStepTimer = 0;
        this._demoAnimFrame = 0;
    },

    drawHUD(ctx) {
        const W = CONFIG.CANVAS_WIDTH;
        const H = CONFIG.CANVAS_HEIGHT;

        // Save context state
        ctx.save();
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        // Score - top left
        drawText(ctx, 'SCORE', 20, 10, 12, '#AAAAAA', 'left');
        drawText(ctx, GameState.score.toString().padStart(5, '0'), 20, 28, 18, CONFIG.COLORS.hud, 'left');

        // High score - top center
        drawText(ctx, 'HI-SCORE', W / 2, 10, 12, '#AAAAAA', 'center');
        drawText(ctx, GameState.highScore.toString().padStart(5, '0'), W / 2, 28, 18, CONFIG.COLORS.hud, 'center');

        // Level - top right
        drawText(ctx, 'LEVEL', W - 20, 10, 12, '#AAAAAA', 'right');
        drawText(ctx, GameState.level.toString(), W - 20, 28, 18, CONFIG.COLORS.hud, 'right');

        // Green line near bottom
        ctx.strokeStyle = CONFIG.COLORS.player;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(CONFIG.PLAY_LEFT, H - 40);
        ctx.lineTo(CONFIG.PLAY_RIGHT, H - 40);
        ctx.stroke();

        // Lives - bottom left (draw small player ship icons)
        const scale = 2;
        const lifeIconW = SPRITES.player.width * scale;
        for (let i = 0; i < GameState.lives; i++) {
            drawSprite(ctx, SPRITES.player, 0, 20 + i * (lifeIconW + 6), H - 34, scale, CONFIG.COLORS.player);
        }

        // Credit text - bottom center
        drawText(ctx, 'SPACE INVADERS BY JPF ORBITAL STUDIOS', W / 2, H - 18, 8, CONFIG.COLORS.credit, 'center');

        // Theme name - bottom right
        drawText(ctx, BackgroundRenderer.currentTheme.toUpperCase(), W - 20, H - 34, 10, CONFIG.COLORS.subtitle, 'right');

        ctx.restore();
    },

    drawTitleScreen(ctx, timer) {
        const W = CONFIG.CANVAS_WIDTH;
        const H = CONFIG.CANVAS_HEIGHT;
        const scale = CONFIG.PIXEL_SCALE || 3;
        const t = timer / 1000; // convert ms to seconds for animation

        // Animated demo aliens at the top
        if (!this._demoAliens) {
            this._initDemoAliens();
        }

        // Update demo aliens
        this._demoStepTimer += 16; // approximate per-frame
        if (this._demoStepTimer >= 600) {
            this._demoStepTimer = 0;
            this._demoAnimFrame = this._demoAnimFrame === 0 ? 1 : 0;
            for (let i = 0; i < this._demoAliens.length; i++) {
                this._demoAliens[i].x += 6 * this._demoDirection;
            }
            // Check bounds
            let needFlip = false;
            for (let i = 0; i < this._demoAliens.length; i++) {
                const a = this._demoAliens[i];
                const sprW = SPRITES[a.type].width * scale;
                if (a.x + sprW >= W - 20 || a.x <= 20) {
                    needFlip = true;
                    break;
                }
            }
            if (needFlip) {
                this._demoDirection *= -1;
            }
        }

        // Draw demo aliens
        for (let i = 0; i < this._demoAliens.length; i++) {
            const a = this._demoAliens[i];
            let color;
            switch (a.type) {
                case 'squid':   color = CONFIG.COLORS.squid; break;
                case 'crab':    color = CONFIG.COLORS.crab; break;
                case 'octopus': color = CONFIG.COLORS.octopus; break;
                default:        color = '#FFFFFF';
            }
            drawSprite(ctx, SPRITES[a.type], this._demoAnimFrame, a.x, a.y, scale, color);
        }

        // Title: "SPACE INVADERS" with glowing/pulsing green effect
        const glowIntensity = 10 + 8 * Math.sin(t * 3);
        ctx.save();
        ctx.shadowBlur = glowIntensity;
        ctx.shadowColor = CONFIG.COLORS.title;
        drawText(ctx, 'SPACE', W / 2, 240, 42, CONFIG.COLORS.title, 'center');
        drawText(ctx, 'INVADERS', W / 2, 290, 42, CONFIG.COLORS.title, 'center');
        ctx.restore();

        // Subtitle
        drawText(ctx, 'by JPF Orbital Studios', W / 2, 345, 14, CONFIG.COLORS.subtitle, 'center');

        // Score table
        const tableY = 400;
        const tableX = W / 2 - 120;
        const iconScale = scale;

        // Squid
        drawSprite(ctx, SPRITES.squid, this._demoAnimFrame, tableX, tableY, iconScale, CONFIG.COLORS.squid);
        drawText(ctx, '= ' + CONFIG.SCORE_SQUID + ' POINTS', tableX + 40, tableY + 4, 12, '#FFFFFF', 'left');

        // Crab
        drawSprite(ctx, SPRITES.crab, this._demoAnimFrame, tableX - 4, tableY + 40, iconScale, CONFIG.COLORS.crab);
        drawText(ctx, '= ' + CONFIG.SCORE_CRAB + ' POINTS', tableX + 40, tableY + 44, 12, '#FFFFFF', 'left');

        // Octopus
        drawSprite(ctx, SPRITES.octopus, this._demoAnimFrame, tableX - 6, tableY + 80, iconScale, CONFIG.COLORS.octopus);
        drawText(ctx, '= ' + CONFIG.SCORE_OCTOPUS + ' POINTS', tableX + 40, tableY + 84, 12, '#FFFFFF', 'left');

        // UFO
        drawSprite(ctx, SPRITES.ufo, 0, tableX - 12, tableY + 120, iconScale, CONFIG.COLORS.ufo);
        drawText(ctx, '= ??? MYSTERY', tableX + 40, tableY + 124, 12, CONFIG.COLORS.ufoText, 'left');

        // Blinking "PRESS ENTER TO PLAY"
        const blinkOn = Math.floor(t * 2) % 2 === 0; // toggle every 500ms
        if (blinkOn) {
            ctx.save();
            ctx.shadowBlur = 6;
            ctx.shadowColor = '#00FF00';
            drawText(ctx, 'PRESS ENTER TO PLAY', W / 2, 580, 16, '#00FF00', 'center');
            ctx.restore();
        }

        // Controls
        drawText(ctx, 'ARROWS/WASD: MOVE  |  SPACE: FIRE  |  M: MUTE  |  T: THEME', W / 2, 640, 8, CONFIG.COLORS.subtitle, 'center');
        drawText(ctx, 'P: PAUSE', W / 2, 660, 8, CONFIG.COLORS.subtitle, 'center');

        // Credit
        drawText(ctx, 'SPACE INVADERS BY JPF ORBITAL STUDIOS', W / 2, H - 18, 8, CONFIG.COLORS.credit, 'center');
    },

    drawGameOverScreen(ctx) {
        const W = CONFIG.CANVAS_WIDTH;
        const H = CONFIG.CANVAS_HEIGHT;
        const t = performance.now() / 1000;

        // Semi-transparent dark overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(0, 0, W, H);

        // "GAME OVER" in red
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#FF0000';
        drawText(ctx, 'GAME OVER', W / 2, H / 2 - 100, 40, '#FF0000', 'center');
        ctx.restore();

        // Final score
        drawText(ctx, 'FINAL SCORE: ' + GameState.score.toString().padStart(5, '0'), W / 2, H / 2 - 30, 16, '#FFFFFF', 'center');

        // High score
        const isNewHigh = GameState.score >= GameState.highScore && GameState.score > 0;
        drawText(ctx, 'HIGH SCORE: ' + GameState.highScore.toString().padStart(5, '0'), W / 2, H / 2 + 10, 16, '#FFFFFF', 'center');

        if (isNewHigh) {
            ctx.save();
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#FFFF00';
            drawText(ctx, 'NEW HIGH SCORE!', W / 2, H / 2 + 45, 14, '#FFFF00', 'center');
            ctx.restore();
        }

        // Level reached
        drawText(ctx, 'LEVEL REACHED: ' + GameState.level, W / 2, H / 2 + 75, 12, CONFIG.COLORS.subtitle, 'center');

        // Blinking "PRESS ENTER TO CONTINUE"
        const blinkOn = Math.floor(t * 2) % 2 === 0;
        if (blinkOn) {
            drawText(ctx, 'PRESS ENTER TO CONTINUE', W / 2, H / 2 + 120, 14, '#FFFFFF', 'center');
        }
    },

    drawPauseScreen(ctx) {
        const W = CONFIG.CANVAS_WIDTH;
        const H = CONFIG.CANVAS_HEIGHT;

        // Semi-transparent overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, W, H);

        // "PAUSED" centered
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#FFFFFF';
        drawText(ctx, 'PAUSED', W / 2, H / 2 - 30, 36, '#FFFFFF', 'center');
        ctx.restore();

        drawText(ctx, 'PRESS P OR ESC TO RESUME', W / 2, H / 2 + 30, 12, CONFIG.COLORS.subtitle, 'center');
    }
};

// ============================================================================
//  SECTION: MAIN GAME LOOP
// ============================================================================

const Game = {
    canvas: null,
    ctx: null,
    lastTime: 0,
    titleAnimTimer: 0,

    init() {
        // Get canvas and context
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');

        // Load high score
        GameState.loadHighScore();

        // Initialize systems
        Input.init();
        BackgroundRenderer.init();

        // Set initial phase
        GameState.phase = 'title';

        // Reset demo aliens for title
        UI._demoAliens = null;

        // Start loop
        this.lastTime = performance.now();
        requestAnimationFrame(this.loop.bind(this));
    },

    loop(timestamp) {
        const dt = Math.min(timestamp - this.lastTime, 50); // cap delta to prevent spiral
        this.lastTime = timestamp;

        const ctx = this.ctx;

        // Clear canvas
        ctx.clearRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

        // Draw background
        BackgroundRenderer.update(dt / 1000);
        BackgroundRenderer.draw(ctx, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

        // Handle input actions common to all phases
        if (Input.justPressed('theme')) {
            const themes = CONFIG.THEMES;
            const idx = (themes.indexOf(BackgroundRenderer.currentTheme) + 1) % themes.length;
            BackgroundRenderer.setTheme(themes[idx]);
        }
        if (Input.justPressed('mute')) {
            AudioEngine.toggleMute();
        }

        // Phase-based update and render
        switch (GameState.phase) {
            case 'title':
                this.updateTitle(dt, ctx);
                break;
            case 'playing':
                this.updatePlaying(dt, ctx);
                break;
            case 'paused':
                this.drawPaused(ctx);
                break;
            case 'gameOver':
                this.updateGameOver(dt, ctx);
                break;
        }

        Input.update();
        requestAnimationFrame(this.loop.bind(this));
    },

    updateTitle(dt, ctx) {
        this.titleAnimTimer += dt;
        UI.drawTitleScreen(ctx, this.titleAnimTimer);

        if (Input.justPressed('enter')) {
            AudioEngine.init(); // Initialize audio context on user gesture
            this.startGame();
        }
    },

    startGame() {
        GameState.reset();

        // Initialize game state
        const playerWidth = SPRITES.player.width * (CONFIG.PIXEL_SCALE || 1);
        state.player = {
            x: CONFIG.CANVAS_WIDTH / 2 - playerWidth / 2,
            y: CONFIG.PLAYER_Y,
            alive: true,
            deathTimer: 0,
            respawnTimer: 0,
            bullet: null
        };
        state.aliens = AlienFormation.create(GameState.level);
        state.shields = ShieldSystem.create();
        state.alienDirection = 1;
        state.alienStepTimer = CONFIG.ALIEN_BASE_INTERVAL;
        state.alienStepInterval = CONFIG.ALIEN_BASE_INTERVAL;
        state.alienAnimFrame = 0;
        state.alienStepNote = 0;
        state.alienNeedDrop = false;
        state.alienBullets = [];
        state.alienShootTimer = CONFIG.ALIEN_SHOOT_INTERVAL;
        state.ufo = { active: false, x: 0, direction: 1, points: 0, scoreDisplay: null };
        state.ufoSpawnTimer = CONFIG.UFO_SPAWN_MIN + Math.random() * (CONFIG.UFO_SPAWN_MAX - CONFIG.UFO_SPAWN_MIN);
        state.particles = [];

        this.titleAnimTimer = 0;
        GameState.phase = 'playing';
    },

    updatePlaying(dt, ctx) {
        if (Input.justPressed('pause')) {
            GameState.phase = 'paused';
            return;
        }

        const dtSec = dt / 1000;

        // Update player (handles movement, firing, death/respawn timers internally)
        PlayerSystem.update(dtSec, state);

        // If player is dead and lives depleted, transition to game over after death anim
        if (!state.player.alive && state.player.deathTimer <= 0 && GameState.lives <= 0) {
            // Wait for death animation to finish, then trigger game over
            if (state.player.respawnTimer <= 0) {
                GameState.phase = 'gameOver';
                GameState.saveHighScore();
                // Still render the current frame below before returning
            }
        }

        // Update bullet
        PlayerSystem.updateBullet(dtSec, state);

        // Update alien formation
        AlienFormation.update(dt, state);
        AlienFormation.shoot(dt, state);

        // Update UFO (pass dtSec since UFOSystem.update uses dt as seconds based on part3)
        UFOSystem.update(dtSec, state);

        // Update alien bullets
        for (let i = state.alienBullets.length - 1; i >= 0; i--) {
            const b = state.alienBullets[i];
            b.y += CONFIG.ALIEN_BULLET_SPEED * dtSec;
            if (b.y > CONFIG.CANVAS_HEIGHT) {
                state.alienBullets.splice(i, 1);
            }
        }

        // Update particles
        ParticleSystem.update(dtSec, state.particles);

        // Collision detection
        CollisionSystem.update(state);

        // Check level complete
        if (AlienFormation.getAliveCount(state.aliens) === 0) {
            this.nextLevel();
        }

        // ---- RENDER ----

        // Draw shields
        ShieldSystem.draw(ctx, state.shields);

        // Draw aliens
        AlienFormation.draw(ctx, state.aliens, state.alienAnimFrame);

        // Draw UFO
        UFOSystem.draw(ctx, state.ufo);

        // Draw player
        PlayerSystem.draw(ctx, state);

        // Draw alien bullets
        ctx.fillStyle = CONFIG.COLORS.alienBullet;
        for (const b of state.alienBullets) {
            ctx.fillRect(b.x - 1, b.y, 3, 12);
        }

        // Draw particles
        ParticleSystem.draw(ctx, state.particles);

        // Draw HUD
        UI.drawHUD(ctx);
    },

    nextLevel() {
        GameState.level++;
        AudioEngine.playLevelUp();

        state.aliens = AlienFormation.create(GameState.level);
        state.shields = ShieldSystem.create();
        state.alienDirection = 1;
        state.alienStepTimer = CONFIG.ALIEN_BASE_INTERVAL;
        state.alienStepInterval = CONFIG.ALIEN_BASE_INTERVAL;
        state.alienAnimFrame = 0;
        state.alienStepNote = 0;
        state.alienNeedDrop = false;
        state.alienBullets = [];
        state.alienShootTimer = CONFIG.ALIEN_SHOOT_INTERVAL;
        state.ufo = { active: false, x: 0, direction: 1, points: 0, scoreDisplay: null };
        state.ufoSpawnTimer = CONFIG.UFO_SPAWN_MIN + Math.random() * (CONFIG.UFO_SPAWN_MAX - CONFIG.UFO_SPAWN_MIN);
        state.player.bullet = null;
    },

    drawPaused(ctx) {
        // Draw the frozen game state
        ShieldSystem.draw(ctx, state.shields);
        AlienFormation.draw(ctx, state.aliens, state.alienAnimFrame);
        UFOSystem.draw(ctx, state.ufo);
        PlayerSystem.draw(ctx, state);

        // Draw alien bullets (frozen)
        ctx.fillStyle = CONFIG.COLORS.alienBullet;
        for (const b of state.alienBullets) {
            ctx.fillRect(b.x - 1, b.y, 3, 12);
        }

        // Draw particles (frozen)
        ParticleSystem.draw(ctx, state.particles);

        UI.drawHUD(ctx);
        UI.drawPauseScreen(ctx);

        if (Input.justPressed('pause')) {
            GameState.phase = 'playing';
        }
    },

    updateGameOver(dt, ctx) {
        const dtSec = dt / 1000;

        // Let particles continue to animate
        ParticleSystem.update(dtSec, state.particles);

        // Draw frozen game underneath
        ShieldSystem.draw(ctx, state.shields);
        AlienFormation.draw(ctx, state.aliens, state.alienAnimFrame);
        UFOSystem.draw(ctx, state.ufo);
        PlayerSystem.draw(ctx, state);

        ctx.fillStyle = CONFIG.COLORS.alienBullet;
        for (const b of state.alienBullets) {
            ctx.fillRect(b.x - 1, b.y, 3, 12);
        }

        ParticleSystem.draw(ctx, state.particles);
        UI.drawHUD(ctx);

        // Draw game over overlay
        UI.drawGameOverScreen(ctx);

        if (Input.justPressed('enter')) {
            // Reset demo aliens for title screen
            UI._demoAliens = null;
            GameState.phase = 'title';
        }
    }
};

// ============================================================================
//  SECTION: SPRITE ALIAS SETUP
// ============================================================================
// Part 1 defines sprites with uppercase keys (SPRITES.SQUID, SPRITES.PLAYER, etc.)
// but Part 3 references them with lowercase/camelCase (SPRITES.squid, SPRITES.player).
// Create lowercase aliases to bridge the two.

(function setupSpriteAliases() {
    const aliases = {
        squid:           'SQUID',
        crab:            'CRAB',
        octopus:         'OCTOPUS',
        player:          'PLAYER',
        ufo:             'UFO',
        shield:          'SHIELD',
        bullet:          'BULLET',
        alienExplosion:  'ALIEN_EXPLOSION',
        playerExplosion: 'PLAYER_EXPLOSION',
        alienBulletSquiggly: 'ALIEN_BULLET_SQUIGGLY',
        alienBulletPlunger:  'ALIEN_BULLET_PLUNGER'
    };

    for (const lower in aliases) {
        const upper = aliases[lower];
        if (SPRITES[upper] && !SPRITES[lower]) {
            SPRITES[lower] = SPRITES[upper];
        }
    }
})();

// ============================================================================
//  BOOTSTRAP
// ============================================================================
window.addEventListener('DOMContentLoaded', () => Game.init());
