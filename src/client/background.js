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
//  Only the CURRENT scene keeps a worker (animated). Any other look is built on request (prepareBackground) in a
//  short-lived worker, one at a time, and kept as a still (an ImageBitmap, ~1 MB); at most MAX_STILLS stills are
//  cached (least recently used goes first), so 8 scenes x 2 looks never sit in memory together. If the next map's
//  look is not ready when it is shown, the previous picture stays up and cross-fades into it (never a gradient flash).
//
//  PUBLIC API for the round-start gate (all take the map's own `background` + `backgroundVariant`; the ?bg= override applies):
//     prepareBackground(id, variant)       request a build ahead of time (queued; idempotent)
//     isBackgroundReady(id, variant)       true when a picture of that look can be shown right now (or it failed for good: the
//                                           fallback gradient is then what will show, so a gate must not wait forever)
//     whenBackgroundReady(id, variant, timeoutMs = 20000)   Promise<boolean>: true = ready, false = failed / timed out
//     getBackgroundStatus(id?, variant?)   { key, status:'idle'|'building'|'ready'|'failed', ready, animated, buildMs }  (no args = the scene on screen)
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
const bgT = params.get('bgt') ? Number(params.get('bgt')) : undefined;     // ?bgt=<ms>: start the animation at this scene time (QA: jump to a wonder moment)
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
const MAX_STILLS = 5;           // built looks kept as stills (besides the one on screen)
const garbage = [];                         // bitmaps to close once they are no longer on screen (never close what renderer.draw may still be drawing)
function discard(b) { if (b && !garbage.includes(b)) garbage.push(b); }
const waiters = [];             // { key, resolve, timer } for whenBackgroundReady
let lastShown = null, fadeFrom = null, fadeStart = 0, lastKey = null, lastOwn = false;   // what was drawn last frame, for the cross-fade

function entryFor(r) {
  let e = entries.get(r.key);
  if (!e) { e = { key: r.key, id: r.id, variant: r.variant, worker: null, status: 'idle', bmp: null, still: null }; entries.set(r.key, e); }
  return e;
}
function release(e) {                           // stop a worker but keep the last frame as a still
  if (e.worker) { e.worker.terminate(); e.worker = null; }
  if (e.bmp) { if (e.still && e.still !== e.bmp) discard(e.still); e.still = e.bmp; e.bmp = null; }
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
      if (e.bmp && e.bmp !== e.still) discard(e.bmp);
      if (m.still) { if (e.still && e.still !== e.bmp) discard(e.still); e.still = m.bmp; e.bmp = wantAnimated ? m.bmp : null; }
      else e.bmp = m.bmp;
      settle();
    } else if (m.type === 'ready') {
      e.status = 'ready'; e.buildMs = m.buildMs;
      if (!wantAnimated || !animated) { w.terminate(); e.worker = null; e.bmp = null; }
      if (onDone) onDone();
    } else if (m.type === 'error') {
      console.warn('background "' + e.key + '" failed:', m.message); e.status = 'failed'; w.terminate(); e.worker = null; e.bmp = null; settle(); if (onDone) onDone();
    }
  };
  w.onerror = (ev) => { console.warn('background worker error:', ev.message); e.status = 'failed'; if (e.worker) e.worker.terminate(); e.worker = null; if (onDone) onDone(); };
  w.postMessage({ type: 'init', id: e.id, variant: e.variant, seed: 1, t0: bgT, animated: wantAnimated && animated });
}
function readyEntry(e) { return !!(e && (e.bmp || e.still)); }
function settle() {                             // resolve every whenBackgroundReady promise whose look is ready / failed
  for (let i = waiters.length - 1; i >= 0; i--) {
    const w = waiters[i], e = entries.get(w.key);
    if (e && (readyEntry(e) || e.status === 'failed')) { waiters.splice(i, 1); clearTimeout(w.timer); w.resolve(readyEntry(e)); }
  }
}
function evict() {                              // keep the still cache small: drop the least recently used looks that are not on screen / building
  const stills = [...entries.values()].filter((e) => e.still && e !== active && e !== prevEntry && e !== preloading && !e.worker);
  stills.sort((a, b) => (a.used || 0) - (b.used || 0));
  while (stills.length > MAX_STILLS) { const e = stills.shift(); discard(e.still); entries.delete(e.key); }
}
function pump() {                               // build the requested looks, one at a time, never while the current scene itself is still building
  if (preloading || (active && active.status === 'building') || !queue.length) return;
  const key = queue.shift(), e = entries.get(key);
  if (!e || e === active || readyEntry(e) || e.worker || e.status === 'failed') { settle(); return pump(); }
  preloading = e; spawn(e, false, () => { preloading = null; evict(); settle(); setTimeout(pump, 30); });
}

/** Ask for a look to be built ahead of time. Cheap and idempotent. */
export function prepareBackground(id, variant) {
  const r = resolve(id, variant), e = entryFor(r); e.used = performance.now();
  if (!readyEntry(e) && e.status !== 'failed' && e !== active && !queue.includes(r.key)) queue.push(r.key);
  setTimeout(pump, 0);
}
/** Can a picture of this look be shown right now? (A look that failed for good also answers true: the fallback gradient is what will show.) */
export function isBackgroundReady(id, variant) {
  const e = entries.get(resolve(id, variant).key); return !!e && (readyEntry(e) || e.status === 'failed');
}
/** Resolves true when the look is ready to show, false if it failed or timeoutMs passed. Starts the build if nobody has. */
export function whenBackgroundReady(id, variant, timeoutMs = 20000) {
  const r = resolve(id, variant); prepareBackground(id, variant);
  const e = entries.get(r.key);
  if (readyEntry(e)) return Promise.resolve(true);
  if (e.status === 'failed') return Promise.resolve(false);
  return new Promise((resolve_) => { const w = { key: r.key, resolve: resolve_, timer: setTimeout(() => { const i = waiters.indexOf(w); if (i >= 0) waiters.splice(i, 1); resolve_(false); }, timeoutMs) }; waiters.push(w); });
}

/** The backdrop to draw this frame (an ImageBitmap, or a canvas while loading). Cheap; call every frame. */
export function getBackground(id, variant) {
  const r = resolve(id, variant), e = entryFor(r);
  if (active !== e) {
    if (active) { release(active); prevEntry = active; }
    active = e; e.used = performance.now(); setTimeout(pump, 300);
  }
  e.used = performance.now();
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
  for (let i = garbage.length - 1; i >= 0; i--) { const b = garbage[i]; if (b !== out && !(fadeFrom && b === fadeFrom) && !(prevEntry && (b === prevEntry.bmp || b === prevEntry.still))) { try { b.close(); } catch (x) { /* ignore */ } garbage.splice(i, 1); } }
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
export function getBackgroundStatus(id, variant) {
  const e = id === undefined ? active : entries.get(resolve(id, variant).key), key = id === undefined ? (active && active.key) : resolve(id, variant).key;
  return e ? { key: e.key, status: e.status, ready: readyEntry(e) || e.status === 'failed', animated, buildMs: e.buildMs } : { key: key || null, status: 'idle', ready: false, animated };
}
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
