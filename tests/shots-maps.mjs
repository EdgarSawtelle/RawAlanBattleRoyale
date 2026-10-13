// A picture of every map: screenshots/maps/<id>.png (the real game, practice mode, no dummy, 1280 x 720, backdrop built)
// plus one contact sheet screenshots/maps/_all.png (every map with its id and counts) for the quick look.
// Needs the server:  node tools/serve.mjs 8123
// Run:  node tests/shots-maps.mjs [--base=http://localhost:8123] [--only=id,id] [--sheet-only]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findBrowser } from './browser-path.mjs';
import { MAPS } from '../src/maps/index.js';

const arg = (k, d) => ((process.argv.find((a) => a.startsWith('--' + k + '=')) || '').slice(k.length + 3)) || d;
const BASE = arg('base', 'http://localhost:8123');
const ONLY = arg('only', '') ? arg('only', '').split(',') : null;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'screenshots', 'maps');
const PORT = 9700 + Math.floor(Math.random() * 250);                  // (not the 9333 range the other test scripts use)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

class Cdp {
  constructor(ws) { this.ws = ws; this.id = 0; this.cbs = new Map(); ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && this.cbs.has(m.id)) { const { res, rej } = this.cbs.get(m.id); this.cbs.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); } }; }
  send(method, params = {}, sessionId) { const id = ++this.id; return new Promise((res, rej) => { this.cbs.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params, sessionId })); }); }
}
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rab-maps-'));
const proc = spawn(findBrowser(), ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--remote-debugging-port=' + PORT, '--user-data-dir=' + dir, '--window-size=1280,720', 'about:blank'], { stdio: 'ignore' });
let info = null;
for (let i = 0; i < 60 && !info; i++) { await sleep(300); try { info = await (await fetch('http://127.0.0.1:' + PORT + '/json/version', { signal: AbortSignal.timeout(2000) })).json(); } catch (e) { /* not yet */ } }
if (!info) { proc.kill(); throw new Error('browser did not start'); }
const ws = new WebSocket(info.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
const cdp = new Cdp(ws);

async function openPage(w, h) {
  const { targetInfos } = await cdp.send('Target.getTargets');                          // use the page Edge opened itself (a second window can hang headless Edge)
  const targetId = targetInfos.find((t) => t.type === 'page').targetId;
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const page = {
    send: (m, p) => cdp.send(m, p, sessionId),
    async eval(expr) { const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sessionId); if (r.exceptionDetails) throw new Error('page error: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text)); return r.result.value; },
    async shotData() { return (await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId)).data; },
    async waitFor(expr, ms = 20000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await this.eval(expr)) return true; } catch (e) { /* not ready */ } await sleep(150); } throw new Error('timeout: ' + expr); },
  };
  await page.send('Page.enable'); await page.send('Runtime.enable');
  await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  return page;
}

const list = MAPS.filter((m) => !ONLY || ONLY.includes(m.id));
try {
  if (!process.argv.includes('--sheet-only')) {
    const page = await openPage(1280, 720);
    for (const m of list) {
      await page.send('Page.navigate', { url: BASE + '/index.html?map=' + m.id + '&autostart=1&dummy=off&seed=3&warmup=30&stopAfter=30' });
      await page.waitFor("window.__game && window.__game.mode.kind === 'practice' && window.__game.session.ticks >= 30", 45000);
      await page.waitFor("window.__game.bgStatus().status === 'ready'", 60000);
      await sleep(1400);                                                    // the cross-fade into the backdrop takes about 0.8 s
      const err = await page.eval("document.getElementById('errbox') ? document.getElementById('errbox').textContent : ''");
      if (err) console.log(m.id + ': page errors: ' + err);
      fs.writeFileSync(path.join(OUT, m.id + '.png'), Buffer.from(await page.shotData(), 'base64'));
      console.log('saved maps/' + m.id + '.png');
    }
  }
  // ---- contact sheet ----
  const cols = 5, cw = 384, ch = 216, pad = 6, rows = Math.ceil(MAPS.length / cols);
  let sheetUrl = null;                                                                  // the sheet is drawn on a canvas and read back (a screenshot of a page this big can hang)
  const sheet = await openPage(1280, 720);
  const items = MAPS.filter((m) => fs.existsSync(path.join(OUT, m.id + '.png'))).map((m) => ({ id: m.id, family: m.family || 'original', bg: m.background + ' ' + (m.backgroundVariant || 0), c: m.solids.length + '/' + m.destructibles.length + '/' + m.platforms.length + '/' + (m.hazards || []).length }));
  await sheet.send('Page.navigate', { url: BASE + '/package.json' });                // any same-origin page: the pictures are fetched from the server
  await sleep(500);
  await sheet.eval(`(async () => {
    const items = ${JSON.stringify(items)}; const c = document.createElement('canvas'); c.width = ${cols * (cw + pad) + pad}; c.height = ${rows * (ch + pad) + pad};
    document.body.innerHTML = ''; document.body.style.margin = '0'; document.body.appendChild(c); const g = c.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < items.length; i++) {
      const bmp = await createImageBitmap(await (await fetch('/screenshots/maps/' + items[i].id + '.png?' + Date.now())).blob());
      const x = ${pad} + (i % ${cols}) * (${cw + pad}), y = ${pad} + Math.floor(i / ${cols}) * (${ch + pad});
      g.drawImage(bmp, x, y, ${cw}, ${ch});
      g.font = 'bold 12px monospace'; g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(x, y + ${ch} - 22, ${cw}, 22); g.fillStyle = '#fff'; g.fillText(items[i].id + ' - ' + items[i].family + ' - ' + items[i].bg + ' - ' + items[i].c, x + 6, y + ${ch} - 6);
    }
    return c.toDataURL('image/png'); })()`).then((url) => { sheetUrl = url; });
  fs.writeFileSync(path.join(OUT, '_all.png'), Buffer.from(sheetUrl.split(',')[1], 'base64'));
  console.log('saved maps/_all.png (' + items.length + ' maps)');
} finally {
  try { await cdp.send('Browser.close'); } catch (e) { /* ignore */ }
  setTimeout(() => {
    try { if (process.platform === 'win32') spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); else proc.kill(); } catch (e) { /* ignore */ }   // the whole browser process tree, not only the first process
    setTimeout(() => process.exit(0), 800);
  }, 500);
}
