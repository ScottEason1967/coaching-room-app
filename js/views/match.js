// Match plan: opposition analysis set against the game model, keys to winning,
// individual instructions, boards, and the challenge that asks what will win it.
import * as S from '../store.js';
import { PHASES, TAGS } from '../store.js';
import { esc, icon, today, fmtD, lines, bindFields, actions, debounce, confirmSheet, toast, sheet, closeSheet } from '../util.js';
import { frameSvg } from '../pitch.js';
import { matchChallenges, openCount, threatened, chalJump, paintChal, focusField } from '../challenges.js';
import { printMatch, printInstructionCards } from '../print.js';
import { reviewGate, startReview } from './review.js';
import { shareSheet, refreshIfShared, refreshPlayers } from './sharing.js';
import { newBoardSheet, BOARD_TYPES, BOARD_LABEL } from './board.js';
import * as cloud from '../cloud.js';

export function newMatch() {
  const T = S.team().id;
  reviewGate(T, () => {
    const m = S.create('match', T, { opponent: '', date: '', ko: '', venue: '', comp: '', src: '', tags: {}, opp: {}, plan: { keys: '', threat: '', first: '', planB: '', subs: '', ip: '', op: '', sp: '', spAgainst: '', selection: '', talk: '', focusIds: [], principleNotes: {} }, instructions: {}, boardIds: [], squadIds: [], result: { us: '', them: '' } });
    S.setMeta('matchTab', 'them');
    location.hash = '#/match/' + m.id;
  }, 'plan the next match');
}

const TABS = [['them', 'Them'], ['plan', 'Plan'], ['squad', 'Squad'], ['boards', 'Boards'], ['day', 'Day']];
// Two parts: the opposition analysis, and the match day plan (plan, team selection, boards, the day).
const PLAN_TABS = [['plan', 'How we play'], ['squad', 'Team selection'], ['boards', 'Boards and set pieces'], ['day', 'On the day']];

