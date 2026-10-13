// Real two-tab test: drives TWO pages of headless Edge (Chrome DevTools Protocol) - one hosts, one joins -
// over the REAL PeerJS / WebRTC path (default) or the offline BroadcastChannel loopback (--local).
// It checks that they connect, that input and a round are synced, that quiz / reveal / card pick are
// visible on both sides (the watcher sees them read-only), the same score on both screens, then a
// disconnect with automatic rejoin. Screenshots of both sides go to screenshots/phase2/.
//
// Run:  node tools/serve.mjs 8123   (in another terminal)   then   node tests/two-tab.mjs [--local] [--base=http://localhost:8123]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { findBrowser } from './browser-path.mjs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const LOCAL = args.includes('--local');
const BASE = (args.find((a) => a.startsWith('--base=')) || '--base=http://localhost:8123').slice(7);
const EDGE = findBrowser();
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'screenshots', (args.find((a) => a.startsWith('--out=')) || '--out=phase2').slice(6));
const PORT = 9333 + Math.floor(Math.random() * 300);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

let passed = 0, failed = 0;
function check(name, cond, extra = '') { if (cond) { passed++; console.log('PASS  ' + name); } else { failed++; console.log('FAIL  ' + name + (extra ? '  -> ' + extra : '')); } }

// ---- minimal CDP client -------------------------------------------------------------------------------------------------------------
class Cdp {
  constructor(ws) { this.ws = ws; this.id = 0; this.cbs = new Map(); ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && this.cbs.has(m.id)) { const { res, rej } = this.cbs.get(m.id); this.cbs.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); } }; }
  send(method, params = {}, sessionId) { const id = ++this.id; return new Promise((res, rej) => { this.cbs.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params, sessionId })); }); }
}
async function launch() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rab-edge-'));
  const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--remote-debugging-port=' + PORT, '--user-data-dir=' + dir, '--window-size=1280,720', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', 'about:blank'], { stdio: 'ignore' });
  let info = null;
  for (let i = 0; i < 60 && !info; i++) { await sleep(300); try { info = await (await fetch('http://127.0.0.1:' + PORT + '/json/version')).json(); } catch (e) { /* not yet */ } }
  if (!info) throw new Error('Edge did not start');
  const ws = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  return { proc, cdp: new Cdp(ws), dir };
}
async function openPage(cdp, url) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank', newWindow: true, width: 1280, height: 720 });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const page = {
    targetId, sessionId,
    send: (m, p) => cdp.send(m, p, sessionId),
    async eval(expr) { const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sessionId); if (r.exceptionDetails) throw new Error('page error: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text)); return r.result.value; },
    async shot(name) { const r = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId); fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.data, 'base64')); },
    async waitFor(expr, ms = 20000, what = expr) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await this.eval(expr)) return true; } catch (e) { /* page not ready */ } await sleep(200); } throw new Error('timeout waiting for: ' + what); },
    async goto(u) { await this.send('Page.navigate', { url: u }); await sleep(600); },
  };
  await page.send('Page.enable'); await page.send('Runtime.enable');
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await page.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await page.goto(url);
  return page;
}

const Q = (LOCAL ? '&local=1' : '') + (process.env.EXTRA || '');
const ST = (p, expr) => p.eval(`(() => { const s = window.__game.session.state; return ${expr}; })()`);

