// Home: what's next, then big tiles for the week (Training > Match > Analysis) and the team.
import * as S from '../store.js';
import { esc, icon, fmtD, today, actions, sheet, closeSheet, badgeSrc } from '../util.js';
import { matchChallenges, openCount } from '../challenges.js';
import { startReview } from './review.js';
import { newMatch } from './match.js';

// The "Start here" guide: opened from the button in the top bar, and once automatically on first use.
export function openStartHere() {
  const el = sheet(`<section class="stack" id="startHere" aria-label="Start here">
    <div class="h2">Start here</div>
    <p class="small" style="margin:0">The Coaching Room joins up your game model, training, matches and analysis into one loop, so each session is built from what you learned in the last one.</p>
    <div class="eyebrow">Set it up, in this order</div>
    <ol class="small" style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px">
      <li><a href="#/model">Rewrite the three principles in your own words</a> and mark them agreed.</li>
      <li><a href="#/squad">Paste your squad.</a></li>
      <li><a href="#/training/programme">Plan your first block</a>: four to six weeks on one or two principles.</li>
      <li><a href="#/cloud">Sign in for sync and links.</a></li>
      <li>Install it on your phone: in Safari tap Share, then Add to Home Screen.</li>
    </ol>
    <div class="eyebrow">The weekly loop</div>
    <ol class="small" style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:4px">
      <li>Training: plan the session from the block, then coach it.</li>
      <li>Analysis: write it up the same night.</li>
      <li>Match: opposition analysis, then the match day plan.</li>
      <li>Analysis: the match, on Monday.</li>
    </ol>
    <p class="small" style="margin:0">The analysis is what makes it work: the one thing you decide to change there is what your next session is built from.</p>
    <p class="small muted" style="margin:0">Every screen has a <b>?</b> at the top right. Tap it for a guide to that screen.</p>
    <div class="row"><button class="btn pri" id="startDone">Got it</button></div></section>`);
  const done = () => { S.setMeta('startHereDone', true); closeSheet(); if (/^#\/?(home)?$/.test(location.hash)) window.dispatchEvent(new HashChangeEvent('hashchange')); };
  el.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { S.setMeta('startHereDone', true); closeSheet(); }));
  el.querySelector('#startDone').onclick = done;
}

const daysTo = d => Math.round((new Date(d + 'T12:00') - new Date(today() + 'T12:00')) / 864e5);

