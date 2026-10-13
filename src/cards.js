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
];

// Lookup by id (used by the simulation to find hooks; the state itself only stores ids).
export const CARDS_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));
