// Axis-aligned box helpers. Bodies (players) are described by their CENTRE x,y and size w,h.
// Colliders (terrain) are plain rectangles { x, y, w, h, kind, id } with x,y = top-left.
// Touching is NOT overlapping (strict comparison), so standing on a slab is stable.

export function bodyOverlaps(b, c, dx = 0, dy = 0) {
  return Math.abs(b.x + dx - (c.x + c.w / 2)) < (b.w + c.w) / 2 &&
         Math.abs(b.y + dy - (c.y + c.h / 2)) < (b.h + c.h) / 2;
}

export function firstOverlap(b, colliders, dx = 0, dy = 0) {
  for (const c of colliders) if (bodyOverlaps(b, c, dx, dy)) return c;
  return null;
}

// Move a body by (dx, dy) in small substeps, stopping at solids. Returns the direction of the
// hit on each axis (0 = none, +1 = moving right/down hit something, -1 = left/up) and the
// collider hit vertically (the thing we landed on, if moving down).
// opts (both default 0 = off) add corner forgiveness while keeping the plain box collider:
//   ledgeStep   walking / jumping sideways into a collider whose top is at most this far above the
//               body's feet pops the body up onto it ("rolling over a corner")
//   cornerNudge moving up into a ceiling corner that overlaps the body by at most this much slides
//               the body sideways round it instead of stopping it
// `popped` / `nudged` report that a rule fired.
export function moveBody(b, dx, dy, colliders, maxStep, opts) {
  const ledge = (opts && opts.ledgeStep) || 0, nudge = (opts && opts.cornerNudge) || 0;
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / maxStep));
  const sx = dx / n, sy = dy / n;
  let hitX = 0, hitY = 0, hitCollY = null, popped = false, nudged = false;
  for (let i = 0; i < n; i++) {
    if (sx !== 0 && !hitX) {
      b.x += sx;
      const c = firstOverlap(b, colliders);
      if (c) {
        let handled = false;
        if (ledge > 0) {                                           // ledge pop
          const rise = (b.y + b.h / 2) - c.y;                      // how far the feet are below the collider's top
          if (rise > 0 && rise <= ledge) {
            const y0 = b.y; b.y = c.y - b.h / 2;
            if (!firstOverlap(b, colliders)) { handled = true; popped = true; } else b.y = y0;
          }
        }
        if (!handled) { b.x = sx > 0 ? c.x - b.w / 2 : c.x + c.w + b.w / 2; hitX = Math.sign(sx); }
      }
    }
    if (sy !== 0 && !hitY) {
      b.y += sy;
      const c = firstOverlap(b, colliders);
      if (c) {
        let handled = false;
        if (nudge > 0 && sy < 0) {                                 // head-bump nudge
          const ol = Math.min(b.x + b.w / 2 - c.x, c.x + c.w - (b.x - b.w / 2));   // horizontal overlap with the ceiling block
          if (ol > 0 && ol <= nudge) {
            const x0 = b.x;
            b.x = b.x < c.x + c.w / 2 ? c.x - b.w / 2 - 0.01 : c.x + c.w + b.w / 2 + 0.01;
            if (!firstOverlap(b, colliders)) { handled = true; nudged = true; } else b.x = x0;
          }
        }
        if (!handled) { b.y = sy > 0 ? c.y - b.h / 2 : c.y + c.h + b.h / 2; hitY = Math.sign(sy); hitCollY = c; }
      }
    }
  }
  return { hitX, hitY, hitCollY, popped, nudged };
}

// Push a body out of any collider it overlaps along the shortest axis (moving platforms
// sweeping into a player, a block growing, a card changing the body size, ...).
export function depenetrate(b, colliders) {
  for (let iter = 0; iter < 4; iter++) {
    let moved = false;
    for (const c of colliders) {
      if (!bodyOverlaps(b, c)) continue;
      const left = (c.x - (b.x + b.w / 2));            // push left amount (negative number)
      const right = (c.x + c.w - (b.x - b.w / 2));     // push right amount
      const up = (c.y - (b.y + b.h / 2));
      const down = (c.y + c.h - (b.y - b.h / 2));
      const m = Math.min(Math.abs(left), Math.abs(right), Math.abs(up), Math.abs(down));
      if (m === Math.abs(up)) b.y += up;
      else if (m === Math.abs(down)) b.y += down;
      else if (m === Math.abs(left)) b.x += left;
      else b.x += right;
      moved = true;
    }
    if (!moved) break;
  }
}

// Does a circle overlap a rectangle?
export function circleHitsRect(cx, cy, r, c) {
  const nx = Math.max(c.x, Math.min(cx, c.x + c.w));
  const ny = Math.max(c.y, Math.min(cy, c.y + c.h));
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

export function circleFirstHit(cx, cy, r, colliders) {
  for (const c of colliders) if (circleHitsRect(cx, cy, r, c)) return c;
  return null;
}

// Distance from a point to the nearest point of a body's box (0 when inside).
export function distPointToBody(px, py, b) {
  const nx = Math.max(b.x - b.w / 2, Math.min(px, b.x + b.w / 2));
  const ny = Math.max(b.y - b.h / 2, Math.min(py, b.y + b.h / 2));
  return Math.hypot(px - nx, py - ny);
}
export function distPointToRect(px, py, c) {
  const nx = Math.max(c.x, Math.min(px, c.x + c.w));
  const ny = Math.max(c.y, Math.min(py, c.y + c.h));
  return Math.hypot(px - nx, py - ny);
}

// Is the straight line between two points blocked by terrain? (used by the dummy bot)
export function lineBlocked(x0, y0, x1, y1, colliders) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6);
  for (let i = 1; i < n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    for (const c of colliders) if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) return true;
  }
  return false;
}
