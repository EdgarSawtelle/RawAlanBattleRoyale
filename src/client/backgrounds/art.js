// ============================================================================
//  art.js - procedural art builders: foliage, trees, vines, grass, ruined towers, vehicles,
//  animals, swinging things. Builders return baked sprites (canvas) or draw onto the current
//  px.js context. Light is always from the upper right (golden hour sun / bright sky).
// ============================================================================
import { W, H, use, P, R, LN, ELLpx, DISC, FPOLY, hash, mulberry32, bay, TAU, layer, mix, mixAll, rgba, clamp, fbm, vnoise, smooth } from './lib.js';

/* ---------------- foliage ---------------- */
/* pal = [hi, light, mid, dark, deep]. Clumpy lobes, lit from the upper right, ragged edge. */
export function foliage(w, h, pal, seed, o = {}) {
  return layer(w, h, () => {
    const r = mulberry32(seed * 97 + 3);
    const n = o.lumps || Math.max(5, Math.round(w * h / 100)), L = [];
    for (let i = 0; i < n; i++) {
      const rr = (o.minR || 3) + r() * (o.maxR || Math.max(4, Math.min(w, h) * 0.26));
      const a = r() * TAU, d = Math.sqrt(r());
      L.push([w / 2 + Math.cos(a) * d * (w / 2 - rr * 0.7), h / 2 + Math.sin(a) * d * (h / 2 - rr * 0.6) * (o.flat || 1), rr]);
    }
    L.sort((p, q) => p[1] - q[1]);
    for (const [cx, cy, rr] of L) {
      ELLpx(cx, cy, rr, rr * 0.78, (x, y, nx, ny) => {
        if (x < 0 || y < 0 || x >= w || y >= h) return;
        const e = nx * nx + ny * ny, nz = hash(x, y, seed);
        if (e > 0.78 && nz > 0.58) return;
        let s = (nx * 0.55 - ny * 0.8) * 0.5 + 0.5 + (nz - 0.5) * 0.3 - e * 0.1;
        if (o.bias) s += o.bias;
        P(x, y, pal[s > 0.86 ? 0 : s > 0.64 ? 1 : s > 0.42 ? 2 : s > 0.24 ? 3 : 4]);
      });
    }
  });
}
/* A tree: trunk with branches + a few canopy lobes. Sprite anchor = bottom centre. */
export function tree(o) {
  const cw = o.canopyW, ch = o.canopyH, th = o.trunkH, w = cw + 10, h = th + Math.round(ch * 0.8);
  const lobes = [[0.28, 0.66, 0.5, 0.58], [0.74, 0.64, 0.5, 0.58], [0.5, 0.5, 0.58, 0.66], [0.36, 0.3, 0.42, 0.5], [0.66, 0.28, 0.42, 0.48], [0.5, 0.16, 0.34, 0.34]];
  const spr = lobes.map((l, k) => foliage(Math.max(8, Math.round(cw * l[2])), Math.max(6, Math.round(ch * l[3])), o.pal, o.seed * 7 + k, { maxR: Math.max(3, ch * 0.17), flat: 0.9 }));
  return layer(w, h, g => {
    const r = mulberry32(o.seed * 13 + 1), cx = Math.round(w / 2), tw = o.trunkW || 2, lean = o.lean || 0;
    const tx = j => Math.round(cx + lean * Math.pow(clamp(1 - j / th, 0, 1), 1.5) * -1 + Math.sin(j * 0.16 + o.seed) * 0.8);
    const topY = h - th;
    for (let k = 0; k < (o.branches || 3); k++) {
      const by = h - 2 - Math.round(th * (0.5 + r() * 0.45)), dir = r() > 0.5 ? 1 : -1, len = 6 + r() * cw * 0.3;
      LN(tx(h - by), by, cx + dir * len, by - 5 - r() * 7, o.trunk[1], 1);
    }
    for (let j = 0; j < th; j++) {
      const x = tx(j), y = h - 1 - j, wd = tw + (j < th * 0.2 ? 1 : 0);
      for (let i = 0; i < wd; i++) P(x + i, y, i >= wd - 1 && wd > 1 ? o.trunk[0] : (i === 0 ? o.trunk[2] : o.trunk[1]));
    }
    lobes.forEach((l, k) => g.drawImage(spr[k], Math.round(cx - cw / 2 + cw * l[0] - spr[k].width / 2 + lean * -0.4), Math.round(ch * l[1] - spr[k].height / 2)));
  });
}
/* A hanging vine curtain. Anchor = top. */
export function vineCurtain(w, h, pal, seed, o = {}) {
  return layer(w, h, () => {
    const r = mulberry32(seed * 31 + 5);
    // dense moss band at the top
    for (let x = 0; x < w; x++) {
      const d = 2 + Math.floor(fbm(x * 0.2, seed, seed, 2) * (o.band == null ? 7 : o.band));
      for (let y = 0; y < d; y++) { const nz = hash(x, y, seed); P(x, y, y > d - 2 ? (nz > 0.5 ? pal.leaf[2] : pal.leaf[1]) : (nz > 0.75 ? pal.leaf[0] : nz > 0.3 ? pal.leaf[1] : pal.leaf[2])); }
    }
    for (let sx = 0; sx < w; sx += 2 + Math.floor(r() * 3)) {
      const len = Math.floor(h * (0.2 + 0.8 * Math.pow(r(), 0.9)) * (o.lenMul || 1)), ph = r() * 6;
      let lastx = sx;
      for (let j = 3; j < len; j++) {
        const x = sx + Math.round(Math.sin(j * 0.27 + ph) * 1.3); lastx = x;
        P(x, j, (j % 7 < 3) ? pal.stem[0] : pal.stem[1]);
        if (j % 4 === 1 && hash(sx, j, seed) > 0.3) {
          const dir = hash(sx, j, seed + 1) > 0.5 ? 1 : -1;
          P(x + dir, j, pal.leaf[1]); P(x + dir * 2, j + 1, pal.leaf[2]); P(x + dir, j - 1, pal.leaf[0]);
          if (hash(sx, j, seed + 8) > 0.55) P(x + dir * 2, j, pal.leaf[1]);
        }
        if (pal.flower && j > 8 && hash(sx, j, seed + 4) > 0.975) P(x + 1, j, pal.flower[Math.floor(hash(sx, j, seed + 5) * pal.flower.length)]);
      }
      P(lastx, len, pal.leaf[0]); P(lastx, len + 1, pal.leaf[1]);
    }
  });
}
/* Grass / fern tuft. Anchor = bottom. */
export function grassTuft(w, h, pal, seed, o = {}) {
  return layer(w, h, () => {
    const r = mulberry32(seed * 7 + 11), n = Math.round(w * (o.dens || 0.8));
    for (let i = 0; i < n; i++) {
      const bx = r() * (w - 2) + 1, bh = Math.max(3, h * (0.3 + 0.7 * Math.pow(r(), 1.2))), lean = (r() - 0.5) * (o.lean || 7);
      for (let j = 0; j < bh; j++) {
        const x = Math.round(bx + lean * Math.pow(j / bh, 1.7)), y = h - 1 - j;
        P(x, y, j < 2 ? pal[3] : j > bh - 3 ? pal[0] : (hash(i, j, seed) > 0.5 ? pal[1] : pal[2]));
      }
      if (o.flowers && r() > 0.82 && bh > h * 0.6) { const x = Math.round(bx + lean * 0.95), y = h - 1 - Math.round(bh); P(x, y - 1, o.flowers[Math.floor(r() * o.flowers.length)]); }
    }
  });
}
/* Ivy / moss growing over a facade: static ragged coverage that thins toward the middle. */
export function ivy(x0, y0, w, h, pal, seed, cov, edge = 0.5) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = fbm((x + x0) * 0.09, (y + y0) * 0.075, seed, 4), thr = 1 - cov(x, y);
    if (n < thr) continue; const d = n - thr;
    const nz = hash(x + x0, y + y0, seed);
    if (d < 0.025 && nz > 0.5) continue;
    const s = (n - 0.5) * 3 + (nz - 0.5) * 0.7 + (hash(x + x0 + 1, y + y0 - 1, seed) > 0.6 ? 0.2 : 0);
    P(x0 + x, y0 + y, pal[s > 0.85 ? 0 : s > 0.25 ? 1 : s > -0.35 ? 2 : s > -0.9 ? 3 : 4]);
  }
}

