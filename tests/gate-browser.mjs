// Browser checks of the READY GATE in headless Edge (Chrome DevTools Protocol):
//   A. the practice path with an artificially slow scene build (?slowbg=3500, a hook of src/client/bgready.js): the title screen says it is loading and a click is
//      queued (no hidden match), the round then waits for the scene ("LOADING..."), the dummy does not shoot and nothing moves meanwhile, 3-2-1, GO
//   B. the online path (BroadcastChannel by default, --real for PeerJS): the guest's scene is slow (?slowbg=20000&slowbgonly=waterfall-forest) so the host shows "WAITING FOR ... TO LOAD..."
//      and does not start; then both screens show the same countdown and go live together
// Screenshots go to screenshots/final/ (--out=name changes the folder).
// Run:  node tools/serve.mjs 8123   (another terminal)   then   node tests/gate-browser.mjs [--real] [--base=http://localhost:8123]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { findBrowser } from './browser-path.mjs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const REAL = args.includes('--real');
const BASE = (args.find((a) => a.startsWith('--base=')) || '--base=http://localhost:8123').slice(7);
const EDGE = findBrowser();
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'screenshots', (args.find((a) => a.startsWith('--out=')) || '--out=final').slice(6));
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


const GL = (p) => p.eval('JSON.stringify(window.__gateLog || [])').then((s) => JSON.parse(s));
const frozen = (rd) => rd.length > 0 && rd.every((e) => e.b === 0 && e.rt === 0 && JSON.stringify(e.hp) === JSON.stringify(rd[0].hp) && JSON.stringify(e.x) === JSON.stringify(rd[0].x));

async function practice(cdp) {
  console.log('--- A. practice with a slow scene (?slowbg=3500)');
  const P = await openPage(cdp, BASE + '/index.html?slowbg=3500&gatelog=1');
  await P.waitFor('!!window.__game', 15000);
  const t0 = Date.now();
  await sleep(500);
  await P.shot('first-load');
  const early = await P.eval("JSON.stringify({ loaded: window.__game.loaded, mode: window.__game.mode.kind, text: document.querySelector('#lobby').innerText })");
  const e = JSON.parse(early);
  check('first load: the title screen says it is loading and the game is not "loaded" yet', e.loaded === false && /Loading the game/i.test(e.text), early.slice(0, 200));
  await P.eval("document.querySelector('#lb-practice').click()");                    // a click while loading: queued
  await sleep(800);
  const q = JSON.parse(await P.eval("JSON.stringify({ loaded: window.__game.loaded, mode: window.__game.mode.kind, text: document.querySelector('#lobby').innerText })"));
  check('a click on PRACTICE while loading is queued: no hidden match has started', q.mode === 'lobby' && q.loaded === false && /starts as soon as everything is ready/i.test(q.text), JSON.stringify(q).slice(0, 200));
  await P.shot('first-load-queued');
  await P.waitFor("window.__game.mode.kind === 'practice'", 20000, 'the queued practice starts once loaded');
  const tStart = Date.now() - t0;
  check('the queued practice started only after the first scene was ready (about ' + tStart + ' ms after the page opened, scene delay 3500)', tStart >= 3000, String(tStart));
  await P.waitFor("window.__game.session.state.phase === 'ready'", 5000);
  await sleep(1200);
  const st1 = JSON.parse(await P.eval("JSON.stringify({ ph: window.__game.session.state.phase, cd: window.__game.session.state.ready.cd, scene: window.__game.sceneReady(window.__game.session.state.mapId) })"));
  check('the round waits for its scene: phase ready, no countdown yet', st1.ph === 'ready' && st1.cd < 0 && st1.scene === false, JSON.stringify(st1));
  await P.shot('gate-waiting-practice');
  await P.waitFor("window.__game.session.state.ready.cd >= 0 && window.__game.session.state.ready.cd < 1.9", 20000, 'the countdown');
  await P.shot('gate-countdown-practice');
  await P.waitFor("window.__game.session.state.phase === 'playing'", 8000, 'GO');
  await sleep(250);
  await P.shot('gate-go-practice');
  const log = await GL(P);
  const rd = log.filter((x) => x.ph === 'ready');
  const waitMs = (log.find((x) => x.ph === 'ready' && x.cd >= 0).t) - rd[0].t;
  check('nothing moved, fired or lost HP during the whole gate (' + rd.length + ' frames, waited ' + waitMs + ' ms for the scene)', frozen(rd) && waitMs > 2000, 'waited ' + waitMs + ' ' + JSON.stringify(rd[rd.length - 1]));
  const cds = rd.filter((x) => x.cd >= 0);
  check('then 3-2-1 of about 2.7 s (' + cds.length + ' frames, first ' + cds[0].cd + ' s)', cds.length > 100 && cds[0].cd > 2.4, JSON.stringify(cds[0]));
  const live = log.filter((x) => x.ph === 'playing').slice(0, 5);
  check('the round is live after GO', live.length > 0 && live[0].rt <= 3, JSON.stringify(live[0]));
  await P.send('Page.close');
}

