// ============================================================================
//  lib.js - shared core + effects for the procedural background scenes.
//  All drawing is on integer pixels with image smoothing off. Everything animated is a pure
//  function of time (ms) so any frame is reproducible. Static art is baked once to offscreen
//  canvases (see layer()).
// ============================================================================
import { W, H, use, P, R, LN, ELLpx, DISC, FPOLY, hash, mulberry32, bay, ctx as curCtx } from '../px.js';
export { W, H, use, P, R, LN, ELLpx, DISC, FPOLY, hash, mulberry32, bay };
export const TAU = Math.PI * 2;

/* ---------- canvases ---------- */
export function mkCanvas(w = W, h = H) {
  // DOM canvas on the page, OffscreenCanvas inside the background worker
  let c; if (typeof document !== 'undefined') { c = document.createElement('canvas'); c.width = w; c.height = h; } else c = new OffscreenCanvas(w, h);
  c.getContext('2d').imageSmoothingEnabled = false; return c;
}
export function layer(w, h, fn) { const prev = curCtx(); const c = mkCanvas(w, h); const g = c.getContext('2d'); use(g); fn(g, c); if (prev) use(prev); return c; }

/* ---------- colour ---------- */
export function rgb(h) { if (h[0] === '#') h = h.slice(1); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
export function hex(r, g, b) { return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
export function mix(a, b, t) { const A = rgb(a), B = rgb(b); return hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); }
export function rgba(h, a) { const c = rgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
export function mixAll(arr, b, t) { return arr.map(c => mix(c, b, t)); }
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* ---------- noise ---------- */
export function vnoise(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, s = 0, o = 4) { let a = 0.5, f = 1, sum = 0, n = 0; for (let i = 0; i < o; i++) { sum += vnoise(x * f, y * f, s + i * 7) * a; n += a; a *= 0.5; f *= 2; } return sum / n; }

/* ---------- wind: gusts that travel left to right across the screen ---------- */
export function wind(x, t, seed = 0) {
  const a = Math.sin(t * 0.0011 - x * 0.0045 + seed);
  const b = Math.sin(t * 0.0029 - x * 0.011 + seed * 2.3) * 0.5;
  const gu = Math.max(0, Math.sin(t * 0.00042 - x * 0.0016 + 1.0)); // big gust rolling across (~15s)
  return a * 0.5 + b * 0.4 + gu * gu * 1.3;
}

/* Draw a baked sprite sheared in rows so it bends in the wind. anchor: 'top' (vines) or 'bottom' (grass, trees).
   The sheared frames are baked lazily per quantised bend (half pixels) so a draw is a single drawImage. */
const SWC = new WeakMap();
function swayBake(spr, bottom, pw, rh, pad, q) {
  const w = spr.width, h = spr.height, fr = mkCanvas(w + pad * 2, h), fg = fr.getContext('2d');
  for (let r = 0; r < h; r += rh) { const k = bottom ? (h - r) / h : r / h, off = Math.round(q * Math.pow(k, pw)), hh = Math.min(rh, h - r); fg.drawImage(spr, 0, r, w, hh, pad + off, r, w, hh); }
  return fr;
}
export function swaySprite(g, spr, x, y, t, o = {}) {
  const w = spr.width, amp = o.amp == null ? 2 : o.amp, ph = o.phase || 0;
  const wv = wind(x + w / 2, t, ph) * (o.windMul == null ? 1 : o.windMul), rip = Math.sin(t * 0.0035 + ph * 3.1) * 0.3;
  const pad = Math.ceil(amp * 2.2) + 2, lim = amp * 2.1 + 1, step = amp >= 3 ? 1 : 0.5;
  const q = clamp(Math.round((wv * 0.7 + rip * 0.6) * amp / step) * step, -lim, lim);
  const bottom = o.anchor === 'bottom', pw = o.pow || 1.4, rh = o.rowH || 2;
  let cache = SWC.get(spr); if (!cache) { cache = new Map(); SWC.set(spr, cache); }
  const base = (bottom ? 'b' : 't') + pw + '|' + rh + '|';
  if (!cache.has(base + 'warm')) { // bake the whole plausible bend range once, so no frame ever pays for it
    cache.set(base + 'warm', 1);
    for (let qq = Math.floor(-0.9 * amp / step) * step; qq <= 1.9 * amp + step; qq += step) if (!cache.has(base + qq)) cache.set(base + qq, swayBake(spr, bottom, pw, rh, pad, qq));
  }
  let fr = cache.get(base + q); if (!fr) { fr = swayBake(spr, bottom, pw, rh, pad, q); cache.set(base + q, fr); }
  g.drawImage(fr, Math.round(x) - pad, Math.round(y));
}
/* Sparse-layer blitter: only the non-empty horizontal runs of 64x60 tiles are drawn (big saving for edge-only layers). */
export function fast(canvas, tw = 64, th = 60) {
  const w = canvas.width, h = canvas.height, d = canvas.getContext('2d').getImageData(0, 0, w, h).data, runs = [];
  for (let ty = 0; ty < h; ty += th) {
    let run = null;
    for (let tx = 0; tx < w; tx += tw) {
      let any = false; const xe = Math.min(w, tx + tw), ye = Math.min(h, ty + th);
      for (let y = ty; y < ye && !any; y++) for (let x = tx; x < xe; x++) if (d[(y * w + x) * 4 + 3] > 0) { any = true; break; }
      if (any) { if (run) run[2] = xe - run[0]; else run = [tx, ty, xe - tx, ye - ty]; } else if (run) { runs.push(run); run = null; }
    }
    if (run) runs.push(run);
  }
  return { canvas, runs, draw(g, x = 0, y = 0) { for (const r of runs) g.drawImage(canvas, r[0], r[1], r[2], r[3], x + r[0], y + r[1], r[2], r[3]); } };
}

/* ---------- dithered gradients ---------- */
/* Linear interpolation of a colour list to n stops (finer steps = no visible banding in a dithered sky). */
export function expandRamp(colors, n) { const out = []; for (let i = 0; i < n; i++) { const f = i / (n - 1) * (colors.length - 1), k = Math.min(colors.length - 2, Math.floor(f)); out.push(mix(colors[k], colors[k + 1], f - k)); } return out; }
/* Vertical multi-colour ramp with ordered dither between neighbouring colours (q = dither levels). */
export function gradV(x, y, w, h, colors, q = 4, f0 = 0, f1 = 1) {
  const n = colors.length; const g = curCtx();
  for (let j = 0; j < h; j++) {
    const f = f0 + (f1 - f0) * ((j + 0.5) / h), pos = clamp(f, 0, 1) * (n - 1), i0 = Math.min(n - 2, Math.floor(pos)), fr = pos - i0;
    const lvl = Math.round(fr * q) / q * 16; const yy = y + j;
    let runC = null, runX = 0;
    for (let i = 0; i <= w; i++) {
      const c = i < w ? ((lvl > bay(x + i, yy)) ? colors[i0 + 1] : colors[i0]) : null;
      if (c !== runC) { if (runC) { g.fillStyle = runC; g.fillRect(x + runX, yy, i - runX, 1); } runC = c; runX = i; }
    }
  }
}

/* Radial glow with ordered dither: quantised alpha rings of a colour. */
export function glow(cx, cy, r, col, maxA, steps = 5, power = 2, sy = 1) {
  const g = curCtx(), [cr, cg, cb] = rgb(col);
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W, Math.ceil(cx + r)), y0 = Math.max(0, Math.floor(cy - r * sy)), y1 = Math.min(H, Math.ceil(cy + r * sy));
  for (let lv = 1; lv <= steps; lv++) {
    g.fillStyle = 'rgba(' + cr + ',' + cg + ',' + cb + ',' + (maxA * lv / steps).toFixed(3) + ')';
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const d = Math.hypot(x - cx, (y - cy) / sy) / r; if (d >= 1) continue;
      const t = Math.pow(1 - d, power) * steps + bay(x, y) / 16 - 0.5;
      if (Math.floor(t + 0.5) === lv) g.fillRect(x, y, 1, 1);
    }
  }
}

