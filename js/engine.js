// ================================================================
// THE UNRAVELING EARTH - Engine Core
// Core systems: Config, Math, Noise, Input, Audio, Camera, Particles
// ================================================================

window.UE = window.UE || {};

// ======================== CONFIGURATION ========================
UE.Config = {
    TILE_SIZE: 32,
    WORLD_W: 200,
    WORLD_H: 200,
    PLAYER_SPEED: 150,
    PLAYER_DODGE_SPEED: 400,
    PLAYER_DODGE_DURATION: 0.25,
    PLAYER_DODGE_COOLDOWN: 0.5,
    PLAYER_MAX_HP: 100,
    PLAYER_MAX_STAMINA: 100,
    STAMINA_REGEN: 25,
    HP_REGEN_NEAR_NODE: 3,
    STATIC_DAMAGE: 8,
    STATIC_TICK: 1.0,
    CAMERA_SMOOTH: 0.08,
    SPAWN_RATE_BASE: 3.0,
    SPAWN_RATE_STATIC: 1.2,
    MAX_ENEMIES: 80,
    ENEMY_DESPAWN_DIST: 1200,
    LOOT_MAGNET_DIST: 60,
    LOOT_PICKUP_DIST: 24,
    XP_BASE: 20,
    XP_SCALE: 1.35,
    NODE_REPAIR_TIME: 5.0,
    NODE_CLEAR_RADIUS: 30,
    NODE_FUEL_COST: 10,
    MINIMAP_SIZE: 160,
    MINIMAP_SCALE: 0.8,
    ATTACK_LIGHT_CD: 0.35,
    ATTACK_HEAVY_CD: 0.75,
    ATTACK_LIGHT_RANGE: 44,
    ATTACK_HEAVY_RANGE: 56,
    ATTACK_LIGHT_ARC: Math.PI * 0.6,
    ATTACK_HEAVY_ARC: Math.PI * 0.85,
    COMBO_WINDOW: 0.6,
    COMBO_MAX: 3,
    WHIRLWIND_COST: 30,
    WHIRLWIND_CD: 3.0,
    BUILD_WALL_COST: 5,
    BUILD_TURRET_COST: 15,
    BUILD_GENERATOR_COST: 20,
    TURRET_RANGE: 200,
    TURRET_FIRE_RATE: 1.5,
    TURRET_DAMAGE: 12
};

// ======================== UTILITIES ========================
UE.Utils = {
    lerp(a, b, t) { return a + (b - a) * t; },
    clamp(v, min, max) { return Math.max(min, Math.min(max, v)); },
    dist(x1, y1, x2, y2) { return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2); },
    angle(x1, y1, x2, y2) { return Math.atan2(y2 - y1, x2 - x1); },
    randRange(min, max) { return Math.random() * (max - min) + min; },
    randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; },
    chance(pct) { return Math.random() < pct; },
    normalizeAngle(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; },
    angleDiff(a, b) { return UE.Utils.normalizeAngle(b - a); },
    pointInArc(px, py, ox, oy, facing, arc, range) {
        const d = UE.Utils.dist(px, py, ox, oy);
        if (d > range) return false;
        const a = UE.Utils.angle(ox, oy, px, py);
        return Math.abs(UE.Utils.angleDiff(facing, a)) < arc / 2;
    },
    worldToTile(wx, wy) {
        return {
            tx: Math.floor(wx / UE.Config.TILE_SIZE),
            ty: Math.floor(wy / UE.Config.TILE_SIZE)
        };
    },
    tileToWorld(tx, ty) {
        return {
            wx: tx * UE.Config.TILE_SIZE + UE.Config.TILE_SIZE / 2,
            wy: ty * UE.Config.TILE_SIZE + UE.Config.TILE_SIZE / 2
        };
    },
    hsla(h, s, l, a) { return `hsla(${h},${s}%,${l}%,${a})`; },
    rgba(r, g, b, a) { return `rgba(${r},${g},${b},${a})`; },
    pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    },
    easeOutQuad(t) { return t * (2 - t); },
    easeInQuad(t) { return t * t; },
    easeOutBack(t) { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
    screenShake(intensity) {
        if (UE.camera) {
            UE.camera.shakeIntensity = Math.max(UE.camera.shakeIntensity, intensity);
        }
    }
};

