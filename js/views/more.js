// More: Joe's profile, pathway (UEFA C to Pro), logbook, teams, cloud sync, backup.
import * as S from '../store.js';
import * as cloud from '../cloud.js';
import { CPD_TYPES, PHASES } from '../store.js';
import { esc, icon, today, fmtD, fmtDY, fmtAgo, bindFields, actions, debounce, confirmSheet, toast, sheet, closeSheet, shareFile } from '../util.js';
import { FORMATIONS } from '../pitch.js';
import { sessionStats } from '../challenges.js';

export default function more(el, params, ctx) {
  const c = S.coach(); ctx.setTop({});
  const save = debounce(() => S.put(c), 400);
  const st = cloud.status();
  el.innerHTML = `<div class="stack" style="max-width:720px">
    <div class="card row nowrap" style="gap:14px"><span class="badge-num" style="width:56px;height:56px;font-size:24px;background:var(--surface2)">${esc(c.initials || 'JE')}</span>
      <div class="grow row" style="gap:10px"><label class="field grow"><span>Your name</span><input type="text" data-f="name"></label><label class="field" style="width:90px"><span>Initials</span><input type="text" data-f="initials" maxlength="3"></label></div></div>
    <div class="list">
      ${[['#/pathway', 'ladder', 'Pathway: UEFA C to Pro', 'Where you are, the competences, and the evidence you’re building'],
        ['#/logbook', 'book', 'Coaching logbook', 'CPD and coaching hours'],
        ['#/teams', 'team', 'Teams', S.teams().map(t => t.name).join(', ') || 'Add your first team'],
        ['#/cloud', 'cloud', 'Cloud sync and backup', { off: 'This device only', signedout: 'Not signed in', ok: 'Synced ' + fmtAgo(st.last), syncing: 'Syncing…', error: 'Sync problem', offline: 'Offline' }[st.state] || '']]
        .map(([h, ic, t, s]) => `<a class="item" href="${h}"><span class="badge-num" style="background:var(--surface2);color:var(--accent)">${icon(ic, 'style="width:20px;height:20px"')}</span><span class="grow"><span class="t" style="display:block">${t}</span><span class="s">${esc(s)}</span></span>${icon('chev', 'style="width:18px;height:18px;color:var(--muted)"')}</a>`).join('')}
      <button class="item" data-act="startHere"><span class="badge-num" style="background:var(--surface2);color:var(--accent)">${icon('flag', 'style="width:20px;height:20px"')}</span><span class="grow"><span class="t" style="display:block">Start here</span><span class="s">The first-week set-up list and how the loop works</span></span>${icon('chev', 'style="width:18px;height:18px;color:var(--muted)"')}</button>
    </div>
    <p class="tiny muted">The Coaching Room</p></div>`;
  bindFields(el, c, () => save());
  actions(el, { startHere: () => { S.setMeta('startHereDone', false); location.hash = '#/home'; } });
  return () => save.flush();
}

/* ---------- Pathway ---------- */
const COMP = [
  ['Coach', 'Philosophy and values: a clear football vision and the coach’s role in it'], ['Coach', 'Coaching to the players’ age, experience and stage, with performance in focus'], ['Coach', 'Using different leadership and teaching styles'], ['Coach', 'Working with support staff and others around the team'],
  ['Player & team', 'Knowing each player’s needs; setting and reviewing individual goals with them'], ['Player & team', 'Building team dynamics: roles, standards, team goals, handling conflict'], ['Player & team', 'Managing physical load and recovery across the week'], ['Player & team', 'Supporting players with pressure, mindset and resilience'],
  ['Training', 'Building decision-making and problem-solving into sessions'], ['Training', 'Planning the week, month and season'], ['Training', 'Game-oriented sessions built around the next opponent'], ['Training', 'Plan, deliver, review: reflecting to improve the team'], ['Training', 'Player welfare, injury prevention and return to play'],
  ['Match', 'Reading and analysing matches and opponents'], ['Match', 'Using different formations and styles; positions and tasks within them'], ['Match', 'Preparing the team: selection, game plan, team talk'], ['Match', 'Coaching during the game and helping players solve problems themselves'], ['Match', 'Evaluating matches to improve training']
];
const WHERE = { 'Coach': 'Identity, game model, me as a coach', 'Player & team': 'Squad goals, focus players, observations', 'Training': 'Programme blocks, drills, sessions, reviews', 'Match': 'Opponent file, plan B, in-game decisions, reviews' };

