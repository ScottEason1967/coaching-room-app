// Programme: training blocks. Four to six weeks on one or two principles, with what each week adds.
// Sessions fall into a block by date. This is the "short-term programme planning" the UEFA C
// assesses and the start of the weekly/monthly/seasonal planning the Pro syllabus expects.
import * as S from '../store.js';
import { PHASES, PHASE_KEYS } from '../store.js';
import { esc, icon, today, addDays, fmtD, bindFields, actions, debounce, confirmSheet, toast } from '../util.js';

export function newBlock() {
  const T = S.team().id;
  const last = S.blocks(T)[0];
  const start = last && S.blockEnd(last) > today() ? S.blockEnd(last) : today();
  const b = S.create('block', T, { title: '', principleIds: [], start, weeks: 4, aim: '', weeksPlan: ['', '', '', ''], outcome: '' });
  location.hash = '#/block/' + b.id;
}

export function blockStatus(b) {
  const td = today();
  if (!b.start) return 'undated';
  if (td < b.start) return 'next';
  if (td < S.blockEnd(b)) return 'now';
  return 'done';
}

export function programmeHtml(T) {
  const bs = S.blocks(T); const td = today();
  const now = bs.filter(b => blockStatus(b) === 'now'); const next = bs.filter(b => blockStatus(b) === 'next').reverse(); const done = bs.filter(b => blockStatus(b) === 'done');
  const card = (b, big) => {
    const ps = (b.principleIds || []).map(S.get).filter(Boolean); const st = blockStatus(b);
    const wk = st === 'now' ? S.weekOf(b, td) : null; const ss = S.blockSessions(T, b);
    return `<a class="card link stack tight" href="#/block/${b.id}" style="text-decoration:none;display:flex;${big ? 'border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)' : ''}">
      <div class="row between nowrap"><span class="h3">${esc(b.title || 'Untitled block')}</span>${st === 'now' ? `<span class="pill">Week ${wk} of ${b.weeks}</span>` : st === 'next' ? '<span class="pill grey">Next</span>' : st === 'done' ? '<span class="pill good">Done</span>' : ''}</div>
      <div class="small muted">${fmtD(b.start)} to ${fmtD(addDays(S.blockEnd(b), -1))} · ${b.weeks} week${b.weeks == 1 ? '' : 's'} · ${ss.length} session${ss.length === 1 ? '' : 's'}</div>
      ${ps.length ? `<div class="chips">${ps.map(p => `<span class="chip" style="pointer-events:none"><span class="dot" style="color:${PHASES[p.phase].col}"></span>${esc(p.title)}</span>`).join('')}</div>` : '<div class="small" style="color:var(--lamp)">No principle chosen yet.</div>'}
      ${wk && (b.weeksPlan || [])[wk - 1] ? `<div class="small"><b>This week:</b> ${esc(b.weeksPlan[wk - 1])}</div>` : ''}</a>`;
  };
  return `<p class="small muted" style="margin:0">A block is four to six weeks on one or two principles, with something new each week. Sessions in those dates belong to it automatically. One-off sessions don’t add up; blocks do.</p>
    ${now.length ? `<div class="eyebrow">Running now</div>${now.map(b => card(b, true)).join('')}` : `<div class="empty">No block running. ${bs.length ? 'Plan the next one.' : 'Start with the principle the last reviews keep flagging.'}</div>`}
    ${next.length ? `<div class="eyebrow" style="margin-top:8px">Coming up</div>${next.map(b => card(b)).join('')}` : ''}
    ${done.length ? `<div class="eyebrow" style="margin-top:8px">Finished</div>${done.map(b => card(b)).join('')}` : ''}`;
}

