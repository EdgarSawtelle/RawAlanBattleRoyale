// ============================================================================
//  dummy-bot.js - the practice dummy. A plain function that turns the game state into an
//  INPUT OBJECT, exactly the same shape a human's keyboard/mouse produces:
//      { left, right, jump, jumpPressed, shoot, block, aim }
//  so it obeys ammo, reload, block cooldown etc. like any player. It is a training target, not a
//  perfect opponent: it sees the player late, aims with some error, shoots in bursts, sometimes
//  blocks, wanders between platforms and mostly (not always) avoids walking off into the pit.
//  Behaviour numbers live in config.js (CONFIG.dummy). The bot keeps its own small memory object
//  and its own seeded RNG (it never uses Math.random), so a run can be replayed.
// ============================================================================
import { CONFIG } from '../config.js';
import { getColliders } from '../sim/world.js';
import { getHazards } from '../sim/hazards.js';
import { lineBlocked } from '../sim/collision.js';
import { solveAimFromBody, arcPoints } from '../sim/aim.js';
import { CONFIG as CFG } from '../config.js';

export function createBot(seed = 1, overrides = {}) {
  return {
    mode: 'active',          // 'active' | 'passive' (moves, never shoots/blocks) | 'off' (stands still)
    cfg: { ...CONFIG.dummy, ...overrides },
    seed: seed | 0,
    time: 0,
    goal: null, goalTimer: 0, waitTimer: 0,
    burstLeft: 0, burstPause: 0.8, aimErr: 0, lastAmmo: -1,
    history: [],             // recent positions of the enemy [{t,x,y}] (for the reaction delay)
    blockSeen: new Set(),    // bullet ids it already decided about
    blockHold: 0,
    jumpHold: 0, prevJump: false, wallTap: 0,
    stuckT: 0, stuckX: 0,
    prevAlive: true,
    hzSeen: new Set(), hzBrave: new Set(),   // hazards it has already decided about (and the few it ignores on purpose)
  };
}

function rnd(bot) {   // mulberry32 on bot.seed
  bot.seed = (bot.seed + 0x6D2B79F5) | 0;
  let t = Math.imul(bot.seed ^ (bot.seed >>> 15), 1 | bot.seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (bot, a, b) => a + (b - a) * rnd(bot);

function pointSolid(x, y, cols) {
  for (const c of cols) if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) return true;
  return false;
}

// Returns the input for player `self` this tick.
export function botInput(bot, state, self, dt) {
  const cfg = bot.cfg, me = state.players[self], enemy = state.players[1 - self];
  const out = { left: false, right: false, jump: false, jumpPressed: false, shoot: false, block: false, aim: me.aim };
  bot.time += dt;
  if (!me.alive) return out;
  const cols = getColliders(state);

  // remember where the enemy was (for the reaction delay)
  bot.history.push({ t: bot.time, x: enemy.x, y: enemy.y });
  while (bot.history.length > 1 && bot.history[1].t < bot.time - cfg.reactionTime) bot.history.shift();
  const seen = bot.history[0];

  // a new round: forget old plans
  if (me.hp === me.stats.maxHp && me.ammo === me.stats.magazine && state.roundTick < 3) {
    bot.goal = null; bot.burstLeft = 0; bot.burstPause = 0.8; bot.blockSeen.clear(); bot.history.length = 0; bot.hzSeen.clear(); bot.hzBrave.clear();
  }

  // ---------------- aiming + shooting ----------------------------------------------------------
  if (enemy.alive) {
    const dx = seen.x - me.x, dy = seen.y - me.y, dist = Math.hypot(dx, dy);
    // aim along the exact ballistic solution (the bullets arc), then add the bot's deliberate aim error
    const v = me.stats.bulletSpeed, g = me.stats.bulletGravity, muzzle = Math.max(CFG.player.muzzleDistance, Math.max(me.w, me.h) / 2 + 3);
    const ideal = solveAimFromBody(me.x, me.y, seen.x, seen.y, v, g, muzzle);
    out.aim = ideal + bot.aimErr;
    // line of sight along the ARC (not the chord): sample the flight path and test every piece
    let los = true;
    if (cfg.needLineOfSight) {
      const ox = me.x + Math.cos(ideal) * muzzle, oy = me.y + Math.sin(ideal) * muzzle;
      const pts = arcPoints(ox, oy, ideal, v, g, seen.x - ox, 14);
      for (let i = 1; i < pts.length && los; i++) if (lineBlocked(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], cols)) los = false;
    }
    if (bot.mode === 'active') {
      if (me.ammo < bot.lastAmmo && bot.burstLeft > 0) bot.burstLeft -= 1;   // a shot left the gun
      bot.lastAmmo = me.ammo;
      if (bot.burstLeft > 0) {
        out.shoot = true;
        if (!los) bot.burstLeft = 0;
      } else {
        bot.burstPause -= dt;
        if (bot.burstPause <= 0 && los && dist < cfg.maxRange && me.reloadLeft <= 0 && me.ammo > 0) {
          bot.burstLeft = 1 + Math.floor(rnd(bot) * (cfg.burstMax - cfg.burstMin + 1)) + (cfg.burstMin - 1);
          bot.aimErr = (rnd(bot) - 0.5) * 2 * cfg.aimErrorDeg * Math.PI / 180;
          bot.burstPause = between(bot, cfg.burstPauseMin, cfg.burstPauseMax);
        }
      }
    }
  }

  // ---------------- blocking --------------------------------------------------------------------
  if (bot.mode === 'active') {
    bot.blockHold = Math.max(0, bot.blockHold - dt);
    for (const b of state.bullets) {
      if (b.owner === self || bot.blockSeen.has(b.id)) continue;
      const bx = b.x - me.x, by = b.y - me.y, d = Math.hypot(bx, by);
      if (d < cfg.blockTriggerDist && (b.vx * -bx + b.vy * -by) > 0) {      // close and coming our way
        bot.blockSeen.add(b.id);
        if (me.blockCd <= 0 && rnd(bot) < cfg.blockChance) bot.blockHold = 0.12;
      }
    }
    out.block = bot.blockHold > 0;
  }

  // ---------------- movement --------------------------------------------------------------------
  if (bot.mode !== 'off') moveLogic(bot, state, me, cols, out, dt, getHazards(state));

  out.jumpPressed = out.jump && !bot.prevJump;
  bot.prevJump = out.jump;
  return out;
}