// ======================== SIMPLEX NOISE ========================
UE.SimplexNoise = class {
    constructor(seed) {
        this.seed = seed || Math.random() * 65536;
        this.perm = new Uint8Array(512);
        this.grad = [
            [1,1],[-1,1],[1,-1],[-1,-1],
            [1,0],[-1,0],[0,1],[0,-1]
        ];
        const p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) p[i] = i;
        let s = this.seed;
        for (let i = 255; i > 0; i--) {
            s = (s * 16807 + 0) % 2147483647;
            const j = s % (i + 1);
            [p[i], p[j]] = [p[j], p[i]];
        }
        for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
    }

    noise2D(x, y) {
        const F2 = 0.5 * (Math.sqrt(3) - 1);
        const G2 = (3 - Math.sqrt(3)) / 6;
        const s = (x + y) * F2;
        const i = Math.floor(x + s);
        const j = Math.floor(y + s);
        const t = (i + j) * G2;
        const X0 = i - t, Y0 = j - t;
        const x0 = x - X0, y0 = y - Y0;
        let i1, j1;
        if (x0 > y0) { i1 = 1; j1 = 0; }
        else { i1 = 0; j1 = 1; }
        const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
        const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
        const ii = i & 255, jj = j & 255;
        const gi0 = this.perm[ii + this.perm[jj]] % 8;
        const gi1 = this.perm[ii + i1 + this.perm[jj + j1]] % 8;
        const gi2 = this.perm[ii + 1 + this.perm[jj + 1]] % 8;
        let n0 = 0, n1 = 0, n2 = 0;
        let t0 = 0.5 - x0 * x0 - y0 * y0;
        if (t0 > 0) { t0 *= t0; n0 = t0 * t0 * (this.grad[gi0][0] * x0 + this.grad[gi0][1] * y0); }
        let t1 = 0.5 - x1 * x1 - y1 * y1;
        if (t1 > 0) { t1 *= t1; n1 = t1 * t1 * (this.grad[gi1][0] * x1 + this.grad[gi1][1] * y1); }
        let t2 = 0.5 - x2 * x2 - y2 * y2;
        if (t2 > 0) { t2 *= t2; n2 = t2 * t2 * (this.grad[gi2][0] * x2 + this.grad[gi2][1] * y2); }
        return 70 * (n0 + n1 + n2);
    }

    octave(x, y, octaves, persistence, lacunarity) {
        let total = 0, frequency = 1, amplitude = 1, maxVal = 0;
        for (let i = 0; i < octaves; i++) {
            total += this.noise2D(x * frequency, y * frequency) * amplitude;
            maxVal += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }
        return total / maxVal;
    }

    normalized(x, y, octaves, persistence, lacunarity) {
        return (this.octave(x, y, octaves || 4, persistence || 0.5, lacunarity || 2.0) + 1) / 2;
    }
};

