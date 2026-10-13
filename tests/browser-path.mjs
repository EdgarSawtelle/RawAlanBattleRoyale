// Finds a Chromium-based browser for the headless browser tests (Edge or Chrome on Windows / macOS / Linux).
// Set EDGE=/path/to/browser to choose one yourself.
import fs from 'node:fs';

export function findBrowser() {
  if (process.env.EDGE) return process.env.EDGE;
  const pf = process.env['ProgramFiles'] || 'C:\\Program Files', pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const list = [
    pf86 + '\\Microsoft\\Edge\\Application\\msedge.exe', pf + '\\Microsoft\\Edge\\Application\\msedge.exe',
    pf + '\\Google\\Chrome\\Application\\chrome.exe', pf86 + '\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/microsoft-edge', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ];
  const hit = list.find((p) => fs.existsSync(p));
  if (!hit) throw new Error('No Edge / Chrome found. Set the EDGE environment variable to the browser executable.');
  return hit;
}
