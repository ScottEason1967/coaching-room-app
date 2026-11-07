// The challenge engine: questions the app puts to Joe so every drill, session
// and match plan is tested against his game model, and every review feeds back in.
// kind: ok (done), ask (worth thinking about), req (needs doing).
// It is a rule engine. It can tell that a field is empty, a type is wrong or a link is missing.
// It cannot tell a sharp principle from a vague one; that is what the questions are for.
import * as S from './store.js';
import { esc, lines, today, addDays, fmtD } from './util.js';
import { OPPOSED, GAMELIKE, PHASES, CORNERS, POP } from './store.js';

// A question: kind, text (first sentence is the headline, the rest is detail), src (where the idea
// comes from), f (the field it is about: a data-f path, a #container id, or a #/route), tab (match tab).
const Q = (kind, text, src, f, tab) => ({ kind, text, src, f, tab });
const has = v => !!(v || '').toString().trim();
const qid = q => { let h = 0; const t = (q.src || '') + '|' + q.text.replace(/\d+/g, '#'); for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return 'q' + (h >>> 0).toString(36); };
const split = text => { const m = /^(.{18,}?[.?!])\s+(.+)$/s.exec(text); return m ? [m[1], m[2]] : [text, '']; };
const bulb = () => '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/></svg>';

let dockOpen = false, showDismissed = false;
export function resetDock() { dockOpen = false; showDismissed = false; document.body.classList.remove('dock'); const d = document.getElementById('chalDock'); if (d) { d.hidden = true; d.innerHTML = ''; } }

