// ============================================================================
//  waterfall-forest - a deep forest clearing: a waterfall into a still pool, mist, a log cabin being
//  eaten by moss, light through the canopy, a fox and deer on the shore.
//  Variants: 0 morning mist, 1 dusk with fireflies.
//  Interface: create(seed, variant) -> { id, name, variantName, draw(ctx, timeMs) }
// ============================================================================
import {
  W, H, use, P, R, LN, FPOLY, hash, mulberry32, bay, TAU, layer, mix, mixAll, clamp, fbm, smooth,
  gradV, expandRamp, glow, shaftLayer, cloudSprite, mistSprite, drawTiled, flock, perched, leaves, motes, fireflies, mirrorSource, drawWater,
  waterSparkle, ripples, vignetteLayer, calmFn, swaySprite, wind, fast, mkCanvas,
} from '../lib.js';
import { foliage, tree, vineCurtain, grassTuft, fern, ivy, bigTrunk, drawCabin, drawCliff, drawDeerC, drawFoxC } from '../art.js';

export const id = 'waterfall-forest';
export const name = 'Waterfall Forest';
export const variants = ['morning mist', 'dusk with fireflies'];

const WY = 292;
const FX = 438;                 // waterfall centre x
const SUN = [575, -16];

const PAL = [
  { // ---- morning mist
    sky: ['#5f9399', '#8fbab0', '#c3d3b0', '#d9dfb8', '#a9c4b0', '#8fb09f', '#7fa190'], haze: '#a3c0ae', warm: '#f6e2a4', glowA: 0.55,
    leaf: ['#c2d56a', '#87b24d', '#54833f', '#335a3a', '#1b3d36'], leafFar: '#6f9a82',
    trunk: ['#8f7d5e', '#5b4d3c', '#352b21'], moss: ['#b5c85a', '#729a40', '#40673a'],
    rock: ['#a9b39d', '#6a7f74', '#445b58', '#273a3d'], rockFog: 0.1,
    fall: ['#f5faf0', '#bfdcd6', '#7fb0b2'], water: ['#8fb9ad', '#5f9892', '#3d7378', '#27505a'], tint: '#3a8086', tintA: 0.3, dark: 0.18,
    log: ['#97856a', '#6d5d48', '#40352a'], roof: ['#7c8a66', '#566a4a', '#344634'], stone: ['#8c9690', '#626f6a', '#404c4b'], cabinGlow: null,
    shaft: '#fff0bd', shaftA: 0.26, mist: '#e9f1e4', mistA: [0.09, 0.17], sparkle: ['#fff4cc', '#e8f0d8'], vig: '#0c1f1a', vigA: 0.5, fire: false,
    deer: { body: '#6e5f46', belly: '#948362', dark: '#443a2a', back: '#5d4f3a', rump: '#ac9b7c', antler: '#4c4232' }, fox: { body: '#8a6446', belly: '#cdbd9c', dark: '#3a2f27', back: '#6f4f38' },
    leafCols: ['#a9bd55', '#7a9a42', '#c9b25a', '#9b7a3c'], bird: '#2c3d3a',
  },
  { // ---- dusk with fireflies
    sky: ['#17293b', '#274457', '#46676a', '#6b8a7c', '#4d6e74', '#3a5a66', '#2f4d5c'], haze: '#46687a', warm: '#f0b46a', glowA: 0.5,
    leaf: ['#98ad58', '#628a48', '#3e6a42', '#264c3a', '#132d2d'], leafFar: '#35575e',
    trunk: ['#6f6350', '#463d33', '#271f1a'], moss: ['#92b24e', '#5b8a3e', '#33573a'],
    rock: ['#7c8b86', '#4d6266', '#304450', '#1c2a36'], rockFog: 0.16,
    fall: ['#dcebea', '#9fc2c8', '#5f90a0'], water: ['#4e7a78', '#32596a', '#20405a', '#142a40'], tint: '#1f4f6a', tintA: 0.34, dark: 0.16,
    log: ['#7c6c56', '#554a3a', '#31291f'], roof: ['#5d6e56', '#3f5440', '#27382f'], stone: ['#6d7a78', '#4b5758', '#2f3a3d'], cabinGlow: '#d89a4a',
    shaft: '#f4b870', shaftA: 0.17, mist: '#9ab6c0', mistA: [0.1, 0.2], sparkle: ['#f6d08a', '#c4d8d0'], vig: '#08141a', vigA: 0.62, fire: true,
    deer: { body: '#4f4636', belly: '#6e644c', dark: '#2e281e', back: '#41392c', rump: '#80765c', antler: '#352e24' }, fox: { body: '#6e4f3a', belly: '#9d9078', dark: '#2a2220', back: '#563d2e' },
    leafCols: ['#7f9a4b', '#587f40', '#a89448', '#7a6034'], bird: '#1a2830',
  },
];
function fogCols(arr, haze, f) { return arr.map(c => mix(c, haze, f)); }
function band(g, y0, y1, col, maxA, steps = 5) {
  const [r_, g_, b_] = [parseInt(col.slice(1, 3), 16), parseInt(col.slice(3, 5), 16), parseInt(col.slice(5, 7), 16)];
  for (let lv = 1; lv <= steps; lv++) {
    g.fillStyle = 'rgba(' + r_ + ',' + g_ + ',' + b_ + ',' + (maxA * lv / steps).toFixed(3) + ')';
    for (let y = Math.min(y0, y1); y < Math.max(y0, y1); y++) { const t = clamp((y - y0) / (y1 - y0), 0, 1); for (let x = 0; x < W; x++) if (Math.floor(t * steps + bay(x, y) / 16) === lv) g.fillRect(x, y, 1, 1); }
  }
}

