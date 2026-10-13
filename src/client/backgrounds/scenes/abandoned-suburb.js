// ============================================================================
//  abandoned-suburb - a street of collapsed, overgrown houses, a leaning water tower and power pylons
//  marching off into the haze, a rusted school bus and a playground swallowed by tall grass and
//  wildflowers. Variants: 0 late afternoon, 1 misty morning (low sun, heavy ground fog, drifting seeds).
//  Interface: create(seed, variant) -> { id, name, variantName, draw(ctx, timeMs) }
// ============================================================================
import {
  W, H, use, P, R, LN, FPOLY, ELLpx, hash, mulberry32, bay, TAU, layer, mix, mixAll, clamp, fbm, smooth,
  gradV, glow, shaftLayer, cloudSprite, mistSprite, drawTiled, flock, perched, leaves, motes, vignetteLayer, calmFn,
  swaySprite, wind, fast, mkCanvas,
} from '../lib.js';
import { foliage, tree, vineCurtain, grassTuft, fern, ivy, drawDeerC, drawFoxC, drawSwing, drawCable } from '../art.js';

export const id = 'abandoned-suburb';
export const name = 'Abandoned Suburb';
export const variants = ['late afternoon', 'misty morning'];

const BASE = 270;                  // ground line of the house row
const SUN = [498, 150];

const PAL = [
  {
    sky: ['#3d7a8c', '#6aa09f', '#a9c3a0', '#ecd08e', '#f0a862'], haze: '#c2b58c', warm: '#f7cf86', glowA: 0.55, sun: true,
    cloud: { hi: '#f6c985', mid: '#b4c0a2', lo: '#628a8c' }, cloudN: 7,
    houses: [['#dccaa0', '#b09a72', '#6a6048'], ['#9db9a2', '#6f8f84', '#41594f'], ['#c9a468', '#9a7a48', '#5c4630'], ['#cfd0bc', '#a2a692', '#5f6a5c']],
    roof: ['#8a7660', '#5c4e42', '#362e2a'], dark: '#1c2624', glass: '#2a4545', glint: '#86b0a6', trim: '#efe3bd', brick: ['#a06c4f', '#78503c'],
    moss: ['#b2c75a', '#729a40', '#40673a'], leaf: ['#b8cf5e', '#82b04a', '#52803e', '#325a38', '#1c3c33'], trunk: ['#7a6548', '#4f4132', '#2f281f'],
    vine: { stem: ['#2b4a30', '#41663a'], leaf: ['#a8c456', '#66963f', '#3a6339'], flower: ['#eadfa6', '#dcd9c6', '#a4bbd6'] },
    metal: ['#8d7662', '#5e4c40', '#352c28'], bus: ['#c2a04a', '#97782f', '#5d4a22'], rust: '#8b5232',
    asphalt: ['#5f6a62', '#4a554f', '#343e3a'], lawn: ['#7a9a4c', '#5b8040', '#3f6236'],
    shaft: '#ffe0a0', shaftA: 0.26, mist: '#f0dca0', mistA: [0.05, 0.1], vig: '#0d1a14', vigA: 0.5,
    flowers: ['#ecdf9c', '#e2e0d0', '#a7bdd8', '#d6b25a'], seeds: false,
    deer: { body: '#6b5c42', belly: '#938360', dark: '#443a2a', back: '#5b4d38', rump: '#ac9a7a', antler: '#4a4030' }, fox: { body: '#8a6446', belly: '#cdbd9c', dark: '#3a2f27', back: '#6f4f38' },
    leafCols: ['#a9bd55', '#7a9a42', '#c8a850', '#a07a3c'], bird: '#26363a',
  },
  {
    sky: ['#6f9fa6', '#98bbb2', '#c1d1b6', '#e1dfba', '#ead9a6'], haze: '#c3cdbd', warm: '#f2e2b0', glowA: 0.4, sun: true,
    cloud: { hi: '#ecdfb8', mid: '#b9cabd', lo: '#7f9ea1' }, cloudN: 6,
    houses: [['#cfc4a0', '#a39878', '#645d4a'], ['#98b2a0', '#6c8a80', '#40574f'], ['#bfa56e', '#92784c', '#5a4733'], ['#c6c9b8', '#9ca08f', '#5c665a']],
    roof: ['#7f7260', '#574d44', '#352f2c'], dark: '#1a2624', glass: '#2a4547', glint: '#86b0a6', trim: '#e6dcbb', brick: ['#97684f', '#70503e'],
    moss: ['#a9cb5c', '#68a042', '#3a6a3a'], leaf: ['#a8cc60', '#6ea64c', '#44813f', '#2c5c38', '#1a3c33'], trunk: ['#6a5c4a', '#463d33', '#2b2620'],
    vine: { stem: ['#2b4a30', '#3f6638'], leaf: ['#a0c85a', '#66a244', '#3a6a3a'], flower: ['#e0e2c4', '#cfd9d6', '#9db7d2'] },
    metal: ['#85705f', '#5a493f', '#352c28'], bus: ['#bd9f52', '#937835', '#5a4824'], rust: '#7d4c34',
    asphalt: ['#5e6a64', '#49554f', '#343f3b'], lawn: ['#76a050', '#58844a', '#3d6639'],
    shaft: '#f8eecb', shaftA: 0.2, mist: '#e7efe6', mistA: [0.14, 0.26], vig: '#0c1a18', vigA: 0.5,
    flowers: ['#ecdf9c', '#e2e0d0', '#a7bdd8', '#d6b25a'], seeds: true,
    deer: { body: '#5f5646', belly: '#867d66', dark: '#3a352b', back: '#4f473a', rump: '#9d9680', antler: '#463f33' }, fox: { body: '#7e5c42', belly: '#c4b898', dark: '#352c26', back: '#654a36' },
    leafCols: ['#8db84f', '#5f9444', '#7a8f45', '#5a7a3a'], bird: '#2a3a3d',
  },
];
function band(g, y0, y1, col, maxA, steps = 5) {
  const [r_, g_, b_] = [parseInt(col.slice(1, 3), 16), parseInt(col.slice(3, 5), 16), parseInt(col.slice(5, 7), 16)];
  for (let lv = 1; lv <= steps; lv++) {
    g.fillStyle = 'rgba(' + r_ + ',' + g_ + ',' + b_ + ',' + (maxA * lv / steps).toFixed(3) + ')';
    for (let y = Math.min(y0, y1); y < Math.max(y0, y1); y++) { const t = clamp((y - y0) / (y1 - y0), 0, 1); for (let x = 0; x < W; x++) if (Math.floor(t * steps + bay(x, y) / 16) === lv) g.fillRect(x, y, 1, 1); }
  }
}

