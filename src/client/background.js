// ============================================================================
//  background.js - animated backdrops. A map's `background` field is the id of one of the scenes in
//  backgrounds/registry.js, `backgroundVariant` (optional, default 0) picks its look:
//     overgrown-downtown (0 golden hour, 1 overcast after rain)   waterfall-forest (0 morning mist, 1 dusk)
//     old-plaza (0 golden afternoon, 1 foggy dawn)                abandoned-suburb (0 late afternoon, 1 misty morning)
//  (the old id 'overgrown-city' is kept as an alias of overgrown-downtown / 0).
//
//  HOW IT RUNS: every scene is built and animated inside a Web Worker (backgrounds/worker.js) on an
//  OffscreenCanvas at ~20 Hz; the page only receives ImageBitmaps. So neither the 2-4 s build nor the
//  per-frame cost ever touches the main thread (the online host keeps ticking). renderer.draw() calls
//  getBackground() every frame and draws whatever it returns (an ImageBitmap, or the plain dithered
//  gradient while the scene is still building / if it failed).
//  Other maps' backdrops are pre-built one after another as soon as the current one is up, kept as
//  stills (the worker is then released), and re-animated when their map is shown.
//
//  Switches:   ?bg=<id>&bgv=<n>   force a scene/variant        ?bganim=0   freeze the animation (still frame)
//              setBackgroundOverride(id, variant) / setBackgroundAnimated(bool)   (debug panel; animation choice is remembered)
// ============================================================================
import { MAPS } from '../maps/index.js';
import { SCENE_LIST } from './backgrounds/registry.js';
import { W, H, use, skyBands } from './px.js';

export const listBackgrounds = () => SCENE_LIST;

const DEFAULT = { id: 'overgrown-downtown', variant: 0 };
const ALIASES = { 'overgrown-city': DEFAULT };
const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
let override = params.get('bg') ? { id: params.get('bg'), variant: Number(params.get('bgv')) || 0 } : null;
let animated = params.get('bganim') ? params.get('bganim') !== '0' : (() => { try { return localStorage.getItem('rab-bg-anim') !== '0'; } catch (e) { return true; } })();

function resolve(id, variant) {
  if (override) id = override.id, variant = override.variant;
  const known = SCENE_LIST.find((s) => s.id === id);
  if (!known) { const a = ALIASES[id] || DEFAULT; return { ...a, key: a.id + ':' + a.variant }; }
  const v = Math.max(0, Math.min(known.variants.length - 1, Number(variant) || 0));
  return { id, variant: v, key: id + ':' + v };
}

// ---- plain dithered gradient: shown while a scene builds, and if one fails ---------------------------------------
let fallback = null;
function fallbackCanvas() {
  if (fallback) return fallback;
  fallback = document.createElement('canvas'); fallback.width = W; fallback.height = H;
  const g = fallback.getContext('2d'); use(g);
  skyBands(0, W, 0, H, [[0, '#131a1f'], [90, '#18232a'], [170, '#1f2d2e'], [250, '#26352f'], [310, '#161f1b']], 12);   // dark, quiet, dithered: the lobby sits on this until the first scene is built
  return fallback;
}

// ---- entries ----------------------------------------------------------------------------------------------------------------
const entries = new Map();        // key -> { key, id, variant, worker, status:'idle'|'building'|'ready'|'failed', bmp, still }
let active = null, prevEntry = null, queue = [], preloading = null, hidden = false;
let lastShown = null, fadeFrom = null, fadeStart = 0, lastKey = null, lastOwn = false;   // what was drawn last frame, for the cross-fade

