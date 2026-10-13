// ============================================================================
//  sunken-metro - a flooded metro station seen from water level: a broken roof pours daylight and ivy into the
//  hall, a train car sits half under water, a platform with a bench and a dead vending machine, reeds,
//  jumping fish and dripping ceiling. The wonder moment: a deer swims across the hall.
//  Variants: 0 daylight through the breach, 1 dusk with a survivor's lamp (warm light, bats leave the breach).
//  Interface: create(seed, variant) -> { id, name, variantName, draw(ctx, timeMs) }
// ============================================================================
import {
  W, H, use, P, R, LN, FPOLY, ELLpx, hash, mulberry32, bay, TAU, layer, mix, mixAll, clamp, fbm, smooth,
  gradV, expandRamp, glow, shaftLayer, cloudSprite, mistSprite, drawTiled, flock, motes, fireflies, mirrorSource, drawWater, waterSparkle, ripples,
  vignetteLayer, calmFn, swaySprite, wind, fast, mkCanvas,
} from '../lib.js';
import { foliage, tree, vineCurtain, grassTuft, fern, ivy, drawSwing, signSprite, drawCable } from '../art.js';

export const id = 'sunken-metro';
export const name = 'Sunken Metro';
export const variants = ['daylight through the breach', 'dusk with a survivor\'s lamp'];

const WY = 252;                      // water surface
const BREACH = [296, 474], LAMP = [505, 199];

