// ============================================================================
//  main.js - bootstrap. The page opens on the LOBBY: create a room, join one, or practise.
//  One "mode" is active at a time:
//     lobby    nothing runs; the lobby is drawn over a frozen scene
//     practice local match against the dummy (src/practice)
//     host     online, this tab runs the simulation (src/net/host-session.js), player 0
//     guest    online, this tab only displays the host's snapshots (src/net/guest-session.js), player 1
//
//  URL test parameters (any of the first group skips the lobby and starts practice directly):
//    ?autostart=1        practice, no lobby                ?demo=1         a bot also drives YOUR player (implies autostart)
//    ?screen=quiz|quizreveal|cardpick|dummy|matchend  (&answer=right|wrong &quiz=right|wrong &qid= &offer=a,b,c,d,e &score=3-1 &round=N &step=0|1|2 &winner=1)
//    ?scenario=explosion|hazard   scripted test situations
//    ?scenario=glide|climb|arc    physics pictures: wall glide, one-wall climb (&stopAfter=N), a stream of bullets along one arc
//    ?menu=1             open the Esc menu (help) right away      ?rotate=1   keep the map rotation on in the test URLs   ?prebuild=0   do not pre-build the other maps' backdrops
//    ?debug=1            open the debug panel              ?hitboxes=1     show hitboxes
//    ?cards=a,b          cards for you (ids)               ?dcards=a,b     cards for the dummy
//    ?map=id             start on this map                 ?dummy=active|passive|off
//    ?seed=n             RNG seed                          ?stopAfter=N    freeze the sim after N ticks
//    ?warmup=N           run N ticks instantly before the first frame   ?time=N   start the round clock at N seconds
//    ?dump=1             write a JSON state summary into the page       ?selftest=1  drive the quiz flow with synthetic events
//  Online:
//    #join=ABCDE         (in the page address) join that room automatically
//    ?local=1            use the BroadcastChannel loopback (two tabs of this browser, no internet) instead of PeerJS
//    ?latency=80&jitter=20&loss=2   simulated network conditions for the loopback (ms, ms, percent)
// ============================================================================
import { CONFIG } from './config.js';
import { MAPS, registerMap, getMap } from './maps/index.js';
import { solveAimFromBody } from './sim/aim.js';
import { STEP, setCards, intent } from './sim/world.js';
import { debugQuiz, debugCardPick, debugMatchEnd, debugSetScore, answerQuiz } from './sim/match.js';
import { CARDS_BY_ID } from './cards.js';
import { drawScreen, screenActive, hitIntent, keyIntent, getHover, nextDummyStep, setDummyStep } from './client/screens.js';
import { createPracticeSession } from './practice/practice-session.js';
import { createRenderer } from './client/render.js';
import { createFx, fxEvents, fxUpdate } from './client/fx.js';
import { drawHud, drawPing, drawNetBanner, drawToast, drawMapBanner, drawHint } from './client/hud.js';
import { createInput } from './client/input.js';
import { createDebugPanel } from './client/debug-panel.js';
import { createLobby } from './client/lobby.js';
import { chooseNetwork, createRoom, joinRoom, describeError } from './net/connect.js';
import { inviteLink, codeFromHash } from './net/room-code.js';
import { pxSVG } from './client/px.js';
import { getBackgroundStatus } from './client/background.js';

const params = new URLSearchParams(location.search);
if (params.get('predict') === '0') CONFIG.net.predictOwnMovement = false;   // ?predict=0: see the host's view of yourself (to compare the feel)
const list = (k) => (params.get(k) ? params.get(k).split(',').filter(Boolean) : []);
const DEFAULT_NAMES = [...CONFIG.player.names];

// ---- errors become visible (always; most useful with ?debug=1) -----------------------------------------------
const errbox = document.getElementById('errbox');
function showError(msg) { errbox.hidden = false; errbox.textContent += msg + '\n'; }
window.addEventListener('error', (e) => showError('ERROR: ' + e.message + ' @ ' + (e.filename || '').split('/').pop() + ':' + e.lineno));
window.addEventListener('unhandledrejection', (e) => showError('PROMISE: ' + (e.reason && e.reason.stack || e.reason)));

