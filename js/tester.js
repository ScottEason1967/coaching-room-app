// Test it: a rules engine that moves a defending side against a board, frame by frame, and
// measures where the play breaks. Nothing is guessed: every finding is a distance, a time or a
// count on the pitch. Board coordinates are metres on a 68 x 105 pitch, our goal at the bottom
// (y = 105), so we attack up the screen and their goal is at y = 0.
import { OPP_SHAPES } from './pitch.js';
import { esc } from './util.js';

export const STYLES = {
  high: { lab: 'High press', says: 'Front line presses the keeper and centre-backs, midfield jumps', shape: '4-3-3', D: 34, F: 82, tight: .8, leash: 16, press: () => true, second: true },
  mid: { lab: 'Mid-block', says: 'Wait around halfway, press when the ball comes forward or goes wide', shape: '4-4-2', D: 22, F: 57, tight: .55, leash: 11, press: b => b.y < 62 || b.x < 15 || b.x > 53 },
  low: { lab: 'Low block', says: 'Ten behind the ball, protect the box', shape: '4-5-1 low block', D: 11, F: 40, tight: .45, leash: 8, press: b => b.y < 38 },
  man6: { lab: 'Man-mark our 6', says: 'Their 10 follows your pivot everywhere', shape: '4-2-3-1', D: 24, F: 63, tight: .6, leash: 12, press: b => b.y < 66 || b.x < 15 || b.x > 53, man6: true }
};
export const SHARP = {
  steady: { lab: 'Steady', speed: 5.2, react: .5 },
  sharp: { lab: 'Sharp', speed: 6.3, react: .3 },
  ruthless: { lab: 'Ruthless', speed: 7.2, react: .15 }
};
const FRAME_SECS = 3;          // time between frames when the opponent moves
const ballSpeed = L => Math.min(19, 11 + L * .18);   // m/s: short passes firm, long ones driven
const REACH = 1.1;             // a stretched leg
const PRESS_GAP = 2;           // how close a presser gets to the ball

const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clampX = x => Math.max(1.5, Math.min(66.5, x));
const clampY = y => Math.max(1.5, Math.min(103.5, y));
const r1 = n => Math.round(n * 10) / 10;

// The opposition file of a match ("How they press", "Shape") as a style for the test.
export function styleFromMatch(m) {
  const t = (m && m.tags) || {};
  const style = t.press === 'low block' ? 'low' : t.press === 'mid block' ? 'mid' : t.press ? 'high' : 'mid';
  const f = t.formation === '4-5-1' ? '4-5-1 low block' : OPP_SHAPES[t.formation] ? t.formation : '';
  return { style, shape: f, sharp: t.press === 'individual/unorganised' ? 'steady' : 'sharp' };
}

// Our side in one frame: players, who has the ball, the passes drawn.
function readFrame(f, players) {
  const us = (f.items || []).filter(i => i.kind === 'us' || i.kind === 'att' || i.kind === 'gk').map(i => {
    const p = players[i.pid] || {};
    const role = p.pos || i.role || (i.kind === 'gk' ? 'GK' : '');
    return { id: i.id, x: i.x, y: i.y, role, gk: role === 'GK' || i.kind === 'gk', num: p.num != null && p.num !== '' ? String(p.num) : (i.label || role || '?'), name: p.short || p.name || '' };
  });
  const ballIt = (f.items || []).find(i => i.kind === 'ball');
  let carrier = null;
  if (ballIt) { carrier = us.slice().sort((a, b) => d2(a, ballIt) - d2(b, ballIt))[0] || null; if (carrier && d2(carrier, ballIt) > 3.5) carrier = null; }
  const ball = ballIt ? { x: ballIt.x, y: ballIt.y } : carrier ? { x: carrier.x, y: carrier.y } : { x: 34, y: 96 };
  const passes = (f.arrows || []).filter(a => (a.style || 'pass') === 'pass').map(a => {
    const from = us.slice().sort((p, q) => d2(p, { x: a.x1, y: a.y1 }) - d2(q, { x: a.x1, y: a.y1 }))[0];
    const to = us.filter(p => p !== from).sort((p, q) => d2(p, { x: a.x2, y: a.y2 }) - d2(q, { x: a.x2, y: a.y2 }))[0];
    return { a: { x: a.x1, y: a.y1 }, b: { x: a.x2, y: a.y2 }, from: from && d2(from, { x: a.x1, y: a.y1 }) < 5 ? from : null, to: to && d2(to, { x: a.x2, y: a.y2 }) < 5 ? to : null };
  });
  return { us, ball, carrier, passes };
}