export default function blockView(el, [id], ctx) {
  const b = S.get(id);
  if (!b) { ctx.setTop({ back: '#/training/programme', title: 'Block' }); el.innerHTML = '<div class="empty">This block has been deleted.</div>'; return; }
  const T = b.team; b.principleIds ||= []; b.weeksPlan ||= [];
  const weeks = Math.max(1, Math.min(12, +b.weeks || 1));
  while (b.weeksPlan.length < weeks) b.weeksPlan.push('');
  ctx.setTop({ back: '#/training/programme', title: b.title || 'Training block', sub: `${fmtD(b.start)} · ${weeks} weeks` });
  const save = debounce(() => S.put(b), 400);
  const ps = S.principles(T); const sel = new Set(b.principleIds);
  const st = blockStatus(b); const td = today(); const wk = st === 'now' ? S.weekOf(b, td) : null;
  const ss = S.blockSessions(T, b); const ms = S.blockMatches(T, b);
  const rs = S.reviews(T).filter(r => r.date >= b.start && r.date < S.blockEnd(b));
  const tally = pid => { const t = { 2: 0, 1: 0, 0: 0 }; rs.forEach(r => { const v = (r.evidence || {})[pid]; if (v != null) t[v]++; }); return t; };
  const weekDates = i => `${fmtD(addDays(b.start, 7 * i))}`;
  const inWeek = (s, i) => s.date >= addDays(b.start, 7 * i) && s.date < addDays(b.start, 7 * (i + 1));

  el.innerHTML = `<div class="split wide-right"><div class="stack">
    <div class="card stack">
      <label class="field"><span>Block title: what the team will be able to do by the end</span><input type="text" data-f="title" placeholder="e.g. Play through a high press without going long by default" ${b.title ? '' : 'autofocus'}></label>
      <div class="grid2" style="grid-template-columns:repeat(2,minmax(0,1fr))"><label class="field"><span>Starts</span><input type="date" data-f="start"></label><label class="field"><span>Weeks</span><input type="number" inputmode="numeric" min="1" max="12" data-f="weeks"></label></div>
      <div class="field"><span>Principles this block is about (one or two)</span>
        ${ps.length ? PHASE_KEYS.filter(k => ps.some(p => p.phase === k)).map(k => `<div class="tiny muted" style="margin-top:4px">${PHASES[k].lab}</div><div class="chips">${ps.filter(p => p.phase === k).map(p => `<button class="chip ${sel.has(p.id) ? 'on' : ''}" data-act="pr" data-arg="${p.id}">${esc(p.title || 'Untitled')}</button>`).join('')}</div>`).join('') : '<div class="small" style="color:var(--lamp)">No principles yet. <a href="#/model">Write your game model</a> first.</div>'}</div>
      <label class="field"><span>Why now: what the reviews or the fixtures say</span><textarea data-f="aim" style="min-height:64px" placeholder="e.g. Not seen in the last three reviews; next four opponents all press high"></textarea></label>
    </div>
    <div class="card stack tight"><div class="h3">Week by week: what each week adds</div>
      <p class="tiny muted" style="margin:0">Simple to complex, or part to whole. If every week says the same thing, it isn’t a programme.</p>
      ${b.weeksPlan.slice(0, weeks).map((w, i) => `<div class="stack tight" style="padding:8px 0;border-top:1px solid var(--line)"><div class="row between nowrap"><span class="small" style="font-weight:600">Week ${i + 1} <span class="muted" style="font-weight:400">· from ${weekDates(i)}</span></span>${wk === i + 1 ? '<span class="pill">Now</span>' : ''}</div>
        <input type="text" data-f="weeksPlan.${i}" placeholder="${['Unopposed shape and the picture', 'Opposed, numbers up', 'Equal numbers, directional', 'Phase of play v the next opponent’s press', 'Game with the trigger live', 'Consolidate and test'][i] || ''}">
        ${ss.filter(s => inWeek(s, i)).map(s => `<a class="tiny" href="#/session/${s.id}">${fmtD(s.date)}: ${esc(s.theme || 'session')}${(s.principleIds || []).some(x => sel.has(x)) ? '' : ' <span style="color:var(--lamp)">(not on the block’s principles)</span>'}</a>`).join('')}
        ${ms.filter(m => inWeek(m, i)).map(m => `<a class="tiny" href="#/match/${m.id}">${fmtD(m.date)}: match v ${esc(m.opponent)}</a>`).join('')}</div>`).join('')}
    </div>
    ${st === 'done' || st === 'now' ? `<div class="card stack" style="border-color:var(--lamp-line)"><label class="field"><span style="color:var(--lamp)">End of block: did the team get there? What’s the evidence, and what’s next?</span><textarea data-f="outcome" placeholder="Reviews, what you saw in games, what the players say. Then: next block, or go again?"></textarea></label></div>` : ''}
    <div class="row"><div class="grow"></div><button class="btn danger" data-act="del">${icon('trash')}Delete block</button></div>
  </div>
  <div class="stack">
    <div class="card stack tight"><div class="h3">Evidence in this block</div>
      <div class="small muted">${ss.length} session${ss.length === 1 ? '' : 's'}, ${ms.length} match${ms.length === 1 ? '' : 'es'}, ${rs.length} review${rs.length === 1 ? '' : 's'} between ${fmtD(b.start)} and ${fmtD(addDays(S.blockEnd(b), -1))}.</div>
      ${b.principleIds.map(S.get).filter(Boolean).map(p => { const t = tally(p.id); const n = t[2] + t[1] + t[0]; return `<div class="small" style="padding:6px 0;border-top:1px solid var(--line)"><b>${esc(p.title)}</b><br>${n ? `Reviews: ${t[2]} seen · ${t[1]} partly · ${t[0]} not seen` : 'Not scored in a review yet'} · trained in ${ss.filter(s => (s.principleIds || []).includes(p.id)).length} of ${ss.length} sessions</div>`; }).join('')}
      ${ss.length && b.principleIds.length ? `<div class="tiny muted">${ss.filter(s => !(s.principleIds || []).some(x => sel.has(x))).length} session${ss.filter(s => !(s.principleIds || []).some(x => sel.has(x))).length === 1 ? '' : 's'} in the block ${ss.filter(s => !(s.principleIds || []).some(x => sel.has(x))).length === 1 ? 'is' : 'are'} on other principles.</div>` : ''}
    </div>
  </div></div>`;

  bindFields(el, b, (p) => { save(); if (p === 'weeks' || p === 'start') { save.flush(); ctx.refresh(); } if (p === 'title') ctx.setTop({ back: '#/training/programme', title: b.title || 'Training block', sub: `${fmtD(b.start)} · ${weeks} weeks` }); });
  actions(el, {
    pr: pid => { b.principleIds = sel.has(pid) ? b.principleIds.filter(x => x !== pid) : b.principleIds.concat(pid); S.put(b); ctx.refresh(); },
    del: async () => { if (await confirmSheet('Delete this block?', 'Sessions in it are kept; they just stop belonging to a block.')) { S.del(b.id); location.hash = '#/training/programme'; } }
  });
  return () => save.flush();
}
