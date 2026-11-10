// Local data store. Every record is {id, kind, team, upd, del, ...fields}.
// Coach-level records (coach, drill, cpd) have team = null.
// Saved to this browser straight away; cloud.js syncs dirty records.
import { uid, today, addDays, clone } from './util.js';
import { FORMATIONS } from './pitch.js';

const KEY = 'coachingroom.v1';
const SEED_TS = '2026-01-01T00:00:00.000Z';
let db = { recs: {}, dirty: {}, meta: {}, base: {}, pend: {} };
const subs = new Set();
export const onChange = fn => subs.add(fn);
const emit = (src) => subs.forEach(f => { try { f(src); } catch (e) { console.error(e); } });

/* ---------- Vocabulary ---------- */
export const PHASES = {
  ip: { lab: 'In possession', short: 'In possession', col: '#3D7BFF' },
  op: { lab: 'Out of possession', short: 'Out of possession', col: '#FF8A65' },
  ta: { lab: 'When we win it', short: 'Win it', col: '#3DDC97' },
  td: { lab: 'When we lose it', short: 'Lose it', col: '#FFD34D' },
  sp: { lab: 'Set pieces', short: 'Set pieces', col: '#B48CFF' }
};
export const PHASE_KEYS = Object.keys(PHASES);
export const DRILL_TYPES = ['Warm-up', 'Technical (unopposed)', 'Skill (opposed)', 'Small-sided game', 'Phase of play', 'Functional', 'Game (11v11)', 'Set piece'];
export const OPPOSED = ['Skill (opposed)', 'Small-sided game', 'Phase of play', 'Functional', 'Game (11v11)'];
export const GAMELIKE = ['Small-sided game', 'Phase of play', 'Functional', 'Game (11v11)'];
export const INTERVENTIONS = { command: 'Command (tell them)', qa: 'Question and answer', obs: 'Observation and feedback', guided: 'Guided discovery', trial: 'Trial and error' };
export const CORNERS = { tech: 'Technical / tactical', phys: 'Physical', psych: 'Psychological', soc: 'Social' };
export const TAGS = {
  formation: { lab: 'Shape', opts: ['4-3-3', '4-4-2', '4-2-3-1', '4-5-1', '3-5-2', '5-3-2', 'Other'] },
  build: { lab: 'How they build', opts: ['play out from back', 'mixed', 'long/direct'] },
  press: { lab: 'How they press', opts: ['high organised press', 'individual/unorganised', 'mid block', 'low block'] },
  transition: { lab: 'Their transitions', opts: ['dangerous on the counter', 'average', 'slow/blunt'] },
  aerial: { lab: 'In the air', opts: ['strong', 'average', 'weak'] },
  setpiece: { lab: 'Set-piece threat', opts: ['high', 'average', 'low'] }
};
export const GOAL_STATUS = { on: 'Working on it', done: 'Achieved', park: 'Parked' };
// The generic principles of play (The FA's "Game" theme on the UEFA C). Team principles are
// tagged with the ones they express, so a drill or session can be read in course language too.
export const POP = {
  pen: { lab: 'Penetration', side: 'att' }, sup: { lab: 'Support', side: 'att' }, wid: { lab: 'Width', side: 'att' }, mob: { lab: 'Mobility', side: 'att' }, cre: { lab: 'Creativity', side: 'att' },
  del: { lab: 'Delay / pressure', side: 'def' }, cov: { lab: 'Cover', side: 'def' }, bal: { lab: 'Balance', side: 'def' }, com: { lab: 'Compactness', side: 'def' }, con: { lab: 'Control / discipline', side: 'def' }
};
export const popsFor = phase => Object.keys(POP).filter(k => phase === 'sp' || POP[k].side === ({ ip: 'att', ta: 'att', op: 'def', td: 'def' }[phase] || 'att'));
export const DIRECTION = { dir: 'Directional (goals or targets to play towards)', non: 'Non-directional (keep-ball, no end to attack)' };
export const DONE = [[2, 'Yes', 'good'], [1, 'Partly', 'part'], [0, 'No', 'no']];
export const CPD_TYPES = ['Course', 'Workshop / webinar', 'Observation of another coach', 'Mentor conversation', 'Reading / video', 'Coaching (outside this team)', 'Other'];

