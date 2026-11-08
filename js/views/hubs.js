// The four areas behind the home tiles: Team, Training, Match and Analysis, plus Sketch.
// Training holds the hierarchy Programme > Sessions > Drills. Each area has its own colour.
import * as S from '../store.js';
import { esc, icon, today, fmtD, fmtAgo, addDays, actions, confirmSheet } from '../util.js';
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
export function teamHome(el, params, ctx) {
  const t = S.team(); const T = t.id; ctx.setTop({});
  const ps = S.principles(T); const agreed = ps.filter(p => p.status === 'agreed').length; const pl = S.players(T).length;
  el.innerHTML = `<div class="stack">${head('team', 'Team', esc(t.name) + (t.season ? ' · ' + esc(t.season) : ''))}
    <div class="tiles">
      <a class="tile" href="#/model" id="tModel">${icon('model')}<span class="t">Game model</span><span class="s">${ps.length} principle${ps.length === 1 ? '' : 's'}${ps.length ? ', ' + agreed + ' agreed' : ''}. Your shape and how you play.</span></a>
      <a class="tile" href="#/squad" id="tSquad">${icon('squad')}<span class="t">Squad</span><span class="s">${pl} player${pl === 1 ? '' : 's'}, development goals and player pages.</span></a>
      <a class="tile" href="#/sketch" id="tSketch">${icon('sketch')}<span class="t">Sketch</span><span class="s">A blank board for ideas and team talks.</span></a>
    </div>
    <a class="small" href="#/team/${T}">Team details: name, season, badge</a></div>`;
}

/* ---------- Training: Programme > Sessions > Drills ---------- */
const TTABS = [['programme', 'Programme'], ['sessions', 'Sessions'], ['drills', 'Drills']];
export function training(el, [tab], ctx) {
  tab = TTABS.some(t => t[0] === tab) ? tab : (S.meta().trainTab || 'sessions');
  S.setMeta('trainTab', tab);
  const T = S.team().id; const td = today(); ctx.setTop({});
  let body = '';
  if (tab === 'sessions') {
    const all = S.sessions(T); const bs = S.blocks(T);
    const row = s => { const st = sessionStats(s); return `<a class="item" href="#/session/${s.id}"><span class="badge-num" style="width:44px;height:44px;flex-direction:column;font-size:15px;line-height:1;border-radius:12px">${s.date ? new Date(s.date + 'T12:00').getDate() : '?'}<span style="font-size:10px;font-family:Inter;font-weight:600">${s.date ? new Date(s.date + 'T12:00').toLocaleDateString('en-GB', { month: 'short' }) : ''}</span></span><span class="grow"><span class="t" style="display:block">${esc(s.theme || 'No theme yet')}</span><span class="s">${fmtD(s.date)}${s.time ? ' · ' + esc(s.time) : ''} · ${st.drills.length} drill${st.drills.length === 1 ? '' : 's'} · ${st.total} min${s.fromTemplate ? ' · from a template' : ''}</span></span>${statusPill(s, td)}</a>`; };
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
    body = `<div class="row" style="justify-content:flex-end"><button class="btn pri" data-act="newB" id="newBlock">${icon('plus')}New block</button></div>
      <p class="small muted" style="margin:0">A block is four to six weeks on one or two principles. Sessions fall into a block by their date.</p>${programmeHtml(T)}`;
  }
  el.innerHTML = `<div class="stack">${head('training', 'Training', 'Programme holds sessions, sessions hold drills')}
    <div class="seg tabs3" role="tablist" id="trainTabs">${TTABS.map(([k, l]) => `<a role="tab" aria-selected="${k === tab}" class="${k === tab ? 'on' : ''}" href="#/training/${k}">${l}</a>`).join('')}</div>
    ${body}</div>`;
  const dq = el.querySelector('#dq');
  if (dq) dq.oninput = () => { S.setMeta('drillQ', dq.value); clearTimeout(dq._t); dq._t = setTimeout(() => { ctx.refresh(); const n = el.querySelector('#dq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 350); };
  actions(el, {
    newS: () => newSession(), tplS: () => { S.setMeta('ideaWeek', null); ctx.go('#/ideas/sessions'); },
    newD: () => { const d = newDrill(); location.hash = '#/drill/' + d.id; }, libD: () => ctx.go('#/ideas/drills'),
    newB: () => newBlock()
  });
}

/* ---------- Match ---------- */
export function matches(el, params, ctx) {
  const T = S.team().id; const td = today(); ctx.setTop({});
  const all = S.matches(T); const up = all.filter(m => !m.date || m.date >= td).reverse(); const past = all.filter(m => m.date && m.date < td);
  const row = m => `<a class="item" href="#/match/${m.id}"><span class="badge-num">${icon('match', 'style="width:20px;height:20px"')}</span><span class="grow"><span class="t" style="display:block">v ${esc(m.opponent || 'Opponent not set')}${m.result && m.result.us !== '' && m.result.us != null ? ` · ${esc(m.result.us)}-${esc(m.result.them)}` : ''}</span><span class="s">${fmtD(m.date)}${m.ko ? ' · ' + esc(m.ko) : ''}${m.venue ? ' · ' + esc(m.venue) : ''}</span></span>${statusPill(m, td)}</a>`;
  el.innerHTML = `<div class="stack">${head('match', 'Match', 'Opposition analysis and your match day plan')}
    <div class="bigpicks one">${bigBtn('newM', 'plus', 'New match', 'Add the fixture, then the opposition and your plan', true, 'newMatch')}</div>
    ${up.length ? `<div class="eyebrow">Coming up</div><div class="list" id="matchesUp">${up.map(row).join('')}</div>` : '<div class="empty">No matches in the diary.</div>'}
    ${past.length ? `<div class="eyebrow">Played</div><div class="list">${past.map(row).join('')}</div>` : ''}</div>`;
  actions(el, { newM: () => newMatch() });
}

/* ---------- Analysis ---------- */
export function analysis(el, params, ctx) {
  const T = S.team().id; ctx.setTop({});
  const due = S.reviewsDue(T); const rs = S.reviews(T);
  el.innerHTML = `<div class="stack">${head('analysis', 'Analysis', 'What worked, what didn’t, and the one thing to change')}
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
