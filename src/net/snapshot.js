// ============================================================================
//  snapshot.js - what the host sends every ~33 ms (buildSnap) and what the client does with it
//  (ClientWorld: keeps a short buffer of snapshots and builds an INTERPOLATED, renderer-ready
//  state ~100 ms in the past). The client never runs the simulation: it only displays.
//
//  Snapshot player array: [x, y, vx, vy, aim, hp, alive, ammo, reloadLeft, blockLeft, blockCd, grounded, w, h, maxHp, magazine, reloadTime, blockCooldown]
//  Snapshot `q` (the receiving client's OWN movement state, for prediction; NOT rounded):
//    [x, y, vx, vy, grounded, groundId, wallDir, wallSide, coyote, jumpBuf, wallCoyote, wallRegrab, carry, jumpCharge, jumping, ghost, oobInv, moveSpeed, jumpVelocity]
//  `ql` is how many client input frames the host has queued (the client speeds up / slows down its input clock a little to keep it near the cushion).
//  `ack` is the sequence number of the last client input frame the host has simulated (one frame = one tick), `rt` the round tick after it.
//  Snapshot bullet array: [id, x, y, vx, vy, r, owner, style]            style: 0 amber, 1 pale, 2 ember
//  Snapshot damaged-block list `bk`: [[id, hp], ...] (hp 0 = destroyed); every snapshot repeats it, so a lost
//  message can never leave the map out of sync. Moving platforms and saws are NOT sent: their position is a
//  pure function of the round tick (rt).
// ============================================================================
import { CONFIG } from '../config.js';
import { getMap } from '../maps/index.js';

const STYLES = ['amber', 'pale', 'ember'];
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;

// The movement state of player `p` that the client needs to predict its own movement (see predict.js).
// NOT rounded: the client replays this state, and the step has hard thresholds (vy < 0, a timer reaching 0), so a
// rounded copy would make the replay branch differently from the host. Full doubles replay bit for bit.
export function moveState(p) {
  return [p.x, p.y, p.vx, p.vy, p.grounded ? 1 : 0, p.groundId || 0, p.wallDir, p.wallSide, p.coyote, p.jumpBuf, p.wallCoyote, p.wallRegrab, p.carry,
    p.jumpCharge, p.jumping ? 1 : 0, p.ghost, p.oobInv, p.stats.moveSpeed, p.stats.jumpVelocity];
}

export function buildSnap(state, seq, ack, mvs, ql = 0) {
  return {
    tick: state.tick, seq, ack, mvs, ql, q: moveState(state.players[1]),
    // (ack = the last client input frame simulated; q is player 1's movement state after it)
    ph: state.phase, rd: state.round, rt: state.roundTick, rtm: r2(state.roundTime), sd: state.suddenDeath ? 1 : 0,
    sc: state.scores.slice(), res: state.result ? state.result.winner : null,
    map: state.mapId,
    p: state.players.map((p) => [r1(p.x), r1(p.y), r1(p.vx), r1(p.vy), r3(p.aim), r1(p.hp), p.alive ? 1 : 0, p.ammo, r2(p.reloadLeft), r2(p.blockLeft), r2(p.blockCd), p.grounded ? 1 : 0,
      r1(p.w), r1(p.h), p.stats.maxHp, p.stats.magazine, p.stats.reloadTime, p.stats.blockCooldown]),
    b: state.bullets.map((b) => [b.id, r1(b.x), r1(b.y), r1(b.vx), r1(b.vy), r1(b.r), b.owner, Math.max(0, STYLES.indexOf(b.style))]),
    bk: state.blocks.filter((k) => !k.alive || k.hp < k.maxHp).map((k) => [k.id, k.alive ? r1(k.hp) : 0]),
  };
}

const lerp = (a, b, t) => a + (b - a) * t;
function lerpAngle(a, b, t) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * t; }
const lerpPos = (a, b, t) => (Math.abs(b - a) > 120 ? b : lerp(a, b, t));   // teleports (respawn, out of bounds) are not smoothed

export class ClientWorld {
  constructor() {
    this.snaps = [];                 // [{ snap, at }] ordered by tick
    this.mvVersion = -1;
    this.state = this._blankState();
    this.mapId = null;
    this.baseBlocks = [];
    this.offset = null;              // host time - guest time (ms), min-delay estimate
    this.samples = [];
    this.stats = { snaps: 0, dropped: 0, lastTick: 0, extrapolated: 0 };
  }