/* ---------- Persistence ---------- */
let saveT;
function persist() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { console.error('save failed', e); emit('savefail'); }
  }, 150);
}
export function flush() { clearTimeout(saveT); try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }
window.addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

export function load() {
  try { const r = localStorage.getItem(KEY); if (r) db = JSON.parse(r); } catch (e) { console.error(e); }
  db.recs ||= {}; db.dirty ||= {}; db.meta ||= {}; db.pend ||= {};
  // First run with field-by-field merging: what is on this device now is the starting point,
  // so the next edit stamps only the fields it changes.
  if (!db.meta.seeded) { seed(); db.meta.seeded = true; persist(); }
  db.base ||= {}; for (const id in db.recs) if (!db.base[id]) db.base[id] = clone(db.recs[id]);
  repairIds();
  tidySeed();
  if (!db.meta.activeTeam || !get(db.meta.activeTeam)) db.meta.activeTeam = (teams()[0] || {}).id || null;
}
export const meta = () => db.meta;
// Another account signed in on this device: start again with nothing, then the pull fills it.
export function resetLocal() { db = { recs: {}, dirty: {}, meta: { seeded: true }, base: {}, pend: {} }; persist(); emit('remote'); }
// Player photos come from the players themselves (via their link), keyed by player id.
export const photoOf = id => ((db.meta.photos || {})[id]) || null;
export function setPhotos(pairs) {
  const ph = db.meta.photos ||= {};
  pairs.forEach(([id, src]) => { if (src) ph[id] = src; else delete ph[id]; });
  persist(); emit('remote');
}
export function setMeta(k, v) { db.meta[k] = v; persist(); }

/* ---------- CRUD ---------- */
export const get = id => { const r = db.recs[id]; return r && !r.del ? r : null; };
export function all(kind, team) {
  const out = [];
  for (const id in db.recs) { const r = db.recs[id]; if (r.kind === kind && !r.del && (team === undefined || r.team === team)) out.push(r); }
  return out;
}
// Field-by-field stamps. Two coaches can edit the same record: each field remembers when it was last
// changed, and the newer edit of each field is kept (here and in the database). Objects one level
// down (a match plan's keys, threat, Plan B...) are stamped field by field too.
const NOSTAMP = new Set(['id', 'kind', 'team', 'upd', 'del', '_f']);
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const J = v => JSON.stringify(v === undefined ? null : v);
// Same content regardless of key order, for "is anything different?".
const SJ = v => JSON.stringify(v, (k, x) => isObj(x) ? Object.keys(x).sort().reduce((o, key) => (o[key] = x[key], o), {}) : x);
function changedPaths(a, b) {
  const out = [];
  new Set([...Object.keys(a || {}), ...Object.keys(b || {})]).forEach(k => {
    if (NOSTAMP.has(k)) return;
    const x = a ? a[k] : undefined, y = b[k];
    if (isObj(x) && isObj(y)) new Set([...Object.keys(x), ...Object.keys(y)]).forEach(s => { if (J(x[s]) !== J(y[s])) out.push(k + '.' + s); });
    else if (J(x) !== J(y)) out.push(k);
  });
  return out;
}
const getPath = (o, p) => p.split('.').reduce((a, k) => a == null ? undefined : a[k], o);
function setPath(o, p, v) {
  const ks = p.split('.'); let a = o;
  for (let i = 0; i < ks.length - 1; i++) { if (!isObj(a[ks[i]])) a[ks[i]] = {}; a = a[ks[i]]; }
  if (v === undefined) delete a[ks[ks.length - 1]]; else a[ks[ks.length - 1]] = clone(v);
}
// A viewer on a team can look but not change anything in it.
export const roleIn = team => ((db.meta.roles || {})[team]) || null;
export const canEdit = rec => { const t = rec && (rec.kind === 'team' ? rec.id : rec.team); return !t || roleIn(t) !== 'viewer'; };
export function put(rec, { quiet } = {}) {
  if (!rec.id) rec.id = uid();
  if (!canEdit(rec)) { emit('readonly'); return rec; }
  const now = new Date().toISOString();
  const ch = changedPaths(db.base[rec.id], rec);
  if (ch.length) {
    const me = db.meta.syncUser;
    if (me && rec.kind !== 'coach' && rec.kind !== 'cpd') { const by = { id: me, n: (db.recs.coach && db.recs.coach.name) || '' }; if (J(rec.by) !== J(by)) { rec.by = by; ch.push('by'); } }
    rec._f = { ...(rec._f || {}) }; const pe = db.pend[rec.id] ||= {};
    ch.forEach(p => { rec._f[p] = now; pe[p] = 1; });
  }
  rec.upd = now;
  db.recs[rec.id] = rec; db.base[rec.id] = clone(rec); db.dirty[rec.id] = 1; db.meta.touched = true;
  persist(); if (!quiet) emit('local');
  return rec;
}
export function create(kind, team, fields) {
  return put({ id: uid(), kind, team: team ?? null, created: today(), ...fields });
}
export function del(id) { const r = db.recs[id]; if (!r) return; r.del = true; put(r); }

