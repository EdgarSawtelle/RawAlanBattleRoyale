// ============================================================================
//  fx.js - render-side effects only. The simulation never sees any of this.
//  Effects are created from simulation EVENTS (shot, bounce, hit, explosion, ...) and advanced
//  by fxUpdate() once per simulation tick, so pausing / slow motion / single-stepping freeze them.
// ============================================================================
import { CONFIG } from '../config.js';
import { ctx, P, R, L, K, DISC, ELLpx, LNf, bay, hash, RING, TXT, TW } from './px.js';
import { CARDS_BY_ID } from '../cards.js';
import { drawIcon } from './icons.js';
import { createAnim, animEvent } from './anim.js';

export const FXC = { amber: '#e9a93c', ember: '#c9591f', pale: '#f8ebb8', hot: '#fff6d8', smoke1: '#45433f', smoke2: '#66655c', smoke3: '#8a897c', dust: '#9a9684', shield: ['#e8efdc', '#a6d0c4', '#6c9d94', '#3d6963'] };
const BARREL = ['#a8461f', '#c9591f', '#7a3a1c', '#2b2a27'];
const CRATE = ['#a79b7c', '#d0c5a2', '#7a7156', '#6f6049'];
const PLAYER_COL = [['#c77c44', '#a2552f', '#d6a444'], ['#7bbfae', '#4a9086', '#b6ab88']];   // player 0 rust / player 1 teal

export function createFx() {
  return { parts: [], anims: [], shake: 0, flash: [0, 0], blockFlash: [0, 0], time: 0, seed: 1, anim: createAnim() };   // anim: the characters' animation springs (anim.js, drawn by render.js)
}
function rnd(fx) { fx.seed = (fx.seed * 1664525 + 1013904223) >>> 0; return fx.seed / 4294967296; }   // render-side RNG (never touches the sim)

function addPart(fx, p) { if (fx.parts.length < CONFIG.fx.maxParticles) fx.parts.push(p); }
function spark(fx, x, y, angle, spread, n, speed, cols, life = 0.3, grav = 500) {
  for (let i = 0; i < n; i++) {
    const a = angle + (rnd(fx) - 0.5) * 2 * spread, s = speed * (0.4 + rnd(fx) * 0.8);
    addPart(fx, { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.6 + rnd(fx) * 0.6), max: life, c: cols[Math.floor(rnd(fx) * cols.length)], g: grav, size: 1 });
  }
}
function puff(fx, x, y, n, speed, r, life, col = FXC.smoke2) {
  for (let i = 0; i < n; i++) {
    const a = rnd(fx) * Math.PI * 2, s = speed * (0.3 + rnd(fx) * 0.7);
    addPart(fx, { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, life: life * (0.7 + rnd(fx) * 0.5), max: life, c: col, g: -15, size: r, smoke: true });
  }
}

