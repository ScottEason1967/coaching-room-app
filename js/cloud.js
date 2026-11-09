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
// Wait for any sync under way, then run one to the end (used after joining a team).
export async function syncFully() { for (let i = 0; i < 150 && busy; i++) await new Promise(r => setTimeout(r, 100)); await sync(); for (let i = 0; i < 150 && (busy || again); i++) await new Promise(r => setTimeout(r, 100)); }
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
export async function signOut() { try { sb.removeAllChannels && sb.removeAllChannels(); } catch (e) {} live = null; presence = null; presenceTeam = null; here = {}; await sb.auth.signOut(); user = null; set('signedout'); authSubs.forEach(f => { try { f('SIGNED_OUT', null); } catch (e) {} }); }
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
    if (store.meta().seedsUp !== user.id) { store.markSeedsDirty(); store.setMeta('seedsUp', user.id); }
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

const COLS = 'id,kind,team_id,data,updated_at,deleted,synced_at';
async function push() {
  const recs = store.dirtyRecs(); if (!recs.length) return;
  for (let i = 0; i < recs.length; i += 200) {
    const chunk = recs.slice(i, i + 200);
    const t = Date.now();
    let back = await upsert(chunk);
    // One record the rules refuse (a viewer's edit, a team you were taken off) must not hold up the
    // rest: send them one at a time and keep each refused edit under Cloud sync.
    if (back.error && /row-level security|permission|42501/i.test(back.error.message + ' ' + (back.error.code || ''))) {
      const ok = [];
      for (const r of chunk) { const one = await upsert([r]); if (one.error) store.noteRejected(r); else ok.push(...(one.data || [])); }
      back = { data: ok, error: null };
    }
    if (back.error) throw back.error;
    chunk.forEach(r => pushed.set(r.id === 'coach' ? 'coach:' + user.id : r.id, { upd: r.upd, t }));
    // A field this device changed that someone else changed more recently: theirs is kept, and
    // what was written here is saved under Cloud sync rather than lost.
    const got = new Map((back.data || []).map(x => [x.id, x]));
    chunk.forEach(r => {
      const x = got.get(r.id === 'coach' ? 'coach:' + user.id : r.id); if (!x || !r._f) return;
      const f = (x.data && x.data._f) || {};
      if (store.pendOf(r.id).some(p => f[p] !== r._f[p])) store.noteRejected(r);
    });
    store.clearDirty(chunk.map(r => ({ id: r.id, upd: r.upd })));
    // What comes back is the merged record: other coaches' fields plus this device's.
    if (Array.isArray(back.data) && back.data.length) store.applyRemote(back.data, user.id);
  }
}
function upsert(recs) {
  const rows = recs.map(r => ({ owner: user.id, ...store.toRow(r, user.id) }));
  return sb.from('items').upsert(rows, { onConflict: 'id' }).select(COLS);
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
    let q = sb.from('items').select(COLS).order('synced_at', { ascending: true }).limit(500);
    if (cursor) q = q.gt('synced_at', cursor);
    const { data, error } = await q; if (error) throw error;
    if (!data.length) break;
    checkClock(data);
    store.applyRemote(data, user.id);
    cursor = data[data.length - 1].synced_at;
    store.setMeta('cursor', cursor);
    if (data.length < 500) break;
  }
  await pullMembers();
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

/* ---------- Coaching staff: members, invitations, live updates, who's here ---------- */
async function pullMembers() {
  const { data, error } = await sb.from('team_members').select('team_id,user_id,role,name,email,added_at').order('added_at', { ascending: true });
  if (error) { console.warn('members', error.message); return; }   // missing until the updated schema.sql is run
  store.setMembers(data || [], user.id);
  watch();
}
export const myId = () => user ? user.id : null;

// Live: another coach's change arrives within a second or two instead of at the next minute's check.
let live = null, presence = null, presenceTeam = null, here = {};
const pullSoon = debounce(() => sync(), 500);
function watch() {
  if (live || !sb.channel) return;
  live = sb.channel('cr-items')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => pullSoon())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members' }, () => pullSoon())
    .subscribe();
}
// Who else is in the app on this team, and which screen they have open.
export function setPresence(team, where) {
  if (!sb || !user || !sb.channel) return;
  const meName = (store.get('coach') || {}).name || email();
  if (presenceTeam !== team) {
    if (presence) { try { sb.removeChannel(presence); } catch (e) {} presence = null; here = {}; }
    presenceTeam = team; if (!team) return;
    presence = sb.channel('cr-here-' + team, { config: { presence: { key: user.id } } });
    presence.on('presence', { event: 'sync' }, () => {
      const st = presence.presenceState(); here = {};
      Object.entries(st).forEach(([uid, metas]) => { if (uid !== user.id && metas && metas.length) here[uid] = metas[metas.length - 1]; });
      emit();
    }).subscribe(async status => { if (status === 'SUBSCRIBED') { try { await presence.track({ name: meName, where }); } catch (e) {} } });
    return;
  }
  if (presence) { try { presence.track({ name: meName, where }); } catch (e) {} }
}
export const othersHere = where => Object.values(here).filter(h => !where || h.where === where);

const rnd = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, b => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join(''); };
export const joinUrl = tok => new URL('index.html#/join/' + tok, location.href.split('#')[0]).href;
export async function createInvite({ team, role, name, email: em }) {
  needCloud();
  const token = rnd(24);
  const { error } = await sb.from('invites').insert({ token, team_id: team, role, name: name || null, email: (em || '').trim() || null });
  if (error) throw new Error(/row-level|permission/i.test(error.message) ? 'Only the team’s owner or an admin can invite people.' : error.message);
  return token;
}
export async function listInvites(team) {
  if (!sb || !user || !navigator.onLine) return [];
  const { data, error } = await sb.from('invites').select('token,role,name,email,created_at,expires_at,used_at').eq('team_id', team).order('created_at', { ascending: false });
  if (error) return [];
  return (data || []).filter(i => !i.used_at && new Date(i.expires_at) > new Date());
}
export async function cancelInvite(token) { needCloud(); const { error } = await sb.from('invites').delete().eq('token', token); if (error) throw error; }
export async function inviteInfo(token) {
  if (!sb) return { ok: false, reason: 'cloud' };
  const { data, error } = await sb.rpc('invite_info', { p_token: token });
  if (error) return { ok: false, reason: 'error', message: error.message };
  return data;
}
export async function acceptInvite(token) {
  const { data, error } = await sb.rpc('accept_invite', { p_token: token });
  if (error) throw error;
  return data;
}
export async function setRole(team, uid, role) { needCloud(); const { error } = await sb.from('team_members').update({ role }).eq('team_id', team).eq('user_id', uid); if (error) throw error; await pullMembers(); }
export async function removeMember(team, uid) { needCloud(); const { error } = await sb.from('team_members').delete().eq('team_id', team).eq('user_id', uid); if (error) throw error; await pullMembers(); }
export const refreshMembers = () => (sb && user && navigator.onLine ? pullMembers() : Promise.resolve());
