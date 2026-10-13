// ============================================================================
//  hud.js - compact pixel HUD (mockup style): per player name, HP bar, ammo pips with reload
//  progress, block cooldown; a round/score panel in the middle. Drawn on the 640x360 canvas.
// ============================================================================
import { CONFIG } from '../config.js';
import { W, H, use, R, P, TXT, TW } from './px.js';
import { CARDS_BY_ID } from '../cards.js';
import { drawIcon } from './icons.js';
import { netQuality, QUALITY_COLOR } from '../net/quality.js';
import { getMap } from '../maps/index.js';

const COL = { ink: '#0e0d0c', edge: '#625b4b', bg: '#1b1916', hi: '#3d382e', track: '#2c2924', text: '#e6e0c8', dim: '#968f79', dmg: '#dcd2b0', amber: '#e9a93c', pale: '#f8ebb8' };
const ACC = [{ base: '#a2552f', hi: '#c77c44' }, { base: '#4a9086', hi: '#7bbfae' }];

function frame(x, y, w, h) { R(x, y, w, h, COL.ink); R(x + 1, y + 1, w - 2, h - 2, COL.edge); R(x + 2, y + 2, w - 4, h - 4, COL.bg); R(x + 2, y + 2, w - 4, 1, COL.hi); }

const PW = 126, PH = 33, MARGIN = 6;

// state: the sim state; hudInfo: { names, dummyMode }
export function drawHud(g, state) {
  use(g);
  for (let i = 0; i < 2; i++) playerPanel(state, i);
  centrePanel(state);
  if (state.phase === 'roundEnd') banner(state); else if (state.suddenDeath) suddenDeath(state);
  else if (state.phase === 'playing' && state.ready && state.ready.id > 0 && state.roundTick < 40 && !state.ready.resume) goFlash(state.roundTick);
}

// The pre-round gate (phase 'ready'): ROUND n + the map name, who is still loading, then 3-2-1 (host-timed: it comes with the state). Nothing is live under it.
//   info = { me, mineReady (this screen has reported ready), sceneOk (the scene is built), total (countdown seconds) }
export function drawReady(g, state, info) {
  use(g);
  const r = state.ready; if (!r) return;
  let name = ''; try { name = getMap(state.mapId).name; } catch (e) { name = ''; }
  drawMapBanner(g, state.round, name, 1);
  const names = CONFIG.player.names, other = names[info.me === 0 ? 1 : 0].toUpperCase();
  const bigY = 140;
  if (r.cd >= 0) {                                              // 3 - 2 - 1
    const step = info.total / 3, n = Math.max(1, Math.min(3, Math.ceil(r.cd / step - 1e-6))), t = String(n), s = 9, tw = TW(t, s), x = Math.round(W / 2 - tw / 2);
    const into = 1 - (r.cd - (n - 1) * step) / step;            // 0..1 inside this number: it pops in
    const sc = into < 0.12 ? s + 2 : s;
    R(Math.round(W / 2 - 26), bigY - 6, 52, 7 * sc + 12, COL.ink); R(Math.round(W / 2 - 25), bigY - 5, 50, 7 * sc + 10, COL.bg);
    TXT(t, Math.round(W / 2 - TW(t, sc) / 2), bigY, n === 1 ? '#d9622b' : COL.amber, sc);
    if (r.resume) { const l = 'BACK IN THE GAME'; TXT(l, Math.round(W / 2 - TW(l, 1) / 2), bigY + 7 * s + 14, COL.dim, 1); }
    return;
  }
  // still waiting: say honestly what for
  let l1, l2 = '';
  if (!info.mineReady) { l1 = 'LOADING...'; l2 = info.sceneOk ? 'GETTING READY' : 'THE SCENE FOR THIS MAP IS STILL BUILDING'; }
  else { l1 = 'WAITING FOR ' + other + ' TO LOAD...'; l2 = r.waited >= 4 ? Math.floor(r.waited) + ' S' : ''; }
  if (r.resume) l2 = 'THE ROUND CONTINUES WHEN BOTH ARE READY' + (l2 && info.mineReady ? ' (' + l2 + ')' : '');
  const w = Math.max(TW(l1, 2), l2 ? TW(l2, 1) : 0) + 24, h = l2 ? 44 : 30, x = Math.round(W / 2 - w / 2), y = bigY - 4;
  R(x, y, w, h, COL.ink); R(x + 1, y + 1, w - 2, h - 2, COL.edge); R(x + 2, y + 2, w - 4, h - 4, COL.bg);
  TXT(l1, Math.round(W / 2 - TW(l1, 2) / 2), y + 8, COL.text, 2);
  if (l2) TXT(l2, Math.round(W / 2 - TW(l2, 1) / 2), y + 28, COL.dim, 1);
}

