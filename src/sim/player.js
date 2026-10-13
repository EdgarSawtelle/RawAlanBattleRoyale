// Player creation, movement, shooting, reloading, blocking and the out-of-bounds rule.
// stepPlayer is a pure function of (state, input): no DOM, no Math.random.
import { CONFIG } from '../config.js';
import { computeStats, refreshStats } from './cardfx.js';
import { moveBody, depenetrate, bodyOverlaps, firstOverlap } from './collision.js';
import { emit, spawnBullet, fireHook, damagePlayer } from './combat.js';
import { rand } from './rng.js';

// ---- creation ------------------------------------------------------------------------------------
export function createPlayer(index, cards = []) {
  const stats = computeStats(cards);
  return {
    index,
    x: 0, y: 0, vx: 0, vy: 0,
    w: CONFIG.player.width * stats.size, h: CONFIG.player.height * stats.size,
    aim: index === 0 ? 0 : Math.PI,
    facing: index === 0 ? 1 : -1,
    alive: true,
    hp: stats.maxHp,
    ammo: stats.magazine,
    reloadLeft: 0,          // > 0 while reloading
    fireCd: 0,              // time until the next shot is allowed
    blockLeft: 0,           // > 0 while the shield is up
    blockCd: 0,             // time until the shield can be used again
    blockPrev: false,       // was block held last tick (edge detection)
    grounded: false,
    groundId: null,         // id of the moving platform we stand on (null = static ground / air)
    wallDir: 0,             // -1 touching a wall on the left, +1 on the right, 0 none
    wallSide: 0,            // remembered for wall-coyote
    coyote: 0, jumpBuf: 0, wallCoyote: 0,
    wallRegrab: 0,          // after any jump: the wall cannot be gripped / refill the jump for a moment
    carry: 0,               // after a shove or wall kick: weak ground friction so the push glides
    jumpCharge: 0,          // the one stored jump (1 while on the ground, kept when walking off a ledge)
    airLeft: 0,             // air jumps left (stats.airJumps, refilled on the ground and on a wall)
    blockSeq: 0,            // counts blocks activated (a card reacts once per block)
    dyn: {},                // current key of every dynamic card { cardId: key } (see cardfx.js)
    lastHit: null,          // { by, tick } the last player who hurt us (credit for a ring-out)
    jumping: false,         // rising from a jump (for the variable-height cut)
    oobInv: 0,              // out-of-bounds invulnerability after being thrown back
    hazardCd: 0,            // re-hit cooldown after a hazard hit
    timed: [],              // temporary stat modifiers [{ src, mods, left }] (Scramble)
    shotTaken: {},          // damage taken per trigger pull (shotId -> amount), for the per-shot cap
    healed: 0,              // HP healed this round (capped)
    reflectCount: 0,        // bullets reflected during the current block (Return Policy)
    ghost: 0,               // > 0: flying back into the arena, passes through terrain (so it cannot bonk a platform from below)
    cards: [...cards],      // card ids (duplicates = stacks)
    cardState: {},          // per-card scratch data for hooks
    stats,                  // derived from base config + cards
  };
}

// Put a player back at a spawn with full HP/ammo (round start).
export function resetPlayerForRound(p, spawn) {
  p.dyn = {}; p.stats = computeStats(p.cards, [], p.dyn);
  p.w = CONFIG.player.width * p.stats.size; p.h = CONFIG.player.height * p.stats.size;
  p.x = spawn.x; p.y = spawn.y - (p.h - CONFIG.player.height) / 2; p.vx = 0; p.vy = 0;
  p.alive = true; p.hp = p.stats.maxHp; p.ammo = p.stats.magazine;
  p.reloadLeft = 0; p.fireCd = 0; p.blockLeft = 0; p.blockCd = 0; p.blockPrev = false;
  p.grounded = false; p.groundId = null; p.wallDir = 0; p.wallSide = 0;
  p.coyote = 0; p.jumpBuf = 0; p.wallCoyote = 0; p.wallRegrab = 0; p.carry = 0; p.jumpCharge = 0; p.jumping = false; p.airLeft = 0;
  p.dyn = {}; p.lastHit = null; p.stats = computeStats(p.cards, [], p.dyn);
  p.oobInv = 0; p.hazardCd = 0; p.ghost = 0; p.cardState = {};
  p.timed = []; p.shotTaken = {}; p.healed = 0; p.reflectCount = 0;
}

