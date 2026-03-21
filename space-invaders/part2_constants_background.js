// ============================================================
// SECTION: CONSTANTS
// ============================================================

const CONFIG = {
    CANVAS_WIDTH: 672,      // 224 * 3 (3x scale of original)
    CANVAS_HEIGHT: 768,     // 256 * 3
    PIXEL_SCALE: 3,         // pixels per game unit

    // Alien grid
    ALIEN_COLS: 11,
    ALIEN_ROWS: 5,
    ALIEN_H_SPACING: 48,    // horizontal spacing between aliens
    ALIEN_V_SPACING: 48,    // vertical spacing between aliens
    ALIEN_START_X: 60,      // left edge of formation
    ALIEN_START_Y: 150,     // top of formation
    ALIEN_STEP_X: 6,        // pixels per horizontal step
    ALIEN_DROP_Y: 24,       // pixels to drop when hitting edge
    ALIEN_BASE_INTERVAL: 800, // ms between steps at full formation
    ALIEN_MIN_INTERVAL: 80,   // fastest step speed

    // Alien types per row (top to bottom)
    ALIEN_ROW_TYPES: ['squid', 'crab', 'crab', 'octopus', 'octopus'],

    // Scoring
    SCORE_SQUID: 30,
    SCORE_CRAB: 20,
    SCORE_OCTOPUS: 10,
    UFO_SCORES: [50, 100, 150, 200, 300],
    EXTRA_LIFE_SCORE: 1500,

    // Player
    PLAYER_Y: 700,          // fixed Y position
    PLAYER_SPEED: 300,      // pixels per second
    PLAYER_BULLET_SPEED: 600,
    PLAYER_WIDTH: 39,       // 13 * 3
    PLAYER_HEIGHT: 24,      // 8 * 3
    DEATH_ANIM_DURATION: 1500,
    RESPAWN_DELAY: 2000,

    // Alien bullets
    ALIEN_BULLET_SPEED: 200,
    ALIEN_SHOOT_INTERVAL: 1500, // base ms between alien shots (decreases with level)
    MAX_ALIEN_BULLETS: 3,

    // UFO
    UFO_SPEED: 150,
    UFO_SPAWN_MIN: 15000,   // min ms between UFO spawns
    UFO_SPAWN_MAX: 30000,
    UFO_Y: 90,

    // Shields
    SHIELD_COUNT: 4,
    SHIELD_Y: 620,
    SHIELD_SCALE: 1,
    SHIELD_EROSION_RADIUS: 4,

    // Colors
    COLORS: {
        player: '#00FF00',
        playerBullet: '#FFFFFF',
        squid: '#FF00FF',
        crab: '#00FFFF',
        octopus: '#FFFF00',
        ufo: '#FF0000',
        ufoText: '#FF4444',
        shield: '#00FF00',
        alienBullet: '#FFFFFF',
        explosion: '#FFFFFF',
        hud: '#FFFFFF',
        title: '#00FF00',
        subtitle: '#AAAAAA',
        credit: '#666666',
    },

    // Game area boundaries
    PLAY_LEFT: 30,
    PLAY_RIGHT: 642,
    GAME_OVER_Y: 660,       // if aliens reach this Y, game over

    // Background themes
    THEMES: ['starfield', 'nebula', 'deep_space', 'classic'],
};

// ============================================================
// SECTION: BACKGROUND RENDERER
// ============================================================

