// Reviews: compulsory after every session and match. Feeds the next session.
import * as S from '../store.js';
import { PHASES, DONE } from '../store.js';
import { esc, icon, lines, today, fmtD, bindFields, actions, sheet, closeSheet, confirmSheet, debounce, toast } from '../util.js';
import { reviewChallenges, sessionStats, chalJump, paintChal } from '../challenges.js';

const WHY = { plan: 'The plan', delivery: 'My delivery', players: 'The players', opposition: 'The opposition', conditions: 'Numbers / conditions' };
const SCORE = [[2, 'Yes', 'good'], [1, 'Partly', 'part'], [0, 'No', 'no']];

export function startReview(kind, rec) {
  if (rec.reviewId && S.get(rec.reviewId)) { location.hash = '#/review/' + rec.reviewId; return; }
  const t = rec.team; const all = S.principles(t).map(p => p.id);
  // What the review tests is fixed when it starts: the plan as it was, not as it is edited later.
  const focusP = kind === 'match' ? ((rec.plan || {}).focusIds || []).filter(id => S.get(id)) : [];
  const principleIds = kind === 'session' ? (rec.principleIds || []).slice() : (focusP.length ? focusP : all);
  const carriedRv = kind === 'session' && rec.addresses ? S.get(rec.addressesReview || rec.fromReview) : null;
  const r = S.create('review', t, {
    type: kind, refId: rec.id, date: rec.date || today(),
    principleIds, otherIds: all.filter(id => !principleIds.includes(id)),
    keys: kind === 'match' ? lines((rec.plan || {}).keys).map(text => ({ text, v: null })) : [],
    carried: carriedRv && carriedRv.change ? { id: carriedRv.id, text: carriedRv.change, how: rec.addressesHow || '' } : null, lastChangeDone: null, lastChangeEffect: '',
    lookFor: kind === 'session' ? rec.lookFor || '' : '', lookForSeen: null,
    focus: kind === 'session' ? (rec.focusIds || []).map(S.get).filter(Boolean).map(p => ({ id: p.id, name: p.name, goal: ((p.goals || []).find(g => g.status === 'on') || {}).text || '' })) : [],
    plannedRolling: kind === 'session' ? sessionStats(rec).rolling : null, rollingActual: null, stops: null,
    trained: kind === 'match' ? S.trainedBefore(t, rec).map(x => x.theme || 'session') : [], trainedShowed: null,
    goalsHow: '', decisions: '', moments: '', them: '', clips: '',
    evidence: {}, why: [], worked: '', didnt: '', change: '', modelChange: '', self: '', playerObs: {}
  });
  rec.reviewId = r.id; S.put(rec);
  location.hash = '#/review/' + r.id;
}

// Shown when Joe tries to plan something new with reviews outstanding.
export function reviewGate(t, onClear, what = 'plan the next one') {
  const due = S.reviewsDue(t);
  if (!due.length) { onClear(); return; }
  const el = sheet(`<div class="stack"><div class="row nowrap" style="gap:12px"><span style="flex:none;width:44px;height:44px;border-radius:14px;background:rgba(255,211,77,.12);color:var(--lamp);display:flex;align-items:center;justify-content:center">${icon('bulb')}</span><div><div class="h2">Review first</div><div class="small muted">Before you ${esc(what)}, close the loop on what’s already happened.</div></div></div>
    <div class="list">${due.map(d => `<div class="item" style="cursor:default"><span class="grow"><span class="t" style="display:block">${d.kind === 'match' ? 'Match v ' + esc(d.rec.opponent) : 'Session: ' + esc(d.rec.theme || 'no theme')}</span><span class="s">${fmtD(d.rec.date)}${d.started ? ' · review started, not finished' : ''}</span></span>${d.started ? '' : `<button class="btn sm" data-x="${d.rec.id}">Didn’t happen</button>`}<button class="btn sm lamp" data-r="${d.rec.id}">${d.started ? 'Finish' : 'Review'}</button></div>`).join('')}</div>
    <p class="tiny muted" style="margin:0">“Didn’t happen” marks it cancelled (weather, postponed, no pitch). Everything else gets a review: that’s how the game model learns.</p></div>`);
  el.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { const d = due.find(x => x.rec.id === b.dataset.r); closeSheet(); startReview(d.kind, d.rec); });
  el.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { const d = due.find(x => x.rec.id === b.dataset.x); d.rec.cancelled = true; S.put(d.rec); closeSheet(); reviewGate(t, onClear, what); });
}