function evidence() {
  const all = k => S.all(k); const td = today();
  const players = all('player'); const goals = players.flatMap(p => p.goals || []);
  const reviews = all('review'); const matches = all('match'); const sessions = all('session'); const drills = all('drill'); const principles = all('principle');
  const obs = reviews.reduce((a, r) => a + Object.values(r.playerObs || {}).filter(x => x && x.trim()).length, 0);
  const past = sessions.filter(s => s.date && s.date < td && !s.cancelled);
  const measured = reviews.filter(r => r.type === 'session' && r.rollingActual != null && r.rollingActual !== '');
  const blocks = all('block'); const c = S.coach();
  return [
    ['Player', 'Player development', [`${goals.length} development goals set`, `${goals.filter(g => g.status === 'done').length} achieved`, `${sessions.filter(s => (s.focusIds || []).length).length} sessions with named focus players`, `${obs} player observations in reviews`]],
    ['Game', 'Game understanding', [`${matches.filter(m => m.opp && m.opp.ip && m.opp.op).length} opposition analyses`, `${matches.filter(m => (m.plan || {}).planB).length} match plans with a plan B`, `${reviews.filter(r => r.type === 'match' && (r.goalsHow || '').trim()).length} match reviews with goals analysed`]],
    ['Game', 'Principles of play', [`${principles.length} principles (${principles.filter(p => p.status === 'agreed').length} agreed)`, `${principles.filter(p => (p.pops || []).length).length} tagged with principles of play`, `${principles.filter(p => (p.trigger || '').trim()).length} with a trigger`, `${drills.filter(d => Object.values(d.links || {}).some(l => l.length)).length} drills linked to principles`]],
    ['Coaching', 'Short-term programme planning', [`${blocks.length} training block${blocks.length === 1 ? '' : 's'} planned`, `${sessions.length} sessions planned`, `${sessions.filter(s => s.addresses && (s.addressesHow || '').trim()).length} acting on a review, with how`, `${reviews.filter(r => r.carried && r.lastChangeDone != null).length} changes followed up in the next review`]],
    ['Coaching', 'Coaching behaviours and practice', [`${drills.filter(d => (d.questions || '').trim()).length} drills with planned questions`, `${drills.filter(d => (d.transition || '').trim()).length} with transition built in`, `${measured.length} sessions with ball rolling measured (${measured.filter(r => +r.rollingActual >= 70).length} at 70%+); ${past.filter(s => sessionStats(s).rolling >= 70).length} of ${past.length} planned at 70%+`, `${reviews.filter(r => (r.why || []).includes('delivery')).length} reviews looking at your delivery`]],
    ['Self', 'Coaching strengths and areas for development', [`${reviews.filter(r => (r.self || '').trim()).length} self-reflections`, (c.strengths || c.develop) ? 'Strengths and development profile written' : 'Strengths and development profile not written yet', `${all('cpd').reduce((a, x) => a + (+x.hours || 0), 0)} CPD hours logged`]]
  ];
}