export default function home(el, params, ctx) {
  const t = S.team(); const T = t.id; const td = today();
  ctx.setTop({ home: true, title: 'Coaching Room' });
  const due = S.reviewsDue(T);
  const ps = S.principles(T); const agreed = ps.filter(p => p.status === 'agreed').length;
  const nm = S.nextMatch(T); const ns = S.nextSession(T); const lc = S.lastChange(T);
  // A session planned after that analysis, with "this session acts on it" ticked, closes the loop.
  const acted = lc ? S.sessions(T).filter(s => s.addresses && !s.cancelled && (s.addressesReview === lc.id || s.fromReview === lc.id || (s.date && s.date >= lc.date))).sort((a, b) => (a.date || '').localeCompare(b.date || ''))[0] : null;
  const cb = S.currentBlock(T); const wk = cb ? S.weekOf(cb, td) : 0;
  const mList = nm ? matchChallenges(nm, T) : []; const mOpen = openCount(mList);
  const pl = S.players(T); const dummy = pl.filter(p => /^Player \d+$/.test(p.name)).length;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const md = nm && nm.date ? daysTo(nm.date) : null;

  const band = (sec, href, id, title, sub, big, small) => `<a class="bandtile ${sec}" href="${href}" id="${id}"><span class="grow"><span class="t">${title}</span><span class="s">${sub}</span></span><span class="k"><b>${big}</b><small>${small}</small></span></a>`;

  el.innerHTML = `<div class="stack home" style="gap:10px">
    ${S.meta().startHereDone ? '' : `<div class="card row nowrap" id="startHereCard" style="gap:12px"><span class="grow small"><b>New here?</b> The start here guide sets the app up in five steps.</span><button class="btn sm pri" data-act="guide">Start here</button><button class="btn sm" data-act="guideHide">Hide</button></div>`}
    <div class="homegrid"><div class="stack" style="gap:10px">
    ${due.length ? `<section class="mustbox" aria-label="Analysis due"><div class="mh"><span>Analysis due</span><span class="pill lamp">${due.length}</span></div>
      <div class="small" style="padding:0 14px 8px;color:var(--lamp-text)">Close the loop before you plan anything new. Your next session is built from what you write here.</div>
      ${due.map(d => `<button class="gr" data-act="rev" data-arg="${d.rec.id}"><span class="lbl">${d.kind === 'match' ? 'v ' + esc(d.rec.opponent) : esc(d.rec.theme || 'Session')}<small>${d.kind === 'match' ? 'Match' : 'Session'} · ${fmtD(d.rec.date)}${d.started ? ' · started' : ''}</small></span><span class="btn sm lamp">${d.started ? 'Finish' : 'Start'}</span></button>`).join('')}</section>` : ''}

    ${nm ? `<a class="nextcard" href="#/match/${nm.id}" id="nextMatch" aria-label="Next match: ${esc(t.name)} v ${esc(nm.opponent || 'opponent not set')}"><span class="scorebug"><span class="us">${badgeSrc(t) ? `<img class="sbb" src="${esc(badgeSrc(t))}" alt="">` : ''}<span class="ell">${esc(t.short || t.name.split(' ')[0])}</span></span><span class="vs">V</span><span class="them ${nm.opponent ? '' : 'unset'}">${esc(nm.opponent || 'Opponent?')}</span></span>
        <span class="meta"><span>${nm.date ? fmtD(nm.date) : 'No date yet'}${nm.ko ? ' · ' + esc(nm.ko) : ''}${nm.venue ? ' · ' + esc(nm.venue) : ''}</span><span class="mono ${mOpen ? 'todo' : ''}">${mOpen ? mOpen + ' MUST-DO' : 'PLAN READY'}</span></span></a>`
      : `<button type="button" class="nextcard" data-act="newMatch" id="nextMatch" aria-label="Next match"><span class="scorebug"><span class="us">${badgeSrc(t) ? `<img class="sbb" src="${esc(badgeSrc(t))}" alt="">` : ''}<span class="ell">${esc(t.short || t.name.split(' ')[0])}</span></span><span class="vs">V</span><span class="them unset">No fixture</span></span><span class="meta"><span>Add the next fixture</span><span class="chev">›</span></span></button>`}
    <div class="gl"><a class="gr" href="${ns ? '#/session/' + ns.id : '#/training/sessions'}" id="nextSession" aria-label="Next session"><span class="lbl">${ns ? esc(ns.theme || 'No theme yet') : 'Next session not planned yet'}<small>${ns ? 'Next session · ' + fmtD(ns.date) + (ns.time ? ' · ' + esc(ns.time) : '') : 'Plan it from your block'}</small></span><span class="chev">›</span></a></div>

    <div class="ghead">This week</div>
    <section aria-label="Your week" class="bands">
      ${band('training', '#/training', 'wTraining', 'Training', cb ? ((cb.weeksPlan || [])[wk - 1] ? 'This week: ' + esc(cb.weeksPlan[wk - 1]) : esc(cb.title || 'Untitled block')) : 'No block running', cb ? `${wk}/${cb.weeks}` : '–', cb ? 'Weeks' : 'No block')}
      ${band('match', '#/matches', 'wMatch', 'Match', nm ? (nm.opponent ? 'v ' + esc(nm.opponent) : 'Opponent not set') : 'Nothing in the diary', md == null ? '–' : md === 0 ? 'Today' : md + 'd', md == null ? 'No date' : md === 0 ? 'Kick-off' : 'To go')}
      ${band('analysis', '#/analysis', 'wAnalysis', 'Analysis', due.length ? 'Write it up while you remember' : (lc ? 'Next: ' + esc(lc.change) : 'Nothing waiting'), due.length, 'To do')}
    </section>
    </div><div class="stack" style="gap:10px">
    ${lc ? `<section aria-label="Carried forward" class="card row nowrap small" style="gap:12px;align-items:flex-start"><span style="flex:none;color:#B38F00">${icon('bulb', 'style="width:20px;height:20px"')}</span><span><b>Carried forward</b> from your analysis of ${fmtD(lc.date)}: “${esc(lc.change)}”<br><span class="muted">${acted ? `<a href="#/session/${acted.id}">Acted on in the session of ${fmtD(acted.date)}</a>. The next analysis will tell you whether it worked.` : 'Not acted on yet. Plan the next session from it.'}</span></span></section>` : ''}
    <div class="ghead">The team</div>
    <section aria-label="Your team" class="gl">
      <a class="gr" href="#/model" id="hModel"><span class="lbl">Game model</span><span class="v"><span class="mono">${ps.length}${ps.length ? ' · ' + agreed + ' agreed' : ''}</span><span class="chev">›</span></span></a>
      <a class="gr" href="#/squad" id="hSquad"><span class="lbl">Squad</span><span class="v"><span class="mono">${dummy ? dummy + ' to name' : pl.length}</span><span class="chev">›</span></span></a>
      <a class="gr" href="#/staff" id="hStaff"><span class="lbl">Staff<small>Who coaches with you, and invites</small></span><span class="v">${S.members(T).length ? `<span class="mono">${S.members(T).length}</span>` : ''}<span class="chev">›</span></span></a>
      <a class="gr" href="#/sketch" id="hSketch"><span class="lbl">Sketch<small>A blank board for ideas</small></span><span class="chev">›</span></a>
    </section>
    ${!standalone && !S.meta().hideInstall ? `<div class="card row nowrap small muted" style="gap:12px"><span class="grow">Put it on your home screen: in Safari tap Share, then <b>Add to Home Screen</b>. On a laptop use the install icon in the address bar.</span><button class="btn sm" data-act="hideInstall">Hide</button></div>` : ''}
    </div></div>
  </div>`;

  actions(el, {
    rev: id => { const d = due.find(x => x.rec.id === id); startReview(d.kind, d.rec); },
    newMatch: () => newMatch(),
    guide: () => openStartHere(),
    guideHide: () => { S.setMeta('startHereDone', true); ctx.refresh(); },
    hideInstall: () => { S.setMeta('hideInstall', true); ctx.refresh(); }
  });
}
