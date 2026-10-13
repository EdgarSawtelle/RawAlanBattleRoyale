// ============================================================================
//  cards.js  -  one plain object per card. ADDING A CARD = ADDING ONE OBJECT HERE.
//  (These are the 10 version-1 cards from docs/CARDS.md, with its "more extreme" numbers.)
//
//  {
//    id:          unique stable string
//    name:        text shown to players
//    rarity:      'common' | 'uncommon' | 'rare'   (offer weights: config.match.rarityWeights)
//    maxStacks:   how many times one player may own it (default 1)
//    description: one punchy line for the UI
//    lines:       [{ t: 'text', good: true|false }]  stat lines on the card (green = upside, rust = downside)
//    icon:        name of a pixel icon drawn by the UI (client/icons.js)
//    mods:        stat modifiers (optional). For every stat:
//                   value = clamp( (base + sum of all `add`) * (1 + sum of (mul - 1)) )
//                 i.e. percentages from different cards ADD (two `mul: 2` give x3). The clamp, the burst cap
//                 and the magazine budget live in config.js (statLimits / caps) and sim/cardfx.js.
//                 Stat keys: maxHp damage fireRate magazine reloadTime bulletSpeed bulletRadius bulletGravity
//                 bulletsPerShot spread fanAngle bounces knockback knockbackTaken recoil bulletLifetime moveSpeed
//                 jumpVelocity size blockCooldown blockWindow          (base values live in config.js)
//    hooks:       optional functions called by the simulation at the right moment:
//                 onShoot, onBulletHit, onBounce, onBlock, onDamaged, onKill.
//  }
//
//  A hook receives one `ctx` object:
//    ctx.owner / ctx.ownerIndex   the player who owns the card
//    ctx.target / ctx.targetIndex the other player involved (hit / killed / damaged / blocked), if any
//    ctx.bullet                   the bullet involved, if any. You may modify its fields:
//                                 damage, vx, vy, bouncesLeft, style, explosive, ... (see sim/combat.js spawnBullet)
//    ctx.bullets                  (onShoot only) the bullets just fired by this trigger pull
//    ctx.amount, ctx.source       (onDamaged) damage taken and where it came from
//    ctx.stacks                   how many copies of this card the owner has
//    ctx.store                    a per-player, per-card plain object for counters / cooldowns
//    ctx.rng()                    seeded random number 0..1 (NEVER use Math.random in a hook)
//    ctx.spawnBullet({...})       fire an extra bullet (returns null if the live-bullet cap is reached)
//    ctx.explode(x, y, radius, damage, {shotId})   damages players AND destructible blocks (also the owner!)
//    ctx.reflect(bullet, {speedMul, damageMul})    (onBlock) send a blocked bullet back at its shooter
//    ctx.addTimed(mods, seconds)  temporary stat modifiers (refreshed, not stacked, by the same card)
//    ctx.heal(player, amount), ctx.applyImpulse(player, vx, vy)
//  Always go through ctx so the matching events reach the renderer.
// ============================================================================

import { CONFIG } from './config.js';

const DEG = Math.PI / 180;

