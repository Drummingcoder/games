// ================================================================
// THE UNRAVELING EARTH - World, Static Fog, Nodes, Items
// ================================================================

// ======================== TILE TYPES ========================
UE.Tiles = {
    WATER: 0,
    SAND: 1,
    GRASS: 2,
    FOREST: 3,
    DIRT: 4,
    STONE: 5,
    RUINS: 6,
    ROAD: 7,
    VOID: 8
};

UE.TileColors = {
    0: ['#1a3a4a', '#1e3e50', '#163646'],
    1: ['#8a7a5a', '#8e7e5e', '#867656'],
    2: ['#2a4a2a', '#2e4e2e', '#264626'],
    3: ['#1a3a1a', '#1e3e1e', '#163616'],
    4: ['#5a4a3a', '#5e4e3e', '#564636'],
    5: ['#5a5a5a', '#5e5e5e', '#565656'],
    6: ['#4a4a4e', '#4e4e52', '#46464a'],
    7: ['#5a5a56', '#5e5e5a', '#565652'],
    8: ['#111', '#0e0e0e', '#141414']
};

UE.TileWalkable = {
    0: false, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: false
};

// ======================== ITEM DEFINITIONS ========================
UE.ItemRarity = { COMMON: 0, UNCOMMON: 1, RARE: 2, EPIC: 3, LEGENDARY: 4 };
UE.RarityColors = { 0: '#aaa', 1: '#4a4', 2: '#48f', 3: '#a4f', 4: '#fa0' };
UE.RarityNames = { 0: 'Common', 1: 'Uncommon', 2: 'Rare', 3: 'Epic', 4: 'Legendary' };

UE.WeaponDefs = [
    { name: 'Rusty Pipe', damage: 5, speed: 1.0, range: 0, rarity: 0, desc: 'Better than nothing.' },
    { name: 'Kitchen Knife', damage: 8, speed: 1.2, range: 0, rarity: 0, desc: 'Still sharp enough.' },
    { name: 'Machete', damage: 12, speed: 1.0, range: 0, rarity: 1, desc: 'A workhorse blade.' },
    { name: 'Fire Axe', damage: 16, speed: 0.8, range: 0, rarity: 1, desc: 'Heavy. Effective.' },
    { name: 'Weighted Blade', damage: 20, speed: 0.9, range: 0, rarity: 2, desc: 'Infused with Weight. Cuts through Static.' },
    { name: 'Katana', damage: 18, speed: 1.3, range: 0, rarity: 2, desc: 'Swift and deadly.' },
    { name: 'Static Cutter', damage: 28, speed: 1.1, range: 0, rarity: 3, desc: 'Forged from crystallized Static.' },
    { name: 'Node Warden Sword', damage: 24, speed: 1.0, range: 0, rarity: 3, desc: 'Hums with Logic energy.' },
    { name: 'The Unraveler\'s Edge', damage: 40, speed: 1.2, range: 0, rarity: 4, desc: 'Reality bends around its edge.' },
    { name: 'Makeshift Pistol', damage: 7, speed: 1.5, range: 250, rarity: 0, desc: 'Inaccurate but ranged.' },
    { name: 'Salvaged Rifle', damage: 14, speed: 0.7, range: 400, rarity: 1, desc: 'Slow but reaches far.' },
    { name: 'Static Repeater', damage: 18, speed: 1.8, range: 300, rarity: 3, desc: 'Fires shards of crystallized noise.' },
];

UE.ArmorDefs = [
    { name: 'Torn Rags', defense: 2, weight: 1, rarity: 0, desc: 'Barely clothes.' },
    { name: 'Leather Jacket', defense: 5, weight: 3, rarity: 0, desc: 'Some protection.' },
    { name: 'Scrap Armor', defense: 10, weight: 5, rarity: 1, desc: 'Hammered together from debris.' },
    { name: 'Weighted Vest', defense: 15, weight: 10, rarity: 2, desc: 'The fog cannot reach you as easily.' },
    { name: 'Node-Linked Plate', defense: 22, weight: 15, rarity: 3, desc: 'Connected to the network. Pulses with warmth.' },
    { name: 'Reality Anchor Suit', defense: 30, weight: 25, rarity: 4, desc: 'You ARE the Weight.' },
];