function pickGoal(bot, me, cols) {
  const cfg = bot.cfg, feetY = me.y + me.h / 2;
  // never aim for burning grates, and skip the slabs down in the pit unless it is already down there
  const surfaces = cols.filter((c) => c.kind !== 'block' && c.kind !== 'hazard' && c.w >= 60 && c.y > -50 && (c.y < 540 || feetY > 520));
  // surfaces that are not too far above us (we cannot climb 300 units) - and not the one we stand on
  let options = surfaces.filter((c) => c.y > feetY - 110 && Math.abs((c.x + c.w / 2) - me.x) > 60);
  // standing on something: only wander to surfaces one jump away (a goal across a gap that is too wide just made the bot stand at the edge)
  const here = me.grounded ? cols.find((c) => c.kind !== 'block' && Math.abs(c.y - feetY) < 2 && me.x >= c.x - 4 && me.x <= c.x + c.w + 4) : null;
  if (here) {
    const near = (c) => { const up = here.y - c.y, gap = Math.max(0, Math.max(here.x, c.x) - Math.min(here.x + here.w, c.x + c.w)); return up >= 0 ? up <= 100 && gap <= 150 : gap <= 185; };
    const hop = options.filter((c) => c !== here && near(c));
    if (hop.length && rnd(bot) < 0.8) options = hop;                  // (now and then any surface, as before: the bot walks to the edge, looks, maybe jumps)
  }
  const list = options.length ? options : surfaces;
  const c = list[Math.floor(rnd(bot) * list.length)];
  bot.goal = { x: c.x + 12 + rnd(bot) * Math.max(1, c.w - 24), top: c.y, kind: c.kind, id: c.id };
  bot.goalTimer = between(bot, cfg.wanderMin, cfg.wanderMax);
}

// Is there a surface we could reach with a jump in direction dir (30-190 units ahead, not far above or below)?
function gapLanding(me, dir, cols, feetY, minWidth = 1, from = 30, to = 190) {
  for (let d = from; d <= to; d += 10) {
    const X = me.x + dir * (me.w / 2 + d);
    for (const c of cols) if (c.kind !== 'block' && c.kind !== 'hazard' && c.w >= minWidth && X >= c.x && X <= c.x + c.w && c.y >= feetY - 95 && c.y <= feetY + 60) return true;
  }
  return false;
}

// Is a body at (x, y) within pad units of a hazard?
function nearHazard(x, y, pad, hz) {
  for (const h of hz) {
    const hit = h.shape === 'circle' ? Math.hypot(x - h.cx, y - h.cy) < h.r + pad + 15
      : (x + 15 > h.x - pad && x - 15 < h.x + h.w + pad && y + 15 > h.y - pad && y - 15 < h.y + h.h + pad);
    if (hit) return h;
  }
  return null;
}

