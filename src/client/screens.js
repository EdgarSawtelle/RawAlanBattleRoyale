// ============================================================================
//  screens.js - the between-rounds screens, drawn on the 640x360 pixel canvas in the HUD's style:
//  quiz, quiz reveal, card pick, the dummy's turn and the match-end screen.
//  RENDER-ONLY: it reads matchView(state) and never changes the simulation. Clicking / keys are
//  turned into INTENTS ({type:'answer', index} ...) which the caller sends to sim/world.js intent().
//  While drawing, every clickable thing registers a hit rectangle; hitIntent(x, y) finds it.
// ============================================================================
import { CONFIG } from '../config.js';
import { CARDS_BY_ID } from '../cards.js';
import { matchView } from '../sim/match.js';
import { W, H, use, R, P, TXT, TW, DITH } from './px.js';
import { drawIcon } from './icons.js';

const C = {
  ink: '#0e0d0c', edge: '#625b4b', bg: '#1b1916', bg2: '#24211c', hi: '#3d382e', track: '#2c2924', text: '#e6e0c8', dim: '#968f79', dimmer: '#6b6656',
  amber: '#e9a93c', pale: '#f8ebb8', good: '#8fa65a', goodDk: '#2f3b1f', goodHi: '#b6c783', bad: '#d9714f', badDk: '#45221a', badHi: '#e9987a',
  rust: '#c77c44', teal: '#7bbfae',
};
const ACC = [C.rust, C.teal];
const MATERIAL = {   // card rarity materials: steel / oxidised copper / tarnished brass
  common: { name: 'COMMON', edge: '#8d9298', bar: '#4d514d', hi: '#bcc0c0', lo: '#575b60', text: '#e6e0c8' },
  uncommon: { name: 'UNCOMMON', edge: '#4e8c70', bar: '#2d5a46', hi: '#86bd9d', lo: '#23463a', text: '#d6efe0' },
  rare: { name: 'RARE', edge: '#b38f3a', bar: '#7a5f24', hi: '#e0c677', lo: '#5a4519', text: '#f6e7b8' },
};

let hits = [];                        // clickable rectangles of the screen drawn last
export function hitIntent(x, y) { for (let i = hits.length - 1; i >= 0; i--) { const h = hits[i]; if (x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) return h.intent; } return null; }
function addHit(x, y, w, h, intent) { hits.push({ x, y, w, h, intent }); }