  _blankState() {
    const mkp = (i) => ({ index: i, x: 0, y: 0, vx: 0, vy: 0, w: 30, h: 30, aim: 0, facing: 1, alive: true, hp: 100, ammo: 5, reloadLeft: 0, blockLeft: 0, blockCd: 0, grounded: false, cards: [],
      stats: { maxHp: 100, magazine: 5, reloadTime: 2, blockCooldown: 4, blockWindow: 0.3 } });
    return {
      tick: 0, roundTick: 0, roundTime: 0, suddenDeath: false, phase: 'playing', round: 1, scores: [0, 0], result: null, mapId: null,
      players: [mkp(0), mkp(1)], bullets: [], blocks: [], events: [], cheats: { invulnerable: [false, false] },
      match: { winTarget: CONFIG.match.winTarget, auto: [false, false], loser: -1, quiz: null, result: null, offer: [], removed: [], skipped: false, dummy: null, timer: 0, again: [false, false], pickedCard: null, used: [] },
    };
  }

  // The match view (what the host allows us to see) arrived.
  applyView(v) {
    const s = this.state, m = s.match;
    this.mvVersion = v.v;
    s.phase = v.phase; s.round = v.round; s.scores = v.scores.slice();
    s.result = v.winner >= 0 || v.phase === 'matchEnd' ? { winner: v.winner } : s.result;
    m.winTarget = v.winTarget; m.loser = v.loser; m.skipped = v.skipped; m.again = v.again || [false, false];
    m.quiz = v.quiz ? { ...v.quiz, why: '' } : null;
    m.result = v.result ? { ...v.result } : null;
    m.offer = v.offer ? v.offer.slice() : (v.offerCount ? Array(v.offerCount).fill('?') : []);
    m.removed = v.removed ? v.removed.slice() : [];
    m.dummy = v.dummy; m.timer = v.timer || 0; m.hover = v.hover === undefined ? -1 : v.hover;
    for (let i = 0; i < 2; i++) s.players[i].cards = (v.builds[i] || []).slice();
  }

  // A snapshot arrived at local time `at` (ms).
  applySnap(snap, at, stepMs) {
    const last = this.snaps[this.snaps.length - 1];
    if (last && snap.tick <= last.snap.tick) { this.stats.dropped++; return false; }   // old / duplicate (unreliable channel)
    this.snaps.push({ snap, at });
    while (this.snaps.length > 40) this.snaps.shift();
    this.stats.snaps++; this.stats.lastTick = snap.tick;
    const sample = snap.tick * stepMs - at;
    this.samples.push(sample); if (this.samples.length > 90) this.samples.shift();
    const target = Math.max(...this.samples);
    this.offset = this.offset === null ? target : this.offset + Math.max(-2, Math.min(2, target - this.offset));
    if (snap.map !== this.mapId) { this._loadMap(snap.map); }
    if (snap.mvs <= this.mvVersion) {          // we know everything this snapshot's phase depends on
      if (snap.ph === 'playing' || snap.ph === 'roundEnd') this.state.phase = snap.ph;
    }
    return true;
  }

  _loadMap(id) {
    this.mapId = id; this.state.mapId = id;
    const map = getMap(id);
    this.baseBlocks = map.destructibles.map((d) => ({ id: d.id, kind: d.kind || 'crate', x: d.x, y: d.y, w: d.w, h: d.h, maxHp: d.hp ?? (d.kind === 'barrel' ? CONFIG.hazards.barrel.hp : 50) }));
  }

  // Estimated host tick (fractional) at local time `now`, minus the interpolation delay.
  renderTick(now, stepMs) {
    if (this.offset === null) return 0;
    return (now + this.offset) / stepMs - CONFIG.net.interpDelay * 1000 / stepMs;
  }

  // The blocks (destructible) as of the NEWEST snapshot, for the client's own movement prediction.
  latestBlocks() {
    const S = this.snaps; if (!S.length) return [];
    const last = S[S.length - 1].snap;
    if (this._blk && this._blk.tick === last.tick && this._blk.map === this.mapId) return this._blk.list;
    const dm = new Map(last.bk);
    const list = this.baseBlocks.map((k) => ({ ...k, alive: dm.has(k.id) ? dm.get(k.id) > 0 : true }));
    this._blk = { tick: last.tick, map: this.mapId, list };
    return list;
  }

