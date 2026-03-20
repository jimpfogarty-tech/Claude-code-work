// ============================================================================
//  SPACE INVADERS - PART 3: GAME STATE & ENTITIES
// ============================================================================

// ============================================================================
//  SECTION: GAME STATE
// ============================================================================

const GameState = {
    score: 0,
    lives: 3,
    level: 1,
    highScore: 0,
    phase: 'title',
    extraLifeAwarded: false,

    reset() {
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.extraLifeAwarded = false;
        this.loadHighScore();
    },

    loadHighScore() {
        try {
            const saved = localStorage.getItem('spaceInvadersHighScore');
            if (saved !== null) {
                this.highScore = parseInt(saved, 10) || 0;
            }
        } catch (e) {
            // localStorage may be unavailable
        }
    },

    saveHighScore() {
        try {
            if (this.score > this.highScore) {
                this.highScore = this.score;
                localStorage.setItem('spaceInvadersHighScore', this.highScore.toString());
            }
        } catch (e) {
            // localStorage may be unavailable
        }
    }
};

let state = {};

function resetState() {
    state = {
        player: {
            x: CONFIG.CANVAS_WIDTH / 2,
            y: CONFIG.PLAYER_Y,
            alive: true,
            deathTimer: 0,
            respawnTimer: 0,
            bullet: null
        },
        aliens: [],
        alienDirection: 1,
        alienStepTimer: 0,
        alienStepInterval: CONFIG.ALIEN_BASE_INTERVAL,
        alienAnimFrame: 0,
        alienStepNote: 0,
        alienNeedDrop: false,
        alienBullets: [],
        alienShootTimer: 0,
        shields: [],
        ufo: {
            active: false,
            x: 0,
            direction: 1,
            points: 0,
            scoreDisplay: null
        },
        ufoSpawnTimer: CONFIG.UFO_SPAWN_MIN + Math.random() * (CONFIG.UFO_SPAWN_MAX - CONFIG.UFO_SPAWN_MIN),
        particles: []
    };
}

// ============================================================================
//  SECTION: INPUT HANDLER
// ============================================================================

const Input = {
    keys: {},
    pressed: {},
    consumed: {},

    init() {
        document.addEventListener('keydown', (e) => {
            const action = this._mapKey(e.code, e.key);
            if (action) {
                e.preventDefault();
                this.keys[action] = true;
                if (!this.consumed[action]) {
                    this.pressed[action] = true;
                }
            }
        });

        document.addEventListener('keyup', (e) => {
            const action = this._mapKey(e.code, e.key);
            if (action) {
                e.preventDefault();
                this.keys[action] = false;
                this.consumed[action] = false;
            }
        });
    },

    _mapKey(code, key) {
        switch (code) {
            case 'ArrowLeft': return 'left';
            case 'ArrowRight': return 'right';
            case 'KeyA': return 'left';
            case 'KeyD': return 'right';
            case 'Space': return 'fire';
            case 'Escape': return 'pause';
            case 'KeyP': return 'pause';
            case 'Enter': return 'enter';
            case 'KeyT': return 'theme';
            case 'KeyM': return 'mute';
            default: return null;
        }
    },

    isLeft() {
        return !!this.keys['left'];
    },

    isRight() {
        return !!this.keys['right'];
    },

    justPressed(action) {
        if (this.pressed[action]) {
            this.pressed[action] = false;
            this.consumed[action] = true;
            return true;
        }
        return false;
    },

    update() {
        // Clear any remaining justPressed flags that weren't consumed this frame
        for (const action in this.pressed) {
            this.pressed[action] = false;
        }
    }
};

// ============================================================================
//  SECTION: SHIELD SYSTEM
// ============================================================================

