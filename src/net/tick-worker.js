// Runs inside a Web Worker: a steady heartbeat that is NOT throttled when the tab is in the background
// (browsers slow main-thread timers in hidden tabs to ~1 Hz, which would freeze a hosted match).
let id = null;
self.onmessage = (e) => {
  if (e.data === 'start') { if (id === null) id = setInterval(() => self.postMessage(0), 8); }
  else if (e.data === 'stop') { clearInterval(id); id = null; }
};