/* ---------------- ruined towers ---------------- */
/* o: x,w,top,bot,jag,seed,pal{wall:[lit,mid,shade],dark,glass:[a,b],lit,moss:[hi,mid,dark],rust,trim},
      win:{sx,sy,ww,wh,x0,y0}, torn:[{x,y,w,h,see}], glow(0..1 warm window), pitch */
export function drawTower(g, o) {
  const { x, w, top, bot, seed } = o, pal = o.pal, r = mulberry32(seed * 101 + 9);
  const prof = new Array(w); let i = 0, y = top;
  while (i < w) {
    const seg = 3 + Math.floor(r() * 13), target = top + Math.round((r() - 0.45) * (o.jag == null ? 12 : o.jag)), slope = r() < 0.32;
    for (let k = 0; k < seg && i < w; k++, i++) prof[i] = slope ? Math.round(y + (target - y) * (k / seg)) : target;
    y = target;
  }
  if (o.collapse) { // one shoulder of the tower has sheared off diagonally
    const cs = o.collapse, span = Math.round(w * (cs.span || 0.5));
    for (let i = 0; i < span; i++) { const k = cs.side === 'right' ? i / span : 1 - i / span; const idx = cs.side === 'right' ? w - span + i : i; prof[idx] = Math.max(prof[idx], top + Math.round(cs.depth * Math.pow(k, 0.9))); }
  }
  const pitch = o.pitch || 9;
  // wall: three-tone dithered volume, brighter to the right and up
  for (let i = 0; i < w; i++) {
    const t0 = prof[i], lf = o.flip ? 1 - i / (w - 1) : i / (w - 1);
    for (let yy = t0; yy < bot; yy++) {
      const up = 1 - clamp((yy - top) / Math.max(1, (bot - top)), 0, 1);
      let tone = 0.22 + 0.62 * lf + up * 0.14 - 0.1;
      if (i % pitch < 2) tone += 0.2; else if (i % pitch === 2) tone -= 0.12;
      tone += (hash(x + i, yy, seed) - 0.5) * 0.12; tone = clamp(tone, 0, 0.999) * 2;
      const i0 = Math.floor(tone), fr = tone - i0, lvl = Math.round(fr * 4) / 4 * 16;
      P(x + i, yy, pal.wall[2 - (lvl > bay(x + i, yy) ? i0 + 1 : i0)]);
    }
  }
  // windows
  const wn = o.win || { sx: 9, sy: 11, ww: 4, wh: 6 }, wc = o.winC == null ? 1 : o.winC, style = o.style || 'grid';
  const cG0 = mix(pal.wall[1], pal.glass[0], wc), cG1 = mix(pal.wall[1], pal.glass[1], wc), cDk = mix(pal.wall[1], pal.dark, wc);
  const cWarm = mix(cDk, pal.lit, o.glow == null ? 0.38 : o.glow);
  const above = (cx, cw, cy) => cy < prof[Math.min(w - 1, Math.max(0, cx - x))] + 5 || cy < prof[Math.min(w - 1, Math.max(0, cx + cw - x))] + 5;
  if (style === 'ribbon') {
    // continuous horizontal glass strips between concrete spandrels
    for (let cy = top + (wn.y0 || 8); cy + wn.wh < bot - 4; cy += wn.sy) {
      for (let cx = x + 2; cx < x + w - 2; cx++) {
        if (above(cx, 0, cy)) continue; const seg = Math.floor((cx - x) / wn.sx), n = hash(seg, cy, seed), mull = (cx - x) % wn.sx === 0;
        if (mull) { R(cx, cy, 1, wn.wh, pal.wall[1]); continue; }
        const c = n < 0.7 ? cG0 : n < 0.84 ? cDk : n < 0.92 ? cWarm : cDk;
        R(cx, cy, 1, wn.wh, c); P(cx, cy, n < 0.7 ? cG1 : c);
        if (n > 0.92 && hash(cx, cy, seed + 1) > 0.5) P(cx, cy + wn.wh - 1, pal.moss[1]);
      }
      R(Math.max(x + 2, x), cy + wn.wh, w - 4, 1, pal.wall[0]);
    }
  } else if (style === 'curtain') {
    // glass curtain wall: big panes, reflective, many missing or leaf-choked
    for (let cy = top + (wn.y0 || 6); cy + wn.sy < bot - 4; cy += wn.sy) for (let cx = x + 2; cx + wn.sx < x + w - 1; cx += wn.sx) {
      if (above(cx, wn.sx, cy)) continue; const n = hash(cx, cy, seed), pw = wn.sx - 1, ph = wn.sy - 1;
      if (n < 0.66) { R(cx, cy, pw, ph, cG0); for (let k = 0; k < ph; k++) { const px_ = cx + ((k * 2 + 1) % pw); if (k < ph - 1) P(px_, cy + k, cG1); } }
      else if (n < 0.78) R(cx, cy, pw, ph, mix(cG0, cDk, 0.55));
      else if (n < 0.9) { R(cx, cy, pw, ph, cG0); R(cx, cy + (ph >> 1), pw, ph - (ph >> 1), cWarm); }
      else { R(cx, cy, pw, ph, cDk); for (let k = 0; k < pw; k++) if (hash(cx + k, cy, seed + 2) > 0.4) R(cx + k, cy + ph - 1 - Math.floor(hash(cx + k, cy, seed + 4) * 3), 1, 2, pal.moss[1 + (k & 1)]); }
    }
  } else {
    for (let cy = top + (wn.y0 || 8); cy + wn.wh < bot - 4; cy += wn.sy) for (let cx = x + (wn.x0 || 3); cx + wn.ww < x + w - 2; cx += wn.sx) {
      if (above(cx, wn.ww, cy)) continue;
      const n = hash(cx, cy, seed);
      if (n < 0.62) { R(cx, cy, wn.ww, wn.wh, cG0); R(cx, cy, wn.ww, 1, cG1); if (hash(cx, cy, seed + 3) > 0.6) P(cx + 1, cy + 1, cG1); }
      else if (n < 0.76) { R(cx, cy, wn.ww, wn.wh, cDk); P(cx + wn.ww - 1, cy, cG1); }
      else if (n < 0.86) { R(cx, cy, wn.ww, wn.wh, cG0); R(cx, cy + 2, wn.ww, wn.wh - 2, cWarm); }
      else if (n < 0.94) { R(cx, cy, wn.ww, wn.wh, cDk); P(cx, cy + wn.wh - 1, pal.moss[1]); P(cx + 1, cy + wn.wh - 2, pal.moss[2]); P(cx, cy + wn.wh - 2, pal.moss[1]); }
      else { R(cx, cy, wn.ww, wn.wh, cDk); }
      R(cx - 1, cy + wn.wh, wn.ww + 2, 1, pal.wall[0]);
      if (hash(cx, cy, seed + 5) > 0.55) R(cx, cy + wn.wh + 1, 1, 2 + Math.floor(hash(cx, cy, seed + 6) * 6), pal.wall[2]);
    }
  }
  const g2 = g;
  // torn-out sections
  for (const tn of (o.torn || [])) {
    const tx = x + tn.x, ty = top + tn.y;
    const jt = [], jb = [];
    for (let c = 0; c < tn.w; c++) { jt[c] = Math.round((fbm(c * 0.22, seed, seed, 2) - 0.45) * 12 + (hash(c, 1, seed) > 0.85 ? 3 : 0)); jb[c] = Math.round((fbm(c * 0.25, seed + 4, seed, 2) - 0.45) * 14); }
    for (let c = 0; c < tn.w; c++) {
      const a = ty + jt[c], b = ty + tn.h + jb[c];
      g.clearRect(tx + c, a, 1, b - a);
      if (!tn.see) { R(tx + c, a, 1, b - a, pal.dark); }
    }
    // interior: floors, columns, hanging slabs
    if (!tn.see) for (let c = 2; c < tn.w - 2; c += 7 + Math.floor(r() * 5)) { R(tx + c, ty + 3, 2, tn.h - 2, pal.wall[2]); }
    for (let fy = ty + 6 + Math.floor(r() * 4); fy < ty + tn.h + 6; fy += wn.sy) {
      let c = 0; while (c < tn.w) {
        const len = 6 + Math.floor(r() * 18); const a = ty + jt[Math.min(c, tn.w - 1)], b = ty + tn.h + jb[Math.min(c, tn.w - 1)];
        if (fy > a + 3 && fy < b - 2 && r() > 0.25) {
          R(tx + c, fy, Math.min(len, tn.w - c), 3, pal.wall[1]); R(tx + c, fy, Math.min(len, tn.w - c), 1, pal.lit); R(tx + c, fy + 3, Math.min(len, tn.w - c), 1, pal.wall[2]);
          // moss on the slab and hanging bits
          for (let m = 0; m < len && c + m < tn.w; m++) { if (hash(tx + c + m, fy, seed) > 0.45) P(tx + c + m, fy - 1, pal.moss[1 + (hash(tx + c + m, fy, seed + 2) > 0.5 ? 1 : 0)]); if (hash(tx + c + m, fy, seed + 7) > 0.85) { const hl = 2 + Math.floor(hash(tx + c + m, fy, seed + 8) * 6); for (let q = 0; q < hl; q++) P(tx + c + m, fy + 4 + q, q < hl - 1 ? pal.moss[2] : pal.moss[0]); } }
          if (r() > 0.55) { const rx = tx + c + len - 1; for (let q = 0; q < 4 + r() * 5; q++) P(rx - (q > 2 ? 1 : 0), fy + 3 + q, pal.rust); }  // dangling rebar
        }
        c += len + Math.floor(r() * 10);
      }
    }
  }
  // rim light: top edges and right edge
  for (let i = 0; i < w; i++) { P(x + i, prof[i], pal.lit); if (i > 0 && prof[i - 1] < prof[i] - 1) R(x + i - 1, prof[i - 1], 1, prof[i] - prof[i - 1], pal.lit); }
  if (o.flip) { R(x, prof[0], 1, bot - prof[0], pal.wall[0]); R(x + w - 1, prof[w - 1], 1, bot - prof[w - 1], pal.wall[2]); }
  else { R(x + w - 1, prof[w - 1], 1, bot - prof[w - 1], pal.wall[0]); R(x, prof[0], 1, bot - prof[0], pal.wall[2]); }
  // warm light falls on the sun-facing side: a few dithered columns
  if (o.rim !== false) for (let k = 1; k <= 5; k++) { const cx = o.flip ? x + k : x + w - 1 - k, ci = cx - x; for (let yy = prof[ci]; yy < bot; yy++) { if (bay(cx, yy) < (7 - k) * 2.3 * (0.5 + 0.5 * (1 - clamp((yy - top) / Math.max(1, bot - top), 0, 1)))) P(cx, yy, k <= 1 ? pal.lit : pal.wall[0]); } }
  // rebar sprouting from the broken top
  for (let k = 0; k < Math.max(3, w / 14); k++) {
    const c = 2 + Math.floor(r() * (w - 4)), hh = 4 + Math.floor(r() * 9), bendAt = Math.floor(hh * 0.6), dir = r() > 0.5 ? 1 : -1;
    for (let q = 0; q < hh; q++) P(x + c + (q > bendAt ? dir * (q - bendAt) : 0), prof[c] - q, q > hh - 3 ? pal.rust : pal.dark);
  }
  // moss crowning the broken top, dripping over the lip
  for (let i = 0; i < w; i++) {
    const d = hash(x + i, 3, seed) > 0.35 ? 1 + Math.floor(hash(x + i, 4, seed) * 3) : 0;
    for (let q = 0; q < d; q++) P(x + i, prof[i] + q, q === 0 ? pal.moss[0] : (hash(x + i, q, seed) > 0.5 ? pal.moss[1] : pal.moss[2]));
  }
  return prof;
}