/* A clapboard house with a gabled roof; o.collapse sags/breaks the ridge, o.hole opens the front wall. */
function house(g, PL, o) {
  const { x, w, h, base, wp, seed, flip } = o, top = base - h, rh = Math.round(w * 0.38), apex = x + w / 2, half = w / 2 + 4;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const lf = flip ? 1 - i / (w - 1) : i / (w - 1);
    let tone = 0.25 + 0.6 * lf + (1 - j / h) * 0.1 + (hash(x + i, j, seed) - 0.5) * 0.1;
    if (j % 3 === 2) tone -= 0.24; else if (j % 3 === 0) tone += 0.06;
    tone = clamp(tone, 0, 0.999) * 2; const i0 = Math.floor(tone), lvl = Math.round((tone - i0) * 4) / 4 * 16;
    P(x + i, top + j, wp[2 - (lvl > bay(x + i, j) ? i0 + 1 : i0)]);
  }
  R(x, top, 1, h, wp[2]); R(flip ? x : x + w - 1, top, 1, h, wp[0]);
  // roof columns with a collapsed middle
  const zone = w * 0.24;
  for (let px = x - 4; px < x + w + 4; px++) {
    const d = Math.abs(px - apex) / half, yFull = top - Math.round(rh * (1 - d)); let yTop = yFull;
    if (o.collapse && Math.abs(px - apex + (o.collapse === 'left' ? w * 0.14 : -w * 0.1)) < zone) { const k = 1 - Math.abs(px - apex + (o.collapse === 'left' ? w * 0.14 : -w * 0.1)) / zone; yTop = yFull + Math.round(rh * 0.78 * Math.pow(k, 0.7) + hash(px, 2, seed) * 2); }
    const lit = flip ? px < apex : px > apex;
    for (let yy = yTop; yy < top + 2; yy++) { const rel = yy - yTop; P(px, yy, rel < 1 ? PL.roof[0] : ((px + yy * 2) % 6 === 0 ? PL.roof[2] : (lit ? PL.roof[1] : PL.roof[2]))); }
    if (yTop === yFull && hash(px, 3, seed) > 0.5) { P(px, yTop, PL.moss[1]); if (hash(px, 4, seed) > 0.6) P(px, yTop - 1, PL.moss[0]); }
    if (o.collapse && yTop > yFull + 2 && hash(px, 5, seed) > 0.8) R(px, yFull, 1, yTop - yFull, PL.dark);   // splintered rafters
  }
  if (o.collapse) for (let k = 0; k < 4; k++) { const rx = Math.round(apex + (k - 1.5) * zone * 0.55), ry = top - rh * 0.4; LN(rx, ry, rx + (k % 2 ? 6 : -6), ry + 10 + k, PL.dark, 1); }
  // chimney
  if (!o.collapse) { const cx = Math.round(x + w * (flip ? 0.2 : 0.74)); R(cx, top - rh * 0.55 - 9, 6, 12, PL.brick[1]); R(cx + 4, top - rh * 0.55 - 9, 2, 12, PL.brick[0]); R(cx - 1, top - rh * 0.55 - 10, 8, 2, PL.roof[2]); }
  // windows, door, porch
  const wins = w > 80 ? [Math.round(w * 0.1), Math.round(w * 0.64), Math.round(w * 0.82)] : [Math.round(w * 0.12), Math.round(w * 0.7)];
  for (const [k, wx0] of wins.entries()) {
    const wx = x + wx0, wy = top + 6; if (o.hole && wx0 > w * 0.5 - 2) continue;
    R(wx, wy, 9, 12, PL.glass); R(wx, wy, 9, 1, o.wp[2]); R(wx, wy + 12, 9, 1, PL.trim); R(wx + 4, wy, 1, 12, o.wp[1]); R(wx, wy + 5, 9, 1, o.wp[1]);
    P(wx + 1, wy + 1, PL.glint); P(wx + 2, wy + 2, PL.glint);
    if (hash(k, seed, 3) > 0.4) { R(wx - 3, wy, 3, 12, PL.moss[2]); R(wx - 3, wy, 1, 12, PL.dark); }
    if (hash(k, seed, 5) > 0.55) R(wx + 7, wy, 3, 7, PL.dark);
  }
  const dx = x + Math.round(w * 0.42); R(dx, base - 17, 9, 17, PL.dark); R(dx - 1, base - 18, 11, 1, PL.trim); R(dx + 6, base - 9, 1, 1, PL.glint);
  R(dx - 6, base - 3, 22, 3, o.wp[1]); R(dx - 6, base - 3, 22, 1, PL.trim); R(dx - 6, base - 15, 2, 12, o.wp[2]); R(dx + 14, base - 15, 2, 12, o.wp[2]); R(dx - 6, base - 16, 22, 1, o.wp[1]);
  if (o.hole) {   // the front wall has fallen away: dark interior, a floor, a bed frame
    const hx = x + Math.round(w * 0.56), hw = Math.round(w * 0.36);
    for (let i = 0; i < hw; i++) { const t0 = top + 2 + Math.round(hash(i, 7, seed) * 5), b0 = base - 1 - Math.round(hash(i, 8, seed) * 4); g.clearRect(hx + i, t0, 1, b0 - t0); R(hx + i, t0, 1, b0 - t0, PL.dark); }
    R(hx, base - 12, hw, 2, wp[1]); R(hx, base - 12, hw, 1, PL.trim); R(hx + 3, base - 21, 1, 9, wp[2]); R(hx + 3, base - 18, 12, 1, wp[2]); R(hx + 14, base - 21, 1, 9, wp[2]);
  }
}
function pylon(g, x, base, h, col) {
  const hw = Math.round(h * 0.13);
  for (let y = 0; y < h; y++) { const w = Math.round(hw * (1 - y / h) + 1); P(x - w, base - y, col); P(x + w, base - y, col); }
  for (let y = 0; y < h - 6; y += 7) { const w1 = Math.round(hw * (1 - y / h) + 1), w2 = Math.round(hw * (1 - (y + 7) / h) + 1); LN(x - w1, base - y, x + w2, base - y - 7, col, 1); LN(x + w1, base - y, x - w2, base - y - 7, col, 1); R(x - w1, base - y, 2 * w1 + 1, 1, col); }
  for (const [yy, aw] of [[h - 4, 14], [h - 18, 11], [h - 32, 8]]) { R(x - aw, base - yy, 2 * aw + 1, 1, col); R(x - aw, base - yy, 1, 3, col); R(x + aw, base - yy, 1, 3, col); P(x, base - yy - 1, col); }
}