UE.RelicDefs = [
    { name: 'Focus Shard', effect: 'xp_boost', value: 0.15, rarity: 1, desc: '+15% XP gain.' },
    { name: 'Memory Crystal', effect: 'muscle_boost', value: 0.2, rarity: 2, desc: '+20% Muscle Memory gain.' },
    { name: 'Stamina Root', effect: 'stamina_regen', value: 10, rarity: 1, desc: '+10 Stamina regen/sec.' },
    { name: 'Vitality Ember', effect: 'hp_regen', value: 2, rarity: 2, desc: '+2 HP regen/sec.' },
    { name: 'Static Eye', effect: 'static_resist', value: 0.5, rarity: 3, desc: '-50% Static damage.' },
    { name: 'Berserker Fang', effect: 'damage_boost', value: 0.25, rarity: 3, desc: '+25% damage.' },
    { name: 'Whisper Fragment', effect: 'crit_chance', value: 0.15, rarity: 2, desc: '+15% critical hit chance.' },
    { name: 'The Machine\'s Eye', effect: 'reveal_map', value: 1, rarity: 4, desc: 'See through the Static on the minimap.' },
];

UE.createItem = function(type, defIndex) {
    let def;
    if (type === 'weapon') def = UE.WeaponDefs[defIndex];
    else if (type === 'armor') def = UE.ArmorDefs[defIndex];
    else if (type === 'relic') def = UE.RelicDefs[defIndex];
    return { type, defIndex, ...def };
};

UE.generateLoot = function(level, inStatic) {
    const lootTable = [];
    const rarityChance = inStatic ? [0.3, 0.3, 0.25, 0.12, 0.03] : [0.5, 0.3, 0.15, 0.04, 0.01];
    let roll = Math.random();
    let rarity = 0;
    let cum = 0;
    for (let i = 0; i < rarityChance.length; i++) {
        cum += rarityChance[i];
        if (roll < cum) { rarity = i; break; }
    }
    // Level scaling - higher levels unlock higher tier items
    const typeRoll = Math.random();
    if (typeRoll < 0.1) {
        // Resource drop instead
        return { type: 'resource', name: UE.Utils.pick(['Scrap', 'Fuel Cell', 'Weighted Ore']),
                 amount: UE.Utils.randInt(1, 3 + level), rarity: 0 };
    }
    if (typeRoll < 0.5) {
        const available = UE.WeaponDefs.filter(w => w.rarity <= rarity);
        if (available.length > 0) {
            const chosen = UE.Utils.pick(available);
            const idx = UE.WeaponDefs.indexOf(chosen);
            return UE.createItem('weapon', idx);
        }
    } else if (typeRoll < 0.8) {
        const available = UE.ArmorDefs.filter(a => a.rarity <= rarity);
        if (available.length > 0) {
            const chosen = UE.Utils.pick(available);
            const idx = UE.ArmorDefs.indexOf(chosen);
            return UE.createItem('armor', idx);
        }
    } else {
        const available = UE.RelicDefs.filter(r => r.rarity <= rarity);
        if (available.length > 0) {
            const chosen = UE.Utils.pick(available);
            const idx = UE.RelicDefs.indexOf(chosen);
            return UE.createItem('relic', idx);
        }
    }
    // Fallback: scrap
    return { type: 'resource', name: 'Scrap', amount: UE.Utils.randInt(1, 3), rarity: 0 };
};

