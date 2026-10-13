// Moving platforms: position is a PURE FUNCTION of (platform definition, round tick).
// Nothing about them is stored in the state except the tick, so they never drift and the
// online client can compute exactly the same position from the tick number alone.
import { CONFIG } from '../config.js';

const cache = new WeakMap();

// Build the list of legs: each leg goes from point a to point b, takes `time` seconds,
// followed by `pause` seconds of standing still at b.
function legsOf(def) {
  let legs = cache.get(def);
  if (legs) return legs;
  const pts = def.path, order = [];
  for (let i = 0; i < pts.length; i++) order.push(i);
  if (def.mode === 'loop') order.push(0);                                   // 0,1,2,0
  else for (let i = pts.length - 2; i >= 0; i--) order.push(i);             // ping-pong: 0,1,2,1,0
  legs = [];
  let total = 0;
  for (let i = 0; i + 1 < order.length; i++) {
    const a = pts[order[i]], b = pts[order[i + 1]];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const time = len / Math.max(1, def.speed);
    legs.push({ a, b, time, pause: def.pause || 0, start: total });
    total += time + (def.pause || 0);
  }
  legs.total = total;
  cache.set(def, legs);
  return legs;
}

// Top-left position of the platform at a given round tick.
export function platformPos(def, tick) {
  const legs = legsOf(def);
  if (!legs.length || legs.total <= 0) return { x: def.path[0].x, y: def.path[0].y };
  const t = ((tick / CONFIG.tickRate) % legs.total + legs.total) % legs.total;
  for (const l of legs) {
    if (t < l.start + l.time) {
      const u = (t - l.start) / l.time;
      return { x: l.a.x + (l.b.x - l.a.x) * u, y: l.a.y + (l.b.y - l.a.y) * u };
    }
    if (t < l.start + l.time + l.pause) return { x: l.b.x, y: l.b.y };
  }
  return { x: def.path[0].x, y: def.path[0].y };
}
