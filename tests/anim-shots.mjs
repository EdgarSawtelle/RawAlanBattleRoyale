// Captures the character-animation pictures into screenshots/anim/ with headless Edge (Chrome DevTools Protocol).
//   node tools/serve.mjs 8123      (another terminal, or already running)
//   node tests/anim-shots.mjs [--base=http://localhost:8123] [--only=text]
// poses-*.png : the pose sheet (tests/poses.html) for body sizes 0.6x / 1x / 1.6x, enlarged
// play-*.png  : real gameplay frames
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findBrowser } from './browser-path.mjs';

const BASE = ((process.argv.find((a) => a.startsWith('--base=')) || '--base=http://localhost:8123')).slice(7);
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'screenshots', 'anim');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 9333 + Math.floor(Math.random() * 300);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rab-anim-'));
const proc = spawn(findBrowser(), ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--remote-debugging-port=' + PORT, '--user-data-dir=' + dir, '--window-size=1280,720', 'about:blank'], { stdio: 'ignore' });
let info = null;
for (let i = 0; i < 60 && !info; i++) { await sleep(300); try { info = await (await fetch('http://127.0.0.1:' + PORT + '/json/version')).json(); } catch (e) { /* not yet */ } }
if (!info) { proc.kill(); throw new Error('Edge did not start'); }
const ws = new WebSocket(info.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let nid = 0; const cbs = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && cbs.has(m.id)) { const { res, rej } = cbs.get(m.id); cbs.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); } };
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const id = ++nid; cbs.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, sessionId })); });
const { targetId } = await send('Target.createTarget', { url: 'about:blank', newWindow: true, width: 1280, height: 720 });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const page = {
  send: (m, p) => send(m, p, sessionId),
  async eval(expr) { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sessionId); if (r.exceptionDetails) throw new Error('page error: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text)); return r.result.value; },
  async waitFor(expr, ms = 30000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await this.eval(expr)) return true; } catch (e) { /* not ready */ } await sleep(150); } throw new Error('timeout: ' + expr); },
};
await page.send('Page.enable'); await page.send('Runtime.enable');

async function shot(name, url, w, h, ready, extraWait = 0, clip, zoom) {
  if (only && !name.includes(only)) return;
  await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await page.send('Page.navigate', { url: BASE + url });
  await page.waitFor(ready);
  if (extraWait) await sleep(extraWait);
  const err = await page.eval("(document.getElementById('errbox') || {}).textContent || ''");
  if (err) console.log(name + ' page errors: ' + err);
  const r = await page.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { x: clip[0], y: clip[1], width: clip[2], height: clip[3], scale: clip[4] || 1 } } : {}) });
  fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.data, 'base64')); console.log('saved ' + name + '.png');
  if (zoom) {                                                  // close-ups of both players (4x the screen size): the game runs at 1280x720 = 1 logical unit per screen pixel
    const ps = await page.eval('window.__game.session.state.players.map((p) => [p.x, p.y])');
    for (let i = 0; i < 2; i++) {
      const [x, y] = ps[i], cx = Math.max(0, Math.min(1280 - 220, x - 110)), cy = Math.max(0, Math.min(720 - 140, y - 90));
      const z = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: cx, y: cy, width: 220, height: 140, scale: 4 } });
      fs.writeFileSync(path.join(OUT, name + '-' + (i ? 'tide' : 'ember') + '.png'), Buffer.from(z.data, 'base64')); console.log('saved ' + name + '-' + (i ? 'tide' : 'ember') + '.png');
    }
  }
}
const GAME = "window.__game && window.__game.mode.kind === 'practice' && window.__game.bgStatus().status === 'ready'";
// pose sheets (the viewport is made big, then the screenshot is clipped to the sheet)
async function sheet(name, query) {
  if (only && !name.includes(only)) return;
  await page.send('Emulation.setDeviceMetricsOverride', { width: 2600, height: 2400, deviceScaleFactor: 1, mobile: false });
  await page.send('Page.navigate', { url: BASE + '/tests/poses.html?' + query });
  await page.waitFor('window.__poses && window.__poses.ready');
  const { W, H, scale } = await page.eval('window.__poses');
  const r = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W * scale, height: H * scale, scale: 1 } });
  fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.data, 'base64')); console.log('saved ' + name + '.png');
}
for (const size of [0.6, 1, 1.6]) await sheet('poses-' + size + 'x', 'size=' + size + '&scale=' + (size > 1 ? 3 : 4));
await sheet('poses-off-1x', 'size=1&scale=4&anim=0');
for (const a of process.argv.filter((x) => x.startsWith('--sheet='))) { const [n, qq] = a.slice(8).split('|'); await sheet(n, qq); }   // --sheet=name|query (ad-hoc zoom, e.g. size=1&scale=10&only=GRIP,GLIDE&cols=3)

// motion strips (tests/anim-strips.html): consecutive moments of the real game, cut out around the player
async function strip(name, query) {
  if (only && !name.includes(only)) return;
  await page.send('Emulation.setDeviceMetricsOverride', { width: 2600, height: 700, deviceScaleFactor: 1, mobile: false });
  await page.send('Page.navigate', { url: BASE + '/tests/anim-strips.html?' + query });
  await page.waitFor('window.__strip && window.__strip.ready', 30000);
  const err = await page.eval("(document.getElementById('errbox') || {}).textContent || ''"); if (err) console.log(name + ' errors: ' + err);
  const { W, H, scale } = await page.eval('window.__strip');
  const ev = process.argv.find((x) => x.startsWith('--eval=')); if (ev) console.log(await page.eval(ev.slice(7)));   // debugging: print an expression of the strip page
  const r = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W * scale, height: H * scale, scale: 1 } });
  fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.data, 'base64')); console.log('saved ' + name + '.png');
}
for (const a of process.argv.filter((x) => x.startsWith('--strip='))) { const [n, qq] = a.slice(8).split('|'); await strip(n, qq); }   // --strip=name|scene=jump&scale=3
if (process.argv.includes('--strips')) for (const s of ['jump', 'run', 'stop', 'wall', 'glide', 'shoot', 'hit', 'victory', 'airjump', 'limpet', 'block']) await strip('strip-' + s, 'scene=' + s + '&scale=2');

// gameplay frames (real game: bot vs dummy, frozen after N ticks), see PLAY below
const PLAY = [
  ['play-1', 'map=ruined-city&autostart=1&demo=1&seed=5&warmup=300&stopAfter=300'],
  ['play-2', 'map=ruined-city&autostart=1&demo=1&seed=5&warmup=420&stopAfter=420'],
  ['play-3', 'map=old-plaza&autostart=1&demo=1&seed=9&warmup=360&stopAfter=360'],
  ['play-4', 'map=waterfall-forest&autostart=1&demo=1&seed=2&warmup=500&stopAfter=500'],
  ['play-glide', 'scenario=glide&stopAfter=40'],
  ['play-climb', 'scenario=climb&stopAfter=52'],
  ['play-limpet', 'scenario=cfx-limpet&stopAfter=20'],
  ['play-cloud', 'scenario=cfx-cloud&stopAfter=30'],
];
for (const [name, q] of PLAY) await shot(name, '/index.html?' + q, 1280, 720, GAME + ' && window.__game.session.ticks >= ' + (Number((q.match(/stopAfter=(\d+)/) || [])[1]) || 1), 1500, null, true);
try { await send('Browser.close'); } catch (e) { /* ignore */ }
setTimeout(() => { try { proc.kill(); } catch (e) { /* ignore */ } process.exit(0); }, 300);
