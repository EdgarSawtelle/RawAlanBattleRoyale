// ============================================================================
//  predict.js - client-side prediction of the client's OWN MOVEMENT (config.net.predictOwnMovement).
//
//  The online client does not run the match, but it does run the one pure function that moves a player
//  (sim/player.js stepMotion, the very code the host uses) on its own player, with its own input, the
//  moment the input is sampled. So pressing a key moves you at once instead of one round trip later.
//
//    * every sampled input frame (sequence number n) is stepped locally and kept in a short history
//    * every snapshot carries the host's authoritative movement state `q` for this player, `ack` (the
//      last input frame the host simulated; one frame = one tick, see host-session.js) and `rt` (round
//      tick after it). The client RECONCILES: rewind to that state, replay the frames after `ack`
//    * the difference between the old and the new predicted position is not applied at once: it is
//      moved into a visual `offset` that fades out over a few frames (config.net.predictSmooth).
//      A correction larger than config.net.predictSnap (teleport, out of bounds, round restart) is applied at once
//
//  Only MOVEMENT is predicted (position, velocity, grounded / wall state, jump charge and timers).
//  Damage, death, bullets, hazards, knockback and card effects stay the host's business: they arrive in
//  the next snapshot and the reconciliation moves you to where they put you. Moving platforms are a pure
//  function of the round tick; destructible blocks come from the newest snapshot.
// ============================================================================
import { CONFIG } from '../config.js';
import { stepMotion, isOutOfBounds } from '../sim/player.js';
import { collidersFor } from '../sim/world.js';

const STEP = 1 / CONFIG.tickRate;
const STEP_MS = 1000 / CONFIG.tickRate;
const lerp = (a, b, t) => a + (b - a) * t;

// the movement state sent by the host (snapshot.js moveState) -> a body the shared step can move
function bodyFrom(q, pw, ph) {
  return {
    index: 1, x: q[0], y: q[1], vx: q[2], vy: q[3], w: pw, h: ph,
    grounded: !!q[4], groundId: q[5] || null, wallDir: q[6], wallSide: q[7], coyote: q[8], jumpBuf: q[9], wallCoyote: q[10], wallRegrab: q[11], carry: q[12],
    jumpCharge: q[13], jumping: !!q[14], ghost: q[15], oobInv: q[16], stats: { moveSpeed: q[17], jumpVelocity: q[18] },
  };
}
const copyBody = (b) => ({ ...b, stats: { ...b.stats } });

export class Predictor {
  constructor() { this.stats = this._newStats(); this.reset(); }

  _newStats() { return { reconciles: 0, snaps: 0, steps: 0, errSum: 0, errMax: 0, errs: [], frameCorrMax: 0, frozenTicks: 0 }; }

  reset() {
    this.p = null;                // the predicted body (null = not predicting: show the interpolated snapshot instead)
    this.active = false; this.frozen = false;
    this.hist = [];               // [{ seq, inp }] input frames not yet acknowledged
    this.ackSeq = -1; this.ackRt = 0; this.round = -1;
    this.prevX = 0; this.prevY = 0; this.stepAt = 0;
    this.offX = 0; this.offY = 0; // visual correction still to be faded out
    this.lastDisp = null;
  }

  get enabled() { return !!CONFIG.net.predictOwnMovement; }

  _colliders(ctx, rt) { return collidersFor(ctx.mapId, rt, ctx.blocks); }

  // One sampled input frame: remember it and, when predicting, move the player. `at` = local time of this tick (ms).
  tick(seq, inp, ctx, at) {
    this.hist.push({ seq, inp: { left: !!inp.left, right: !!inp.right, jump: !!inp.jump, jumpPressed: !!inp.jumpPressed } });
    if (this.hist.length > 240) this.hist.splice(0, this.hist.length - 240);
    this.stepAt = at;
    if (!this.active || !this.p) return;
    if (this.frozen) { this.stats.frozenTicks++; return; }
    if (seq - this.ackSeq > CONFIG.net.predictMaxPending) return;          // the link is dead: stand still instead of running away
    this.prevX = this.p.x; this.prevY = this.p.y;
    stepMotion(this.p, this.hist[this.hist.length - 1].inp, this._colliders(ctx, this.ackRt + (seq - this.ackSeq)), STEP);
    this.stats.steps++;
    if (isOutOfBounds(this.p) && this.p.oobInv <= 0) this.frozen = true;  // the host will throw us back: wait for it
  }

