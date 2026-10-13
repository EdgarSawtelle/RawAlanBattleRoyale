// worker.js - builds ONE background scene off the main thread and renders it into an OffscreenCanvas at ~20 Hz,
// posting an ImageBitmap per frame (or a single "still" frame when the animation is switched off).
// Messages in : { type:'init', id, variant, seed, animated }, { type:'pause', on }
// Messages out: { type:'ready' }, { type:'frame', bmp, still }, { type:'error', message }
import { SCENES } from './registry.js';
import { W, H } from '../px.js';

const FRAME_MS = 50, STILL_T = 4000;
let T0 = STILL_T, scene = null, canvas = null, g = null, timer = null, animated = true, paused = false, t0 = 0;

function post(still) {
  scene.draw(g, still ? T0 : T0 + (performance.now() - t0));
  const bmp = canvas.transferToImageBitmap();
  postMessage({ type: 'frame', bmp, still: !!still }, [bmp]);
}
function schedule() {
  if (timer) { clearInterval(timer); timer = null; }
  if (animated && !paused && scene) timer = setInterval(() => { try { post(false); } catch (e) { postMessage({ type: 'error', message: String(e && e.stack || e) }); clearInterval(timer); } }, FRAME_MS);
}
self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === 'init') {
      const tb = performance.now(); const mod = await SCENES[m.id]();
      scene = mod.create(m.seed || 1, m.variant || 0);
      canvas = new OffscreenCanvas(W, H); g = canvas.getContext('2d'); g.imageSmoothingEnabled = false;
      animated = m.animated !== false; t0 = performance.now(); if (typeof m.t0 === 'number') T0 = m.t0;
      post(true);                                  // a still first, so there is something to show immediately
      postMessage({ type: 'ready', buildMs: Math.round(performance.now() - tb) });
      if (animated) schedule();
    } else if (m.type === 'pause') { paused = !!m.on; schedule(); if (!paused && scene) post(!animated); }
    else if (m.type === 'animate') { animated = !!m.on; schedule(); if (scene && !animated) post(true); }
  } catch (err) { postMessage({ type: 'error', message: String(err && err.stack || err) }); }
};
