// ============================================================================
//  overgrown-downtown - ruined skyscrapers swallowed by vines and trees, low sun between towers,
//  god rays, a flooded street with reflections, rusted vehicles half buried in green.
//  Variants: 0 golden hour, 1 overcast after rain (light rain, mist, no sun).
//  Interface: create(seed, variant) -> { id, name, variantName, draw(ctx, timeMs) }
// ============================================================================
import {
  W, H, use, P, R, LN, ELLpx, FPOLY, hash, mulberry32, bay, TAU, layer, mix, mixAll, rgba, clamp, fbm, smooth,
  gradV, glow, shaftLayer, cloudSprite, mistSprite, drawTiled, flock, perched, leaves, motes, rain, mirrorSource, drawWater,
  waterSparkle, ripples, vignetteLayer, calmFn, swaySprite, wind, fast, mkCanvas,
} from '../lib.js';
import {
  foliage, tree, vineCurtain, grassTuft, fern, ivy, drawTower, drawCrane, drawCar, drawDeerC, drawSwing, signSprite, drawCable,
} from '../art.js';

export const id = 'overgrown-downtown';
export const name = 'Overgrown Downtown';
export const variants = ['golden hour', 'overcast after rain'];

const WY = 298;               // waterline (flooded street)
const SX = 432, SY = 116;     // sun

const PAL = [
  { // ---- golden hour
    sky: ['#2a525e', '#3b6c75', '#5d9391', '#8fb6a0', '#c5cc9d', '#ecd699', '#f2c778'],
    haze: '#9fb596', sun: true, sunCol: '#f9e2a2', sunRing: '#eec677', glow: '#f7d58a', glowA: 0.5, warm: '#f3d58a',
    cloud: { hi: '#f4d28f', mid: '#a9c4ae', lo: '#5f8e90' }, cloudN: 7,
    wall: ['#8fa07e', '#566b57', '#34463f'], dark: '#182a2a', glass: ['#26443f', '#6f9f8e'], lit: '#f3d58c',
    moss: ['#a9c158', '#6c9640', '#3d6437'], rust: '#8e5535',
    leaf: ['#b5cd5e', '#7fae48', '#4e7e3d', '#2f5937', '#1b3b32'],
    trunk: ['#7a6548', '#4f4132', '#2f281f'],
    vine: { stem: ['#2b4a30', '#41663a'], leaf: ['#a3bf55', '#62923f', '#38623a'], flower: ['#eadfa6', '#dcd9c6', '#a4bbd6'] },
    car: { body: ['#a17050', '#734a35', '#472b21'], rust: '#8b4f2a', glass: '#1b2a2c', glint: '#86b1ab', tire: '#171d1d', rim: '#59615b', moss: ['#a9c158', '#6c9640', '#3d6437'] },
    bank: '#4a6a45', earth: '#2f3d2c',
    fgLeaf: ['#5f8a3d', '#41683a', '#2c4b2f', '#1b3528', '#0f221d'],
    water: ['#7aa391', '#4f8581', '#346a6e', '#223f4f'], waterTint: '#2c6c78', waterTintA: 0.34, waterDark: 0.26,
    glintA: '#f7e2a6', glintB: '#fff5d2', ripple: '#c4d6b0', mist: '#ead8a0', mistA: [0.06, 0.11], shafts: true, rain: false,
    leafCols: ['#a9bd55', '#7a9a42', '#c3a850', '#9b7a3c'], bird: '#26363a', birdFar: '#4a5f5e',
    deer: { body: '#66583f', belly: '#8d7d5c', dark: '#3f3626', back: '#574a34', rump: '#a79678', antler: '#4a4030' }, vig: '#0c1a16', vigA: 0.62,
  },
  { // ---- overcast after rain
    sky: ['#4c666b', '#6a888b', '#8ea8a5', '#aabeb5', '#c0cdc1', '#d2dbca', '#dde4d3'],
    haze: '#a0b3aa', sun: false, sunCol: '#e8efe0', sunRing: '#d8e2d4', glow: '#e4ecdc', glowA: 0.18, warm: '#cddccc',
    cloud: { hi: '#c9d6cb', mid: '#8fa5a3', lo: '#5d767a' }, cloudN: 10,
    wall: ['#7b8f84', '#506760', '#33484a'], dark: '#152428', glass: ['#223f44', '#5f8c8d'], lit: '#a9bfb1',
    moss: ['#9ac45a', '#609c42', '#366838'], rust: '#7d4c34',
    leaf: ['#9cc55c', '#65a049', '#407e3f', '#2a5a38', '#193a33'],
    trunk: ['#6a5c4a', '#463d33', '#2b2620'],
    vine: { stem: ['#2b4a30', '#3f6638'], leaf: ['#98c45a', '#63a043', '#38683a'], flower: ['#e0e2c4', '#cfd9d6', '#9db7d2'] },
    car: { body: ['#8d6850', '#664636', '#40291f'], rust: '#7c4a2c', glass: '#172629', glint: '#7aa5a6', tire: '#151b1c', rim: '#515a58', moss: ['#9ac45a', '#609c42', '#366838'] },
    bank: '#3f6340', earth: '#2a382c',
    fgLeaf: ['#5a8f44', '#3d6a38', '#294c30', '#1a3529', '#0f221f'],
    water: ['#a2b6ae', '#7d9a98', '#587a7c', '#3a5a60'], waterTint: '#47707a', waterTintA: 0.3, waterDark: 0.2,
    glintA: '#d3e1d8', glintB: '#eef4ee', ripple: '#c3d3cb', mist: '#d4e0d8', mistA: [0.12, 0.22], shafts: false, rain: true,
    leafCols: ['#8db84f', '#5f9444', '#7a8f45', '#5a7a3a'], bird: '#2a3a3d', birdFar: '#566a68',
    deer: { body: '#5c5444', belly: '#827a64', dark: '#38342a', back: '#4e4638', rump: '#9a937e', antler: '#463f33' }, vig: '#0c1a18', vigA: 0.55,
  },
];

