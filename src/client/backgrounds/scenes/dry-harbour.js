// ============================================================================
//  dry-harbour - the sea has pulled back and left a harbour on the seabed: a huge freighter beached on the
//  mud with trees growing on its deck, leaning gantry cranes, stacked containers, tidal pools, gulls, and,
//  far out on the retreating sea, a whale that breaches now and then (the wonder moment).
//  Variants: 0 clear morning at low tide, 1 storm light (rain, distant muted lightning, whitecaps).
//  Interface: create(seed, variant) -> { id, name, variantName, draw(ctx, timeMs) }
// ============================================================================
import {
  W, H, use, P, R, LN, FPOLY, ELLpx, hash, mulberry32, bay, TAU, layer, mix, mixAll, clamp, fbm, smooth,
  gradV, expandRamp, glow, shaftLayer, cloudSprite, mistSprite, drawTiled, flock, perched, motes, rain, lightning, vignetteLayer, calmFn,
  swaySprite, wind, fast, mkCanvas, waterSparkle, ripples,
} from '../lib.js';
import { foliage, tree, vineCurtain, grassTuft, ivy, drawSwing, drawCable, container, drawPigeonC } from '../art.js';

export const id = 'dry-harbour';
export const name = 'Dry Harbour';
export const variants = ['clear morning, low tide', 'storm light'];

const HZ = 188, MUD = 226, SUN = [532, 132];

const PAL = [
  {
    sky: ['#3f7d9c', '#6fa6b4', '#a9cbc0', '#e4dfae', '#f3cf8e'], haze: '#b9cfc2', warm: '#f6d894', glowA: 0.5, sun: true,
    cloud: { hi: '#f6dca0', mid: '#b6cfc6', lo: '#6f9ca6' }, cloudN: 6, sea: ['#6aa6ae', '#4a8892', '#2f6676'], seaHi: '#e9f1d4', seaLine: '#a9d0cc',
    hull: ['#5f7a84', '#435a65', '#27383f'], oxide: ['#a8624a', '#7f4234', '#4f2820'], house: ['#dadcce', '#adb1a6', '#6f7873'], metal: ['#8d7662', '#5e4c40', '#352c28'], rust: '#8b5232',
    conts: [['#7fa39d', '#5d8680', '#3a5a57'], ['#c2a468', '#9c8048', '#6a5530'], ['#a8664e', '#824a3a', '#552e25'], ['#8fa078', '#6c7e58', '#46553a']],
    moss: ['#b2c75a', '#729a40', '#40673a'], leaf: ['#b8cf5e', '#82b04a', '#52803e', '#325a38', '#1c3c33'], trunk: ['#7a6548', '#4f4132', '#2f281f'],
    vine: { stem: ['#2b4a30', '#41663a'], leaf: ['#a8c456', '#66963f', '#3a6339'], flower: ['#eadfa6', '#dcd9c6', '#a4bbd6'] },
    mud: ['#a39a74', '#82795c', '#5d5843'], pool: ['#b4d6d2', '#86b8bd', '#4f858f'], straw: ['#d2c878', '#a99e52', '#7c7840', '#4f5530'],
    gull: '#e6ece8', gullFar: '#bcc8c6', rain: false, bolt: false, mist: '#f0e6b8', mistA: [0.05, 0.1], shaft: '#ffe9b0', shaftA: 0.22, vig: '#0c1a1a', vigA: 0.5,
    whale: ['#3d5a68', '#2b4350', '#a9c0c2'],
  },
  {
    sky: ['#243640', '#39525e', '#587478', '#86a09a', '#b2bba8'], haze: '#8fa6a2', warm: '#b9c7bd', glowA: 0.2, sun: false,
    cloud: { hi: '#8fa4a4', mid: '#617a80', lo: '#3c5560' }, cloudN: 9, sea: ['#4a7480', '#355a68', '#224451'], seaHi: '#d8e4de', seaLine: '#8fb0b0',
    hull: ['#52707a', '#3a5360', '#233640'], oxide: ['#8f5440', '#6e382c', '#44231d'], house: ['#bfc4b8', '#939a94', '#5c6663'], metal: ['#7d6a5a', '#54463c', '#30292a'], rust: '#7d4c34',
    conts: [['#6f948f', '#52756f', '#35504c'], ['#aa9058', '#887040', '#5c4a2c'], ['#98583f', '#74402f', '#4a2a22'], ['#7f9068', '#5f7049', '#3e4c32']],
    moss: ['#9ac45a', '#609c42', '#366838'], leaf: ['#9cc55c', '#65a049', '#407e3f', '#2a5a38', '#193a33'], trunk: ['#6a5c4a', '#463d33', '#2b2620'],
    vine: { stem: ['#2b4a30', '#3f6638'], leaf: ['#98c45a', '#63a043', '#38683a'], flower: ['#e0e2c4', '#cfd9d6', '#9db7d2'] },
    mud: ['#7f7a62', '#625e4a', '#45433a'], pool: ['#8aa8ac', '#628891', '#3d636e'], straw: ['#b5ae6c', '#8c8a4c', '#66693a', '#434b2c'],
    gull: '#2a3a40', gullFar: '#4a5e62', rain: true, bolt: true, mist: '#c8d6d0', mistA: [0.12, 0.22], shaft: '#d8e6e0', shaftA: 0.08, vig: '#081416', vigA: 0.62,
    whale: ['#2f4854', '#223742', '#7f9a9e'],
  },
];
function band(g, y0, y1, col, maxA, steps = 5) {
  const [r_, g_, b_] = [parseInt(col.slice(1, 3), 16), parseInt(col.slice(3, 5), 16), parseInt(col.slice(5, 7), 16)];
  for (let lv = 1; lv <= steps; lv++) {
    g.fillStyle = 'rgba(' + r_ + ',' + g_ + ',' + b_ + ',' + (maxA * lv / steps).toFixed(3) + ')';
    for (let y = Math.min(y0, y1); y < Math.max(y0, y1); y++) { const t = clamp((y - y0) / (y1 - y0), 0, 1); for (let x = 0; x < W; x++) if (Math.floor(t * steps + bay(x, y) / 16) === lv) g.fillRect(x, y, 1, 1); }
  }
}
// hull outline: deck line and keel line as functions of x
const hullTop = x => (x < 34 ? 176 - (34 - x) * 1.1 : 176 + (x - 34) * 0.07);
const hullBot = x => (x < 88 ? 270 - Math.pow((88 - x) / 76, 0.85) * (270 - 152) : 270 + (x - 88) * 0.06);
const HX0 = 12, HX1 = 338;

