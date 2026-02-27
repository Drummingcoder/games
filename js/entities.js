// ================================================================
// THE UNRAVELING EARTH - Entities (Player, Enemies, Projectiles)
// ================================================================

// ======================== ENTITY BASE ========================
UE.Entity = class {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radius = 8;
        this.facing = 0;
        this.hp = 100;
        this.maxHp = 100;
        this.dead = false;
        this.invulnTimer = 0;
        this.flashTimer = 0;
        this.knockbackX = 0;
        this.knockbackY = 0;
    }

    takeDamage(amount, fromX, fromY) {
        if (this.invulnTimer > 0) return 0;
        const actualDmg = Math.max(1, Math.round(amount));
        this.hp -= actualDmg;
        this.flashTimer = 0.15;
        if (fromX !== undefined && fromY !== undefined) {
            const angle = UE.Utils.angle(fromX, fromY, this.x, this.y);
            this.knockbackX = Math.cos(angle) * 120;
            this.knockbackY = Math.sin(angle) * 120;
        }
        if (this.hp <= 0) {
            this.hp = 0;
            this.dead = true;
        }
        return actualDmg;
    }

    updateBase(dt) {
        // Apply knockback
        if (Math.abs(this.knockbackX) > 1 || Math.abs(this.knockbackY) > 1) {
            this.x += this.knockbackX * dt;
            this.y += this.knockbackY * dt;
            this.knockbackX *= 0.85;
            this.knockbackY *= 0.85;
        }
        if (this.invulnTimer > 0) this.invulnTimer -= dt;
        if (this.flashTimer > 0) this.flashTimer -= dt;
    }
};

