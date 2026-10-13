// ============================================================================
//  anim.js - character animation state (RENDER ONLY, no drawing here, no DOM, never touches the simulation).
//
//  Every frame the renderer hands animUpdate() what it can see of a player (position, velocity, grounded, the wall it
//  touches - found from the map, see wallContact() -, aim, shield) and gets back a POSE: how much to squash / stretch
//  / lean / lift the body, where the feet and paws go, and so on. The pose is driven by a few damped springs:
//
//     s      squash & stretch (height x (1+s), width x 1/(1+s): the volume is kept)
//     lean   sideways lean of the top of the body against its feet (px)    -> run lean, skid and stop wobble
//     lag    scarf / pack / filter trail behind the movement (2D, softer spring)
//     kick   the gun slides back on a shot;  px / py  the body is pushed back by it
//
//  Transitions (take-off, landing, air jump, wall jump, grabbing a wall, ledge pop, ...) are recognised from the state
//  itself, not from sim events, so the online client's own predicted player and the interpolated opponent animate
//  exactly like the host does. Events (shot, hit, blocked, oob, death, roundStart) add the combat feedback.
//
//  All numbers live in CONFIG.render.animations (src/config.js).
// ============================================================================
import { CONFIG } from '../config.js';
import { K } from './px.js';

const TAU = Math.PI * 2;
const HOP_G = 520;     // gravity of the cosmetic hops (victory, ledge pull-up), px/s^2
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sp = (x = 0) => ({ x, v: 0 });
export const animCfg = () => CONFIG.render.animations;

// One step of a damped spring: pos/vel in `s` = { x, v } chasing `target`. Semi-implicit Euler in small substeps
// (stable for any stiffness we use and any frame time).
export function springStep(s, target, k, c, dt) {
  if (!(dt > 0)) return s;
  const n = Math.max(1, Math.ceil(dt / (1 / 240))), h = dt / n;
  for (let i = 0; i < n; i++) { s.v += (k * (target - s.x) - c * s.v) * h; s.x += s.v * h; }
  return s;
}

// ---- wall contact (pure geometry: works for any player on any client) -------------------------------------------------
// Which solid does a body (centre x,y, size w,h in logical units) touch on its left / right? Returns { side, edge } or null.
// side +1 = wall on the right (edge = x of its left face), -1 = on the left (edge = x of its right face).
export function wallContact(x, y, w, h, colliders) {
  let best = null;
  for (const c of colliders) {
    const vo = (h + c.h) / 2 - Math.abs(y - (c.y + c.h / 2));
    if (vo < 4) continue;                                        // only a corner grazes it
    const cx = c.x + c.w / 2;
    if (Math.abs(x - cx) < (w + c.w) / 2 - 0.01) continue;     // inside it (depenetration frame): no side
    for (const dx of [-1.6, 1.6]) {
      if (Math.abs(x + dx - cx) < (w + c.w) / 2) {
        const side = dx > 0 ? 1 : -1;
        if (!best || vo > best.vo) best = { side, edge: side > 0 ? c.x : c.x + c.w, vo };
      }
    }
  }
  return best;
}

// ---- state ---------------------------------------------------------------------------------------------------------------------
export function createAnim() { return { time: 0, players: [newPlayer(7), newPlayer(19)] }; }

function newPlayer(seed) {
  return {
    seed, init: false, alive: true, t: 0,
    s: sp(), sT: 0, sSet: 0, sAdd: 0, lean: sp(), kick: sp(), px: sp(), py: sp(), lagx: sp(), lagy: sp(), rot: sp(),
    lift: 0, liftv: 0, grip: 0, side: 0, lastWall: 0, wallPx: 0, wallT: 9, run: 0, phase: 0, ax: 0,
    pg: true, pvx: 0, pvy: 0, lx: 0, ly: 0, vyHold: 0, vyHoldT: 0, airT: 0,
    moving: false, fast: false, dirSign: 0, stepAcc: 0, stepCd: 0,
    hopWait: 0, kbT: 0, spinDir: 1, kickT: 0, kickKind: '', pullT: 0, landT: 0, cheerT: 0, hopT: 0, scrapeT: 0, blockPrev: false, popT: 0,
    nextBlink: 2.5, blinkT: 0, deadT: -1, last: null, dust: [], pose: null,
  };
}
function resetPlayer(a) { const seed = a.seed; Object.assign(a, newPlayer(seed + 1)); }
function rnd(a) { a.seed = (a.seed * 1664525 + 1013904223) >>> 0; return a.seed / 4294967296; }

