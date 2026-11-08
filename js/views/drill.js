// Drill designer: real kit on a real-sized area, objective, principle links per team, four corners, STEP.
import * as S from '../store.js';
import { PHASES, PHASE_KEYS, DRILL_TYPES, INTERVENTIONS, CORNERS, DIRECTION } from '../store.js';
import { esc, icon, uid, clone, bindFields, actions, debounce, confirmSheet, toast, sheet, closeSheet, shareFile, fmtD } from '../util.js';
import { Canvas, EQUIP, ARROWS, AREAS, CONE_COLOURS, areaBg, drillScale, svgToPng } from '../pitch.js';
import { drillChallenges, box, chalJump, paintChal } from '../challenges.js';
import { printDrill } from '../print.js';

const KIT = ['disc', 'cone', 'mannequin', 'pole', 'hurdle', 'ladder', 'minigoal', 'goal', 'ball', 'att', 'def', 'neu', 'gk', 'coach', 'zone', 'text'];
const ROTATABLE = ['mannequin', 'hurdle', 'ladder', 'minigoal', 'goal', 'zone'];
const kitIcon = k => {
  if (k.startsWith('arrow:')) { const a = ARROWS[k.slice(6)]; return `<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="4" y1="18" x2="18" y2="6" stroke="${a.c}" stroke-width="2.4" stroke-dasharray="${a.d ? a.d.split(' ').map(n => n * 3).join(' ') : ''}" stroke-linecap="round"/><path d="M18 6l-6 1 5 5z" fill="${a.c}"/></svg>`; }
  if (k === 'select') return icon('hand');
  if (k === 'goal') return '<svg viewBox="-12 -12 24 24" aria-hidden="true"><rect x="-10" y="-3.5" width="20" height="7" fill="rgba(255,255,255,.3)" stroke="#fff" stroke-width="1.4"/></svg>';
  if (k === 'minigoal') return '<svg viewBox="-12 -12 24 24" aria-hidden="true"><rect x="-6.5" y="-3" width="13" height="6" fill="rgba(255,255,255,.3)" stroke="#fff" stroke-width="1.4"/></svg>';
  return `<svg viewBox="-12 -12 24 24" aria-hidden="true">${EQUIP[k].draw({ kind: k, label: k === 'text' ? 'Aa' : '', zw: 20, zh: 13, color: k === 'disc' ? '#F2B705' : undefined }, k === 'ladder' ? 5.5 : k === 'pole' ? 16 : 10)}</svg>`;
};

export function newDrill(fields = {}) {
  return S.create('drill', null, { name: 'New drill', type: 'Skill (opposed)', area: 'box20', preset: 'box20', w: 20, h: 20, items: [], arrows: [], objective: '', links: {}, corners: {}, interventions: [], org: '', how: '', points: '', prog: '', reg: '', players: '', minutes: 15, ...fields });
}