// ======================== WORLD GENERATION ========================
UE.World = class {
    constructor() {
        const C = UE.Config;
        this.w = C.WORLD_W;
        this.h = C.WORLD_H;
        this.tiles = new Uint8Array(this.w * this.h);
        this.decorations = [];
        this.noise1 = new UE.SimplexNoise(12345);
        this.noise2 = new UE.SimplexNoise(67890);
        this.noise3 = new UE.SimplexNoise(11111);
        this.nodes = [];
        this.structures = [];
        this.lootDrops = [];
        this.spawnX = 0;
        this.spawnY = 0;
        this.generate();
    }

    generate() {
        const T = UE.Tiles;
        // Generate terrain
        for (let y = 0; y < this.h; y++) {
            for (let x = 0; x < this.w; x++) {
                const nx = x / this.w;
                const ny = y / this.h;
                const elev = this.noise1.normalized(nx * 4, ny * 4, 5, 0.5, 2.0);
                const moist = this.noise2.normalized(nx * 3 + 100, ny * 3 + 100, 4, 0.5, 2.0);
                const urban = this.noise3.normalized(nx * 6 + 200, ny * 6 + 200, 3, 0.6, 2.5);

                let tile;
                // Edge of world is void
                const edgeDist = Math.min(x, y, this.w - 1 - x, this.h - 1 - y);
                if (edgeDist < 3) {
                    tile = T.VOID;
                } else if (elev < 0.28) {
                    tile = T.WATER;
                } else if (elev < 0.33) {
                    tile = T.SAND;
                } else if (urban > 0.72 && elev > 0.4) {
                    tile = Math.random() < 0.3 ? T.ROAD : T.RUINS;
                } else if (elev > 0.7) {
                    tile = T.STONE;
                } else if (moist > 0.6) {
                    tile = T.FOREST;
                } else if (moist > 0.4) {
                    tile = T.GRASS;
                } else {
                    tile = T.DIRT;
                }
                this.tiles[y * this.w + x] = tile;
            }
        }

        // Place roads connecting some areas
        this._generateRoads();

        // Place nodes
        this._placeNodes();

        // Generate decorations (trees, rocks, ruins)
        this._generateDecorations();

        // Set spawn point near center node
        const centerNode = this.nodes.find(n => n.isMain) || this.nodes[0];
        this.spawnX = centerNode.x;
        this.spawnY = centerNode.y + 3 * UE.Config.TILE_SIZE;
    }

    _generateRoads() {
        const T = UE.Tiles;
        // Create some road paths across the map
        const numRoads = 6;
        for (let r = 0; r < numRoads; r++) {
            let x = UE.Utils.randInt(10, this.w - 10);
            let y = UE.Utils.randInt(10, this.h - 10);
            const targetX = UE.Utils.randInt(10, this.w - 10);
            const targetY = UE.Utils.randInt(10, this.h - 10);
            const steps = 300;
            for (let s = 0; s < steps; s++) {
                if (x >= 3 && x < this.w - 3 && y >= 3 && y < this.h - 3) {
                    const current = this.tiles[y * this.w + x];
                    if (current !== T.WATER && current !== T.VOID) {
                        this.tiles[y * this.w + x] = T.ROAD;
                    }
                }
                if (Math.random() < 0.7) {
                    x += Math.sign(targetX - x);
                } else {
                    y += Math.sign(targetY - y);
                }
                if (x === targetX && y === targetY) break;
            }
        }
    }

    _placeNodes() {
        const TS = UE.Config.TILE_SIZE;
        // Place main node near center
        const cx = Math.floor(this.w / 2);
        const cy = Math.floor(this.h / 2);
        this.nodes.push({
            x: cx * TS + TS / 2,
            y: cy * TS + TS / 2,
            tx: cx, ty: cy,
            active: true,
            isMain: true,
            repairProgress: 1,
            health: 100,
            maxHealth: 100,
            clearRadius: UE.Config.NODE_CLEAR_RADIUS * 2.0,
            pulseTimer: 0,
            requiredSubNodes: 4
        });

        // Clear area around main node
        this._clearAreaForNode(cx, cy, 8);

        // Place 6 sub-nodes spread across the map
        const positions = [
            [0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8],
            [0.5, 0.15], [0.5, 0.85]
        ];
        for (const [fx, fy] of positions) {
            let tx = Math.floor(fx * this.w);
            let ty = Math.floor(fy * this.h);
            // Find walkable ground nearby
            for (let tries = 0; tries < 50; tries++) {
                const checkX = tx + UE.Utils.randInt(-5, 5);
                const checkY = ty + UE.Utils.randInt(-5, 5);
                if (this.isWalkable(checkX, checkY)) {
                    tx = checkX;
                    ty = checkY;
                    break;
                }
            }
            this.nodes.push({
                x: tx * TS + TS / 2,
                y: ty * TS + TS / 2,
                tx, ty,
                active: false,
                isMain: false,
                repairProgress: 0,
                health: 100,
                maxHealth: 100,
                clearRadius: UE.Config.NODE_CLEAR_RADIUS,
                pulseTimer: 0
            });
            this._clearAreaForNode(tx, ty, 4);
        }

        // Activate the starting sub-node (closest to center)
        let closest = null, closestDist = Infinity;
        for (const n of this.nodes) {
            if (n.isMain) continue;
            const d = UE.Utils.dist(n.x, n.y, this.nodes[0].x, this.nodes[0].y);
            if (d < closestDist) { closestDist = d; closest = n; }
        }
        if (closest) {
            closest.active = true;
            closest.repairProgress = 1;
        }
    }

    _clearAreaForNode(cx, cy, radius) {
        const T = UE.Tiles;
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const x = cx + dx;
                const y = cy + dy;
                if (x >= 0 && x < this.w && y >= 0 && y < this.h) {
                    if (dx * dx + dy * dy <= radius * radius) {
                        const current = this.tiles[y * this.w + x];
                        if (current === T.WATER || current === T.VOID) continue;
                        this.tiles[y * this.w + x] = Math.random() < 0.3 ? T.STONE : T.DIRT;
                    }
                }
            }
        }
    }

    _generateDecorations() {
        const TS = UE.Config.TILE_SIZE;
        const T = UE.Tiles;
        for (let y = 0; y < this.h; y++) {
            for (let x = 0; x < this.w; x++) {
                const tile = this.tiles[y * this.w + x];
                if (tile === T.FOREST && Math.random() < 0.35) {
                    this.decorations.push({
                        x: x * TS + Math.random() * TS,
                        y: y * TS + Math.random() * TS,
                        type: 'tree',
                        size: 4 + Math.random() * 6,
                        color: UE.Utils.pick(['#1a5a1a', '#2a6a2a', '#1a4a1a', '#0e3e0e'])
                    });
                } else if (tile === T.STONE && Math.random() < 0.15) {
                    this.decorations.push({
                        x: x * TS + Math.random() * TS,
                        y: y * TS + Math.random() * TS,
                        type: 'rock',
                        size: 3 + Math.random() * 5,
                        color: UE.Utils.pick(['#666', '#777', '#555'])
                    });
                } else if (tile === T.RUINS && Math.random() < 0.2) {
                    this.decorations.push({
                        x: x * TS + Math.random() * TS,
                        y: y * TS + Math.random() * TS,
                        type: 'rubble',
                        size: 5 + Math.random() * 8,
                        color: UE.Utils.pick(['#4a4a50', '#555560', '#3a3a40'])
                    });
                } else if (tile === T.GRASS && Math.random() < 0.03) {
                    this.decorations.push({
                        x: x * TS + Math.random() * TS,
                        y: y * TS + Math.random() * TS,
                        type: 'bush',
                        size: 3 + Math.random() * 3,
                        color: UE.Utils.pick(['#3a6a3a', '#2a5a2a'])
                    });
                }
            }
        }
    }

    getTile(tx, ty) {
        if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) return UE.Tiles.VOID;
        return this.tiles[ty * this.w + tx];
    }

    isWalkable(tx, ty) {
        return UE.TileWalkable[this.getTile(tx, ty)] || false;
    }

    isWalkableWorld(wx, wy) {
        const t = UE.Utils.worldToTile(wx, wy);
        return this.isWalkable(t.tx, t.ty);
    }

    addLootDrop(x, y, item) {
        this.lootDrops.push({
            x, y, item,
            bobTimer: Math.random() * Math.PI * 2,
            life: 60, // seconds before despawn
            magnetized: false
        });
    }

    addStructure(tx, ty, type) {
        const TS = UE.Config.TILE_SIZE;
        const existing = this.structures.find(s => s.tx === tx && s.ty === ty);
        if (existing) return false;
        if (!this.isWalkable(tx, ty)) return false;

        const structure = {
            tx, ty,
            x: tx * TS + TS / 2,
            y: ty * TS + TS / 2,
            type,
            health: type === 'wall' ? 50 : (type === 'turret' ? 30 : 40),
            maxHealth: type === 'wall' ? 50 : (type === 'turret' ? 30 : 40),
            fireTimer: 0,
            built: true
        };
        this.structures.push(structure);
        return true;
    }

    removeStructure(tx, ty) {
        const idx = this.structures.findIndex(s => s.tx === tx && s.ty === ty);
        if (idx >= 0) { this.structures.splice(idx, 1); return true; }
        return false;
    }

    drawTiles(ctx, camera) {
        const C = UE.Config;
        const TS = C.TILE_SIZE;
        const bounds = camera.getViewBounds(TS);
        const startTX = Math.max(0, Math.floor(bounds.left / TS));
        const endTX = Math.min(this.w - 1, Math.ceil(bounds.right / TS));
        const startTY = Math.max(0, Math.floor(bounds.top / TS));
        const endTY = Math.min(this.h - 1, Math.ceil(bounds.bottom / TS));

        for (let ty = startTY; ty <= endTY; ty++) {
            for (let tx = startTX; tx <= endTX; tx++) {
                const tile = this.tiles[ty * this.w + tx];
                const colors = UE.TileColors[tile];
                const colorIdx = ((tx + ty * 7) % 3);
                const s = camera.worldToScreen(tx * TS, ty * TS);
                ctx.fillStyle = colors[colorIdx];
                ctx.fillRect(Math.floor(s.x), Math.floor(s.y), TS + 1, TS + 1);
            }
        }
    }

    drawDecorations(ctx, camera) {
        for (const d of this.decorations) {
            if (!camera.isVisible(d.x, d.y, 20)) continue;
            const s = camera.worldToScreen(d.x, d.y);
            ctx.save();
            switch (d.type) {
                case 'tree':
                    // Trunk
                    ctx.fillStyle = '#3a2a1a';
                    ctx.fillRect(s.x - 1, s.y - 2, 3, 6);
                    // Canopy
                    ctx.fillStyle = d.color;
                    ctx.beginPath();
                    ctx.arc(s.x, s.y - 4, d.size, 0, Math.PI * 2);
                    ctx.fill();
                    break;
                case 'rock':
                    ctx.fillStyle = d.color;
                    ctx.beginPath();
                    ctx.ellipse(s.x, s.y, d.size, d.size * 0.7, 0, 0, Math.PI * 2);
                    ctx.fill();
                    break;
                case 'rubble':
                    ctx.fillStyle = d.color;
                    ctx.fillRect(s.x - d.size / 2, s.y - d.size / 3, d.size, d.size * 0.6);
                    ctx.fillStyle = '#3a3a3e';
                    ctx.fillRect(s.x - d.size / 3, s.y - d.size / 2, d.size * 0.4, d.size * 0.3);
                    break;
                case 'bush':
                    ctx.fillStyle = d.color;
                    ctx.beginPath();
                    ctx.arc(s.x, s.y, d.size, 0, Math.PI * 2);
                    ctx.fill();
                    break;
            }
            ctx.restore();
        }
    }

    drawNodes(ctx, camera, time) {
        for (const node of this.nodes) {
            if (!camera.isVisible(node.x, node.y, 100)) continue;
            const s = camera.worldToScreen(node.x, node.y);
            const pulse = Math.sin(time * 2 + node.x) * 0.3 + 0.7;

            ctx.save();
            if (node.active) {
                // Active node - golden glow
                const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 40);
                grad.addColorStop(0, `rgba(255, 200, 50, ${0.3 * pulse})`);
                grad.addColorStop(1, 'rgba(255, 200, 50, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(s.x, s.y, 40, 0, Math.PI * 2);
                ctx.fill();

                // Crystal
                ctx.fillStyle = `rgba(255, 220, 80, ${0.8 + pulse * 0.2})`;
                ctx.shadowColor = '#fda';
                ctx.shadowBlur = 15;
            } else {
                // Dormant node - grey
                ctx.fillStyle = `rgba(100, 100, 110, ${0.6 + pulse * 0.1})`;
                ctx.shadowColor = '#666';
                ctx.shadowBlur = 5;
            }

            // Draw crystal shape
            ctx.beginPath();
            const size = node.isMain ? 14 : 10;
            ctx.moveTo(s.x, s.y - size * 1.8);
            ctx.lineTo(s.x + size, s.y);
            ctx.lineTo(s.x, s.y + size * 0.5);
            ctx.lineTo(s.x - size, s.y);
            ctx.closePath();
            ctx.fill();

            // Node base
            ctx.shadowBlur = 0;
            ctx.fillStyle = node.active ? '#554420' : '#333';
            ctx.fillRect(s.x - size * 1.2, s.y + size * 0.5, size * 2.4, 4);

            // Repair progress bar
            if (!node.active && node.repairProgress > 0) {
                ctx.fillStyle = '#333';
                ctx.fillRect(s.x - 15, s.y + size + 8, 30, 4);
                ctx.fillStyle = '#fa0';
                ctx.fillRect(s.x - 15, s.y + size + 8, 30 * node.repairProgress, 4);
            }

            // Label
            ctx.font = '9px Courier New';
            ctx.textAlign = 'center';
            ctx.fillStyle = node.active ? '#fda' : '#888';
            ctx.fillText(node.isMain ? 'MAIN NODE' : 'SUB-NODE', s.x, s.y - size * 2 - 4);
            if (!node.active) {
                ctx.fillStyle = '#666';
                ctx.fillText('[E] Repair', s.x, s.y + size + 20);
            }

            ctx.restore();
        }
    }

    drawStructures(ctx, camera, time) {
        const TS = UE.Config.TILE_SIZE;
        for (const s of this.structures) {
            if (!camera.isVisible(s.x, s.y, TS)) continue;
            const sc = camera.worldToScreen(s.x, s.y);
            ctx.save();
            switch (s.type) {
                case 'wall':
                    ctx.fillStyle = '#6a6a6e';
                    ctx.fillRect(sc.x - TS / 2, sc.y - TS / 2, TS, TS);
                    ctx.strokeStyle = '#888';
                    ctx.strokeRect(sc.x - TS / 2, sc.y - TS / 2, TS, TS);
                    break;
                case 'turret':
                    ctx.fillStyle = '#4a4a50';
                    ctx.fillRect(sc.x - 8, sc.y - 8, 16, 16);
                    ctx.fillStyle = '#8a8a90';
                    const turretAngle = time * 0.5;
                    ctx.beginPath();
                    ctx.moveTo(sc.x, sc.y);
                    ctx.lineTo(sc.x + Math.cos(turretAngle) * 10, sc.y + Math.sin(turretAngle) * 10);
                    ctx.strokeStyle = '#aaa';
                    ctx.lineWidth = 3;
                    ctx.stroke();
                    // Range indicator
                    ctx.strokeStyle = 'rgba(100, 200, 100, 0.08)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.arc(sc.x, sc.y, UE.Config.TURRET_RANGE, 0, Math.PI * 2);
                    ctx.stroke();
                    break;
                case 'generator':
                    ctx.fillStyle = '#3a5a3a';
                    ctx.fillRect(sc.x - 10, sc.y - 10, 20, 20);
                    const genPulse = Math.sin(time * 3) * 0.3 + 0.7;
                    ctx.fillStyle = `rgba(100, 255, 100, ${genPulse * 0.5})`;
                    ctx.beginPath();
                    ctx.arc(sc.x, sc.y, 4, 0, Math.PI * 2);
                    ctx.fill();
                    break;
            }
            // Health bar if damaged
            if (s.health < s.maxHealth) {
                ctx.fillStyle = '#300';
                ctx.fillRect(sc.x - 10, sc.y - TS / 2 - 5, 20, 3);
                ctx.fillStyle = '#f44';
                ctx.fillRect(sc.x - 10, sc.y - TS / 2 - 5, 20 * (s.health / s.maxHealth), 3);
            }
            ctx.restore();
        }
    }

    drawLootDrops(ctx, camera, time) {
        for (const drop of this.lootDrops) {
            if (!camera.isVisible(drop.x, drop.y, 20)) continue;
            const s = camera.worldToScreen(drop.x, drop.y);
            const bob = Math.sin(time * 3 + drop.bobTimer) * 3;
            const rarity = drop.item.rarity || 0;
            const color = UE.RarityColors[rarity];

            ctx.save();
            ctx.shadowColor = color;
            ctx.shadowBlur = 8;
            ctx.fillStyle = color;

            if (drop.item.type === 'resource') {
                // Resource - small square
                ctx.fillRect(s.x - 4, s.y - 4 + bob, 8, 8);
            } else {
                // Equipment - diamond shape
                ctx.beginPath();
                ctx.moveTo(s.x, s.y - 6 + bob);
                ctx.lineTo(s.x + 5, s.y + bob);
                ctx.lineTo(s.x, s.y + 6 + bob);
                ctx.lineTo(s.x - 5, s.y + bob);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
        }
    }
};

