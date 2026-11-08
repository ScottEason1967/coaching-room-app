// Links with PINs for staff (session, match, board) and players (their own page).
// Each link holds a snapshot of only what's meant to be shared. Health data,
// staff notes and other players' profiles are never included.
import * as S from '../store.js';
import * as cloud from '../cloud.js';
import { PHASES, GOAL_STATUS } from '../store.js';
import { esc, icon, token, pin4, sheet, closeSheet, toast, shareText, fmtD, fmtAgo, lines, today, debounce } from '../util.js';
import { sessionStats, sessionKit } from '../challenges.js';
import { kitLabel } from '../print.js';

const teamInfo = T => { const t = S.get(T) || {}; return { name: t.name || '', season: t.season || '', logo: t.logo || '' }; };
const drillOut = (d, T) => ({ name: d.name, type: d.type, w: d.w, h: d.h, preset: d.preset, items: d.items || [], arrows: d.arrows || [], objective: d.objective, org: d.org, how: d.how, points: d.points, prog: d.prog, reg: d.reg, players: d.players, transition: d.transition || '', success: d.success || '', questions: d.questions || '', principles: S.drillLinks(d, T).map(S.get).filter(Boolean).map(p => p.title) });
const boardOut = b => ({ name: b.name, type: b.type, frames: b.frames.map(f => ({ name: f.name, phase: f.phase, notes: f.notes, items: f.items, arrows: f.arrows })) });
function playersFor(boards, T) {
  const pm = S.playerMap(T); const out = {};
  boards.forEach(b => b.frames.forEach(f => f.items.forEach(i => { if (i.kind === 'us' && pm[i.pid]) out[i.pid] = { num: pm[i.pid].num, name: pm[i.pid].short || pm[i.pid].name, pos: pm[i.pid].pos }; })));
  return out;
}

export function snapshot(kind, rec) {
  const T = rec.team;
  if (kind === 'board') return { team: teamInfo(T), board: boardOut(rec), players: playersFor([rec], T) };
  if (kind === 'session') {
    const st = sessionStats(rec); const { kit, balls } = sessionKit(rec);
    return { team: teamInfo(T), session: { theme: rec.theme, date: rec.date, time: rec.time, venue: rec.venue, staff: rec.staff, notes: rec.notes, total: st.total, rolling: st.rolling, lookFor: rec.lookFor || '',
      principles: (rec.principleIds || []).map(S.get).filter(Boolean).map(p => p.title),
      kit: Object.entries(kit).map(([k, v]) => `${v} × ${kitLabel(k)}`).concat(balls ? ['Balls'] : []),
      blocks: (rec.blocks || []).map(b => { const d = S.get(b.drillId); return { minutes: b.minutes, talk: b.talk, note: b.note, drill: d ? drillOut(d, T) : null }; }) } };
  }
  if (kind === 'match') {
    const boards = (rec.boardIds || []).map(S.get).filter(Boolean);
    const squad = (rec.squadIds || []).map(S.get).filter(Boolean);
    return { team: teamInfo(T), match: { opponent: rec.opponent, date: rec.date, ko: rec.ko, venue: rec.venue, comp: rec.comp, tags: rec.tags, opp: rec.opp, plan: { keys: lines(rec.plan.keys), threat: rec.plan.threat, first: rec.plan.first || '', planB: rec.plan.planB || '', subs: rec.plan.subs || '', ip: rec.plan.ip, op: rec.plan.op, sp: rec.plan.sp, spAgainst: rec.plan.spAgainst || '', selection: rec.plan.selection, talk: rec.plan.talk },
      squad: squad.map(p => ({ num: p.num, name: p.name, instruction: (rec.instructions || {})[p.id] || '' })) }, boards: boards.map(boardOut), players: playersFor(boards, T) };
  }
  if (kind === 'player') return playerSnapshot(rec);
  return {};
}