export function box(list, title = 'Coach’s challenge', sub = '', dismissed = []) {
  const live = list.filter(q => !dismissed.includes(qid(q)));
  const req = live.filter(q => q.kind === 'req'), ask = live.filter(q => q.kind === 'ask'), ok = live.filter(q => q.kind === 'ok');
  const gone = list.length - live.length;
  const item = q => { const [head, rest] = split(q.text); const id = qid(q); return `<div class="q ${q.kind}" data-q="${id}"><div class="ic">${q.kind === 'ok' ? '✓' : q.kind === 'req' ? '!' : '?'}</div><div class="grow">
      <div class="qh ${q.f ? 'go' : ''}" ${q.f ? `data-go="${esc(q.f)}" ${q.tab ? `data-tab="${esc(q.tab)}"` : ''} role="button" tabindex="0"` : ''}>${esc(head)}${q.src ? `<span class="src">· ${esc(q.src)}</span>` : ''}</div>
      ${rest || q.kind === 'ask' ? `<div class="qd">${esc(rest)}${q.kind === 'ask' ? ` <button type="button" class="qx" data-dismiss="${id}">Not this time</button>` : ''}</div>` : ''}</div>
      ${rest || q.kind === 'ask' ? `<button type="button" class="qt" aria-label="More" data-toggle="${id}">›</button>` : ''}</div>`; };
  const pill = req.length || ask.length ? `${req.length ? `<span class="pill" style="background:rgba(255,107,107,.16);color:var(--bad)">${req.length} must-do</span>` : ''}${ask.length ? `<span class="pill lamp">${ask.length} to think about</span>` : ''}` : '<span class="pill good">All clear</span>';
  return `<section class="challenge" aria-label="${esc(title)}"><div class="head"><div class="title">${bulb()}${esc(title)}</div><span class="row" style="gap:6px">${pill}</span></div>${sub ? `<div class="tiny" style="color:#C9B66A">${esc(sub)}</div>` : ''}
    ${req.map(item).join('')}${ask.map(item).join('')}
    ${ok.length ? `<div class="tiny" style="color:#CFE9DC">✓ ${ok.map(q => esc(split(q.text)[0])).join(' · ')}</div>` : ''}
    ${gone ? `<button type="button" class="qx" data-showgone="1">${showDismissed ? 'Hide' : 'Show'} ${gone} set aside</button>${showDismissed ? list.filter(q => dismissed.includes(qid(q))).map(q => `<div class="q ask" style="opacity:.55"><div class="ic">?</div><div class="grow"><div class="qh">${esc(split(q.text)[0])}</div><button type="button" class="qx" data-undismiss="${qid(q)}">Bring back</button></div></div>`).join('') : ''}` : ''}</section>`;
}
// Scroll to the field a question is about and show it. f: data-f path, #id, #/route,
// or (used by the help guides) a CSS selector that starts with [ or .
export function focusField(f, root) {
  if (!f) return false;
  if (f.startsWith('#/')) { location.hash = f; return true; }
  root = root || document.getElementById('view');
  let el = null;
  if (f.startsWith('#') || f.startsWith('[') || f.startsWith('.')) { try { el = root.querySelector(f); } catch (e) { el = null; } }
  else el = root.querySelector(`[data-f="${f}"]`);
  if (!el) return false;
  let d = el.parentElement; while (d) { if (d.tagName === 'DETAILS') d.open = true; d = d.parentElement; }
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) setTimeout(() => el.focus({ preventScroll: true }), 350);
  el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1600);
  return true;
}
// The jump button is no longer needed: on narrow screens the panel is a drawer above the nav.
export function chalJump() { return ''; }
// opts: { rec (holds the set-aside list), save(), repaint(), goTab(tab, f) }
export function paintChal(el, list, title, sub, opts = {}) {
  const rec = opts.rec || {}; const dismissed = rec.dismissed || [];
  const html = box(list, title, sub, dismissed);
  const c = el.querySelector('#chal'); if (c) c.innerHTML = html;
  const open = list.filter(q => q.kind !== 'ok' && !dismissed.includes(qid(q))).length;
  const dock = document.getElementById('chalDock');
  if (dock) {
    dock.hidden = false; document.body.classList.add('dock'); dock.classList.toggle('open', dockOpen);
    dock.innerHTML = `<button type="button" class="dockbar" id="dockBar" aria-expanded="${dockOpen}">${bulb()}<span class="grow" style="text-align:left">${esc(title)}</span><span class="pill ${open ? 'lamp' : 'good'}">${open ? open + ' open' : 'All clear'}</span><span class="chev">${dockOpen ? '▾' : '▴'}</span></button><div class="dockbody">${html}</div>`;
    dock.querySelector('#dockBar').onclick = () => { dockOpen = !dockOpen; dock.classList.toggle('open', dockOpen); dock.querySelector('#dockBar').setAttribute('aria-expanded', dockOpen); dock.querySelector('.chev').textContent = dockOpen ? '▾' : '▴'; };
  }
  const wire = root => {
    root.querySelectorAll('[data-toggle]').forEach(b => b.onclick = () => { const q = b.closest('.q'); q.classList.toggle('open'); b.textContent = q.classList.contains('open') ? '⌄' : '›'; });
    root.querySelectorAll('[data-go]').forEach(h => { const go = () => {
      const f = h.dataset.go, tab = h.dataset.tab;
      if (dock) { dockOpen = false; dock.classList.remove('open'); }
      if (tab && opts.goTab && !focusField(f, el)) { opts.goTab(tab, f); return; }
      if (!focusField(f, el) && f.startsWith('#')) focusField(f);
    }; h.onclick = go; h.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }; });
    root.querySelectorAll('[data-dismiss]').forEach(b => b.onclick = () => { rec.dismissed = (rec.dismissed || []).concat(b.dataset.dismiss); opts.save && opts.save(); opts.repaint ? opts.repaint() : paintChal(el, list, title, sub, opts); });
    root.querySelectorAll('[data-undismiss]').forEach(b => b.onclick = () => { rec.dismissed = (rec.dismissed || []).filter(x => x !== b.dataset.undismiss); opts.save && opts.save(); opts.repaint ? opts.repaint() : paintChal(el, list, title, sub, opts); });
    root.querySelectorAll('[data-showgone]').forEach(b => b.onclick = () => { showDismissed = !showDismissed; opts.repaint ? opts.repaint() : paintChal(el, list, title, sub, opts); });
  };
  if (c) wire(c); if (dock) wire(dock);
}
export const openCount = list => list.filter(q => q.kind === 'req').length;
export const popLabels = ids => (ids || []).map(k => POP[k] && POP[k].lab).filter(Boolean);

/* ---------- Principle evidence: the connective tissue ---------- */
export function principleEvidence(p, t) {
  const drills = S.drills().filter(d => S.drillLinks(d, t).includes(p.id));
  const since = addDays(today(), -28);
  const sess = S.sessions(t).filter(s => !s.cancelled && (s.principleIds || []).includes(p.id));
  const recent = sess.filter(s => s.date && s.date >= since && s.date <= today());
  const scores = S.reviews(t).filter(r => r.evidence && r.evidence[p.id] != null).map(r => ({ date: r.date, v: r.evidence[p.id] }));
  const tally = { 2: 0, 1: 0, 0: 0 }; scores.forEach(s => tally[s.v]++);
  const blocks = S.blocks(t).filter(b => (b.principleIds || []).includes(p.id));
  return { drills, sessions: sess, recent, scores, tally, blocks };
}