/* ---------------- vehicles ---------------- */
/* Side-view rusted car, half sunk in green. (x,y)= left, ground line y. */
export function drawCar(x, gy, o) {
  const c = o.pal, l = o.len || 46, hgt = o.h || 14, r = mulberry32(o.seed || 3), flip = o.flip;
  const X = dx => flip ? x + l - 1 - dx : x + dx;
  const px = (dx, dy, col) => P(X(dx), gy - dy, col);
  const rect = (dx, dy, w, h, col) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(dx + i, dy + j, col); };
  // lower body
  rect(1, 3, l - 2, hgt * 0.45 | 0, c.body[1]); rect(0, 4, l, (hgt * 0.35) | 0, c.body[1]);
  // cabin
  const cb = 5 + ((hgt * 0.45) | 0), ch = Math.round(hgt * 0.5), cs = Math.round(l * 0.22), ce = Math.round(l * 0.72);
  for (let j = 0; j < ch; j++) for (let i = cs + j; i < ce - j * 1.2; i++) px(i, cb + j, j === ch - 1 ? c.body[0] : c.body[1]);
  // windows (broken, dark, with sky glint)
  for (let j = 1; j < ch - 1; j++) for (let i = cs + j + 2; i < ce - j * 1.2 - 2; i++) px(i, cb + j, c.glass);
  px(cs + 4, cb + 2, c.glint); px(cs + 5, cb + 2, c.glint);
  // highlight along the top edges, shade underneath
  for (let i = 0; i < l; i++) { px(i, 3 + ((hgt * 0.45) | 0) + 1, c.body[0]); px(i, 3, c.body[2]); }
  for (let i = cs + ch; i < ce - ch * 1.2; i++) px(i, cb + ch, c.body[0]);
  // rust patches, door seam
  for (let k = 0; k < 24; k++) { const dx = Math.floor(r() * l), dy = 3 + Math.floor(r() * hgt * 0.5); px(dx, dy, c.rust); if (r() > 0.5) px(dx + 1, dy, c.rust); }
  rect(Math.round(l * 0.48), 4, 1, (hgt * 0.35) | 0, c.body[2]);
  // wheels
  for (const wx of [Math.round(l * 0.2), Math.round(l * 0.78)]) { for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (i * i + j * j <= 10) px(wx + i, 3 + j - 1, c.tire); px(wx, 2, c.rim); }
  // moss on roof & hood, a little tree sprouting
  for (let i = cs + 1; i < ce - ch; i++) { const d = 1 + Math.floor(hash(i, 1, o.seed || 3) * 3); for (let q = 0; q < d; q++) px(i, cb + ch + q, c.moss[q === 0 ? 0 : 1 + (hash(i, q, 4) > 0.5 ? 1 : 0)]); }
  for (let i = 1; i < cs + 4; i++) if (hash(i, 9, o.seed || 3) > 0.35) { px(i, 3 + ((hgt * 0.45) | 0) + 2, c.moss[1]); if (hash(i, 8, 3) > 0.6) px(i, 3 + ((hgt * 0.45) | 0) + 3, c.moss[0]); }
}