// Where each of their players wants to be, given the ball and our players.
function targets(st, base, fr, prev) {
  const S = STYLES[st.style]; const { ball, us } = fr;
  const out = outfield(us);
  // The block: shifted towards the ball and squeezed narrow around it.
  const block = base.map(o => {
    if (o.gk) return { ...o, x: 34 + (ball.x - 34) * .15, y: 4 };
    let x = o.bx + (ball.x - 34) * .35; x = ball.x + (x - ball.x) * .85;
    const y = S.D + (o.by - 17) * (S.F - S.D) / (73 - 17) + (st.style === 'high' ? 0 : (ball.y - 60) * .15);
    return { ...o, x: clampX(x), y: clampY(y) };
  });
  const free = block.filter(o => !o.gk);
  const job = new Map();
  // Who presses: the nearest to the ball, if the style says now.
  const pressing = S.press(ball);
  if (pressing && free.length) {
    const p1 = free.slice().sort((a, b) => d2(a, ball) - d2(b, ball))[0];
    // Come in on the side that cuts the pass back to the keeper.
    const gk = us.find(p => p.gk); let dir = gk && fr.carrier && !fr.carrier.gk ? { x: gk.x - ball.x, y: gk.y - ball.y } : { x: 34 - ball.x, y: -1 };
    const n = Math.hypot(dir.x, dir.y) || 1;
    job.set(p1, { x: clampX(ball.x + dir.x / n * PRESS_GAP), y: clampY(ball.y + dir.y / n * PRESS_GAP), press: true });
    if (S.second) {
      // A second presser screens the nearest short pass.
      const opts = out.filter(p => p !== fr.carrier).sort((a, b) => d2(a, ball) - d2(b, ball));
      const t = opts[0]; const p2 = free.filter(o => o !== p1).sort((a, b) => d2(a, t || ball) - d2(b, t || ball))[0];
      if (t && p2) job.set(p2, { x: clampX(ball.x + (t.x - ball.x) * .55), y: clampY(ball.y + (t.y - ball.y) * .55), screen: true });
    }
  }
  // Man-mark the 6: the most central midfielder of ours, tight, wherever she goes.
  if (S.man6) {
    const six = out.filter(p => p.role === '6' || p.role === 'DM')[0] || out.slice().sort((a, b) => Math.abs(a.x - 34) + Math.abs(a.y - 70) - Math.abs(b.x - 34) - Math.abs(b.y - 70))[0];
    const m = free.filter(o => !job.has(o)).sort((a, b) => (a.lab === '10' ? -1 : 0) - (b.lab === '10' ? -1 : 0) || d2(a, six) - d2(b, six))[0];
    if (six && m) job.set(m, { x: six.x, y: clampY(six.y - 1.6), mark: six.id });
  }
  // Everyone else marks the nearest of ours in reach of their spot, goal-side and a touch towards the ball.
  const pairs = [];
  free.filter(o => !job.has(o)).forEach(o => out.forEach(p => { if (p !== fr.carrier && d2(o, p) < S.leash) pairs.push([d2(o, p), o, p]); }));
  pairs.sort((a, b) => a[0] - b[0]); const taken = new Set([...job.values()].map(j => j.mark));
  for (const [, o, p] of pairs) {
    if (job.has(o) || taken.has(p.id)) continue;
    const tx = p.x + (ball.x - p.x) * .12, ty = p.y - 2 + (ball.y - p.y) * .12;
    job.set(o, { x: clampX(o.x + (tx - o.x) * S.tight), y: clampY(o.y + (ty - o.y) * S.tight), mark: p.id }); taken.add(p.id);
  }
  return block.map(o => ({ ...o, ...(job.get(o) || {}) }));
}
const outfield = us => us.filter(p => !p.gk);

// Their starting eleven: the shape drawn on the board if there is one, else the style's shape.
function baseShape(f, st) {
  const drawn = (f.items || []).filter(i => i.kind === 'opp' || i.kind === 'def');
  const shape = OPP_SHAPES[st.shape] || OPP_SHAPES[STYLES[st.style].shape];
  const src = drawn.length >= 6 ? drawn.map((i, k) => ({ lab: i.label || String(k + 1), x: i.x, y: i.y }))
    : shape.map(([lab, x, y]) => ({ lab, x: 68 - x, y: 105 - y }));
  // Positions in their own shape's terms (their back line at 17, forwards at 73) for moving the block.
  const ys = src.filter(o => o.lab !== 'GK').map(o => o.y); const lo = Math.min(...ys), hi = Math.max(...ys);
  return src.map((o, i) => ({ id: 'x' + i, lab: o.lab, gk: o.lab === 'GK' || (drawn.length >= 6 && o.y < 8), bx: o.x, by: hi > lo ? 17 + (o.y - lo) * (73 - 17) / (hi - lo) : 45 }));
}