// ---- events -> effects -------------------------------------------------------------------------------------
export function fxEvents(fx, events) {
  const F = CONFIG.fx, animOn = CONFIG.render.animations.enabled;
  for (const e of events) {
    animEvent(fx.anim, e);                                          // squash / recoil / flinch of the characters (render-only)
    switch (e.type) {
      case 'roundStart': fx.parts.length = 0; fx.anims.length = 0; fx.flash = [0, 0]; fx.blockFlash = [0, 0]; fx.shake = 0; break;
      case 'shot':
        if (e.silent) break;                                           // the client already showed this muzzle flash when you clicked
        fx.anims.push({ kind: 'muzzle', x: e.x, y: e.y, a: e.angle, t: 0, dur: 0.09 });
        spark(fx, e.x, e.y, e.angle, 0.5, 3, 220, [FXC.amber, FXC.pale], 0.18, 200);
        break;
      case 'bounce':
        fx.anims.push({ kind: 'bounce', x: e.x, y: e.y, nx: e.nx, ny: e.ny, t: 0, dur: 0.2, style: e.style });
        spark(fx, e.x, e.y, Math.atan2(e.ny, e.nx), 0.9, 6, 260, [FXC.amber, FXC.pale], 0.3);
        break;
      case 'impact':
        if (e.kind === 'terrain' || e.kind === 'block') {
          fx.anims.push({ kind: 'bounce', x: e.x, y: e.y, nx: e.nx || 0, ny: e.ny || 0, t: 0, dur: 0.16, small: true });
          spark(fx, e.x, e.y, Math.atan2(e.ny || 0, e.nx || 0), 1.0, 4, 200, [FXC.amber, FXC.pale], 0.25);
          if (e.kind === 'block') puff(fx, e.x, e.y, 2, 40, 1, 0.4, FXC.dust);
        }
        break;
      case 'hit': {
        fx.anims.push({ kind: 'hit', x: e.x, y: e.y, a: e.angle, t: 0, dur: 0.18 });
        spark(fx, e.x, e.y, e.angle, 0.7, 7, 280, [FXC.amber, FXC.pale, '#d9d2b8'], 0.35);
        fx.flash[e.player] = 0.12; fx.shake = Math.max(fx.shake, F.hitShake);
        break;
      }
      case 'blocked':
        fx.anims.push({ kind: 'shieldHit', x: e.x, y: e.y, a: e.angle + Math.PI, t: 0, dur: 0.22 });
        spark(fx, e.x, e.y, e.angle + Math.PI, 0.9, 6, 240, [FXC.shield[0], FXC.shield[1], FXC.pale], 0.3);
        fx.blockFlash[e.player] = 0.2;
        break;
      case 'hazardHit': {
        const a = Math.atan2(e.ny, e.nx);
        spark(fx, e.x, e.y, a, 0.9, 12, 330, ['#e9a93c', '#ffd58a', '#c9591f'], 0.45, 700);
        fx.anims.push({ kind: 'hit', x: e.x, y: e.y, a, t: 0, dur: 0.2 });
        fx.shake = Math.max(fx.shake, 2);
        break;
      }
      case 'suddenDeath': fx.shake = Math.max(fx.shake, 3); break;
      case 'blockHit': puff(fx, e.x, e.y, 2, 50, 1, 0.45, FXC.dust); spark(fx, e.x, e.y, -Math.PI / 2, 1.2, 3, 120, CRATE, 0.5, 700); break;
      case 'blockBreak':
        for (let i = 0; i < F.debrisPerBlock; i++) {
          const a = rnd(fx) * Math.PI * 2, s = 60 + rnd(fx) * 220;
          addPart(fx, { x: e.x + (rnd(fx) - 0.5) * e.w * 0.8, y: e.y + (rnd(fx) - 0.5) * e.h * 0.8, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 140, life: 0.9 + rnd(fx) * 0.8, max: 1.6, c: (e.kind === 'barrel' ? BARREL : CRATE)[1 + Math.floor(rnd(fx) * 3)], g: 1100, size: rnd(fx) > 0.7 ? 3 : 2, bounce: true });
        }
        puff(fx, e.x, e.y, 4, 70, 2, 0.6, FXC.dust);
        break;
      case 'explosion':
        fx.anims.push({ kind: 'explosion', x: e.x, y: e.y, r: e.r, t: 0, dur: F.explosionTime });
        fx.shake = Math.max(fx.shake, F.explosionShake);
        spark(fx, e.x, e.y, 0, Math.PI, 14, 380, [FXC.amber, FXC.ember, FXC.pale], 0.5, 600);
        puff(fx, e.x, e.y, 6, 110, 3, 0.9);
        break;
      case 'death': {
        const c = PLAYER_COL[e.player];
        const x = Math.max(8, Math.min(CONFIG.field.w - 8, e.x)), y = Math.min(CONFIG.field.h - 8, e.y);
        spark(fx, x, y, -Math.PI / 2, Math.PI, 18, 320, [c[0], c[1], c[2], FXC.pale], 0.8, 900);
        puff(fx, x, y, 4, 80, 2, 0.8);
        fx.shake = Math.max(fx.shake, 2);
        break;
      }
      case 'oob':
        spark(fx, e.x, e.y, -Math.PI / 2, 1.2, 16, 360, [FXC.dust, FXC.smoke3, FXC.pale], 0.6, 300);
        fx.shake = Math.max(fx.shake, 2);
        break;
      case 'land': if (!animOn) puff(fx, e.x, e.y, 3, 70, 1, 0.35, FXC.dust); break;           // (with animations on the dust comes from fxDust, derived from the state, so the predicted own player gets it at once)
      case 'jump':
        if (!animOn) puff(fx, e.x, e.y, e.wall ? 3 : 2, 50, 1, 0.3, FXC.dust);
        if (e.air) fx.anims.push({ kind: 'ring', x: e.x, y: e.y + 2, r: 20, t: 0, dur: 0.28, col: FXC.pale, col2: FXC.shield[2], flat: true });     // Cloudstep: a ring under the feet
        break;
      // ---- card effects: the opponent must be able to read what just happened ----
      case 'buff': {                                              // a timed or conditional power-up started: a ring around the player and the card's icon rising
        const card = CARDS_BY_ID[e.src];
        fx.anims.push({ kind: 'ring', x: e.x, y: e.y, r: 30 + 4 * (e.level || 0), t: 0, dur: 0.45, col: FXC.amber, col2: FXC.pale });
        if (card) fx.anims.push({ kind: 'icon', x: e.x, y: e.y - 26, icon: card.icon, t: 0, dur: 0.9 });
        spark(fx, e.x, e.y, -Math.PI / 2, 1.1, 6, 200, [FXC.amber, FXC.pale], 0.5, 200);
        break;
      }
      case 'heal':
        fx.anims.push({ kind: 'label', x: e.x, y: e.y - 22, text: '+' + Math.round(e.amount), col: '#a8d46a', t: 0, dur: 0.9 });
        spark(fx, e.x, e.y, -Math.PI / 2, 1.0, 5, 140, ['#a8d46a', '#e8f5b8'], 0.6, 100);
        break;
      case 'cardLost': {
        const card = CARDS_BY_ID[e.cardId];
        fx.anims.push({ kind: 'label', x: e.x, y: e.y - 34, text: (card ? card.name.toUpperCase() : 'CARD') + ' SPENT', col: FXC.amber, t: 0, dur: 1.4 });
        if (card) fx.anims.push({ kind: 'icon', x: e.x, y: e.y - 20, icon: card.icon, t: 0, dur: 1.2 });
        break;
      }
      case 'slab':
        puff(fx, e.x, e.y, 5, 60, 2, 0.5, FXC.dust); spark(fx, e.x, e.y, -Math.PI / 2, 1.4, 8, 220, ['#c9d0d6', '#8f97a0', FXC.pale], 0.4, 500);
        fx.anims.push({ kind: 'ring', x: e.x, y: e.y, r: 26, t: 0, dur: 0.3, col: '#c9d0d6', col2: '#8f97a0' });
        break;
      case 'slabEnd': puff(fx, e.x, e.y, 3, 50, 2, 0.5, FXC.dust); spark(fx, e.x, e.y, -Math.PI / 2, 1.6, 8, 160, ['#c9d0d6', '#8f97a0'], 0.5, 900); break;
      case 'cardFx': {
        const card = CARDS_BY_ID[e.card];
        switch (e.kind) {
          case 'refill':
            fx.anims.push({ kind: 'label', x: e.x, y: e.y - 24, text: 'RELOADED', col: FXC.pale, t: 0, dur: 0.9 });
            fx.anims.push({ kind: 'ring', x: e.x, y: e.y, r: 28, t: 0, dur: 0.35, col: FXC.shield[1], col2: FXC.pale });
            break;
          case 'ring': fx.anims.push({ kind: 'ring', x: e.x, y: e.y, r: 70, t: 0, dur: 0.3, col: '#a9d45a', col2: '#f4ffd0' }); break;
          case 'fuse': fx.anims.push({ kind: 'fuse', x: e.x, y: e.y, r: 112, t: 0, dur: e.t || 0.5 }); fx.anims.push({ kind: 'label', x: e.x, y: e.y - 26, text: 'PARTING GIFT', col: FXC.ember, t: 0, dur: 0.9 }); break;
          case 'permit': fx.anims.push({ kind: 'ring', x: e.x, y: e.y, r: 70, t: 0, dur: 0.35, col: FXC.amber, col2: FXC.pale }); break;
          case 'ringout':
            fx.anims.push({ kind: 'label', x: e.x, y: Math.min(CONFIG.field.h - 24, e.y) - 18, text: 'RING OUT', col: FXC.ember, t: 0, dur: 1.2 });
            if (card) fx.anims.push({ kind: 'icon', x: e.x, y: Math.min(CONFIG.field.h - 24, e.y) - 36, icon: card.icon, t: 0, dur: 1.2 });
            break;
          default: break;
        }
        break;
      }
      default: break;
    }
  }
}

