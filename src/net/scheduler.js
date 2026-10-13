// Time sources for the net layer. Everything that needs "now" or "run this later" goes through a
// scheduler, so the same code runs against the real clock in the browser and against a VIRTUAL
// clock in the headless tests (no real waiting, fully deterministic).

// Real time: milliseconds from performance.now(), callbacks through setTimeout.
export function realClock() {
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  return { now, at(ms, fn) { const id = setTimeout(fn, Math.max(0, ms - now())); return () => clearTimeout(id); } };
}

// Virtual time: nothing happens until advance(toMs) is called; callbacks run in time order.
export function virtualClock(start = 0) {
  let t = start, seq = 0;
  const q = [];
  return {
    now: () => t,
    at(ms, fn) { const e = { ms, seq: seq++, fn, dead: false }; q.push(e); return () => { e.dead = true; }; },
    advance(to) {
      for (;;) {
        let best = null;
        for (const e of q) if (!e.dead && e.ms <= to && (!best || e.ms < best.ms || (e.ms === best.ms && e.seq < best.seq))) best = e;
        if (!best) break;
        q.splice(q.indexOf(best), 1);
        t = Math.max(t, best.ms); best.fn();
      }
      t = Math.max(t, to);
      for (let i = q.length - 1; i >= 0; i--) if (q[i].dead) q.splice(i, 1);
    },
  };
}
