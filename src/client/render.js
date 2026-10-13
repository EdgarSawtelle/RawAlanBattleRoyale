// ============================================================================
//  render.js - draws the simulation state onto the 640x360 pixel canvas. READ-ONLY on the state.
//  Layers: painted backdrop -> plain terrain slabs -> destructible blocks -> moving platforms ->
//  effects -> survivors -> shields -> bullets -> effects -> off-screen arrows -> (debug hitboxes).
//  The HUD is drawn separately (hud.js) so it is not affected by screen shake.
// ============================================================================
import { CONFIG } from '../config.js';
import { getMap } from '../maps/index.js';
import { platformPos } from '../sim/platforms.js';
import { shieldRadius } from '../sim/bullet.js';
import { getHazards } from '../sim/hazards.js';
import { W, H, K, L, use, ctx, P, R, LN, LNf, DISC, ELL, ELLpx, DITH, hash } from './px.js';
import { getBackground, getBackgroundFade } from './background.js';
import { fxDraw } from './fx.js';

const INK = '#0e0d0c';

// ---- survivor palettes (muted accent colour each: rust/ochre vs faded teal) --------------------------------------
const PC = [
  { ink: '#17110d', base: '#a2552f', hi: '#c77c44', lo: '#693220', acc: '#d6a444', acc2: '#efca74', leather: '#5a4130', lens: '#e1dcc0', patch: '#8c8466', metal: '#2c2a27', metalHi: '#75726a', wood: '#6e4c31' },
  { ink: '#0f1717', base: '#4a9086', hi: '#7bbfae', lo: '#2c6360', hood: '#376f68', hoodHi: '#63ab9c', acc: '#b6ab88', acc2: '#d6cda9', leather: '#53472f', lens: '#c9e6dc', patch: '#a8814a', metal: '#2c2a27', metalHi: '#75726a', wood: '#6e4c31', filter: '#8b9088' },
];
const BULLET = { amber: ['#fbf0c0', '#efae3a', '#9c5420'], pale: ['#ffffff', '#f6e7a1', '#b69a4a'], ember: ['#ffe9a8', '#e0642a', '#7a2a14'] };
const SHIELD = { rim: '#e8efdc', mid: '#a6d0c4', soft: '#6c9d94', deep: '#3d6963' };

// ---- helpers --------------------------------------------------------------------------------------------------------
function newCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
const lerp = (a, b, t) => a + (b - a) * t;
function lerpPos(prev, cur, a) {
  if (!prev) return cur;
  return Math.abs(cur - prev) > 120 ? cur : lerp(prev, cur, a);   // teleports (respawn, out of bounds) are not smoothed
}

// ---- static terrain layer (plain, quiet slabs) -------------------------------------------------------------------------
// Flat dark fill, a subtle lighter top edge, a hint of moss. No bricks, no border around the screen.
function paintSlab(x, y, w, h, seed) {
  const x0 = L(x), y0 = L(y), x1 = L(x + w), y1 = L(y + h), pw = x1 - x0, ph = y1 - y0;
  R(x0 - 1, y0 - 1, pw + 2, ph + 2, INK);                        // dark outline separates it from the backdrop
  R(x0, y0, pw, ph, '#383c39');                                   // flat fill
  R(x0, y0 + 2, pw, ph - 2, '#323634');                           // a very slightly darker body under the top edge
  R(x0, y0, pw, 1, '#7a8074');                                    // lighter top edge
  R(x0, y0 + 1, pw, 1, '#4f554d');
  R(x0, y1 - 1, pw, 1, '#232625');                                // shadowed underside
  R(x0, y0 + 1, 1, ph - 2, '#434842');                            // faint left bevel
  // a hint of moss on the top edge: a few short tufts
  for (let i = 1; i < pw - 1; i++) {
    const n = hash(x0 + i, seed, 31);
    if (n > 0.86 && hash(Math.floor((x0 + i) / 7), seed, 32) > 0.45) { P(x0 + i, y0, '#5f7440'); if (hash(x0 + i, seed, 33) > 0.5) P(x0 + i, y0 - 1, '#7b9150'); }
  }
}