// ---- character dust (queued by anim.js from the players' own state: start, skid, landing, jumps, wall grab / scrape) ----
// d = { k, x, y (logical, at the feet / the wall), dir (-1/0/1, the way the dust flies or the movement direction), amt 0..1 }
export function fxDust(fx, list) {
  for (const d of list) {
    const c = [FXC.dust, FXC.smoke3, FXC.dust][Math.floor(rnd(fx) * 3)];
    const sp1 = (n, vx0, vxR, vy0, vyR, life, grav = 140, col) => {
      for (let i = 0; i < n; i++) addPart(fx, { x: d.x + (rnd(fx) - 0.5) * 6, y: d.y - 1, vx: vx0() + (rnd(fx) - 0.5) * vxR, vy: vy0 - rnd(fx) * vyR, life: life * (0.7 + rnd(fx) * 0.6), max: life, c: col || c, g: grav, size: 1 });
    };
    switch (d.k) {
      case 'land': {
        const n = 2 + Math.round(d.amt * 4);
        for (const sg of [-1, 1]) {
          sp1(n, () => sg * (40 + 70 * d.amt * rnd(fx)), 30, -6, 34, 0.3);
          if (d.amt > 0.45) addPart(fx, { x: d.x + sg * 5, y: d.y - 2, vx: sg * 50, vy: -14, life: 0.42, max: 0.42, c: FXC.smoke2, g: -12, size: 2, smoke: true });
        }
        break;
      }
      case 'jump': for (const sg of [-1, 1]) sp1(2, () => sg * (30 + 40 * rnd(fx)), 20, -4, 22, 0.25); break;
      case 'airjump': sp1(4, () => 0, 90, 10, -30, 0.28, 100, FXC.pale); break;
      case 'start': sp1(3, () => -d.dir * (28 + 40 * rnd(fx)), 20, -4, 24, 0.28); break;
      case 'skid': sp1(3 + Math.round(d.amt * 2), () => d.dir * (30 + 70 * rnd(fx)), 30, -4, 26, 0.3); if (d.amt > 0.6) addPart(fx, { x: d.x + d.dir * 4, y: d.y - 2, vx: d.dir * 36, vy: -10, life: 0.38, max: 0.38, c: FXC.smoke2, g: -12, size: 2, smoke: true }); break;
      case 'walljump': sp1(4, () => d.dir * (40 + 60 * rnd(fx)), 30, 0, 36, 0.3, 160); break;
      case 'grab': sp1(2, () => d.dir * (20 + 30 * rnd(fx)), 20, -2, 16, 0.22); break;
      case 'scrape': sp1(1 + (d.amt > 0.6 ? 1 : 0), () => d.dir * (8 + 24 * rnd(fx)), 10, 4, -26, 0.24, 220); break;
      default: break;
    }
  }
  list.length = 0;
}