// ======================== INPUT MANAGER ========================
UE.InputManager = class {
    constructor() {
        this.keys = {};
        this.keysJustPressed = {};
        this.mouse = { x: 0, y: 0, worldX: 0, worldY: 0, left: false, right: false, leftJust: false, rightJust: false };
        this._prevKeys = {};
        this._prevMouse = { left: false, right: false };

        window.addEventListener('keydown', (e) => {
            if (e.repeat) return;
            this.keys[e.code] = true;
            this.keysJustPressed[e.code] = true;
            if (['Space', 'Tab', 'KeyI', 'KeyC', 'KeyB', 'KeyM'].includes(e.code)) e.preventDefault();
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
        window.addEventListener('mousedown', (e) => {
            if (e.button === 0) { this.mouse.left = true; this.mouse.leftJust = true; }
            if (e.button === 2) { this.mouse.right = true; this.mouse.rightJust = true; }
        });
        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.mouse.left = false;
            if (e.button === 2) this.mouse.right = false;
        });
        this.mouse.scrollY = 0;
        window.addEventListener('wheel', (e) => {
            this.mouse.scrollY += e.deltaY;
            e.preventDefault();
        }, { passive: false });
        window.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    update() {
        // Clear just-pressed states after each frame
    }

    postUpdate() {
        this.keysJustPressed = {};
        this.mouse.leftJust = false;
        this.mouse.rightJust = false;
        this.mouse.scrollY = 0;
    }

    isDown(code) { return !!this.keys[code]; }
    justPressed(code) { return !!this.keysJustPressed[code]; }
    mouseWorld(camera) {
        this.mouse.worldX = this.mouse.x + camera.x - camera.hw;
        this.mouse.worldY = this.mouse.y + camera.y - camera.hh;
    }
};

// ======================== AUDIO MANAGER ========================
UE.AudioManager = class {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.initialized = false;
        this.musicPlaying = false;
    }

    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.3;
            this.masterGain.connect(this.ctx.destination);
            this.initialized = true;
        } catch (e) {
            console.warn('Audio not available');
        }
    }

    play(type) {
        if (!this.initialized) return;
        const now = this.ctx.currentTime;
        try {
            switch (type) {
                case 'hit': this._playHit(now); break;
                case 'slash': this._playSlash(now); break;
                case 'heavySlash': this._playHeavySlash(now); break;
                case 'dodge': this._playDodge(now); break;
                case 'pickup': this._playPickup(now); break;
                case 'levelup': this._playLevelUp(now); break;
                case 'death': this._playDeath(now); break;
                case 'nodeActivate': this._playNodeActivate(now); break;
                case 'build': this._playBuild(now); break;
                case 'enemyHit': this._playEnemyHit(now); break;
                case 'whirlwind': this._playWhirlwind(now); break;
                case 'combo': this._playCombo(now); break;
            }
        } catch (e) {}
    }

    _osc(freq, type, start, dur, vol) {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type;
        o.frequency.value = freq;
        g.gain.setValueAtTime(vol || 0.2, start);
        g.gain.exponentialRampToValueAtTime(0.001, start + dur);
        o.connect(g);
        g.connect(this.masterGain);
        o.start(start);
        o.stop(start + dur);
    }

    _noise(start, dur, vol) {
        const bufSize = this.ctx.sampleRate * dur;
        const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(vol || 0.1, start);
        g.gain.exponentialRampToValueAtTime(0.001, start + dur);
        src.connect(g);
        g.connect(this.masterGain);
        src.start(start);
    }

    _playSlash(t) {
        this._noise(t, 0.12, 0.15);
        this._osc(300, 'sawtooth', t, 0.08, 0.1);
        this._osc(200, 'sawtooth', t + 0.02, 0.06, 0.08);
    }

    _playHeavySlash(t) {
        this._noise(t, 0.2, 0.2);
        this._osc(200, 'sawtooth', t, 0.15, 0.15);
        this._osc(120, 'square', t + 0.03, 0.12, 0.1);
    }

    _playHit(t) {
        this._osc(150, 'square', t, 0.1, 0.15);
        this._osc(80, 'sawtooth', t, 0.15, 0.1);
        this._noise(t, 0.08, 0.12);
    }

    _playEnemyHit(t) {
        this._osc(250, 'square', t, 0.06, 0.1);
        this._noise(t, 0.05, 0.08);
    }

    _playDodge(t) {
        this._noise(t, 0.15, 0.08);
        this._osc(400, 'sine', t, 0.1, 0.06);
        this._osc(600, 'sine', t + 0.05, 0.05, 0.04);
    }

    _playPickup(t) {
        this._osc(600, 'sine', t, 0.08, 0.12);
        this._osc(800, 'sine', t + 0.06, 0.08, 0.1);
        this._osc(1000, 'sine', t + 0.12, 0.1, 0.08);
    }

    _playLevelUp(t) {
        [400, 500, 600, 800, 1000].forEach((f, i) => {
            this._osc(f, 'sine', t + i * 0.08, 0.3 - i * 0.04, 0.12);
        });
    }

    _playDeath(t) {
        this._osc(200, 'sawtooth', t, 0.5, 0.15);
        this._osc(100, 'square', t + 0.1, 0.6, 0.12);
        this._noise(t + 0.2, 0.4, 0.1);
    }

    _playNodeActivate(t) {
        [300, 400, 500, 600, 800, 1000, 1200].forEach((f, i) => {
            this._osc(f, 'sine', t + i * 0.1, 0.5, 0.1);
        });
        this._osc(200, 'sine', t, 1.0, 0.08);
    }

    _playBuild(t) {
        this._osc(300, 'square', t, 0.05, 0.1);
        this._osc(400, 'square', t + 0.05, 0.05, 0.1);
        this._noise(t, 0.08, 0.06);
    }

    _playWhirlwind(t) {
        this._noise(t, 0.4, 0.2);
        for (let i = 0; i < 5; i++) {
            this._osc(250 + i * 50, 'sawtooth', t + i * 0.06, 0.15, 0.08);
        }
    }

    _playCombo(t) {
        this._osc(500, 'sawtooth', t, 0.12, 0.15);
        this._osc(700, 'sawtooth', t + 0.04, 0.1, 0.12);
        this._noise(t, 0.15, 0.15);
    }

    startAmbience() {
        if (!this.initialized || this.musicPlaying) return;
        this.musicPlaying = true;
        this._ambLoop();
    }

    _ambLoop() {
        if (!this.musicPlaying) return;
        const t = this.ctx.currentTime;
        const notes = [60, 63, 67, 70, 72, 75, 79];
        const base = UE.Utils.pick(notes);
        const freq = 440 * Math.pow(2, (base - 69) / 12);

        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.value = freq * 0.25;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.03, t + 1);
        g.gain.linearRampToValueAtTime(0, t + 4);
        o.connect(g);
        g.connect(this.masterGain);
        o.start(t);
        o.stop(t + 4);

        setTimeout(() => this._ambLoop(), 3000 + Math.random() * 4000);
    }
};

