// ============================================================================
//  px.js - low-res pixel drawing toolkit (adapted from the approved mockup).
//  Everything is fillRect on integer pixels (no anti-aliasing). Call use(ctx) to choose the
//  canvas the helpers draw on. 1 canvas pixel = K (= 2) logical units.
// ============================================================================
import { CONFIG } from '../config.js';

export const W = CONFIG.render.canvasW;     // 640
export const H = CONFIG.render.canvasH;     // 360
export const K = CONFIG.field.w / W;        // logical units per canvas pixel (2)

let g = null;
export function use(ctx) { g = ctx; g.imageSmoothingEnabled = false; }
export function ctx() { return g; }

export const L = (v) => Math.round(v / K);   // logical units -> canvas pixels

export function P(x, y, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), 1, 1); }
export function R(x, y, w, h, c) { if (w <= 0 || h <= 0) return; g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
export function LN(x0, y0, x1, y1, c, t) {
  if (!(Number.isFinite(x0) && Number.isFinite(y0) && Number.isFinite(x1) && Number.isFinite(y1))) return;   // NaN guard: Bresenham would never end
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1); t = t || 1;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy;
  g.fillStyle = c; const o = Math.floor((t - 1) / 2);
  for (;;) { g.fillRect(x0 - o, y0 - o, t, t); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
}
export function LNf(x0, y0, x1, y1, fn) { // call fn(x,y,i,n) along a line
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) { const t = n ? i / n : 0; fn(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), i, n); }
}
export function ELLpx(cx, cy, rx, ry, fn) {
  const ax = rx + 0.5, ay = ry + 0.5;
  for (let y = Math.ceil(cy - ay); y <= Math.floor(cy + ay); y++) for (let x = Math.ceil(cx - ax); x <= Math.floor(cx + ax); x++) {
    const nx = (x - cx) / ax, ny = (y - cy) / ay; if (nx * nx + ny * ny <= 1) fn(x, y, nx, ny);
  }
}
export function RING(cx, cy, r, c) { g.fillStyle = c; ELLpx(cx, cy, r, r, (x, y) => { if (Math.hypot(x - cx, y - cy) >= r - 0.6) g.fillRect(x, y, 1, 1); }); }
export function ELL(cx, cy, rx, ry, c) { g.fillStyle = c; ELLpx(cx, cy, rx, ry, (x, y) => g.fillRect(x, y, 1, 1)); }
export function DISC(cx, cy, r, c) { ELL(cx, cy, r, r, c); }
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export function bay(x, y) { return BAYER[(y & 3) * 4 + (x & 3)]; }
export function DITH(x, y, w, h, c) { g.fillStyle = c; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { if (((x + i + y + j) & 1) === 0) g.fillRect(x + i, y + j, 1, 1); } }
export function FPOLY(pts, c) { // scanline polygon fill, pts [[x,y],...]
  let miny = 1e9, maxy = -1e9; for (const p of pts) { miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]); }
  g.fillStyle = c;
  for (let y = Math.ceil(miny); y <= Math.floor(maxy); y++) {
    const xs = []; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > y) !== (b[1] > y)) xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1])); }
    xs.sort((p, q) => p - q); for (let i = 0; i + 1 < xs.length; i += 2) { const x0 = Math.round(xs[i]), x1 = Math.round(xs[i + 1]); g.fillRect(x0, y, Math.max(1, x1 - x0), 1); }
  }
}
export function hash(x, y, s) { let h = (x * 374761393 + y * 668265263 + (s || 0) * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* Sky helper: vertical bands separated by short ordered-dither transitions. bands = [[yStart, color],...] */
export function skyBands(x0, x1, y0, y1, bands, zone) {
  zone = zone || 6;
  for (let y = y0; y < y1; y++) {
    let idx = 0, blend = -1;
    for (let i = 0; i < bands.length; i++) { if (y >= bands[i][0] + zone / 2) idx = i; }
    for (let i = 1; i < bands.length; i++) { const b = bands[i][0]; if (y >= b - zone / 2 && y < b + zone / 2) { blend = i; } }
    if (blend < 0) { R(x0, y, x1 - x0, 1, bands[idx][1]); continue; }
    const b = bands[blend][0], u = (y - (b - zone / 2) + 0.5) / zone, lvl = Math.max(0, Math.min(16, Math.round(u * 16)));
    R(x0, y, x1 - x0, 1, bands[blend - 1][1]); g.fillStyle = bands[blend][1];
    for (let x = x0; x < x1; x++) if (bay(x, y) < lvl) g.fillRect(x, y, 1, 1);
  }
}

/* ---- background painting helpers ---- */
export function leafBlob(cx, cy, rx, ry, cols, seed) {
  ELLpx(cx, cy, rx, ry, (x, y, nx, ny) => {
    const n = hash(x, y, seed || 1), edge = nx * nx + ny * ny;
    if (edge > 0.72 && n > 0.62) return;
    const s = nx * -0.55 + ny * -0.85; let c = cols[1];
    if (s > 0.35) c = cols[0]; else if (s < -0.15) c = cols[2];
    if (n > 0.9) c = cols[0]; else if (n < 0.08) c = cols[2];
    P(x, y, c);
  });
}
export function treeCluster(x, y, size, trunk, cols, seed) { // y = base of trunk
  const th = Math.round(size * 0.9);
  R(x, y - th, Math.max(1, Math.round(size / 6)), th, trunk);
  leafBlob(x, y - th - Math.round(size * 0.15), Math.round(size * 0.55), Math.round(size * 0.42), cols, seed);
  leafBlob(x - Math.round(size * 0.4), y - th + Math.round(size * 0.12), Math.round(size * 0.36), Math.round(size * 0.28), cols, seed + 1);
  leafBlob(x + Math.round(size * 0.42), y - th + Math.round(size * 0.1), Math.round(size * 0.34), Math.round(size * 0.26), cols, seed + 2);
}
export function vine(x, y, len, c1, c2, seed) { // hangs down from (x,y)
  for (let j = 0; j < len; j++) {
    const sway = Math.round(Math.sin(j * 0.5 + seed) * 0.9); P(x + sway, y + j, (j % 5 === 3) ? c2 : c1);
    if (j % 4 === 2 && hash(x, j, seed) > 0.35) { P(x + sway + 1, y + j, c2); P(x + sway - 1, y + j + 1, c1); }
  }
}
export function windowsGrid(x, y, w, h, sx, sy, ww, wh, dark, lite, seed, holes) {
  for (let j = y + 2; j + wh < y + h; j += sy) for (let i = x + 2; i + ww < x + w - 1; i += sx) {
    const n = hash(i, j, seed); R(i, j, ww, wh, n > 0.9 ? lite : dark); if (n > 0.75 && n <= 0.9) { R(i, j, ww, 1, lite); }
    if (holes && n < 0.07) R(i, j, ww + sx - ww, wh + sy - wh, dark);
  }
}
export function birdV(x, y, c) { P(x, y, c); P(x + 1, y - 1, c); P(x + 2, y, c); P(x + 3, y - 1, c); P(x + 4, y, c); }
export function jaggedTop(x, w, baseY, topY, step, seed, fn) { // calls fn(x,top) per column; ragged broken top
  let t = topY; for (let i = 0; i < w; i++) { if (i % step === 0) { t = topY + Math.round((hash(x + i, seed, 2) - 0.4) * step * 2.2); } fn(x + i, t); }
}
export function dustMotes(c, n, seed) { for (let i = 0; i < n; i++) { P(Math.round(hash(i, 1, seed) * W), Math.round(hash(i, 2, seed) * H * 0.8), c); } }
/* Quantised colour wash: blends pixels toward `hex` by tf(x,y) in 0..1, in q steps. */
export function tint(x0, y0, x1, y1, hex, tf, q) {
  x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W, x1); y1 = Math.min(H, y1);
  const img = g.getImageData(x0, y0, x1 - x0, y1 - y0), d = img.data, r = parseInt(hex.slice(1, 3), 16), gg = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    let t = tf(x, y); if (t <= 0) continue; t = Math.round(Math.min(1, t) * q) / q; if (t <= 0) continue; const i = ((y - y0) * (x1 - x0) + (x - x0)) * 4;
    d[i] += (r - d[i]) * t; d[i + 1] += (gg - d[i + 1]) * t; d[i + 2] += (b - d[i + 2]) * t;
  }
  g.putImageData(img, x0, y0);
}