// "GO!" for the first moments of a gated round (it never covers anything that matters: the players are already free to move).
function goFlash(rt) {
  const t = 'GO!', s = rt < 8 ? 8 : 7, a = rt < 24 ? 1 : Math.max(0, (40 - rt) / 16), y = 110;
  if (a <= 0) return;
  if (a < 1 && Math.floor(rt / 2) % 2) return;                // blink out
  TXT(t, Math.round(W / 2 - TW(t, s) / 2), y, COL.pale, s, [COL.ink, 1, 1]);
}

// Small icons of the player's cards under the panel (x2 for stacks).
function buildIcons(p, i, px, py) {
  const counts = {}, order = [];
  for (const id of p.cards) { if (!counts[id]) { counts[id] = 0; order.push(id); } counts[id]++; }
  let x = i === 0 ? px : px + PW;
  for (const id of order) {
    const card = CARDS_BY_ID[id], n = counts[id], w = 14 + (n > 1 ? 6 : 0);
    if (i === 1) x -= w;
    R(x, py, 14, 14, COL.ink); R(x + 1, py + 1, 12, 12, COL.track); drawIcon(card.icon, x + 1, py + 1, 1);
    if (n > 1) TXT(String(n), x + 15, py + 4, COL.amber, 1);
    if (i === 0) x += w + 2; else x -= 2;
  }
}

function playerPanel(state, i) {
  const p = state.players[i], st = p.stats, name = CONFIG.player.names[i];
  const px = i === 0 ? MARGIN : W - MARGIN - PW, py = MARGIN, pad = 5;
  frame(px, py, PW, PH);
  buildIcons(p, i, px, py + PH + 3);
  const x = px + pad, bw = PW - 2 * pad;
  let y = py + pad;
  // name + hp number
  R(x, y, 2, 7, ACC[i].base); R(x + 2, y, 1, 7, ACC[i].hi);
  TXT(name, x + 5, y, COL.text, 1);
  const hpT = String(Math.max(0, Math.ceil(p.hp)));
  TXT(hpT, px + PW - pad - TW(hpT, 1), y, COL.text, 1);
  y += 9;
  // hp bar
  const hb = 5;
  R(x, y, bw, hb, COL.ink); R(x + 1, y + 1, bw - 2, hb - 2, COL.track);
  const fw = Math.round((bw - 2) * Math.max(0, p.hp) / st.maxHp);
  R(x + 1, y + 1, fw, hb - 2, ACC[i].base); R(x + 1, y + 1, fw, 1, ACC[i].hi);
  for (let t = 1; t < 4; t++) R(x + Math.round(bw * t / 4), y + 1, 1, hb - 2, COL.ink);
  y += hb + 3;
  // ammo pips (empty pips fill back up during a reload) + thin reload bar underneath
  const mag = Math.round(st.magazine), pw = mag > 9 ? 3 : 4, gap = 1, ph = 6;
  const reloading = p.reloadLeft > 0, rp = reloading ? 1 - p.reloadLeft / st.reloadTime : 0;
  for (let a = 0; a < mag; a++) {
    const ax = x + a * (pw + gap), full = a < p.ammo;
    R(ax, y, pw, ph, full ? COL.ink : COL.edge);
    if (full) { R(ax + 1, y + 1, pw - 2, ph - 2, COL.amber); R(ax + 1, y + 1, pw - 2, 1, COL.pale); } else R(ax + 1, y + 1, pw - 2, ph - 2, COL.track);
  }
  const pipsW = mag * (pw + gap);
  if (reloading) { R(x, y + ph + 1, pipsW - gap, 1, COL.track); R(x, y + ph + 1, Math.round((pipsW - gap) * rp), 1, COL.amber); }
  // block icon + cooldown bar
  const ix = x + pipsW + 5, sw = 7;
  const ready = p.blockCd <= 0, bwid = px + PW - pad - (ix + sw + 3);
  R(ix, y, sw, ph, COL.ink); R(ix + 1, y + 1, sw - 2, ph - 2, ready ? COL.text : COL.dim); R(ix + 3, y + ph - 2, 1, 1, COL.ink);
  if (bwid > 6) {
    const bx = ix + sw + 3, frac = ready ? 1 : 1 - p.blockCd / st.blockCooldown;
    R(bx, y, bwid, ph, COL.ink); R(bx + 1, y + 1, bwid - 2, ph - 2, COL.track);
    const f = Math.round((bwid - 2) * frac);
    R(bx + 1, y + 1, f, ph - 2, ready ? '#8fa65a' : '#c68a3a'); R(bx + 1, y + 1, f, 1, ready ? '#b6c783' : '#e2b068');
  }
}