const pages = {};
async function report() {
  for (const [k, p] of Object.entries(pages)) { try { console.log('      [' + k + '] ' + await p.eval("JSON.stringify({ mode: window.__game.mode.kind, lobby: document.querySelector('#lobby').innerText.split(String.fromCharCode(10)).join(' | ').slice(0, 300), err: document.getElementById('errbox').textContent })")); await p.shot('_fail-' + k); } catch (e) { console.log('      [' + k + '] report failed: ' + e.message); } }
}
async function main() {
  console.log((LOCAL ? 'LOCAL (BroadcastChannel)' : 'REAL PeerJS / WebRTC') + ' two-tab test against ' + BASE);
  const { proc, cdp } = await launch();
  try {
    const A = await openPage(cdp, BASE + '/index.html?dump=1&map=ruined-city' + Q);       // host
    pages.A = A;
    await A.waitFor('!!window.__game && window.__game.lobby.visible');
    await A.shot('lobby');
    check('the page opens on the lobby', await A.eval("document.querySelector('#lobby').textContent.length >= 0 && window.__game.mode.kind === 'lobby'"));

    // ---- host creates a room ----
    await A.eval("document.querySelector('#lb-name').value = 'HOSTY'; document.querySelector('#lb-create').click()");
    await A.waitFor("!!window.__game.room && !!window.__game.room.code", 25000, 'room code (is the PeerJS broker reachable?)');
    const code = await A.eval('window.__game.room.code');
    check('a 5-character room code was created', /^[A-HJKMNP-Z2-9]{5}$/.test(code), code);
    await A.waitFor("!!document.querySelector('.lb-link')", 25000, 'the lobby shows the waiting state');
    await sleep(300);
    await A.shot('room-created');
    const invite = await A.eval("document.querySelector('.lb-link').textContent");
    check('the invite link carries the code in the hash and the page path', invite.endsWith('#join=' + code) && invite.startsWith(BASE), invite);

    // ---- client joins through the invite link ----
    const B = await openPage(cdp, BASE + '/index.html?dump=1' + Q + '#join=' + code);
    pages.B = B;
    await sleep(800);
    await B.shot('joining');
    await A.waitFor("window.__game.mode.kind === 'host'", 30000, 'host sees the opponent');
    await B.waitFor("window.__game.mode.kind === 'guest' && window.__game.session.ready", 30000, 'client connected');
    check('both sides connected', true);
    const names = await B.eval('window.__game.session.names.join(",")');
    check('names were exchanged', /HOSTY,/.test(names), names);

    // ---- a few seconds of duel; client input moves the client player on the host ----
    await sleep(1500);
    const x0 = await ST(A, 's.players[1].x');
    await B.eval("window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', bubbles: true }))");
    await sleep(300);   // the right island is only about 150 units long to the right of the spawn: a short press, then measure
    await B.eval("window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD', bubbles: true }))");
    await sleep(350); const x1 = await ST(A, 's.players[1].x');
    check('the client\'s key presses move its player on the host', x1 - x0 > 30, 'moved ' + (x1 - x0));
    // the client predicts its own movement and runs ahead of the host while it moves: wait until the host's copy of the player has stopped (a slow machine needs longer), then both must agree
    let xa = await ST(A, 's.players[1].x'); for (let i = 0; i < 20; i++) { await sleep(300); const n = await ST(A, 's.players[1].x'); if (Math.abs(n - xa) < 0.5) { xa = n; break; } xa = n; }
    await sleep(300); xa = await ST(A, 's.players[1].x'); const xb = await ST(B, 's.players[1].x');
    check('the client sees its own player where the host has it (within 40 units)', Math.abs(xa - xb) < 40, xa + ' vs ' + xb);
    const ping = await B.eval('window.__game.session.ping');
    check('ping is measured', typeof ping === 'number' && ping >= 0 && ping < 500, String(ping));
    const info = await Promise.all([A.eval('(() => { const t = window.__game.room.host.transport; return JSON.stringify({ unreliable: !!t.usingUnreliable, tx: t.stats.tx, txBytes: t.stats.txBytes, rx: t.stats.rx }); })()'), B.eval('(() => { const t = window.__game.joined.guest.transport; return JSON.stringify({ unreliable: !!t.usingUnreliable, tx: t.stats.tx, rxBytes: t.stats.rxBytes, rx: t.stats.rx }); })()')]);
    console.log('      transport A(host):', info[0], ' B(client):', info[1]);
    await Promise.all([A.shot('duel-host'), B.shot('duel-client')]);
    console.log('      tick timer uses a Web Worker:', await A.eval('window.__game.room.timer.usingWorker'), '| page visibility A/B:', await A.eval('document.visibilityState'), await B.eval('document.visibilityState'));
    const tick = await ST(A, 's.tick'), tAt = Date.now();
    await sleep(1500);
    const rate = ((await ST(A, 's.tick')) - tick) / ((Date.now() - tAt) / 1000);
    check('the host simulates at about 60 ticks per second even though its tab is in the background (worker timer)', rate > 45 && rate < 75, rate.toFixed(1) + ' ticks/s');
    const viaWorker = await A.eval('window.__game.room.host.status');
    check('host status is playing', viaWorker === 'playing', viaWorker);

    // ---- the client loses a round: client answers (clicking), host watches ----
    await A.eval(`(async () => { const c = await import('./src/sim/combat.js'); c.killPlayer(window.__game.session.state, 1, 0); })()`);
    await A.waitFor("window.__game.session.state.phase === 'quiz'", 15000, 'quiz phase');
    await B.waitFor("window.__game.session.state.phase === 'quiz' && !!window.__game.session.state.match.quiz", 8000, 'quiz visible to the client');
    await A.waitFor("!!window.__game.session.state.match.quiz", 3000);
    await sleep(500);
    await Promise.all([A.shot('quiz-watcher-host'), B.shot('quiz-answerer-client')]);
    const wq = await ST(A, 'JSON.stringify(window.__game.session.state.match.quiz.answers)'), aq = await ST(B, 'JSON.stringify(window.__game.session.state.match.quiz.answers)');
    check('the watcher sees the same four answers in the same order', wq === aq);
    check('the client was not sent the correct index or the explanation', !(await ST(B, "JSON.stringify(window.__game.session.state.match).includes('correctShown')")));
    // answer with a REAL click on the third answer box (coordinates come from the screen's hit-boxes)
    await B.eval(`(async () => {
      const m = await import('./src/client/screens.js'); const c = document.getElementById('game'); const r = c.getBoundingClientRect();
      let pos = null; for (let y = 0; y < 360 && !pos; y += 2) for (let x = 0; x < 640 && !pos; x += 2) { const it = m.hitIntent(x, y); if (it && it.type === 'answer' && it.index === 2) pos = [x, y]; }
      c.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: r.left + pos[0] / 640 * r.width, clientY: r.top + pos[1] / 360 * r.height, bubbles: true, cancelable: true }));
    })()`);
    await A.waitFor("window.__game.session.state.phase === 'quizReveal'", 8000, 'reveal on the host');
    await B.waitFor("window.__game.session.state.phase === 'quizReveal'", 8000, 'reveal on the client');
    await sleep(600);
    await Promise.all([A.shot('reveal-watcher-host'), B.shot('reveal-answerer-client')]);
    const why = await ST(A, 'window.__game.session.state.match.result.why.length');
    check('the watcher gets the reveal with the explanation text', why > 5, String(why));
    const picked = await Promise.all([ST(A, 'window.__game.session.state.match.result.picked'), ST(B, 'window.__game.session.state.match.result.picked')]);
    check('both sides agree which answer was picked', picked[0] === 2 && picked[1] === 2, picked.join());
    await B.eval("window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', bubbles: true }))");      // the answerer continues for both
    await A.waitFor("window.__game.session.state.phase === 'cardPick'", 8000, 'card pick on the host');
    await B.waitFor("window.__game.session.state.phase === 'cardPick'", 8000, 'card pick on the client');
    check('the loser\'s continue advanced both screens', true);
    // hover: the picker points at a card, the watcher follows
    await B.eval(`(async () => {
      const m = await import('./src/client/screens.js'); const c = document.getElementById('game'); const r = c.getBoundingClientRect();
      let pos = null; for (let y = 0; y < 360 && !pos; y += 2) for (let x = 0; x < 640 && !pos; x += 2) { const it = m.hitIntent(x, y); if (it && it.type === 'pick') pos = [x, y]; }
      const mv = new MouseEvent('mousemove', { clientX: r.left + pos[0] / 640 * r.width, clientY: r.top + pos[1] / 360 * r.height, bubbles: true }); c.dispatchEvent(mv); window.dispatchEvent(mv);
    })()`);
    await sleep(700);
    const hov = await ST(A, 'window.__game.session.state.match.hover');
    check('the watcher sees which card the picker is pointing at', hov >= 0, String(hov));
    await Promise.all([A.shot('cardpick-watcher-host'), B.shot('cardpick-picker-client')]);
    const offerA = await ST(A, 'JSON.stringify(window.__game.session.state.match.offer)'), removed = await ST(A, 'window.__game.session.state.match.removed.length');
    check('the watcher sees all 5 offered cards face up; a wrong answer struck out 3 or a right one none', JSON.parse(offerA).length === 5 && JSON.parse(offerA).every((x) => x !== '?') && (removed === 3 || removed === 0), 'removed ' + removed);
    // the picker clicks a (non-removed) card for real
    await B.eval(`(async () => {
      const m = await import('./src/client/screens.js'); const c = document.getElementById('game'); const r = c.getBoundingClientRect();
      let pos = null; for (let y = 0; y < 360 && !pos; y += 2) for (let x = 0; x < 640 && !pos; x += 2) { const it = m.hitIntent(x, y); if (it && it.type === 'pick') pos = [x, y]; }
      c.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: r.left + pos[0] / 640 * r.width, clientY: r.top + pos[1] / 360 * r.height, bubbles: true, cancelable: true }));
    })()`);
    await A.waitFor("window.__game.session.state.phase === 'playing'", 8000, 'round 2 on the host');
    await B.waitFor("window.__game.session.state.phase === 'playing' && window.__game.session.state.round === 2", 8000, 'round 2 on the client');
    await sleep(700);
    const cardsA = await ST(A, 'JSON.stringify(s.players.map((p) => p.cards))'), cardsB = await ST(B, 'JSON.stringify(s.players.map((p) => p.cards))');
    check('the card was taken and both sides show the same builds', cardsA === cardsB && JSON.parse(cardsA)[1].length === 1, cardsA + ' / ' + cardsB);
    const scoreA = await ST(A, 'JSON.stringify(s.scores)'), scoreB = await ST(B, 'JSON.stringify(s.scores)');
    check('both sides show the same score (1-0)', scoreA === scoreB && scoreA === '[1,0]', scoreA + ' / ' + scoreB);
    await Promise.all([A.shot('round2-host'), B.shot('round2-client')]);

    // ---- the host loses a round: host answers, client watches ----
    await A.eval(`(async () => { const c = await import('./src/sim/combat.js'); c.killPlayer(window.__game.session.state, 0, 1); })()`);
    await B.waitFor("window.__game.session.state.phase === 'quiz'", 15000, 'quiz as watcher on the client');
    await sleep(500);
    await Promise.all([A.shot('quiz-answerer-host'), B.shot('quiz-watcher-client')]);
    check('the client watches the host\'s question', (await ST(B, 'window.__game.session.state.match.loser')) === 0);
    await A.eval(`window.__game.session.sendIntent({ type: 'answer', index: 0 })`);
    await B.waitFor("window.__game.session.state.phase === 'quizReveal'", 8000, 'reveal on the watching client');
    await sleep(500); await B.shot('reveal-watcher-client');
    await A.eval(`window.__game.session.sendIntent({ type: 'continue' })`);
    await B.waitFor("window.__game.session.state.phase === 'cardPick'", 8000, 'card pick on the watching client');
    await sleep(300); await B.shot('cardpick-watcher-client');
    await A.eval(`(() => { const m = window.__game.session.state.match; const id = m.offer.find((x) => !m.removed.includes(x)); window.__game.session.sendIntent({ type: 'pick', cardId: id }); })()`);
    await B.waitFor("window.__game.session.state.phase === 'playing' && window.__game.session.state.round === 3", 8000, 'round 3 on the client');
    check('after a host-side loss the client sees the same scores', (await ST(B, 'JSON.stringify(s.scores)')) === (await ST(A, 'JSON.stringify(s.scores)')));

    // ---- disconnect and automatic rejoin ----
    const before = await ST(A, 'JSON.stringify({ sc: s.scores, c: s.players.map((p) => p.cards), r: s.round })');
    // simulate a LONG outage: the client's retries are delayed by 4 s so the paused state can be seen and photographed
    await B.eval('(() => { const g = window.__game.joined.guest, orig = g.opts.reconnect; g.opts.reconnect = (cb) => { setTimeout(() => orig(cb), 4000); return { cancel() {} }; }; g.transport.close("test: network died"); })()');
    await A.waitFor("window.__game.room.host.status === 'paused'", 15000, 'host notices the drop');
    await sleep(600);
    await Promise.all([A.shot('disconnect-host'), B.shot('disconnect-client')]);
    check('the host paused and shows a message', true);
    const t0 = await ST(A, 's.tick'); await sleep(1200);
    check('no simulation while paused', (await ST(A, 's.tick')) === t0 && (await A.eval('window.__game.room.host.status')) === 'paused');
    await A.waitFor("window.__game.room.host.status === 'playing'", 40000, 'the client rejoined');
    await B.waitFor("window.__game.joined.guest.status === 'playing'", 20000, 'client back in the match');
    await sleep(1500);
    const after = await ST(A, 'JSON.stringify({ sc: s.scores, c: s.players.map((p) => p.cards), r: s.round })');
    check('the match resumed with the same score, builds and round', after === before, before + ' vs ' + after);
    check('both sides agree again after the rejoin', (await ST(B, 'JSON.stringify(s.scores)')) === (await ST(A, 'JSON.stringify(s.scores)')));
    await Promise.all([A.shot('rejoined-host'), B.shot('rejoined-client')]);

    // ---- leave on purpose ----
    await B.eval('window.__game.toLobby("")');
    await A.waitFor("window.__game.mode.kind === 'lobby'", 10000, 'host returns to the lobby');
    check('leaving on purpose returns the other side to the lobby at once', true);
    await A.shot('lobby-after-leave');
  } catch (e) {
    failed++; console.log('FAIL  ' + e.message); await report();
  } finally {
    try { proc.kill(); } catch (e) { /* ignore */ }
  }
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}
main();