function moveLogic(bot, state, me, cols, out, dt, hz) {
  const cfg = bot.cfg, feetY = me.y + me.h / 2;
  bot.goalTimer -= dt; bot.waitTimer = Math.max(0, bot.waitTimer - dt);
  if (!bot.goal || bot.goalTimer <= 0) pickGoal(bot, me, cols);
  let goal = bot.goal;
  if (goal.kind === 'platform') { const pl = cols.find((c) => c.kind === 'platform' && c.id === goal.id); if (pl) goal = bot.goal = { ...goal, x: pl.x + pl.w / 2, top: pl.y }; }

  const dx = goal.x - me.x;
  let dir = Math.abs(dx) > 10 ? Math.sign(dx) : 0;
  const goalAbove = goal.top < feetY - 30, goalBelow = goal.top > feetY + 24;

  // arrived: stand around for a moment, then choose somewhere else
  if (dir === 0 && Math.abs(goal.top - feetY) < 12 && me.grounded) { if (bot.waitTimer <= 0) { bot.waitTimer = between(bot, 0.3, 1.2); bot.goalTimer = Math.min(bot.goalTimer, bot.waitTimer); } dir = 0; }

  if (dir === 0 && goalBelow && me.grounded) dir = goal.x >= me.x ? 1 : -1;     // standing on a crate right above the goal: step off it
  let jump = false;
  if (me.grounded) {
    const aheadX = me.x + (dir || 1) * (me.w / 2 + 12);
    const groundAhead = pointSolid(aheadX, feetY + 4, cols);
    const wallAhead = dir !== 0 && (pointSolid(aheadX, me.y, cols) || pointSolid(aheadX, me.y - 10, cols));
    if (wallAhead) {
      // hop over low cover; if the wall is too high, give up this goal
      if (pointSolid(aheadX, me.y - 105, cols)) bot.goalTimer = 0;
      else if (gapLanding(me, dir, cols, feetY, 40, 30, 230)) jump = true;         // only hop if there is ground (at least 40 wide: a stair step counts) to land on beyond it
      else dir = 0;
    } else if (dir !== 0 && !groundAhead) {
      if (goalAbove || (!goalBelow && gapLanding(me, dir, cols, feetY))) jump = true;     // jump the gap if there is something to land on
      else if (!goalBelow && rnd(bot) < cfg.edgeAvoidChance) { dir = 0; bot.goalTimer = 0; } // do not walk off into the pit
      else if (goalBelow && goal.kind === 'platform') {
        // dropping onto a moving platform: wait until it is underneath
        const pl = cols.find((c) => c.kind === 'platform' && c.id === goal.id), lx = me.x + dir * 34;
        if (!pl || lx < pl.x - 6 || lx > pl.x + pl.w + 6) { dir = 0; if (!pl || Math.abs(pl.x + pl.w / 2 - me.x) > 160) bot.goalTimer = 0; }   // (a platform far away sideways is no goal from here: choose another)
      }
      // other goals below: just walk off (a deliberate drop)
    }
    if (goalAbove && Math.abs(dx) < cfg.jumpReach && Math.abs(dx) > 30) jump = true;      // get up onto the higher platform
    if (!jump && rnd(bot) < cfg.randomJumpPerSec * dt) jump = true;                         // a pointless hop now and then
  } else {
    // in the air: keep steering to the goal, hold jump while rising to a higher goal
    if (goalAbove && me.vy < 0) jump = true;
    // wall climbing: gripping a wall (holding into it) with a higher goal -> tap jump in the ROUNDS rhythm (every ~0.3 s)
    bot.wallTap = Math.max(0, bot.wallTap - dt);
    if (goalAbove && me.wallDir !== 0 && (dir === me.wallDir || dir === 0) && bot.wallTap <= 0 && me.vy >= -50) {
      dir = me.wallDir; jump = true; bot.jumpHold = 0.12; bot.wallTap = 0.32;
    }
    if (me.y > CONFIG.field.h - 60 && me.vy > 0) dir = me.x < 640 ? 1 : -1;               // falling into the pit: steer back to the middle
  }

  // hazards: stop short of them (most of the time), step away from a saw that is on top of us,
  // and do not jump up into spikes overhead
  if (dir !== 0) {
    const h = nearHazard(me.x + dir * 46, me.y, 14, hz);
    if (h) {
      if (!bot.hzSeen.has(h.id)) { bot.hzSeen.add(h.id); if (rnd(bot) > cfg.edgeAvoidChance) bot.hzBrave.add(h.id); }
      if (!bot.hzBrave.has(h.id)) { dir = 0; if (me.grounded) bot.goalTimer = Math.min(bot.goalTimer, 0.4); }
    }
  }
  for (const h of hz) if (h.shape === 'circle' && Math.hypot(me.x - h.cx, me.y - h.cy) < h.r + 60) { dir = Math.sign(me.x - h.cx) || 1; }
  if (jump && nearHazard(me.x, me.y - 70, 8, hz)) jump = false;

  // stuck detection: pressing a direction but not getting anywhere
  if (dir !== 0 && Math.abs(me.x - bot.stuckX) < 3) bot.stuckT += dt; else { bot.stuckT = 0; bot.stuckX = me.x; }
  if (bot.stuckT > 0.8) { jump = true; bot.stuckT = 0; if (rnd(bot) < 0.5) bot.goalTimer = 0; }

  out.left = dir < 0; out.right = dir > 0;
  // a jump is held for ~0.3 s so it reaches full height
  if (jump) bot.jumpHold = 0.3;
  bot.jumpHold = Math.max(0, bot.jumpHold - dt);
  out.jump = bot.jumpHold > 0 || jump;
  if (out.jump && bot.prevJump && me.grounded && me.vy >= 0) out.jump = false;            // jump held while standing on the ground (blocked at a wall): let go for one tick so the next press is a fresh one
}