function centrePanel(state) {
  const cw = 92, ch = PH, cx = Math.round(W / 2 - cw / 2), cy = MARGIN;
  frame(cx, cy, cw, ch);
  // round number + round clock (counts down; turns amber under 10 s and ember in sudden death)
  const left = Math.max(0, Math.ceil(CONFIG.round.timeLimit - state.roundTime));
  const clock = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
  const rt = 'ROUND ' + state.round, gap = 8, tw = TW(rt, 1) + gap + TW(clock, 1), tx = Math.round(W / 2 - tw / 2);
  TXT(rt, tx, cy + 5, COL.dim, 1);
  TXT(clock, tx + TW(rt, 1) + gap, cy + 5, state.suddenDeath ? '#d9622b' : left <= 10 ? COL.amber : COL.text, 1);
  const a = String(state.scores[0]), b = String(state.scores[1]), s = 2, yy = cy + 15;
  const mid = Math.round(W / 2);
  TXT(a, mid - 8 - TW(a, s), yy, ACC[0].hi, s);
  TXT(b, mid + 8, yy, ACC[1].hi, s);
  R(mid - 2, yy + 6, 5, 2, COL.dim);
}

function banner(state) {
  const w = state.result ? state.result.winner : -1;
  const text = w < 0 ? 'DRAW' : CONFIG.player.names[w] + ' WINS THE ROUND';
  const s = 2, tw = TW(text, s), x = Math.round(W / 2 - tw / 2), y = 52;
  R(x - 6, y - 5, tw + 12, 7 * s + 9, COL.ink); R(x - 5, y - 4, tw + 10, 7 * s + 7, COL.bg);
  TXT(text, x, y, w < 0 ? COL.text : ACC[w].hi, s);
  const sub = 'NEXT ROUND STARTING...';
  TXT(sub, Math.round(W / 2 - TW(sub, 1) / 2), y + 7 * s + 14, COL.dim, 1);
}

// "SUDDEN DEATH": a big banner for the first moments, then a small blinking plaque under the clock.
function suddenDeath(state) {
  const sinceStart = state.roundTime - CONFIG.round.timeLimit, text = 'SUDDEN DEATH';
  if (sinceStart < CONFIG.round.suddenDeathBanner) {
    const sc = 2, tw = TW(text, sc), x = Math.round(W / 2 - tw / 2), y = 52;
    R(x - 6, y - 5, tw + 12, 7 * sc + 9, COL.ink); R(x - 5, y - 4, tw + 10, 7 * sc + 7, COL.bg);
    if (Math.floor(state.roundTime * 6) % 2 === 0) TXT(text, x, y, '#d9622b', sc);
    else TXT(text, x, y, COL.pale, sc);
    const sub = 'BOTH PLAYERS LOSE HP - LAST ONE STANDING WINS', sx = Math.round(W / 2 - TW(sub, 1) / 2);
    const sy = y + 7 * sc + 12; R(sx - 4, sy - 3, TW(sub, 1) + 8, 13, COL.ink); R(sx - 3, sy - 2, TW(sub, 1) + 6, 11, COL.bg);
    TXT(sub, sx, sy, COL.dim, 1);
  } else {
    const tw = TW(text, 1), x = Math.round(W / 2 - tw / 2), y = MARGIN + PH + 3;
    R(x - 3, y - 2, tw + 6, 11, COL.ink); R(x - 2, y - 1, tw + 4, 9, COL.bg);
    TXT(text, x, y, Math.floor(state.roundTime * 3) % 2 === 0 ? '#d9622b' : COL.amber, 1);
  }
}