/* ---------------- animals ---------------- */
/* Deer (facing dir). head: 0 grazing .. 1 alert. walk: phase in radians or null for standing. */
export function drawDeer(g, x, gy, o) {
  const c = o.col, dir = o.dir || 1, u = o.head == null ? 0.5 : o.head;
  const X = dx => dir > 0 ? x + dx : x + 16 - dx;
  const p = (dx, dy, col) => { g.fillStyle = col; g.fillRect(X(dx), gy + dy, 1, 1); };
  const run = (dx, dy, w, h, col) => { g.fillStyle = col; for (let j = 0; j < h; j++) g.fillRect(dir > 0 ? x + dx : x + 16 - dx - w + 1, gy + dy + j, w, 1); };
  const ph = o.walk == null ? null : o.walk;
  // legs
  const lg = [1, 3, 8, 10];
  for (let k = 0; k < 4; k++) {
    let off = 0, lift = 0; if (ph != null) { const s = Math.sin(ph + (k === 1 || k === 2 ? Math.PI : 0)); off = Math.round(s * 1.2); lift = s > 0.5 ? 1 : 0; }
    for (let j = 0; j < 6 - lift; j++) p(lg[k] + (j < 3 ? 0 : off), -6 + j + lift * 0, k % 2 ? c.dark : c.body);
    p(lg[k] + off, -1 - lift, c.dark);
  }
  run(1, -10, 10, 3, c.body); run(2, -7, 8, 1, c.belly); run(0, -9, 1, 2, c.body); p(0, -9, c.rump);
  for (let i = 3; i < 9; i++) p(i, -10, c.back);
  p(-1, -9, c.rump);
  // neck + head: blend between grazing (0) and alert (1)
  const NG = [[11, -9], [12, -8], [13, -6], [14, -4]], NU = [[11, -11], [12, -12], [12, -13], [13, -14]];
  for (let k = 0; k < 4; k++) { const nx = Math.round(NG[k][0] + (NU[k][0] - NG[k][0]) * u), ny = Math.round(NG[k][1] + (NU[k][1] - NG[k][1]) * u); p(nx, ny, c.body); p(nx, ny + 1, c.body); }
  const hx = Math.round(14 + (13 - 14) * u + (u > 0.5 ? 1 : 1)), hy = Math.round(-3 + (-15 + 3) * u);
  p(hx, hy, c.body); p(hx + 1, hy, c.body); p(hx + 2, hy + (u > 0.5 ? 1 : 1), c.dark); p(hx, hy + 1, c.body); p(hx + 1, hy + 1, c.body);
  p(hx, hy - 1, c.body); p(hx + 1, hy - 1, c.body);
  if (o.antlers) { p(hx, hy - 2, c.antler); p(hx - 1, hy - 3, c.antler); p(hx + 1, hy - 3, c.antler); p(hx, hy - 4, c.antler); }
}
export function drawFox(g, x, gy, o) {
  const c = o.col, dir = o.dir || 1, ph = o.walk || 0;
  const X = dx => dir > 0 ? x + dx : x + 15 - dx; const p = (dx, dy, col) => { g.fillStyle = col; g.fillRect(X(dx), gy + dy, 1, 1); };
  for (let k = 0; k < 4; k++) { const s = Math.sin(ph + (k % 2 ? Math.PI : 0) + (k > 1 ? 1.6 : 0)), lx = [3, 4, 9, 10][k] + Math.round(s * 1), lift = s > 0.6 ? 1 : 0; p(lx, -2 - lift, c.dark); p(lx, -1 - lift, c.dark); p(lx, -3, c.body); }
  for (let i = 3; i < 11; i++) { p(i, -6, c.body); p(i, -5, c.body); p(i, -4, i > 4 && i < 9 ? c.belly : c.body); }
  for (let i = 3; i < 10; i++) p(i, -7, c.back);
  p(11, -7, c.body); p(12, -7, c.body); p(11, -6, c.body); p(12, -6, c.body); p(13, -6, c.body); p(14, -5, c.dark); p(11, -8, c.dark); p(12, -8, c.dark); p(13, -7, c.belly);
  const wag = Math.round(Math.sin(ph * 0.5) * 0.6);
  for (let i = 0; i < 5; i++) { p(2 - i, -6 + (i > 1 ? 1 : 0) + wag, c.body); p(2 - i, -5 + (i > 1 ? 1 : 0) + wag, i > 2 ? c.back : c.body); }
  p(-3, -4 + wag, c.belly);
}
export function drawGiraffe(g, x, gy, o) {
  const c = o.col, dir = o.dir || 1, ph = o.walk || 0, hb = Math.round(Math.sin(ph * 0.5) * 0.6);
  const X = dx => dir > 0 ? x + dx : x + 24 - dx; const p = (dx, dy, col) => { g.fillStyle = col; g.fillRect(X(dx), gy + dy, 1, 1); };
  for (let k = 0; k < 4; k++) { const s = Math.sin(ph + (k % 2 ? Math.PI : 0) + (k > 1 ? 1.2 : 0)), lx = [4, 6, 13, 15][k]; const off = Math.round(s * 1.3); for (let j = 0; j < 12; j++) p(lx + (j < 6 ? 0 : off), -12 + j, j > 9 ? c.dark : c.body); }
  for (let j = 0; j < 5; j++) for (let i = 3; i < 17; i++) p(i, -18 + j, (hash(i, j, 3) > 0.62 ? c.spot : (j === 4 ? c.belly : c.body)));
  for (let k = 0; k < 17; k++) { const nx = 15 + Math.round(k * 0.3), ny = -18 - k; for (let i = 0; i < 3; i++) p(nx + i, ny + hb * (k > 12 ? 1 : 0), (hash(nx, ny, 5) > 0.7 && i === 1) ? c.spot : c.body); }
  const hx = 20, hy = -35 + hb; for (let i = 0; i < 4; i++) { p(hx + i, hy, c.body); p(hx + i, hy + 1, i === 3 ? c.dark : c.body); }
  p(hx + 1, hy - 1, c.dark); p(hx + 2, hy - 1, c.dark); p(hx + 1, hy - 2, c.dark); p(hx + 2, hy - 2, c.dark);
  p(2, -17, c.dark); p(1, -16, c.dark); p(1, -15 + hb, c.dark); p(1, -14, c.spot);
}
export function drawPigeon(g, x, gy, o) {
  const c = o.col, dir = o.dir || 1, bob = o.peck ? 2 : 0; const X = dx => dir > 0 ? x + dx : x + 6 - dx;
  const p = (dx, dy, col) => { g.fillStyle = col; g.fillRect(X(dx), gy + dy, 1, 1); };
  for (let i = 0; i < 6; i++) p(i, -3, i > 3 ? c.belly : c.body); for (let i = 1; i < 5; i++) p(i, -2, c.belly);
  p(0, -3, c.dark); p(-1, -3, c.dark); p(5, -4 + bob, c.dark); p(4, -4 + bob, c.body); p(6, -3 + bob, c.dark); p(4, -5 + bob, c.dark); p(5, -5 + bob, c.dark);
  p(2, -1, c.dark); p(3, -1, c.dark); p(2, 0, c.dark); p(3, 0, c.dark);
}