  // Build the interpolated state for the renderer at fractional host tick `rt`. Returns { state, alpha }.
  build(rt) {
    const s = this.state, S = this.snaps;
    if (!S.length) return { state: s, alpha: 1 };
    // find a = last snapshot with tick <= rt, b = the next one
    let ia = 0;
    while (ia + 1 < S.length && S[ia + 1].snap.tick <= rt) ia++;
    const A = S[ia].snap, Bn = S[ia + 1] ? S[ia + 1].snap : null;
    let t = 0, cur = A, extra = 0;
    if (Bn) { t = Math.max(0, Math.min(1, (rt - A.tick) / (Bn.tick - A.tick))); cur = t >= 1 ? Bn : A; }
    else { extra = Math.max(0, Math.min(CONFIG.net.extrapolateMax * CONFIG.tickRate, rt - A.tick)); if (extra > 0) this.stats.extrapolated++; }
    const dtA = Bn ? (Bn.tick - A.tick) / CONFIG.tickRate : 0;

    s.tick = cur.tick; s.round = cur.rd; s.roundTime = cur.rtm; s.suddenDeath = !!cur.sd; s.scores = cur.sc.slice();
    s.mapId = cur.map;
    if (s.phase === 'playing' || s.phase === 'roundEnd') s.result = cur.res === null ? null : { winner: cur.res };
    // players
    for (let i = 0; i < 2; i++) {
      const a = A.p[i], b = Bn ? Bn.p[i] : null, c = cur.p[i], P = s.players[i];
      let x, y, vx, vy, aim;
      if (b) { x = lerpPos(a[0], b[0], t); y = lerpPos(a[1], b[1], t); vx = lerp(a[2], b[2], t); vy = lerp(a[3], b[3], t); aim = lerpAngle(a[4], b[4], t); }
      else { const e = extra / CONFIG.tickRate; x = a[0] + a[2] * e; y = a[1] + a[3] * e; vx = a[2]; vy = a[3]; aim = a[4]; }
      P.x = x; P.y = y; P.vx = vx; P.vy = vy; P.aim = aim; P.facing = Math.cos(aim) >= 0 ? 1 : -1;
      P.hp = c[5]; P.alive = !!c[6]; P.ammo = c[7]; P.reloadLeft = c[8]; P.blockLeft = c[9]; P.blockCd = c[10]; P.grounded = !!c[11];
      P.w = c[12]; P.h = c[13];
      P.stats.maxHp = c[14]; P.stats.magazine = c[15]; P.stats.reloadTime = c[16]; P.stats.blockCooldown = c[17];
    }
    // round tick (platforms / saws): interpolate unless the round restarted
    s.roundTick = Bn && Bn.rt >= A.rt ? Math.floor(lerp(A.rt, Bn.rt, t)) : Math.floor(cur.rt + extra);
    const alpha = Bn && Bn.rt >= A.rt ? lerp(A.rt, Bn.rt, t) - Math.floor(lerp(A.rt, Bn.rt, t)) : 1;
    // bullets by id
    const bm = new Map(); if (Bn) for (const b of Bn.b) bm.set(b[0], b);
    const out = [];
    for (const a of A.b) {
      const b = bm.get(a[0]);
      if (b) { out.push({ id: a[0], x: lerp(a[1], b[1], t), y: lerp(a[2], b[2], t), r: a[5], owner: a[6], style: STYLES[a[7]] }); bm.delete(a[0]); }
      else out.push({ id: a[0], x: a[1] + a[3] * (t * dtA + extra / CONFIG.tickRate), y: a[2] + a[4] * (t * dtA + extra / CONFIG.tickRate), r: a[5], owner: a[6], style: STYLES[a[7]] });
    }
    for (const b of bm.values()) {              // new in the next snapshot: back-project along its velocity
      const back = (1 - t) * dtA;
      out.push({ id: b[0], x: b[1] - b[3] * back, y: b[2] - b[4] * back, r: b[5], owner: b[6], style: STYLES[b[7]] });
    }
    s.bullets = out;
    // blocks: base layout + damaged list of the current snapshot
    const dm = new Map(cur.bk);
    s.blocks = this.baseBlocks.map((k) => {
      const hp = dm.has(k.id) ? dm.get(k.id) : k.maxHp;
      return { ...k, hp, alive: hp > 0 };
    });
    return { state: s, alpha };
  }
}