/* ---------- Sync hooks (used by cloud.js) ---------- */
// A record must be stored under its own id. Two ways that broke on some devices: a copy of the
// profile kept under its cloud name ('coach:<user>') beside 'coach', and a record whose id was
// changed after it was stored. Both put the same id in one upload twice, which the database refuses
// ("ON CONFLICT DO UPDATE command cannot affect row a second time") and sync stopped for good.
function repairIds() {
  let changed = false;
  for (const key of Object.keys(db.recs)) {
    const r = db.recs[key];
    if (!r || typeof r !== 'object') { delete db.recs[key]; delete db.dirty[key]; changed = true; continue; }
    if (key.startsWith('coach:')) {
      const c = db.recs.coach;
      delete db.recs[key]; delete db.dirty[key]; delete db.base[key]; delete db.pend[key]; changed = true;
      // The newer copy wins, stamped as an edit so it reaches the cloud.
      if (!c || (r.upd || '') > (c.upd || '')) put({ ...clone(r), id: 'coach', kind: 'coach' }, { quiet: true });
      continue;
    }
    if (r.id !== key) { db.recs[key] = { ...r, id: key }; db.dirty[key] = 1; changed = true; }
  }
  for (const key of Object.keys(db.dirty)) if (!db.recs[key]) { delete db.dirty[key]; changed = true; }
  if (changed) persist();
  return changed;
}
export function dirtyRecs() { repairIds(); return Object.keys(db.dirty).map(id => db.recs[id]).filter(Boolean); }
// sent: [{id, upd}] that the server accepted. Only clear if not edited again since.
export function clearDirty(sent) { sent.forEach(s => { const cur = db.recs[s.id]; if (!cur || cur.upd === s.upd) { delete db.dirty[s.id]; delete db.pend[s.id]; } }); persist(); }
export function hasDirty() { return Object.keys(db.dirty).length > 0; }
const META_KEYS = ['id', 'kind', 'team', 'upd', 'del'];
// In the cloud each person's profile has its own id; a team record belongs to its own team.
export function toRow(r, me) {
  const data = {}; for (const k in r) if (!META_KEYS.includes(k)) data[k] = r[k];
  return { id: r.id === 'coach' && me ? 'coach:' + me : r.id, kind: r.kind, team_id: r.kind === 'team' ? r.id : (r.team || null), data, updated_at: r.upd, deleted: !!r.del };
}
// Something readable to call a record in a message.
export function label(r) {
  if (!r) return '?';
  const k = { session: r.theme, match: r.opponent && 'v ' + r.opponent, drill: r.name, board: r.name, principle: r.title, player: r.name, team: r.name, review: 'review', cpd: r.title, coach: 'your profile', block: r.title }[r.kind];
  return (k || r.kind) + (r.date ? ' (' + r.date + ')' : '');
}
// One-off clean-up of wording from the first version's starter data, for copies already saved on a
// device or in the cloud. Only touches text that is still exactly as it was seeded.
const OLD_NOTE = 'From Scott’s description of how Thornaby play. Joe to rewrite in his own words.';
const OLD_SRC = 'Example built from Joe’s Hudl notes on Chester-le-Street v Stockport.';
export function tidySeed() {
  const fix = [];
  ['pr-1', 'pr-2', 'pr-3'].forEach(id => { const r = db.recs[id]; if (r && r.note === OLD_NOTE) { r.note = 'A starting point. Rewrite it in your own words, then mark it agreed.'; fix.push(r); } });
  const t = db.recs['t-thornaby'];
  if (t && t.roles && Object.values(t.roles).some(v => typeof v === 'string' && v.includes(' (Joe to write the detail.)'))) {
    Object.keys(t.roles).forEach(k => { if (typeof t.roles[k] === 'string') t.roles[k] = t.roles[k].replace(' (Joe to write the detail.)', ''); }); fix.push(t);
  }
  const m = db.recs['mt-cls']; if (m && m.src === OLD_SRC) { m.src = ''; fix.push(m); }
  fix.forEach(r => put(r, { quiet: true }));
  // The example rondo and example match were planted in Joe's own lists at set-up. The practice library
  // replaces them, so they go, unless he has turned them into something of his own.
  // Library copies opened for editing but never saved: gone after a day.
  const cut = new Date(Date.now() - 864e5).toISOString();
  Object.values(db.recs).forEach(r => { if (r.kind === 'drill' && r.draft && !r.del && (r.upd || '') < cut) del(r.id); });
  if (!db.meta.examplesGone) {
  db.meta.examplesGone = true;
  const rd = db.recs['dr-rondo']; if (rd && !rd.del && rd.name === 'Example: 5v2 rondo') { del('dr-rondo'); fix.push(rd); }
  const ex = db.recs['mt-cls']; if (ex && !ex.del && ex.example && !ex.date && !ex.reviewId) { del('mt-cls'); fix.push(ex); }
  }
  return fix.length;
}