/* ---------- Game model ---------- */
export function modelChallenges(t) {
  const team = S.get(t) || {}; const ps = S.principles(t); const out = [];
  if (!has(team.identity)) out.push(Q('ask', 'Identity: one paragraph on how this team plays and what it will never do. Every principle below should be explained by it.', 'Game model', 'identity'));
  Object.entries(PHASES).forEach(([k, ph]) => {
    const n = ps.filter(p => p.phase === k).length;
    if (!n) out.push(Q(k === 'sp' ? 'ask' : 'req', `${ph.lab}: no principles yet. How do you want the team to behave here?`, 'Game model'));
    if (n > 5) out.push(Q('ask', `${ph.lab}: ${n} principles. Players carry three or four. Which of these are really sub-principles of another?`, 'Game model'));
  });
  const drafts = ps.filter(p => p.status !== 'agreed');
  if (drafts.length) out.push(Q('ask', `${drafts.length} principle${drafts.length > 1 ? 's are' : ' is'} still a draft. Rewrite in your own words, then mark agreed so sessions can be built on it.`, 'Game model'));
  ps.forEach(p => {
    const ev = principleEvidence(p, t); const gaps = [];
    if (!ev.drills.length) gaps.push('a drill that trains it');
    if (!(p.subs || []).length) gaps.push('sub-principles (what each unit does)');
    if (!has(p.trigger)) gaps.push('a trigger (when it applies, what the cue is)');
    if (!(p.pops || []).length) gaps.push('principles-of-play tags');
    if (!p.boardId || !S.get(p.boardId)) gaps.push('a picture (a board that shows it)');
    if (gaps.length) out.push(Q('ask', `“${p.title || 'Untitled'}” is missing ${gaps.join('; ')}.`, 'Game model', `#/principle/${p.id}`));
    const last2 = ev.scores.slice(0, 2);
    if (last2.length === 2 && last2.every(s => s.v === 0)) out.push(Q('ask', `“${p.title}” was not seen in the last two reviews. Coaching problem, player problem, or the wrong principle for this group?`, 'Review', `#/principle/${p.id}`));
  });
  if (team && !(team.roles && Object.values(team.roles).some(v => v && v.trim()))) out.push(Q('ask', 'Positional roles are blank. What do you expect of each position in your shape?', 'Game model'));
  const cb = S.currentBlock(t);
  if (ps.length && !cb) out.push(Q('ask', 'No training block is running. Which principle gets the next four to six weeks, and what does each week add?', 'Programme', '#/plans/programme'));
  if (!out.length) out.push(Q('ok', 'Every phase has principles; each has a trigger, a picture, tags and a drill; a block is running; nothing is flagged by recent reviews.'));
  return out;
}

