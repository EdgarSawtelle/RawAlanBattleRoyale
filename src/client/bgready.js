// ============================================================================
//  bgready.js - "is the animated scene of this map built, so the round can be SHOWN?" The one place that knows how to ask client/background.js.
//
//  background.js is owned by the background artist; this adapter only uses its PUBLIC functions (its header documents them for exactly this gate):
//     isBackgroundReady(id, variant)    a picture of that look can be shown right now (a still or an animated frame), or it failed for good
//     prepareBackground(id, variant)    build it ahead of time (queued, idempotent): asked for as soon as the next map is known
//  and falls back to getBackgroundStatus() (the scene on screen: its key and 'building' | 'ready' | 'failed') if they are ever missing.
//  To swap in other names, change only this file.
//
//  Test hook:  ?slowbg=4000   pretends every scene needs 4 s (from the first time it was asked for or prepared) before it counts as ready
//              (&slowbgonly=<scene id> restricts that to one scene).
// ============================================================================
import * as BG from './background.js';
import { getMap } from '../maps/index.js';

const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const SLOW_MS = Number(params.get('slowbg')) || 0;
const SLOW_ONLY = params.get('slowbgonly') || '';                // ?slowbgonly=waterfall-forest: only that scene is slow (so the title screen is not)
const asked = new Map();                                       // scene key -> performance.now() of the first ask (only for ?slowbg)

function scene(mapId) {
  const m = getMap(mapId);
  return { id: m.background, variant: Number(m.backgroundVariant) || 0 };
}
// the key background.js uses for a scene (same rules as its resolve(): the ?bg= override, aliases, a variant inside the scene's range)
function keyOf(s) {
  const ov = BG.getBackgroundOverride && BG.getBackgroundOverride();
  if (ov) return ov.id + ':' + ov.variant;
  const list = BG.listBackgrounds ? BG.listBackgrounds() : [];
  const known = list.find((x) => x.id === s.id);
  if (!known) return list.length ? (list[0].id + ':0') : s.id + ':' + s.variant;      // unknown ids fall back to the default scene
  return s.id + ':' + Math.max(0, Math.min(known.variants.length - 1, s.variant));
}
function noteAsked(s) { const k = s.id + ':' + s.variant; if (SLOW_MS && !asked.has(k)) asked.set(k, performance.now()); return k; }

/** Can the scene of this map be drawn right now (built and on screen)? A failed build counts as ready: the plain gradient is all there will ever be. */
export function sceneReady(mapId) {
  let s; try { s = scene(mapId); } catch (e) { return true; }
  const k = noteAsked(s);
  if (SLOW_MS && (!SLOW_ONLY || SLOW_ONLY === s.id) && performance.now() - asked.get(k) < SLOW_MS) return false;
  if (typeof BG.isBackgroundReady === 'function') {
    const ready = !!BG.isBackgroundReady(s.id, s.variant);
    if (!ready && typeof BG.prepareBackground === 'function') BG.prepareBackground(s.id, s.variant);      // (idempotent: make sure somebody is building it)
    return ready;
  }
  const st = BG.getBackgroundStatus();
  if (st.key !== keyOf(s)) return false;                       // the renderer has not switched to this map's scene yet (it does within a frame)
  return st.status === 'ready' || st.status === 'failed';
}

/** Start building the scene of a map that is not shown yet (called as soon as the next map is known: round end, quiz, card pick). */
export function prepareScene(mapId) {
  let s; try { s = scene(mapId); } catch (e) { return; }
  noteAsked(s);
  if (typeof BG.prepareBackground === 'function') { try { BG.prepareBackground(s.id, s.variant); } catch (e) { /* ignore */ } }
}

export const slowBgMs = () => SLOW_MS;