// ======================== CAMERA ========================
UE.Camera = class {
    constructor(canvas) {
        this.canvas = canvas;
        this.x = 0;
        this.y = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.hw = canvas.width / 2;
        this.hh = canvas.height / 2;
        this.shakeIntensity = 0;
        this.shakeX = 0;
        this.shakeY = 0;
    }

    resize() {
        this.hw = this.canvas.width / 2;
        this.hh = this.canvas.height / 2;
    }

    follow(x, y, dt) {
        this.targetX = x;
        this.targetY = y;
        const smooth = 1 - Math.pow(UE.Config.CAMERA_SMOOTH, dt);
        this.x = UE.Utils.lerp(this.x, this.targetX, smooth);
        this.y = UE.Utils.lerp(this.y, this.targetY, smooth);

        if (this.shakeIntensity > 0.1) {
            this.shakeX = (Math.random() - 0.5) * this.shakeIntensity;
            this.shakeY = (Math.random() - 0.5) * this.shakeIntensity;
            this.shakeIntensity *= 0.88;
        } else {
            this.shakeX = 0;
            this.shakeY = 0;
            this.shakeIntensity = 0;
        }
    }

    worldToScreen(wx, wy) {
        return {
            x: wx - this.x + this.hw + this.shakeX,
            y: wy - this.y + this.hh + this.shakeY
        };
    }

    screenToWorld(sx, sy) {
        return {
            x: sx + this.x - this.hw,
            y: sy + this.y - this.hh
        };
    }

    isVisible(wx, wy, margin) {
        margin = margin || 64;
        const sx = wx - this.x + this.hw;
        const sy = wy - this.y + this.hh;
        return sx > -margin && sx < this.canvas.width + margin &&
               sy > -margin && sy < this.canvas.height + margin;
    }

    getViewBounds(margin) {
        margin = margin || 0;
        return {
            left: this.x - this.hw - margin,
            right: this.x + this.hw + margin,
            top: this.y - this.hh - margin,
            bottom: this.y + this.hh + margin
        };
    }
};

// ======================== PARTICLE SYSTEM ========================
UE.Particle = class {
    constructor(x, y, vx, vy, life, color, size, opts) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.life = life;
        this.maxLife = life;
        this.color = color;
        this.size = size;
        this.gravity = (opts && opts.gravity) || 0;
        this.friction = (opts && opts.friction) || 0.98;
        this.shrink = (opts && opts.shrink !== undefined) ? opts.shrink : true;
        this.glow = (opts && opts.glow) || false;
        this.dead = false;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vy += this.gravity * dt;
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.life -= dt;
        if (this.life <= 0) this.dead = true;
    }

    draw(ctx, camera) {
        if (this.dead) return;
        const s = camera.worldToScreen(this.x, this.y);
        const t = this.life / this.maxLife;
        const sz = this.shrink ? this.size * t : this.size;
        const alpha = t;

        ctx.save();
        ctx.globalAlpha = alpha;
        if (this.glow) {
            ctx.shadowColor = this.color;
            ctx.shadowBlur = sz * 3;
        }
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, Math.max(0.5, sz), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
};

