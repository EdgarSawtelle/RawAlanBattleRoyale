// Room codes and invite links. Pure functions (no DOM needed except for location helpers).
import { CONFIG } from '../config.js';

// A random room code from the unambiguous alphabet (about 28 million combinations at length 5).
// `rand` is injectable for tests; the lobby uses crypto / Math.random (this is NOT the simulation).
export function makeRoomCode(rand = Math.random) {
  const A = CONFIG.net.codeAlphabet;
  let s = '';
  for (let i = 0; i < CONFIG.net.codeLength; i++) s += A[Math.floor(rand() * A.length)];
  return s;
}

// Normalise what a person typed: upper case, spaces removed, look-alike characters mapped
// (0 -> O is not in the alphabet, so O -> kept out; we simply strip anything not in the alphabet).
export function normaliseCode(text) {
  const A = CONFIG.net.codeAlphabet;
  return String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '').split('').filter((c) => A.includes(c)).join('').slice(0, CONFIG.net.codeLength);
}
export function isValidCode(code) { return typeof code === 'string' && code.length === CONFIG.net.codeLength && [...code].every((c) => CONFIG.net.codeAlphabet.includes(c)); }

export function peerIdForCode(code) { return CONFIG.net.roomPrefix + code; }

// Invite link = this page's URL (any sub-path) + #join=CODE. The hash is never sent to a server.
export function inviteLink(code, loc = (typeof location !== 'undefined' ? location : null)) {
  if (!loc) return '#join=' + code;
  return loc.origin + loc.pathname + '#join=' + code;
}
// Reads #join=CODE from a hash string; returns a valid code or null.
export function codeFromHash(hash) {
  const m = /[#&]join=([A-Za-z0-9]+)/.exec(hash || '');
  const c = m ? normaliseCode(m[1]) : '';
  return isValidCode(c) ? c : null;
}

// Player names must be safe for the pixel font: letters, digits, space, dot, dash, underscore.
export function cleanName(text, fallback) {
  const t = String(text || '').toUpperCase().replace(/[^A-Z0-9 ._-]/g, '').trim().slice(0, CONFIG.net.maxNameLength);
  return t || fallback;
}
