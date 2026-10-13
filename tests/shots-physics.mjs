// Takes the physics pictures into screenshots/physics/ with headless Edge (Chrome DevTools Protocol):
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

// 1. wall glide
save('wall-glide', await scenario('scenario=glide&seed=1&stopAfter=40', 40));

// 2. wall climb: four moments
const moments = [10, 40, 70, 100], frames = [];
for (let i = 0; i < moments.length; i++) { const d = await scenario('scenario=climb&seed=1&stopAfter=' + moments[i], moments[i]); frames.push(d); save('wall-climb-' + (i + 1), d); }
{
  // a contact sheet: the area around the wall from each moment, side by side
  const crop = { x: 140, y: 40, w: 340, h: 470 };
  await page.send('Page.navigate', { url: 'about:blank' }); await sleep(300);
  const sheet = await page.eval(`(async () => {
    const imgs = await Promise.all(${JSON.stringify(frames)}.map((d) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + d; })));
    const c = document.createElement('canvas'); c.width = ${crop.w} * imgs.length + 6 * (imgs.length - 1); c.height = ${crop.h}; const g = c.getContext('2d');
    g.fillStyle = '#10141a'; g.fillRect(0, 0, c.width, c.height);
    imgs.forEach((im, k) => g.drawImage(im, ${crop.x}, ${crop.y}, ${crop.w}, ${crop.h}, k * (${crop.w} + 6), 0, ${crop.w}, ${crop.h}));
    return c.toDataURL('image/png').split(',')[1];
  })()`);
  save('wall-climb-seq', sheet);
}

// 3. a stream of bullets along one arc
save('bullet-arc', await scenario('scenario=arc&seed=1&stopAfter=44', 44));

// 4. a normal fight
save('gameplay', await scenario('demo=1&seed=7&warmup=420&stopAfter=420', 420));

try { await cdp.send('Browser.close'); } catch (e) { /* ignore */ }
setTimeout(() => process.exit(0), 300);