export function applyRemote(rows, me) {
  let n = 0, lost = 0;
  const take = (id, rec) => { db.recs[id] = rec; db.base[id] = clone(rec); delete db.dirty[id]; delete db.pend[id]; n++; };
  const lose = (local, rt) => {
    db.meta.conflicts = (db.meta.conflicts || []).filter(c => c.id !== local.id).slice(-19);
    db.meta.conflicts.push({ id: local.id, kind: local.kind, name: label(local), at: new Date().toISOString(), theirs: rt, mine: clone(local) });
    lost++;
  };
  rows.forEach(row => {
    let id = row.id;
    if (id.startsWith('coach:')) { if (me && id !== 'coach:' + me) return; id = 'coach'; }
    const rt = new Date(row.updated_at).toISOString();
    const remote = { ...(row.data || {}), id, kind: row.kind, team: row.kind === 'team' ? null : (row.team_id || null), upd: rt, del: !!row.deleted };
    const local = db.recs[id];
    if (!local) return take(id, remote);
    const pend = Object.keys(db.pend[id] || {});
    // Neither copy has field stamps (made before they existed): last edit wins on the whole record.
    if (!remote._f && !local._f) {
      if (local.upd >= rt) return;
      if (db.dirty[id] && !local.del) lose(local, rt);
      return take(id, remote);
    }
    if (!db.dirty[id] || !pend.length) {
      if (db.dirty[id] && local.upd > rt) return;            // an unsent change with no field in it (a deletion): keep it
      if (SJ({ ...local, upd: 0 }) === SJ({ ...remote, upd: 0 })) { if (local.upd < rt) local.upd = rt; return; }
      return take(id, remote);
    }
    // Both changed it. Start from the other copy and put back each field changed here that is newer.
    const res = clone(remote); res._f = { ...(remote._f || {}) }; const gone = [];
    pend.forEach(p => {
      const lt = (local._f || {})[p] || '', rp = (remote._f || {})[p] || '';
      if (lt > rp) { setPath(res, p, getPath(local, p)); res._f[p] = lt; }
      else { gone.push(p); delete db.pend[id][p]; }
    });
    if (local.del && local.upd > rt) res.del = true;
    res.upd = local.upd > rt ? local.upd : rt;
    if (gone.length && !local.del) lose(local, rt);
    db.recs[id] = res; db.base[id] = clone(res); n++;
    if (!Object.keys(db.pend[id] || {}).length && !(local.del && !remote.del)) { delete db.dirty[id]; delete db.pend[id]; }
  });
  if (n) { tidySeed(); persist(); if (db.meta.activeTeam && !get(db.meta.activeTeam)) db.meta.activeTeam = (teams()[0] || {}).id || null; emit('remote'); }
  if (lost) emit('conflict');
  return n;
}
// The coaching staff of each team this person belongs to, and their own role in each.
export function setMembers(rows, me) {
  const roles = {}; rows.forEach(r => { if (r.user_id === me) roles[r.team_id] = r.role; });
  const before = J([db.meta.members, db.meta.roles]);
  db.meta.members = rows; db.meta.roles = roles;
  if (J([rows, roles]) !== before) { persist(); emit('members'); }
}
// "Last change by Dave, 5 min ago" when the last change to a record was someone else's.
export function editedBy(rec, ago) {
  if (!rec || !rec.by || !rec.by.id || rec.by.id === db.meta.syncUser) return '';
  return 'Last change by ' + (rec.by.n || 'another coach') + (ago ? ', ' + ago(rec.upd) : '');
}
// Records from the starting data that were never edited have never been uploaded. Upload them once per
// account, so a coach who joins sees the same team (its name, shapes, principles) as the one who set it up.
// Anything already in the cloud is newer, and stays.
export function markSeedsDirty() {
  let n = 0; for (const id in db.recs) { const r = db.recs[id]; if (r.upd === SEED_TS && !r.del && canEdit(r)) { db.dirty[id] = 1; n++; } }
  if (n) persist(); return n;
}
export const isSeed = r => !!r && r.upd === SEED_TS;
export const pendOf = id => Object.keys(db.pend[id] || {});
export const members = team => (db.meta.members || []).filter(m => m.team_id === team);
// The server already holds a newer copy of this record (edited on another device), so the edit
// made here was dropped. Keep it so Joe can copy it back by hand.
export function noteRejected(local) {
  if (!local || local.del || local.upd === SEED_TS) return;
  db.meta.conflicts = (db.meta.conflicts || []).filter(c => c.id !== local.id).slice(-19);
  db.meta.conflicts.push({ id: local.id, kind: local.kind, name: label(local), at: new Date().toISOString(), mine: clone(local) });
  persist(); emit('conflict');
}
export const conflicts = () => db.meta.conflicts || [];
export function dropConflict(id) { db.meta.conflicts = (db.meta.conflicts || []).filter(c => c.id !== id); persist(); }
export function exportAll() { return JSON.stringify({ app: 'coaching-room', v: 1, exported: new Date().toISOString(), recs: Object.values(db.recs) }, null, 1); }
export function importAll(text) {
  const o = JSON.parse(text); if (!o || !Array.isArray(o.recs)) throw new Error('Not a Coaching Room backup');
  let n = 0;
  o.recs.forEach(r => { if (!r.id || !r.kind) return; const cur = db.recs[r.id]; if (!cur || (r.upd || '') > (cur.upd || '')) { db.recs[r.id] = r; db.dirty[r.id] = 1; n++; } });
  persist(); emit('local'); return n;
}