function buildTerrain(map) {
  const c = newCanvas(W, H), g = c.getContext('2d'); use(g);
  // rails for moving platforms (quiet, dotted guide line with end stops)
  for (const def of map.platforms || []) {
    const a = def.path[0], b = def.path[def.path.length - 1];
    const gy = L(a.y + def.h / 2);
    const x0 = L(a.x + def.w / 2), x1 = L(b.x + def.w / 2);
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x += 4) P(x, gy, '#76705a');
    for (const ex of [x0, x1]) { R(ex - 1, gy - 3, 3, 7, INK); R(ex, gy - 2, 1, 5, '#a89e74'); }
  }
  // rails for saw blades: a dotted rust-orange line with end stops
  for (const h of map.hazards || []) {
    if (h.type !== 'saw') continue;
    const a = h.path[0], b = h.path[h.path.length - 1], x0 = L(a.x), y0 = L(a.y), x1 = L(b.x), y1 = L(b.y);
    LNf(x0, y0, x1, y1, (x, y, i) => { if (i % 3 === 0) P(x, y, '#7a3a1c'); });
    for (const [ex, ey] of [[x0, y0], [x1, y1]]) { R(ex - 1, ey - 2, 3, 5, INK); R(ex, ey - 1, 1, 3, '#c9591f'); }
  }
  map.solids.forEach((s, i) => paintSlab(s.x, s.y, s.w, s.h, i));
  return c;
}

// ---- destructible block sprites ------------------------------------------------------------------------------------------------
const CRACK1 = [[[.55, 0], [.42, .28], [.6, .5], [.46, .78], [.52, 1]]];
const CRACK2 = [[[.55, 0], [.42, .28], [.6, .5], [.46, .78], [.52, 1]], [[.6, .5], [.9, .58], [1, .7]], [[.42, .28], [.12, .34], [0, .5]], [[.46, .78], [.2, .88]]];
const CHIP = [[0, .55], [.3, .72], [.22, 1], [0, 1]];
function inPoly(x, y, p) { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { if (((p[i][1] > y) !== (p[j][1] > y)) && (x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0])) c = !c; } return c; }
function blockPx(u, v, w, h, st, crack, edge, n) {
  if (u === 0 || v === 0 || u === w - 1 || v === h - 1) return '#25231f';
  if (crack) return '#2a2823';
  if (edge) return n > 0.5 ? '#8a4b2a' : '#3d2a1d';
  let c = '#a79b7c';
  if (v === 1 || u === 1) c = '#d0c5a2'; else if (v === h - 2 || u === w - 2) c = '#7a7156';
  else if (u === v || u === h - 1 - v) c = '#6f6049'; else if (n > 0.9) c = '#b9ad8c'; else if (n < 0.1) c = '#8d8467';
  if ((u === Math.floor(w / 4) || u === w - 1 - Math.floor(w / 4)) && v === Math.floor(h / 2)) c = '#4a493f';
  if (st > 0 && n > 0.82 && v > h * 0.45) c = '#7d5a3c';
  return c;
}
const blockSprites = {};
function blockSprite(w, h, st, seed) {
  const key = w + 'x' + h + ':' + st + ':' + (seed & 1);
  if (blockSprites[key]) return blockSprites[key];
  const c = newCanvas(w, h), g = c.getContext('2d');
  const flip = !!(seed & 1), cm = new Uint8Array(w * h), chip = new Uint8Array(w * h);
  const polys = st === 1 ? CRACK1 : st === 2 ? CRACK2 : [];
  for (const pl of polys) for (let i = 0; i + 1 < pl.length; i++) {
    LNf(pl[i][0] * (w - 1), pl[i][1] * (h - 1), pl[i + 1][0] * (w - 1), pl[i + 1][1] * (h - 1), (x, y) => { const xx = flip ? w - 1 - x : x; if (xx >= 0 && xx < w && y >= 0 && y < h) cm[y * w + xx] = 1; });
  }
  if (st === 2) for (let v = 0; v < h; v++) for (let u = 0; u < w; u++) { const uu = flip ? w - 1 - u : u; if (inPoly((uu + .5) / w, (v + .5) / h, CHIP)) chip[v * w + u] = 1; }
  for (let v = 0; v < h; v++) for (let u = 0; u < w; u++) {
    if (chip[v * w + u]) continue;
    let edge = false;
    if (st === 2) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const uu = u + a, vv = v + b; if (uu >= 0 && uu < w && vv >= 0 && vv < h && chip[vv * w + uu]) edge = true; }
    g.fillStyle = blockPx(u, v, w, h, st, cm[v * w + u] === 1, edge, hash(u, v, 7 + (seed & 1)));
    g.fillRect(u, v, 1, 1);
  }
  return (blockSprites[key] = c);
}

