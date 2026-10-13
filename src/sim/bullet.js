// Bullet motion, collision, bouncing and hitting players / shields / destructible blocks.
// Bullets move in small substeps (config.combat.bulletSubstep) so nothing tunnels through thin slabs.
import { CONFIG } from '../config.js';
import { circleFirstHit, circleHitsRect } from './collision.js';
import { emit, fireHook, damagePlayer, damageBlock } from './combat.js';

export function shieldRadius(p) {
  return Math.hypot(p.w / 2, p.h / 2) + CONFIG.combat.shieldPadding;
}

export function stepBullets(state, colliders, dt) {
  const list = state.bullets;
  state.bullets = [];                 // bullets created by hooks during this loop are appended to the new array
  for (const b of list) if (!stepBullet(state, b, colliders, dt)) state.bullets.push(b);
}

// Returns true when the bullet is consumed / removed.
function stepBullet(state, b, colliders, dt) {
  const C = CONFIG.combat, F = CONFIG.field;
  b.age += dt;
  if (b.age > b.lifetime) return true;
  if (b.immune > 0) b.immune -= dt;

  // spawned (or pushed by a moving platform) inside terrain: it simply hits
  const embedded = circleFirstHit(b.x, b.y, b.r, colliders);
  if (embedded) return hitTerrain(state, b, embedded, 0, 0, true);

  b.vy += b.gravity * dt;
  const n = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / C.bulletSubstep));
  for (let i = 0; i < n; i++) {
    if (hitPlayers(state, b)) return true;

    // x axis
    let sx = b.vx * dt / n;
    b.x += sx;
    let c = circleFirstHit(b.x, b.y, b.r, colliders);
    if (c) {
      b.x -= sx;
      if (hitTerrain(state, b, c, sx > 0 ? -1 : 1, 0, false)) return true;
    }
    // y axis
    let sy = b.vy * dt / n;
    b.y += sy;
    c = circleFirstHit(b.x, b.y, b.r, colliders);
    if (c) {
      b.y -= sy;
      if (hitTerrain(state, b, c, 0, sy > 0 ? -1 : 1, false)) return true;
    }
    // left the screen
    const m = C.bulletKillMargin;
    if (b.x < -m || b.x > F.w + m || b.y < -C.bulletKillMarginTop || b.y > F.h + m) return true;
  }
  return false;
}

// Bullet vs shields and bodies. Returns true if the bullet was consumed.
function hitPlayers(state, b) {
  for (const p of state.players) {
    if (!p.alive) continue;
    if (p.index === b.owner && b.immune > 0) continue;       // short owner immunity (muzzle / first moments)
    if (p.blockLeft > 0 && Math.hypot(b.x - p.x, b.y - p.y) <= shieldRadius(p) + b.r) {
      emit(state, 'blocked', { player: p.index, x: b.x, y: b.y, angle: Math.atan2(b.vy, b.vx), owner: b.owner });
      fireHook(state, 'onBlock', p.index, { bullet: b, target: state.players[b.owner], targetIndex: b.owner });
      if (b.keep) { delete b.keep; return false; }      // a card (Return Policy) turned it around: it lives on
      return true;
    }
    if (circleHitsRect(b.x, b.y, b.r, { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h })) {
      fireHook(state, 'onBulletHit', b.owner, { bullet: b, hitType: 'player', target: p, targetIndex: p.index });
      damagePlayer(state, p.index, b.damage, b.owner, b, { x: b.x, y: b.y }, { kind: 'bullet', shotId: b.shotId });
      emit(state, 'impact', { x: b.x, y: b.y, kind: 'player', style: b.style });
      return true;
    }
  }
  return false;
}

// Bullet touches terrain / a block / a moving platform. (nx, ny) is the surface normal.
// Returns true if the bullet is consumed, false if it bounced.
function hitTerrain(state, b, c, nx, ny, embedded) {
  const block = c.kind === 'block' ? state.blocks.find((k) => k.id === c.id) : null;
  if (!embedded && b.bouncesLeft > 0) {
    if (block) damageBlock(state, block, b.damage * CONFIG.combat.bulletBlockDamageMul, b.x, b.y, b.owner, b.shotId);
    if (nx !== 0) b.vx = -b.vx;
    if (ny !== 0) b.vy = -b.vy;
    b.bouncesLeft -= 1; b.bounces += 1;
    b.immune = 0;                                             // after the first bounce it can hurt its owner
    emit(state, 'bounce', { x: b.x, y: b.y, nx, ny, owner: b.owner, style: b.style });
    fireHook(state, 'onBounce', b.owner, { bullet: b });
    return false;
  }
  fireHook(state, 'onBulletHit', b.owner, { bullet: b, hitType: block ? 'block' : 'terrain' });
  if (block) damageBlock(state, block, b.damage * CONFIG.combat.bulletBlockDamageMul, b.x, b.y, b.owner, b.shotId);
  emit(state, 'impact', { x: b.x, y: b.y, kind: block ? 'block' : 'terrain', style: b.style, nx, ny });
  return true;
}