// ======================== STATIC FOG ========================
UE.StaticFog = class {
    constructor(world) {
        this.world = world;
        this.w = world.w;
        this.h = world.h;
        // Coverage map: 0 = clear, 1 = full static
        this.coverage = new Float32Array(this.w * this.h);
        this.noiseCanvas = document.createElement('canvas');
        this.noiseCanvas.width = 128;
        this.noiseCanvas.height = 128;
        this.noiseCtx = this.noiseCanvas.getContext('2d');
        this.noiseTimer = 0;
        this.init();
    }

    init() {
        // Start with most of the world covered in static
        for (let y = 0; y < this.h; y++) {
            for (let x = 0; x < this.w; x++) {
                this.coverage[y * this.w + x] = 1.0;
            }
        }
        // Clear around active nodes
        this.updateCoverage();
    }

    updateCoverage() {
        // Reset to full static
        this.coverage.fill(1.0);

        // Clear around active nodes
        for (const node of this.world.nodes) {
            if (!node.active) continue;
            const radius = node.clearRadius;
            const centerTX = node.tx;
            const centerTY = node.ty;

            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const tx = centerTX + dx;
                    const ty = centerTY + dy;
                    if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) continue;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < radius) {
                        const fade = UE.Utils.clamp((dist / radius - 0.7) / 0.3, 0, 1);
                        const current = this.coverage[ty * this.w + tx];
                        this.coverage[ty * this.w + tx] = Math.min(current, fade);
                    }
                }
            }
        }
    }

    getCoverage(wx, wy) {
        const t = UE.Utils.worldToTile(wx, wy);
        if (t.tx < 0 || t.tx >= this.w || t.ty < 0 || t.ty >= this.h) return 1.0;
        return this.coverage[t.ty * this.w + t.tx];
    }

    updateNoise(time) {
        this.noiseTimer += 1;
        if (this.noiseTimer % 3 !== 0) return; // Update every 3 frames
        const ctx = this.noiseCtx;
        const w = this.noiseCanvas.width;
        const h = this.noiseCanvas.height;
        const imgData = ctx.createImageData(w, h);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
            const v = Math.random() * 180 + 40;
            data[i] = v;
            data[i + 1] = v;
            data[i + 2] = v + Math.random() * 20;
            data[i + 3] = 255;
        }
        ctx.putImageData(imgData, 0, 0);
    }

    draw(ctx, camera) {
        const C = UE.Config;
        const TS = C.TILE_SIZE;
        const bounds = camera.getViewBounds(TS);
        const startTX = Math.max(0, Math.floor(bounds.left / TS));
        const endTX = Math.min(this.w - 1, Math.ceil(bounds.right / TS));
        const startTY = Math.max(0, Math.floor(bounds.top / TS));
        const endTY = Math.min(this.h - 1, Math.ceil(bounds.bottom / TS));

        // Draw static noise pattern over covered areas
        for (let ty = startTY; ty <= endTY; ty++) {
            for (let tx = startTX; tx <= endTX; tx++) {
                const cov = this.coverage[ty * this.w + tx];
                if (cov < 0.05) continue;

                const s = camera.worldToScreen(tx * TS, ty * TS);
                const sx = Math.floor(s.x);
                const sy = Math.floor(s.y);

                // Draw noise texture with alpha based on coverage
                ctx.save();
                ctx.globalAlpha = cov * 0.75;
                ctx.drawImage(this.noiseCanvas,
                    (tx * 17) % 96, (ty * 13) % 96, 32, 32,
                    sx, sy, TS + 1, TS + 1
                );
                ctx.restore();

                // Add colored tint
                if (cov > 0.5) {
                    ctx.save();
                    ctx.globalAlpha = (cov - 0.5) * 0.3;
                    ctx.fillStyle = '#2a2a3a';
                    ctx.fillRect(sx, sy, TS + 1, TS + 1);
                    ctx.restore();
                }
            }
        }
    }
};

console.log('[UE] World module loaded.');