/* ---------------- things that swing / sway ---------------- */
/* Rotate a baked sprite about a pivot with nearest-neighbour sampling (no antialiasing). */
const _img = new WeakMap();
export function drawSwing(g, spr, px, py, x, y, ang) {
  let d = _img.get(spr); if (!d) { d = spr.getContext('2d').getImageData(0, 0, spr.width, spr.height); _img.set(spr, d); }
  const w = spr.width, h = spr.height, ca = Math.cos(ang), sa = Math.sin(ang), R_ = Math.ceil(Math.hypot(Math.max(px, w - px), Math.max(py, h - py))) + 1;
  for (let dy = -R_; dy <= R_; dy++) for (let dx = -R_; dx <= R_; dx++) {
    const sx = Math.round(px + dx * ca + dy * sa), sy = Math.round(py - dx * sa + dy * ca);
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue; const i = (sy * w + sx) * 4; if (d.data[i + 3] < 128) continue;
    g.fillStyle = 'rgb(' + d.data[i] + ',' + d.data[i + 1] + ',' + d.data[i + 2] + ')'; g.fillRect(x + dx, y + dy, 1, 1);
  }
}
export function signSprite(pal, seed, w = 16, h = 8) {
  return layer(w, h + 7, () => {
    const cx = Math.floor(w / 2);
    P(2, 0, pal.chain); P(2, 1, pal.chain); P(2, 2, pal.chain); P(2, 3, pal.chain); P(w - 3, 0, pal.chain); P(w - 3, 1, pal.chain); P(w - 3, 2, pal.chain); P(w - 3, 3, pal.chain);
    R(0, 4, w, h, pal.board); R(0, 4, w, 1, pal.edge); R(0, 4 + h - 1, w, 1, pal.shade);
    for (let i = 2; i < w - 2; i++) if (hash(i, seed, 1) > 0.35) { R(i, 6, 1, 1 + (hash(i, seed, 2) > 0.5 ? 1 : 0), pal.paint); }
    for (let k = 0; k < 8; k++) P(Math.floor(hash(k, 1, seed) * w), 4 + Math.floor(hash(k, 2, seed) * h), pal.rust);
    P(0, 4, 'rgba(0,0,0,0)');
  });
}
export function drawCable(g, t, x0, y0, x1, y1, sag, col, amp = 1.5, ph = 0) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); g.fillStyle = col;
  for (let i = 0; i <= n; i++) { const s = i / n, sw = Math.sin(t * 0.0016 + ph + s * 3.0) * amp * Math.sin(s * Math.PI) + Math.sin(t * 0.0041 + s * 8 + ph) * 0.4 * Math.sin(s * Math.PI); g.fillRect(Math.round(x0 + (x1 - x0) * s + sw * 0.4), Math.round(y0 + (y1 - y0) * s + sag * 4 * s * (1 - s) + sw), 1, 1); }
}