// ---- moving platform ---------------------------------------------------------------------------------------------------------------
// Metal tram plate with an amber hazard stripe: clearly different from the plain slabs.
function drawMovingPlatform(x, y, w, h) {
  const x0 = L(x), y0 = L(y), pw = L(w), ph = Math.max(6, L(h)), g = ctx();
  R(x0 - 1, y0 - 1, pw + 2, ph + 2, INK);
  for (let v = 0; v < ph; v++) for (let u = 0; u < pw; u++) {
    let c;
    if (v === 0) c = '#b3b5a8'; else if (v === 1) c = '#82847a'; else if (v === ph - 1) c = '#2a2b29';
    else if (u < 2 || u >= pw - 2) c = '#8f9186';
    else if (v >= ph - 3) c = (((u + v) >> 1) & 1) ? '#c4892e' : '#2b2a27';
    else { const d1 = (u + v) % 10 < 2, d2 = ((u - v) % 10 + 10) % 10 < 2; c = (d1 || d2) ? '#5d5e54' : '#3d3f3b'; }
    g.fillStyle = c; g.fillRect(x0 + u, y0 + v, 1, 1);
  }
}

// ---- hazards: rust-orange / ember accents + hazard stripes mark everything dangerous -----------------------------------------
const HZ_BASE = { rust: '#a8461f', rustHi: '#c9591f', rustLo: '#7a3a1c', ember: '#e9a93c', hot: '#ffd58a', steel: '#8d8f86', dark: '#2b2a27' };
// each map may dress its hazards to fit the setting (same shapes and the same orange / ember warning tips): map.hazardStyle
const HZ_STYLES = {
  rust: HZ_BASE,                                                                                                    // downtown: rusted rebar
  thorn: { ...HZ_BASE, rust: '#5b6e2a', rustHi: '#86a038', rustLo: '#3d4c1d', steel: '#7f8c78', dark: '#232d1b' },    // forest: thorn vines, green blades with ember tips
  iron: { ...HZ_BASE, rust: '#5f6270', rustHi: '#8d92a3', rustLo: '#40434f', steel: '#9a9ca6', dark: '#24252d' },    // plaza: wrought iron
  brick: { ...HZ_BASE, rust: '#8f3a30', rustHi: '#b84f40', rustLo: '#612721', steel: '#8d8f86', dark: '#2b2523' },   // suburb: splintered brick red
};
let HZ = HZ_BASE;

// Rebar spikes (face 'up' or 'down'): a hazard-striped base with rusty triangular spikes, tips glowing ember.
function drawSpikes(h) {
  const g = ctx(), x0 = L(h.x), y0 = L(h.y), w = L(h.w), hh = Math.max(5, L(h.h)), down = h.face === 'down';
  const rowY = (d) => down ? y0 + d : y0 + hh - 1 - d;          // d = distance from the base (0) to the tip
  const TW_ = 6;                                                  // tooth width in pixels
  for (let k = 0; k * TW_ < w; k++) {
    const bx = x0 + k * TW_;
    // dark outline first (a slightly bigger triangle), then the lit tooth
    for (let d = 0; d < hh; d++) {
      const width = Math.max(1, Math.round((TW_ - 0) * (1 - d / hh)) ), off = (TW_ - width) >> 1;
      R(bx + off - 1, rowY(d), width + 2, 1, INK);
    }
    R(bx + (TW_ >> 1) - 1, rowY(hh), 2, 1, INK);
    for (let d = 1; d < hh; d++) {
      const width = Math.max(1, Math.round((TW_ - 0) * (1 - d / hh))), off = (TW_ - width) >> 1;
      for (let u = 0; u < width; u++) {
        g.fillStyle = d >= hh - 2 ? HZ.hot : d >= hh - 4 ? HZ.ember : (u < width / 2 ? HZ.rustHi : HZ.rust);
        g.fillRect(bx + off + u, rowY(d), 1, 1);
      }
    }
  }
  for (let u = 0; u < w; u++) { g.fillStyle = (((u >> 1) & 1) ? HZ.ember : HZ.dark); g.fillRect(x0 + u, rowY(0), 1, 1); }   // hazard-stripe base
}