// ---- online extras -----------------------------------------------------------------------------------------------------
// Small connection readout in the bottom-right corner: a muted traffic-light dot (green-grey / amber / burnt orange from ping, jitter and
// loss together, see net/quality.js) and the ping ("42 MS"). `info` = session.netInfo() (or a plain ping in ms).
export function drawPing(g, info) {
  use(g);
  const obj = info !== null && typeof info === 'object';
  const ms = obj ? info.ping : info, q = obj ? (info.quality || netQuality(info)) : netQuality({ ping: ms });
  const t = (ms === null || ms === undefined ? '-' : Math.round(ms)) + ' MS', col = QUALITY_COLOR[q];
  const w = TW(t, 1);
  R(W - w - 20, H - 16, w + 16, 11, COL.ink); R(W - w - 19, H - 15, w + 14, 9, COL.bg);
  R(W - w - 16, H - 12, 4, 4, col);
  TXT(t, W - w - 8, H - 14, col, 1);
}

// "HOST IS RUNNING SLOW": shown on BOTH screens when the host machine cannot keep up 60 ticks per second (the whole match then runs in slow motion).
export function drawHostSlow(g, hz) {
  use(g);
  const l1 = 'HOST IS RUNNING SLOW', l2 = 'THE GAME RUNS AT ' + Math.round(hz) + ' OF 60 TICKS PER SECOND', w = Math.max(TW(l1, 1), TW(l2, 1)) + 16, x = Math.round(W / 2 - w / 2), y = H - 36;
  R(x, y, w, 25, COL.ink); R(x + 1, y + 1, w - 2, 23, COL.edge); R(x + 2, y + 2, w - 4, 21, COL.bg);
  TXT(l1, Math.round(W / 2 - TW(l1, 1) / 2), y + 5, Math.floor(performance.now() / 500) % 2 === 0 ? '#d9622b' : COL.amber, 1);
  TXT(l2, Math.round(W / 2 - TW(l2, 1) / 2), y + 15, COL.dim, 1);
}

// A message plaque in the middle of the screen: lines = ['OPPONENT DISCONNECTED', 'waiting 28 s ...']
export function drawNetBanner(g, lines) {
  use(g);
  const s = 2, w = Math.max(...lines.map((l, i) => TW(l, i === 0 ? s : 1))) + 24, h = 7 * s + 12 + (lines.length - 1) * 12 + 8;
  const x = Math.round(W / 2 - w / 2), y = 120;
  R(x, y, w, h, COL.ink); R(x + 1, y + 1, w - 2, h - 2, COL.edge); R(x + 2, y + 2, w - 4, h - 4, COL.bg);
  TXT(lines[0], Math.round(W / 2 - TW(lines[0], s) / 2), y + 9, '#d9622b', s);
  for (let i = 1; i < lines.length; i++) TXT(lines[i], Math.round(W / 2 - TW(lines[i], 1) / 2), y + 9 + 7 * s + 6 + (i - 1) * 12, COL.text, 1);
}

// "EMBER TOOK PINBALL": a short toast at the start of the round, for BOTH players.
export function drawToast(g, text, cardIcon, tint) {
  use(g);
  const tw_ = TW(text, 1), w = tw_ + 30, x = Math.round(W / 2 - w / 2), y = 60;
  R(x, y, w, 18, COL.ink); R(x + 1, y + 1, w - 2, 16, COL.edge); R(x + 2, y + 2, w - 4, 14, COL.bg);
  drawIcon(cardIcon, x + 5, y + 3, 1);
  TXT(text, x + 22, y + 6, tint, 1);
}

// "ROUND 3 - OLD PLAZA": shown for a few seconds when a round starts (a = 0..1 fade).
export function drawMapBanner(g, round, name, a) {
  use(g);
  const t1 = 'ROUND ' + round, t2 = name.toUpperCase();
  const w = Math.max(TW(t2, 2), TW(t1, 1)) + 24, x = Math.round(W / 2 - w / 2), y = 92;
  g.save(); g.globalAlpha = Math.max(0, Math.min(1, a));
  R(x, y, w, 36, COL.ink); R(x + 1, y + 1, w - 2, 34, COL.edge); R(x + 2, y + 2, w - 4, 32, COL.bg); R(x + 2, y + 2, w - 4, 1, COL.hi);
  TXT(t1, Math.round(W / 2 - TW(t1, 1) / 2), y + 7, COL.dim, 1);
  TXT(t2, Math.round(W / 2 - TW(t2, 2) / 2), y + 17, COL.pale, 2);
  g.restore();
}

// A small always-visible hint in the bottom-left corner.
export function drawHint(g) {
  use(g);
  const t = 'ESC: HELP / MENU', w = TW(t, 1) + 8;
  R(4, H - 15, w, 12, '#0e0d0c'); R(5, H - 14, w - 2, 10, '#1b1916');
  TXT(t, 8, H - 12, '#a39c82', 1);
}
