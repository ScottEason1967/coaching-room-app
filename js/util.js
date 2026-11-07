// Small shared helpers: escaping, ids, dates, icons, toast, sheets.

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export const nl2br = v => esc(v).replace(/\n/g, '<br>');

export function uid() {
  const a = new Uint8Array(6); crypto.getRandomValues(a);
  return Date.now().toString(36) + [...a].map(b => (b % 36).toString(36)).join('');
}
export function token(len = 22) {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const a = new Uint8Array(len); crypto.getRandomValues(a);
  return [...a].map(b => abc[b % abc.length]).join('');
}
export function pin4() {
  const a = new Uint32Array(1); crypto.getRandomValues(a);
  return String(a[0] % 10000).padStart(4, '0');
}

export function today() {
  const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
export function addDays(iso, n) {
  const d = new Date(iso + 'T12:00'); d.setDate(d.getDate() + n);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10);
}
export const fmtD = d => d ? new Date(d + 'T12:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Date not set';
export const fmtDY = d => d ? new Date(d + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date not set';
export function fmtAgo(iso) {
  if (!iso) return 'never';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 86400) return Math.round(s / 3600) + ' h ago';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
export const lines = t => String(t || '').split('\n').map(x => x.trim()).filter(Boolean);
export const clone = o => JSON.parse(JSON.stringify(o));

// Debounced saves that are still waiting when the app goes to the background are run at once.
// Without this, anything typed in the last few hundred milliseconds before the phone was locked
// was saved locally but never marked for sync (store.flush runs after, and only writes what it has).
const waiting = new Set();
export function debounce(fn, ms) {
  let t, pending = false, args = [];
  const f = (...a) => { args = a; pending = true; waiting.add(f); clearTimeout(t); t = setTimeout(() => { pending = false; waiting.delete(f); fn(...args); }, ms); };
  f.flush = () => { if (!pending) return; clearTimeout(t); pending = false; waiting.delete(f); fn(...args); };
  return f;
}
export function flushAll() { [...waiting].forEach(f => { try { f.flush(); } catch (e) { console.error(e); } }); }
window.addEventListener('pagehide', flushAll);
document.addEventListener('visibilitychange', () => { if (document.hidden) flushAll(); });

// Deep get/set by dotted path, used by data-f form binding.
export function getPath(o, p) { return p.split('.').reduce((a, k) => a == null ? a : a[k], o); }
export function setPath(o, p, v) {
  const ks = p.split('.'); let a = o;
  ks.slice(0, -1).forEach(k => { if (a[k] == null || typeof a[k] !== 'object') a[k] = {}; a = a[k]; });
  a[ks[ks.length - 1]] = v;
}

// Bind every [data-f] control inside root to rec. onChange runs after each edit.
export function bindFields(root, rec, onChange) {
  root.querySelectorAll('[data-f]').forEach(el => {
    const p = el.dataset.f; const v = getPath(rec, p);
    if (el.type === 'checkbox') el.checked = !!v;
    else if (v != null && document.activeElement !== el) el.value = v;
    const ev = (el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'date') ? 'change' : 'input';
    el.addEventListener(ev, () => {
      let val = el.type === 'checkbox' ? el.checked : el.value;
      if (el.type === 'number') val = el.value === '' ? '' : +el.value;
      setPath(rec, p, val); onChange && onChange(p, val, el);
    });
  });
}

// Event delegation for [data-act] buttons.
export function actions(root, map) {
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b || !root.contains(b)) return;
    const fn = map[b.dataset.act];
    if (fn) { e.preventDefault(); fn(b.dataset.arg, b, e); }
  });
}

/* ---------- Toast ---------- */
let toastT;
export function toast(msg, ms = 2400) {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), ms);
}

/* ---------- Bottom sheet / dialog ---------- */
export function sheet(html, { onClose, wide } = {}) {
  closeSheet();
  const s = document.createElement('div'); s.className = 'scrim'; s.id = 'scrim';
  s.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" ${wide ? 'style="max-width:900px"' : ''}>${html}</div>`;
  s.addEventListener('click', e => { if (e.target === s) closeSheet(); });
  s._onClose = onClose;
  document.body.appendChild(s);
  const f = s.querySelector('[autofocus]'); if (f) setTimeout(() => f.focus(), 50);
  return s.firstElementChild;
}
export function closeSheet() {
  const s = $('#scrim'); if (!s) return;
  const cb = s._onClose; s.remove(); cb && cb();
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

export function confirmSheet(title, body, okLabel = 'Delete', danger = true) {
  return new Promise(res => {
    const el = sheet(`<div class="stack"><div class="h2">${esc(title)}</div>${body ? `<p class="muted" style="margin:0">${esc(body)}</p>` : ''}
      <div class="row" style="justify-content:flex-end"><button class="btn" data-x="0">Cancel</button><button class="btn ${danger ? 'danger' : 'pri'}" data-x="1">${esc(okLabel)}</button></div></div>`,
      { onClose: () => res(false) });
    el.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { const v = b.dataset.x === '1'; const s = $('#scrim'); s._onClose = null; s.remove(); res(v); });
  });
}

/* ---------- Share / copy ---------- */
export async function shareText(title, text, url) {
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); return true; } catch (e) { if (e.name === 'AbortError') return false; }
  }
  try { await navigator.clipboard.writeText(text + (url ? '\n' + url : '')); toast('Copied. Paste it into WhatsApp or a text.'); return true; }
  catch (e) { toast('Could not copy on this device'); return false; }
}
export async function shareFile(blob, filename, title) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* ---------- Icons (24px stroke) ---------- */
const P = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  model: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  board: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/><circle cx="12" cy="12" r="3"/>',
  plans: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 10h6M9 14h6M9 18h3"/>',
  squad: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2c2.8.2 5 2.6 5 5.8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  share: '<path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 12v8h14v-8"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/>',
  play: '<path d="M7 5l12 7-12 7z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  cloud: '<path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19.6 10 4 4 0 0 1 18 18z"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
  ladder: '<path d="M7 3v18M17 3v18M7 7h10M7 12h10M7 17h10"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>',
  flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  whistle: '<circle cx="9" cy="14" r="5"/><path d="M13 11l8-4v4l-6 3"/><path d="M5 5l2 2"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  rotate: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>',
  dup: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V4h12"/>',
  up: '<path d="M18 15l-6-6-6 6"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  team: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/>',
  hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M11 10.5V4a1.5 1.5 0 0 1 3 0v6.5"/><path d="M14 10.5V5.5a1.5 1.5 0 0 1 3 0V14"/><path d="M8 13l-1.5-1.5a1.5 1.5 0 0 0-2.1 2.1L9 19a6 6 0 0 0 4.2 2H14a5 5 0 0 0 5-5v-4.5a1.5 1.5 0 0 0-2-1.4"/>'
};
export function icon(n, extra = '') {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${P[n] || ''}</svg>`;
}

// Text boxes grow to fit what's written in them.
export function fit(t) { if (!t.offsetParent) return; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight + 2, 640) + 'px'; }
export function autosize(root = document) { root.querySelectorAll('textarea').forEach(fit); }
document.addEventListener('input', e => { if (e.target.tagName === 'TEXTAREA') fit(e.target); });
document.addEventListener('toggle', e => { if (e.target.tagName === 'DETAILS') autosize(e.target); }, true);

export function emptyState(text, btn) {
  return `<div class="empty">${esc(text)}${btn ? `<div style="margin-top:12px">${btn}</div>` : ''}</div>`;
}
