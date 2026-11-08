// Home: what's next, then big tiles for the week (Training > Match > Analysis) and the team.
import * as S from '../store.js';
import { esc, icon, fmtD, today, actions, sheet, closeSheet } from '../util.js';
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

export default function home(el, params, ctx) {
  const t = S.team(); const T = t.id; const td = today();
  ctx.setTop({ home: true });
  const due = S.reviewsDue(T);
  const ps = S.principles(T); const agreed = ps.filter(p => p.status === 'agreed').length;
  const nm = S.nextMatch(T); const ns = S.nextSession(T); const lc = S.lastChange(T);
  // A session planned after that analysis, with "this session acts on it" ticked, closes the loop.
  const acted = lc ? S.sessions(T).filter(s => s.addresses && !s.cancelled && (s.addressesReview === lc.id || s.fromReview === lc.id || (s.date && s.date >= lc.date))).sort((a, b) => (a.date || '').localeCompare(b.date || ''))[0] : null;
  const cb = S.currentBlock(T); const wk = cb ? S.weekOf(cb, td) : 0;
  const mList = nm ? matchChallenges(nm, T) : []; const mOpen = openCount(mList);
  const pl = S.players(T); const dummy = pl.filter(p => /^Player \d+$/.test(p.name)).length;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;

  const tile = (sec, href, ic, title, sub, status, id) => `<a class="wtile ${sec}" href="${href}" id="${id}"><span class="ic">${icon(ic)}</span><span class="t">${title}</span><span class="s">${sub}</span><span class="st">${status}</span></a>`;

  el.innerHTML = `<div class="stack home">
    ${S.meta().startHereDone ? '' : `<div class="card row nowrap" id="startHereCard" style="gap:12px;border-color:var(--accent-line)"><span class="grow small"><b>New here?</b> The start here guide sets the app up in five steps.</span><button class="btn sm pri" data-act="guide">Start here</button><button class="btn sm" data-act="guideHide">Hide</button></div>`}
    ${due.length ? `<section class="challenge" aria-label="Analysis due"><div class="head"><div class="title">${icon('bulb', 'style="width:18px;height:18px"')}Analysis due</div><span class="pill lamp">${due.length}</span></div>
      <div class="small" style="color:var(--lamp-text)">Close the loop before you plan anything new. Your next session is built from what you write here.</div>
      ${due.map(d => `<button class="item" data-act="rev" data-arg="${d.rec.id}" style="background:rgba(10,16,32,.5);border-color:var(--lamp-line)"><span class="grow"><span class="t" style="display:block">${d.kind === 'match' ? 'v ' + esc(d.rec.opponent) : esc(d.rec.theme || 'Session')}</span><span class="s">${d.kind === 'match' ? 'Match' : 'Session'} · ${fmtD(d.rec.date)}${d.started ? ' · started' : ''}</span></span><span class="btn sm lamp">${d.started ? 'Finish' : 'Start'}</span></button>`).join('')}</section>` : ''}

    <div class="nextup">
      ${nm ? `<a class="next match" href="#/match/${nm.id}" id="nextMatch" aria-label="Next match"><span class="lab">Next match</span><span class="t">${esc(nm.opponent || 'Opponent not set')}</span><span class="s">${fmtD(nm.date)}${nm.ko ? ' · ' + esc(nm.ko) : ''}${mOpen ? ` · plan has ${mOpen} must-do${mOpen > 1 ? 's' : ''}` : ' · plan ready'}</span></a>`
        : `<button type="button" class="next match" data-act="newMatch" id="nextMatch" aria-label="Next match"><span class="lab">Next match</span><span class="t">Nothing in the diary</span><span class="s">Add the next fixture</span></button>`}
      <a class="next training" href="${ns ? '#/session/' + ns.id : '#/training/sessions'}" id="nextSession" aria-label="Next session"><span class="lab">Next session</span><span class="t">${ns ? esc(ns.theme || 'No theme yet') : 'Not planned yet'}</span><span class="s">${ns ? fmtD(ns.date) : 'Plan it from your block'}</span></a>
    </div>
    ${lc ? `<section aria-label="Carried forward" class="card row nowrap small" style="gap:12px;align-items:flex-start"><span style="flex:none;color:var(--lamp)">${icon('bulb', 'style="width:20px;height:20px"')}</span><span><b>Carried forward</b> from your analysis of ${fmtD(lc.date)}: “${esc(lc.change)}”<br><span class="muted">${acted ? `<a href="#/session/${acted.id}">Acted on in the session of ${fmtD(acted.date)}</a>. The next analysis will tell you whether it worked.` : 'Not acted on yet. Plan the next session from it.'}</span></span></section>` : ''}

    <section aria-label="Your week" class="stack tight">
      <div class="eyebrow">Your week</div>
      <div class="week">
        ${tile('training', '#/training', 'training', 'Training', 'Programme, sessions and drills, one inside the other.', cb ? `Block: ${esc(cb.title || 'untitled')} · week ${wk} of ${cb.weeks}` : 'No block running', 'wTraining')}
        <span class="arrow" aria-hidden="true">${icon('chev')}</span>
        ${tile('match', '#/matches', 'match', 'Match', 'Opposition analysis and your match day plan.', nm ? `Next: ${esc(nm.opponent || 'opponent not set')}${mOpen ? ` · ${mOpen} must-do` : ''}` : 'Nothing in the diary', 'wMatch')}
        <span class="arrow" aria-hidden="true">${icon('chev')}</span>
        ${tile('analysis', '#/analysis', 'analysis', 'Analysis', 'What worked, what didn’t, the one thing to change.', due.length ? `${due.length} to write up` : (lc ? 'Next: ' + esc(lc.change.slice(0, 50)) : 'Nothing waiting'), 'wAnalysis')}
      </div>
    </section>

    <section aria-label="Your team" class="stack tight">
      <div class="eyebrow">Your team</div>
      <div class="teamtiles">
        <a class="ttile" href="#/model" id="hModel">${icon('model')}<span><span class="t">Game model</span><span class="s">${ps.length} principle${ps.length === 1 ? '' : 's'}${ps.length ? ', ' + agreed + ' agreed' : ''}</span></span></a>
        <a class="ttile" href="#/squad" id="hSquad">${icon('squad')}<span><span class="t">Squad</span><span class="s">${dummy ? dummy + ' still to name' : pl.length + ' players'}</span></span></a>
        <a class="ttile" href="#/sketch" id="hSketch">${icon('sketch')}<span><span class="t">Sketch</span><span class="s">A blank board for ideas</span></span></a>
      </div>
    </section>

    ${!standalone && !S.meta().hideInstall ? `<div class="card row nowrap small muted" style="gap:12px"><span class="grow">Put it on your home screen: in Safari tap Share, then <b>Add to Home Screen</b>. On a laptop use the install icon in the address bar.</span><button class="btn sm" data-act="hideInstall">Hide</button></div>` : ''}
  </div>`;

  actions(el, {
    rev: id => { const d = due.find(x => x.rec.id === id); startReview(d.kind, d.rec); },
    newMatch: () => newMatch(),
    guide: () => openStartHere(),
    guideHide: () => { S.setMeta('startHereDone', true); ctx.refresh(); },
    hideInstall: () => { S.setMeta('hideInstall', true); ctx.refresh(); }
  });
}