// ---- advance one tick ---------------------------------------------------------------------------------------
export function fxUpdate(fx, dt) {
  fx.time += dt;
  fx.shake = Math.max(0, fx.shake - CONFIG.fx.shakeDecay * dt);
  for (let i = 0; i < 2; i++) { fx.flash[i] = Math.max(0, fx.flash[i] - dt); fx.blockFlash[i] = Math.max(0, fx.blockFlash[i] - dt); }
  for (const p of fx.parts) {
    p.life -= dt;
    p.vy += p.g * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.bounce && p.y > CONFIG.field.h + 40) p.life = 0;
    if (!p.smoke) { p.vx *= 1 - 1.5 * dt; }
    else { p.vx *= 1 - 2 * dt; p.vy *= 1 - 2 * dt; }
  }
  fx.parts = fx.parts.filter((p) => p.life > 0);
  for (const a of fx.anims) a.t += dt;
  fx.anims = fx.anims.filter((a) => a.t < a.dur);
}

// ---- drawing ------------------------------------------------------------------------------------------------
function sparkBurst(x, y, r, ang0, n, cA, cB, spread, seed = 9) {
  for (let i = 0; i < n; i++) {
    const a = ang0 + (i / (n - 1 || 1) - 0.5) * spread * 2 + (hash(i, n, seed) - 0.5) * 0.3, len = r * (0.7 + 0.5 * hash(i, n, seed + 2));
    LNf(x + Math.cos(a) * r * 0.25, y + Math.sin(a) * r * 0.25, x + Math.cos(a) * len, y + Math.sin(a) * len, (px, py, k, m) => P(px, py, k > m * 0.6 ? cB : cA));
  }
}

