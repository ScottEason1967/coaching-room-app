// Pitch, kit and touch canvas. Shared by the app and the player/staff view page.
// Canonical board coordinates: a vertical 68 x 105 m pitch, our goal at the bottom.
import { esc, uid } from './util.js';

export const TEAM_COL = '#3D7BFF', GK_COL = '#2FB67A', OPP_COL = '#D63B3B';
const GRASS_A = '#1F6B3F', GRASS_B = '#237446';

export function pitchFull() {
  let s = '';
  for (let i = 0; i < 20; i++) s += `<rect x="0" y="${i * 5.25}" width="68" height="5.25" fill="${i % 2 ? GRASS_A : GRASS_B}"/>`;
  const L = 'stroke="#fff" stroke-width="0.35" fill="none" opacity=".85"';
  s += `<rect x="0" y="0" width="68" height="105" ${L}/><line x1="0" y1="52.5" x2="68" y2="52.5" ${L}/><circle cx="34" cy="52.5" r="9.15" ${L}/><circle cx="34" cy="52.5" r=".45" fill="#fff"/>`;
  [0, 1].forEach(t => {
    const y0 = t ? 105 : 0, d = t ? -1 : 1;
    s += `<rect x="${34 - 20.16}" y="${t ? 105 - 16.5 : 0}" width="40.32" height="16.5" ${L}/><rect x="${34 - 9.16}" y="${t ? 105 - 5.5 : 0}" width="18.32" height="5.5" ${L}/>`;
    s += `<circle cx="34" cy="${y0 + d * 11}" r=".45" fill="#fff"/>`;
    s += `<path d="M ${34 - 7.3} ${y0 + d * 16.5} A 9.15 9.15 0 0 ${t ? 1 : 0} ${34 + 7.3} ${y0 + d * 16.5}" ${L}/>`;
    s += `<rect x="${34 - 3.66}" y="${t ? 105 : -2}" width="7.32" height="2" fill="rgba(255,255,255,.3)" stroke="#fff" stroke-width=".3"/>`;
  });
  return s;
}