export const NEUTRAL_POSE = Object.freeze({ sw: 1, sh: 1, lean: 0, lift: 0, rot: 0, kick: 0, lagx: 0, lagy: 0, px: 0, py: 0, grip: 0, side: 0, wallPx: 0, glide: false, cling: false,
  hands: 'none', foot: [0, 0], footSpread: 0.45, footShift: [0, 0], blink: false, look: 0, phase: 0, run: 0, state: 'idle', fade: 0, flash: false, scrapeY: 0 });

// ---- events -> impulses (the combat feedback) ---------------------------------------------------------------------------------
export function animEvent(A, e) {
  const C = animCfg(); if (!C.enabled) return;
  if (e.type === 'roundStart') { for (const a of A.players) resetPlayer(a); return; }
  const a = A.players[e.player]; if (!a) return;
  switch (e.type) {
    case 'shot': {
      if (e.silent) break;                                       // the muzzle flash (and this recoil) already happened on the click
      const c = Math.cos(e.angle), sn = Math.sin(e.angle);
      a.kick.x = 1; a.kick.v = 0;
      a.px.x -= c * C.recoilPush; a.py.x -= sn * C.recoilPush;
      a.sAdd += C.recoilSquash * (0.9 * Math.abs(c) - Math.abs(sn));   // pushed along x: narrower and a bit taller; pushed along y: flatter
      a.lean.v -= c * 28;
      break;
    }
    case 'hit': {
      const c = Math.cos(e.angle), sn = Math.sin(e.angle);
      a.sSet = Math.min(a.sSet, -C.hitSquash);
      a.lean.v += c * C.hitLean; a.px.v += c * 45; a.py.v += sn * 25;
      a.kbT = C.tumbleTime; a.spinDir = c >= 0 ? 1 : -1; a.popT = 0.1;
      break;
    }
    case 'blocked': {
      const c = Math.cos(e.angle), sn = Math.sin(e.angle);
      a.px.v += c * 55; a.py.v += sn * 30; a.sAdd -= 0.06; a.lean.v += c * 22;
      break;
    }
    case 'oob': a.kbT = C.tumbleTime * 1.7; a.spinDir = (e.side === 'right' ? -1 : 1); break;
    case 'death': if (a.deadT < 0) a.deadT = 0; break;
    default: break;
  }
}

