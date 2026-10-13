// ============================================================================
//  echo.js - local echo of the client's OWN shots and blocks, so they feel instant. Cosmetic and movement only: the host stays
//  authoritative for every bullet, hit and damage number.
//
//  The client mirrors, frame by frame, the few rules that decide whether a pressed trigger or block actually does something on the
//  host (sim/player.js stepPlayer): ammo, reload, fire interval, block cooldown. It starts from the newest snapshot (the host state
//  after input frame `ack`, with the shooter's CURRENT shot stats in `sq`, so timed and conditional card effects are included) and
//  replays the client's own frames after it. Frame n is tick n (see host-session.js), so the model and the host agree on which
//  frame fires. If the model says "fire" it
//    * shows the muzzle flash at once (the host's own `shot` event, which arrives later, is then shown without a second flash),
//    * applies the shot's recoil to the predicted body (Kickback), exactly where the host will,
//    * for a plain shot (one bullet, no spread, no bounce, no card that changes the bullet) draws a PROVISIONAL bullet that flies
//      from the muzzle at once; the host's bullet for the same shot is hidden when it appears (first in, first out), so there is
//      one bullet on screen, drawn ~RTT/2 + interpolation delay earlier than the authoritative copy would be.
//  and the shield of a block is drawn at once. A mismatch (the host refuses) only costs a shield or a bullet that does nothing for
//  a moment; it never changes the game state.
// ============================================================================
import { CONFIG } from '../config.js';
import { CARDS_BY_ID } from '../cards.js';
import { decodeAim, encodeAim } from './protocol.js';
import { collidersFor } from '../sim/world.js';
import { SQ_KEYS } from './snapshot.js';
import { circleFirstHit } from '../sim/collision.js';

const STEP = 1 / CONFIG.tickRate;

// One host frame of the shot / reload / block rules (sim/player.js stepPlayer, same order, same arithmetic) on the model m.
function stepModel(m, S, magazine, shoot, blockEdge) {
  const out = { fired: false, blocked: false };
  m.bl = Math.max(0, m.bl - STEP); m.bcd = Math.max(0, m.bcd - STEP); m.cd = Math.max(m.cd - STEP, -STEP);
  if (blockEdge && m.bcd <= 0 && m.bl <= 0) { m.bl = S.blockWindow; m.bcd = S.blockCooldown; out.blocked = true; }
  if (m.ammo <= 0 && m.rl <= 0) m.rl = S.reloadTime;
  if (m.rl > 0) { m.rl -= STEP; if (m.rl <= 0) { m.rl = 0; m.ammo = magazine; } }
  else if (shoot && m.bl <= 0 && m.cd <= 0 && m.ammo > 0) { m.ammo -= 1; m.cd += 1 / S.fireRate; out.fired = true; }
  return out;
}

export class Echo {
  constructor() { this.reset(); }
  reset() {
    this.base = null;            // newest snapshot facts { ack, alive, sq, magazine }
    this.m = null;               // the model: ammo, reload left, block left, block cooldown, fire interval left - after our newest frame
    this.rec = [];               // our recent input frames { seq, shoot, edge } (to replay on top of a snapshot)
    this.prevBlock = false;
    this.bullets = [];           // provisional bullets
    this.hidden = new Set();     // authoritative bullet ids replaced by a provisional one
    this.waiting = [];           // one token per provisional bullet whose authoritative twin has not been seen yet { t0 } (it outlives the drawn bullet: the twin shows up a round trip + the interpolation delay later, long after a short flight ended)
    this.n = 0; this.round = -1;
    this.stats = { fired: 0, blocked: 0, spawned: 0, paired: 0 };   // for the tests and the debug panel
    this.blockUntil = 0; this.blockCdUntil = 0;   // local clock (ms) of the echoed shield, for drawing
  }

  // The newest snapshot (accepted in order): the new starting point. Its `sq` carries our shot stats and our exact timers after frame `ack`.
  onSnapshot(snap) {
    if (snap.rd !== this.round) { this.round = snap.rd; this.bullets = []; this.waiting = []; this.hidden.clear(); this.blockUntil = this.blockCdUntil = 0; }   // a new round: nothing of the last one carries over
    const me = snap.p[1], q = snap.sq;
    this.rec = this.rec.filter((r) => r.seq > snap.ack);
    if (!q) { this.base = null; this.m = null; return; }
    const sq = Object.fromEntries(SQ_KEYS.map((k, i) => [k, q[i]])), T = q.slice(SQ_KEYS.length);
    this.base = { ack: snap.ack, alive: !!me[6], sq, magazine: me[15] };
    const m = { ammo: me[7], rl: T[0], cd: T[1], bl: T[2], bcd: T[3] };
    for (const r of this.rec) stepModel(m, sq, me[15], r.shoot, r.edge);     // our frames the host has not simulated yet
    this.m = m;
  }