/* ---------- Queries ---------- */
// Each person's own links (their course, the FA's learning site). Private, like the rest of the profile.
export const DEFAULT_LINKS = [{ id: 'efl', label: 'England Football Learning', url: 'https://learn.englandfootball.com/' }];
export const coachLinks = () => { const c = get('coach'); return c && Array.isArray(c.links) ? c.links.filter(l => l && l.url) : DEFAULT_LINKS; };
export const coach = () => get('coach') || put({ id: 'coach', kind: 'coach', team: null, name: 'Joe', initials: 'JE', ratings: {}, ratingLog: [] }, { quiet: true });
export const teams = () => all('team').sort((a, b) => (!!a.archived - !!b.archived) || (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name));
export const team = () => get(db.meta.activeTeam) || teams()[0] || null;
export function setTeam(id) { db.meta.activeTeam = id; persist(); emit('team'); }
export const players = t => all('player', t).sort((a, b) => (+a.num || 999) - (+b.num || 999));
export const playerMap = t => Object.fromEntries(players(t).map(p => [p.id, { num: p.num, name: p.name, short: p.short, pos: p.pos }]));
export const principles = t => all('principle', t).sort((a, b) => PHASE_KEYS.indexOf(a.phase) - PHASE_KEYS.indexOf(b.phase) || (a.order || 0) - (b.order || 0));
export const boards = t => all('board', t).sort((a, b) => (b.upd || '').localeCompare(a.upd || ''));
// Drafts are library copies being edited that have not been saved as Joe's own yet: kept out of every list.
export const drillSketches = () => all('drill').filter(d => d.sketch && !d.draft).sort((a, b) => (b.upd || '').localeCompare(a.upd || ''));
export const drills = () => all('drill').filter(d => !d.draft && !d.sketch).sort((a, b) => (b.upd || '').localeCompare(a.upd || ''));
export const sessions = t => all('session', t).sort((a, b) => (b.date || '9').localeCompare(a.date || '9'));
export const matches = t => all('match', t).sort((a, b) => (b.date || '9').localeCompare(a.date || '9'));
export const reviews = t => all('review', t).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
export const cpd = () => all('cpd').sort((a, b) => (b.date || '').localeCompare(a.date || ''));
export const drillLinks = (d, t) => ((d.links || {})[t] || []).filter(id => get(id));