// ---- text helpers (mixed-case pixel font) ----------------------------------------------------------------------------
const tw = (t) => TW(t, 1, true);
function wrap(text, maxW) {
  const words = String(text).split(/\s+/), lines = []; let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (tw(t) <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}
const LH = 10;                         // line height of mixed text
function para(text, x, y, maxW, color) { const ls = wrap(text, maxW); ls.forEach((l, i) => TXT(l, x, y + i * LH, color, 1, null, true)); return y + ls.length * LH; }
function frame(x, y, w, h, fill = C.bg, edge = C.edge) { R(x, y, w, h, C.ink); R(x + 1, y + 1, w - 2, h - 2, edge); R(x + 2, y + 2, w - 4, h - 4, fill); R(x + 2, y + 2, w - 4, 1, C.hi); }
function centre(text, cx, y, color, s = 1, mixed = false) { TXT(text, cx - TW(text, s, mixed) / 2, y, color, s, null, mixed); }
function dim(g, a) { g.fillStyle = 'rgba(10,9,8,' + a + ')'; g.fillRect(0, 0, W, H); }
function pips(x, y, n, filled, col, colDk, removed = []) {   // n small card pips; `removed` indexes are crossed out
  for (let i = 0; i < n; i++) {
    const px = x + i * 11, gone = removed.includes(i);
    R(px, y, 9, 11, C.ink); R(px + 1, y + 1, 7, 9, gone ? C.track : colDk); R(px + 1, y + 1, 7, 1, gone ? C.track : col);
    if (gone) { for (let k = 0; k < 7; k++) { P(px + 1 + k, y + 2 + k, C.bad); P(px + 7 - k, y + 2 + k, C.bad); } }
  }
}
function button(x, y, w, h, label, mouse, intent, accent = C.amber) {
  const over = mouse && mouse.x >= x && mouse.x < x + w && mouse.y >= y && mouse.y < y + h;
  frame(x, y, w, h, over ? C.hi : C.bg2, over ? accent : C.edge);
  centre(label, x + w / 2, y + (h - 7) / 2, over ? C.pale : accent, 1);
  addHit(x, y, w, h, intent);
}

const names = CONFIG.player.names;
const labels = ['1', '2', '3', '4', '5'];

// ---- quiz & reveal ---------------------------------------------------------------------------------------------------
// X = { me, interactive }: the answerer can click; the watcher sees exactly the same screen, read-only and labelled.
function quizScreen(g, v, mouse, reveal, X) {
  const qz = v.quiz, res = v.result, loser = v.loser, I = X.interactive, NM = names[loser];
  dim(g, 0.94);
  // header
  TXT(names[loser] + ' LOST ROUND ' + (v.round), 20, 8, ACC[loser] === C.rust ? C.rust : C.teal, 1);
  if (!reveal) TXT(I ? 'ANSWER TO UNLOCK' : NM + ' IS ANSWERING', 20, 19, I ? C.pale : ACC[loser], 2);
  else if (I) TXT(res.right ? 'CORRECT!' : 'NOT QUITE', 20, 19, res.right ? C.goodHi : C.badHi, 2);
  else TXT(NM + (res.right ? ' GOT IT RIGHT' : ' GOT IT WRONG'), 20, 19, res.right ? C.goodHi : C.badHi, 2);
  const stakesTxt = 'No time limit';
  TXT(stakesTxt, 620 - TW(stakesTxt, 1), 10, C.dim, 1);

  // question panel
  const qx = 20, qw = 600, qy = 38;
  const qLines = wrap(qz.q, qw - 24);
  const qh = 22 + qLines.length * LH + 8;
  frame(qx, qy, qw, qh, C.bg2);
  TXT('QUESTION  -  ' + (qz.category || 'GENERAL'), qx + 10, qy + 8, C.dim, 1);
  qLines.forEach((l, i) => TXT(l, qx + 12, qy + 20 + i * LH, C.text, 1, null, true));

  // answers (2 x 2); heights follow the longest wrapped answer of each row
  const aw = 294, gap = 12, ax = [qx, qx + aw + gap];
  const wrapped = qz.answers.map((a) => wrap(a, aw - 34));
  const marked = (i) => reveal && (i === res.correctShown || i === res.picked);          // these get a RIGHT / YOUR PICK tag on their own line
  const rowH = [0, 1].map((r) => Math.max(26, Math.max(wrapped[r * 2].length + (marked(r * 2) ? 1 : 0), wrapped[r * 2 + 1].length + (marked(r * 2 + 1) ? 1 : 0)) * LH + 10));
  let ay = qy + qh + 6;
  const rowY = [ay, ay + rowH[0] + 6];
  for (let i = 0; i < 4; i++) {
    const col = i % 2, row = (i / 2) | 0, x = ax[col], y = rowY[row], h = rowH[row];
    const over = I && !reveal && mouse && mouse.x >= x && mouse.x < x + aw && mouse.y >= y && mouse.y < y + h;
    let fill = over ? C.hi : C.bg2, edge = over ? C.amber : C.edge, tcol = C.text, mark = null;
    if (reveal) {
      if (i === res.correctShown) { fill = C.goodDk; edge = C.good; tcol = C.pale; mark = 'ok'; }
      else if (i === res.picked) { fill = C.badDk; edge = C.bad; tcol = C.badHi; mark = 'no'; }
      else { tcol = C.dimmer; }
    }
    frame(x, y, aw, h, fill, edge);
    // key box
    const kb = reveal ? (mark === 'ok' ? C.good : mark === 'no' ? C.bad : C.track) : (over ? C.amber : C.track);
    const ky = y + Math.round(h / 2) - 8;
    R(x + 5, ky, 16, 16, C.ink); R(x + 6, ky + 1, 14, 14, kb);
    centre(labels[i], x + 13, ky + 5, reveal || over ? C.ink : C.amber, 1);
    const top = reveal ? y + 6 : y + Math.round((h - wrapped[i].length * LH) / 2) + 1;
    wrapped[i].forEach((l, k) => TXT(l, x + 28, top + k * LH, tcol, 1, null, true));
    const tag = mark === 'ok' ? 'RIGHT' : (I ? 'YOUR PICK' : NM + ' PICKED THIS');
    if (mark) TXT(tag, x + aw - 6 - TW(tag, 1), y + h - 11, mark === 'ok' ? C.goodHi : C.badHi, 1);
    if (I && !reveal) addHit(x, y, aw, h, { type: 'answer', index: i });
  }
  let y = rowY[1] + rowH[1] + 8;

  if (!reveal) {
    // the stakes + the five face-down cards the answer unlocks
    const bw = 294;
    frame(qx, y, bw, 34, C.goodDk, C.good);
    TXT('Correct: choose from all 5 cards', qx + 8, y + 7, C.goodHi, 1, null, true);
    pips(qx + 8, y + 19 - 2, 5, 5, C.good, '#4b5e2c');
    frame(qx + bw + gap, y, bw, 34, C.badDk, C.bad);
    TXT('Wrong: 3 of the 5 cards are removed at random', qx + bw + gap + 8, y + 7, C.badHi, 1, null, true);
    pips(qx + bw + gap + 8, y + 17, 5, 5, C.bad, '#7a3a2a', [0, 2, 3]);
    y += 42;
    centre(I ? 'NEXT: PICK ONE OF YOUR CARDS' : 'NEXT: ' + NM + ' PICKS A CARD', W / 2, y, C.amber, 1); y += 11;
    const cw = 64, ch = Math.min(86, H - y - 22), cgap = 10, cx0 = Math.round(W / 2 - (5 * cw + 4 * cgap) / 2);
    for (let i = 0; i < 5; i++) faceDown(cx0 + i * (cw + cgap), y, cw, ch);
    centre(I ? 'Press 1-4 or click an answer' : 'Watching ' + NM + '. There is no time limit.', W / 2, H - 12, C.dim, 1, true);
  } else {
    // why + outcome
    // the explanation is the longest text of the game: shorter lines and more air between them, so it stays readable in a small window
    const WP = LH + 4, wlines = wrap(res.why || '', qw - 90);
    const wh = 22 + Math.max(1, wlines.length) * WP + 6;
    frame(qx, y, qw, wh, C.bg2, res.right ? C.good : C.bad);
    TXT(res.right ? (I ? 'WHY YOU WERE RIGHT' : 'WHY THIS IS THE ANSWER') : 'WHY THIS IS THE ANSWER', qx + 10, y + 8, res.right ? C.goodHi : C.badHi, 1);
    wlines.forEach((l, i) => TXT(l, qx + 14, y + 21 + i * WP, C.text, 1, null, true));
    y += wh + 6;
    const removed = v.removed.length;
    frame(qx, y, qw, 26, res.right ? C.goodDk : C.badDk, res.right ? C.good : C.bad);
    const who = I ? 'you' : NM, msg = res.right ? 'Right answer: ' + who + (I ? ' can' : ' can') + ' choose from ALL 5 cards.' : 'Wrong answer: ' + removed + ' cards were removed. ' + (I ? 'You choose' : NM + ' chooses') + ' from the other ' + (5 - removed) + '.';
    TXT(msg, qx + 10, y + 9, res.right ? C.goodHi : C.badHi, 1, null, true);
    pips(qx + qw - 5 * 11 - 8, y + 7, 5, 5, res.right ? C.good : C.bad, res.right ? '#4b5e2c' : '#7a3a2a', res.right ? [] : [0, 1, 2].slice(0, removed));
    y += 32;
    if (X.step !== undefined) { const lab = X.step === 0 ? 'NEXT' : 'NEXT'; button(W / 2 - 70, Math.min(y, H - 26), 140, 20, lab, mouse, X.nextIntent); }
    else if (I) button(W / 2 - 70, Math.min(y, H - 26), 140, 20, 'CONTINUE', mouse, { type: 'continue' });
    else centre('Waiting for ' + NM + ' to continue...', W / 2, Math.min(y, H - 26) + 7, C.dim, 1, true);
  }
}

function faceDown(x, y, w, h) {
  frame(x, y, w, h, C.bg2, C.edge);
  R(x + 5, y + 5, w - 10, h - 10, C.ink); R(x + 6, y + 6, w - 12, h - 12, C.track);
  DITH(x + 6, y + 6, w - 12, h - 12, C.hi);
  centre('?', x + w / 2, y + h / 2 - 7, C.amber, 2);
}

// ---- a card ------------------------------------------------------------------------------------------------------------------
// state: { hover, removed, key }
function drawCard(card, x, y, w, h, st) {
  const mat = MATERIAL[card.rarity] || MATERIAL.common;
  R(x, y, w, h, C.ink);
  R(x + 1, y + 1, w - 2, h - 2, st.hover ? C.amber : mat.edge);
  R(x + 2, y + 2, w - 4, h - 4, mat.lo);
  R(x + 3, y + 3, w - 6, h - 6, C.bg2);
  // name bar
  R(x + 3, y + 3, w - 6, 14, mat.bar); R(x + 3, y + 3, w - 6, 1, mat.hi);
  centre(card.name.toUpperCase(), x + w / 2, y + 7, mat.text, 1);
  // rarity strip
  R(x + 3, y + 17, w - 6, 10, C.ink);
  TXT(mat.name, x + 7, y + 19, mat.hi, 1);
  const n = card.rarity === 'rare' ? 3 : card.rarity === 'uncommon' ? 2 : 1;
  for (let i = 0; i < 3; i++) R(x + w - 9 - i * 5, y + 20, 3, 3, i < n ? mat.hi : C.track);
  // icon box
  const ix = x + w / 2 - 22;
  R(ix, y + 30, 44, 38, C.ink); R(ix + 1, y + 31, 42, 36, '#14120f');
  for (const [cx, cy] of [[ix + 2, y + 32], [ix + 38, y + 32], [ix + 2, y + 62], [ix + 38, y + 62]]) R(cx, cy, 4, 1, mat.edge);
  drawIcon(card.icon, ix + 22 - 18, y + 31, 3);
  // text area
  let ty = y + 72;
  const lx = x + 7, mw = w - 14;
  ty = para(card.description, lx, ty, mw, C.text) + 3;
  R(x + 7, ty, w - 14, 1, C.hi); ty += 4;
  for (const line of card.lines) {
    const ls = wrap(line.t, mw - 8);
    R(lx, ty + 2, 4, 4, line.good ? C.good : C.bad);
    ls.forEach((l, i) => TXT(l, lx + 7, ty + i * LH, line.good ? C.goodHi : C.badHi, 1, null, true));
    ty += ls.length * LH + 1;
  }
}

let hoverNow = -1;                                  // the card the local picker points at (sent to the other screen)
export function getHover() { return hoverNow; }
function cardPickScreen(g, v, mouse, X) {
  dim(g, 0.94);
  const loser = v.loser, I = X.interactive, NM = names[loser];
  hoverNow = -1;
  const title = !I ? NM + ' IS CHOOSING' : v.skipped ? 'PICK A CARD' : (v.result && v.result.right ? 'RIGHT ANSWER - PICK A CARD' : 'PICK A CARD');
  TXT(names[loser] + ' LOST ROUND ' + v.round, 20, 6, ACC[loser], 1);
  TXT(title, 20, 16, C.pale, 2);
  const sub = v.removed.length ? 'WRONG ANSWER: ' + v.removed.length + ' CARDS WERE REMOVED. ' + (I ? 'TAKE' : NM + ' TAKES') + ' 1 OF THE ' + (v.offer.length - v.removed.length) + ' LEFT.' : (I ? 'TAKE 1 OF 5. IT STAYS WITH YOU FOR THE WHOLE MATCH.' : NM + ' TAKES 1 OF 5 AND KEEPS IT FOR THE WHOLE MATCH.');
  TXT(sub, 20, 34, v.removed.length ? C.badHi : C.dim, 1);

  const n = v.offer.length, cw = 112, gap = 8, x0 = Math.round(W / 2 - (n * cw + (n - 1) * gap) / 2), y0 = 46, ch = 214;
  let tip = null;
  v.offer.forEach((id, i) => {
    const card = CARDS_BY_ID[id], x = x0 + i * (cw + gap);
    const removed = v.removed.includes(id);
    const mouseOver = !removed && mouse && mouse.x >= x && mouse.x < x + cw && mouse.y >= y0 && mouse.y < y0 + ch;
    if (I && mouseOver) hoverNow = i;
    const hover = I ? mouseOver : (!removed && (v.hover === i || X.pickedIndex === i));
    drawCard(card, x, y0, cw, ch, { hover, removed });
    if (removed) {
      // greyed out and struck through
      g.fillStyle = 'rgba(12,11,10,0.84)'; g.fillRect(x + 1, y0 + 1, cw - 2, ch - 2);
      for (let k = 0; k < cw - 12; k++) { const yy = y0 + 20 + Math.round(k * (ch - 40) / (cw - 12)); R(x + 6 + k, yy, 2, 2, '#7a3a2a'); R(x + cw - 8 - k, yy, 2, 2, '#7a3a2a'); }
      R(x + cw / 2 - 28, y0 + ch / 2 - 8, 56, 15, C.ink); R(x + cw / 2 - 27, y0 + ch / 2 - 7, 54, 13, C.badDk);
      centre('REMOVED', x + cw / 2, y0 + ch / 2 - 4, C.badHi, 1);
    } else {
      if (I) addHit(x, y0, cw, ch, { type: 'pick', cardId: id });
      if (I) { R(x + cw / 2 - 5, y0 + ch + 3, 10, 10, C.ink); R(x + cw / 2 - 4, y0 + ch + 4, 8, 8, hover ? C.amber : C.track); centre(labels[i], x + cw / 2, y0 + ch + 5, hover ? C.ink : C.dim, 1); }
      else if (hover) centre(X.pickedIndex === i ? NM + ' TOOK THIS' : NM + ' IS LOOKING', x + cw / 2, y0 + ch + 5, C.amber, 1);
    }
  });

  // bottom bar: score, both builds
  const by = 280, bh = 62;
  frame(20, by, 600, bh, C.bg, C.edge);
  TXT('SCORE', 30, by + 8, C.dim, 1);
  TXT(v.scores[0] + ' - ' + v.scores[1], 30, by + 19, C.text, 2);
  TXT(names[0], 30, by + 38, ACC[0], 1); TXT(names[1], 30 + 6 * 7, by + 38, ACC[1], 1);
  for (let p = 0; p < 2; p++) {
    const bx = 120 + p * 250;
    TXT(names[p] + "'S BUILD" + (p === loser ? (I ? ' (YOU PICK)' : ' (PICKING)') : ''), bx, by + 8, ACC[p], 1);
    buildChips(bx, by + 20, 240, v.builds[p], 2);
  }
  const nt = 'ROUND ' + (v.round + 1) + ' NEXT'; TXT(nt, 610 - TW(nt, 1), by + 8, C.amber, 1);
}

// compact list of a build: icon + name (x2 for stacks), wrapped over rows
function buildChips(x, y, maxW, build, rows) {
  if (!build.length) { TXT('no cards yet', x, y + 3, C.dimmer, 1, null, true); return; }
  const counts = {}; const order = [];
  for (const id of build) { if (!counts[id]) { counts[id] = 0; order.push(id); } counts[id]++; }
  let cx = x, cy = y;
  for (const id of order) {
    const card = CARDS_BY_ID[id], label = card.name + (counts[id] > 1 ? ' x' + counts[id] : ''), w = 16 + tw(label) + 6;
    if (cx + w > x + maxW) { cx = x; cy += 15; }
    R(cx, cy, w, 14, C.ink); R(cx + 1, cy + 1, w - 2, 12, C.track);
    drawIcon(card.icon, cx + 2, cy + 1, 1);
    TXT(label, cx + 16, cy + 3, C.text, 1, null, true);
    cx += w + 4;
  }
}

// the build as rows: icon, name (x2 for stacks) and the description, wrapped over up to two lines (rows are 28 high: five cards fit)
function buildRows(x, y, maxW, build) {
  if (!build.length) { TXT('no cards this match', x, y + 4, C.dimmer, 1, null, true); return; }
  const counts = {}, order = [];
  for (const id of build) { if (!counts[id]) { counts[id] = 0; order.push(id); } counts[id]++; }
  order.forEach((id, i) => {
    const card = CARDS_BY_ID[id], yy = y + i * 28, mat = MATERIAL[card.rarity], ls = wrap(card.description, maxW - 30);
    R(x, yy, 24, 24, C.ink); R(x + 1, yy + 1, 22, 22, C.track); drawIcon(card.icon, x + 6, yy + 6, 1);
    TXT(card.name.toUpperCase() + (counts[id] > 1 ? ' X' + counts[id] : ''), x + 30, yy, mat.hi, 1);
    for (let k = 0; k < Math.min(2, ls.length); k++) TXT(ls[k] + (k === 1 && ls.length > 2 ? '...' : ''), x + 30, yy + 9 + k * 9, C.dim, 1, null, true);
  });
}

// ---- the dummy's turn -----------------------------------------------------------------------------------------------------------
// The bot resolves its turn instantly inside the match state machine; the UI replays it on the regular
// screens in read-only mode: 1) its question  2) its answer and the explanation  3) the card it took.
// Click / Enter goes to the next step (and after the last one continues); each step also advances by itself.
const dummyUi = { key: '', step: 0, t0: 0, manual: false };
export function setDummyStep(n) { dummyUi.step = n; dummyUi.manual = true; dummyUi.key = '*'; }
export function dummyStep() { return dummyUi.step; }
export function nextDummyStep(state) { const last = lastDummyStep(state); if (dummyUi.step < last) { dummyUi.step++; dummyUi.t0 = performance.now(); return null; } return { type: 'continue' }; }
function lastDummyStep(state) { return state.match.quiz && !state.match.skipped ? 2 : 0; }
const DUMMY_STEP_MS = 3400;

function dummyScreen(g, v, mouse, state) {
  const d = v.dummy, m = state.match;
  const key = state.round + ':' + (d && d.qid) + ':' + (d && d.cardId);
  if (dummyUi.key !== key && dummyUi.key !== '*') { dummyUi.key = key; dummyUi.step = 0; dummyUi.t0 = performance.now(); dummyUi.manual = false; }
  if (!dummyUi.manual && dummyUi.step < lastDummyStep(state) && performance.now() - dummyUi.t0 > DUMMY_STEP_MS) { dummyUi.step++; dummyUi.t0 = performance.now(); }
  const last = lastDummyStep(state), step = Math.min(dummyUi.step, last);
  const next = step < last ? { type: '__next' } : { type: 'continue' };
  const X = { interactive: false, me: -1, step, nextIntent: next };
  if (d && !d.skipped && step === 0) { quizScreen(g, { ...v, quiz: { q: d.q, answers: d.answers, category: d.category }, result: null, removed: [] }, mouse, false, X); }
  else if (d && !d.skipped && step === 1) { quizScreen(g, { ...v, quiz: { q: d.q, answers: d.answers, category: d.category }, result: { picked: d.picked, correctShown: d.correctShown, right: d.right, why: d.why } }, mouse, true, X); }
  else { cardPickScreen(g, { ...v, hover: -1 }, mouse, { ...X, pickedIndex: v.offer.indexOf(d.cardId) }); }
  // a click anywhere moves on (the reveal's NEXT button is drawn on top of this)
  hits.unshift({ x: 0, y: 0, w: W, h: H, intent: next });
  if (step === last) { const t = 'click or press ENTER to continue'; const tw_ = TW(t, 1); R(W / 2 - tw_ / 2 - 4, H - 22, tw_ + 8, 13, C.ink); centre(t, W / 2, H - 20, C.dim, 1); }
}

// ---- match end ------------------------------------------------------------------------------------------------------------------
function matchEndScreen(g, v, mouse, X) {
  dim(g, 0.94);
  const w = v.winner;
  centre(names[w] + ' WINS THE MATCH', W / 2, 30, ACC[w], 3);
  centre('FINAL SCORE', W / 2, 74, C.dim, 1);
  centre(v.scores[0] + ' - ' + v.scores[1], W / 2, 86, C.text, 4);
  for (let p = 0; p < 2; p++) {
    const x = 20 + p * 306, bw = 294;
    frame(x, 116, bw, 168, C.bg, p === w ? C.amber : C.edge);
    TXT(names[p] + (p === w ? '  - WINNER' : ''), x + 10, 125, ACC[p], 1);
    TXT(v.builds[p].length + ' CARDS', x + bw - 10 - TW(v.builds[p].length + ' CARDS', 1), 125, C.dim, 1);
    buildRows(x + 10, 140, bw - 20, v.builds[p]);
  }
  const me = X.me, voted = v.again && v.again[me], other = v.again && v.again[1 - me];
  if (X.online) {
    if (voted) { frame(W / 2 - 110, 289, 220, 24, C.bg2, C.edge); centre('WAITING FOR ' + names[1 - me] + '...', W / 2, 297, C.amber, 1); }
    else button(W / 2 - 110, 289, 220, 24, other ? names[1 - me] + ' WANTS TO PLAY AGAIN' : 'PLAY AGAIN', mouse, { type: 'playAgain' }, other ? C.goodHi : C.amber);
    button(W / 2 - 50, 318, 100, 18, 'LEAVE', mouse, { type: '__leave' }, C.dim);
    centre(voted ? 'both players must agree' : 'press ENTER - both players must agree', W / 2, 341, C.dim, 1, true);
  } else {
    button(W / 2 - 80, 292, 160, 24, 'PLAY AGAIN', mouse, { type: 'playAgain' });
    centre('press ENTER', W / 2, 322, C.dim, 1, true);
  }
}

// ---- entry points --------------------------------------------------------------------------------------------------------------------
export function screenActive(state) { return state.phase !== 'playing' && state.phase !== 'roundEnd'; }

// mouse = { x, y } in canvas pixels (or null)
// me = which player is looking at this screen (0 = host / practice, 1 = online client). Only the round loser can click.
export function drawScreen(g, state, mouse, me = 0, online = false) {
  hits = [];
  if (!screenActive(state)) return;
  use(g);
  const v = matchView(state);
  const X = { me, online, interactive: me === v.loser && !(v.auto && v.auto[v.loser]) };
  switch (state.phase) {
    case 'quiz': if (v.quiz) quizScreen(g, v, mouse, false, X); break;
    case 'quizReveal': if (v.quiz && v.result) quizScreen(g, v, mouse, true, X); break;
    case 'cardPick': if (v.offer && v.offer.length) cardPickScreen(g, v, mouse, X); break;
    case 'dummyTurn': if (v.dummy) dummyScreen(g, v, mouse, state); break;
    case 'matchEnd': matchEndScreen(g, v, mouse, X); break;
    default: break;
  }
}

// Keyboard: 1-4 answer (never A-D: those are movement keys), 1-5 take a card, Enter / Space continue.
export function keyIntent(state, code, me = 0) {
  const digit = /^Digit([1-5])$/.exec(code) || /^Numpad([1-5])$/.exec(code);
  const v = matchView(state), enter = code === 'Enter' || code === 'Space' || code === 'NumpadEnter';
  if (state.phase === 'dummyTurn') return enter ? { type: '__next' } : null;     // the UI decides: next step or continue
  if (state.phase !== 'matchEnd' && me !== v.loser) return null;                 // the watcher cannot act
  switch (state.phase) {
    case 'quiz': return digit && +digit[1] <= 4 ? { type: 'answer', index: +digit[1] - 1 } : null;
    case 'quizReveal': return enter ? { type: 'continue' } : null;
    case 'cardPick': {
      if (!digit) return null;
      const id = v.offer[+digit[1] - 1];
      return id && !v.removed.includes(id) ? { type: 'pick', cardId: id } : null;
    }
    case 'matchEnd': return enter ? { type: 'playAgain' } : null;
    default: return null;
  }
}