// Burning ember grate: a dark steel slab with glowing slits and rising embers.
function drawGrate(h, tick) {
  const g = ctx(), x0 = L(h.x), y0 = L(h.y), w = L(h.w), hh = Math.max(4, L(h.h));
  R(x0 - 1, y0 - 1, w + 2, hh + 2, INK);
  R(x0, y0, w, hh, '#2a2826');
  for (let u = 1; u < w - 1; u += 3) {
    const f = hash(u, Math.floor(tick / 5), 61);
    g.fillStyle = f > 0.7 ? HZ.hot : f > 0.25 ? HZ.ember : HZ.rustHi;
    g.fillRect(x0 + u, y0 + 1, 2, hh - 2);
  }
  R(x0, y0, w, 1, HZ.rustHi); R(x0, y0 + hh - 1, w, 1, '#14120f');
  for (let k = 0; k < 4; k++) {           // embers drifting up (deterministic from the tick)
    const t = Math.floor((tick / 3 + k * 5) % 14), ex = x0 + 2 + Math.floor(hash(k, Math.floor((tick / 3 + k * 5) / 14), 62) * (w - 4));
    if (t < 10) P(ex, y0 - 2 - t, t < 4 ? HZ.hot : t < 7 ? HZ.ember : HZ.rust);
  }
}

// Rusted saw blade with rotating teeth and a few sparks.
function drawSaw(cx0, cy0, r, tick) {
  const cx = L(cx0), cy = L(cy0), rp = Math.max(4, L(r)), spin = tick * CONFIG.hazards.sawSpin;
  DISC(cx, cy, rp + 1, INK);
  for (let i = 0; i < 10; i++) {                 // teeth: rust-orange, tips glowing
    const a = spin + i * Math.PI / 5;
    for (let d = rp - 1; d <= rp + 3; d++) {
      const w = d <= rp + 1 ? 1 : 0;
      for (let o = -w; o <= w; o++) { const aa = a + o * 0.16; const x = cx + Math.cos(aa) * d, y = cy + Math.sin(aa) * d; if (d >= rp + 2) { P(x - 1, y, INK); P(x + 1, y, INK); P(x, y - 1, INK); P(x, y + 1, INK); } }
    }
    for (let d = rp - 1; d <= rp + 3; d++) {
      const w = d <= rp + 1 ? 1 : 0;
      for (let o = -w; o <= w; o++) { const aa = a + o * 0.16; P(cx + Math.cos(aa) * d, cy + Math.sin(aa) * d, d >= rp + 2 ? HZ.hot : i % 2 ? HZ.rustHi : HZ.ember); }
    }
  }
  DISC(cx, cy, rp, HZ.steel);
  ELLpx(cx, cy, rp, rp, (x, y) => { const d = Math.hypot(x - cx, y - cy); if (d > rp - 1.2) P(x, y, '#5d5e56'); });
  for (let i = 0; i < 3; i++) { const a = spin + i * 2.094; LNf(cx, cy, cx + Math.cos(a) * (rp - 1), cy + Math.sin(a) * (rp - 1), (x, y) => P(x, y, HZ.rustLo)); }
  DISC(cx, cy, 2, HZ.dark); P(cx, cy, HZ.ember);
  if (tick % 4 < 2) { const a = spin * 2 + 1; P(cx + Math.cos(a) * (rp + 3), cy + Math.sin(a) * (rp + 3), HZ.hot); P(cx + Math.cos(a + 3) * (rp + 3), cy + Math.sin(a + 3) * (rp + 3), HZ.ember); }
}

const barrelSprites = {};
function barrelSprite(w, h, damaged) {
  const key = w + 'x' + h + ':' + damaged;
  if (barrelSprites[key]) return barrelSprites[key];
  const c = newCanvas(w, h), g = c.getContext('2d');
  const fill = (x, y, ww, hh, col) => { g.fillStyle = col; g.fillRect(x, y, ww, hh); };
  fill(0, 0, w, h, INK);
  fill(1, 1, w - 2, h - 2, HZ_BASE.rust);
  fill(1, 1, 2, h - 2, HZ_BASE.rustHi);                      // lit left side
  fill(w - 3, 1, 2, h - 2, HZ_BASE.rustLo);                  // shadowed right side
  fill(1, 1, w - 2, 1, HZ_BASE.ember);                       // top rim
  for (const y of [3, h - 4]) fill(1, y, w - 2, 1, HZ_BASE.dark);   // iron bands
  const mx0 = (w >> 1) - 1, my0 = (h >> 1) - 2;          // flame pictogram on a dark patch
  fill(mx0 - 1, my0 - 1, 5, 6, HZ_BASE.dark);
  fill(mx0, my0 + 2, 3, 2, HZ_BASE.ember); fill(mx0 + 1, my0, 1, 2, HZ_BASE.hot); fill(mx0 + 1, my0 + 3, 1, 1, HZ_BASE.hot);
  if (damaged) { fill(2, h - 6, 1, 3, INK); fill(3, h - 4, 2, 1, INK); fill(w - 4, 5, 1, 3, INK); }
  return (barrelSprites[key] = c);
}

