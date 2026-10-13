// Ballistics helpers (pure, deterministic): where to aim so that a bullet with launch speed v and
// downward acceleration g reaches a target, and what path it flies. Used by the dummy bot and the tests.
//   y(x) = x * tan(a) + g x^2 / (2 v^2 cos^2(a))      (y grows downwards, a < 0 means upwards)

// Launch angle (radians, y down) from (mx, my) to hit (tx, ty). If the target is out of range returns 45 degrees upwards.
export function solveAim(mx, my, tx, ty, v, g) {
  let dx = tx - mx; const dy = ty - my, left = dx < 0;
  if (left) dx = -dx;
  let angle;
  if (g <= 0 || dx < 1e-6) angle = Math.atan2(dy, Math.max(dx, 1e-6));
  else {
    const A = g * dx * dx / (2 * v * v);
    const disc = dx * dx - 4 * A * (A - dy);
    if (disc < 0) angle = -Math.PI / 4;                          // out of range: lob it as far as it goes
    else angle = Math.atan((-dx + Math.sqrt(disc)) / (2 * A));   // the flat root
  }
  return left ? Math.PI - angle : angle;
}

// The same, for a gun whose muzzle is \`muzzle\` units in front of the body centre along the aim (two refinement passes).
export function solveAimFromBody(cx, cy, tx, ty, v, g, muzzle) {
  let a = solveAim(cx, cy, tx, ty, v, g);
  for (let i = 0; i < 2; i++) a = solveAim(cx + Math.cos(a) * muzzle, cy + Math.sin(a) * muzzle, tx, ty, v, g);
  return a;
}

// Vertical drop (units) of a flat shot after travelling \`range\` horizontally.
export function dropAt(range, v, g) { return g * range * range / (2 * v * v); }

// Points of the flight path from (ox, oy) at launch angle a until it has travelled \`xRange\` horizontally.
export function arcPoints(ox, oy, a, v, g, xRange, n = 12) {
  const vx = v * Math.cos(a), vy = v * Math.sin(a);
  const T = Math.abs(vx) < 1e-6 ? 0 : Math.abs(xRange / vx);
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = T * i / n; pts.push([ox + vx * t, oy + vy * t + 0.5 * g * t * t]); }
  return pts;
}
