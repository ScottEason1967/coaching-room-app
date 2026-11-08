// App shell: navigation, team switcher, router, sync status.
import * as S from './store.js';
import * as cloud from './cloud.js';
import { $, esc, icon, sheet, closeSheet, toast, autosize, avatar, teamBadge } from './util.js';

import home from './views/home.js';
import model, { principleView } from './views/model.js';
import board, { boardList } from './views/board.js';
import plans from './views/plans.js';
import drill from './views/drill.js';
import session from './views/session.js';
import match from './views/match.js';
import review from './views/review.js';
import squad, { playerView } from './views/squad.js';
import more, { pathwayView, logbookView, teamsView, teamView, cloudView } from './views/more.js';
import blockView from './views/block.js';
import { resetDock, focusField } from './challenges.js';
import { helpFor, openHelp } from './help.js';

const ROUTES = {
  home: { v: home, nav: 'home' },
  model: { v: model, nav: 'model' }, principle: { v: principleView, nav: 'model', detail: true },
  boards: { v: boardList, nav: 'board' }, board: { v: board, nav: 'board', detail: true },
  plans: { v: plans, nav: 'plans' },
  drill: { v: drill, nav: 'plans', detail: true }, session: { v: session, nav: 'plans', detail: true },
  match: { v: match, nav: 'plans', detail: true }, review: { v: review, nav: 'plans', detail: true },
  block: { v: blockView, nav: 'plans', detail: true },
  squad: { v: squad, nav: 'squad' }, player: { v: playerView, nav: 'squad', detail: true },
  more: { v: more, nav: 'more' }, pathway: { v: pathwayView, nav: 'pathway', detail: true },
  logbook: { v: logbookView, nav: 'logbook', detail: true }, teams: { v: teamsView, nav: 'more', detail: true },
  team: { v: teamView, nav: 'more', detail: true }, cloud: { v: cloudView, nav: 'more', detail: true }
};
const NAV = [['home', 'Home', 'home', '#/home'], ['model', 'Model', 'model', '#/model'], ['board', 'Board', 'board', '#/boards'], ['plans', 'Plans', 'plans', '#/plans'], ['squad', 'Squad', 'squad', '#/squad']];
const SIDE_EXTRA = [['pathway', 'Pathway', 'ladder', '#/pathway'], ['logbook', 'Logbook', 'book', '#/logbook'], ['more', 'More', 'cog', '#/more']];

let current = { name: '', params: [] }, top = {}, pendingRefresh = false, pointerDown = false, cleanup = null;