// ---- the per-frame update --------------------------------------------------------------------------------------------------------------
// o = { x, y, w, h (logical), vx, vy, grounded, wall (-1/0/1), wallEdge (logical x), aim, alive, blockLeft, limpet, victory }
// Returns the pose (also stored in a.pose; null while dead). a.dust collects dust puffs for fx.js to turn into particles.
export function animUpdate(a, o, dt) {
  const C = animCfg();
  if (!o.alive) {
    if (a.alive && a.deadT < 0) a.deadT = 0;                    // alive -> dead seen in the state: start the pop even if the 'death' event is late or was missed
    a.alive = false; if (a.deadT >= 0) a.deadT += Math.min(dt, 0.05); a.pose = null; return null;
  }
  if (!a.alive) { resetPlayer(a); a.alive = true; }
  if (a.pose && !(dt > 0)) return a.pose;                      // frozen (paused / single step): keep the pose
  dt = clamp(dt || 0.0167, 0.0005, 0.05);
  const z = clamp(o.h / CONFIG.player.height, 0.6, 1.6);         // body size (cards)
  const footY = o.y + o.h / 2;
  const first = !a.init || Math.hypot(o.x - a.lx, o.y - a.ly) > 150;   // spawn / respawn / out-of-bounds launch: no transitions this frame
  if (first) { a.init = true; a.pg = o.grounded; a.pvx = o.vx; a.pvy = o.vy; a.ly = o.y; a.lx = o.x; a.vyHold = 0; a.airT = o.grounded ? 0 : 0.5; a.dirSign = Math.sign(o.vx); a.stepAcc = 0; }
  const g = o.grounded, wasG = a.pg, spd = Math.abs(o.vx), face = Math.cos(o.aim) >= 0 ? 1 : -1;
  a.t += dt;
  a.airT = g ? 0 : a.airT + dt;
  a.wallT = o.wall ? 0 : a.wallT + dt;
  if (o.wall) { a.lastWall = o.wall; if (o.wallEdge !== undefined) a.wallPx = o.wallEdge; }
  a.kbT = Math.max(0, a.kbT - dt); a.kickT = Math.max(0, a.kickT - dt); a.pullT = Math.max(0, a.pullT - dt); a.landT = Math.max(0, a.landT - dt); a.popT = Math.max(0, a.popT - dt);
  a.blinkT = Math.max(0, a.blinkT - dt); a.stepCd = Math.max(0, a.stepCd - dt);
  const rawAx = clamp((o.vx - a.pvx) / dt, -6000, 6000);
  a.ax += (rawAx - a.ax) * (1 - Math.exp(-dt / 0.035));
  // the squash spring chases LAST frame's target first, then this frame's impulses land on top (so a landing / hit shows its full depth on the very frame it happens)
  springStep(a.s, a.sT, C.stiffness, C.damping, dt);
  if (a.sSet < 0) { a.s.x = Math.min(a.s.x, a.sSet); a.s.v = Math.min(a.s.v, 0); } a.sSet = 0;
  a.s.x += a.sAdd; a.sAdd = 0;
  const foot = { x: o.x, y: footY };
  const dust = (k, x, y, dir, amt) => a.dust.push({ k, x, y, dir, amt });

  // ---- take-off / landing / air jump / wall jump (from the state itself) ----
  if (!first) {
    if (!wasG && g) {                                            // landed
      const impact = Math.max(a.vyHold, 0);
      if (impact > C.landMin) {
        const depth = clamp((impact - C.landMin * 0.4) * C.landSquash, 0.07, C.maxSquash);
        a.s.x = Math.min(a.s.x, -depth); a.s.v = Math.min(a.s.v, 0); a.landT = 0.14; a.lean.v *= 0.3;
        dust('land', foot.x, foot.y, 0, clamp(impact / 900, 0.15, 1));
      }
      a.vyHold = 0; a.kickT = 0;
    }
    const kicked = o.vy < a.pvy - 320 && o.vy < -350;           // an upward speed jump: some kind of jump
    if (wasG && !g && kicked || (!g && !wasG && kicked && a.airT < 0.12 && a.wallT > 0.15)) {   // jump from the ground (or just off a ledge)
      a.s.x = -C.takeoffSquash; a.s.v = 0; a.lean.v *= 0.5;
      dust('jump', foot.x, foot.y, 0, 0.5);
    } else if (!g && !wasG && kicked) {
      if (a.wallT < 0.16) {                                      // wall jump: push off the wall
        const away = -a.lastWall;
        a.s.x = -C.airJumpSquash * 1.1; a.s.v = 0; a.kickT = 0.22; a.kickKind = 'wall'; a.lean.v += away * 70; a.px.v += away * 80;
        dust('walljump', o.x + a.lastWall * o.w / 2, o.y + o.h * 0.15, away, 0.7);
      } else {                                                   // air jump (Cloudstep): a little kick
        a.s.x = -C.airJumpSquash; a.s.v = 0; a.kickT = 0.24; a.kickKind = 'air'; a.lean.v += (Math.sign(o.vx) || face) * 35;
        dust('airjump', foot.x, foot.y, 0, 0.6);
      }
    }
    // ledge pop: the sim lifts a running body onto a step in one tick; show it as a little heave
    if (g && wasG && spd > 40) {
      const dy = o.y - a.ly;
      a.stepAcc = dy < -0.25 ? a.stepAcc - dy : a.stepAcc * Math.exp(-dt / 0.03);
      if (a.stepAcc > 4.5 && a.stepCd <= 0) { a.stepAcc = 0; a.stepCd = 0.3; a.pullT = 0.2; a.s.x = 0.14; a.s.v = 20; a.liftv = Math.max(a.liftv, 56 * z); dust('start', foot.x, foot.y, Math.sign(o.vx), 0.5); }
    } else a.stepAcc = 0;
  }
  if (o.vy > a.vyHold || a.vyHoldT > 0.16) { a.vyHold = o.vy; a.vyHoldT = 0; } else a.vyHoldT += dt;   // recent downward peak (the interpolated opponent's vy fades out before it lands): updated AFTER the landing check above uses it
  // run start / skid / turn dust
  if (g) {
    if (!a.moving && spd > 110) { a.moving = true; dust('start', foot.x, foot.y, Math.sign(o.vx), clamp(spd / 300, 0.4, 1)); }
    else if (a.moving && spd < 40) a.moving = false;
    if (spd > 170) { if (!a.fast) a.fast = true; if (a.dirSign !== 0 && Math.sign(o.vx) !== a.dirSign) { dust('skid', foot.x, foot.y, a.dirSign, 0.8); a.s.x -= 0.05; } a.dirSign = Math.sign(o.vx); }
    else if (a.fast && spd < 90) { a.fast = false; dust('skid', foot.x, foot.y, a.dirSign, clamp(Math.abs(a.pvx) / 300, 0.4, 1)); }
  } else { a.moving = false; a.fast = false; }

  // ---- wall grip ----
  const gripT = o.wall && !g && o.vy < C.gripMaxVy && o.vy > -800 ? 1 : 0;
  if (gripT && a.grip < 0.2 && !first) {                         // grab: the body slaps against the wall
    a.px.v += o.wall * 90; a.s.x -= 0.1; a.lean.v += o.wall * 40; a.popT = 0.12;
    dust('grab', o.x + o.wall * o.w / 2, o.y - o.h * 0.1, -o.wall, 0.5);
  }
  a.grip += (gripT - a.grip) * Math.min(1, (gripT ? C.gripRate : C.gripRate * 2) * dt);
  if (a.grip < 0.02 && !gripT) a.grip = 0;
  if (gripT) a.side = o.wall;
  const side = a.side || a.lastWall;
  const gliding = a.grip > 0.6 && o.vy > 35;
  if (gliding) {
    a.scrapeT -= dt;
    if (a.scrapeT <= 0) { a.scrapeT = clamp(0.13 - o.vy / 1800, 0.05, 0.13); dust('scrape', o.x + side * o.w / 2, o.y - o.h * 0.2, -side, clamp(o.vy / 160, 0.3, 1)); }
  }

  // ---- run cycle ----
  const runT = g ? clamp((spd - 30) / 150, 0, 1) : 0;
  a.run += (runT - a.run) * (1 - Math.exp(-dt / (runT > a.run ? 0.04 : 0.07)));
  if (g && spd > 30) a.phase += (spd / K) * dt / C.stepPx;
  const fr = a.phase % 1, w = Math.sin(Math.PI * fr);
  const speedK = clamp(spd / 300, 0.45, 1.25);
  const runLift = C.bobPx * z * a.run * w * speedK;
  const runS = a.run * (C.runStretch * w - C.runSquash * Math.pow(1 - w, 4));
  const stepIdx = Math.floor(a.phase) & 1;

  // ---- shield brace ----
  const blocking = o.blockLeft > 0;
  if (blocking && !a.blockPrev) { a.s.x = Math.min(a.s.x, -0.2); a.s.v = 0; a.lean.v += face * 40; a.px.v += face * 45; }
  a.blockPrev = blocking;

  // ---- victory hop (round-end banner): a little ballistic hop, a squash on every landing ----
  if (o.victory) {
    a.cheerT += dt;
    a.hopWait = Math.max(0, a.hopWait - dt);
    if (a.lift <= 0 && a.liftv <= 0 && a.cheerT > 0.05 && a.hopWait <= 0) { a.liftv = Math.sqrt(2 * HOP_G * C.winHop * z); a.s.x = -0.22; a.s.v = 0; a.hopWait = 0.1; }
  } else a.cheerT = 0;
  if (a.liftv !== 0 || a.lift > 0) {
    a.liftv -= HOP_G * dt; a.lift += a.liftv * dt;
    if (a.lift <= 0) { a.lift = 0; if (a.liftv < -60) { a.s.x = Math.min(a.s.x, -0.16 * clamp(-a.liftv / 130, 0.4, 1.4)); a.s.v = 0; } a.liftv = 0; }
  }

  // ---- targets & springs ----
  let sT = 0;
  if (!g) {
    const av = Math.abs(o.vy);
    sT = clamp((av - 80) * C.stretchPerSpeed, 0, C.maxStretch) - C.apexSquash * clamp(1 - av / 150, 0, 1);
    if (a.grip > 0.5) sT *= 1 - a.grip;
  }
  if (blocking) sT -= C.blockSquash;
  if (o.limpet && a.grip > 0.5) sT -= 0.05 * a.grip;
  const breath = C.breath * Math.sin(TAU * a.t / C.breathPeriod) * (g ? 1 - a.run : 0) * (blocking ? 0.3 : 1);
  a.sT = sT;
  if (a.s.x > C.maxStretch) { a.s.x = C.maxStretch; a.s.v = Math.min(a.s.v, 0); } else if (a.s.x < -C.maxSquash) { a.s.x = -C.maxSquash; a.s.v = Math.max(a.s.v, 0); }

  let lT = g ? clamp(o.vx / 300, -1.4, 1.4) * C.leanRun + clamp(a.ax / 2400, -1.5, 1.5) * C.leanAccel : clamp(o.vx / 300, -1.4, 1.4) * C.leanAir;
  if (blocking) lT += face * 1.2;
  lT = (lT * (1 - a.grip) + side * C.gripLean * a.grip) * z;
  springStep(a.lean, lT, C.leanStiffness, C.leanDamping, dt);
  a.lean.x = clamp(a.lean.x, -5 * z, 5 * z);
  springStep(a.lagx, -clamp(o.vx / 300, -1.3, 1.3) * C.lagPx, C.lagStiffness, C.lagDamping, dt);
  springStep(a.lagy, -clamp(o.vy / 600, -1, 1) * C.lagPx * 0.8, C.lagStiffness, C.lagDamping, dt);
  springStep(a.px, 0, C.kickStiffness, C.kickDamping, dt);
  springStep(a.py, 0, C.kickStiffness, C.kickDamping, dt);
  springStep(a.kick, 0, C.kickStiffness, C.kickDamping * 0.8, dt);

  // tumble: while it is flung through the air after a hit / launch the body spins; afterwards it eases back upright
  const tumbling = a.kbT > 0 && !g && Math.hypot(o.vx, o.vy) > C.tumbleMinSpeed;
  if (tumbling) a.rot.x += C.tumbleSpin * a.spinDir * dt;
  else springStep(a.rot, Math.round(a.rot.x / TAU) * TAU, 700, 38, dt);
  if (!tumbling && Math.abs(a.rot.x - Math.round(a.rot.x / TAU) * TAU) < 0.05 && Math.abs(a.rot.v) < 0.5) a.rot.x = 0;

  // blink
  a.nextBlink -= dt;
  if (a.nextBlink <= 0) { a.blinkT = C.blinkTime; a.nextBlink = C.blinkEvery[0] + rnd(a) * (C.blinkEvery[1] - C.blinkEvery[0]); }

  // ---- the pose ----
  let s = a.s.x + breath + (g ? runS : 0) + (tumbling ? 0.1 : 0);
  s = clamp(s, -C.maxSquash, C.maxStretch);
  const sh = 1 + s;
  let sw = 1 / sh;
  sw *= 1 - C.gripFlat * (o.limpet ? 2 : 1) * a.grip;
  // feet: run pattering, tucked when rising, spread when falling, braced on the wall
  const foot2 = [0, 0], shift = [0, 0]; let spread = 0.45;
  const dir = Math.sign(o.vx) || face;
  if (a.grip > 0.5) { spread = 0.45; }
  else if (!g) {
    const vy = o.vy;
    if (a.kickT > 0) { spread = 1.0; foot2[0] = 1; foot2[1] = 0; shift[0] = -dir; shift[1] = dir; }
    else if (vy < -150) { spread = 0.28; foot2[0] = foot2[1] = 1; shift[0] = shift[1] = -Math.sign(o.vx || 0); }   // rising: feet tucked, trailing
    else if (vy < 150) spread = 0.75;                                                                              // apex: feet apart
    else { spread = 0.9; }                                                                                         // falling: feet out, dangling
  } else if (a.run > 0.15) {
    const lifted = Math.round(1 + w * 1.2 * a.run);
    foot2[stepIdx] = lifted; shift[stepIdx] = Math.round(dir * w * 1.6 * a.run); spread = 0.45 + 0.1 * w;
  }
  // hands
  let hands = 'none';
  if (o.victory) hands = 'up';
  else if (a.grip > 0.3 && a.wallPx) hands = 'wall';
  else if (blocking) hands = 'brace';
  else if (a.pullT > 0) hands = 'up';
  else if (a.kickT > 0) hands = 'out';
  else if (!g && o.vy > 150) hands = 'up';
  else if (!g && Math.abs(o.vy) <= 150) hands = 'out';
  // state name (debug / pose sheet)
  let state = 'idle';
  if (a.grip > 0.5) state = o.limpet && o.vy < 25 ? 'cling' : gliding ? 'glide' : 'grip';
  else if (tumbling) state = 'tumble';
  else if (o.victory) state = 'victory';
  else if (blocking) state = 'block';
  else if (a.kickT > 0) state = a.kickKind === 'wall' ? 'walljump' : 'airjump';
  else if (!g) state = o.vy < -150 ? 'rise' : o.vy < 150 ? 'apex' : 'fall';
  else if (a.landT > 0) state = 'land';
  else if (a.run > 0.2) state = 'run';
  const lookV = Math.abs(Math.sin(o.aim)) > 0.35 ? Math.sign(Math.sin(o.aim)) : 0;
  const wallPx = a.wallPx || 0;
  a.pose = {
    sw, sh, lean: a.lean.x, lift: runLift + a.lift, rot: tumbling || Math.abs(a.rot.x) > 0.05 ? a.rot.x : 0, kick: a.kick.x * C.recoilKick,
    lagx: a.lagx.x, lagy: a.lagy.x, px: a.px.x, py: a.py.x,
    grip: a.grip, side, wallPx, glide: gliding, cling: !!o.limpet && a.grip > 0.5, hands, foot: foot2, footSpread: spread, footShift: shift,
    blink: a.blinkT > 0 && g && a.run < 0.2, look: lookV, phase: a.phase, run: a.run, state, fade: 0, flash: false, scrapeY: gliding ? Math.floor(a.t * 20) : 0,
  };
  a.last = { x: o.x, y: o.y, w: o.w, h: o.h, aim: o.aim, pose: a.pose };
  a.pg = g; a.pvx = o.vx; a.pvy = o.vy; a.lx = o.x; a.ly = o.y;
  return a.pose;
}

// The death pop: the body stretches up, flashes, then squashes flat and dithers away. u = 0..1 over CONFIG...deathTime.
export function deathPose(a) {
  const C = animCfg(); if (!a.last || a.deadT < 0 || a.deadT >= C.deathTime) return null;
  const u = a.deadT / C.deathTime;
  const base = a.last.pose || NEUTRAL_POSE;
  let sh, sw;
  if (u < 0.3) { sh = 1 + 0.4 * (u / 0.3); sw = 1 / sh; }
  else { const k = (u - 0.3) / 0.7; sh = Math.max(0.12, 1.4 - 1.3 * k * k - 0.1 * k); sw = 0.8 + 1.1 * k; }
  return { ...NEUTRAL_POSE, ...base, sw, sh, lean: 0, rot: 0, kick: 0, hands: 'none', foot: [0, 0], grip: 0, glide: false, cling: false, flash: u < 0.55, fade: u > 0.45 ? (u - 0.45) / 0.55 : 0, lift: u < 0.3 ? 2 * (u / 0.3) : 2 - 2 * ((u - 0.3) / 0.7) };
}
