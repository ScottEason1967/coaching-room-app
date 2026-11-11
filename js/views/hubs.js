// The four areas behind the home tiles: Team, Training, Match and Analysis, plus Sketch.
// Training holds the hierarchy Programme > Sessions > Drills. Each area has its own colour.
import * as S from '../store.js';
import { esc, icon, today, fmtD, fmtAgo, addDays, actions, confirmSheet, teamBadge } from '../util.js';
import { PHASES, PHASE_KEYS } from '../store.js';
import { sessionStats, drillChallenges, openCount, reviewComplete } from '../challenges.js';
import { newSession } from './session.js';
import { newMatch } from './match.js';
import { newDrill } from './drill.js';
import { startReview } from './review.js';
import { drillSvg, frameSvg } from '../pitch.js';
import { newBlock, programmeHtml } from './block.js';
import { BOARD_LABEL, newBoardFrame } from './board.js';

export const SECTIONS = {
  team: { lab: 'Team', ic: 'model', href: '#/teamhome' },
  training: { lab: 'Training', ic: 'training', href: '#/training' },
  match: { lab: 'Match', ic: 'match', href: '#/matches' },
  analysis: { lab: 'Analysis', ic: 'analysis', href: '#/analysis' }
};

const head = (sec, title, sub, right = '') => `<div class="sec-head row nowrap" style="gap:12px">
  <span class="sec-ic">${icon(SECTIONS[sec] ? SECTIONS[sec].ic : 'sketch')}</span>
  <div class="grow" style="min-width:0"><div class="h1" style="margin:0">${esc(title)}</div>${sub ? `<div class="small muted">${sub}</div>` : ''}</div>${right}</div>`;

// Section banner: the section's colour (as on the Home tiles), its name and the numbers that matter.
const band = (sec, title, sub, stats) => `<div class="sband ${sec}"><div class="row nowrap" style="gap:12px"><span class="sbic">${icon(SECTIONS[sec].ic)}</span><div class="sbs grow">${sub}</div></div>
  <div class="tstats">${stats.map(([n, l]) => `<div class="tstat"><span class="n">${n}</span><span class="l">${l}</span></div>`).join('')}</div></div>`;