function parse() {
  const h = location.hash.replace(/^#\/?/, '');
  const [name, ...params] = h.split('/').map(decodeURIComponent);
  return { name: ROUTES[name] ? name : 'home', params };
}

export const ctx = {
  setTop(o) { top = o || {}; renderTop(); },
  refresh() { route(true); },
  go(h) { if (location.hash === h) route(); else location.hash = h; }
};

function route(keepScroll) {
  if (!started) return;   // behind the sign-in screen: render nothing
  if (!S.team() && !['teams', 'team', 'cloud', 'more'].includes(parse().name)) {
    location.hash = '#/teams'; return;
  }
  const r = parse(); const R = ROUTES[r.name];
  const same = r.name === current.name && r.params.join('/') === current.params.join('/');
  current = r; top = { detail: !!R.detail };
  if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
  if (!same) resetDock(); else { const d = document.getElementById('chalDock'); if (d) { d.hidden = true; } }
  // Fresh container every time, so no click handlers survive from the last screen.
  const old = $('#view'); const y = window.scrollY;
  old.style.minHeight = old.offsetHeight + 'px';
  const el = old.cloneNode(false); el.style.minHeight = old.style.minHeight; old.replaceWith(el);
  try { cleanup = R.v(el, r.params, ctx) || null; }
  catch (e) { console.error(e); el.innerHTML = `<div class="card"><div class="h2">Something went wrong</div><p class="muted">${esc(e.message)}</p><a class="btn" href="#/home">Go home</a></div>`; }
  renderNav(R.nav); renderTop(); requestAnimationFrame(() => autosize(el));
  if (keepScroll && same) window.scrollTo(0, y); else window.scrollTo(0, 0);
  requestAnimationFrame(() => { el.style.minHeight = ''; });
}

function renderNav(on) {
  $('#bottomnav').innerHTML = NAV.map(([k, lab, ic, href]) => `<a href="${href}" class="${on === k ? 'on' : ''}" ${on === k ? 'aria-current="page"' : ''}>${icon(ic)}<span>${lab}</span></a>`).join('');
  const t = S.team(); const c = S.coach();
  $('#sidebar').innerHTML = `<div class="brand">${ringMini()}<span>Coaching Room</span></div>
    <button class="item" data-act="team" style="margin:0 0 10px;min-height:52px">${teamBadge(t, 32, 15)}<span class="grow"><span class="t" style="display:block;font-size:13.5px">${esc(t?.name || 'No team')}</span><span class="s">${esc(t?.season || '')} · switch</span></span>${icon('down', 'style="width:16px;height:16px;color:var(--muted)"')}</button>
    ${NAV.concat(SIDE_EXTRA).map(([k, lab, ic, href]) => `<a class="nav ${on === k ? 'on' : ''}" href="${href}">${icon(ic)}<span>${lab}</span></a>`).join('')}
    <div style="flex:1"></div>
    <a class="nav" href="#/cloud" id="sideSync">${syncDot()}<span>${syncLabel()}</span></a>
    <div class="tiny muted" style="padding:6px 12px">${esc(c.name || '')}</div>`;
  $('#sidebar').querySelector('[data-act="team"]').onclick = teamSwitcher;
}

function renderTop() {
  const t = S.team(); const c = S.coach(); const tb = $('#topbar');
  const left = top.back
    ? `<a class="btn icon" href="${top.back}" aria-label="Back" style="border:0;background:rgba(255,255,255,.05)">${icon('back')}</a><div class="grow" style="min-width:0"><div class="h2" style="font-size:21px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(top.title || '')}</div>${top.sub ? `<div class="tiny muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(top.sub)}</div>` : ''}</div>`
    : `<button class="team-switch" data-act="team">
        ${teamBadge(t, 34, 17)}
        <span style="display:flex;flex-direction:column;align-items:flex-start;line-height:1.15;min-width:0"><span style="font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%">${esc(t?.name || 'Add a team')}</span><span class="tiny muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%">${esc(t?.season || '')}${t?.season ? ' · ' : ''}switch team</span></span>${icon('down', 'style="width:16px;height:16px;color:var(--muted);flex:none"')}</button><div class="grow"></div>`;
  const help = helpFor(current.name, current.params) ? `<button type="button" class="btn icon" data-act="help" aria-label="How to use this screen" title="How to use this screen" style="background:var(--surface2);font-family:var(--display);font-weight:700;font-size:20px">?</button>` : '';
  tb.innerHTML = `${left}<div class="row nowrap" style="gap:8px">${top.actions || ''}${help}<a href="#/cloud" class="btn icon" aria-label="Sync: ${esc(syncLabel())}" title="${esc(syncLabel())}" style="border:0;width:36px">${syncDot()}</a><a href="#/more" class="btn icon" aria-label="Your profile, pathway and settings" style="background:var(--surface2);font-family:var(--display);font-weight:700;font-size:16px;letter-spacing:.04em;${c.photo ? 'padding:0;overflow:hidden' : ''}">${avatar(c.photo, 40, esc(c.initials || 'JE'))}</a></div>`;
  const b = tb.querySelector('[data-act="team"]'); if (b) b.onclick = teamSwitcher;
  const hb = tb.querySelector('[data-act="help"]');
  if (hb) hb.onclick = () => openHelp(current.name, current.params, { goTab: (tab, show) => { S.setMeta('matchTab', tab); ctx.refresh(); setTimeout(() => focusField(show, document), 60); } });
  if (top.onActions) top.onActions(tb);
}

function syncLabel() {
  const s = cloud.status();
  return { off: 'This device only', signedout: 'Not signed in', syncing: 'Syncing…', ok: 'Synced', error: 'Sync problem', offline: 'Offline' }[s.state] || s.state;
}
function syncDot() {
  const s = cloud.status().state;
  const col = { ok: 'var(--good)', syncing: 'var(--lamp)', error: 'var(--bad)', offline: 'var(--muted)', signedout: 'var(--lamp)', off: 'var(--muted)' }[s] || 'var(--muted)';
  return `<span style="width:10px;height:10px;border-radius:50%;background:${col};display:inline-block;box-shadow:0 0 0 3px color-mix(in srgb,${col} 25%,transparent)"></span>`;
}
function ringMini() {
  return `<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><g fill="none" stroke-width="3.2" stroke-linecap="round">${[0, 1, 2, 3].map(i => `<circle cx="13" cy="13" r="9.5" stroke="${i === 1 ? 'var(--accent)' : i === 0 ? 'color-mix(in srgb,var(--accent) 50%,transparent)' : 'rgba(255,255,255,.18)'}" stroke-dasharray="12.5 47.2" transform="rotate(${-86 + i * 90} 13 13)"/>`).join('')}</g></svg>`;
}

export function teamSwitcher() {
  const ts = S.teams(); const cur = S.team();
  const el = sheet(`<div class="stack"><div class="h2">Your teams</div>
    <div class="list">${ts.map(t => `<button class="item ${cur && t.id === cur.id ? 'on' : ''}" data-t="${t.id}">${teamBadge(t, 40, 18)}<span class="grow"><span class="t" style="display:block">${esc(t.name)}</span><span class="s">${esc([t.season, t.archived ? 'archived' : ''].filter(Boolean).join(' · '))}</span></span>${cur && t.id === cur.id ? icon('check', 'style="width:20px;height:20px;color:var(--accent)"') : ''}</button>`).join('')}</div>
    <div class="row"><a class="btn pri" href="#/team/new">${icon('plus')}Add a team</a><a class="btn" href="#/teams">Manage teams</a></div>
    <p class="tiny muted" style="margin:0">Each team has its own squad, game model, boards, sessions and matches. Your drill library and pathway come with you.</p></div>`);
  el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { S.setTeam(b.dataset.t); closeSheet(); if (top.detail) location.hash = '#/home'; else route(); toast('Switched to ' + S.team().name); });
  el.querySelectorAll('a').forEach(a => a.addEventListener('click', () => closeSheet()));
}