// Replace a player's cards and recompute stats (used by the debug panel and, later, card picking).
export function setPlayerCards(p, cardIds) {
  const oldMaxHp = p.stats.maxHp, oldH = p.h;
  p.cards = [...cardIds];
  p.stats = computeStats(p.cards, p.timed, p.dyn);
  p.w = CONFIG.player.width * p.stats.size; p.h = CONFIG.player.height * p.stats.size;
  p.y -= (p.h - oldH) / 2;                                    // grow/shrink around the feet
  if (p.alive) p.hp = Math.min(p.stats.maxHp, Math.max(1, p.hp + (p.stats.maxHp - oldMaxHp)));
  p.ammo = Math.min(p.ammo, p.stats.magazine);
}

function moveToward(v, target, amount) {
  if (v < target) return Math.min(v + amount, target);
  return Math.max(v - amount, target);
}

// ---- one tick of one player --------------------------------------------------------------------------
// The tick is split in two: stepPlayer = everything (timers, block, reload, shooting) + stepMovement.
// stepMovement is a PURE function of (player movement state, input, colliders, dt): the online client
// runs it on its own player for prediction (src/net/predict.js).
export function stepPlayer(state, p, input, colliders, dt) {
  if (!p.alive) return;
  const st = p.stats;
  const inp = {
    left: !!input.left, right: !!input.right, jump: !!input.jump, jumpPressed: !!input.jumpPressed,
    shoot: !!input.shoot, block: !!input.block, aim: Number.isFinite(input.aim) ? input.aim : p.aim,
  };

  // timers
  p.fireCd = Math.max(p.fireCd - dt, -dt);
  p.blockLeft = Math.max(0, p.blockLeft - dt);
  p.blockCd = Math.max(0, p.blockCd - dt);
  if (p.timed.length) {                                         // temporary stat modifiers (Scramble)
    for (const t of p.timed) t.left -= dt;
    const n0 = p.timed.length; p.timed = p.timed.filter((t) => t.left > 0);
    if (p.timed.length !== n0) refreshStats(p);
  }
  p.aim = inp.aim;
  p.facing = Math.cos(p.aim) >= 0 ? 1 : -1;

  // ---- block (shield): activates on the press edge, then a cooldown counted from activation ----
  const blockPressed = inp.block && !p.blockPrev;
  p.blockPrev = inp.block;
  if (blockPressed && p.blockCd <= 0 && p.blockLeft <= 0) {
    p.blockLeft = st.blockWindow;
    p.blockCd = st.blockCooldown;
    p.reflectCount = 0; p.blockSeq += 1;
    emit(state, 'blockStart', { player: p.index, x: p.x, y: p.y });
  }

  // ---- reload / shoot --------------------------------------------------------------------------
  if (p.ammo <= 0 && p.reloadLeft <= 0) {
    p.reloadLeft = st.reloadTime;
    emit(state, 'reloadStart', { player: p.index });
  }
  if (p.reloadLeft > 0) {
    p.reloadLeft -= dt;
    if (p.reloadLeft <= 0) { p.reloadLeft = 0; p.ammo = st.magazine; emit(state, 'reloadEnd', { player: p.index }); }
  } else if (inp.shoot && p.blockLeft <= 0 && p.fireCd <= 0 && p.ammo > 0) {
    fire(state, p);
  }

  stepMotion(p, inp, colliders, dt, (type, data) => emit(state, type, data));
}