const ShieldSystem = {
    create() {
        const shields = [];
        const shieldWidth = SPRITES.shield.width * CONFIG.SHIELD_SCALE;
        const totalWidth = CONFIG.SHIELD_COUNT * shieldWidth;
        const gap = (CONFIG.PLAY_RIGHT - CONFIG.PLAY_LEFT - totalWidth) / (CONFIG.SHIELD_COUNT + 1);

        for (let i = 0; i < CONFIG.SHIELD_COUNT; i++) {
            const x = CONFIG.PLAY_LEFT + gap + i * (shieldWidth + gap);
            const y = CONFIG.SHIELD_Y;

            // Create scaled pixel grid from shield template
            const srcW = SPRITES.shield.width;
            const srcH = SPRITES.shield.height;
            const scaledW = srcW * CONFIG.SHIELD_SCALE;
            const scaledH = srcH * CONFIG.SHIELD_SCALE;
            const pixels = [];

            for (let row = 0; row < scaledH; row++) {
                pixels[row] = [];
                for (let col = 0; col < scaledW; col++) {
                    const srcRow = Math.floor(row / CONFIG.SHIELD_SCALE);
                    const srcCol = Math.floor(col / CONFIG.SHIELD_SCALE);
                    pixels[row][col] = !!SPRITES.shield.frames[0][srcRow * srcW + srcCol];
                }
            }

            shields.push({ x, y, pixels, width: scaledW, height: scaledH });
        }

        return shields;
    },

    draw(ctx, shields) {
        const pixelSize = CONFIG.PIXEL_SCALE || 1;
        ctx.fillStyle = CONFIG.COLORS ? CONFIG.COLORS.shield || '#00FF00' : '#00FF00';

        for (let s = 0; s < shields.length; s++) {
            const shield = shields[s];
            for (let row = 0; row < shield.pixels.length; row++) {
                for (let col = 0; col < shield.pixels[row].length; col++) {
                    if (shield.pixels[row][col]) {
                        ctx.fillRect(
                            shield.x + col * pixelSize,
                            shield.y + row * pixelSize,
                            pixelSize,
                            pixelSize
                        );
                    }
                }
            }
        }
    },

    erode(shield, hitX, hitY, radius) {
        const pixelSize = CONFIG.PIXEL_SCALE || 1;
        const relX = (hitX - shield.x) / pixelSize;
        const relY = (hitY - shield.y) / pixelSize;

        for (let row = 0; row < shield.pixels.length; row++) {
            for (let col = 0; col < shield.pixels[row].length; col++) {
                const dx = col - relX;
                const dy = row - relY;
                if (dx * dx + dy * dy <= radius * radius) {
                    shield.pixels[row][col] = false;
                }
            }
        }
    },

    checkCollision(shields, bulletX, bulletY, bulletW, bulletH, fromAbove) {
        const pixelSize = CONFIG.PIXEL_SCALE || 1;

        for (let s = 0; s < shields.length; s++) {
            const shield = shields[s];
            const shieldRight = shield.x + shield.width * pixelSize;
            const shieldBottom = shield.y + shield.height * pixelSize;

            // Quick bounding box check
            if (bulletX + bulletW < shield.x || bulletX > shieldRight) continue;
            if (bulletY + bulletH < shield.y || bulletY > shieldBottom) continue;

            // Check individual pixels
            const startCol = Math.max(0, Math.floor((bulletX - shield.x) / pixelSize));
            const endCol = Math.min(shield.pixels[0].length - 1, Math.floor((bulletX + bulletW - shield.x) / pixelSize));
            const startRow = Math.max(0, Math.floor((bulletY - shield.y) / pixelSize));
            const endRow = Math.min(shield.pixels.length - 1, Math.floor((bulletY + bulletH - shield.y) / pixelSize));

            for (let row = startRow; row <= endRow; row++) {
                for (let col = startCol; col <= endCol; col++) {
                    if (shield.pixels[row][col]) {
                        // Hit detected - erode from the correct side
                        const erosionX = shield.x + col * pixelSize;
                        const erosionY = fromAbove
                            ? shield.y + startRow * pixelSize
                            : shield.y + endRow * pixelSize;
                        this.erode(shield, erosionX, erosionY, 4);
                        return true;
                    }
                }
            }
        }
        return false;
    }
};