// ---- survivors ------------------------------------------------------------------------------------------------------------------------------
const P_SCALE = 1.0;   // drawn size relative to the hitbox
function drawSurvivor(kind, p, x, y, flash, bobFrame) {
  const g = ctx(), c = PC[kind], f = Math.cos(p.aim) >= 0 ? 1 : -1;
  const cx = L(x), bottomEx = L(y + p.h / 2), Hh = L(p.h * P_SCALE / 2), cy0 = bottomEx - Hh;
  const feet = 1;
  const rx = Math.floor(p.w * P_SCALE / K / 2);
  const T0 = cy0 - Hh + 1, B0 = bottomEx - feet - 1, cy = (T0 + B0) / 2 - (bobFrame ? 1 : 0), ry = (B0 - T0) / 2;
  const big = rx >= 8, mid = rx >= 5;
  // backpack / bag on the back
  if (kind === 0) {
    const bw = big ? 4 : mid ? 3 : 2, bx = f > 0 ? cx - rx - bw + 1 : cx + rx, by0 = Math.round(cy - ry * 0.25), bh = Math.round(ry * 1.1);
    R(bx - 1, by0 - 1, bw + 2, bh + 2, c.ink); R(bx, by0, bw, bh, c.leather); R(bx, by0, bw, 1, c.patch); if (bw >= 3) P(bx + (f > 0 ? 0 : bw - 1), by0 + bh - 1, c.acc);
  } else {
    const bw = big ? 4 : mid ? 3 : 2, bx = f > 0 ? cx - rx - bw + 1 : cx + rx, by0 = Math.round(cy - ry * 0.5), bh = big ? 5 : 3;
    R(bx - 1, by0 - 1, bw + 2, bh + 2, c.ink); R(bx, by0, bw, bh, c.patch); P(bx, by0, c.acc2);
  }
  // boots
  const bwid = Math.max(2, Math.round(rx * 0.6));
  const bootX = (sx) => cx + sx * Math.round(rx * 0.45) - (sx < 0 ? bwid - 1 : 0);
  for (const sx of [-1, 1]) R(bootX(sx) - 1, bottomEx - feet - 1, bwid + 2, feet + 2, c.ink);
  for (const sx of [-1, 1]) { R(bootX(sx), bottomEx - feet, bwid, feet, '#2d241d'); }
  // body
  ELL(cx, cy, rx + 1, ry + 1, c.ink);
  ELLpx(cx, cy, rx, ry, (px, py, nx, ny) => {
    const s = nx * -0.6 + ny * -0.8; let col = c.base; if (s > 0.5) col = c.hi; else if (s < -0.5) col = c.lo;
    if (kind === 1 && ny < -0.1) col = ny > -0.25 ? c.hoodHi : c.hood;
    g.fillStyle = col; g.fillRect(px, py, 1, 1);
  });
  for (let i = -rx; i <= rx; i += 2) { if (Math.abs(i) < rx * 0.9) P(cx + i, Math.round(cy + ry), c.lo); }
  if (kind === 0) {   // ember: scarf + goggles
    const sy = Math.round(cy - ry * 0.2), st = Math.max(1, Math.round(ry * 0.22));
    ELLpx(cx, cy, rx, ry, (px, py) => { if (py >= sy && py < sy + st) { g.fillStyle = (py === sy) ? c.acc2 : c.acc; g.fillRect(px, py, 1, 1); } });
    const tl = Math.max(2, Math.round(ry * 0.6)), tx = f > 0 ? cx - rx + 1 : cx + rx - 1 - (big ? 1 : 0);
    R(tx, sy + st, big ? 2 : 1, tl, c.acc); P(tx, sy + st + tl - 1, c.lo);
    const gy = Math.round(cy - ry * 0.55);
    ELLpx(cx, cy, rx, ry, (px, py) => { if (py === gy) { g.fillStyle = c.leather; g.fillRect(px, py, 1, 1); } });
    const ls = big ? 3 : mid ? 2 : 1, lh = big ? 3 : 2;
    for (const o of [0.12, 0.62]) {
      const lx = Math.round(cx + f * rx * o) - (f < 0 ? ls - 1 : 0);
      R(lx - 1, gy - 1, ls + 2, lh + 2, c.ink); R(lx, gy, ls, lh, c.lens);
    }
  } else {            // tide: hood + gas-mask filter
    const fx = Math.round(cx + f * rx * 0.35), fy = Math.round(cy - ry * 0.38), frx = Math.max(2, Math.round(rx * 0.42)), fry = Math.max(1, Math.round(ry * 0.28));
    ELL(fx, fy, frx, fry, '#0d1212');
    const ex = Math.round(fx + f * frx * 0.25); P(ex, fy, c.lens); if (mid) P(ex - f, fy, c.lens); if (big) { P(ex, fy - 1, c.lens); P(ex - f, fy - 1, c.lens); }
    const fw = big ? 3 : 2, fh = big ? 4 : 3, fcx = f > 0 ? fx + frx : fx - frx - fw + 1, fcy = fy + fry - 1;
    R(fcx - 1, fcy - 1, fw + 2, fh + 2, c.ink); R(fcx, fcy, fw, fh, c.filter); P(fcx + (f > 0 ? 0 : fw - 1), fcy, '#b4b9b0'); R(fcx, fcy + fh - 1, fw, 1, '#4b4f4a');
    const by = Math.round(cy + ry * 0.3); ELLpx(cx, cy, rx, ry, (px, py) => { if (py === by) { g.fillStyle = c.acc; g.fillRect(px, py, 1, 1); } });
    const pw = big ? 4 : mid ? 3 : 2, px = f > 0 ? cx - Math.round(rx * 0.2) - pw : cx + Math.round(rx * 0.2) + 1, py = Math.round(cy + ry * 0.45);
    R(px, py, pw, pw > 2 ? 3 : 2, c.acc); P(px, py, c.acc2);
  }
  // hit flash: a pale dither over the body
  if (flash > 0) { ELLpx(cx, cy, rx, ry, (px, py) => { if (((px + py) & 1) === 0) P(px, py, '#f4ecd0'); }); }
  // gun, always pointing along the aim direction
  const hx = Math.round(cx + f * rx * 0.25), hy = Math.round(cy + ry * 0.3), dx = Math.cos(p.aim), dy = Math.sin(p.aim);
  const glen = rx + 6, tipx = hx + dx * glen, tipy = hy + dy * glen;
  LN(hx - dx * 3, hy - dy * 3, hx, hy, c.wood, 2);
  LN(hx, hy, tipx, tipy, c.ink, 3);
  LN(hx, hy, tipx, tipy, c.metal, 1);
  LNf(hx, hy, tipx, tipy, (px, py, i) => { if (i % 3 === 1) P(px, py, c.metalHi); });
  P(Math.round(tipx), Math.round(tipy), c.metalHi);
  R(hx - 1, hy - 1, 2, 2, c.leather);
}

