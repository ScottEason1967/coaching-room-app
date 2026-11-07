// Home: next match, the Model > Plan > Coach > Review cycle, what's carried forward.
import * as S from '../store.js';
import { esc, icon, fmtD, today, addDays, actions } from '../util.js';
import { matchChallenges, openCount } from '../challenges.js';
import { startReview } from './review.js';
import { newSession } from './session.js';
import { newMatch } from './match.js';

export default function home(el, params, ctx) {
  const t = S.team(); const T = t.id;
  ctx.setTop({});
  const due = S.reviewsDue(T);
  const ps = S.principles(T); const drafts = ps.filter(p => p.status !== 'agreed').length;
  const nm = S.nextMatch(T); const ns = S.nextSession(T); const lc = S.lastChange(T);
  const td = today();
  // A session planned after that review, with "this session acts on it" ticked, closes the loop.
  const acted = lc ? S.sessions(T).filter(s => s.addresses && !s.cancelled && (s.addressesReview === lc.id || s.fromReview === lc.id || (s.date && s.date >= lc.date))).sort((a, b) => (a.date || '').localeCompare(b.date || ''))[0] : null;
  const cb = S.currentBlock(T); const wk = cb ? S.weekOf(cb, td) : 0;

  // Where are we in the cycle?
  let stage = 'coach';
  if (due.length) stage = 'review';
  else if (!ps.length) stage = 'model';
  else if (!ns) stage = 'plan';
  const order = ['model', 'plan', 'coach', 'review'];
  const si = order.indexOf(stage);
  const segCol = i => i === si ? 'var(--accent)' : (i < si ? 'color-mix(in srgb,var(--accent) 45%,transparent)' : 'rgba(255,255,255,.1)');
  const centre = {
    model: ['MODEL', 'Write your first', 'principles of play'],
    plan: ['PLAN', 'Next session', 'not planned yet'],
    coach: ['COACH', ns ? 'Next session' : '', ns ? fmtD(ns.date) : ''],
    review: ['REVIEW', due.length + ' review' + (due.length > 1 ? 's' : ''), 'waiting for you']
  }[stage];
  const lab = {
    model: `${ps.length} principle${ps.length === 1 ? '' : 's'}${drafts ? ', ' + drafts + ' draft' : ''}`,
    plan: stage === 'plan' ? 'You are here' : (ns ? 'Planned' : 'Nothing planned'),
    coach: stage === 'coach' ? 'You are here' : 'On the pitch',
    review: due.length ? due.length + ' due' : 'After every game'
  };
  const ring = `<svg role="img" aria-label="The cycle: ${stage} is current" width="300" height="236" viewBox="0 0 300 236" style="max-width:100%">
    ${[-86.2, 3.8, 93.8, 183.8].map((r, i) => `<circle cx="150" cy="118" r="80" fill="none" stroke="${segCol(i)}" stroke-width="16" stroke-dasharray="115 387.65" transform="rotate(${r} 150 118)" stroke-linecap="round"/>`).join('')}
    <text x="150" y="114" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-size="32" font-weight="700" fill="#EEF2FA" letter-spacing="1">${centre[0]}</text>
    <text x="150" y="136" text-anchor="middle" font-size="12" fill="#9AA6BF">${esc(centre[1])}</text>
    <text x="150" y="152" text-anchor="middle" font-size="12" fill="#9AA6BF">${esc(centre[2])}</text>
    ${[['MODEL', 236, 30, 'model', '#/model'], ['PLAN', 240, 204, 'plan', '#/plans'], ['COACH', 60, 204, 'coach', '#/plans'], ['REVIEW', 64, 30, 'review', '#/plans/reviews']].map(([L, x, y, k, href], i) => `<a href="${href}"><text x="${x}" y="${y}" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-size="16" font-weight="600" fill="${i === si ? 'var(--accent)' : '#EEF2FA'}" letter-spacing="1">${L}</text><text x="${x}" y="${y + 16}" text-anchor="middle" font-size="11" fill="#9AA6BF">${esc(lab[k])}</text></a>`).join('')}
  </svg>`;

  const upcoming = [...S.sessions(T).filter(s => s.date && s.date >= td && !s.cancelled).map(s => ({ d: s.date, k: 'session', r: s })),
    ...S.matches(T).filter(m => m.date && m.date >= td && !m.cancelled).map(m => ({ d: m.date, k: 'match', r: m }))]
    .sort((a, b) => a.d.localeCompare(b.d)).slice(0, 6);

  const mList = nm ? matchChallenges(nm, T) : []; const mOpen = openCount(mList); const mAsk = mList.filter(q => q.kind === 'ask').length;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const dummy = S.players(T).filter(p => /^Player \d+$/.test(p.name)).length;

  const startHere = S.meta().startHereDone ? '' : `<section class="card stack" id="startHere" aria-label="Start here" style="border-color:var(--accent);box-shadow:0 0 0 1px var(--accent);margin-bottom:16px">
    <div class="h2">Start here</div>
    <p class="small" style="margin:0">The Coaching Room joins up your game model, sessions, matches and reviews into one loop, so each session is built from what you learned in the last one. It works on this device straight away.</p>
    <div class="eyebrow">Set it up, in this order</div>
    <ol class="small" style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px">
      <li><a href="#/model">Rewrite the three principles in your own words</a> and mark them agreed.</li>
      <li><a href="#/squad">Paste your squad.</a></li>
      <li><a href="#/plans/programme">Plan your first block</a>: four to six weeks on one or two principles.</li>
      <li><a href="#/cloud">Sign in for sync and links.</a></li>
      <li>Install it on your phone: in Safari tap Share, then Add to Home Screen.</li>
    </ol>
    <div class="eyebrow">The weekly loop</div>
    <ol class="small" style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:4px">
      <li>Plan the session from the block.</li>
      <li>Coach it.</li>
      <li>Review it the same night.</li>
      <li>Plan the match.</li>
      <li>Review the match on Monday.</li>
    </ol>
    <p class="small" style="margin:0">The review is what makes it work: the one thing you decide to change there is what your next session is built from.</p>
    <p class="small muted" style="margin:0">Every screen has a <b>?</b> at the top right. Tap it for a guide to that screen.</p>
    <div class="row"><button class="btn pri" data-act="startDone">Got it</button></div>
  </section>
  `;
  el.innerHTML = `${startHere}<div class="grid2" style="align-items:start">
  <div class="stack">
    ${due.length ? `<section class="challenge" aria-label="Reviews due"><div class="head"><div class="title">${icon('bulb', 'style="width:18px;height:18px"')}Review due</div><span class="pill lamp">${due.length}</span></div>
      <div class="small" style="color:var(--lamp-text)">Close the loop before you plan anything new. Your next session is built from what you write here.</div>
      ${due.map(d => `<button class="item" data-act="rev" data-arg="${d.rec.id}" style="background:rgba(10,16,32,.5);border-color:var(--lamp-line)"><span class="grow"><span class="t" style="display:block">${d.kind === 'match' ? 'v ' + esc(d.rec.opponent) : esc(d.rec.theme || 'Session')}</span><span class="s">${d.kind === 'match' ? 'Match' : 'Session'} · ${fmtD(d.rec.date)}${d.started ? ' · started' : ''}</span></span><span class="btn sm lamp">${d.started ? 'Finish' : 'Review'}</span></button>`).join('')}</section>` : ''}

    <section class="card" aria-label="Next match" style="border-radius:24px;padding:18px;position:relative;overflow:hidden">
      <svg aria-hidden="true" width="180" height="180" viewBox="0 0 180 180" style="position:absolute;right:-60px;top:-40px;opacity:.16"><circle cx="90" cy="90" r="62" fill="none" stroke="#fff" stroke-width="2"/><line x1="90" y1="0" x2="90" y2="180" stroke="#fff" stroke-width="2"/><circle cx="90" cy="90" r="4" fill="#fff"/></svg>
      <div class="eyebrow">Next match</div>
      ${nm ? `<div class="h1" style="font-size:42px;margin:8px 0 6px;line-height:.95">${esc(nm.opponent)}</div>
        <div class="small muted">${fmtD(nm.date)}${nm.ko ? ' · ' + esc(nm.ko) : ''}${nm.venue ? ' · ' + esc(nm.venue) : ''}${nm.example ? ' · example plan' : ''}</div>
        <div class="chips" style="margin:10px 0 12px">${nm.opp && nm.opp.ip && nm.opp.op ? '<span class="pill good"><span class="dot"></span>Opposition report in</span>' : '<span class="pill grey"><span class="dot"></span>No opposition report yet</span>'}${mOpen ? `<span class="pill lamp"><span class="dot"></span>Plan has ${mOpen} must-do${mOpen > 1 ? 's' : ''}</span>` : mAsk ? `<span class="pill lamp"><span class="dot"></span>${mAsk} question${mAsk > 1 ? 's' : ''} to think about</span>` : '<span class="pill good"><span class="dot"></span>Plan ready</span>'}</div>
        <a class="btn pri block" href="#/match/${nm.id}">Open match plan ${icon('chev')}</a>`
      : `<div class="h2" style="margin:8px 0">Nothing in the diary</div><p class="small muted" style="margin:0 0 12px">Add the next fixture and start the opposition analysis.</p><button class="btn pri block" data-act="newMatch">${icon('plus')}New match plan</button>`}
    </section>

    <section aria-label="Carried forward" class="card row nowrap" style="align-items:flex-start;gap:12px">
      <span style="flex:none;width:36px;height:36px;border-radius:12px;background:rgba(255,211,77,.12);color:var(--lamp);display:flex;align-items:center;justify-content:center">${icon('bulb', 'style="width:20px;height:20px"')}</span>
      <div class="stack tight" style="gap:3px"><div class="small" style="font-weight:600">Carried forward</div>
        <div class="small muted">${lc ? `From your review of ${fmtD(lc.date)}: <span style="color:var(--text)">“${esc(lc.change)}”</span>${acted ? `<br><a href="#/session/${acted.id}">Acted on in the session of ${fmtD(acted.date)}</a>. The next review will tell you whether it worked.` : '<br>Not acted on yet. Plan the next session from it.'}` : 'No reviews yet. After the next game or session, the one thing you decide to change appears here until you act on it.'}</div></div>
    </section>
  </div>

  <div class="stack">
    <section aria-label="The cycle" class="card" style="background:transparent;border:0;padding:0">
      <div class="row between" style="align-items:baseline"><div class="h2">The cycle</div><span class="tiny muted">Model · Plan · Coach · Review</span></div>
      <div class="cycle">${ring}</div>
    </section>
    <div class="grid2" style="grid-template-columns:repeat(3,minmax(0,1fr))">
      <button class="card link stack tight" data-act="newSession" style="padding:14px;align-items:flex-start">${icon('plans', 'style="width:22px;height:22px;color:var(--accent)"')}<span class="small" style="font-weight:600">New session</span></button>
      <a class="card link stack tight" href="#/boards" style="padding:14px;text-decoration:none">${icon('board', 'style="width:22px;height:22px;color:var(--accent)"')}<span class="small" style="font-weight:600">Board</span></a>
      <a class="card link stack tight" href="#/model" style="padding:14px;text-decoration:none">${icon('model', 'style="width:22px;height:22px;color:var(--accent)"')}<span class="small" style="font-weight:600">Game model</span></a>
    </div>
    <section aria-label="Training block" class="card stack tight">
      <div class="row between"><div class="small" style="font-weight:600">Training block</div>${cb ? `<span class="pill">Week ${wk} of ${cb.weeks}</span>` : ''}</div>
      ${cb ? `<div class="small"><a href="#/block/${cb.id}">${esc(cb.title || 'Untitled block')}</a>${(cb.principleIds || []).length ? ` <span class="muted">· ${cb.principleIds.map(S.get).filter(Boolean).map(p => esc(p.title)).join(', ')}</span>` : ''}</div>${(cb.weeksPlan || [])[wk - 1] ? `<div class="small muted">This week: ${esc(cb.weeksPlan[wk - 1])}</div>` : '<div class="small muted">Nothing written for this week yet.</div>'}` : `<div class="small muted">No block running. Sessions that don’t add up to anything are the most common way a season drifts. <a href="#/plans/programme">Plan four to six weeks</a> on the principle the reviews keep flagging.</div>`}
    </section>
    <section class="stack tight" aria-label="Coming up">
      <div class="h2">Coming up</div>
      ${upcoming.length ? `<div class="list">${upcoming.map(u => `<a class="item" href="#/${u.k}/${u.r.id}"><span class="badge-num" style="background:${u.k === 'match' ? 'var(--opp)' : 'var(--accent)'};width:36px;height:36px">${icon(u.k === 'match' ? 'flag' : 'whistle', 'style="width:18px;height:18px"')}</span><span class="grow"><span class="t" style="display:block">${u.k === 'match' ? 'v ' + esc(u.r.opponent) : esc(u.r.theme || 'Session (no theme yet)')}</span><span class="s">${fmtD(u.d)}${u.r.ko ? ' · ' + esc(u.r.ko) : ''}</span></span>${icon('chev', 'style="width:18px;height:18px;color:var(--muted)"')}</a>`).join('')}</div>`
        : `<div class="empty">Nothing dated in the next few weeks.</div>`}
    </section>
    ${dummy ? `<div class="card small muted">${dummy} players still have dummy names. <a href="#/squad">Add real names in Squad</a>.</div>` : ''}
    ${!standalone && !S.meta().hideInstall ? `<div class="card stack tight"><div class="row between"><div class="h3">Put it on your home screen</div><button class="btn sm" data-act="hideInstall">Hide</button></div>
      <div class="small muted">iPhone or iPad: open this page in Safari, tap Share, then <b>Add to Home Screen</b>. Android: Chrome menu, <b>Install app</b>. Laptop: the install icon in Chrome or Edge’s address bar. It then opens full screen like an app and works without signal.</div></div>` : ''}
  </div></div>`;

  actions(el, {
    rev: id => { const d = due.find(x => x.rec.id === id); startReview(d.kind, d.rec); },
    newSession: () => newSession(),
    newMatch: () => newMatch(),
    hideInstall: () => { S.setMeta('hideInstall', true); ctx.refresh(); },
    startDone: () => { S.setMeta('startHereDone', true); ctx.refresh(); }
  });
}
