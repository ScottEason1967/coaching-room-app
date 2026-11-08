// Printable pages (A4). Uses the browser's print dialog, which also saves as PDF.
import * as S from './store.js';
import { PHASES, INTERVENTIONS, CORNERS, TAGS, DIRECTION } from './store.js';
import { esc, nl2br, fmtDY, lines } from './util.js';
import { frameSvg, drillSvg, EQUIP } from './pitch.js';
import { sessionStats, sessionKit } from './challenges.js';

const COLOUR = { '#F2B705': 'yellow', '#FF7A00': 'orange', '#3D7BFF': 'blue', '#D63B3B': 'red', '#FFFFFF': 'white', '#2FB67A': 'green' };
export function kitLabel(k) {
  const [kind, col] = k.split(':'); const e = EQUIP[kind];
  return (e ? e.lab : kind) + (col ? ` (${COLOUR[col.toUpperCase()] || 'coloured'})` : '');
}

function doPrint(html) {
  const p = document.getElementById('print'); p.innerHTML = html;
  setTimeout(() => { try { window.print(); } catch (e) { console.error(e); } }, 120);
}
const head = (title, meta, T) => { const lg = T && (S.get(T) || {}).logo; return `${lg ? `<img src="${esc(lg)}" alt="" style="float:right;width:56px;height:56px;object-fit:contain;margin-left:12px">` : ''}<h1>${esc(title)}</h1><div class="meta">${meta}</div>`; };
const teamName = T => esc((S.get(T) || {}).name || '');

export function boardHtml(b, pm) {
  return b.frames.map((f, i) => `<div class="avoid" style="margin-bottom:5mm"><h2>${i + 1}. ${esc(f.name || 'Frame')}${f.phase ? ' · ' + PHASES[f.phase].lab : ''}</h2>
    <table><tr><td style="width:62%;border:0;padding:0">${frameSvg(f, pm, { style: 'width:100%;max-height:120mm' })}</td><td style="border:0">${nl2br(f.notes)}</td></tr></table></div>`).join('');
}
export function printBoard(b) {
  doPrint(head(b.name, `${teamName(b.team)} · ${b.frames.length} frame${b.frames.length === 1 ? '' : 's'}`, b.team) + boardHtml(b, S.playerMap(b.team)));
}

export function drillHtml(d, T, mins, talk) {
  const ps = S.drillLinks(d, T).map(S.get).filter(Boolean);
  const corners = Object.entries(CORNERS).filter(([k]) => ((d.corners || {})[k] || '').trim()).map(([k, l]) => `<b>${l}:</b> ${esc(d.corners[k])}`).join('<br>');
  return `<div class="avoid"><h2>${esc(d.name)} <span style="font-weight:500;font-size:11pt;text-transform:none">${esc(d.type || '')}${mins ? ` · ${mins} min` : ''}${talk ? ` (talk ${talk})` : ''}</span></h2>
  <table><tr><td style="width:52%">${drillSvg(d, { style: 'width:100%;max-height:95mm' })}</td><td>
    <b>Objective</b><br>${nl2br(d.objective)}<br><br>
    <b>Principles</b><br>${ps.map(p => esc(p.title)).join('<br>') || '—'}<br><br>
    <b>Players</b> ${esc(d.players || '')} · <b>Area</b> ${esc(d.w)} x ${esc(d.h)} m${(d.interventions || []).length ? `<br><br><b>Interventions</b><br>${d.interventions.map(k => esc(INTERVENTIONS[k] || k)).join(', ')}` : ''}
  </td></tr>
  <tr><td colspan="2"><b>Organisation:</b> ${nl2br(d.org)}<br><b>How it works:</b> ${nl2br(d.how)}${d.direction ? `<br><b>Direction:</b> ${esc(DIRECTION[d.direction] || d.direction)}` : ''}${d.transition ? `<br><b>Transition:</b> ${nl2br(d.transition)}` : ''}<br><b>Coaching points:</b> ${nl2br(d.points)}${d.success ? `<br><b>Success looks like:</b> ${nl2br(d.success)}` : ''}${d.questions ? `<br><b>Questions:</b> ${nl2br(d.questions)}` : ''}${d.stepIn ? `<br><b>Step in when:</b> ${nl2br(d.stepIn)}` : ''}<br><b>Progress:</b> ${nl2br(d.prog)}<br><b>Regress:</b> ${nl2br(d.reg)}${corners ? `<br><br>${corners}` : ''}</td></tr></table></div>`;
}
export function printDrill(d, T) { doPrint(head(d.name, teamName(T), T) + drillHtml(d, T)); }

