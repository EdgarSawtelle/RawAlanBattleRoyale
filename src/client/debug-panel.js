// ============================================================================
//  debug-panel.js - plain HTML overlay for testing. Toggle with ` (backquote), F1 or F2.
//  Everything here only pokes the session / state through public functions; nothing in the
//  simulation depends on it.
// ============================================================================
import { CARDS, CARDS_BY_ID } from '../cards.js';
import { MAPS, ROTATION, getMap } from '../maps/index.js';
import { loadMap, setCards, healAll, startRound, intent } from '../sim/world.js';
import { debugQuiz, debugCardPick, debugMatchEnd, debugSetScore, validQuestions } from '../sim/match.js';
import { killPlayer } from '../sim/combat.js';
import { CONFIG } from '../config.js';
import { describePath, pct, QUALITY_COLOR } from '../net/quality.js';
import { listBackgrounds, setBackgroundOverride, getBackgroundOverride, setBackgroundAnimated, isBackgroundAnimated, getBackgroundStatus } from './background.js';

// Online: the cheats (give cards, heal, jump to screens, set score, map, pause...) only exist for the HOST and act on the
// authoritative state; a CLIENT only gets the read-only info and the local hitbox toggle.
export function createDebugPanel(root, { getSession, renderer, getFps, getPing }) {
  let giveTo = 'me';            // 'me' | 'dummy' | 'both'
  const sess = () => getSession();
  const state = () => sess().state;
  const cheatsAllowed = () => { const r = sess(); return !!r && r.role !== 'guest'; };

  root.innerHTML = `
    <div class="dbg-head"><b>DEBUG</b><span class="dbg-keys">toggle: \` / F1 / F2</span></div>
    <div class="dbg-row dbg-info"><span>FPS <b id="dbg-fps">-</b></span><span>PING <b id="dbg-ping">-</b></span><span>PRED <b id="dbg-pred">-</b></span><span>TICK <b id="dbg-tick">0</b></span><span>BULLETS <b id="dbg-bul">0</b></span></div>
    <div id="dbg-netbox" hidden><div class="dbg-sec">Network <span id="dbg-netq" class="dbg-sub"></span></div><div id="dbg-net" class="dbg-sub" style="line-height:1.45;white-space:pre-wrap"></div></div>
    <div class="dbg-sec">Background <span id="dbg-bgstat" class="dbg-sub"></span></div>
    <div class="dbg-row"><select id="dbg-bg"></select><select id="dbg-bgv"></select></div>
    <label><input type="checkbox" id="dbg-bganim"> animate background (off = frozen frame, for slow machines)</label>
    <div class="dbg-sec">Display / cheats</div><div id="dbg-note" class="dbg-sub"></div>
    <label><input type="checkbox" id="dbg-hit"> show hitboxes</label>
    <label><input type="checkbox" id="dbg-anim"> character animations (squash, run cycle, wall paws; off = rigid sprite)</label>
    <label data-cheat><input type="checkbox" id="dbg-inv"> I am invulnerable</label>
    <label data-cheat><input type="checkbox" id="dbg-pause"> pause</label>
    <div class="dbg-row" data-cheat>
      <button id="dbg-step" data-practice>step 1 tick</button>
      <button id="dbg-heal">heal both</button>
      <button id="dbg-restart">restart round</button>
    </div>
    <div class="dbg-row" data-cheat><span data-practice>dummy:
      <select id="dbg-dummy"><option value="active">on (fights)</option><option value="passive">passive (moves only)</option><option value="off">off (stands still)</option></select></span>
      speed:
      <select id="dbg-speed"><option value="0.25">0.25x</option><option value="0.5">0.5x</option><option value="1" selected>1x</option><option value="2">2x</option></select>
    </div>
    <div data-cheat>
    <div class="dbg-sec">Match / quiz</div>
    <div class="dbg-row">
      <button id="dbg-quiz">quiz (me)</button><button id="dbg-dummyturn">dummy turn</button>
      <button id="dbg-pickr">card pick (right)</button><button id="dbg-pickw">card pick (wrong)</button>
    </div>
    <div class="dbg-row">
      <button id="dbg-win">I win round now</button><button id="dbg-lose">I lose round now</button><button id="dbg-mend">match end</button>
    </div>
    <div class="dbg-row">score <input id="dbg-s0" type="number" min="0" max="5" value="0" style="width:38px"> - <input id="dbg-s1" type="number" min="0" max="5" value="0" style="width:38px"> <button id="dbg-setscore">set</button></div>
    <div class="dbg-row">question id <input id="dbg-qid" type="text" placeholder="a-001" style="width:70px"> <button id="dbg-showq">show</button>
      <button id="dbg-prevq">&lt; prev</button><button id="dbg-nextq">next &gt;</button> <span id="dbg-qinfo" class="dbg-sub"></span></div>
    <div class="dbg-sec">Map</div>
    <div class="dbg-row"><select id="dbg-map"></select></div>
    <div class="dbg-sec">Cards <span class="dbg-sub">give to:
      <select id="dbg-give"><option value="me">me</option><option value="dummy">dummy / opponent</option><option value="both">both</option></select></span></div>
    <div id="dbg-cards" class="dbg-cards"></div>
    <div class="dbg-row"><button id="dbg-clear">clear cards</button></div>
    </div>
    <div id="dbg-owned" class="dbg-owned"></div>
  `;
  const $ = (id) => root.querySelector('#' + id);

  // match / quiz tools (all go through the same match module as the real flow)
  const num = (id) => Math.max(0, Math.min(9, Number($(id).value) || 0));
  const qids = () => validQuestions().map((q) => q.id);
  let qi = -1;
  const showQ = (id) => { debugQuiz(state(), 0, id); $('dbg-qinfo').textContent = id + ' (' + (qids().indexOf(id) + 1) + '/' + qids().length + ')'; };
  $('dbg-quiz').onclick = () => debugQuiz(state(), 0);
  $('dbg-dummyturn').onclick = () => debugQuiz(state(), 1);
  $('dbg-pickr').onclick = () => debugCardPick(state(), 0, true);
  $('dbg-pickw').onclick = () => debugCardPick(state(), 0, false);
  $('dbg-win').onclick = () => { if (state().phase === 'playing') killPlayer(state(), 1, 0); };
  $('dbg-lose').onclick = () => { if (state().phase === 'playing') killPlayer(state(), 0, 1); };
  $('dbg-mend').onclick = () => debugMatchEnd(state(), 0);
  $('dbg-setscore').onclick = () => debugSetScore(state(), num('dbg-s0'), num('dbg-s1'));
  $('dbg-showq').onclick = () => { const id = $('dbg-qid').value.trim(); if (qids().includes(id)) { qi = qids().indexOf(id); showQ(id); } else $('dbg-qinfo').textContent = 'unknown id'; };
  $('dbg-nextq').onclick = () => { const a = qids(); qi = (qi + 1) % a.length; $('dbg-qid').value = a[qi]; showQ(a[qi]); };
  $('dbg-prevq').onclick = () => { const a = qids(); qi = (qi - 1 + a.length) % a.length; $('dbg-qid').value = a[qi]; showQ(a[qi]); };

  // background scene / variant / animation (local and cosmetic: allowed for everyone)
  const bgSel = $('dbg-bg'), bgvSel = $('dbg-bgv'), bgAnim = $('dbg-bganim');
  bgSel.add(new Option('(the map\'s own)', ''));
  for (const s of listBackgrounds()) bgSel.add(new Option(s.name, s.id));
  const fillVariants = () => { const s = listBackgrounds().find((x) => x.id === bgSel.value); bgvSel.innerHTML = ''; bgvSel.hidden = !s; if (s) s.variants.forEach((v, i) => bgvSel.add(new Option(i + ' - ' + v, i))); };
  const ov = getBackgroundOverride(); bgSel.value = ov ? ov.id : ''; fillVariants(); if (ov) bgvSel.value = String(ov.variant);
  bgSel.onchange = () => { fillVariants(); setBackgroundOverride(bgSel.value || null, 0); };
  bgvSel.onchange = () => setBackgroundOverride(bgSel.value, Number(bgvSel.value));
  bgAnim.checked = isBackgroundAnimated(); bgAnim.onchange = () => setBackgroundAnimated(bgAnim.checked);

  // maps
  const mapSel = $('dbg-map');
  { const o = document.createElement('option'); o.value = ''; o.textContent = 'rotate: a new map every round'; mapSel.appendChild(o); }
  { // 30+ maps: grouped by backdrop (a native <select> scrolls), each group sorted by name
    const groups = new Map();
    for (const m of ROTATION.map(getMap)) { if (!groups.has(m.background)) groups.set(m.background, []); groups.get(m.background).push(m); }
    for (const [bg, list] of groups) {
      const g = document.createElement('optgroup'); g.label = bg.replace(/-/g, ' ') + ' (' + list.length + ')';
      for (const m of list.sort((p, q) => p.name.localeCompare(q.name))) { const o = document.createElement('option'); o.value = m.id; o.textContent = m.name + (m.family ? ' - ' + m.family : ''); g.appendChild(o); }
      mapSel.appendChild(g);
    }
  }
  const mapWant = () => (state().mapLock ? state().mapId : state().rotate ? '' : state().mapId);
  mapSel.value = mapWant();
  // '' = the normal rotation; a map id pins that map (and reloads the round on it)
  mapSel.onchange = () => { const st = state(); if (mapSel.value === '') { st.mapLock = null; st.rotate = true; } else { st.mapLock = mapSel.value; st.rotate = false; loadMap(st, mapSel.value); } };

  // cards
  const cardBox = $('dbg-cards');
  for (const c of CARDS) {
    const b = document.createElement('button');
    b.className = 'dbg-card dbg-' + c.rarity;
    b.innerHTML = '<b>' + c.name + '</b><i>' + c.rarity + '</i>';
    b.title = c.description;
    b.onclick = () => { for (const i of targets()) addCard(i, c.id); refresh(); };
    cardBox.appendChild(b);
  }
  function targets() { return giveTo === 'me' ? [0] : giveTo === 'dummy' ? [1] : [0, 1]; }
  function addCard(i, id) {
    const p = state().players[i], card = CARDS_BY_ID[id], have = p.cards.filter((x) => x === id).length;
    if (have >= (card.maxStacks || 1)) return;
    setCards(state(), i, [...p.cards, id]);
  }
  $('dbg-give').onchange = (e) => { giveTo = e.target.value; };
  $('dbg-clear').onclick = () => { for (const i of targets()) setCards(state(), i, []); refresh(); };

  // toggles
  $('dbg-hit').onchange = (e) => { renderer.showHitboxes = e.target.checked; };
  $('dbg-anim').checked = !!CONFIG.render.animations.enabled; $('dbg-anim').onchange = (e) => { CONFIG.render.animations.enabled = e.target.checked; };   // local and cosmetic: allowed for everyone
  $('dbg-inv').onchange = (e) => { state().cheats.invulnerable[0] = e.target.checked; };
  $('dbg-pause').onchange = (e) => { if (cheatsAllowed()) sess().paused = e.target.checked; };
  $('dbg-step').onclick = () => { if (!cheatsAllowed() || sess().role === 'host') return; sess().paused = true; $('dbg-pause').checked = true; sess().stepOnce = true; };
  $('dbg-heal').onclick = () => healAll(state());
  $('dbg-restart').onclick = () => startRound(state());
  $('dbg-dummy').onchange = (e) => { if (sess().bot) sess().bot.mode = e.target.value; };
  $('dbg-speed').onchange = (e) => { if (cheatsAllowed()) sess().timeScale = Number(e.target.value); };
  $('dbg-hit').onchange = (e) => { renderer.showHitboxes = e.target.checked; };

  // which controls make sense for the current session (practice: everything, host: cheats without the dummy, client: info only)
  function applyMode() {
    const r = sess(); if (!r) return;
    const guest = r.role === 'guest', host = r.role === 'host';
    for (const el of root.querySelectorAll('[data-cheat]')) el.style.display = guest ? 'none' : '';
    for (const el of root.querySelectorAll('[data-practice]')) el.style.display = (guest || host) ? 'none' : '';
    $('dbg-note').textContent = guest ? 'Online client: cheats are disabled (only the host can use them).' : host ? 'Online host: cheats act on the shared match.' : '';
  }
  // Online: ping with jitter and loss, the channel the snapshots really use, direct or relayed, the host's tick rate, rates and bandwidth.
  let bw = { at: 0, tx: 0, rx: 0, up: 0, down: 0 };
  function netRows() {
    const s = sess(), box = $('dbg-netbox');
    if (!s || !s.netInfo || (s.role !== 'host' && s.role !== 'guest')) { box.hidden = true; return; }
    box.hidden = false;
    const n = s.netInfo(), tr = s.transport, now = performance.now();
    if (tr && now - bw.at >= 1000) { const dt = (now - bw.at) / 1000; if (bw.at) { bw.up = (tr.stats.txBytes - bw.tx) / dt; bw.down = (tr.stats.rxBytes - bw.rx) / dt; } bw.at = now; bw.tx = tr.stats.txBytes; bw.rx = tr.stats.rxBytes; }
    const f = (v, d = 0) => (v === null || v === undefined ? '-' : v.toFixed(d));
    const lines = [
      'ping ' + f(n.ping) + ' ms, jitter ' + f(n.jitter, 1) + ' ms, loss ' + pct(n.loss) + ' (to you ' + pct(n.lossIn) + ', from you ' + pct(n.lossOut) + ')',
      'snapshots travel on: ' + n.channel,
      'connection: ' + (n.path ? describePath(n.path) : tr && tr.channel ? 'checking...' : 'same browser (local test mode)'),
      'host ticks: ' + (n.hostHz === null ? '-' : n.hostHz.toFixed(1)) + ' / ' + CONFIG.tickRate + ' per s' + (n.hostSlow ? '  <- HOST IS RUNNING SLOW' : ''),
      'snapshots: ' + n.snapHz + ' per s' + (n.interpMs !== null ? ', drawn ' + n.interpMs + ' ms in the past' : ', lag compensation window ' + n.lagCompMs + ' ms (client draws ' + n.viewDelayMs + ' ms behind)'),
      'traffic: up ' + (bw.up / 1024).toFixed(1) + ' kB/s, down ' + (bw.down / 1024).toFixed(1) + ' kB/s',
    ];
    $('dbg-net').textContent = lines.join('\n');
    $('dbg-netq').textContent = n.quality; $('dbg-netq').style.color = QUALITY_COLOR[n.quality];
  }
  function refresh() {
    applyMode(); netRows();
    $('dbg-fps').textContent = String(Math.round(getFps()));
    { const bs = getBackgroundStatus(); $('dbg-bgstat').textContent = (bs.key || '-') + ' ' + bs.status; }
    $('dbg-ping').textContent = getPing();
    { const s = getSession(), P = s && s.predict; $('dbg-pred').textContent = P ? (P.enabled && P.active ? 'on' : P.enabled ? 'idle' : 'off') : '-'; }
    $('dbg-tick').textContent = String(state().tick);
    $('dbg-bul').textContent = String(state().bullets.length);
    const own = state().players.map((p, i) => {
      const names = {}; for (const id of p.cards) names[id] = (names[id] || 0) + 1;
      const list = Object.keys(names).map((id) => CARDS_BY_ID[id].name + (names[id] > 1 ? ' x' + names[id] : '')).join(', ') || 'none';
      const s = p.stats;
      return '<div><b>' + (i === 0 ? 'ME' : 'DUMMY') + '</b>: ' + list + '<br><span class="dbg-sub">hp ' + Math.round(p.hp) + '/' + Math.round(s.maxHp) + ' dmg ' + (s.damage === undefined ? '-' : s.damage.toFixed(1)) + ' rate ' + (s.fireRate === undefined ? '-' : s.fireRate.toFixed(1)) + '/s mag ' + Math.round(s.magazine) + ' bounces ' + s.bounces + ' speed ' + Math.round(s.moveSpeed) + '</span></div>';
    });
    $('dbg-owned').innerHTML = own.join('');
    if (mapSel.value !== mapWant()) mapSel.value = mapWant();
  }
  const timer = setInterval(() => { if (!root.hidden) refresh(); }, 200);

  return {
    toggle(force) { root.hidden = force === undefined ? !root.hidden : !force; if (!root.hidden) refresh(); },
    isOpen() { return !root.hidden; },
    refresh,
    dispose() { clearInterval(timer); },
  };
}