// Everything that moves the body, as a PURE function of (movement state, input, colliders, dt): the
// out-of-bounds timers, ghost flight and stepMovement. The online client runs exactly this on its own
// player for prediction (src/net/predict.js); the host runs it inside stepPlayer.
export function stepMotion(p, inp, colliders, dt, emitFn) {
  p.oobInv = Math.max(0, p.oobInv - dt);
  if (p.ghost > 0) { p.ghost -= dt; if (p.ghost <= 0) { p.ghost = 0; popOnTop(p, colliders); } }
  stepMovement(p, inp, p.ghost > 0 ? [] : colliders, dt, emitFn);   // ghost flight: no terrain collisions
}

// Movement only: horizontal control, gravity, wall grip, jumping, collision, ground / wall probes.
// `emitFn(type, data)` is optional (jump / land effects); prediction passes nothing.
export function stepMovement(p, inp, colliders, dt, emitFn) {
  const M = CONFIG.move, st = p.stats;
  p.coyote = Math.max(0, p.coyote - dt);
  p.jumpBuf = Math.max(0, p.jumpBuf - dt);
  p.wallCoyote = Math.max(0, p.wallCoyote - dt);
  p.wallRegrab = Math.max(0, p.wallRegrab - dt);
  if (p.carry > 0) p.carry = Math.max(0, p.carry - dt);

  { const spd = Math.hypot(p.vx, p.vy); if (spd > M.maxSpeed) { const k = M.maxSpeed / spd; p.vx *= k; p.vy *= k; } }   // stacked blasts on a light build must not launch you across the map

  // ride a moving platform: move with it before anything else
  if (p.groundId) {
    const plat = colliders.find((c) => c.kind === 'platform' && c.id === p.groundId);
    if (plat && (plat.dx || plat.dy)) moveBody(p, plat.dx, plat.dy, colliders, M.maxSubstep);
  }
  depenetrate(p, colliders);

  // ---- horizontal movement -----------------------------------------------------------------------
  const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  // WALL GRIP (ROUNDS): only while airborne AND holding input into the wall we touched last tick, and not just after a jump.
  const gripping = !p.grounded && p.ghost <= 0 && p.wallDir !== 0 && dir === p.wallDir && p.wallRegrab <= 0;
  let target = dir * st.moveSpeed, accel;
  // MOMENTUM: speed above moveSpeed (shoves, kicks, buffs that ended) decays slowly instead of being braked at once
  const over = p.ghost <= 0 && Math.abs(p.vx) > st.moveSpeed && (dir === 0 || Math.sign(p.vx) === dir);
  if (over) { accel = p.grounded ? M.overspeedGround : M.overspeedAir; target = Math.sign(p.vx) * st.moveSpeed; }
  else if (p.grounded) accel = dir !== 0 ? M.groundAccel : (p.carry > 0 ? M.carryFriction : M.groundFriction);
  else accel = dir !== 0 ? M.airAccel : (p.ghost > 0 || p.oobInv > 0 ? 0 : M.airDrag);   // no air drag while flying back in (thrown back after a fall)
  p.vx = moveToward(p.vx, target, accel * dt);

  // ---- gravity ----------------------------------------------------------------------------------
  let g = p.vy < 0 ? M.gravityUp : M.gravityDown;
  if (!p.grounded && Math.abs(p.vy) < M.apexSpeed && inp.jump) g *= M.apexGravityMul;
  if (gripping && p.vy >= 0) {                                   // gliding down the wall: weak gravity + wall friction
    p.vy -= p.vy * Math.min(1, M.wallScrub * dt);
    p.vy += M.wallSlideAccel * (st.wallGlide ?? 1) * dt;           // wallGlide 0 (Limpet): you hang on the wall
    p.vy = Math.min(p.vy, M.wallSlideMax);
  } else {
    if (gripping) g *= M.wallRiseGravityMul;                     // rising along the wall: lighter
    p.vy += g * dt;
  }
  if (p.vy > M.terminalFall) p.vy = M.terminalFall;

  // ---- jumping (one stored charge) -----------------------------------------------------------------------
  if (inp.jumpPressed) p.jumpBuf = M.jumpBuffer;
  if (p.jumpBuf > 0) {
    const ledgeCharge = M.ledgeJumpCharge && p.jumpCharge > 0;
    if (p.grounded || p.coyote > 0 || (ledgeCharge && p.wallCoyote <= 0)) {          // (a wall within reach wins over the stored charge)
      p.vy = -st.jumpVelocity; p.jumping = true; p.jumpBuf = 0; p.coyote = 0; p.grounded = false; p.jumpCharge = 0;
      p.wallRegrab = M.wallRegrab;
      if (emitFn) emitFn('jump', { player: p.index, x: p.x, y: p.y + p.h / 2, wall: 0 });
    } else if (p.wallCoyote <= 0 && p.airLeft > 0) {                                  // an air jump (Cloudstep)
      p.airLeft -= 1; p.vy = -st.jumpVelocity * M.airJumpMul; p.jumping = true; p.jumpBuf = 0; p.wallRegrab = M.wallRegrab;
      if (emitFn) emitFn('jump', { player: p.index, x: p.x, y: p.y + p.h / 2, wall: 0, air: 1 });
    } else if (p.wallCoyote > 0) {
      const away = -p.wallSide;
      p.vx = away * M.wallJumpVx; p.vy = -st.jumpVelocity * M.wallJumpVyMul;
      p.carry = M.carryTime; p.wallRegrab = M.wallRegrab; p.jumpCharge = 0;
      p.jumping = true; p.jumpBuf = 0; p.wallCoyote = 0;
      if (emitFn) emitFn('jump', { player: p.index, x: p.x + p.wallSide * p.w / 2, y: p.y, wall: p.wallSide });
    }
  }
  if (p.jumping && !inp.jump && p.vy < 0) { p.vy *= M.jumpCutMul; p.jumping = false; }
  if (p.vy >= 0) p.jumping = false;

  // ---- move + collide ----------------------------------------------------------------------------------
  const impactVy = p.vy;
  const wasGrounded = p.grounded;
  const res = moveBody(p, p.vx * dt, p.vy * dt, colliders, M.maxSubstep, p.ghost > 0 ? null : M);
  if (res.hitX) p.vx = 0;
  if (res.popped && p.vy > 0) p.vy = 0;                          // popped up onto a ledge: that is a landing
  if (res.hitY) {
    if (res.hitY > 0 && !wasGrounded && impactVy > M.landEventSpeed && emitFn) {
      emitFn('land', { player: p.index, x: p.x, y: p.y + p.h / 2, speed: impactVy });
    }
    p.vy = 0;
  }

  // ---- ground / wall probes -------------------------------------------------------------------------------
  const below = p.vy >= 0 ? firstOverlap(p, colliders, 0, 1) : null;
  p.grounded = !!below;
  p.groundId = below && below.kind === 'platform' ? below.id : null;
  if (p.grounded) { p.coyote = M.coyoteTime; p.jumpCharge = 1; p.airLeft = st.airJumps; }
  p.wallDir = 0;
  if (!p.grounded) {
    const l = firstOverlap(p, colliders, -1, 0), r = firstOverlap(p, colliders, 1, 0);
    if (l && !r) p.wallDir = -1; else if (r && !l) p.wallDir = 1; else if (l && r) p.wallDir = dir || 1;
    if (p.wallDir !== 0 && p.wallRegrab <= 0) { p.wallSide = p.wallDir; p.wallCoyote = M.wallCoyote; p.jumpCharge = 1; p.airLeft = st.airJumps; }   // wall contact refills the jump (and the air jumps)
  }
}