// Block shield: a bubble around the body with a brighter front arc facing the aim.
function drawShield(p, x, y, t) {
  const g = ctx(), cx = L(x), cy = L(y), Rr = Math.round(shieldRadius(p) / K) + 1;
  const blink = t < 0.25 && (Math.floor(t * 40) & 1);
  if (blink) return;
  for (let py = cy - Rr - 2; py <= cy + Rr + 2; py++) for (let px = cx - Rr - 2; px <= cx + Rr + 2; px++) {
    const dx = px - cx, dy = py - cy, d = Math.hypot(dx, dy);
    if (d > Rr + 0.6) continue;
    let da = Math.atan2(dy, dx) - p.aim; da = Math.atan2(Math.sin(da), Math.cos(da)); const ad = Math.abs(da);
    if (d >= Rr - 1) { g.fillStyle = ad < 0.6 ? SHIELD.rim : ad < 1.3 ? SHIELD.mid : SHIELD.soft; g.fillRect(px, py, 1, 1); }
    else if (d > Rr * 0.72 && (((px >> 1) + (py >> 1)) & 1) === 0 && (px & 1) === 0 && (py & 1) === 0) { g.fillStyle = ad < 1.4 ? SHIELD.mid : SHIELD.soft; g.fillRect(px, py, 1, 1); }   // sparse dither near the rim only: the body stays readable
  }
}

