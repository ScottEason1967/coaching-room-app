// Game model: phases > principles > sub-principles, with versions and evidence.
import * as S from '../store.js';
import { PHASES, PHASE_KEYS, POP, popsFor } from '../store.js';
import { esc, icon, uid, fmtDY, fmtD, today, bindFields, actions, debounce, sheet, closeSheet, confirmSheet, toast, clone } from '../util.js';
import { FORMATIONS } from '../pitch.js';
import { modelChallenges, principleEvidence, box, chalJump, paintChal } from '../challenges.js';

const pad = n => String(n).padStart(2, '0');
function evidenceLine(p, T) {
  const ev = principleEvidence(p, T); const tl = ev.tally;
  const rv = ev.scores.length ? `Reviews: ${tl[2]} seen · ${tl[1]} partly · ${tl[0]} not seen` : 'Not reviewed yet';
  return `<span>${ev.drills.length} drill${ev.drills.length === 1 ? '' : 's'}</span><span>${ev.recent.length} session${ev.recent.length === 1 ? '' : 's'} in 4 weeks</span><span>${rv}</span>`;
}
export const versionCount = T => S.principles(T).reduce((a, p) => a + (p.history || []).length, 0);

export default function model(el, params, ctx) {
  const t = S.team(); const T = t.id;
  ctx.setTop({});
  const ph = S.meta().modelPhase || 'ip';
  const ps = S.principles(T); const list = ps.filter(p => p.phase === ph);
  const drafts = ps.filter(p => p.status !== 'agreed' && p.note).length;
  const roles = [...new Set((FORMATIONS[t.formation] || []).map(r => r[0]))];
  const st = t.style || {}; const cb = S.currentBlock(T);

  el.innerHTML = `<div class="split wide-right"><div class="stack">
    <div class="row between"><div><div class="h1">Game model</div><div class="small muted" style="margin-top:4px">How ${esc(t.name)} play, phase by phase</div></div>
      <button class="btn sm" data-act="history">${icon('book')}Version ${versionCount(T) + 1} · history</button></div>${chalJump()}
    <div class="chips scroll" role="tablist" aria-label="Phases">${PHASE_KEYS.map(k => `<button class="chip ${k === ph ? 'on' : ''}" role="tab" aria-selected="${k === ph}" data-act="phase" data-arg="${k}">${PHASES[k].lab} <span style="opacity:.7">${ps.filter(p => p.phase === k).length}</span></button>`).join('')}<button class="chip ${ph === 'shape' ? 'on' : ''}" data-act="phase" data-arg="shape">Shape &amp; roles</button></div>
    ${ph === 'shape' ? shapeHtml(t, roles, st) : `
    <div class="card stack tight"><div class="row between"><div class="eyebrow">Identity</div>${cb ? `<a class="tiny" href="#/block/${cb.id}">Block: ${esc(cb.title)} · week ${S.weekOf(cb, today())} of ${cb.weeks}</a>` : '<a class="tiny" href="#/plans/programme">No block running</a>'}</div>
      <textarea data-f="identity" style="min-height:64px" placeholder="One paragraph: how ${esc(t.short || t.name)} play, what we always do, what we never do. Every principle below should follow from it."></textarea></div>
    ${drafts && list.some(p => p.note) ? `<div class="row nowrap small" style="gap:10px;color:var(--lamp-text);background:var(--lamp-soft);border:1px solid var(--lamp-line);border-radius:14px;padding:10px 12px">${icon('pen', 'style="width:18px;height:18px;flex:none;color:var(--lamp)"')}<span>Drafted from Scott’s description. Joe rewrites these in his own words, then marks them agreed.</span></div>` : ''}
    ${list.length ? `<ol class="list" style="list-style:none;padding:0;margin:0">${list.map((p, i) => `<li><a class="card link stack tight" href="#/principle/${p.id}" style="text-decoration:none;display:flex">
      <div class="row nowrap" style="gap:12px;align-items:baseline"><span class="display" style="font-size:22px;color:${PHASES[p.phase].col}">${pad(i + 1)}</span><span class="display" style="font-size:24px;flex:1">${esc(p.title || 'Untitled')}</span>${p.status === 'agreed' ? '<span class="pill good">Agreed</span>' : '<span class="pill lamp">Draft</span>'}</div>
      ${p.why ? `<p class="small" style="margin:0;color:var(--text2)">${esc(p.why)}</p>` : ''}
      ${(p.subs || []).length ? `<ul class="small muted" style="margin:0;padding-left:18px">${p.subs.map(s => `<li>${esc(s.text)}</li>`).join('')}</ul>` : ''}
      ${p.trigger ? `<div class="tiny" style="color:var(--text2)"><b>When:</b> ${esc(p.trigger)}</div>` : ''}
      <div class="row tiny muted" style="gap:14px">${evidenceLine(p, T)}${(p.pops || []).length ? `<span>${(p.pops || []).map(k => POP[k] ? POP[k].lab : '').filter(Boolean).join(' · ')}</span>` : ''}</div></a></li>`).join('')}</ol>`
      : `<div class="empty">No principles for ${PHASES[ph].lab.toLowerCase()} yet.</div>`}
    <button class="btn pri" data-act="add">${icon('plus')}Add a principle: ${PHASES[ph].lab.toLowerCase()}</button>`}
  </div>
  <div><div id="chal" style="position:sticky;top:80px"></div></div></div>`;
  const chalM = () => paintChal(el, modelChallenges(T), 'Model check', '', { rec: t, save: () => S.put(t), repaint: () => chalM() });
  chalM();

  const saveT = debounce(() => S.put(t), 400);
  bindFields(el, t, (p) => { saveT(); if (p === 'formation') { saveT.flush(); ctx.refresh(); } if (p === 'identity') chalM(); });
  actions(el, {
    phase: k => { S.setMeta('modelPhase', k); ctx.refresh(); },
    add: () => {
      const n = S.create('principle', T, { phase: ph, order: list.length, title: '', why: '', subs: [], status: 'draft', history: [] });
      location.hash = '#/principle/' + n.id;
    },
    history: () => historySheet(T)
  });
  return () => saveT.flush();
}