const hasResult = m => m.result && m.result.us !== '' && m.result.us != null && m.result.them !== '' && m.result.them != null;
const dayMon = d => d ? new Date(d + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '–';
const bigBtn = (act, ic, title, sub, pri, id) => `<button type="button" class="bigpick ${pri ? 'pri' : ''}" data-act="${act}" id="${id}">${icon(ic)}<span class="t">${esc(title)}</span><span class="s">${esc(sub)}</span></button>`;

const statusPill = (r, td) => {
  if (r.cancelled) return '<span class="pill grey">Didn’t happen</span>';
  const rv = S.reviewOf(r);
  if (rv && S.reviewDone(rv)) return '<span class="pill an">Analysis done</span>';
  if (rv) return '<span class="pill lamp">Analysis unfinished</span>';
  if (r.date && r.date < td) return '<span class="pill lamp">Needs analysis</span>';
  if (r.date === td) return '<span class="pill">Today</span>';
  return '';
};

/* ---------- Team ---------- */
// Each part of the team shows what is in it, not just its name: the principles and how many are
// agreed, the squad by unit with the captains, who is on the staff, the latest sketches.
const UNIT = { GK: 'gk', RB: 'def', CB: 'def', LB: 'def', FB: 'def', 6: 'mid', 8: 'mid', CM: 'mid', 10: 'mid', RW: 'att', LW: 'att', W: 'att', CF: 'att' };
const UNITS = [['gk', 'GK'], ['def', 'Defence'], ['mid', 'Midfield'], ['att', 'Attack']];
const initials = n => (String(n || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2) || '?').toUpperCase();
export function teamHome(el, params, ctx) {
  const t = S.team(); const T = t.id; ctx.setTop({ title: 'Team' });
  const ps = S.principles(T); const agreed = ps.filter(p => p.status === 'agreed').length;
  const pl = S.players(T); const ms = S.members(T); const bs = S.boards(T).filter(b => b.type === 'sketch');
  const pm = S.playerMap(T);
  const played = S.matches(T).filter(m => m.result && m.result.us !== '' && m.result.us != null && m.result.them !== '' && m.result.them != null);
  const wdl = played.reduce((a, m) => { const u = +m.result.us, th = +m.result.them; a[u > th ? 0 : u === th ? 1 : 2]++; return a; }, [0, 0, 0]);
  const stat = (n, l) => `<div class="tstat"><span class="n">${n}</span><span class="l">${l}</span></div>`;

  const byPhase = PHASE_KEYS.map(k => [k, ps.filter(p => p.phase === k)]).filter(([, l]) => l.length);
  const model = ps.length
    ? `<div class="tbar" aria-label="${agreed} of ${ps.length} agreed"><span style="width:${Math.round(agreed / ps.length * 100)}%"></span></div>
       <div class="tlist">${byPhase.map(([k, l]) => l.slice(0, 3).map(p => `<div class="trow"><span class="dot" style="background:${PHASES[k].col}"></span><span class="grow ell">${esc(p.title || 'Untitled')}</span><span class="tiny ${p.status === 'agreed' ? 'ok' : 'muted'}">${p.status === 'agreed' ? 'Agreed' : 'Draft'}</span></div>`).join('')).join('')}</div>
       ${ps.length > byPhase.reduce((n, [, l]) => n + Math.min(3, l.length), 0) ? `<div class="tiny muted">and more in the game model</div>` : ''}`
    : `<div class="tempty">No principles yet. Write down how you want to play, one moment of the game at a time.</div>`;

  const units = UNITS.map(([k, lab]) => [k, lab, pl.filter(p => UNIT[p.pos] === k).length]);
  const unset = pl.filter(p => !UNIT[p.pos]).length;
  const capt = c => pl.find(p => p.capt === c);
  const squad = pl.length
    ? `<div class="tshirts">${pl.slice(0, 26).map(p => `<span class="shirt ${p.pos === 'GK' ? 'gk' : ''} ${p.capt ? 'capt' : ''}" title="${esc(p.name)}">${esc(p.num || '·')}</span>`).join('')}</div>
       <div class="tunits">${units.map(([k, lab, n]) => `<span class="tunit ${k}"><b>${n}</b>${lab}</span>`).join('')}${unset ? `<span class="tunit none"><b>${unset}</b>No position</span>` : ''}</div>
       <div class="small">${capt('c') ? `<b>Captain</b> ${esc(capt('c').name)}` : '<span class="muted">No captain picked</span>'}${capt('vc') ? ` · <b>Vice</b> ${esc(capt('vc').name)}` : ''}</div>`
    : `<div class="tempty">No players yet. Paste your squad list and the app sets them all up.</div>`;

  const ROLE_L = { owner: 'Owner', admin: 'Admin', coach: 'Coach', viewer: 'Viewer' };
  const staff = ms.length
    ? `<div class="tpeople">${ms.slice(0, 6).map(m => `<div class="tperson"><span class="face">${esc(initials(m.name || m.email))}</span><span class="grow ell"><span class="nm">${esc(m.name || m.email || 'Coach')}</span><span class="tiny muted">${ROLE_L[m.role] || ''}</span></span></div>`).join('')}</div>
       ${ms.length < 2 ? '<div class="small muted">Just you so far. Bring your manager and assistant in, so you plan sessions and matches together.</div>' : ''}`
    : `<div class="tempty">Bring your manager and assistant in, so you plan sessions and matches together.</div>`;

  const sk = bs.slice(0, 2);
  const sketch = sk.length
    ? `<div class="tthumbs">${sk.map(b => `<div class="tthumb">${frameSvg(b.frames[0] || { items: [], arrows: [] }, pm, { orient: 'h', style: 'width:100%;height:auto;border-radius:10px;display:block' })}<span class="tiny ell">${esc(b.name)} · ${fmtAgo(b.upd)}</span></div>`).join('')}</div>`
    : `<div class="tthumbs"><div class="tthumb">${frameSvg({ items: [], arrows: [] }, pm, { orient: 'h', style: 'width:100%;height:auto;border-radius:10px;display:block;opacity:.55' })}</div><div class="small muted" style="align-self:center">A blank pitch for ideas and team talks. Saved sketches show here.</div></div>`;

  const card = (id, href, ic, title, right, body, cta) => `<a class="tcard" id="${id}" href="${href}"><div class="tchead">${icon(ic)}<span class="t">${title}</span><span class="r">${right}</span><span class="chev">›</span></div>${body}<span class="tcta">${cta}</span></a>`;
  el.innerHTML = `<div class="stack">
    <div class="tband">
      <div class="row nowrap" style="gap:12px"><div class="grow" style="min-width:0"><div class="tname" style="font-size:20px;text-transform:none;font-family:Inter,sans-serif;font-weight:700">${esc([t.season, t.formation].filter(Boolean).join(' · ') || 'Your team')}</div></div><a class="tedit" href="#/team/${T}" id="tDetails">Team details</a></div>
      <div class="tstats">${stat(pl.length, 'Players')}${stat(ps.length ? agreed + '/' + ps.length : '0', 'Principles agreed')}${stat(ms.length || 1, ms.length === 1 || !ms.length ? 'Coach' : 'Coaches')}${stat(played.length ? wdl.join('-') : '–', played.length ? 'W-D-L' : 'Results')}</div>
    </div>
    <div class="tgrid">
      ${card('tModel', '#/model', 'model', 'Game model', ps.length ? `${agreed} of ${ps.length} agreed` : '', model, ps.length ? (agreed < ps.length ? 'Agree the drafts' : 'Open the game model') : 'Write your first principle')}
      ${card('tSquad', '#/squad', 'squad', 'Squad', pl.length ? pl.length + ' players' : '', squad, pl.length ? (unset ? 'Give everyone a position' : 'Player pages and goals') : 'Paste your squad')}
      ${card('tStaff', '#/staff', 'staff', 'Staff', ms.length > 1 ? ms.length + ' coaches' : '', staff, '+ Invite a coach')}
      ${card('tSketch', '#/sketch', 'sketch', 'Sketch', bs.length ? bs.length + ' saved' : '', sketch, bs.length ? 'All sketches' : 'Start a sketch')}
    </div></div>`;
}

/* ---------- Training: Programme > Sessions > Drills ---------- */
const TTABS = [['programme', 'Programme'], ['sessions', 'Sessions'], ['drills', 'Drills']];
export function training(el, [tab], ctx) {
  tab = TTABS.some(t => t[0] === tab) ? tab : (S.meta().trainTab || 'sessions');
  S.setMeta('trainTab', tab);
  const T = S.team().id; const td = today(); ctx.setTop({ title: 'Training' });
  let body = '';
  if (tab === 'sessions') {
    const all = S.sessions(T); const bs = S.blocks(T);
    const row = s => { const st = sessionStats(s); return `<a class="item" href="#/session/${s.id}"><span class="datetile">${s.date ? new Date(s.date + 'T12:00').getDate() : '?'}<span>${s.date ? new Date(s.date + 'T12:00').toLocaleDateString('en-GB', { month: 'short' }) : ''}</span></span><span class="grow"><span class="t" style="display:block">${esc(s.theme || 'No theme yet')}</span><span class="s">${fmtD(s.date)}${s.time ? ' · ' + esc(s.time) : ''} · ${st.drills.length} drill${st.drills.length === 1 ? '' : 's'} · ${st.total} min${s.fromTemplate ? ' · from a template' : ''}</span></span>${statusPill(s, td)}</a>`; };
    const groups = bs.map(b => ({ b, ss: all.filter(s => S.blockFor(T, s.date) === b) })).filter(g => g.ss.length);
    const loose = all.filter(s => !S.blockFor(T, s.date));
    body = `<div class="bigpicks">${bigBtn('newS', 'plus', 'Create your own', 'Start from a blank session', true, 'newSession')}${bigBtn('tplS', 'grid', 'Pick a template', 'Whole sessions from top coaches, drills included', false, 'pickSession')}</div>
      <div class="eyebrow">My sessions</div>
      ${all.length ? groups.map(g => `<div class="group card stack tight"><div class="row nowrap" style="gap:10px"><span class="pill">Block</span><a class="small grow" style="font-weight:600" href="#/block/${g.b.id}">${esc(g.b.title || 'Untitled block')}</a><span class="tiny muted">${fmtD(g.b.start)} to ${fmtD(addDays(S.blockEnd(g.b), -1))}</span></div><div class="list">${g.ss.map(row).join('')}</div></div>`).join('')
        + (loose.length ? `<div class="group card stack tight"><div class="row nowrap" style="gap:10px"><span class="pill grey">No block</span><span class="tiny muted grow">Dated outside any block in the programme</span></div><div class="list">${loose.map(row).join('')}</div></div>` : '')
        : '<div class="empty">No sessions yet. Create one, or pick a template to start from.</div>'}`;
  } else if (tab === 'drills') {
    const q = (S.meta().drillQ || '').toLowerCase();
    const ds = S.drills().filter(d => !q || (d.name + ' ' + d.type + ' ' + d.objective).toLowerCase().includes(q));
    body = `<div class="bigpicks">${bigBtn('newD', 'plus', 'Create your own', 'Draw it, write it, save it as yours', true, 'newDrill')}${bigBtn('libD', 'grid', 'Pick from the library', '36 practices from top coaches', false, 'pickDrill')}</div>
      <div class="row between"><div class="eyebrow" style="margin:0">My drills</div>${S.drills().length > 6 ? `<input type="search" id="dq" placeholder="Search my drills" value="${esc(S.meta().drillQ || '')}" style="max-width:260px">` : ''}</div>
      ${ds.length ? `<div class="grid3" id="myDrills">${ds.map(d => { const n = openCount(drillChallenges(d, T)); const lk = S.drillLinks(d, T).map(S.get).filter(Boolean);
        return `<a class="card link stack tight" href="#/drill/${d.id}" style="text-decoration:none;display:flex">${drillSvg(d, { style: 'width:100%;height:150px;border-radius:12px' })}<div class="row between nowrap"><span class="h3">${esc(d.name)}</span>${n ? `<span class="pill lamp">${n} to do</span>` : '<span class="pill good">Ready</span>'}</div><span class="tiny muted">${esc(d.type)} · ${d.minutes || '?'} min${d.tplId ? ' · from the library' : ' · your own'}${lk.length ? ' · ' + lk.map(p => esc(p.title)).join(', ') : ''}</span></a>`; }).join('')}</div>`
        : `<div class="empty">${q ? 'No drills match.' : 'No drills yet. Create your own, or pick one from the library to edit.'}</div>`}
      <p class="tiny muted" style="margin:0">Your drills come with you to any team you coach.</p>`;
  } else {
    body = `<div class="bigpicks">${bigBtn('newB', 'plus', 'Create your own', 'Start from a blank block', true, 'newBlock')}${bigBtn('tplB', 'grid', 'Pick a template', 'Four weeks on one theme, sessions and drills included', false, 'pickBlock')}</div>
      ${programmeHtml(T)}`;
  }
  const ss = S.sessions(T); const wk0 = addDays(td, -((new Date(td + 'T12:00').getDay() + 6) % 7)); const wk1 = addDays(wk0, 7);
  const blk = S.blockFor(T, td); const bw = blk ? Math.floor((new Date(td + 'T12:00') - new Date(blk.start + 'T12:00')) / 6048e5) + 1 : 0;
  el.innerHTML = `<div class="stack">${band('training', 'Training', blk ? 'Now: ' + esc(blk.title || 'Untitled block') : 'Programme holds sessions, sessions hold drills', [
    [ss.filter(s => s.date >= wk0 && s.date < wk1).length, 'Sessions this week'], [blk ? bw + '/' + (+blk.weeks || 1) : '–', blk ? 'Week of the block' : 'No block running'],
    [ss.filter(s => s.date && s.date >= td).length, 'Planned ahead'], [S.drills().length, 'My drills']])}
    <div class="seg tabs3" role="tablist" id="trainTabs">${TTABS.map(([k, l]) => `<a role="tab" aria-selected="${k === tab}" class="${k === tab ? 'on' : ''}" href="#/training/${k}">${l}</a>`).join('')}</div>
    ${body}</div>`;
  const dq = el.querySelector('#dq');
  if (dq) dq.oninput = () => { S.setMeta('drillQ', dq.value); clearTimeout(dq._t); dq._t = setTimeout(() => { ctx.refresh(); const n = el.querySelector('#dq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 350); };
  actions(el, {
    newS: () => newSession(), tplS: () => { S.setMeta('ideaWeek', null); ctx.go('#/ideas/sessions'); },
    newD: () => { const d = newDrill(); location.hash = '#/drill/' + d.id; }, libD: () => ctx.go('#/ideas/drills'),
    newB: () => newBlock(), tplB: () => { S.setMeta('ideaWeek', null); ctx.go('#/ideas/blocks'); }
  });
}

/* ---------- Match ---------- */
export function matches(el, params, ctx) {
  const T = S.team().id; const td = today(); ctx.setTop({ title: 'Match' });
  const all = S.matches(T); const up = all.filter(m => !m.date || m.date >= td).reverse(); const past = all.filter(m => m.date && m.date < td);
  const wl = m => { if (!hasResult(m)) return ''; const u = +m.result.us, th = +m.result.them; const k = u > th ? 'w' : u === th ? 'd' : 'l'; return `<span class="wdl ${k}">${k.toUpperCase()}</span>`; };
  const row = m => `<a class="item" href="#/match/${m.id}"><span class="datetile">${m.date ? new Date(m.date + 'T12:00').getDate() : '?'}<span>${m.date ? new Date(m.date + 'T12:00').toLocaleDateString('en-GB', { month: 'short' }) : ''}</span></span><span class="grow"><span class="t" style="display:block">v ${esc(m.opponent || 'Opponent not set')}${m.result && m.result.us !== '' && m.result.us != null ? ` · ${esc(m.result.us)}-${esc(m.result.them)}` : ''}</span><span class="s">${fmtD(m.date)}${m.ko ? ' · ' + esc(m.ko) : ''}${m.venue ? ' · ' + esc(m.venue) : ''}</span></span>${wl(m)}${statusPill(m, td)}</a>`;
  const res = all.filter(hasResult); const nx = up.find(m => m.date) || up[0];
  const wdl = res.reduce((a, m) => { const u = +m.result.us, th = +m.result.them; a[u > th ? 0 : u === th ? 1 : 2]++; a[3] += u; a[4] += th; return a; }, [0, 0, 0, 0, 0]);
  el.innerHTML = `<div class="stack">${band('match', 'Match', nx ? 'Next: v ' + esc(nx.opponent || 'opponent not set') + (nx.date ? ' · ' + fmtD(nx.date) : '') : 'Opposition analysis and your match day plan', [
    [nx ? dayMon(nx.date) : '–', nx ? 'Next match' : 'Nothing booked'], [res.length, 'Played'], [res.length ? wdl.slice(0, 3).join('-') : '–', 'W-D-L'], [res.length ? wdl[3] + '-' + wdl[4] : '–', 'Goals for-against']])}
    <div class="bigpicks">${bigBtn('newM', 'plus', 'New match', 'Add the fixture, then the opposition and your plan', true, 'newMatch')}${bigBtn('tplM', 'grid', 'Pick a template', 'Match day plans, timelines and half-time from The FA and top coaches', false, 'pickMatchTpl')}</div>
    ${up.length ? `<div class="eyebrow">Coming up</div><div class="list" id="matchesUp">${up.map(row).join('')}</div>` : '<div class="empty">No matches in the diary.</div>'}
    ${past.length ? `<div class="eyebrow">Played</div><div class="list">${past.map(row).join('')}</div>` : ''}</div>`;
  actions(el, { newM: () => newMatch(), tplM: () => ctx.go('#/mtemplates') });
}

/* ---------- Analysis ---------- */
export function analysis(el, params, ctx) {
  const T = S.team().id; ctx.setTop({ title: 'Analysis' });
  const due = S.reviewsDue(T); const rs = S.reviews(T);
  const doneN = rs.filter(reviewComplete).length; const last = rs.find(r => r.change);
  el.innerHTML = `<div class="stack">${band('analysis', 'Analysis', last ? 'Last change: ' + esc(last.change.slice(0, 70)) : 'What worked, what didn’t, and the one thing to change', [
    [due.length, 'To write up'], [doneN, 'Done'], [rs.filter(r => r.type === 'match').length, 'Matches'], [rs.filter(r => r.type !== 'match').length, 'Sessions']])}
    ${due.length ? `<div class="eyebrow">To write up</div><div class="list" id="anDue">${due.map(d => `<button class="item" data-act="rev" data-arg="${d.rec.id}"><span class="badge-num">${icon(d.kind === 'match' ? 'match' : 'training', 'style="width:20px;height:20px"')}</span><span class="grow"><span class="t" style="display:block">${d.kind === 'match' ? 'v ' + esc(d.rec.opponent) : esc(d.rec.theme || 'Session')}</span><span class="s">${d.kind === 'match' ? 'Match' : 'Session'} · ${fmtD(d.rec.date)}${d.started ? ' · started' : ''}</span></span><span class="btn sm pri">${d.started ? 'Finish' : 'Start'}</span></button>`).join('')}</div>` : ''}
    <div class="eyebrow">Done</div>
    ${rs.length ? `<div class="list" id="anList">${rs.map(r => { const ref = S.get(r.refId); const ok = reviewComplete(r);
      return `<a class="item" href="#/review/${r.id}"><span class="badge-num">${icon(r.type === 'match' ? 'match' : 'training', 'style="width:20px;height:20px"')}</span><span class="grow"><span class="t" style="display:block">${r.type === 'match' ? 'v ' + esc(ref ? ref.opponent : '?') : esc(ref ? ref.theme || 'Session' : 'Session')}</span><span class="s">${fmtD(r.date)}${r.change ? ' · next: ' + esc(r.change.slice(0, 60)) : ''}</span></span>${ok ? '<span class="pill an">Done</span>' : '<span class="pill lamp">Unfinished</span>'}</a>`; }).join('')}</div>`
      : '<div class="empty">Nothing yet. After every session and match the app asks for one, and the one thing you decide to change is what your next session is built from.</div>'}</div>`;
  actions(el, { rev: id => { const d = due.find(x => x.rec.id === id); startReview(d.kind, d.rec); } });
}

/* ---------- Sketch ---------- */
export function sketch(el, params, ctx) {
  const T = S.team().id; ctx.setTop({ back: '#/home', title: 'Sketch', sub: 'Think on a blank board' });
  const pm = S.playerMap(T);
  const bs = S.boards(T); const bsk = bs.filter(b => b.type === 'sketch'); const saved = bs.filter(b => b.type !== 'sketch');
  const dsk = S.drillSketches();
  const recent = [...bsk.map(b => ({ k: 'b', r: b })), ...dsk.map(d => ({ k: 'd', r: d }))].sort((a, b) => (b.r.upd || '').localeCompare(a.r.upd || ''));
  const card = (x, id) => x.k === 'b'
    ? `<a class="card link stack tight" href="#/board/${x.r.id}" style="text-decoration:none;display:flex">${frameSvg(x.r.frames[0] || { items: [], arrows: [] }, pm, { orient: 'h', style: 'width:100%;height:auto;border-radius:12px' })}
      <div class="row between nowrap"><span class="h3">${esc(x.r.name)}</span><span class="pill grey">${BOARD_LABEL(x.r.type === 'sketch' ? 'phase' : x.r.type)}</span></div><span class="tiny muted">${x.r.frames.length} frame${x.r.frames.length === 1 ? '' : 's'} · edited ${fmtAgo(x.r.upd)}</span></a>`
    : `<a class="card link stack tight" href="#/drill/${x.r.id}" style="text-decoration:none;display:flex">${drillSvg(x.r, { style: 'width:100%;height:150px;border-radius:12px' })}
      <div class="row between nowrap"><span class="h3">${esc(x.r.name)}</span><span class="pill grey">Drill</span></div><span class="tiny muted">edited ${fmtAgo(x.r.upd)}</span></a>`;
  el.innerHTML = `<div class="stack">
    <div class="bigpicks">${bigBtn('newT', 'board', 'Tactics', 'A full pitch with your team on it. Move, draw, add frames.', true, 'newSketch')}${bigBtn('newD', 'training', 'Drill', 'An area with cones and players, like a practice.', true, 'newDrillSketch')}</div>
    <div class="row between"><div class="eyebrow" style="margin:0">Recent sketches</div>${recent.length ? '<button class="btn sm" data-act="clear" id="clearSketches">Clear all</button>' : ''}</div>
    ${recent.length ? `<div class="grid3" id="sketches">${recent.map(card).join('')}</div><p class="tiny muted" style="margin:0">Sketches stay here until you save them somewhere with <b>Save to</b>, or delete them.</p>` : '<div class="empty">Nothing sketched yet.</div>'}
    ${saved.length ? `<div class="eyebrow">Saved boards</div><p class="tiny muted" style="margin:0">Shapes, phases and set pieces used by your game model and match plans.</p><div class="grid3" id="savedBoards">${saved.map(b => card({ k: 'b', r: b })).join('')}</div>` : ''}
  </div>`;
  const n = recent.length + 1;
  actions(el, {
    newT: () => { const b = S.create('board', T, { name: 'Sketch ' + n, type: 'sketch', sharePlayers: false, frames: [newBoardFrame(T, S.team().formation, '')] }); location.hash = '#/board/' + b.id; },
    newD: () => { const d = newDrill({ name: 'Sketch ' + n, sketch: true }); location.hash = '#/drill/' + d.id; },
    clear: async () => {
      if (!await confirmSheet('Clear all sketches?', `${recent.length} sketch${recent.length === 1 ? '' : 'es'} will be deleted. Anything you saved somewhere stays.`)) return;
      recent.forEach(x => S.del(x.r.id)); ctx.refresh();
    }
  });
}