function fogPal(p, haze, f) {
  return {
    wall: mixAll(p.wall, haze, f), dark: mix(p.dark, haze, f), glass: mixAll(p.glass, haze, f), lit: mix(p.lit, haze, f * 0.5),
    moss: mixAll(p.moss, haze, f), rust: mix(p.rust, haze, f),
  };
}
/* dithered translucent colour band, alpha rising from y0 to y1 (or falling if reversed) */
function fogBand(g, y0, y1, col, maxA, steps = 5) {
  const [r_, g_, b_] = [parseInt(col.slice(1, 3), 16), parseInt(col.slice(3, 5), 16), parseInt(col.slice(5, 7), 16)];
  const ya = Math.min(y0, y1), yb = Math.max(y0, y1);
  for (let lv = 1; lv <= steps; lv++) {
    g.fillStyle = 'rgba(' + r_ + ',' + g_ + ',' + b_ + ',' + (maxA * lv / steps).toFixed(3) + ')';
    for (let y = ya; y < yb; y++) {
      const t = clamp((y - y0) / (y1 - y0), 0, 1);
      for (let x = 0; x < W; x++) { if (Math.floor(t * steps + bay(x, y) / 16) === lv) g.fillRect(x, y, 1, 1); }
    }
  }
}

/* warm light raking across a facade: alpha rises horizontally x0->x1 and fades down y0->y1 */
function lightBand(g, x0, x1, y0, y1, col, maxA, steps = 5) {
  const [r_, g_, b_] = [parseInt(col.slice(1, 3), 16), parseInt(col.slice(3, 5), 16), parseInt(col.slice(5, 7), 16)];
  for (let lv = 1; lv <= steps; lv++) {
    g.fillStyle = 'rgba(' + r_ + ',' + g_ + ',' + b_ + ',' + (maxA * lv / steps).toFixed(3) + ')';
    for (let y = Math.min(y0, y1); y < Math.max(y0, y1); y++) { const ty = 1 - clamp((y - y0) / (y1 - y0), 0, 1); for (let x = Math.min(x0, x1); x < Math.max(x0, x1); x++) { const t = clamp((x - x0) / (x1 - x0), 0, 1) * ty; if (Math.floor(t * steps + bay(x, y) / 16) === lv) g.fillRect(x, y, 1, 1); } }
  }
}

