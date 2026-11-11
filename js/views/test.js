// Test it: run a board against a defending side and see where it breaks (rules engine in tester.js).
import * as S from '../store.js';
import { esc, icon, actions, sheet, closeSheet, debounce, fmtD, today, toast } from '../util.js';
import { frameSvg } from '../pitch.js';
import { STYLES, SHARP, simulate, overlaySvg, styleFromMatch } from '../tester.js';

const KEY = id => 'test:' + id;
// Matches coming up with something in their opposition file to test against.
function matchOpps(T) {
  const td = today();
  return S.matches(T).filter(m => m.opponent && (!m.date || m.date >= td) && m.tags && (m.tags.press || m.tags.formation))
    .sort((a, b) => (a.date || '9').localeCompare(b.date || '9')).slice(0, 3);
}
const matchSays = m => [m.tags.press ? m.tags.press[0].toUpperCase() + m.tags.press.slice(1) : '', m.tags.formation ? m.tags.formation : ''].filter(Boolean).join(' · ');

// Who they're testing against, as settings the engine understands.
export function resolveTest(b, set) {
  const T = b.team;
  if (set.opp && set.opp.startsWith('match:')) {
    const m = S.get(set.opp.slice(6));
    if (m) { const st = styleFromMatch(m); return { ...st, sharp: set.sharp || st.sharp, against: m.opponent, sub: matchSays(m) }; }
  }
  const style = STYLES[set.opp] ? set.opp : 'high';
  return { style, shape: '', sharp: set.sharp || 'sharp', against: STYLES[style].lab, sub: STYLES[style].says };
}

export function testSheet(b, { onRun } = {}) {
  const T = b.team; const ms = matchOpps(T);
  const cur = S.meta()[KEY(b.id)] || { opp: ms[0] ? 'match:' + ms[0].id : 'high', sharp: 'sharp' };
  const opt = (v, title, sub, tag = '') => `<label class="topt"><input type="radio" name="tOpp" value="${esc(v)}" ${cur.opp === v ? 'checked' : ''}><span><b>${esc(title)}${tag}</b><small>${esc(sub)}</small></span></label>`;
  const el = sheet(`<div class="stack" id="testSheet">
    <div><div class="h1" style="margin:0">Test this play</div><p class="small muted" style="margin:4px 0 0">A defending side moves against it, frame by frame, and the app shows where it breaks.</p></div>
    <div class="ghead" style="margin:0">Who are you testing it against?</div>
    <div class="gl" id="tOpps">${ms.map((m, i) => opt('match:' + m.id, m.opponent, `From the opposition file: ${matchSays(m)}`, i === 0 ? ` <span class="pill good" style="margin-left:6px">${m.date ? fmtD(m.date) : 'Next match'}</span>` : '')).join('')}
      ${Object.entries(STYLES).map(([k, s]) => opt(k, s.lab, s.says)).join('')}</div>
    ${ms.length ? '' : '<p class="tiny muted" style="margin:0">Fill in “How they press” in a match’s opposition file and you can test against that team here.</p>'}
    <div class="ghead" style="margin:0">How sharp are they?</div>
    <div class="seg" role="radiogroup" id="tSharp">${Object.entries(SHARP).map(([k, s]) => `<button type="button" role="radio" aria-checked="${cur.sharp === k}" class="${cur.sharp === k ? 'on' : ''}" data-s="${k}">${s.lab}</button>`).join('')}</div>
    <button class="btn pri block" id="tRun" style="min-height:50px;font-size:16px">${icon('play')}Run the test</button>
    <p class="tiny muted" style="margin:0;text-align:center">Everything it flags is measured on the pitch: distances, angles and how long the ball takes.</p>
  </div>`);
  let sharp = cur.sharp;
  el.querySelectorAll('[data-s]').forEach(x => x.onclick = () => { sharp = x.dataset.s; el.querySelectorAll('[data-s]').forEach(y => { y.classList.toggle('on', y === x); y.setAttribute('aria-checked', y === x); }); });
  el.querySelector('#tRun').onclick = () => {
    const opp = (el.querySelector('input[name="tOpp"]:checked') || {}).value || 'high';
    S.setMeta(KEY(b.id), { opp, sharp, ran: Date.now() }); closeSheet();
    if (onRun) onRun(); else location.hash = '#/test/' + b.id;
  };
}