export function create(seed = 1, variant = 0) {
  const PL = PAL[variant] || PAL[0], hz = PL.haze, rnd = mulberry32(seed * 733 + variant * 13 + 1), calm = calmFn(105, 300, 0.3);

  const SKY = layer(W, H, g => {
    gradV(0, 0, W, 262, PL.sky, 4); R(0, 262, W, H - 262, PL.sky[4]);
    glow(SUN[0], SUN[1], 240, PL.warm, PL.glowA * 0.7, 6, 1.6); glow(SUN[0], SUN[1], 46, '#ffe9b0', 0.34, 5, 1.5);
    for (let y = -12; y <= 12; y++) for (let x = -12; x <= 12; x++) { const d = Math.hypot(x, y); if (d <= 9.5) P(SUN[0] + x, SUN[1] + y, d > 7.5 ? '#eec677' : '#f9e2a2'); }
  });
  const clouds = [];
  for (let i = 0; i < PL.cloudN; i++) { const row = i % 3, w = [240, 160, 110][row] + Math.floor(rnd() * 40), h = [34, 24, 16][row]; clouds.push({ spr: cloudSprite(w, h, seed * 9 + i * 3 + variant, PL.cloud), y: [10, 42, 84][row] + Math.floor(rnd() * 24), v: [3, 4.6, 7][row], x0: rnd() * 900, w }); }

  // ---------------------------------------------------------------- far: hills, treeline, pylons, the leaning water tower
  const fogC = (c, f) => mix(c, hz, f);
  const FARL = layer(W, H, g => {
    for (const [amp, f, y0, sd] of [[26, 0.78, 214, 3], [20, 0.64, 232, 5]]) {
      for (let x = 0; x < W; x++) { const top = Math.round(y0 - fbm(x * 0.006, sd, seed, 3) * amp - Math.sin(x * 0.011 + sd) * 4); R(x, top, 1, BASE - top + 4, fogC(PL.lawn[1], f)); P(x, top, fogC(PL.lawn[0], f - 0.08)); }
      const lf = mixAll(PL.leaf, hz, f);
      for (let x = -10; x < W; x += 12 + Math.floor(rnd() * 12)) { const top = Math.round(y0 - fbm(x * 0.006, sd, seed, 3) * amp - Math.sin(x * 0.011 + sd) * 4); g.drawImage(foliage(22 + Math.floor(rnd() * 22), 14 + Math.floor(rnd() * 10), lf, x + sd, { maxR: 5 }), x - 10, top - 10); }
      band(g, y0 - 10, 268, hz, 0.28);
    }
    // pylons marching away, wires drawn per frame
    pylon(g, 262, 262, 92, fogC(PL.metal[2], 0.3)); pylon(g, 548, 262, 92, fogC(PL.metal[2], 0.3)); pylon(g, 170, 246, 40, fogC(PL.metal[2], 0.6));
    // the water tower: tank on four legs, leaning on its worn footings
    const wt = layer(70, 124, gg => {
      const m = PL.metal, tc = fogC(PL.metal[1], 0.2);
      for (const lx of [14, 24, 44, 54]) { LN(lx, 118, lx < 35 ? 22 : 48, 42, m[2], 2); LN(lx + 2, 118, (lx < 35 ? 22 : 48) + 2, 42, m[1], 1); }
      for (let y = 60; y < 118; y += 18) { LN(14 + (y - 44) * 0.08, y, 54 - (y - 44) * 0.08, y + 18, m[2], 1); LN(54 - (y - 44) * 0.08, y, 14 + (y - 44) * 0.08, y + 18, m[2], 1); }
      for (let y = 14; y < 46; y++) for (let x = 16; x < 54; x++) { const f = (x - 16) / 38, n = hash(x, y, 4); P(x, y, (y % 8 === 0) ? m[2] : f > 0.7 ? m[0] : f > 0.3 ? m[1] : (n > 0.5 ? m[1] : m[2])); if (n > 0.93) P(x, y, PL.rust); }
      for (let y = 4; y < 14; y++) { const hw = Math.round((y - 4) * 1.9); for (let x = 35 - hw; x <= 35 + hw; x++) P(x, y, x > 35 ? m[0] : m[1]); }
      R(35, 0, 1, 5, m[2]); R(14, 46, 42, 2, m[2]); R(14, 46, 42, 1, m[0]); R(24, 20, 7, 6, PL.dark); P(26, 22, PL.glint);                       // a hole punched in the tank
      for (let k = 0; k < 9; k++) { const rx = 18 + Math.floor(hash(k, 1, 4) * 34); for (let q = 0; q < 6 + hash(k, 2, 4) * 20; q++) P(rx, 26 + q, hash(rx, q, 5) > 0.3 ? PL.rust : m[2]); }
      for (let x = 16; x < 54; x++) if (hash(x, 9, 4) > 0.5) { P(x, 14, PL.moss[1]); if (hash(x, 10, 4) > 0.7) P(x, 13, PL.moss[0]); }
    });
    for (let r = 0; r < 124; r++) g.drawImage(wt, 0, r, 70, 1, 352 + Math.round((124 - r) * 0.13), 130 + r, 70, 1);   // shear = lean
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(' + parseInt(hz.slice(1, 3), 16) + ',' + parseInt(hz.slice(3, 5), 16) + ',' + parseInt(hz.slice(5, 7), 16) + ',0.16)'; g.fillRect(340, 120, 100, 140); g.globalCompositeOperation = 'source-over';
    band(g, 200, 272, hz, 0.34);
  });
  const tankTree = tree({ canopyW: 26, canopyH: 18, trunkH: 6, trunkW: 2, pal: mixAll(PL.leaf, hz, 0.4), trunk: mixAll(PL.trunk, hz, 0.4), seed: 91, lean: 2, branches: 2 });

  // ---------------------------------------------------------------- the street and its houses
  const H_SPEC = [
    { x: 2, w: 106, h: 50, k: 0, collapse: 'left' }, { x: 118, w: 90, h: 44, k: 1, hole: true },
    { x: 432, w: 84, h: 46, k: 2, flip: true, hole: true }, { x: 526, w: 114, h: 54, k: 3, collapse: 'right', flip: true },
  ];
  const GROUND = layer(W, H, g => {
    // lawns grading into the street; the road is a trapezoid running to the vanishing point
    for (let y = 262; y < H; y++) for (let x = 0; x < W; x++) {
      const f = (y - 262) / (H - 262), n = fbm(x * 0.03, y * 0.05, seed, 3), rl = 320 - (60 + f * 190), rr = 320 + (60 + f * 190), onRoad = x > rl && x < rr;
      let c;
      if (onRoad) { c = mix(PL.asphalt[1], PL.asphalt[n > 0.55 ? 0 : 2], 0.3); if (hash(x, y, seed) > 0.97) c = PL.asphalt[2]; if (Math.abs(x - 320) < 1 + f * 2 && ((y >> 3) & 1) && f > 0.1) c = '#b4aa7a'; }
      else { c = PL.lawn[n > 0.56 ? 0 : n > 0.4 ? 1 : 2]; if (hash(x, y, seed + 1) > 0.9) c = PL.lawn[(x + y) % 3]; if (Math.abs(x - rl) < 3 || Math.abs(x - rr) < 3) c = mix(PL.asphalt[0], PL.lawn[1], 0.4); }
      P(x, y, c);
    }
    for (let k = 0; k < 200; k++) { const y = 264 + Math.floor(Math.pow(rnd(), 0.8) * 96), f = (y - 262) / (H - 262), x = Math.floor(320 + (rnd() - 0.5) * 2 * (60 + f * 190)); R(x, y, 2 + Math.floor(f * 6), 1, PL.moss[2]); if (rnd() > 0.5) P(x, y - 1, PL.moss[1]); }   // cracks full of moss
    band(g, 262, 296, hz, 0.2);
  });
  const HOUSES = layer(W, H, g => {
    for (const s of H_SPEC) house(g, PL, { ...s, base: BASE, wp: PL.houses[s.k], seed: s.x * 3 + 7 });
    g.globalCompositeOperation = 'source-atop';
    for (const s of H_SPEC) ivy(s.x, BASE - s.h - 14, s.w, s.h + 14, PL.leaf, s.x, (x, y) => 0.5 * (1 - smooth(0, 40, y)) + 0.16 + 0.4 * (x < 8 || x > s.w - 8 ? 1 : 0), 0.5);
    glow(SUN[0] - 160, 220, 300, PL.warm, PL.sun ? 0.22 : 0.1, 5, 1.2);
    g.globalCompositeOperation = 'source-over';
    band(g, 232, BASE + 2, hz, 0.22);
    // fences and mailboxes, a toppled lamp
    for (const [x0, x1] of [[210, 240], [396, 428]]) for (let x = x0 < 1 ? 0 : x0; x < x1 + (x1 - x0 < 5 ? 0 : 0); x += 4) if (hash(x, 4, seed) > 0.25) { R(x, BASE - 8 + Math.floor(hash(x, 5, seed) * 3), 2, 9, PL.houses[3][0]); R(x, BASE - 8, 1, 9, PL.houses[3][1]); }
    for (let i = 0; i < 40; i++) { P(396 + i, BASE + 6 - Math.round(i * 0.2), '#2d3636'); P(396 + i, BASE + 7 - Math.round(i * 0.2), '#464f4d'); }
  });
  // the big trees growing through and between the houses (sway)
  const trees = [];
  const addTree = (x, base, cw, ch, th, s, lean) => { const spr = tree({ canopyW: cw, canopyH: ch, trunkH: th, trunkW: 4, pal: PL.leaf, trunk: PL.trunk, seed: s, lean, branches: 4 }); trees.push({ spr, x: x - (spr.width >> 1), y: base - spr.height, o: { amp: 3, anchor: 'bottom', phase: s * 0.4, pow: 1.1 } }); };
  addTree(112, BASE + 2, 72, 50, 28, 1, 4); addTree(226, BASE + 2, 86, 58, 36, 2, -4); addTree(424, BASE + 2, 80, 54, 32, 3, 4); addTree(52, 200, 56, 38, 14, 5, 3); addTree(588, 192, 60, 40, 14, 6, -3);
  const curtains = [];
  for (const [x, y, w, h, s] of [[24, 222, 22, 38, 11], [86, 230, 24, 30, 12], [440, 226, 22, 34, 13], [560, 212, 22, 42, 14], [610, 222, 20, 36, 15]]) curtains.push({ spr: vineCurtain(w, h, PL.vine, s, { band: 4 }), x, y, o: { amp: 4, anchor: 'top', phase: s * 0.5 } });

  // ---------------------------------------------------------------- props: school bus, playground (static parts)
  const BUS = layer(150, 64, g => {
    const b = PL.bus, L = 140, y0 = 10;
    R(4, y0 + 8, L, 34, b[0]); R(4, y0 + 8, L, 3, mix(b[0], '#fff', 0.2)); R(4, y0 + 36, L, 6, b[1]); R(4, y0 + 22, L, 2, b[2]);   // body, roof edge, black stripe
    R(4, y0 + 3, L - 14, 5, b[0]); R(4, y0 + 3, L - 14, 1, mix(b[0], '#fff', 0.25)); R(L - 6, y0 + 20, 14, 22, b[0]); R(L + 4, y0 + 24, 6, 10, PL.dark);
    for (let k = 0; k < 8; k++) { const wx = 10 + k * 15; R(wx, y0 + 12, 11, 9, PL.glass); P(wx + 1, y0 + 13, PL.glint); P(wx + 2, y0 + 14, PL.glint); if (hash(k, 3, seed) > 0.6) for (let i = 0; i < 11; i++) if (hash(i, k, 9) > 0.4) R(wx + i, y0 + 20 - Math.floor(hash(i, k, 8) * 5), 1, 3, PL.moss[1 + (i & 1)]); }
    R(116, y0 + 24, 14, 16, PL.dark); R(116, y0 + 24, 1, 16, b[2]);
    for (let k = 0; k < 40; k++) { const rx = 6 + Math.floor(hash(k, 1, seed) * (L - 6)), ry = y0 + 9 + Math.floor(hash(k, 2, seed) * 30), rl = 2 + Math.floor(hash(k, 4, seed) * 9); for (let j = 0; j < rl; j++) P(rx, ry + j, hash(rx, j, 4) > 0.3 ? PL.rust : mix(PL.rust, b[0], 0.5)); }
    for (const wx of [28, 112]) { ELLpx(wx, y0 + 42, 8, 8, (x, y) => P(x, y, y < y0 + 44 ? '#181e1e' : '#101515')); P(wx, y0 + 42, '#59615b'); }
    for (let i = 0; i < L; i++) { const n = fbm(i * 0.14, 5, seed, 2); if (n > 0.46) for (let q = 0; q < 2 + n * 5; q++) P(4 + i, y0 + 2 + q, q === 0 ? PL.moss[0] : (hash(i, q, 3) > 0.5 ? PL.moss[1] : PL.moss[2])); }
  });
  const PLAY = layer(150, 80, g => {      // swing frame, slide and a roundabout, all rusted
    const m = PL.metal;
    LN(10, 70, 30, 12, m[1], 2); LN(70, 70, 50, 12, m[1], 2); R(26, 10, 28, 3, m[0]); R(26, 12, 28, 1, m[2]); LN(8, 70, 32, 12, m[2], 1); LN(72, 70, 48, 12, m[2], 1);
    for (let i = 0; i < 28; i++) if (hash(i, 2, 6) > 0.7) P(26 + i, 9, PL.moss[1]);
    // slide
    LN(92, 70, 100, 26, m[1], 2); LN(112, 70, 104, 26, m[1], 2); R(96, 22, 12, 4, m[0]); LN(108, 26, 142, 64, m[0], 3); LN(108, 29, 142, 67, m[2], 1);
    for (let q = 0; q < 14; q++) P(112 + q * 2, 31 + q * 2, PL.rust);
    // roundabout (flat disc in perspective)
    ELLpx(122, 74, 18, 4, (x, y, nx, ny) => P(x, y, ny > 0.3 ? m[2] : (nx > 0 ? m[0] : m[1])));
  });
  const SWING = layer(10, 30, g => { R(1, 0, 1, 24, '#2b2f30'); R(8, 0, 1, 24, '#2b2f30'); R(0, 24, 10, 2, PL.metal[1]); R(0, 24, 10, 1, PL.metal[0]); });
  const SHORE = layer(W, H, g => {      // the bus and playground sit in the grass; tufts drawn on top
    g.drawImage(BUS, 464, 266); g.drawImage(PLAY, 28, 250);
  });
  const tuftP = [PL.leaf[0], PL.leaf[2], PL.leaf[3], PL.leaf[4]];
  const wild = [0, 1, 2, 3].map(k => grassTuft(34, 18 + k * 4, tuftP, 150 + k, { dens: 1.2, flowers: PL.flowers }));
  const GRASS = layer(W, H, g => {
    for (let x = -6; x < W; x += 6 + Math.floor(rnd() * 10)) { const f = Math.floor(rnd() * 4), y = 284 + Math.floor(Math.pow(rnd(), 0.8) * 70); if ((x > 250 && x < 390 && y < 330) || (x > 456 && x < 616 && y < 332)) continue; g.drawImage(wild[f], x, y - wild[f].height + 3); }
    const snap = g.getImageData(0, 0, W, H);
    for (let k = 0; k < 110; k++) { const x = Math.floor(rnd() * W), y = 270 + Math.floor(rnd() * 80); const px = snap.data, o4 = (y * W + x) * 4; if (px[o4 + 3] > 200 && px[o4 + 1] > px[o4] + 10) P(x, y, PL.flowers[k % 4]); }
  });
  const tallL = grassTuft(110, 56, tuftP, 160, { dens: 1.3, flowers: PL.flowers, lean: 8 }), tallR = grassTuft(90, 30, tuftP, 161, { dens: 1.3, flowers: PL.flowers, lean: 8 }), tallM = grassTuft(90, 44, tuftP, 162, { dens: 1.2, flowers: PL.flowers, lean: 7 });
  const fgTop = [{ spr: foliage(190, 54, [PL.leaf[1], PL.leaf[2], PL.leaf[3], PL.leaf[4], mix(PL.leaf[4], '#000000', 0.4)], 171, { maxR: 9 }), x: -50, y: -26 }, { spr: foliage(160, 44, [PL.leaf[1], PL.leaf[2], PL.leaf[3], PL.leaf[4], mix(PL.leaf[4], '#000000', 0.4)], 172, { maxR: 8 }), x: 520, y: -24 }];
  const fgVine = { stem: [PL.leaf[4], PL.leaf[3]], leaf: [PL.leaf[2], PL.leaf[3], PL.leaf[4]] };
  const fgCurt = [vineCurtain(26, 50, fgVine, 141, { band: 4 }), vineCurtain(22, 44, fgVine, 142, { band: 4 })];

  // light through the trees
  const shafts = [];
  { const mk = (ang, w0, spread, len, a) => shafts.push({ ox: SUN[0], oy: SUN[1], ang, w0, spread, len, a, mask: (x, y) => 1 - 0.5 * smooth(150, 195, y) * (1 - smooth(255, 300, y)) });
    mk(1.95, 10, 0.16, 460, 0.9); mk(2.2, 14, 0.18, 600, 0.8); mk(2.45, 10, 0.16, 640, 0.8); mk(2.7, 16, 0.2, 640, 0.55); mk(2.95, 12, 0.18, 600, 0.45); mk(1.7, 8, 0.12, 360, 0.5);
    for (const s of shafts) s.spr = shaftLayer(s, '#ffe3a2', PL.shaftA); }
  const shaftGroups = [0, 1].map(k => [0.62, 0.82, 1].map(a => { const c = mkCanvas(W, H), gg = c.getContext('2d'); gg.globalCompositeOperation = 'lighter'; gg.globalAlpha = a; shafts.forEach((s, i) => { if (i % 2 === k) gg.drawImage(s.spr, 0, 0); }); return fast(c); }));
  const mistA = mistSprite(W, 70, seed, PL.mist, PL.mistA[0], PL.mistA[1], 0.012, 0.07), mistB = mistSprite(W, 60, seed + 3, PL.mist, PL.mistA[0], PL.mistA[1], 0.016, 0.09);
  const VIG = vignetteLayer(PL.vig, PL.vigA);
  const FARLF = fast(FARL), GROUNDF = fast(GROUND), HOUSESF = fast(HOUSES), SHOREF = fast(SHORE), GRASSF = fast(GRASS), VIGF = fast(VIG);
  const deerCol = { ...PL.deer }; for (const k in deerCol) deerCol[k] = mix(deerCol[k], hz, 0.2);
  const foxCol = { ...PL.fox }; for (const k in foxCol) foxCol[k] = mix(foxCol[k], hz, 0.18);
  // power wires: pylon (250,238) -> (152,228) -> house-side pole; birds sit on them
  const WIRES = [[262 - 14, 262 - 88, 548 - 14, 262 - 88, 10], [262 + 14, 262 - 88, 548 + 14, 262 - 88, 10], [262 - 11, 262 - 74, 548 - 11, 262 - 74, 9], [262 + 11, 262 - 74, 548 + 11, 262 - 74, 9]];
  const perch = [[330, 178], [352, 179], [410, 180], [440, 179]];

  function deerHead(t, off) { const c = ((t / 1000 + off) % 15 + 15) % 15; if (c < 9) return 0.05; if (c < 10) return (c - 9) * 0.95; if (c < 13) return 1; if (c < 14) return 1 - (c - 13); return 0.05; }

  function draw(g, t) {
    g.imageSmoothingEnabled = false; use(g);
    g.drawImage(SKY, 0, 0);
    for (const c of clouds) { const span = W + c.w + 40, x = Math.round(((c.x0 + t * c.v / 1000) % span) - c.w - 20); g.drawImage(c.spr, x, c.y); }
    FARLF.draw(g);
    swaySprite(g, tankTree, 352 + 28 - (tankTree.width >> 1) + 15, 130 + 6 - tankTree.height, t, { amp: 2, anchor: 'bottom', phase: 0.5, pow: 1.1 });
    for (const w of WIRES) drawCable(g, t, w[0], w[1], w[2], w[3], w[4], '#1f2a2c', 1.2, w[0] * 0.01);
    flock(g, t, { y: 70, n: 8, col: PL.bird, seed: 5, t0: 5000, cycle: 44000, dur: 17000, rise: 12 });
    perched(g, t, perch, PL.bird, 34000, seed);
    GROUNDF.draw(g);
    // wildlife on the road far off: a deer pair crossing, a fox trotting the other way
    { const cyc = 90000, u = ((t + 20000) % cyc) / cyc * 1.5; if (u <= 1) { const x = -30 + u * (W + 60), st = t * 0.0052; drawDeerC(g, x, 284, { col: deerCol, dir: 1, head: 0.5, walk: st, antlers: true }); drawDeerC(g, x - 26, 286, { col: deerCol, dir: 1, head: 0.4, walk: st + 1.4 }); }
      const c2 = 70000, u2 = ((t + 41000) % c2) / c2 * 1.6; if (u2 <= 1) drawFoxC(g, W + 20 - u2 * (W + 50), 300, { col: foxCol, dir: -1, walk: t * 0.011 }); }
    drawDeerC(g, 292, 288, { col: deerCol, dir: 1, head: deerHead(t, 3) });
    HOUSESF.draw(g);
    for (const s of curtains) swaySprite(g, s.spr, s.x, s.y, t, s.o);
    for (const s of trees) swaySprite(g, s.spr, s.x, s.y, t, s.o);
    SHOREF.draw(g);
    // the swings
    for (const [sx, k] of [[34 + 28 + 2, 0], [34 + 28 + 14, 1]]) drawSwing(g, SWING, 5, 0, sx, 262, Math.sin(t * 0.0011 + k * 1.3) * 0.22 + wind(sx, t) * 0.12);
    GRASSF.draw(g);
    swaySprite(g, tallL, 18, 300, t, { amp: 4, anchor: 'bottom', phase: 0.4 }); swaySprite(g, tallR, 470, 336, t, { amp: 4, anchor: 'bottom', phase: 1.6 }); swaySprite(g, tallM, 212, 306, t, { amp: 3, anchor: 'bottom', phase: 2.7 });
    swaySprite(g, tallM, 430, 312, t, { amp: 3, anchor: 'bottom', phase: 3.7 }); swaySprite(g, tallL, 90, 312, t, { amp: 4, anchor: 'bottom', phase: 4.4 });
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 2; k++) { const v = 0.5 + 0.5 * Math.sin(t * 0.00055 + k * 2.1); shaftGroups[k][Math.min(2, Math.floor(v * 3))].draw(g); }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    motes(g, t, shafts, { n: 56, seed: 3, col: '#fff0c4', calm, a: 0.85 });
    drawTiled(g, mistA, 250, t, 4, 0); drawTiled(g, mistB, 296, t, -6, 100);
    leaves(g, t, { n: PL.seeds ? 6 : 16, seed: 8, cols: PL.leafCols, calm, drift: 70 });
    if (PL.seeds) leaves(g, t, { n: 22, seed: 12, cols: ['#f2eed8', '#e6e2c6'], calm, drift: 170 });
    for (const f of fgTop) g.drawImage(f.spr, f.x, f.y);
    swaySprite(g, fgCurt[0], 24, 14, t, { amp: 5, anchor: 'top', phase: 0.3 }); swaySprite(g, fgCurt[1], 560, 12, t, { amp: 5, anchor: 'top', phase: 1.1 });
    VIGF.draw(g);
  }
  const scene = { id, name, variant, variantName: variants[variant] || variants[0], variants, draw };
  { const wc = mkCanvas(W, H), wg = wc.getContext('2d'); for (const tt of [0, 5000]) draw(wg, tt); }
  return scene;
}
