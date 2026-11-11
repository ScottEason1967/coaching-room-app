// Tactics board: free movement, frames you can play through, arrows, opposition, set pieces.
import * as S from '../store.js';
import { PHASES } from '../store.js';
import { esc, icon, uid, clone, actions, sheet, closeSheet, confirmSheet, toast, debounce, shareFile, fmtAgo } from '../util.js';
import { Canvas, FORMATIONS, OPP_SHAPES, BOARD_SC, boardItem, pitchFull, frameSvg, boardViewBox, ARROWS, svgToPng } from '../pitch.js';
import { printBoard } from '../print.js';
import { testSheet } from './test.js';
import { shareSheet } from './sharing.js';
import { saveBoardSketch } from './sketch.js';

// On a phone the pitch takes every touch, so it is kept short enough to leave room to scroll.
const PHONE = () => matchMedia('(max-width:899px)').matches;
export const BOARD_TYPES = { shape: 'Shape', phase: 'Phase of play', setpiece: 'Set piece' };
export const BOARD_LABEL = t => ({ ...BOARD_TYPES, sketch: 'Sketch' })[t] || 'Board';
const SIMILAR = { GK: ['GK'], RB: ['RB', 'FB', 'RWB'], LB: ['LB', 'FB', 'LWB'], CB: ['CB'], '6': ['6', 'DM', 'CM'], '8': ['8', 'CM', '10'], RW: ['RW', 'W', 'RM'], LW: ['LW', 'W', 'LM'], CF: ['CF', 'ST', '9'], ST: ['ST', 'CF'], CM: ['CM', '8', '6'], DM: ['DM', '6', 'CM'], RM: ['RM', 'RW', 'W'], LM: ['LM', 'LW', 'W'], '10': ['10', '8', 'CM'], RAM: ['RW', '10', 'W'], LAM: ['LW', '10', 'W'], RWB: ['RB', 'RWB', 'FB'], LWB: ['LB', 'LWB', 'FB'] };

// Best guess at an XI for a formation from player positions. Joe can swap anyone.
export function autoXI(T, formation, prefer) {
  const ps = prefer && prefer.length ? prefer.map(S.get).filter(Boolean) : S.players(T);
  const pool = ps.slice(); const used = new Set();
  const f = FORMATIONS[formation] || FORMATIONS['4-3-3 (6 + two 8s)'];
  const pick = role => {
    for (const pos of (SIMILAR[role] || [role])) { const p = pool.find(x => !used.has(x.id) && (x.pos === pos || x.pos2 === pos)); if (p) return p; }
    return pool.find(x => !used.has(x.id) && (role === 'GK' ? true : x.pos !== 'GK'));
  };
  return f.map(([role, x, y], i) => { const p = pick(role); if (p) used.add(p.id); return { id: 'u' + i, kind: 'us', pid: p ? p.id : null, role, x, y }; });
}

// Eleven opponents in a shape, attacking down the screen. Positions (CB, ST…) on them unless asked for numbers.
const OPP_NAME = f => f.replace(' (6 + two 8s)', '').replace(' (block)', ' low block');
export function oppItems(shape, positions = true) {
  const c = OPP_SHAPES[shape] || FORMATIONS[shape] || OPP_SHAPES[OPP_NAME(shape)] || [];
  return c.map((p, i) => ({ id: 'o' + i, kind: 'opp', label: positions ? p[0] : String(i + 1), x: 68 - p[1], y: 105 - p[2] }));
}
const oppOptions = sel => Object.keys(OPP_SHAPES).map(f => `<option value="${esc(f)}" ${f === sel ? 'selected' : ''}>${esc(f)}</option>`).join('');

export function newBoardFrame(T, formation, withOpp) {
  const items = autoXI(T, formation).concat([{ id: 'b', kind: 'ball', x: 34, y: 96 }]);
  if (withOpp) items.push(...oppItems(withOpp));
  return { id: uid(), name: 'Frame 1', phase: '', notes: '', items, arrows: [], oppShape: withOpp || '' };
}

