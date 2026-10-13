// ============================================================================
//  protocol.js - message types and the compact input-frame encoding.
//
//  Every message is a plain object { t: <type>, ... } sent as JSON.
//    hello    C->H reliable  { v, name, token }                      first message from a client (token set when rejoining)
//    welcome  H->C reliable  { v, you: 1, hostName, token, rejoin }  accepted
//    reject   H->C reliable  { reason: 'full' | 'version' }
//    full     H->C reliable  { snap, mv, evSeq, map, names }         everything needed to (re)start rendering
//    snap     H->C unreliable{ tick, seq, ack, ph, rd, rt, rtm, sd, sc, res, map, p:[..], b:[..], bk:[..], mvs }  ~30 Hz
//    ev       H->C reliable  { n, list:[{...event, tick}] }          sim events for effects; n = sequence of the first one
//    in       C->H unreliable{ f:[frame, frame, frame] }             newest frame first, older ones repeated for loss
//    intent   C->H reliable  { i: { type:'answer'|'pick'|'continue'|'playAgain', ... } }
//    mv       H->C reliable  { view }                                matchView(): what the client may see of the match
//    ping/pong both reliable { ts }
//    nack     H->C reliable  { error }                               an intent was rejected
//    bye      both reliable  { reason }                              leaving on purpose
// ============================================================================
import { CONFIG } from '../config.js';

export const T = {
  HELLO: 'hello', WELCOME: 'welcome', REJECT: 'reject', FULL: 'full', SNAP: 'snap', EV: 'ev', IN: 'in',
  INTENT: 'intent', MV: 'mv', PING: 'ping', PONG: 'pong', NACK: 'nack', BYE: 'bye',
};
export const VERSION = CONFIG.net.gameVersion;

// ---- input frames: [seq, bits, aimQ] ----------------------------------------------------------------------------------
const B = { left: 1, right: 2, jump: 4, jumpEdge: 8, shoot: 16, shootEdge: 32, block: 64, blockEdge: 128 };
const TWO_PI = Math.PI * 2;

export function encodeAim(a) {
  if (!Number.isFinite(a)) return 0;
  let x = (a + Math.PI) % TWO_PI; if (x < 0) x += TWO_PI;
  return Math.round(x / TWO_PI * 65535);
}
export function decodeAim(q) { return (q / 65535) * TWO_PI - Math.PI; }

// input = { left, right, jump, jumpPressed, shoot, block, aim, shootPressed?, blockPressed? }
export function encodeFrame(seq, input) {
  let bits = 0;
  if (input.left) bits |= B.left; if (input.right) bits |= B.right;
  if (input.jump) bits |= B.jump; if (input.jumpPressed) bits |= B.jumpEdge;
  if (input.shoot) bits |= B.shoot; if (input.shootPressed) bits |= B.shootEdge;
  if (input.block) bits |= B.block; if (input.blockPressed) bits |= B.blockEdge;
  return [seq, bits, encodeAim(input.aim)];
}
export function decodeFrame(f) {
  const [seq, bits, q] = f;
  return {
    seq, aim: decodeAim(q),
    left: !!(bits & B.left), right: !!(bits & B.right), jump: !!(bits & B.jump), jumpPressed: !!(bits & B.jumpEdge),
    shoot: !!(bits & B.shoot), shootPressed: !!(bits & B.shootEdge), block: !!(bits & B.block), blockPressed: !!(bits & B.blockEdge),
  };
}

// Is this a sane input message? (the host never trusts the client)
export function validInputMsg(m) {
  return m && Array.isArray(m.f) && m.f.length > 0 && m.f.length <= 8 && m.f.every((f) => Array.isArray(f) && f.length === 3 && Number.isInteger(f[0]) && Number.isInteger(f[1]) && Number.isInteger(f[2]) && f[2] >= 0 && f[2] <= 65535);
}
const INTENTS = new Set(['answer', 'pick', 'continue', 'playAgain', 'hover']);
export function validIntent(i) { return !!i && INTENTS.has(i.type); }