/* ---------- Programme: blocks of weeks on named principles ---------- */
export const blocks = t => all('block', t).sort((a, b) => (b.start || '').localeCompare(a.start || ''));
export const blockEnd = b => addDays(b.start, 7 * (+b.weeks || 1));          // first day after the block
export const blockFor = (t, date) => date ? blocks(t).find(b => b.start && b.start <= date && date < blockEnd(b)) || null : null;
export const currentBlock = t => blockFor(t, today());
export const weekOf = (b, date) => Math.min(+b.weeks || 1, Math.floor((new Date(date + 'T12:00') - new Date(b.start + 'T12:00')) / 6048e5) + 1);
export const blockSessions = (t, b) => sessions(t).filter(s => s.date && !s.cancelled && s.date >= b.start && s.date < blockEnd(b)).sort((a, b2) => a.date.localeCompare(b2.date));
export const blockMatches = (t, b) => matches(t).filter(m => m.date && !m.cancelled && m.date >= b.start && m.date < blockEnd(b)).sort((a, b2) => a.date.localeCompare(b2.date));
// Sessions in the seven days before a match: what was trained going into it.
export const trainedBefore = (t, m) => m.date ? sessions(t).filter(s => s.date && !s.cancelled && s.date < m.date && s.date >= addDays(m.date, -7)).sort((a, b) => a.date.localeCompare(b.date)) : [];
// Earlier matches against the same opponent: the opponent file.
export const previousMeetings = (t, m) => m.opponent ? matches(t).filter(x => x.id !== m.id && x.opponent && x.opponent.trim().toLowerCase() === m.opponent.trim().toLowerCase() && x.date && (!m.date || x.date < m.date)) : [];

export function nextMatch(t) {
  const td = today();
  const up = matches(t).filter(m => m.date && m.date >= td && !m.cancelled).sort((a, b) => a.date.localeCompare(b.date));
  return up[0] || matches(t).find(m => !m.date && !m.cancelled) || null;
}
export function nextSession(t) {
  const td = today();
  return sessions(t).filter(s => s.date && s.date >= td && !s.cancelled).sort((a, b) => a.date.localeCompare(b.date))[0] || null;
}
// A review counts only when the parts that feed the next session are written:
// what worked, what didn't, the one thing to change, what Joe learned about himself,
// and (after a match) every key to winning scored. Opening a review is not reviewing.
export function reviewDone(r) {
  if (!r) return false;
  const has = k => !!(r[k] || '').trim();
  if (!has('worked') || !has('didnt') || !has('change') || !has('self')) return false;
  if (r.type === 'match' && (r.keys || []).some(k => k.v == null)) return false;
  // The loop: if this session set out to act on the last review's change, say whether it did.
  if (r.carried && r.lastChangeDone == null) return false;
  return true;
}
export const reviewOf = rec => (rec && rec.reviewId && get(rec.reviewId)) || null;
// Sessions and matches that have happened and have no finished review yet.
export function reviewsDue(t) {
  const td = today(); const out = [];
  sessions(t).forEach(s => { if (s.date && s.date < td && !s.cancelled && !reviewDone(reviewOf(s))) out.push({ kind: 'session', rec: s, started: !!reviewOf(s) }); });
  matches(t).forEach(m => { if (m.date && m.date < td && !m.cancelled && !reviewDone(reviewOf(m))) out.push({ kind: 'match', rec: m, started: !!reviewOf(m) }); });
  return out.sort((a, b) => a.rec.date.localeCompare(b.rec.date));
}
export function lastChange(t) { return reviews(t).find(r => r.change && r.change.trim()) || null; }

export function newTeam(fields, copyFrom) {
  const t = create('team', null, { name: 'New team', short: '', club: '', season: '', formation: '4-3-3 (6 + two 8s)', style: { build: '', press: '', restdef: '' }, roles: {}, order: teams().length, ...fields });
  if (copyFrom) principles(copyFrom).forEach(p => create('principle', t.id, { ...clone(p), id: undefined, team: t.id, history: [], status: 'draft', note: 'Copied from another team. Check it fits this group.' }));
  return t;
}