// After a ghost flight, a player left inside terrain is lifted onto the top of it.
function popOnTop(p, colliders) {
  for (let i = 0; i < 6; i++) {
    const c = firstOverlap(p, colliders);
    if (!c) return;
    p.y = c.y - p.h / 2; p.vy = Math.min(p.vy, 0);
  }
}

// ---- shooting ---------------------------------------------------------------------------------------------------
function fire(state, p) {
  const st = p.stats;
  p.ammo -= 1;
  p.fireCd += 1 / st.fireRate;
  const n = Math.max(1, Math.round(st.bulletsPerShot));
  const bullets = [];
  const dist = Math.max(CONFIG.player.muzzleDistance, Math.max(p.w, p.h) / 2 + 3);
  const shotId = state.nextShot++;                              // all bullets of this trigger pull share it (per-shot damage cap)
  for (let i = 0; i < n; i++) {
    const wobble = (rand(state) - 0.5) * 2 * st.spread;          // random aim error per bullet
    const fan = n > 1 ? ((i / (n - 1)) * 2 - 1) * st.fanAngle : 0;   // multi-pellet shots fan out evenly (Pepperpot)
    const angle = p.aim + wobble + fan;
    const b = spawnBullet(state, p.index, { x: p.x + Math.cos(angle) * dist, y: p.y + Math.sin(angle) * dist, angle, shotId });
    if (b) bullets.push(b);
  }
  p.vx -= Math.cos(p.aim) * st.recoil; p.vy -= Math.sin(p.aim) * st.recoil * 0.8;
  emit(state, 'shot', { player: p.index, x: p.x + Math.cos(p.aim) * (dist + 4), y: p.y + Math.sin(p.aim) * (dist + 4), angle: p.aim, pellets: n });
  fireHook(state, 'onShoot', p.index, { bullets });
}

