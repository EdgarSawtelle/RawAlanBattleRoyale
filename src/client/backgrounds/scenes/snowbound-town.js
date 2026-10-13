// ============================================================================
//  snowbound-town - a mountain town under snow: a dead ski lift whose chairs swing in the wind, chalets with
//  caved-in roofs, a church, an observatory dome on the ridge, pine forest, drifts and a frozen pond. Cold,
//  natural palette (blue-grey shadows, pale gold light), never neon. The wonder moment: an elk herd files
//  across the far snowfield.
//  Variants: 0 clear cold morning (low gold sun, glittering snow, blown spindrift), 1 snowfall at dusk
//  (falling snow, chimney smoke, a single lit window and the observatory slit glowing).
//  Interface: create(seed, variant) -> { id, name, variantName, draw(ctx, timeMs) }
// ============================================================================
import {
  W, H, use, P, R, LN, FPOLY, ELLpx, hash, mulberry32, bay, TAU, layer, mix, mixAll, clamp, fbm, smooth,
  gradV, expandRamp, glow, shaftLayer, cloudSprite, mistSprite, drawTiled, flock, snow, streaks, vignetteLayer, calmFn,
  swaySprite, wind, fast, mkCanvas,
} from '../lib.js';
import { foliage, grassTuft, drawDeerC, drawSwing } from '../art.js';

export const id = 'snowbound-town';
export const name = 'Snowbound Town';
export const variants = ['clear cold morning', 'snowfall at dusk'];