/* ---------- Refresh after remote changes, without wiping what Joe is typing ---------- */
function safeRefresh() {
  const a = document.activeElement;
  const typing = a && $('#view').contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName);
  if (typing || pointerDown || $('#scrim')) { pendingRefresh = true; return; }
  pendingRefresh = false; route(true);
}
document.addEventListener('pointerdown', () => pointerDown = true, true);
document.addEventListener('pointerup', () => { pointerDown = false; if (pendingRefresh) setTimeout(safeRefresh, 200); }, true);
document.addEventListener('focusout', () => { if (pendingRefresh) setTimeout(safeRefresh, 200); });

/* ---------- Sign-in screen ----------
   With cloud sync set up, nothing in the app shows until someone is signed in. Before this, the app
   opened signed out, showed everything, and took edits that never reached the cloud. */
let started = false;
function hideApp(on) {
  ['app', 'bottomnav', 'chalDock'].forEach(id => { const e = document.getElementById(id); if (e) e.style.display = on ? 'none' : ''; });
  if (on) { closeSheet(); const v = $('#view'); if (v) v.innerHTML = ''; }
}
function gate(mode = 'signin', note = '') {
  window.__crStarted = true;
  started = false; hideApp(true);
  let g = document.getElementById('gate');
  if (!g) { g = document.createElement('div'); g.id = 'gate'; document.body.appendChild(g); }
  const ring = `<svg width="56" height="56" viewBox="0 0 26 26" aria-hidden="true"><g fill="none" stroke-width="3.2" stroke-linecap="round">${[0, 1, 2, 3].map(i => `<circle cx="13" cy="13" r="9.5" stroke="${i === 1 ? 'var(--accent)' : i === 0 ? 'color-mix(in srgb,var(--accent) 50%,transparent)' : 'rgba(255,255,255,.18)'}" stroke-dasharray="12.5 47.2" transform="rotate(${-86 + i * 90} 13 13)"/>`).join('')}</g></svg>`;
  const off = !navigator.onLine;
  g.innerHTML = `<div class="gatebox stack">
    <div style="text-align:center">${ring}<div class="display" style="font-size:26px;letter-spacing:.05em;margin-top:6px">The Coaching Room</div></div>
    ${mode === 'reset' ? `<div class="h2" style="text-align:center">Set a new password</div>
      <form id="gF" class="stack" autocomplete="on">
        <label class="field"><span>New password (8 or more characters)</span><input type="password" id="gP" autocomplete="new-password" required minlength="8"></label>
        <button class="btn pri block" type="submit">Save password</button>
      </form>` : `<p class="small muted" style="margin:0;text-align:center">Sign in to open your coaching. Everything you do is saved to your account, so it is the same on your phone, iPad and laptop.</p>
      <form id="gF" class="stack" autocomplete="on">
        <label class="field"><span>Email</span><input type="email" id="cE" autocomplete="username" inputmode="email" required></label>
        <label class="field"><span>Password</span><input type="password" id="cP" autocomplete="current-password" required></label>
        <button class="btn pri block" type="submit" id="cIn">Sign in</button>
        <button class="btn sm" type="button" id="cFg" style="align-self:center">Forgot password</button>
      </form>`}
    <div class="small" id="gM" role="status" style="min-height:20px;text-align:center;color:var(--lamp-text)">${esc(off ? 'You’re offline. Connect to the internet to sign in.' : note)}</div>
  </div>`;
  const msg = t => { g.querySelector('#gM').textContent = t; };
  const f = g.querySelector('#gF');
  f.onsubmit = async e => {
    e.preventDefault();
    if (!navigator.onLine) return msg('You’re offline. Connect to the internet to sign in.');
    if (mode === 'reset') {
      const pw = g.querySelector('#gP').value; if (pw.length < 8) return msg('Use at least 8 characters.');
      msg('Saving…'); try { await cloud.setPassword(pw); toast('Password changed'); start(); } catch (er) { msg(er.message); }
      return;
    }
    msg('Signing in…');
    try { await cloud.signIn(g.querySelector('#cE').value, g.querySelector('#cP').value); start(); }
    catch (er) { msg(/invalid/i.test(er.message) ? 'That email and password don’t match. Check them, or tap Forgot password.' : er.message); }
  };
  g.querySelector('#cFg')?.addEventListener('click', async () => {
    const em = g.querySelector('#cE').value.trim(); if (!em) return msg('Type your email first, then tap Forgot password.');
    try { await cloud.resetPassword(em); msg('Check your email for a link to set a new password.'); } catch (er) { msg(er.message); }
  });
  setTimeout(() => g.querySelector('input')?.focus(), 50);
}
function start() {
  window.__crStarted = true;
  document.getElementById('gate')?.remove();
  hideApp(false);
  if (started) return; started = true;
  if (!location.hash || /access_token|type=recovery|error_description/.test(location.hash)) location.replace('#/home');
  route();
}

