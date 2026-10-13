// ============================================================================
//  icons.js - small pixel icons for the cards (12 x 12 pixel grid, drawn with the px toolkit).
//  drawIcon(id, x, y, scale) draws on the canvas currently selected with px.use(). An unknown id
//  draws a "?" box, so a new card works before it has an icon.
// ============================================================================
import { ctx, P, R, LN, DISC, FPOLY, RING } from './px.js';

const INK = '#0e0d0c', AMB = '#e9a93c', PALE = '#ffd58a', RUST = '#c9591f', DRUST = '#7a3a1c', STEEL = '#b9bcb0', MID = '#6d7068', DARK = '#3b3d38',
  BONE = '#e6e0c8', TEAL = '#7bbfae', DTEAL = '#3d6963', BROWN = '#6e4c31', GREEN = '#8fa65a';

const ICONS = {
  hairtrigger() {              // lightning bolt with speed lines
    FPOLY([[8, 0], [2, 7], [5.5, 7], [4, 12], [11, 4], [7, 4]], AMB);
    LN(8, 0, 2, 7, INK); LN(2, 7, 5, 7, INK); LN(5, 7, 4, 12, INK); LN(4, 12, 11, 4, INK); LN(11, 4, 7, 4, INK); LN(7, 4, 8, 0, INK);
    R(0, 2, 2, 1, STEEL); R(0, 5, 1, 1, STEEL); R(10, 8, 2, 1, STEEL); R(9, 10, 2, 1, STEEL);
    P(7, 2, PALE); P(6, 3, PALE);
  },
  pinball() {                  // a ball bouncing off a wall
    R(0, 1, 1, 10, MID); R(1, 1, 1, 10, STEEL);
    LN(10, 1, 2, 6, AMB); LN(2, 6, 9, 11, AMB);
    DISC(9, 2, 2, INK); DISC(9, 2, 1.5, STEEL); P(8, 1, BONE);
    P(2, 6, PALE); P(3, 6, PALE); P(2, 5, PALE); P(2, 7, PALE);
  },
  thickskin() {                // a shield with a heart
    FPOLY([[1, 1], [11, 1], [11, 6], [6, 11.5], [1, 6]], STEEL);
    R(1, 1, 10, 1, BONE); R(1, 2, 1, 4, BONE);
    LN(11, 2, 11, 6, MID); LN(11, 6, 6, 11, MID);
    LN(1, 1, 11, 1, INK); LN(11, 1, 11, 6, INK); LN(11, 6, 6, 11, INK); LN(6, 11, 1, 6, INK); LN(1, 6, 1, 1, INK);
    P(4, 4, RUST); P(5, 4, RUST); P(7, 4, RUST); P(8, 4, RUST); R(4, 5, 5, 1, RUST); R(5, 6, 3, 1, RUST); P(6, 7, RUST);
  },
  tightguard() {               // a thin shield arc and a clock tick: short, fast block
    RING(6, 6, 5, TEAL); RING(6, 6, 4, DTEAL);
    R(5, 3, 2, 4, PALE); R(5, 6, 4, 1, PALE);
    P(0, 6, STEEL); P(11, 6, STEEL);
  },
  scramble() {                 // a flame under your feet
    FPOLY([[6, 0], [9, 4], [10, 8], [8, 11], [4, 11], [2, 8], [3, 5], [5, 7]], RUST);
    FPOLY([[6, 4], [8, 7], [8.5, 9.5], [7, 11], [5, 11], [4, 9], [5, 7]], AMB);
    FPOLY([[6, 7], [7, 9], [6.5, 11], [5, 11], [5, 9]], PALE);
  },
  featherweight() {            // a feather
    FPOLY([[1, 11], [2, 6], [5, 2], [10, 0.5], [11, 1], [10, 5], [7, 9], [3, 10.5]], BONE);
    FPOLY([[4, 8], [6, 5], [9, 2], [9, 4], [7, 7]], STEEL);
    LN(0, 11, 9, 2, MID);
    LN(1, 11, 2, 6, INK); LN(2, 6, 5, 2, INK); LN(5, 2, 10, 0, INK); LN(10, 0, 11, 1, INK); LN(11, 1, 10, 5, INK); LN(10, 5, 7, 9, INK); LN(7, 9, 3, 11, INK);
    P(0, 11, INK);
  },
  powderkeg() {                // a barrel with a lit fuse
    R(2, 3, 8, 9, INK); R(3, 4, 6, 7, BROWN); R(3, 4, 1, 7, '#8f6a45'); R(2, 5, 8, 1, DARK); R(2, 9, 8, 1, DARK);
    R(5, 6, 2, 2, AMB); P(5, 5, PALE);
    LN(6, 3, 8, 1, STEEL); P(9, 0, AMB); P(10, 1, PALE); P(8, 0, RUST); P(10, 0, AMB);
  },
  pepperpot() {                // five pellets fanning out of a barrel
    R(0, 4, 3, 4, STEEL); R(0, 4, 3, 1, BONE); R(0, 7, 3, 1, MID); R(3, 5, 1, 2, DARK);
    const pts = [[9, 0], [10, 3], [11, 6], [10, 9], [9, 12]];
    for (const [x, y] of pts) { DISC(x - 0.5, y - 0.5, 1.3, INK); R(x - 1, y - 1, 2, 2, AMB); P(x - 1, y - 1, PALE); }
    for (const [x, y] of [[6, 3], [7, 6], [6, 9]]) R(x, y, 1, 1, RUST);
  },
  prismshot() {                // a prism splitting one ray into three
    FPOLY([[5, 2], [9, 10], [1, 10]], STEEL);
    LN(5, 2, 9, 10, INK); LN(9, 10, 1, 10, INK); LN(1, 10, 5, 2, INK);
    FPOLY([[5, 4], [7, 9], [3, 9]], BONE);
    LN(0, 6, 3, 6, AMB);
    LN(8, 5, 11, 2, AMB); LN(8, 7, 11, 7, AMB); LN(8, 9, 11, 11, AMB);
  },
  returnpolicy() {             // an arrow turning back
    RING(6, 7, 4, TEAL);
    FPOLY([[3, 3], [6, 0.5], [6, 5.5]], PALE); R(6, 2, 4, 2, PALE); P(10, 3, PALE); P(10, 4, TEAL); P(10, 5, TEAL);
    P(2, 7, TEAL); P(2, 6, TEAL);
  },
  // ---- the 20 cards added after version 1 ----
  needlerounds() {             // three thin needles, pointing right
    for (const [y, x0] of [[2, 1], [6, 0], [9, 2]]) { R(x0, y, 7, 1, MID); R(x0 + 6, y, 3, 1, STEEL); R(x0 + 8, y, 1, 1, BONE); P(x0 + 9, y, PALE); R(x0, y - 1, 2, 1, DARK); R(x0, y + 1, 2, 1, DARK); }
  },
  cloudstep() {                // a cloud with a double chevron under it
    DISC(4, 4, 2.6, BONE); DISC(7.5, 3.5, 3, BONE); DISC(9.5, 5, 2, BONE); R(2, 5, 9, 2, BONE); R(2, 6, 9, 1, STEEL);
    LN(3, 9, 6, 7.5, TEAL); LN(9, 9, 6, 7.5, TEAL); LN(3, 11, 6, 9.5, DTEAL); LN(9, 11, 6, 9.5, DTEAL);
  },
  paperdragon() {              // a folded paper dragon head breathing a spark
    FPOLY([[1, 8], [4, 2], [9, 4], [7, 8], [4, 11]], BONE);
    FPOLY([[4, 2], [5.5, 6], [1, 8]], STEEL);
    LN(1, 8, 4, 2, INK); LN(4, 2, 9, 4, INK); LN(9, 4, 7, 8, INK); LN(7, 8, 4, 11, INK); LN(4, 11, 1, 8, INK);
    P(5, 5, INK); P(6, 5, RUST);
    P(9, 6, AMB); P(10, 6, PALE); P(10, 5, RUST); P(10, 7, RUST); P(11, 6, AMB);
  },
  anchor() {                   // an anchor
    RING(6, 2, 1.6, STEEL); R(5, 3, 2, 7, STEEL); R(5, 3, 1, 7, BONE); R(3, 4, 6, 1, STEEL);
    LN(1, 7, 3, 10, STEEL); LN(3, 10, 6, 11, STEEL); LN(6, 11, 9, 10, STEEL); LN(9, 10, 11, 7, STEEL);
    P(1, 6, MID); P(11, 6, MID); P(6, 0, INK);
  },
  limpet() {                   // a shell clinging to a wall
    R(0, 0, 3, 12, MID); R(0, 0, 1, 12, STEEL); R(2, 0, 1, 12, DARK);
    FPOLY([[3, 3], [7, 1.5], [11, 5], [11, 9], [3, 9]], BROWN);
    LN(3, 9, 11, 9, INK); LN(11, 9, 11, 5, INK); LN(11, 5, 7, 1.5, INK); LN(7, 1.5, 3, 3, INK);
    LN(5, 8, 6, 3, '#8f6a45'); LN(8, 8, 8, 3, '#8f6a45'); LN(10, 8, 10, 6, '#8f6a45');
    R(3, 9, 8, 2, BONE);
  },
  salamander() {               // a lizard with a flame on its back
    FPOLY([[1, 8], [4, 6], [8, 6], [10, 4], [11, 6], [8, 9], [3, 10]], GREEN);
    LN(1, 8, 4, 6, INK); LN(4, 6, 8, 6, INK); LN(8, 6, 10, 4, INK); LN(11, 6, 8, 9, INK); LN(8, 9, 3, 10, INK); LN(3, 10, 1, 8, INK);
    P(9, 5, INK); P(10, 5, PALE); R(4, 10, 1, 2, GREEN); R(8, 9, 1, 2, GREEN); P(0, 9, GREEN);
    FPOLY([[6, 1], [8, 4], [7, 6], [5, 6], [4, 4]], RUST); FPOLY([[6, 3], [7, 5], [6, 6], [5, 5]], AMB);
  },
  tithe() {                    // a coin with a heart
    DISC(6, 6, 5.2, INK); DISC(6, 6, 4.4, AMB); DISC(6, 6, 3.4, '#c58a28');
    R(4, 4, 2, 1, RUST); R(6, 4, 2, 1, RUST); R(3, 5, 6, 2, RUST); R(4, 7, 4, 1, RUST); R(5, 8, 2, 1, RUST); P(4, 5, PALE);
  },
  wreckingball() {             // a heavy ball on a chain
    DISC(8, 8, 4, INK); DISC(8, 8, 3.3, DARK); DISC(8, 8, 2.2, MID); P(6, 6, STEEL); P(7, 6, STEEL); P(6, 7, STEEL);
    R(5, 2, 2, 2, STEEL); R(3, 4, 2, 2, MID); R(2, 0, 2, 2, STEEL); P(4, 3, INK);
  },
  trebuchet() {                // a lobbed ball over an arc, a lever below
    for (const [x, y] of [[1, 9], [2, 6], [4, 4], [6, 3], [8, 4], [10, 7]]) P(x, y, MID);
    DISC(10, 9, 1.8, INK); DISC(10, 9, 1.2, AMB); P(9, 8, PALE);
    LN(1, 11, 7, 9, BROWN); LN(1, 10, 7, 8, '#8f6a45'); R(3, 9, 2, 3, DARK); DISC(2, 9, 1.4, STEEL);
  },
  kickback() {                 // a gun with a kick arrow behind it
    R(5, 4, 6, 3, STEEL); R(5, 4, 6, 1, BONE); R(10, 3, 1, 5, MID); R(6, 7, 2, 4, DARK);
    LN(4, 5, 0, 5, AMB); FPOLY([[0, 5], [3, 3], [3, 7]], AMB); P(1, 8, MID); P(2, 9, MID); P(0, 3, MID);
  },
  sleight() {                  // a card flipping out of a sleeve
    FPOLY([[3, 1], [9, 2], [8, 10], [2, 9]], BONE); LN(3, 1, 9, 2, INK); LN(9, 2, 8, 10, INK); LN(8, 10, 2, 9, INK); LN(2, 9, 3, 1, INK);
    DISC(5.5, 5.5, 1.6, RUST); P(5, 5, AMB); P(4, 3, INK); P(7, 8, INK);
    P(10, 0, PALE); P(11, 1, AMB); P(0, 10, PALE); P(1, 11, AMB);
  },
  porcupine() {                // a spiky ball
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5; LN(6 + Math.cos(a) * 3, 6 + Math.sin(a) * 3, 6 + Math.cos(a) * 6, 6 + Math.sin(a) * 6, i % 2 ? STEEL : BONE); }
    DISC(6, 6, 3.4, INK); DISC(6, 6, 2.8, BROWN); P(5, 5, '#8f6a45'); P(7, 6, INK);
  },
  cornered() {                 // a cracked heart in a corner
    R(0, 0, 1, 12, MID); R(0, 11, 12, 1, MID);
    FPOLY([[6, 10], [2, 6], [2, 3], [4, 2], [6, 4], [8, 2], [10, 3], [10, 6]], RUST);
    LN(6, 4, 5, 6, INK); LN(5, 6, 7, 7, INK); LN(7, 7, 6, 9, INK);
    P(3, 3, PALE); P(4, 3, PALE); P(10, 8, AMB); P(11, 9, AMB);
  },
  demopermit() {               // a crate with a stick of dynamite and a stamp
    R(1, 4, 10, 8, INK); R(2, 5, 8, 6, BROWN); R(2, 5, 8, 1, '#8f6a45'); LN(2, 6, 9, 10, DARK); LN(9, 6, 2, 10, DARK);
    R(4, 1, 3, 4, RUST); R(4, 1, 1, 4, '#d9703a'); P(5, 0, AMB); P(6, 0, PALE); P(7, 1, AMB);
    R(8, 6, 3, 3, BONE); P(9, 7, RUST);
  },
  latebloomer() {              // a bud opening
    R(5, 6, 2, 6, GREEN); R(5, 6, 1, 6, '#6e8a40'); FPOLY([[6, 9], [10, 7], [9, 10]], GREEN); FPOLY([[6, 10], [2, 8], [3, 11]], GREEN);
    FPOLY([[6, 6], [3, 3], [4, 0.5], [6, 2]], AMB); FPOLY([[6, 6], [9, 3], [8, 0.5], [6, 2]], AMB); FPOLY([[6, 6], [5, 1.5], [7, 1.5]], PALE);
    P(4, 3, RUST); P(8, 3, RUST); P(6, 5, RUST);
  },
  bricklayer() {               // bricks
    for (const [y, off] of [[1, 0], [4, 3], [7, 0], [10, 3]]) { for (let x = off - 6; x < 12; x += 6) { R(Math.max(0, x), y, Math.min(5, 12 - Math.max(0, x)), 2, x + 5 > 0 ? RUST : INK); R(Math.max(0, x), y, Math.min(5, 12 - Math.max(0, x)), 1, '#d9703a'); } }
    R(0, 3, 12, 1, STEEL); R(0, 6, 12, 1, STEEL); R(0, 9, 12, 1, STEEL);
  },
  partinggift() {              // a gift box with a lit fuse
    R(1, 5, 10, 7, INK); R(2, 6, 8, 5, BONE); R(5, 6, 2, 5, RUST); R(2, 8, 8, 2, RUST); R(1, 4, 10, 2, INK); R(2, 4, 8, 1, STEEL);
    LN(6, 4, 8, 2, DARK); P(9, 1, AMB); P(10, 0, PALE); P(8, 0, RUST); P(10, 2, AMB);
  },
  vendetta() {                 // a dagger
    FPOLY([[9, 0], [10.5, 1.5], [4, 8]], BONE); LN(9, 0, 4, 8, INK); LN(10.5, 1.5, 4, 8, MID);
    R(2, 7, 4, 1, STEEL); LN(2, 6, 6, 9, DARK); LN(1, 11, 4, 8, BROWN); LN(2, 11, 5, 8, '#8f6a45');
    P(10, 3, RUST); P(10, 4, RUST);
  },
  lastcall() {                 // a big gold cannonball with a flame trail
    FPOLY([[0, 6], [4, 3], [4, 9]], RUST); FPOLY([[1, 6], [4, 4.5], [4, 7.5]], AMB);
    DISC(8, 6, 4.4, INK); DISC(8, 6, 3.7, AMB); DISC(8, 6, 2.6, '#ffd24a'); P(7, 4, PALE); P(8, 4, PALE); P(6, 5, PALE);
  },
  gravedigger() {              // a shovel stuck in a mound
    LN(2, 0, 7, 8, BROWN); LN(3, 0, 8, 8, '#8f6a45');
    FPOLY([[6, 7], [10, 6], [11, 9], [8, 11]], STEEL); LN(6, 7, 10, 6, INK); LN(10, 6, 11, 9, INK); LN(11, 9, 8, 11, INK); LN(8, 11, 6, 7, INK); P(9, 8, BONE);
    R(0, 10, 6, 2, DARK); R(1, 9, 4, 1, BROWN); P(2, 9, '#8f6a45');
  },
  unknown() { R(1, 1, 10, 10, DARK); R(2, 2, 8, 8, MID); P(5, 4, BONE); P(6, 4, BONE); P(6, 6, BONE); P(6, 8, BONE); },
};

// Draw card icon `id` with its top-left corner at (x, y) (canvas pixels), each icon pixel scaled by `scale`.
export function drawIcon(id, x, y, scale = 1) {
  const g = ctx();
  g.save();
  g.translate(Math.round(x), Math.round(y)); g.scale(scale, scale);
  (ICONS[id] || ICONS.unknown)();
  g.restore();
}