const PAL = [
  {
    sky: ['#79b5cc', '#a4cfd6', '#cde4dc', '#e6f0dc'], skyHi: '#f4f6dc', wall: ['#86b0aa', '#628d8a', '#3f6866'], tile: ['#9bc0b6', '#74a09a', '#4a7472'], conc: ['#9aa39a', '#6f7a74', '#434e4c'], dark: '#14201f',
    ceil: ['#5b6b66', '#3e4d4a', '#222d2c'], train: ['#d0d0b8', '#a4a894', '#6a7068'], stripe: '#4f8a86', rust: '#8b5232', moss: ['#a9c458', '#6c9640', '#3d6437'],
    leaf: ['#b0ca5c', '#7bab48', '#4d7b3c', '#305836', '#1b3b32'], trunk: ['#6e5a42', '#4a3d2e', '#2c241c'], vine: { stem: ['#2b4a30', '#41663a'], leaf: ['#a3bf55', '#62923f', '#38623a'], flower: ['#eadfa6', '#dcd9c6', '#a4bbd6'] },
    water: ['#6fa2a2', '#4a7f84', '#2f5a68', '#1e4152'], tint: '#2c6c78', tintA: 0.3, wdark: 0.2, glint: ['#f4f8dc', '#cfe6d4'], shaft: '#f2f4cc', shaftA: 0.3, mist: '#dcecdc', mistA: [0.08, 0.15],
    reed: ['#8aa05a', '#657a44', '#46572e', '#2c3a22'], lamp: false, vig: '#07100f', vigA: 0.55, bats: false,
  },
  {
    sky: ['#2c4a62', '#476c78', '#7a9a8e', '#b7b78a'], skyHi: '#e8c078', wall: ['#5f8a86', '#44706e', '#2a4a4a'], tile: ['#6f9a92', '#527c78', '#365654'], conc: ['#7d8982', '#58645e', '#333d3b'], dark: '#0d1514',
    ceil: ['#44534f', '#2f3c3a', '#19221f'], train: ['#a6a894', '#7e8274', '#4c5450'], stripe: '#3d6e6c', rust: '#7d4c34', moss: ['#8cb04e', '#5d8838', '#365a32'],
    leaf: ['#8fb04f', '#5f8a42', '#3e6a3a', '#26482f', '#142c28'], trunk: ['#5c4c38', '#3e3326', '#251e17'], vine: { stem: ['#264430', '#3a5e36'], leaf: ['#8aae4e', '#5a8a3c', '#34583a'], flower: ['#d8d49c', '#c6cec4', '#8ea8c4'] },
    water: ['#4c7a7e', '#335c68', '#214455', '#143040'], tint: '#1f4f6a', tintA: 0.34, wdark: 0.16, glint: ['#f4d9a0', '#b4d0cc'], shaft: '#f0b878', shaftA: 0.2, mist: '#a9c4c8', mistA: [0.1, 0.18],
    reed: ['#7c9450', '#5a6e3e', '#3e4e2a', '#27311c'], lamp: true, vig: '#050c0c', vigA: 0.62, bats: true,
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
  const PL = PAL[variant] || PAL[0], rnd = mulberry32(seed * 457 + variant * 23 + 5), calm = calmFn(105, 300, 0.3);

  const SKY = layer(W, H, g => { gradV(0, 0, W, 80, expandRamp(PL.sky, 12), 4); R(0, 80, W, 60, PL.sky[3]); glow(430, 20, 150, PL.skyHi, 0.5, 5, 1.4); });
  const clouds = []; for (let i = 0; i < 3; i++) clouds.push({ spr: cloudSprite(200 + i * 30, 30, seed + i * 5 + variant + 120, variant ? { hi: '#d8b888', mid: '#7e9aa0', lo: '#3f5c6a' } : { hi: '#f2f4e0', mid: '#cfe0dc', lo: '#9cc0c8' }), y: 2 + i * 14, v: 3 + i * 1.6, x0: rnd() * 700, w: 200 + i * 30 });

  // ---- the hall: ceiling with a breach, tiled back wall, columns, train car, platform
  const tileWall = (g, x0, y0, x1, y1, sd) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const gx = (x % 12 === 0), gy = (y % 8 === 0), t = hash(Math.floor(x / 12), Math.floor(y / 8), sd), f = (x / W);
      let c = gx || gy ? mix(PL.tile[1], PL.tile[2], 0.4) : (t > 0.86 ? mix(PL.tile[1], PL.tile[0], 0.55) : t < 0.14 ? mix(PL.tile[1], PL.wall[1], 0.6) : PL.tile[1]);
      const lf = 0.4 + 0.4 * (1 - Math.abs(f - 0.62) * 1.6); if (!(gx || gy) && hash(x, y, sd) > 0.95) c = mix(c, PL.tile[0], 0.5);
      P(x, y, c);
    }
    // patches where the tiles have fallen off, showing concrete and wet stains
    for (let k = 0; k < 16; k++) { const px = x0 + Math.floor(hash(k, 1, sd) * (x1 - x0 - 24)), py = y0 + 6 + Math.floor(hash(k, 2, sd) * (y1 - y0 - 40)), pw = 10 + Math.floor(hash(k, 3, sd) * 24), ph = 8 + Math.floor(hash(k, 4, sd) * 24); for (let j = 0; j < ph; j++) for (let i = 0; i < pw; i++) { if (hash(i + px, j + py, sd) > 0.28 && hash((px + i) >> 2, (py + j) >> 2, sd + 4) > 0.4) P(px + i, py + j, hash(i, j, sd + 1) > 0.6 ? PL.conc[0] : PL.conc[1]); } }
    for (let k = 0; k < 60; k++) { const x = x0 + Math.floor(hash(k, 5, sd) * (x1 - x0)), y = y0 + Math.floor(hash(k, 6, sd) * (y1 - y0 - 30)), l = 8 + Math.floor(hash(k, 7, sd) * 36); for (let q = 0; q < l; q++) if (hash(x, q, 4) > 0.3) P(x, y + q, PL.wall[2]); }
  };
  const HALL = layer(W, H, g => {
    tileWall(g, 0, 40, W, WY + 6, 7);
    // ceiling slab with ribs
    for (let y = 0; y < 46; y++) for (let x = 0; x < W; x++) { const rib = (x % 80) < 7, t = rib ? 0 : 1 + Math.floor(hash(x >> 1, y >> 1, 3) * 1.2); P(x, y, rib ? PL.ceil[0] : (y > 38 ? PL.ceil[0] : PL.ceil[Math.min(2, 1 + (hash(x, y, 5) > 0.7 ? 1 : 0))])); }
    for (let x = 0; x < W; x++) { R(x, 40, 1, 6, PL.ceil[2]); if ((x % 80) < 7) R(x, 40, 1, 14 + (hash(x, 1, 2) > 0.5 ? 2 : 0), PL.ceil[1]); }
    // columns: tiled shafts with a bright lit edge
    for (const cx of [60, 214, 566, 360]) for (let y = 46; y < WY + 6; y++) for (let i = 0; i < 18; i++) { const f = i / 18, gx = (i % 6 === 0), gy = (y % 6 === 0), tone = gx || gy ? PL.tile[2] : f > 0.7 ? PL.tile[0] : f > 0.25 ? PL.tile[1] : PL.wall[2]; P(cx + i, y, tone); }
    // breach: the roof has fallen in, sky shows through, rebar and slabs hang from the edge
    for (let x = BREACH[0]; x < BREACH[1]; x++) { const e = Math.min(x - BREACH[0], BREACH[1] - x); const bot = 46 + Math.round(Math.min(18, e * 0.5 + hash(x, 3, seed) * 5)); g.clearRect(x, 0, 1, bot - 4 + (hash(x, 4, seed) > 0.6 ? 3 : 0)); }
    for (let k = 0; k < 18; k++) { const x = BREACH[0] + 4 + Math.floor(hash(k, 1, seed) * (BREACH[1] - BREACH[0] - 8)); for (let q = 0; q < 10 + hash(k, 2, seed) * 20; q++) P(x + Math.round(Math.sin(q * 0.4 + k) * 1.2), 38 + q + (x < 330 || x > 440 ? 0 : 6), q > 14 ? PL.rust : PL.dark); }
    // the train car, half under the surface
    const tx = 16, ty = 154, tw = 210;
    R(tx, ty, tw, 100, PL.train[1]); R(tx, ty, tw, 3, PL.train[0]); R(tx + 4, ty - 3, tw - 8, 3, PL.train[1]); R(tx + 4, ty - 3, tw - 8, 1, PL.train[0]); R(tx, ty + 22, tw, 1, PL.train[2]); R(tx, ty + 46, tw, 7, PL.stripe); R(tx, ty + 46, tw, 1, mix(PL.stripe, '#fff', 0.2)); R(tx + tw - 3, ty, 3, 100, PL.train[2]); R(tx, ty, 3, 100, PL.train[0]);
    for (let k = 0; k < 8; k++) { const wx = tx + 10 + k * 25; R(wx, ty + 8, 20, 30, PL.dark); R(wx, ty + 8, 20, 2, PL.train[2]); R(wx + 9, ty + 8, 2, 30, PL.train[2]); const n = hash(k, 3, seed); if (n > 0.3) for (let j = 0; j < 12; j++) P(wx + 2 + j, ty + 10 + Math.floor(j * 0.9), mix(PL.sky[1], PL.dark, 0.3)); if (n > 0.65) for (let i = 0; i < 20; i++) if (hash(i, k, 9) > 0.45) R(wx + i, ty + 38 - Math.floor(hash(i, k, 8) * 8), 1, 4, PL.moss[1 + (i & 1)]); }
    for (let k = 0; k < 70; k++) { const rx = tx + 3 + Math.floor(hash(k, 1, seed + 3) * (tw - 6)), ry = ty + 4 + Math.floor(hash(k, 2, seed + 3) * 60), rl = 3 + Math.floor(hash(k, 4, seed + 3) * 14); for (let j = 0; j < rl; j++) P(rx, ry + j, hash(rx, j, 4) > 0.3 ? PL.rust : mix(PL.rust, PL.train[1], 0.5)); }
    R(tx + 70, ty - 8, 24, 6, PL.train[2]); LN(tx + 90, ty - 3, tx + 118, ty - 20, PL.dark, 1); LN(tx + 118, ty - 20, tx + 140, ty - 16, PL.dark, 1);   // pantograph, bent
    for (let i = 0; i < tw; i++) { const n = fbm(i * 0.14, 5, seed, 2); if (n > 0.45) for (let q = 0; q < 2 + n * 6; q++) P(tx + i, ty - 4 + q, q === 0 ? PL.moss[0] : (hash(i, q, 3) > 0.5 ? PL.moss[1] : PL.moss[2])); }
    // platform on the right
    const px0 = 468;
    R(px0, 224, W - px0, 60, PL.conc[1]); R(px0, 224, W - px0, 3, PL.conc[0]); R(px0, 227, W - px0, 2, '#b3a560'); for (let x = px0; x < W; x += 4) P(x, 228, '#8f8240'); R(px0, 232, W - px0, 3, PL.conc[2]);
    for (let x = px0; x < W; x += 24) R(x, 236, 1, 40, PL.conc[2]);
    // bench, dead vending machine, a destination board hanging by its cables
    R(492, 214, 26, 2, PL.metal || '#4b3f36'); R(492, 216, 2, 8, '#2b2f30'); R(516, 216, 2, 8, '#2b2f30'); R(492, 208, 26, 2, '#4b3f36'); R(493, 204, 1, 4, '#2b2f30'); R(517, 204, 1, 4, '#2b2f30');
    R(580, 196, 18, 28, '#3a5f66'); R(580, 196, 18, 2, '#5d8a8a'); R(582, 200, 14, 14, '#1c2a2d'); for (let r = 0; r < 4; r++) R(583, 201 + r * 3, 12, 1, ['#8f6a3c', '#6a8f5a', '#a85a3a', '#7a8f9a'][r]); R(590, 216, 6, 4, '#1c2a2d');
    g.globalCompositeOperation = 'source-atop';
    ivy(0, 40, W, 60, PL.leaf, 51, (x, y) => 0.1 + 0.55 * (1 - smooth(0, 40, y)) * (0.4 + 0.6 * smooth(250, 330, x) * (1 - smooth(470, 560, x))) , 0.5);
    ivy(0, 180, 250, 80, PL.leaf, 52, (x, y) => 0.25 * smooth(0, 70, y) + 0.15, 0.5); ivy(470, 180, 170, 40, PL.leaf, 53, (x, y) => 0.2, 0.5);
    glow(380, 70, 200, PL.skyHi, PL.lamp ? 0.1 : 0.34, 5, 1.2);
    band(g, 60, 170, mix(PL.dark, PL.wall[1], 0.3), 0.26, 4); band(g, 150, 230, mix(PL.dark, PL.wall[1], 0.4), 0.14, 4);
    if (PL.lamp) { g.fillStyle = 'rgba(6,18,24,0.34)'; g.fillRect(0, 40, W, 230); glow(LAMP[0], LAMP[1] - 6, 130, '#f0b45e', 0.5, 6, 1.3, 0.8); }
    g.globalCompositeOperation = 'source-over';
    for (let x = px0 + 4; x < W; x += 12) g.drawImage(foliage(14, 9, PL.leaf, x, { maxR: 4 }), x - 6, 214 + Math.floor(rnd() * 4));
  });
  const trees = [], vines = [];
  { const spr = tree({ canopyW: 46, canopyH: 32, trunkH: 12, trunkW: 3, pal: PL.leaf, trunk: PL.trunk, seed: 130, lean: 2, branches: 3 }); trees.push({ spr, x: 108 - (spr.width >> 1), y: 154 - spr.height + 4, o: { amp: 3, anchor: 'bottom', phase: 0.6, pow: 1.1 } }); }
  { const spr = tree({ canopyW: 40, canopyH: 28, trunkH: 10, trunkW: 3, pal: PL.leaf, trunk: PL.trunk, seed: 131, lean: -2, branches: 3 }); trees.push({ spr, x: 620 - (spr.width >> 1), y: 224 - spr.height + 3, o: { amp: 3, anchor: 'bottom', phase: 2.1, pow: 1.1 } }); }
  for (const [x, w, h, s] of [[300, 26, 90, 1], [330, 20, 60, 2], [362, 24, 110, 3], [398, 20, 70, 4], [430, 26, 96, 5], [452, 20, 64, 6], [20, 22, 50, 7], [580, 22, 56, 8]]) vines.push({ spr: vineCurtain(w, h, PL.vine, s + 140, { band: 5 }), x, y: x > 290 && x < 470 ? 30 : 42, o: { amp: 5, anchor: 'top', phase: s * 0.7 } });
  const sign = signSprite({ chain: '#2b3032', board: '#2f4f55', edge: '#4f7a7a', shade: '#1c3034', paint: '#9fd0c4', rust: '#6a4a30' }, 9, 22, 9);

  // ---- the water
  const REFL = mirrorSource(g => { g.drawImage(SKY, 0, 0); g.drawImage(HALL, 0, 0); }, WY, H - WY, PL.tint, PL.tintA, PL.wdark);
  const WBASE = layer(W, H - WY, () => { gradV(0, 0, W, H - WY, expandRamp(PL.water, 10), 4); glow(260, 8, 190, PL.shaft, PL.lamp ? 0.1 : 0.34, 6, 1.3, 0.36); if (PL.lamp) glow(LAMP[0], 6, 90, '#f0b45e', 0.3, 5, 1.4, 0.3); for (let k = 0; k < 70; k++) { const x = Math.floor(rnd() * W), y = Math.floor(rnd() * (H - WY)); R(x, y, 2 + Math.floor(rnd() * 3), 1, PL.moss[2]); } });
  const reedL = grassTuft(60, 62, PL.reed, 170, { dens: 1.0, lean: 6 }), reedR = grassTuft(70, 66, PL.reed, 171, { dens: 1.0, lean: 6 }), reedM = grassTuft(50, 40, PL.reed, 172, { dens: 1.0, lean: 5 });
  const lilyFern = fern(40, 30, PL.leaf, 173, 8);

  // ---- light
  const shafts = [];
  { const mk = (ang, w0, spread, len, a) => shafts.push({ ox: 420, oy: 8, ang, w0, spread, len, a, mask: (x, y) => 1 - 0.5 * smooth(120, 170, y) * (1 - smooth(235, 270, y)) }); mk(1.9, 12, 0.16, 360, 0.9); mk(2.1, 18, 0.2, 380, 0.8); mk(2.35, 14, 0.18, 420, 0.7); mk(2.6, 12, 0.16, 420, 0.5); mk(1.7, 10, 0.12, 300, 0.6); mk(1.5, 8, 0.12, 280, 0.35); for (const s of shafts) s.spr = shaftLayer(s, PL.shaft, PL.shaftA); }
  const shaftGroups = [0, 1].map(k => [0.62, 0.82, 1].map(a => { const c = mkCanvas(W, H), gg = c.getContext('2d'); gg.globalCompositeOperation = 'lighter'; gg.globalAlpha = a; shafts.forEach((s, i) => { if (i % 2 === k) gg.drawImage(s.spr, 0, 0); }); return fast(c); }));
  const mistA = mistSprite(W, 56, seed + 2, PL.mist, PL.mistA[0], PL.mistA[1], 0.012, 0.08), mistB = mistSprite(W, 46, seed + 6, PL.mist, PL.mistA[0], PL.mistA[1], 0.016, 0.1);
  const VIG = vignetteLayer(PL.vig, PL.vigA);
  const HALLF = fast(HALL), VIGF = fast(VIG);
  const drips = [[352, 14, 0], [386, 20, 1300], [418, 12, 2500], [330, 26, 700], [450, 18, 1900], [250, 30, 3100], [180, 34, 400]];
  const deerC = { body: '#4d4a3c', dark: '#2a2820', antler: '#3a3428' };

  function swimmingDeer(g, t) {
    const cyc = 84000, c0 = (t + 11000) % cyc, dur = 26000; if (c0 > dur) return;
    const u = c0 / dur, x = 240 + u * 240 * 1.0 - 0, y = WY + 20 + Math.sin(u * 9) * 1;                 // head height ~ surface
    const bob = Math.sin(t * 0.004) * 0.7, X = Math.round(x), Y = Math.round(y + bob);
    g.fillStyle = deerC.body; g.fillRect(X - 7, Y, 11, 2); g.fillRect(X + 3, Y - 4, 3, 5); g.fillRect(X + 5, Y - 6, 4, 3); g.fillRect(X + 8, Y - 5, 2, 2);
    g.fillStyle = deerC.dark; g.fillRect(X + 9, Y - 4, 1, 1); g.fillRect(X + 5, Y - 8, 1, 2); g.fillRect(X + 7, Y - 8, 1, 2); g.fillStyle = deerC.antler; g.fillRect(X + 4, Y - 11, 1, 3); g.fillRect(X + 7, Y - 11, 1, 3); g.fillRect(X + 3, Y - 12, 1, 1); g.fillRect(X + 8, Y - 12, 1, 1);
    // wake: V of ripple lines behind the swimmer
    g.fillStyle = PL.glint[1]; for (let i = 1; i < 16; i++) { g.globalAlpha = 0.55 * (1 - i / 16); g.fillRect(X - 6 - i * 2, Y + 2 + Math.round(i * 0.45), 3, 1); g.fillRect(X - 6 - i * 2, Y + 2 - Math.round(i * 0.12), 2, 1); } g.globalAlpha = 1;
  }
  function fish(g, t) {
    for (let k = 0; k < 3; k++) {
      const per = 7300 + k * 2100, slot = Math.floor((t + k * 1700) / per), ph = ((t + k * 1700) % per) / 900; if (ph > 1) continue;
      const fx = 120 + Math.floor(hash(slot, k, 5) * 300), fy = WY + 30 + Math.floor(hash(slot, k, 6) * 26), jy = fy - Math.sin(ph * Math.PI) * 11, jx = fx + ph * 12;
      g.fillStyle = '#2f4d58'; g.fillRect(Math.round(jx), Math.round(jy), 4, 2); g.fillStyle = '#8fb0b4'; g.fillRect(Math.round(jx), Math.round(jy) + 1, 3, 1);
      if (ph < 0.15 || ph > 0.85) { g.fillStyle = PL.glint[1]; g.globalAlpha = 0.7; g.fillRect(Math.round(fx + (ph > 0.5 ? 12 : 0)) - 3, fy + 1, 7, 1); g.globalAlpha = 1; }
    }
  }

  function draw(g, t) {
    g.imageSmoothingEnabled = false; use(g);
    g.drawImage(SKY, 0, 0);
    for (const c of clouds) { const span = W + c.w + 40, x = Math.round(((c.x0 + t * c.v / 1000) % span) - c.w - 20); g.drawImage(c.spr, x, c.y); }
    HALLF.draw(g);
    for (const s of vines) swaySprite(g, s.spr, s.x, s.y, t, s.o);
    for (const s of trees) swaySprite(g, s.spr, s.x, s.y, t, s.o);
    drawCable(g, t, 402, 40, 410, 104, 5, '#161d1d', 3, 0); drawCable(g, t, 336, 42, 328, 92, 4, '#161d1d', 2.6, 2);
    g.fillStyle = '#2b3032'; g.fillRect(596, 214, 1, -2); g.fillRect(520, 132, 2, 20); g.fillRect(514, 130, 30, 2);
    drawSwing(g, sign, 11, 0, 534, 133, Math.sin(t * 0.0013) * 0.18 + wind(534, t) * 0.08);
    // flickering dead display on the sign: a few muted teal pixels now and then
    if (hash(Math.floor(t / 130), 3, seed) > 0.78) { g.fillStyle = '#7fc4b4'; g.globalAlpha = 0.7; g.fillRect(526, 142, 10, 1); g.globalAlpha = 1; }
    // water
    g.drawImage(WBASE, 0, WY);
    drawWater(g, t, REFL, WY, H - WY, { alpha: 0.82 });
    waterSparkle(g, t, { wy: WY, rows: H - WY, seed: 5, n: variant ? 16 : 34, sx: 260, spread: 220, hi: PL.glint[0], col: PL.glint[1], a: 0.8 });
    ripples(g, t, drips, WY, PL.glint[1], 3400, 12);
    swimmingDeer(g, t); fish(g, t);
    if (PL.lamp) { const fl = 0.72 + 0.2 * Math.sin(t * 0.011) * Math.sin(t * 0.0031) + 0.08 * (hash(Math.floor(t / 90), 1, seed) - 0.5); g.globalAlpha = Math.max(0, Math.min(1, fl)); g.drawImage(LAMPGLOW, LAMP[0] - 65, LAMP[1] - 55); g.globalAlpha = 1; }
    swaySprite(g, reedL, -8, H - 60, t, { amp: 4, anchor: 'bottom', phase: 0.4 }); swaySprite(g, reedR, 590, H - 64, t, { amp: 4, anchor: 'bottom', phase: 1.9 }); swaySprite(g, reedM, 120, H - 36, t, { amp: 3, anchor: 'bottom', phase: 2.8 }); swaySprite(g, reedM, 420, H - 30, t, { amp: 3, anchor: 'bottom', phase: 3.6 });
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 2; k++) { const v = 0.5 + 0.5 * Math.sin(t * 0.0005 + k * 2.1); shaftGroups[k][Math.min(2, Math.floor(v * 3))].draw(g); }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    motes(g, t, shafts, { n: 60, seed: 6, col: variant ? '#f4d9a0' : '#fff4c8', calm, a: 0.85 });
    drawTiled(g, mistA, 214, t, 4, 0); drawTiled(g, mistB, 268, t, -6, 100);
    if (PL.bats) flock(g, t, { y: 70, n: 16, col: '#0f1618', seed: 8, t0: 9000, cycle: 36000, dur: 7000, rise: -20 });
    if (PL.lamp) fireflies(g, t, { n: 16, seed: 9, y0: 140, y1: 250, col: '#d8d070', calm: y => 0.5 + 0.5 * (1 - calm(y)) });
    VIGF.draw(g);
  }
  // the survivor's lamp: a warm dithered glow on the platform (drawn with fillRects, quantised alpha rings)
  const LAMPGLOW = layer(130, 110, gg => { const cx = 65, cy = 55; for (let r = 3; r >= 1; r--) { gg.fillStyle = 'rgba(246,188,100,' + (0.17 * (4 - r)).toFixed(2) + ')'; for (let y = -r * 12; y <= r * 12; y++) for (let x = -r * 14; x <= r * 14; x++) { if ((x + y) & 1) continue; if ((x / (r * 14)) ** 2 + (y / (r * 12)) ** 2 < 1) gg.fillRect(cx + x, cy + y, 1, 1); } } gg.fillStyle = '#ffd68a'; gg.fillRect(cx - 1, cy - 1, 3, 3); gg.fillStyle = '#fff0c0'; gg.fillRect(cx, cy, 1, 1); });
  function glowBlobOld(g, cx, cy) { for (let r = 3; r >= 1; r--) { g.fillStyle = 'rgba(240,180,94,' + (0.1 * (4 - r)).toFixed(2) + ')'; for (let y = -r * 12; y <= r * 12; y += 1) for (let x = -r * 14; x <= r * 14; x += 1) { if ((x + y) & 1) continue; if ((x / (r * 14)) ** 2 + (y / (r * 12)) ** 2 < 1) g.fillRect(cx + x, cy + y, 1, 1); } } g.fillStyle = '#ffd68a'; g.fillRect(cx - 1, cy - 1, 3, 3); g.fillStyle = '#fff0c0'; g.fillRect(cx, cy, 1, 1); }
  const scene = { id, name, variant, variantName: variants[variant] || variants[0], variants, draw };
  { const wc = mkCanvas(W, H), wg = wc.getContext('2d'); for (const tt of [0, 5000, 14800]) draw(wg, tt); }
  return scene;
}