export function simulate(board, players, st) {
  const sp = SHARP[st.sharp] || SHARP.sharp; const maxMove = sp.speed * FRAME_SECS;
  const base = baseShape(board.frames[0] || {}, st);
  let prev = null; const frames = [];
  board.frames.forEach((f, k) => {
    const fr = readFrame(f, players);
    const want = targets(st, base, fr, prev);
    const opp = want.map((o, i) => {
      if (!prev) return o;
      const p = prev[i]; const dx = o.x - p.x, dy = o.y - p.y; const dist = Math.hypot(dx, dy);
      return dist <= maxMove ? o : { ...o, x: p.x + dx / dist * maxMove, y: p.y + dy / dist * maxMove };
    });
    frames.push({ k, fr, opp, from: prev });
    prev = opp;
  });
  const findings = []; frames.forEach(F => check(F, sp, findings));
  return { frames, findings: merge(findings), st };
}

// The checks on one frame.
function check(F, sp, out) {
  const { fr, opp, k } = F; const them = opp.filter(o => !o.gk); const us = fr.us; const ball = fr.ball;
  const usName = p => p ? (p.num && p.num !== '?' ? p.num : p.role || 'player') : '?';
  const lane = (A, B, to = null) => {
    const L = d2(A, B); let best = null;
    them.forEach(o => {
      const ux = (B.x - A.x) / L, uy = (B.y - A.y) / L; const s = Math.max(0, Math.min(L, (o.x - A.x) * ux + (o.y - A.y) * uy));
      if (s < 1.5) return;
      const P = { x: A.x + ux * s, y: A.y + uy * s }; const off = d2(o, P); const run = Math.max(0, off - REACH);
      const tBall = s / ballSpeed(L), tThem = run ? sp.react + run / sp.speed : 0;
      let margin = tBall - tThem;
      // Near the end of the pass the receiver can step in to meet it: they only win it if they get there first.
      if (to && s / L > .7) margin = Math.min(margin, (.15 + d2(to, P) / 6.5) - tThem);
      if (margin > -0.05 && (!best || margin > best.margin)) best = { o, P, off: r1(off), tBall: r1(tBall), tThem: r1(tThem), margin, end: s / L > .85 };
    });
    return best;
  };
  // 1. Each pass drawn: can they get to it first?
  const targetsPlayed = new Set();
  fr.passes.forEach(p => {
    if (p.to) targetsPlayed.add(p.to.id);
    const hit = lane(p.a, p.b, p.to); const who = `${p.from ? usName(p.from) : 'the passer'} to ${p.to ? usName(p.to) : 'space'}`;
    if (hit) out.push({ key: 'pass:' + who, type: 'pass', sev: 'serious', frame: k, score: 10 + hit.margin * 4,
      title: hit.end && p.to ? `Their ${hit.o.lab} gets there before your ${usName(p.to)}` : `The pass from ${who} is cut out`, measure: hit.off <= REACH ? `Their ${hit.o.lab} is already on the line of the pass` : `Their ${hit.o.lab} is ${hit.off} m off the line · ball takes ${hit.tBall} s to get there · she needs ${hit.tThem} s`,
      q: `What would change so ${p.to ? usName(p.to) : 'she'} can receive?`, draw: { kind: 'cut', a: p.a, b: p.b, o: hit.o.id, P: hit.P } });
    else if (p.to) {
      const near = them.slice().sort((a, b) => d2(a, p.to) - d2(b, p.to))[0];
      if (near && d2(near, p.to) < 2.6) out.push({ key: 'recv:' + p.to.id, type: 'recv', sev: 'look', frame: k, score: 5,
        title: `Your ${usName(p.to)} receives with their ${near.lab} on her`, measure: `${r1(d2(near, p.to))} m away when the ball arrives · she has no time to turn`,
        q: `How does ${usName(p.to)} get half a yard first: a check away, receiving on the half-turn, or a different target?`, draw: { kind: 'tight', p: p.to.id, o: near.id } });
    }
  });
  // 2. A free player nobody plays.
  const pressed = fr.carrier && them.some(o => d2(o, fr.carrier) < 5);
  if (fr.carrier) {
    const cand = us.filter(p => !p.gk && p !== fr.carrier && !targetsPlayed.has(p.id)).map(p => {
      const near = Math.min(...them.map(o => d2(o, p))); const dist = d2(fr.carrier, p);
      return { p, near, dist, open: !lane(fr.carrier, p) };
    }).filter(c => c.near >= 8.5 && c.open && c.dist >= 8 && c.dist <= 45 && (c.p.y < fr.carrier.y - 5 || (pressed && c.p.y <= fr.carrier.y + 12))).sort((a, b) => (a.p.y - b.p.y) - (a.near - b.near) * 2);
    const c = cand[0];
    if (c) out.push({ key: 'free:' + c.p.id, type: 'free', sev: 'look', frame: k, score: 4 + c.near / 10,
      title: `Your ${usName(c.p)} is free and nobody plays her`, measure: `Nearest opponent ${r1(c.near)} m away · the pass from ${usName(fr.carrier)} is on (${Math.round(c.dist)} m)`,
      q: `Why isn't ${usName(c.p)} the pass here? Does she need to be seen, or is it the right call to go elsewhere?`, draw: { kind: 'free', p: c.p.id, from: fr.carrier.id } });
  }
  // 3. Outnumbered around the ball.
  const R = 15; const ours = us.filter(p => !p.gk && d2(p, ball) <= R).length; const theirs = them.filter(o => d2(o, ball) <= R).length;
  if (theirs > ours && theirs >= 2) out.push({ key: 'out', type: 'out', sev: theirs - ours >= 2 ? 'serious' : 'look', frame: k, score: 6 + (theirs - ours) * 2,
    title: `Outnumbered around the ball: ${ours} v ${theirs}`, measure: `Players within ${R} m of the ball, keepers not counted`,
    q: 'Who can come closer to make it even, or should the ball go somewhere else first?', draw: { kind: 'zone', c: ball, r: R, lab: `${ours} v ${theirs}` } });
  // 4. Rest defence: if we lose it here, who's behind the ball?
  if (ball.y < 78) {
    const back = us.filter(p => !p.gk && p.y > ball.y + 2).length; const fwd = them.filter(o => o.y > ball.y - 3).length;
    if (fwd > back) out.push({ key: 'rest', type: 'rest', sev: back < fwd - 1 || back <= 1 ? 'serious' : 'look', frame: k, score: 7 + (fwd - back) * 2,
      title: `If we lose it here: ${back} of ours v ${fwd} of theirs behind the ball`, measure: `Rest defence · ${Math.round(105 - ball.y)} m to our goal`,
      q: 'Who stays back while we attack, and where do they stand?', draw: { kind: 'rest', y: ball.y, lab: `${back} v ${fwd} behind the ball` } });
  }
  // 5. The gap between our defence and midfield.
  const of = us.filter(p => !p.gk).sort((a, b) => b.y - a.y);
  if (of.length >= 8 && ball.y < 85) {
    const D = of.slice(0, 4), M = of.slice(4, 7); const dy = D.reduce((s, p) => s + p.y, 0) / 4, my = M.reduce((s, p) => s + p.y, 0) / 3; const gap = dy - my;
    if (gap > 22) out.push({ key: 'gap', type: 'gap', sev: gap > 30 ? 'serious' : 'look', frame: k, score: 3 + (gap - 22) / 4,
      title: 'Big gap between your defence and midfield', measure: `${Math.round(gap)} m between the lines · aim for under 20 m`,
      q: 'Does the back line step up, or does midfield drop? What would you tell them?', draw: { kind: 'gap', y1: dy, y2: my, x: Math.max(...M.map(p => p.x)) + 4 } });
  }
}