export default function reviewView(el, [id], ctx) {
  const r = S.get(id);
  if (!r) { el.innerHTML = `<div class="empty">This review has been deleted.</div>`; ctx.setTop({ back: '#/plans/reviews', title: 'Review' }); return; }
  const ref = S.get(r.refId); const t = r.team;
  const title = r.type === 'match' ? 'v ' + (ref ? ref.opponent : 'match') : (ref ? ref.theme || 'Session' : 'Session');
  ctx.setTop({ back: '#/plans/reviews', title: 'Review', sub: title + ' · ' + fmtD(r.date) });
  const save = debounce(() => S.put(r), 400);
  const ps = (r.principleIds || []).map(S.get).filter(Boolean); const others = (r.otherIds || []).map(S.get).filter(Boolean);
  const focusIds = new Set((r.focus || []).map(f => f.id));
  const squadAll = r.type === 'match' && ref ? (ref.squadIds || []).map(S.get).filter(Boolean) : S.players(t);
  const squad = squadAll.slice().sort((a, b) => (focusIds.has(b.id) ? 1 : 0) - (focusIds.has(a.id) ? 1 : 0));
  const st = r.type === 'session' && ref ? sessionStats(ref) : null;
  const seg = (f, cur) => `<div class="seg">${DONE.map(([v, l, c]) => `<button class="${cur === v ? 'on ' + c : ''}" data-act="seg" data-arg="${f}:${v}">${l}</button>`).join('')}</div>`;
  const scoreRow = p => `<div class="stack tight" style="padding:8px 0;border-top:1px solid var(--line)"><div class="row nowrap" style="gap:8px"><span class="dot" style="color:${PHASES[p.phase].col}"></span><span class="small" style="font-weight:600">${esc(p.title)}</span>${r.type === 'match' && ref && ((ref.plan || {}).principleNotes || {})[p.id] ? `<span class="tiny muted">· planned: ${esc(ref.plan.principleNotes[p.id].slice(0, 60))}</span>` : ''}</div><div class="seg">${SCORE.map(([v, l, c]) => `<button class="${(r.evidence || {})[p.id] === v ? 'on ' + c : ''}" data-act="ev" data-arg="${p.id}:${v}">${['Not seen', 'Partly', 'Seen'][v]}</button>`).join('')}</div></div>`;
  // The plan, so Joe reviews against what he planned rather than what he remembers.
  const planHtml = () => {
    if (!ref) return '';
    if (r.type === 'session') { const bl = (ref.blocks || []).map(b => S.get(b.drillId)).filter(Boolean); return `<details class="card inset"><summary class="small" style="cursor:pointer"><b>The plan</b> <span class="muted">· ${esc(ref.theme || '')}</span></summary><div class="small stack tight" style="margin-top:8px">${ref.lookFor ? `<div><span class="muted">Looking for:</span> ${esc(ref.lookFor)}</div>` : ''}${(r.focus || []).length ? `<div><span class="muted">Focus:</span> ${r.focus.map(f => esc(f.name) + (f.goal ? ' (' + esc(f.goal) + ')' : '')).join('; ')}${ref.focusHow ? ' · ' + esc(ref.focusHow) : ''}</div>` : ''}${bl.length ? `<div><span class="muted">Practices:</span> ${bl.map(d => esc(d.name)).join(' → ')}</div>` : ''}</div></details>`; }
    const p = ref.plan || {}; return `<details class="card inset"><summary class="small" style="cursor:pointer"><b>The plan</b> <span class="muted">· v ${esc(ref.opponent || '')}</span></summary><div class="small stack tight" style="margin-top:8px">${p.threat ? `<div><span class="muted">Threat and answer:</span> ${esc(p.threat)}</div>` : ''}${p.first ? `<div><span class="muted">First ten:</span> ${esc(p.first)}</div>` : ''}${p.planB ? `<div><span class="muted">Plan B:</span> ${esc(p.planB)}</div>` : ''}${p.subs ? `<div><span class="muted">Subs:</span> ${esc(p.subs)}</div>` : ''}${(r.trained || []).length ? `<div><span class="muted">Trained this week:</span> ${r.trained.map(esc).join('; ')}</div>` : ''}</div></details>`;
  };

  el.innerHTML = `<div class="split wide-right"><div class="stack">${chalJump()}
    <div class="card stack tight"><div class="eyebrow">${r.type === 'match' ? 'Match review' : 'Session review'}</div><div class="h1" style="font-size:32px">${esc(title)}</div>
      <div class="row small muted">${fmtD(r.date)}${ref ? ` · <a href="#/${r.type}/${ref.id}">Open the ${r.type === 'match' ? 'match plan' : 'session plan'}</a>` : ''}${st ? ` · planned ${st.total} min, ${st.rolling}% ball rolling` : ''}</div>
      ${r.type === 'match' && ref ? `<div class="row" style="margin-top:6px"><label class="field" style="width:90px"><span>Us</span><input type="number" inputmode="numeric" min="0" id="rsUs" value="${esc(ref.result?.us ?? '')}"></label><label class="field" style="width:90px"><span>Them</span><input type="number" inputmode="numeric" min="0" id="rsThem" value="${esc(ref.result?.them ?? '')}"></label></div>` : ''}
      ${planHtml()}
    </div>

    ${r.carried ? `<div class="card stack tight" id="carried" style="border-color:var(--lamp-line)"><div class="eyebrow" style="color:var(--lamp)">Last time you decided</div><div class="small">“${esc(r.carried.text)}”${r.carried.how ? `<br><span class="muted">Planned: ${esc(r.carried.how)}</span>` : ''}</div>
      <div class="small" style="font-weight:600;margin-top:4px">Did you do it?</div>${seg('lastChangeDone', r.lastChangeDone)}
      <label class="field"><span>${r.lastChangeDone === 0 ? 'What got in the way? Is it still the right change?' : 'What happened? Keep it, build on it, or drop it?'}</span><textarea data-f="lastChangeEffect" style="min-height:56px"></textarea></label></div>` : ''}

    ${r.type === 'session' ? `<div class="card stack tight"><div class="h3">What actually happened</div>
      ${r.lookFor ? `<div id="lookForSeen"><div class="small">You were looking for: “${esc(r.lookFor)}”</div><div class="small" style="font-weight:600">Did you see it?</div>${seg('lookForSeen', r.lookForSeen)}</div>` : ''}
      <div class="row" style="gap:8px;align-items:flex-end"><label class="field" style="width:130px"><span>Ball rolling, actual %</span><input type="number" inputmode="numeric" min="0" max="100" data-f="rollingActual" placeholder="${esc(r.plannedRolling != null ? 'planned ' + r.plannedRolling : '')}"></label><label class="field" style="width:130px"><span>Times you stopped it</span><input type="number" inputmode="numeric" min="0" data-f="stops"></label></div>
      <div class="tiny muted">Rough is fine. The point is to notice. Ask a helper to time your stoppages when you can.</div></div>` : ''}

    ${r.type === 'match' ? `<div class="card stack tight" id="keys"><div class="h3">Did the keys to winning happen?</div>
      ${(r.keys || []).length ? r.keys.map((k, i) => `<div class="stack tight" style="padding:8px 0;border-top:1px solid var(--line)"><div class="small">${esc(k.text)}</div><div class="seg">${SCORE.map(([v, l, c]) => `<button class="${k.v === v ? 'on ' + c : ''}" data-act="key" data-arg="${i}:${v}">${l}</button>`).join('')}</div></div>`).join('') : '<div class="small muted">The match plan had no keys to winning. Next time, write them before the game so you can test them after.</div>'}</div>` : ''}

    <div class="card stack tight" id="scores"><div class="h3">${r.type === 'match' ? 'Principles under test: did they hold?' : 'Principles: did you see them?'}</div>
      ${ps.length ? ps.map(scoreRow).join('') : '<div class="small muted">No principles were linked to this. Link principles when you plan, so the review can test them.</div>'}
      ${others.length ? `<details><summary class="tiny muted" style="cursor:pointer;padding-top:8px">Score the other ${others.length} principle${others.length > 1 ? 's' : ''} (optional)</summary>${others.map(scoreRow).join('')}</details>` : ''}
    </div>

    ${r.type === 'match' ? `<div class="card stack"><div class="h3">The game</div>
      <label class="field"><span>Goals, both ends: how each one happened (phase, principle, who was where)</span><textarea data-f="goalsHow" placeholder="1-0 (us, 23′): played out through the 6, switch to the right, back-post header. 1-1 (62′): lost it in our half pressing as individuals; no rest defence behind the 8s."></textarea></label>
      <label class="field"><span>What you changed during the game, when, and whether it worked</span><textarea data-f="decisions" placeholder="e.g. 55′ dropped to a 4-4-2 to go long: stopped the bleeding but we never had the ball again. Should have gone to plan B at 30′ when the trigger was already there."></textarea></label>
      <label class="field"><span>The two or three moments that decided it</span><textarea data-f="moments" style="min-height:56px"></textarea></label>
      ${(r.trained || []).length ? `<div id="trainedShowed"><div class="small">You trained ${r.trained.map(x => '“' + esc(x) + '”').join(', ')} this week.</div><div class="small" style="font-weight:600">Did it show in the game?</div>${seg('trainedShowed', r.trainedShowed)}</div>` : ''}
      <label class="field"><span>What they did that you didn’t expect <span class="muted">(goes in the opponent file)</span></span><textarea data-f="them" style="min-height:56px"></textarea></label>
      <label class="field"><span>Clips to cut <span class="muted">(Hudl timestamps, one per line)</span></span><textarea data-f="clips" style="min-height:56px" placeholder="1:08:27 their first shot, poor clearance"></textarea></label></div>` : ''}

    <div class="card stack">
      <label class="field"><span>What worked?</span><textarea data-f="worked" placeholder="Be specific: which moment, which players, which part of the plan."></textarea></label>
      <label class="field"><span>What didn’t?</span><textarea data-f="didnt" placeholder="Every review needs this half too."></textarea></label>
      <div class="field" id="why"><span>Why? Tick all that apply</span><div class="chips">${Object.entries(WHY).map(([k, l]) => `<button class="chip ${(r.why || []).includes(k) ? 'on' : ''}" data-act="why" data-arg="${k}">${l}</button>`).join('')}</div></div>
    </div>

    <div class="card stack" style="border-color:var(--lamp-line)">
      <label class="field"><span style="color:var(--lamp)">One thing to change next time</span><textarea data-f="change" placeholder="This appears on Home and in your next session plan until you act on it."></textarea></label>
      <label class="field"><span>Does the game model need to change?</span><textarea data-f="modelChange" placeholder="Leave blank if not. If yes: which principle, and how?"></textarea></label>
      ${ps.length ? `<div class="chips">${ps.map(p => `<a class="chip" href="#/principle/${p.id}">${icon('pen', 'style="width:14px;height:14px"')}${esc(p.title)}</a>`).join('')}</div>` : ''}
      <label class="field"><span>Me as a coach: what did I learn about myself?</span><textarea data-f="self" placeholder="How you set it up, when you stepped in, what you said, how you came across."></textarea></label>
      <div class="tiny muted">These build your <a href="#/pathway">strengths and development profile</a>.</div>
    </div>

    <details class="card" id="playerObs" ${focusIds.size ? 'open' : ''}><summary class="h3" style="cursor:pointer">Player observations <span class="muted small">(${focusIds.size ? 'focus players first; ' : ''}shows on each player’s profile)</span></summary>
      <div class="stack tight" style="margin-top:10px">${squad.length ? squad.map(p => `<label class="field"><span>${esc(p.num)} · ${esc(p.name)}${focusIds.has(p.id) ? ` <span class="pill lamp">focus</span> <span class="muted">${esc(((r.focus || []).find(f => f.id === p.id) || {}).goal || '')}</span>` : ''}</span><input type="text" data-f="playerObs.${p.id}" placeholder="${focusIds.has(p.id) ? 'What you saw, what you said, what next' : 'One line'}"></label>`).join('') : '<div class="small muted">Pick a match squad to see players here.</div>'}</div>
    </details>
    <div class="row"><button class="btn danger" data-act="del">${icon('trash')}Delete review</button></div>
  </div>
  <div><div id="chal" style="position:sticky;top:80px"></div></div></div>`;

  const chal = () => paintChal(el, reviewChallenges(r, t), 'Review check', '', { rec: r, save: () => S.put(r), repaint: () => chal() });
  chal();
  bindFields(el, r, () => { save(); chal(); });
  if (ref && r.type === 'match') {
    const sr = () => { ref.result = { us: el.querySelector('#rsUs').value, them: el.querySelector('#rsThem').value }; S.put(ref); };
    el.querySelector('#rsUs').oninput = sr; el.querySelector('#rsThem').oninput = sr;
  }
  actions(el, {
    key: a => { const [i, v] = a.split(':'); r.keys[+i].v = r.keys[+i].v === +v ? null : +v; S.put(r); ctx.refresh(); },
    seg: a => { const [f, v] = a.split(':'); r[f] = r[f] === +v ? null : +v; S.put(r); ctx.refresh(); },
    ev: a => { const [pid, v] = a.split(':'); r.evidence ||= {}; if (r.evidence[pid] === +v) delete r.evidence[pid]; else r.evidence[pid] = +v; S.put(r); ctx.refresh(); },
    why: k => { r.why ||= []; r.why = r.why.includes(k) ? r.why.filter(x => x !== k) : r.why.concat(k); S.put(r); ctx.refresh(); },
    del: async () => {
      if (!await confirmSheet('Delete this review?', 'The session or match will show as needing a review again.')) return;
      if (ref) { ref.reviewId = null; S.put(ref); }
      S.del(r.id); toast('Review deleted'); location.hash = '#/plans/reviews';
    }
  });
  return () => save.flush();
}
