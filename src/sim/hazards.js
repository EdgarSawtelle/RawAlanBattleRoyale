// Map hazards: things that hurt on contact. Everything is data-driven from the map file
// (`hazards: [...]`) and tuned in CONFIG.hazards. Hazard damage is ENVIRONMENT damage (source -1).
//
//   { id, type: 'spikes', x, y, w, h, face: 'up'|'down'|'left'|'right' }   rusted rebar spikes: a damage zone (not solid)
//   { id, type: 'grate',  x, y, w, h, solid: true }                        burning ember grate: a solid platform that hurts
//   { id, type: 'saw', r, path: [{x,y},..], speed, pause, mode }           saw blade; path points are the blade CENTRE;
//                                                                          position is a pure function of the round tick
//   explosive barrels are destructibles with kind: 'barrel' (see combat.js damageBlock)
//
// A player touched by a hazard loses CONFIG.hazards[type].damage, is shoved away from it, and is
// immune to further hazard hits for CONFIG.hazards.rehit seconds.
import { CONFIG } from '../config.js';
import { getMap } from '../maps/index.js';
import { platformPos } from './platforms.js';
import { bodyOverlaps, circleHitsRect } from './collision.js';
import { emit, damagePlayer } from './combat.js';

const FACE = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

// Hazards at the current round tick: rects { shape:'rect', x,y,w,h } and circles { shape:'circle', cx,cy,r }.
export function getHazards(state, tick = state.roundTick) {
  const map = getMap(state.mapId), out = [];
  for (const h of map.hazards || []) {
    if (h.type === 'saw') {
      const pos = platformPos(h, tick);          // the path points are centres, so this IS the centre
      out.push({ id: h.id, type: 'saw', shape: 'circle', cx: pos.x, cy: pos.y, r: h.r });
    } else {
      out.push({ id: h.id, type: h.type, shape: 'rect', x: h.x, y: h.y, w: h.w, h: h.h, face: h.face || null, solid: !!h.solid });
    }
  }
  return out;
}

// Solid hazards (grates) also act as terrain.
export function solidHazardColliders(hazards) {
  return hazards.filter((h) => h.shape === 'rect' && h.solid).map((h) => ({ x: h.x, y: h.y, w: h.w, h: h.h, kind: 'hazard', id: h.id }));
}

function outwardNormal(p, h) {
  if (h.shape === 'circle') {
    const dx = p.x - h.cx, dy = p.y - h.cy, len = Math.hypot(dx, dy) || 1;
    return [dx / len, dy / len];
  }
  if (h.face && FACE[h.face]) {
    const n = FACE[h.face], side = Math.sign(p.x - (h.x + h.w / 2)) || 1;
    return n[0] === 0 ? [side * 0.35, n[1]] : [n[0], -0.35];     // spikes also push a little sideways / up
  }
  // nearest side of the rectangle
  const pl = (p.x + p.w / 2) - h.x, pr = (h.x + h.w) - (p.x - p.w / 2), pu = (p.y + p.h / 2) - h.y, pd = (h.y + h.h) - (p.y - p.h / 2);
  const m = Math.min(pl, pr, pu, pd);
  if (m === pu) return [Math.sign(p.x - (h.x + h.w / 2)) * 0.3, -1];
  if (m === pd) return [0, 1];
  return m === pl ? [-1, -0.35] : [1, -0.35];
}

export function stepHazards(state, hazards) {
  const H = CONFIG.hazards;
  for (const p of state.players) {
    p.hazardCd = Math.max(0, (p.hazardCd || 0) - 1 / CONFIG.tickRate);
    if (!p.alive || p.hazardCd > 0) continue;
    for (const h of hazards) {
      const touching = h.shape === 'circle'
        ? circleHitsRect(h.cx, h.cy, h.r + 1, { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h })
        : bodyOverlaps(p, { x: h.x - 1, y: h.y - 1, w: h.w + 2, h: h.h + 2 });
      if (!touching) continue;
      const cfg = H[h.type];
      const n = outwardNormal(p, h);
      const len = Math.hypot(n[0], n[1]) || 1;
      p.hazardCd = H.rehit;
      emit(state, 'hazardHit', { player: p.index, hazard: h.id, kind: h.type, x: p.x, y: p.y, nx: n[0] / len, ny: n[1] / len });
      damagePlayer(state, p.index, cfg.damage, -1, null, { x: p.x, y: p.y });
      if (p.alive) {
        p.vx = (n[0] / len) * cfg.shove; p.vy = (n[1] / len) * cfg.shove;
        p.jumping = false; p.grounded = false; p.groundId = null; p.carry = CONFIG.move.carryTime;
      }
      break;                                                   // one hazard hit per tick
    }
  }
}
