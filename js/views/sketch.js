// Sketch: a blank board to think on, kept apart from the team's saved work until it is worth keeping.
// A tactics sketch is a board (type 'sketch'); a drill sketch is a drill marked sketch:true. Both stay
// in "Recent sketches" until Joe saves them somewhere (Save to) or deletes them.
import * as S from '../store.js';
import { esc, icon, uid, clone, today, fmtD, sheet, closeSheet, toast } from '../util.js';

// A tactics frame as a drill on a full pitch: our players become attackers (keepers stay keepers),
// opponents become defenders, kit and arrows carry over.
export function frameToDrill(b, f, name) {
  const pm = S.playerMap(b.team);
  const items = (f.items || []).map(it => {
    if (it.kind === 'us') { const p = pm[it.pid]; return { id: uid(), kind: p && p.pos === 'GK' ? 'gk' : 'att', x: it.x, y: it.y, label: p ? String(p.num) : '' }; }
    if (it.kind === 'opp') return { id: uid(), kind: 'def', x: it.x, y: it.y, label: it.label || '' };
    if (['ball', 'text', 'cone', 'mannequin'].includes(it.kind)) return { ...clone(it), id: uid() };
    return null;
  }).filter(Boolean);
  return S.create('drill', null, {
    name: name || b.name, type: 'Phase of play', area: 'full', preset: 'full', w: 68, h: 105, items, arrows: clone(f.arrows || []).map(a => ({ ...a, id: uid() })),
    objective: f.notes || '', links: {}, corners: {}, interventions: [], org: '', how: '', points: '', prog: '', reg: '', players: items.filter(i => ['att', 'def', 'gk'].includes(i.kind)).length, minutes: 15
  });
}

// "Save to" for a tactics sketch.
export function saveBoardSketch(b, frameIndex) {
  const T = b.team; const ps = S.principles(T); const td = today();
  const ms = S.matches(T).filter(m => !m.date || m.date >= td).reverse();
  const el = sheet(`<div class="stack" id="saveTo"><div class="h2">Save this sketch</div>
    <label class="field"><span>Name</span><input type="text" id="svN" value="${esc(/^Sketch \d+$/.test(b.name) ? '' : b.name)}" placeholder="e.g. Corner: inswinger to the back post"></label>
    <div class="list">
      <button class="item" data-to="setpiece"><span class="badge-num" style="background:var(--surface2);color:var(--text2)">${icon('flag', 'style="width:20px;height:20px"')}</span><span class="grow"><span class="t" style="display:block">A set piece</span><span class="s">Kept with your saved boards, ready to attach to a match plan</span></span></button>
      <button class="item" data-to="phase"><span class="badge-num" style="background:var(--surface2);color:var(--text2)">${icon('board', 'style="width:20px;height:20px"')}</span><span class="grow"><span class="t" style="display:block">A shape or phase of play</span><span class="s">Kept with your saved boards</span></span></button>
      <button class="item" data-to="principle"><span class="badge-num" style="background:var(--surface2);color:var(--text2)">${icon('model', 'style="width:20px;height:20px"')}</span><span class="grow"><span class="t" style="display:block">The picture for a principle</span><span class="s">Shows on the principle in your game model</span></span></button>
      <button class="item" data-to="match"><span class="badge-num" style="background:var(--surface2);color:var(--text2)">${icon('match', 'style="width:20px;height:20px"')}</span><span class="grow"><span class="t" style="display:block">A match day plan</span><span class="s">Goes on the plan’s boards and prints with it</span></span></button>
      <button class="item" data-to="drill"><span class="badge-num" style="background:var(--surface2);color:var(--text2)">${icon('training', 'style="width:20px;height:20px"')}</span><span class="grow"><span class="t" style="display:block">A new drill</span><span class="s">This frame on a full pitch, in your drills to edit</span></span></button>
    </div><div id="svPick"></div><button class="btn" id="svX">Cancel</button></div>`);
  const name = () => el.querySelector('#svN').value.trim();
  const keep = type => { b.type = type; if (name()) b.name = name(); if (type === 'setpiece') b.sharePlayers = true; S.put(b); };
  const pick = (title, rows, onPick) => {
    el.querySelector('#svPick').innerHTML = `<div class="eyebrow" style="margin:6px 0">${esc(title)}</div>${rows.length ? `<div class="list">${rows.map(([id, t, s]) => `<button class="item" data-pk="${id}"><span class="grow"><span class="t" style="display:block">${esc(t)}</span><span class="s">${esc(s)}</span></span></button>`).join('')}</div>` : '<div class="empty">Nothing to pick yet.</div>'}`;
    el.querySelectorAll('[data-pk]').forEach(x => x.onclick = () => onPick(x.dataset.pk));
  };
  el.querySelector('#svX').onclick = closeSheet;
  el.querySelectorAll('[data-to]').forEach(x => x.onclick = () => {
    const to = x.dataset.to;
    if (to === 'setpiece' || to === 'phase') { keep(to); closeSheet(); toast('Saved with your boards'); location.hash = '#/board/' + b.id; window.dispatchEvent(new HashChangeEvent('hashchange')); return; }
    if (to === 'principle') return pick('Which principle?', ps.map(p => [p.id, p.title || 'Untitled', p.boardId ? 'Replaces its current picture' : 'No picture yet']), pid => {
      keep('phase'); const p = S.get(pid); p.boardId = b.id; S.put(p); closeSheet(); toast('Now the picture for “' + (p.title || 'the principle') + '”'); location.hash = '#/principle/' + pid;
    });
    if (to === 'match') return pick('Which match?', ms.map(m => [m.id, 'v ' + (m.opponent || 'opponent not set'), fmtD(m.date)]), mid => {
      keep(b.type === 'sketch' ? 'phase' : b.type); const m = S.get(mid); m.boardIds ||= []; if (!m.boardIds.includes(b.id)) m.boardIds.push(b.id); S.put(m);
      S.setMeta('matchTab', 'boards'); S.setMeta('matchPlanTab', 'boards'); closeSheet(); toast('On the match day plan'); location.hash = '#/match/' + mid;
    });
    if (to === 'drill') { const d = frameToDrill(b, b.frames[frameIndex] || b.frames[0], name()); closeSheet(); toast('Saved as a drill. The sketch is still in Recent sketches'); location.hash = '#/drill/' + d.id; }
  });
}

