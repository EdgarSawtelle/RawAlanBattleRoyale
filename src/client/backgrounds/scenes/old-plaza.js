// ============================================================================
//  old-plaza - a once-busy city square: arcaded facades, a clock tower, a dry fountain with a statue,
//  a derelict tram, grass through the paving, deer crossing, pigeons, and (rarely) a giraffe far off.
//  Variants: 0 golden afternoon, 1 foggy dawn.
//  Interface: create(seed, variant) -> { id, name, variantName, draw(ctx, timeMs) }
// ============================================================================
import {
  W, H, use, P, R, LN, FPOLY, ELLpx, hash, mulberry32, bay, TAU, layer, mix, mixAll, clamp, fbm, smooth,
  gradV, glow, shaftLayer, cloudSprite, mistSprite, drawTiled, flock, bird, leaves, motes, mirrorSource, vignetteLayer, calmFn, swaySprite, wind, fast, mkCanvas,
} from '../lib.js';
import { foliage, tree, vineCurtain, grassTuft, fern, ivy, drawTower, drawDeerC, drawGiraffeC, drawPigeonC, drawSwing, signSprite, drawCable } from '../art.js';

export const id = 'old-plaza';
export const name = 'Old Plaza';
export const variants = ['golden afternoon', 'foggy dawn'];

const GY = 304;                        // ground line of the near facades / fountain
const SX = 560, SY = 70;               // sun, behind the right-hand facade

const PAL = [
  {
    sky: ['#4a8795', '#78aba7', '#b2c9ac', '#ead8a2', '#f1c878'], haze: '#b4bd96', warm: '#f6d68c', glowA: 0.5, sun: true,
    cloud: { hi: '#f4d28f', mid: '#a9c4ae', lo: '#5f8e90' }, cloudN: 6,
    wall: ['#d6c48e', '#a4986f', '#5f6552'], dark: '#1b2926', glass: ['#2b4647', '#7aa597'], lit: '#f6dc96', moss: ['#b2c65a', '#729a40', '#40673a'], rust: '#8e5535', brick: ['#a06c4f', '#78503c'],
    wallR: ['#8a8d68', '#566853', '#2f3f38'],
    leaf: ['#b8cf5e', '#82b04a', '#52803e', '#325a38', '#1c3c33'], trunk: ['#7a6548', '#4f4132', '#2f281f'],
    vine: { stem: ['#2b4a30', '#41663a'], leaf: ['#a8c456', '#66963f', '#3a6339'], flower: ['#eadfa6', '#dcd9c6', '#a4bbd6'] },
    stone: ['#e0d2a2', '#b3a77e', '#6c6a52'], pave: ['#76836a', '#5f6c56', '#46533f'],
    tram: { body: ['#c4bc8a', '#98a67c', '#566b58'], rust: '#8b5232', glass: '#203638', glint: '#86b4aa', dark: '#25302e', roof: ['#8f9a80', '#667564', '#47564a'] },
    shaft: '#ffe5a0', shaftA: 0.24, mist: '#ecdc9e', mistA: [0.05, 0.1], vig: '#0d1a15', vigA: 0.5, rain: false,
    deer: { body: '#6f6044', belly: '#978660', dark: '#463b2a', back: '#5f5139', rump: '#b09e7c', antler: '#4a4030' }, giraffe: { body: '#a58a56', belly: '#bba978', dark: '#5d4e32', spot: '#7a6840' },
    pigeon: { body: '#6c7478', belly: '#8e9694', dark: '#3c4448' }, leafCols: ['#a9bd55', '#7a9a42', '#c3a850', '#9b7a3c'], bird: '#2a3a3c', fgLeaf: ['#5e8a3d', '#41683a', '#2c4b2f', '#1b3528', '#0f221d'],
  },
  {
    sky: ['#7b9fa4', '#a1bcb4', '#c4d3c4', '#dbe1cf', '#e3e6d0'], haze: '#bcc9bd', warm: '#e8e6c6', glowA: 0.22, sun: false,
    cloud: { hi: '#d4dccd', mid: '#a9bdb8', lo: '#7a9498' }, cloudN: 8,
    wall: ['#b6b898', '#8c9078', '#565d50'], dark: '#19262a', glass: ['#2a4547', '#7fa49a'], lit: '#cfd2ae', moss: ['#a3c85a', '#68a042', '#3a6a3a'], rust: '#7d4c34', brick: ['#8c6650', '#6a4a3a'],
    wallR: ['#858f7e', '#5d6c5f', '#36443e'],
    leaf: ['#a2c75e', '#6aa249', '#437f3f', '#2c5a38', '#1a3b33'], trunk: ['#6a5c4a', '#463d33', '#2b2620'],
    vine: { stem: ['#2b4a30', '#3f6638'], leaf: ['#9ec65a', '#64a043', '#386a3a'], flower: ['#e0e2c4', '#cfd9d6', '#9db7d2'] },
    stone: ['#cdcfb4', '#9aa28c', '#5d6a60'], pave: ['#74817a', '#5d6a62', '#44524a'],
    tram: { body: ['#b2b496', '#8a9a80', '#53665c'], rust: '#7d4c34', glass: '#1d3436', glint: '#7aa6a0', dark: '#22302f', roof: ['#8a9588', '#637263', '#45544b'] },
    shaft: '#f0f0d0', shaftA: 0.1, mist: '#dfe9e0', mistA: [0.13, 0.24], vig: '#0c1a18', vigA: 0.5, rain: false,
    deer: { body: '#5c5444', belly: '#827a64', dark: '#38342a', back: '#4e4638', rump: '#9a937e', antler: '#463f33' }, giraffe: { body: '#9a8a64', belly: '#b4a888', dark: '#5a4e38', spot: '#74663f' },
    pigeon: { body: '#68737a', belly: '#8d979a', dark: '#3a444a' }, leafCols: ['#8db84f', '#5f9444', '#7a8f45', '#5a7a3a'], bird: '#2d3d40', fgLeaf: ['#5a8f44', '#3d6a38', '#294c30', '#1a3529', '#0f221f'],
  },
];
function band(g, y0, y1, col, maxA, steps = 5) {
  const [r_, g_, b_] = [parseInt(col.slice(1, 3), 16), parseInt(col.slice(3, 5), 16), parseInt(col.slice(5, 7), 16)];
  for (let lv = 1; lv <= steps; lv++) {
    g.fillStyle = 'rgba(' + r_ + ',' + g_ + ',' + b_ + ',' + (maxA * lv / steps).toFixed(3) + ')';
    for (let y = Math.min(y0, y1); y < Math.max(y0, y1); y++) { const t = clamp((y - y0) / (y1 - y0), 0, 1); for (let x = 0; x < W; x++) if (Math.floor(t * steps + bay(x, y) / 16) === lv) g.fillRect(x, y, 1, 1); }
  }
}
function fogP(p, haze, f) { return { wall: mixAll(p.wall, haze, f), dark: mix(p.dark, haze, f), glass: mixAll(p.glass, haze, f), lit: mix(p.lit, haze, f * 0.5), moss: mixAll(p.moss, haze, f), rust: mix(p.rust, haze, f) }; }

