// Practice ideas: session and drill templates from top-level coaching, sorted by what they train.
// Routes: #/ideas, #/ideas/p/<principle> (for one principle), #/ideas/s/<session> (adding to a session),
// #/ideas/t/<theme>; #/idea/<template>[/s|p/<id>] for one idea.
import * as S from '../store.js';
import { PHASES, PHASE_KEYS } from '../store.js';
import { esc, icon, uid, actions, sheet, closeSheet, toast } from '../util.js';
import { drillSvg } from '../pitch.js';
import { THEMES, themesFor, themeOf, DRILL_TEMPLATES, SESSION_TEMPLATES, drillsForTheme, sessionsForTheme, tplById, sessionTplById } from '../templates.js';
import { createSession } from './session.js';
import { reviewGate } from './review.js';

const tplDrill = t => ({ w: t.w, h: t.h, preset: 'custom', items: t.items(), arrows: [] });
const credit = s => s ? `${esc(s.who)}${s.role ? ', ' + esc(s.role) : ''}` : '';
const themeChips = ths => ths.length > 6 ? '<span class="pill grey">Any theme</span>' : ths.map(k => `<span class="pill grey">${esc(THEMES[k].lab)}</span>`).join('');

// Principles of this team that a template trains (same theme), so a new drill arrives linked.
function linkFor(T, tpl, extra = []) {
  const ids = new Set(extra);
  if (!tpl.general) S.principles(T).forEach(p => { if (tpl.themes.includes(themeOf(p))) ids.add(p.id); });
  return [...ids];
}
// One drill per template in the library: reuse it if it is already there.
function drillFromTemplate(tpl, T, pids) {
  const have = S.drills().find(d => d.tplId === tpl.id);
  if (have) {
    const cur = new Set(S.drillLinks(have, T)); pids.forEach(x => cur.add(x));
    have.links = { ...(have.links || {}), [T]: [...cur] }; S.put(have); return { d: have, existed: true };
  }
  const d = S.create('drill', null, {
    tplId: tpl.id, name: tpl.name, type: tpl.type, area: 'custom', preset: 'custom', w: tpl.w, h: tpl.h,
    items: tpl.items(), arrows: [], objective: tpl.objective, org: tpl.org + (tpl.sizeNote ? ' ' + tpl.sizeNote : ''), how: tpl.how, points: tpl.points,
    prog: tpl.prog, reg: tpl.reg, transition: tpl.transition || '', questions: tpl.questions || '', stepIn: tpl.stepIn || '', success: tpl.success || '',
    direction: /rondo|Warm-up/i.test(tpl.name + tpl.type) && !/goal/i.test(tpl.how) ? 'non' : 'dir',
    corners: { ...(tpl.corners || {}) }, interventions: [], players: tpl.players, minutes: tpl.minutes,
    links: pids.length ? { [T]: pids } : {}, src: tpl.src
  });
  return { d, existed: false };
}
function addBlocks(s, drills) {
  drills.forEach(d => s.blocks.push({ id: uid(), drillId: d.id, minutes: +d.minutes || 15, talk: 3, note: '' }));
  S.put(s);
}

function themePicker(p, onDone) {
  const opts = themesFor(p.phase);
  const el = sheet(`<div class="stack"><div class="h2">What is “${esc(p.title || 'this principle')}” about?</div>
    <p class="small muted" style="margin:0">Your principle stays in your words. This tag just links it to practice ideas that train it.</p>
    <div class="list">${opts.map(k => `<button class="item" data-th="${k}"><span class="grow t">${esc(THEMES[k].lab)}</span>${themeOf(p) === k ? '<span class="pill good">Now</span>' : ''}</button>`).join('')}
    <button class="item" data-th="none"><span class="grow t muted">None of these</span></button></div>
    <button class="btn" id="tpX">Cancel</button></div>`);
  el.querySelectorAll('[data-th]').forEach(b => b.onclick = () => { p.theme = b.dataset.th; S.put(p); closeSheet(); onDone && onDone(); });
  el.querySelector('#tpX').onclick = closeSheet;
}
export { themePicker };