const SUN = [470, 150], GROUND = 268;
const PAL = [
  {
    sky: ['#2c6590', '#5693b6', '#98c0d0', '#d2e0d4', '#f0dcae'], haze: '#c4d4dc', warm: '#f6dca0', glowA: 0.5, sun: true, cloud: { hi: '#f4e8c4', mid: '#c4d6de', lo: '#8ca8b8' }, cloudN: 4,
    snowL: '#eaf0f0', snowM: '#b9c7cf', snowS: '#8d9eae', rock: ['#7e8a94', '#566470', '#34404c'], pine: ['#4f7a6a', '#2f5650', '#1b3836', '#10231f'], wood: ['#8a6a4a', '#634a34', '#3d2e22'], roof: ['#d8e2e6', '#aebdc8', '#7a8ea0'],
    win: '#1c2a30', glowWin: null, metal: '#2a3036', ice: ['#9fc4d4', '#7ba3b8', '#587f96'], elk: { body: '#5a4f44', belly: '#7e7264', dark: '#2f2822', back: '#4a4036', rump: '#a09484', antler: '#3a3028' },
    mist: '#e8f0f4', mistA: [0.05, 0.1], vig: '#0a1218', vigA: 0.46, snowfall: false, glints: true, smoke: false, ravens: '#1c2428',
  },
  {
    sky: ['#222f44', '#374e66', '#617c90', '#9aa7a2', '#c8ab7a'], haze: '#8ea2b0', warm: '#d8b27c', glowA: 0.3, sun: false, cloud: { hi: '#8ea0ac', mid: '#5c7284', lo: '#364a5c' }, cloudN: 8,
    snowL: '#c4d0d8', snowM: '#98a8b6', snowS: '#6c8096', rock: ['#667480', '#45525e', '#2a3640'], pine: ['#3f6458', '#264640', '#152e2c', '#0b1b1a'], wood: ['#725640', '#523c2a', '#33261b'], roof: ['#bccad2', '#8fa1b0', '#627688'],
    win: '#161f26', glowWin: '#f2b866', metal: '#222830', ice: ['#7f9fb2', '#5f8298', '#42647c'], elk: { body: '#463e36', belly: '#645a50', dark: '#241f1a', back: '#38322b', rump: '#7a7062', antler: '#2e2720' },
    mist: '#aebdca', mistA: [0.12, 0.22], vig: '#060b10', vigA: 0.6, snowfall: true, glints: false, smoke: true, ravens: '#12181c',
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
  const PL = PAL[variant] || PAL[0], hz = PL.haze, rnd = mulberry32(seed * 541 + variant * 29 + 3), calm = calmFn(105, 300, 0.28);
  const fog = (c, f) => mix(c, hz, f);

  const SKY = layer(W, H, g => {
    gradV(0, 0, W, 232, expandRamp(PL.sky, 16), 4); R(0, 232, W, H - 232, PL.sky[4]);
    glow(SUN[0], SUN[1], PL.sun ? 230 : 300, PL.warm, PL.glowA * (PL.sun ? 0.7 : 1), 6, 1.6);
    if (PL.sun) { glow(SUN[0], SUN[1], 44, '#ffeec0', 0.34, 5, 1.5); for (let y = -11; y <= 11; y++) for (let x = -11; x <= 11; x++) { const d = Math.hypot(x, y); if (d <= 9.5) P(SUN[0] + x, SUN[1] + y, d > 7.5 ? '#eec677' : '#f9e8b4'); } }
    else for (let k = 0; k < 90; k++) P(Math.floor(rnd() * W), Math.floor(rnd() * 90), '#b8c8d6');   // a few early stars through the cloud rifts
  });
  const clouds = []; for (let i = 0; i < PL.cloudN; i++) { const row = i % 3, w = [250, 170, 120][row] + Math.floor(rnd() * 40); clouds.push({ spr: cloudSprite(w, [34, 24, 16][row], seed * 5 + i * 3 + variant + 150, PL.cloud), y: [8, 40, 76][row] + Math.floor(rnd() * 22), v: [2.6, 4.2, 6.4][row], x0: rnd() * 900, w }); }

  // ---- mountains: heightfield ridges shaded by slope (sun from the right), rock where it is steep
  const ridge = (g, base, amp, f, sd, fogF, freq, peakAt) => {
    const hs = new Float32Array(W + 12);
    for (let i = 0; i < W + 12; i++) { const x = i - 6; hs[i] = base - fbm(x * freq, sd, seed, 4) * amp - (peakAt ? Math.pow(Math.max(0, 1 - Math.abs(x - peakAt[0]) / peakAt[1]), 1.3) * peakAt[2] : 0); }
    const hgt = x => hs[x + 6];
    for (let x = 0; x < W; x++) {
      const h0 = Math.round(hgt(x)), sl = (hgt(x - 4) - hgt(x + 4)) * 0.5, rl = h0 + 16 + fbm(x * 0.07, sd + 5, seed, 2) * 30;       // sl > 0: the surface faces the sun
      for (let y = h0; y < GROUND + 4; y++) {
        const depth = y - h0, steep = Math.abs(sl) > 1.5 && depth > 2;
        let tone = 0.5 + sl * 0.22 - Math.min(1, depth / 90) * 0.12 + (hash(x >> 1, y >> 1, sd) - 0.5) * 0.12;
        let c;
        if ((y > rl && depth > 22) || steep) { c = tone > 0.62 ? PL.rock[0] : tone > 0.4 ? PL.rock[1] : PL.rock[2]; }
        else { const tt = clamp(tone, 0, 0.999) * 2, i0 = Math.floor(tt), lvl = Math.round((tt - i0) * 4) / 4 * 16; c = [PL.snowS, PL.snowM, PL.snowL][lvl > bay(x, y) ? i0 + 1 : i0] || PL.snowL; }
        P(x, y, fog(c, fogF));
      }
    }
    return hgt;
  };
  const FARL = layer(W, H, g => {
    ridge(g, 190, 70, 0.7, 3, 0.72, 0.006, [330, 150, 60]); ridge(g, 214, 52, 0.5, 8, 0.52, 0.009, [120, 110, 18]);
    band(g, 130, 240, hz, 0.34);
    g.globalCompositeOperation = 'source-atop'; band(g, 110, 262, mix(PL.snowS, '#5f768c', 0.5), 0.3, 4); g.globalCompositeOperation = 'source-over';   // play band: snow is mid-grey-blue, never white
    // forest rows: conifers with snow on every tier
    const pine = (g2, cx, base, h, w, fogF, sd) => { const tiers = Math.max(3, Math.round(h / 9)); R(cx, base - 3, 1, 3, fog(PL.wood[2], fogF)); for (let k = 0; k < tiers; k++) { const y0 = base - 3 - Math.round(h * (k + 1) / tiers), y1 = base - 3 - Math.round(h * k / tiers * 0.9) + 2, hw0 = Math.round(w * (0.25 + 0.75 * (tiers - 1 - k + 0.6) / tiers)); for (let y = y0; y <= y1; y++) { const t = (y - y0) / Math.max(1, y1 - y0), hw = Math.round(hw0 * (0.15 + 0.85 * t)); for (let x = -hw; x <= hw; x++) { const lit = x > hw * 0.25, snowTop = t < 0.34 && hash(cx + x, y, sd) > 0.18; P(cx + x, y, fog(snowTop ? (lit ? PL.snowL : PL.snowM) : lit ? PL.pine[0] : x < -hw * 0.3 ? PL.pine[2] : PL.pine[1], fogF)); } } } };
    for (let x = -8; x < W + 8; x += 8 + Math.floor(rnd() * 7)) pine(g, x, 238 + Math.floor(rnd() * 8), 22 + Math.floor(rnd() * 14), 7, 0.62, x);
    band(g, 190, 262, hz, 0.34);
    for (let x = 0; x < W; x += 10 + Math.floor(rnd() * 7)) pine(g, x, 252 + Math.floor(rnd() * 8), 26 + Math.floor(rnd() * 16), 8, 0.4, x + 3);
  });

  // ---- the town in the valley (fogged), the church, the observatory on the left ridge
  const chalet = (g, x, base, w, h, o) => {
    const top = base - h, f = o.fog;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const lf = i / w, plank = j % 3 === 2; P(x + i, top + j, fog(plank ? PL.wood[2] : lf > 0.6 ? PL.wood[0] : PL.wood[1], f)); }
    const rh = Math.round(w * 0.5);
    for (let k = 0; k < rh; k++) { const hw = Math.round((w / 2 + 3) * (1 - k / rh)); for (let i = -hw; i <= hw; i++) { const cx = x + w / 2 + i, snowy = k > 1 || o.cave === undefined; P(Math.round(cx), top - k, fog(k > rh * 0.2 ? (i > 0 ? PL.roof[0] : PL.roof[1]) : PL.roof[0], f * 0.7)); if (k % 5 === 4 && Math.abs(i) < hw - 1) P(Math.round(cx), top - k, fog(PL.roof[2], f)); } }
    for (let i = -Math.round(w / 2 + 3); i <= Math.round(w / 2 + 3); i += 2) if (hash(i, x, 5) > 0.4) R(Math.round(x + w / 2 + i), top + 1, 1, 2 + Math.floor(hash(i, x, 6) * 3), fog(PL.roof[0], f));   // icicles
    if (o.cave !== undefined) { const cx = Math.round(x + w * o.cave); for (let j = 0; j < 8; j++) for (let i = -4 + (j >> 2); i <= 4 - (j >> 2); i++) P(cx + i, top - rh + 6 + j - 2, fog(PL.win, f)); }
    R(x + 3, top + 5, 6, 6, fog(o.lit ? PL.glowWin : PL.win, o.lit ? 0.1 : f)); if (w > 26) R(x + w - 10, top + 5, 6, 6, fog(PL.win, f)); R(x + (w >> 1) - 2, base - 9, 5, 9, fog(PL.win, f));
    R(x + w - 8, top - rh + 2, 4, 9, fog(PL.rock[1], f)); R(x + w - 9, top - rh + 1, 6, 2, fog(PL.snowL, f));
  };
  const OBS = [66, 206];                                     // observatory dome centre x, base y
  const TOWN = layer(W, H, g => {
    // observatory: a stone drum under a white dome with its slit open, on the ridge, a mast beside it
    for (let y = OBS[1] - 26; y < OBS[1] + 6; y++) for (let x = OBS[0] - 16; x < OBS[0] + 16; x++) P(x, y, fog((x > OBS[0] + 4) ? PL.rock[0] : (x < OBS[0] - 8 ? PL.rock[2] : PL.rock[1]), 0.34));
    for (let y = -17; y <= 0; y++) for (let x = -19; x <= 19; x++) if ((x / 19) ** 2 + (y / 17) ** 2 <= 1) { const f = (x / 19) * 0.7 - (y / 17) * 0.3 + 0.3; P(OBS[0] + x, OBS[1] - 26 + y, fog(f > 0.6 ? PL.snowL : f > 0.05 ? PL.roof[1] : PL.roof[2], 0.3)); }
    R(OBS[0] + 3, OBS[1] - 41, 5, 15, fog(PL.win, 0.2)); if (PL.glowWin) R(OBS[0] + 4, OBS[1] - 40, 3, 13, mix(PL.glowWin, PL.win, 0.55));
    R(OBS[0] + 26, OBS[1] - 34, 1, 40, fog(PL.metal, 0.3)); LN(OBS[0] + 26, OBS[1] - 28, OBS[0] + 34, OBS[1] - 20, fog(PL.metal, 0.3), 1); R(OBS[0] + 22, OBS[1] - 34, 9, 1, fog(PL.metal, 0.3));
    band(g, OBS[1] - 20, OBS[1] + 40, hz, 0.1, 3);
    // chalets and the church in the valley
    chalet(g, 140, 262, 34, 22, { fog: 0.34, cave: 0.5 }); chalet(g, 186, 264, 28, 20, { fog: 0.32 }); chalet(g, 232, 262, 38, 24, { fog: 0.3, lit: !!PL.glowWin }); chalet(g, 312, 264, 30, 20, { fog: 0.36, cave: 0.4 }); chalet(g, 360, 262, 34, 22, { fog: 0.36 }); chalet(g, 410, 264, 26, 18, { fog: 0.4 });
    for (let y = 0; y < 34; y++) { const hw = y < 18 ? 4 : 5; for (let x = -hw; x <= hw; x++) P(280 + x, 222 + y, fog(x > 1 ? PL.rock[0] : PL.rock[1], 0.4)); }
    for (let k = 0; k < 20; k++) { const hw = Math.round(5 * (1 - k / 20)); for (let x = -hw; x <= hw; x++) P(280 + x, 222 - k, fog(x > 0 ? PL.roof[0] : PL.roof[1], 0.4)); } R(280, 196, 1, 8, fog(PL.metal, 0.4)); R(278, 199, 5, 1, fog(PL.metal, 0.4));
    R(278, 232, 4, 6, fog(PL.win, 0.3));
    if (PL.glowWin) { glow(238, 248, 56, PL.glowWin, 0.4, 5, 1.6, 0.7); R(235, 243, 6, 6, PL.glowWin); R(236, 244, 3, 3, '#ffe2a0'); glow(OBS[0] + 5, OBS[1] - 34, 26, PL.glowWin, 0.3, 4, 1.6); }
    band(g, 220, 270, hz, 0.28);
  });
  const smoke = [[168, 224], [264, 221]];

  // ---- the ground: drifts, a frozen pond, a snow-capped car and fence, rocks
  const GROUNDL = layer(W, H, g => {
    const nGrid = new Float32Array((W >> 1) * (H >> 1)); for (let gy = 0; gy < (H >> 1); gy++) for (let gx = 0; gx < (W >> 1); gx++) nGrid[gy * (W >> 1) + gx] = fbm(gx * 2 * 0.012, gy * 2 * 0.05 + seed, seed, 3);
    for (let y = GROUND - 6; y < H; y++) for (let x = 0; x < W; x++) {
      const f = (y - GROUND) / (H - GROUND), n = nGrid[(y >> 1) * (W >> 1) + (x >> 1)], drift = Math.sin(x * 0.02 + n * 5) * 3 + n * 8;
      if (y < GROUND + drift - 6) continue;
      const t = n + f * 0.25; let c = t > 0.72 ? PL.snowL : t > 0.5 ? PL.snowM : PL.snowS;
      if (y > 300) c = mix(c, PL.snowL, smooth(300, 340, y) * 0.8);
      if (hash(x, y, seed) > 0.95) c = mix(c, PL.snowL, 0.5);
      P(x, y, fog(c, y < 290 ? 0.28 : 0.04));
    }
    // pond: ice with cracks
    ELLpx(110, 332, 70, 10, (x, y, nx, ny) => { const hh = hash(x >> 2, y >> 1, seed); P(x, y, ny < -0.4 ? PL.ice[0] : ny < 0.3 ? PL.ice[1] : PL.ice[2]); if (hh > 0.88) P(x, y, PL.ice[0]); });
    for (let k = 0; k < 9; k++) LN(70 + Math.floor(rnd() * 80), 326 + Math.floor(rnd() * 12), 70 + Math.floor(rnd() * 80), 326 + Math.floor(rnd() * 12), PL.ice[2], 1);
    // a buried car and a line of fence posts
    R(430, 316, 64, 12, mix('#6a5442', PL.snowS, 0.2)); R(440, 306, 36, 10, mix('#5a4636', PL.snowS, 0.2)); R(444, 308, 28, 6, '#1c2a30'); for (let x = 428; x < 498; x++) { const sn = 2 + Math.floor(fbm(x * 0.2, 5, seed, 2) * 6); R(x, 312 - sn + (x > 438 && x < 478 ? -6 : 0), 1, sn, PL.snowL); }
    ELLpx(444, 328, 5, 5, (x, y) => P(x, y, '#171d1d')); ELLpx(482, 328, 5, 5, (x, y) => P(x, y, '#171d1d'));
    for (let x = 520; x < 636; x += 14) { R(x, 296, 2, 12, PL.wood[1]); R(x, 296, 2, 3, PL.snowL); if (x < 620) { LN(x + 2, 300, x + 14, 301, PL.wood[2], 1); } }
    for (const [x, y, w, h] of [[250, 300, 26, 12], [330, 318, 20, 9], [600, 324, 30, 14]]) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const nx = (i - w / 2) / (w / 2), ny = (j - h) / h; if (nx * nx + ny * ny > 1) continue; P(x + i, y + j, nx > 0.1 && ny < -0.2 ? PL.snowL : (nx > 0 ? PL.rock[0] : PL.rock[1])); } }
    band(g, GROUND - 6, 304, mix(PL.rock[1], hz, 0.5), 0.28);
    g.globalCompositeOperation = 'source-atop'; band(g, GROUND - 6, 316, mix(PL.snowS, '#5f768c', 0.5), 0.2, 4); g.globalCompositeOperation = 'source-over';
  });

  // ---- dead ski lift: station, pylons, cable, chairs swinging (chairs are pre-rotated sprites)
  const LIFT = [[404, 266], [610, 66]], pyl = [0.34, 0.68].map(t => [LIFT[0][0] + (LIFT[1][0] - LIFT[0][0]) * t, LIFT[0][1] + (LIFT[1][1] - LIFT[0][1]) * t]);
  const sagAt = (t) => 0;                    // straight in plan, tiny sag below
  const cableY = (x) => LIFT[0][1] - 24 + (x - LIFT[0][0]) * (LIFT[1][1] - LIFT[0][1]) / (LIFT[1][0] - LIFT[0][0]) + Math.sin((x - LIFT[0][0]) / (LIFT[1][0] - LIFT[0][0]) * Math.PI * 3) * 2;
  const LIFTL = layer(W, H, g => {
    const m = fog(PL.metal, 0.12);
    for (let x = LIFT[0][0] + 6; x < LIFT[1][0]; x++) P(x, Math.round(cableY(x)), m);
    for (const [px, py] of pyl) { R(Math.round(px) - 1, Math.round(cableY(px)) - 2, 3, py - cableY(px) + 14, m); R(Math.round(px) - 6, Math.round(cableY(px)) - 3, 13, 2, m); R(Math.round(px) - 6, Math.round(cableY(px)) - 3, 2, 4, m); R(Math.round(px) + 5, Math.round(cableY(px)) - 3, 2, 4, m); for (let q = 0; q < 8; q++) P(Math.round(px) - 3 + (q % 2) * 6, Math.round(py) + 8 + q, PL.snowL); }
    R(398, 248, 20, 20, fog(PL.wood[1], 0.14)); R(396, 244, 24, 5, fog(PL.roof[0], 0.1)); R(404, 254, 6, 8, PL.win); R(396, 244, 24, 1, PL.snowL);
    R(603, 54, 12, 12, fog(PL.wood[1], 0.14)); R(601, 51, 16, 4, fog(PL.roof[0], 0.1)); R(603, 51, 12, 1, PL.snowL);
  });
  const chair = layer(8, 12, () => { R(3, 0, 1, 7, '#1f262c'); R(0, 7, 7, 1, '#3a444c'); R(0, 4, 1, 3, '#2d363c'); R(0, 7, 7, 1, '#4b5a63'); R(1, 8, 5, 1, '#1f262c'); P(5, 6, PL.snowL); P(1, 7, PL.snowL); });
  const chairFr = [-3, -2, -1, 0, 1, 2, 3].map(k => layer(24, 34, g => drawSwing(g, chair, 3, 0, 12, 1, k * 0.11)));
  const chairs = []; for (let k = 0; k < 9; k++) { const x = LIFT[0][0] + 22 + k * 21 + (k % 3), y = cableY(x); if (k !== 3 && k !== 6) chairs.push({ x, y, ph: k * 1.3 }); }

  // ---- foreground pines (sway), snow drift on the ground in front, falling clumps
  const bigPine = (cw, ch, sd) => layer(cw, ch, g => { const tiers = 6; R(cw >> 1, ch - 8, 3, 8, PL.wood[2]); for (let k = 0; k < tiers; k++) { const y0 = Math.round(ch * 0.04 + (ch - 12) * k / tiers * 0.9), y1 = y0 + Math.round((ch - 12) / tiers * 1.7), hw0 = Math.round(cw * 0.5 * (0.4 + 0.6 * (k + 1) / tiers)); for (let y = y0; y <= y1; y++) { const t = (y - y0) / Math.max(1, y1 - y0), hw = Math.round(hw0 * (0.1 + 0.9 * t)); for (let x = -hw; x <= hw; x++) { const lit = x > hw * 0.2, snowTop = t < 0.3 && hash(x, y + k * 9, sd) > 0.12 || (hash(x, y, sd) > 0.9 && t < 0.7); P((cw >> 1) + 1 + x, y, snowTop ? (lit ? PL.snowL : PL.snowM) : lit ? PL.pine[0] : x < -hw * 0.3 ? PL.pine[3] : PL.pine[2]); } } } });
  const pinesFg = [{ spr: bigPine(66, 110, 1), x: -14, y: 240 }, { spr: bigPine(54, 92, 2), x: 574, y: 262 }, { spr: bigPine(46, 80, 3), x: 36, y: 282 }, { spr: bigPine(60, 100, 4), x: 214, y: 270 }];
  const tuft = [0, 1].map(k => grassTuft(40, 14, ['#b9a878', '#8a7a52', '#5d5238', '#3a3326'], 160 + k, { dens: 0.5, lean: 6 }));
  const mistA = mistSprite(W, 60, seed + 3, PL.mist, PL.mistA[0], PL.mistA[1], 0.012, 0.07), mistB = mistSprite(W, 50, seed + 7, PL.mist, PL.mistA[0], PL.mistA[1], 0.016, 0.09);
  const VIG = vignetteLayer(PL.vig, PL.vigA);
  // light: low sun rays through the pines (clear morning only)
  const shafts = [];
  if (PL.sun) { const mk = (ang, w0, spread, len, a) => shafts.push({ ox: SUN[0], oy: SUN[1], ang, w0, spread, len, a, mask: (x, y) => 1 - 0.6 * smooth(140, 190, y) * (1 - smooth(250, 300, y)) }); mk(2.1, 10, 0.16, 420, 0.8); mk(2.4, 14, 0.18, 520, 0.7); mk(2.7, 10, 0.16, 560, 0.55); mk(1.8, 8, 0.12, 320, 0.5); for (const s of shafts) s.spr = shaftLayer(s, '#fff0c8', 0.24); }
  const shaftGroups = shafts.length ? [0, 1].map(k => [0.62, 0.82, 1].map(a => { const c = mkCanvas(W, H), gg = c.getContext('2d'); gg.globalCompositeOperation = 'lighter'; gg.globalAlpha = a; shafts.forEach((s, i) => { if (i % 2 === k) gg.drawImage(s.spr, 0, 0); }); return fast(c); })) : [];
  const FARLF = fast(FARL), TOWNF = fast(TOWN), GROUNDF = fast(GROUNDL), LIFTF = fast(LIFTL), VIGF = fast(VIG);
  const elkCol = {}; for (const k in PL.elk) elkCol[k] = mix(PL.elk[k], hz, 0.1);

  function draw(g, t) {
    g.imageSmoothingEnabled = false; use(g);
    g.drawImage(SKY, 0, 0);
    for (const c of clouds) { const span = W + c.w + 40, x = Math.round(((c.x0 + t * c.v / 1000) % span) - c.w - 20); g.drawImage(c.spr, x, c.y); }
    FARLF.draw(g);
    if (!PL.snowfall) flock(g, t, { y: 70, n: 7, col: PL.ravens, seed: 5, t0: 3000, cycle: 48000, dur: 17000, rise: 12 });
    TOWNF.draw(g);
    GROUNDF.draw(g);
    LIFTF.draw(g);
    // the elk herd filing across the far snowfield (wonder moment): 6 animals, a calf at the end
    { const cyc = 86000, u = ((t + 18000) % cyc) / cyc * 1.6; if (u <= 1) for (let k = 0; k < 6; k++) { const x = 660 - u * 760 + k * 26 + (k % 2) * 6, st = t * 0.0047 + k * 1.3; drawDeerC(g, Math.round(x), 288 + (k % 3) * 3, { col: elkCol, dir: -1, head: k === 2 ? 0.1 : 0.55, walk: st, antlers: k !== 5 }); } }
    for (const c of chairs) { const a = clamp(Math.round((Math.sin(t * 0.0013 + c.ph) * 1.2 + wind(c.x, t) * 1.2) ), -3, 3); g.drawImage(chairFr[a + 3], Math.round(c.x) - 12, Math.round(c.y) + 1); }
    if (PL.smoke) for (const [sx, sy] of smoke) for (let k = 0; k < 9; k++) { const u = ((t * 0.00018 + k / 9) % 1), x = sx + u * 18 + Math.sin(u * 7 + k) * 3, y = sy - u * 46, a = (1 - u) * 0.5; g.fillStyle = 'rgba(150,164,176,' + a.toFixed(2) + ')'; const r = 1 + Math.floor(u * 3); g.fillRect(Math.round(x), Math.round(y), r, r); }
    for (const p of pinesFg) swaySprite(g, p.spr, p.x, p.y, t, { amp: 2, anchor: 'bottom', phase: p.x * 0.01, pow: 1.1 });
    if (PL.glints) for (let i = 0; i < 26; i++) { const slot = Math.floor(t / (500 + (i % 5) * 160) + i * 7); if (hash(slot, i, seed) < 0.55) continue; const y = i % 2 ? 318 + Math.floor(hash(slot, i, 2) * 40) : 150 + Math.floor(hash(slot, i, 3) * 40), x = Math.floor(hash(slot, i, 4) * W); const cl = calm(y); if (cl < 0.6) continue; g.fillStyle = '#ffffff'; g.fillRect(x, y, 1, 1); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); }
    swaySprite(g, tuft[0], 90, 356 - 14, t, { amp: 2, anchor: 'bottom', phase: 1 }); swaySprite(g, tuft[1], 330, 358 - 14, t, { amp: 2, anchor: 'bottom', phase: 2.4 }); swaySprite(g, tuft[0], 540, 352 - 14, t, { amp: 2, anchor: 'bottom', phase: 3.1 });
    if (shaftGroups.length) {
      g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 2; k++) { const v = 0.5 + 0.5 * Math.sin(t * 0.00055 + k * 2.1); shaftGroups[k][Math.min(2, Math.floor(v * 3))].draw(g); }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    drawTiled(g, mistA, 232, t, 4, 0); drawTiled(g, mistB, 286, t, -6, 100);
    if (!PL.snowfall) streaks(g, t, { n: 30, seed: 2, col: '#e8f0f4', y0: 280, y1: 350, a: 0.4, speed: 1.1 });
    if (PL.snowfall) snow(g, t, { n: 150, seed: 6, cols: ['#c4d0da', '#e6eef2'], calm: y => 0.45 + 0.55 * (1 - calm(y)), drift: 60, speed: 1 });
    VIGF.draw(g);
  }
  const scene = { id, name, variant, variantName: variants[variant] || variants[0], variants, draw };
  { const wc = mkCanvas(W, H), wg = wc.getContext('2d'); for (const tt of [0, 5000, 14800]) draw(wg, tt); }
  return scene;
}
