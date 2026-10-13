// Takes the physics pictures into screenshots/physics/ with headless Edge (Chrome DevTools Protocol):
// (generic: the final screenshot set, see LIST below)
//   wall-glide.png        gliding down a wall (holding into it)
//   wall-climb-seq.png    four moments of climbing ONE wall by tapping jump on every touch (+ the single frames wall-climb-1..4.png)
//   bullet-arc.png        a stream of bullets along one arc (aimed with the ballistic solver at the far player)
//   gameplay.png          a normal fight (two bots) on the real map
// Run:  node tools/serve.mjs 8123   (another terminal)   then   node tests/shots-physics.mjs [--base=http://localhost:8123]
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
  const lobby = query === 'lobbyonly=1';
  await page.send('Page.navigate', { url: BASE + '/index.html' + (lobby ? '' : '?' + query) });
  await page.waitFor("window.__game && window.__game.mode.kind === '" + (lobby ? 'lobby' : 'practice') + "'", 20000);
  await page.waitFor(`window.__game.session.ticks >= ${waitTicks}`, 20000);
  await page.waitFor("window.__game.bgStatus().status === 'ready'", 60000);    // the animated backdrop is built in a worker (4-5 s); until then a plain gradient shows
  await sleep(1300);                                        // the cross-fade into the scene takes about 0.8 s
  const err = await page.eval("document.getElementById('errbox').textContent");
  if (err) console.log('page errors: ' + err);
  return page.shotData();
}
const save = (name, b64) => { fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(b64, 'base64')); console.log('saved ' + name + '.png'); };

// the shot list: [file name, query string, ticks to wait, window width, window height]
const OUTDIR = process.env.OUT || 'final';
const only = process.argv.find((x) => x.startsWith('--only='));
const LIST = [
  ['lobby', 'lobbyonly=1', 0, 1280, 720],
  ['map-overgrown-downtown', 'map=ruined-city&autostart=1&seed=3&warmup=240&stopAfter=240', 240, 1280, 720],
  ['map-waterfall-forest', 'map=waterfall-forest&autostart=1&seed=3&warmup=240&stopAfter=240', 240, 1280, 720],
  ['map-old-plaza', 'map=old-plaza&autostart=1&seed=3&warmup=240&stopAfter=240', 240, 1280, 720],
  ['map-abandoned-suburb', 'map=abandoned-suburb&autostart=1&seed=3&warmup=240&stopAfter=240', 240, 1280, 720],
  ['quiz', 'screen=quiz&qid=a-007', 0, 1280, 720],
  ['quiz-reveal', 'screen=quizreveal&answer=wrong&qid=a-007', 0, 1280, 720],
  ['card-pick', 'screen=cardpick&answer=right', 0, 1280, 720],
  ['dummy-turn', 'screen=dummy&step=2&stopAfter=2', 2, 1280, 720],
  ['match-end', 'screen=matchend&winner=0', 0, 1280, 720],
];
const extra = process.argv.filter((x) => x.startsWith('--shot=')).map((x) => x.slice(7).split('|'));   // --shot=name|query|ticks|w|h
for (const e of extra) LIST.push([e[0], e[1], Number(e[2] || 0), Number(e[3] || 1280), Number(e[4] || 720)]);
fs.mkdirSync(path.join(OUT, '..', OUTDIR), { recursive: true });
for (const [name, query, ticks, w, h] of LIST) {
  if (only && !name.includes(only.slice(7))) continue;
  await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  const b64 = await scenario(query, ticks);
  fs.writeFileSync(path.join(OUT, '..', OUTDIR, name + '.png'), Buffer.from(b64, 'base64')); console.log('saved ' + OUTDIR + '/' + name + '.png');
}

try { await cdp.send('Browser.close'); } catch (e) { /* ignore */ }
setTimeout(() => process.exit(0), 300);
