// ============================================================================
//  fx.js - render-side effects only. The simulation never sees any of this.
//  Effects are created from simulation EVENTS (shot, bounce, hit, explosion, ...) and advanced
//  by fxUpdate() once per simulation tick, so pausing / slow motion / single-stepping freeze them.
// ============================================================================
import { CONFIG } from '../config.js';
import { ctx, P, R, L, K, DISC, ELLpx, LNf, bay, hash } from './px.js';

export const FXC = { amber: '#e9a93c', ember: '#c9591f', pale: '#f8ebb8', hot: '#fff6d8', smoke1: '#45433f', smoke2: '#66655c', smoke3: '#8a897c', dust: '#9a9684', shield: ['#e8efdc', '#a6d0c4', '#6c9d94', '#3d6963'] };
const BARREL = ['#a8461f', '#c9591f', '#7a3a1c', '#2b2a27'];
const CRATE = ['#a79b7c', '#d0c5a2', '#7a7156', '#6f6049'];
const PLAYER_COL = [['#c77c44', '#a2552f', '#d6a444'], ['#7bbfae', '#4a9086', '#b6ab88']];   // player 0 rust / player 1 teal

export function createFx() {
  return { parts: [], anims: [], shake: 0, flash: [0, 0], blockFlash: [0, 0], time: 0, seed: 1 };
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
  const F = CONFIG.fx;
  for (const e of events) {
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
      case 'land': puff(fx, e.x, e.y, 3, 70, 1, 0.35, FXC.dust); break;
      case 'jump': puff(fx, e.x, e.y, e.wall ? 3 : 2, 50, 1, 0.3, FXC.dust); break;
      default: break;
    }
  }
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
      default: break;
    }
  }
}