/* ---------- god rays ----------
   Each shaft = a fan from (ox,oy) along angle ang (radians, 0 = right, PI/2 = down) with half width
   growing along its length. Baked as 3 dithered intensity levels of a warm colour. Drawn additive. */
export function shaftLayer(sh, col = '#ffe2a0', maxA = 0.2) {
  const [cr, cg, cb] = rgb(col);
  return layer(W, H, g => {
    const dx = Math.cos(sh.ang), dy = Math.sin(sh.ang), nx = -dy, ny = dx;
    const lv = [0, 0.4, 0.72, 1].map(v => 'rgba(' + cr + ',' + cg + ',' + cb + ',' + (maxA * sh.a * v).toFixed(3) + ')');
    for (let lvl = 1; lvl <= 3; lvl++) {
      g.fillStyle = lv[lvl];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const px = x - sh.ox, py = y - sh.oy, s = px * dx + py * dy; if (s < 0 || s > sh.len) continue;
        const n = Math.abs(px * nx + py * ny), hw = sh.w0 / 2 + s * sh.spread;
        if (n >= hw) continue;
        let k = (1 - n / hw); k = Math.min(1, k * 2.2);        // soft edges, flat core
        k *= Math.pow(1 - s / sh.len, 0.8) * smooth(0, 18, s);
        if (sh.mask) k *= sh.mask(x, y);
        const t = k * 3 + bay(x, y) / 16 - 0.5;
        if (Math.floor(t + 0.5) === lvl) g.fillRect(x, y, 1, 1);
      }
    }
  });
}
export function shaftContains(sh, x, y) {
  const dx = Math.cos(sh.ang), dy = Math.sin(sh.ang), px = x - sh.ox, py = y - sh.oy, s = px * dx + py * dy;
  if (s < 0 || s > sh.len) return 0; const n = Math.abs(-px * dy + py * dx), hw = sh.w0 / 2 + s * sh.spread;
  if (n >= hw) return 0; return Math.min(1, (1 - n / hw) * 2) * (1 - s / sh.len);
}