/* ---------- Drill ---------- */
export function drillChallenges(d, t) {
  const out = []; const links = S.drillLinks(d, t).map(S.get).filter(Boolean);
  if (!d.objective || d.objective.trim().length < 8) out.push(Q('req', 'What is this practice for? Write the objective as what the players will be better at by the end.', 'UEFA C: planning', 'objective'));
  else out.push(Q('ok', 'Objective set.'));
  if (!S.principles(t).length) out.push(Q('req', 'This team’s game model is empty. Drills hang off principles, so add those first.', 'Game model', '#/model'));
  else if (!links.length) out.push(Q('req', 'Which principle does this serve for this team? If none, why is it in your sessions? Link one, or add the principle to your game model.', 'Game model', '#drillPrinciples'));
  else {
    const pops = [...new Set(links.flatMap(p => p.pops || []))];
    out.push(Q('ok', 'Serves: ' + links.map(p => p.title).join('; ') + (pops.length ? ` (principles of play: ${popLabels(pops).join(', ').toLowerCase()})` : '')));
    if (!pops.length) out.push(Q('ask', 'The linked principles carry no principles-of-play tags, so this practice can’t be read in course language (penetration, support, width, delay, cover…). Tag them in the game model.', 'Principles of play', '#/model'));
    const ph = [...new Set(links.map(p => p.phase))];
    if (ph.length > 2) out.push(Q('ask', `Linked to ${ph.length} different phases. Is it trying to do too much? A sharper focus usually coaches better.`, null, '#drillPrinciples'));
  }
  if (!d.direction) out.push(Q('ask', 'Is there a direction of play and a way to score or succeed? Say which. Non-directional practices have their place, but the game has goals at both ends.', 'England DNA', 'direction'));
  else if (d.direction === 'non' && GAMELIKE.includes(d.type)) out.push(Q('ask', 'A game-type practice with no direction. Where do players learn which way is forward?', 'England DNA', 'direction'));
  const items = d.items || []; const def = items.filter(i => i.kind === 'def').length;
  if (OPPOSED.includes(d.type) && !def) out.push(Q('ask', 'You’ve called this opposed but there are no defenders on the plan. Who is making the decisions hard?', 'England DNA', '#dc'));
  if (OPPOSED.includes(d.type) && !has(d.transition)) out.push(Q('ask', 'Transition: what happens the moment the ball is won or lost in this practice? If the answer is “nothing”, the practice stops where the game gets interesting.', 'England DNA', 'transition'));
  if (d.type === 'Technical (unopposed)') out.push(Q('ask', 'Unopposed: how does it transfer to the game? Where do players have to scan or decide?', 'England DNA', 'type'));
  if (!d.points || d.points.trim().length < 5) out.push(Q('req', 'Coaching points: what will you look for, and what will you say when it goes wrong?', null, 'points'));
  if (!has(d.success)) out.push(Q('ask', 'What does success look like? Something you can see or count, so you know when to progress it.', 'UEFA C: planning', 'success'));
  if (!d.prog || !d.reg) out.push(Q('ask', 'Too easy after five minutes, or falling apart? Plan the change: space, task, equipment or players.', 'STEP', 'prog'));
  const iv = d.interventions || [];
  if (!iv.length) out.push(Q('ask', 'How will you intervene? Pick at least one style so you go in with a plan.', 'Coaching behaviours', '#interventions'));
  else if (iv.length === 1 && iv[0] === 'command') out.push(Q('ask', 'Only “command” planned. Where could a question or guided discovery let them find the answer themselves?', 'Coaching behaviours', '#interventions'));
  if ((iv.includes('qa') || iv.includes('guided')) && !has(d.questions)) out.push(Q('ask', 'You plan to ask questions. Write two or three now; questions made up on the spot tend to be “what should you have done?”', 'Coaching behaviours', 'questions'));
  else if (!has(d.questions)) out.push(Q('ask', 'Planned questions: two or three that open the decision up (“where’s the space when she steps in?”).', 'Coaching behaviours', 'questions'));
  if (!has(d.stepIn)) out.push(Q('ask', 'When do you step in? Name the picture that makes you stop it, so you don’t stop it for everything else.', 'Coaching behaviours', 'stepIn'));
  const n = +d.players || items.filter(i => ['att', 'def', 'neu', 'gk'].includes(i.kind)).length;
  if (n > 0 && d.preset !== 'full' && d.preset !== 'half' && d.w && d.h) {
    const a = (d.w * d.h) / n;
    out.push(Q('ask', `Space: about ${Math.round(a)} m² per player (a full 11 v 11 pitch is about 325 m²). Does the area match the part of the pitch this principle lives in? Tighter means more pressure and quicker decisions.`, null, '#area'));
  }
  return out;
}