// ---- shared pieces ---------------------------------------------------------------------------------------------------
const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
renderer.showHitboxes = params.get('hitboxes') === '1';
const fx = createFx();
const input = createInput(canvas);
let fps = 60, frames = 0, fpsT = 0;
input.gate = () => {                               // may the keyboard / mouse control the player right now?
  const m = mode;
  if (m.kind === 'lobby') return false;
  const st = m.session.state;
  if (screenActive(st)) return false;
  if (m.kind === 'guest') return m.session.status === 'playing' && st.phase === 'playing';
  if (m.kind === 'host') return m.session.status === 'playing';
  return true;
};
let toast = null;                                  // { text, icon, tint, until }
const BANNER_MS = Number(params.get('bannerms')) || 3200;      // how long the map name stays (?bannerms=60000 for pictures)
let mapBanner = null;                              // { round, name, from } the map name shown at the start of a round
function showMapBanner(mapId, round) { try { mapBanner = { round, name: getMap(mapId).name, from: performance.now() }; } catch (e) { mapBanner = null; } }

function fit() {
  // integer scale (crisp pixels) from 2x up; below that the canvas shrinks in quarter steps instead of staying tiny (960x540 -> 1.5x, 800x450 -> 1.25x)
  const s0 = Math.min(window.innerWidth / CONFIG.render.canvasW, window.innerHeight / CONFIG.render.canvasH);
  const s = s0 >= 2 ? Math.floor(s0) : Math.max(0.5, Math.floor(s0 * 4) / 4);
  canvas.style.width = CONFIG.render.canvasW * s + 'px';
  canvas.style.height = CONFIG.render.canvasH * s + 'px';
}
// The DOM boxes (lobby, Esc menu) are laid out at a fixed size: in a small window they are shrunk (CSS zoom) to fit instead of being cut off.
function fitBoxes() {
  for (const sel of ['#lobby .lb-box', '#pausemenu .ov-box']) {
    const el = document.querySelector(sel); if (!el) continue;
    el.style.zoom = '1';
    const k = Math.min(1, (window.innerHeight - 12) / Math.max(1, el.offsetHeight), (window.innerWidth - 12) / Math.max(1, el.offsetWidth));
    el.style.zoom = k < 1 ? String(Math.max(0.4, k)) : '1';
  }
}
window.addEventListener('resize', () => { fit(); fitBoxes(); }); fit();
new MutationObserver(() => fitBoxes()).observe(document.getElementById('stage'), { childList: true, subtree: true });

function applyNames(names) { CONFIG.player.names[0] = names[0] || DEFAULT_NAMES[0]; CONFIG.player.names[1] = names[1] || DEFAULT_NAMES[1]; }

// ---- practice session (also the frozen backdrop of the lobby) -------------------------------------------------------------
// The map rule (practice and online alike, the host decides): a new map every round, shuffled so all of them appear before any repeats
// (sim/world.js drawMap). ?map=id pins one map; the test URLs (autostart, scenario, screen...) pin the first map so pictures stay the same.
const pinnedMap = () => params.get('map') || (SCEN === 'glide' || SCEN === 'climb' ? 'phys-yard' : SCEN === 'arc' ? 'phys-arc' : urlStart && params.get('rotate') !== '1' ? MAPS[0].id : null);
function makePractice(forLobby) {
  const pin = forLobby ? MAPS[0].id : pinnedMap();
  const s = createPracticeSession({
    mapId: pin || undefined, mapLock: pin || null, rotate: !pin,
    cards: [list('cards'), list('dcards')],
    seed: Number(params.get('seed')) || (urlStart ? 12345 : Date.now() % 100000),
    demo: params.get('demo') === '1',
  });
  if (params.get('demo') === '1') s.state.match.auto = [true, true];
  if (params.get('dummy')) s.bot.mode = params.get('dummy');
  if (params.get('time')) s.state.roundTime = Number(params.get('time'));
  if (params.get('stopAfter')) s.stopAfterTicks = Number(params.get('stopAfter'));
  return s;
}