// ============================================================================
//  SECTION: ALIEN FORMATION
// ============================================================================

const AlienFormation = {
    create(level) {
        const aliens = [];
        const levelOffset = (level - 1) * CONFIG.ALIEN_V_SPACING;

        for (let row = 0; row < CONFIG.ALIEN_ROWS; row++) {
            const type = CONFIG.ALIEN_ROW_TYPES[row];
            for (let col = 0; col < CONFIG.ALIEN_COLS; col++) {
                aliens.push({
                    type: type,
                    row: row,
                    col: col,
                    x: CONFIG.ALIEN_START_X + col * CONFIG.ALIEN_H_SPACING,
                    y: CONFIG.ALIEN_START_Y + row * CONFIG.ALIEN_V_SPACING + levelOffset,
                    alive: true,
                    dying: false,
                    deathTimer: 0
                });
            }
        }
        return aliens;
    },

    update(dt, state) {
        // Decrement step timer
        state.alienStepTimer -= dt;

        if (state.alienStepTimer <= 0) {
            if (state.alienNeedDrop) {
                // Drop all alive aliens down
                for (let i = 0; i < state.aliens.length; i++) {
                    if (state.aliens[i].alive) {
                        state.aliens[i].y += CONFIG.ALIEN_DROP_Y;
                    }
                }
                state.alienDirection *= -1;
                state.alienNeedDrop = false;
            } else {
                // Move all alive aliens horizontally
                for (let i = 0; i < state.aliens.length; i++) {
                    if (state.aliens[i].alive) {
                        state.aliens[i].x += CONFIG.ALIEN_STEP_X * state.alienDirection;
                    }
                }

                // Check if any alive alien hit screen edge
                for (let i = 0; i < state.aliens.length; i++) {
                    const alien = state.aliens[i];
                    if (alien.alive && !alien.dying) {
                        const spriteData = SPRITES[alien.type];
                        const alienRight = alien.x + spriteData.width * (CONFIG.PIXEL_SCALE || 1);
                        if (alienRight >= CONFIG.PLAY_RIGHT || alien.x <= CONFIG.PLAY_LEFT) {
                            state.alienNeedDrop = true;
                            break;
                        }
                    }
                }
            }

            // Toggle animation frame
            state.alienAnimFrame = state.alienAnimFrame === 0 ? 1 : 0;

            // Play step sound
            AudioEngine.playAlienStep(state.alienStepNote);
            state.alienStepNote = (state.alienStepNote + 1) % 4;

            // Reset timer
            state.alienStepTimer = state.alienStepInterval;
        }

        // Calculate step interval based on remaining aliens
        const aliveCount = this.getAliveCount(state.aliens);
        state.alienStepInterval = Math.max(
            CONFIG.ALIEN_MIN_INTERVAL,
            CONFIG.ALIEN_BASE_INTERVAL * (aliveCount / 55)
        );

        // Handle dying aliens
        for (let i = state.aliens.length - 1; i >= 0; i--) {
            const alien = state.aliens[i];
            if (alien.dying) {
                alien.deathTimer -= dt;
                if (alien.deathTimer <= 0) {
                    alien.alive = false;
                    alien.dying = false;
                }
            }
        }
    },

    shoot(dt, state) {
        state.alienShootTimer -= dt;

        if (state.alienShootTimer <= 0 && state.alienBullets.length < CONFIG.MAX_ALIEN_BULLETS) {
            // Get alive aliens grouped by column
            const columns = {};
            for (let i = 0; i < state.aliens.length; i++) {
                const alien = state.aliens[i];
                if (alien.alive && !alien.dying) {
                    if (!columns[alien.col]) {
                        columns[alien.col] = [];
                    }
                    columns[alien.col].push(alien);
                }
            }

            const colKeys = Object.keys(columns);
            if (colKeys.length > 0) {
                // Pick random column
                const randomCol = colKeys[Math.floor(Math.random() * colKeys.length)];
                const colAliens = columns[randomCol];

                // Find lowest alien in column (highest y value)
                let lowest = colAliens[0];
                for (let i = 1; i < colAliens.length; i++) {
                    if (colAliens[i].y > lowest.y) {
                        lowest = colAliens[i];
                    }
                }

                const spriteData = SPRITES[lowest.type];
                const scale = CONFIG.PIXEL_SCALE || 1;
                state.alienBullets.push({
                    x: lowest.x + (spriteData.width * scale) / 2 - 1.5,
                    y: lowest.y + spriteData.height * scale,
                    speed: CONFIG.ALIEN_BULLET_SPEED
                });
            }

            // Reset timer, faster at higher levels
            const levelFactor = Math.max(0.4, 1 - (GameState.level - 1) * 0.1);
            state.alienShootTimer = CONFIG.ALIEN_SHOOT_INTERVAL * levelFactor;
        }
    },

    draw(ctx, aliens, animFrame) {
        const scale = CONFIG.PIXEL_SCALE || 1;

        for (let i = 0; i < aliens.length; i++) {
            const alien = aliens[i];
            if (!alien.alive && !alien.dying) continue;

            if (alien.dying) {
                // Draw explosion sprite
                if (SPRITES.alienExplosion) {
                    drawSprite(ctx, SPRITES.alienExplosion, 0, alien.x, alien.y, scale, CONFIG.COLORS.white || '#FFFFFF');
                } else {
                    // Fallback: draw a simple flash
                    ctx.fillStyle = '#FFFFFF';
                    const spriteData = SPRITES[alien.type];
                    ctx.fillRect(alien.x, alien.y, spriteData.width * scale, spriteData.height * scale);
                }
            } else {
                let color;
                switch (alien.type) {
                    case 'squid':
                        color = CONFIG.COLORS.squid || '#FF0000';
                        break;
                    case 'crab':
                        color = CONFIG.COLORS.crab || '#FF8800';
                        break;
                    case 'octopus':
                        color = CONFIG.COLORS.octopus || '#FF00FF';
                        break;
                    default:
                        color = '#FFFFFF';
                }
                drawSprite(ctx, SPRITES[alien.type], animFrame, alien.x, alien.y, scale, color);
            }
        }
    },

    getAliveCount(aliens) {
        let count = 0;
        for (let i = 0; i < aliens.length; i++) {
            if (aliens[i].alive && !aliens[i].dying) {
                count++;
            }
        }
        return count;
    },

    checkHit(aliens, bulletX, bulletY) {
        const scale = CONFIG.PIXEL_SCALE || 1;

        for (let i = 0; i < aliens.length; i++) {
            const alien = aliens[i];
            if (!alien.alive || alien.dying) continue;

            const spriteData = SPRITES[alien.type];
            const w = spriteData.width * scale;
            const h = spriteData.height * scale;

            if (bulletX >= alien.x && bulletX <= alien.x + w &&
                bulletY >= alien.y && bulletY <= alien.y + h) {
                alien.dying = true;
                alien.deathTimer = CONFIG.DEATH_ANIM_DURATION;
                AudioEngine.playExplosion();

                let points;
                switch (alien.type) {
                    case 'squid': points = CONFIG.SCORE_SQUID; break;
                    case 'crab': points = CONFIG.SCORE_CRAB; break;
                    case 'octopus': points = CONFIG.SCORE_OCTOPUS; break;
                    default: points = 10;
                }

                return { alien, points };
            }
        }
        return null;
    },

    hasReachedBottom(aliens) {
        for (let i = 0; i < aliens.length; i++) {
            if (aliens[i].alive && !aliens[i].dying && aliens[i].y >= CONFIG.GAME_OVER_Y) {
                return true;
            }
        }
        return false;
    }
};

