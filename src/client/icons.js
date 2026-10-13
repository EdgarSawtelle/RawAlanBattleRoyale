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