function shapeHtml(t, roles, st) {
  return `<div class="card stack">
    <label class="field"><span>Base formation</span><select data-f="formation">${Object.keys(FORMATIONS).map(f => `<option ${f === t.formation ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select></label>
    <div class="grid2">
      <label class="field"><span>How we build</span><select data-f="style.build"><option value="">Not set</option>${['play out from back', 'mixed', 'direct'].map(o => `<option ${o === st.build ? 'selected' : ''}>${o}</option>`).join('')}</select></label>
      <label class="field"><span>Where we defend from</span><select data-f="style.press"><option value="">Not set</option>${['high press', 'mid block', 'low block', 'depends on opponent'].map(o => `<option ${o === st.press ? 'selected' : ''}>${o}</option>`).join('')}</select></label>
    </div>
    <label class="field"><span>Rest defence: who stays back when we attack?</span><textarea data-f="style.restdef" placeholder="e.g. two centre-backs and the 6 stay behind the ball"></textarea></label>
    <p class="tiny muted" style="margin:0">These feed the match-plan challenge: how you build is tested against how each opponent presses.</p>
  </div>
  <div class="card stack"><div class="h3">Positional roles in ${esc(t.formation)}</div>
    ${roles.map(r => `<label class="field"><span>${esc(r)}</span><textarea data-f="roles.${esc(r)}" style="min-height:64px" placeholder="What do you expect of the ${esc(r)} in and out of possession?"></textarea></label>`).join('')}
  </div>`;
}

function historySheet(T) {
  const ev = [];
  S.principles(T).forEach(p => (p.history || []).forEach(h => ev.push({ p, h })));
  ev.sort((a, b) => (b.h.at || '').localeCompare(a.h.at || ''));
  sheet(`<div class="stack"><div class="h2">Model history</div>
    <p class="small muted" style="margin:0">Every saved version of every principle, newest first. This is your record of how the game model has evolved and why.</p>
    ${ev.length ? `<div class="list">${ev.map(({ p, h }) => `<a class="item" href="#/principle/${p.id}" onclick="document.getElementById('scrim')?.remove()"><span class="grow"><span class="t" style="display:block">${esc(h.title)}</span><span class="s">${fmtDY(h.at)} · ${esc(PHASES[p.phase].short)}${h.reason ? ' · ' + esc(h.reason) : ''}</span></span></a>`).join('')}</div>` : '<div class="empty">No versions saved yet. Open a principle and mark it agreed, or save a version after you change it.</div>'}
    <button class="btn" onclick="document.getElementById('scrim')?.remove()">Close</button></div>`);
}

/* ---------- Principle editor ---------- */
export function principleView(el, [id], ctx) {
  const p = S.get(id);
  if (!p) { ctx.setTop({ back: '#/model', title: 'Principle' }); el.innerHTML = '<div class="empty">This principle has been deleted.</div>'; return; }
  const T = p.team; p.subs ||= []; p.history ||= []; p.pops ||= [];
  const bds = S.boards(T); const pops = popsFor(p.phase);
  ctx.setTop({ back: '#/model', title: p.title || 'New principle', sub: PHASES[p.phase].lab });
  const save = debounce(() => S.put(p), 400);
  const ev = principleEvidence(p, T);
  const last = p.history[p.history.length - 1];
  const changed = last && (last.title !== p.title || last.why !== p.why || JSON.stringify(last.subs) !== JSON.stringify(p.subs));

  el.innerHTML = `<div class="split wide-right"><div class="stack">
    ${p.note ? `<div class="row nowrap small" style="gap:10px;color:var(--lamp-text);background:var(--lamp-soft);border:1px solid var(--lamp-line);border-radius:14px;padding:10px 12px"><span class="grow">${esc(p.note)}</span><button class="btn sm" data-act="clearNote">Done</button></div>` : ''}
    <div class="card stack">
      <div class="grid2"><label class="field"><span>Phase</span><select data-f="phase">${PHASE_KEYS.map(k => `<option value="${k}" ${k === p.phase ? 'selected' : ''}>${PHASES[k].lab}</option>`).join('')}</select></label>
        <div class="field"><span>Status</span><div class="seg"><button class="${p.status !== 'agreed' ? 'on part' : ''}" data-act="status" data-arg="draft">Draft</button><button class="${p.status === 'agreed' ? 'on good' : ''}" data-act="status" data-arg="agreed">Agreed</button></div></div></div>
      <label class="field"><span>Principle (short, something players can remember)</span><input type="text" data-f="title" placeholder="e.g. Play out from the back" ${p.title ? '' : 'autofocus'}></label>
      <label class="field"><span>Why: what it means and why we do it</span><textarea data-f="why"></textarea></label>
      <label class="field"><span>When: the trigger or cue that tells players it’s on</span><input type="text" data-f="trigger" placeholder="e.g. Keeper has it in her hands and their front two are split"></label>
      <label class="field"><span>If it’s not on: what we do instead</span><input type="text" data-f="ifNot" placeholder="e.g. Go long to the 9 and squeeze up for the second ball"></label>
      <div class="field"><span>Principles of play it expresses <span class="muted">(course language)</span></span><div class="chips">${pops.map(k => `<button class="chip ${p.pops.includes(k) ? 'on' : ''}" data-act="pop" data-arg="${k}">${POP[k].lab}</button>`).join('')}</div></div>
      <label class="field"><span>Picture: a board that shows it</span><select data-f="boardId"><option value="">None yet</option>${bds.map(b => `<option value="${b.id}" ${b.id === p.boardId ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></label>
      ${p.boardId && S.get(p.boardId) ? `<a class="tiny" href="#/board/${p.boardId}">Open the board</a>` : ''}
    </div>
    <div class="card stack"><div class="row between"><div class="h3">Sub-principles</div><button class="btn sm" data-act="addSub">${icon('plus')}Add</button></div>
      <p class="tiny muted" style="margin:0">What the principle looks like for each unit or moment. Put the finer detail (sub-sub-principles) one per line underneath.</p>
      ${p.subs.length ? p.subs.map((s, i) => `<div class="card inset stack tight"><div class="row nowrap"><input type="text" data-f="subs.${i}.text" placeholder="e.g. Centre-backs split wide when the keeper has it"><button class="btn icon sm" data-act="upSub" data-arg="${i}" aria-label="Move up" ${i ? '' : 'disabled'}>${icon('up')}</button><button class="btn icon sm danger" data-act="delSub" data-arg="${i}" aria-label="Remove">${icon('x')}</button></div>
        <textarea data-f="subs.${i}.detail" style="min-height:56px" placeholder="Detail, one per line (optional)"></textarea></div>`).join('') : '<div class="small muted">None yet.</div>'}
    </div>
    <div class="card stack"><div class="row between"><div class="h3">Versions</div><button class="btn sm" data-act="version">Save a version</button></div>
      ${changed ? '<div class="small" style="color:var(--lamp)">Changed since the last saved version.</div>' : ''}
      ${p.history.length ? `<div class="list">${p.history.slice().reverse().map((h, i) => `<details class="card inset"><summary class="small" style="cursor:pointer"><b>v${p.history.length - i}</b> · ${fmtDY(h.at)}${h.reason ? ' · ' + esc(h.reason) : ''}</summary><div class="small" style="margin-top:8px"><b>${esc(h.title)}</b><br>${esc(h.why)}${(h.subs || []).length ? `<ul style="margin:6px 0 0;padding-left:18px">${h.subs.map(s => `<li>${esc(s.text)}</li>`).join('')}</ul>` : ''}</div></details>`).join('')}</div>` : '<div class="small muted">No versions yet. Marking it agreed saves version 1.</div>'}
    </div>
    <div class="row"><button class="btn sm" data-act="move" data-arg="-1">${icon('up')}Move up</button><button class="btn sm" data-act="move" data-arg="1">${icon('down')}Move down</button><div class="grow"></div><button class="btn danger" data-act="del">${icon('trash')}Delete</button></div>
  </div>
  <div class="stack">
    <div class="card stack tight"><div class="h3">Evidence</div>
      <div class="small muted">How this principle is being trained and whether it shows up in games.</div>
      <div class="eyebrow" style="margin-top:6px">Drills that train it</div>
      ${ev.drills.length ? `<div class="list">${ev.drills.map(d => `<a class="item" href="#/drill/${d.id}"><span class="grow t small">${esc(d.name)}</span></a>`).join('')}</div>` : '<div class="small" style="color:var(--lamp)">None. Link one from a drill’s “Principles” section.</div>'}
      <div class="eyebrow" style="margin-top:6px">Sessions</div>
      <div class="small">${ev.sessions.length} in total, ${ev.recent.length} in the last 4 weeks</div>
      <div class="eyebrow" style="margin-top:6px">Blocks</div>
      ${ev.blocks.length ? `<div class="list">${ev.blocks.map(b => `<a class="item" href="#/block/${b.id}"><span class="grow t small">${esc(b.title)} <span class="muted">· ${fmtD(b.start)} · ${b.weeks} wk</span></span></a>`).join('')}</div>` : '<div class="small muted">Not the focus of a block yet. <a href="#/plans/programme">Plan one</a>.</div>'}
      <div class="eyebrow" style="margin-top:6px">Reviews</div>
      ${ev.scores.length ? `<div class="row" style="gap:4px">${ev.scores.slice(0, 16).reverse().map(s => `<span title="${fmtDY(s.date)}" style="width:18px;height:18px;border-radius:5px;background:${s.v === 2 ? 'var(--good)' : s.v === 1 ? 'var(--lamp)' : 'var(--bad)'}"></span>`).join('')}</div><div class="tiny muted">Oldest to newest. Green seen, amber partly, red not seen.</div>` : '<div class="small muted">Not reviewed yet.</div>'}
    </div>
  </div></div>`;

  bindFields(el, p, (path) => { save(); if (path === 'phase') { save.flush(); ctx.refresh(); } });
  const snap = reason => { p.history.push({ at: today(), title: p.title, why: p.why, subs: clone(p.subs), reason }); };
  actions(el, {
    clearNote: () => { delete p.note; S.put(p); ctx.refresh(); },
    pop: k => { p.pops = p.pops.includes(k) ? p.pops.filter(x => x !== k) : p.pops.concat(k); S.put(p); ctx.refresh(); },
    status: s => {
      if (s === p.status) return;
      if (s === 'agreed' && !p.title.trim()) { toast('Give it a title first'); return; }
      p.status = s; if (s === 'agreed' && (!last || changed)) snap(p.history.length ? 'Agreed again' : 'Agreed'); S.put(p); ctx.refresh();
    },
    addSub: () => { p.subs.push({ id: uid(), text: '', detail: '' }); S.put(p); ctx.refresh(); setTimeout(() => { const ins = el.querySelectorAll('[data-f$=".text"]'); ins[ins.length - 1]?.focus(); }, 30); },
    delSub: i => { p.subs.splice(+i, 1); S.put(p); ctx.refresh(); },
    upSub: i => { i = +i; if (!i) return; [p.subs[i - 1], p.subs[i]] = [p.subs[i], p.subs[i - 1]]; S.put(p); ctx.refresh(); },
    version: () => {
      const s = sheet(`<div class="stack"><div class="h2">Save a version</div><label class="field"><span>What changed, and why? (e.g. “After the review v Chester-le-Street”)</span><input type="text" id="vr" autofocus></label><div class="row" style="justify-content:flex-end"><button class="btn" id="vc">Cancel</button><button class="btn pri" id="vs">Save version</button></div></div>`);
      s.querySelector('#vc').onclick = closeSheet;
      s.querySelector('#vs').onclick = () => { snap(s.querySelector('#vr').value.trim()); S.put(p); closeSheet(); toast('Version saved'); ctx.refresh(); };
    },
    move: d => {
      const sib = S.principles(T).filter(x => x.phase === p.phase); const i = sib.findIndex(x => x.id === p.id); const j = i + +d;
      if (j < 0 || j >= sib.length) return;
      [sib[i], sib[j]] = [sib[j], sib[i]]; sib.forEach((x, k) => { if (x.order !== k) { x.order = k; S.put(x); } }); toast('Moved');
    },
    del: async () => {
      if (!await confirmSheet('Delete this principle?', 'Drills and sessions linked to it will lose the link. Its review history goes too.')) return;
      S.del(p.id); location.hash = '#/model';
    }
  });
  return () => save.flush();
}