export default function ideasView(el, params, ctx) {
  const T = S.team().id;
  const [kind, cid] = params;
  const sess = kind === 's' ? S.get(cid) : null;
  const prin = kind === 'p' ? S.get(cid) : null;
  const ps = S.principles(T);
  // The theme shown: the URL's, a choice made earlier in this same context, the principle's or the
  // session's, or the last one picked.
  const key = sess ? 's:' + sess.id : prin ? 'p:' + prin.id : '';
  const m = S.meta();
  let th = kind === 't' ? cid
    : key && m.ideaCtx === key ? (m.ideaCtxTheme || '')
    : prin ? themeOf(prin) : sess ? (sess.principleIds || []).map(x => themeOf(S.get(x))).find(Boolean) || '' : (m.ideaTheme || '');
  if (th && !THEMES[th]) th = '';
  const suffix = sess ? `/s/${sess.id}` : prin ? `/p/${prin.id}` : '';
  ctx.setTop({ back: sess ? '#/session/' + sess.id : prin ? '#/principle/' + prin.id : '#/plans/drills', title: 'Practice ideas', sub: sess ? 'Adding to a session' : prin ? 'For: ' + (prin.title || 'principle') : 'From top-level coaching' });

  const pChip = p => { const pt = themeOf(p); return `<button class="chip ${pt && pt === th ? 'on' : ''}" data-act="pick" data-arg="${p.id}">${esc(p.title || 'Untitled')}${pt ? '' : ' <span class="muted">· tag it</span>'}</button>`; };
  const drills = drillsForTheme(th), sessions = sessionsForTheme(th);
  const inLib = new Set(S.drills().map(d => d.tplId).filter(Boolean));

  el.innerHTML = `<div class="stack">
    ${sess ? `<div class="banner small">Pick a practice or a whole session and it goes into the session for ${esc(S.get(sess.id) ? new Date(sess.date + 'T12:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '')}.</div>` : ''}
    <div class="card stack tight" id="ideaFilter">
      <div class="label">Train one of your principles</div>
      ${ps.length ? PHASE_KEYS.filter(k => ps.some(p => p.phase === k)).map(k => `<div class="tiny muted">${PHASES[k].lab}</div><div class="chips">${ps.filter(p => p.phase === k).map(pChip).join('')}</div>`).join('') : '<div class="small muted">No principles yet. <a href="#/model">Write your game model</a> and the ideas sort themselves by it.</div>'}
      <div class="label" style="margin-top:6px">Or pick what to work on</div>
      ${PHASE_KEYS.map(k => `<div class="tiny muted">${PHASES[k].lab}</div><div class="chips">${themesFor(k).map(t => `<button class="chip ${t === th ? 'on' : ''}" data-act="theme" data-arg="${t}">${esc(THEMES[t].lab)}</button>`).join('')}</div>`).join('')}
    </div>
    <div class="row between"><div class="h2" style="margin:0">${th ? esc(THEMES[th].lab) : 'Everything'}</div>${th ? '<button class="btn sm" data-act="theme" data-arg="">Show everything</button>' : ''}</div>
    ${sessions.length ? `<div class="eyebrow">Whole sessions</div><div class="grid3" id="ideaSessions">${sessions.map(st => `<a class="card link stack tight" href="#/idea/${st.id}${suffix}" style="text-decoration:none;display:flex">
        <div class="row nowrap" style="gap:6px">${st.parts.slice(0, 4).map(pid => { const t = tplById(pid); return t ? drillSvg(tplDrill(t), { style: 'width:25%;height:54px;border-radius:6px' }) : ''; }).join('')}</div>
        <span class="h3">${esc(st.name)}</span><span class="small muted">${esc(st.why)}</span><span class="tiny muted">${st.parts.length} practices · ${esc(st.src)}</span></a>`).join('')}</div>` : ''}
    <div class="eyebrow">Practices</div>
    <div class="grid3" id="ideaDrills">${drills.map(t => `<a class="card link stack tight" href="#/idea/${t.id}${suffix}" style="text-decoration:none;display:flex">${drillSvg(tplDrill(t), { style: 'width:100%;height:150px;border-radius:12px' })}
      <div class="row between nowrap"><span class="h3">${esc(t.name)}</span>${inLib.has(t.id) ? '<span class="pill good">In your drills</span>' : ''}</div>
      <span class="tiny muted">${esc(t.type)} · ${t.players} players · ${t.minutes} min · ${esc(t.src.who)}</span></a>`).join('')}</div>
    <p class="tiny muted" style="margin:0">Written in our own words from sessions the coaches published, with a link to each original. Adapt the numbers and sizes to your squad.</p>
  </div>`;

  actions(el, {
    theme: t => {
      if (key) { S.setMeta('ideaCtx', key); S.setMeta('ideaCtxTheme', t); ctx.refresh(); return; }
      S.setMeta('ideaTheme', t); ctx.go(t ? '#/ideas/t/' + t : '#/ideas');
    },
    pick: pid => {
      const p = S.get(pid); if (!p) return;
      const go = () => {
        if (sess) { S.setMeta('ideaCtx', key); S.setMeta('ideaCtxTheme', themeOf(p)); ctx.refresh(); return; }
        S.setMeta('ideaCtx', ''); ctx.go('#/ideas/p/' + p.id);
      };
      if (!themeOf(p)) themePicker(p, go); else go();
    }
  });
}

export function ideaView(el, [tid, kind, cid], ctx) {
  const T = S.team().id;
  const sess = kind === 's' ? S.get(cid) : null;
  const prin = kind === 'p' ? S.get(cid) : null;
  const suffix = sess ? `/s/${sess.id}` : prin ? `/p/${prin.id}` : '';
  const back = `#/ideas${suffix}`;
  const st = sessionTplById(tid), t = tplById(tid);
  if (!st && !t) { ctx.setTop({ back, title: 'Practice idea' }); el.innerHTML = '<div class="empty">That idea isn’t in the library.</div>'; return; }

  if (st) {
    ctx.setTop({ back, title: st.name, sub: 'Session idea' });
    el.innerHTML = `<div class="stack" style="max-width:820px">
      <div class="card stack tight"><div class="small">${esc(st.why)}</div><div class="chips">${themeChips(st.themes)}</div><div class="tiny muted">Based on: ${esc(st.src)}</div></div>
      <div class="list">${st.parts.map((pid, i) => { const p = tplById(pid); return p ? `<a class="item" href="#/idea/${p.id}${suffix}">${drillSvg(tplDrill(p), { style: 'width:84px;height:60px;border-radius:8px;flex:none' })}<span class="grow"><span class="t" style="display:block">${i + 1}. ${esc(p.name)}</span><span class="s">${esc(p.type)} · ${p.minutes} min · ${esc(p.src.who)}</span></span></a>` : ''; }).join('')}</div>
      <div class="row"><button class="btn pri" data-act="useS" id="useS">${icon('plus')}${sess ? 'Add these practices to the session' : 'Plan a session from this'}</button></div>
      <p class="tiny muted" style="margin:0">Each practice goes into your drills, linked to any of your principles with the same theme, ready for you to edit.</p></div>`;
    actions(el, {
      useS: () => {
        const extra = sess ? (sess.principleIds || []) : [];
        const made = st.parts.map(pid => tplById(pid)).filter(Boolean).map(p => drillFromTemplate(p, T, linkFor(T, p, extra)).d);
        if (sess) { addBlocks(sess, made); toast(`${made.length} practices added`); location.hash = '#/session/' + sess.id; return; }
        reviewGate(T, () => {
          const pids = [...new Set(S.principles(T).filter(p => st.themes.includes(themeOf(p))).map(p => p.id))];
          const s = createSession(T, { theme: st.name, principleIds: pids, fromTemplate: st.id });
          addBlocks(s, made); toast('Session planned from the idea: check the date and the challenge'); location.hash = '#/session/' + s.id;
        }, 'plan a new session');
      }
    });
    return;
  }

  ctx.setTop({ back, title: t.name, sub: t.type });
  const have = S.drills().find(d => d.tplId === t.id);
  const sec = (lab, txt) => txt ? `<div class="stack tight"><div class="label">${lab}</div><div class="small" style="white-space:pre-line">${esc(txt)}</div></div>` : '';
  el.innerHTML = `<div class="split wide-right"><div class="stack">
      <div class="card" style="padding:8px">${drillSvg(tplDrill(t), { style: 'width:100%;max-height:60vh;border-radius:12px' })}</div>
      <div class="row" style="gap:8px">
        ${sess ? `<button class="btn pri" data-act="addS" id="addS">${icon('plus')}Add to this session</button>` : ''}
        <button class="btn ${sess ? '' : 'pri'}" data-act="addD" id="addD">${icon('plus')}${have ? 'Open in your drills' : 'Add to my drills'}</button>
      </div>
    </div><div class="stack">
      <div class="card stack tight">
        <div class="small">${esc(t.objective)}</div>
        <div class="tiny muted">${t.w} x ${t.h} m · ${t.players} players · ${t.minutes} min${t.sizeNote ? ' · ' + esc(t.sizeNote) : ''}</div>
        <div class="chips">${themeChips(t.themes)}</div>
      </div>
      <div class="card stack">
        ${sec('Set-up', t.org)}${sec('How it works', t.how)}${sec('Coaching points', t.points)}${sec('Transition', t.transition)}
        ${sec('Questions to ask', t.questions)}${sec('I step in when…', t.stepIn)}${sec('Success looks like', t.success)}
        ${sec('Progress', t.prog)}${sec('Regress', t.reg)}
      </div>
      <div class="card stack tight" id="ideaSrc"><div class="label">Where it comes from</div>
        <div class="small">${credit(t.src)}${t.src.where ? ` · ${esc(t.src.where)}` : ''}</div>
        ${t.src.note ? `<div class="tiny muted">${esc(t.src.note)}</div>` : ''}
        <a class="small" href="${esc(t.src.url)}" target="_blank" rel="noopener">See the original session</a>
        <div class="tiny muted">Our own write-up of the idea. The diagram is our layout; check the original for the coach’s.</div>
      </div>
    </div></div>`;
  actions(el, {
    addS: () => { const { d } = drillFromTemplate(t, T, linkFor(T, t, sess.principleIds || [])); addBlocks(sess, [d]); toast('Added to the session'); location.hash = '#/session/' + sess.id; },
    addD: () => {
      const { d, existed } = drillFromTemplate(t, T, linkFor(T, t, prin ? [prin.id] : []));
      if (!existed) { const n = (d.links && d.links[T] || []).length; toast(n ? `Added, linked to ${n} of your principles` : 'Added to your drills. Link it to a principle on the drill page'); }
      location.hash = '#/drill/' + d.id;
    }
  });
}
