// ============================================================================
//  quality.js - plain functions that turn the measured numbers of a connection (ping, jitter, loss, the host's tick rate, the
//  selected ICE candidate pair) into what the player sees: a muted traffic-light colour, a line of text. Pure, so tests can call them.
// ============================================================================
import { CONFIG } from '../config.js';

// 'good' | 'ok' | 'poor' | 'unknown'. Loss is a fraction (0.02 = 2 %); ping and jitter are in ms.
export function netQuality({ ping = null, jitter = 0, loss = 0 } = {}) {
  if (ping === null || ping === undefined) return 'unknown';
  if (ping > 160 || loss > 0.06 || jitter > 45) return 'poor';
  if (ping > 80 || loss > 0.02 || jitter > 18) return 'ok';
  return 'good';
}

// muted colours (the HUD and the debug panel): green-grey, amber, burnt orange
export const QUALITY_COLOR = { good: '#a3b56c', ok: '#d0a24a', poor: '#d9622b', unknown: '#8a8a80' };

// "direct" | "relayed" (what getStats() says about the selected candidate pair), as words for the debug panel
export function describePath(path) {
  if (!path) return '-';
  const how = { host: 'same network', srflx: 'through NAT', prflx: 'through NAT', relay: 'relay server' };
  return path.kind + ' (' + (how[path.local] || path.local) + (path.local !== path.remote ? ' / ' + (how[path.remote] || path.remote) : '') + ', ' + String(path.protocol || '?').toUpperCase() + ')';
}

export function pct(x) { return (Math.round((x || 0) * 1000) / 10) + '%'; }

// The host is "running slow" when it simulates fewer ticks per second than hostSlowHz (the game then runs in slow motion for both).
export function hostIsSlow(hz) { return typeof hz === 'number' && hz < CONFIG.net.hostSlowHz; }