// ============================================================================
//  SECTION: UFO SYSTEM
// ============================================================================

const UFOSystem = {
    update(dt, state) {
        if (!state.ufo.active) {
            // Handle score display timer
            if (state.ufo.scoreDisplay) {
                state.ufo.scoreDisplay.timer -= dt;
                if (state.ufo.scoreDisplay.timer <= 0) {
                    state.ufo.scoreDisplay = null;
                }
            }

            state.ufoSpawnTimer -= dt * 1000;
            if (state.ufoSpawnTimer <= 0) {
                this.spawn(state);
            }
        } else {
            state.ufo.x += CONFIG.UFO_SPEED * state.ufo.direction * dt;

            // Check if off screen
            const spriteW = SPRITES.ufo.width * (CONFIG.PIXEL_SCALE || 1);
            if ((state.ufo.direction === 1 && state.ufo.x > CONFIG.CANVAS_WIDTH + spriteW) ||
                (state.ufo.direction === -1 && state.ufo.x < -spriteW)) {
                state.ufo.active = false;
                AudioEngine.stopUFOSound();
                state.ufoSpawnTimer = CONFIG.UFO_SPAWN_MIN + Math.random() * (CONFIG.UFO_SPAWN_MAX - CONFIG.UFO_SPAWN_MIN);
            }
        }
    },

    spawn(state) {
        const direction = Math.random() < 0.5 ? 1 : -1;
        const spriteW = SPRITES.ufo.width * (CONFIG.PIXEL_SCALE || 1);

        state.ufo.active = true;
        state.ufo.direction = direction;
        state.ufo.x = direction === 1 ? -spriteW : CONFIG.CANVAS_WIDTH + spriteW;
        state.ufo.points = CONFIG.UFO_SCORES
            ? CONFIG.UFO_SCORES[Math.floor(Math.random() * CONFIG.UFO_SCORES.length)]
            : 100;
        state.ufo.scoreDisplay = null;

        AudioEngine.playUFOSound();
    },

    draw(ctx, ufo) {
        const scale = CONFIG.PIXEL_SCALE || 1;

        if (ufo.active) {
            const color = CONFIG.COLORS.ufo || '#FF0000';
            drawSprite(ctx, SPRITES.ufo, 0, ufo.x, CONFIG.UFO_Y, scale, color);
        }

        // Draw score display if active
        if (ufo.scoreDisplay) {
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '16px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(
                ufo.scoreDisplay.points.toString(),
                ufo.scoreDisplay.x,
                ufo.scoreDisplay.y + 12
            );
            ctx.textAlign = 'left';
        }
    },

    checkHit(ufo, bulletX, bulletY) {
        if (!ufo.active) return null;

        const scale = CONFIG.PIXEL_SCALE || 1;
        const w = SPRITES.ufo.width * scale;
        const h = SPRITES.ufo.height * scale;

        if (bulletX >= ufo.x && bulletX <= ufo.x + w &&
            bulletY >= CONFIG.UFO_Y && bulletY <= CONFIG.UFO_Y + h) {
            const points = ufo.points;

            ufo.scoreDisplay = {
                x: ufo.x + w / 2,
                y: CONFIG.UFO_Y,
                points: points,
                timer: 1.0
            };
            ufo.active = false;
            AudioEngine.stopUFOSound();

            state.ufoSpawnTimer = CONFIG.UFO_SPAWN_MIN + Math.random() * (CONFIG.UFO_SPAWN_MAX - CONFIG.UFO_SPAWN_MIN);

            return points;
        }
        return null;
    }
};

