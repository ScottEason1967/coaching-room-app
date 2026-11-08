// Cloud sync and shared links (Supabase). Everything here is optional:
// with no config the app runs on one device and the share buttons explain why.
import cfg from './config.js';
import * as store from './store.js';
import { debounce } from './util.js';

let sb = null, user = null, busy = false, again = false;
const st = { state: 'off', last: null, err: '' };
const subs = new Set(), authSubs = new Set();
export const onAuth = fn => authSubs.add(fn);
export const onStatus = fn => subs.add(fn);
const emit = () => subs.forEach(f => { try { f(st); } catch (e) {} });
export const status = () => st;
export const configured = () => !!(cfg.url && cfg.anonKey);
export const signedIn = () => !!user;
export const email = () => user ? user.email : '';
export const client = () => sb;

function set(state, err = '') { st.state = state; st.err = err; emit(); }

export async function init() {
  if (!configured()) return set('off');
  if (!window.supabase) return set('error', 'Sync library did not load');
  sb = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'coachingroom.auth' } });
  try { const { data } = await sb.auth.getSession(); user = data.session ? data.session.user : null; } catch (e) { user = null; }
  sb.auth.onAuthStateChange((ev, session) => {
    const was = user && user.id; user = session ? session.user : null;
    authSubs.forEach(f => { try { f(ev, user); } catch (e) { console.error(e); } });
    if (!user) set('signedout'); else if (user.id !== was) sync();
  });
  st.last = store.meta().lastSync || null;
  // These must be wired up whether or not Joe is signed in yet. Before this moved, a device that
  // signed in after the app loaded never pushed its edits until the app was killed and reopened.
  setInterval(() => sync(), 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
  window.addEventListener('online', () => sync());
  window.addEventListener('focus', () => sync());
  store.onChange(src => { if (src === 'local') pushSoon(); });
  if (!user) return set('signedout');
  set(navigator.onLine ? 'ok' : 'offline');
  sync();
}
const pushSoon = debounce(() => sync({ pushOnly: true }), 1500);
// Records this device pushed, so the pull that follows can measure this device's clock against the server's.
const pushed = new Map();

export async function signIn(em, pw) {
  const { error } = await sb.auth.signInWithPassword({ email: em.trim(), password: pw });
  if (error) throw error;
}
export async function signUp(em, pw) {
  const { data, error } = await sb.auth.signUp({ email: em.trim(), password: pw, options: { emailRedirectTo: location.href.split('#')[0] } });
  if (error) throw error;
  return !!data.session; // false means "check your email to confirm"
}
export async function resetPassword(em) {
  const { error } = await sb.auth.resetPasswordForEmail(em.trim(), { redirectTo: location.href.split('#')[0] });
  if (error) throw error;
}
export async function signOut() { await sb.auth.signOut(); user = null; set('signedout'); authSubs.forEach(f => { try { f('SIGNED_OUT', null); } catch (e) {} }); }
export async function setPassword(pw) {
  const { error } = await sb.auth.updateUser({ password: pw });
  if (error) throw error;
}
// A session is saved on this device but could not be checked (usually: no signal at the ground, and
// the hour-long access token has run out). Let the app open; sync resumes when the token refreshes.
// If the session turns out to be dead, Supabase clears it and signs out, and the sign-in screen shows.
export function savedSession() { try { return !!localStorage.getItem('coachingroom.auth'); } catch (e) { return false; } }

export async function sync({ pushOnly } = {}) {
  if (!sb || !user) return;
  if (busy) { again = true; return; }
  if (!navigator.onLine) return set('offline');
  busy = true; set('syncing');
  try {
    // A different account signed in on this device: the data here belongs to the last account and
    // must not be pushed into this one. Clear it, then pull this account's data.
    const m = store.meta();
    if (m.syncUser && m.syncUser !== user.id) { store.resetLocal(); store.setMeta('syncUser', user.id); store.setMeta('cursor', null); store.setMeta('photoCursor', null); }
    await push();
    if (!pushOnly) await pull();
    st.last = new Date().toISOString(); store.setMeta('lastSync', st.last);
    set('ok');
  } catch (e) {
    console.warn('sync', e);
    set(navigator.onLine ? 'error' : 'offline', e.message || String(e));
  } finally {
    busy = false;
    if (again) { again = false; setTimeout(() => sync(), 300); }
  }
}

async function push() {
  const recs = store.dirtyRecs(); if (!recs.length) return;
  for (let i = 0; i < recs.length; i += 200) {
    const chunk = recs.slice(i, i + 200);
    const rows = chunk.map(r => ({ owner: user.id, ...store.toRow(r) }));
    const t = Date.now();
    // Ask for the rows back: the database's last-edit-wins trigger drops any row that is older than
    // what it already holds, and a dropped row is not returned. That is how we know an edit lost.
    const { data, error } = await sb.from('items').upsert(rows, { onConflict: 'owner,id' }).select('id,updated_at');
    if (error) throw error;
    if (Array.isArray(data)) {
      const ok = new Set(data.map(r => r.id + '|' + new Date(r.updated_at).toISOString()));
      chunk.filter(r => !ok.has(r.id + '|' + r.upd)).forEach(r => store.noteRejected(r));
    }
    chunk.forEach(r => pushed.set(r.id, { upd: r.upd, t }));
    store.clearDirty(chunk.map(r => ({ id: r.id, upd: r.upd })));
  }
}