function drawBullet(trail, b) {
  const col = BULLET[b.style] || BULLET.amber, r = b.r >= 4.5 ? 2 : 1.5;
  const pts = trail;
  // trail: newest at index 0
  const g = ctx();
  const path = [];
  for (let i = 0; i + 1 < pts.length; i++) LNf(L(pts[i].x), L(pts[i].y), L(pts[i + 1].x), L(pts[i + 1].y), (x, y) => { const l = path[path.length - 1]; if (!l || l[0] !== x || l[1] !== y) path.push([x, y]); });
  const n = path.length;
  for (let i = n - 1; i >= 0; i--) {
    const t = i / n, c = t < 0.3 ? col[0] : t < 0.62 ? col[1] : col[2];
    if (t >= 0.62 && ((path[i][0] + path[i][1]) & 1)) continue;
    g.fillStyle = c; if (t < 0.62) g.fillRect(path[i][0], path[i][1], 2, 2); else g.fillRect(path[i][0], path[i][1], 1, 1);
  }
  const hx = L(pts[0].x), hy = L(pts[0].y);
  DISC(hx, hy, r + 1, '#1a1410'); DISC(hx, hy, r, col[1]); DISC(hx, hy, Math.max(0.5, r - 1), col[0]);
  P(hx, hy, '#ffffff');
}

// ---- the renderer ---------------------------------------------------------------------------------------------------------------------------------------
export function createRenderer(canvas) {
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  const R_ = { canvas, g, terrainMapId: null, terrain: null, trails: new Map(), showHitboxes: false };

  // Draw one frame. `prev` = positions captured before the last tick (for interpolation), `alpha` 0..1.
  R_.draw = function (state, prev, alpha, fx) {
    const map = getMap(state.mapId);
    HZ = HZ_STYLES[map.hazardStyle] || HZ_BASE;
    // build the cached layers first (they switch the pixel toolkit to their own canvases), then draw on the main canvas
    if (R_.terrainMapId !== state.mapId) { R_.terrain = buildTerrain(map); R_.terrainMapId = state.mapId; R_.trails.clear(); }
    const bg = getBackground(map.background, map.backgroundVariant);
    use(g);

    g.save();
    g.drawImage(bg, 0, 0);
    { const fd = getBackgroundFade(); if (fd) { g.globalAlpha = fd.alpha; try { g.drawImage(fd.from, 0, 0); } catch (e) { /* a frame that was closed meanwhile */ } g.globalAlpha = 1; } }
    // screen shake (integer pixel offsets, render-only)
    if (fx.shake > 0.05) { const m = Math.ceil(fx.shake); g.translate(Math.round((Math.sin(fx.time * 91) ) * m * 0.7), Math.round((Math.cos(fx.time * 77)) * m * 0.7)); }
    g.drawImage(R_.terrain, 0, 0);

    // destructible blocks
    for (const b of state.blocks) {
      if (!b.alive) continue;
      const r = b.hp / b.maxHp, st = r > 0.66 ? 0 : r > 0.33 ? 1 : 2;
      if (b.kind === 'barrel') g.drawImage(barrelSprite(L(b.w), L(b.h), r < 0.99), L(b.x), L(b.y));
      else g.drawImage(blockSprite(L(b.w), L(b.h), st, Math.floor(b.x / 32 + b.y / 32)), L(b.x), L(b.y));
    }
    // moving platforms (interpolated between the previous and current tick)
    for (const def of map.platforms || []) {
      const a = platformPos(def, Math.max(0, state.roundTick - 1)), c = platformPos(def, state.roundTick);
      const t = state.roundTick === 0 ? 1 : alpha;
      drawMovingPlatform(lerp(a.x, c.x, t), lerp(a.y, c.y, t), def.w, def.h);
    }

    // hazards (saws interpolated like moving platforms)
    const hzNow = getHazards(state), hzPrev = getHazards(state, Math.max(0, state.roundTick - 1));
    hzNow.forEach((h, i) => {
      if (h.type === 'spikes') drawSpikes(h);
      else if (h.type === 'grate') drawGrate(h, state.roundTick);
      else if (h.type === 'saw') { const q = hzPrev[i], t = state.roundTick === 0 ? 1 : alpha; drawSaw(lerp(q.cx, h.cx, t), lerp(q.cy, h.cy, t), h.r, state.roundTick); }
    });

    // survivors
    const pos = state.players.map((p, i) => {
      const pp = prev && prev.players[i];
      return { x: lerpPos(pp && pp.x, p.x, alpha), y: lerpPos(pp && pp.y, p.y, alpha) };
    });
    const arrows = [];
    state.players.forEach((p, i) => {
      if (!p.alive) return;
      const q = pos[i];
      if (q.y + p.h / 2 < 0) arrows.push({ i, x: q.x });                       // above the top edge: show an arrow instead
      const moving = p.grounded && Math.abs(p.vx) > 40;
      drawSurvivor(i, p, q.x, q.y, fx.flash[i], moving && (Math.floor(fx.time * 12) & 1));
      if (p.blockLeft > 0) drawShield(p, q.x, q.y, p.blockLeft);
    });

    // bullets with trails
    const seen = new Set();
    for (const b of state.bullets) {
      seen.add(b.id);
      let tr = R_.trails.get(b.id);
      const pb = prev && prev.bullets.get(b.id);
      const bx = pb ? lerpPos(pb.x, b.x, alpha) : b.x, by = pb ? lerpPos(pb.y, b.y, alpha) : b.y;
      if (!tr) { tr = [{ x: bx, y: by }]; R_.trails.set(b.id, tr); }
      const last = tr[0];
      if (Math.hypot(bx - last.x, by - last.y) > 3) { tr.unshift({ x: bx, y: by }); if (tr.length > 7) tr.pop(); }
      const pts = [{ x: bx, y: by }, ...tr];
      drawBullet(pts, b);
    }
    for (const id of R_.trails.keys()) if (!seen.has(id)) R_.trails.delete(id);

    fxDraw(fx);

    // arrows for players above the top of the screen
    for (const a of arrows) {
      const cx = Math.max(8, Math.min(W - 9, L(a.x))), c = PC[a.i], dist = -(state.players[a.i].y) / 40;
      const s = 3 + Math.min(2, Math.floor(dist));
      for (let j = 0; j < s; j++) R(cx - (s - 1 - j), 2 + j, 2 * (s - 1 - j) + 1, 1, c.hi);
      R(cx - s, 1, 2 * s + 1, 1, c.ink); for (let j = 0; j < s; j++) { P(cx - (s - 1 - j) - 1, 2 + j, c.ink); P(cx + (s - 1 - j) + 1, 2 + j, c.ink); }
      R(cx - 1, 2 + s, 3, 1, c.ink);
    }

    if (R_.showHitboxes) drawHitboxes(state, map, pos);
    g.restore();
  };
  return R_;
}