// ======================== PLAYER ========================
UE.Player = class extends UE.Entity {
    constructor(x, y) {
        super(x, y);
        this.radius = 10;
        this.maxHp = UE.Config.PLAYER_MAX_HP;
        this.hp = this.maxHp;
        this.stamina = UE.Config.PLAYER_MAX_STAMINA;
        this.maxStamina = UE.Config.PLAYER_MAX_STAMINA;
        this.speed = UE.Config.PLAYER_SPEED;

        // XP & Level
        this.xp = 0;
        this.level = 1;
        this.xpToNext = UE.Config.XP_BASE;
        this.statPoints = 0;

        // Stats
        this.strength = 5;
        this.agility = 5;
        this.vitality = 5;
        this.luck = 5;
        this.weight = 5; // Static resistance

        // Equipment
        this.weapon = UE.createItem('weapon', 0); // Rusty Pipe
        this.armor = UE.createItem('armor', 0);   // Torn Rags
        this.relic = null;

        // Inventory
        this.inventory = [];
        this.maxInventory = 20;

        // Resources
        this.scrap = 10;
        this.fuel = 2;
        this.weightedOre = 0;

        // Combat state
        this.attackTimer = 0;
        this.attackCooldown = 0;
        this.isAttacking = false;
        this.attackType = 'none'; // 'light', 'heavy', 'whirlwind'
        this.attackAngle = 0;
        this.attackProgress = 0;
        this.comboCount = 0;
        this.comboTimer = 0;

        // Dodge
        this.isDodging = false;
        this.dodgeTimer = 0;
        this.dodgeCooldown = 0;
        this.dodgeAngle = 0;

        // Archetype
        this.archetype = 'none'; // 'none', 'guild', 'soloist', 'static'
        this.archetypeLevel = 0;

        // Muscle Memory (skill proficiency)
        this.muscleMemory = {
            lightAttack: 0,
            heavyAttack: 0,
            dodge: 0,
            whirlwind: 0
        };
        this.muscleMemoryMax = 100;

        // Whirlwind
        this.whirlwindCooldown = 0;

        // Interactive
        this.nearNode = null;
        this.isRepairing = false;
        this.repairTimer = 0;

        // Building
        this.buildMode = false;
        this.buildType = 'wall'; // 'wall', 'turret', 'generator'

        // Visual
        this.trail = new UE.Trail();
        this.bodyAngle = 0;

        // Static damage timer
        this.staticDmgTimer = 0;

        // Death
        this.deathTimer = 0;
        this.respawnTimer = 0;
    }

    getDefense() {
        return (this.armor ? this.armor.defense : 0) + this.vitality * 0.3;
    }

    getWeaponDamage() {
        return this.weapon ? this.weapon.damage : 3;
    }

    getAttackDamage(type) {
        let base = this.getWeaponDamage() + this.strength * 0.5;
        let multiplier = 1.0;

        // Muscle memory bonus
        const mm = this.muscleMemory[type] || 0;
        multiplier += mm / this.muscleMemoryMax * 0.5; // Up to +50%

        // Relic bonus
        if (this.relic && this.relic.effect === 'damage_boost') {
            multiplier += this.relic.value;
        }

        // Combo bonus
        if (type === 'lightAttack' && this.comboCount >= UE.Config.COMBO_MAX) {
            multiplier *= 1.5;
        }

        // Heavy attack bonus
        if (type === 'heavyAttack') {
            multiplier *= 1.8;
        }

        // Critical hit
        let critChance = 0.05 + this.luck * 0.005;
        if (this.relic && this.relic.effect === 'crit_chance') critChance += this.relic.value;
        const isCrit = Math.random() < critChance;
        if (isCrit) multiplier *= 1.5 + this.luck * 0.01;

        const damage = Math.round(base * multiplier);
        return { damage, isCrit };
    }

    getAttackSpeed() {
        let speed = this.weapon ? this.weapon.speed : 1.0;
        speed *= 1 + this.agility * 0.01;
        return speed;
    }

    getStaticResist() {
        let resist = this.weight * 0.02;
        if (this.relic && this.relic.effect === 'static_resist') resist += this.relic.value;
        if (this.armor) resist += this.armor.weight * 0.005;
        return UE.Utils.clamp(resist, 0, 0.9);
    }

    addXP(amount) {
        let bonus = 1.0;
        if (this.relic && this.relic.effect === 'xp_boost') bonus += this.relic.value;
        this.xp += Math.round(amount * bonus);
        while (this.xp >= this.xpToNext) {
            this.xp -= this.xpToNext;
            this.level++;
            this.xpToNext = Math.round(UE.Config.XP_BASE * Math.pow(UE.Config.XP_SCALE, this.level - 1));
            this.statPoints += 3;
            this.maxHp += 10;
            this.hp = this.maxHp;
            this.maxStamina += 5;
            this.stamina = this.maxStamina;
            if (UE.audio) UE.audio.play('levelup');
            if (UE.particles) {
                UE.particles.emit(this.x, this.y, 30, {
                    colors: ['#ffd700', '#fff', '#ffa500'],
                    speedMin: 50, speedMax: 150,
                    lifeMin: 0.5, lifeMax: 1.2,
                    sizeMin: 2, sizeMax: 5,
                    glow: true
                });
            }
        }
    }

    addMuscleMemory(skill, amount) {
        let bonus = 1.0;
        if (this.relic && this.relic.effect === 'muscle_boost') bonus += this.relic.value;
        const mm = this.muscleMemory;
        if (mm[skill] !== undefined) {
            mm[skill] = Math.min(this.muscleMemoryMax, mm[skill] + amount * bonus);
        }
    }

    addToInventory(item) {
        if (this.inventory.length >= this.maxInventory) return false;
        this.inventory.push(item);
        return true;
    }

    equip(inventoryIndex) {
        const item = this.inventory[inventoryIndex];
        if (!item) return;
        let old = null;
        if (item.type === 'weapon') { old = this.weapon; this.weapon = item; }
        else if (item.type === 'armor') { old = this.armor; this.armor = item; }
        else if (item.type === 'relic') { old = this.relic; this.relic = item; }
        this.inventory.splice(inventoryIndex, 1);
        if (old) this.inventory.push(old);
    }

    update(dt, input, camera, world, staticFog) {
        if (this.dead) {
            this.deathTimer += dt;
            this.respawnTimer -= dt;
            return;
        }

        this.updateBase(dt);
        this.trail.update(dt);

        // Update mouse world position
        input.mouseWorld(camera);

        // Facing
        this.facing = UE.Utils.angle(this.x, this.y, input.mouse.worldX, input.mouse.worldY);
        this.bodyAngle = UE.Utils.lerp(this.bodyAngle, this.facing, 0.15);

        // Stamina regen
        let staminaRegen = UE.Config.STAMINA_REGEN;
        if (this.relic && this.relic.effect === 'stamina_regen') staminaRegen += this.relic.value;
        if (!this.isAttacking && !this.isDodging) {
            this.stamina = Math.min(this.maxStamina, this.stamina + staminaRegen * dt);
        }

        // HP regen near active node
        let nearActiveNode = false;
        for (const node of world.nodes) {
            if (!node.active) continue;
            const dist = UE.Utils.dist(this.x, this.y, node.x, node.y);
            if (dist < node.clearRadius * UE.Config.TILE_SIZE * 0.5) {
                nearActiveNode = true;
                break;
            }
        }
        if (nearActiveNode || (this.relic && this.relic.effect === 'hp_regen')) {
            let hpRegen = nearActiveNode ? UE.Config.HP_REGEN_NEAR_NODE : 0;
            if (this.relic && this.relic.effect === 'hp_regen') hpRegen += this.relic.value;
            this.hp = Math.min(this.maxHp, this.hp + hpRegen * dt);
        }

        // Static damage
        const staticCov = staticFog.getCoverage(this.x, this.y);
        if (staticCov > 0.3) {
            this.staticDmgTimer += dt;
            if (this.staticDmgTimer >= UE.Config.STATIC_TICK) {
                this.staticDmgTimer = 0;
                const dmg = UE.Config.STATIC_DAMAGE * staticCov * (1 - this.getStaticResist());
                if (dmg > 0) {
                    this.takeDamage(dmg);
                    if (UE.dmgNumbers) UE.dmgNumbers.add(this.x, this.y, Math.round(dmg), '#aaa');
                    if (UE.particles) {
                        UE.particles.emit(this.x, this.y, 5, {
                            colors: ['#aaa', '#888', '#666'],
                            speedMin: 20, speedMax: 50,
                            lifeMin: 0.3, lifeMax: 0.6,
                            sizeMin: 1, sizeMax: 3
                        });
                    }
                }
            }
        } else {
            this.staticDmgTimer = 0;
        }

        // Cooldown timers
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        if (this.dodgeCooldown > 0) this.dodgeCooldown -= dt;
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) this.comboCount = 0;
        }
        if (this.whirlwindCooldown > 0) this.whirlwindCooldown -= dt;

        // Dodge
        if (this.isDodging) {
            this.dodgeTimer -= dt;
            const dodgeSpeed = UE.Config.PLAYER_DODGE_SPEED;
            this.x += Math.cos(this.dodgeAngle) * dodgeSpeed * dt;
            this.y += Math.sin(this.dodgeAngle) * dodgeSpeed * dt;

            // Dodge trail
            this.trail.add(this.x, this.y, 'rgba(100, 200, 255, 0.5)');

            if (this.dodgeTimer <= 0) {
                this.isDodging = false;
                this.invulnTimer = 0;
            }

            // Clamp to world
            this._clampToWorld(world);
            return; // Can't do anything else while dodging
        }

        // Attack animation
        if (this.isAttacking) {
            this.attackTimer -= dt;
            const totalDur = this.attackType === 'heavy' ? 0.4 : (this.attackType === 'whirlwind' ? 0.5 : 0.25);
            this.attackProgress = 1 - (this.attackTimer / totalDur);
            if (this.attackTimer <= 0) {
                this.isAttacking = false;
                this.attackType = 'none';
            }
        }

        // Repairing
        if (this.isRepairing) {
            this.repairTimer -= dt;
            if (this.nearNode && !this.nearNode.active) {
                const repairRate = 1.0 / UE.Config.NODE_REPAIR_TIME;
                this.nearNode.repairProgress += repairRate * dt;
                if (this.nearNode.repairProgress >= 1.0) {
                    this.nearNode.active = true;
                    this.nearNode.repairProgress = 1.0;
                    if (UE.audio) UE.audio.play('nodeActivate');
                    UE.Utils.screenShake(15);
                    if (UE.particles) {
                        UE.particles.emit(this.nearNode.x, this.nearNode.y, 60, {
                            colors: ['#ffd700', '#fff', '#ffa500', '#ff0'],
                            speedMin: 80, speedMax: 250,
                            lifeMin: 0.8, lifeMax: 2.0,
                            sizeMin: 2, sizeMax: 6,
                            glow: true
                        });
                    }
                    // Update static fog
                    staticFog.updateCoverage();
                    this.isRepairing = false;
                }
            } else {
                this.isRepairing = false;
            }
            return; // Can't move while repairing
        }

        // Movement
        let moveX = 0, moveY = 0;
        if (input.isDown('KeyW') || input.isDown('ArrowUp')) moveY -= 1;
        if (input.isDown('KeyS') || input.isDown('ArrowDown')) moveY += 1;
        if (input.isDown('KeyA') || input.isDown('ArrowLeft')) moveX -= 1;
        if (input.isDown('KeyD') || input.isDown('ArrowRight')) moveX += 1;

        // Normalize diagonal movement
        if (moveX !== 0 && moveY !== 0) {
            const len = Math.sqrt(moveX * moveX + moveY * moveY);
            moveX /= len;
            moveY /= len;
        }

        const actualSpeed = this.speed * (1 + this.agility * 0.005);
        const newX = this.x + moveX * actualSpeed * dt;
        const newY = this.y + moveY * actualSpeed * dt;

        // Collision with world
        if (world.isWalkableWorld(newX, this.y)) this.x = newX;
        if (world.isWalkableWorld(this.x, newY)) this.y = newY;

        // Collision with structures (walls)
        for (const s of world.structures) {
            if (s.type !== 'wall') continue;
            const TS = UE.Config.TILE_SIZE;
            const sx = s.x, sy = s.y;
            const halfTS = TS / 2;
            if (this.x + this.radius > sx - halfTS && this.x - this.radius < sx + halfTS &&
                this.y + this.radius > sy - halfTS && this.y - this.radius < sy + halfTS) {
                // Push out
                const dx = this.x - sx;
                const dy = this.y - sy;
                if (Math.abs(dx) > Math.abs(dy)) {
                    this.x = dx > 0 ? sx + halfTS + this.radius : sx - halfTS - this.radius;
                } else {
                    this.y = dy > 0 ? sy + halfTS + this.radius : sy - halfTS - this.radius;
                }
            }
        }

        // Dodge input
        if (input.justPressed('Space') && this.dodgeCooldown <= 0 && this.stamina >= 15) {
            this.isDodging = true;
            this.dodgeTimer = UE.Config.PLAYER_DODGE_DURATION;
            this.dodgeCooldown = UE.Config.PLAYER_DODGE_COOLDOWN;
            this.invulnTimer = UE.Config.PLAYER_DODGE_DURATION;
            this.stamina -= 15;
            this.dodgeAngle = (moveX !== 0 || moveY !== 0) ? Math.atan2(moveY, moveX) : this.facing;
            this.addMuscleMemory('dodge', 0.3);
            if (UE.audio) UE.audio.play('dodge');
        }

        // Attack input - Light attack
        if (input.mouse.leftJust && !this.isAttacking && this.attackCooldown <= 0 && !this.buildMode) {
            const isHeavy = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
            if (isHeavy && this.stamina >= 20) {
                this._startAttack('heavy');
                this.stamina -= 20;
            } else if (!isHeavy) {
                this._startAttack('light');
                this.stamina -= 5;
            }
        }

        // Whirlwind (Q)
        if (input.justPressed('KeyQ') && !this.isAttacking && this.whirlwindCooldown <= 0 && this.stamina >= UE.Config.WHIRLWIND_COST) {
            this._startAttack('whirlwind');
            this.stamina -= UE.Config.WHIRLWIND_COST;
            this.whirlwindCooldown = UE.Config.WHIRLWIND_CD;
        }

        // Interact (E)
        if (input.justPressed('KeyE')) {
            // Check for node repair
            this.nearNode = null;
            for (const node of world.nodes) {
                if (node.active) continue;
                const dist = UE.Utils.dist(this.x, this.y, node.x, node.y);
                if (dist < 50) {
                    this.nearNode = node;
                    break;
                }
            }
            if (this.nearNode && !this.nearNode.active) {
                // Check main node requirements
                if (this.nearNode.isMain) {
                    const activeSubNodes = world.nodes.filter(n => !n.isMain && n.active).length;
                    if (activeSubNodes < this.nearNode.requiredSubNodes) {
                        if (UE.dmgNumbers) UE.dmgNumbers.add(this.x, this.y - 20,
                            `Need ${this.nearNode.requiredSubNodes - activeSubNodes} more sub-nodes`, '#f88');
                        this.nearNode = null;
                    } else if (this.fuel < UE.Config.NODE_FUEL_COST * 2) {
                        if (UE.dmgNumbers) UE.dmgNumbers.add(this.x, this.y - 20, 'Need more Fuel Cells', '#f88');
                        this.nearNode = null;
                    } else {
                        this.fuel -= UE.Config.NODE_FUEL_COST * 2;
                        this.isRepairing = true;
                    }
                } else {
                    if (this.fuel >= UE.Config.NODE_FUEL_COST && this.scrap >= 5) {
                        this.fuel -= UE.Config.NODE_FUEL_COST;
                        this.scrap -= 5;
                        this.isRepairing = true;
                    } else {
                        if (UE.dmgNumbers) UE.dmgNumbers.add(this.x, this.y - 20,
                            `Need ${UE.Config.NODE_FUEL_COST} Fuel + 5 Scrap`, '#f88');
                    }
                }
            }
        }

        // Build mode
        if (input.justPressed('KeyB')) {
            this.buildMode = !this.buildMode;
        }
        if (this.buildMode) {
            // Cycle build type
            if (input.justPressed('Digit1')) this.buildType = 'wall';
            if (input.justPressed('Digit2')) this.buildType = 'turret';
            if (input.justPressed('Digit3')) this.buildType = 'generator';

            // Place structure with right click
            if (input.mouse.rightJust) {
                const t = UE.Utils.worldToTile(input.mouse.worldX, input.mouse.worldY);
                const dist = UE.Utils.dist(this.x, this.y, input.mouse.worldX, input.mouse.worldY);
                if (dist < 120) {
                    let cost, costType;
                    if (this.buildType === 'wall') { cost = UE.Config.BUILD_WALL_COST; costType = 'scrap'; }
                    else if (this.buildType === 'turret') { cost = UE.Config.BUILD_TURRET_COST; costType = 'scrap'; }
                    else { cost = UE.Config.BUILD_GENERATOR_COST; costType = 'scrap'; }

                    if (this[costType] >= cost) {
                        if (world.addStructure(t.tx, t.ty, this.buildType)) {
                            this[costType] -= cost;
                            if (UE.audio) UE.audio.play('build');
                        }
                    } else {
                        if (UE.dmgNumbers) UE.dmgNumbers.add(input.mouse.worldX, input.mouse.worldY, `Need ${cost} Scrap`, '#f88');
                    }
                }
            }
        }

        // Pick up loot
        for (let i = world.lootDrops.length - 1; i >= 0; i--) {
            const drop = world.lootDrops[i];
            const dist = UE.Utils.dist(this.x, this.y, drop.x, drop.y);

            // Magnet effect
            if (dist < UE.Config.LOOT_MAGNET_DIST) {
                const angle = UE.Utils.angle(drop.x, drop.y, this.x, this.y);
                drop.x += Math.cos(angle) * 200 * dt;
                drop.y += Math.sin(angle) * 200 * dt;
            }

            if (dist < UE.Config.LOOT_PICKUP_DIST) {
                if (drop.item.type === 'resource') {
                    if (drop.item.name === 'Scrap') this.scrap += drop.item.amount;
                    else if (drop.item.name === 'Fuel Cell') this.fuel += drop.item.amount;
                    else if (drop.item.name === 'Weighted Ore') this.weightedOre += drop.item.amount;
                    if (UE.dmgNumbers) UE.dmgNumbers.add(drop.x, drop.y, `+${drop.item.amount} ${drop.item.name}`, '#8f8');
                } else {
                    if (this.addToInventory(drop.item)) {
                        if (UE.dmgNumbers) UE.dmgNumbers.add(drop.x, drop.y, drop.item.name, UE.RarityColors[drop.item.rarity]);
                    } else {
                        continue; // Inventory full, don't pick up
                    }
                }
                if (UE.audio) UE.audio.play('pickup');
                world.lootDrops.splice(i, 1);
            }
        }

        // Clamp to world
        this._clampToWorld(world);
    }

    _startAttack(type) {
        this.isAttacking = true;
        this.attackType = type;
        this.attackAngle = this.facing;
        this.attackProgress = 0;

        let cd;
        if (type === 'light') {
            cd = UE.Config.ATTACK_LIGHT_CD / this.getAttackSpeed();
            this.attackTimer = 0.25 / this.getAttackSpeed();
            this.comboCount++;
            this.comboTimer = UE.Config.COMBO_WINDOW;
            this.addMuscleMemory('lightAttack', 0.2);
            if (this.comboCount >= UE.Config.COMBO_MAX) {
                if (UE.audio) UE.audio.play('combo');
            } else {
                if (UE.audio) UE.audio.play('slash');
            }
        } else if (type === 'heavy') {
            cd = UE.Config.ATTACK_HEAVY_CD / this.getAttackSpeed();
            this.attackTimer = 0.4 / this.getAttackSpeed();
            this.comboCount = 0;
            this.addMuscleMemory('heavyAttack', 0.5);
            if (UE.audio) UE.audio.play('heavySlash');
        } else if (type === 'whirlwind') {
            cd = 0.5;
            this.attackTimer = 0.5;
            this.addMuscleMemory('whirlwind', 0.8);
            if (UE.audio) UE.audio.play('whirlwind');
        }
        this.attackCooldown = cd;

        // Lunge forward slightly
        if (type !== 'whirlwind') {
            this.knockbackX = Math.cos(this.attackAngle) * -30;
            this.knockbackY = Math.sin(this.attackAngle) * -30;
        }
    }

    getAttackHitbox() {
        if (!this.isAttacking) return null;
        if (this.attackType === 'whirlwind') {
            return { type: 'circle', x: this.x, y: this.y, radius: 60 };
        }
        const range = this.attackType === 'heavy' ? UE.Config.ATTACK_HEAVY_RANGE : UE.Config.ATTACK_LIGHT_RANGE;
        const arc = this.attackType === 'heavy' ? UE.Config.ATTACK_HEAVY_ARC : UE.Config.ATTACK_LIGHT_ARC;
        // Weapon range bonus
        const bonusRange = this.weapon ? (this.weapon.range > 0 ? 0 : 0) : 0;
        return {
            type: 'arc',
            x: this.x,
            y: this.y,
            angle: this.attackAngle,
            arc,
            range: range + bonusRange
        };
    }

    _clampToWorld(world) {
        const TS = UE.Config.TILE_SIZE;
        const maxW = world.w * TS;
        const maxH = world.h * TS;
        this.x = UE.Utils.clamp(this.x, TS * 3, maxW - TS * 3);
        this.y = UE.Utils.clamp(this.y, TS * 3, maxH - TS * 3);
    }

    die() {
        this.dead = true;
        this.deathTimer = 0;
        this.respawnTimer = 3.0;
        if (UE.audio) UE.audio.play('death');
        UE.Utils.screenShake(20);
        if (UE.particles) {
            UE.particles.emit(this.x, this.y, 40, {
                colors: ['#f44', '#f88', '#faa', '#800'],
                speedMin: 40, speedMax: 180,
                lifeMin: 0.5, lifeMax: 1.5,
                sizeMin: 2, sizeMax: 5,
                glow: true
            });
        }
    }

    respawn(world) {
        this.dead = false;
        this.hp = this.maxHp * 0.5;
        this.stamina = this.maxStamina;
        this.x = world.spawnX;
        this.y = world.spawnY;
        // Lose some scrap on death
        this.scrap = Math.max(0, this.scrap - 5);
    }

    draw(ctx, camera, time) {
        if (this.dead) return;

        const s = camera.worldToScreen(this.x, this.y);

        // Draw dodge trail
        this.trail.draw(ctx, camera);

        ctx.save();

        // Flash on damage
        if (this.flashTimer > 0) {
            ctx.globalAlpha = 0.5 + Math.sin(this.flashTimer * 30) * 0.5;
        }

        // Invuln indicator
        if (this.isDodging) {
            ctx.globalAlpha = 0.4;
        }

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + 8, 10, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body
        let bodyColor = '#4488cc';
        if (this.archetype === 'soloist') bodyColor = '#cc8844';
        else if (this.archetype === 'static') bodyColor = '#8844aa';
        else if (this.archetype === 'guild') bodyColor = '#44aa44';

        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.arc(s.x, s.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Direction indicator / face
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(
            s.x + Math.cos(this.bodyAngle) * 5,
            s.y + Math.sin(this.bodyAngle) * 5,
            3, 0, Math.PI * 2
        );
        ctx.fill();

        // Weapon draw
        if (this.isAttacking) {
            this._drawAttack(ctx, s, time);
        } else {
            // Weapon idle
            const wx = s.x + Math.cos(this.bodyAngle) * 14;
            const wy = s.y + Math.sin(this.bodyAngle) * 14;
            ctx.strokeStyle = this.weapon ? UE.RarityColors[this.weapon.rarity] : '#aaa';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(s.x + Math.cos(this.bodyAngle) * 8, s.y + Math.sin(this.bodyAngle) * 8);
            ctx.lineTo(wx, wy);
            ctx.stroke();
        }

        ctx.restore();
    }

    _drawAttack(ctx, s, time) {
        const p = this.attackProgress;
        const angle = this.attackAngle;

        if (this.attackType === 'whirlwind') {
            // Full circle slash
            const swirl = p * Math.PI * 4;
            ctx.strokeStyle = this.weapon ? UE.RarityColors[this.weapon.rarity] : '#fff';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#ffa500';
            ctx.shadowBlur = 10;
            for (let i = 0; i < 4; i++) {
                const a = swirl + i * Math.PI / 2;
                const r = 20 + p * 40;
                ctx.beginPath();
                ctx.moveTo(s.x + Math.cos(a) * 10, s.y + Math.sin(a) * 10);
                ctx.lineTo(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r);
                ctx.stroke();
            }
            // Circle indicator
            ctx.strokeStyle = 'rgba(255, 165, 0, 0.3)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(s.x, s.y, 60 * p, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            // Slash arc
            const arcSize = this.attackType === 'heavy' ? UE.Config.ATTACK_HEAVY_ARC : UE.Config.ATTACK_LIGHT_ARC;
            const range = this.attackType === 'heavy' ? UE.Config.ATTACK_HEAVY_RANGE : UE.Config.ATTACK_LIGHT_RANGE;
            const swingAngle = angle - arcSize / 2 + arcSize * UE.Utils.easeOutQuad(p);

            // Weapon trail
            const trailColor = this.comboCount >= 3 ? '#ffa500' :
                              (this.weapon ? UE.RarityColors[this.weapon.rarity] : '#fff');

            ctx.strokeStyle = trailColor;
            ctx.lineWidth = this.attackType === 'heavy' ? 4 : 2;
            ctx.shadowColor = trailColor;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(
                s.x + Math.cos(swingAngle) * 10,
                s.y + Math.sin(swingAngle) * 10
            );
            ctx.lineTo(
                s.x + Math.cos(swingAngle) * range,
                s.y + Math.sin(swingAngle) * range
            );
            ctx.stroke();

            // Slash arc visual
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 * (1 - p)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(s.x, s.y, range, angle - arcSize / 2, angle - arcSize / 2 + arcSize * p);
            ctx.stroke();
        }
    }
};