// ---- physics picture scenarios: small variations of the real map (registered only when asked for) -----------------------------
const SCEN = params.get('scenario');
if (SCEN === 'glide' || SCEN === 'climb') {            // the left pillar becomes a tall wall
  const base = MAPS[0];
  registerMap({ ...base, id: 'phys-yard', name: 'Physics yard', solids: base.solids.filter((s) => !(s.x === 250 && s.y === 330) && !(s.x === 210 && s.y === 190)).map((s) => (s.x === 330 && s.y === 416 ? { ...s, y: 80, h: 400 } : s)) });   // (the overhanging step and perch beside the wall are removed so nothing bonks the climber)
}
if (SCEN === 'arc') {                                    // an empty floor so the whole flight of the bullets can be seen
  const base = MAPS[0];
  registerMap({ ...base, id: 'phys-arc', name: 'Physics arc', solids: [{ x: 0, y: 500, w: 1280, h: 40 }], destructibles: [], platforms: [], hazards: [], spawns: [{ x: 120, y: 485 }, { x: 1160, y: 485 }] });
}

const urlStart = params.get('autostart') === '1' || params.get('demo') === '1' || !!params.get('scenario') || !!params.get('screen') || params.get('selftest') === '1';
let mode = { kind: 'lobby', session: makePractice(true), me: 0 };
let room = null, joined = null;                    // the host's room / the client's connection

// ---- test scenarios and screen parameters (practice only) -------------------------------------------------------------
function applyTestParams(session) {
  const st = session.state, scr = params.get('screen'), right = params.get('answer') === 'right' || params.get('quiz') === 'right';
  if (params.get('scenario') === 'explosion') {
    setCards(st, 0, ['powderkeg']); session.bot.mode = 'off';
    session.scripted = (S) => { const p = S.state.players[0]; return { left: false, right: false, jump: false, jumpPressed: false, block: false, shoot: S.ticks === 8, aim: Math.atan2(472 - p.y, 262 - p.x) }; };
    if (!params.get('stopAfter')) session.stopAfterTicks = 26;
  }
  if (params.get('scenario') === 'hazard') {
    const p = st.players[0]; p.x = 590; p.y = 440; p.vy = -200; session.bot.mode = 'off';
    session.scripted = () => ({ left: false, right: false, jump: false, jumpPressed: false, block: false, shoot: false, aim: 0.3 });
    if (!params.get('stopAfter')) session.stopAfterTicks = 8;
  }
  const NONE = { left: false, right: false, jump: false, jumpPressed: false, shoot: false, block: false, aim: 0 };
  if (SCEN === 'glide' || SCEN === 'climb') {
    session.bot.mode = 'off'; st.cheats.invulnerable = [true, true];
    const p = st.players[0]; p.x = 315; p.vx = 0; p.vy = 0; p.y = SCEN === 'glide' ? 150 : 465;   // beside the wall's left face
    let prev = false;
    session.scripted = (S) => {                                // hold into the wall; for the climb tap jump on every touch (like a player who keeps the key down)
      const q = S.state.players[0];
      if (SCEN === 'glide') return { ...NONE, right: true };
      const want = (q.grounded || q.wallCoyote > 0) && q.wallRegrab <= 0;
      const f = { ...NONE, right: true, jump: true, jumpPressed: want && !prev }; prev = want; return f;
    };
    if (!params.get('stopAfter')) session.stopAfterTicks = SCEN === 'glide' ? 40 : 100;
  }
  if (SCEN === 'arc') {
    session.bot.mode = 'off'; st.cheats.invulnerable = [true, true];
    const p = st.players[0]; p.stats.fireRate = 9; p.stats.magazine = 40; p.ammo = 40;       // a stream of bullets, 0.11 s apart, all on the same arc
    const aim = solveAimFromBody(p.x, p.y, st.players[1].x, st.players[1].y, p.stats.bulletSpeed, p.stats.bulletGravity, CONFIG.player.muzzleDistance);
    session.scripted = () => ({ ...NONE, shoot: true, aim });
    if (!params.get('stopAfter')) session.stopAfterTicks = 50;
  }
  if (params.get('score')) { const [a, b] = params.get('score').split('-').map(Number); debugSetScore(st, a || 0, b || 0); }
  if (params.get('round')) st.round = Number(params.get('round'));
  if (params.get('qid') && !scr) debugQuiz(st, 0, params.get('qid'));
  if (scr === 'quiz') debugQuiz(st, 0, params.get('qid') || undefined);
  if (scr === 'quizreveal') { debugQuiz(st, 0, params.get('qid') || undefined); const c = st.match.quiz.correctShown; answerQuiz(st, 0, right ? c : (c + 1) % 4); }
  if (scr === 'cardpick') { debugCardPick(st, 0, right); if (params.get('offer')) { st.match.offer = list('offer'); st.match.removed = right ? [] : st.match.offer.slice(0, 3); } }
  if (scr === 'dummy') {
    CONFIG.match.dummyRightChance = params.get('answer') === 'right' ? 1 : params.get('answer') === 'wrong' ? 0 : CONFIG.match.dummyRightChance;
    debugQuiz(st, 1, params.get('qid') || undefined);
    if (params.get('step')) setDummyStep(Number(params.get('step')));
  }
  if (scr === 'matchend') debugMatchEnd(st, params.get('winner') === '1' ? 1 : 0);
}

