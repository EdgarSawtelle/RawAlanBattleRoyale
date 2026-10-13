// ============================================================================
//  highway-interchange - a collapsed highway interchange on dry golden hills: stacked overpasses with
//  hanging rebar, waterfalls of ivy, a swinging road sign, rows of dead cars, and (the wonder moment) a herd
//  of horses that walks out from under the spans.
//  Variants: 0 golden dusk, 1 dust haze (dry ochre light, wind-blown dust, a tumbleweed rolling by).
//  Interface: create(seed, variant) -> { id, name, variantName, draw(ctx, timeMs) }
// ============================================================================
import {
  W, H, use, P, R, LN, FPOLY, ELLpx, hash, mulberry32, bay, TAU, layer, mix, mixAll, clamp, fbm, smooth,
  gradV, expandRamp, glow, shaftLayer, cloudSprite, mistSprite, drawTiled, flock, perched, leaves, motes, streaks, vignetteLayer, calmFn,
  swaySprite, wind, fast, mkCanvas,
} from '../lib.js';
import { foliage, tree, vineCurtain, grassTuft, ivy, drawTower, drawCar, drawHorseC, drawDeerC, drawSwing, signSprite, drawCable } from '../art.js';

export const id = 'highway-interchange';
export const name = 'Highway Interchange';
export const variants = ['golden dusk', 'dust haze'];

const GROUND = 296, SUN = [476, 176];
const PAL = [
  {
    sky: ['#386a8c', '#6a9eae', '#b4c9a6', '#e6d49a', '#efc57e'], haze: '#c9b88a', warm: '#f7cf86', glowA: 0.55, sun: true,
    cloud: { hi: '#f6c985', mid: '#b4c0a2', lo: '#6a8e94' }, cloudN: 6,
    conc: ['#aeaa98', '#807e72', '#4f5250'], dark: '#1f2726', rust: '#8e5535', metal: ['#8d7662', '#5e4c40', '#352c28'],
    moss: ['#b2c75a', '#729a40', '#40673a'], leaf: ['#b8cf5e', '#82b04a', '#52803e', '#325a38', '#1c3c33'], trunk: ['#7a6548', '#4f4132', '#2f281f'],
    vine: { stem: ['#2b4a30', '#41663a'], leaf: ['#a8c456', '#66963f', '#3a6339'], flower: ['#eadfa6', '#dcd9c6', '#a4bbd6'] },
    hill: ['#c9b062', '#a48f4a', '#7b7040'], straw: ['#dcc470', '#b8a050', '#8a7a3c', '#5a5630'], road: ['#5c6360', '#474e4c', '#323937'],
    car: { body: ['#8d7a66', '#675646', '#41352c'], rust: '#8b5232', glass: '#1b2a2c', glint: '#86b1ab', tire: '#171d1d', rim: '#59615b', moss: ['#b2c75a', '#729a40', '#40673a'] },
    horse: { body: '#6e5338', belly: '#8d7050', dark: '#2f241c', back: '#5a432d', mane: '#241b15', blaze: '#e0d6bc', hoof: '#201a16' },
    shaft: '#ffe0a0', shaftA: 0.3, mist: '#f0d8a0', mistA: [0.05, 0.1], vig: '#140f0a', vigA: 0.5, dust: false, birds: '#2a3436', leafCols: ['#a9bd55', '#c9a850', '#9b7a3c'],
  },
  {
    sky: ['#9a8660', '#b8a272', '#d0bd8a', '#e2d3a0', '#ecdcae'], haze: '#d4c496', warm: '#f0e0a8', glowA: 0.35, sun: true,
    cloud: { hi: '#ecdcae', mid: '#cdbd90', lo: '#a49470' }, cloudN: 4,
    conc: ['#a8a290', '#7c7868', '#4d504a'], dark: '#241f1a', rust: '#80482c', metal: ['#85705c', '#5a493d', '#332a26'],
    moss: ['#a8b858', '#6a8c3e', '#3e5e34'], leaf: ['#a8b858', '#78a046', '#4e7a3a', '#305434', '#1c3a30'], trunk: ['#6e5c42', '#4a3d2e', '#2c241c'],
    vine: { stem: ['#2b4a30', '#3f6638'], leaf: ['#a0b856', '#66923f', '#3a6039'], flower: ['#e6dca4', '#d6d4c0', '#a0b4cc'] },
    hill: ['#bca66c', '#9a8650', '#74683e'], straw: ['#d0bc78', '#ac9858', '#82743f', '#585230'], road: ['#625f56', '#4c4a43', '#34332e'],
    car: { body: ['#8a7660', '#645242', '#40342a'], rust: '#7d4c34', glass: '#1d2829', glint: '#7aa5a6', tire: '#171c1c', rim: '#555a54', moss: ['#a8b858', '#6a8c3e', '#3e5e34'] },
    horse: { body: '#76603f', belly: '#947a58', dark: '#34281e', back: '#625035', mane: '#2a2018', blaze: '#e0d8be', hoof: '#221b16' },
    shaft: '#f6e6b4', shaftA: 0.12, mist: '#e6d6a6', mistA: [0.14, 0.24], vig: '#17120c', vigA: 0.56, dust: true, birds: '#4a4638', leafCols: ['#a2a850', '#b89a48', '#8a7038'],
  },
];
function band(g, y0, y1, col, maxA, steps = 5) {
  const [r_, g_, b_] = [parseInt(col.slice(1, 3), 16), parseInt(col.slice(3, 5), 16), parseInt(col.slice(5, 7), 16)];
  for (let lv = 1; lv <= steps; lv++) {
    g.fillStyle = 'rgba(' + r_ + ',' + g_ + ',' + b_ + ',' + (maxA * lv / steps).toFixed(3) + ')';
    for (let y = Math.min(y0, y1); y < Math.max(y0, y1); y++) { const t = clamp((y - y0) / (y1 - y0), 0, 1); for (let x = 0; x < W; x++) if (Math.floor(t * steps + bay(x, y) / 16) === lv) g.fillRect(x, y, 1, 1); }
  }
}