// ======================== ENEMY TYPES ========================
UE.EnemyTypes = {
    CRAWLER: 'crawler',
    SHIFTER: 'shifter',
    BRUTE: 'brute',
    SPITTER: 'spitter',
    VOID_WALKER: 'voidwalker',
    CHAMPION: 'champion'
};

UE.EnemyDefs = {
    crawler: {
        name: 'Crawler', hp: 30, damage: 8, speed: 60, radius: 8,
        xp: 10, color: '#cc4444', attackRange: 25, attackCD: 1.0,
        lootChance: 0.4
    },
    shifter: {
        name: 'Shifter', hp: 20, damage: 12, speed: 120, radius: 7,
        xp: 18, color: '#aa44aa', attackRange: 22, attackCD: 0.7,
        lootChance: 0.5, canTeleport: true
    },
    brute: {
        name: 'Brute', hp: 80, damage: 25, speed: 35, radius: 14,
        xp: 35, color: '#884422', attackRange: 30, attackCD: 1.8,
        lootChance: 0.6, canCharge: true
    },
    spitter: {
        name: 'Spitter', hp: 25, damage: 10, speed: 50, radius: 8,
        xp: 15, color: '#44aa44', attackRange: 200, attackCD: 1.5,
        lootChance: 0.45, isRanged: true
    },
    voidwalker: {
        name: 'Void Walker', hp: 40, damage: 18, speed: 80, radius: 9,
        xp: 25, color: '#6644cc', attackRange: 28, attackCD: 1.2,
        lootChance: 0.55, canPhase: true
    },
    champion: {
        name: 'Static Champion', hp: 250, damage: 35, speed: 55, radius: 18,
        xp: 100, color: '#ff4444', attackRange: 35, attackCD: 1.5,
        lootChance: 1.0, isBoss: true
    }
};