export default function drillView(el, [id, fromSession], ctx) {
  const d = S.get(id);
  // Opened from a session plan (#/drill/<id>/<sessionId>): Back returns to that session, not the library.
  const back = fromSession && S.get(fromSession) ? '#/session/' + fromSession : '#/plans/drills';
  if (!d) { ctx.setTop({ back, title: 'Drill' }); el.innerHTML = '<div class="empty">This drill has been deleted.</div>'; return; }
  const t = S.team(); const T = t.id;
  d.links ||= {}; d.corners ||= {}; d.interventions ||= []; d.items ||= []; d.arrows ||= [];
  ctx.setTop({ back, title: d.name || 'Drill', sub: d.type });
  const save = debounce(() => S.put(d), 400);
  let colour = S.meta().coneColour || '#F2B705';
  const ps = S.principles(T); const linked = new Set(S.drillLinks(d, T));
  const usedIn = S.sessions(T).filter(s => (s.blocks || []).some(b => b.drillId === d.id));

  const cr = d.src && d.src.who ? `<div class="tiny muted" id="drillSrc">Based on a session by <b>${esc(d.src.who)}</b>${d.src.role ? ' (' + esc(d.src.role) + ')' : ''}${d.src.url ? ` · <a href="${esc(d.src.url)}" target="_blank" rel="noopener">see the original</a>` : ''}${d.src.note ? '. ' + esc(d.src.note) : ''}</div>` : '';
  el.innerHTML = `<div class="split wide-right"><div class="stack">${chalJump()}
    <div class="card stack tight">
      <label class="field"><span>Name</span><input type="text" data-f="name"></label>${cr}
      <div class="grid2">
        <label class="field"><span>Practice type</span><select data-f="type">${DRILL_TYPES.map(x => `<option ${x === d.type ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
        <label class="field"><span>Area</span><select id="area">${Object.entries(AREAS).map(([k, a]) => `<option value="${k}" ${k === (d.area || d.preset) ? 'selected' : ''}>${a[0]}</option>`).join('')}</select></label>
      </div>
      <div class="row" id="custom" style="${(d.area || d.preset) === 'custom' ? '' : 'display:none'}"><label class="field" style="width:110px"><span>Width (m)</span><input type="number" inputmode="decimal" id="cw" value="${d.w}" min="4" max="105"></label><label class="field" style="width:110px"><span>Length (m)</span><input type="number" inputmode="decimal" id="ch" value="${d.h}" min="4" max="105"></label></div>
      <div class="row"><label class="field" style="width:110px"><span>Players</span><input type="number" inputmode="numeric" data-f="players" min="1"></label><label class="field" style="width:110px"><span>Minutes</span><input type="number" inputmode="numeric" data-f="minutes" min="1"></label></div>
    </div>

    <div class="toolrail" role="toolbar" aria-label="Kit">${['select', ...KIT, 'arrow:pass', 'arrow:run', 'arrow:dribble', 'arrow:press'].map(k => `<button class="tool" data-tool="${k}">${kitIcon(k)}<span>${k === 'select' ? 'Move' : k.startsWith('arrow:') ? ARROWS[k.slice(6)].lab : EQUIP[k].lab}</span></button>`).join('')}</div>
    <div class="row" style="gap:5px"><span class="tiny muted">Colour</span>${CONE_COLOURS.map(c => `<button class="chip ${c === colour ? 'on' : ''}" data-col="${c}" aria-label="Colour" style="width:34px;min-height:34px;padding:0;justify-content:center"><span style="width:16px;height:16px;border-radius:50%;background:${c};border:1px solid rgba(0,0,0,.4)"></span></button>`).join('')}</div>
    <div class="pitchwrap" style="display:flex;justify-content:center;background:transparent"><svg class="pitch" id="dc" role="img" aria-label="Drill diagram"></svg></div>
    <div class="row" style="gap:8px"><button class="btn sm" data-act="undo" id="undoB" disabled>Undo</button><button class="btn sm" data-act="clearArrows">Clear arrows</button><button class="btn sm" data-act="zoom" id="zoomB">Zoom</button><span id="panB" class="row" style="gap:4px;display:none"><button class="btn icon sm" data-act="pan" data-arg="-1,0" aria-label="Left">◀</button><button class="btn icon sm" data-act="pan" data-arg="0,-1" aria-label="Up">▲</button><button class="btn icon sm" data-act="pan" data-arg="0,1" aria-label="Down">▼</button><button class="btn icon sm" data-act="pan" data-arg="1,0" aria-label="Right">▶</button></span><div class="grow"></div><button class="btn sm" data-act="png">${icon('image')}Image</button><button class="btn sm" data-act="print">${icon('print')}Print</button></div>
    <div class="card stack tight" id="insp"></div>

    <div class="card stack">
      <label class="field"><span>Objective: what will players be better at by the end?</span><textarea data-f="objective"></textarea></label>
      <div class="field" id="drillPrinciples"><span>Principles it serves for ${esc(t.name)}</span>
        ${ps.length ? PHASE_KEYS.filter(k => ps.some(p => p.phase === k)).map(k => `<div class="tiny muted" style="margin-top:4px">${PHASES[k].lab}</div><div class="chips">${ps.filter(p => p.phase === k).map(p => `<button class="chip ${linked.has(p.id) ? 'on' : ''}" data-act="link" data-arg="${p.id}">${esc(p.title || 'Untitled')}</button>`).join('')}</div>`).join('') : '<div class="small" style="color:var(--lamp)">No principles yet. <a href="#/model">Write your game model</a> first.</div>'}
        <div class="tiny muted">Links are per team. The same drill can serve different principles at another club.</div></div>
    </div>
    <div class="card stack">
      <label class="field"><span>Organisation: area, numbers, rotation</span><textarea data-f="org"></textarea></label>
      <label class="field"><span>How it works</span><textarea data-f="how"></textarea></label>
      <label class="field"><span>Coaching points: what you’ll look for, and say</span><textarea data-f="points"></textarea></label>
      <label class="field"><span>Success looks like <span class="muted">(something you can see or count)</span></span><input type="text" data-f="success" placeholder="e.g. 6 of 10 build-ups reach the 8 facing forward"></label>
      <div class="grid2"><label class="field"><span>Progress (harder)</span><textarea data-f="prog" placeholder="Space, task, equipment, players"></textarea></label><label class="field"><span>Regress (easier)</span><textarea data-f="reg" placeholder="Space, task, equipment, players"></textarea></label></div>
    </div>
    <div class="card stack"><div class="h3">Realism</div>
      <label class="field"><span>Direction</span><select data-f="direction"><option value="">Not set</option>${Object.entries(DIRECTION).map(([k, l]) => `<option value="${k}" ${d.direction === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="field"><span>Transition: what happens when the ball is won or lost</span><input type="text" data-f="transition" placeholder="e.g. Defenders who win it attack the two small goals; attackers have 6 seconds to win it back"></label>
    </div>
    <div class="card stack"><div class="h3">What you’ll say</div>
      <label class="field"><span>Planned questions <span class="muted">(two or three, one per line)</span></span><textarea data-f="questions" placeholder="Where is the space when their 9 steps in?&#10;What tells you to play forward rather than sideways?"></textarea></label>
      <label class="field"><span>I step in when…</span><input type="text" data-f="stepIn" placeholder="e.g. the 6 receives with her back to play twice in a row"></label>
    </div>
    <div class="card stack"><div class="h3">Four corners</div><p class="tiny muted" style="margin:0">Only fill the ones you’re developing on purpose, and say how.</p>
      ${Object.entries(CORNERS).map(([k, l]) => `<label class="field"><span>${l}</span><input type="text" data-f="corners.${k}"></label>`).join('')}</div>
    <div class="card stack tight" id="interventions"><div class="h3">How you plan to intervene</div><div class="chips">${Object.entries(INTERVENTIONS).map(([k, l]) => `<button class="chip ${d.interventions.includes(k) ? 'on' : ''}" data-act="iv" data-arg="${k}">${l}</button>`).join('')}</div></div>
    <div class="card small muted">${usedIn.length ? `Used in ${usedIn.length} session${usedIn.length > 1 ? 's' : ''}: ${usedIn.slice(0, 4).map(s => `<a href="#/session/${s.id}">${fmtD(s.date)}</a>`).join(', ')}` : 'Not used in a session yet.'}</div>
    <div class="row"><button class="btn" data-act="dup">${icon('dup')}Duplicate</button><div class="grow"></div><button class="btn danger" data-act="del">${icon('trash')}Delete drill</button></div>
  </div>
  <div><div id="chal" style="position:sticky;top:80px"></div></div></div>`;

  const chal = () => paintChal(el, drillChallenges(d, T), 'Drill check', '', { rec: d, save: () => S.put(d), repaint: () => chal() });
  bindFields(el, d, (p) => { save(); chal(); if (p === 'name') ctx.setTop({ back, title: d.name || 'Drill', sub: d.type }); });

  const svg = el.querySelector('#dc'); const undo = []; let snap = JSON.stringify({ items: d.items, arrows: d.arrows });
  const size = () => { svg.style.aspectRatio = `${d.w + 4}/${d.h + 4}`; svg.style.width = `min(100%, calc((100dvh - 220px) * ${(d.w + 4) / (d.h + 4)}))`; };
  const cv = new Canvas(svg, {
    model: () => d, size: () => [d.w, d.h], bg: () => areaBg(d.w, d.h, d.preset), scale: () => drillScale(d.w, d.h),
    viewBox: () => `-2 -2 ${d.w + 4} ${d.h + 4}`,
    drawItem: (it, sc) => (EQUIP[it.kind] || EQUIP.disc).draw(it, sc),
    newItem: (kind, x, y) => {
      const it = { id: uid(), kind, x, y, r: 0 };
      if (kind === 'disc' || kind === 'cone') it.color = colour;
      if (kind === 'zone') { it.zw = Math.round(d.w / 3); it.zh = Math.round(d.h / 4); }
      if (kind === 'text') { it.label = 'Label'; setTimeout(() => setTool('select'), 0); }
      if (['att', 'def', 'neu', 'gk'].includes(kind)) it.label = '';
      return it;
    },
    changed: () => { undo.push(snap); if (undo.length > 40) undo.shift(); snap = JSON.stringify({ items: d.items, arrows: d.arrows }); el.querySelector('#undoB').disabled = false; save(); chal(); },
    onSelect: () => insp()
  });
  const setTool = k => { cv.mode = KIT.includes(k) ? 'add:' + k : k; el.querySelectorAll('[data-tool]').forEach(x => x.classList.toggle('on', x.dataset.tool === k)); };
  el.querySelectorAll('[data-tool]').forEach(x => x.onclick = () => setTool(x.dataset.tool));
  el.querySelectorAll('[data-col]').forEach(x => x.onclick = () => { colour = x.dataset.col; S.setMeta('coneColour', colour); el.querySelectorAll('[data-col]').forEach(y => y.classList.toggle('on', y === x)); const it = cv.selected(); if (it && (it.kind === 'disc' || it.kind === 'cone')) { it.color = colour; cv.o.changed(); cv.render(); } });
  setTool('select');

  function insp() {
    const b = el.querySelector('#insp'); const it = cv.selected();
    if (!it) { b.innerHTML = `<div class="small muted">Pick kit from the bar and tap the area to place it. Choose Move to drag things around. Pick an arrow and drag to draw. Tap anything to edit it.</div>`; return; }
    if (cv.selT === 'a') {
      b.innerHTML = `<div class="h3">Arrow</div><div class="seg">${Object.entries(ARROWS).map(([k, a]) => `<button data-st="${k}" class="${it.style === k ? 'on' : ''}">${a.lab}</button>`).join('')}</div><button class="btn sm danger" data-x="rm">${icon('trash')}Remove</button>`;
      b.querySelectorAll('[data-st]').forEach(x => x.onclick = () => { it.style = x.dataset.st; cv.o.changed(); cv.render(); insp(); });
    } else {
      const lab = EQUIP[it.kind] ? EQUIP[it.kind].lab : it.kind;
      b.innerHTML = `<div class="h3">${esc(lab)}</div>
        ${EQUIP[it.kind] && EQUIP[it.kind].text ? `<label class="field"><span>${it.kind === 'text' ? 'Text' : 'Number or letter'}</span><input type="text" id="il" maxlength="${it.kind === 'text' ? 30 : 3}" value="${esc(it.label || '')}"></label>` : ''}
        ${ROTATABLE.includes(it.kind) ? `<div class="row"><span class="small muted">Turn</span><button class="btn sm" data-x="rotL">−45°</button><button class="btn sm" data-x="rotR">+45°</button></div>` : ''}
        ${it.kind === 'zone' ? `<div class="row"><label class="field" style="width:100px"><span>Width</span><input type="number" id="zw" value="${it.zw}"></label><label class="field" style="width:100px"><span>Length</span><input type="number" id="zh" value="${it.zh}"></label></div>` : ''}
        <div class="row"><button class="btn sm" data-x="copy">${icon('dup')}Copy</button><button class="btn sm danger" data-x="rm">${icon('trash')}Remove</button></div>`;
      const il = b.querySelector('#il'); if (il) { il.oninput = () => { it.label = il.value; cv.render(); save(); }; il.onchange = () => cv.o.changed(); }
      const zw = b.querySelector('#zw'), zh = b.querySelector('#zh');
      if (zw) { const z = () => { it.zw = Math.max(1, +zw.value || 1); it.zh = Math.max(1, +zh.value || 1); cv.render(); }; zw.oninput = z; zh.oninput = z; zw.onchange = zh.onchange = () => cv.o.changed(); }
    }
    b.querySelectorAll('[data-x]').forEach(x => x.onclick = () => {
      const k = x.dataset.x;
      if (k === 'rm') return cv.remove();
      if (k === 'rotL' || k === 'rotR') { it.r = ((it.r || 0) + (k === 'rotR' ? 45 : -45) + 360) % 360; }
      if (k === 'copy') { const c = clone(it); c.id = uid(); c.x = Math.min(d.w, it.x + 2); c.y = Math.min(d.h, it.y + 2); d.items.push(c); cv.sel = c.id; }
      cv.o.changed(); cv.render(); insp();
    });
  }

  const areaSel = el.querySelector('#area');
  areaSel.onchange = () => {
    const k = areaSel.value; const a = AREAS[k];
    d.area = k; d.preset = k; if (k !== 'custom') { d.w = a[1]; d.h = a[2]; }
    el.querySelector('#custom').style.display = k === 'custom' ? '' : 'none';
    el.querySelector('#cw').value = d.w; el.querySelector('#ch').value = d.h;
    d.items.forEach(i => { i.x = Math.min(i.x, d.w); i.y = Math.min(i.y, d.h); });
    S.put(d); size(); cv.render(); chal();
  };
  const cust = () => { d.w = Math.max(4, Math.min(105, +el.querySelector('#cw').value || 20)); d.h = Math.max(4, Math.min(105, +el.querySelector('#ch').value || 20)); save(); size(); cv.render(); chal(); };
  el.querySelector('#cw').onchange = cust; el.querySelector('#ch').onchange = cust;

  actions(el, {
    link: pid => { const cur = new Set(S.drillLinks(d, T)); cur.has(pid) ? cur.delete(pid) : cur.add(pid); d.links[T] = [...cur]; S.put(d); ctx.refresh(); },
    iv: k => { d.interventions = d.interventions.includes(k) ? d.interventions.filter(x => x !== k) : d.interventions.concat(k); S.put(d); ctx.refresh(); },
    zoom: () => { cv.setZoom(!cv.zoom); el.querySelector('#zoomB').classList.toggle('on', cv.zoom); el.querySelector('#panB').style.display = cv.zoom ? 'inline-flex' : 'none'; },
    pan: a => { const [x, y] = a.split(',').map(Number); cv.pan(x * .4, y * .4); },
    undo: () => { if (!undo.length) return; const p = JSON.parse(undo.pop()); d.items = p.items; d.arrows = p.arrows; snap = JSON.stringify(p); cv.sel = null; save(); cv.render(); insp(); chal(); el.querySelector('#undoB').disabled = !undo.length; },
    clearArrows: () => { if (!d.arrows.length) return; d.arrows = []; cv.o.changed(); cv.render(); },
    png: async () => { if (cv.zoom) { cv.setZoom(false); el.querySelector('#zoomB').classList.remove('on'); el.querySelector('#panB').style.display = 'none'; } try { await shareFile(await svgToPng(svg), (d.name || 'drill').replace(/[^\w\- ]+/g, '') + '.png', d.name); } catch (e) { toast('Could not make the image on this device'); } },
    print: () => { save.flush(); printDrill(d, T); },
    dup: () => { const c = clone(d); c.id = undefined; c.name = d.name + ' (copy)'; const n = S.create('drill', null, c); location.hash = '#/drill/' + n.id + (fromSession ? '/' + fromSession : ''); },
    del: async () => {
      if (!await confirmSheet('Delete this drill?', usedIn.length ? `It’s used in ${usedIn.length} session plan(s), which will show it as missing.` : '')) return;
      S.del(d.id); location.hash = back;
    }
  });
  size(); cv.render(); insp(); chal();
  return () => save.flush();
}

// Pick a drill from the library (used by the session planner).
export function pickDrill(T, onPick, sessionId) {
  const ds = S.drills();
  const el = sheet(`<div class="stack"><div class="h2">Add a practice</div>
    ${sessionId ? `<a class="btn" href="#/ideas/s/${esc(sessionId)}" id="pdIdeas" style="justify-content:flex-start">${icon('book')}Practice ideas from top coaches<span class="grow"></span><span class="tiny muted">by what they train</span></a>` : ''}
    <input type="search" id="pdq" placeholder="Search your drills" autofocus>
    <div class="list" id="pdl"></div>
    <div class="row"><button class="btn pri" id="pdNew">${icon('plus')}Design a new drill</button><button class="btn" id="pdX">Cancel</button></div></div>`);
  const draw = q => {
    q = (q || '').toLowerCase();
    el.querySelector('#pdl').innerHTML = ds.filter(d => !q || (d.name + ' ' + d.type + ' ' + d.objective).toLowerCase().includes(q)).map(d => {
      const lk = S.drillLinks(d, T).map(S.get).filter(Boolean);
      return `<button class="item" data-d="${d.id}"><span class="grow"><span class="t" style="display:block">${esc(d.name)}</span><span class="s">${esc(d.type)} · ${d.minutes || '?'} min${lk.length ? ' · ' + lk.map(p => esc(p.title)).join(', ') : ' · not linked for this team'}</span></span></button>`;
    }).join('') || '<div class="empty">No drills match.</div>';
    el.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { closeSheet(); onPick(S.get(b.dataset.d)); });
  };
  draw(); el.querySelector('#pdq').oninput = e => draw(e.target.value);
  el.querySelector('#pdX').onclick = closeSheet;
  el.querySelector('#pdIdeas')?.addEventListener('click', () => closeSheet());
  el.querySelector('#pdNew').onclick = () => { closeSheet(); const n = newDrill(); onPick(n, true); };
}