// ---- falling out of the open arena ----------------------------------------------------------------------------------
// Leaving by the bottom or the sides costs a fraction of max HP and throws the player back towards
// the centre. Up is free. Afterwards a short invulnerability stops it chaining.
export function isOutOfBounds(p) {
  const O = CONFIG.oob, F = CONFIG.field;
  return p.x < -O.margin || p.x > F.w + O.margin || p.y > F.h + O.margin;
}
export function checkOutOfBounds(state, p, colliders) {
  if (!p.alive || p.oobInv > 0) return;
  const O = CONFIG.oob, F = CONFIG.field;
  const left = p.x < -O.margin, right = p.x > F.w + O.margin, bottom = p.y > F.h + O.margin;
  if (!left && !right && !bottom) return;
  const px = p.x, py = p.y;
  damagePlayer(state, p.index, O.damagePct * p.stats.maxHp, -1, null, { x: Math.max(0, Math.min(F.w, px)), y: Math.min(F.h, py) });
  p.oobInv = O.invulnerable; p.ghost = O.ghostTime;
  if (!p.alive) return;                                        // the fall killed us: round lost
  if (bottom) {
    p.y = F.h - O.reentryInset - p.h / 2;
    p.x = Math.max(p.w, Math.min(F.w - p.w, p.x));
    p.vy = -O.bottomLaunchVy;
    p.vx = Math.max(-O.bottomLaunchMaxVx, Math.min(O.bottomLaunchMaxVx, (F.w / 2 - p.x) * O.bottomLaunchVxPerUnit));
  } else {
    const dir = left ? 1 : -1;
    p.x = left ? O.reentryInset + p.w / 2 : F.w - O.reentryInset - p.w / 2;
    p.y = Math.max(40, Math.min(F.h - 80, p.y));
    p.vx = dir * O.sideLaunchVx; p.vy = -O.sideLaunchVy;
  }
  p.grounded = false; p.groundId = null; p.wallDir = 0;
  emit(state, 'oob', { player: p.index, fromX: px, fromY: py, x: p.x, y: p.y, side: bottom ? 'bottom' : (left ? 'left' : 'right') });
  const lh = p.lastHit;                                                        // thrown out soon after being hit: the attacker gets the credit (Gravedigger)
  if (lh && lh.by !== p.index && state.tick - lh.tick <= CONFIG.oob.creditTicks) fireHook(state, 'onRingOut', lh.by, { target: p, targetIndex: p.index });
}

export { bodyOverlaps };