UE.Enemy = class extends UE.Entity {
    constructor(x, y, type) {
        super(x, y);
        const def = UE.EnemyDefs[type];
        this.type = type;
        this.name = def.name;
        this.maxHp = def.hp;
        this.hp = def.hp;
        this.damage = def.damage;
        this.speed = def.speed;
        this.radius = def.radius;
        this.xpReward = def.xp;
        this.color = def.color;
        this.attackRange = def.attackRange;
        this.attackCD = def.attackCD;
        this.lootChance = def.lootChance;
        this.isBoss = def.isBoss || false;

        // Abilities
        this.canTeleport = def.canTeleport || false;
        this.canCharge = def.canCharge || false;
        this.isRanged = def.isRanged || false;
        this.canPhase = def.canPhase || false;

        // AI State
        this.state = 'idle'; // idle, chase, attack, retreat, charge, teleport, phase
        this.targetX = x;
        this.targetY = y;
        this.attackTimer = 0;
        this.stateTimer = 0;
        this.aggroRange = 250;
        this.deaggroRange = 500;
        this.wanderTimer = 0;

        // Special timers
        this.teleportCD = 3.0;
        this.teleportTimer = 0;
        this.chargeCD = 4.0;
        this.chargeTimer = 0;
        this.chargeSpeed = 0;
        this.phaseTimer = 0;
        this.phaseCD = 5.0;
        this.isPhased = false;
        this.phaseAlpha = 1.0;

        // Movement
        this.moveAngle = Math.random() * Math.PI * 2;

        // Boss specific
        if (this.isBoss) {
            this.aggroRange = 350;
            this.deaggroRange = 600;
        }
    }

    update(dt, player, world) {
        if (this.dead) return;
        this.updateBase(dt);

        const distToPlayer = UE.Utils.dist(this.x, this.y, player.x, player.y);
        const angleToPlayer = UE.Utils.angle(this.x, this.y, player.x, player.y);

        // Timers
        if (this.attackTimer > 0) this.attackTimer -= dt;
        this.stateTimer += dt;
        if (this.teleportTimer > 0) this.teleportTimer -= dt;
        if (this.chargeTimer > 0) this.chargeTimer -= dt;
        if (this.phaseTimer > 0) this.phaseTimer -= dt;

        // Phase in/out
        if (this.canPhase) {
            if (this.isPhased) {
                this.phaseAlpha = UE.Utils.lerp(this.phaseAlpha, 0.15, 0.1);
                if (this.phaseTimer <= 0) {
                    this.isPhased = false;
                    this.phaseTimer = this.phaseCD;
                }
            } else {
                this.phaseAlpha = UE.Utils.lerp(this.phaseAlpha, 1.0, 0.1);
                if (this.phaseTimer <= 0 && distToPlayer < this.aggroRange) {
                    this.isPhased = true;
                    this.phaseTimer = 2.0;
                    if (UE.particles) {
                        UE.particles.emit(this.x, this.y, 10, {
                            colors: ['#66f', '#44c', '#88f'],
                            speedMin: 20, speedMax: 60,
                            lifeMin: 0.3, lifeMax: 0.6,
                            sizeMin: 2, sizeMax: 4
                        });
                    }
                }
            }
        }

        // State machine
        switch (this.state) {
            case 'idle':
                this.wanderTimer -= dt;
                if (this.wanderTimer <= 0) {
                    this.wanderTimer = 1 + Math.random() * 3;
                    this.moveAngle = Math.random() * Math.PI * 2;
                }
                // Wander slowly
                const wx = this.x + Math.cos(this.moveAngle) * this.speed * 0.3 * dt;
                const wy = this.y + Math.sin(this.moveAngle) * this.speed * 0.3 * dt;
                if (world.isWalkableWorld(wx, wy)) { this.x = wx; this.y = wy; }

                // Aggro on player
                if (distToPlayer < this.aggroRange && !player.dead) {
                    this.state = 'chase';
                    this.stateTimer = 0;
                }
                break;

            case 'chase':
                this.facing = angleToPlayer;
                if (distToPlayer < this.attackRange) {
                    this.state = 'attack';
                    this.stateTimer = 0;
                } else if (distToPlayer > this.deaggroRange || player.dead) {
                    this.state = 'idle';
                    this.stateTimer = 0;
                } else {
                    // Move toward player
                    let moveSpeed = this.speed;
                    const mx = this.x + Math.cos(angleToPlayer) * moveSpeed * dt;
                    const my = this.y + Math.sin(angleToPlayer) * moveSpeed * dt;
                    if (world.isWalkableWorld(mx, my)) {
                        this.x = mx;
                        this.y = my;
                    } else {
                        // Try to navigate around obstacle
                        const alt1 = angleToPlayer + Math.PI / 4;
                        const alt2 = angleToPlayer - Math.PI / 4;
                        const mx1 = this.x + Math.cos(alt1) * moveSpeed * dt;
                        const my1 = this.y + Math.sin(alt1) * moveSpeed * dt;
                        if (world.isWalkableWorld(mx1, my1)) {
                            this.x = mx1; this.y = my1;
                        } else {
                            const mx2 = this.x + Math.cos(alt2) * moveSpeed * dt;
                            const my2 = this.y + Math.sin(alt2) * moveSpeed * dt;
                            if (world.isWalkableWorld(mx2, my2)) {
                                this.x = mx2; this.y = my2;
                            }
                        }
                    }

                    // Teleport toward player (Shifter)
                    if (this.canTeleport && this.teleportTimer <= 0 && distToPlayer < 150 && distToPlayer > 50) {
                        this.teleportTimer = this.teleportCD;
                        if (UE.particles) {
                            UE.particles.emit(this.x, this.y, 15, {
                                colors: ['#a4f', '#84c', '#c6f'],
                                speedMin: 30, speedMax: 80,
                                lifeMin: 0.3, lifeMax: 0.6,
                                sizeMin: 2, sizeMax: 4
                            });
                        }
                        // Teleport to behind player
                        const behindAngle = angleToPlayer + Math.PI + (Math.random() - 0.5) * 1.0;
                        this.x = player.x + Math.cos(behindAngle) * 30;
                        this.y = player.y + Math.sin(behindAngle) * 30;
                        if (UE.particles) {
                            UE.particles.emit(this.x, this.y, 15, {
                                colors: ['#a4f', '#84c', '#c6f'],
                                speedMin: 30, speedMax: 80,
                                lifeMin: 0.3, lifeMax: 0.6,
                                sizeMin: 2, sizeMax: 4
                            });
                        }
                    }

                    // Charge attack (Brute)
                    if (this.canCharge && this.chargeTimer <= 0 && distToPlayer < 120 && distToPlayer > 40) {
                        this.state = 'charge';
                        this.stateTimer = 0;
                        this.chargeTimer = this.chargeCD;
                        this.chargeSpeed = 300;
                        this.moveAngle = angleToPlayer;
                    }
                }
                break;

            case 'charge':
                this.chargeSpeed *= 0.97;
                const cx = this.x + Math.cos(this.moveAngle) * this.chargeSpeed * dt;
                const cy = this.y + Math.sin(this.moveAngle) * this.chargeSpeed * dt;
                if (world.isWalkableWorld(cx, cy)) { this.x = cx; this.y = cy; }

                // Charge particles
                if (UE.particles && Math.random() < 0.5) {
                    UE.particles.emit(this.x, this.y, 1, {
                        colors: ['#f84', '#fa4'],
                        speedMin: 10, speedMax: 30,
                        lifeMin: 0.2, lifeMax: 0.4,
                        sizeMin: 2, sizeMax: 4
                    });
                }

                if (this.chargeSpeed < 50 || this.stateTimer > 1.5) {
                    this.state = 'chase';
                    this.stateTimer = 0;
                }
                break;

            case 'attack':
                this.facing = angleToPlayer;
                if (this.attackTimer <= 0) {
                    this.attackTimer = this.attackCD;

                    if (this.isRanged) {
                        // Ranged attack - create projectile
                        if (UE.projectiles) {
                            UE.projectiles.push({
                                x: this.x,
                                y: this.y,
                                vx: Math.cos(angleToPlayer) * 250,
                                vy: Math.sin(angleToPlayer) * 250,
                                damage: this.damage,
                                radius: 4,
                                life: 2.0,
                                color: '#4f4',
                                fromEnemy: true
                            });
                        }
                    }
                    // Melee damage is handled by game.js collision check
                }

                // Back to chase if out of range
                if (distToPlayer > this.attackRange * 2) {
                    this.state = 'chase';
                    this.stateTimer = 0;
                }

                // Ranged enemies try to maintain distance
                if (this.isRanged && distToPlayer < 80) {
                    const retreatAngle = angleToPlayer + Math.PI;
                    const rx = this.x + Math.cos(retreatAngle) * this.speed * dt;
                    const ry = this.y + Math.sin(retreatAngle) * this.speed * dt;
                    if (world.isWalkableWorld(rx, ry)) { this.x = rx; this.y = ry; }
                }
                break;
        }

        // Collision with other enemies (separation)
        // Done in game.js for efficiency
    }

    draw(ctx, camera, time) {
        if (this.dead) return;
        if (!camera.isVisible(this.x, this.y, 30)) return;

        const s = camera.worldToScreen(this.x, this.y);

        ctx.save();

        // Phase effect
        if (this.canPhase) {
            ctx.globalAlpha = this.phaseAlpha;
        }

        // Flash on damage
        if (this.flashTimer > 0) {
            ctx.globalAlpha = Math.min(ctx.globalAlpha || 1, 0.5 + Math.sin(this.flashTimer * 30) * 0.5);
        }

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + this.radius * 0.8, this.radius * 0.8, this.radius * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body
        if (this.isBoss) {
            // Boss has a pulsing effect
            const pulse = Math.sin(time * 3) * 0.15 + 0.85;
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 15 * pulse;
        }

        ctx.fillStyle = this.color;

        switch (this.type) {
            case 'crawler':
                // Bug-like shape
                ctx.beginPath();
                ctx.ellipse(s.x, s.y, this.radius * 1.2, this.radius * 0.8, this.facing, 0, Math.PI * 2);
                ctx.fill();
                // Mandibles
                ctx.strokeStyle = '#ff6666';
                ctx.lineWidth = 2;
                const m1 = this.facing - 0.4;
                const m2 = this.facing + 0.4;
                ctx.beginPath();
                ctx.moveTo(s.x + Math.cos(m1) * this.radius, s.y + Math.sin(m1) * this.radius);
                ctx.lineTo(s.x + Math.cos(this.facing) * (this.radius + 5), s.y + Math.sin(this.facing) * (this.radius + 5));
                ctx.moveTo(s.x + Math.cos(m2) * this.radius, s.y + Math.sin(m2) * this.radius);
                ctx.lineTo(s.x + Math.cos(this.facing) * (this.radius + 5), s.y + Math.sin(this.facing) * (this.radius + 5));
                ctx.stroke();
                break;

            case 'shifter':
                // Ghostly diamond
                ctx.beginPath();
                ctx.moveTo(s.x, s.y - this.radius);
                ctx.lineTo(s.x + this.radius, s.y);
                ctx.lineTo(s.x, s.y + this.radius);
                ctx.lineTo(s.x - this.radius, s.y);
                ctx.closePath();
                ctx.fill();
                break;

            case 'brute':
                // Large square
                ctx.fillRect(s.x - this.radius, s.y - this.radius, this.radius * 2, this.radius * 2);
                // Angry eyes
                ctx.fillStyle = '#ff0';
                ctx.fillRect(s.x - 5, s.y - 4, 4, 3);
                ctx.fillRect(s.x + 1, s.y - 4, 4, 3);
                break;

            case 'spitter':
                // Blob shape
                ctx.beginPath();
                ctx.arc(s.x, s.y, this.radius, 0, Math.PI * 2);
                ctx.fill();
                // Acid drip
                ctx.fillStyle = '#8f8';
                const dripY = s.y + this.radius + Math.sin(time * 5) * 3;
                ctx.beginPath();
                ctx.arc(s.x, dripY, 2, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'voidwalker':
                // Tall triangle
                ctx.beginPath();
                ctx.moveTo(s.x, s.y - this.radius * 1.5);
                ctx.lineTo(s.x + this.radius, s.y + this.radius * 0.5);
                ctx.lineTo(s.x - this.radius, s.y + this.radius * 0.5);
                ctx.closePath();
                ctx.fill();
                // Eye
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(s.x, s.y - 3, 3, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'champion':
                // Large complex shape
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const a = (i / 6) * Math.PI * 2 + time * 0.5;
                    const r = this.radius * (0.8 + Math.sin(a * 3 + time * 2) * 0.2);
                    if (i === 0) ctx.moveTo(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r);
                    else ctx.lineTo(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r);
                }
                ctx.closePath();
                ctx.fill();
                // Crown
                ctx.fillStyle = '#ffd700';
                ctx.beginPath();
                ctx.moveTo(s.x - 8, s.y - this.radius - 2);
                ctx.lineTo(s.x - 4, s.y - this.radius - 8);
                ctx.lineTo(s.x, s.y - this.radius - 4);
                ctx.lineTo(s.x + 4, s.y - this.radius - 8);
                ctx.lineTo(s.x + 8, s.y - this.radius - 2);
                ctx.closePath();
                ctx.fill();
                break;
        }

        // Health bar
        if (this.hp < this.maxHp) {
            const barW = this.radius * 2.5;
            const barH = 3;
            const barY = s.y - this.radius - 10;
            ctx.fillStyle = '#300';
            ctx.fillRect(s.x - barW / 2, barY, barW, barH);
            ctx.fillStyle = this.isBoss ? '#f80' : '#f44';
            ctx.fillRect(s.x - barW / 2, barY, barW * (this.hp / this.maxHp), barH);
        }

        // Boss name
        if (this.isBoss) {
            ctx.font = 'bold 10px Courier New';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffd700';
            ctx.fillText(this.name, s.x, s.y - this.radius - 15);
        }

        ctx.restore();
    }
};

// ======================== ENEMY SPAWNER ========================
UE.EnemySpawner = class {
    constructor() {
        this.enemies = [];
        this.spawnTimer = 0;
        this.waveCount = 0;
        this.championsSpawned = 0;
    }

    update(dt, player, world, staticFog) {
        const C = UE.Config;

        // Spawning
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && this.enemies.length < C.MAX_ENEMIES) {
            this.spawnTimer = this._getSpawnRate(player);
            this._spawnEnemyNearPlayer(player, world, staticFog);
        }

        // Update and cleanup enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            e.update(dt, player, world);

            // Despawn if too far
            const dist = UE.Utils.dist(e.x, e.y, player.x, player.y);
            if (dist > C.ENEMY_DESPAWN_DIST && !e.isBoss) {
                this.enemies.splice(i, 1);
                continue;
            }

            // Clean up dead enemies
            if (e.dead) {
                this._onEnemyDeath(e, player, world);
                this.enemies.splice(i, 1);
            }
        }

        // Enemy separation
        this._separateEnemies(dt);
    }

    _getSpawnRate(player) {
        // Spawn faster in Static, slower near nodes
        let rate = UE.Config.SPAWN_RATE_BASE;
        rate -= player.level * 0.05; // Faster spawns at higher levels
        return Math.max(0.5, rate);
    }

    _spawnEnemyNearPlayer(player, world, staticFog) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 300 + Math.random() * 400;
        const sx = player.x + Math.cos(angle) * dist;
        const sy = player.y + Math.sin(angle) * dist;

        // Only spawn in walkable tiles
        if (!world.isWalkableWorld(sx, sy)) return;

        // Determine enemy type based on location and player level
        const inStatic = staticFog.getCoverage(sx, sy) > 0.5;
        const type = this._pickEnemyType(player.level, inStatic);

        const enemy = new UE.Enemy(sx, sy, type);
        this.enemies.push(enemy);

        // Spawn particles
        if (UE.particles && UE.camera && UE.camera.isVisible(sx, sy, 50)) {
            UE.particles.emit(sx, sy, 8, {
                colors: [enemy.color, '#444'],
                speedMin: 20, speedMax: 60,
                lifeMin: 0.3, lifeMax: 0.6,
                sizeMin: 2, sizeMax: 4
            });
        }
    }

    _pickEnemyType(level, inStatic) {
        const types = UE.EnemyTypes;
        const pool = [];

        // Base enemies always available
        pool.push(types.CRAWLER, types.CRAWLER, types.CRAWLER);

        if (level >= 2) pool.push(types.SPITTER, types.SPITTER);
        if (level >= 3) pool.push(types.SHIFTER);
        if (level >= 5) pool.push(types.BRUTE);
        if (level >= 7) pool.push(types.VOID_WALKER);

        // Static zones have tougher enemies
        if (inStatic) {
            pool.push(types.SHIFTER, types.VOID_WALKER, types.BRUTE);
            if (level >= 8 && Math.random() < 0.05 && this.championsSpawned < 3) {
                this.championsSpawned++;
                return types.CHAMPION;
            }
        }

        return UE.Utils.pick(pool);
    }

    _onEnemyDeath(enemy, player, world) {
        // XP
        player.addXP(enemy.xpReward);

        // Death particles
        if (UE.particles) {
            UE.particles.emit(enemy.x, enemy.y, 20, {
                colors: [enemy.color, '#444', '#222'],
                speedMin: 40, speedMax: 150,
                lifeMin: 0.3, lifeMax: 0.8,
                sizeMin: 2, sizeMax: 5,
                glow: true
            });
        }

        // Loot drop
        if (Math.random() < enemy.lootChance) {
            const loot = UE.generateLoot(player.level, true);
            world.addLootDrop(enemy.x, enemy.y, loot);
        }

        // Boss extra loot
        if (enemy.isBoss) {
            for (let i = 0; i < 3; i++) {
                const loot = UE.generateLoot(player.level + 3, true);
                world.addLootDrop(
                    enemy.x + (Math.random() - 0.5) * 30,
                    enemy.y + (Math.random() - 0.5) * 30,
                    loot
                );
            }
            UE.Utils.screenShake(25);
        }

        if (UE.audio) UE.audio.play('hit');
    }

    _separateEnemies(dt) {
        for (let i = 0; i < this.enemies.length; i++) {
            for (let j = i + 1; j < this.enemies.length; j++) {
                const a = this.enemies[i];
                const b = this.enemies[j];
                const dist = UE.Utils.dist(a.x, a.y, b.x, b.y);
                const minDist = a.radius + b.radius;
                if (dist < minDist && dist > 0) {
                    const angle = UE.Utils.angle(a.x, a.y, b.x, b.y);
                    const push = (minDist - dist) * 0.5;
                    a.x -= Math.cos(angle) * push * dt * 10;
                    a.y -= Math.sin(angle) * push * dt * 10;
                    b.x += Math.cos(angle) * push * dt * 10;
                    b.y += Math.sin(angle) * push * dt * 10;
                }
            }
        }
    }

    draw(ctx, camera, time) {
        for (const e of this.enemies) {
            e.draw(ctx, camera, time);
        }
    }
};