export function create(seed = 1, variant = 0) {
  const PL = PAL[variant] || PAL[0], hz = PL.haze, rnd = mulberry32(seed * 521 + variant * 11 + 3), calm = calmFn(105, 300, 0.3);

  const SKY = layer(W, H, g => {
    gradV(0, 0, W, 250, PL.sky, 4); R(0, 250, W, 120, PL.sky[4]);
    if (PL.sun) { glow(SX, SY, 220, PL.warm, PL.glowA, 6, 1.5); glow(SX, SY, 50, '#fff0c0', 0.5, 5, 1.4); for (let y = -12; y <= 12; y++) for (let x = -12; x <= 12; x++) { const d = Math.hypot(x, y); if (d <= 9.5) P(SX + x, SY + y, d > 7.5 ? '#f8d98f' : '#fff3cc'); } }
    else glow(480, 90, 260, PL.warm, PL.glowA, 5, 1.3);
  });
  const clouds = [];
  for (let i = 0; i < PL.cloudN; i++) { const row = i % 3, w = [240, 160, 110][row] + Math.floor(rnd() * 40), h = [36, 24, 16][row]; clouds.push({ spr: cloudSprite(w, h, seed * 7 + i * 3 + variant, PL.cloud), y: [8, 36, 70][row] + Math.floor(rnd() * 24), v: [3, 4.6, 7][row], x0: rnd() * 900, w }); }

  // ---------------------------------------------------------------- far city + clock tower (hazy)
  const FARC = layer(W, H, g => {
    let x = -10; while (x < W) { const w = 14 + Math.floor(rnd() * 24), top = 150 + Math.floor(rnd() * 70); drawTower(g, { x, w, top: x > 250 && x < 460 ? Math.max(top, 190) : top, bot: 250, jag: 8, seed: x + 5, pal: fogP(PL, hz, 0.7), win: { sx: 5, sy: 7, ww: 2, wh: 3, x0: 2, y0: 5 }, pitch: 6, flip: x > SX - 200, glow: 0.4, winC: 0.5 }); x += w - 3 + Math.floor(rnd() * 8); }
    band(g, 160, 252, hz, 0.35);
    { const dp = fogP(PL, hz, 0.5), cx = 296; drawTower(g, { x: cx - 24, w: 48, top: 176, bot: 250, jag: 3, seed: 77, pal: dp, win: { sx: 8, sy: 12, ww: 3, wh: 7, x0: 4, y0: 6 }, flip: false, winC: 0.6 });
      for (let y = -22; y <= 0; y++) for (let x = -23; x <= 23; x++) { if ((x / 23) ** 2 + (y / 22) ** 2 > 1) continue; const f = (x / 23) * 0.6 - (y / 22) * 0.3 + 0.35, c = f > 0.75 ? dp.wall[0] : f > 0.35 ? dp.wall[1] : dp.wall[2]; P(cx + x, 176 + y, (x + y) % 5 === 0 ? dp.wall[2] : c); }
      R(cx - 3, 144, 6, 10, dp.wall[1]); R(cx - 1, 134, 2, 10, dp.wall[2]); P(cx, 132, dp.lit); R(cx - 1, 150, 1, 4, dp.wall[0]);
      g.globalCompositeOperation = 'source-atop'; ivy(cx - 24, 150, 48, 50, mixAll(PL.leaf, hz, 0.4), 12, (x, y) => 0.4, 0.5); g.globalCompositeOperation = 'source-over'; }
    // the clock tower: slender, broken-topped, a tree on its shoulder
    const tp = fogP(PL, hz, 0.38);
    drawTower(g, { x: 384, w: 34, top: 74, bot: 250, jag: 6, seed: 9, pal: tp, win: { sx: 9, sy: 14, ww: 3, wh: 8, x0: 5, y0: 40 }, pitch: 17, flip: false, winC: 0.6, collapse: { side: 'right', depth: 10, span: 0.4 } });
    drawTower(g, { x: 390, w: 22, top: 38, bot: 80, jag: 4, seed: 10, pal: tp, win: { sx: 8, sy: 10, ww: 3, wh: 5, x0: 3, y0: 8 }, flip: false, winC: 0.6, collapse: { side: 'right', depth: 12, span: 0.5 } });
    // clock face
    const cx = 401, cy = 96; for (let y = -9; y <= 9; y++) for (let x = -9; x <= 9; x++) { const d = Math.hypot(x, y); if (d <= 8.5) P(cx + x, cy + y, d > 7 ? tp.wall[2] : '#cfd2b4'); }
    LN(cx, cy, cx + 1, cy - 6, tp.dark, 1); LN(cx, cy, cx + 5, cy + 2, tp.dark, 1); P(cx, cy, tp.dark);
    for (const [x0, y0] of [[0, -7], [7, 0], [0, 7], [-7, 0]]) P(cx + x0, cy + y0, tp.dark);
    g.globalCompositeOperation = 'source-atop'; ivy(384, 40, 34, 120, mixAll(PL.leaf, hz, 0.35), 5, (x, y) => 0.5 * (1 - smooth(0, 80, y)) + 0.1, 0.5); g.globalCompositeOperation = 'source-over';
    band(g, 205, 252, hz, 0.4);
    // distant avenue pavement strip behind the square
    R(0, 249, W, 6, mix(PL.pave[0], hz, 0.55));
  });
  const clockTree = tree({ canopyW: 30, canopyH: 20, trunkH: 6, trunkW: 2, pal: mixAll(PL.leaf, hz, 0.34), trunk: mixAll(PL.trunk, hz, 0.34), seed: 91, lean: 2, branches: 2 });
  const GIR = { cyc: 78000, dur: 48000, x0: 196, x1: 462 };

  // ---------------------------------------------------------------- the square itself: paving in perspective
  const GROUND = layer(W, H, g => {
    for (let y = 252; y < H; y++) {
      const f = (y - 252) / (H - 252);
      for (let x = 0; x < W; x++) {
        const rowH = 4 + f * f * 22, row = Math.floor(Math.pow(f, 1.0) * 14), vx = (x - 320) * (0.55 + f * 1.5), col = Math.floor(vx / 18);
        const seam = ((Math.floor(y * 0.18 / (0.4 + f) + row * 0.0) % 1) === 0) && false;
        let c = PL.pave[1]; const n = hash(col, Math.floor((y - 252) / (3 + f * 12)), seed);
        c = n > 0.7 ? mix(PL.pave[1], PL.pave[0], 0.4) : n < 0.25 ? mix(PL.pave[1], PL.pave[2], 0.4) : PL.pave[1];
        if (hash(x, y, seed + 2) > 0.93) c = mix(PL.pave[1], PL.pave[n > 0.5 ? 0 : 2], 0.5);
        P(x, y, c);
      }
    }
    // joints (rows narrower in the distance, columns converging)
    g.fillStyle = mix(PL.pave[2], '#000000', 0.08);
    for (let k = 0, yy = 254; yy < H; k++) { g.fillRect(0, Math.round(yy), W, 1); yy += 3 + Math.pow(k, 1.25) * 0.9; }
    for (let i = -20; i <= 20; i++) { for (let y = 254; y < H; y += 1) { const f = (y - 252) / (H - 252), x = Math.round(320 + i * (16 + f * 46)); if (x >= 0 && x < W && ((y + i * 3) % 3 !== 0)) g.fillRect(x, y, 1, 1); } }
    // moss-filled cracks and grass sprouting between the stones
    for (let k = 0; k < 520; k++) { const y = 254 + Math.floor(Math.pow(rnd(), 0.8) * (H - 254)), x = Math.floor(rnd() * W), s = 1 + Math.floor((y - 252) / 40); R(x, y, 1 + s, 1, rnd() > 0.5 ? PL.moss[1] : PL.moss[2]); if (rnd() > 0.7) P(x, y - 1, PL.moss[0]); }
    band(g, 252, 290, hz, 0.46);     // distance haze over the far paving
  });

  // ---------------------------------------------------------------- arcaded facades
  function arcade(g, o) {
    const { x, w, top, base, seed: sd, pal, flip } = o, AH = 50, gTop = base - AH, fl = flip;
    // upper storeys (a tower body with tall windows), then the arcade below
    const wallPal = { ...pal, wall: o.wallPal };
    const prof = drawTower(g, { x, w, top, bot: base, jag: o.jag || 10, seed: sd, pal: wallPal, win: { sx: 26, sy: 30, ww: 10, wh: 19, x0: 8, y0: 20 }, pitch: 26, flip: fl, glow: 0.4, winC: 0.78, collapse: o.collapse, torn: o.torn, rim: true });
    // arched heads, shutters and lintels on the tall windows
    const glassC = mix(o.wallPal[1], PL.glass[0], 0.78), glintC = mix(o.wallPal[1], PL.glass[1], 0.78);
    for (let cy = top + 20; cy + 19 < gTop - 4; cy += 30) for (let cx = x + 8; cx + 10 < x + w - 2; cx += 26) {
      const col = cx - x; if (cy < prof[Math.min(w - 1, col)] + 9 || cy < prof[Math.min(w - 1, col + 10)] + 9) continue;
      if (o.torn && o.torn.some(tn => cx > x + tn.x - 6 && cx < x + tn.x + tn.w + 6 && cy > top + tn.y - 10 && cy < top + tn.y + tn.h + 6)) continue;
      const h2 = hash(cx, cy, sd + 7);
      ELLpx(cx + 4.5, cy - 1, 4.5, 4.5, (xx, yy) => { if (yy < cy) P(xx, yy, h2 > 0.8 ? o.dark : glassC); });
      for (let q = 0; q < 10; q++) { const dd = (q - 4.5) / 5.2, yy = cy - 1 - Math.round(Math.sqrt(Math.max(0, 1 - dd * dd)) * 5.4); P(cx + q, yy, o.wallPal[0]); }
      P(cx + 3, cy - 3, glintC); P(cx + 4, cy - 2, glintC);
      if (h2 > 0.4) { const sc = h2 > 0.75 ? '#5d7a58' : '#6f7f66'; R(cx - 4, cy - 2, 3, 22, sc); R(cx - 4, cy - 2, 1, 22, mix(sc, '#000000', 0.25)); for (let q = 1; q < 22; q += 3) R(cx - 4, cy - 2 + q, 3, 1, mix(sc, '#000000', 0.3)); }
      if (h2 > 0.55) { const sc = h2 > 0.8 ? '#5d7a58' : '#6f7f66'; R(cx + 11, cy - 2, 3, 22, sc); R(cx + 13, cy - 2, 1, 22, mix(sc, '#000000', 0.25)); for (let q = 1; q < 22; q += 3) R(cx + 11, cy - 2 + q, 3, 1, mix(sc, '#000000', 0.3)); }
    }
    // plaster damage showing brick (drawn source-atop: only onto existing wall pixels, no readback)
    g.globalCompositeOperation = 'source-atop';
    for (let k = 0; k < Math.round(w / 9); k++) { const bx = x + 4 + Math.floor(rnd() * (w - 16)), by = top + 14 + Math.floor(rnd() * (gTop - top - 30)), bw = 6 + Math.floor(rnd() * 10), bh = 4 + Math.floor(rnd() * 8); for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) { if (hash(i, j, sd + k) > 0.3) P(bx + i, by + j, ((i + (j % 2) * 3) % 6 === 0) ? PL.brick[1] : PL.brick[0]); } }
    g.globalCompositeOperation = 'source-over';
    // cornice + string course
    R(x, prof[0] + 0, w, 1, pal.lit); R(x, gTop - 3, w, 3, o.wallPal[0]); R(x, gTop - 3, w, 1, pal.lit); R(x, gTop, w, 1, o.wallPal[2]);
    // the arcade: dark piers + round arches into shade
    const AW = 26, pier = 8, n = Math.max(1, Math.floor((w - pier) / (AW + pier)));
    const sx0 = x + Math.round((w - (n * (AW + pier) + pier)) / 2);
    R(x, gTop + 1, w, AH, o.wallPal[1]);
    for (let k = 0; k <= n; k++) { const px = sx0 + k * (AW + pier); R(px, gTop + 1, pier, AH, o.wallPal[fl ? 2 : 0]); R(px + (fl ? 0 : pier - 2), gTop + 1, 2, AH, o.wallPal[fl ? 1 : 0]); R(px + (fl ? pier - 1 : 0), gTop + 1, 1, AH, o.wallPal[2]); }
    for (let k = 0; k < n; k++) {
      const ax = sx0 + pier + k * (AW + pier), cy = gTop + 15;
      for (let yy = gTop + 3; yy < base; yy++) for (let xx = 0; xx < AW; xx++) {
        const dx = xx - (AW - 1) / 2; if (yy < cy && dx * dx + (yy - cy) * (yy - cy) > (AW / 2) * (AW / 2)) continue;
        const dd = (yy - gTop) / AH; let c = o.dark; if (o.interior) { c = mix(o.dark, o.interior, 0.12 + 0.3 * smooth(0.25, 1, dd) * (0.4 + 0.6 * (1 - Math.abs(dx) / (AW / 2)))); } P(ax + xx, yy, (bay(ax + xx, yy) < 5 && dd > 0.3) ? mix(c, o.wallPal[2], 0.3) : c);
      }
      // arch ring + keystone
      for (let a = 0; a <= 32; a++) { const an = Math.PI + a / 32 * Math.PI, rx = Math.round(ax + (AW - 1) / 2 + Math.cos(an) * (AW / 2 + 1)), ry = Math.round(cy + Math.sin(an) * (AW / 2 + 1)); P(rx, ry, o.wallPal[0]); P(rx, ry - 1, o.wallPal[2]); }
      R(ax + (AW >> 1) - 1, gTop + 2, 3, 3, o.wallPal[0]);
      // things growing in the shadows: ferns and a bush
      const fr = fern(22, 16 + Math.floor(rnd() * 8), PL.leaf, sd + k, 6); g.drawImage(fr, ax + 2 + Math.floor(rnd() * 6), base - fr.height + 1);
      if (rnd() > 0.5) { const f2 = foliage(14, 10, PL.leaf, sd + k * 3, { maxR: 4 }); g.drawImage(f2, ax + 6 + Math.floor(rnd() * 8), base - 11); }
    }
    // iron balcony rails on the first storey
    for (let by = gTop - 28; by < gTop - 26; by++) for (let bx = x + 4; bx < x + w - 4; bx++) if (hash(bx, by, sd) > 0.05) P(bx, by, o.dark);
    for (let bx = x + 5; bx < x + w - 4; bx += 3) R(bx, gTop - 26, 1, 8, o.dark);
    // trim the ground: grass at the foot
    return prof;
  }
  const LF = { x: -14, w: 176, top: 72, base: GY }, RF = { x: 482, w: 176, top: 40, base: GY };
  let profL = null, profR = null;
  const WPL = { wall: PL.wall }, WPR = PL.wallR;
  const FACADES = layer(W, H, g => {
    profL = arcade(g, { ...LF, seed: 12, pal: PL, wallPal: PL.wall, dark: PL.dark, interior: PL.sun ? '#b79a5c' : '#7d8a80', flip: false, jag: 12, collapse: { side: 'right', depth: 26, span: 0.3 } });
    profR = arcade(g, { ...RF, seed: 31, pal: PL, wallPal: PL.wallR, dark: PL.dark, interior: PL.sun ? '#a68d56' : '#76837a', flip: true, jag: 14, collapse: { side: 'left', depth: 30, span: 0.3 }, torn: [{ x: 70, y: 52, w: 44, h: 52, see: false }] });
    g.globalCompositeOperation = 'source-atop';
    ivy(LF.x, LF.top - 6, LF.w, 120, PL.leaf, 4, (x, y) => 0.8 * (1 - smooth(8, 100, y)) + 0.1, 0.5);
    ivy(RF.x, RF.top - 6, RF.w, 130, PL.leaf, 5, (x, y) => 0.8 * (1 - smooth(8, 110, y)) + 0.1, 0.5);
    ivy(LF.x + 100, LF.top + 120, 76, 90, PL.leaf, 8, (x, y) => 0.5 * (1 - smooth(0, 70, x)) + 0.1, 0.5);
    ivy(RF.x, RF.top + 120, 80, 100, PL.leaf, 9, (x, y) => 0.5 * (1 - smooth(0, 70, 80 - x)) * 0 + 0.5 * smooth(0, 60, x) * 0 + 0.3, 0.5);
    glow(SX - 200, 100, 320, PL.warm, PL.sun ? 0.22 : 0.05, 5, 1.2);     // sunlit upper facades
    band(g, 112, 190, mix(PL.dark, hz, 0.4), 0.28, 4);
    g.globalCompositeOperation = 'source-over';
    for (const [T, prof] of [[LF, profL], [RF, profR]]) for (let i = 2; i < T.w - 6; i += 9) g.drawImage(foliage(14 + Math.floor(rnd() * 12), 9 + Math.floor(rnd() * 6), PL.leaf, T.x + i, { maxR: 4 }), T.x + i - 7, prof[i] - 6);
  });
  const sway = [], trees = [];
  const addCur = (prof, tx, i, w, h, s) => sway.push({ spr: vineCurtain(w, h, PL.vine, s, { band: 6 }), x: tx + i - (w >> 1), y: prof[clamp(i, 0, prof.length - 1)] - 1, o: { amp: 5, anchor: 'top', phase: s * 0.7 } });
  for (const [i, w, h, s] of [[8, 22, 70, 1], [34, 24, 54, 2], [58, 18, 90, 3], [86, 22, 44, 4], [112, 20, 60, 5], [140, 22, 76, 12]]) addCur(profL, LF.x, i, w, h, s);
  for (const [i, w, h, s] of [[6, 20, 66, 6], [32, 26, 50, 7], [60, 24, 88, 8], [92, 22, 58, 9], [120, 22, 72, 10], [150, 20, 54, 13]]) addCur(profR, RF.x, i, w, h, s);
  const addTree = (prof, tx, i, cw, ch, th, s, lean) => { const spr = tree({ canopyW: cw, canopyH: ch, trunkH: th, trunkW: 3, pal: PL.leaf, trunk: PL.trunk, seed: s, lean, branches: 3 }); trees.push({ spr, x: tx + i - (spr.width >> 1), y: prof[i] + 3 - spr.height, o: { amp: 3, anchor: 'bottom', phase: s * 0.4, pow: 1.1 } }); };
  addTree(profL, LF.x, 30, 56, 36, 14, 1, 4); addTree(profL, LF.x, 100, 40, 28, 12, 2, -3); addTree(profR, RF.x, 40, 44, 30, 12, 3, 3); addTree(profR, RF.x, 112, 60, 38, 15, 4, -3); addTree(profR, RF.x, 160, 34, 24, 8, 5, 2);
  // a tattered banner and a café sign on the left facade
  const banner = layer(10, 34, () => { for (let y = 0; y < 34; y++) for (let x = 0; x < 10; x++) { const edge = Math.abs(x - 4.5) + y * 0.12 > 6.5 + (y > 26 ? (y - 26) : 0) * 0.2; if (hash(x, y, 8) > 0.9 || (y > 28 && hash(x, y, 4) > 0.45)) continue; P(x, y, x < 2 ? '#7d8a5a' : (y % 9 < 2 ? '#cfc08a' : '#8d9a64')); } });
  const sign = signSprite({ chain: '#2b3032', board: '#6d6a52', edge: '#8c8a68', shade: '#3c3a2a', paint: '#c7bf8c', rust: '#7a4a2b' }, 6);

  // ---------------------------------------------------------------- fountain
  const FOUNTAIN = layer(170, 112, g => {
    const cx = 85, by = 98, st = PL.stone;
    // pedestal + upper bowl
    for (let y = 30; y < by - 6; y++) { const hw = y < 44 ? 5 : y > by - 18 ? 11 : 8; for (let x = -hw; x <= hw; x++) P(cx + x, y, x > hw - 3 ? st[0] : x < -hw + 2 ? st[2] : st[1]); }
    // crowning urn with a worn relief band, a few pigeons perch on its rim at runtime
    ELLpx(cx, 22, 8, 10, (x, y, nx, ny) => P(x, y, nx > 0.35 ? st[0] : nx < -0.4 ? st[2] : st[1]));
    R(cx - 3, 10, 7, 3, st[1]); R(cx - 4, 8, 9, 2, st[0]); R(cx - 4, 10, 1, 2, st[2]); R(cx - 6, 14, 1, 6, st[2]); R(cx + 6, 14, 1, 6, st[0]); R(cx - 8, 28, 17, 2, st[0]); R(cx - 6, 21, 13, 1, st[2]);
    for (let i = -6; i < 7; i += 2) P(cx + i, 18, st[2]);
    for (let q = 0; q < 8; q++) P(cx - 7 + (q % 2), 12 + q, PL.moss[1 + (q & 1)]);
    ELLpx(cx, 40, 32, 8, (x, y, nx, ny) => P(x, y, ny > 0.2 ? st[2] : (nx > 0.3 ? st[0] : st[1])));
    ELLpx(cx, 38, 30, 6, (x, y, nx, ny) => P(x, y, PL.dark));
    ELLpx(cx, 39, 28, 4, (x, y) => { if (hash(x, y, 3) > 0.45) P(x, y, mix(st[2], PL.moss[2], 0.5)); });
    // big lower basin: rim, shadowed inside, dry leaf litter and moss
    ELLpx(cx, by - 8, 78, 17, (x, y, nx, ny) => P(x, y, ny > 0.5 ? st[2] : nx > 0.45 ? st[0] : st[1]));
    ELLpx(cx, by - 11, 75, 14, (x, y, nx, ny) => P(x, y, mix(st[2], PL.dark, 0.55)));
    ELLpx(cx, by - 9, 72, 11, (x, y, nx, ny) => { const n = hash(x, y, 5); P(x, y, n > 0.82 ? PL.moss[1] : n > 0.6 ? mix(st[2], PL.moss[2], 0.6) : n < 0.1 ? '#8c7a48' : mix(st[2], PL.dark, 0.35)); });
    for (let x = cx - 78; x <= cx + 78; x++) { const nx = (x - cx) / 78, y = Math.round(by - 8 - 17 * Math.sqrt(Math.max(0, 1 - nx * nx))); P(x, y, st[0]); }
    // plants in the basin
    g.drawImage(foliage(36, 16, PL.leaf, 33, { maxR: 5 }), cx - 44, by - 28); g.drawImage(foliage(30, 14, PL.leaf, 35, { maxR: 5 }), cx + 14, by - 26);
  });
  const fountTree = tree({ canopyW: 26, canopyH: 18, trunkH: 8, trunkW: 2, pal: PL.leaf, trunk: PL.trunk, seed: 71, lean: 2, branches: 2 });
  const FX0 = 122, FY0 = GY - 90;       // fountain sprite origin

  // ---------------------------------------------------------------- derelict tram
  const TRAM = layer(150, 64, g => {
    const tp = PL.tram, L = 140, TH = 44, y0 = 8, x0 = 5;
    // body
    R(x0, y0 + 6, L, TH - 6, tp.body[1]); R(x0 + 2, y0 + 3, L - 4, 4, tp.body[1]);
    R(x0, y0 + 6, L, 1, tp.body[0]); R(x0 + 2, y0 + 3, L - 4, 1, tp.body[0]); R(x0, y0 + TH - 8, L, 8, tp.body[2]); R(x0, y0 + TH - 9, L, 1, tp.body[0]);
    for (let i = 0; i < L; i++) { P(x0 + i, y0 + 6 + 2, mix(tp.body[1], tp.body[0], 0.6)); }
    // roof with equipment and a bent pantograph
    R(x0 + 4, y0, L - 8, 3, tp.roof[1]); R(x0 + 4, y0, L - 8, 1, tp.roof[0]); R(x0 + 10, y0 - 2, 20, 2, tp.roof[2]);
    LN(x0 + 50, y0, x0 + 62, y0 - 8, tp.dark, 1); LN(x0 + 62, y0 - 8, x0 + 74, y0 - 4, tp.dark, 1); R(x0 + 72, y0 - 4, 8, 1, tp.dark);
    // windows: broken, sky glints, leaf-choked
    for (let k = 0; k < 7; k++) {
      const wx = x0 + 8 + k * 19, wy = y0 + 12, ww = 16, wh = 17, n = hash(k, 3, seed);
      R(wx, wy, ww, wh, tp.glass); R(wx, wy, ww, 1, tp.body[2]);
      if (n > 0.3) { for (let j = 0; j < 8; j++) P(wx + 2 + j, wy + 1 + Math.floor(j * 0.8), tp.glint); }
      if (n > 0.6) { for (let i = 0; i < ww; i++) if (hash(i, k, 7) > 0.4) R(wx + i, wy + wh - 1 - Math.floor(hash(i, k, 8) * 6), 1, 3, PL.moss[1 + (i & 1)]); }
      if (n < 0.2) { R(wx + 2, wy + 2, 5, 6, mix(tp.glass, '#a98a4a', 0.4)); }
      R(wx - 1, wy + wh, ww + 2, 1, tp.body[0]);
    }
    // destination board + door + rust streaks
    R(x0 + 4, y0 + 7, 22, 4, '#2a3532'); for (let i = 0; i < 18; i += 3) R(x0 + 6 + i, y0 + 8, 2, 2, '#c7bf8c');
    R(x0 + L - 22, y0 + 10, 14, 30, tp.dark); R(x0 + L - 22, y0 + 10, 1, 30, tp.body[2]); R(x0 + L - 9, y0 + 10, 1, 30, tp.body[2]);
    for (let k = 0; k < 30; k++) { const rx = x0 + 3 + Math.floor(hash(k, 1, seed) * (L - 6)), ry = y0 + 12 + Math.floor(hash(k, 2, seed) * 20), rl = 3 + Math.floor(hash(k, 4, seed) * 10); for (let j = 0; j < rl; j++) P(rx, ry + j, hash(rx, j, 4) > 0.3 ? tp.rust : mix(tp.rust, tp.body[1], 0.5)); }
    // bogies / wheels sunk in grass
    for (const wx of [x0 + 18, x0 + 40, x0 + L - 44, x0 + L - 22]) { ELLpx(wx, y0 + TH - 2, 6, 6, (x, y) => P(x, y, y < y0 + TH ? tp.dark : '#171d1d')); P(wx, y0 + TH - 2, tp.body[2]); }
    // moss and vines over the roof edge and flanks
    for (let i = 0; i < L; i++) { const n = fbm(i * 0.14, 5, seed, 2); if (n > 0.46) for (let q = 0; q < 2 + n * 4; q++) P(x0 + i, y0 + 3 + q - 1, q === 0 ? PL.moss[0] : (hash(i, q, 3) > 0.5 ? PL.moss[1] : PL.moss[2])); if (hash(i, 9, seed) > 0.9) for (let q = 0; q < 8; q++) P(x0 + i, y0 + 7 + q, q > 6 ? PL.moss[0] : PL.moss[2]); }
  });
  const TX = 292, TY = GY - 56;

  // ---------------------------------------------------------------- near ground clutter + foreground
  const gp = [PL.leaf[1], PL.leaf[2], PL.leaf[3], PL.leaf[4]];
  const tufts = [0, 1, 2, 3].map(k => grassTuft(30, 14 + k * 3, gp, 120 + k, { dens: 1.1, flowers: ['#e6dc9c', '#dcdccb', '#a9bfd6'] }));
  const NEARG = layer(W, H, g => {
    // rails in front of the tram
    R(130, GY - 4, 340, 1, '#3c443f'); R(130, GY - 3, 340, 1, '#59615a'); R(130, GY - 1, 340, 1, '#3c443f'); for (let x = 132; x < 470; x += 7) R(x, GY - 3, 3, 3, '#4a4033');
    // cafe chairs and a table knocked over, a lamp post leaning
    // a knocked-over cafe table: round top on its side, one leg in the air
    ELLpx(120, GY + 16, 9, 3, (x, y, nx, ny) => P(x, y, ny > 0.2 ? '#3a4440' : '#59635d')); LN(122, GY + 18, 126, GY + 26, '#2b3430', 1); LN(116, GY + 17, 112, GY + 25, '#2b3430', 1); LN(120, GY + 13, 119, GY + 6, '#2b3430', 1);
    for (let i = 0; i < 26; i++) { P(500 - i, GY + 6 - Math.round(i * 0.25), '#2a3234'); P(500 - i, GY + 7 - Math.round(i * 0.25), '#434b4c'); }
    // grass tufts through the paving
    for (let x = 0; x < W; x += 9 + Math.floor(rnd() * 22)) { const y = GY + 4 + Math.floor(Math.pow(rnd(), 0.7) * 52); if ((x > 164 && x < 262 && y < GY + 12)) continue; const k = Math.floor(rnd() * 4); g.drawImage(tufts[k], x, y - tufts[k].height + 2); }
  });
  const puddleSrc = mirrorSource(g => { g.drawImage(SKY, 0, 0); g.drawImage(FARC, 0, 0); g.drawImage(FACADES, 0, 0); }, 322, 38, '#2c6c78', 0.12, 0.12);
  // light through the arcade onto the paving (slanted, down-left from the sun)
  const shafts = [];
  if (PL.sun) {
    const mk = (ox, oy, ang, w0, spread, len, a) => shafts.push({ ox, oy, ang, w0, spread, len, a, ph: shafts.length * 1.7, mask: (x, y) => 1 - 0.45 * smooth(150, 190, y) * (1 - smooth(255, 300, y)) });
    mk(SX, SY, 1.85, 10, 0.15, 520, 0.9); mk(SX, SY, 2.1, 14, 0.18, 640, 0.8); mk(SX, SY, 2.36, 10, 0.16, 700, 0.8); mk(SX, SY, 2.62, 16, 0.2, 700, 0.55); mk(SX, SY, 2.88, 12, 0.18, 640, 0.45);
    for (const s of shafts) s.fs = fast(s.spr = shaftLayer(s, PL.shaft, PL.shaftA));
  }
  const mistA = mistSprite(W, 70, seed, PL.mist, PL.mistA[0], PL.mistA[1], 0.012, 0.07), mistB = mistSprite(W, 60, seed + 3, PL.mist, PL.mistA[0], PL.mistA[1], 0.016, 0.09);
  const fgTop = [{ spr: foliage(190, 54, PL.fgLeaf, 171, { maxR: 9 }), x: -50, y: -26 }, { spr: foliage(160, 44, PL.fgLeaf, 172, { maxR: 8 }), x: 520, y: -24 }];
  const fgVine = { stem: [PL.fgLeaf[3], PL.fgLeaf[2]], leaf: [PL.fgLeaf[1], PL.fgLeaf[2], PL.fgLeaf[3]] };
  const fgCurt = [vineCurtain(26, 50, fgVine, 141, { band: 4 }), vineCurtain(22, 44, fgVine, 142, { band: 4 })];
  const fgGrass = [grassTuft(70, 30, gp, 6, { dens: 1.2 }), grassTuft(80, 34, gp, 7, { dens: 1.2 })];
  const VIG = vignetteLayer(PL.vig, PL.vigA);
  const deerCol = { ...PL.deer }; for (const k in deerCol) deerCol[k] = mix(deerCol[k], hz, 0.12);
  const girCol = { ...PL.giraffe }; for (const k in girCol) girCol[k] = mix(girCol[k], hz, 0.55);
  const pig = [[190, 0], [200, 1], [214, 2], [236, 3], [258, 4], [124, 5], [142, 6]].map(([x, k]) => ({ x, y: GY + 4 + (k % 3) * 7 + Math.round(hash(k, 1, seed) * 6), k }));
  const signPivot = [LF.x + 150, 168];

  const FARCF = fast(FARC), GROUNDF = fast(GROUND), FACF = fast(FACADES), NEARGF = fast(NEARG), VIGF = fast(VIG);
  // the rays are pre-summed into 2 groups x 3 intensity levels (additive blending is the costly part of a frame, and alpha makes it costlier)
  const shaftGroups = [0, 1].map(k => [0.62, 0.82, 1].map(a => { const c = mkCanvas(W, H), gg = c.getContext('2d'); gg.globalCompositeOperation = 'lighter'; gg.globalAlpha = a; shafts.forEach((s, i) => { if (i % 2 === k) gg.drawImage(s.spr, 0, 0); }); return fast(c); }));
  function pigeons(g, t) {
    const cyc = 32000;
    for (const p of pig) {
      const c0 = (((t + hash(p.k, 3, seed) * 4000) % cyc) + cyc) % cyc, col = PL.pigeon, d = (p.k % 2) ? 1 : -1;
      if (c0 < 21000) { const peck = (Math.floor(t / 600 + p.k * 5) % 5 < 2); drawPigeonC(g, p.x + Math.round(Math.sin(t * 0.0004 + p.k) * 3 * (peck ? 0 : 1)), p.y, { col, dir: d, peck }); }
      else if (c0 < 24500) { const u = (c0 - 21000) / 3500; bird(g, p.x + u * (90 + p.k * 25), p.y - 3 - u * 120 + u * u * 20, t * 0.016 + p.k, PL.bird); }
      else if (c0 < 29000) { /* circling far above */ }
      else { const u = (c0 - 29000) / 3000, e = 1 - u; bird(g, p.x - e * (70 + p.k * 14), p.y - 3 - e * 70, t * 0.012 + p.k, PL.bird); }
    }
  }
  function wanderDeer(g, t) {
    const cyc = 100000, u = (((t + 30000) % cyc) / cyc) * 1.6;
    if (u <= 1) { const x = -34 + u * (W + 70), step = t * 0.0052; drawDeerC(g, Math.round(x), GY + 12, { col: deerCol, dir: 1, head: 0.5 + 0.1 * Math.sin(t * 0.0012), walk: step, antlers: true }); drawDeerC(g, Math.round(x - 30), GY + 15, { col: deerCol, dir: 1, head: 0.4, walk: step + 1.4 }); }
  }
  function distantGiraffe(g, t) {
    const u = (((t + 22000) % GIR.cyc)) / GIR.dur; if (u > 1) return;
    drawGiraffeC(g, Math.round(GIR.x0 + u * (GIR.x1 - GIR.x0)), 252, { col: girCol, dir: 1, walk: t * 0.0034 });
  }

  function draw(g, t) {
    g.imageSmoothingEnabled = false; use(g);
    g.drawImage(SKY, 0, 0);
    for (const c of clouds) { const span = W + c.w + 40, x = Math.round(((c.x0 + t * c.v / 1000) % span) - c.w - 20); g.drawImage(c.spr, x, c.y); }
    FARCF.draw(g);
    swaySprite(g, clockTree, 401 - (clockTree.width >> 1) + 6, 38 - clockTree.height + 4, t, { amp: 2, anchor: 'bottom', phase: 0.5, pow: 1.1 });
    distantGiraffe(g, t);
    flock(g, t, { y: 70, n: 9, col: PL.bird, seed: 5, t0: 5000, cycle: 46000, dur: 17000, rise: 12 });
    GROUNDF.draw(g);
    g.drawImage(TRAM, TX, TY);
    // light puddle reflections of sky in the paving (foggy variant keeps them subtle)
    FACF.draw(g);
    for (const s of sway) swaySprite(g, s.spr, s.x, s.y, t, s.o);
    for (const s of trees) swaySprite(g, s.spr, s.x, s.y, t, s.o);
    // banner + sign
    swaySprite(g, banner, LF.x + 136, 150, t, { amp: 4, anchor: 'top', phase: 0.8, rowH: 2 });
    g.fillStyle = '#2b3032'; g.fillRect(signPivot[0] - 14, signPivot[1] - 1, 28, 2);
    drawSwing(g, sign, 2, 0, signPivot[0] - 8, signPivot[1] + 1, Math.sin(t * 0.0013 + 2) * 0.2 + wind(signPivot[0], t) * 0.08);
    drawCable(g, t, RF.x + 20, RF.top + 62, RF.x + 26, RF.top + 112, 6, '#1b2326', 3.5, 1);
    g.drawImage(FOUNTAIN, FX0, FY0);
    for (const [dx, k] of [[-5, 0], [3, 1]]) { const c0 = (((t + k * 7000) % 30000) + 30000) % 30000; if (c0 < 19000) drawPigeonC(g, FX0 + 85 + dx, FY0 + 9, { col: PL.pigeon, dir: k ? -1 : 1, peck: Math.floor(t / 700 + k * 3) % 6 === 0 }); }
    swaySprite(g, fountTree, FX0 + 85 - (fountTree.width >> 1), FY0 + 44 - fountTree.height, t, { amp: 2, anchor: 'bottom', phase: 2, pow: 1.1 });
    NEARGF.draw(g);
    pigeons(g, t); wanderDeer(g, t);
    if (shafts.length) {
      g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 2; k++) { const v = 0.5 + 0.5 * Math.sin(t * 0.00055 + k * 2.1); shaftGroups[k][Math.min(2, Math.floor(v * 3))].draw(g); }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      motes(g, t, shafts, { n: 56, seed: 3, col: '#fff0c4', calm, a: 0.85 });
    }
    drawTiled(g, mistA, 250, t, 4, 0); drawTiled(g, mistB, 292, t, -6, 100);
    leaves(g, t, { n: 16, seed: 8, cols: PL.leafCols, calm, drift: 70 });
    for (const f of fgTop) g.drawImage(f.spr, f.x, f.y);
    swaySprite(g, fgCurt[0], 24, 14, t, { amp: 5, anchor: 'top', phase: 0.3 }); swaySprite(g, fgCurt[1], 560, 12, t, { amp: 5, anchor: 'top', phase: 1.1 });
    swaySprite(g, fgGrass[0], -6, H - 30, t, { amp: 4, anchor: 'bottom', phase: 0.5 }); swaySprite(g, fgGrass[1], 566, H - 34, t, { amp: 4, anchor: 'bottom', phase: 2.5 });
    VIGF.draw(g);
  }
  const scene = { id, name, variant, variantName: variants[variant] || variants[0], variants, draw };
  { const wc = mkCanvas(W, H), wg = wc.getContext('2d'); for (const tt of [0, 5000]) draw(wg, tt); }   // warm every lazily baked frame once
  return scene;
}