export default function matchView(el, [id], ctx) {
  const m = S.get(id);
  if (!m) { ctx.setTop({ back: '#/matches', title: 'Match' }); el.innerHTML = '<div class="empty">This match plan has been deleted.</div>'; return; }
  const T = m.team; m.tags ||= {}; m.opp ||= {}; m.plan ||= {}; m.plan.principleNotes ||= {}; m.plan.focusIds ||= []; m.instructions ||= {}; m.boardIds ||= []; m.squadIds ||= [];
  const prev = S.previousMeetings(T, m); const trained = S.trainedBefore(T, m);
  const focusSet = new Set(m.plan.focusIds); const suggested = threatened(m, T);
  const prevReview = x => S.reviewOf(x);
  const tab = S.meta().matchTab || 'them';
  ctx.setTop({ back: '#/matches', title: m.opponent ? 'v ' + m.opponent : 'New match plan', sub: fmtD(m.date) });
  const save = debounce(() => S.put(m), 400);
  const ps = S.principles(T); const squad = new Set(m.squadIds); const players = S.players(T);
  const boards = m.boardIds.map(S.get).filter(Boolean); const pm = S.playerMap(T);
  const played = m.date && m.date <= today();
  const ta = (f, label, ph, rows = '') => `<label class="field"><span>${label}</span><textarea data-f="${f}" placeholder="${esc(ph || '')}" ${rows}></textarea></label>`;

  const body = {
    them: () => `${prev.length ? `<div class="card stack tight" id="oppFile" style="border-color:var(--accent-line)"><div class="h3">Opponent file: ${esc(m.opponent)}</div>
        ${prev.map(x => { const r = prevReview(x); return `<div class="small" style="padding:6px 0;border-top:1px solid var(--line)"><a href="#/match/${x.id}"><b>${fmtD(x.date)}</b>${x.result && x.result.us !== '' && x.result.us != null ? ` · ${esc(x.result.us)}-${esc(x.result.them)}` : ''}</a>${lines((x.plan || {}).keys).length ? `<br><span class="muted">Keys then:</span> ${lines(x.plan.keys).map(esc).join('; ')}` : ''}${r && r.them ? `<br><span class="muted">What they did that we didn’t expect:</span> ${esc(r.them)}` : ''}${r && r.didnt ? `<br><span class="muted">What didn’t work for us:</span> ${esc(r.didnt)}` : ''}</div>`; }).join('')}
        ${!(m.opp.ip || m.opp.op) && prev.some(x => x.opp && (x.opp.ip || x.opp.op)) ? `<button class="btn sm" data-act="copyPrev">Start from last time’s analysis</button>` : ''}</div>` : ''}
      <div class="card stack"><div class="h3">How they play</div>
        <div class="grid2">${Object.entries(TAGS).map(([k, tg]) => `<label class="field"><span>${tg.lab}</span><select data-f="tags.${k}"><option value="">Not known</option>${tg.opts.map(o => `<option ${o === m.tags[k] ? 'selected' : ''}>${o}</option>`).join('')}</select></label>`).join('')}</div>
        <label class="field"><span>Where this comes from</span><input type="text" data-f="src" placeholder="e.g. Hudl v Stockport, watched live, league table"></label></div>
      <div class="card stack">${ta('opp.ip', 'In possession', 'How do they build and attack?')}${ta('opp.op', 'Out of possession', 'How and where do they defend and press?')}${ta('opp.ta', 'When they win it', 'Counter, or keep it?')}${ta('opp.td', 'When they lose it', 'Counter-press, or drop?')}${ta('opp.sp', 'Set pieces', 'Corners, free kicks, throws, for and against')}${ta('opp.people', 'Key individuals', 'Who to stop, who to target')}</div>`,
    plan: () => `<div class="card stack" style="border-color:var(--accent-line)">${ta('plan.keys', 'What wins us the game? One per line', 'e.g. Attack their weak full-back with our best winger', 'style="min-height:110px"')}${ta('plan.threat', 'Their biggest threat, and our answer')}
        ${ta('plan.first', 'The first ten minutes: what we expect, what we want', 'e.g. They’ll go long early and foul. We keep the ball on the floor, no reaction, first switch inside two minutes.')}</div>
      <div class="card stack" style="border-color:var(--lamp-line)"><div class="h3">Match management</div>
        ${ta('plan.planB', 'Plan B: the trigger that tells you it isn’t working, and what you change', 'e.g. If we’ve lost it in our half three times by 20 minutes: GK goes long to the 9, 8s on second balls.')}
        ${ta('plan.subs', 'Substitutions: who comes on for what, who moves where', 'e.g. 60 min: 14 for 11 if we’re chasing; 7 moves to the left. Keep 16 for the last 15 if we’re holding.')}</div>
      <div class="card stack">${ta('plan.ip', 'Our plan in possession')}${ta('plan.op', 'Our plan out of possession')}${ta('plan.sp', 'Our set pieces', 'Corners, wide free kicks, throws: the routine and why against this keeper and marking')}${ta('plan.spAgainst', 'Their set pieces', 'Who marks whom, zonal or man, who stays up')}</div>
      ${trained.length ? `<div class="card stack tight" id="trained"><div class="h3">Trained this week</div>${trained.map(x => `<div class="small"><a href="#/session/${x.id}">${fmtD(x.date)}: ${esc(x.theme || 'session')}</a>${(x.principleIds || []).length ? ` <span class="muted">· ${x.principleIds.map(S.get).filter(Boolean).map(p => esc(p.title)).join(', ')}</span>` : ''}${x.matchPrep ? ' <span class="pill good">match prep</span>' : ''}</div>`).join('')}<div class="tiny muted">If what you trained isn’t in the keys or the principles under test, either put it in or ask why you trained it.</div></div>` : ''}
      <div class="card stack" id="focusPrinciples"><div class="h3">Principles under test</div><p class="tiny muted" style="margin:0">Which two or three does this opponent threaten most? Pick them; the review scores these first.${suggested.length ? ' Suggested from the tags are marked.' : ''}</p>
        ${ps.length ? `<div class="chips">${ps.map(p => `<button class="chip ${focusSet.has(p.id) ? 'on' : ''}" data-act="focus" data-arg="${p.id}"><span class="dot" style="color:${PHASES[p.phase].col}"></span>${esc(p.title)}${suggested.includes(p.id) && !focusSet.has(p.id) ? ' <span style="color:var(--lamp)">?</span>' : ''}</button>`).join('')}</div>
        ${m.plan.focusIds.map(S.get).filter(Boolean).map(p => `<label class="field"><span><span class="dot" style="display:inline-block;color:${PHASES[p.phase].col};margin-right:6px"></span>${esc(p.title)} · ${PHASES[p.phase].short}: keep it, tweak it, or accept the risk?</span><textarea data-f="plan.principleNotes.${p.id}" style="min-height:60px" placeholder="${esc(p.trigger ? 'Trigger: ' + p.trigger + (p.ifNot ? ' · If not: ' + p.ifNot : '') : '')}"></textarea></label>`).join('')}` : '<div class="small" style="color:var(--lamp)">No principles in your game model yet.</div>'}</div>`,
    squad: () => `<div class="card stack tight" id="squadChips"><div class="row between"><div class="h3">Squad (${m.squadIds.length})</div><div class="row" style="gap:6px"><button class="btn sm" data-act="squadAll">All</button><button class="btn sm" data-act="squadNone">None</button></div></div>
        <div class="chips">${players.map(p => `<button class="chip ${squad.has(p.id) ? 'on' : ''}" data-act="sq" data-arg="${p.id}"><b>${esc(p.num)}</b> ${esc(p.name)}</button>`).join('')}</div>
        ${ta('plan.selection', 'Selection notes', 'Starting XI, subs plan, who plays where')}</div>
      ${m.squadIds.length ? `<div class="card stack" id="instructions"><div class="h3">Individual instructions</div><p class="tiny muted" style="margin:0">Each player sees only her own on her player page.</p>
        ${m.squadIds.map(S.get).filter(Boolean).map(p => `<label class="field"><span>${esc(p.num)} · ${esc(p.name)}${p.pos ? ` <span class="muted">(${esc(p.pos)})</span>` : ''}</span><textarea data-f="instructions.${p.id}" style="min-height:60px" placeholder="Her job against this opponent"></textarea></label>`).join('')}</div>` : ''}`,
    boards: () => `<div class="stack" id="boards">${boards.length ? `<div class="grid2">${boards.map(b => `<div class="card stack tight"><a href="#/board/${b.id}">${frameSvg(b.frames[0] || { items: [], arrows: [] }, pm, { orient: 'h', style: 'width:100%;height:auto;border-radius:12px' })}</a><div class="row between nowrap"><span class="h3">${esc(b.name)}</span><span class="pill ${b.type === 'setpiece' ? 'lamp' : 'grey'}">${BOARD_LABEL(b.type)}</span></div><div class="row"><span class="tiny muted grow">${b.sharePlayers ? 'On player pages' : 'Staff only'}</span><button class="btn sm" data-act="detach" data-arg="${b.id}">Remove</button></div></div>`).join('')}</div>` : '<div class="empty">No boards attached. Attach your shapes and set pieces so they print with the plan.</div>'}
      <div class="row"><button class="btn pri" data-act="attach">${icon('plus')}Attach a board</button><button class="btn" data-act="newBoard">New board for this match</button></div></div>`,
    day: () => `<div class="card stack">${ta('plan.talk', 'Team talk', 'Three things, in their language', 'style="min-height:110px"')}</div>
      <div class="card stack tight"><div class="h3">Get it out</div>
        <div class="row"><button class="btn" data-act="print">${icon('print')}Print match plan</button><button class="btn" data-act="cards">${icon('print')}Print player cards</button></div>
        <div class="row"><button class="btn" data-act="share">${icon('share')}Share with staff</button><button class="btn pri" data-act="players">${icon('squad')}Update player pages</button></div>
        <p class="tiny muted" style="margin:0">Player pages show each player her own instruction, the keys, and boards marked for players. Set up player links in Squad.</p></div>
      ${played ? `<div class="card stack tight"><div class="h3">Result</div><div class="row"><label class="field" style="width:90px"><span>Us</span><input type="number" inputmode="numeric" data-f="result.us"></label><label class="field" style="width:90px"><span>Them</span><input type="number" inputmode="numeric" data-f="result.them"></label></div></div>` : ''}`
  };

  el.innerHTML = `<div class="split wide-right"><div class="stack">${chalJump()}
    ${m.example ? `<div class="row nowrap small" style="gap:10px;color:var(--lamp-text);background:var(--lamp-soft);border:1px solid var(--lamp-line);border-radius:14px;padding:10px 12px"><span class="grow">Example plan, to show how the challenge works. Set a date to make it real, or delete it.</span><button class="btn sm" data-act="unexample">Make it real</button></div>` : ''}
    ${played && !m.cancelled ? (() => { const rv = S.reviewOf(m), done = S.reviewDone(rv); return `<div class="challenge row between" id="reviewBar" style="flex-direction:row;align-items:center"><span class="small" style="color:var(--lamp-text)">${done ? 'Reviewed.' : rv ? 'Review started but not finished.' : m.date < today() ? 'This match has been played. Review it.' : 'Match day. Review it after the game.'}</span><button class="btn sm lamp" data-act="review">${done ? 'Open review' : rv ? 'Finish review' : 'Review'}</button></div>`; })() : ''}
    ${m.cancelled ? `<div class="card row between"><span class="small">Marked as didn’t happen.</span><button class="btn sm" data-act="uncancel">Undo</button></div>` : ''}
    <div class="card stack tight">
      <label class="field"><span>Opponent</span><input type="text" data-f="opponent" list="oppList" autocomplete="off" placeholder="Who are you playing?" ${m.opponent ? '' : 'autofocus'}></label>
      <datalist id="oppList">${[...new Set(S.matches(T).map(x => (x.opponent || '').trim()).filter(Boolean))].sort().map(o => `<option value="${esc(o)}">`).join('')}</datalist>
      <div class="grid2" style="grid-template-columns:repeat(2,minmax(0,1fr))"><label class="field"><span>Date</span><input type="date" data-f="date"></label><label class="field"><span>Kick-off</span><input type="text" data-f="ko" placeholder="14:00"></label>
      <label class="field"><span>Venue</span><input type="text" data-f="venue" placeholder="Home / away ground"></label><label class="field"><span>Competition</span><input type="text" data-f="comp"></label></div>
    </div>
    <div class="seg" role="tablist" id="matchPart"><button type="button" role="tab" aria-selected="${tab === 'them'}" class="${tab === 'them' ? 'on' : ''}" data-act="tab" data-arg="them" style="min-height:48px;font-size:14px">Opposition analysis</button><button type="button" role="tab" aria-selected="${tab !== 'them'}" class="${tab !== 'them' ? 'on' : ''}" data-act="tab" data-arg="${S.meta().matchPlanTab || 'plan'}" style="min-height:48px;font-size:14px">Match day plan</button></div>
    ${tab !== 'them' ? `<div class="chips scroll" role="tablist" id="planTabs">${PLAN_TABS.map(([k, l]) => `<button class="chip ${k === tab ? 'on' : ''}" role="tab" aria-selected="${k === tab}" data-act="tab" data-arg="${k}">${l}</button>`).join('')}</div>` : ''}
    ${body[tab]()}
    <div class="row">${!m.cancelled && m.date ? '<button class="btn" data-act="cancel">Didn’t happen</button>' : ''}<div class="grow"></div><button class="btn danger" data-act="del">${icon('trash')}Delete plan</button></div>
  </div>
  <div><div id="chal" style="position:sticky;top:80px"></div></div></div>`;

  const chal = () => { const list = matchChallenges(m, T); paintChal(el, list, 'What wins this game?', 'Tested against your game model', { rec: m, save: () => S.put(m), repaint: () => chal(), goTab: (k, f) => { save.flush(); S.setMeta('matchTab', k); ctx.refresh(); setTimeout(() => focusField(f), 60); } }); };
  chal();
  bindFields(el, m, p => {
    save(); chal();
    if (p === 'opponent' || p === 'date') {
      ctx.setTop({ back: '#/matches', title: m.opponent ? 'v ' + m.opponent : 'New match plan', sub: fmtD(m.date) });
      // The opponent file and "trained this week" depend on these two fields; redraw when they change what is shown.
      if (S.previousMeetings(T, m).length !== prev.length || S.trainedBefore(T, m).length !== trained.length) { save.flush(); ctx.refresh(); }
    }
  });
  actions(el, {
    tab: k => { save.flush(); S.setMeta('matchTab', k); if (k !== 'them') S.setMeta('matchPlanTab', k); ctx.refresh(); },
    unexample: () => { delete m.example; S.put(m); toast('Now set the date'); ctx.refresh(); },
    focus: pid => { m.plan.focusIds = focusSet.has(pid) ? m.plan.focusIds.filter(x => x !== pid) : m.plan.focusIds.concat(pid); S.put(m); ctx.refresh(); },
    copyPrev: () => { const x = prev.find(y => y.opp && (y.opp.ip || y.opp.op)); if (!x) return; m.tags = { ...(x.tags || {}) }; m.opp = { ...(x.opp || {}) }; m.src = 'From the plan of ' + fmtD(x.date) + (x.src ? ' (' + x.src + ')' : '') + '. Update it.'; S.put(m); toast('Copied. Now update it.'); ctx.refresh(); },
    sq: pid => { m.squadIds = squad.has(pid) ? m.squadIds.filter(x => x !== pid) : m.squadIds.concat(pid); S.put(m); ctx.refresh(); },
    squadAll: () => { m.squadIds = players.map(p => p.id); S.put(m); ctx.refresh(); },
    squadNone: () => { m.squadIds = []; S.put(m); ctx.refresh(); },
    detach: bid => { m.boardIds = m.boardIds.filter(x => x !== bid); S.put(m); ctx.refresh(); },
    attach: () => {
      const avail = S.boards(T).filter(b => !m.boardIds.includes(b.id) && b.type !== 'sketch');
      const s = sheet(`<div class="stack"><div class="h2">Attach a board</div>${avail.length ? `<div class="list">${avail.map(b => `<button class="item" data-b="${b.id}"><span class="grow"><span class="t" style="display:block">${esc(b.name)}</span><span class="s">${BOARD_LABEL(b.type)} · ${b.frames.length} frames</span></span></button>`).join('')}</div>` : '<div class="empty">Every board is already attached.</div>'}<button class="btn" id="abX">Close</button></div>`);
      s.querySelectorAll('[data-b]').forEach(x => x.onclick = () => { m.boardIds.push(x.dataset.b); S.put(m); closeSheet(); ctx.refresh(); });
      s.querySelector('#abX').onclick = closeSheet;
    },
    newBoard: () => newBoardSheet(T, b => { m.boardIds.push(b.id); S.put(m); location.hash = '#/board/' + b.id; }),
    review: () => startReview('match', m),
    cancel: () => { m.cancelled = true; S.put(m); ctx.refresh(); },
    uncancel: () => { m.cancelled = false; S.put(m); ctx.refresh(); },
    print: () => { save.flush(); printMatch(m); },
    cards: () => { save.flush(); if (!m.squadIds.length) return toast('Pick the squad first'); printInstructionCards(m); },
    share: () => { save.flush(); shareSheet('match', m); },
    players: async () => {
      save.flush();
      if (!cloud.signedIn()) return toast('Player pages need cloud sync. See your profile picture > Cloud sync.');
      try { const n = await refreshPlayers(T); toast(n ? `Updated ${n} player page${n > 1 ? 's' : ''}` : 'No player links yet. Create them in Squad.'); }
      catch (e) { toast(e.message || 'Could not update'); }
    },
    del: async () => { if (await confirmSheet('Delete this match plan?', m.reviewId ? 'Its review will be kept.' : '')) { S.del(m.id); location.hash = '#/matches'; } }
  });
  return () => { save.flush(); refreshIfShared('match', m); };
}