// Rows this device just pushed come straight back in the next pull with the server's own
// timestamp. If that is minutes away from when this device sent them, this device's clock is
// wrong, and with last-edit-wins a wrong clock silently beats (or loses to) every other device.
function checkClock(rows) {
  let skew = null;
  rows.forEach(row => {
    const p = pushed.get(row.id); if (!p) return;
    if (new Date(row.updated_at).toISOString() === p.upd) skew = new Date(row.synced_at).getTime() - p.t;
    pushed.delete(row.id);
  });
  if (skew == null) return;
  const bad = Math.abs(skew) > 120000;
  if (bad !== !!st.clockSkew || bad) { st.clockSkew = bad ? skew : 0; store.setMeta('clockSkew', st.clockSkew); emit(); }
}
export const clockSkewText = () => {
  const s = st.clockSkew || store.meta().clockSkew || 0; if (!s) return '';
  const m = Math.round(Math.abs(s) / 60000);
  return `This device’s clock is about ${m >= 120 ? Math.round(m / 60) + ' hours' : m + ' minutes'} ${s < 0 ? 'ahead of' : 'behind'} the server. Fix the date and time in the device settings: with a wrong clock, edits made here can silently overwrite newer edits from your other devices (or be overwritten by older ones).`;
};

async function pull() {
  const m = store.meta();
  // Different account on this device from last time: start the cursor again.
  if (m.syncUser !== user.id) { store.setMeta('syncUser', user.id); store.setMeta('cursor', null); }
  let cursor = store.meta().cursor;
  // Overlap by 30 seconds so a slow write from another device is never missed.
  if (cursor) cursor = new Date(new Date(cursor).getTime() - 30000).toISOString();
  for (let guard = 0; guard < 50; guard++) {
    let q = sb.from('items').select('id,kind,team_id,data,updated_at,deleted,synced_at').order('synced_at', { ascending: true }).limit(500);
    if (cursor) q = q.gt('synced_at', cursor);
    const { data, error } = await q; if (error) throw error;
    if (!data.length) break;
    checkClock(data);
    store.applyRemote(data);
    cursor = data[data.length - 1].synced_at;
    store.setMeta('cursor', cursor);
    if (data.length < 500) break;
  }
  await pullPhotos();
}

// Players add or remove their own photo from their player page. The photo lives on the link, not in
// the player record, so nothing Joe edits can overwrite it, and deleting the link takes it away.
async function pullPhotos() {
  let q = sb.from('shares').select('ref_id,photo,photo_at').eq('kind', 'player').not('photo_at', 'is', null).order('photo_at', { ascending: true }).limit(500);
  let since = store.meta().photoCursor;
  if (since) { since = new Date(new Date(since).getTime() - 30000).toISOString(); q = q.gt('photo_at', since); }
  const { data, error } = await q;
  if (error) { console.warn('photos', error.message); return; }   // the photo columns are missing until the updated schema.sql is run
  if (!data || !data.length) return;
  store.setPhotos(data.map(r => [r.ref_id, r.photo || null]));
  store.setMeta('photoCursor', data[data.length - 1].photo_at);
}
export async function removePlayerPhoto(token) {
  needCloud();
  const { error } = await sb.from('shares').update({ photo: null }).eq('token', token);   // the database stamps photo_at
  if (error) throw error;
}

/* ---------- Shared links ---------- */
export function shareUrl(tok) { return new URL('view.html#' + tok, location.href.split('#')[0]).href; }
function needCloud() {
  if (!configured()) throw new Error('Links need cloud sync switched on first (your profile picture > Cloud sync).');
  if (!user) throw new Error('Sign in first (your profile picture > Cloud sync) to create links.');
  if (!navigator.onLine) throw new Error('You’re offline. Links update when you’re back online.');
}
export async function saveShare({ token, kind, refId, title, data, pin, enabled = true }) {
  needCloud();
  const { error } = await sb.rpc('save_share', { p_token: token, p_kind: kind, p_ref: refId, p_title: title, p_data: data, p_pin: pin || null, p_enabled: enabled });
  if (error) throw error;
}
export async function setShareEnabled(token, enabled) {
  needCloud();
  const { error } = await sb.from('shares').update({ enabled }).eq('token', token);
  if (error) throw error;
}
export async function deleteShare(token) {
  needCloud();
  const { error } = await sb.from('shares').delete().eq('token', token);
  if (error) throw error;
}
export async function shareInfo(token) {
  if (!sb || !user || !navigator.onLine) return null;
  const { data, error } = await sb.from('shares').select('token,enabled,updated_at,comments').eq('token', token).maybeSingle();
  if (error) return null;
  return data;
}