// ---- modes ----------------------------------------------------------------------------------------------------------------------
const lobbyEl = document.getElementById('lobby');
function resetVisuals() { mapBanner = null; fx.parts.length = 0; fx.anims.length = 0; fx.flash = [0, 0]; fx.blockFlash = [0, 0]; fx.shake = 0; toast = null; renderer.trails.clear(); }

function enterPractice() {
  leaveNetwork();
  applyNames(DEFAULT_NAMES);
  mode = { kind: 'practice', session: makePractice(), me: 0 };
  applyTestParams(mode.session);
  resetVisuals(); lobby.hide();
  showMapBanner(mode.session.state.mapId, mode.session.state.round);
}

function leaveNetwork() {
  if (room) { const r = room; room = null; r.close(); }
  if (joined) { const j = joined; joined = null; j.close(); }
}

function toLobby(message) {
  leaveNetwork();
  applyNames(DEFAULT_NAMES);
  mode = { kind: 'lobby', session: makePractice(true), me: 0 };
  resetVisuals();
  document.getElementById('pausemenu').hidden = true;
  lobby.showMenu(message || '');
  history.replaceState(null, '', location.pathname + location.search);   // drop #join=... so a reload does not rejoin
}

let netCache = null;
const getNet = () => (netCache = netCache || chooseNetwork(params));
const playerName = () => lobby.name || '';

// Online play needs WebRTC (every current browser has it; some privacy modes / old browsers switch it off). Say so plainly instead of failing silently.
const NO_WEBRTC = 'This browser has no WebRTC, which online play needs. Use a current Chrome, Edge, Firefox or Safari (and check that WebRTC is not switched off in a privacy setting). Practice against the dummy still works.';
function webrtcMissing() { return params.get('local') !== '1' && (typeof RTCPeerConnection === 'undefined' || typeof window.Peer === 'undefined'); }

function startCreate() {
  if (webrtcMissing()) { toLobby(NO_WEBRTC); return; }
  lobby.showCreating();
  const net = getNet();
  const r = createRoom(net, {
    name: playerName() || DEFAULT_NAMES[0], seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0, mapLock: params.get('map') || null,
    getLocalInput: (p) => input.sample(p),
  }, {
    onReady: (code) => { lobby.showWaiting(code, inviteLink(code)); },
    onError: (err) => { room = null; toLobby(describeError(err)); },
    onStatus: (status, text) => {
      if (status === 'playing' && room) { applyNames(room.host.names); resetVisuals(); mode = { kind: 'host', session: room.host, me: 0 }; lobby.hide(); showMapBanner(room.host.state.mapId, room.host.state.round); }
    },
    onEnded: (reason) => { if (room) toLobby(reason === 'left' ? '' : reason); },
  });
  room = r;
}

function startJoin(code, name) {
  if (webrtcMissing()) { toLobby(NO_WEBRTC); return; }
  lobby.showJoining(code, '');
  const net = getNet();
  let token = null; try { token = sessionStorage.getItem('rab-token-' + code); } catch (e) { /* ignore */ }
  const j = joinRoom(net, { code, name: name || DEFAULT_NAMES[1], token, getLocalInput: (p) => input.sample(p) }, {
    onError: (err) => { joined = null; toLobby(describeError(err)); },
    onStatus: (status, text) => {
      if (status === 'connecting') lobby.setStatus('Connecting (' + text + ')...');
      if (status === 'playing' && joined) {
        applyNames(joined.guest.names); try { sessionStorage.setItem('rab-token-' + code, joined.guest.token); } catch (e) { /* ignore */ }
        if (mode.kind !== 'guest') { resetVisuals(); mode = { kind: 'guest', session: joined.guest, me: 1 }; lobby.hide(); showMapBanner(joined.guest.state.mapId, joined.guest.state.round); }
      }
    },
    onEnded: (reason) => { if (joined) toLobby(reason === 'left' ? '' : reason); },
  });
  joined = j;
}