export function newBoardSheet(T, onMade) {
  const t = S.get(T);
  const el = sheet(`<div class="stack"><div class="h2">New board</div>
    <label class="field"><span>Name</span><input type="text" id="nbN" placeholder="e.g. Corner for: inswinger" autofocus></label>
    <div class="field"><span>Type</span><div class="seg" id="nbT">${Object.entries(BOARD_TYPES).map(([k, l], i) => `<button data-v="${k}" class="${i ? '' : 'on'}">${l}</button>`).join('')}</div></div>
    <label class="field"><span>Our shape</span><select id="nbF">${Object.keys(FORMATIONS).map(f => `<option ${f === t.formation ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select></label>
    <label class="field"><span>Opposition</span><select id="nbO"><option value="">None for now</option>${oppOptions('')}</select></label>
    <div class="row" style="justify-content:flex-end"><button class="btn" id="nbC">Cancel</button><button class="btn pri" id="nbM">Create</button></div></div>`);
  let type = 'shape';
  el.querySelectorAll('#nbT button').forEach(b => b.onclick = () => { type = b.dataset.v; el.querySelectorAll('#nbT button').forEach(x => x.classList.toggle('on', x === b)); });
  el.querySelector('#nbC').onclick = closeSheet;
  el.querySelector('#nbM').onclick = () => {
    const b = S.create('board', T, { name: el.querySelector('#nbN').value.trim() || BOARD_TYPES[type], type, sharePlayers: type === 'setpiece', frames: [newBoardFrame(T, el.querySelector('#nbF').value, el.querySelector('#nbO').value)] });
    closeSheet(); onMade ? onMade(b) : (location.hash = '#/board/' + b.id);
  };
}

export function boardList(el, params, ctx) {
  const T = S.team().id; ctx.setTop({});
  const bs = S.boards(T); const pm = S.playerMap(T);
  el.innerHTML = `<div class="stack"><div class="row between"><div><div class="h1">Tactics board</div><div class="small muted" style="margin-top:4px">Shapes, phases and set pieces for ${esc(S.team().name)}</div></div><button class="btn pri" data-act="new">${icon('plus')}New board</button></div>
    ${bs.length ? `<div class="grid3">${bs.map(b => `<a class="card link stack tight" href="#/board/${b.id}" style="text-decoration:none;display:flex">${frameSvg(b.frames[0] || { items: [], arrows: [] }, pm, { orient: 'h', style: 'width:100%;height:auto;border-radius:12px' })}
      <div class="row between nowrap"><span class="h3">${esc(b.name)}</span><span class="pill ${b.type === 'setpiece' ? 'lamp' : 'grey'}">${BOARD_LABEL(b.type)}</span></div><span class="tiny muted">${b.frames.length} frame${b.frames.length === 1 ? '' : 's'} · edited ${fmtAgo(b.upd)}${b.sharePlayers ? ' · on player pages' : ''}</span></a>`).join('')}</div>`
    : `<div class="empty">No boards yet. Start with your base shape, then add frames for build-up, pressing and set pieces.</div>`}</div>`;
  actions(el, { new: () => newBoardSheet(T) });
}

const TOOLS = [['select', 'Move', 'hand'], ['arrow:pass', 'Pass'], ['arrow:run', 'Run'], ['arrow:dribble', 'Dribble'], ['arrow:press', 'Press'], ['add:opp', 'Opponent'], ['add:ball', 'Ball'], ['add:text', 'Label'], ['add:cone', 'Cone'], ['add:mannequin', 'Mannequin']];
const toolIcon = (k) => {
  if (k.startsWith('arrow:')) { const a = ARROWS[k.slice(6)]; return `<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="4" y1="18" x2="18" y2="6" stroke="${a.c}" stroke-width="2.4" stroke-dasharray="${a.d ? a.d.split(' ').map(n => n * 3).join(' ') : ''}" stroke-linecap="round"/><path d="M18 6l-6 1 5 5z" fill="${a.c}"/></svg>`; }
  if (k === 'add:opp') return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="#D63B3B" stroke="#fff" stroke-width="1.5"/></svg>';
  if (k === 'add:ball') return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7" fill="#fff" stroke="#111" stroke-width="1.5"/><circle cx="12" cy="12" r="2.4" fill="#111"/></svg>';
  if (k === 'add:text') return '<svg viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="17" text-anchor="middle" font-size="15" font-weight="700" fill="currentColor">Aa</text></svg>';
  if (k === 'add:cone') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l6 14H6z" fill="#FF7A00"/><rect x="4" y="18" width="16" height="2.5" fill="#FF7A00"/></svg>';
  if (k === 'add:mannequin') return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="9" width="16" height="6" rx="3" fill="#444"/><circle cx="12" cy="12" r="3.5" fill="#777" stroke="#fff"/></svg>';
  return icon('hand');
};

export default function boardView(el, [id], ctx) {
  const b = S.get(id);
  if (!b) { ctx.setTop({ back: '#/sketch', title: 'Board' }); el.innerHTML = '<div class="empty">This board has been deleted.</div>'; return; }
  const T = b.team;
  let fi = Math.min(+(S.meta()['frame:' + id] || 0), b.frames.length - 1); if (fi < 0) fi = 0;
  if (!b.frames.length) b.frames.push(newBoardFrame(T, S.get(T).formation));
  const fr = () => b.frames[fi];
  const autoOrient = () => (innerWidth >= 700 && innerWidth > innerHeight) ? 'h' : 'v';
  let orient = S.meta().boardOrient || 'auto';
  const O = () => orient === 'auto' ? autoOrient() : orient;
  let playing = false; const undo = []; let snap = JSON.stringify(fr());
  const save = debounce(() => S.put(b), 300);
  ctx.setTop({ back: '#/sketch', title: b.name, sub: BOARD_LABEL(b.type) + ' · ' + b.frames.length + ' frame' + (b.frames.length === 1 ? '' : 's') });

  const sketchBar = b.type === 'sketch' ? `<div class="card row nowrap" id="sketchBar" style="gap:10px;flex-wrap:wrap;border-color:var(--accent-line)"><span class="grow small" style="min-width:200px">A sketch: play about freely. When it’s worth keeping, <b>Save to</b> a set piece, a principle, a match plan or a drill.</span><button class="btn sm" data-act="delSketch">Delete</button><button class="btn sm pri" data-act="saveTo" id="saveToBtn">Save to…</button></div>` : '';
  el.innerHTML = `<div class="stack">${sketchBar}
    <div class="toolrail" role="toolbar" aria-label="Board tools">${TOOLS.map(([k, l]) => `<button class="tool" data-tool="${k}">${toolIcon(k)}<span>${l}</span></button>`).join('')}</div>
    <div class="split wide-right" style="align-items:start">
      <div class="stack tight">
        <label class="row nowrap" style="gap:10px;align-items:center" id="oppRow"><span class="small" style="white-space:nowrap;font-weight:600">Opposition</span>
          <select id="oppSel" style="flex:1;min-width:0"></select></label>
        <div class="pitchwrap" style="display:flex;justify-content:center;background:transparent"><svg class="pitch" id="pitch" role="img" aria-label="Tactics board"></svg></div>
        <div class="row" style="gap:8px">
          <button class="btn sm" data-act="undo" id="undoB" disabled>${icon('rotate', 'style="transform:scaleX(-1)"')}Undo</button>
          <button class="btn sm pri" data-act="test" id="testB">${icon('analysis')}Test it</button>
          <button class="btn sm" data-act="play">${icon('play')}Play</button>
          <button class="btn sm" data-act="orient">${icon('rotate')}<span id="oLab"></span></button>
          <button class="btn sm" data-act="shape">${icon('squad')}Shapes</button>
          <button class="btn sm" data-act="frameMenu">${icon('dup')}Frame</button>
          <button class="btn sm" data-act="zoom" id="zoomB">Zoom</button><span id="panB" class="row" style="gap:4px;display:none"><button class="btn icon sm" data-act="pan" data-arg="-1,0" aria-label="Left">◀</button><button class="btn icon sm" data-act="pan" data-arg="0,-1" aria-label="Up">▲</button><button class="btn icon sm" data-act="pan" data-arg="0,1" aria-label="Down">▼</button><button class="btn icon sm" data-act="pan" data-arg="1,0" aria-label="Right">▶</button></span>
          <div class="grow"></div>
          <button class="btn sm" data-act="png">${icon('image')}Image</button>
          <button class="btn sm" data-act="print">${icon('print')}Print</button>
          <button class="btn sm" data-act="share">${icon('share')}Link</button>
        </div>
        <div class="frames" id="frames"></div>
      </div>
      <div class="stack">
        <div class="card stack tight" id="insp"></div>
        <div class="card stack tight">
          <div class="h3">This frame</div>
          <label class="field"><span>Name</span><input type="text" id="fN"></label>
          <label class="field"><span>Phase</span><select id="fP"><option value="">Not set</option>${Object.entries(PHASES).map(([k, p]) => `<option value="${k}">${p.lab}</option>`).join('')}</select></label>
          <label class="field"><span>Coaching notes for this moment</span><textarea id="fT" placeholder="What should players see and do here?"></textarea></label>
        </div>
        <details class="card"><summary class="h3" style="cursor:pointer">Board settings</summary><div class="stack tight" style="margin-top:10px">
          <label class="field"><span>Board name</span><input type="text" id="bN" value="${esc(b.name)}"></label>
          <label class="field"><span>Type</span><select id="bT">${Object.entries(BOARD_TYPES).map(([k, l]) => `<option value="${k}" ${k === b.type ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="check"><input type="checkbox" id="bSP" ${b.sharePlayers ? 'checked' : ''}> Show on player pages (set pieces)</label>
          <div class="tiny muted">Every frame’s coaching notes go on the player pages with it, and every player on the board is named. Write those notes for the players, not about them.</div>
          <div class="row"><button class="btn sm" data-act="dupBoard">${icon('dup')}Duplicate board</button><button class="btn sm danger" data-act="delBoard">${icon('trash')}Delete board</button></div>
        </div></details>
      </div>
    </div></div>`;

  const svg = el.querySelector('#pitch');
  const sizePitch = () => {
    const h = O() === 'h';
    svg.style.aspectRatio = h ? '113/74' : '74/113';
    svg.style.width = `min(100%, calc((100dvh - ${PHONE() ? 430 : 200}px) * ${h ? '113/74' : '74/113'}))`;
    el.querySelector('#oLab').textContent = h ? 'Upright' : 'Sideways';
  };
  let pm = S.playerMap(T);
  const cv = new Canvas(svg, {
    model: () => fr(), size: () => [68, 105], bg: pitchFull, scale: () => BOARD_SC,
    viewBox: () => boardViewBox(O()), orient: O,
    drawItem: (it, sc) => boardItem(it, sc, pm),
    newItem: (kind, x, y) => {
      const it = { id: uid(), kind, x, y };
      if (kind === 'opp') it.label = String(fr().items.filter(i => i.kind === 'opp').length + 1);
      if (kind === 'text') it.label = 'Label';
      if (kind === 'ball') { fr().items = fr().items.filter(i => i.kind !== 'ball'); it.id = 'b'; }
      if (kind === 'opp' || kind === 'text' || kind === 'ball') setTimeout(() => setTool('select'), 0);
      return it;
    },
    changed: () => { undo.push(snap); if (undo.length > 40) undo.shift(); snap = JSON.stringify(fr()); el.querySelector('#undoB').disabled = false; save(); renderFrames(); },
    onSelect: () => renderInsp(),
    locked: () => playing
  });
  const setTool = k => { cv.mode = k; el.querySelectorAll('[data-tool]').forEach(x => x.classList.toggle('on', x.dataset.tool === k)); };
  el.querySelectorAll('[data-tool]').forEach(x => x.onclick = () => setTool(x.dataset.tool));
  setTool('select');

  function renderFrames() {
    el.querySelector('#frames').innerHTML = b.frames.map((f, i) => `<button class="frame ${i === fi ? 'on' : ''}" data-f="${i}">${frameSvg(f, pm, { orient: 'h' })}<span>${i + 1}. ${esc(f.name || 'Frame')}</span></button>`).join('')
      + `<button class="frame" data-act="addFrame" style="align-items:center;justify-content:center;min-height:120px">${icon('plus', 'style="width:22px;height:22px"')}<span>Next frame</span></button>`;
    el.querySelectorAll('[data-f]').forEach(x => x.onclick = () => selectFrame(+x.dataset.f));
    oppDropdown();
  }
  // Opponents belong to the whole board: putting a shape on, changing it or taking them off applies to every
  // frame. If they have been moved by hand on any frame, that work would be lost, so ask first.
  function oppMoved() {
    return b.frames.some(f => {
      const o = f.items.filter(i => i.kind === 'opp'); if (!o.length) return false;
      if (!OPP_SHAPES[f.oppShape]) return true;
      const ref = oppItems(f.oppShape);
      return o.length !== ref.length || o.some(i => { const r = ref.find(x => x.id === i.id); return !r || Math.abs(r.x - i.x) > .5 || Math.abs(r.y - i.y) > .5; });
    });
  }
  async function setOppAll(v, positions = true) {
    const had = b.frames.some(f => f.items.some(i => i.kind === 'opp'));
    if (had && oppMoved() && !await confirmSheet(v ? 'Reset the opponents on every frame?' : 'Take the opponents off every frame?',
      `You have moved opponents on ${b.frames.length > 1 ? 'some frames' : 'this board'}. ${v ? 'They will all go back into a ' + v + ' on every frame.' : 'Those moves will be lost.'}`, v ? 'Reset them' : 'Take them off')) { oppDropdown(); return false; }
    b.frames.forEach(f => { f.items = f.items.filter(i => i.kind !== 'opp').concat(v ? oppItems(v, positions) : []); f.oppShape = v; });
    cv.o.changed(); cv.render(); oppDropdown(); renderFrames();
    toast(v ? `Opponents in a ${v} on every frame` : 'Opponents taken off every frame');
    return true;
  }
  // Opposition dropdown on the board: pick a shape and all eleven go on every frame; pick None to take them off.
  function oppDropdown() {
    const sel = el.querySelector('#oppSel'); if (!sel) return;
    const f = fr(), on = f.items.some(i => i.kind === 'opp');
    const cur = on ? (f.oppShape && OPP_SHAPES[f.oppShape] ? f.oppShape : '_custom') : '';
    sel.innerHTML = `<option value="">None</option>${cur === '_custom' ? '<option value="_custom" selected>On the board (placed by hand)</option>' : ''}${oppOptions(cur)}`;
    sel.value = cur;
    sel.onchange = () => { const v = sel.value; if (v === '_custom') return; setOppAll(v); };
  }

  function frameFields() {
    const f = fr(); const n = el.querySelector('#fN'), p = el.querySelector('#fP'), t = el.querySelector('#fT');
    n.value = f.name || ''; p.value = f.phase || ''; t.value = f.notes || '';
  }
  el.querySelector('#fN').oninput = e => { fr().name = e.target.value; save(); renderFramesSoon(); };
  el.querySelector('#fP').onchange = e => { fr().phase = e.target.value; save(); };
  el.querySelector('#fT').oninput = e => { fr().notes = e.target.value; save(); };
  const renderFramesSoon = debounce(renderFrames, 300);
  el.querySelector('#bN').oninput = e => { b.name = e.target.value; save(); };
  el.querySelector('#bT').onchange = e => { b.type = e.target.value; save(); };
  el.querySelector('#bSP').onchange = e => { b.sharePlayers = e.target.checked; save(); };

  function selectFrame(i) {
    fi = i; S.setMeta('frame:' + id, i); cv.sel = null; undo.length = 0; snap = JSON.stringify(fr());
    el.querySelector('#undoB').disabled = true; cv.render(); renderFrames(); frameFields(); renderInsp();
  }

  // A locked arrow is copied, same id, onto every later frame, so it stays put from frame to frame
  // and play-through keeps it on screen. Unlocking takes the copies off the later frames.
  function setKeep(a, on) {
    b.frames.forEach((f2, j) => {
      if (j < fi) return;
      const k = f2.arrows.findIndex(x => x.id === a.id);
      if (j === fi) { if (k >= 0) f2.arrows[k].keep = on; return; }
      if (on && k < 0) f2.arrows.push({ ...clone(a), keep: true });
      else if (on) f2.arrows[k].keep = true;
      else if (k >= 0) f2.arrows.splice(k, 1);
    });
    a.keep = on;
  }
  function renderInsp() {
    const box = el.querySelector('#insp'); const it = cv.selected(); const f = fr();
    const onPitch = new Set(f.items.filter(i => i.kind === 'us').map(i => i.pid));
    const bench = S.players(T).filter(p => !onPitch.has(p.id));
    const benchHtml = `<div class="eyebrow" style="margin-top:4px">Not on the pitch · tap to bring on</div>${bench.length ? `<div class="chips">${bench.map(p => `<button class="chip" data-bench="${p.id}"><b>${esc(p.num)}</b> ${esc(p.short || p.name)}</button>`).join('')}</div>` : '<div class="small muted">Everyone is on.</div>'}`;
    if (!it) { box.innerHTML = `<div class="small muted">Tap a player, arrow or label to change it. Drag to move. Pick an arrow tool and drag on the pitch to draw.</div>${benchHtml}`; }
    else if (cv.selT === 'a') {
      const later = b.frames.length - 1 - fi;
      box.innerHTML = `<div class="h3">Arrow</div><div class="seg">${Object.entries(ARROWS).map(([k, a]) => `<button data-st="${k}" class="${it.style === k ? 'on' : ''}">${a.lab}</button>`).join('')}</div>
        <label class="check" id="keepArrow"><input type="checkbox" id="keepA" ${it.keep ? 'checked' : ''}> ${icon('lock', 'style="width:16px;height:16px"')} Keep on the next frames</label>
        <p class="tiny muted" style="margin:0">${it.keep ? `Locked: it stays in place on ${later ? 'the ' + (later === 1 ? 'next frame' : 'next ' + later + ' frames') + ' and on' : ''} any frame you add after this one, and doesn’t flash off when you play it through.` : 'Tick to keep this arrow in the same place on the frames after this one.'}</p>
        <button class="btn sm danger" data-act="rm">${icon('trash')}Remove arrow</button>`;
      box.querySelectorAll('[data-st]').forEach(x => x.onclick = () => { it.style = x.dataset.st; cv.o.changed(); cv.render(); renderInsp(); });
      box.querySelector('#keepA').onchange = e => { setKeep(it, e.target.checked); cv.o.changed(); cv.render(); renderFrames(); renderInsp(); };
    } else if (it.kind === 'us') {
      const p = S.get(it.pid);
      box.innerHTML = `<div class="row nowrap"><span class="badge-num">${esc(p ? p.num : '?')}</span><div class="grow"><div class="h3">${esc(p ? p.name : 'Unassigned')}</div><div class="tiny muted">${esc(p ? p.pos : it.role || '')}</div></div></div>
        <label class="field"><span>Swap for</span><select id="swap"><option value="">Choose a player</option>${S.players(T).filter(x => x.id !== it.pid).map(x => `<option value="${x.id}">${esc(x.num)} · ${esc(x.name)}${x.pos ? ` (${esc(x.pos)})` : ''}${onPitch.has(x.id) ? ' · on pitch' : ''}</option>`).join('')}</select></label>
        <p class="tiny muted" style="margin:0">Swapping changes every frame of this board. If she’s already on, the two swap places.</p>
        <button class="btn sm" data-act="rm">${icon('x')}Take off the pitch</button>${benchHtml}`;
      box.querySelector('#swap').onchange = e => {
        const nid = e.target.value; if (!nid) return; const oid = it.pid;
        // The same person in every frame: a board shows one team moving, so a swap applies to all of it.
        b.frames.forEach(f2 => f2.items.forEach(x => { if (x.kind !== 'us') return; if (x.id === it.id || (oid && x.pid === oid)) x.pid = nid; else if (x.pid === nid) x.pid = oid; }));
        cv.o.changed(); cv.render(); renderInsp();
      };
    } else if (it.kind === 'opp' || it.kind === 'text') {
      box.innerHTML = `<div class="h3">${it.kind === 'opp' ? 'Opponent' : 'Label'}</div><label class="field"><span>${it.kind === 'opp' ? 'Number or role' : 'Text'}</span><input type="text" id="lab" value="${esc(it.label || '')}" maxlength="${it.kind === 'opp' ? 4 : 30}"></label><button class="btn sm danger" data-act="rm">${icon('trash')}Remove</button>`;
      const inp = box.querySelector('#lab'); inp.oninput = () => { it.label = inp.value; cv.render(); save(); };
      inp.onchange = () => cv.o.changed();
    } else {
      box.innerHTML = `<div class="h3">${esc(it.kind === 'ball' ? 'Ball' : it.kind[0].toUpperCase() + it.kind.slice(1))}</div><div class="small muted">Drag to move.</div><button class="btn sm danger" data-act="rm">${icon('trash')}Remove</button>`;
    }
    box.querySelectorAll('[data-bench]').forEach(x => x.onclick = () => {
      const f2 = fr(); const n = f2.items.filter(i => i.kind === 'us').length;
      if (n >= 11 && !confirm('There are already 11 on the pitch. Add another anyway?')) return;
      f2.items.push({ id: uid(), kind: 'us', pid: x.dataset.bench, x: 34 + (Math.random() * 10 - 5), y: 60 });
      cv.o.changed(); cv.render(); renderInsp();
    });
  }

  function play() {
    if (playing || b.frames.length < 2) { if (b.frames.length < 2) toast('Add a second frame to play it through'); return; }
    playing = true; let i = 0; const dur = 1100;
    // On a phone, bring the whole pitch into the middle of the screen before it plays.
    if (PHONE()) svg.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const step = () => {
      if (i >= b.frames.length - 1) { playing = false; selectFrame(b.frames.length - 1); return; }
      const A = b.frames[i], B = b.frames[i + 1]; const t0 = performance.now();
      const tick = now => {
        const t = Math.min(1, (now - t0) / dur), e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const items = B.items.map(bi => { const ai = A.items.find(x => x.id === bi.id); return ai ? { ...bi, x: ai.x + (bi.x - ai.x) * e, y: ai.y + (bi.y - ai.y) * e } : bi; });
        // Arrows on both frames (locked ones) stay on screen; the rest swap over near the end.
        const both = new Set(A.arrows.filter(a => B.arrows.some(x => x.id === a.id)).map(a => a.id));
        cv.render({ items, arrows: t > .85 ? B.arrows : A.arrows.filter(a => both.has(a.id)) });
        if (t < 1) requestAnimationFrame(tick); else { i++; fi = i; renderFrames(); setTimeout(step, 600); }
      };
      requestAnimationFrame(tick);
    };
    fi = 0; cv.sel = null; cv.render(b.frames[0]); renderFrames(); setTimeout(step, 500);
  }

  actions(el, {
    saveTo: () => { save.flush(); saveBoardSketch(b, fi); },
    delSketch: async () => { if (await confirmSheet('Delete this sketch?', '')) { S.del(b.id); location.hash = '#/sketch'; } },
    undo: () => { if (!undo.length) return; const prev = JSON.parse(undo.pop()); const f = fr(); f.items = prev.items; f.arrows = prev.arrows; snap = JSON.stringify(f); cv.sel = null; save(); cv.render(); renderFrames(); renderInsp(); el.querySelector('#undoB').disabled = !undo.length; },
    play,
    orient: () => { orient = O() === 'h' ? 'v' : 'h'; S.setMeta('boardOrient', orient); sizePitch(); cv.render(); },
    zoom: () => { cv.setZoom(!cv.zoom); el.querySelector('#zoomB').classList.toggle('on', cv.zoom); el.querySelector('#panB').style.display = cv.zoom ? 'inline-flex' : 'none'; },
    pan: a => { const [x, y] = a.split(',').map(Number); cv.pan(x * .4, y * .4); },
    rm: () => cv.remove(),
    addFrame: () => {
      const f = clone(fr()); f.id = uid(); f.name = 'Frame ' + (b.frames.length + 1); f.notes = ''; f.arrows = f.arrows.filter(a => a.keep);
      b.frames.splice(fi + 1, 0, f); S.put(b); selectFrame(fi + 1); toast('New frame: move players to show what happens next');
    },
    shape: () => shapeSheet(),
    frameMenu: () => frameMenu(),
    png: async () => { if (cv.zoom) { cv.setZoom(false); el.querySelector('#zoomB').classList.remove('on'); el.querySelector('#panB').style.display = 'none'; } try { const blob = await svgToPng(svg); await shareFile(blob, (b.name + ' - ' + (fr().name || 'frame')).replace(/[^\w\- ]+/g, '') + '.png', b.name); } catch (e) { toast('Could not make the image on this device'); } },
    print: () => printBoard(b),
    test: () => { save.flush(); testSheet(b); },
    share: () => shareSheet('board', b),
    dupBoard: () => { const c = clone(b); c.id = uid(); c.name = b.name + ' (copy)'; delete c.share; S.put(c); location.hash = '#/board/' + c.id; },
    delBoard: async () => { if (await confirmSheet('Delete this board?', 'Match plans that use it will lose it.')) { S.del(b.id); location.hash = '#/sketch'; } }
  });

  function frameMenu() {
    const s = sheet(`<div class="stack"><div class="h2">Frame ${fi + 1} of ${b.frames.length}</div>
      <button class="btn block" id="fmDup">${icon('dup')}Duplicate this frame</button>
      <button class="btn block" id="fmL" ${fi ? '' : 'disabled'}>Move earlier</button>
      <button class="btn block" id="fmR" ${fi < b.frames.length - 1 ? '' : 'disabled'}>Move later</button>
      <button class="btn block" id="fmKeepA">${icon('lock')}Keep all this frame’s arrows on the next frames</button>
      <button class="btn block" id="fmClrA">Clear arrows in this frame</button>
      <button class="btn block danger" id="fmDel" ${b.frames.length > 1 ? '' : 'disabled'}>${icon('trash')}Delete this frame</button>
      <button class="btn block" id="fmX">Close</button></div>`);
    const done = i => { S.put(b); closeSheet(); selectFrame(i); };
    s.querySelector('#fmDup').onclick = () => { const f = clone(fr()); f.id = uid(); f.name = (fr().name || 'Frame') + ' (copy)'; b.frames.splice(fi + 1, 0, f); done(fi + 1); };
    s.querySelector('#fmL').onclick = () => { const f = b.frames.splice(fi, 1)[0]; b.frames.splice(fi - 1, 0, f); done(fi - 1); };
    s.querySelector('#fmR').onclick = () => { const f = b.frames.splice(fi, 1)[0]; b.frames.splice(fi + 1, 0, f); done(fi + 1); };
    s.querySelector('#fmClrA').onclick = () => { fr().arrows = []; done(fi); };
    s.querySelector('#fmKeepA').onclick = () => { fr().arrows.forEach(a => setKeep(a, true)); done(fi); toast('Arrows locked: they stay in place on the next frames'); };
    s.querySelector('#fmDel').onclick = () => { b.frames.splice(fi, 1); done(Math.max(0, fi - 1)); };
    s.querySelector('#fmX').onclick = closeSheet;
  }

  function shapeSheet() {
    const t = S.get(T);
    const chip = (attr, f, on) => `<button class="btn sm ${on ? 'on' : ''}" ${attr}="${esc(f)}" style="min-width:76px">${esc(f.replace(' (6 + two 8s)', '').replace(' (block)', ' block'))}</button>`;
    const hasOpp = fr().items.some(i => i.kind === 'opp');
    const s = sheet(`<div class="stack"><div class="h2">Shapes</div>
      <div class="stack tight"><div class="label">Opponents: one tap puts all eleven on every frame</div>
        <div class="row" style="gap:8px;flex-wrap:wrap" id="oppShapes">${Object.keys(OPP_SHAPES).map(f => chip('data-opp', f, false)).join('')}</div>
        <div class="row" style="gap:8px"><label class="check small"><input type="checkbox" id="sOpos" checked> Show positions (CB, ST…) on them</label></div>
        ${hasOpp ? '<button class="btn sm danger" id="sOclr" style="align-self:flex-start">Take the opponents off</button>' : ''}</div>
      <div class="stack tight" style="border-top:1px solid var(--line);padding-top:12px"><div class="label">Our team</div>
        <div class="row" style="gap:8px;flex-wrap:wrap" id="usShapes">${Object.keys(FORMATIONS).map(f => chip('data-us', f, f === t.formation)).join('')}</div>
        <p class="tiny muted" style="margin:0">Keeps the same players on the pitch where it can and moves them into position. Arrows and the ball stay.</p></div>
      <p class="tiny muted" style="margin:0">Opponents go on every frame. Our team’s shape changes this frame only. Put the shapes on first, then use <b>Next frame</b> to show the movement.</p>
      <button class="btn" id="sX">Close</button></div>`);
    s.querySelectorAll('[data-us]').forEach(btn => btn.onclick = () => {
      const f = fr(); const cur = f.items.filter(i => i.kind === 'us').map(i => i.pid).filter(Boolean);
      const xi = autoXI(T, btn.dataset.us, cur.length >= 11 ? cur : null);
      f.items = f.items.filter(i => i.kind !== 'us').concat(xi); cv.o.changed(); cv.render(); closeSheet(); renderInsp();
    });
    s.querySelectorAll('[data-opp]').forEach(btn => btn.onclick = () => { const pos = s.querySelector('#sOpos').checked; closeSheet(); setOppAll(btn.dataset.opp, pos); });
    s.querySelector('#sOclr')?.addEventListener('click', () => { closeSheet(); setOppAll(''); });
    s.querySelector('#sX').onclick = closeSheet;
  }

  const onResize = debounce(() => { if (svg.isConnected && orient === 'auto') { sizePitch(); cv.render(); } }, 150);
  window.addEventListener('resize', onResize);
  sizePitch(); cv.render(); renderFrames(); frameFields(); renderInsp();
  return () => { save.flush(); window.removeEventListener('resize', onResize); };
}