// "Save to" for a drill sketch: into the drills, or straight into a session.
export function saveDrillSketch(d) {
  const T = S.team().id; const td = today();
  const ss = S.sessions(T).filter(s => !s.date || s.date >= td).reverse();
  const el = sheet(`<div class="stack" id="saveTo"><div class="h2">Save this sketch</div>
    <label class="field"><span>Name</span><input type="text" id="svN" value="${esc(/^Sketch \d+$/.test(d.name) ? '' : d.name)}" placeholder="e.g. 6v4 break the first line"></label>
    <div class="list">
      <button class="item" data-to="drills"><span class="badge-num" style="background:var(--surface2);color:var(--text2)">${icon('training', 'style="width:20px;height:20px"')}</span><span class="grow"><span class="t" style="display:block">My drills</span><span class="s">Keep it as one of your drills</span></span></button>
    </div>
    <div class="eyebrow">Or into a session coming up</div>
    ${ss.length ? `<div class="list">${ss.map(s => `<button class="item" data-s="${s.id}"><span class="grow"><span class="t" style="display:block">${esc(s.theme || 'Session, no theme yet')}</span><span class="s">${fmtD(s.date)}</span></span></button>`).join('')}</div>` : '<div class="small muted">No sessions coming up.</div>'}
    <button class="btn" id="svX">Cancel</button></div>`);
  const keep = () => { delete d.sketch; const n = el.querySelector('#svN').value.trim(); if (n) d.name = n; else if (/^Sketch \d+$/.test(d.name)) d.name = 'New drill'; S.put(d); };
  el.querySelector('#svX').onclick = closeSheet;
  el.querySelector('[data-to="drills"]').onclick = () => { keep(); closeSheet(); toast('Saved in your drills'); window.dispatchEvent(new HashChangeEvent('hashchange')); };
  el.querySelectorAll('[data-s]').forEach(x => x.onclick = () => {
    keep(); const s = S.get(x.dataset.s); (s.blocks ||= []).push({ id: uid(), drillId: d.id, minutes: +d.minutes || 15, talk: 3, note: '' }); S.put(s);
    closeSheet(); toast('Saved and added to the session'); location.hash = '#/session/' + s.id;
  });
}