export function areaBg(w, h, preset) {
  if (preset === 'full') return pitchFull();
  let s = ''; const band = Math.max(2, h / 10);
  for (let y = 0, i = 0; y < h; y += band, i++) s += `<rect x="0" y="${y}" width="${w}" height="${Math.min(band, h - y)}" fill="${i % 2 ? GRASS_A : GRASS_B}"/>`;
  const L = 'stroke="#fff" stroke-width="0.3" fill="none" opacity=".85"';
  if (preset === 'half') {
    s += `<rect x="0" y="0" width="68" height="52.5" ${L}/><rect x="${34 - 20.16}" y="0" width="40.32" height="16.5" ${L}/><rect x="${34 - 9.16}" y="0" width="18.32" height="5.5" ${L}/><circle cx="34" cy="11" r=".45" fill="#fff"/><path d="M ${34 - 7.3} 16.5 A 9.15 9.15 0 0 0 ${34 + 7.3} 16.5" ${L}/><path d="M ${34 - 9.15} 52.5 A 9.15 9.15 0 0 1 ${34 + 9.15} 52.5" ${L}/><rect x="${34 - 3.66}" y="-2" width="7.32" height="2" fill="rgba(255,255,255,.3)" stroke="#fff" stroke-width=".3"/>`;
  } else {
    const g = w > 40 || h > 40 ? 10 : 5;
    for (let x = g; x < w; x += g) s += `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="#fff" stroke-width=".08" opacity=".3"/>`;
    for (let y = g; y < h; y += g) s += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="#fff" stroke-width=".08" opacity=".3"/>`;
    s += `<rect x="0" y="0" width="${w}" height="${h}" stroke="#fff" stroke-width=".25" fill="none" stroke-dasharray="1 .6"/>`;
  }
  return s;
}

export const ARROWS = {
  pass: { c: '#FFFFFF', d: '1.2 .8', w: .45, lab: 'Pass' },
  run: { c: '#FFD23F', d: '', w: .5, lab: 'Run' },
  dribble: { c: '#FF9F43', d: '.3 .5', w: .55, lab: 'Dribble' },
  press: { c: '#FF5C5C', d: '', w: .5, lab: 'Press' }
};
// Marker ids are prefixed per SVG so hidden or printed copies never clash.
let pfxN = 0; export const newPfx = () => 'm' + (++pfxN).toString(36) + Math.random().toString(36).slice(2, 5);
export function arrowDefs(pf = 'm') {
  return `<defs>${Object.entries(ARROWS).map(([k, a]) => `<marker id="${pf}-${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${a.c}"/></marker>`).join('')}<marker id="${pf}-sel" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#00E5FF"/></marker></defs>`;
}
export function arrowSvg(a, sc, sel, pf = 'm') {
  const st = ARROWS[a.style] || ARROWS.pass;
  return `<g data-id="${a.id}" data-t="a"><line x1="${a.x1}" y1="${a.y1}" x2="${a.x2}" y2="${a.y2}" stroke="transparent" stroke-width="${3.2 * sc}"/><line x1="${a.x1}" y1="${a.y1}" x2="${a.x2}" y2="${a.y2}" stroke="${sel ? '#00E5FF' : st.c}" stroke-width="${st.w * sc}" stroke-dasharray="${st.d ? st.d.split(' ').map(n => n * sc).join(' ') : ''}" marker-end="url(#${pf}-${sel ? 'sel' : (ARROWS[a.style] ? a.style : 'pass')})" stroke-linecap="round"/></g>`;
}

export function tokenSvg(s, fill, num, name, tc = '#fff') {
  let h = `<circle r="${1 * s}" fill="${fill}" stroke="#fff" stroke-width="${.13 * s}"/>`;
  if (num !== '' && num != null) h += `<text font-size="${.95 * s}" text-anchor="middle" dy=".36em" fill="${tc}" font-weight="700" font-family="Barlow Condensed,Arial Narrow,sans-serif">${esc(num)}</text>`;
  if (name) h += `<text y="${1.85 * s}" font-size="${.72 * s}" text-anchor="middle" fill="#fff" stroke="rgba(0,0,0,.75)" stroke-width="${.22 * s}" paint-order="stroke" font-weight="600" font-family="Inter,Arial,sans-serif">${esc(name)}</text>`;
  return h;
}

export const EQUIP = {
  disc: { lab: 'Disc', draw: (it, s) => `<ellipse rx="${.55 * s}" ry="${.55 * s}" fill="${it.color || '#F2B705'}" stroke="#000" stroke-opacity=".35" stroke-width="${.08 * s}"/><circle r="${.18 * s}" fill="rgba(0,0,0,.25)"/>` },
  cone: { lab: 'Cone', draw: (it, s) => `<path d="M0 ${-1 * s} L${.7 * s} ${.6 * s} L${-.7 * s} ${.6 * s} Z" fill="${it.color || '#FF7A00'}" stroke="#000" stroke-opacity=".4" stroke-width="${.08 * s}"/><rect x="${-.85 * s}" y="${.55 * s}" width="${1.7 * s}" height="${.25 * s}" fill="${it.color || '#FF7A00'}"/>` },
  mannequin: { lab: 'Mannequin', draw: (it, s) => `<rect x="${-.75 * s}" y="${-.3 * s}" width="${1.5 * s}" height="${.6 * s}" rx="${.25 * s}" fill="#1a1a1a"/><circle r="${.35 * s}" fill="#444" stroke="#fff" stroke-width="${.06 * s}"/>` },
  pole: { lab: 'Pole', draw: (it, s) => `<circle r="${.3 * s}" fill="${it.color || '#E8E8E8'}" stroke="#000" stroke-width="${.1 * s}"/><circle r="${.1 * s}" fill="#000"/>` },
  hurdle: { lab: 'Hurdle', draw: (it, s) => `<rect x="${-.8 * s}" y="${-.15 * s}" width="${1.6 * s}" height="${.3 * s}" fill="${it.color || '#FFD23F'}" stroke="#000" stroke-width="${.06 * s}"/>` },
  ladder: { lab: 'Ladder', draw: (it, s) => { let r = `<rect x="${-.5 * s}" y="${-2 * s}" width="${1 * s}" height="${4 * s}" fill="none" stroke="#FFD23F" stroke-width="${.12 * s}"/>`; for (let i = 1; i < 8; i++) r += `<line x1="${-.5 * s}" x2="${.5 * s}" y1="${(-2 + i * .5) * s}" y2="${(-2 + i * .5) * s}" stroke="#FFD23F" stroke-width="${.1 * s}"/>`; return r; } },
  minigoal: { lab: 'Mini goal', draw: () => `<rect x="-0.9" y="-0.4" width="1.8" height="0.8" fill="rgba(255,255,255,.25)" stroke="#fff" stroke-width=".18"/>` },
  goal: { lab: 'Goal', draw: () => `<rect x="-3.66" y="-1" width="7.32" height="2" fill="rgba(255,255,255,.3)" stroke="#fff" stroke-width=".25"/>` },
  ball: { lab: 'Ball', draw: (it, s) => `<circle r="${.42 * s}" fill="#fff" stroke="#111" stroke-width="${.1 * s}"/><circle r="${.14 * s}" fill="#111"/>` },
  att: { lab: 'Attacker', text: true, draw: (it, s) => tokenSvg(s, TEAM_COL, it.label || '') },
  def: { lab: 'Defender', text: true, draw: (it, s) => tokenSvg(s, OPP_COL, it.label || '') },
  neu: { lab: 'Neutral', text: true, draw: (it, s) => tokenSvg(s, '#F2B705', it.label || '', '#1b1400') },
  gk: { lab: 'Keeper', text: true, draw: (it, s) => tokenSvg(s, GK_COL, it.label || '') },
  coach: { lab: 'Coach', text: true, draw: (it, s) => tokenSvg(s, '#222', it.label || 'C') },
  zone: { lab: 'Zone', draw: it => `<rect x="${-(it.zw || 6) / 2}" y="${-(it.zh || 4) / 2}" width="${it.zw || 6}" height="${it.zh || 4}" fill="rgba(255,255,255,.14)" stroke="#fff" stroke-width=".15" stroke-dasharray=".6 .4"/>` },
  text: { lab: 'Label', text: true, draw: (it, s) => `<text font-size="${1.1 * s}" text-anchor="middle" dy=".35em" fill="#fff" stroke="#000" stroke-width="${.18 * s}" paint-order="stroke" font-weight="700" font-family="Inter,Arial,sans-serif">${esc(it.label || 'Text')}</text>` }
};
export const CONE_COLOURS = ['#F2B705', '#FF7A00', '#3D7BFF', '#D63B3B', '#FFFFFF', '#2FB67A'];

// Formations in board coordinates: [role, x, y]. Order: GK, back line, midfield, front.
export const FORMATIONS = {
  '4-3-3 (6 + two 8s)': [['GK', 34, 100], ['RB', 58, 82], ['CB', 42, 88], ['CB', 26, 88], ['LB', 10, 82], ['6', 34, 72], ['8', 46, 58], ['8', 22, 58], ['RW', 58, 38], ['LW', 10, 38], ['CF', 34, 30]],
  '4-4-2': [['GK', 34, 100], ['RB', 58, 82], ['CB', 42, 88], ['CB', 26, 88], ['LB', 10, 82], ['RM', 58, 58], ['CM', 40, 62], ['CM', 28, 62], ['LM', 10, 58], ['ST', 40, 36], ['ST', 28, 36]],
  '4-2-3-1': [['GK', 34, 100], ['RB', 58, 82], ['CB', 42, 88], ['CB', 26, 88], ['LB', 10, 82], ['DM', 41, 70], ['DM', 27, 70], ['RAM', 56, 50], ['10', 34, 50], ['LAM', 12, 50], ['ST', 34, 32]],
  '4-5-1 (block)': [['GK', 34, 100], ['RB', 56, 84], ['CB', 41, 86], ['CB', 27, 86], ['LB', 12, 84], ['RM', 58, 66], ['CM', 44, 68], ['DM', 34, 72], ['CM', 24, 68], ['LM', 10, 66], ['ST', 34, 52]],
  '3-5-2': [['GK', 34, 100], ['CB', 48, 86], ['CB', 34, 88], ['CB', 20, 86], ['RWB', 62, 62], ['CM', 46, 62], ['DM', 34, 70], ['CM', 22, 62], ['LWB', 6, 62], ['ST', 40, 36], ['ST', 28, 36]]
};

export const AREAS = {
  box10: ['10 x 10 m', 10, 10], box15: ['15 x 15 m', 15, 15], box20: ['20 x 20 m', 20, 20], ssg30: ['30 x 20 m', 30, 20],
  ssg40: ['40 x 30 m', 40, 30], third: ['Final third', 68, 35], half: ['Half pitch', 68, 52.5], full: ['Full pitch', 68, 105], custom: ['Custom', 20, 20]
};

export function drillScale(w, h) { return Math.max(.6, Math.min(2.2, Math.max(w, h) / 34)); }
export const BOARD_SC = 2.6;

// Board item drawing. players: id -> {num, name, short, pos}
export function boardItem(it, sc, players) {
  if (it.kind === 'us') {
    const p = players && players[it.pid];
    const gk = p ? p.pos === 'GK' : it.role === 'GK';
    const name = p ? (p.short || p.name || '') : (it.role || '');
    return tokenSvg(sc, gk ? GK_COL : TEAM_COL, p ? p.num : '', name.length > 12 ? name.slice(0, 11) + '…' : name);
  }
  if (it.kind === 'opp') return tokenSvg(sc, OPP_COL, it.label || '', '');
  const e = EQUIP[it.kind]; return e ? e.draw(it, sc) : '';
}
const isText = it => it.kind === 'us' || it.kind === 'opp' || (EQUIP[it.kind] && EQUIP[it.kind].text);

const ROT_H = 'matrix(0,1,-1,0,105,0)';
export function boardViewBox(orient) { return orient === 'h' ? '-4 -3 113 74' : '-3 -4 74 113'; }

// Static SVG of one board frame (thumbnails, print, share page).
export function frameSvg(f, players, { orient = 'v', cls = '', style = '' } = {}) {
  const sc = BOARD_SC; const pf = newPfx();
  const items = (f.items || []).map(it => `<g transform="translate(${it.x} ${it.y}) rotate(${(it.r || 0) + (orient === 'h' && isText(it) ? -90 : 0)})">${boardItem(it, sc, players)}</g>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${boardViewBox(orient)}" class="${cls}" style="background:#16502F;${style}">${arrowDefs(pf)}<g transform="${orient === 'h' ? ROT_H : ''}">${pitchFull()}${(f.arrows || []).map(a => arrowSvg(a, sc, false, pf)).join('')}${items}</g></svg>`;
}
export function drillSvg(d, { cls = '', style = '' } = {}) {
  const sc = drillScale(d.w, d.h); const pf = newPfx();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 ${d.w + 4} ${d.h + 4}" class="${cls}" style="background:#16502F;${style}">${arrowDefs(pf)}${areaBg(d.w, d.h, d.preset)}${(d.arrows || []).map(a => arrowSvg(a, sc, false, pf)).join('')}${(d.items || []).map(it => `<g transform="translate(${it.x} ${it.y}) rotate(${it.r || 0})">${(EQUIP[it.kind] || EQUIP.disc).draw(it, sc)}</g>`).join('')}</svg>`;
}

/* ---------- Touch canvas ----------
   o = { model(), size() -> [w,h], bg(), drawItem(it,sc), scale(), viewBox(), orient(),
         newItem(kind,x,y), changed(), onSelect(), locked() } */
export class Canvas {
  constructor(svg, o) {
    this.svg = svg; this.o = o; this.mode = 'select'; this.sel = null; this.selT = null; this.pf = newPfx();
    this.zoom = false; this.zc = null; // zoomed in: show half the area, centred on zc
    svg.addEventListener('pointerdown', e => this.down(e));
    svg.addEventListener('pointermove', e => this.move(e));
    svg.addEventListener('pointerup', e => this.up(e));
    svg.addEventListener('pointercancel', e => this.up(e));
    svg.addEventListener('contextmenu', e => e.preventDefault());
  }
  get m() { return this.o.model(); }
  baseBox() { return this.o.viewBox().trim().split(/\s+/).map(Number); }
  viewBoxNow() {
    const [x, y, w, h] = this.baseBox(); if (!this.zoom) return `${x} ${y} ${w} ${h}`;
    const nw = w / 2, nh = h / 2; const c = this.zc || [x + w / 2, y + h / 2];
    const nx = this.clamp(c[0] - nw / 2, x, x + w - nw), ny = this.clamp(c[1] - nh / 2, y, y + h - nh);
    this.zc = [nx + nw / 2, ny + nh / 2];
    return `${nx} ${ny} ${nw} ${nh}`;
  }
  setZoom(on) { this.zoom = !!on; if (!on) this.zc = null; this.render(); }
  // Move the zoom window by a fraction of its size.
  pan(dx, dy) { if (!this.zoom) return; const v = this.viewBoxNow().split(' ').map(Number); this.zc = [v[0] + v[2] / 2 + dx * v[2], v[1] + v[3] / 2 + dy * v[3]]; this.render(); }
  pt(e) {
    const g = this.svg.querySelector('#cg') || this.svg;
    const p = this.svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    return p.matrixTransform(g.getScreenCTM().inverse());
  }
  clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  itemTransform(it) {
    const h = this.o.orient && this.o.orient() === 'h' && isText(it);
    return `translate(${it.x} ${it.y}) rotate(${(it.r || 0) + (h ? -90 : 0)})`;
  }
  render(over) {
    const m = over || this.m; const sc = this.o.scale();
    const vb = this.viewBoxNow(); this.svg.setAttribute('viewBox', vb);
    // A finger needs about 44 px. Hit circles are at least 22 px in radius on screen whatever the drawing scale.
    const pxPer = (this.svg.getBoundingClientRect().width || 0) / (+vb.split(' ')[2] || 1); const minR = pxPer ? 22 / pxPer : 0; this.minR = minR;
    const rot = this.o.orient && this.o.orient() === 'h' ? ROT_H : '';
    let h = arrowDefs(this.pf) + `<g id="cg" transform="${rot}"><g>${this.o.bg()}</g><g>`;
    (m.arrows || []).forEach(a => h += arrowSvg(a, sc, this.sel === a.id, this.pf));
    if (this.drawing) h += arrowSvg(this.drawing, sc, false, this.pf);
    h += '</g><g>';
    (m.items || []).forEach(it => {
      const big = it.kind === 'us' || it.kind === 'opp' || ['att', 'def', 'neu', 'gk', 'coach'].includes(it.kind);
      const hit = `<circle r="${Math.max((big ? 1.5 : it.kind === 'ball' ? .75 : 1.1) * sc, minR)}" fill="transparent"/>`;
      h += `<g data-id="${it.id}" data-t="i" transform="${this.itemTransform(it)}">${hit}${this.o.drawItem(it, sc)}${this.sel === it.id ? `<circle r="${1.5 * sc}" fill="none" stroke="#00E5FF" stroke-width="${.18 * sc}" stroke-dasharray="${.5 * sc} ${.3 * sc}"/>` : ''}</g>`;
    });
    h += '</g></g>'; this.svg.innerHTML = h;
  }
  // Bigger hit circles overlap on a phone, so the one drawn last would steal taps meant for its
  // neighbour. Pick the item whose centre is nearest the finger instead of trusting the DOM target.
  nearest(pt) {
    const sc = this.o.scale(); let best = null;
    (this.m.items || []).forEach(it => {
      if (it.kind === 'zone') return;
      const big = it.kind === 'us' || it.kind === 'opp' || ['att', 'def', 'neu', 'gk', 'coach'].includes(it.kind);
      const r = Math.max((big ? 1.5 : it.kind === 'ball' ? .75 : 1.1) * sc, this.minR || 0);
      const d = Math.hypot(pt.x - it.x, pt.y - it.y);
      if (d <= r && (!best || d < best.d)) best = { it, d };
    });
    return best;
  }
  down(e) {
    if (this.o.locked && this.o.locked()) return;
    if (e.button && e.button !== 0) return;
    const pt = this.pt(e); let t = e.target.closest('[data-id]'); const W = this.o.size();
    if (!this.mode.startsWith('add:') && !this.mode.startsWith('arrow:')) { const near = this.nearest(pt); if (near) t = this.svg.querySelector(`[data-id="${near.it.id}"]`) || t; }
    try { this.svg.setPointerCapture(e.pointerId); } catch (_) {}
    if (this.mode.startsWith('add:')) {
      const it = this.o.newItem(this.mode.slice(4), +this.clamp(pt.x, 0, W[0]).toFixed(2), +this.clamp(pt.y, 0, W[1]).toFixed(2));
      if (it) { this.m.items.push(it); this.sel = it.id; this.selT = 'i'; this.o.changed(); this.render(); this.o.onSelect && this.o.onSelect(); }
      return;
    }
    if (this.mode.startsWith('arrow:')) { this.drawing = { id: uid(), style: this.mode.slice(6), x1: +pt.x.toFixed(2), y1: +pt.y.toFixed(2), x2: pt.x, y2: pt.y }; return; }
    if (t) {
      this.sel = t.dataset.id; this.selT = t.dataset.t;
      if (this.selT === 'i') { const it = this.m.items.find(i => i.id === this.sel); if (it) this.drag = { id: it.id, dx: pt.x - it.x, dy: pt.y - it.y, moved: false }; }
      this.render(); this.o.onSelect && this.o.onSelect();
    } else if (this.sel) { this.sel = null; this.selT = null; this.render(); this.o.onSelect && this.o.onSelect(); }
  }
  move(e) {
    if (!this.drag && !this.drawing) return;
    e.preventDefault();
    const pt = this.pt(e);
    if (this.drag) {
      const it = this.m.items.find(i => i.id === this.drag.id); if (!it) return; const W = this.o.size();
      it.x = +this.clamp(pt.x - this.drag.dx, -2, W[0] + 2).toFixed(2); it.y = +this.clamp(pt.y - this.drag.dy, -2, W[1] + 2).toFixed(2); this.drag.moved = true;
      const g = this.svg.querySelector(`[data-id="${it.id}"]`); if (g) g.setAttribute('transform', this.itemTransform(it));
    } else { this.drawing.x2 = +pt.x.toFixed(2); this.drawing.y2 = +pt.y.toFixed(2); this.render(); }
  }
  up() {
    if (this.drag) { if (this.drag.moved) this.o.changed(); this.drag = null; }
    if (this.drawing) {
      const a = this.drawing; this.drawing = null;
      if (Math.hypot(a.x2 - a.x1, a.y2 - a.y1) > .8) { this.m.arrows.push(a); this.sel = a.id; this.selT = 'a'; this.o.changed(); }
      this.render(); this.o.onSelect && this.o.onSelect();
    }
  }
  selected() {
    if (!this.sel) return null;
    return this.selT === 'a' ? this.m.arrows.find(a => a.id === this.sel) : this.m.items.find(i => i.id === this.sel);
  }
  remove() {
    if (!this.sel) return; const m = this.m;
    m.items = m.items.filter(i => i.id !== this.sel); m.arrows = m.arrows.filter(a => a.id !== this.sel);
    this.sel = null; this.o.changed(); this.render(); this.o.onSelect && this.o.onSelect();
  }
}

// Render any SVG element to a PNG blob.
export function svgToPng(svgEl, width = 1400, bg = '#16502F') {
  return new Promise((res, rej) => {
    try {
      const c0 = svgEl.cloneNode(true);
      c0.querySelectorAll('[stroke="#00E5FF"]').forEach(n => n.remove());
      const vb = svgEl.viewBox.baseVal; const H = Math.round(width * vb.height / vb.width);
      c0.setAttribute('width', width); c0.setAttribute('height', H); c0.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      const img = new Image();
      img.onload = () => { const c = document.createElement('canvas'); c.width = width; c.height = H; const x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, width, H); x.drawImage(img, 0, 0, width, H); c.toBlob(b => b ? res(b) : rej(new Error('no blob')), 'image/png'); };
      img.onerror = rej;
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(c0));
    } catch (e) { rej(e); }
  });
}