// ============================================================================
//  SECTION: PLAYER LOGIC
// ============================================================================

const PlayerSystem = {
    update(dt, state) {
        if (state.player.alive) {
            // Movement
            if (Input.isLeft()) {
                state.player.x -= CONFIG.PLAYER_SPEED * dt;
            }
            if (Input.isRight()) {
                state.player.x += CONFIG.PLAYER_SPEED * dt;
            }

            // Clamp to play area
            const playerWidth = SPRITES.player.width * (CONFIG.PIXEL_SCALE || 1);
            if (state.player.x < CONFIG.PLAY_LEFT) {
                state.player.x = CONFIG.PLAY_LEFT;
            }
            if (state.player.x + playerWidth > CONFIG.PLAY_RIGHT) {
                state.player.x = CONFIG.PLAY_RIGHT - playerWidth;
            }

            // Fire
            if (Input.justPressed('fire') && state.player.bullet === null) {
                const bulletX = state.player.x + playerWidth / 2 - 1.5;
                const bulletY = state.player.y;
                state.player.bullet = { x: bulletX, y: bulletY };
                AudioEngine.playShoot();
            }
        } else {
            // Death animation
            if (state.player.deathTimer > 0) {
                state.player.deathTimer -= dt * 1000;
                if (state.player.deathTimer <= 0) {
                    state.player.respawnTimer = CONFIG.RESPAWN_DELAY;
                }
            } else if (state.player.respawnTimer > 0) {
                state.player.respawnTimer -= dt * 1000;
                if (state.player.respawnTimer <= 0) {
                    if (GameState.lives > 0) {
                        this.respawn(state);
                    }
                }
            }
        }
    },

    updateBullet(dt, state) {
        if (state.player.bullet === null) return;

        state.player.bullet.y -= CONFIG.PLAYER_BULLET_SPEED * dt;

        // Remove if off screen
        if (state.player.bullet.y < 0) {
            state.player.bullet = null;
        }
    },

    draw(ctx, state) {
        const scale = CONFIG.PIXEL_SCALE || 1;

        if (state.player.alive) {
            const color = CONFIG.COLORS.player || '#00FF00';
            drawSprite(ctx, SPRITES.player, 0, state.player.x, state.player.y, scale, color);
        } else if (state.player.deathTimer > 0) {
            // Draw explosion animation during death
            if (SPRITES.playerExplosion) {
                const frame = state.player.deathTimer > CONFIG.DEATH_ANIM_DURATION / 2 ? 0 : 1;
                drawSprite(ctx, SPRITES.playerExplosion, frame, state.player.x, state.player.y, scale, '#FFFFFF');
            } else {
                // Fallback explosion look
                const color = state.player.deathTimer % 0.1 > 0.05 ? '#FF8800' : '#FFFFFF';
                drawSprite(ctx, SPRITES.player, 0, state.player.x, state.player.y, scale, color);
            }
        }

        // Draw bullet
        if (state.player.bullet) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(state.player.bullet.x, state.player.bullet.y, 3, 12);
        }
    },

    kill(state) {
        state.player.alive = false;
        state.player.deathTimer = CONFIG.DEATH_ANIM_DURATION;
        state.player.bullet = null;
        AudioEngine.playDeath();
        GameState.lives--;
    },

    respawn(state) {
        const playerWidth = SPRITES.player.width * (CONFIG.PIXEL_SCALE || 1);
        state.player.x = CONFIG.CANVAS_WIDTH / 2 - playerWidth / 2;
        state.player.y = CONFIG.PLAYER_Y;
        state.player.alive = true;
        state.player.deathTimer = 0;
        state.player.respawnTimer = 0;
        state.player.bullet = null;
    }
};

// ============================================================================
//  SECTION: PARTICLE SYSTEM
// ============================================================================

const ParticleSystem = {
    emit(particles, x, y, color, count) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 30 + Math.random() * 120;
            const life = 0.3 + Math.random() * 0.5;

            particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: life,
                maxLife: life,
                color: color,
                size: 1 + Math.random() * 3
            });
        }
    },

    update(dt, particles) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;

            if (p.life <= 0) {
                particles.splice(i, 1);
            }
        }
    },

    draw(ctx, particles) {
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            const alpha = Math.max(0, p.life / p.maxLife);

            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
        ctx.globalAlpha = 1;
    }
};