const lobby = createLobby(lobbyEl, {
  onPractice: () => enterPractice(),
  onCreate: () => startCreate(),
  onJoin: (code) => startJoin(code, lobby.name),
  onCancel: () => toLobby(''),
});

// ---- intents from clicks / keys on the between-rounds screens (the UI never edits the match itself) ----
function currentState() { const m = mode; return m.kind === 'guest' ? m.session.state : m.session.state; }
function sendIntent(it) {
  if (!it) return;
  if (it.type === '__leave') { toLobby(''); return; }
  if (it.type === '__next') { it = nextDummyStep(currentState()); if (!it) return; }
  const m = mode;
  if (m.kind === 'practice') {
    const r = intent(m.session.state, 0, it);
    if (r.ok) { fxEvents(fx, r.events); noteEvents(r.events); m.session.prev = null; } else if (it.type !== 'hover') console.warn('intent rejected:', r.error);
  } else if (m.kind === 'host') {
    const r = m.session.sendIntent(it); if (!r.ok && it.type !== 'hover') console.warn('intent rejected:', r.error);
  } else if (m.kind === 'guest') m.session.sendIntent(it);
}
function canvasPos(logical) { return { x: logical.x / (CONFIG.field.w / CONFIG.render.canvasW), y: logical.y / (CONFIG.field.h / CONFIG.render.canvasH) }; }
canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0 || mode.kind === 'lobby' || !screenActive(currentState())) return;
  const r = canvas.getBoundingClientRect();
  sendIntent(hitIntent((e.clientX - r.left) / r.width * CONFIG.render.canvasW, (e.clientY - r.top) / r.height * CONFIG.render.canvasH));
});
window.addEventListener('keydown', (e) => {
  if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
  if (mode.kind === 'lobby') return;
  if (e.code === 'Escape') { togglePauseMenu(); return; }
  if (!screenActive(currentState())) return;
  const it = keyIntent(currentState(), e.code, mode.me);
  if (it) { e.preventDefault(); sendIntent(it); }
});

// ---- Esc menu ------------------------------------------------------------------------------------------------------------------------
const pauseEl = document.getElementById('pausemenu');
function togglePauseMenu() {
  if (!pauseEl.hidden) { pauseEl.hidden = true; return; }
  const online = mode.kind === 'host' || mode.kind === 'guest';
  const help = [['MOVE', 'A / D'], ['JUMP', 'W OR SPACE'], ['WALL CLIMB', 'HOLD INTO A WALL, TAP JUMP'], ['AIM', 'MOUSE'], ['SHOOT', 'LEFT CLICK (SHOTS DROP: AIM HIGH FAR AWAY)'], ['BLOCK', 'RIGHT CLICK (STOPS BULLETS)'], ['QUIZ', '1-4 OR CLICK, ENTER = CONTINUE'], ['DEBUG PANEL', '` OR F1 / F2']]
    .map(([k, v]) => `<div class="hp-k">${pxSVG(k, 1)}</div><div class="hp-v">${pxSVG(v, 1)}</div>`).join('');
  pauseEl.innerHTML = `<div class="ov-box"><div class="ov-sub">${pxSVG('PAUSED', 3)}</div>
    <button class="lb-btn" id="pm-resume">${pxSVG('KEEP PLAYING', 2)}</button>
    <div class="hp">${help}</div><div class="hp-note">${pxSVG('FALLING OFF THE SIDES OR THE BOTTOM HURTS.', 1)}${pxSVG('THE TOP OF THE SCREEN IS FREE: JUMP OUT AND COME BACK.', 1)}</div>
    <button class="lb-btn lb-dim" id="pm-leave">${pxSVG(online ? 'LEAVE (ENDS THE MATCH)' : 'BACK TO THE MENU', 2)}</button></div>`;
  pauseEl.hidden = false;
  pauseEl.querySelector('#pm-resume').onclick = () => { pauseEl.hidden = true; };
  pauseEl.querySelector('#pm-leave').onclick = () => { pauseEl.hidden = true; toLobby(''); };
}