export function pathwayView(el, params, ctx) {
  const c = S.coach(); c.ratings ||= {}; c.ratingLog ||= [];
  ctx.setTop({ back: '#/more', title: 'Pathway', sub: 'UEFA C to Pro' });
  const areas = [...new Set(COMP.map(x => x[0]))];
  const save = debounce(() => S.put(c), 400);
  const selfs = S.all('review').filter(r => (r.self || '').trim()).sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 8);
  const rung = (name, now, hrs, txt) => `<div class="card stack tight" style="${now ? 'border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)' : ''}"><div class="row between"><div class="h2">${name}</div>${now ? '<span class="pill">Enrolled</span>' : ''}</div><div class="tiny muted">${hrs}</div><div class="small" style="color:var(--text2)">${txt}</div></div>`;
  el.innerHTML = `<div class="stack">
    <p class="lead">Four UEFA licences, from the C to the Pro. This page keeps the destination in view and builds the evidence as you go, from what you already do in the app.</p>
    <div class="grid2" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
      ${rung('UEFA C', true, 'At least 60 hours of course', 'Plan, deliver and review sessions that give players a positive experience. The FA assesses six competencies in four themes (below). You need to be coaching a team.')}
      ${rung('UEFA B', false, 'At least 120 hours · in England, 12 months after the C', 'The FA’s modules: developing a game model, coaching approach, individual tactics. The UEFA syllabus includes a player profiling system and a personal coaching logbook.')}
      ${rung('UEFA A', false, 'At least 180 hours', 'Strategy and tactics, systems of play, position-specific coaching. Match plans built from your playing philosophy and the opponent.')}
      ${rung('UEFA Pro', false, 'At least 360 hours', 'The head coach at professional level: leadership, staff, seasonal tactical and physical plans.')}
    </div>
    <div class="card small">On 11 September 2026 UEFA asked national associations to open more UEFA Pro places for female coaches and for coaches working in women’s football (four extra places per course, or extra courses with half the places reserved). UEFA doesn’t define who counts as a women’s-football coach; The FA decides who gets those places, and the context is the professional women’s game. Coaching Thornaby Women is a start, not a ticket. Check the entry criteria with The FA when the time comes.</div>
    <div class="h2" style="margin-top:6px">Me as a coach</div>
    <p class="small muted" style="margin:0">The C course’s “Self” theme and the Pro profile both start here: a standing view of your strengths and what you’re working on, distilled from your reviews. Rewrite it every few weeks; don’t let it become a diary.</p>
    <div class="card stack">
      <div class="grid2"><label class="field"><span>Strengths: what you do well, with evidence</span><textarea data-f="strengths" placeholder="e.g. Questions that open the decision up (players answered without me telling them, three reviews running)"></textarea></label>
      <label class="field"><span>Areas for development</span><textarea data-f="develop" placeholder="e.g. I stop practices for everything. Talk ran to 35% in two of the last four sessions."></textarea></label></div>
      <label class="field"><span>What I’m working on now, and how I’ll know</span><input type="text" data-f="workingOn" placeholder="e.g. Max three stoppages per practice; count them in every review until Christmas"></label>
      ${selfs.length ? `<details><summary class="tiny muted" style="cursor:pointer">Your last ${selfs.length} reflections</summary><div class="stack tight" style="margin-top:6px">${selfs.map(r => `<div class="small" style="padding:4px 0;border-top:1px solid var(--line)"><span class="muted">${fmtD(r.date)} · ${r.type}:</span> ${esc(r.self)}</div>`).join('')}</div></details>` : '<div class="tiny muted">Your “me as a coach” lines from reviews will collect here.</div>'}
    </div>
    <div class="h2" style="margin-top:6px">UEFA C evidence so far</div>
    <p class="small muted" style="margin:0">Counted automatically from your plans and reviews across all teams. Paraphrased from The FA’s UEFA C competencies.</p>
    <div class="grid3">${evidence().map(([th, comp, ls]) => `<div class="card stack tight"><div class="eyebrow">${th}</div><div class="h3">${comp}</div><ul class="small" style="margin:0;padding-left:18px;color:var(--text2)">${ls.map(l => `<li>${esc(l)}</li>`).join('')}</ul></div>`).join('')}</div>
    <div class="h2" style="margin-top:6px">Pro competences: where are you now?</div>
    <p class="small muted" style="margin:0">Rate 1 (not started) to 4 (strong). Paraphrased from the UEFA Pro syllabus (2020 Coaching Convention). Re-rate every few months; the history shows progress for course applications.</p>
    ${areas.map(a => `<div class="card stack tight"><div class="row between"><div class="h3">${a}</div><span class="tiny muted">Trained in: ${WHERE[a]}</span></div>
      ${COMP.map((x, i) => [x, i]).filter(([x]) => x[0] === a).map(([x, i]) => `<div class="row between" style="padding:8px 0;border-top:1px solid var(--line)"><span class="small" style="flex:1;min-width:200px">${esc(x[1])}</span><div class="seg" style="width:200px">${[1, 2, 3, 4].map(v => `<button class="${c.ratings[i] === v ? 'on' : ''}" data-act="rate" data-arg="${i}:${v}">${v}</button>`).join('')}</div></div>`).join('')}</div>`).join('')}
    <div class="card stack tight"><div class="h3">Rating history</div>${c.ratingLog.length ? c.ratingLog.slice(-15).reverse().map(l => `<div class="small" style="padding:4px 0;border-top:1px solid var(--line)">${fmtD(l.date)} · ${esc(COMP[l.i][1])}: ${l.from || '–'} → ${l.to}</div>`).join('') : '<div class="small muted">Nothing rated yet.</div>'}</div>
    <p class="tiny muted">Sources: UEFA coaching licences overview; UEFA Coaching Convention syllabus of minimum content (Pro competences paraphrased from the 2020 edition; UEFA issued 2025 editions, so check the current one); The FA course pages for UEFA C, B, A and Pro. Course details change, so check with The FA.</p></div>`;
  bindFields(el, c, () => save());
  actions(el, { rate: a => { const [i, v] = a.split(':').map(Number); if (c.ratings[i] !== v) { c.ratingLog.push({ date: today(), i, from: c.ratings[i] || 0, to: v }); c.ratings[i] = v; S.put(c); } ctx.refresh(); } });
  return () => save.flush();
}