function drawExplosion(a) {
  const x = L(a.x), y = L(a.y), R0 = Math.max(4, L(a.r)), t = a.t / a.dur;
  const grow = 1 - Math.pow(1 - Math.min(1, t * 2.4), 2);          // fast expansion
  const r = Math.max(2, Math.round(R0 * (0.35 + 0.65 * grow)));
  // smoke puffs, expanding and fading late
  const sm = [[-0.9, -0.9, 0.45], [0.95, -0.6, 0.4], [0.1, -1.25, 0.35], [-1.2, 0.2, 0.3], [1.15, 0.45, 0.35]];
  const smokeT = Math.max(0, (t - 0.15) / 0.85);
  for (const [ox, oy, sr] of sm) {
    const k = 0.4 + 0.6 * Math.min(1, smokeT * 1.6);
    const sx = x + Math.round(ox * R0 * k), sy = y + Math.round(oy * R0 * k) - Math.round(smokeT * 6), srr = Math.max(2, Math.round(sr * R0 * (0.6 + smokeT * 0.25)));
    const g = ctx();
    g.fillStyle = FXC.smoke2;
    ELLpx(sx, sy, srr, srr, (px, py, nx, ny) => {
      if (smokeT > 0.25 && bay(px, py) < (smokeT - 0.25) * 21) return;     // dither away
      g.fillStyle = (nx + ny > 0.35) ? FXC.smoke1 : (nx + ny < -0.7 ? FXC.smoke3 : FXC.smoke2); g.fillRect(px, py, 1, 1);
    });
  }
  if (t < 0.55) {
    const k = 1 - t / 0.55;
    const rr = Math.max(1, Math.round(r * (0.6 + 0.4 * k)));
    for (let j = -rr - 3; j <= rr + 3; j++) for (let i = -rr - 3; i <= rr + 3; i++) { const d = Math.hypot(i, j); if (d > rr * 0.82 && d < rr * 1.15 && ((x + i + y + j) & 1) === 0) P(x + i, y + j, FXC.ember); }
    DISC(x, y, Math.round(rr * 0.82), FXC.ember);
    if (k > 0.2) DISC(x, y, Math.round(rr * 0.62), FXC.amber);
    if (k > 0.4) DISC(x, y, Math.round(rr * 0.42), FXC.pale);
    if (k > 0.6) DISC(x, y, Math.round(rr * 0.2), FXC.hot);
    if (t < 0.35) for (let i = 0; i < 10; i++) {
      const an = i * Math.PI / 5 + 0.2, l = rr * (i % 2 ? 1.25 : 1.55);
      LNf(x + Math.cos(an) * rr * 0.7, y + Math.sin(an) * rr * 0.7, x + Math.cos(an) * l, y + Math.sin(an) * l, (px, py, kk, m) => P(px, py, kk > m * 0.55 ? FXC.amber : FXC.pale));
    }
  }
}

