// A steady timer for the host (and for the client's input sending): a Web Worker heartbeat, with a
// plain setInterval fallback if workers are unavailable (file:// pages, very old browsers, Node).
export class TickTimer {
  constructor(fn) {
    this.fn = fn; this.worker = null; this.interval = null; this.usingWorker = false;
  }
  start() {
    if (this.worker || this.interval) return;
    try {
      this.worker = new Worker(new URL('./tick-worker.js', import.meta.url));   // relative to this file: works under any sub-path
      this.worker.onmessage = () => this.fn();
      this.worker.onerror = () => { this._fallback(); };
      this.worker.postMessage('start'); this.usingWorker = true;
    } catch (e) { this._fallback(); }
  }
  _fallback() {
    if (this.worker) { try { this.worker.terminate(); } catch (e) { /* ignore */ } this.worker = null; }
    this.usingWorker = false;
    if (!this.interval) this.interval = setInterval(() => this.fn(), 8);
  }
  stop() {
    if (this.worker) { try { this.worker.postMessage('stop'); this.worker.terminate(); } catch (e) { /* ignore */ } this.worker = null; }
    if (this.interval) { clearInterval(this.interval); this.interval = null; }
  }
}
