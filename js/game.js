// ================================================================
// THE UNRAVELING EARTH - Main Game Loop, UI, Combat Resolution
// ================================================================

// ======================== GAME CLASS ========================
UE.Game = class {
    constructor() {
        // Canvas setup
        this.gameCanvas = document.getElementById('gameCanvas');
        this.uiCanvas = document.getElementById('uiCanvas');
        this.ctx = this.gameCanvas.getContext('2d');
        this.uiCtx = this.uiCanvas.getContext('2d');

        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Core systems
        this.input = new UE.InputManager();
        this.audio = new UE.AudioManager();
        this.particles = new UE.ParticleSystem();
        this.dmgNumbers = new UE.DamageNumbers();

        // Make globally accessible
        UE.audio = this.audio;
        UE.particles = this.particles;
        UE.dmgNumbers = this.dmgNumbers;
        UE.projectiles = [];

        // Game state
        this.state = 'menu'; // menu, playing, paused, inventory, character, dead, victory, archetype
        this.time = 0;
        this.playTime = 0;
        this.lastTime = 0;
        this.fps = 0;
        this.fpsTimer = 0;
        this.fpsCount = 0;

        // World
        this.world = null;
        this.staticFog = null;
        this.camera = null;
        this.player = null;
        this.spawner = null;

        // Combat tracking
        this.attackHitEnemies = new Set(); // Track which enemies were hit this attack
        this.lastAttackId = 0;

        // UI state
        this.selectedInventorySlot = 0;
        this.hoveredInventorySlot = -1;
        this.messages = [];
        this.messageTimer = 0;
        this.showMinimap = true;
        this.tooltipItem = null;

        // Menu state
        this.menuSelection = 0;
        this.menuItems = ['START GAME', 'CONTROLS'];
        this.showControls = false;
        this.menuStaticTimer = 0;
        this.menuStaticCanvas = document.createElement('canvas');
        this.menuStaticCanvas.width = 200;
        this.menuStaticCanvas.height = 200;
        this.menuStaticCtx = this.menuStaticCanvas.getContext('2d');

        // Archetype selection
        this.archetypeSelection = 0;
        this.archetypeShown = false;

        // Scroll offsets for menus
        this.inventoryScroll = 0;
        this.characterScroll = 0;

        // Victory
        this.victoryTimer = 0;

        // Turret tracking
        this.turretTargets = new Map();

        // Stats tracking
        this.stats = {
            enemiesKilled: 0,
            damageDealt: 0,
            nodesRepaired: 0,
            itemsCollected: 0,
            timesSurvived: 0
        };

        // Initialize
        this._initWorld();

        // Start loop
        this.lastTime = performance.now();
        this._loop = this._loop.bind(this);
        requestAnimationFrame(this._loop);

        // Hide loading
        setTimeout(() => {
            document.getElementById('loading').style.display = 'none';
        }, 500);
    }

    resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.gameCanvas.width = w;
        this.gameCanvas.height = h;
        this.uiCanvas.width = w;
        this.uiCanvas.height = h;
        if (this.camera) this.camera.resize();
    }

    _initWorld() {
        this.world = new UE.World();
        this.staticFog = new UE.StaticFog(this.world);
        this.camera = new UE.Camera(this.gameCanvas);
        UE.camera = this.camera;
        this.player = new UE.Player(this.world.spawnX, this.world.spawnY);
        this.camera.x = this.player.x;
        this.camera.y = this.player.y;
        this.spawner = new UE.EnemySpawner();
        UE.projectiles = [];
    }

    addMessage(text, color) {
        this.messages.push({ text, color: color || '#ccc', life: 4.0 });
        if (this.messages.length > 8) this.messages.shift();
    }

    // ======================== MAIN LOOP ========================
    _loop(timestamp) {
        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
        this.lastTime = timestamp;
        this.time += dt;

        // FPS counter
        this.fpsCount++;
        this.fpsTimer += dt;
        if (this.fpsTimer >= 1) {
            this.fps = this.fpsCount;
            this.fpsCount = 0;
            this.fpsTimer = 0;
        }

        // Update
        this._update(dt);

        // Render
        this._render(dt);

        // Input postUpdate
        this.input.postUpdate();

        requestAnimationFrame(this._loop);
    }

    // ======================== UPDATE ========================
    _update(dt) {
        switch (this.state) {
            case 'menu':
                this._updateMenu(dt);
                break;
            case 'playing':
                this._updatePlaying(dt);
                break;
            case 'paused':
                if (this.input.justPressed('Escape') || this.input.justPressed('KeyP')) {
                    this.state = 'playing';
                }
                break;
            case 'inventory':
                this._updateInventory(dt);
                break;
            case 'character':
                this._updateCharacter(dt);
                break;
            case 'dead':
                this._updateDead(dt);
                break;
            case 'victory':
                this.victoryTimer += dt;
                if (this.input.justPressed('Enter') || this.input.justPressed('Space')) {
                    this.state = 'menu';
                    this._initWorld();
                }
                break;
            case 'archetype':
                this._updateArchetype(dt);
                break;
        }
    }

    _updateMenu(dt) {
        this.menuStaticTimer += dt;

        if (this.showControls) {
            if (this.input.justPressed('Escape') || this.input.justPressed('Enter') || this.input.justPressed('Space')) {
                this.showControls = false;
            }
            return;
        }

        if (this.input.justPressed('ArrowUp') || this.input.justPressed('KeyW')) {
            this.menuSelection = (this.menuSelection - 1 + this.menuItems.length) % this.menuItems.length;
        }
        if (this.input.justPressed('ArrowDown') || this.input.justPressed('KeyS')) {
            this.menuSelection = (this.menuSelection + 1) % this.menuItems.length;
        }
        if (this.input.justPressed('Enter') || this.input.justPressed('Space')) {
            this.audio.init();
            this.audio.startAmbience();
            if (this.menuSelection === 0) {
                this.state = 'playing';
                this._initWorld();
                this.addMessage('You awaken in a fractured world. The Static consumes everything.', '#aaa');
                this.addMessage('Find and repair the Nodes to push it back.', '#fa0');
                this.addMessage('WASD to move, Click to attack, E to interact.', '#8af');
            } else if (this.menuSelection === 1) {
                this.showControls = true;
            }
        }
    }

    _updatePlaying(dt) {
        this.playTime += dt;

        // Pause
        if (this.input.justPressed('Escape') || this.input.justPressed('KeyP')) {
            this.state = 'paused';
            return;
        }

        // Inventory
        if (this.input.justPressed('KeyI') || this.input.justPressed('Tab')) {
            this.state = 'inventory';
            this.selectedInventorySlot = 0;
            return;
        }

        // Character screen
        if (this.input.justPressed('KeyC')) {
            this.state = 'character';
            return;
        }

        // Toggle minimap
        if (this.input.justPressed('KeyM')) {
            this.showMinimap = !this.showMinimap;
        }

        // Update player
        this.player.update(dt, this.input, this.camera, this.world, this.staticFog);

        // Check player death
        if (this.player.dead) {
            this.state = 'dead';
            this.stats.timesSurvived++;
            return;
        }

        // Archetype selection at level 5
        if (this.player.level >= 5 && this.player.archetype === 'none' && !this.archetypeShown) {
            this.state = 'archetype';
            this.archetypeSelection = 0;
            return;
        }

        // Update camera
        this.camera.follow(this.player.x, this.player.y, dt);

        // Update enemies
        this.spawner.update(dt, this.player, this.world, this.staticFog);

        // Combat resolution
        this._resolveCombat(dt);

        // Update turrets
        this._updateTurrets(dt);

        // Update projectiles
        UE.Projectile.updateAll(UE.projectiles, dt, this.player, this.spawner.enemies, this.world);

        // Update particles
        this.particles.update(dt);
        this.dmgNumbers.update(dt);

        // Update loot drop timers
        for (let i = this.world.lootDrops.length - 1; i >= 0; i--) {
            this.world.lootDrops[i].life -= dt;
            if (this.world.lootDrops[i].life <= 0) {
                this.world.lootDrops.splice(i, 1);
            }
        }

        // Update static fog noise
        this.staticFog.updateNoise(this.time);

        // Message cleanup
        for (let i = this.messages.length - 1; i >= 0; i--) {
            this.messages[i].life -= dt;
            if (this.messages[i].life <= 0) this.messages.splice(i, 1);
        }

        // Check victory - All sub-nodes activated
        const subNodes = this.world.nodes.filter(n => !n.isMain);
        const allSubActive = subNodes.length > 0 && subNodes.every(n => n.active);
        if (allSubActive) {
            this.state = 'victory';
            this.victoryTimer = 0;
        }
    }

    _resolveCombat(dt) {
        const player = this.player;
        const enemies = this.spawner.enemies;

        // Player attack hits
        if (player.isAttacking && player.attackProgress > 0.2 && player.attackProgress < 0.8) {
            const hitbox = player.getAttackHitbox();
            if (hitbox) {
                for (const enemy of enemies) {
                    if (enemy.dead) continue;
                    if (enemy.canPhase && enemy.isPhased) continue;
                    // Check if already hit this attack
                    const hitKey = `${this.lastAttackId}_${enemies.indexOf(enemy)}`;
                    if (this.attackHitEnemies.has(hitKey)) continue;

                    let hit = false;
                    if (hitbox.type === 'circle') {
                        hit = UE.Utils.dist(hitbox.x, hitbox.y, enemy.x, enemy.y) < hitbox.radius + enemy.radius;
                    } else if (hitbox.type === 'arc') {
                        hit = UE.Utils.pointInArc(enemy.x, enemy.y, hitbox.x, hitbox.y, hitbox.angle, hitbox.arc, hitbox.range + enemy.radius);
                    }

                    if (hit) {
                        this.attackHitEnemies.add(hitKey);
                        const atkType = player.attackType === 'heavy' ? 'heavyAttack' :
                                       (player.attackType === 'whirlwind' ? 'whirlwind' : 'lightAttack');
                        const { damage, isCrit } = player.getAttackDamage(atkType);
                        const actualDmg = enemy.takeDamage(damage, player.x, player.y);

                        this.stats.damageDealt += actualDmg;

                        // Damage number
                        const color = isCrit ? '#ffd700' : '#ff8';
                        const text = isCrit ? `${actualDmg}!` : String(actualDmg);
                        this.dmgNumbers.add(enemy.x, enemy.y, text, color);

                        // Hit particles
                        const hitAngle = UE.Utils.angle(player.x, player.y, enemy.x, enemy.y);
                        this.particles.emit(enemy.x, enemy.y, 8, {
                            angle: hitAngle,
                            spread: Math.PI * 0.5,
                            colors: [enemy.color, '#fff', '#ff8'],
                            speedMin: 50, speedMax: 150,
                            lifeMin: 0.15, lifeMax: 0.4,
                            sizeMin: 1, sizeMax: 3,
                            glow: true
                        });

                        // Screen shake
                        UE.Utils.screenShake(isCrit ? 8 : 4);

                        // Audio
                        if (UE.audio) UE.audio.play('enemyHit');

                        if (enemy.dead) {
                            this.stats.enemiesKilled++;
                        }
                    }
                }
            }
        }

        // New attack - reset hit tracking
        if (player.attackProgress <= 0.1) {
            if (player.isAttacking) {
                this.lastAttackId++;
                this.attackHitEnemies.clear();
            }
        }

        // Ranged weapon - shoot projectile
        if (player.weapon && player.weapon.range > 0 && player.isAttacking && player.attackProgress > 0.3 && player.attackProgress < 0.5) {
            const key = `ranged_${this.lastAttackId}`;
            if (!this.attackHitEnemies.has(key)) {
                this.attackHitEnemies.add(key);
                UE.projectiles.push({
                    x: player.x,
                    y: player.y,
                    vx: Math.cos(player.attackAngle) * 400,
                    vy: Math.sin(player.attackAngle) * 400,
                    damage: player.getAttackDamage('lightAttack').damage,
                    radius: 3,
                    life: 1.5,
                    color: '#ff8',
                    fromEnemy: false
                });
            }
        }

        // Enemy melee damage to player
        for (const enemy of enemies) {
            if (enemy.dead || player.dead || player.isDodging || player.invulnTimer > 0) continue;
            if (enemy.isRanged) continue;
            if (enemy.state !== 'attack' && enemy.state !== 'charge') continue;
            // Only deal damage in a brief window after attacking (last 20% of cooldown)
            if (enemy.attackTimer > enemy.attackCD * 0.2) continue;

            const dist = UE.Utils.dist(enemy.x, enemy.y, player.x, player.y);
            const range = enemy.state === 'charge' ? enemy.radius + player.radius + 10 : enemy.attackRange + player.radius;

            if (dist < range) {
                const dmg = enemy.damage - player.getDefense() * 0.3;
                const actualDmg = player.takeDamage(Math.max(1, dmg), enemy.x, enemy.y);
                if (actualDmg > 0) {
                    this.dmgNumbers.add(player.x, player.y, actualDmg, '#f44');
                    if (UE.audio) UE.audio.play('enemyHit');
                    UE.Utils.screenShake(6);
                    player.invulnTimer = 0.3; // Brief invulnerability after hit
                }
                if (player.hp <= 0) {
                    player.die();
                    this.state = 'dead';
                }
            }
        }

        // Enemies attack structures
        for (const enemy of enemies) {
            if (enemy.dead || enemy.isRanged) continue;
            for (let si = this.world.structures.length - 1; si >= 0; si--) {
                const s = this.world.structures[si];
                const dist = UE.Utils.dist(enemy.x, enemy.y, s.x, s.y);
                if (dist < enemy.radius + 20 && enemy.attackTimer <= 0) {
                    s.health -= enemy.damage * 0.3;
                    enemy.attackTimer = enemy.attackCD;
                    if (s.health <= 0) {
                        if (UE.particles) {
                            UE.particles.emit(s.x, s.y, 15, {
                                colors: ['#888', '#666', '#444'],
                                speedMin: 30, speedMax: 100,
                                lifeMin: 0.3, lifeMax: 0.8,
                                sizeMin: 2, sizeMax: 4
                            });
                        }
                        this.world.structures.splice(si, 1);
                    }
                    break;
                }
            }
        }
    }

    _updateTurrets(dt) {
        for (const structure of this.world.structures) {
            if (structure.type !== 'turret') continue;
            structure.fireTimer -= dt;
            if (structure.fireTimer > 0) continue;

            // Find closest enemy in range
            let closest = null, closestDist = UE.Config.TURRET_RANGE;
            for (const e of this.spawner.enemies) {
                if (e.dead) continue;
                const dist = UE.Utils.dist(structure.x, structure.y, e.x, e.y);
                if (dist < closestDist) {
                    closestDist = dist;
                    closest = e;
                }
            }

            if (closest) {
                structure.fireTimer = UE.Config.TURRET_FIRE_RATE;
                const angle = UE.Utils.angle(structure.x, structure.y, closest.x, closest.y);
                UE.projectiles.push({
                    x: structure.x,
                    y: structure.y,
                    vx: Math.cos(angle) * 350,
                    vy: Math.sin(angle) * 350,
                    damage: UE.Config.TURRET_DAMAGE,
                    radius: 3,
                    life: 1.0,
                    color: '#8f8',
                    fromEnemy: false
                });
            }
        }
    }

    _updateInventory(dt) {
        const inv = this.player.inventory;

        if (this.input.justPressed('Escape') || this.input.justPressed('KeyI') || this.input.justPressed('Tab')) {
            this.state = 'playing';
            this.inventoryScroll = 0;
            return;
        }

        if (this.input.justPressed('ArrowUp') || this.input.justPressed('KeyW')) {
            this.selectedInventorySlot = Math.max(0, this.selectedInventorySlot - 1);
        }
        if (this.input.justPressed('ArrowDown') || this.input.justPressed('KeyS')) {
            this.selectedInventorySlot = Math.min(inv.length - 1, this.selectedInventorySlot + 1);
        }
        // Scroll wheel navigation
        const scrollY = this.input.mouse.scrollY;
        if (scrollY < 0) {
            this.selectedInventorySlot = Math.max(0, this.selectedInventorySlot - 1);
        } else if (scrollY > 0) {
            this.selectedInventorySlot = Math.min(inv.length - 1, this.selectedInventorySlot + 1);
        }
        if (this.input.justPressed('Enter') || this.input.justPressed('KeyE')) {
            if (inv[this.selectedInventorySlot]) {
                this.player.equip(this.selectedInventorySlot);
                this.selectedInventorySlot = Math.min(this.selectedInventorySlot, inv.length - 1);
                if (UE.audio) UE.audio.play('pickup');
            }
        }
        // Drop item
        if (this.input.justPressed('KeyX')) {
            if (inv[this.selectedInventorySlot]) {
                const item = inv.splice(this.selectedInventorySlot, 1)[0];
                this.world.addLootDrop(this.player.x + (Math.random() - 0.5) * 20, this.player.y + 20, item);
                this.selectedInventorySlot = Math.min(this.selectedInventorySlot, inv.length - 1);
            }
        }
    }

    _updateCharacter(dt) {
        if (this.input.justPressed('Escape') || this.input.justPressed('KeyC')) {
            this.state = 'playing';
            this.characterScroll = 0;
            return;
        }

        // Scroll wheel for character panel
        const scrollY = this.input.mouse.scrollY;
        if (scrollY !== 0) {
            this.characterScroll += scrollY * 0.5;
        }

        // Spend stat points
        const p = this.player;
        if (p.statPoints > 0) {
            if (this.input.justPressed('Digit1')) { p.strength++; p.statPoints--; }
            if (this.input.justPressed('Digit2')) { p.agility++; p.statPoints--; }
            if (this.input.justPressed('Digit3')) { p.vitality++; p.statPoints--; p.maxHp += 5; p.hp += 5; }
            if (this.input.justPressed('Digit4')) { p.luck++; p.statPoints--; }
            if (this.input.justPressed('Digit5')) { p.weight++; p.statPoints--; }
        }
    }

    _updateDead(dt) {
        this.player.deathTimer += dt;
        this.player.respawnTimer -= dt;

        // Update particles even when dead
        this.particles.update(dt);
        this.dmgNumbers.update(dt);

        if (this.player.respawnTimer <= 0 && (this.input.justPressed('Enter') || this.input.justPressed('Space'))) {
            this.player.respawn(this.world);
            this.camera.x = this.player.x;
            this.camera.y = this.player.y;
            this.state = 'playing';
            this.addMessage('You reformed near the Node. The Static gives and takes.', '#aaa');
        }
    }

    _updateArchetype(dt) {
        if (this.input.justPressed('ArrowUp') || this.input.justPressed('KeyW')) {
            this.archetypeSelection = (this.archetypeSelection - 1 + 3) % 3;
        }
        if (this.input.justPressed('ArrowDown') || this.input.justPressed('KeyS')) {
            this.archetypeSelection = (this.archetypeSelection + 1) % 3;
        }
        if (this.input.justPressed('Enter') || this.input.justPressed('Space')) {
            const archetypes = ['guild', 'soloist', 'static'];
            this.player.archetype = archetypes[this.archetypeSelection];
            this.archetypeShown = true;
            this.state = 'playing';

            // Apply archetype bonuses
            switch (this.player.archetype) {
                case 'guild':
                    this.player.maxHp += 30;
                    this.player.hp += 30;
                    this.player.weight += 5;
                    this.addMessage('You chose THE GUILD PATH. +30 HP, +5 Weight. Build and defend.', '#4a4');
                    break;
                case 'soloist':
                    this.player.strength += 5;
                    this.player.agility += 3;
                    this.addMessage('You chose THE SOLOIST PATH. +5 STR, +3 AGI. Destroy everything.', '#ca4');
                    break;
                case 'static':
                    this.player.weight -= 3;
                    this.player.luck += 5;
                    this.player.speed *= 1.15;
                    this.addMessage('You chose THE STATIC PATH. +15% Speed, +5 Luck, -3 Weight. Embrace the noise.', '#a4f');
                    break;
            }
        }
    }

    // ======================== RENDER ========================
    _render(dt) {
        const ctx = this.ctx;
        const uiCtx = this.uiCtx;
        const w = this.gameCanvas.width;
        const h = this.gameCanvas.height;

        // Clear
        ctx.fillStyle = '#0a0a0e';
        ctx.fillRect(0, 0, w, h);
        uiCtx.clearRect(0, 0, w, h);

        switch (this.state) {
            case 'menu':
                this._renderMenu(ctx, w, h);
                break;
            case 'playing':
            case 'paused':
            case 'inventory':
            case 'character':
            case 'archetype':
                this._renderGame(ctx, w, h);
                this._renderUI(uiCtx, w, h);
                if (this.state === 'paused') this._renderPause(uiCtx, w, h);
                if (this.state === 'inventory') this._renderInventory(uiCtx, w, h);
                if (this.state === 'character') this._renderCharacter(uiCtx, w, h);
                if (this.state === 'archetype') this._renderArchetype(uiCtx, w, h);
                break;
            case 'dead':
                this._renderGame(ctx, w, h);
                this._renderDeathScreen(uiCtx, w, h);
                break;
            case 'victory':
                this._renderGame(ctx, w, h);
                this._renderVictory(uiCtx, w, h);
                break;
        }
    }

    _renderMenu(ctx, w, h) {
        // Animated static background
        this._drawMenuStatic(ctx, w, h);

        // Title
        ctx.save();
        ctx.textAlign = 'center';

        // Title glow
        const pulse = Math.sin(this.time * 1.5) * 0.3 + 0.7;
        ctx.shadowColor = '#666';
        ctx.shadowBlur = 20 * pulse;

        ctx.font = 'bold 48px Courier New';
        ctx.fillStyle = `rgba(200, 200, 210, ${pulse})`;
        ctx.fillText('THE UNRAVELING', w / 2, h * 0.25);
        ctx.font = 'bold 60px Courier New';
        ctx.fillStyle = '#ddd';
        ctx.fillText('EARTH', w / 2, h * 0.25 + 60);

        ctx.shadowBlur = 0;

        // Subtitle
        ctx.font = '14px Courier New';
        ctx.fillStyle = '#666';
        ctx.fillText('Reality is dissolving. The Static consumes.', w / 2, h * 0.25 + 95);
        ctx.fillText('Only the Nodes can save what remains.', w / 2, h * 0.25 + 115);

        if (this.showControls) {
            this._renderControls(ctx, w, h);
        } else {
            // Menu items
            ctx.font = '20px Courier New';
            for (let i = 0; i < this.menuItems.length; i++) {
                const y = h * 0.55 + i * 45;
                const selected = i === this.menuSelection;
                ctx.fillStyle = selected ? '#fff' : '#666';
                if (selected) {
                    ctx.shadowColor = '#888';
                    ctx.shadowBlur = 10;
                    ctx.fillText('> ' + this.menuItems[i] + ' <', w / 2, y);
                    ctx.shadowBlur = 0;
                } else {
                    ctx.fillText(this.menuItems[i], w / 2, y);
                }
            }

            ctx.font = '12px Courier New';
            ctx.fillStyle = '#444';
            ctx.fillText('Use W/S or Arrow Keys to select, Enter to confirm', w / 2, h * 0.85);
        }

        ctx.restore();
    }

    _drawMenuStatic(ctx, w, h) {
        // Use small noise tile and repeat for performance
        const mctx = this.menuStaticCtx;
        const mw = this.menuStaticCanvas.width;
        const mh = this.menuStaticCanvas.height;
        const imgData = mctx.createImageData(mw, mh);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
            if (Math.random() < 0.12) {
                const v = Math.random() * 60 + 10;
                data[i] = v; data[i+1] = v; data[i+2] = v + 5; data[i+3] = 160;
            }
        }
        mctx.putImageData(imgData, 0, 0);
        ctx.save();
        ctx.globalAlpha = 0.6;
        for (let ty = 0; ty < h; ty += mh) {
            for (let tx = 0; tx < w; tx += mw) {
                ctx.drawImage(this.menuStaticCanvas, tx, ty);
            }
        }
        ctx.restore();
    }

    _renderControls(ctx, w, h) {
        const cx = w / 2;

        const controls = [
            ['W/A/S/D', 'Move'],
            ['Mouse', 'Aim'],
            ['Left Click', 'Light Attack'],
            ['Shift + Click', 'Heavy Attack'],
            ['Space', 'Dodge Roll'],
            ['Q', 'Whirlwind Attack'],
            ['E', 'Interact / Repair Node'],
            ['I / Tab', 'Inventory'],
            ['C', 'Character Stats'],
            ['B', 'Build Mode (1/2/3 to select)'],
            ['Right Click', 'Place Structure (in Build Mode)'],
            ['M', 'Toggle Minimap'],
            ['Esc / P', 'Pause'],
        ];

        const contentH = 30 + controls.length * 22 + 40;
        const startY = Math.max(40, (h - contentH) / 2);

        // Clip if needed
        ctx.save();
        if (contentH > h - 20) {
            ctx.beginPath();
            ctx.rect(0, 10, w, h - 20);
            ctx.clip();
        }

        ctx.font = 'bold 18px Courier New';
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'center';
        ctx.fillText('CONTROLS', cx, startY);

        ctx.font = '13px Courier New';
        for (let i = 0; i < controls.length; i++) {
            const y = startY + 30 + i * 22;
            ctx.fillStyle = '#888';
            ctx.textAlign = 'right';
            ctx.fillText(controls[i][0], cx - 10, y);
            ctx.fillStyle = '#aaa';
            ctx.textAlign = 'left';
            ctx.fillText(controls[i][1], cx + 10, y);
        }

        ctx.textAlign = 'center';
        ctx.font = '12px Courier New';
        ctx.fillStyle = '#555';
        ctx.fillText('Press Escape to go back', cx, startY + 30 + controls.length * 22 + 20);
        ctx.restore();
    }

    _renderGame(ctx, w, h) {
        const cam = this.camera;

        // Draw world tiles
        this.world.drawTiles(ctx, cam);

        // Draw decorations
        this.world.drawDecorations(ctx, cam);

        // Draw structures
        this.world.drawStructures(ctx, cam, this.time);

        // Draw loot drops
        this.world.drawLootDrops(ctx, cam, this.time);

        // Draw nodes
        this.world.drawNodes(ctx, cam, this.time);

        // Draw enemies
        this.spawner.draw(ctx, cam, this.time);

        // Draw projectiles
        UE.Projectile.drawAll(UE.projectiles, ctx, cam);

        // Draw player
        this.player.draw(ctx, cam, this.time);

        // Draw particles
        this.particles.draw(ctx, cam);

        // Draw damage numbers
        this.dmgNumbers.draw(ctx, cam);

        // Draw Static Fog (on top of everything)
        this.staticFog.draw(ctx, cam);

        // Build mode cursor
        if (this.player.buildMode && this.state === 'playing') {
            this._renderBuildCursor(ctx, cam);
        }
    }

    _renderBuildCursor(ctx, cam) {
        const TS = UE.Config.TILE_SIZE;
        const mx = this.input.mouse.worldX;
        const my = this.input.mouse.worldY;
        const t = UE.Utils.worldToTile(mx, my);
        const s = cam.worldToScreen(t.tx * TS, t.ty * TS);

        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = '#0f0';
        ctx.lineWidth = 2;
        ctx.strokeRect(s.x, s.y, TS, TS);

        // Show what you're building
        ctx.fillStyle = '#0f0';
        ctx.font = '10px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText(this.player.buildType.toUpperCase(), s.x + TS / 2, s.y - 5);
        ctx.restore();
    }

    // ======================== UI RENDERING ========================
    _renderUI(ctx, w, h) {
        const p = this.player;
        ctx.save();

        // Health bar
        this._drawBar(ctx, 20, h - 60, 200, 18, p.hp, p.maxHp, '#c44', '#400', `HP: ${Math.ceil(p.hp)}/${p.maxHp}`);

        // Stamina bar
        this._drawBar(ctx, 20, h - 36, 200, 14, p.stamina, p.maxStamina, '#4a4', '#142', `STA: ${Math.ceil(p.stamina)}/${p.maxStamina}`);

        // XP bar
        this._drawBar(ctx, 20, h - 18, 200, 10, p.xp, p.xpToNext, '#44a', '#124', `XP: ${p.xp}/${p.xpToNext}`);

        // Level
        ctx.font = 'bold 16px Courier New';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffd700';
        ctx.fillText(`Lv.${p.level}`, 20, h - 70);

        // Archetype
        if (p.archetype !== 'none') {
            const arcColors = { guild: '#4a4', soloist: '#ca4', static: '#a4f' };
            ctx.font = '12px Courier New';
            ctx.fillStyle = arcColors[p.archetype] || '#888';
            ctx.fillText(p.archetype.toUpperCase(), 70, h - 70);
        }

        // Weapon info
        if (p.weapon) {
            ctx.font = '12px Courier New';
            ctx.fillStyle = UE.RarityColors[p.weapon.rarity];
            ctx.fillText(`⚔ ${p.weapon.name} (${p.weapon.damage} DMG)`, 240, h - 55);
        }

        // Armor info
        if (p.armor) {
            ctx.font = '11px Courier New';
            ctx.fillStyle = UE.RarityColors[p.armor.rarity];
            ctx.fillText(`🛡 ${p.armor.name} (${p.armor.defense} DEF)`, 240, h - 38);
        }

        // Relic info
        if (p.relic) {
            ctx.font = '11px Courier New';
            ctx.fillStyle = UE.RarityColors[p.relic.rarity];
            ctx.fillText(`✦ ${p.relic.name}`, 240, h - 22);
        }

        // Resources (top-left)
        ctx.font = '13px Courier New';
        ctx.fillStyle = '#aaa';
        ctx.fillText(`Scrap: ${p.scrap}`, 20, 25);
        ctx.fillText(`Fuel: ${p.fuel}`, 120, 25);
        ctx.fillText(`W.Ore: ${p.weightedOre}`, 200, 25);

        // Stat points notification
        if (p.statPoints > 0) {
            ctx.fillStyle = '#ffd700';
            ctx.fillText(`★ ${p.statPoints} Stat Points [C]`, 20, 45);
        }

        // Combo counter
        if (p.comboCount > 0 && p.comboTimer > 0) {
            ctx.font = `bold ${16 + p.comboCount * 2}px Courier New`;
            ctx.textAlign = 'center';
            ctx.fillStyle = p.comboCount >= UE.Config.COMBO_MAX ? '#ffa500' : '#ff8';
            ctx.globalAlpha = Math.min(1, p.comboTimer * 2);
            ctx.fillText(`${p.comboCount}x COMBO`, w / 2, h * 0.4);
            ctx.globalAlpha = 1;
        }

        // Cooldowns
        if (p.whirlwindCooldown > 0) {
            ctx.font = '11px Courier New';
            ctx.textAlign = 'left';
            ctx.fillStyle = '#666';
            ctx.fillText(`Q: ${p.whirlwindCooldown.toFixed(1)}s`, 20, h - 85);
        } else {
            ctx.font = '11px Courier New';
            ctx.textAlign = 'left';
            ctx.fillStyle = '#8af';
            ctx.fillText(`Q: WHIRLWIND`, 20, h - 85);
        }

        // Build mode indicator
        if (p.buildMode) {
            ctx.font = 'bold 14px Courier New';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#0f0';
            ctx.fillText('BUILD MODE', w / 2, 30);
            ctx.font = '11px Courier New';
            ctx.fillStyle = '#0a0';
            ctx.fillText(`[1] Wall (${UE.Config.BUILD_WALL_COST}) [2] Turret (${UE.Config.BUILD_TURRET_COST}) [3] Generator (${UE.Config.BUILD_GENERATOR_COST}) | Right-Click to place | B to exit`, w / 2, 48);
        }

        // Node repair hint (sub-nodes only, main node is always active)
        for (const node of this.world.nodes) {
            if (node.active) continue;
            const dist = UE.Utils.dist(p.x, p.y, node.x, node.y);
            if (dist < 80) {
                ctx.font = '12px Courier New';
                ctx.textAlign = 'center';
                ctx.fillStyle = '#fa0';
                ctx.fillText(`[E] Repair Node (${UE.Config.NODE_FUEL_COST} Fuel + 5 Scrap)`, w / 2, h * 0.3);
                break;
            }
        }

        // Main node proximity hint
        {
            const mainNode = this.world.nodes.find(n => n.isMain);
            if (mainNode) {
                const dist = UE.Utils.dist(p.x, p.y, mainNode.x, mainNode.y);
                if (dist < 80) {
                    const activeSubNodes = this.world.nodes.filter(n => !n.isMain && n.active).length;
                    const totalSubNodes = this.world.nodes.filter(n => !n.isMain).length;
                    ctx.font = '12px Courier New';
                    ctx.textAlign = 'center';
                    ctx.fillStyle = '#fa0';
                    ctx.fillText(`MAIN NODE [Active] - The last stand against the Static`, w / 2, h * 0.3);
                    ctx.fillText(`Sub-nodes activated: ${activeSubNodes}/${totalSubNodes}`, w / 2, h * 0.3 + 18);
                }
            }
        }

        // Objective tracker (top-right, below minimap)
        {
            const subNodes = this.world.nodes.filter(n => !n.isMain);
            const activeCount = subNodes.filter(n => n.active).length;
            const ox = w - UE.Config.MINIMAP_SIZE - 15;
            const oy = this.showMinimap ? UE.Config.MINIMAP_SIZE + 30 : 20;
            ctx.font = 'bold 11px Courier New';
            ctx.textAlign = 'left';
            ctx.fillStyle = '#888';
            ctx.fillText('OBJECTIVE', ox, oy);
            ctx.font = '11px Courier New';
            ctx.fillStyle = activeCount >= subNodes.length ? '#ffd700' : '#aaa';
            ctx.fillText(`Activate all sub-nodes: ${activeCount}/${subNodes.length}`, ox, oy + 16);
        }

        // Messages
        ctx.textAlign = 'left';
        for (let i = 0; i < this.messages.length; i++) {
            const msg = this.messages[i];
            ctx.globalAlpha = Math.min(1, msg.life);
            ctx.font = '12px Courier New';
            ctx.fillStyle = '#000';
            ctx.fillText(msg.text, 21, 75 + i * 18);
            ctx.fillStyle = msg.color;
            ctx.fillText(msg.text, 20, 74 + i * 18);
        }
        ctx.globalAlpha = 1;

        // Minimap
        if (this.showMinimap) {
            this._renderMinimap(ctx, w, h);
        }

        // FPS
        ctx.font = '10px Courier New';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#444';
        ctx.fillText(`${this.fps} FPS`, w - 10, h - 10);

        ctx.restore();
    }

    _drawBar(ctx, x, y, w, h, value, max, color, bgColor, text) {
        const pct = UE.Utils.clamp(value / max, 0, 1);
        ctx.fillStyle = bgColor;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w * pct, h);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.strokeRect(x, y, w, h);
        if (text) {
            ctx.font = `${Math.min(h - 2, 11)}px Courier New`;
            ctx.textAlign = 'center';
            ctx.fillStyle = '#fff';
            ctx.fillText(text, x + w / 2, y + h - 3);
        }
    }

    _renderMinimap(ctx, w, h) {
        const size = UE.Config.MINIMAP_SIZE;
        const mx = w - size - 15;
        const my = 15;
        const scale = size / this.world.w;

        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = '#111';
        ctx.fillRect(mx, my, size, size);
        ctx.strokeStyle = '#333';
        ctx.strokeRect(mx, my, size, size);

        // Draw tiles (very simplified)
        const step = Math.max(1, Math.floor(2 / scale));
        for (let ty = 0; ty < this.world.h; ty += step) {
            for (let tx = 0; tx < this.world.w; tx += step) {
                const tile = this.world.tiles[ty * this.world.w + tx];
                const cov = this.staticFog.coverage[ty * this.world.w + tx];

                let color;
                if (this.player.relic && this.player.relic.effect === 'reveal_map') {
                    // Reveal all
                    const tileColors = { 0: '#1a3a4a', 1: '#8a7a5a', 2: '#2a4a2a', 3: '#1a3a1a', 4: '#5a4a3a', 5: '#5a5a5a', 6: '#4a4a4e', 7: '#5a5a56', 8: '#111' };
                    color = tileColors[tile] || '#111';
                } else if (cov > 0.7) {
                    color = '#222';
                } else if (cov > 0.3) {
                    color = '#333';
                } else {
                    const tileColors = { 0: '#1a3a4a', 1: '#8a7a5a', 2: '#2a4a2a', 3: '#1a3a1a', 4: '#5a4a3a', 5: '#5a5a5a', 6: '#4a4a4e', 7: '#5a5a56', 8: '#111' };
                    color = tileColors[tile] || '#111';
                }

                ctx.fillStyle = color;
                ctx.fillRect(mx + tx * scale, my + ty * scale, Math.max(1, step * scale), Math.max(1, step * scale));
            }
        }

        // Draw nodes
        for (const node of this.world.nodes) {
            const nx = mx + (node.x / (this.world.w * UE.Config.TILE_SIZE)) * size;
            const ny = my + (node.y / (this.world.h * UE.Config.TILE_SIZE)) * size;
            ctx.fillStyle = node.active ? '#ffd700' : '#666';
            const ns = node.isMain ? 4 : 2;
            ctx.fillRect(nx - ns, ny - ns, ns * 2, ns * 2);
        }

        // Draw player
        const px = mx + (this.player.x / (this.world.w * UE.Config.TILE_SIZE)) * size;
        const py = my + (this.player.y / (this.world.h * UE.Config.TILE_SIZE)) * size;
        ctx.fillStyle = '#4af';
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();

        // Camera bounds
        const bounds = this.camera.getViewBounds();
        const bx = mx + (bounds.left / (this.world.w * UE.Config.TILE_SIZE)) * size;
        const by = my + (bounds.top / (this.world.h * UE.Config.TILE_SIZE)) * size;
        const bw = ((bounds.right - bounds.left) / (this.world.w * UE.Config.TILE_SIZE)) * size;
        const bh = ((bounds.bottom - bounds.top) / (this.world.h * UE.Config.TILE_SIZE)) * size;
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, bw, bh);

        ctx.restore();
    }

    _renderPause(ctx, w, h) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, w, h);
        ctx.textAlign = 'center';
        ctx.font = 'bold 36px Courier New';
        ctx.fillStyle = '#aaa';
        ctx.fillText('PAUSED', w / 2, h / 2 - 20);
        ctx.font = '14px Courier New';
        ctx.fillStyle = '#666';
        ctx.fillText('Press Esc or P to resume', w / 2, h / 2 + 20);

        // Play time
        const mins = Math.floor(this.playTime / 60);
        const secs = Math.floor(this.playTime % 60);
        ctx.fillText(`Time: ${mins}:${secs.toString().padStart(2, '0')}`, w / 2, h / 2 + 50);
        ctx.fillText(`Enemies Killed: ${this.stats.enemiesKilled}`, w / 2, h / 2 + 70);
        ctx.fillText(`Damage Dealt: ${this.stats.damageDealt}`, w / 2, h / 2 + 90);
        ctx.restore();
    }

    _renderInventory(ctx, w, h) {
        const p = this.player;
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(0, 0, w, h);

        const panelW = 500;
        const panelH = Math.min(500, h - 40);
        const px = (w - panelW) / 2;
        const py = (h - panelH) / 2;

        ctx.fillStyle = '#1a1a1e';
        ctx.fillRect(px, py, panelW, panelH);
        ctx.strokeStyle = '#333';
        ctx.strokeRect(px, py, panelW, panelH);

        // Title (outside scroll region)
        ctx.font = 'bold 18px Courier New';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#aaa';
        ctx.fillText('INVENTORY', w / 2, py + 25);

        // Controls footer (outside scroll region)
        ctx.font = '11px Courier New';
        ctx.fillStyle = '#555';
        ctx.fillText('W/S/Scroll: Navigate | Enter/E: Equip | X: Drop | I/Tab/Esc: Close', w / 2, py + panelH - 10);

        // Scrollable content area
        const clipTop = py + 38;
        const clipBottom = py + panelH - 25;
        const clipH = clipBottom - clipTop;

        // Compute total content height
        const equipH = 15 + 3 * 22 + 15; // header + 3 items + gap
        const itemsHeaderH = 22;
        const itemsH = Math.max(1, p.inventory.length) * 22;
        const detailH = 60;
        const totalContentH = equipH + itemsHeaderH + itemsH + 10 + detailH;
        const maxScroll = Math.max(0, totalContentH - clipH);

        // Auto-scroll to keep selected item visible
        const selectedItemTop = equipH + itemsHeaderH + this.selectedInventorySlot * 22;
        const selectedItemBot = selectedItemTop + 22;
        if (selectedItemTop - this.inventoryScroll < 0) {
            this.inventoryScroll = selectedItemTop;
        } else if (selectedItemBot - this.inventoryScroll > clipH - detailH) {
            this.inventoryScroll = selectedItemBot - clipH + detailH;
        }
        this.inventoryScroll = Math.max(0, Math.min(maxScroll, this.inventoryScroll));

        // Clip the scrollable region
        ctx.save();
        ctx.beginPath();
        ctx.rect(px, clipTop, panelW, clipH);
        ctx.clip();

        const scrollOff = -this.inventoryScroll;
        let cy = clipTop + 15 + scrollOff;

        // Equipment section
        ctx.textAlign = 'left';
        ctx.font = 'bold 13px Courier New';
        ctx.fillStyle = '#888';
        ctx.fillText('EQUIPPED:', px + 15, cy);
        cy += 18;

        const equipItems = [
            { label: 'Weapon', item: p.weapon },
            { label: 'Armor', item: p.armor },
            { label: 'Relic', item: p.relic }
        ];
        for (let i = 0; i < equipItems.length; i++) {
            const ei = equipItems[i];
            ctx.font = '12px Courier New';
            ctx.fillStyle = '#666';
            ctx.fillText(`${ei.label}: `, px + 20, cy);
            if (ei.item) {
                ctx.fillStyle = UE.RarityColors[ei.item.rarity];
                ctx.fillText(ei.item.name, px + 90, cy);
            } else {
                ctx.fillStyle = '#444';
                ctx.fillText('(empty)', px + 90, cy);
            }
            cy += 22;
        }
        cy += 15;

        // Inventory items
        ctx.font = 'bold 13px Courier New';
        ctx.fillStyle = '#888';
        ctx.fillText(`ITEMS (${p.inventory.length}/${p.maxInventory}):`, px + 15, cy);
        cy += 22;

        if (p.inventory.length === 0) {
            ctx.font = '12px Courier New';
            ctx.fillStyle = '#444';
            ctx.fillText('(empty)', px + 20, cy);
            cy += 22;
        }

        for (let i = 0; i < p.inventory.length; i++) {
            const iy = cy + i * 22;
            const item = p.inventory[i];
            const selected = i === this.selectedInventorySlot;

            if (selected) {
                ctx.fillStyle = '#2a2a30';
                ctx.fillRect(px + 10, iy - 14, panelW - 20, 20);
            }

            ctx.font = '12px Courier New';
            ctx.fillStyle = selected ? '#fff' : '#888';
            ctx.fillText(selected ? '>' : ' ', px + 15, iy);
            ctx.fillStyle = UE.RarityColors[item.rarity || 0];
            ctx.fillText(item.name, px + 30, iy);

            if (item.type === 'weapon') {
                ctx.fillStyle = '#888';
                ctx.fillText(`DMG: ${item.damage}`, px + 280, iy);
            } else if (item.type === 'armor') {
                ctx.fillStyle = '#888';
                ctx.fillText(`DEF: ${item.defense}`, px + 280, iy);
            } else if (item.type === 'relic') {
                ctx.fillStyle = '#888';
                const desc = item.desc || '';
                ctx.fillText(desc.length > 28 ? desc.substring(0, 26) + '..' : desc, px + 280, iy);
            } else if (item.type === 'resource') {
                ctx.fillStyle = '#888';
                ctx.fillText(`x${item.amount}`, px + 280, iy);
            }
        }
        cy += p.inventory.length * 22 + 10;

        // Selected item details
        if (p.inventory[this.selectedInventorySlot]) {
            const item = p.inventory[this.selectedInventorySlot];
            ctx.fillStyle = '#222';
            ctx.fillRect(px + 10, cy - 5, panelW - 20, 50);
            ctx.font = '12px Courier New';
            ctx.fillStyle = UE.RarityColors[item.rarity || 0];
            ctx.fillText(`[${UE.RarityNames[item.rarity || 0]}] ${item.name}`, px + 15, cy + 10);
            ctx.fillStyle = '#aaa';
            const desc = item.desc || '';
            ctx.fillText(desc.length > 55 ? desc.substring(0, 53) + '..' : desc, px + 15, cy + 28);
        }

        ctx.restore(); // end clip

        // Scroll indicators
        if (this.inventoryScroll > 0) {
            ctx.fillStyle = '#666';
            ctx.font = '10px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText('▲ scroll up ▲', w / 2, clipTop + 10);
        }
        if (this.inventoryScroll < maxScroll - 1) {
            ctx.fillStyle = '#666';
            ctx.font = '10px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText('▼ scroll down ▼', w / 2, clipBottom - 3);
        }

        ctx.restore();
    }

    _renderCharacter(ctx, w, h) {
        const p = this.player;
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(0, 0, w, h);

        const panelW = 420;
        const panelH = Math.min(460, h - 40);
        const px = (w - panelW) / 2;
        const py = (h - panelH) / 2;

        ctx.fillStyle = '#1a1a1e';
        ctx.fillRect(px, py, panelW, panelH);
        ctx.strokeStyle = '#333';
        ctx.strokeRect(px, py, panelW, panelH);

        // Title (outside scroll)
        ctx.font = 'bold 18px Courier New';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#aaa';
        ctx.fillText('CHARACTER', w / 2, py + 25);

        // Footer (outside scroll)
        ctx.font = '11px Courier New';
        ctx.fillStyle = '#555';
        ctx.fillText('Number keys: spend points | Scroll: navigate | C/Esc: close', w / 2, py + panelH - 10);

        // Scrollable content
        const clipTop = py + 38;
        const clipBottom = py + panelH - 25;
        const clipH = clipBottom - clipTop;

        // Compute total content height
        const totalContentH = 5 * 22 + 10 + 22 + 5 * 22 + 10 + 22 + 4 * 18 + 10 + 22 + 5 * 18 + 20;
        const maxScroll = Math.max(0, totalContentH - clipH);
        this.characterScroll = Math.max(0, Math.min(maxScroll, this.characterScroll));

        ctx.save();
        ctx.beginPath();
        ctx.rect(px, clipTop, panelW, clipH);
        ctx.clip();

        let y = clipTop + 15 - this.characterScroll;
        ctx.textAlign = 'left';

        const line = (label, value, color) => {
            ctx.font = '13px Courier New';
            ctx.fillStyle = '#888';
            ctx.fillText(label, px + 20, y);
            ctx.fillStyle = color || '#ccc';
            ctx.fillText(String(value), px + 200, y);
            y += 22;
        };

        line('Level', p.level, '#ffd700');
        line('Archetype', p.archetype === 'none' ? 'Undecided' : p.archetype.toUpperCase(),
             p.archetype === 'guild' ? '#4a4' : p.archetype === 'soloist' ? '#ca4' : p.archetype === 'static' ? '#a4f' : '#888');
        line('HP', `${Math.ceil(p.hp)} / ${p.maxHp}`, '#f44');
        line('Stamina', `${Math.ceil(p.stamina)} / ${p.maxStamina}`, '#4a4');
        line('Weight', p.weight, '#aaa');

        y += 10;
        ctx.font = 'bold 13px Courier New';
        ctx.fillStyle = '#888';
        ctx.fillText('--- STATS ---', px + 20, y);
        if (p.statPoints > 0) {
            ctx.fillStyle = '#ffd700';
            ctx.fillText(`(${p.statPoints} points to spend)`, px + 160, y);
        }
        y += 22;

        const statLine = (key, label, value) => {
            ctx.font = '13px Courier New';
            ctx.fillStyle = p.statPoints > 0 ? '#ccc' : '#888';
            ctx.fillText(`[${key}] ${label}`, px + 20, y);
            ctx.fillStyle = '#fff';
            ctx.fillText(String(value), px + 200, y);
            y += 22;
        };

        statLine('1', 'Strength', p.strength);
        statLine('2', 'Agility', p.agility);
        statLine('3', 'Vitality', p.vitality);
        statLine('4', 'Luck', p.luck);
        statLine('5', 'Weight', p.weight);

        y += 10;
        ctx.font = 'bold 13px Courier New';
        ctx.fillStyle = '#888';
        ctx.fillText('--- MUSCLE MEMORY ---', px + 20, y);
        y += 22;

        const mmLine = (label, value) => {
            ctx.font = '12px Courier New';
            ctx.fillStyle = '#888';
            ctx.fillText(label, px + 20, y);
            const barX = px + 160;
            const barW = 150;
            const pct = value / p.muscleMemoryMax;
            ctx.fillStyle = '#222';
            ctx.fillRect(barX, y - 10, barW, 12);
            ctx.fillStyle = '#4a8';
            ctx.fillRect(barX, y - 10, barW * pct, 12);
            ctx.fillStyle = '#aaa';
            ctx.font = '10px Courier New';
            ctx.fillText(`${Math.round(value)}/${p.muscleMemoryMax}`, barX + barW + 5, y);
            y += 18;
        };

        mmLine('Light Attack', p.muscleMemory.lightAttack);
        mmLine('Heavy Attack', p.muscleMemory.heavyAttack);
        mmLine('Dodge', p.muscleMemory.dodge);
        mmLine('Whirlwind', p.muscleMemory.whirlwind);

        y += 10;
        ctx.font = 'bold 13px Courier New';
        ctx.fillStyle = '#888';
        ctx.fillText('--- DERIVED ---', px + 20, y);
        y += 22;

        ctx.font = '12px Courier New';
        const derived = [
            ['Attack Damage', Math.round(p.getWeaponDamage() + p.strength * 0.5)],
            ['Attack Speed', p.getAttackSpeed().toFixed(2) + 'x'],
            ['Defense', Math.round(p.getDefense())],
            ['Static Resist', Math.round(p.getStaticResist() * 100) + '%'],
            ['Move Speed', Math.round(p.speed * (1 + p.agility * 0.005))],
        ];
        for (const [label, value] of derived) {
            ctx.fillStyle = '#888';
            ctx.fillText(label, px + 20, y);
            ctx.fillStyle = '#ccc';
            ctx.fillText(String(value), px + 200, y);
            y += 18;
        }

        ctx.restore(); // end clip

        // Scroll indicators
        if (this.characterScroll > 0) {
            ctx.fillStyle = '#666';
            ctx.font = '10px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText('▲ scroll up ▲', w / 2, clipTop + 10);
        }
        if (this.characterScroll < maxScroll - 1) {
            ctx.fillStyle = '#666';
            ctx.font = '10px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText('▼ scroll down ▼', w / 2, clipBottom - 3);
        }

        ctx.restore();
    }

    _renderArchetype(ctx, w, h) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.9)';
        ctx.fillRect(0, 0, w, h);

        const totalH = 30 + 20 + 3 * 130 + 30;
        const topY = Math.max(20, (h - totalH) / 2);

        // Clip for small viewports
        if (totalH > h - 20) {
            ctx.beginPath();
            ctx.rect(0, 10, w, h - 20);
            ctx.clip();
        }

        ctx.textAlign = 'center';
        ctx.font = 'bold 24px Courier New';
        ctx.fillStyle = '#ffd700';
        ctx.fillText('CHOOSE YOUR PATH', w / 2, topY + 24);

        ctx.font = '13px Courier New';
        ctx.fillStyle = '#888';
        ctx.fillText('You have grown strong enough to specialize.', w / 2, topY + 54);

        const archetypes = [
            {
                name: 'THE GUILD MEMBER',
                color: '#4a4',
                desc: 'Join the collective. Build. Defend. Endure.',
                bonus: '+30 HP, +5 Weight',
                detail: 'Bonus to building and defense. Nations need anchors.'
            },
            {
                name: 'THE SOLOIST',
                color: '#ca4',
                desc: 'Walk alone. Strike hard. Ascend beyond limits.',
                bonus: '+5 STR, +3 AGI',
                detail: 'Massive combat bonuses. The world is yours to conquer.'
            },
            {
                name: 'THE STATIC PERSON',
                color: '#a4f',
                desc: 'Embrace the noise. Let it reshape you.',
                bonus: '+15% Speed, +5 Luck, -3 Weight',
                detail: 'Phase through reality. But the Nodes will reject you.'
            }
        ];

        for (let i = 0; i < archetypes.length; i++) {
            const a = archetypes[i];
            const selected = i === this.archetypeSelection;
            const cy = topY + 70 + i * 130;

            if (selected) {
                ctx.fillStyle = 'rgba(255,255,255,0.05)';
                ctx.fillRect(w / 2 - 220, cy - 15, 440, 110);
                ctx.strokeStyle = a.color;
                ctx.lineWidth = 2;
                ctx.strokeRect(w / 2 - 220, cy - 15, 440, 110);
            }

            ctx.font = `bold 18px Courier New`;
            ctx.fillStyle = selected ? a.color : '#555';
            ctx.fillText(a.name, w / 2, cy + 10);

            ctx.font = '12px Courier New';
            ctx.fillStyle = selected ? '#aaa' : '#444';
            ctx.fillText(a.desc, w / 2, cy + 35);

            ctx.fillStyle = selected ? '#ffd700' : '#555';
            ctx.fillText(a.bonus, w / 2, cy + 55);

            ctx.fillStyle = selected ? '#888' : '#333';
            ctx.fillText(a.detail, w / 2, cy + 75);
        }

        ctx.font = '12px Courier New';
        ctx.fillStyle = '#555';
        ctx.fillText('W/S to select, Enter to confirm', w / 2, topY + 70 + 3 * 130 + 10);

        ctx.restore();
    }

    _renderDeathScreen(ctx, w, h) {
        const alpha = Math.min(1, this.player.deathTimer * 0.5);
        ctx.save();
        ctx.fillStyle = `rgba(20, 0, 0, ${alpha * 0.8})`;
        ctx.fillRect(0, 0, w, h);

        ctx.textAlign = 'center';
        ctx.font = 'bold 36px Courier New';
        ctx.fillStyle = `rgba(200, 50, 50, ${alpha})`;
        ctx.fillText('DISSOLVED', w / 2, h / 2 - 30);

        ctx.font = '14px Courier New';
        ctx.fillStyle = `rgba(150, 100, 100, ${alpha})`;
        ctx.fillText('The Static reclaims another fragment.', w / 2, h / 2 + 10);

        if (this.player.respawnTimer <= 0) {
            ctx.font = '16px Courier New';
            ctx.fillStyle = `rgba(200, 200, 200, ${0.5 + Math.sin(this.time * 3) * 0.3})`;
            ctx.fillText('Press Enter or Space to reform', w / 2, h / 2 + 60);
        } else {
            ctx.font = '14px Courier New';
            ctx.fillStyle = `rgba(150, 150, 150, ${alpha})`;
            ctx.fillText(`Reforming in ${Math.ceil(this.player.respawnTimer)}...`, w / 2, h / 2 + 60);
        }

        ctx.restore();
    }

    _renderVictory(ctx, w, h) {
        const alpha = Math.min(1, this.victoryTimer * 0.3);
        ctx.save();

        // Golden glow
        const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        grad.addColorStop(0, `rgba(255, 200, 50, ${alpha * 0.15})`);
        grad.addColorStop(1, `rgba(0, 0, 0, ${alpha * 0.9})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        ctx.textAlign = 'center';
        ctx.font = 'bold 42px Courier New';
        ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`;
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 20;
        ctx.fillText('THE LOGIC WAVE', w / 2, h / 2 - 60);
        ctx.shadowBlur = 0;

        ctx.font = 'bold 28px Courier New';
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fillText('REALITY RESTORED', w / 2, h / 2 - 15);

        ctx.font = '14px Courier New';
        ctx.fillStyle = `rgba(200, 200, 200, ${alpha})`;
        ctx.fillText('The Main Node pulses to life. A Logic Wave expands across the continent.', w / 2, h / 2 + 25);
        ctx.fillText('The Static retreats. For now.', w / 2, h / 2 + 48);

        // Stats
        ctx.font = '13px Courier New';
        ctx.fillStyle = `rgba(180, 180, 180, ${alpha})`;
        const mins = Math.floor(this.playTime / 60);
        const secs = Math.floor(this.playTime % 60);
        ctx.fillText(`Time: ${mins}:${secs.toString().padStart(2, '0')}`, w / 2, h / 2 + 90);
        ctx.fillText(`Level: ${this.player.level}`, w / 2, h / 2 + 110);
        ctx.fillText(`Enemies Slain: ${this.stats.enemiesKilled}`, w / 2, h / 2 + 130);
        ctx.fillText(`Nodes Repaired: ${this.world.nodes.filter(n => n.active).length}/${this.world.nodes.length}`, w / 2, h / 2 + 150);

        if (this.victoryTimer > 2) {
            ctx.font = '16px Courier New';
            ctx.fillStyle = `rgba(200, 200, 200, ${0.5 + Math.sin(this.time * 3) * 0.3})`;
            ctx.fillText('Press Enter or Space to return to menu', w / 2, h / 2 + 200);
        }

        ctx.restore();
    }
};

// ======================== INITIALIZATION ========================
window.addEventListener('load', () => {
    console.log('[UE] Initializing The Unraveling Earth...');
    window.game = new UE.Game();
    console.log('[UE] Game started.');
});
