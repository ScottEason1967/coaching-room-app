// Match day templates: browse them, and use one on a match (or start a new match with it).
// Routes: #/mtemplates (from Match), #/mtemplates/<match id> (from inside a match plan).
import * as S from '../store.js';
import { esc, icon, actions, toast } from '../util.js';
import { MATCH_TEMPLATES, matchTplById, FILL_LABEL } from '../matchTemplates.js';
import { createMatch } from './match.js';
import { reviewGate } from './review.js';

const path = k => k === 'src' || k.startsWith('opp.') ? k : 'plan.' + k;
const getP = (o, p) => p.split('.').reduce((a, k) => a == null ? a : a[k], o);
const setP = (o, p, v) => { const ks = p.split('.'); let a = o; ks.slice(0, -1).forEach(k => { a[k] ||= {}; a = a[k]; }); a[ks[ks.length - 1]] = v; };

// Fill only what is still empty; anything already written is kept.
export function applyMatchTemplate(m, tpl) {
  const added = [], kept = [];
  Object.entries(tpl.fills).forEach(([k, v]) => {
    const p = path(k);
    if (String(getP(m, p) || '').trim()) kept.push(FILL_LABEL[k]); else { setP(m, p, v); added.push(FILL_LABEL[k]); }
  });
  m.templatesUsed ||= []; if (!m.templatesUsed.includes(tpl.id)) m.templatesUsed.push(tpl.id);
  S.put(m); return { added, kept };
}

const PARTS = [['them', 'The opposition'], ['plan', 'The plan'], ['day', 'The day and half-time']];

export default function matchTemplatesView(el, [mid], ctx) {
  const m = mid ? S.get(mid) : null;
  ctx.setTop({ back: m ? '#/match/' + m.id : '#/matches', title: 'Match day templates', sub: m ? 'For ' + (m.opponent ? 'v ' + m.opponent : 'this match') : 'From The FA and top coaches' });
  const used = new Set((m && m.templatesUsed) || []);
  const card = t => `<div class="card stack tight" data-tpl="${t.id}">
      <div class="row between nowrap"><span class="h3">${esc(t.name)}</span>${used.has(t.id) ? '<span class="pill good">Used</span>' : ''}</div>
      <div class="small">${esc(t.why)}</div>
      <div class="tiny muted">${esc(t.who)} · <a href="${esc(t.url)}" target="_blank" rel="noopener">See the original</a></div>
      <details><summary class="small" style="cursor:pointer;color:var(--accent-ink);font-weight:600">What it adds to the plan</summary>
        <div class="stack tight" style="margin-top:8px">${Object.entries(t.fills).map(([k, v]) => `<div><div class="label">${esc(FILL_LABEL[k])}</div><div class="tiny" style="white-space:pre-line;background:var(--bg);border-radius:8px;padding:8px 10px">${esc(v)}</div></div>`).join('')}
        ${t.tips.length ? `<div><div class="label">Worth knowing</div><ul class="tiny" style="margin:4px 0 0;padding-left:18px">${t.tips.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}</div></details>
      <div class="row"><button class="btn sm pri" data-act="use" data-arg="${t.id}">${icon('plus')}${m ? 'Use on this match' : 'Start a match with this'}</button></div></div>`;
  el.innerHTML = `<div class="stack" style="max-width:820px">
    <p class="small muted" style="margin:0">Ways The FA and top coaches plan a match, the day and half-time, written in our own words with a link to each original. Using one only fills parts of the plan that are still empty, so nothing you have written is lost. Use more than one if you like.</p>
    ${PARTS.map(([k, l]) => `<div class="ghead">${l}</div>${MATCH_TEMPLATES.filter(t => t.part === k).map(card).join('')}`).join('')}
  </div>`;
  actions(el, {
    use: id => {
      const t = matchTplById(id);
      const go = mm => {
        const { added, kept } = applyMatchTemplate(mm, t);
        S.setMeta('matchTab', t.part === 'them' ? 'them' : t.part);
        if (t.part !== 'them') S.setMeta('matchPlanTab', t.part);
        toast(added.length ? `Added to ${added.join(', ')}${kept.length ? `. Kept what you’d written in ${kept.join(', ')}` : ''}` : 'Everything it fills already has your writing in it, so nothing changed');
        location.hash = '#/match/' + mm.id;
      };
      if (m) go(m); else reviewGate(S.team().id, () => go(createMatch(S.team().id)), 'plan the next match');
    }
  });
}