// ---- debug panel -----------------------------------------------------------------------------------------------------------------------------
const pingText = () => { const s = mode.session; const p = s && s.ping; return mode.kind === 'host' || mode.kind === 'guest' ? (p === null || p === undefined ? '-' : Math.round(p) + ' ms') : '-'; };
const panel = createDebugPanel(document.getElementById('debug'), { getSession: () => mode.session, renderer, getFps: () => fps, getPing: pingText });
if (params.get('debug') === '1') panel.toggle(true);
window.addEventListener('keydown', (e) => { if (CONFIG.debug.toggleKeys.includes(e.code)) { e.preventDefault(); panel.toggle(); } });

// ---- toast: "EMBER TOOK PINBALL" for both players -----------------------------------------------------------------------------------------------
function noteEvents(events) {
  for (const e of events) if (e.type === 'roundStart') showMapBanner(e.mapId, e.round);
  for (const e of events) if (e.type === 'cardPicked') {
    const card = CARDS_BY_ID[e.cardId]; if (!card) continue;
    toast = { text: CONFIG.player.names[e.player] + ' TOOK ' + card.name.toUpperCase(), icon: card.icon, tint: e.player === 0 ? '#c77c44' : '#7bbfae', until: performance.now() + 3200 };
  }
}

// ---- start ---------------------------------------------------------------------------------------------------------------------------------------------
if (urlStart) { enterPractice(); }
else {
  lobby.showMenu();
  const code = codeFromHash(location.hash);
  if (code) { lobby.prefillCode(code); setTimeout(() => startJoin(code, lobby.name), 100); }
}
window.addEventListener('hashchange', () => { const c = codeFromHash(location.hash); if (c && mode.kind === 'lobby') { lobby.prefillCode(c); startJoin(c, lobby.name); } });

if (params.get('warmup') && mode.kind === 'practice') {
  const n = Number(params.get('warmup'));
  for (let i = 0; i < n; i++) mode.session.update(STEP, (p) => input.sample(p), (events) => { fxEvents(fx, events); fxUpdate(fx, STEP); });
}

// ---- main loop ---------------------------------------------------------------------------------------------------------------------------------------------
let last = performance.now(), lastHover = -2, lastHoverAt = 0;
function frame(now) {
  const dt = Math.min(0.25, Math.max(0, (now - last) / 1000)); last = now;
  frames++; fpsT += dt; if (fpsT >= 0.5) { fps = frames / fpsT; frames = 0; fpsT = 0; }
  const m = mode, S = m.session;
  let state = S.state, prev = null, alpha = 1;

  if (m.kind === 'practice') {
    input.enabled = !screenActive(S.state);
    S.update(dt, (p) => input.sample(p), (events) => { fxEvents(fx, events); noteEvents(events); fxUpdate(fx, STEP); });
    prev = S.prev; alpha = S.alpha();
  } else if (m.kind === 'host') {
    input.enabled = !screenActive(S.state) && S.status === 'playing';
    const ev = S.drainEvents(); fxEvents(fx, ev); noteEvents(ev); fxUpdate(fx, dt);
    prev = S.prev; alpha = S.alpha();
  } else if (m.kind === 'guest') {
    const r = S.render(now);
    state = r.state; alpha = r.alpha;
    fxEvents(fx, r.events); noteEvents(r.events); fxUpdate(fx, dt);
    input.enabled = !screenActive(state) && S.status === 'playing' && state.phase === 'playing';
  } else input.enabled = false;

  const online = m.kind === 'host' || m.kind === 'guest';
  renderer.draw(state, prev, alpha, fx);
  if (m.kind !== 'lobby') {
    if (!screenActive(state)) { drawHud(renderer.g, state); drawHint(renderer.g); }
    drawScreen(renderer.g, state, input.moved ? canvasPos(input.mouse) : null, m.me, online);
    if (toast && performance.now() < toast.until && !screenActive(state)) drawToast(renderer.g, toast.text, toast.icon, toast.tint);
    if (mapBanner && !screenActive(state) && !(online && (S.status === 'paused' || S.status === 'reconnecting'))) { const age = performance.now() - mapBanner.from; if (age < BANNER_MS) drawMapBanner(renderer.g, mapBanner.round, mapBanner.name, Math.min(1, (BANNER_MS - age) / 700, age / 150)); else mapBanner = null; }
    if (online) {
      drawPing(renderer.g, S.ping);
      if (m.kind === 'host' && S.status === 'paused') drawNetBanner(renderer.g, ['OPPONENT DISCONNECTED', 'WAITING FOR THEM TO COME BACK: ' + Math.max(0, Math.ceil(CONFIG.net.graceSeconds - (performance.now() - S.pausedAt) / 1000)) + ' S', 'THE MATCH IS PAUSED']);
      if (m.kind === 'guest' && S.status === 'reconnecting') drawNetBanner(renderer.g, ['CONNECTION LOST', 'TRYING TO RECONNECT: ' + Math.max(0, Math.ceil(CONFIG.net.graceSeconds - (performance.now() - S.lostAt) / 1000)) + ' S']);
      // the picker's hover goes to the other screen (throttled)
      if (state.phase === 'cardPick' && state.match.loser === m.me) {
        const h = getHover();
        if (h !== lastHover && now - lastHoverAt > 90) { lastHover = h; lastHoverAt = now; sendIntent({ type: 'hover', index: h }); }
      } else lastHover = -2;
    }
  }
  if (dumpEl) dumpEl.textContent = JSON.stringify({ mode: m.kind, tick: state.tick, phase: state.phase, round: state.round, status: S.status || null, ping: S.ping ?? null, pred: m.kind === 'guest' && S.predict ? { on: S.predict.enabled && S.predict.active, ...S.predict.summary() } : null, players: state.players.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), hp: Math.round(p.hp), alive: p.alive, ammo: p.ammo, cards: p.cards.length })), bullets: state.bullets.length, scores: state.scores, errors: errbox.textContent });
  requestAnimationFrame(frame);
}
const dumpEl = params.get('dump') === '1' ? Object.assign(document.body.appendChild(document.createElement('pre')), { id: 'dump' }) : null;
if (dumpEl) dumpEl.style.cssText = 'position:fixed;left:0;bottom:0;margin:0;font:10px monospace;color:#9be15d;background:#000a;z-index:40;max-width:100vw;white-space:pre-wrap';
requestAnimationFrame(frame);