/* ---------- clouds ---------- */
export function cloudSprite(w, h, seed, pal) {
  return layer(w, h, g => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const nx = x / w, ny = y / h;
      const env = Math.pow(Math.sin(nx * Math.PI), 0.7) * Math.pow(Math.sin(Math.min(1, ny * 1.15) * Math.PI), 0.55) * (ny > 0.78 ? Math.max(0, 1 - (ny - 0.78) * 7) : 1);
      const v = fbm(x * 0.05 + seed * 11, y * 0.11, seed, 4) * env * 1.55 - 0.42;
      if (v <= 0) continue;
      let c;
      const under = ny + (fbm(x * 0.09, y * 0.2, seed + 3, 2) - 0.5) * 0.4;
      if (v < 0.05 && bay(x, y) < 8) continue;                       // dithered rim
      if (under > 0.58) c = pal.hi; else if (under > 0.36) c = pal.mid; else c = pal.lo;
      if (nx > 0.62 && under > 0.4 && under <= 0.58 && bay(x, y) < 7) c = pal.hi;
      if (v > 0.32 && under < 0.34) c = (bay(x, y) < 8) ? pal.lo : pal.mid;
      P(x, y, c);
    }
  });
}

/* ---------- mist ---------- */
export function mistSprite(w, h, seed, col, a1, a2, sx = 0.012, sy = 0.07) {
  const [cr, cg, cb] = rgb(col);
  return layer(w, h, g => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      // periodic in x so the sprite tiles
      const u = x / w * TAU, nxx = Math.cos(u) * (w * sx / TAU), nyy = Math.sin(u) * (w * sx / TAU);
      const v = fbm(nxx + 40, nyy + y * sy + seed * 13, seed, 3) * Math.pow(Math.sin((y + 0.5) / h * Math.PI), 0.8);
      const lvl = v > 0.46 ? 2 : v > 0.36 ? 1 : 0;
      if (!lvl) continue; if (lvl === 1 && bay(x, y) > 8) continue;
      g.fillStyle = 'rgba(' + cr + ',' + cg + ',' + cb + ',' + (lvl === 2 ? a2 : a1) + ')'; g.fillRect(x, y, 1, 1);
    }
  });
}
/* Tile a w-periodic sprite across the screen, scrolling at vx px/s. */
export function drawTiled(g, spr, y, t, vx, ph = 0, alpha = 1) {
  const w = spr.width; let ox = -(((t * vx / 1000 + ph) % w) + w) % w; ox = Math.round(ox);
  if (alpha !== 1) g.globalAlpha = alpha;
  for (let x = ox; x < W; x += w) g.drawImage(spr, x, y);
  if (alpha !== 1) g.globalAlpha = 1;
}