/* ---------- Session ---------- */
export function sessionStats(s) {
  const blocks = s.blocks || [];
  const total = blocks.reduce((a, b) => a + (+b.minutes || 0), 0);
  const talk = blocks.reduce((a, b) => a + (+b.talk || 0), 0);
  const rolling = total ? Math.round(100 * (total - talk) / total) : 0;
  const drills = blocks.map(b => S.get(b.drillId)).filter(Boolean);
  return { total, talk, rolling, drills };
}
export function sessionKit(s) {
  const kit = {}; let balls = 0;
  sessionStats(s).drills.forEach(d => {
    const c = {}; (d.items || []).forEach(i => { if (['att', 'def', 'neu', 'gk', 'coach', 'text', 'zone'].includes(i.kind)) return; const k = i.kind === 'disc' || i.kind === 'cone' ? i.kind + ':' + (i.color || '') : i.kind; c[k] = (c[k] || 0) + 1; });
    Object.entries(c).forEach(([k, v]) => { if (k === 'ball') balls = Math.max(balls, v); else kit[k] = Math.max(kit[k] || 0, v); });
  });
  return { kit, balls };
}
export function sessionChallenges(s, t) {
  const out = []; const st = sessionStats(s); const ps = (s.principleIds || []).map(S.get).filter(Boolean);
  const due = S.reviewsDue(t).filter(x => x.rec.id !== s.id && (!s.date || x.rec.date < s.date));
  if (due.length) out.push(Q('req', `${due.length} review${due.length > 1 ? 's' : ''} outstanding from before this session. Write ${due.length > 1 ? 'them' : 'it'} first: that’s where this session should come from.`, 'Plan-Do-Review', '#/plans/reviews'));
  if (!s.theme || s.theme.trim().length < 5) out.push(Q('req', 'Session theme: one sentence on what the team will be better at by the end.', null, 'theme'));
  if (!ps.length) out.push(Q('req', 'Which principle(s) is this session about?', 'Game model', '#sessionPrinciples'));
  const blk = S.blockFor(t, s.date);
  if (ps.length && !blk) out.push(Q('ask', 'This session isn’t in a training block. One-off sessions don’t add up; put four to six weeks behind a principle in Plans > Programme.', 'Programme', '#/plans/programme'));
  else if (blk && ps.length && !ps.some(p => (blk.principleIds || []).includes(p.id))) out.push(Q('ask', `The block “${blk.title}” is about ${(blk.principleIds || []).map(S.get).filter(Boolean).map(p => p.title).join(', ') || 'other principles'}; this session isn’t. Deliberate (match prep, a problem from the review), or drift?`, 'Programme', '#sessionPrinciples'));
  const lc = S.lastChange(t);
  if (lc) {
    if (!s.addresses) out.push(Q('ask', `Your last review said: “${lc.change}”. Does this session act on it? If so, tick the box and say how.`, 'Carried forward', 'addresses'));
    else if (!has(s.addressesHow)) out.push(Q('req', 'You’ve ticked that this session acts on the last review. Say how: which practice, which players, what will look different.', 'Carried forward', 'addressesHow'));
    else out.push(Q('ok', `Acts on the last review: ${s.addressesHow}`, 'Carried forward'));
  }
  if (!has(s.lookFor)) out.push(Q('ask', 'What are you looking for tonight? Two or three things you could see or count. The review will ask whether you saw them.', 'Plan-Do-Review', 'lookFor'));
  const focus = (s.focusIds || []).map(S.get).filter(Boolean);
  if (!focus.length) out.push(Q('ask', 'Who are you coaching tonight? Pick one or two players and the goal you’re working on with them. The team session is where individual goals get coached.', 'UEFA C: player development', '#focusChips'));
  else if (!has(s.focusHow)) out.push(Q('ask', `Focus on ${focus.map(p => p.name).join(' and ')}: what will you watch for, and what will you say to them?`, 'UEFA C: player development', 'focusHow'));
  if (!st.drills.length) out.push(Q('req', 'Add practices from your drill library.', null, '#running'));
  const unlinked = st.drills.filter(d => ps.length && !S.drillLinks(d, t).some(id => (s.principleIds || []).includes(id)));
  if (unlinked.length) out.push(Q('ask', `${unlinked.map(d => '“' + d.name + '”').join(', ')} ${unlinked.length > 1 ? 'aren’t' : 'isn’t'} linked to this session’s principles. Earning ${unlinked.length > 1 ? 'their' : 'its'} place?`, null, '#running'));
  if (st.drills.length && !st.drills.some(d => GAMELIKE.includes(d.type))) out.push(Q('ask', 'Nothing here looks like the game yet. Do players get to apply the theme against opposition, in the right area of the pitch, before the end?', 'England DNA', '#running'));
  if (st.drills.length > 1) {
    const order = st.drills.map(d => GAMELIKE.includes(d.type) ? 2 : OPPOSED.includes(d.type) ? 1 : 0);
    if (order[order.length - 1] < order[0]) out.push(Q('ask', 'The session ends with something less game-like than it started with. Is the arc deliberate (whole-part-whole), or has the game ended up in the wrong place?', 'Practice design', '#running'));
  }
  if (st.total) {
    out.push(Q(st.rolling >= 70 ? 'ok' : 'ask', `Ball rolling: ${st.rolling}% of ${st.total} minutes planned (talk and set-up: ${st.talk} min). That is a plan; the review asks what it actually was.${st.rolling < 70 ? ' The England DNA aim is at least 70%. Where can you cut the talking?' : ''}`, 'England DNA', '#running'));
    if (s.length && Math.abs(st.total - s.length) > 5) out.push(Q('ask', `Blocks add up to ${st.total} min but the session is ${s.length} min. Which is right?`, null, 'length'));
  }
  if (!s.injuryPrev) out.push(Q('ask', 'Does the warm-up include injury-prevention work? Tick it below if it does, or plan it in.', 'Player welfare', 'injuryPrev'));
  const corners = new Set(); st.drills.forEach(d => Object.keys(CORNERS).forEach(k => { if (((d.corners || {})[k] || '').trim()) corners.add(k); }));
  if (st.drills.length && corners.size < 2) out.push(Q('ask', `Across the session you’re developing ${corners.size} of the four corners. Is that deliberate?`, 'Four Corner Model', '#running'));
  const iv = new Set(); st.drills.forEach(d => (d.interventions || []).forEach(x => iv.add(x)));
  if (st.drills.length && iv.size < 2) out.push(Q('ask', 'You’ve planned one intervention style for the whole session. Mixing them reaches more players.', 'Coaching behaviours', '#running'));
  const nm = S.nextMatch(t);
  if (nm && nm.date && (!s.date || nm.date >= s.date)) out.push(Q(s.matchPrep ? 'ok' : 'ask', `Next match: ${nm.opponent}, ${fmtD(nm.date)}. Does this session prepare for anything specific about them?`, 'Match preparation', 'matchPrep'));
  return out;
}