/* ---------- Seed: Thornaby FC Women, dummy squad ---------- */
function seedPut(rec) { db.recs[rec.id] = { team: null, created: '2026-11-06', ...rec, upd: SEED_TS }; }
function seed() {
  if (all('team').length) return;
  const T = 't-thornaby';
  seedPut({ id: 'coach', kind: 'coach', name: 'Joe', initials: 'JE', ratings: {}, ratingLog: [] });
  seedPut({ id: T, kind: 'team', name: 'Thornaby FC Women', short: 'Thornaby', club: 'Thornaby FC', season: '2026/27', formation: '4-3-3 (6 + two 8s)', order: 0, identity: '',
    style: { build: 'play out from back', press: '', restdef: '' },
    roles: { '6': 'Holding midfielder. The constant central option.', '8': 'Two 8s play higher than the 6 but keep their defensive duties.' } });
  const pos = [['GK', 1], ['RB', 2], ['CB', 5], ['CB', 4], ['LB', 3], ['6', 6], ['8', 8], ['8', 10], ['RW', 7], ['LW', 11], ['CF', 9], ['GK', 13], ['CB', 15], ['FB', 12], ['CM', 14], ['CM', 16], ['W', 17], ['CF', 18]];
  pos.forEach(([p, n]) => seedPut({ id: 'pl-' + n, kind: 'player', team: T, num: n, name: 'Player ' + n, short: '', pos: p, pos2: '', foot: '', notes: '', goals: [], obs: [] }));
  const note = 'A starting point. Rewrite it in your own words, then mark it agreed.';
  seedPut({ id: 'pr-1', kind: 'principle', team: T, phase: 'ip', order: 0, status: 'draft', note, title: 'Play out from the back', why: 'We build through the goalkeeper and centre-backs rather than going long by default.', subs: [], history: [] });
  seedPut({ id: 'pr-2', kind: 'principle', team: T, phase: 'ip', order: 1, status: 'draft', note, title: 'Keep the ball', why: 'We are a passing, possession team. We move the ball to move the opponent.', subs: [], history: [] });
  seedPut({ id: 'pr-3', kind: 'principle', team: T, phase: 'ip', order: 2, status: 'draft', note, title: 'The 6 links, the 8s go', why: 'One holding midfielder stays as the central link. The two 8s play higher but keep their defensive duties.', subs: [], history: [] });

  const ids = pos.slice(0, 11).map(([, n]) => 'pl-' + n);
  const mk = cs => cs.map((c, i) => ({ id: 'u' + i, kind: 'us', pid: ids[i], x: c[0], y: c[1] }));
  const base = FORMATIONS['4-3-3 (6 + two 8s)'].map(c => [c[1], c[2]]);
  const build = [[34, 101], [60, 70], [48, 92], [20, 92], [8, 70], [34, 82], [46, 62], [22, 62], [62, 40], [6, 40], [34, 32]];
  const block = [[34, 100], [56, 82], [41, 84], [27, 84], [12, 82], [34, 72], [44, 64], [24, 64], [58, 64], [10, 64], [34, 50]];
  seedPut({ id: 'bd-shape', kind: 'board', team: T, name: '4-3-3 shapes', type: 'shape', frames: [
    { id: 'f1', name: 'Base shape', phase: '', notes: 'Starting positions. Drag anyone anywhere.', items: mk(base).concat([{ id: 'b', kind: 'ball', x: 34, y: 96 }]), arrows: [] },
    { id: 'f2', name: 'Build-up (starter)', phase: 'ip', notes: 'STARTER FRAME. A guess at a build-up shape so you can see how frames work. Move players to how Thornaby actually build.', items: mk(build).concat([{ id: 'b', kind: 'ball', x: 34, y: 99 }]), arrows: [] },
    { id: 'f3', name: 'Mid block (starter)', phase: 'op', notes: 'STARTER FRAME. A 4-5-1 style block to show the idea. Set the real shape and pressing triggers.', items: mk(block).concat([{ id: 'b', kind: 'ball', x: 34, y: 30 }]), arrows: [] }
  ] });

  // No pretend drills or matches: the practice library and the starter principles are the examples.
}
