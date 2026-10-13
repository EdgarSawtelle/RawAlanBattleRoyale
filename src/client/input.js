// ============================================================================
//  input.js - keyboard + mouse -> the small input object the simulation consumes:
//      { left, right, jump, jumpPressed, shoot, block, aim }
//  A/D move, W or Space jump, mouse aims, left button shoots (hold), right button blocks.
//  `jumpPressed` is an EDGE: it stays true until the next sim tick consumes it, so a quick tap
//  is never lost even if no tick runs in that frame.
// ============================================================================
import { CONFIG } from '../config.js';

export function createInput(canvas) {
  const keys = new Set();
  let jumpEdge = false, shootEdge = false, blockEdge = false;
  const mouse = { x: CONFIG.field.w / 2, y: CONFIG.field.h / 2, left: false, right: false };
  const self = { enabled: true, moved: false };
  const isOn = () => (self.gate ? self.gate() : self.enabled);   // moved: the mouse has been seen over the page at least once

  const toLogical = (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) / r.width * CONFIG.field.w;
    mouse.y = (e.clientY - r.top) / r.height * CONFIG.field.h;
    self.moved = true;
  };
  const JUMP = new Set(['KeyW', 'Space', 'ArrowUp']);
  window.addEventListener('keydown', (e) => {
    if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (JUMP.has(e.code) || e.code === 'ArrowLeft' || e.code === 'ArrowRight') e.preventDefault();
    if (JUMP.has(e.code) && !keys.has(e.code) && isOn()) jumpEdge = true;
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); mouse.left = mouse.right = false; });
  canvas.addEventListener('mousemove', toLogical);
  window.addEventListener('mousemove', toLogical);
  canvas.addEventListener('mousedown', (e) => { toLogical(e); e.preventDefault(); if (!isOn()) return; if (e.button === 0) { mouse.left = true; shootEdge = true; } if (e.button === 2) { mouse.right = true; blockEdge = true; } e.preventDefault(); });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.left = false; if (e.button === 2) mouse.right = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());          // no browser menu on the canvas
  document.addEventListener('contextmenu', (e) => { if (e.target === canvas || e.target.closest('#stage')) e.preventDefault(); });

  // Build the input for the player at `p` (its centre is the aim origin). Consumes the jump edge.
  self.sample = function (p) {
    const on = self.gate ? self.gate() : self.enabled;       // gate(): decided at the moment of sampling (does not depend on drawing frames)
    if (!on) { jumpEdge = shootEdge = blockEdge = false; return { left: false, right: false, jump: false, jumpPressed: false, shoot: false, block: false, aim: p.aim }; }
    const jump = keys.has('KeyW') || keys.has('Space') || keys.has('ArrowUp');
    const out = {
      left: keys.has('KeyA') || keys.has('ArrowLeft'),
      right: keys.has('KeyD') || keys.has('ArrowRight'),
      jump, jumpPressed: jumpEdge,
      shoot: mouse.left, block: mouse.right, shootPressed: shootEdge, blockPressed: blockEdge,
      aim: Math.atan2(mouse.y - p.y, mouse.x - p.x),
    };
    jumpEdge = shootEdge = blockEdge = false;
    return out;
  };
  self.mouse = mouse;
  return self;
}