// ======================== PROJECTILES ========================
UE.Projectile = class {
    static updateAll(projectiles, dt, player, enemies, world) {
        for (let i = projectiles.length - 1; i >= 0; i--) {
            const p = projectiles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;

            // Out of bounds or expired
            if (p.life <= 0 || !world.isWalkableWorld(p.x, p.y)) {
                projectiles.splice(i, 1);
                continue;
            }

            if (p.fromEnemy) {
                // Hit player
                const dist = UE.Utils.dist(p.x, p.y, player.x, player.y);
                if (dist < player.radius + p.radius && !player.isDodging && player.invulnTimer <= 0) {
                    const dmg = p.damage - player.getDefense() * 0.3;
                    const actualDmg = player.takeDamage(Math.max(1, dmg), p.x, p.y);
                    if (actualDmg > 0) {
                        if (UE.dmgNumbers) UE.dmgNumbers.add(player.x, player.y, actualDmg, '#f44');
                        if (UE.audio) UE.audio.play('enemyHit');
                        UE.Utils.screenShake(5);
                    }
                    if (player.hp <= 0) player.die();
                    projectiles.splice(i, 1);
                    continue;
                }
            } else {
                // Hit enemies
                for (const e of enemies) {
                    if (e.dead) continue;
                    const dist = UE.Utils.dist(p.x, p.y, e.x, e.y);
                    if (dist < e.radius + p.radius) {
                        const actualDmg = e.takeDamage(p.damage, p.x, p.y);
                        if (UE.dmgNumbers) UE.dmgNumbers.add(e.x, e.y, actualDmg, '#ff8');
                        if (UE.particles) {
                            UE.particles.emit(e.x, e.y, 5, {
                                colors: [e.color, '#fff'],
                                speedMin: 30, speedMax: 80,
                                lifeMin: 0.1, lifeMax: 0.3,
                                sizeMin: 1, sizeMax: 3
                            });
                        }
                        projectiles.splice(i, 1);
                        break;
                    }
                }
            }
        }
    }

    static drawAll(projectiles, ctx, camera) {
        for (const p of projectiles) {
            if (!camera.isVisible(p.x, p.y, 10)) continue;
            const s = camera.worldToScreen(p.x, p.y);
            ctx.save();
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(s.x, s.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
};

console.log('[UE] Entities loaded.');