export function create(seed = 1, variant = 0) {
  const PL = PAL[variant] || PAL[0];
  const calm = calmFn(105, 300, 0.32);
  const rnd = mulberry32(seed * 977 + variant);

  // ---------------------------------------------------------------- sky
  const SKY = layer(W, H, g => {
    gradV(0, 0, W, 262, PL.sky, 4); R(0, 262, W, H - 262, PL.sky[6]);
    if (PL.sun) {
      glow(SX, SY, 150, PL.glow, PL.glowA * 0.68, 6, 1.7);
      glow(SX, SY, 46, '#ffe9b0', 0.36, 5, 1.5);
      for (let y = -14; y <= 14; y++) for (let x = -14; x <= 14; x++) { const d = Math.hypot(x, y); if (d <= 10.5) P(SX + x, SY + y, d > 8.4 ? PL.sunRing : PL.sunCol); else if (d <= 12.5 && bay(SX + x, SY + y) < 7) P(SX + x, SY + y, PL.sunRing); }
    } else {
      glow(SX - 30, SY + 10, 190, PL.glow, PL.glowA, 5, 1.3);
    }
  });
  const clouds = [];
  for (let i = 0; i < PL.cloudN; i++) {
    const row = i % 3, w = [250, 170, 110][row] + Math.floor(rnd() * 40), h = [38, 26, 18][row];
    clouds.push({ spr: cloudSprite(w, h, seed * 5 + i * 3 + variant, PL.cloud), y: [8, 40, 78][row] + Math.floor(rnd() * 24), v: [3.2, 5, 7.5][row], x0: rnd() * 900, w });
  }

  // ---------------------------------------------------------------- far + mid city (hazy, calm)
  const hz = PL.haze, STY = ['grid', 'ribbon', 'curtain'];
  const farTow = [];
  { let x = -10; while (x < W) { const w = 12 + Math.floor(rnd() * 22); let top = 138 + Math.floor(rnd() * 92); if (x > 350 && x < 470) top = Math.max(top, 196); farTow.push({ x, w, top, st: STY[Math.floor(rnd() * 3)] }); x += w - 4 + Math.floor(rnd() * 10); } }
  const MID = [
    { x: 100, w: 42, top: 98, st: 'ribbon', collapse: { side: 'right', depth: 34, span: 0.55 }, crown: { dx: 6, w: 24, top: 70 } },
    { x: 148, w: 26, top: 150, st: 'curtain' }, { x: 180, w: 34, top: 180, st: 'grid' },
    { x: 238, w: 46, top: 120, st: 'curtain', torn: [{ x: 10, y: 28, w: 24, h: 34, see: true }] },
    { x: 290, w: 28, top: 82, st: 'ribbon', spire: true }, { x: 322, w: 38, top: 142, st: 'grid', collapse: { side: 'left', depth: 28, span: 0.5 } },
    { x: 364, w: 24, top: 172, st: 'curtain' },
    { x: 472, w: 48, top: 90, st: 'curtain', torn: [{ x: 8, y: 34, w: 26, h: 34, see: true }] }, { x: 522, w: 22, top: 150, st: 'ribbon' },
  ];
  const CAUSE = [[128, 204], [326, 436], [472, 546]];
  const FAR = layer(W, H, g => {
    for (const t of farTow) {
      drawTower(g, { x: t.x, w: t.w, top: t.top, bot: WY, jag: 9, seed: t.x + 3, pal: fogPal(PL, PL.sun ? '#86a9a0' : hz, 0.66), win: { sx: 5, sy: 7, ww: 2, wh: 3, x0: 2, y0: 5 }, pitch: 6, flip: t.x + t.w / 2 > SX, glow: 0.5, style: t.st, winC: 0.55 });
      if (rnd() > 0.5) { const f = foliage(t.w + 4, 9, mixAll(PL.leaf, hz, 0.74), t.x, { maxR: 4 }); g.drawImage(f, t.x - 2, t.top - 5); }
      if (rnd() > 0.7) R(t.x + (t.w >> 1), t.top - 10, 1, 10, mix(PL.wall[2], hz, 0.7));
    }
    fogBand(g, 150, 312, hz, 0.3);
    for (const m of MID) {
      const pal = fogPal(PL, hz, 0.36), wnd = m.st === 'grid' ? { sx: 7, sy: 9, ww: 3, wh: 5, x0: 3, y0: 6 } : { sx: 6, sy: 8, ww: 3, wh: 4, x0: 3, y0: 6 };
      if (m.crown) drawTower(g, { x: m.x + m.crown.dx, w: m.crown.w, top: m.crown.top, bot: m.top + 30, jag: 8, seed: m.x + 9, pal, win: wnd, pitch: 8, flip: m.x > SX, glow: 0.45, style: m.st, winC: 0.6 });
      drawTower(g, { x: m.x, w: m.w, top: m.top, bot: WY, jag: 12, seed: m.x, pal, win: wnd, pitch: 8, torn: m.torn, flip: m.x + m.w / 2 > SX, glow: 0.45, style: m.st, winC: 0.6, collapse: m.collapse });
      if (m.spire) { const sx = m.x + (m.w >> 1); R(sx, m.top - 22, 1, 22, pal.wall[2]); R(sx - 1, m.top - 8, 3, 1, pal.wall[2]); }
      const lp = mixAll(PL.leaf, hz, 0.4);
      g.globalCompositeOperation = 'source-atop'; ivy(m.x, m.top, m.w, 60, lp, m.x, (x, y) => 0.7 * (1 - smooth(0, 60, y)) + 0.06, 0.5); g.globalCompositeOperation = 'source-over';
      for (let k = 0; k < (m.w / 14 | 0); k++) { const cw = 12 + Math.floor(rnd() * 10), f = foliage(cw, 9, lp, m.x * 3 + k, { maxR: 4 }); g.drawImage(f, m.x + k * 14 - 2, m.top - 6 + Math.floor(rnd() * 3)); }
    }
    drawCrane(g, 392, WY, 150, 74, mix(PL.wall[2], hz, 0.5));
    // sun-washed: the towers that face the sun pick up warm light
    g.globalCompositeOperation = 'source-atop';
    glow(SX, SY + 60, 230, PL.warm, PL.sun ? 0.4 : 0.08, 5, 1.2);
    g.globalCompositeOperation = 'source-over';
    fogBand(g, 200, 312, hz, 0.32);
    // distant causeways: broken strips of green and rubble in the flooded street
    const bp = mixAll(PL.leaf, hz, 0.36);
    for (const [x0, x1] of CAUSE) {
      for (let x = x0; x < x1; x += 2) {
        const e = Math.min(x - x0, x1 - x) / 10, h = Math.max(1, Math.round((3 + fbm(x * 0.05, 4, seed, 3) * 6) * Math.min(1, e))), top = WY - h;
        R(x, top, 2, h + 2, mix(PL.bank, hz, 0.3)); R(x, top, 2, 1, bp[1]); if (hash(x, 1, seed) > 0.55) R(x, top - 1, 2, 1, bp[1]); if (hash(x, 2, seed) > 0.8) R(x, top + 1, 1, 1, bp[0]);
      }
      for (let k = 0; k < (x1 - x0) / 22; k++) { const f = foliage(14 + Math.floor(rnd() * 12), 10 + Math.floor(rnd() * 5), bp, 70 + k + x0, { maxR: 4 }); g.drawImage(f, x0 + 4 + k * 22 + Math.floor(rnd() * 6), WY - 14 - Math.floor(rnd() * 3)); }
    }
    for (const cx of [388, 480]) { R(cx, WY - 6, 13, 3, mix("#5a463a", hz, 0.45)); R(cx + 3, WY - 9, 7, 3, mix("#5a463a", hz, 0.45)); R(cx + 4, WY - 8, 5, 1, mix("#2a3a3c", hz, 0.4)); }
    fogBand(g, 236, 312, hz, 0.3);
  });
  // living greenery on the mid towers (fogged): the hero tree crowning the tower right of the sun, hanging vines
  const fogLeaf = mixAll(PL.leaf, hz, 0.3), fogVine = { stem: mixAll(PL.vine.stem, hz, 0.3), leaf: mixAll(PL.vine.leaf, hz, 0.3), flower: PL.vine.flower };
  const swayMid = [];
  swayMid.push({ spr: tree({ canopyW: 74, canopyH: 46, trunkH: 12, trunkW: 3, pal: fogLeaf, trunk: mixAll(PL.trunk, hz, 0.3), seed: 17, lean: -4, branches: 3 }), x: 472 + 24 - 42, y: 90 + 2 - 12 - 38 - 0, o: { amp: 3, anchor: 'bottom', phase: 1.2, pow: 1.1 } });
  swayMid.push({ spr: vineCurtain(18, 64, fogVine, 61, { band: 4 }), x: 470, y: 91, o: { amp: 4, anchor: 'top', phase: 2 } });
  swayMid.push({ spr: vineCurtain(16, 40, fogVine, 62, { band: 4 }), x: 498, y: 97, o: { amp: 4, anchor: 'top', phase: 2.5 } });
  swayMid.push({ spr: vineCurtain(22, 50, fogVine, 63, { band: 4 }), x: 102, y: 105, o: { amp: 4, anchor: 'top', phase: 0.6 } });
  swayMid.push({ spr: tree({ canopyW: 40, canopyH: 28, trunkH: 8, trunkW: 2, pal: fogLeaf, trunk: mixAll(PL.trunk, hz, 0.3), seed: 18, lean: 3, branches: 2 }), x: 290 + 14 - 25, y: 82 - 8 - 22, o: { amp: 3, anchor: 'bottom', phase: 0.4, pow: 1.1 } });
  swayMid.push({ spr: tree({ canopyW: 36, canopyH: 24, trunkH: 8, trunkW: 2, pal: fogLeaf, trunk: mixAll(PL.trunk, hz, 0.3), seed: 19, lean: -2, branches: 2 }), x: 238 + 30 - 23, y: 120 - 8 - 18, o: { amp: 3, anchor: 'bottom', phase: 3.4, pow: 1.1 } });

  // ---------------------------------------------------------------- near giants
  let profL = null, profR = null;
  const LT = { x: -22, w: 142, top: 64 }, RT = { x: 538, w: 124, top: 24 };
  const NEAR = layer(W, H, g => {
    profL = drawTower(g, { x: LT.x, w: LT.w, top: LT.top, bot: WY + 2, jag: 16, seed: 21, pal: PL, win: { sx: 8, sy: 12, ww: 4, wh: 7, x0: 4, y0: 10 }, pitch: 11, torn: [{ x: 58, y: 54, w: 54, h: 66, see: false }], flip: false, style: 'ribbon', winC: 0.6, collapse: { side: 'right', depth: 34, span: 0.34 } });
    profR = drawTower(g, { x: RT.x, w: RT.w, top: RT.top, bot: WY + 2, jag: 14, seed: 55, pal: PL, win: { sx: 9, sy: 11, ww: 4, wh: 6, x0: 4, y0: 10 }, pitch: 11, torn: [{ x: 8, y: 66, w: 56, h: 74, see: true }], flip: true, style: 'curtain', winC: 0.6, collapse: { side: 'left', depth: 40, span: 0.36 } });
    g.globalCompositeOperation = 'source-atop';
    const lp = PL.leaf, edge = (w, k) => (x => Math.max(0, 1 - Math.min(x, w - x) / k));
    for (const [T, prof, sd] of [[LT, profL, 5], [RT, profR, 9]]) {
      ivy(T.x, T.top - 6, T.w, 150, lp, sd, (x, y) => 0.88 * (1 - smooth(6, 120, y)) + 0.14 + 0.5 * edge(T.w, 14)(x), 0.5);
      ivy(T.x, T.top + 150, T.w, 160, lp, sd + 3, (x, y) => 0.3 * smooth(0, 160, y) + 0.6 * edge(T.w, 12)(x) + 0.22, 0.5);
    }
    g.globalCompositeOperation = 'source-over';
    // static foliage fringe along the broken lip (the trees + vines on top of it sway)
    for (const [T, prof] of [[LT, profL], [RT, profR]]) for (let i = 2; i < T.w - 6; i += 8) { const f = foliage(14 + Math.floor(rnd() * 12), 9 + Math.floor(rnd() * 6), lp, T.x + i, { maxR: 4 }); g.drawImage(f, T.x + i - 7, prof[i] - 6); }
    // calm the middle of the big facades: a green-grey haze veil (the top and the base keep their detail)
    g.globalCompositeOperation = 'source-atop';
    fogBand(g, 112, 200, mix(PL.dark, hz, 0.4), 0.36, 4);
    lightBand(g, LT.x + 40, LT.x + LT.w, 70, 230, PL.warm, PL.sun ? 0.34 : 0.05, 5);
    lightBand(g, RT.x + 90, RT.x, 40, 250, PL.warm, PL.sun ? 0.34 : 0.05, 5);
    g.globalCompositeOperation = 'source-over';
  });

  // ---------------------------------------------------------------- sway sprites on the near towers
  const sway = [];
  const addCur = (prof, tx, i, w, h, s, amp) => sway.push({ spr: vineCurtain(w, h, PL.vine, s, { band: 6 }), x: tx + i - (w >> 1), y: prof[clamp(i, 0, prof.length - 1)] - 1, o: { amp, anchor: 'top', phase: s * 0.7 } });
  for (const [i, w, h, s] of [[8, 22, 70, 1], [28, 26, 54, 2], [50, 18, 92, 3], [72, 24, 40, 4], [96, 20, 60, 5], [118, 18, 46, 11], [136, 18, 70, 12]]) addCur(profL, LT.x, i, w, h, s, 5);
  for (const [i, w, h, s] of [[4, 20, 62, 6], [26, 28, 48, 7], [52, 24, 84, 8], [78, 22, 56, 9], [100, 22, 70, 10], [118, 18, 50, 13]]) addCur(profR, RT.x, i, w, h, s, 5);
  sway.push({ spr: vineCurtain(40, 36, PL.vine, 31, { band: 3 }), x: LT.x + 60, y: LT.top + 54 + 8, o: { amp: 4, anchor: 'top', phase: 2 } });
  sway.push({ spr: vineCurtain(36, 40, PL.vine, 32, { band: 3 }), x: RT.x + 12, y: RT.top + 66 + 10, o: { amp: 4, anchor: 'top', phase: 3 } });
  const trees = [];
  const addTree = (prof, tx, i, cw, ch, th, s, lean) => { const spr = tree({ canopyW: cw, canopyH: ch, trunkH: th, trunkW: 3, pal: PL.leaf, trunk: PL.trunk, seed: s, lean, branches: 3 }); trees.push({ spr, x: tx + i - (spr.width >> 1), y: prof[i] + 3 - spr.height, o: { amp: 3, anchor: 'bottom', phase: s * 0.4, pow: 1.1 } }); };
  addTree(profL, LT.x, 24, 60, 38, 14, 1, 4); addTree(profL, LT.x, 88, 46, 30, 12, 2, -3); addTree(profL, LT.x, 124, 34, 24, 8, 3, 2);
  addTree(profR, RT.x, 20, 40, 28, 10, 4, 3); addTree(profR, RT.x, 72, 66, 40, 16, 5, -3); addTree(profR, RT.x, 110, 40, 26, 8, 6, 2);
  const sign = signSprite({ chain: '#2b3032', board: '#6d5a40', edge: '#8c7a58', shade: '#3c3226', paint: '#b9ad82', rust: '#7a4a2b' }, 4);
  const signPivot = [LT.x + 70, LT.top + 54 + 6];

  // ---------------------------------------------------------------- shore: banks, rubble, vehicles, green
  const tuftPal = [PL.leaf[0], PL.leaf[2], PL.leaf[3], PL.leaf[4]];
  const gTufts = [0, 1, 2, 3].map(k => grassTuft(34, 16 + k * 3, tuftPal, 50 + k, { dens: 1.2, flowers: ['#e6dc9c', '#dcdccb', '#a9bfd6'] }));
  const ferns = [0, 1, 2].map(k => fern(34, 24 + k * 4, PL.leaf, 60 + k, 7));
  const SHORE = layer(W, H, g => {
    const earth = PL.earth, B = WY + 13;
    const mounds = [{ x0: -5, x1: 174, top: [[-5, 288], [30, 291], [70, 296], [110, 293], [150, 298], [174, 306]] }, { x0: 486, x1: 645, top: [[486, 306], [505, 300], [540, 293], [580, 290], [645, 289]] }];
    const topAt = (m, x) => { const p = m.top; for (let i = 0; i < p.length - 1; i++) if (x <= p[i + 1][0]) return p[i][1] + (p[i + 1][1] - p[i][1]) * (x - p[i][0]) / (p[i + 1][0] - p[i][0]); return p[p.length - 1][1]; };
    for (const m of mounds) { FPOLY([...m.top, [m.x1, B], [m.x0, B]], earth); for (let x = m.x0; x < m.x1; x++) { const t0 = Math.round(topAt(m, x)); P(x, t0, mix(earth, PL.leaf[2], 0.6)); if (hash(x, 3, seed) > 0.6) P(x, t0 + 1 + Math.floor(hash(x, 4, seed) * 3), mix(earth, PL.dark, 0.4)); P(x, B - 1, mix(earth, PL.water[0], 0.4)); } }
    // half-sunk cars in the flooded street: clipped at the waterline
    for (const [cx, len, hh, fl_, sd] of [[236, 70, 24, false, 12], [446, 60, 20, true, 14]]) {
      g.save(); g.beginPath(); g.rect(0, 0, W, WY + 5); g.clip(); drawCar(cx, WY + 20, { len, h: hh, pal: PL.car, seed: sd, flip: fl_ }); g.restore();
      for (let x = cx; x < cx + len; x++) if (hash(x, 5, seed) > 0.35) P(x, WY + 5, mix(PL.water[0], '#ffffff', 0.25));
    }
    const place = (m, x0, x1) => { for (let x = x0; x < x1; x += 6 + Math.floor(rnd() * 8)) { const k = Math.floor(rnd() * 4), yb = Math.round(topAt(m, x)) + 4; g.drawImage(gTufts[k], x, yb - gTufts[k].height + Math.floor(rnd() * 3)); if (rnd() > 0.55) { const f = ferns[Math.floor(rnd() * 3)]; g.drawImage(f, x - 6, yb - f.height + 3); } } };
    place(mounds[0], -8, 176); place(mounds[1], 486, 650);
    drawCar(50, 302, { len: 74, h: 21, pal: PL.car, seed: 6 });
    drawCar(516, 300, { len: 84, h: 25, pal: PL.car, seed: 9, flip: true });
    for (const [x0, x1, yb] of [[52, 126, 306], [518, 600, 304]]) for (let x = x0; x < x1; x += 9 + Math.floor(rnd() * 8)) { const k = Math.floor(rnd() * 4); g.drawImage(gTufts[k], x, yb - gTufts[k].height + Math.floor(rnd() * 3)); }
    for (const [x0, x1] of [[240, 300], [448, 500]]) for (let x = x0; x < x1; x += 8 + Math.floor(rnd() * 8)) { const k = Math.floor(rnd() * 4); g.drawImage(gTufts[k], x, WY + 3 - gTufts[k].height + Math.floor(rnd() * 3)); }
    for (const [x, y] of [[8, 282], [118, 284], [560, 280], [610, 280], [258, 274]]) { const f = foliage(26 + Math.floor(rnd() * 14), 14 + Math.floor(rnd() * 6), PL.leaf, x + y, { maxR: 5, flat: 0.8 }); g.drawImage(f, x, y); }
    const fl = ['#e6dc9c', '#dcdccb', '#a9bfd6', '#d3b05a'];
    const snap = g.getImageData(0, 0, W, H);
    for (let k = 0; k < 80; k++) { const x = Math.floor(rnd() * W), y = 282 + Math.floor(rnd() * 26); const px = snap.data, o4 = (y * W + x) * 4; if (px[o4 + 3] > 200 && px[o4 + 1] > px[o4] + 10) P(x, y, fl[k % fl.length]); }
  });
  const grassL = grassTuft(70, 24, PL.leaf, 3, { dens: 1.1, flowers: ['#e6dc9c', '#dcdccb', '#a9bfd6'] }), grassR = grassTuft(80, 28, PL.leaf, 4, { dens: 1.1, flowers: ['#e6dc9c', '#dcdccb', '#a9bfd6'] });
  const reeds = grassTuft(44, 44, PL.fgLeaf, 9, { dens: 0.5, lean: 5 }), fgFern = fern(48, 40, PL.fgLeaf, 77, 8);

  // ---------------------------------------------------------------- water (mirror of everything static above)
  const REFL = mirrorSource(g => { g.drawImage(SKY, 0, 0); g.drawImage(FAR, 0, 0); g.drawImage(NEAR, 0, 0); g.drawImage(SHORE, 0, 0); }, WY, H - WY, PL.waterTint, PL.waterTintA, PL.waterDark);
  const WBASE = layer(W, H - WY, () => { gradV(0, 0, W, H - WY, PL.water, 4); if (PL.sun) glow(SX, 6, 200, PL.warm, 0.42, 6, 1.3, 0.34); });

  // ---------------------------------------------------------------- god rays
  const shafts = [];
  if (PL.shafts) {
    const mk = (ang, w0, spread, len, a) => shafts.push({ ox: SX - 4, oy: SY + 4, ang, w0, spread, len, a, ph: shafts.length * 1.7, mask: (x, y) => 1 - 0.5 * smooth(140, 185, y) * (1 - smooth(250, 300, y)) });
    mk(1.78, 10, 0.16, 330, 0.9); mk(2.4, 30, 0.2, 700, 0.5); mk(2.75, 22, 0.22, 720, 0.4); mk(2.05, 12, 0.2, 440, 0.85); mk(2.34, 8, 0.15, 480, 0.8); mk(2.62, 14, 0.18, 430, 0.6); mk(1.5, 8, 0.12, 300, 0.6); mk(2.9, 10, 0.16, 400, 0.5); mk(1.22, 8, 0.12, 250, 0.4);
    for (const s of shafts) s.fs = fast(s.spr = shaftLayer(s, '#ffe3a2', 0.34));
  }
  const mistA = mistSprite(W, 70, seed, PL.mist, PL.mistA[0], PL.mistA[1]), mistB = mistSprite(W, 56, seed + 4, PL.mist, PL.mistA[0], PL.mistA[1], 0.016, 0.09);
  const fgTop = [
    { spr: foliage(190, 54, PL.fgLeaf, 71, { maxR: 9 }), x: -50, y: -26 }, { spr: foliage(160, 44, PL.fgLeaf, 72, { maxR: 8 }), x: 520, y: -24 },
  ];
  const fgVine = { stem: [PL.fgLeaf[3], PL.fgLeaf[2]], leaf: [PL.fgLeaf[1], PL.fgLeaf[2], PL.fgLeaf[3]] };
  const fgCurt = [vineCurtain(26, 50, fgVine, 41, { band: 4 }), vineCurtain(22, 44, fgVine, 42, { band: 4 })];
  const VIG = vignetteLayer(PL.vig, PL.vigA);
  const birdsPerch = [[LT.x + 40, profL[40] + 1], [LT.x + 100, profL[100] + 1], [RT.x + 40, profR[40] + 1], [474 + 14, 88 + 3]];
  const deerCol = { ...PL.deer }; for (const k in deerCol) deerCol[k] = mix(deerCol[k], hz, 0.28);
  const rippleSrc = [[120, 20, 0], [300, 12, 900], [470, 30, 1700], [560, 22, 2400], [60, 38, 600]];

  const FARF = fast(FAR), NEARF = fast(NEAR), SHOREF = fast(SHORE), VIGF = fast(VIG);
  // the rays are pre-summed into 2 groups x 3 intensity levels (additive blending is the costly part of a frame, and alpha makes it costlier)
  const shaftGroups = [0, 1].map(k => [0.62, 0.82, 1].map(a => { const c = mkCanvas(W, H), gg = c.getContext('2d'); gg.globalCompositeOperation = 'lighter'; gg.globalAlpha = a; shafts.forEach((s, i) => { if (i % 2 === k) gg.drawImage(s.spr, 0, 0); }); return fast(c); }));
  function deerHead(t, off) { const c = ((t / 1000 + off) % 16 + 16) % 16; if (c < 9) return 0.05 + 0.05 * Math.sin(t * 0.004 + off); if (c < 10) return (c - 9) * 0.95; if (c < 13) return 1; if (c < 14) return 1 - (c - 13); return 0.05; }

  function draw(g, t) {
    g.imageSmoothingEnabled = false; use(g);
    g.drawImage(SKY, 0, 0);
    for (const c of clouds) { const span = W + c.w + 40, x = Math.round(((c.x0 + t * c.v / 1000) % span) - c.w - 20); g.drawImage(c.spr, x, c.y); }
    FARF.draw(g);
    for (const s of swayMid) swaySprite(g, s.spr, s.x, s.y, t, s.o);
    deerGraze(g, t);
    flock(g, t, { y: 84, n: 9, col: PL.birdFar, seed: 5, t0: 3000, cycle: 44000, dur: 17000, rise: 14 });
    perched(g, t, birdsPerch, PL.bird, 38000, seed);
    NEARF.draw(g);
    for (const s of sway) swaySprite(g, s.spr, s.x, s.y, t, s.o);
    for (const s of trees) swaySprite(g, s.spr, s.x, s.y, t, s.o);
    g.fillStyle = '#2b3032'; g.fillRect(signPivot[0] - 14, signPivot[1] - 1, 30, 2);
    drawSwing(g, sign, 2, 0, signPivot[0] - 6, signPivot[1] + 1, Math.sin(t * 0.0012 + 1) * 0.18 + wind(signPivot[0], t) * 0.08);
    drawCable(g, t, RT.x + 24, RT.top + 66 + 12, RT.x + 30, RT.top + 66 + 62, 6, '#1b2326', 3.5, 1);
    drawCable(g, t, LT.x + 120, LT.top + 80, LT.x + 128, LT.top + 150, 4, '#1b2326', 2.5, 4);
    g.drawImage(WBASE, 0, WY);
    drawWater(g, t, REFL, WY, H - WY, { alpha: 0.8 });
    waterSparkle(g, t, { wy: WY, rows: H - WY, seed: 2, n: PL.sun ? 46 : 22, sx: SX, spread: PL.sun ? 150 : 520, hi: PL.glintB, col: PL.glintA, a: 0.85 });
    ripples(g, t, rippleSrc, WY, PL.ripple, 3400, 12);
    SHOREF.draw(g);
    swaySprite(g, grassL, 40, 278, t, { amp: 3, anchor: 'bottom', phase: 1 }); swaySprite(g, grassR, 520, 272, t, { amp: 3, anchor: 'bottom', phase: 2 });
    swaySprite(g, grassL, 130, 284, t, { amp: 3, anchor: 'bottom', phase: 3 }); swaySprite(g, grassR, 590, 266, t, { amp: 3, anchor: 'bottom', phase: 5 });
    if (shafts.length) {
      g.globalCompositeOperation = 'lighter';
      if (shafts.length) for (let k = 0; k < 2; k++) { const v = 0.5 + 0.5 * Math.sin(t * 0.00055 + k * 2.1); shaftGroups[k][Math.min(2, Math.floor(v * 3))].draw(g); }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      motes(g, t, shafts, { n: 54, seed: 3, col: '#fff0c4', calm, a: 0.85 });
    }
    drawTiled(g, mistA, 262, t, 4, 0); drawTiled(g, mistB, 296, t, -7, 120);
    leaves(g, t, { n: PL.rain ? 10 : 16, seed: 8, cols: PL.leafCols, calm, drift: 80 });
    for (const f of fgTop) g.drawImage(f.spr, f.x, f.y);
    swaySprite(g, fgCurt[0], 24, 14, t, { amp: 5, anchor: 'top', phase: 0.3 }); swaySprite(g, fgCurt[1], 560, 12, t, { amp: 5, anchor: 'top', phase: 1.1 });
    swaySprite(g, reeds, -6, H - 44, t, { amp: 4, anchor: 'bottom', phase: 0.5 }); swaySprite(g, reeds, 604, H - 44, t, { amp: 4, anchor: 'bottom', phase: 2.5 });
    swaySprite(g, fgFern, 24, H - 38, t, { amp: 3, anchor: 'bottom', phase: 0.9 }); swaySprite(g, fgFern, 570, H - 38, t, { amp: 3, anchor: 'bottom', phase: 1.9 });
    if (PL.rain) rain(g, t, { n: 120, seed: 4, col: '#d6e4de', a: 0.5, calm: y => 0.35 + 0.65 * (1 - calm(y)) });
    VIGF.draw(g);
  }
  function deerGraze(g, t) {
    drawDeerC(g, 352, WY - 6, { col: deerCol, dir: -1, head: deerHead(t, 0), antlers: true });
    drawDeerC(g, 374, WY - 6, { col: deerCol, dir: -1, head: deerHead(t, 5.5) });
    // one deer ambles back and forth along the left causeway, pausing now and then
    const L = 48, sp = 0.006, cyc = 2 * (L / sp + 4000), tt = (t + 9000) % cyc; let dx, dir, walking = true;
    if (tt < 4000) { dx = 0; dir = 1; walking = false; } else if (tt < 4000 + L / sp) { dx = (tt - 4000) * sp; dir = 1; } else if (tt < 8000 + L / sp) { dx = L; dir = -1; walking = false; } else { dx = L - (tt - 8000 - L / sp) * sp; dir = -1; }
    drawDeerC(g, 138 + Math.round(dx), WY - 5, { col: deerCol, dir, head: walking ? 0.5 : deerHead(t, 2), walk: walking ? t * 0.007 : null });
  }
  const scene = { id, name, variant, variantName: variants[variant] || variants[0], variants, draw };
  { const wc = mkCanvas(W, H), wg = wc.getContext('2d'); for (const tt of [0, 5000]) draw(wg, tt); }   // warm every lazily baked frame once
  return scene;
}