UE.ParticleSystem = class {
    constructor() {
        this.particles = [];
    }

    emit(x, y, count, opts) {
        for (let i = 0; i < count; i++) {
            const angle = opts.angle !== undefined ? opts.angle + (Math.random() - 0.5) * (opts.spread || Math.PI * 2) : Math.random() * Math.PI * 2;
            const speed = (opts.speedMin || 30) + Math.random() * ((opts.speedMax || 120) - (opts.speedMin || 30));
            const life = (opts.lifeMin || 0.2) + Math.random() * ((opts.lifeMax || 0.8) - (opts.lifeMin || 0.2));
            const size = (opts.sizeMin || 1) + Math.random() * ((opts.sizeMax || 4) - (opts.sizeMin || 1));
            const color = Array.isArray(opts.colors) ? UE.Utils.pick(opts.colors) : (opts.color || '#fff');
            this.particles.push(new UE.Particle(
                x + (Math.random() - 0.5) * (opts.offsetX || 0),
                y + (Math.random() - 0.5) * (opts.offsetY || 0),
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                life, color, size,
                { gravity: opts.gravity, friction: opts.friction, shrink: opts.shrink, glow: opts.glow }
            ));
        }
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(dt);
            if (this.particles[i].dead) this.particles.splice(i, 1);
        }
    }

    draw(ctx, camera) {
        for (const p of this.particles) p.draw(ctx, camera);
    }
};

// ======================== DAMAGE NUMBERS ========================
UE.DamageNumber = class {
    constructor(x, y, text, color) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color || '#fff';
        this.life = 0.8;
        this.maxLife = 0.8;
        this.vy = -60;
        this.dead = false;
    }

    update(dt) {
        this.y += this.vy * dt;
        this.vy *= 0.95;
        this.life -= dt;
        if (this.life <= 0) this.dead = true;
    }

    draw(ctx, camera) {
        if (this.dead) return;
        const s = camera.worldToScreen(this.x, this.y);
        const t = this.life / this.maxLife;
        ctx.save();
        ctx.globalAlpha = t;
        ctx.font = `bold ${12 + (1 - t) * 4}px 'Courier New'`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#000';
        ctx.fillText(this.text, s.x + 1, s.y + 1);
        ctx.fillStyle = this.color;
        ctx.fillText(this.text, s.x, s.y);
        ctx.restore();
    }
};

UE.DamageNumbers = class {
    constructor() { this.numbers = []; }
    add(x, y, text, color) {
        this.numbers.push(new UE.DamageNumber(x + (Math.random() - 0.5) * 10, y - 10, String(text), color));
    }
    update(dt) {
        for (let i = this.numbers.length - 1; i >= 0; i--) {
            this.numbers[i].update(dt);
            if (this.numbers[i].dead) this.numbers.splice(i, 1);
        }
    }
    draw(ctx, camera) {
        for (const n of this.numbers) n.draw(ctx, camera);
    }
};

// ======================== TRAIL RENDERER ========================
UE.Trail = class {
    constructor() {
        this.points = [];
        this.maxPoints = 12;
    }

    add(x, y, color) {
        this.points.push({ x, y, color, alpha: 1.0 });
        if (this.points.length > this.maxPoints) this.points.shift();
    }

    clear() { this.points = []; }

    update(dt) {
        for (const p of this.points) p.alpha -= dt * 4;
        this.points = this.points.filter(p => p.alpha > 0);
    }

    draw(ctx, camera) {
        for (let i = 1; i < this.points.length; i++) {
            const p0 = this.points[i - 1];
            const p1 = this.points[i];
            const s0 = camera.worldToScreen(p0.x, p0.y);
            const s1 = camera.worldToScreen(p1.x, p1.y);
            ctx.save();
            ctx.globalAlpha = p1.alpha * 0.6;
            ctx.strokeStyle = p1.color || '#fff';
            ctx.lineWidth = p1.alpha * 3;
            ctx.beginPath();
            ctx.moveTo(s0.x, s0.y);
            ctx.lineTo(s1.x, s1.y);
            ctx.stroke();
            ctx.restore();
        }
    }
};

console.log('[UE] Engine loaded.');