window.__game = { bgStatus: getBackgroundStatus, get mode() { return mode; }, get session() { return mode.session; }, fx, renderer, lobby, toLobby, startCreate, startJoin, enterPractice, get room() { return room; }, get joined() { return joined; } };   // handy in the console / for tests

// ---- ?selftest=1 : drives the quiz -> reveal -> card pick flow with synthetic mouse / key events ----------------------------------------------
if (params.get('selftest') === '1') {
  const out = document.body.appendChild(document.createElement('pre')); out.id = 'selftest'; out.style.cssText = 'position:fixed;left:8px;top:8px;margin:0;padding:6px;font:14px monospace;color:#9be15d;background:#000c;z-index:50';
  const log = [];
  const clickAt = (cx, cy) => { const r = canvas.getBoundingClientRect(); canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: r.left + cx / CONFIG.render.canvasW * r.width, clientY: r.top + cy / CONFIG.render.canvasH * r.height, bubbles: true, cancelable: true })); };
  const find = (pred) => { for (let y = 0; y < 360; y += 2) for (let x = 0; x < 640; x += 2) { const it = hitIntent(x, y); if (it && pred(it)) return [x, y]; } return null; };
  let n = 0;
  const go = () => {
    n++;
    const st = mode.session.state;
    if (n === 5) {
      log.push('start:' + st.phase);
      const p = find((it) => it.type === 'answer' && it.index === 2); log.push('answer3 hit at ' + p);
      clickAt(p[0], p[1]); log.push('after click:' + st.phase + ' picked=' + (st.match.result && st.match.result.picked));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', bubbles: true })); log.push('after Enter:' + st.phase);
    }
    if (n === 8) {
      const p = find((it) => it.type === 'pick'); log.push('card hit at ' + p);
      clickAt(p[0], p[1]); log.push('after pick:' + st.phase + ' cards=' + st.players[0].cards.join(',') + ' round=' + st.round + ' alive=' + st.players[0].alive);
      out.textContent = log.join('\n') + '\nerrors: ' + (errbox.textContent || 'none');
      return;
    }
    requestAnimationFrame(go);
  };
  requestAnimationFrame(go);
}

// ?menu=1 opens the Esc menu (help + leave) right away (pictures, tests)
if (params.get('menu') === '1') setTimeout(() => { if (pauseEl.hidden) togglePauseMenu(); }, 400);