/* Fern / palm-ish fronds radiating from the base. Anchor = bottom centre. */
export function fern(w, h, pal, seed, n = 7) {
  return layer(w, h, () => {
    const r = mulberry32(seed * 19 + 2);
    for (let k = 0; k < n; k++) {
      const ang = -Math.PI / 2 + (k / (n - 1) - 0.5) * 2.5 + (r() - 0.5) * 0.25, len = h * (0.55 + r() * 0.45) * (1 - Math.abs(ang + Math.PI / 2) * 0.12);
      let px = w / 2, py = h - 1; const col = k % 2 ? pal[1] : pal[2];
      for (let s = 0; s < len; s++) {
        const a = ang + (ang > -Math.PI / 2 ? 1 : -1) * Math.pow(s / len, 1.6) * 0.9; px += Math.cos(a); py += Math.sin(a);
        const x = Math.round(px), y = Math.round(py); P(x, y, s > len * 0.8 ? pal[0] : col);
        if (s > 3 && s % 2 === 0) { const side = s % 4 === 0 ? 1 : -1, ll = 2 + Math.round((1 - s / len) * 2); for (let q = 1; q <= ll; q++) P(x + side * q, y + Math.round(q * 0.5), q === ll ? pal[0] : col); P(x - side, y + 1, pal[3]); }
      }
    }
  });
}

/* Tower crane left standing; the jib has snapped and hangs. */
export function drawCrane(g, x, baseY, topY, jibL, col) {
  for (let y = topY; y < baseY; y++) { P(x, y, col); P(x + 5, y, col); }
  for (let y = topY; y < baseY - 6; y += 6) { LN(x, y, x + 5, y + 6, col); LN(x + 5, y, x, y + 6, col); }
  LN(x + 2, topY - 12, x, topY, col); LN(x + 2, topY - 12, x + 5, topY, col);
  R(x - 16, topY, 16, 2, col); R(x + 5, topY, jibL * 0.6, 2, col);
  LN(x + 5 + jibL * 0.6, topY, x + 5 + jibL * 0.85, topY + 18, col); R(x + 5 + jibL * 0.85, topY + 18, 1, 8, col);
  for (let i = 0; i < jibL * 0.6; i += 6) LN(x + 5 + i, topY + 1, x + 5 + i + 3, topY - 3, col);
  LN(x + 2, topY - 12, x + 5 + jibL * 0.55, topY, col); LN(x + 2, topY - 12, x - 14, topY, col);
  R(x - 16, topY + 2, 8, 6, col); R(x - 3, topY - 2, 7, 4, col);
}

