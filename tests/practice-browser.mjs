// Headless browser smoke test: a full practice match between two bots in the real page (see below).
// Run:  node tools/serve.mjs 8123   (another terminal)   then   node tests/practice-browser.mjs   (SECS=90 real seconds at 8x speed)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { findBrowser } from './browser-path.mjs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = ((process.argv.find((a) => a.startsWith('--base=')) || '--base=http://localhost:8123')).slice(7);
const EDGE = findBrowser();
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'screenshots', 'physics');
const PORT = 9333 + Math.floor(Math.random() * 300);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

class Cdp {
  constructor(ws) { this.ws = ws; this.id = 0; this.cbs = new Map(); ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && this.cbs.has(m.id)) { const { res, rej } = this.cbs.get(m.id); this.cbs.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); } }; }
  send(method, params = {}, sessionId) { const id = ++this.id; return new Promise((res, rej) => { this.cbs.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params, sessionId })); }); }
}
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rab-shots-'));
const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--remote-debugging-port=' + PORT, '--user-data-dir=' + dir, '--window-size=1280,720', 'about:blank'], { stdio: 'ignore' });
let info = null;
for (let i = 0; i < 60 && !info; i++) { await sleep(300); try { info = await (await fetch('http://127.0.0.1:' + PORT + '/json/version')).json(); } catch (e) { /* not yet */ } }
if (!info) throw new Error('Edge did not start');
const ws = new WebSocket(info.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
const cdp = new Cdp(ws);

async function openPage() {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank', newWindow: true, width: 1280, height: 720 });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const page = {
    send: (m, p) => cdp.send(m, p, sessionId),
    async eval(expr) { const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sessionId); if (r.exceptionDetails) throw new Error('page error: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text)); return r.result.value; },
    async shotData() { return (await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId)).data; },
    async waitFor(expr, ms = 20000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await this.eval(expr)) return true; } catch (e) { /* not ready */ } await sleep(150); } throw new Error('timeout: ' + expr); },
  };
  await page.send('Page.enable'); await page.send('Runtime.enable');
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  return page;
}
const page = await openPage();
async function scenario(query, waitTicks) {
  await page.send('Page.navigate', { url: BASE + '/index.html?' + query });
  await page.waitFor("window.__game && window.__game.mode.kind === 'practice'", 20000);
  await page.waitFor(`window.__game.session.ticks >= ${waitTicks}`, 20000);
  await page.waitFor("window.__game.bgStatus().status === 'ready'", 40000);    // the animated backdrop is built in a worker (4-5 s); until then a plain gradient shows
  await sleep(500);                                         // let the last frame be drawn
  const err = await page.eval("document.getElementById('errbox').textContent");
  if (err) console.log('page errors: ' + err);
  return page.shotData();
}
const save = (name, b64) => { fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(b64, 'base64')); console.log('saved ' + name + '.png'); };

// A headless full practice match in the real page: two bots play (demo mode), the maps rotate, quizzes and card picks are answered by the bots;
// time runs 8x faster. Reports page errors, rounds, the maps seen, the phases seen and the frame rate.
await page.send('Page.navigate', { url: BASE + '/index.html?demo=1&rotate=1&seed=5&debug=0' });
await page.waitFor("window.__game && window.__game.mode.kind === 'practice'", 20000);
await page.eval("(() => { const s = window.__game.session; s.timeScale = 8; window.__seen = { maps: [], phases: {}, rounds: 0 }; setInterval(() => { const st = s.state; if (!window.__seen.maps.includes(st.mapId)) window.__seen.maps.push(st.mapId); window.__seen.phases[st.phase] = (window.__seen.phases[st.phase] || 0) + 1; window.__seen.rounds = st.round; }, 100); })()");
const secs = Number(process.env.SECS || 90);
const t0 = Date.now(); let maxRound = 0;
while (Date.now() - t0 < secs * 1000) { await sleep(5000); const e = await page.eval("document.getElementById('errbox').textContent"); if (e) { console.log('PAGE ERROR: ' + e); break; } }
const seen = await page.eval('JSON.stringify(window.__seen)'), st = await page.eval('JSON.stringify({ round: window.__game.session.state.round, scores: window.__game.session.state.scores, phase: window.__game.session.state.phase, tick: window.__game.session.state.tick, map: window.__game.session.state.mapId })');
const err = await page.eval("document.getElementById('errbox').textContent");
console.log('seen: ' + seen); console.log('state: ' + st); console.log('errors: ' + (err || 'none'));
fs.writeFileSync(path.join(OUT, '..', 'final', 'practice-demo.png'), Buffer.from(await page.shotData(), 'base64'));
process.exitCode = err ? 1 : 0;

try { await cdp.send('Browser.close'); } catch (e) { /* ignore */ }
setTimeout(() => process.exit(0), 300);