const BackgroundRenderer = {
    currentTheme: 'starfield',
    stars: [],
    nebulaClouds: [],
    galaxies: [],

    // Internal timing accumulators
    _time: 0,

    init() {
        this._generateStars();
        this._generateNebulaClouds();
        this._generateGalaxies();
    },

    _generateStars() {
        this.stars = [];
        const layers = [
            { count: 100, speedFactor: 0.3, sizeRange: [0.5, 1.0], brightnessRange: [0.2, 0.5] },
            { count: 60,  speedFactor: 0.6, sizeRange: [1.0, 1.8], brightnessRange: [0.4, 0.7] },
            { count: 40,  speedFactor: 1.0, sizeRange: [1.5, 2.5], brightnessRange: [0.6, 1.0] },
        ];

        for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
            const layer = layers[layerIdx];
            for (let i = 0; i < layer.count; i++) {
                this.stars.push({
                    x: Math.random() * CONFIG.CANVAS_WIDTH,
                    y: Math.random() * CONFIG.CANVAS_HEIGHT,
                    brightness: layer.brightnessRange[0] + Math.random() * (layer.brightnessRange[1] - layer.brightnessRange[0]),
                    speed: 8 + Math.random() * 12 * layer.speedFactor,
                    size: layer.sizeRange[0] + Math.random() * (layer.sizeRange[1] - layer.sizeRange[0]),
                    layer: layerIdx,
                    twinkleOffset: Math.random() * Math.PI * 2,
                    twinkleSpeed: 1.5 + Math.random() * 3.0,
                });
            }
        }
    },

    _generateNebulaClouds() {
        this.nebulaClouds = [];
        const nebulaColors = [
            { r: 40, g: 10, b: 80 },   // deep purple
            { r: 10, g: 20, b: 90 },   // dark blue
            { r: 80, g: 10, b: 60 },   // magenta
            { r: 20, g: 40, b: 100 },  // steel blue
            { r: 60, g: 5, b: 50 },    // dark pink
            { r: 10, g: 30, b: 70 },   // navy
            { r: 50, g: 15, b: 70 },   // violet
        ];

        for (let i = 0; i < 7; i++) {
            const color = nebulaColors[i % nebulaColors.length];
            this.nebulaClouds.push({
                x: Math.random() * CONFIG.CANVAS_WIDTH,
                y: Math.random() * CONFIG.CANVAS_HEIGHT,
                radius: 120 + Math.random() * 200,
                color: color,
                alpha: 0.04 + Math.random() * 0.06,
                driftX: (Math.random() - 0.5) * 4,
                driftY: (Math.random() - 0.5) * 3,
                pulseOffset: Math.random() * Math.PI * 2,
                pulseSpeed: 0.3 + Math.random() * 0.5,
            });
        }
    },

    _generateGalaxies() {
        this.galaxies = [];

        // Sparse distant stars for deep space
        for (let i = 0; i < 50; i++) {
            this.galaxies.push({
                type: 'star',
                x: Math.random() * CONFIG.CANVAS_WIDTH,
                y: Math.random() * CONFIG.CANVAS_HEIGHT,
                size: 0.3 + Math.random() * 0.8,
                brightness: 0.15 + Math.random() * 0.3,
                twinkleOffset: Math.random() * Math.PI * 2,
                twinkleSpeed: 0.5 + Math.random() * 1.0,
            });
        }

        // Galaxy smudges
        for (let i = 0; i < 4; i++) {
            this.galaxies.push({
                type: 'galaxy',
                x: 60 + Math.random() * (CONFIG.CANVAS_WIDTH - 120),
                y: 60 + Math.random() * (CONFIG.CANVAS_HEIGHT - 120),
                radiusX: 30 + Math.random() * 50,
                radiusY: 10 + Math.random() * 20,
                angle: Math.random() * Math.PI,
                brightness: 0.02 + Math.random() * 0.03,
                driftAngle: Math.random() * Math.PI * 2,
                driftSpeed: 1 + Math.random() * 2,
            });
        }
    },

    setTheme(name) {
        if (CONFIG.THEMES.indexOf(name) !== -1) {
            this.currentTheme = name;
        } else {
            // Cycle to next theme
            const idx = CONFIG.THEMES.indexOf(this.currentTheme);
            this.currentTheme = CONFIG.THEMES[(idx + 1) % CONFIG.THEMES.length];
        }
    },

    update(dt) {
        this._time += dt;

        switch (this.currentTheme) {
            case 'starfield':
                this._updateStarfield(dt);
                break;
            case 'nebula':
                this._updateNebula(dt);
                break;
            case 'deep_space':
                this._updateDeepSpace(dt);
                break;
            case 'classic':
                // No animation
                break;
        }
    },

    _updateStarfield(dt) {
        for (let i = 0; i < this.stars.length; i++) {
            const star = this.stars[i];
            star.y += star.speed * dt;
            if (star.y > CONFIG.CANVAS_HEIGHT) {
                star.y -= CONFIG.CANVAS_HEIGHT;
                star.x = Math.random() * CONFIG.CANVAS_WIDTH;
            }
        }
    },

    _updateNebula(dt) {
        for (let i = 0; i < this.nebulaClouds.length; i++) {
            const cloud = this.nebulaClouds[i];
            cloud.x += cloud.driftX * dt;
            cloud.y += cloud.driftY * dt;

            // Wrap around with generous margins
            if (cloud.x < -cloud.radius) cloud.x = CONFIG.CANVAS_WIDTH + cloud.radius;
            if (cloud.x > CONFIG.CANVAS_WIDTH + cloud.radius) cloud.x = -cloud.radius;
            if (cloud.y < -cloud.radius) cloud.y = CONFIG.CANVAS_HEIGHT + cloud.radius;
            if (cloud.y > CONFIG.CANVAS_HEIGHT + cloud.radius) cloud.y = -cloud.radius;
        }
    },

    _updateDeepSpace(dt) {
        for (let i = 0; i < this.galaxies.length; i++) {
            const obj = this.galaxies[i];
            if (obj.type === 'galaxy') {
                obj.angle += 0.01 * dt;
                obj.x += Math.cos(obj.driftAngle) * obj.driftSpeed * dt;
                obj.y += Math.sin(obj.driftAngle) * obj.driftSpeed * dt;

                // Wrap
                if (obj.x < -obj.radiusX) obj.x = CONFIG.CANVAS_WIDTH + obj.radiusX;
                if (obj.x > CONFIG.CANVAS_WIDTH + obj.radiusX) obj.x = -obj.radiusX;
                if (obj.y < -obj.radiusY) obj.y = CONFIG.CANVAS_HEIGHT + obj.radiusY;
                if (obj.y > CONFIG.CANVAS_HEIGHT + obj.radiusY) obj.y = -obj.radiusY;
            }
        }
    },

    draw(ctx, canvasWidth, canvasHeight) {
        switch (this.currentTheme) {
            case 'starfield':
                this._drawStarfield(ctx, canvasWidth, canvasHeight);
                break;
            case 'nebula':
                this._drawNebula(ctx, canvasWidth, canvasHeight);
                break;
            case 'deep_space':
                this._drawDeepSpace(ctx, canvasWidth, canvasHeight);
                break;
            case 'classic':
                this._drawClassic(ctx, canvasWidth, canvasHeight);
                break;
        }
    },

    _drawStarfield(ctx, canvasWidth, canvasHeight) {
        // Dark gradient background
        const bgGrad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
        bgGrad.addColorStop(0, '#020010');
        bgGrad.addColorStop(0.5, '#050018');
        bgGrad.addColorStop(1, '#020010');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // Draw stars with twinkle effect
        const time = this._time;
        for (let i = 0; i < this.stars.length; i++) {
            const star = this.stars[i];
            const twinkle = 0.5 + 0.5 * Math.sin(time * star.twinkleSpeed + star.twinkleOffset);
            const alpha = star.brightness * (0.6 + 0.4 * twinkle);

            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, ' + alpha.toFixed(3) + ')';
            ctx.fill();

            // Add a subtle glow to brighter, larger stars
            if (star.layer === 2 && twinkle > 0.7) {
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.size * 3, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(200, 220, 255, ' + (alpha * 0.1).toFixed(3) + ')';
                ctx.fill();
            }
        }
    },

    _drawNebula(ctx, canvasWidth, canvasHeight) {
        // Very dark base
        ctx.fillStyle = '#010008';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        const time = this._time;

        // Draw nebula clouds as radial gradients
        for (let i = 0; i < this.nebulaClouds.length; i++) {
            const cloud = this.nebulaClouds[i];
            const pulse = 0.7 + 0.3 * Math.sin(time * cloud.pulseSpeed + cloud.pulseOffset);
            const currentAlpha = cloud.alpha * pulse;
            const r = cloud.color.r;
            const g = cloud.color.g;
            const b = cloud.color.b;

            const grad = ctx.createRadialGradient(
                cloud.x, cloud.y, 0,
                cloud.x, cloud.y, cloud.radius
            );
            grad.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',' + (currentAlpha * 1.5).toFixed(4) + ')');
            grad.addColorStop(0.3, 'rgba(' + r + ',' + g + ',' + b + ',' + (currentAlpha * 0.8).toFixed(4) + ')');
            grad.addColorStop(0.7, 'rgba(' + r + ',' + g + ',' + b + ',' + (currentAlpha * 0.3).toFixed(4) + ')');
            grad.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');

            ctx.fillStyle = grad;
            ctx.fillRect(
                cloud.x - cloud.radius,
                cloud.y - cloud.radius,
                cloud.radius * 2,
                cloud.radius * 2
            );
        }

        // Scatter a few faint stars over the nebula
        for (let i = 0; i < 40; i++) {
            // Use deterministic positions seeded by index
            const sx = ((i * 137.5) % canvasWidth);
            const sy = ((i * 251.3) % canvasHeight);
            const twinkle = 0.5 + 0.5 * Math.sin(time * 2.0 + i * 1.7);
            const alpha = 0.2 + 0.3 * twinkle;

            ctx.beginPath();
            ctx.arc(sx, sy, 0.8, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, ' + alpha.toFixed(3) + ')';
            ctx.fill();
        }
    },

    _drawDeepSpace(ctx, canvasWidth, canvasHeight) {
        // Almost pure black with a very subtle gradient
        const bgGrad = ctx.createRadialGradient(
            canvasWidth * 0.5, canvasHeight * 0.5, 0,
            canvasWidth * 0.5, canvasHeight * 0.5, canvasHeight * 0.7
        );
        bgGrad.addColorStop(0, '#030012');
        bgGrad.addColorStop(1, '#000005');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        const time = this._time;

        // Draw galaxy smudges
        for (let i = 0; i < this.galaxies.length; i++) {
            const obj = this.galaxies[i];

            if (obj.type === 'galaxy') {
                ctx.save();
                ctx.translate(obj.x, obj.y);
                ctx.rotate(obj.angle);

                const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, obj.radiusX);
                const b = obj.brightness;
                grad.addColorStop(0, 'rgba(180, 160, 220, ' + (b * 2).toFixed(4) + ')');
                grad.addColorStop(0.4, 'rgba(120, 100, 180, ' + (b * 1.2).toFixed(4) + ')');
                grad.addColorStop(1, 'rgba(80, 60, 140, 0)');

                ctx.scale(1, obj.radiusY / obj.radiusX);
                ctx.fillStyle = grad;
                ctx.fillRect(-obj.radiusX, -obj.radiusX, obj.radiusX * 2, obj.radiusX * 2);

                ctx.restore();
            } else if (obj.type === 'star') {
                const twinkle = 0.5 + 0.5 * Math.sin(time * obj.twinkleSpeed + obj.twinkleOffset);
                const alpha = obj.brightness * (0.5 + 0.5 * twinkle);

                ctx.beginPath();
                ctx.arc(obj.x, obj.y, obj.size, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(200, 210, 255, ' + alpha.toFixed(3) + ')';
                ctx.fill();
            }
        }
    },

    _drawClassic(ctx, canvasWidth, canvasHeight) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    },
};