export function create(seed = 1, variant = 0) {
  const PL = PAL[variant] || PAL[0], hz = PL.haze, rnd = mulberry32(seed * 887 + variant * 17 + 3), calm = calmFn(105, 300, 0.3);
  const fog = (c, f) => mix(c, hz, f);

  const SKY = layer(W, H, g => {
    gradV(0, 0, W, HZ + 2, expandRamp(PL.sky, 16), 4); R(0, HZ + 1, W, H - HZ, PL.sky[4]);
    glow(SUN[0], SUN[1], PL.sun ? 220 : 260, PL.warm, PL.glowA * (PL.sun ? 0.7 : 1), 6, 1.6);
    if (PL.sun) { glow(SUN[0], SUN[1], 44, '#ffe9b0', 0.34, 5, 1.5); for (let y = -11; y <= 11; y++) for (let x = -11; x <= 11; x++) { const d = Math.hypot(x, y); if (d <= 9.5) P(SUN[0] + x, SUN[1] + y, d > 7.5 ? '#eec677' : '#fcebb8'); } }
  });
  const clouds = [];
  for (let i = 0; i < PL.cloudN; i++) { const row = i % 3, w = [250, 170, 110][row] + Math.floor(rnd() * 40), h = [38, 26, 18][row]; clouds.push({ spr: cloudSprite(w, h, seed * 5 + i * 3 + variant + 40, PL.cloud), y: [6, 40, 80][row] + Math.floor(rnd() * 24), v: [3.4, 5.2, 7.6][row], x0: rnd() * 900, w }); }

  // ---- far: the retreated sea, low hills, ship wrecks on the horizon
  const FARL = layer(W, H, g => {
    gradV(0, HZ, W, MUD - HZ + 10, expandRamp(PL.sea, 8), 4);
    for (let x = 0; x < W; x++) { const top = Math.round(HZ - 4 - fbm(x * 0.012, 3, seed, 3) * 22 * smooth(250, 520, x) - (x > 560 ? (x - 560) * 0.08 : 0)); if (x > 250) { R(x, top, 1, HZ - top + 1, fog('#3d5a52', 0.66)); P(x, top, fog('#6f8a66', 0.62)); } }
    // wrecks standing on the horizon
    for (const [x, w, h] of [[300, 40, 9], [560, 52, 11]]) { FPOLY([[x, HZ + 2], [x + 4, HZ - h], [x + w - 6, HZ - h + 1], [x + w, HZ + 2]], fog(PL.hull[2], 0.55)); R(x + w - 18, HZ - h - 7, 8, 7, fog(PL.house[1], 0.6)); }
    for (let x = 0; x < W; x += 2) if (hash(x, 3, seed) > 0.5) P(x, HZ + 1, mix(PL.sea[0], PL.seaHi, 0.4));
    band(g, HZ - 16, HZ + 10, hz, 0.34);
  });

  // ---- the exposed seabed: cracked mud, ripple marks, tidal pools
  const pools = [[104, 316, 70, 10], [262, 304, 96, 12], [436, 334, 84, 11], [580, 312, 54, 9], [30, 340, 50, 8]];
  const GROUND = layer(W, H, g => {
    for (let y = MUD; y < H; y++) for (let x = 0; x < W; x++) {
      const f = (y - MUD) / (H - MUD), n = fbm(x * 0.04, y * 0.09 + seed, seed, 3), r = Math.sin((x * 0.2 + y * 1.3) + n * 6) * 0.5 + 0.5;
      let c = PL.mud[n > 0.56 ? 0 : n > 0.42 ? 1 : 2]; if (r > 0.9 && f > 0.15) c = mix(c, PL.mud[0], 0.5); if (hash(x, y, seed) > 0.96) c = PL.mud[2];
      P(x, y, c);
    }
    for (let k = 0; k < 120; k++) { const y = MUD + 6 + Math.floor(Math.pow(rnd(), 0.8) * (H - MUD - 8)), x = Math.floor(rnd() * W), l = 3 + Math.floor(rnd() * 9); R(x, y, l, 1, PL.mud[2]); R(x + l, y + 1, 2, 1, PL.mud[2]); }
    for (const [cx, cy, rx, ry] of pools) {
      ELLpx(cx, cy, rx + 2, ry + 2, (x, y) => P(x, y, mix(PL.mud[2], '#000000', 0.2)));
      ELLpx(cx, cy, rx, ry, (x, y, nx, ny) => P(x, y, ny < -0.35 ? PL.pool[0] : ny < 0.25 ? PL.pool[1] : PL.pool[2]));
      for (let q = 0; q < rx; q++) if (hash(q, cx, seed) > 0.7) P(cx - rx + q * 2, cy - ry + 1, PL.seaHi);
    }
    band(g, MUD, MUD + 40, hz, 0.42);
  });

  // ---- the freighter
  const trees = [], vines = [];
  const SHIP = layer(W, H, g => {
    const lit = x => (x - HX0) / (HX1 - HX0);
    for (let x = HX0; x < HX1; x++) {
      const t0 = Math.round(hullTop(x)), b0 = Math.round(hullBot(x)), boot = b0 - 40 + Math.round(Math.sin(x * 0.05) * 2);
      for (let y = t0; y < b0; y++) {
        const down = y >= boot, ramp = down ? PL.oxide : PL.hull, f = lit(x) * 0.7 + 0.12 + (hash(x, y, seed) - 0.5) * 0.12 + (down ? 0 : (1 - (y - t0) / Math.max(1, b0 - t0)) * 0.08);
        const tone = clamp(f, 0, 0.999) * 2, i0 = Math.floor(tone), lvl = Math.round((tone - i0) * 2) / 2 * 16;
        P(x, y, ramp[2 - (lvl > bay(x, y) ? i0 + 1 : i0)]);
      }
      R(x, boot - 1, 1, 2, '#c9c2a4'); P(x, t0, PL.hull[0]);
    }
    // rust streaks, portholes, plating lines
    for (let k = 0; k < 90; k++) { const x = HX0 + 16 + Math.floor(hash(k, 1, seed) * (HX1 - HX0 - 20)), y = Math.round(hullTop(x)) + 2 + Math.floor(hash(k, 2, seed) * 30), l = 4 + Math.floor(hash(k, 3, seed) * 26); for (let q = 0; q < l; q++) if (y + q < hullBot(x) - 40) P(x, y + q, hash(x, q, 5) > 0.35 ? PL.rust : PL.oxide[1]); }
    for (let x = HX0 + 40; x < HX1 - 8; x += 11) { const y = Math.round(hullTop(x)) + 12; ELLpx(x, y, 2, 2, (px, py) => P(px, py, PL.hull[2])); P(x, y - 1, PL.hull[0]); }
    for (let x = HX0 + 24; x < HX1; x += 40) R(x, Math.round(hullTop(x)) + 1, 1, 60, PL.hull[2]);
    // deck: containers, rail, the bridge house and funnel at the stern
    const dk = x => Math.round(hullTop(x));
    let cx = 96; const cols = PL.conts;
    for (let col = 0; col < 5; col++, cx += 25) { const hgt = 1 + (col % 3 === 0 ? 2 : col % 2); for (let r = 0; r < hgt; r++) container(g, cx, dk(cx) - 10 * (r + 1) + 1, 24, 10, cols[(col + r * 2) % 4], col * 7 + r); }
    for (let x = HX0 + 22; x < 262; x += 3) { R(x, dk(x) - 5, 1, 5, PL.metal[1]); } R(HX0 + 22, dk(HX0 + 22) - 5, 240, 1, PL.metal[1]);
    const bx = 276, by = dk(bx);
    R(bx, by - 62, 56, 62, PL.house[1]); R(bx + 44, by - 62, 12, 62, PL.house[0]); R(bx, by - 62, 3, 62, PL.house[2]); R(bx - 3, by - 64, 62, 3, PL.house[2]);
    for (let r = 0; r < 4; r++) for (let q = 0; q < 6; q++) { R(bx + 5 + q * 8, by - 56 + r * 14, 5, 7, hash(q, r, seed) > 0.8 ? PL.hull[0] : '#1f2c30'); R(bx + 5 + q * 8, by - 56 + r * 14, 5, 1, PL.hull[0]); }
    R(bx + 12, by - 92, 16, 28, PL.oxide[1]); R(bx + 12, by - 92, 16, 3, '#1c1d1c'); R(bx + 24, by - 92, 4, 28, PL.oxide[0]); R(bx + 12, by - 80, 16, 2, '#c9c2a4');
    R(bx + 36, by - 100, 1, 36, PL.metal[1]); R(bx + 30, by - 94, 14, 1, PL.metal[1]); R(bx + 33, by - 100, 8, 2, PL.metal[2]);
    for (let k = 0; k < 30; k++) { const x = bx + 2 + Math.floor(hash(k, 1, 9) * 52), y = by - 60 + Math.floor(hash(k, 2, 9) * 50), l = 3 + Math.floor(hash(k, 3, 9) * 12); for (let q = 0; q < l; q++) P(x, y + q, PL.rust); }
    // the propeller half buried at the stern
    for (let a = 0; a < 3; a++) { const an = -1.2 + a * 1.3; FPOLY([[HX1 - 2, 266], [HX1 + 5 + Math.cos(an) * 20, 266 + Math.sin(an) * 20], [HX1 + 8 + Math.cos(an + 0.3) * 18, 266 + Math.sin(an + 0.3) * 18]], PL.metal[1]); }
    // moss on every ledge, ivy over the hull and the house
    g.globalCompositeOperation = 'source-atop';
    ivy(HX0, 140, HX1 - HX0, 150, PL.leaf, 11, (x, y) => 0.22 + 0.5 * (1 - smooth(0, 40, y)) + 0.35 * smooth(120, 150, y), 0.5);
    glow(SUN[0] - 80, 150, 340, PL.warm, PL.sun ? 0.3 : 0.05, 5, 1.2);
    band(g, 168, 240, mix('#101c1e', hz, 0.3), 0.26, 4);
    g.globalCompositeOperation = 'source-over';
    for (let x = HX0 + 6; x < 270; x += 9) g.drawImage(foliage(12 + Math.floor(rnd() * 8), 8, PL.leaf, x, { maxR: 3 }), x - 5, dk(x) - 10 - (x > 100 ? 8 : 0));
  });
  for (const [x, cw, ch, th, s, lean] of [[60, 48, 34, 14, 1, 4], [120, 40, 28, 6, 2, -3], [178, 52, 36, 8, 3, 3], [240, 36, 26, 6, 4, -2]]) {
    const spr = tree({ canopyW: cw, canopyH: ch, trunkH: th, trunkW: 3, pal: PL.leaf, trunk: PL.trunk, seed: s + 60, lean, branches: 3 });
    trees.push({ spr, x: x - (spr.width >> 1), y: Math.round(hullTop(x)) - (s === 2 ? 22 : s === 3 ? 12 : 0) + 3 - spr.height, o: { amp: 3, anchor: 'bottom', phase: s * 0.5, pow: 1.1 } });
  }
  for (const [x, w, h, s] of [[40, 22, 52, 1], [96, 24, 70, 2], [150, 20, 56, 3], [206, 24, 62, 4], [262, 22, 48, 5], [322, 20, 66, 6]]) vines.push({ spr: vineCurtain(w, h, PL.vine, s + 70, { band: 4 }), x: x - (w >> 1), y: Math.round(hullTop(x)) + 1, o: { amp: 4, anchor: 'top', phase: s * 0.7 } });

  // ---- gantry cranes and the container heap on the right
  const hookPts = [[498, 98], [562, 100]];
  const CRANES = layer(W, H, g => {
    const col = fog(PL.metal[2], 0.28), colHi = fog(PL.metal[0], 0.3);
    const leg = (x0, x1, y0, y1) => { LN(x0, y0, x1, y1, col, 3); LN(x0 + 5, y0, x1 + 5, y1, col, 2); for (let y = y1 + 8; y < y0; y += 12) { const t = (y - y1) / (y0 - y1); LN(x1 + (x0 - x1) * t, y, x1 + (x0 - x1) * t + 5, y - 12, col, 1); LN(x1 + (x0 - x1) * t + 5, y, x1 + (x0 - x1) * t, y - 12, col, 1); } };
    leg(468, 484, 292, 86); leg(552, 540, 292, 86);
    R(478, 84, 76, 4, col); R(478, 84, 76, 1, colHi);
    LN(484, 84, 396, 62, col, 3); LN(484, 78, 396, 58, col, 1); for (let i = 0; i < 88; i += 8) LN(484 - i, 84 - i * 0.25, 484 - i - 4, 78 - i * 0.25 - 4, col, 1);
    LN(540, 86, 640, 70, col, 2); R(396, 56, 6, 10, col);
    // the far boom has snapped and droops
    LN(396, 62, 372, 100, col, 2);
    R(500, 62, 22, 22, mix(col, PL.house[2], 0.3)); R(504, 66, 8, 7, '#1f2c30');
    g.globalCompositeOperation = 'source-atop'; ivy(468, 80, 90, 210, PL.leaf, 31, (x, y) => 0.1 + 0.4 * smooth(0, 200, y), 0.5); g.globalCompositeOperation = 'source-over';
  });
  const HEAP = layer(W, H, g => {
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { const x = 566 + c * 25 + (r === 2 ? 12 : 0), y = 292 - (r + 1) * 11; if (r < 2 || c < 2) container(g, x, y, 24, 11, PL.conts[(r * 3 + c * 5) % 4], r * 5 + c + 40); }
    g.globalCompositeOperation = 'source-atop'; ivy(560, 250, 90, 50, PL.leaf, 33, (x, y) => 0.3 + 0.4 * smooth(0, 50, y), 0.5); g.globalCompositeOperation = 'source-over';
    for (let x = 560; x < 645; x += 7) g.drawImage(foliage(12, 8, PL.leaf, x, { maxR: 3 }), x - 4, 255 + Math.floor(rnd() * 6));
    // a rowing boat on its side, rope coil, anchor
    for (let i = 0; i < 40; i++) { const y = 312 - Math.round(Math.sin(i / 40 * Math.PI) * 9); R(120 + i, y, 1, 312 - y + 4, i % 3 === 0 ? PL.oxide[2] : PL.hull[1]); P(120 + i, y, PL.house[0]); }
    LN(250, 296, 250, 312, PL.metal[1], 2); LN(242, 304, 258, 304, PL.metal[1], 2); LN(242, 304, 246, 311, PL.metal[1], 2); LN(258, 304, 254, 311, PL.metal[1], 2);
  });
  const dune = [0, 1, 2, 3].map(k => grassTuft(34, 18 + k * 4, PL.straw, 190 + k, { dens: 1.1, flowers: ['#e9e4c2', '#b9cfe0'], lean: 8 }));
  const GRASS = layer(W, H, g => {
    for (let x = -6; x < W; x += 8 + Math.floor(rnd() * 14)) { const f = Math.floor(rnd() * 4), y = 276 + Math.floor(Math.pow(rnd(), 0.7) * 80); g.drawImage(dune[f], x, y - dune[f].height + 3); }
  });
  const tallA = grassTuft(110, 54, PL.straw, 160, { dens: 1.2, lean: 9 }), tallB = grassTuft(100, 46, PL.straw, 161, { dens: 1.2, lean: 9 });
  const flag = layer(10, 26, () => { for (let y = 0; y < 26; y++) for (let x = 0; x < 9; x++) { if (hash(x, y, 8) > 0.88 || (y > 20 && hash(x, y, 4) > 0.5)) continue; P(x, y, y < 9 ? '#b5543a' : y < 17 ? '#dcd8bc' : '#2f5f6a'); } });

  // ---- whale
  const whale = layer(52, 24, () => {
    const [d, m, belly] = PL.whale;
    for (let x = 0; x < 52; x++) { const t = x / 51, hh = Math.sin(Math.pow(t, 0.7) * Math.PI) * 9 * (t > 0.78 ? (1 - t) / 0.22 + 0.15 : 1); for (let y = -Math.round(hh); y <= Math.round(hh * 0.8); y++) { const nz = y / (hh + 0.1); P(x, 11 + y, nz > 0.25 ? (hash(x, y, 3) > 0.35 && x % 3 === 0 ? mix(belly, m, 0.4) : belly) : nz > -0.4 ? m : d); } }
    FPOLY([[46, 11], [51, 5], [50, 9], [51, 14], [51, 18], [46, 12]], d); FPOLY([[26, 14], [18, 22], [22, 15]], m);
    P(12, 8, '#0d1618');
  });
  const whaleSplash = (g, t, cx, ph) => { for (let i = 0; i < 18; i++) { const u = clamp(ph + i * 0.01, 0, 1.5); g.fillStyle = PL.seaHi; g.globalAlpha = Math.max(0, 0.8 - u * 0.5); g.fillRect(Math.round(cx - 10 + hash(i, 1, seed) * 20 + (hash(i, 2, seed) - 0.5) * u * 16), Math.round(HZ + 6 - Math.sin(Math.min(1, u) * Math.PI) * (4 + hash(i, 3, seed) * 10)), 1, 1); } g.globalAlpha = 1; };

  // ---- light, mist, vignette
  const shafts = [];
  if (PL.sun) { const mk = (ang, w0, spread, len, a) => shafts.push({ ox: SUN[0], oy: SUN[1], ang, w0, spread, len, a, mask: (x, y) => 1 - 0.55 * smooth(130, 180, y) * (1 - smooth(250, 300, y)) }); mk(2.0, 10, 0.16, 480, 0.8); mk(2.3, 14, 0.18, 600, 0.7); mk(2.6, 10, 0.16, 620, 0.6); mk(1.75, 8, 0.12, 360, 0.5); for (const s of shafts) s.spr = shaftLayer(s, '#ffe9b0', PL.shaftA); }
  const shaftGroups = shafts.length ? [0, 1].map(k => [0.62, 0.82, 1].map(a => { const c = mkCanvas(W, H), gg = c.getContext('2d'); gg.globalCompositeOperation = 'lighter'; gg.globalAlpha = a; shafts.forEach((s, i) => { if (i % 2 === k) gg.drawImage(s.spr, 0, 0); }); return fast(c); })) : [];
  const mistA = mistSprite(W, 70, seed + 9, PL.mist, PL.mistA[0], PL.mistA[1], 0.012, 0.07), mistB = mistSprite(W, 56, seed + 12, PL.mist, PL.mistA[0], PL.mistA[1], 0.016, 0.09);
  const VIG = vignetteLayer(PL.vig, PL.vigA);
  const fgTop = [{ spr: foliage(120, 34, [PL.leaf[2], PL.leaf[3], PL.leaf[4], mix(PL.leaf[4], '#000', 0.4), '#07110f'], 71, { maxR: 8 }), x: -30, y: -20 }];
  const FARLF = fast(FARL), GROUNDF = fast(GROUND), SHIPF = fast(SHIP), CRANESF = fast(CRANES), HEAPF = fast(HEAP), GRASSF = fast(GRASS), VIGF = fast(VIG);
  const perch = [[160, hullTop(160) - 2], [60, hullTop(60) - 1], [396, 56], [500, 84], [300, hullTop(300) - 62]].map(([x, y]) => [Math.round(x), Math.round(y)]);

  function draw(g, t) {
    g.imageSmoothingEnabled = false; use(g);
    g.drawImage(SKY, 0, 0);
    for (const c of clouds) { const span = W + c.w + 40, x = Math.round(((c.x0 + t * c.v / 1000) % span) - c.w - 20); g.drawImage(c.spr, x, c.y); }
    FARLF.draw(g);
    // swell lines and glints on the far sea
    g.fillStyle = PL.seaLine; for (let r = 2; r < 38; r += 3) { const k = r / 38; for (let q = 0; q < 6; q++) { const x = ((hash(q, r, seed) * W + t * (0.006 + k * 0.016) * (r % 2 ? 1 : -1) * 20) % (W + 30) + W + 30) % (W + 30) - 15; g.globalAlpha = 0.3 + k * 0.3; g.fillRect(Math.round(x), HZ + 2 + r, 4 + Math.round(k * 10), 1); } } g.globalAlpha = 1;
    waterSparkle(g, t, { wy: HZ + 2, rows: 34, seed: 4, n: PL.sun ? 36 : 14, sx: SUN[0], spread: PL.sun ? 150 : 400, hi: PL.seaHi, col: PL.seaLine, a: 0.8 });
    // the whale: one breach every 58 s, with a spout of foam where it lands
    { const cyc = 58000, c0 = (t + 14000) % cyc, dur = 3400; if (c0 < dur + 1600) { const u = c0 / dur, cx = 452 + u * 44; if (u <= 1) { const py = HZ + 6 - Math.sin(u * Math.PI) * 30, ang = -Math.cos(u * Math.PI) * 0.8; drawSwing(g, whale, 26, 12, Math.round(cx), Math.round(py), ang); } whaleSplash(g, t, u <= 1 ? cx : 496, (c0 - dur * 0.7) / 1200); whaleSplash(g, t, 452, (c0 - dur * 0.05) / 1200); } }
    GROUNDF.draw(g);
    CRANESF.draw(g);
    drawCable(g, t, 398, 62, 380 + Math.sin(t * 0.0011) * 3, 108, 4, '#1b1f20', 1.2, 0); g.fillStyle = '#1b1f20'; g.fillRect(Math.round(378 + Math.sin(t * 0.0011) * 3), 108, 5, 6);
    drawCable(g, t, 498, 84, 498 + Math.sin(t * 0.0013 + 1) * 4, 140, 3, '#1b1f20', 2, 2); g.fillRect(Math.round(496 + Math.sin(t * 0.0013 + 1) * 4), 140, 5, 7);
    SHIPF.draw(g);
    for (const s of vines) swaySprite(g, s.spr, s.x, s.y, t, s.o);
    for (const s of trees) swaySprite(g, s.spr, s.x, s.y, t, s.o);
    swaySprite(g, flag, 313, hullTop(313) - 98, t, { amp: 4, anchor: 'top', phase: 1.2, rowH: 2 });
    flock(g, t, { y: 56, n: 8, col: PL.gull, seed: 5, t0: 3000, cycle: 46000, dur: 18000, rise: 10 });
    perched(g, t, perch, PL.gullFar, 34000, seed);
    HEAPF.draw(g);
    // tidal pools: glints and slow ripples
    for (const [cx, cy, rx, ry] of pools) { for (let q = 0; q < 5; q++) { const slot = Math.floor(t / (700 + q * 230) + hash(q, cx, seed) * 40); if (hash(slot, q, cx) < 0.45) continue; g.fillStyle = PL.seaHi; g.globalAlpha = 0.7; g.fillRect(cx - rx + 4 + Math.floor(hash(slot, q, 3) * (rx * 2 - 10)), cy - ry + 1 + (q % 2) * 3, 2 + (q % 3), 1); } }
    g.globalAlpha = 1; ripples(g, t, pools.slice(0, 4).map(([cx, cy], i) => [cx + (i - 1) * 6, cy - 226 + 226 * 0 - 0, i * 900]).map(p => [p[0], 0, p[2]]).slice(0, 0), 0, PL.seaHi, 3000, 8);
    GRASSF.draw(g);
    swaySprite(g, tallA, 10, 322, t, { amp: 4, anchor: 'bottom', phase: 0.5 }); swaySprite(g, tallB, 520, 330, t, { amp: 4, anchor: 'bottom', phase: 2.2 }); swaySprite(g, tallA, 300, 346, t, { amp: 3, anchor: 'bottom', phase: 3.4 });
    if (shaftGroups.length) {
      g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 2; k++) { const v = 0.5 + 0.5 * Math.sin(t * 0.00055 + k * 2.1); shaftGroups[k][Math.min(2, Math.floor(v * 3))].draw(g); }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      motes(g, t, shafts, { n: 30, seed: 3, col: '#fff0c4', calm, a: 0.8 });
    }
    drawTiled(g, mistA, 226, t, 5, 0); drawTiled(g, mistB, 270, t, -7, 100);
    if (PL.rain) rain(g, t, { n: 130, seed: 4, col: '#cfdcd8', a: 0.45, calm: y => 0.35 + 0.65 * (1 - calm(y)) });
    if (PL.bolt) { const I = lightning(t, 8200, 3); if (I > 0) { g.fillStyle = 'rgba(214,226,224,' + (I * 0.2).toFixed(3) + ')'; g.fillRect(0, 0, W, HZ + 14); g.fillStyle = 'rgba(214,226,224,' + (I * 0.07).toFixed(3) + ')'; g.fillRect(0, HZ + 14, W, H - HZ - 14); const bx = 330 + Math.floor(hash(Math.floor(t / 8200), 1, 3) * 140); g.fillStyle = 'rgba(232,240,238,' + (I * 0.85).toFixed(3) + ')'; let x = bx; for (let y = 6; y < HZ - 2; y += 3) { x += Math.round((hash(y, bx, 3) - 0.5) * 6); g.fillRect(x, y, 1, 3); } } }
    for (const f of fgTop) g.drawImage(f.spr, f.x, f.y);
    VIGF.draw(g);
  }
  const scene = { id, name, variant, variantName: variants[variant] || variants[0], variants, draw };
  { const wc = mkCanvas(W, H), wg = wc.getContext('2d'); for (const tt of [0, 5000, 14800]) draw(wg, tt); }
  return scene;
}
