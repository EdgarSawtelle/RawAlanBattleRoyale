// ============================================================================
//  lobby.js - the first screen: create a room, join a room (code or invite link), or practise.
//  Plain DOM drawn in the game's pixel style (pixel-font headings, same palette as the HUD).
//  It only talks to the rest of the game through the handlers passed to createLobby().
// ============================================================================
import { CONFIG } from '../config.js';
import { pxSVG } from './px.js';
import { normaliseCode, cleanName } from '../net/room-code.js';

const NAME_KEY = 'rab-name';
function storedName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; } }
function storeName(n) { try { localStorage.setItem(NAME_KEY, n); } catch (e) { /* private window: fine */ } }

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* fall through */ }
  try {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;left:-999px'; document.body.appendChild(ta);
    ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch (e) { return false; }
}

// handlers: { onPractice(), onCreate(name), onJoin(code, name), onCancel() }
export function createLobby(root, handlers) {
  let name = storedName();
  let view = { kind: 'menu', code: '', invite: '', error: '', status: '' };

  const row = (k, a) => `<span class="k">${pxSVG(k, 2)}</span><span class="a">${pxSVG(a, 2)}</span>`;
  const title = `<div class="ov-title">${pxSVG('RAW ALAN', 7, '#0e0d0c')}${pxSVG('BATTLE ROYALE', 4, '#0e0d0c')}</div>`;
  const controls = `<div class="lb-controls">${row('A / D', 'MOVE')}${row('W / SPACE', 'JUMP, CLIMB WALLS')}${row('MOUSE', 'AIM')}${row('LEFT CLICK', 'SHOOT')}${row('RIGHT CLICK', 'BLOCK')}${row('1-4 / CLICK', 'ANSWER THE QUIZ')}</div>`;

  function msg() {
    const e = view.error ? `<div class="lb-msg lb-err">${esc(view.error)}</div>` : '';
    const s = view.status ? `<div class="lb-msg lb-info">${esc(view.status)}</div>` : '';
    return e + s;
  }
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function render() {
    let body = '';
    if (view.kind === 'menu') {
      body = `
        <div class="lb-field"><label for="lb-name">${pxSVG('YOUR NAME', 2)}</label><input id="lb-name" maxlength="${CONFIG.net.maxNameLength}" placeholder="EMBER" value="${esc(name)}" autocomplete="off" spellcheck="false"></div>
        <div class="lb-cols">
          <div class="lb-col"><div class="lb-h">${pxSVG('HOST A GAME', 2)}</div><button class="lb-btn lb-go" id="lb-create">${pxSVG('CREATE ROOM', 3)}</button><div class="lb-small">You get a short code to give your friend.</div></div>
          <div class="lb-col"><div class="lb-h">${pxSVG('JOIN A FRIEND', 2)}</div><input id="lb-code" class="lb-code-in" maxlength="9" placeholder="ROOM CODE" autocomplete="off" spellcheck="false"><button class="lb-btn" id="lb-join">${pxSVG('JOIN ROOM', 3)}</button></div>
        </div>
        <button class="lb-btn lb-dim" id="lb-practice">${pxSVG('PRACTICE VS DUMMY', 2)}</button>
        ${msg()}${controls}`;
    } else if (view.kind === 'creating') {
      body = `<div class="lb-h">${pxSVG('OPENING ROOM...', 3)}</div>${msg()}<button class="lb-btn lb-dim" id="lb-cancel">${pxSVG('CANCEL', 2)}</button>`;
    } else if (view.kind === 'waiting') {
      body = `
        <div class="lb-h">${pxSVG('ROOM CODE', 2)}</div>
        <div class="lb-code">${pxSVG(view.code, 8)}</div>
        <div class="lb-btns"><button class="lb-btn" id="lb-copycode">${pxSVG('COPY CODE', 2)}</button><button class="lb-btn" id="lb-copylink">${pxSVG('COPY INVITE LINK', 2)}</button></div>
        <div class="lb-link">${esc(view.invite)}</div>
        <div class="lb-wait">${pxSVG('WAITING FOR OPPONENT', 3)}<span class="lb-dots"></span></div>
        <div class="lb-small">Send the code or the link to your friend. Keep this tab open and visible.</div>
        ${msg()}<button class="lb-btn lb-dim" id="lb-cancel">${pxSVG('CANCEL', 2)}</button>`;
    } else if (view.kind === 'joining') {
      body = `<div class="lb-h">${pxSVG('JOINING ' + view.code, 3)}</div><div class="lb-wait">${pxSVG('CONNECTING', 3)}<span class="lb-dots"></span></div>${msg()}<button class="lb-btn lb-dim" id="lb-cancel">${pxSVG('CANCEL', 2)}</button>`;
    }
    root.innerHTML = `<div class="ov-box lb-box">${title}${body}</div>`;
    bind();
  }

  function bind() {
    const $ = (id) => root.querySelector('#' + id);
    const nm = () => { const el = $('lb-name'); name = cleanName(el ? el.value : name, ''); storeName(name); return name; };
    if ($('lb-create')) $('lb-create').onclick = () => handlers.onCreate(nm());
    if ($('lb-practice')) $('lb-practice').onclick = () => handlers.onPractice();
    if ($('lb-join')) {
      const go = () => { const c = normaliseCode($('lb-code').value); if (c.length !== CONFIG.net.codeLength) { view.error = 'Type the ' + CONFIG.net.codeLength + '-character room code your friend gave you.'; render(); return; } handlers.onJoin(c, nm()); };
      $('lb-join').onclick = go;
      $('lb-code').onkeydown = (e) => { if (e.key === 'Enter') go(); };
      $('lb-code').oninput = (e) => { e.target.value = e.target.value.toUpperCase(); };
      if (view.focusCode) { $('lb-code').focus(); }
    }
    if ($('lb-name')) $('lb-name').onkeydown = (e) => { if (e.key === 'Enter') handlers.onCreate(nm()); };
    if ($('lb-cancel')) $('lb-cancel').onclick = () => handlers.onCancel();
    if ($('lb-copycode')) $('lb-copycode').onclick = async (e) => { const ok = await copyText(view.code); flash(e.currentTarget, ok ? 'COPIED!' : 'COPY FAILED'); };
    if ($('lb-copylink')) $('lb-copylink').onclick = async (e) => { const ok = await copyText(view.invite); flash(e.currentTarget, ok ? 'LINK COPIED!' : 'COPY FAILED'); };
  }
  function flash(btn, text) { const old = btn.innerHTML; btn.innerHTML = pxSVG(text, 2); setTimeout(() => { btn.innerHTML = old; }, 1400); }

  const api = {
    get name() { return cleanName(name, ''); },
    show() { root.hidden = false; },
    hide() { root.hidden = true; },
    get visible() { return !root.hidden; },
    showMenu(error = '', status = '') { view = { kind: 'menu', code: '', invite: '', error, status }; render(); root.hidden = false; },
    showCreating() { view = { kind: 'creating', error: '', status: '' }; render(); },
    showWaiting(code, invite) { view = { kind: 'waiting', code, invite, error: '', status: '' }; render(); },
    showJoining(code, status = '') { view = { kind: 'joining', code, error: '', status }; render(); },
    setStatus(text) { view.status = text; const el = root.querySelector('.lb-info'); if (el) el.textContent = text; else render(); },
    prefillCode(code) { const el = root.querySelector('#lb-code'); if (el) el.value = code; },
  };
  render();
  return api;
}