/* ---------- birds ---------- */
const BIRD_FR = [
  [[-3, -2], [-2, -1], [-1, 0], [0, 0], [1, 0], [2, -1], [3, -2]],
  [[-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [3, 0]],
  [[-3, 1], [-2, 1], [-1, 0], [0, 0], [1, 0], [2, 1], [3, 1]],
  [[-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [3, 0]],
];
export function bird(g, x, y, ph, col) {
  const f = BIRD_FR[Math.floor(ph) & 3]; g.fillStyle = col; x = Math.round(x); y = Math.round(y);
  for (const p of f) g.fillRect(x + p[0], y + p[1], 1, 1);
}
/* A loose flock crossing the sky once per `cycle` ms. */
export function flock(g, t, o) {
  const cycle = o.cycle || 42000, dur = o.dur || 16000, n = o.n || 7;
  for (let i = 0; i < n; i++) {
    const off = (hash(i, 1, o.seed) - 0.5) * 2400 + i * 260;
    let u = (((t + o.t0 + off) % cycle) + cycle) % cycle / dur; if (u > 1) continue;
    const fy = o.y + (hash(i, 2, o.seed) - 0.5) * 26 + Math.sin(u * 7 + i) * 3 - u * (o.rise || 0);
    const x = -10 + u * (W + 20) - (hash(i, 3, o.seed)) * 40 * 0; // all travel left to right
    bird(g, x, fy, t * 0.012 + i * 1.3, o.col);
  }
}
/* Perched birds that startle and fly off, then come back. perches: [[x,y,seed],...] */
export function perched(g, t, perches, col, cycle = 36000, seed = 0) {
  for (let i = 0; i < perches.length; i++) {
    const [px, py] = perches[i]; const c0 = (((t + hash(i, 5, seed) * 9000) % cycle) + cycle) % cycle;
    g.fillStyle = col;
    if (c0 < 15000) { // perched, tiny head-bob
      const bob = (Math.floor(t / 900 + i * 3) % 7 === 0) ? 1 : 0;
      g.fillRect(px, py - 2 + bob, 2, 1); g.fillRect(px, py - 1, 3, 1); g.fillRect(px + 3, py - 1, 1, 1);
    } else if (c0 < 19000) { // take off: arc up and away
      const u = (c0 - 15000) / 4000; bird(g, px + u * (50 + i * 20) * (i % 2 ? -1 : 1), py - 2 - u * 46 + u * u * 8, t * 0.016 + i, col);
    } else if (c0 < 30000) { /* away */ } else { // glide back in
      const u = (c0 - 30000) / (cycle - 30000), e = 1 - u; bird(g, px + e * (60 + i * 15) * (i % 2 ? -1 : 1), py - 2 - e * 30, t * 0.01 + i, col);
    }
  }
}

/* ---------- particles ---------- */
/* Falling leaves. calm(y) in 0..1 reduces visibility in the play band. */
export function leaves(g, t, o) {
  const n = o.n || 14;
  for (let i = 0; i < n; i++) {
    const per = 15000 + hash(i, 1, o.seed) * 12000, u = ((t / per) + hash(i, 2, o.seed)) % 1;
    const x0 = hash(i, 3, o.seed) * (W + 120) - 60, y = -6 + u * (H + 12);
    const x = x0 + u * (o.drift == null ? 70 : o.drift) + Math.sin(u * TAU * (2 + hash(i, 4, o.seed) * 3) + i) * 12;
    const vis = o.calm ? o.calm(y) : 1; if (vis < 0.2) continue;
    g.globalAlpha = vis; g.fillStyle = o.cols[i % o.cols.length];
    const flip = Math.sin(u * TAU * 5 + i * 2) > 0;
    g.fillRect(Math.round(x), Math.round(y), flip ? 2 : 1, flip ? 1 : 2);
  }
  g.globalAlpha = 1;
}
/* Dust motes / pollen drifting inside shafts. */
export function motes(g, t, shafts, o) {
  const n = o.n || 40;
  for (let i = 0; i < n; i++) {
    const sh = shafts[i % shafts.length];
    const s = hash(i, 1, o.seed) * sh.len * 0.85 + 20, nn = (hash(i, 2, o.seed) - 0.5) * 1.6;
    const dx = Math.cos(sh.ang), dy = Math.sin(sh.ang);
    const hw = sh.w0 / 2 + s * sh.spread;
    const ph = t * (0.00018 + hash(i, 6, o.seed) * 0.0002);
    let x = sh.ox + dx * s - dy * nn * hw + Math.sin(ph * 5 + i) * 6 + ((t * 0.004 * (0.4 + hash(i, 7, o.seed))) % 40);
    let y = sh.oy + dy * s + dx * nn * hw + Math.cos(ph * 4 + i * 1.7) * 5 - ((t * 0.003) % 30) * 0.5;
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    const lit = shaftContains(sh, x, y); if (lit < 0.12) continue;
    const tw = 0.5 + 0.5 * Math.sin(t * 0.0021 * (1 + hash(i, 8, o.seed)) + i * 2.1);
    const vis = (o.calm ? o.calm(y) : 1) * tw * Math.min(1, lit * 2.5); if (vis < 0.18) continue;
    g.globalAlpha = Math.min(0.9, vis * (o.a || 0.9)); g.fillStyle = o.col; g.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
  g.globalAlpha = 1;
}
/* Fireflies (muted warm yellow-green), blinking and wandering. */
export function fireflies(g, t, o) {
  for (let i = 0; i < o.n; i++) {
    const hx = hash(i, 1, o.seed) * W, hy = o.y0 + hash(i, 2, o.seed) * (o.y1 - o.y0);
    const x = hx + Math.sin(t * 0.00043 * (1 + hash(i, 3, o.seed)) + i * 3) * 18 + Math.sin(t * 0.0011 + i) * 4;
    const y = hy + Math.cos(t * 0.00051 * (1 + hash(i, 4, o.seed)) + i * 2) * 10;
    const b = Math.sin(t * 0.0016 * (0.6 + hash(i, 5, o.seed) * 0.8) + i * 5.1);
    const calm = o.calm ? o.calm(y) : 1; if (b < 0.1 || calm < 0.2) continue;
    const bright = b > 0.62;
    g.globalAlpha = calm * (bright ? 0.95 : 0.55); g.fillStyle = o.col; g.fillRect(Math.round(x), Math.round(y), 1, 1);
    if (bright) { g.globalAlpha = calm * 0.28; g.fillRect(Math.round(x) - 1, Math.round(y), 3, 1); g.fillRect(Math.round(x), Math.round(y) - 1, 1, 3); }
  }
  g.globalAlpha = 1;
}
/* Light rain: thin slanted streaks. */
export function rain(g, t, o) {
  g.fillStyle = o.col;
  for (let i = 0; i < o.n; i++) {
    const sp = 0.9 + hash(i, 1, o.seed) * 0.5, u = ((t * 0.00085 * sp) + hash(i, 2, o.seed)) % 1;
    const y = -8 + u * (H + 16), x = hash(i, 3, o.seed) * (W + 80) - 40 - u * (H + 16) * 0.22;
    const vis = o.calm ? o.calm(y) : 1; g.globalAlpha = o.a * vis;
    const xi = Math.round(x), yi = Math.round(y);
    g.fillRect(xi, yi, 1, 2); g.fillRect(xi - 1, yi + 2, 1, 2);
  }
  g.globalAlpha = 1;
}

/* ---------- water: baked mirror of the scene above the shoreline, drawn in wavy strips ---------- */
export const WPAD = 8;
export function mirrorSource(compose, wy, rows, tintCol, tintA, dark) {
  // compose(g) draws the full static scene on a W x H canvas. Result: (W + 2*WPAD) x rows, mirrored about wy, edge-padded.
  const full = layer(W, H, compose);
  const base = layer(W, rows, g => {
    for (let r = 0; r < rows; r++) g.drawImage(full, 0, wy - 1 - r, W, 1, 0, r, W, 1);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = rgba('#000000', dark); g.fillRect(0, 0, W, rows);
    g.fillStyle = rgba(tintCol, tintA); g.fillRect(0, 0, W, rows);
    g.globalCompositeOperation = 'source-over';
  });
  return layer(W + WPAD * 2, rows, g => { g.drawImage(base, WPAD, 0); g.drawImage(base, 0, 0, 1, rows, 0, 0, WPAD, rows); g.drawImage(base, W - 1, 0, 1, rows, W + WPAD, 0, WPAD, rows); });
}
export function drawWater(g, t, src, wy, rows, o = {}) {
  g.globalAlpha = o.alpha == null ? 0.82 : o.alpha;
  for (let r = 0; r < rows; r += 2) {
    const hh = Math.min(2, rows - r), rr = r + 1, k = rr / rows;
    const dx = clamp(Math.round(Math.sin(rr * 0.62 + t * 0.0021 + Math.sin(rr * 0.17) * 2) * (0.7 + k * 2.3) + Math.sin(rr * 1.7 - t * 0.0033) * 0.6 * k), -WPAD, WPAD);
    const sr = Math.min(rows - hh, Math.round(r * (o.squash == null ? 1 : o.squash)));
    g.drawImage(src, WPAD - dx, sr, W, hh, 0, wy + r, W, hh);
  }
  g.globalAlpha = 1;
}
/* Glints + ripple dashes on the water; sx = x of the light source reflection (or null for diffuse). */
export function waterSparkle(g, t, o) {
  const { wy, rows, seed } = o;
  for (let i = 0; i < o.n; i++) {
    const r = Math.floor(Math.pow(hash(i, 1, seed), 1.4) * rows), k = r / rows;
    const bx = o.sx == null ? hash(i, 2, seed) * W : o.sx + (hash(i, 2, seed) - 0.5) * (o.spread || 120) * (0.4 + k);
    const len = 2 + Math.floor(hash(i, 3, seed) * 4 * (0.5 + k));
    const slot = Math.floor(t / (600 + hash(i, 4, seed) * 900) + hash(i, 5, seed) * 50);
    if (hash(slot, i, seed + 9) < 0.45) continue;
    const x = bx + Math.sin(t * 0.0006 + i) * 4;
    g.globalAlpha = o.a || 0.8; g.fillStyle = hash(slot, i, seed + 2) > 0.7 ? o.hi : o.col;
    g.fillRect(Math.round(x), wy + r, len, 1);
  }
  g.globalAlpha = 1;
}
/* Expanding elliptical ripples. pts: [[x,yOffsetFromWy,phaseMs],...] */
export function ripples(g, t, pts, wy, col, period = 3200, maxR = 13) {
  g.fillStyle = col;
  for (const p of pts) {
    const u = (((t + p[2]) % period) + period) % period / period, rx = 2 + u * maxR, ry = Math.max(1, rx * 0.28);
    g.globalAlpha = (1 - u) * 0.85;
    const cx = p[0], cy = wy + p[1];
    for (let a = 0; a < 20; a++) { // pixel ring
      const an = a / 20 * TAU; g.fillRect(Math.round(cx + Math.cos(an) * rx), Math.round(cy + Math.sin(an) * ry), 1, 1);
    }
  }
  g.globalAlpha = 1;
}

/* ---------- finishing: baked vignette (dithered) ---------- */
export function vignetteLayer(col = '#0b1412', maxA = 0.5) {
  const [cr, cg, cb] = rgb(col);
  return layer(W, H, g => {
    for (let lv = 1; lv <= 4; lv++) {
      g.fillStyle = 'rgba(' + cr + ',' + cg + ',' + cb + ',' + (maxA * lv / 4).toFixed(3) + ')';
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const dx = (x - W / 2) / (W / 2), dy = (y - H * 0.45) / (H * 0.62);
        const d = Math.pow(Math.abs(dx), 2.6) * 0.8 + Math.pow(Math.abs(dy), 2.4) * 0.9;
        const t = clamp((d - 0.45) / 0.9, 0, 1) * 4 + bay(x, y) / 16 - 0.5;
        if (Math.floor(t + 0.5) === lv) g.fillRect(x, y, 1, 1);
      }
    }
  });
}
/* play band calm factor: 1 near the top/bottom, `low` in the middle */
export function calmFn(y0 = 105, y1 = 300, low = 0.3) { return y => { if (y < y0 - 25 || y > y1 + 25) return 1; if (y >= y0 && y <= y1) return low; return y < y0 ? low + (1 - low) * (y0 - y) / 25 : low + (1 - low) * (y - y1) / 25; }; }

export const PROF = { on: false, acc: {}, t: 0, mark(l) { if (!this.on) return; if (this.flush) this.flush(); const n = performance.now(); this.acc[l] = (this.acc[l] || 0) + (n - this.t); this.t = n; } };