async function online(cdp) {
  console.log('--- B. online (' + (REAL ? 'real PeerJS' : 'BroadcastChannel loopback') + '): the guest\'s scene is slow (?slowbg=20000)');
  const Q = (REAL ? '' : '&local=1') + '&gatelog=1';
  const A = await openPage(cdp, BASE + '/index.html?map=waterfall-forest' + Q);
  await A.waitFor('!!window.__game && window.__game.loaded', 20000);
  await A.eval("document.querySelector('#lb-name').value = 'HOSTY'; document.querySelector('#lb-create').click()");
  await A.waitFor('!!window.__game.room && !!window.__game.room.code', 25000, 'room code');
  const code = await A.eval('window.__game.room.code');
  const B = await openPage(cdp, BASE + '/index.html?slowbg=20000&slowbgonly=waterfall-forest' + Q + '#join=' + code);
  await A.waitFor("window.__game.mode.kind === 'host'", 40000, 'host sees the opponent');
  await B.waitFor("window.__game.mode.kind === 'guest'", 40000, 'guest connected');
  await A.waitFor('window.__game.session.state.ready.got[0] === true', 60000, 'the host own scene is up');
  await sleep(500);
  const hostWait = JSON.parse(await A.eval("JSON.stringify({ ph: window.__game.session.state.phase, r: window.__game.session.state.ready })"));
  check('the host does not start: the guest\'s scene is still building (host ready, guest not)', hostWait.ph === 'ready' && hostWait.r.cd < 0 && hostWait.r.got[0] === true && hostWait.r.got[1] === false, JSON.stringify(hostWait));
  await Promise.all([A.shot('gate-waiting-host'), B.shot('gate-waiting-guest')]);
  const gMsg = JSON.parse(await B.eval("JSON.stringify(window.__game.session.state.ready)"));
  check('the guest is told who is ready', gMsg.got[0] === true && gMsg.got[1] === false, JSON.stringify(gMsg));
  await A.waitFor('window.__game.session.state.ready.cd >= 0', 30000, 'the countdown starts once the guest reported');
  await B.waitFor("window.__game.session.state.phase === 'ready' && window.__game.session.state.ready.cd >= 0 && window.__game.session.state.ready.cd < 2.0", 8000, 'the guest sees the countdown');
  await Promise.all([A.shot('gate-countdown-host'), B.shot('gate-countdown-guest')]);
  await A.waitFor("window.__game.session.state.phase === 'playing'", 8000); await B.waitFor("window.__game.session.state.phase === 'playing'", 8000);
  await sleep(300);
  await Promise.all([A.shot('gate-go-host'), B.shot('gate-go-guest')]);
  const [la, lb] = await Promise.all([GL(A), GL(B)]);
  for (const [who, log] of [['host', la], ['guest', lb]]) {
    const rd = log.filter((x) => x.ph === 'ready');
    check('the ' + who + ' screen: frozen during the gate (' + rd.length + ' frames), then live', frozen(rd) && log.some((x) => x.ph === 'playing'), JSON.stringify(rd.slice(-1)));
  }
  const waited = la.find((x) => x.ph === 'playing').t - la.find((x) => x.ph === 'ready').t;
  check('the host stayed in the gate for the slow guest (' + waited + ' ms >= ~20000 scene delay + 2700 countdown)', waited > 21000, String(waited));
  await A.send('Page.close'); await B.send('Page.close');
}

async function main() {
  console.log('READY GATE browser checks against ' + BASE);
  const { proc, cdp } = await launch();
  try { await practice(cdp); await online(cdp); }
  catch (e) { failed++; console.log('FAIL  ' + (e.stack || e).toString().split('\n').slice(0, 3).join('\n      ')); }
  finally { try { proc.kill(); } catch (e) { /* ignore */ } }
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}
main();