/* ---------- Match ---------- */
// Which principles does this opponent test most? Rules from the tags, matched against the words
// in each principle. A suggestion for Joe to accept or change, not a verdict.
export function threatened(m, t) {
  const tg = m.tags || {}; const o = m.opp || {}; const ps = S.principles(t); const hit = new Set();
  const grab = (phases, re) => ps.filter(p => phases.includes(p.phase) && re.test((p.title || '') + ' ' + (p.why || ''))).forEach(p => hit.add(p.id));
  if (tg.press === 'high organised press' || tg.press === 'individual/unorganised') grab(['ip'], /out|build|keep|possession|through|goalkeeper|\bgk\b|\b6\b|link|ball/i);
  if (tg.press === 'mid block' || tg.press === 'low block' || /4-5-1|block|\bsit\b/i.test(o.op || '')) grab(['ip'], /create|final|cross|width|wide|switch|overload|penetrat|chance|shot/i);
  if (tg.build === 'long/direct') grab(['op', 'td'], /second|aerial|duel|first contact|compact|drop|header|long|cover/i);
  if (tg.build === 'play out from back') grab(['op', 'ta'], /press|trigger|win|high|force|counter/i);
  if (tg.transition === 'dangerous on the counter') grab(['td', 'ip'], /rest|lose|counter|react|behind|cover|balance/i);
  if (tg.setpiece === 'high' || tg.aerial === 'strong') grab(['sp', 'op'], /corner|set|free kick|throw|mark|zonal|aerial/i);
  if (tg.aerial === 'weak') grab(['ip', 'sp'], /cross|wide|back post|deliver|corner|aerial/i);
  if (!hit.size) ['ip', 'op'].forEach(k => { const p = ps.find(x => x.phase === k); if (p) hit.add(p.id); });
  return [...hit];
}
export function matchChallenges(m, t) {
  const team = S.get(t) || {}; const tg = m.tags || {}; const st = team.style || {}; const o = m.opp || {}; const p = m.plan || {}; const out = [];
  const req = (c, txt, src, f, tab) => out.push(Q(c ? 'ok' : 'req', txt, src, f, tab));
  req(!!(o.ip && o.op), 'Describe how they play, both in and out of possession.', 'Opposition analysis', 'opp.ip', 'them');
  req(lines(p.keys).length >= 2, 'What wins you this game? At least two things, one per line.', null, 'plan.keys', 'plan');
  req(!!p.threat, 'What is their biggest threat, and what is your answer to it?', null, 'plan.threat', 'plan');
  req(has(p.planB), 'Plan B: what tells you it isn’t working (the trigger), and what you change. A plan with no plan B is a hope.', 'Match management', 'plan.planB', 'plan');
  if (!has(p.first)) out.push(Q('ask', 'The first ten minutes: what do you expect from them, and what do you want from us? Say it so the players can picture it.', 'Match management', 'plan.first', 'plan'));
  if (!has(p.subs)) out.push(Q('ask', 'Substitutions: who comes on for what, and who moves where when they do? Decide it now, not in the 70th minute.', 'Match management', 'plan.subs', 'plan'));
  const prev = S.previousMeetings(t, m);
  if (prev.length && !(o.ip || o.op)) out.push(Q('ask', `You’ve played ${m.opponent} before (${prev.map(x => fmtD(x.date)).join(', ')}). Start from last time’s analysis and review, then update it.`, 'Opponent file', '#oppFile', 'them'));
  const build = st.build || '';
  if (build === 'play out from back' && tg.press === 'high organised press') out.push(Q('ask', 'They press high and organised, and you play out. Where is your free player? Which board frame shows the answer? What’s the trigger to go long instead?', null, 'plan.ip', 'plan'));
  if (build === 'play out from back' && tg.press === 'individual/unorganised') out.push(Q('ask', 'Their press is individual and disorganised. How do you invite it, then play through the gaps it leaves? Who is the third player?', null, 'plan.ip', 'plan'));
  if (['mid block', 'low block'].includes(tg.press) || /4-5-1|\bsit\b|block/i.test(o.op || '')) out.push(Q('ask', 'Against a block: how do you create overloads and win second balls? With bodies committed forward, what’s your rest defence if you lose it?', null, 'plan.ip', 'plan'));
  if (tg.build === 'long/direct') out.push(Q('ask', 'They go long. Who wins first contact, who is set for the second ball, and is your 6 in the right place for it?', null, 'plan.op', 'plan'));
  if (tg.aerial === 'weak') out.push(Q('ask', 'They’re weak in the air. Is there a crossing plan and a set-piece plan to use it? Who attacks the back post?', null, 'plan.ip', 'plan'));
  if (tg.transition === 'dangerous on the counter') out.push(Q('ask', 'They hurt teams on the counter. When your full-backs push on, who is left, and where?', null, 'plan.op', 'plan'));
  if (tg.transition === 'slow/blunt') out.push(Q('ask', 'Their transitions are slow. Can you win it back and attack before they reorganise? Is that in your plan?', null, 'plan.ip', 'plan'));
  const boards = (m.boardIds || []).map(S.get).filter(Boolean);
  if (tg.setpiece === 'high' && !boards.some(b => b.type === 'setpiece')) out.push(Q('ask', 'Set-piece threat is high and no set-piece board is attached. Plan who marks whom, on a board you can print.', null, '#boards', 'boards'));
  if (!has(p.sp)) out.push(Q('ask', 'Our set pieces: corners, wide free kicks, throws. Which routine, and why against this keeper and this marking?', null, 'plan.sp', 'plan'));
  if (!has(p.spAgainst)) out.push(Q('ask', 'Their set pieces: who marks whom, zonal or man, who stays up for the counter?', null, 'plan.spAgainst', 'plan'));
  if (!boards.length) out.push(Q('ask', 'No boards attached. Attach the shapes and set pieces you’ll use, so the printed plan and player pages carry them.', null, '#boards', 'boards'));
  const squad = (m.squadIds || []).filter(id => S.get(id));
  if (!squad.length) out.push(Q('ask', 'Who’s in the squad? Pick them so you can give individual instructions.', 'Match preparation', '#squadChips', 'squad'));
  else {
    const noIns = squad.filter(id => !((m.instructions || {})[id] || '').trim()).length;
    if (noIns) out.push(Q('ask', `${noIns} of ${squad.length} players have no individual instruction. Does each one know her job against this opponent?`, 'Match preparation', '#instructions', 'squad'));
  }
  // Principles under test: only the ones this opponent threatens, not every principle every week.
  const focus = (p.focusIds || []).map(S.get).filter(Boolean);
  if (S.principles(t).length && !focus.length) {
    const sug = threatened(m, t).map(S.get).filter(Boolean).map(x => x.title);
    out.push(Q('ask', `Which two or three principles does this opponent test most?${sug.length ? ' From the tags: ' + sug.join('; ') + '.' : ''} Pick them in Our plan and say how each holds up.`, 'Game model', '#focusPrinciples', 'plan'));
  }
  focus.forEach(pr => { if (!has((p.principleNotes || {})[pr.id])) out.push(Q('ask', `“${pr.title}” (${PHASES[pr.phase].short}) is under test. Keep it, tweak it for this game, or accept the risk? Note how.`, 'Game model', `plan.principleNotes.${pr.id}`, 'plan')); });
  const trained = S.trainedBefore(t, m);
  if (trained.length) {
    const tp = new Set(trained.flatMap(s => s.principleIds || []));
    const inPlan = focus.some(f => tp.has(f.id)) || trained.some(s => s.matchPrep);
    if (!inPlan) out.push(Q('ask', `This week you trained ${trained.map(s => '“' + (s.theme || 'session') + '”').join(', ')}. None of it is in this plan. Either put it in (keys, focus principles) or ask why you trained it.`, 'Training to match', '#trained', 'plan'));
  } else if (m.date && m.date >= today()) out.push(Q('ask', 'No session in the seven days before this match. What are the players going into it on?', 'Training to match', '#/plans/sessions'));
  if (m.date && m.date < today() && !m.cancelled) {
    const rv = S.reviewOf(m);
    if (!rv) out.push(Q('req', 'This match has been played. Write the review: it’s what makes the game model learn.', 'Plan-Do-Review', '#reviewBar'));
    else if (!S.reviewDone(rv)) out.push(Q('req', 'The review of this match is unfinished. Finish it: the next session is built from it.', 'Plan-Do-Review', '#reviewBar'));
  }
  return out;
}