/* ---------------- forest bits ---------------- */
/* Big tree trunk with flared roots, bark streaks, moss on the shaded side. pal = [lit, mid, shade]; moss = [hi, mid, dark]. */
export function bigTrunk(w, h, pal, moss, seed, o = {}) {
  const fl = Math.round(w * 0.45), W2 = w + fl * 2;
  return layer(W2, h, () => {
    for (let y = 0; y < h; y++) {
      const rf = clamp((y - (h - 18)) / 18, 0, 1), half = w / 2 + fl * rf * rf, cx = W2 / 2 + Math.sin(y * 0.05 + seed) * (o.bend || 1.2);
      for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
        const f = (x - (cx - half)) / (2 * half), st = hash(Math.floor((x - cx) * 0.5) + 99, 0, seed), nz = hash(x, y, seed);
        let tone = 0.15 + 0.78 * f + (st - 0.5) * 0.3 + (nz - 0.5) * 0.14; tone = clamp(tone, 0, 0.999) * 2;
        const i0 = Math.floor(tone), fr = tone - i0, lvl = Math.round(fr * 4) / 4 * 16, c = pal[2 - (lvl > bay(x, y) ? i0 + 1 : i0)];
        P(x, y, c);
        // moss climbing on the shaded side and roots
        if ((f < 0.42 && fbm(x * 0.12, y * 0.06, seed, 3) > 0.52 - (y > h - 24 ? 0.12 : 0)) || (y > h - 5 && nz > 0.55)) P(x, y, nz > 0.7 ? moss[0] : nz > 0.3 ? moss[1] : moss[2]);
      }
    }
  });
}
/* Collapsed log cabin. (x,y) = bottom-left. */
export function drawCabin(g, x, y, w, h, pal, seed) {
  const r = mulberry32(seed), wallTop = y - h;
  // log walls
  for (let j = 0; j < h; j += 3) for (let i = 0; i < w; i++) {
    const row = j / 3, off = (row % 2) * 2, lit = i > w * 0.7, nz = hash(i, j, seed);
    const c = j % 3 === 0 ? (lit ? pal.log[0] : pal.log[1]) : (lit ? pal.log[1] : pal.log[2]);
    P(x + i, wallTop + j, c); P(x + i, wallTop + j + 1, nz > 0.8 ? pal.log[2] : c); P(x + i, wallTop + j + 2, pal.log[2]);
    if (hash(Math.floor((i + off) / 9), row, seed) > 0.9 && (i + off) % 9 === 0) { P(x + i, wallTop + j, pal.log[2]); P(x + i, wallTop + j + 1, pal.log[2]); }
    if (i < 3 || i > w - 4) { if (row % 2 === 0 ? i < 3 : i > w - 4) { P(x + i, wallTop + j + 1, pal.log[0]); } }
  }
  // door gap, broken window
  R(x + 10, y - 20, 9, 20, pal.dark); R(x + 10, y - 20, 9, 1, pal.log[2]); R(x + 18, y - 20, 1, 20, pal.log[1]);
  const wx = x + Math.round(w * 0.55), wy = y - 22; R(wx, wy, 11, 9, pal.dark); R(wx - 1, wy - 1, 13, 1, pal.log[0]); R(wx - 1, wy + 9, 13, 1, pal.log[0]); R(wx + 5, wy, 1, 9, pal.log[1]);
  if (pal.glow) { R(wx + 6, wy + 3, 4, 5, pal.glow); P(wx + 7, wy + 4, '#f5d58a'); }
  // sagging roof: two slopes meeting low in the middle, a hole in it
  const mid = x + w * 0.46;
  for (let i = -4; i < w + 4; i++) {
    const cx = x + i, d = Math.abs(cx - mid), top = wallTop - Math.round(Math.max(0, 14 - d * 0.36) - (cx > x + w * 0.3 && cx < x + w * 0.5 ? 6 * Math.sin((cx - x - w * 0.3) / (w * 0.2) * Math.PI) : 0));
    for (let yy = top; yy < wallTop + 2; yy++) { const rel = yy - top, nz = hash(cx, yy, seed + 3); P(cx, yy, rel < 2 ? (cx > mid ? pal.roof[0] : pal.roof[1]) : (nz > 0.5 ? pal.roof[1] : pal.roof[2])); if (rel % 4 === 3) P(cx, yy, pal.roof[2]); }
  }
  g.clearRect(Math.round(x + w * 0.34), wallTop - 7, 9, 5);   // hole in the roof: the sky shows through
  // moss mats and dripping green on the roof, ivy on the walls
  for (let i = -4; i < w + 4; i++) { const n = fbm(i * 0.18, 3, seed, 2); if (n > 0.46) { for (let q = 0; q < 3; q++) P(x + i, wallTop - 14 + Math.round(Math.abs(x + i - mid) * 0.36) + q + (x + i > x + w * 0.3 && x + i < x + w * 0.5 ? 6 : 0), pal.moss[q === 0 ? 0 : 1 + (hash(i, q, seed) > 0.5 ? 1 : 0)]); } }
  for (let i = 0; i < w * 0.45; i++) { const n = hash(i, 7, seed); if (n > 0.5) for (let q = 0; q < 2 + n * 12; q++) P(x + i, wallTop + 1 + q, q > 8 ? pal.moss[0] : (hash(i, q, seed) > 0.4 ? pal.moss[1] : pal.moss[2])); }
  // chimney of stones
  const cx = x + w - 12; for (let j = 0; j < 22; j++) for (let i = 0; i < 6; i++) P(cx + i, wallTop - 10 - j + 6, (i + j) % 3 === 0 ? pal.stone[2] : (i > 3 ? pal.stone[0] : pal.stone[1]));
  // porch posts, leaning
  for (let j = 0; j < 18; j++) { P(x - 4 + Math.round(j * 0.15), y - j, pal.log[1]); P(x - 3 + Math.round(j * 0.15), y - j, pal.log[2]); }
  R(x - 7, y - 19, 12, 2, pal.log[1]);
}
/* Rock cliff face. Fills from per-column top profile down to baseY. */
export function drawCliff(g, x0, x1, baseY, prof, pal, seed, lightFromRight = true) {
  for (let x = x0; x < x1; x++) {
    const t0 = prof(x), f = (x - x0) / (x1 - x0);
    for (let y = Math.round(t0); y < baseY; y++) {
      const strata = Math.sin(y * 0.33 + fbm(x * 0.05, y * 0.02, seed, 2) * 6) * 0.5 + 0.5, crack = hash(Math.floor(x / 5), Math.floor(y / 30), seed) > 0.8 && (x % 5 === 0);
      let tone = 0.2 + 0.6 * (lightFromRight ? f : 1 - f) + (strata - 0.5) * 0.22 + (hash(x, y, seed) - 0.5) * 0.15 + (1 - (y - t0) / (baseY - t0 + 1)) * 0.12;
      if (crack) tone -= 0.35; tone = clamp(tone, 0, 0.999) * 3;
      const i0 = Math.floor(tone), fr = tone - i0, lvl = Math.round(fr * 4) / 4 * 16;
      P(x, y, pal[3 - (lvl > bay(x, y) ? i0 + 1 : i0)]);
    }
    P(x, Math.round(t0), pal[0]);
  }
}