export function fxDraw(fx) {
  // particles
  const g = ctx();
  for (const p of fx.parts) {
    const x = L(p.x), y = L(p.y), f = p.life / p.max;
    if (p.smoke) {
      if (f < 0.5 && ((x + y) & 1) === 0 && bay(x, y) < (0.5 - f) * 32) continue;
      DISC(x, y, Math.max(1, Math.round(p.size * (1.3 - f * 0.5))), p.c);
    } else {
      if (f < 0.3 && ((x + y) & 1)) continue;
      if (p.bounce) { g.fillStyle = '#25231f'; g.fillRect(x - 1, y - 1, p.size + 2, p.size + 2); }   // debris gets a dark outline so it reads on any backdrop
      g.fillStyle = p.c; g.fillRect(x, y, p.size, p.size);
    }
  }
  // animations
  for (const a of fx.anims) {
    const t = a.t / a.dur;
    switch (a.kind) {
      case 'muzzle': {
        const x = L(a.x), y = L(a.y), s = Math.max(3, Math.round(16 / K) - Math.round(t * 3));
        sparkBurst(x, y, s, a.a, 5, FXC.amber, FXC.pale, 0.6); DISC(x, y, Math.max(1, Math.round(s * 0.3)), FXC.pale);
        break;
      }
      case 'bounce': {
        const x = L(a.x), y = L(a.y), rr = L(a.small ? 14 : 22) * (0.6 + t * 0.6), ang = Math.atan2(a.ny, a.nx);
        sparkBurst(x, y, rr, ang, a.small ? 5 : 7, FXC.amber, FXC.pale, 1.3);
        if (t < 0.6) DISC(x, y, Math.max(1, Math.round(L(a.small ? 4 : 6) * (1 - t))), FXC.pale);
        break;
      }
      case 'hit': {
        const x = L(a.x), y = L(a.y);
        sparkBurst(x, y, L(20) * (0.5 + t * 0.7), a.a, 6, FXC.amber, FXC.pale, 1.0, 21);
        if (t < 0.5) DISC(x, y, 2, FXC.pale);
        break;
      }
      case 'shieldHit': {
        const x = L(a.x), y = L(a.y), r = L(26) * (0.6 + t * 0.5);
        sparkBurst(x, y, r, a.a, 9, '#f8ebb8', '#e9a93c', 1.25);
        if (t < 0.7) { DISC(x, y, Math.max(2, Math.round(r * 0.28 * (1 - t))), FXC.shield[0]); }
        break;
      }
      case 'explosion': drawExplosion(a); break;
      case 'ring': {                                              // an expanding ring (air jump, buff, shard ring, slab)
        const x = L(a.x), y = L(a.y), r = Math.max(2, Math.round(L(a.r) * (0.3 + 0.8 * Math.sqrt(t)))), yy = a.flat ? 0.45 : 1;
        if (t > 0.55 && (x + y) % 2) break;
        const g2 = ctx();
        for (let i = 0; i < 48; i++) {
          const an = i / 48 * Math.PI * 2, px = Math.round(x + Math.cos(an) * r), py = Math.round(y + Math.sin(an) * r * yy);
          if (t > 0.35 && (i % 2)) continue;
          g2.fillStyle = i % 4 === 0 ? a.col2 : a.col; g2.fillRect(px, py, 1, 1);
        }
        break;
      }
      case 'icon': {                                              // the card's icon floats up and fades
        const x = L(a.x) - 6, y = Math.round(L(a.y) - t * 14) - 6;
        if (t > 0.7 && (x + y) % 2) break;
        R(x - 1, y - 1, 14, 14, '#0e0d0c'); R(x, y, 12, 12, '#2c2924'); drawIcon(a.icon, x, y, 1);
        break;
      }
      case 'label': {                                             // short text floating up (+heal, RING OUT, ...)
        const w = TW(a.text, 1), x = Math.round(L(a.x) - w / 2), y = Math.round(L(a.y) - t * 12);
        if (t > 0.7 && (x + y) % 2) break;
        TXT(a.text, x + 1, y + 1, '#0e0d0c', 1); TXT(a.text, x, y, a.col, 1);
        break;
      }
      case 'fuse': {                                              // Parting Gift: the blast radius blinks faster and faster until it goes off
        const x = L(a.x), y = L(a.y), r = Math.round(L(a.r)), blink = Math.floor(t * (6 + 14 * t)) % 2 === 0;
        const g2 = ctx();
        for (let i = 0; i < 96; i++) {                          // the whole blast radius as a dotted ring, bright and thick while it blinks on
          const an = i / 96 * Math.PI * 2; if (i % 2) continue;
          const px = Math.round(x + Math.cos(an) * r), py = Math.round(y + Math.sin(an) * r);
          g2.fillStyle = '#0e0d0c'; g2.fillRect(px - 1, py - 1, 4, 4);                        // dark rim so it reads on any backdrop
          g2.fillStyle = blink ? (i % 4 ? FXC.hot : FXC.amber) : FXC.ember; g2.fillRect(px, py, 2, 2);
        }
        DISC(x, y, 2 + Math.round(t * 3), blink ? FXC.hot : FXC.ember);
        break;
      }
      default: break;
    }
  }
}
