// Session planner: theme from the game model, practices from the library, carried-forward change, DNA checks.
import * as S from '../store.js';
import { PHASES, PHASE_KEYS } from '../store.js';
import { esc, icon, uid, today, addDays, fmtD, bindFields, actions, debounce, confirmSheet, toast } from '../util.js';
import { drillSvg } from '../pitch.js';
import { sessionChallenges, sessionStats, sessionKit, chalJump, paintChal } from '../challenges.js';
import { printSession, kitLabel } from '../print.js';
import { pickDrill } from './drill.js';
import { reviewGate, startReview } from './review.js';
import { shareSheet, refreshIfShared } from './sharing.js';

// A new session on the next sensible date. extra: fields to set (blocks, principleIds, theme).
export function createSession(T, extra = {}) {
    const taken = new Set(S.sessions(T).map(s => s.date));
    // Default to the team's usual training night: the next free date whose weekday matches one of
    // the last few sessions. With no history it is today.
    const days = new Set(S.sessions(T).filter(s => s.date && !s.cancelled).slice(0, 6).map(s => new Date(s.date + 'T12:00').getDay()));
    let d = today();
    if (days.size) { let n = 0; while (n < 14 && (taken.has(d) || !days.has(new Date(d + 'T12:00').getDay()))) { d = addDays(d, 1); n++; } }
    while (taken.has(d)) d = addDays(d, 1);
    const lc = S.lastChange(T);
    const blk = S.blockFor(T, d);
    return S.create('session', T, { date: d, time: '', venue: '', length: 90, theme: '', principleIds: blk ? (blk.principleIds || []).slice() : [], blocks: [], injuryPrev: false, addresses: false, addressesHow: '', matchPrep: false, lookFor: '', focusIds: [], focusHow: '', staff: '', notes: '', fromReview: lc ? lc.id : null, ...extra });
}
export function newSession() {
  const T = S.team().id;
  reviewGate(T, () => { const s = createSession(T); location.hash = '#/session/' + s.id; }, 'plan a new session');
}

const OPEN = new Set();