/* ---------- Boot ---------- */
async function boot() {
  const recovering = /type=recovery/.test(location.hash);   // opened from a password-reset email
  S.load(); S.coach();
  window.addEventListener('hashchange', () => { closeSheet(); route(); });
  S.onChange(src => {
    if (src === 'remote') safeRefresh();
    if (src === 'savefail') toast('This device is out of storage space. Export a backup from More.', 5000);
    if (src === 'conflict') toast('A newer edit from another device replaced an unsent edit made here. What you wrote is kept under More > Cloud sync.', 7000);
  });
  cloud.onStatus(() => { const s = $('#topbar'); if (s) renderTop(); const sd = $('#sideSync'); if (sd) sd.innerHTML = `${syncDot()}<span>${syncLabel()}</span>`; });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('sw', e));
  }
  if (!cloud.configured()) { start(); cloud.init(); return; }   // no cloud set up: one device, no account
  cloud.onAuth((ev, u) => {
    if (ev === 'PASSWORD_RECOVERY') return gate('reset');
    if (!u && ev === 'SIGNED_OUT') return gate('signin', 'You’re signed out.');
    if (u && !started && !document.getElementById('gP')) start();
  });
  await cloud.init();
  if (recovering && cloud.signedIn()) return gate('reset');
  if (document.getElementById('gP')) return;
  if (cloud.signedIn() || cloud.savedSession()) start();
  else gate();
}
boot();