export function create(seed = 1, variant = 0) {
  const PL = PAL[variant] || PAL[0], hz = PL.haze, rnd = mulberry32(seed * 313 + variant * 7 + 5), calm = calmFn(105, 300, 0.3);
  const cliffTop = x => 46 + fbm(x * 0.03, 2, seed, 3) * 34 + Math.round(fbm(x * 0.13, 9, seed, 2) * 9) + (x < 330 ? Math.pow((330 - x) / 210, 1.3) * 250 : 0) + (x > 580 ? (x - 580) * 1.3 : 0) + 24 * Math.exp(-Math.pow((x - FX) / 15, 2));
  const FALLS = [
    { cx: FX + 16, w0: 15, w1: 19, y0: cliffTop(FX) + 3, y1: 156, spd: 1.0 }, { cx: FX, w0: 26, w1: 42, y0: 158, y1: WY - 2, spd: 1.1, base: true },
    { cx: 370, w0: 5, w1: 6, y0: cliffTop(370) + 10, y1: 196, spd: 0.8 }, { cx: 362, w0: 6, w1: 11, y0: 198, y1: WY - 2, spd: 0.9, base: true }, { cx: 508, w0: 8, w1: 12, y0: cliffTop(508) + 8, y1: WY - 2, spd: 0.8, base: true },
  ];

  // ------------------------------------------------------------- sky + far forest (columns of trunks fading into mist)
  const SKY = layer(W, H, g => { gradV(0, 0, W, WY, expandRamp(PL.sky, 16), 4); glow(SUN[0], SUN[1], 300, PL.warm, PL.glowA, 6, 1.5); });
  const FAR1 = layer(W, H, g => {
    const lf = mixAll(PL.leaf, hz, 0.74), tr = mixAll(PL.trunk, hz, 0.78);
    for (let x = -8; x < W; x += 7 + Math.floor(rnd() * 11)) {
      const top = 34 + Math.floor(rnd() * 90), w = 2 + Math.floor(rnd() * 3);
      R(x, top, w, WY - top, tr[1]); R(x + w - 1, top, 1, WY - top, tr[0]);
      if (rnd() > 0.35) g.drawImage(foliage(30 + Math.floor(rnd() * 34), 22 + Math.floor(rnd() * 20), lf, x, { maxR: 7 }), x - 20, top - 14);
    }
    band(g, 130, WY, hz, 0.36);
    // second row: thicker trunks, deeper tone
    const lf2 = mixAll(PL.leaf, hz, 0.56), tr2 = mixAll(PL.trunk, hz, 0.58);
    for (let x = 4; x < W; x += 34 + Math.floor(rnd() * 44)) {
      const top = 10 + Math.floor(rnd() * 46), w = 5 + Math.floor(rnd() * 5);
      for (let y = top; y < WY; y++) for (let i = 0; i < w; i++) P(x + i, y, i > w - 3 ? tr2[0] : i < 2 ? tr2[2] : (hash(x + i, y, seed) > 0.8 ? tr2[2] : tr2[1]));
      g.drawImage(foliage(64 + Math.floor(rnd() * 30), 44 + Math.floor(rnd() * 14), lf2, x + 3, { maxR: 9 }), x - 30, top - 24);
    }
    band(g, 190, WY, hz, 0.34);
    // undergrowth: low bushes and ferns melting into the ground mist
    const bf = mixAll(PL.leaf, hz, 0.46);
    for (let x = -20; x < W; x += 16 + Math.floor(rnd() * 14)) g.drawImage(foliage(34 + Math.floor(rnd() * 24), 20 + Math.floor(rnd() * 14), bf, x + 9, { maxR: 6 }), x, WY - 36 - Math.floor(rnd() * 16));
    band(g, 236, WY + 4, hz, 0.4);
  });

  // ------------------------------------------------------------- cliff with the waterfall
  const CLIFF = layer(W, H, g => {
    const rock = mixAll(PL.rock, hz, PL.rockFog);
    drawCliff(g, 110, 640, WY, cliffTop, rock, 11);
    // ledges: lighter lips where strata step out, with shadowed undersides
    for (const ly of [88, 110, 132, 152, 174, 196, 218, 240, 262]) for (let x = 130; x < 640; x++) { if (fbm(x * 0.05, ly, seed, 2) > 0.5 && cliffTop(x) < ly - 4) { P(x, ly + Math.round(Math.sin(x * 0.07 + ly) * 1.5), rock[0]); P(x, ly + 1 + Math.round(Math.sin(x * 0.07 + ly) * 1.5), rock[3]); } }
    g.globalCompositeOperation = 'source-atop';
    ivy(110, 40, 530, 140, mixAll(PL.leaf, hz, 0.1), 3, (x, y) => 0.55 * (1 - smooth(0, 80, y)) + 0.12, 0.5);
    ivy(110, 170, 530, 130, mixAll(PL.leaf, hz, 0.12), 6, (x, y) => 0.38 * smooth(0, 120, y) + 0.1, 0.5);
    glow(SUN[0] - 60, 40, 330, PL.warm, variant ? 0.08 : 0.2, 5, 1.3);
    g.globalCompositeOperation = 'source-over';
    // bushes and ferns along the lip
    const lp = mixAll(PL.leaf, hz, 0.1);
    for (let x = 120; x < 640; x += 12 + Math.floor(rnd() * 8)) { const f = foliage(16 + Math.floor(rnd() * 12), 10 + Math.floor(rnd() * 6), lp, x, { maxR: 4 }); g.drawImage(f, x - 8, Math.round(cliffTop(x)) - 7); }
    for (let k = 0; k < 34; k++) { const x = 140 + Math.floor(rnd() * 480), y = 100 + Math.floor(rnd() * 170); if (cliffTop(x) < y - 10) g.drawImage(fern(24, 14 + Math.floor(rnd() * 6), lp, 200 + k, 6), x, y - 12); }
    // the water bodies of the falls, with rock lips under every break
    for (const f of FALLS) {
      for (let y = Math.round(f.y0); y < f.y1; y++) {
        const wd = f.w0 + (f.w1 - f.w0) * ((y - f.y0) / (f.y1 - f.y0)), x0 = Math.round(f.cx - wd / 2), x1 = Math.round(f.cx + wd / 2);
        for (let x = x0; x < x1; x++) { const e = Math.min(x - x0, x1 - 1 - x); P(x, y, e < 1 ? PL.fall[2] : (bay(x, y) < 8 ? PL.fall[1] : PL.fall[2])); }
        if (hash(y, f.cx, seed) > 0.5) { P(x0 - 1, y, rock[3]); P(x1, y, rock[3]); }
      }
      if (!f.base) { R(Math.round(f.cx - f.w1 / 2) - 7, f.y1, Math.round(f.w1) + 14, 3, rock[1]); R(Math.round(f.cx - f.w1 / 2) - 7, f.y1, Math.round(f.w1) + 14, 1, rock[0]); R(Math.round(f.cx - f.w1 / 2) - 5, f.y1 + 3, Math.round(f.w1) + 10, 1, rock[3]); }
    }
    // pebbly ledge at the foot of the cliff (the fox and deer use it)
    for (let x = 130; x < 570; x++) { const t0 = WY - 3 - Math.round(fbm(x * 0.06, 8, seed, 2) * 3); R(x, t0, 1, WY + 2 - t0, mix(rock[1], '#b9b08a', 0.25)); P(x, t0, rock[0]); if (hash(x, 4, seed) > 0.7) P(x, t0 + 1, rock[3]); }
  });
  // ferns/ivy hanging on the cliff lip + trees growing on top (animated)
  const cliffTrees = [];
  for (const [x, cw, ch, th, s] of [[300, 36, 26, 10, 21], [346, 30, 22, 8, 22], [390, 44, 30, 12, 23], [488, 40, 28, 12, 24], [534, 52, 34, 14, 25], [584, 40, 28, 10, 26]]) {
    const spr = tree({ canopyW: cw, canopyH: ch, trunkW: 3, trunkH: th, pal: mixAll(PL.leaf, hz, 0.16), trunk: PL.trunk, seed: s, lean: (s % 2 ? 3 : -3), branches: 2 });
    cliffTrees.push({ spr, x: x - (spr.width >> 1), y: Math.round(cliffTop(x)) + 4 - spr.height, o: { amp: 3, anchor: 'bottom', phase: s * 0.5, pow: 1.1 } });
  }
  const cliffVines = [];
  for (const [x, w, h, s] of [[312, 18, 40, 31], [372, 14, 30, 32], [410, 18, 46, 33], [470, 14, 34, 34], [520, 18, 40, 35], [560, 14, 30, 36]]) {
    cliffVines.push({ spr: vineCurtain(w, h, { stem: mixAll(['#2b4a30', '#41663a'], hz, 0.1), leaf: mixAll(PL.moss, hz, 0.1) }, s, { band: 4 }), x: x - (w >> 1), y: Math.round(cliffTop(x)) + 2, o: { amp: 3, anchor: 'top', phase: s * 0.3 } });
  }

  // ------------------------------------------------------------- mid trunks (framing), banks, cabin
  const midTrunks = [
    { spr: bigTrunk(16, 300, mixAll(PL.trunk, hz, 0.4).reverse().reverse(), mixAll(PL.moss, hz, 0.4), 41), x: 206, y: 0 + 0 },
    { spr: bigTrunk(14, 300, mixAll(PL.trunk, hz, 0.4), mixAll(PL.moss, hz, 0.4), 42), x: 600, y: 0 },
  ];
  const trunkPal = mixAll(PL.trunk, hz, 0.12).slice().reverse();     // [lit, mid, shade] -> bigTrunk wants [shade? lit?] see below
  const MID = layer(W, H, g => {
    for (const m of midTrunks) g.drawImage(m.spr, m.x - (m.spr.width >> 1), WY + 4 - m.spr.height);
  });
  const midCanopy = [
    { spr: foliage(110, 54, mixAll(PL.leaf, hz, 0.34), 51, { maxR: 9 }), x: 206 - 56, y: -6 }, { spr: foliage(90, 50, mixAll(PL.leaf, hz, 0.3), 52, { maxR: 8 }), x: 600 - 48, y: -2 },
  ];
  const SHORE = layer(W, H, g => {
    const earth = mix(PL.rock[3], PL.moss[2], 0.35);
    FPOLY([[-5, 316], [-5, 288], [28, 291], [90, 296], [150, 297], [190, 303], [222, 311], [190, 316], [120, 318], [50, 317]], earth);
    FPOLY([[570, 316], [574, 306], [596, 298], [640, 292], [645, 292], [645, 320], [610, 319]], earth);
    drawCabin(g, 10, 303, 100, 40, { log: PL.log, dark: '#1a2220', roof: PL.roof, moss: PL.moss, stone: PL.stone, glow: PL.cabinGlow }, 7);
    // log + boulders on the right bank
    for (let i = 0; i < 60; i++) for (let j = 0; j < 7; j++) { const yy = 300 - j + Math.round(i * 0.05); if ((i - 30) * (i - 30) / 900 + (j - 3) * (j - 3) / 12 <= 1) P(586 + i - 40, yy, j < 2 ? PL.log[0] : j > 4 ? PL.log[2] : PL.log[1]); }
    const bold = mixAll(PL.rock, hz, 0.1);
    for (const [bx, by, bw, bh] of [[528, 306, 30, 16], [118, 306, 34, 14], [560, 312, 22, 10]]) { for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) { const nx = (i - bw / 2) / (bw / 2), ny = (j - bh) / bh; if (nx * nx + ny * ny > 1) continue; const s = nx * 0.5 - ny * 0.7 + (hash(i, j, seed) - 0.5) * 0.4; P(bx + i, by + j, bold[s > 0.5 ? 0 : s > 0.0 ? 1 : s > -0.5 ? 2 : 3]); } }
    // grass, ferns, flowers over the banks
    const tp = [PL.leaf[0], PL.leaf[2], PL.leaf[3], PL.leaf[4]], gt = [0, 1, 2].map(k => grassTuft(32, 14 + k * 3, tp, 80 + k, { dens: 1.2, flowers: ['#e6dc9c', '#dcdccb', '#a9bfd6'] })), fr = [0, 1, 2].map(k => fern(34, 22 + k * 4, PL.leaf, 90 + k, 7));
    for (let x = -6; x < 214; x += 6 + Math.floor(rnd() * 8)) { const yb = x < 150 ? 300 : 300 + (x - 150) * 0.22, k = Math.floor(rnd() * 3); g.drawImage(gt[k], x, yb - gt[k].height + 3); if (rnd() > 0.6) g.drawImage(fr[k], x - 6, yb - fr[k].height + 5); }
    for (let x = 572; x < 650; x += 6 + Math.floor(rnd() * 8)) { const k = Math.floor(rnd() * 3); g.drawImage(gt[k], x, 300 - gt[k].height + 4); if (rnd() > 0.5) g.drawImage(fr[k], x - 6, 304 - fr[k].height); }
    // the pool's shoreline: wet dark rim
    for (let x = 190; x < 575; x++) { if (hash(x, 9, seed) > 0.8) P(x, WY, PL.water[0]); }
  });
  const fgTrunkL = bigTrunk(26, 380, PL.trunk.slice().reverse().reverse(), PL.moss, 61, { bend: 1.6 }), fgTrunkR = bigTrunk(22, 380, PL.trunk, PL.moss, 62, { bend: 1.6 });

  // ------------------------------------------------------------- water
  const REFL = mirrorSource(g => { g.drawImage(SKY, 0, 0); g.drawImage(FAR1, 0, 0); g.drawImage(CLIFF, 0, 0); g.drawImage(MID, 0, 0); g.drawImage(SHORE, 0, 0); }, WY, H - WY, PL.tint, PL.tintA, PL.dark);
  const WBASE = layer(W, H - WY, () => { gradV(0, 0, W, H - WY, PL.water, 4); glow(FX, 4, 150, PL.warm, variant ? 0.12 : 0.22, 5, 1.3, 0.4); });
  // ------------------------------------------------------------- light + mist + canopy
  const shafts = [];
  { const mk = (ang, w0, spread, len, a) => shafts.push({ ox: SUN[0], oy: SUN[1], ang, w0, spread, len, a, ph: shafts.length * 1.9, mask: (x, y) => 1 - 0.5 * smooth(140, 190, y) * (1 - smooth(250, 300, y)) });
    mk(1.86, 8, 0.14, 420, 0.9); mk(2.0, 12, 0.18, 500, 0.8); mk(2.16, 8, 0.15, 520, 0.9); mk(2.34, 14, 0.2, 560, 0.7); mk(2.55, 10, 0.16, 520, 0.6); mk(2.8, 12, 0.18, 560, 0.45);
    for (const s of shafts) s.fs = fast(s.spr = shaftLayer(s, PL.shaft, PL.shaftA)); }
  const mistA = mistSprite(W, 80, seed, PL.mist, PL.mistA[0], PL.mistA[1], 0.01, 0.06), mistB = mistSprite(W, 60, seed + 3, PL.mist, PL.mistA[0], PL.mistA[1], 0.014, 0.08), plume = mistSprite(160, 90, seed + 9, PL.mist, PL.mistA[0] * 1.4, PL.mistA[1] * 1.4, 0.03, 0.07);
  const canopy = [
    { spr: foliage(190, 72, PL.leaf.map((c, i) => mix(c, '#0a1a14', 0.32)), 71, { maxR: 10 }), x: -34, y: -34, a: 1.5 }, { spr: foliage(130, 58, PL.leaf.map(c => mix(c, '#0a1a14', 0.3)), 72, { maxR: 9 }), x: 140, y: -34, a: 1.5 },
    { spr: foliage(110, 50, PL.leaf.map(c => mix(c, '#0a1a14', 0.28)), 73, { maxR: 8 }), x: 270, y: -32, a: 1.5 }, { spr: foliage(90, 60, PL.leaf.map(c => mix(c, '#0a1a14', 0.3)), 74, { maxR: 9 }), x: 586, y: -30, a: 1.5 },
  ];
  const fgVine = { stem: [PL.leaf[4], PL.leaf[3]], leaf: [PL.leaf[2], PL.leaf[3], PL.leaf[4]] };
  const fgVines = [[20, 22, 56, 81], [150, 20, 46, 82], [286, 22, 40, 83], [600, 22, 60, 84]].map(([x, w, h, s]) => ({ spr: vineCurtain(w, h, fgVine, s, { band: 3 }), x, y: 22, s }));
  const fgFern = [fern(54, 44, PL.leaf.map(c => mix(c, '#0a1a14', 0.35)), 77, 9), fern(46, 38, PL.leaf.map(c => mix(c, '#0a1a14', 0.35)), 78, 8)];
  const VIG = vignetteLayer(PL.vig, PL.vigA);
  const perch = [[Math.round(300), Math.round(cliffTop(300)) + 3], [Math.round(334), Math.round(cliffTop(334)) + 3], [Math.round(560), Math.round(cliffTop(560)) + 3]];
  const deerCol = { ...PL.deer }; for (const k in deerCol) deerCol[k] = mix(deerCol[k], hz, 0.16);
  const foxCol = { ...PL.fox }; for (const k in foxCol) foxCol[k] = mix(foxCol[k], hz, 0.3);
  const cabinWin = [10 + Math.round(100 * 0.55) + 7, 303 - 22 + 5];

  function deerHead(t, off) { const c = ((t / 1000 + off) % 17 + 17) % 17; if (c < 11) return 0.04 + 0.04 * Math.sin(t * 0.003 + off); if (c < 12) return (c - 11) * 0.95; if (c < 15) return 1; if (c < 16) return 1 - (c - 15); return 0.05; }

  const FAR1F = fast(FAR1), CLIFFF = fast(CLIFF), MIDF = fast(MID), SHOREF = fast(SHORE), VIGF = fast(VIG);
  // the rays are pre-summed into 2 groups x 3 intensity levels (additive blending is the costly part of a frame, and alpha makes it costlier)
  const shaftGroups = [0, 1].map(k => [0.62, 0.82, 1].map(a => { const c = mkCanvas(W, H), gg = c.getContext('2d'); gg.globalCompositeOperation = 'lighter'; gg.globalAlpha = a; shafts.forEach((s, i) => { if (i % 2 === k) gg.drawImage(s.spr, 0, 0); }); return fast(c); }));
  function drawFall(g, t) {
    for (const f of FALLS) {
      const wmax = Math.ceil(f.w1) + 2, hw0 = f.w0 / 2, hw1 = f.w1 / 2, hgt = f.y1 - f.y0;
      for (let c = 0; c < wmax; c++) {
        const dx = c - wmax / 2 + 0.5; if (Math.abs(dx) > hw1) continue;
        const ys = Math.abs(dx) <= hw0 ? f.y0 : f.y0 + (Math.abs(dx) - hw0) / (hw1 - hw0 + 0.001) * hgt, x = Math.round(f.cx + dx);
        const hs = hash(c, f.cx, seed), per = 18 + Math.floor(hs * 16), v = (60 + hs * 60) * f.spd, ph = hash(c, 3, seed) * per;
        const off = ((t * v / 1000 + ph) % per + per) % per;
        for (let yy = f.y0 - per + off; yy < f.y1; yy += per) {
          const a = Math.max(yy, ys), b = Math.min(yy + 4 + hs * 8, f.y1); if (b <= a) continue;
          g.fillStyle = (c + Math.floor(yy / per)) % 3 === 0 ? PL.fall[0] : PL.fall[1]; g.fillRect(x, Math.round(a), 1, Math.round(b - a));
        }
        if (hs > 0.5) { const o2 = ((t * v * 0.6 / 1000 + ph * 2) % 29 + 29) % 29; g.fillStyle = PL.fall[2]; for (let yy = f.y0 - 29 + o2; yy < f.y1; yy += 29) { const a = Math.max(yy, ys), b = Math.min(yy + 7, f.y1); if (b > a) g.fillRect(x, Math.round(a), 1, Math.round(b - a)); } }
      }
      g.fillStyle = PL.fall[0]; for (let i = 0; i < f.w0; i++) if (hash(i, Math.floor(t / 180), seed + f.cx) > 0.5) g.fillRect(Math.round(f.cx - f.w0 / 2 + i), Math.round(f.y0 - 1), 1, 1);
      foam(g, t, f.cx, f.y1, f.w1 * 0.55, f.base ? 1 : 0.5);
    }
  }
  function foam(g, t, cx, yb, rx, k) {
    const n = Math.round(46 * k * rx / 20);
    for (let i = 0; i < n; i++) {
      const slot = Math.floor(t / 110 + i * 3.7), r = hash(slot, i, seed + cx);
      const x = cx + Math.round((hash(i, 2, seed) - 0.5) * rx * 2.2), y = yb + Math.round((hash(i, 3, seed) - 0.5) * 5);
      if (r < 0.45) continue; g.fillStyle = r > 0.8 ? PL.fall[0] : PL.fall[1]; g.fillRect(x, y + Math.round(Math.sin(t * 0.004 + i) * 1.2), r > 0.9 ? 2 : 1, 1);
    }
    g.fillStyle = PL.fall[0];
    for (let i = 0; i < Math.round(14 * k); i++) { const per = 1300 + hash(i, 1, seed) * 900, u = ((t + hash(i, 2, seed) * per) % per) / per, hgt = 5 + hash(i, 3, seed) * 12 * k; const x = cx + (hash(i, 4, seed) - 0.5) * rx * 2 + (u - 0.5) * (hash(i, 5, seed) - 0.5) * 18, y = yb - 1 - 4 * u * (1 - u) * hgt; g.globalAlpha = 0.85 * (1 - u * 0.5); g.fillRect(Math.round(x), Math.round(y), 1, 1); }
    g.globalAlpha = 1;
  }
  function butterflies(g, t) {
    for (let i = 0; i < 3; i++) {
      const bx = [120, 565, 90][i], by = [280, 282, 292][i], x = bx + Math.sin(t * 0.0009 + i * 2) * 26 + Math.sin(t * 0.0023 + i) * 6, y = by + Math.sin(t * 0.0013 + i * 4) * 8 + Math.sin(t * 0.007 + i) * 1.5;
      const fl = Math.floor(t / 110 + i * 3) % 2; g.fillStyle = i % 2 ? '#e8dca4' : '#d8d8cc'; g.fillRect(Math.round(x), Math.round(y), 1, 1); g.fillRect(Math.round(x) + (fl ? -1 : 1), Math.round(y) - (fl ? 1 : 0), 1, 1); g.fillRect(Math.round(x) + (fl ? 1 : -1), Math.round(y) - (fl ? 1 : 0), 1, 1);
    }
  }

  function draw(g, t) {
    g.imageSmoothingEnabled = false; use(g);
    g.drawImage(SKY, 0, 0);
    flock(g, t, { y: 44, n: 6, col: PL.bird, seed: 5, t0: 4000, cycle: 40000, dur: 16000, rise: 6 });
    FAR1F.draw(g);
    CLIFFF.draw(g);
    for (const s of cliffTrees) swaySprite(g, s.spr, s.x, s.y, t, s.o);
    for (const s of cliffVines) swaySprite(g, s.spr, s.x, s.y, t, s.o);
    perched(g, t, perch, PL.bird, 34000, seed);
    drawFall(g, t);
    // animals on the ledge below the cliff
    { const cyc = 56000, u = ((t + 14000) % cyc) / cyc; if (u < 0.5) { const x = 120 + (u / 0.5) * 300; drawFoxC(g, Math.round(x), WY - 3, { col: foxCol, dir: 1, walk: t * 0.011 }); } }
    drawDeerC(g, 486, WY - 4, { col: deerCol, dir: -1, head: deerHead(t, 2), antlers: true }); drawDeerC(g, 504, WY - 4, { col: deerCol, dir: -1, head: deerHead(t, 9) });
    drawTiled(g, mistA, WY - 78, t, 3, 0);
    MIDF.draw(g);
    // pool
    g.drawImage(WBASE, 0, WY);
    drawWater(g, t, REFL, WY, H - WY, { alpha: 0.78 });
    ripples(g, t, [[FX, 6, 0], [FX, 6, 1700], [FX, 6, 3400]], WY, PL.sparkle[1], 5100, 70);
    ripples(g, t, [[300, 24, 500], [190, 36, 2100], [380, 44, 1300]], WY, PL.sparkle[1], 3600, 12);
    waterSparkle(g, t, { wy: WY, rows: H - WY, seed: 3, n: variant ? 18 : 34, sx: 380, spread: 260, hi: PL.sparkle[0], col: PL.sparkle[1], a: 0.8 });
    for (const m of midCanopy) swaySprite(g, m.spr, m.x, m.y, t, { amp: 2, anchor: 'top', phase: m.x * 0.01 });
    SHOREF.draw(g);
    // the cabin's one dim window (dusk)
    if (PL.cabinGlow) { g.globalAlpha = 0.65 + 0.2 * Math.sin(t * 0.003 + Math.sin(t * 0.0011) * 2); g.fillStyle = '#f5d58a'; g.fillRect(cabinWin[0], cabinWin[1] + 1, 2, 1); g.globalAlpha = 1; }
    swaySprite(g, fgFern[0], 150, WY + 6, t, { amp: 3, anchor: 'bottom', phase: 0.4 }); swaySprite(g, fgFern[1], 556, WY + 4, t, { amp: 3, anchor: 'bottom', phase: 1.4 });
    // light, pollen
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 2; k++) { const v = 0.5 + 0.5 * Math.sin(t * 0.00055 + k * 2.1); shaftGroups[k][Math.min(2, Math.floor(v * 3))].draw(g); }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    motes(g, t, shafts, { n: 56, seed: 6, col: variant ? '#f4d9a0' : '#fff4c8', calm, a: 0.85 });
    // mist
    g.globalAlpha = 0.7 + 0.3 * Math.sin(t * 0.0006); g.drawImage(plume, FX - 80, WY - 74 + Math.round(Math.sin(t * 0.0008) * 3)); g.globalAlpha = 1;
    drawTiled(g, mistB, WY - 26, t, -6, 200);
    leaves(g, t, { n: 16, seed: 8, cols: PL.leafCols, calm, drift: 60 });
    if (PL.fire) fireflies(g, t, { n: 30, seed: 9, y0: 200, y1: 350, col: '#d8d070', calm: y => 0.5 + 0.5 * (1 - calm(y)) });
    else butterflies(g, t);
    // canopy overhead and framing trunks
    for (const c of canopy) swaySprite(g, c.spr, c.x, c.y, t, { amp: c.a, anchor: 'top', phase: c.x * 0.02, windMul: 0.8 });
    for (const v of fgVines) swaySprite(g, v.spr, v.x, v.y, t, { amp: 4, anchor: 'top', phase: v.s * 0.3 });
    g.drawImage(fgTrunkL, -26 - 4, H - 380 + 14); g.drawImage(fgTrunkR, W - fgTrunkR.width + 20, H - 380 + 14);
    VIGF.draw(g);
  }
  const scene = { id, name, variant, variantName: variants[variant] || variants[0], variants, draw };
  { const wc = mkCanvas(W, H), wg = wc.getContext('2d'); for (const tt of [0, 5000]) draw(wg, tt); }   // warm every lazily baked frame once
  return scene;
}