export function playerSnapshot(p) {
  const T = p.team; const t = S.get(T) || {}; const opt = t.playerShare || { principles: true, keys: true, setpieces: true };
  const nm = S.nextMatch(T);
  const inSquad = nm && (!(nm.squadIds || []).length || nm.squadIds.includes(p.id));
  const setpieces = opt.setpieces ? S.boards(T).filter(b => b.sharePlayers) : [];
  const mBoards = nm && inSquad ? (nm.boardIds || []).map(S.get).filter(b => b && b.sharePlayers && !setpieces.includes(b)) : [];
  const all = setpieces.concat(mBoards);
  return {
    team: teamInfo(T),
    player: { num: p.num, name: p.name, pos: p.pos },
    goals: (p.goals || []).filter(g => g.status !== 'park').map(g => ({ text: g.text, status: GOAL_STATUS[g.status] || '', how: g.how || '' })),
    principles: opt.principles ? S.principles(T).filter(x => x.status === 'agreed').map(x => ({ phase: PHASES[x.phase].lab, title: x.title, why: x.why, subs: (x.subs || []).map(s => s.text).filter(Boolean) })) : [],
    match: nm && nm.date && inSquad ? { opponent: nm.opponent, date: nm.date, ko: nm.ko, venue: nm.venue, keys: opt.keys ? lines(nm.plan.keys) : [], instruction: (nm.instructions || {})[p.id] || '' } : null,
    boards: all.map(boardOut), players: playersFor(all, T),
    updated: today()
  };
}

function titleFor(kind, rec) {
  if (kind === 'board') return rec.name;
  if (kind === 'session') return 'Session ' + fmtD(rec.date) + (rec.theme ? ': ' + rec.theme : '');
  if (kind === 'match') return 'Match plan v ' + rec.opponent;
  if (kind === 'player') return rec.name;
  return '';
}

async function publish(kind, rec, { newPin } = {}) {
  rec.share ||= {};
  const first = !rec.share.token;
  if (first) rec.share.token = token();
  if (first || newPin) rec.share.pin = pin4();
  await cloud.saveShare({ token: rec.share.token, kind, refId: rec.id, title: titleFor(kind, rec), data: snapshot(kind, rec), pin: (first || newPin) ? rec.share.pin : null, enabled: rec.share.enabled !== false });
  rec.share.at = new Date().toISOString(); if (rec.share.enabled == null) rec.share.enabled = true;
  S.put(rec);
}

// Quietly bring a link up to date after edits (called when leaving a plan).
const pending = new Map();
export function refreshIfShared(kind, rec) {
  if (!rec || !rec.share || !rec.share.token || rec.share.enabled === false || !cloud.signedIn()) return;
  if (rec.share.at && rec.upd && rec.upd <= rec.share.at) return;
  clearTimeout(pending.get(rec.id));
  pending.set(rec.id, setTimeout(() => publish(kind, rec).catch(e => console.warn('share refresh', e)), 800));
}
export async function refreshPlayers(T) {
  const ps = S.players(T).filter(p => p.share && p.share.token && p.share.enabled !== false);
  let n = 0; for (const p of ps) { await publish('player', p); n++; }
  return n;
}