  // One input frame. Returns what the client does locally: { fired, kick, spawn, blocked }.
  frame(seq, input, ctx) {
    const out = { fired: false, kick: null, spawn: null, blocked: false };
    const blk = !!(input.block || input.blockPressed), edge = blk && !this.prevBlock; this.prevBlock = blk;   // (the host ORs the edge into the held bit)
    const b = this.base, shoot = !!(input.shoot || input.shootPressed);
    this.rec.push({ seq, shoot, edge }); if (this.rec.length > 300) this.rec.shift();
    if (!b || !this.m) return out;
    const r = stepModel(this.m, b.sq, b.magazine, shoot, edge);
    if (!b.alive || ctx.phase !== 'playing') return out;
    const S = b.sq;
    if (r.blocked) { out.blocked = true; this.stats.blocked++; }
    if (r.fired) {
      out.fired = true; this.stats.fired++;
      const a = decodeAim(encodeAim(input.aim));                  // the host uses the 16-bit aim of the frame
      if (S.recoil > 0) out.kick = [-Math.cos(a) * S.recoil, -Math.sin(a) * S.recoil * 0.8];
      const simple = S.bulletsPerShot === 1 && S.spread === 0 && S.bounces === 0 && !ctx.cards.some((id) => { const c = CARDS_BY_ID[id]; return c && (c.hooks && (c.hooks.onShoot || c.hooks.onBulletHit)); });
      if (simple) out.spawn = { angle: a, speed: S.bulletSpeed, gravity: S.bulletGravity, r: S.bulletRadius, life: S.bulletLifetime };
    }
    return out;
  }

  // Provisional bullets are advanced analytically against the clock and vanish at terrain or at the displayed opponent.
  spawn(spawn, x, y, now, w, h) {
    const d = Math.max(CONFIG.player.muzzleDistance, Math.max(w, h) / 2 + 3);
    const ox = x + Math.cos(spawn.angle) * d, oy = y + Math.sin(spawn.angle) * d;
    const b = { id: 'p' + (++this.n), ox, oy, vx: Math.cos(spawn.angle) * spawn.speed, vy: Math.sin(spawn.angle) * spawn.speed, g: spawn.gravity, r: spawn.r, life: spawn.life, t0: now, x: ox, y: oy, owner: 1, style: 'amber', provisional: true, paired: false };
    this.bullets.push(b); this.waiting.push({ t0: now, paired: false }); this.stats.spawned++;
    if (this.bullets.length > 40) this.bullets.shift();
    return b;
  }

  // Called by render(): the bullets to draw for our own shots, and which authoritative ones to hide.
  update(now, world, opp) {
    const mapId = world.mapId; let cols = null;
    const keep = [];
    for (const b of this.bullets) {
      const t = (now - b.t0) / 1000;
      if (t < 0) { keep.push(b); continue; }
      if (t > b.life) continue;
      b.x = b.ox + b.vx * t; b.y = b.oy + b.vy * t + 0.5 * b.g * t * t;
      if (b.x < -60 || b.x > CONFIG.field.w + 60 || b.y > CONFIG.field.h + 60 || b.y < -CONFIG.combat.bulletKillMarginTop) continue;
      if (mapId) { cols = cols || collidersFor(mapId, world.state.roundTick, world.latestBlocks()); if (circleFirstHit(b.x, b.y, b.r, cols)) continue; }
      if (opp && opp.alive && Math.abs(b.x - opp.x) < opp.w / 2 + b.r && Math.abs(b.y - opp.y) < opp.h / 2 + b.r) continue;   // reached the opponent as drawn
      keep.push(b);
    }
    this.bullets = keep; this.waiting = this.waiting.filter((w) => !w.paired && now - w.t0 < 1200);
  }

  // Filter the authoritative bullet list (render state): own bullets replaced by a provisional one are removed; the others stay.
  filter(list, now) {
    const out = [], seen = new Set();
    for (const b of list) {
      if (b.owner === 1) {
        seen.add(b.id);
        if (this.hidden.has(b.id)) continue;
        const w = this.waiting.find((p) => !p.paired);
        if (w) { w.paired = true; this.stats.paired++; this.hidden.add(b.id); continue; }
      }
      out.push(b);
    }
    if (this.hidden.size > 80) for (const id of this.hidden) if (!seen.has(id)) this.hidden.delete(id);
    for (const p of this.bullets) out.push({ id: p.id, x: p.x, y: p.y, r: p.r, owner: 1, style: p.style });
    return out;
  }
}