export const CARDS = [
  {
    id: 'hairtrigger', name: 'Hair Trigger', rarity: 'common', maxStacks: 2, icon: 'hairtrigger',
    description: 'Spray twice as many, half as strong.',
    lines: [{ t: '+100% fire rate', good: true }, { t: '+100% ammo', good: true }, { t: '-40% damage', good: false }, { t: '+4 deg spread', good: false }],
    mods: { fireRate: { mul: 2 }, magazine: { mul: 2 }, damage: { mul: 0.6 }, spread: { add: 4 * DEG } },
  },
  {
    id: 'pinball', name: 'Pinball', rarity: 'common', maxStacks: 2, icon: 'pinball',
    description: 'Bullets bounce four times and hit harder every time, you included.',
    lines: [{ t: '+4 bounces', good: true }, { t: '+30% damage per bounce', good: true }, { t: '-25% damage', good: false }, { t: 'bounced bullets hurt you', good: false }],
    mods: { bounces: { add: 4 }, damage: { mul: 0.75 }, bulletLifetime: { add: 1 } },
    hooks: {
      onShoot(ctx) { for (const b of ctx.bullets) if (b.style === 'amber') b.style = 'pale'; },
      onBounce(ctx) {
        const b = ctx.bullet;
        if (b.generation > 0) return;                              // split children do not inherit the growth
        b.damage += b.launchDamage * 0.3 * ctx.stacks;             // +30% of launch damage per bounce (+60% with two copies)
      },
    },
  },
  {
    id: 'thickskin', name: 'Thick Skin', rarity: 'common', maxStacks: 2, icon: 'thickskin',
    description: 'Twice the health, a bigger target, and a long fall.',
    lines: [{ t: '+100% max HP', good: true }, { t: '-25% move speed', good: false }, { t: '+30% size', good: false }, { t: 'falls cost twice as much', good: false }],
    mods: { maxHp: { mul: 2 }, size: { mul: 1.3 }, moveSpeed: { mul: 0.75 } },
  },
  {
    id: 'tightguard', name: 'Tight Guard', rarity: 'common', maxStacks: 1, icon: 'tightguard',
    description: 'Block whenever you like, but only for a heartbeat.',
    lines: [{ t: '-75% block cooldown', good: true }, { t: '-50% block window', good: false }],
    mods: { blockCooldown: { mul: 0.25 }, blockWindow: { mul: 0.5 } },
  },
  {
    id: 'scramble', name: 'Scramble', rarity: 'common', maxStacks: 1, icon: 'scramble',
    description: 'Getting hit lights a fire under you.',
    lines: [{ t: 'after a hit: +100% speed', good: true }, { t: 'after a hit: +50% fire rate', good: true }, { t: '-20% max HP', good: false }],
    mods: { maxHp: { mul: 0.8 } },
    hooks: {
      onDamaged(ctx) {
        if (ctx.amount > 0) ctx.addTimed({ moveSpeed: { mul: 2 }, fireRate: { mul: 1.5 } }, 2.5);   // refreshes, does not stack
      },
    },
  },
  {
    id: 'featherweight', name: 'Featherweight', rarity: 'uncommon', maxStacks: 1, icon: 'featherweight',
    description: 'A speck that darts around. Blown away by anything.',
    lines: [{ t: '-40% size', good: true }, { t: '+40% move speed', good: true }, { t: '+15% jump', good: true }, { t: '-40% max HP', good: false }, { t: 'knocked back twice as far', good: false }],
    mods: { size: { mul: 0.6 }, moveSpeed: { mul: 1.4 }, jumpVelocity: { mul: 1.15 }, maxHp: { mul: 0.6 }, knockbackTaken: { mul: 2 } },
  },
  {
    id: 'powderkeg', name: 'Powder Keg', rarity: 'uncommon', maxStacks: 1, icon: 'powderkeg',
    description: "Every bullet is a bomb. Don't stand too close.",
    lines: [{ t: 'bullets explode on impact', good: true }, { t: '+25% damage', good: true }, { t: 'blasts hurt you too', good: false }, { t: '-20% bullet speed', good: false }, { t: '+25% reload time', good: false }],
    mods: { damage: { mul: 1.25 }, bulletSpeed: { mul: 0.8 }, reloadTime: { mul: 1.25 } },
    hooks: {
      onShoot(ctx) { for (const b of ctx.bullets) { b.explosive = true; b.style = 'ember'; } },
      onBulletHit(ctx) {
        const b = ctx.bullet;
        if (!b.explosive) return;
        const child = b.generation > 0;                              // split children explode at 60% radius and damage
        const damage = b.damage * (child ? 0.6 / 0.7 : 1);
        b.damage = 0;                                                // the blast replaces the direct hit (no double damage)
        ctx.explode(b.x, b.y, (child ? 0.6 : 1) * 96, damage, { shotId: b.shotId });
      },
    },
  },
  {
    id: 'pepperpot', name: 'Pepperpot', rarity: 'uncommon', maxStacks: 1, icon: 'pepperpot',
    description: 'Five pellets per shot. Get close.',
    lines: [{ t: '5 pellets per shot', good: true }, { t: '-60% damage per pellet', good: false }, { t: 'short range', good: false }],
    // pellets fan out across +-14 degrees (plus 1.5 degrees of jitter); lifetime 3 s - 2.64 s = 0.36 s (range about 540 units at 1500 u/s)
    mods: { bulletsPerShot: { add: 4 }, damage: { mul: 0.4 }, bulletLifetime: { add: -2.64 }, fanAngle: { add: 14 * DEG }, spread: { add: 1.5 * DEG } },
  },
  {
    id: 'prismshot', name: 'Prism Shot', rarity: 'rare', maxStacks: 1, icon: 'prismshot',
    description: "A bullet's first bounce splits it into three.",
    lines: [{ t: '+2 bounces', good: true }, { t: 'first bounce: 3 bullets', good: true }, { t: 'children hit for 70%', good: false }, { t: 'bounced bullets hurt you', good: false }],
    mods: { bounces: { add: 2 } },
    hooks: {
      onBounce(ctx) {
        const b = ctx.bullet;
        if (b.generation > 0 || b.bounces !== 1) return;            // only a first bounce of an original bullet splits
        const base = Math.atan2(b.vy, b.vx), speed = Math.hypot(b.vx, b.vy);
        for (const off of [-25 * DEG, 25 * DEG]) {
          ctx.spawnBullet({ x: b.x, y: b.y, angle: base + off, speed, damage: b.damage * 0.7, generation: 1, shotId: b.shotId,
            bounces: b.bouncesLeft, age: b.age, style: b.style, radius: b.r, explosive: b.explosive, immune: 0 });
        }
      },
    },
  },
  {
    id: 'returnpolicy', name: 'Return Policy', rarity: 'rare', maxStacks: 1, icon: 'returnpolicy',
    description: 'Blocked bullets come back, aimed at whoever fired them, faster and harder.',
    lines: [{ t: 'blocked bullets return x1.5', good: true }, { t: '+50% block cooldown', good: false }],
    mods: { blockCooldown: { mul: 1.5 } },
    hooks: {
      onBlock(ctx) { ctx.reflect(ctx.bullet, { speedMul: 1.5, damageMul: 1.5 }); },
    },
  },

  // ======================================================================================================================
  //  The 20 cards added after version 1 (see docs/CARDS.md for the design, the archetype map, combos and counters).
  //  New machinery they use (all generic, in sim/): `dynamic` (modifiers that follow a state), hooks onDealt / onHazard / onRingOut /
  //  onBarrel / onRoundEnd / onTimer, ctx.removeCard / schedule / spawnSlab / hurt / fx, stats airJumps / wallGlide / hazardTaken / blockDamage.
  // ======================================================================================================================

  // ---- common --------------------------------------------------------------------------------------------------------
  {
    id: 'needlerounds', name: 'Needle Rounds', rarity: 'common', maxStacks: 1, icon: 'needlerounds', tags: ['sniper', 'glass'],
    description: 'Flat, blindingly fast bullets. Only two in the clip.',
    lines: [{ t: '+100% bullet speed', good: true }, { t: 'no bullet drop', good: true }, { t: '+50% damage', good: true }, { t: '-3 ammo', good: false }],
    mods: { bulletSpeed: { mul: 2 }, bulletGravity: { mul: 0 }, damage: { mul: 1.5 }, bulletRadius: { mul: 0.6 }, magazine: { add: -3 } },
    hooks: { onShoot(ctx) { for (const b of ctx.bullets) b.style = 'steel'; } },
  },
  {
    id: 'cloudstep', name: 'Cloudstep', rarity: 'common', maxStacks: 1, icon: 'cloudstep', tags: ['mobility'],
    description: 'Jump twice more in mid-air. The ground feels heavy.',
    lines: [{ t: '+2 air jumps', good: true }, { t: '-20% move speed', good: false }, { t: '-20% max HP', good: false }],
    mods: { airJumps: { add: 2 }, moveSpeed: { mul: 0.8 }, maxHp: { mul: 0.8 } },
  },
  {
    id: 'paperdragon', name: 'Paper Dragon', rarity: 'common', maxStacks: 1, icon: 'paperdragon', tags: ['glass'],
    description: 'Hits like a dragon. Breaks like paper.',
    lines: [{ t: '+100% damage', good: true }, { t: '-40% max HP', good: false }, { t: '-2 ammo', good: false }],
    mods: { damage: { mul: 2 }, maxHp: { mul: 0.6 }, magazine: { add: -2 } },
  },
  {
    id: 'anchor', name: 'Anchor', rarity: 'common', maxStacks: 1, icon: 'anchor', tags: ['tank', 'counter'],
    description: 'Planted. Hits, blasts and hazards barely push you.',
    lines: [{ t: '-80% knockback taken', good: true }, { t: '+30% max HP', good: true }, { t: '-15% move speed', good: false }, { t: '-15% jump height', good: false }],
    mods: { knockbackTaken: { mul: 0.2 }, maxHp: { mul: 1.3 }, moveSpeed: { mul: 0.85 }, jumpVelocity: { mul: 0.85 } },
  },
  {
    id: 'limpet', name: 'Limpet', rarity: 'common', maxStacks: 1, icon: 'limpet', tags: ['mobility', 'sniper'],
    description: 'Stick to a wall and you stop sliding. Clinging makes you mean.',
    lines: [{ t: 'hang still on walls', good: true }, { t: 'clinging: +40% damage', good: true }, { t: 'clinging: -50% knockback', good: true }, { t: '-15% max HP', good: false }],
    mods: { wallGlide: { mul: 0 }, maxHp: { mul: 0.85 } },
    dynamic: {
      key: (p) => (!p.grounded && p.wallDir !== 0 ? 1 : 0),
      mods: () => ({ damage: { mul: 1.4 }, knockbackTaken: { mul: 0.5 } }),
    },
  },
  {
    id: 'salamander', name: 'Salamander', rarity: 'common', maxStacks: 1, icon: 'salamander', tags: ['mobility', 'counter'],
    description: 'Spikes, saws and embers cannot hurt you. Touching them lights you up.',
    lines: [{ t: 'hazards do no damage', good: true }, { t: 'touch one: +50% fire rate, +30% speed', good: true }, { t: '-15% max HP', good: false }],
    mods: { hazardTaken: { mul: 0 }, maxHp: { mul: 0.85 } },
    hooks: { onHazard(ctx) { ctx.addTimed({ fireRate: { mul: 1.5 }, moveSpeed: { mul: 1.3 } }, 3); } },
  },

  // ---- uncommon ------------------------------------------------------------------------------------------------------
  {
    id: 'tithe', name: 'Tithe', rarity: 'uncommon', maxStacks: 1, icon: 'tithe', tags: ['tank'],
    description: 'Every hit heals you for what it takes.',
    lines: [{ t: 'heal 100% of damage dealt', good: true }, { t: 'max 70 HP healed per round', good: true }, { t: '-45% damage', good: false }],
    mods: { damage: { mul: 0.55 } },
    hooks: { onDealt(ctx) { if (ctx.amount > 0) ctx.heal(ctx.owner, ctx.amount); } },
  },
  {
    id: 'wreckingball', name: 'Wrecking Ball', rarity: 'uncommon', maxStacks: 1, icon: 'wreckingball', tags: ['ringout'],
    description: 'Huge, slow bullets that launch people off the map.',
    lines: [{ t: 'bullets 3x as big', good: true }, { t: '3x knockback', good: true }, { t: '-25% bullet speed', good: false }, { t: '-40% fire rate', good: false }],
    mods: { bulletRadius: { mul: 3 }, knockback: { mul: 3 }, bulletSpeed: { mul: 0.75 }, fireRate: { mul: 0.6 } },
  },
  {
    id: 'trebuchet', name: 'Trebuchet', rarity: 'uncommon', maxStacks: 1, icon: 'trebuchet', tags: ['explosive', 'sniper'], preview: true,
    description: 'Lob heavy shells high over cover. Your aim shows the arc.',
    lines: [{ t: 'shells arc 3x as steeply', good: true }, { t: '+60% damage', good: true }, { t: '+50% bullet size', good: true }, { t: '-3 ammo', good: false }],
    mods: { bulletGravity: { mul: 3 }, bulletSpeed: { mul: 1.25 }, damage: { mul: 1.6 }, bulletRadius: { mul: 1.5 }, magazine: { add: -3 } },
  },
  {
    id: 'kickback', name: 'Kickback', rarity: 'uncommon', maxStacks: 1, icon: 'kickback', tags: ['mobility', 'ringout'],
    description: 'Every shot shoves you backwards. Every hit shoves them harder.',
    lines: [{ t: 'shots push you back', good: true }, { t: '2x knockback dealt', good: true }, { t: 'you can push yourself off the map', good: false }],
    mods: { recoil: { add: 380 }, knockback: { mul: 2 } },
  },
  {
    id: 'sleight', name: 'Sleight of Hand', rarity: 'uncommon', maxStacks: 1, icon: 'sleight', tags: ['parry'],
    description: 'Block a bullet and your gun is full again.',
    lines: [{ t: 'a blocked bullet refills the magazine', good: true }, { t: '+50% reload time', good: false }],
    mods: { reloadTime: { mul: 1.5 } },
    hooks: {
      onBlock(ctx) {
        const p = ctx.owner;
        if (ctx.store.seq === p.blockSeq) return;                    // once per block
        ctx.store.seq = p.blockSeq;
        p.ammo = p.stats.magazine; p.reloadLeft = 0;
        ctx.fx('refill', { x: p.x, y: p.y });
      },
    },
  },
  {
    id: 'porcupine', name: 'Porcupine', rarity: 'uncommon', maxStacks: 1, icon: 'porcupine', tags: ['tank', 'counter'],
    description: 'Hit me and I hit back, ten ways.',
    lines: [{ t: 'when hit: ring of 10 shards', good: true }, { t: 'shards 10 damage each, 1 s cooldown', good: true }, { t: '-20% move speed', good: false }],
    mods: { moveSpeed: { mul: 0.8 } },
    hooks: {
      onDamaged(ctx) {
        const p = ctx.owner;
        if ((ctx.source !== 'bullet' && ctx.source !== 'explosion') || ctx.targetIndex < 0 || ctx.targetIndex === p.index || ctx.lethal) return;
        if (ctx.state.tick < (ctx.store.next || 0)) return;           // 1 s between rings
        ctx.store.next = ctx.state.tick + 60;
        const shot = ctx.state.nextShot++;
        for (let i = 0; i < 10; i++) {
          ctx.spawnBullet({ x: p.x, y: p.y, angle: i * (Math.PI / 5) + 0.3, speed: 900, damage: 10, gravity: 0, lifetime: 0.4, bounces: 0, radius: 4, generation: 1, shotId: shot, style: 'thorn' });
        }
        ctx.fx('ring', { x: p.x, y: p.y });
      },
    },
  },
  {
    id: 'cornered', name: 'Cornered', rarity: 'uncommon', maxStacks: 1, icon: 'cornered', tags: ['glass', 'tank'],
    description: 'The closer to death, the nastier you get.',
    lines: [{ t: 'at 40% HP or less: +60% damage', good: true }, { t: 'at 40% HP or less: +50% fire rate', good: true }, { t: 'at 40% HP or less: +30% speed', good: true }],
    dynamic: {
      key: (p) => (p.hp <= 0.4 * p.stats.maxHp ? 1 : 0),
      mods: () => ({ damage: { mul: 1.6 }, fireRate: { mul: 1.5 }, moveSpeed: { mul: 1.3 } }),
    },
  },
  {
    id: 'demopermit', name: 'Demo Permit', rarity: 'uncommon', maxStacks: 2, icon: 'demopermit', tags: ['explosive'],
    description: 'Barrels you shoot blast wider and spare you. Crates crumble.',
    lines: [{ t: 'barrel blasts: +40% radius', good: true }, { t: 'your blasts never hurt you', good: true }, { t: '2.5x vs crates and barrels', good: true }, { t: '-15% damage', good: false }],
    mods: { damage: { mul: 0.85 }, blockDamage: { mul: 2.5 } },
    hooks: {
      onBarrel(ctx) {
        ctx.blast.radius *= 1 + 0.4 * ctx.stacks; ctx.blast.spare = ctx.owner.index;
        ctx.blast.owner = ctx.owner.index;                          // the blast is YOUR attack: the 40 per hit / 60 per chain caps apply, Tithe and Gravedigger see it
        ctx.fx('permit', { x: ctx.block.x + ctx.block.w / 2, y: ctx.block.y + ctx.block.h / 2 });
      },
    },
  },
  {
    id: 'latebloomer', name: 'Late Bloomer', rarity: 'uncommon', maxStacks: 2, icon: 'latebloomer', tags: ['tank', 'counter'],
    description: 'Weak at first. Every six seconds of the round you hit harder.',
    lines: [{ t: '+8% damage per 6 s (up to 8 steps)', good: true }, { t: '-20% damage at the start', good: false }],
    mods: { damage: { mul: 0.8 } },
    dynamic: {
      key: (p, state) => Math.min(8, Math.floor(state.roundTime / 6)),
      mods: (k) => ({ damage: { mul: 1 + 0.08 * k } }),
    },
  },

  // ---- rare ----------------------------------------------------------------------------------------------------------
  {
    id: 'bricklayer', name: 'Bricklayer', rarity: 'rare', maxStacks: 1, icon: 'bricklayer', tags: ['parry', 'bounce'],
    description: 'A good block builds you stone: a platform in the air, a wall on the ground.',
    lines: [{ t: 'a block makes a slab (5 s)', good: true }, { t: 'slabs bounce bullets', good: true }, { t: '-0.1 s block window', good: false }],
    mods: { blockWindow: { add: -0.1 } },
    hooks: {
      onBlock(ctx) {
        const p = ctx.owner;
        if (ctx.store.seq === p.blockSeq) return;                    // once per block
        ctx.store.seq = p.blockSeq;
        if (!p.grounded) {                                           // in the air: a platform under your feet (it is a lifeline over the pit)
          for (const dy of [0, 16, 32]) for (const dx of [0, -28, 28, -56, 56]) if (ctx.spawnSlab({ x: p.x - 64 + dx, y: p.y + p.h / 2 + dy, w: 128, h: 16, hp: 60, life: 5 })) return;   // (slides aside when something is in the way)
        } else {                                                     // on the ground: a wall in front of you
          for (const f of Math.cos(p.aim) >= 0 ? [1, -1] : [-1, 1]) {   // in front of you, or behind if that is blocked
            if (ctx.spawnSlab({ x: f > 0 ? p.x + p.w / 2 + 10 : p.x - p.w / 2 - 26, y: p.y + p.h / 2 - 72, w: 16, h: 72, hp: 60, life: 5 })) return;
          }
        }
      },
    },
  },
  {
    id: 'partinggift', name: 'Parting Gift', rarity: 'rare', maxStacks: 1, icon: 'partinggift', tags: ['explosive', 'counter'],
    description: 'If you go down, they do not walk away clean.',
    lines: [{ t: 'when you die: 0.5 s fuse, then a blast', good: true }, { t: 'blast: 40 damage, big radius, flat', good: true }, { t: 'if it kills them too, the round is a draw', good: true }],
    hooks: {
      onDamaged(ctx) {
        if (!ctx.lethal) return;
        const p = ctx.owner;
        ctx.schedule(0.5, 'fuse', { x: p.x, y: p.y }, { hold: true });
        ctx.fx('fuse', { x: p.x, y: p.y, t: 0.5 });
      },
      onTimer(ctx) { if (ctx.tag === 'fuse') ctx.explode(ctx.data.x, ctx.data.y, 112, 40, { flat: true }); },
    },
  },
  {
    id: 'vendetta', name: 'Vendetta', rarity: 'rare', maxStacks: 1, icon: 'vendetta', tags: ['glass'],
    description: 'A surge of power that lasts until you win a round.',
    lines: [{ t: '+50% damage, +20% fire rate, +2 ammo', good: true }, { t: '-25% max HP', good: false }, { t: 'gone when you win a round', good: false }],
    mods: { damage: { mul: 1.5 }, magazine: { add: 2 }, fireRate: { mul: 1.2 }, maxHp: { mul: 0.75 } },
    hooks: { onRoundEnd(ctx) { if (ctx.won) ctx.removeCard(); } },
  },
  {
    id: 'lastcall', name: 'Last Call', rarity: 'rare', maxStacks: 1, icon: 'lastcall', tags: ['explosive', 'sniper'],
    description: 'Your last bullet is a cannonball.',
    lines: [{ t: 'last bullet: 2x damage, 2.5x size, 1.3x speed', good: true }, { t: 'last bullet: 2.5x knockback', good: true }, { t: '+25% reload time', good: false }],
    mods: { reloadTime: { mul: 1.25 } },
    hooks: {
      onShoot(ctx) {
        if (ctx.owner.ammo !== 0) return;                            // the shot that emptied the magazine
        for (const b of ctx.bullets) {
          b.damage = Math.min(CONFIG.caps.hitDamage, b.damage * 2); b.launchDamage = b.damage;
          b.r = Math.min(CONFIG.statLimits.bulletRadius[1], b.r * 2.5); b.vx *= 1.3; b.vy *= 1.3; b.knockback *= 2.5; b.style = 'gold';
        }
      },
    },
  },
  {
    id: 'gravedigger', name: 'Gravedigger', rarity: 'rare', maxStacks: 1, icon: 'gravedigger', tags: ['ringout', 'tank'],
    description: 'Whoever you knock out of the arena pays extra, and you feel better for it.',
    lines: [{ t: 'ring-out: +12 damage to them, heal 25', good: true }, { t: '+50% knockback dealt', good: true }, { t: '-15% damage', good: false }],
    mods: { knockback: { mul: 1.5 }, damage: { mul: 0.85 } },
    hooks: {
      onRingOut(ctx) {
        ctx.heal(ctx.owner, 25); ctx.hurt(ctx.target, 12);
        ctx.fx('ringout', { x: ctx.target.x, y: ctx.target.y });
      },
    },
  },
];

// Lookup by id (used by the simulation to find hooks; the state itself only stores ids).
export const CARDS_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));