export default function testView(el, [id], ctx) {
  const b = S.get(id);
  if (!b || b.del) { ctx.setTop({ back: '#/sketch', title: 'Test it' }); el.innerHTML = '<div class="empty">This board has been deleted.</div>'; return; }
  const set = S.meta()[KEY(id)];
  if (!set) { ctx.setTop({ back: '#/board/' + id, title: 'Test: ' + b.name }); el.innerHTML = `<div class="empty">Pick who to test it against. <button class="btn pri" data-act="pick">Choose</button></div>`; actions(el, { pick: () => testSheet(b, { onRun: () => ctx.refresh() }) }); testSheet(b, { onRun: () => ctx.refresh() }); return; }
  const st = resolveTest(b, set);
  const pm = S.playerMap(b.team);
  const R = simulate(b, pm, st);
  const n = R.frames.length; const ser = R.findings.filter(f => f.sev === 'serious'); const look = R.findings.filter(f => f.sev !== 'serious');
  const badF = new Set(ser.flatMap(f => f.frames)); const lookF = new Set(look.flatMap(f => f.frames));
  const passes = R.frames.reduce((a, F) => a + F.fr.passes.length, 0); const cut = R.findings.filter(f => f.type === 'pass').reduce((a, f) => a + f.frames.length, 0);
  const notes = b.testNotes || {};
  ctx.setTop({ back: '#/board/' + id, backLabel: 'Board', title: 'Test: ' + b.name, sub: `v ${st.against} · ${SHARP[st.sharp].lab}` });

  let fi = Math.min(+(S.meta()['testFrame:' + id] || 0), n - 1); let focus = null; let anim = null;
  const orient = () => (innerWidth >= 700 && innerWidth > innerHeight) ? 'h' : 'v';
  const pitch = (t = 1) => { const F = R.frames[fi];
    return frameSvg(b.frames[fi], pm, { orient: orient(), cls: 'pitch', style: 'width:100%;height:auto;border-radius:14px;display:block', attrs: 'id="testPitch" role="img" aria-label="Pitch with the opponent"',
      hide: it => it.kind === 'opp' || it.kind === 'def', overlay: overlaySvg(F, R.findings, { focus, t, orient: orient() }) }); };
  const card = (f, i) => `<article class="tfind ${f.sev}" data-key="${esc(f.key)}">
      <div class="row nowrap" style="gap:10px;align-items:flex-start">
        <span class="tnum">${i + 1}</span>
        <span class="grow" style="min-width:0"><span class="row nowrap" style="gap:6px;margin-bottom:3px"><span class="tsev">${f.sev === 'serious' ? 'Serious' : 'Worth a look'}</span><span class="tfr">${f.frames.length > 1 ? 'FRAMES ' + f.frames.map(k => k + 1).join(', ') : 'FRAME ' + (f.frame + 1)}</span></span>
          <span class="tt">${esc(f.title)}</span><span class="tm">${esc(f.measure)}</span></span>
        <button class="btn sm tshow" data-act="show" data-arg="${esc(f.key)}">${icon('play')}Show me</button>
      </div>
      <details class="tans" ${notes[f.key] ? 'open' : ''}><summary>${esc(f.q)}</summary><textarea rows="2" data-note="${esc(f.key)}" aria-label="${esc(f.q)}" placeholder="Your answer, saved with the board">${esc(notes[f.key] || '')}</textarea></details>
    </article>`;
  el.innerHTML = `<div class="split wide-right testgrid" style="align-items:start">
    <div class="stack tight">
      <div class="row nowrap" style="gap:6px;flex-wrap:wrap" id="tFrames"><span class="tiny muted" style="font-weight:700;letter-spacing:.08em">FRAME</span>
        ${R.frames.map((F, k) => `<button class="tframe ${k === fi ? 'on' : ''}" data-act="frame" data-arg="${k}" aria-label="Frame ${k + 1}${badF.has(k) ? ', a serious problem' : lookF.has(k) ? ', worth a look' : ''}">${k + 1}${badF.has(k) ? '<span class="tdot bad"></span>' : lookF.has(k) ? '<span class="tdot look"></span>' : ''}</button>`).join('')}
        <span class="grow"></span>${n > 1 ? `<button class="btn sm pri" data-act="play" id="tPlay">${icon('play')}Play</button>` : ''}<button class="btn sm" data-act="change" id="tChange">Change opponent</button></div>
      <div id="tPitchWrap">${pitch()}</div>
      <div class="row" id="tFocus" style="gap:8px;display:none"><span class="small grow" id="tFocusLab"></span><button class="btn sm" data-act="all">Show everything</button></div>
      <div class="tlegend"><span><i class="lg opp"></i>Their players</span><span><i class="lg cut"></i>Gets to the pass</span><span><i class="lg free"></i>Free player</span><span><i class="lg zone"></i>Outnumbered or exposed</span></div>
      <p class="tiny muted" style="margin:0">${esc(st.sub)}. They move up to ${Math.round(SHARP[st.sharp].speed * 3)} m between frames and react in ${SHARP[st.sharp].react} s.${b.frames.some(f => (f.items || []).some(i => i.kind === 'opp')) ? ' Your opposition players on the board are their starting positions.' : ''}</p>
    </div>
    <div class="stack">
      <div class="tband lite"><div class="tstats">
        <div class="tstat"><span class="n" style="color:#B3261E">${ser.length}</span><span class="l">Serious</span></div>
        <div class="tstat"><span class="n">${look.length}</span><span class="l">Worth a look</span></div>
        <div class="tstat"><span class="n">${n - badF.size}/${n}</span><span class="l">Frames clean</span></div>
        <div class="tstat"><span class="n">${passes ? (passes - cut) + '/' + passes : '–'}</span><span class="l">Passes on</span></div></div></div>
      ${R.findings.length ? `<div class="ghead" style="margin:0">Most dangerous first</div><div class="stack tight" id="tFindings">${R.findings.slice(0, 5).map(card).join('')}${R.findings.length > 5 ? `<details class="tmore"><summary>${R.findings.length - 5} more worth a look</summary><div class="stack tight" style="margin-top:8px">${R.findings.slice(5).map((f, i) => card(f, i + 5)).join('')}</div></details>` : ''}</div>`
        : `<div class="empty" id="tFindings">Nothing broke against ${esc(st.against)}. Try them at Ruthless, or another style.</div>`}
      ${passes ? '' : '<p class="small muted" style="margin:0">Draw the passes with the Pass arrow and the test checks whether each one is on.</p>'}
      <div class="grid2"><button class="btn" data-act="change">Test again</button><a class="btn pri" href="#/board/${b.id}">Edit the play</a></div>
    </div></div>`;

  const draw = t => { el.querySelector('#tPitchWrap').innerHTML = pitch(t); };
  const setFrame = k => { fi = k; S.setMeta('testFrame:' + id, k); el.querySelectorAll('.tframe').forEach((x, j) => x.classList.toggle('on', j === k)); };
  const animate = (done) => { cancelAnimationFrame(anim); const t0 = performance.now(); const step = now => { const t = Math.min(1, (now - t0) / 900); draw(t); if (t < 1) anim = requestAnimationFrame(step); else if (done) done(); }; anim = requestAnimationFrame(step); };
  const setFocus = key => { focus = key; const f = R.findings.find(x => x.key === key); el.querySelector('#tFocus').style.display = key ? 'flex' : 'none'; el.querySelector('#tFocusLab').textContent = f ? f.title : '';
    el.querySelectorAll('.tfind').forEach(x => x.classList.toggle('on', x.dataset.key === key)); };
  const save = debounce(() => { if (S.canEdit(b)) S.put(b); }, 600);
  el.querySelectorAll('[data-note]').forEach(t => t.oninput = () => { b.testNotes = { ...(b.testNotes || {}), [t.dataset.note]: t.value }; if (!t.value) delete b.testNotes[t.dataset.note]; save(); });
  actions(el, {
    frame: k => { setFocus(null); setFrame(+k); animate(); },
    all: () => { setFocus(null); draw(1); },
    change: () => testSheet(b, { onRun: () => ctx.refresh() }),
    show: key => { const f = R.findings.find(x => x.key === key); if (!f) return; setFocus(key); setFrame(f.frame); animate();
      const w = el.querySelector('#tPitchWrap'); if (w.getBoundingClientRect().top < 60 || w.getBoundingClientRect().bottom > innerHeight) w.scrollIntoView({ behavior: 'smooth', block: 'center' }); },
    play: () => { setFocus(null); let k = 0; const next = () => { setFrame(k); animate(() => { k++; if (k < n) setTimeout(next, 500); }); }; next(); }
  });
  // A finished run is recorded on the board once, when it is first shown.
  if (set.ran && set.ran !== (b.lastTest || {}).ran && S.canEdit(b)) { b.lastTest = { ran: set.ran, at: new Date().toISOString(), against: st.against, sharp: st.sharp, serious: ser.length, look: look.length }; S.put(b, { quiet: true }); }
  return () => cancelAnimationFrame(anim);
}