export default function sessionView(el, [id], ctx) {
  const s = S.get(id);
  if (!s) { ctx.setTop({ back: '#/training/sessions', title: 'Session' }); el.innerHTML = '<div class="empty">This session has been deleted.</div>'; return; }
  const T = s.team; s.blocks ||= []; s.principleIds ||= []; s.focusIds ||= [];
  const summary = () => s.date || s.time || s.venue ? [fmtD(s.date), s.time, s.venue].filter(Boolean).join(' · ') : 'Set the date, time and venue';
  const top = () => ctx.setTop({ back: '#/training/sessions', title: s.theme || 'New session', sub: summary(), onSub: () => { const d = el.querySelector('#sessDetails'); d.open = true; OPEN.add(s.id + ':details'); d.scrollIntoView({ block: 'start', behavior: 'smooth' }); } });
  top();
  const save = debounce(() => S.put(s), 400);
  const ps = S.principles(T); const sel = new Set(s.principleIds);
  const lc = S.lastChange(T); const nm = S.nextMatch(T);
  const st = sessionStats(s); const { kit, balls } = sessionKit(s);
  const happened = s.date && s.date <= today();
  const rv = S.reviewOf(s); const rvDone = S.reviewDone(rv);
  const blk = S.blockFor(T, s.date); const wk = blk ? S.weekOf(blk, s.date) : 0;
  const players = S.players(T); const focus = new Set(s.focusIds);
  const openGoal = p => (p.goals || []).find(g => g.status === 'on');
  const withGoals = players.filter(openGoal); const without = players.filter(p => !openGoal(p));
  const chip = p => { const g = openGoal(p); return `<button class="chip ${focus.has(p.id) ? 'on' : ''}" data-act="focus" data-arg="${p.id}" title="${esc(g ? g.text : '')}"><b>${esc(p.num)}</b> ${esc(p.short || p.name)}${g ? ` <span class="muted" style="font-weight:400">· ${esc(g.text.slice(0, 28))}${g.text.length > 28 ? '…' : ''}</span>` : ''}</button>`; };
  // Folded sections stay as Joe left them when the screen redraws.
  const op = (k, dflt) => OPEN.has(s.id + ':' + k) || dflt ? 'open' : '';
  const fold = (k, label, val, body, dflt, sub) => `<details data-fold="${k}" ${op(k, dflt)}><summary class="gr"><span class="lbl">${label}${sub ? `<small>${sub}</small>` : ''}</span><span class="v">${val !== '' && val != null ? `<span class="mono">${val}</span>` : ''}<span class="chev">›</span></span></summary><div class="fold">${body}</div></details>`;
  const roll = n => `${n.total} MIN · ${n.rolling}% ROLLING`;
  const kitN = Object.keys(kit).length + (balls ? 1 : 0);
  const prNames = s.principleIds.map(S.get).filter(Boolean).map(p => p.title || 'Untitled');

  el.innerHTML = `<div class="split wide-right"><div class="stack">${chalJump()}
    ${s.cancelled ? `<div class="card row between" style="border-color:var(--line2)"><span class="small">Marked as didn’t happen.</span><button class="btn sm" data-act="uncancel">Undo</button></div>` : ''}
    ${happened && !s.cancelled ? `<div class="challenge row between" id="reviewBar" style="flex-direction:row;align-items:center"><span class="small" style="color:var(--lamp-text)">${rvDone ? 'Reviewed.' : rv ? 'Review started but not finished.' : s.date < today() ? 'This session has happened. Review it to close the loop.' : 'Session day. Review it when you’re done.'}</span><button class="btn sm lamp" data-act="review">${rvDone ? 'Open review' : rv ? 'Finish review' : 'Review now'}</button></div>` : ''}
    <div class="gl">
      <details id="sessDetails" data-fold="details" ${op('details', !s.theme || !s.date)}><summary class="gr"><span class="lbl">Theme, date and venue<small>${s.theme ? 'Tap the line under the title, or here, to change them' : 'Start with the theme'}</small></span><span class="chev">›</span></summary>
      <div class="fold">
        <label class="field"><span>Theme: what will the team be better at by the end?</span><input type="text" data-f="theme" placeholder="e.g. Playing out through the 6 against a two-player press" ${s.theme ? '' : 'autofocus'}></label>
        <div class="grid2" style="grid-template-columns:repeat(2,minmax(0,1fr))">
          <label class="field"><span>Date</span><input type="date" data-f="date"></label>
          <label class="field"><span>Time</span><input type="text" data-f="time" placeholder="19:00"></label>
          <label class="field"><span>Venue</span><input type="text" data-f="venue"></label>
          <label class="field"><span>Length (min)</span><input type="number" inputmode="numeric" data-f="length"></label>
        </div></div></details>
      ${blk ? `<a class="gr" href="#/block/${blk.id}"><span class="lbl">${esc(blk.title || 'Untitled block')}<small>Week ${wk} of ${blk.weeks}${(blk.weeksPlan || [])[wk - 1] ? ` · this week: ${esc(blk.weeksPlan[wk - 1])}` : ''}</small></span><span class="v"><span class="mono">${wk}/${blk.weeks}</span><span class="chev">›</span></span></a>`
        : `<a class="gr" href="#/training/programme"><span class="lbl">Not in a training block<small>Plan one so sessions add up</small></span><span class="chev">›</span></a>`}
      ${fold('principles', 'Principles', s.principleIds.length || '', `<div id="sessionPrinciples" class="stack tight">${ps.length ? PHASE_KEYS.filter(k => ps.some(p => p.phase === k)).map(k => `<div class="tiny muted">${PHASES[k].lab}</div><div class="chips">${ps.filter(p => p.phase === k).map(p => `<button class="chip ${sel.has(p.id) ? 'on' : ''}" data-act="pr" data-arg="${p.id}">${esc(p.title || 'Untitled')}</button>`).join('')}</div>`).join('') : '<div class="small" style="color:var(--lamp-text)">No principles yet. <a href="#/model">Write your game model</a> first: sessions are built from it.</div>'}</div>`, !s.principleIds.length, prNames.length ? esc(prNames.join(', ')) : 'What this session is about')}
    </div>

    ${lc ? `<div class="card stack tight" style="border-color:var(--lamp-line);background:var(--lamp-soft)"><div class="eyebrow" style="color:var(--lamp-text)">Carried forward from ${fmtD(lc.date)}</div><div class="small">“${esc(lc.change)}”</div><label class="check"><input type="checkbox" data-f="addresses"> This session acts on it</label>
      ${s.addresses ? `<label class="field"><span>How: which practice, which players, what will look different</span><textarea data-f="addressesHow" style="min-height:56px"></textarea></label>` : ''}</div>` : ''}

    <div class="stack tight" id="running" style="gap:6px">
      <div class="ghead"><span>Running order</span><span id="rollPill" class="mono" style="${st.total && st.rolling < 70 ? 'color:#8A6A00' : ''}">${roll(st)}</span></div>
      <div class="gl">
        ${s.blocks.length ? `<div class="minstrip" aria-hidden="true">${s.blocks.map(b => `<span style="flex:${Math.max(1, +b.minutes || 0)}"></span>`).join('')}</div>` : ''}
        ${s.blocks.map((b, i) => { const d = S.get(b.drillId); return `<details data-fold="b${b.id}" ${op('b' + b.id)}><summary class="gr"><span class="ix">${String(i + 1).padStart(2, '0')}</span><span class="lbl">${esc(d ? d.name : 'Drill deleted')}<small>${esc(d ? d.type : '')}${d && S.drillLinks(d, T).some(x => sel.has(x)) ? ' · linked to the theme' : ''}</small></span><span class="v"><span class="mono" data-mins="${i}">${+b.minutes || 0}′</span><span class="chev">›</span></span></summary>
          <div class="fold"><div class="row nowrap" style="align-items:flex-start">
            <a href="${d ? '#/drill/' + d.id + '/' + s.id : '#'}" style="flex:none;width:92px" aria-label="Open the drill">${d ? drillSvg(d, { style: 'width:92px;height:auto;border-radius:10px' }) : '<div class="empty" style="padding:10px">Missing</div>'}</a>
            <div class="row grow" style="gap:8px"><label class="field" style="width:84px"><span>Minutes</span><input type="number" inputmode="numeric" data-f="blocks.${i}.minutes"></label><label class="field" style="width:84px"><span>Talk</span><input type="number" inputmode="numeric" data-f="blocks.${i}.talk" title="Minutes of explaining, stoppages and set-up"></label></div>
            <div class="stack tight" style="gap:6px"><button class="btn icon sm" data-act="up" data-arg="${i}" aria-label="Move up" ${i ? '' : 'disabled'}>${icon('up')}</button><button class="btn icon sm danger" data-act="rm" data-arg="${i}" aria-label="Remove">${icon('x')}</button></div>
          </div>
          <input type="text" data-f="blocks.${i}.note" placeholder="Note for this block (who, rotation, focus)" aria-label="Note for this block"></div></details>`; }).join('')}
        ${s.blocks.length ? `<button class="gr add" data-act="add">+ Add a practice</button><a class="gr add" href="#/ideas/s/${s.id}" id="sessTpl">${icon('grid', 'style="width:18px;height:18px"')}Pick from templates<span class="grow"></span><span class="tiny muted">whole sessions or single practices</span></a>`
          : `<div class="bigpicks" style="padding:12px"><button type="button" class="bigpick pri" data-act="add">${icon('plus')}<span class="t">Create your own</span><span class="s">From your drills, or design a new one</span></button><a class="bigpick" href="#/ideas/s/${s.id}" id="sessTpl" style="text-decoration:none">${icon('grid')}<span class="t">Pick a template</span><span class="s">A whole session or single practices from top coaches</span></a></div>`}
      </div>
      <div class="tiny muted" style="padding:0 4px">Tap a practice for its minutes and talk time. “Talk” is explaining, stopping and setting up. Ball rolling = total minus talk.</div>
    </div>

    <div class="card stack tight">
      <label class="field"><span>What I’m looking for tonight <span class="muted">(two or three things you could see or count)</span></span><textarea data-f="lookFor" style="min-height:56px" placeholder="e.g. CBs split on the keeper’s first touch; the 6 shows before the pass, not after; at least five played-out attacks reach the halfway line"></textarea></label>
    </div>

    <div class="gl">
      ${fold('focus', 'Focus players', s.focusIds.length || '', `<div class="field" id="focusChips"><span class="tiny muted">One or two; their goal in brackets</span>
        <div class="chips">${withGoals.map(chip).join('')}</div>
        ${without.length ? `<details><summary class="tiny muted" style="cursor:pointer">Players without an open goal</summary><div class="chips" style="margin-top:6px">${without.map(chip).join('')}</div></details>` : ''}
        ${s.focusIds.length ? `<textarea data-f="focusHow" style="min-height:56px;margin-top:6px" placeholder="What will you watch for, and what will you say to them?" aria-label="What you will watch for"></textarea>` : ''}</div>`)}
      ${nm && nm.date && (!s.date || nm.date >= s.date) ? `<label class="gr" style="cursor:pointer"><span class="lbl">Prepares for v ${esc(nm.opponent || 'next opponent')}<small>${fmtD(nm.date)} · <a href="#/match/${nm.id}">open the match plan</a></small></span><input type="checkbox" data-f="matchPrep" style="width:22px;height:22px;accent-color:var(--accent)"></label>` : ''}
      ${fold('kit', 'Warm-up and kit', kitN || '', `<label class="check"><input type="checkbox" data-f="injuryPrev"> Warm-up includes injury-prevention work</label>
        <div class="small">${kitN ? Object.entries(kit).map(([k, v]) => `${v} × ${esc(kitLabel(k))}`).concat(balls ? ['balls'] : []).join(' · ') : '<span class="muted">Worked out from the drill diagrams once you add practices.</span>'}</div>
        <div class="tiny muted">Most of each item needed in any one practice.</div>`, false, s.injuryPrev ? 'Injury prevention in the warm-up' : 'Kit to bring, worked out from the drills')}
      ${fold('staff', 'Staff and notes', '', `<label class="field"><span>Staff on the night</span><input type="text" data-f="staff" placeholder="Who’s helping, and with what"></label>
        <label class="field"><span>Notes</span><textarea data-f="notes"></textarea></label>`, false, s.staff ? esc(s.staff) : '')}
    </div>
    <div class="row"><button class="btn" data-act="print">${icon('print')}Print</button><button class="btn" data-act="share">${icon('share')}Share with staff</button><div class="grow"></div>
      ${!s.cancelled ? '<button class="btn" data-act="cancel">Didn’t happen</button>' : ''}<button class="btn danger" data-act="del">${icon('trash')}Delete</button></div>
  </div>
  <div><div id="chal" style="position:sticky;top:80px"></div></div></div>`;

  el.querySelectorAll('details[data-fold]').forEach(d => d.addEventListener('toggle', () => { const k = s.id + ':' + d.dataset.fold; if (d.open) OPEN.add(k); else OPEN.delete(k); }));
  const chal = () => paintChal(el, sessionChallenges(s, T), 'Session check', '', { rec: s, save: () => S.put(s), repaint: () => chal() });
  chal();
  bindFields(el, s, (p) => {
    save(); chal();
    if (p === 'theme') { const t = document.getElementById('bandTitle'); if (t) t.textContent = s.theme || 'New session'; }
    if (p === 'time' || p === 'venue') top();
    if (p === 'addresses') { s.addressesReview = s.addresses && lc ? lc.id : null; save.flush(); ctx.refresh(); }
    if (p === 'date') { save.flush(); ctx.refresh(); }
    if (/^blocks\.\d+\.(minutes|talk)$/.test(p)) { const n = sessionStats(s); const pill = el.querySelector("#rollPill"); if (pill) { pill.textContent = roll(n); pill.style.color = n.total && n.rolling < 70 ? '#8A6A00' : ''; } const i = +p.split('.')[1]; const mm = el.querySelector(`[data-mins="${i}"]`); if (mm && p.endsWith('minutes')) mm.textContent = (+s.blocks[i].minutes || 0) + '′'; }
  });
  actions(el, {
    pr: pid => { OPEN.add(s.id + ':principles'); s.principleIds = sel.has(pid) ? s.principleIds.filter(x => x !== pid) : s.principleIds.concat(pid); S.put(s); ctx.refresh(); },
    focus: pid => { OPEN.add(s.id + ':focus'); s.focusIds = focus.has(pid) ? s.focusIds.filter(x => x !== pid) : s.focusIds.concat(pid).slice(-3); S.put(s); ctx.refresh(); },
    add: () => pickDrill(T, (d, isNew) => {
      s.blocks.push({ id: uid(), drillId: d.id, minutes: +d.minutes || 15, talk: 3, note: '' }); S.put(s);
      if (isNew) { if (s.principleIds.length) { d.links = { ...(d.links || {}), [T]: s.principleIds.slice() }; S.put(d); } location.hash = '#/drill/' + d.id + '/' + s.id; } else ctx.refresh();
    }, s.id),
    up: i => { i = +i; [s.blocks[i - 1], s.blocks[i]] = [s.blocks[i], s.blocks[i - 1]]; S.put(s); ctx.refresh(); },
    rm: i => { s.blocks.splice(+i, 1); S.put(s); ctx.refresh(); },
    review: () => startReview('session', s),
    cancel: () => { s.cancelled = true; S.put(s); toast('Marked as didn’t happen'); ctx.refresh(); },
    uncancel: () => { s.cancelled = false; S.put(s); ctx.refresh(); },
    print: () => { save.flush(); printSession(s); },
    share: () => { save.flush(); shareSheet('session', s); },
    del: async () => { if (await confirmSheet('Delete this session plan?', s.reviewId ? 'Its review will be kept.' : '')) { S.del(s.id); location.hash = '#/training/sessions'; } }
  });
  return () => { save.flush(); refreshIfShared('session', s); };
}