/* ---------- Review ---------- */
export function reviewChallenges(r, t) {
  const o = []; const ids = r.principleIds || [];
  if (!has(r.worked) || !has(r.didnt)) o.push(Q('req', 'Both halves: what worked and what didn’t. A review with only good news teaches nothing.', null, 'worked'));
  if (r.carried) {
    if (r.lastChangeDone == null) o.push(Q('req', `Last time you decided: “${r.carried.text}”. Did you do it?`, 'Plan-Do-Review', '#carried'));
    else if (r.lastChangeDone === 0) o.push(Q('ask', 'You didn’t make the change you decided on. What got in the way, and is it still the right change?', 'Plan-Do-Review', 'lastChangeEffect'));
    else if (!has(r.lastChangeEffect)) o.push(Q('ask', 'You made the change. What happened? Keep it, build on it, or drop it?', 'Plan-Do-Review', 'lastChangeEffect'));
  }
  if (r.type === 'match') { // the record's own kind is 'review'; the match/session flag is r.type
    const keys = r.keys || []; const un = keys.filter(k => k.v == null).length;
    if (un) o.push(Q('req', `${un} key${un > 1 ? 's' : ''} to winning not scored. Did the plan happen?`, null, '#keys'));
    if (!has(r.goalsHow)) o.push(Q('ask', 'Every goal, both ends: which phase, which principle held or failed, who was where. This is the most honest data you have.', 'Match analysis', 'goalsHow'));
    if (!has(r.decisions)) o.push(Q('ask', 'What did you change during the game (shape, subs, instructions), when, and did it work? If nothing: was that a decision or a lapse?', 'Match management', 'decisions'));
    if (!has(r.moments)) o.push(Q('ask', 'The two or three moments that decided it. Clip them if you can.', 'Match analysis', 'moments'));
    if (!has(r.them)) o.push(Q('ask', 'What did they do that you didn’t expect? It goes in the file for next time you play them.', 'Opponent file', 'them'));
    if (r.trained && r.trained.length && r.trainedShowed == null) o.push(Q('ask', `This week you trained ${r.trained.map(x => '“' + x + '”').join(', ')}. Did it show in the game?`, 'Training to match', '#trainedShowed'));
  } else {
    if (r.rollingActual == null || r.rollingActual === '') o.push(Q('ask', `Ball rolling: roughly what share of the session was the ball actually moving?${r.plannedRolling != null ? ' You planned ' + r.plannedRolling + '%.' : ''} Count your stops next time if you’re guessing.`, 'England DNA', 'rollingActual'));
    else if (+r.rollingActual < 70) o.push(Q('ask', `Ball rolling ${r.rollingActual}%: below the 70% aim. What stopped it: your talking, the set-up, the numbers?`, 'England DNA', 'rollingActual'));
    if (r.lookFor && r.lookForSeen == null) o.push(Q('ask', `You said you were looking for: “${r.lookFor}”. Did you see it?`, 'Plan-Do-Review', '#lookForSeen'));
    if (r.focus && r.focus.length && !r.focus.some(f => has((r.playerObs || {})[f.id]))) o.push(Q('ask', `Your focus player${r.focus.length > 1 ? 's were' : ' was'} ${r.focus.map(f => f.name).join(' and ')}. One line each: what you saw, what you said, what next.`, 'UEFA C: player development', '#playerObs'));
  }
  const unscored = ids.filter(id => (r.evidence || {})[id] == null).length;
  if (unscored) o.push(Q('ask', `${unscored} principle${unscored > 1 ? 's' : ''} under test not scored yet.`, 'Game model', '#scores'));
  const no = ids.filter(id => (r.evidence || {})[id] === 0).map(S.get).filter(Boolean);
  if (no.length) o.push(Q('ask', `Not seen: ${no.map(p => p.title).join('; ')}. Coaching problem (not trained enough), player problem, or is the principle wrong for this group?`, null, '#scores'));
  if (!(r.why || []).length) o.push(Q('ask', 'Why did it happen? Be honest whether it was the plan, your delivery or the players.', null, '#why'));
  else if (!(r.why || []).includes('delivery')) o.push(Q('ask', 'You haven’t ticked your own delivery. Was there really nothing in how you set it up, intervened or communicated?', 'Coaching behaviours', '#why'));
  if (!has(r.change)) o.push(Q('req', 'One thing to change next time. This is what your next session is built from.', 'Plan-Do-Review', 'change'));
  if (!has(r.self)) o.push(Q('req', 'What did you learn about yourself as a coach today?', 'UEFA C: coaching strengths and areas for development', 'self'));
  if (no.length && !has(r.modelChange)) o.push(Q('ask', 'Does the game model need to change? If yes, say how, then edit the principle.', null, 'modelChange'));
  // A key that worked is a candidate principle. Asked here, once, where it can be answered (not on every match plan for ever).
  const won = (r.keys || []).filter(k => k.v === 2);
  if (r.type === 'match' && won.length && !has(r.modelChange)) o.push(Q('ask', `${won.length === 1 ? 'A key' : won.length + ' keys'} to winning worked (“${won[0].text}”). One-off for this opponent, or part of how you play? If it’s the latter, say so above and add it to the model.`, 'Game model', 'modelChange'));
  if (!o.length) o.push(Q('ok', 'Complete. The change you wrote will appear when you plan the next session.'));
  return o;
}
// The gate and the lists use the same definition as the store, so they can never disagree.
export const reviewComplete = (r) => S.reviewDone(r);