// Debug overlay: every collision shape in the simulation, drawn as 1px outlines.
function drawHitboxes(state, map, pos) {
  const g = ctx();
  const box = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(L(x), L(y), L(w), 1); g.fillRect(L(x), L(y + h) - 1, L(w), 1); g.fillRect(L(x), L(y), 1, L(h)); g.fillRect(L(x + w) - 1, L(y), 1, L(h)); };
  map.solids.forEach((s) => box(s.x, s.y, s.w, s.h, '#8fd16a'));
  for (const b of state.blocks) if (b.alive) box(b.x, b.y, b.w, b.h, '#e0b25a');
  for (const def of map.platforms || []) { const c = platformPos(def, state.roundTick); box(c.x, c.y, def.w, def.h, '#6fb7d9'); }
  for (const h of getHazards(state)) {     // hazards in their own colour (orange)
    if (h.shape === 'rect') box(h.x, h.y, h.w, h.h, '#ff9a3c');
    else { g.fillStyle = '#ff9a3c'; const x = L(h.cx), y = L(h.cy), r = L(h.r) + 1; ELLpx(x, y, r, r, (px, py, nx, ny) => { if (nx * nx + ny * ny > 0.7) g.fillRect(px, py, 1, 1); }); }
  }
  state.players.forEach((p, i) => {
    if (!p.alive) return;
    box(pos[i].x - p.w / 2, pos[i].y - p.h / 2, p.w, p.h, '#f06a5a');
    if (p.blockLeft > 0) { const r = shieldRadius(p); g.fillStyle = '#9fe0d0'; ELLpx(L(pos[i].x), L(pos[i].y), L(r), L(r), (x, y, nx, ny) => { if (nx * nx + ny * ny > 0.82) g.fillRect(x, y, 1, 1); }); }
  });
  for (const b of state.bullets) { g.fillStyle = '#ffffff'; const x = L(b.x), y = L(b.y), r = Math.max(1, L(b.r)); ELLpx(x, y, r, r, (px, py, nx, ny) => { if (nx * nx + ny * ny > 0.5) g.fillRect(px, py, 1, 1); }); }
  for (const sp of map.spawns) { g.fillStyle = '#d9d2b8'; g.fillRect(L(sp.x) - 2, L(sp.y), 5, 1); g.fillRect(L(sp.x), L(sp.y) - 2, 1, 5); }
}