/* ---------- Logbook ---------- */
export function logbookView(el, params, ctx) {
  ctx.setTop({ back: '#/more', title: 'Logbook', sub: 'CPD and coaching hours' });
  const es = S.cpd(); const td = today();
  const delivered = S.all('session').filter(s => s.date && s.date < td && !s.cancelled);
  const mins = delivered.reduce((a, s) => a + sessionStats(s).total, 0);
  const games = S.all('match').filter(m => m.date && m.date < td && !m.cancelled).length;
  const hrs = es.reduce((a, x) => a + (+x.hours || 0), 0);
  el.innerHTML = `<div class="stack" style="max-width:820px">
    <div class="grid3" style="grid-template-columns:repeat(3,minmax(0,1fr))">${[[hrs, 'CPD hours'], [Math.round(mins / 6) / 10, 'Hours coaching'], [games, 'Matches']].map(([n, l]) => `<div class="card stack tight" style="align-items:center"><div class="display" style="font-size:40px;color:var(--accent)">${n}</div><div class="tiny muted">${l}</div></div>`).join('')}</div>
    <p class="tiny muted" style="margin:0">Coaching hours count delivered sessions across all your teams. Add courses, workshops, observations and mentor chats below.</p>
    <button class="btn pri" data-act="add">${icon('plus')}Add to logbook</button>
    ${es.length ? `<div class="list">${es.map(x => `<button class="item" data-act="edit" data-arg="${x.id}"><span class="grow"><span class="t" style="display:block">${esc(x.title || x.type)}</span><span class="s">${fmtD(x.date)} · ${esc(x.type)} · ${esc(x.hours || 0)} h${x.learned ? ' · ' + esc(x.learned.slice(0, 70)) : ''}</span></span></button>`).join('')}</div>` : '<div class="empty">Nothing logged yet.</div>'}</div>`;
  const edit = x => {
    const s = sheet(`<div class="stack"><div class="h2">${x ? 'Edit entry' : 'Add to logbook'}</div>
      <div class="row nowrap"><label class="field" style="width:160px"><span>Date</span><input type="date" id="lD" value="${esc(x ? x.date : today())}"></label><label class="field" style="width:100px"><span>Hours</span><input type="number" inputmode="decimal" step="0.5" id="lH" value="${esc(x ? x.hours : 1)}"></label></div>
      <label class="field"><span>Type</span><select id="lT">${CPD_TYPES.map(t => `<option ${x && x.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="field"><span>What</span><input type="text" id="lN" value="${esc(x ? x.title : '')}" placeholder="e.g. Watched Middlesbrough Women train"></label>
      <label class="field"><span>What I learned, and how I’ll use it</span><textarea id="lL">${esc(x ? x.learned : '')}</textarea></label>
      <div class="row">${x ? '<button class="btn danger" id="lX">Delete</button>' : ''}<div class="grow"></div><button class="btn" id="lC">Cancel</button><button class="btn pri" id="lS">Save</button></div></div>`);
    s.querySelector('#lC').onclick = closeSheet;
    s.querySelector('#lS').onclick = () => {
      const f = { date: s.querySelector('#lD').value, hours: +s.querySelector('#lH').value || 0, type: s.querySelector('#lT').value, title: s.querySelector('#lN').value.trim(), learned: s.querySelector('#lL').value.trim() };
      if (x) S.put(Object.assign(x, f)); else S.create('cpd', null, f);
      closeSheet(); ctx.refresh();
    };
    s.querySelector('#lX')?.addEventListener('click', () => { S.del(x.id); closeSheet(); ctx.refresh(); });
  };
  actions(el, { add: () => edit(null), edit: id => edit(S.get(id)) });
}

/* ---------- Teams ---------- */
export function teamsView(el, params, ctx) {
  ctx.setTop({ back: '#/more', title: 'Teams' });
  const ts = S.teams(); const cur = S.team();
  el.innerHTML = `<div class="stack" style="max-width:720px">
    <p class="lead" style="margin:0">Each team has its own squad, game model, boards, sessions, matches and reviews. Your drill library, logbook and pathway stay with you.</p>
    ${ts.length ? `<div class="list">${ts.map(t => `<a class="item" href="#/team/${t.id}"><span class="badge-num">${esc(t.name[0] || '?')}</span><span class="grow"><span class="t" style="display:block">${esc(t.name)}</span><span class="s">${esc([t.season, S.players(t.id).length + ' players', t.archived ? 'archived' : '', cur && cur.id === t.id ? 'current' : ''].filter(Boolean).join(' · '))}</span></span>${icon('chev', 'style="width:18px;height:18px;color:var(--muted)"')}</a>`).join('')}</div>` : '<div class="empty">No teams yet. Add the team you coach.</div>'}
    <a class="btn pri" href="#/team/new">${icon('plus')}Add a team</a></div>`;
}

export function teamView(el, [id], ctx) {
  if (id === 'new') {
    ctx.setTop({ back: '#/teams', title: 'New team' });
    const ts = S.teams();
    el.innerHTML = `<div class="card stack" style="max-width:620px">
      <label class="field"><span>Team name</span><input type="text" id="tN" placeholder="e.g. Thornaby FC Women" autofocus></label>
      <div class="grid2"><label class="field"><span>Club</span><input type="text" id="tC"></label><label class="field"><span>Season</span><input type="text" id="tS" placeholder="2026/27"></label></div>
      <label class="field"><span>Base formation</span><select id="tF">${Object.keys(FORMATIONS).map(f => `<option>${esc(f)}</option>`).join('')}</select></label>
      ${ts.length ? `<label class="field"><span>Start the game model from</span><select id="tP"><option value="">A blank game model</option>${ts.map(t => `<option value="${t.id}">A copy of ${esc(t.name)}’s principles</option>`).join('')}</select></label><p class="tiny muted" style="margin:0">A new group may need very different principles. Copies come in as drafts.</p>` : ''}
      <div class="row" style="justify-content:flex-end"><a class="btn" href="#/teams">Cancel</a><button class="btn pri" id="tGo">Create team</button></div></div>`;
    el.querySelector('#tGo').onclick = () => {
      const name = el.querySelector('#tN').value.trim(); if (!name) return toast('Give the team a name');
      const t = S.newTeam({ name, club: el.querySelector('#tC').value.trim(), season: el.querySelector('#tS').value.trim(), formation: el.querySelector('#tF').value }, el.querySelector('#tP')?.value || null);
      S.setTeam(t.id); toast('Now add the squad'); location.hash = '#/squad';
    };
    return;
  }
  const t = S.get(id);
  if (!t) { ctx.setTop({ back: '#/teams', title: 'Team' }); el.innerHTML = '<div class="empty">This team has been deleted.</div>'; return; }
  ctx.setTop({ back: '#/teams', title: t.name });
  const save = debounce(() => S.put(t), 400);
  const counts = ['player', 'principle', 'board', 'session', 'match', 'review'].map(k => [k, S.all(k, t.id).length]);
  el.innerHTML = `<div class="stack" style="max-width:620px"><div class="card stack">
    <label class="field"><span>Team name</span><input type="text" data-f="name"></label>
    <div class="grid2"><label class="field"><span>Short name</span><input type="text" data-f="short"></label><label class="field"><span>Club</span><input type="text" data-f="club"></label></div>
    <div class="grid2"><label class="field"><span>Season</span><input type="text" data-f="season"></label><label class="field"><span>Base formation</span><select data-f="formation">${Object.keys(FORMATIONS).map(f => `<option ${f === t.formation ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select></label></div>
    <label class="check"><input type="checkbox" data-f="archived"> Archived (a team you no longer coach; kept for your records)</label></div>
    <div class="card small muted">${counts.map(([k, n]) => `${n} ${k}${n === 1 ? '' : 's'}`).join(' · ')}</div>
    <div class="row">${S.team() && S.team().id === t.id ? '<span class="pill">Current team</span>' : `<button class="btn pri" data-act="use">Switch to this team</button>`}<div class="grow"></div><button class="btn danger" data-act="del">${icon('trash')}Delete team</button></div></div>`;
  bindFields(el, t, () => save());
  actions(el, {
    use: () => { S.setTeam(t.id); location.hash = '#/home'; },
    del: async () => {
      if (!await confirmSheet('Delete ' + t.name + '?', 'This deletes its squad, game model, boards, sessions, matches and reviews on every device. Archiving keeps them. Your drill library is not affected.', 'Delete everything')) return;
      ['player', 'principle', 'board', 'session', 'match', 'review'].forEach(k => S.all(k, t.id).forEach(r => S.del(r.id)));
      S.del(t.id); const next = S.teams()[0]; if (next) S.setTeam(next.id); location.hash = next ? '#/home' : '#/teams';
    }
  });
  return () => save.flush();
}

/* ---------- Cloud sync and backup ---------- */
export function cloudView(el, params, ctx) {
  ctx.setTop({ back: '#/more', title: 'Cloud sync', sub: 'and backup' });
  const st = cloud.status(); const dirty = S.dirtyRecs().length;
  let body;
  if (!cloud.configured()) {
    body = `<div class="card stack tight"><div class="h3">This device only</div>
      <p class="small muted" style="margin:0">Everything is saved in this browser on this device. To have the same data on your phone, iPad and laptop, and to switch on player and staff links, connect a free Supabase database once. The README file that came with the app walks through it step by step (about 15 minutes). Until then, use backups below to move data between devices.</p></div>`;
  } else if (!cloud.signedIn()) {
    body = `<div class="card stack"><div class="h3">Sign in</div><p class="small muted" style="margin:0">Use the same email and password on every device.</p>
      <label class="field"><span>Email</span><input type="email" id="cE" autocomplete="username" inputmode="email"></label>
      <label class="field"><span>Password</span><input type="password" id="cP" autocomplete="current-password"></label>
      <div class="row"><button class="btn pri" id="cIn">Sign in</button><button class="btn" id="cUp">Create account</button><button class="btn sm" id="cFg">Forgot password</button></div>
      <div class="small" id="cMsg" role="status"></div></div>`;
  } else {
    body = `<div class="card stack tight"><div class="row between"><div><div class="h3">${esc(cloud.email())}</div><div class="small muted">${{ ok: 'Synced', syncing: 'Syncing…', error: 'Sync problem: ' + esc(st.err), offline: 'Offline: changes are saved here and sync when you’re back online' }[st.state] || ''}</div></div><span class="pill ${st.state === 'ok' ? 'good' : st.state === 'error' ? 'opp' : 'grey'}">${fmtAgo(st.last)}</span></div>
      <div class="small muted">${dirty ? dirty + ' change' + (dirty > 1 ? 's' : '') + ' waiting to upload.' : 'Everything on this device is uploaded.'}</div>
      <div class="row"><button class="btn pri" id="cSync">${icon('rotate')}Sync now</button><button class="btn" id="cOut">Sign out</button></div></div>`;
  }
  const skew = cloud.clockSkewText();
  const cons = S.conflicts();
  const field = v => typeof v === 'string' ? v : JSON.stringify(v);
  const diffs = c => { const now = S.get(c.id) || {}; return Object.keys(c.mine).filter(k => !['id', 'kind', 'team', 'upd', 'del', 'created', 'share'].includes(k) && field(c.mine[k]) !== field(now[k]) && (c.mine[k] !== '' && c.mine[k] != null)); };
  el.innerHTML = `<div class="stack" style="max-width:640px">${body}
    ${skew ? `<div class="card stack tight" style="border-color:var(--bad)"><div class="h3" style="color:var(--bad)">Check this device’s clock</div><div class="small">${esc(skew)}</div></div>` : ''}
    ${cons.length ? `<div class="card stack tight" style="border-color:var(--lamp-line)"><div class="h3" style="color:var(--lamp)">Edits replaced by another device</div>
      <p class="small muted" style="margin:0">Sync keeps the last edit of a whole item. These edits were made here but a newer copy arrived from another device before they were sent. Nothing is lost: copy what you want back into the item, then dismiss.</p>
      ${cons.slice().reverse().map(c => `<details class="card inset"><summary class="small" style="cursor:pointer"><b>${esc(c.name)}</b> <span class="muted">· ${esc(c.kind)} · ${fmtAgo(c.at)}</span></summary>
        <div class="stack tight" style="margin-top:8px">${diffs(c).map(k => `<div class="small"><span class="eyebrow">${esc(k)}</span><br>${esc(field(c.mine[k]))}</div>`).join('') || '<div class="small muted">No text differences (the change was in a diagram or a list).</div>'}
        <div class="row">${['session', 'match', 'drill', 'board', 'principle', 'player', 'review', 'team'].includes(c.kind) ? `<a class="btn sm" href="#/${c.kind}/${c.id}">Open the current version</a>` : ''}<button class="btn sm" data-dismiss="${c.id}">Dismiss</button></div></div></details>`).join('')}</div>` : ''}
    <div class="card stack tight"><div class="h3">Backup</div><p class="small muted" style="margin:0">Download everything as one file. Keep a copy somewhere safe, or use it to move data to another device.</p>
      <div class="row"><button class="btn" id="bEx">${icon('share')}Download backup</button><label class="btn" style="cursor:pointer">Restore from file<input type="file" id="bIm" accept=".json,application/json" hidden></label></div></div></div>`;
  const msg = t => { const m = el.querySelector('#cMsg'); if (m) m.textContent = t; };
  const creds = () => [el.querySelector('#cE').value, el.querySelector('#cP').value];
  el.querySelector('#cIn')?.addEventListener('click', async () => { msg('Signing in…'); try { await cloud.signIn(...creds()); toast('Signed in. Syncing…'); ctx.refresh(); } catch (e) { msg(e.message); } });
  el.querySelector('#cUp')?.addEventListener('click', async () => { const [e, p] = creds(); if (p.length < 8) return msg('Use a password of at least 8 characters.'); msg('Creating…'); try { const live = await cloud.signUp(e, p); if (live) { toast('Account created'); ctx.refresh(); } else msg('Check your email and tap the confirmation link, then come back and sign in.'); } catch (er) { msg(er.message); } });
  el.querySelector('#cFg')?.addEventListener('click', async () => { const [e] = creds(); if (!e) return msg('Type your email first.'); try { await cloud.resetPassword(e); msg('If that email has an account, a reset link is on its way.'); } catch (er) { msg(er.message); } });
  el.querySelector('#cSync')?.addEventListener('click', async () => { await cloud.sync(); ctx.refresh(); });
  el.querySelector('#cOut')?.addEventListener('click', async () => { if (await confirmSheet('Sign out on this device?', 'Your data stays on this device and in the cloud.', 'Sign out', false)) { await cloud.signOut(); ctx.refresh(); } });
  el.querySelectorAll('[data-dismiss]').forEach(b => b.onclick = () => { S.dropConflict(b.dataset.dismiss); ctx.refresh(); });
  el.querySelector('#bEx').onclick = () => shareFile(new Blob([S.exportAll()], { type: 'application/json' }), `coaching-room-backup-${today()}.json`, 'Coaching Room backup');
  el.querySelector('#bIm').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { const n = S.importAll(await f.text()); toast(`Restored ${n} item${n === 1 ? '' : 's'} (newer copies kept)`); ctx.refresh(); } catch (er) { toast(er.message); }
  };
  const off = () => {}; return off;
}