export function create(seed = 1, variant = 0) {
  const PL = PAL[variant] || PAL[0], hz = PL.haze, rnd = mulberry32(seed * 619 + variant * 19 + 7), calm = calmFn(105, 300, 0.3);
  const fog = (c, f) => mix(c, hz, f);

  const SKY = layer(W, H, g => {
    gradV(0, 0, W, 250, expandRamp(PL.sky, 16), 4); R(0, 250, W, H - 250, PL.sky[4]);
    glow(SUN[0], SUN[1], 250, PL.warm, PL.glowA * 0.72, 6, 1.6); glow(SUN[0], SUN[1], 46, '#ffe9b0', 0.34, 5, 1.5);
    for (let y = -11; y <= 11; y++) for (let x = -11; x <= 11; x++) { const d = Math.hypot(x, y); if (d <= 9.5) P(SUN[0] + x, SUN[1] + y, d > 7.5 ? '#eec677' : '#f9e2a2'); }
  });
  const clouds = [];
  for (let i = 0; i < PL.cloudN; i++) { const row = i % 3, w = [250, 170, 110][row] + Math.floor(rnd() * 40), h = [36, 26, 18][row]; clouds.push({ spr: cloudSprite(w, h, seed * 7 + i * 3 + variant + 90, PL.cloud), y: [8, 40, 80][row] + Math.floor(rnd() * 24), v: [3, 5, 7.4][row], x0: rnd() * 900, w }); }

  // ---- far: dry hills and a hazy skyline behind the spans
  const FARL = layer(W, H, g => {
    let x = 250; while (x < 520) { const w = 14 + Math.floor(rnd() * 22); drawTower(g, { x, w, top: 176 + Math.floor(rnd() * 40), bot: 270, jag: 8, seed: x + 4, pal: { wall: mixAll(PL.conc, hz, 0.72), dark: fog(PL.dark, 0.72), glass: [fog('#2a4548', 0.72), fog('#7aa597', 0.72)], lit: fog('#f3d58c', 0.6), moss: mixAll(PL.moss, hz, 0.72), rust: fog(PL.rust, 0.72) }, win: { sx: 5, sy: 7, ww: 2, wh: 3, x0: 2, y0: 5 }, pitch: 6, flip: x > SUN[0] - 40, winC: 0.5, glow: 0.5 }); x += w - 3 + Math.floor(rnd() * 8); }
    for (const [amp, f, y0, sd] of [[34, 0.7, 238, 3], [26, 0.5, 256, 6]]) for (let xx = 0; xx < W; xx++) { const top = Math.round(y0 - fbm(xx * 0.006, sd, seed, 3) * amp - Math.sin(xx * 0.01 + sd) * 4); R(xx, top, 1, 300 - top, fog(PL.hill[1], f)); P(xx, top, fog(PL.hill[0], f - 0.1)); if (hash(xx, sd, seed) > 0.8) P(xx, top + 2, fog(PL.hill[2], f)); }
    band(g, 190, 280, hz, 0.4);
  });

  // ---- the road, the dry hills in front of it
  const GRND = layer(W, H, g => {
    for (let y = 262; y < H; y++) for (let x = 0; x < W; x++) {
      const n = fbm(x * 0.03, y * 0.06 + seed, seed, 3), f = (y - 262) / (H - 262), onRoad = y >= 292 && y < 338;
      let c = onRoad ? mix(PL.road[1], PL.road[n > 0.55 ? 0 : 2], 0.28) : PL.hill[n > 0.56 ? 0 : n > 0.4 ? 1 : 2];
      if (!onRoad && hash(x, y, seed) > 0.93) c = PL.hill[(x + y) % 3];
      if (onRoad && Math.abs(y - 314) < 1 && ((x >> 4) & 1)) c = '#b8ad84';
      P(x, y, c);
    }
    for (let k = 0; k < 140; k++) { const x = Math.floor(rnd() * W), y = 292 + Math.floor(rnd() * 44); const l = 3 + Math.floor(rnd() * 12); for (let q = 0; q < l; q++) P(x + q, y + Math.round(Math.sin(q * 0.8) * 1.2), PL.road[2]); }
    band(g, 262, 300, hz, 0.34);
  });

  // ---- the stacked overpasses
  const slab = (g, x0, x1, y, th, sd) => {
    for (let x = x0; x < x1; x++) for (let j = 0; j < th; j++) {
      const lf = (x - x0) / (x1 - x0), tone = j === 0 ? 0.95 : j < 3 ? 0.55 + lf * 0.2 : 0.18 + (hash(x, j, sd) - 0.5) * 0.12 + (th - j < 3 ? -0.08 : 0);
      const tt = clamp(tone, 0, 0.999) * 2, i0 = Math.floor(tt), lvl = Math.round((tt - i0) * 4) / 4 * 16;
      P(x, y + j, PL.conc[2 - (lvl > bay(x, y + j) ? i0 + 1 : i0)]);
    }
    for (let x = x0 + 18; x < x1; x += 38) { R(x, y + 3, 1, th - 4, PL.conc[2]); }
    for (let x = x0; x < x1; x++) if (hash(x, sd, 3) > 0.55) { const l = 2 + Math.floor(hash(x, sd, 4) * 7); for (let q = 0; q < l; q++) P(x, y + th + q, hash(x, q, 5) > 0.45 ? PL.conc[2] : PL.rust); }   // stains and hanging rebar ends
    for (let k = 0; k < (x1 - x0) / 14; k++) { const rx = x0 + 3 + Math.floor(hash(k, sd, 8) * (x1 - x0 - 6)), hl = 6 + Math.floor(hash(k, sd, 9) * 16); for (let q = 0; q < hl; q++) P(rx + Math.round(Math.sin(q * 0.4 + k) * 1.5), y + th + q, q > hl - 4 ? PL.rust : PL.dark); }
  };
  const rail = (g, x0, x1, y) => { for (let x = x0; x < x1; x += 4) if (hash(x, y, 2) > 0.18) R(x, y - 6, 1, 6, PL.metal[1]); R(x0, y - 6, x1 - x0, 1, PL.metal[0]); for (let x = x0; x < x1; x++) if (hash(x, y, 3) > 0.9) R(x, y - 6, 1, 1, PL.dark); };
  const pillar = (g, x, y0, y1, w) => { for (let y = y0; y < y1; y++) for (let i = 0; i < w; i++) { const f = i / w, tone = clamp(0.2 + 0.6 * f + (hash(i, y >> 2, 4) - 0.5) * 0.2, 0, 0.999) * 2, i0 = Math.floor(tone), lvl = Math.round((tone - i0) * 4) / 4 * 16; P(x + i, y, PL.conc[2 - (lvl > bay(x + i, y) ? i0 + 1 : i0)]); } R(x - 2, y1 - 6, w + 4, 6, PL.conc[1]); R(x - 2, y0, w + 4, 3, PL.conc[2]); };
  const SPANS = layer(W, H, g => {
    // lower deck first (behind), then pillars, then the upper deck
    pillar(g, 520, 154, GROUND, 16); pillar(g, 596, 154, GROUND, 16); pillar(g, 224, 154, GROUND, 14);
    slab(g, 170, 392, 138, 16, 5); slab(g, 440, 660, 138, 16, 6); rail(g, 170, 392, 138); rail(g, 440, 660, 138);
    // a chunk of the lower deck lies fallen against the pillar
    FPOLY([[392, 138], [412, 150], [420, 280], [392, 280]], PL.conc[1]); FPOLY([[392, 138], [412, 150], [414, 154], [394, 142]], PL.conc[0]); for (let k = 0; k < 7; k++) LN(396 + k * 3, 140 + k, 394 + k * 2, 168 + k * 3, PL.dark, 1);
    for (const x of [28, 118, 208, 298]) pillar(g, x, 76, GROUND, 14);
    slab(g, -20, 380, 60, 16, 7); rail(g, -20, 380, 60);
    // the broken end of the upper deck hangs from its rebar
    FPOLY([[380, 60], [380, 76], [452, 150], [452, 136]], PL.conc[1]); FPOLY([[380, 60], [452, 136], [450, 140], [378, 64]], PL.conc[0]); for (let k = 0; k < 12; k++) LN(380 + k * 2, 70, 386 + k * 4, 92 + k * 4, PL.dark, 1);
    // cars: rows on the decks, one hanging off the edge, a long line on the road
    for (let k = 0; k < 7; k++) drawCar(6 + k * 62 + Math.floor(hash(k, 3, seed) * 14), 318 + (k % 2) * 4, { len: 38 + (k % 3) * 4, h: 13, pal: PL.car, seed: 20 + k, flip: k % 3 === 1 });
    // ivy waterfalls and moss everywhere
    g.globalCompositeOperation = 'source-atop';
    ivy(-20, 56, 400, 36, PL.leaf, 41, (x, y) => 0.12 + 0.35 * (1 - smooth(0, 18, y)), 0.5);
    ivy(168, 134, 500, 30, PL.leaf, 42, (x, y) => 0.1 + 0.3 * (1 - smooth(0, 16, y)), 0.5);
    for (const x of [28, 118, 208, 298, 224, 520, 596]) ivy(x - 2, 80, 18, 220, PL.leaf, x, (xx, y) => 0.16 + 0.55 * smooth(110, 214, y) + 0.3 * (1 - smooth(0, 60, y)), 0.5);
    glow(SUN[0] - 60, 120, 330, PL.warm, 0.3, 5, 1.2);
    band(g, 86, 140, mix(PL.dark, hz, 0.4), 0.3, 4);
    g.globalCompositeOperation = 'source-over';
    for (const [x0, x1, y] of [[-20, 380, 60], [170, 392, 138], [440, 660, 138]]) for (let x = x0; x < x1; x += 7) g.drawImage(foliage(10 + Math.floor(rnd() * 8), 7, PL.leaf, x, { maxR: 3 }), x - 4, y - 8 - Math.floor(rnd() * 3));
    for (const [x, y, fl, sd, l] of [[20, 60, false, 1, 40], [74, 60, true, 2, 38], [130, 60, false, 3, 42], [250, 60, true, 4, 40], [196, 138, false, 5, 36], [470, 138, true, 6, 38], [566, 138, false, 7, 40], [620, 138, true, 8, 34]]) drawCar(x, y, { len: l, h: 13, pal: PL.car, seed: sd, flip: fl });
  });
  const trees = [], vines = [];
  for (const [x, y, cw, ch, th, s, lean] of [[70, 60, 46, 32, 12, 1, 3], [250, 60, 50, 34, 14, 2, -3], [330, 60, 36, 26, 8, 3, 2], [250, 138, 40, 28, 8, 4, -2], [560, 138, 56, 36, 12, 5, 3], [640, 138, 40, 28, 8, 6, -3]]) {
    const spr = tree({ canopyW: cw, canopyH: ch, trunkH: th, trunkW: 3, pal: PL.leaf, trunk: PL.trunk, seed: s + 100, lean, branches: 3 }); trees.push({ spr, x: x - (spr.width >> 1), y: y + 2 - spr.height, o: { amp: 3, anchor: 'bottom', phase: s * 0.5, pow: 1.1 } });
  }
  for (const [x, y, w, h, s] of [[16, 76, 24, 70, 1], [66, 76, 20, 52, 2], [146, 76, 26, 84, 3], [230, 76, 22, 60, 4], [330, 76, 24, 90, 5], [196, 154, 22, 70, 6], [262, 154, 24, 56, 7], [470, 154, 26, 88, 8], [540, 154, 20, 64, 9], [620, 154, 24, 80, 10]]) vines.push({ spr: vineCurtain(w, h, PL.vine, s + 110, { band: 4 }), x, y, o: { amp: 5, anchor: 'top', phase: s * 0.7 } });
  const sign = layer(34, 22, () => { R(0, 3, 34, 16, '#2f5a46'); R(0, 3, 34, 1, '#5a8a6e'); R(0, 18, 34, 1, '#1d3a2d'); R(1, 4, 32, 1, '#e8e4cc'); for (let i = 3; i < 30; i++) if (hash(i, 7, 2) > 0.3) R(i, 8, 1, 3, '#e8e4cc'); for (let i = 5; i < 22; i++) if (hash(i, 9, 2) > 0.4) R(i, 13, 1, 2, '#cfd6bc'); R(4, 0, 1, 4, '#2b2f30'); R(29, 0, 1, 4, '#2b2f30'); for (let k = 0; k < 14; k++) P(Math.floor(hash(k, 1, 8) * 34), 3 + Math.floor(hash(k, 2, 8) * 16), PL.rust); });

  const tuftP = PL.straw, wild = [0, 1, 2, 3].map(k => grassTuft(34, 16 + k * 4, tuftP, 150 + k, { dens: 1.2, flowers: ['#e9e4c2', '#a4bbd6', '#d6b25a'], lean: 8 }));
  const GRASS = layer(W, H, g => { for (let x = -6; x < W; x += 7 + Math.floor(rnd() * 12)) { const f = Math.floor(rnd() * 4), y = 270 + Math.floor(Math.pow(rnd(), 0.8) * 90); if (y > 288 && y < 334 && rnd() > 0.15) continue; g.drawImage(wild[f], x, y - wild[f].height + 3); } });
  const tallL = grassTuft(120, 56, tuftP, 160, { dens: 1.3, lean: 9, flowers: ['#e9e4c2', '#a4bbd6'] }), tallR = grassTuft(110, 50, tuftP, 161, { dens: 1.3, lean: 9, flowers: ['#e9e4c2'] });
  const weed = layer(14, 14, () => { for (let a = 0; a < 40; a++) { const an = a / 40 * TAU * 3; P(7 + Math.round(Math.cos(an) * (2 + a / 8)), 7 + Math.round(Math.sin(an * 1.3) * (2 + a / 8)), a % 3 === 0 ? PL.straw[2] : PL.straw[1]); } });

  const shafts = [];
  { const mk = (ang, w0, spread, len, a) => shafts.push({ ox: SUN[0], oy: SUN[1], ang, w0, spread, len, a, mask: (x, y) => 1 - 0.55 * smooth(140, 190, y) * (1 - smooth(250, 300, y)) }); mk(2.1, 10, 0.16, 460, 0.9); mk(2.35, 14, 0.18, 600, 0.8); mk(2.6, 10, 0.16, 640, 0.7); mk(2.85, 14, 0.2, 640, 0.5); mk(1.85, 8, 0.12, 380, 0.5); mk(3.0, 10, 0.16, 600, 0.4); for (const s of shafts) s.spr = shaftLayer(s, '#ffe3a2', PL.shaftA); }
  const shaftGroups = [0, 1].map(k => [0.62, 0.82, 1].map(a => { const c = mkCanvas(W, H), gg = c.getContext('2d'); gg.globalCompositeOperation = 'lighter'; gg.globalAlpha = a; shafts.forEach((s, i) => { if (i % 2 === k) gg.drawImage(s.spr, 0, 0); }); return fast(c); }));
  const mistA = mistSprite(W, 70, seed + 5, PL.mist, PL.mistA[0], PL.mistA[1], 0.012, 0.07), mistB = mistSprite(W, 56, seed + 8, PL.mist, PL.mistA[0], PL.mistA[1], 0.016, 0.09);
  const VIG = vignetteLayer(PL.vig, PL.vigA);
  const fgTop = [{ spr: foliage(110, 30, [PL.leaf[2], PL.leaf[3], PL.leaf[4], mix(PL.leaf[4], '#000', 0.4), '#07110f'], 71, { maxR: 8 }), x: 540, y: -16 }];
  const FARLF = fast(FARL), GRNDF = fast(GRND), SPANSF = fast(SPANS), GRASSF = fast(GRASS), VIGF = fast(VIG);
  const horseCol = { ...PL.horse }; for (const k in horseCol) horseCol[k] = mix(horseCol[k], hz, 0.14);
  const deerCol = { body: fog('#6b5c42', 0.3), belly: fog('#938360', 0.3), dark: fog('#443a2a', 0.3), back: fog('#5b4d38', 0.3), rump: fog('#ac9a7a', 0.3), antler: fog('#4a4030', 0.3) };
  const perch = [[20, 52], [74, 52], [250, 52], [196, 130], [560, 130]];

  function draw(g, t) {
    g.imageSmoothingEnabled = false; use(g);
    g.drawImage(SKY, 0, 0);
    for (const c of clouds) { const span = W + c.w + 40, x = Math.round(((c.x0 + t * c.v / 1000) % span) - c.w - 20); g.drawImage(c.spr, x, c.y); }
    FARLF.draw(g);
    flock(g, t, { y: 66, n: 9, col: PL.birds, seed: 5, t0: 4000, cycle: 44000, dur: 17000, rise: 10 });
    GRNDF.draw(g);
    drawDeerC(g, 560, 296, { col: deerCol, dir: -1, head: 0.1 + (Math.floor(t / 6000) % 3 === 0 ? 0.8 : 0) });
    SPANSF.draw(g);
    for (const s of vines) swaySprite(g, s.spr, s.x, s.y, t, s.o);
    for (const s of trees) swaySprite(g, s.spr, s.x, s.y, t, s.o);
    // the gantry sign swinging from one bolt, and a loose cable
    g.fillStyle = '#2b2f30'; g.fillRect(332, 76, 40, 2); g.fillRect(332, 76, 2, 4);
    drawSwing(g, sign, 4, 0, 338, 77, Math.sin(t * 0.0011) * 0.2 + wind(338, t) * 0.1);
    drawCable(g, t, 452, 138, 462, 188, 5, '#1b1f20', 3, 1); drawCable(g, t, 390, 76, 396, 116, 4, '#1b1f20', 2.4, 3);
    perched(g, t, perch.map(([x, y]) => [x, y]), PL.birds, 34000, seed);
    GRASSF.draw(g);
    swaySprite(g, tallL, 8, 340, t, { amp: 4, anchor: 'bottom', phase: 0.5 }); swaySprite(g, tallR, 520, 346, t, { amp: 4, anchor: 'bottom', phase: 2.2 }); swaySprite(g, tallL, 290, 356, t, { amp: 3, anchor: 'bottom', phase: 3.4 });
    // the herd: six horses, one foal-sized lagging, walking out from under the spans along the road verge (60 s cycle)
    { const cyc = 72000, u = ((t + 6000) % cyc) / cyc * 1.55; if (u <= 1) for (let k = 0; k < 6; k++) { const x = -40 + u * (W + 110) - k * 30 - (k % 2) * 8, st = t * 0.0064 + k * 1.1; drawHorseC(g, Math.round(x), 344 + (k % 3) * 4, { col: horseCol, dir: 1, head: k === 3 ? 0.2 : 0.75, walk: st }); } }
    if (PL.dust) { const u = ((t * 0.00005) % 1), wx = -20 + u * (W + 40); g.drawImage(weed, Math.round(wx), 322 + Math.round(Math.abs(Math.sin(t * 0.004)) * -4)); }
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 2; k++) { const v = 0.5 + 0.5 * Math.sin(t * 0.00055 + k * 2.1); shaftGroups[k][Math.min(2, Math.floor(v * 3))].draw(g); }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    motes(g, t, shafts, { n: 40, seed: 3, col: '#fff0c4', calm, a: 0.8 });
    drawTiled(g, mistA, 226, t, 5, 0); drawTiled(g, mistB, 276, t, -7, 100);
    leaves(g, t, { n: 12, seed: 8, cols: PL.leafCols, calm, drift: 90 });
    if (PL.dust) { streaks(g, t, { n: 46, seed: 2, col: '#d8c690', y0: 150, y1: 345, a: 0.3, speed: 1.4 }); }
    for (const f of fgTop) g.drawImage(f.spr, f.x, f.y);
    VIGF.draw(g);
  }
  const scene = { id, name, variant, variantName: variants[variant] || variants[0], variants, draw };
  { const wc = mkCanvas(W, H), wg = wc.getContext('2d'); for (const tt of [0, 5000, 14800]) draw(wg, tt); }
  return scene;
}