export function sessionHtml(s) {
  const T = s.team; const st = sessionStats(s); const { kit, balls } = sessionKit(s);
  const ps = (s.principleIds || []).map(S.get).filter(Boolean); const blk = S.blockFor(T, s.date);
  const focus = (s.focusIds || []).map(S.get).filter(Boolean);
  const kitTxt = Object.entries(kit).map(([k, v]) => `${v} × ${esc(kitLabel(k))}`).concat(balls ? [`balls (at least ${Math.max(balls, 10)})`] : []).join(', ');
  return head('Session: ' + (s.theme || ''), `${teamName(T)} · ${fmtDY(s.date)}${s.time ? ' · ' + esc(s.time) : ''}${s.venue ? ' · ' + esc(s.venue) : ''} · ${st.total} min · ball rolling ${st.rolling}%`, T)
    + `<table><tr><th style="width:28%">Principles</th><td>${ps.map(p => esc(p.title)).join('; ') || '—'}</td></tr>
       ${blk ? `<tr><th>Block</th><td>${esc(blk.title)} · week ${S.weekOf(blk, s.date)} of ${blk.weeks}${(blk.weeksPlan || [])[S.weekOf(blk, s.date) - 1] ? ': ' + esc(blk.weeksPlan[S.weekOf(blk, s.date) - 1]) : ''}</td></tr>` : ''}
       ${s.lookFor ? `<tr><th>Looking for</th><td>${nl2br(s.lookFor)}</td></tr>` : ''}
       ${focus.length ? `<tr><th>Focus players</th><td>${focus.map(p => esc(p.num + ' ' + p.name)).join(', ')}${s.focusHow ? ': ' + nl2br(s.focusHow) : ''}</td></tr>` : ''}
       ${s.addresses && s.addressesHow ? `<tr><th>From the last review</th><td>${nl2br(s.addressesHow)}</td></tr>` : ''}
       ${s.staff ? `<tr><th>Staff</th><td>${nl2br(s.staff)}</td></tr>` : ''}
       <tr><th>Kit</th><td>${kitTxt || '—'}</td></tr>
       ${s.notes ? `<tr><th>Notes</th><td>${nl2br(s.notes)}</td></tr>` : ''}</table>
       <h2>Running order</h2><table>${(s.blocks || []).map((b, i) => { const d = S.get(b.drillId); return `<tr><td style="width:8%">${i + 1}</td><td>${esc(d ? d.name : 'Missing drill')}</td><td style="width:18%">${esc(b.minutes || 0)} min</td><td style="width:30%">${esc(b.note || '')}</td></tr>`; }).join('')}</table>`
    + (s.blocks || []).map(b => { const d = S.get(b.drillId); return d ? drillHtml(d, T, b.minutes, b.talk) : ''; }).join('');
}
export function printSession(s) { doPrint(sessionHtml(s)); }

export function matchHtml(m) {
  const T = m.team; const p = m.plan || {}; const o = m.opp || {}; const pm = S.playerMap(T);
  const rows = (arr) => arr.filter(x => x[1]).map(([l, v]) => `<tr><th style="width:28%">${l}</th><td>${nl2br(v)}</td></tr>`).join('');
  const boards = (m.boardIds || []).map(S.get).filter(Boolean);
  const squad = (m.squadIds || []).map(S.get).filter(Boolean);
  return head('Match plan v ' + m.opponent, `${teamName(T)} · ${fmtDY(m.date)}${m.ko ? ' · ' + esc(m.ko) : ''}${m.venue ? ' · ' + esc(m.venue) : ''}${m.comp ? ' · ' + esc(m.comp) : ''}`, T)
    + `<h2>What wins us the game</h2><ol>${lines(p.keys).map(k => `<li>${esc(k)}</li>`).join('')}</ol>
       <h2>Their threat and our answer</h2><p>${nl2br(p.threat)}</p>
       ${p.first || p.planB || p.subs ? `<h2>Match management</h2><table>${rows([['First ten minutes', p.first], ['Plan B', p.planB], ['Substitutions', p.subs]])}</table>` : ''}
       <h2>How they play</h2><p>${Object.keys(TAGS).filter(k => (m.tags || {})[k]).map(k => `<b>${TAGS[k].lab}:</b> ${esc(m.tags[k])}`).join(' · ')}</p>
       <table>${rows([['In possession', o.ip], ['Out of possession', o.op], ['When they win it', o.ta], ['When they lose it', o.td], ['Set pieces', o.sp], ['Key individuals', o.people]])}</table>
       <h2>Our plan</h2><table>${rows([['In possession', p.ip], ['Out of possession', p.op], ['Our set pieces', p.sp], ['Their set pieces', p.spAgainst], ['Selection', p.selection], ['Team talk', p.talk]])}</table>
       ${(p.focusIds || []).map(S.get).filter(Boolean).length ? `<h2>Principles under test</h2><table>${rows((p.focusIds || []).map(S.get).filter(Boolean).map(pr => [esc(pr.title), (p.principleNotes || {})[pr.id] || '—']))}</table>` : ''}
       ${squad.length ? `<h2>Individual instructions</h2><table>${squad.map(pl => `<tr><th style="width:28%">${esc(pl.num)} · ${esc(pl.name)}</th><td>${nl2br((m.instructions || {})[pl.id] || '')}</td></tr>`).join('')}</table>` : ''}`
    + boards.map(b => `<div class="brk"></div><h1 style="font-size:16pt">${esc(b.name)}</h1>${boardHtml(b, pm)}`).join('');
}
export function printMatch(m) { doPrint(matchHtml(m)); }

// One card per player, to cut out or hand over.
export function printInstructionCards(m) {
  const squad = (m.squadIds || []).map(S.get).filter(Boolean);
  doPrint(head('Player instructions v ' + m.opponent, `${teamName(m.team)} · ${fmtDY(m.date)}`, m.team)
    + `<table>${squad.map(pl => `<tr class="avoid"><td style="padding:4mm"><div style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15pt;text-transform:uppercase">${esc(pl.num)} · ${esc(pl.name)}</div><div style="margin-top:2mm">${nl2br((m.instructions || {})[pl.id] || 'No individual instruction.')}</div><div style="margin-top:3mm;color:#555;font-size:9pt">Keys: ${lines((m.plan || {}).keys).map(esc).join(' · ')}</div></td></tr>`).join('')}</table>`);
}

window.addEventListener('afterprint', () => { const p = document.getElementById('print'); if (p) p.innerHTML = ''; });