  // A snapshot arrived (already known to be newer than the last one). ctx = { mapId, blocks }.
  onSnapshot(s, ctx) {
    const live = s.ph === 'playing' || s.ph === 'roundEnd', me = s.p[1];
    if (!this.enabled || !live || !me[6] || !s.q) { this.active = false; this.p = null; this.frozen = false; this.offX = this.offY = 0; this.hist = this.hist.filter((h) => h.seq > s.ack); return; }
    const auth = bodyFrom(s.q, me[12], me[13]);
    this.hist = this.hist.filter((h) => h.seq > s.ack);
    const restart = !this.active || !this.p || s.rd !== this.round || s.rt < this.ackRt;
    // rewind to the host's state and replay what the host has not simulated yet
    const body = copyBody(auth); let frozen = false;
    for (const h of this.hist) {
      if (h.seq - s.ack > CONFIG.net.predictMaxPending) break;
      stepMotion(body, h.inp, this._colliders(ctx, s.rt + (h.seq - s.ack)), STEP);
      if (isOutOfBounds(body) && body.oobInv <= 0) { frozen = true; break; }
    }
    const old = this.p;
    this.ackSeq = s.ack; this.ackRt = s.rt; this.round = s.rd; this.frozen = frozen;
    this.stats.reconciles++;
    if (restart) {
      this.p = body; this.offX = this.offY = 0; this.prevX = body.x; this.prevY = body.y; this.active = true;
      return;
    }
    const dx = body.x - old.x, dy = body.y - old.y, err = Math.hypot(dx, dy);
    this.stats.errSum += err; this.stats.errMax = Math.max(this.stats.errMax, err);
    this.stats.errs.push(err); if (this.stats.errs.length > 4000) this.stats.errs.shift();
    if (err > CONFIG.net.predictSnap) {
      this.stats.snaps++;
      this.p = body; this.offX = this.offY = 0; this.prevX = body.x; this.prevY = body.y;
      return;
    }
    // small correction: the displayed position stays where it was, the difference fades out
    this.offX -= dx; this.offY -= dy;
    this.prevX = this.prevX + dx; this.prevY = this.prevY + dy;
    this.p = body;
  }

  // The position to draw at local time `now` (ms), or null when not predicting. Also fades the correction out.
  display(now) {
    if (!this.active || !this.p) return null;
    if (this.lastDisp !== null && (this.offX !== 0 || this.offY !== 0)) {
      const dt = Math.max(0, Math.min(100, now - this.lastDisp)) / 1000;
      const k = Math.exp(-dt / Math.max(0.001, CONFIG.net.predictSmooth));
      const nx = this.offX * k, ny = this.offY * k;
      const moved = Math.hypot(nx - this.offX, ny - this.offY);
      if (moved > this.stats.frameCorrMax) this.stats.frameCorrMax = moved;
      this.offX = Math.abs(nx) < 0.02 ? 0 : nx; this.offY = Math.abs(ny) < 0.02 ? 0 : ny;
    }
    this.lastDisp = now;
    const f = this.frozen ? 1 : Math.max(0, Math.min(1, (now - this.stepAt) / STEP_MS));
    const p = this.p;
    return { x: lerp(this.prevX, p.x, f) + this.offX, y: lerp(this.prevY, p.y, f) + this.offY, vx: p.vx, vy: p.vy, grounded: p.grounded, wallDir: p.wallDir };
  }

  summary() {
    const e = this.stats.errs.slice().sort((a, b) => a - b), n = e.length;
    return { reconciles: this.stats.reconciles, snaps: this.stats.snaps, meanErr: n ? this.stats.errSum / this.stats.reconciles : 0, p95Err: n ? e[Math.floor(n * 0.95)] : 0, maxErr: this.stats.errMax, maxFrameCorr: this.stats.frameCorrMax };
  }
}