export function shareSheet(kind, rec) {
  const who = kind === 'player' ? 'this player' : 'your staff';
  const ready = cloud.configured() && cloud.signedIn();
  const sh = rec.share || {};
  const url = sh.token ? cloud.shareUrl(sh.token) : '';
  const el = sheet(`<div class="stack"><div class="h2">${kind === 'player' ? 'Player page' : 'Share with staff'}</div>
    ${!ready ? `<div class="card inset small">${cloud.configured() ? 'Sign in to cloud sync first. Links live online so people can open them on their own phones.' : 'Links need cloud sync switched on. The README explains the one-off setup (about 15 minutes).'} <a href="#/cloud" id="goCloud">Cloud sync settings</a></div>`
      : !sh.token ? `<p class="small muted" style="margin:0">Creates a private link for ${who}. They need the link and a 4-digit PIN. Five wrong PINs locks the link for 15 minutes.${kind === 'player' ? ' The page shows her development goals, your agreed principles, the next match (her instruction and the keys) and set-piece boards you’ve marked for players. Never your private notes.' : ''}</p>
        <button class="btn pri" id="shMake">${icon('link')}Create link and PIN</button>`
      : `<label class="field"><span>Link</span><input type="text" readonly value="${esc(url)}" id="shUrl"></label>
        <div class="row between"><div><div class="label">PIN</div><div class="display" style="font-size:40px;letter-spacing:.12em;color:var(--lamp)">${esc(sh.pin || '••••')}</div></div>
          <div class="stack tight" style="align-items:flex-end"><span class="pill ${sh.enabled === false ? 'grey' : 'good'}">${sh.enabled === false ? 'Turned off' : 'Live'}</span><span class="tiny muted">Updated ${fmtAgo(sh.at)}</span></div></div>
        <div class="row"><button class="btn pri" id="shSend">${icon('share')}Send link</button><button class="btn" id="shSendPin">Send PIN</button><button class="btn" id="shSendBoth">Send both</button></div>
        <p class="tiny muted" style="margin:0">Safest: send the link, then give the PIN in person or in a separate message.</p>
        <div class="row"><button class="btn sm" id="shUpd">${icon('rotate')}Update now</button><button class="btn sm" id="shPin">New PIN</button><button class="btn sm" id="shOff">${sh.enabled === false ? 'Turn back on' : 'Turn off'}</button><button class="btn sm danger" id="shDel">${icon('trash')}Delete link</button></div>
        <div id="shCom"></div>`}
    <button class="btn" id="shX">Close</button></div>`);
  const busy = async (fn, ok) => { try { await fn(); if (ok) toast(ok); closeSheet(); shareSheet(kind, rec); } catch (e) { toast(e.message || 'Could not reach the cloud'); } };
  el.querySelector('#shX').onclick = closeSheet;
  el.querySelector('#goCloud')?.addEventListener('click', closeSheet);
  el.querySelector('#shMake')?.addEventListener('click', () => busy(() => publish(kind, rec), 'Link created'));
  if (!sh.token) return;
  const name = titleFor(kind, rec);
  el.querySelector('#shSend').onclick = () => shareText(name, `${name}${kind === 'player' ? ' (your player page)' : ''}. Open on your phone:`, url);
  el.querySelector('#shSendPin').onclick = () => shareText('PIN', `PIN for ${name}: ${sh.pin}`);
  el.querySelector('#shSendBoth').onclick = () => shareText(name, `${name}. PIN ${sh.pin}.`, url);
  el.querySelector('#shUpd').onclick = () => busy(() => publish(kind, rec), 'Updated');
  el.querySelector('#shPin').onclick = () => busy(() => publish(kind, rec, { newPin: true }), 'New PIN set. The old one no longer works.');
  el.querySelector('#shOff').onclick = () => busy(async () => { const on = sh.enabled === false; await cloud.setShareEnabled(sh.token, on); rec.share.enabled = on; S.put(rec); }, sh.enabled === false ? 'Link is live again' : 'Link turned off');
  el.querySelector('#shDel').onclick = () => busy(async () => { await cloud.deleteShare(sh.token); delete rec.share; S.put(rec); }, 'Link deleted');
  cloud.shareInfo(sh.token).then(info => {
    const box = el.querySelector('#shCom'); if (!box || !info) return;
    const cs = info.comments || [];
    box.innerHTML = cs.length ? `<div class="eyebrow">Comments</div><div class="list">${cs.slice().reverse().map(c => `<div class="card inset small"><b>${esc(c.name)}</b> <span class="muted tiny">${fmtAgo(c.at)}</span><br>${esc(c.text)}</div>`).join('')}</div>` : '';
  });
}