function entryFor(r) {
  let e = entries.get(r.key);
  if (!e) { e = { key: r.key, id: r.id, variant: r.variant, worker: null, status: 'idle', bmp: null, still: null }; entries.set(r.key, e); }
  return e;
}
function release(e) {                           // stop a worker but keep the last frame as a still
  if (e.worker) { e.worker.terminate(); e.worker = null; }
  if (e.bmp) { if (e.still && e.still !== e.bmp) e.still.close(); e.still = e.bmp; e.bmp = null; }
  if (e.status === 'building') e.status = 'idle';
}
function spawn(e, wantAnimated, onDone) {
  if (e.worker || e.status === 'failed') return;
  e.status = 'building';
  let w;
  try { w = new Worker(new URL('./backgrounds/worker.js', import.meta.url), { type: 'module' }); }
  catch (err) { e.status = 'failed'; console.warn('background worker unavailable:', err); if (onDone) onDone(); return; }
  e.worker = w;
  w.onmessage = (ev) => {
    const m = ev.data;
    if (m.type === 'frame') {
      if (e.bmp && e.bmp !== e.still) e.bmp.close();
      if (m.still) { if (e.still && e.still !== e.bmp) e.still.close(); e.still = m.bmp; e.bmp = wantAnimated ? m.bmp : null; }
      else e.bmp = m.bmp;
    } else if (m.type === 'ready') {
      e.status = 'ready'; e.buildMs = m.buildMs;
      if (!wantAnimated || !animated) { w.terminate(); e.worker = null; e.bmp = null; }
      if (onDone) onDone();
    } else if (m.type === 'error') {
      console.warn('background "' + e.key + '" failed:', m.message); e.status = 'failed'; w.terminate(); e.worker = null; e.bmp = null; if (onDone) onDone();
    }
  };
  w.onerror = (ev) => { console.warn('background worker error:', ev.message); e.status = 'failed'; if (e.worker) e.worker.terminate(); e.worker = null; if (onDone) onDone(); };
  w.postMessage({ type: 'init', id: e.id, variant: e.variant, seed: 1, animated: wantAnimated && animated });
}
function pump() {                               // pre-build the other maps' backgrounds, one at a time, once the current one is up
  if (preloading || !active || active.status === 'building' || !queue.length) return;
  const key = queue.shift(), e = entries.get(key);
  if (!e || e.still || e.worker || e.status === 'failed') return pump();
  preloading = e; spawn(e, false, () => { preloading = null; setTimeout(pump, 50); });
}
function planPreload() {
  queue = [];
  if (params.get('prebuild') === '0') return;                  // ?prebuild=0: do not build the other maps' scenes in advance (tests, slow machines)
  for (const m of MAPS) { const r = resolve(m.background, m.backgroundVariant); const e = entryFor(r); if (e !== active && !e.still && !queue.includes(r.key)) queue.push(r.key); }
  setTimeout(pump, 300);
}

/** The backdrop to draw this frame (an ImageBitmap, or a canvas while loading). Cheap; call every frame. */
export function getBackground(id, variant) {
  const r = resolve(id, variant), e = entryFor(r);
  if (active !== e) {
    if (active) { release(active); prevEntry = active; }
    active = e; planPreload();
  }
  const need = !e.worker && e.status !== 'failed' && e !== preloading && (animated ? !e.bmp : !e.still);
  if (need) spawn(e, true);
  // never flash a gradient between scenes: while the new scene has no frame yet, keep showing the previous scene's last frame
  const own = e.bmp || e.still;
  const out = own || (prevEntry && (prevEntry.bmp || prevEntry.still)) || fallbackCanvas();
  if (e.key !== lastKey || (own && !lastOwn)) {            // a different scene, or this scene's first frame: fade from what was on screen
    if (lastShown && lastShown !== out) { fadeFrom = lastShown; fadeStart = performance.now(); }
    lastKey = e.key;
  }
  lastOwn = !!own; lastShown = out;
  return out;
}

/** The previous picture and how opaque it still is (1 -> 0 over ~0.8 s) while the backdrop cross-fades, else null. */
export function getBackgroundFade() {
  if (!fadeFrom) return null;
  const a = 1 - (performance.now() - fadeStart) / 800;
  if (a <= 0) { fadeFrom = null; return null; }
  return { from: fadeFrom, alpha: a * a * (3 - 2 * a) };
}

// ---- controls (debug panel / URL / settings) ---------------------------------------------------------------------------
export function setBackgroundOverride(id, variant = 0) { override = id ? { id, variant } : null; }
export function getBackgroundOverride() { return override; }
export function getBackgroundStatus() { return active ? { key: active.key, status: active.status, animated, buildMs: active.buildMs } : { key: null, status: 'idle', animated }; }
export function isBackgroundAnimated() { return animated; }
export function setBackgroundAnimated(on) {
  animated = !!on; try { localStorage.setItem('rab-bg-anim', on ? '1' : '0'); } catch (e) { /* ignore */ }
  if (!active) return;
  if (!animated) { release(active); active.status = active.still ? 'ready' : 'idle'; }   // freeze on the current frame
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => {
  hidden = document.visibilityState === 'hidden';
  if (active && active.worker) active.worker.postMessage({ type: 'pause', on: hidden });
});
