// Plans: sessions, matches, the drill library and reviews.
import * as S from '../store.js';
import { esc, icon, today, fmtD, actions } from '../util.js';
import { sessionStats, drillChallenges, openCount, reviewComplete } from '../challenges.js';
import { newSession } from './session.js';
import { newMatch } from './match.js';
import { newDrill } from './drill.js';
import { drillSvg } from '../pitch.js';
import { newBlock, programmeHtml } from './block.js';

const TABS = [['sessions', 'Sessions'], ['matches', 'Matches'], ['reviews', 'Reviews'], ['programme', 'Programme'], ['drills', 'Drills']];

export default function plans(el, [tab], ctx) {
  tab = TABS.some(t => t[0] === tab) ? tab : (S.meta().plansTab || 'sessions');
  S.setMeta('plansTab', tab);
  const T = S.team().id; const td = today();
  ctx.setTop({});
  const head = `<div class="row between"><div class="h1">Plans</div>${{
    sessions: `<button class="btn pri" data-act="newS">${icon('plus')}New session</button>`,
    matches: `<button class="btn pri" data-act="newM">${icon('plus')}New match plan</button>`,
    drills: `<button class="btn pri" data-act="newD">${icon('plus')}New drill</button>`, reviews: '',
    programme: `<button class="btn pri" data-act="newB">${icon('plus')}New block</button>`
  }[tab]}</div>
  <div class="chips" role="tablist">${TABS.map(([k, l]) => `<a class="chip ${k === tab ? 'on' : ''}" role="tab" aria-selected="${k === tab}" href="#/plans/${k}" style="text-decoration:none">${l}</a>`).join('')}</div>`;

  const status = (r, kind) => {
    if (r.cancelled) return '<span class="pill grey">Didn’t happen</span>';
    const rv = S.reviewOf(r);
    if (rv && S.reviewDone(rv)) return '<span class="pill good">Reviewed</span>';
    if (rv) return '<span class="pill lamp">Review unfinished</span>';
    if (r.date && r.date < td) return '<span class="pill lamp">Needs review</span>';
    if (r.date === td) return '<span class="pill">Today</span>';
    return '';
  };
  let body = '';
  if (tab === 'sessions') {
    const all = S.sessions(T); const up = all.filter(s => !s.date || s.date >= td).reverse(); const past = all.filter(s => s.date && s.date < td);
    const row = s => { const st = sessionStats(s); const bk = S.blockFor(T, s.date); return `<a class="item" href="#/session/${s.id}"><span class="badge-num" style="width:44px;height:44px;flex-direction:column;font-size:15px;line-height:1;border-radius:12px">${s.date ? new Date(s.date + 'T12:00').getDate() : '?'}<span style="font-size:10px;font-family:Inter;font-weight:600">${s.date ? new Date(s.date + 'T12:00').toLocaleDateString('en-GB', { month: 'short' }) : ''}</span></span><span class="grow"><span class="t" style="display:block">${esc(s.theme || 'No theme yet')}</span><span class="s">${fmtD(s.date)}${s.time ? ' · ' + esc(s.time) : ''} · ${st.total} min · ${st.drills.length} practice${st.drills.length === 1 ? '' : 's'}${bk ? ` · ${esc(bk.title || 'block')} wk ${S.weekOf(bk, s.date)}` : ''}</span></span>${status(s)}</a>`; };
    body = `${up.length ? `<div class="eyebrow">Coming up</div><div class="list">${up.map(row).join('')}</div>` : '<div class="empty">No sessions planned.</div>'}
      ${past.length ? `<div class="eyebrow" style="margin-top:8px">Done</div><div class="list">${past.map(row).join('')}</div>` : ''}`;
  } else if (tab === 'programme') {
    body = programmeHtml(T);
  } else if (tab === 'matches') {
    const all = S.matches(T); const up = all.filter(m => !m.date || m.date >= td).reverse(); const past = all.filter(m => m.date && m.date < td);
    const row = m => `<a class="item" href="#/match/${m.id}"><span class="badge-num" style="background:var(--opp)">${icon('flag', 'style="width:18px;height:18px"')}</span><span class="grow"><span class="t" style="display:block">v ${esc(m.opponent || 'Opponent not set')}${m.result && m.result.us !== '' && m.result.us != null ? ` · ${esc(m.result.us)}-${esc(m.result.them)}` : ''}</span><span class="s">${fmtD(m.date)}${m.venue ? ' · ' + esc(m.venue) : ''}${m.example ? ' · example' : ''}</span></span>${status(m)}</a>`;
    body = `${up.length ? `<div class="eyebrow">Coming up</div><div class="list">${up.map(row).join('')}</div>` : '<div class="empty">No matches in the diary.</div>'}
      ${past.length ? `<div class="eyebrow" style="margin-top:8px">Played</div><div class="list">${past.map(row).join('')}</div>` : ''}`;
  } else if (tab === 'drills') {
    const q = (S.meta().drillQ || '').toLowerCase(); const mine = S.meta().drillMine;
    const ds = S.drills().filter(d => (!q || (d.name + ' ' + d.type + ' ' + d.objective).toLowerCase().includes(q)) && (!mine || S.drillLinks(d, T).length));
    body = `<div class="row"><input type="search" id="dq" placeholder="Search drills" value="${esc(S.meta().drillQ || '')}" style="flex:1;min-width:180px"><button class="chip ${mine ? 'on' : ''}" data-act="mine">Linked to this team</button></div>
      <p class="tiny muted" style="margin:0">Your library comes with you to any team. Each drill links to principles separately for each team.</p>
      ${ds.length ? `<div class="grid3">${ds.map(d => { const ch = drillChallenges(d, T); const n = openCount(ch); const lk = S.drillLinks(d, T).map(S.get).filter(Boolean);
        return `<a class="card link stack tight" href="#/drill/${d.id}" style="text-decoration:none;display:flex">${drillSvg(d, { style: 'width:100%;height:150px;border-radius:12px' })}<div class="row between nowrap"><span class="h3">${esc(d.name)}</span>${n ? `<span class="pill lamp">${n} to do</span>` : '<span class="pill good">Ready</span>'}</div><span class="tiny muted">${esc(d.type)} · ${d.minutes || '?'} min${lk.length ? ' · ' + lk.map(p => esc(p.title)).join(', ') : ''}</span></a>`; }).join('')}</div>` : '<div class="empty">No drills match.</div>'}`;
  } else {
    const rs = S.reviews(T);
    body = rs.length ? `<div class="list">${rs.map(r => { const ref = S.get(r.refId); const ok = reviewComplete(r);
      return `<a class="item" href="#/review/${r.id}"><span class="badge-num" style="background:${r.type === 'match' ? 'var(--opp)' : 'var(--accent)'}">${icon(r.type === 'match' ? 'flag' : 'whistle', 'style="width:18px;height:18px"')}</span><span class="grow"><span class="t" style="display:block">${r.type === 'match' ? 'v ' + esc(ref ? ref.opponent : '?') : esc(ref ? ref.theme || 'Session' : 'Session')}</span><span class="s">${fmtD(r.date)}${r.change ? ' · next: ' + esc(r.change.slice(0, 60)) : ''}</span></span>${ok ? '<span class="pill good">Done</span>' : '<span class="pill lamp">Unfinished</span>'}</a>`; }).join('')}</div>`
      : '<div class="empty">No reviews yet. After every session and match, the app asks for one.</div>';
  }
  el.innerHTML = `<div class="stack">${head}${body}</div>`;
  const dq = el.querySelector('#dq');
  if (dq) dq.oninput = () => { S.setMeta('drillQ', dq.value); clearTimeout(dq._t); dq._t = setTimeout(() => { ctx.refresh(); const n = el.querySelector('#dq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 350); };
  actions(el, {
    newS: () => newSession(), newM: () => newMatch(),
    newD: () => { const d = newDrill(); location.hash = '#/drill/' + d.id; },
    newB: () => newBlock(),
    mine: () => { S.setMeta('drillMine', !S.meta().drillMine); ctx.refresh(); }
  });
}