// The same problem over several frames is one finding: keep its worst frame and list the rest.
function merge(list) {
  const by = new Map();
  list.forEach(f => { const o = by.get(f.key); if (!o) by.set(f.key, { ...f, frames: [f.frame] }); else { o.frames.push(f.frame); if (f.score > o.score) Object.assign(o, { ...f, frames: o.frames }); } });
  return [...by.values()].sort((a, b) => (a.sev === b.sev ? 0 : a.sev === 'serious' ? -1 : 1) || b.score - a.score);
}

// Opponents and markings on top of a frame, in board coordinates. focus: one finding to show alone.
export function overlaySvg(F, findings, { focus = null, t = 1, orient = 'v', sc = 2.6 } = {}) {
  const rot = orient === 'h' ? ' rotate(-90)' : '';
  const pos = (o, i) => !F.from || t >= 1 ? o : { x: F.from[i].x + (o.x - F.from[i].x) * t, y: F.from[i].y + (o.y - F.from[i].y) * t };
  const usAt = id => F.fr.us.find(p => p.id === id);
  const oppAt = id => { const i = F.opp.findIndex(o => o.id === id); return i < 0 ? null : pos(F.opp[i], i); };
  const shown = findings.filter(f => f.frame === F.k || (f.frames || []).includes(F.k)).filter(f => !focus || f.key === focus);
  const txt = (x, y, s, fill = '#fff', anchor = 'middle') => `<g transform="translate(${x} ${y})${rot}"><text font-size="${sc * .8}" text-anchor="${anchor}" dy=".35em" fill="${fill}" stroke="rgba(0,0,0,.7)" stroke-width="${sc * .25}" paint-order="stroke" font-weight="700" font-family="Inter,Arial,sans-serif">${s}</text></g>`;
  let marks = '';
  shown.forEach(f => {
    const g = f.draw; const dim = focus ? 1 : .9;
    if (g.kind === 'cut') { const o = oppAt(g.o); if (o) marks += `<line x1="${o.x}" y1="${o.y}" x2="${g.P.x}" y2="${g.P.y}" stroke="#E4572E" stroke-width="${sc * .32}" opacity="${dim}"/>`;
      marks += `<g transform="translate(${g.P.x} ${g.P.y})"><circle r="${sc * .75}" fill="#E4572E" stroke="#fff" stroke-width="${sc * .15}"/><path d="M${-sc * .35} ${-sc * .35} L${sc * .35} ${sc * .35} M${sc * .35} ${-sc * .35} L${-sc * .35} ${sc * .35}" stroke="#fff" stroke-width="${sc * .2}"/></g>`; }
    if (g.kind === 'free') { const p = usAt(g.p), c = usAt(g.from); if (p) marks += `<circle cx="${p.x}" cy="${p.y}" r="${sc * 1.55}" fill="none" stroke="#7FDDA6" stroke-width="${sc * .3}"/>`;
      if (p && c) marks += `<line x1="${c.x}" y1="${c.y}" x2="${p.x}" y2="${p.y}" stroke="#7FDDA6" stroke-width="${sc * .28}" stroke-dasharray="${sc * .7} ${sc * .5}"/>`;
      if (p) marks += txt(p.x, p.y - sc * 2.2, 'Free', '#7FDDA6'); }
    if (g.kind === 'tight') { const p = usAt(g.p); if (p) marks += `<circle cx="${p.x}" cy="${p.y}" r="${sc * 1.55}" fill="none" stroke="#FFB27F" stroke-width="${sc * .3}" stroke-dasharray="${sc * .5} ${sc * .35}"/>`; }
    if (g.kind === 'zone') marks += `<circle cx="${g.c.x}" cy="${g.c.y}" r="${g.r}" fill="#E4572E" fill-opacity=".16" stroke="#E4572E" stroke-width="${sc * .2}" stroke-dasharray="${sc * .6} ${sc * .45}"/>` + txt(g.c.x, Math.max(3, g.c.y - g.r + 2.5), g.lab);
    if (g.kind === 'rest') marks += `<rect x="0" y="${g.y}" width="68" height="${105 - g.y}" fill="#E4572E" fill-opacity=".1"/><line x1="0" y1="${g.y}" x2="68" y2="${g.y}" stroke="#E4572E" stroke-width="${sc * .2}" stroke-dasharray="${sc * .8} ${sc * .5}"/>` + txt(4, g.y + 3, g.lab, '#fff', 'start');
    if (g.kind === 'gap') marks += `<path d="M${g.x} ${g.y1} L${g.x + 1.5} ${g.y1} L${g.x + 1.5} ${g.y2} L${g.x} ${g.y2}" fill="none" stroke="#FFB27F" stroke-width="${sc * .25}"/>` + txt(Math.min(64, g.x + 4), (g.y1 + g.y2) / 2, Math.round(g.y1 - g.y2) + ' m', '#FFB27F');
  });
  const s = sc * .95;
  const opp = F.opp.map((o, i) => { const p = pos(o, i); const hot = shown.some(f => f.draw.o === o.id);
    return `<g transform="translate(${p.x} ${p.y})${rot}"><rect x="${-s}" y="${-s}" width="${2 * s}" height="${2 * s}" rx="${s * .3}" fill="${o.gk ? '#9B2C1F' : '#E4572E'}" stroke="${hot ? '#FFD34D' : '#fff'}" stroke-width="${sc * (hot ? .3 : .13)}"/><text font-size="${o.lab.length > 2 ? sc * .62 : sc * .8}" text-anchor="middle" dy=".36em" fill="#fff" font-weight="700" font-family="Inter,Arial,sans-serif">${esc(o.lab)}</text></g>`; }).join('');
  return `<g class="testlayer">${marks}${opp}</g>`;
}