/* ===== 5x7 pixel font (hand drawn, original). Uppercase only. ===== */
const PX_FONT = (function () {
  const t = {
    'A': '.###./#...#/#...#/#####/#...#/#...#/#...#', 'B': '####./#...#/#...#/####./#...#/#...#/####.',
    'C': '.####/#..../#..../#..../#..../#..../.####', 'D': '####./#...#/#...#/#...#/#...#/#...#/####.',
    'E': '#####/#..../#..../####./#..../#..../#####', 'F': '#####/#..../#..../####./#..../#..../#....',
    'G': '.####/#..../#..../#..##/#...#/#...#/.####', 'H': '#...#/#...#/#...#/#####/#...#/#...#/#...#',
    'I': '#####/..#../..#../..#../..#../..#../#####', 'J': '..###/...#./...#./...#./...#./#..#./.##..',
    'K': '#...#/#..#./#.#../##.../#.#../#..#./#...#', 'L': '#..../#..../#..../#..../#..../#..../#####',
    'M': '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#', 'N': '#...#/##..#/#.#.#/#..##/#...#/#...#/#...#',
    'O': '.###./#...#/#...#/#...#/#...#/#...#/.###.', 'P': '####./#...#/#...#/####./#..../#..../#....',
    'Q': '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#', 'R': '####./#...#/#...#/####./#.#../#..#./#...#',
    'S': '.####/#..../#..../.###./....#/....#/####.', 'T': '#####/..#../..#../..#../..#../..#../..#..',
    'U': '#...#/#...#/#...#/#...#/#...#/#...#/.###.', 'V': '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
    'W': '#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#', 'X': '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
    'Y': '#...#/#...#/.#.#./..#../..#../..#../..#..', 'Z': '#####/....#/...#./..#../.#.../#..../#####',
    '0': '.###./#...#/#..##/#.#.#/##..#/#...#/.###.', '1': '..#../.##../..#../..#../..#../..#../.###.',
    '2': '.###./#...#/....#/...#./..#../.#.../#####', '3': '####./....#/....#/.###./....#/....#/####.',
    '4': '#...#/#...#/#...#/#####/....#/....#/....#', '5': '#####/#..../####./....#/....#/#...#/.###.',
    '6': '.###./#..../#..../####./#...#/#...#/.###.', '7': '#####/....#/...#./..#../.#.../.#.../.#...',
    '8': '.###./#...#/#...#/.###./#...#/#...#/.###.', '9': '.###./#...#/#...#/.####/....#/....#/.###.',
    '.': '../../../../../##/##', ',': '../../../../##/#./#.', ':': '../##/##/../##/##/..', '!': '#/#/#/#/#/././#',
    '?': '.###./#...#/....#/...#./..#../...../..#..', '-': '..../..../..../####/..../..../....',
    '+': '...../..#../..#../#####/..#../..#../.....', '%': '##..#/##..#/...#./..#../.#.../#..##/#..##',
    '/': '....#/....#/...#./..#../.#.../#..../#....', "'": '#/#/././././.', '(': '.#/#./#./#./#./#./.#', ')': '#./.#/.#/.#/.#/.#/#.',
    '=': '...../...../#####/...../#####/...../.....', '>': '#.../.#../..#./...#/..#./.#../#...', '<': '...#/..#./.#../#.../.#../..#./...#',
    '`': '#./.#/../../../../..',
    ';': '.../.#./.#./.../.#./.#./#..', '[': '##/#./#./#./#./#./##', ']': '##/.#/.#/.#/.#/.#/##',
    '@': '.###./#...#/#.###/#.#.#/#.###/#..../.####', '_': '...../...../...../...../...../...../#####',
    '{': '..#/.#./.#./#../.#./.#./..#', '}': '#../.#./.#./..#/.#./.#./#..', '&': '.##./#..#/#..#/.##./#.#./#..#/.##.',
    '"': '#.#/#.#/.../.../.../.../...', '$': '..#../.####/#.#../.###./..#.#/####./..#..', '|': '#/#/#/#/#/#/#', '\\': '#..../.#.../..#../...#./....#/...../.....',
    '~': '...../...../.#..#/#.##./...../...../.....', '^': '..#../.#.#./#...#/...../...../...../.....', '’': '#/#/././././.',
    'a': '...../...../.###./....#/.####/#...#/.####/.....', 'b': '#..../#..../####./#...#/#...#/#...#/####./.....',
    'c': '...../...../.###./#..../#..../#...#/.###./.....', 'd': '....#/....#/.####/#...#/#...#/#...#/.####/.....',
    'e': '...../...../.###./#...#/#####/#..../.###./.....', 'f': '..##./.#.../###../.#.../.#.../.#.../.#.../.....',
    'g': '...../...../.####/#...#/#...#/.####/....#/.###.', 'h': '#..../#..../#.##./##..#/#...#/#...#/#...#/.....',
    'i': '..#../...../.##../..#../..#../..#../.###./.....', 'j': '...#./...../..##./...#./...#./...#./#..#./.##..',
    'k': '#..../#..../#..#./#.#../##.../#.#../#..#./.....', 'l': '.##../..#../..#../..#../..#../..#../.###./.....',
    'm': '...../...../##.#./#.#.#/#.#.#/#...#/#...#/.....', 'n': '...../...../####./#...#/#...#/#...#/#...#/.....',
    'o': '...../...../.###./#...#/#...#/#...#/.###./.....', 'p': '...../...../####./#...#/#...#/####./#..../#....',
    'q': '...../...../.####/#...#/#...#/.####/....#/....#', 'r': '...../...../#.##./##..#/#..../#..../#..../.....',
    's': '...../...../.####/#..../.###./....#/####./.....', 't': '.#.../.#.../###../.#.../.#.../.#..#/..##./.....',
    'u': '...../...../#...#/#...#/#...#/#..##/.##.#/.....', 'v': '...../...../#...#/#...#/#...#/.#.#./..#../.....',
    'w': '...../...../#...#/#...#/#.#.#/#.#.#/.#.#./.....', 'x': '...../...../#...#/.#.#./..#../.#.#./#...#/.....',
    'y': '...../...../#...#/#...#/.####/....#/....#/.###.', 'z': '...../...../#####/...#./..#../.#.../#####/.....', '#': '.#.#./#####/.#.#./.#.#./#####/.#.#./.....', '*': '...../#.#.#/.###./#####/.###./#.#.#/.....', ' ': '.../.../.../.../.../.../...',
  };
  const out = {}; for (const k in t) out[k] = t[k].split('/'); return out;
})();
function glyph(ch) { return PX_FONT[ch] || PX_FONT['?']; }
export function pxWidth(text, s = 1, mixed = false) { let w = 0; for (const ch of (mixed ? text : text.toUpperCase())) w += (glyph(ch)[0].length + 1) * s; return w - s; }
export const TW = pxWidth;
/* Draw text on the current canvas. shadow = [color, dx, dy] in font pixels (optional). */
export function TXT(text, x, y, color, s = 1, shadow, mixed = false) {
  if (!mixed) text = text.toUpperCase(); x = Math.round(x); y = Math.round(y);
  const run = (ox, oy, col) => {
    g.fillStyle = col; let cx = x + ox;
    for (const ch of text) {
      const gl = glyph(ch);
      for (let r = 0; r < gl.length; r++) for (let c = 0; c < gl[r].length; c++) if (gl[r][c] === '#') g.fillRect(cx + c * s, y + oy + r * s, s, s);
      cx += (gl[0].length + 1) * s;
    }
  };
  if (shadow) run(shadow[1] * s, shadow[2] * s, shadow[0]);
  run(0, 0, color);
}
/* Same font as crisp inline SVG for DOM overlays. Colour comes from CSS `color`. */
export function pxSVG(text, s, shadow) {
  text = text.toUpperCase();
  let d = '', cx = 0;
  for (const ch of text) {
    const gl = glyph(ch);
    for (let r = 0; r < 7; r++) for (let c = 0; c < gl[r].length; c++) if (gl[r][c] === '#') d += 'M' + (cx + c) + ' ' + r + 'h1v1h-1z';
    cx += gl[0].length + 1;
  }
  const w = cx - 1, sh = shadow ? 1 : 0;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + (w + sh) + ' ' + (7 + sh) + '" width="' + ((w + sh) * s) + '" height="' + ((7 + sh) * s) + '" shape-rendering="crispEdges" style="display:block">' +
    (shadow ? '<path d="' + d + '" fill="' + shadow + '" transform="translate(1 1)"/>' : '') + '<path d="' + d + '" fill="currentColor"/></svg>';
}