/* ---------------- cached animal frames (a draw = one drawImage) ---------------- */
const ANI = new Map();
function cachedAnimal(g, kind, x, gy, o, w, h, ax, ay, fn, walkSteps = 12) {
  const wi = o.walk == null ? -1 : Math.round((((o.walk % TAU) + TAU) % TAU) / TAU * walkSteps) % walkSteps, hq = o.head == null ? -1 : Math.round(o.head * 6);
  const key = kind + '|' + (o.dir || 1) + '|' + wi + '|' + hq + '|' + (o.antlers ? 1 : 0) + '|' + (o.peck ? 1 : 0) + '|' + Object.values(o.col).join('');
  let c = ANI.get(key);
  if (!c) { const o2 = { ...o, walk: wi < 0 ? null : wi / walkSteps * TAU, head: hq < 0 ? o.head : hq / 6 }; c = layer(w, h, g2 => fn(g2, ax, ay, o2)); ANI.set(key, c); }
  g.drawImage(c, Math.round(x) - ax, Math.round(gy) - ay);
}
export const drawDeerC = (g, x, gy, o) => cachedAnimal(g, 'deer', x, gy, o, 26, 26, 4, 22, drawDeer);
export const drawFoxC = (g, x, gy, o) => cachedAnimal(g, 'fox', x, gy, o, 26, 16, 6, 12, drawFox);
export const drawGiraffeC = (g, x, gy, o) => cachedAnimal(g, 'giraffe', x, gy, o, 32, 42, 4, 40, drawGiraffe);
export const drawPigeonC = (g, x, gy, o) => cachedAnimal(g, 'pigeon', x, gy, o, 12, 10, 3, 8, drawPigeon);

/* ---------------- horse (herd animal, wonder moments) ---------------- */
export function drawHorse(g, x, gy, o) {
  const c = o.col, dir = o.dir || 1, ph = o.walk == null ? null : o.walk, u = o.head == null ? 0.7 : o.head;
  const X = dx => dir > 0 ? x + dx : x + 28 - dx;
  const p = (dx, dy, col) => { g.fillStyle = col; g.fillRect(X(dx), gy + dy, 1, 1); };
  const run = (dx, dy, w, h, col) => { g.fillStyle = col; for (let j = 0; j < h; j++) g.fillRect(dir > 0 ? x + dx : x + 28 - dx - w + 1, gy + dy + j, w, 1); };
  const lg = [4, 6, 19, 21];
  for (let k = 0; k < 4; k++) {
    let off = 0, lift = 0; if (ph != null) { const s = Math.sin(ph + (k === 1 || k === 2 ? Math.PI : 0)); off = Math.round(s * 2); lift = s > 0.55 ? 2 : 0; }
    for (let j = 0; j < 9 - lift; j++) { p(lg[k] + (j < 4 ? 0 : off), -9 + j + lift, k % 2 ? c.dark : c.body); }
    p(lg[k] + off, -1 - lift, c.hoof || c.dark); p(lg[k] + off + 1, -1 - lift, c.hoof || c.dark);
  }
  run(3, -17, 19, 7, c.body); run(4, -11, 17, 1, c.belly); run(3, -17, 19, 1, c.back); run(2, -16, 1, 4, c.body); run(21, -17, 2, 4, c.body);
  // neck + head, lower when grazing
  const NU = [[21, -17], [22, -19], [23, -21], [24, -23]], NG = [[21, -15], [23, -13], [25, -11], [26, -8]];
  for (let k = 0; k < 4; k++) { const nx = Math.round(NG[k][0] + (NU[k][0] - NG[k][0]) * u), ny = Math.round(NG[k][1] + (NU[k][1] - NG[k][1]) * u); p(nx, ny, c.body); p(nx + 1, ny, c.body); p(nx, ny + 1, c.body); p(nx - 1, ny + 1, c.mane || c.dark); }
  const hx = Math.round(26 + (24 - 26) * u), hy = Math.round(-7 + (-25 + 7) * u);
  p(hx, hy, c.body); p(hx + 1, hy, c.body); p(hx + 2, hy + 1, c.body); p(hx + 3, hy + 1, c.dark); p(hx, hy + 1, c.body); p(hx + 1, hy + 1, c.body); p(hx + 2, hy + 2, c.body); p(hx + 3, hy + 2, c.dark); p(hx, hy - 1, c.dark);
  if (c.blaze) p(hx + 1, hy + 1, c.blaze);
  // tail, swishing
  const sw = ph != null ? Math.round(Math.sin(ph * 0.5) * 1.4) : 0;
  for (let q = 0; q < 8; q++) { p(2 - Math.round(q * 0.15) - (q > 5 ? 1 : 0) + (q > 3 ? sw : 0), -16 + q, c.mane || c.dark); }
}
export const drawHorseC = (g, x, gy, o) => cachedAnimal(g, 'horse', x, gy, o, 36, 34, 4, 31, drawHorse);

/* ---------------- shipping container ---------------- */
export function container(g, x, y, w, h, col, seed) {
  R(x, y, w, h, col[1]); R(x, y, w, 1, col[0]); R(x, y + h - 1, w, 1, col[2]); R(x, y, 1, h, col[2]); R(x + w - 1, y, 1, h, col[0]);
  for (let i = 3; i < w - 2; i += 3) R(x + i, y + 1, 1, h - 2, hash(i, seed, 2) > 0.5 ? col[2] : mix(col[1], col[2], 0.5));
  for (let k = 0; k < Math.max(2, w >> 2); k++) { const rx = x + 1 + Math.floor(hash(k, seed, 5) * (w - 2)), ry = y + 1 + Math.floor(hash(k, seed, 6) * (h - 2)); P(rx, ry, '#7b4a30'); if (hash(k, seed, 7) > 0.5) P(rx, ry + 1, '#7b4a30'); }
}
