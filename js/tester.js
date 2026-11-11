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
      q: `What would change so ${p.to ? usName(p.to) : 'she'} can receive?`, draw: { kind: 'cut', a: p.a, b: p.b, o: hit.o.id, P: hit.P },
      who: { us: [[p.from && p.from.id, 'passes'], [p.to && p.to.id, 'receives']].filter(w => w[0]), them: [[hit.o.id, 'gets there first']], spot: hit.P, spotLab: hit.end ? '' : 'Cut out here' } });
    else if (p.to) {
      const near = them.slice().sort((a, b) => d2(a, p.to) - d2(b, p.to))[0];
      if (near && d2(near, p.to) < 2.6) out.push({ key: 'recv:' + p.to.id, type: 'recv', sev: 'look', frame: k, score: 5,
        title: `Your ${usName(p.to)} receives with their ${near.lab} on her`, measure: `${r1(d2(near, p.to))} m away when the ball arrives · she has no time to turn`,
        q: `How does ${usName(p.to)} get half a yard first: a check away, receiving on the half-turn, or a different target?`, draw: { kind: 'tight', p: p.to.id, o: near.id },
        who: { us: [[p.to.id, 'receives']], them: [[near.id, `${r1(d2(near, p.to))} m away`]], spot: p.to } });
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
      q: `Why isn't ${usName(c.p)} the pass here? Does she need to be seen, or is it the right call to go elsewhere?`, draw: { kind: 'free', p: c.p.id, from: fr.carrier.id },
      who: { us: [[c.p.id, `free, ${Math.round(c.near)} m clear`], [fr.carrier.id, 'on the ball']], them: [], spot: c.p } });
  }
  // 3. Outnumbered around the ball.
  const R = 15; const ours = us.filter(p => !p.gk && d2(p, ball) <= R).length; const theirs = them.filter(o => d2(o, ball) <= R).length;
  if (theirs > ours && theirs >= 2) out.push({ key: 'out', type: 'out', sev: theirs - ours >= 2 ? 'serious' : 'look', frame: k, score: 6 + (theirs - ours) * 2,
    title: `Outnumbered around the ball: ${ours} v ${theirs}`, measure: `Players within ${R} m of the ball, keepers not counted`,
    q: 'Who can come closer to make it even, or should the ball go somewhere else first?', draw: { kind: 'zone', c: ball, r: R, lab: `${ours} v ${theirs}` },
    who: { us: us.filter(p => !p.gk && d2(p, ball) <= R).map(p => [p.id, '']), them: them.filter(o => d2(o, ball) <= R).map(o => [o.id, '']), spot: ball } });
  // 4. Rest defence: if we lose it here, who's behind the ball?
  if (ball.y < 78) {
    const back = us.filter(p => !p.gk && p.y > ball.y + 2).length; const fwd = them.filter(o => o.y > ball.y - 3).length;
    if (fwd > back) out.push({ key: 'rest', type: 'rest', sev: back < fwd - 1 || back <= 1 ? 'serious' : 'look', frame: k, score: 7 + (fwd - back) * 2,
      title: `If we lose it here: ${back} of ours v ${fwd} of theirs behind the ball`, measure: `Rest defence · ${Math.round(105 - ball.y)} m to our goal`,
      q: 'Who stays back while we attack, and where do they stand?', draw: { kind: 'rest', y: ball.y, lab: `${back} v ${fwd} behind the ball` },
      who: { us: us.filter(p => !p.gk && p.y > ball.y + 2).map(p => [p.id, '']), them: them.filter(o => o.y > ball.y - 3).map(o => [o.id, '']), spot: { x: 34, y: Math.min(100, ball.y + 8) } } });
  }
  // 5. The gap between our defence and midfield.
  const of = us.filter(p => !p.gk).sort((a, b) => b.y - a.y);
  if (of.length >= 8 && ball.y < 85) {
    const D = of.slice(0, 4), M = of.slice(4, 7); const dy = D.reduce((s, p) => s + p.y, 0) / 4, my = M.reduce((s, p) => s + p.y, 0) / 3; const gap = dy - my;
    if (gap > 22) out.push({ key: 'gap', type: 'gap', sev: gap > 30 ? 'serious' : 'look', frame: k, score: 3 + (gap - 22) / 4,
      title: 'Big gap between your defence and midfield', measure: `${Math.round(gap)} m between the lines · aim for under 20 m`,
      q: 'Does the back line step up, or does midfield drop? What would you tell them?', draw: { kind: 'gap', y1: dy, y2: my, x: Math.max(...M.map(p => p.x)) + 4 } ,
      who: { us: [...D, ...M].map(p => [p.id, '']), them: [], spot: { x: Math.max(...M.map(p => p.x)) + 5, y: (dy + my) / 2 } }});
  }
}

// The same problem over several frames is one finding: keep its worst frame and list the rest.
function merge(list) {
  const by = new Map();
  list.forEach(f => { const o = by.get(f.key); if (!o) by.set(f.key, { ...f, frames: [f.frame] }); else { o.frames.push(f.frame); if (f.score > o.score) Object.assign(o, { ...f, frames: o.frames }); } });
  return [...by.values()].sort((a, b) => (a.sev === b.sev ? 0 : a.sev === 'serious' ? -1 : 1) || b.score - a.score);
}

// What goes on the pitch, in board coordinates. Two layers: under our players (their players and
// shaded areas, so our numbers always show) and over them (lines, rings, the numbered markers).
// focus: one finding alone, with everything else dimmed and the players involved labelled.
export function overlaySvg(F, findings, { focus = null, t = 1, orient = 'v', sc = 2.6, numbers = null } = {}) {
  const H = orient === 'h';
  const rot = H ? ' rotate(-90)' : '';
  // A move in screen terms (right, down) as a move on the board.
  const scr = (x, y, dx, dy) => H ? { x: x + dy, y: y - dx } : { x: x + dx, y: y + dy };
  const top = (x, y) => H ? x : y;             // distance from the top of the screen
  const pos = (o, i) => !F.from || t >= 1 ? o : { x: F.from[i].x + (o.x - F.from[i].x) * t, y: F.from[i].y + (o.y - F.from[i].y) * t };
  const oppPos = F.opp.map(pos);
  const usAt = id => F.fr.us.find(p => p.id === id);
  const oppAt = id => { const i = F.opp.findIndex(o => o.id === id); return i < 0 ? null : { ...F.opp[i], ...oppPos[i] }; };
  const inFrame = f => f.frame === F.k || (f.frames || []).includes(F.k);
  const shown = findings.filter(inFrame).filter(f => !focus || f.key === focus);
  const T = (x, y, s, { fill = '#fff', size = .8, anchor = 'middle', bold = 700 } = {}) => `<g transform="translate(${x} ${y})${rot}"><text font-size="${sc * size}" text-anchor="${anchor}" dy=".35em" fill="${fill}" stroke="rgba(0,0,0,.75)" stroke-width="${sc * .22}" paint-order="stroke" font-weight="${bold}" font-family="Inter,Arial,sans-serif">${esc(s)}</text></g>`;
  // Labels are laid out at the end so they never cover each other, a lit-up player, or leave the pitch.
  const req = [];
  const pill = (x, y, s, col = '#FFD34D', anchorR = 1.5) => { req.push({ x, y, s, col, anchorR }); return ''; };
  const toS = (x, y) => H ? { x: 105 - y, y: x } : { x, y };
  const toB = (sx, sy) => H ? { x: sy, y: 105 - sx } : { x: sx, y: sy };
  const SW = H ? 105 : 68, SH = H ? 68 : 105;
  const layout = (avoid) => {
    const placed = []; let out = '';
    const fs = sc * .74, ph = sc * 1.45;
    const hits = (r) => placed.some(q => r.x1 < q.x2 && r.x2 > q.x1 && r.y1 < q.y2 && r.y2 > q.y1) || avoid.some(c => r.x1 < c.x + c.r && r.x2 > c.x - c.r && r.y1 < c.y + c.r && r.y2 > c.y - c.r);
    req.forEach(q => {
      const a = toS(q.x, q.y); const w = q.s.length * fs * .56 + sc * 1.1; const g = sc * q.anchorR;
      const cands = [[0, -(g + ph / 2)], [0, g + ph / 2], [g + w / 2, 0], [-(g + w / 2), 0], [g * .7 + w / 2, -(g * .7 + ph / 2)], [-(g * .7 + w / 2), -(g * .7 + ph / 2)], [g * .7 + w / 2, g * .7 + ph / 2], [-(g * .7 + w / 2), g * .7 + ph / 2], [0, -(g + ph * 1.6)], [0, g + ph * 1.6], [g + w / 2 + sc * 2, 0], [-(g + w / 2 + sc * 2), 0], [0, -(g + ph * 2.7)], [0, g + ph * 2.7], [g + w / 2, -(g + ph * 1.6)], [-(g + w / 2), g + ph * 1.6]];
      let best = null;
      for (const [dx, dy] of cands) {
        const cx = Math.max(w / 2 + .5, Math.min(SW - w / 2 - .5, a.x + dx)), cy = Math.max(ph / 2 + .5, Math.min(SH - ph / 2 - .5, a.y + dy));
        const r = { x1: cx - w / 2, x2: cx + w / 2, y1: cy - ph / 2, y2: cy + ph / 2, cx, cy };
        if (!hits(r)) { best = r; break; } if (!best) best = r;
      }
      placed.push(best); const b = toB(best.cx, best.cy);
      out += `<g transform="translate(${b.x} ${b.y})${rot}"><rect x="${-w / 2}" y="${-ph / 2}" width="${w}" height="${ph}" rx="${ph / 2}" fill="#0B0F19" fill-opacity=".94" stroke="${q.col}" stroke-width="${sc * .14}"/><text font-size="${fs}" text-anchor="middle" dy=".36em" fill="#fff" font-weight="700" font-family="Inter,Arial,sans-serif">${esc(q.s)}</text></g>`;
    });
    return out;
  };
  const oppTok = (o, { hot = false, size = .8 } = {}) => { const s = sc * size; return `<g transform="translate(${o.x} ${o.y})${rot}"><rect x="${-s}" y="${-s}" width="${2 * s}" height="${2 * s}" rx="${s * .3}" fill="${o.gk ? '#9B2C1F' : '#E4572E'}" stroke="${hot ? '#FFD34D' : '#fff'}" stroke-width="${sc * (hot ? .32 : .12)}"/><text font-size="${o.lab.length > 2 ? s * .62 : s * .8}" text-anchor="middle" dy=".36em" fill="#fff" font-weight="700" font-family="Inter,Arial,sans-serif">${esc(o.lab)}</text></g>`; };
  const usTok = p => `<g transform="translate(${p.x} ${p.y})${rot}"><circle r="${sc * 1.45}" fill="none" stroke="#FFD34D" stroke-width="${sc * .3}"/><circle r="${sc}" fill="${p.gk ? '#2FB67A' : '#3D7BFF'}" stroke="#fff" stroke-width="${sc * .14}"/><text font-size="${sc * .85}" text-anchor="middle" dy=".36em" fill="#fff" font-weight="800" font-family="Inter,Arial,sans-serif">${esc(p.num)}</text></g>`;
  let under = '', marks = '', lit = '', litOpp = '', tags = '', nums = ''; const drawnAt = [];
  shown.forEach(f => {
    const g = f.draw;
    if (g.kind === 'zone') under += `<circle cx="${g.c.x}" cy="${g.c.y}" r="${g.r}" fill="#E4572E" fill-opacity=".16"/>`, marks += `<circle cx="${g.c.x}" cy="${g.c.y}" r="${g.r}" fill="none" stroke="#E4572E" stroke-width="${sc * .2}" stroke-dasharray="${sc * .6} ${sc * .45}"/>` + (focus ? pill(g.c.x, g.c.y - g.r, g.lab + ' within 15 m', '#E4572E', .2) : '');
    if (g.kind === 'rest') under += `<rect x="-3" y="${g.y}" width="74" height="${108 - g.y}" fill="#E4572E" fill-opacity=".12"/>`, marks += `<line x1="0" y1="${g.y}" x2="68" y2="${g.y}" stroke="#E4572E" stroke-width="${sc * .22}" stroke-dasharray="${sc * .8} ${sc * .5}"/>` + (focus ? pill(34, g.y + 2.5, g.lab, '#E4572E', .2) : '');
    if (g.kind === 'gap') marks += `<path d="M${g.x} ${g.y1} L${g.x + 1.6} ${g.y1} L${g.x + 1.6} ${g.y2} L${g.x} ${g.y2}" fill="none" stroke="#FFB27F" stroke-width="${sc * .28}"/>` + T(Math.min(64, g.x + 4.5), (g.y1 + g.y2) / 2, Math.round(g.y1 - g.y2) + ' m', { fill: '#FFB27F', size: .9 });
    if (g.kind === 'cut') { const o = oppAt(g.o);
      marks += `<line x1="${g.a.x}" y1="${g.a.y}" x2="${g.b.x}" y2="${g.b.y}" stroke="#fff" stroke-width="${sc * .3}" stroke-dasharray="${sc * .7} ${sc * .45}" opacity="${focus ? 1 : 0}"/>`;
      if (o) marks += `<line x1="${o.x}" y1="${o.y}" x2="${g.P.x}" y2="${g.P.y}" stroke="#E4572E" stroke-width="${sc * .34}"/>`;
      marks += `<g transform="translate(${g.P.x} ${g.P.y})"><circle r="${sc * .8}" fill="#E4572E" stroke="#fff" stroke-width="${sc * .16}"/><path d="M${-sc * .35} ${-sc * .35} L${sc * .35} ${sc * .35} M${sc * .35} ${-sc * .35} L${-sc * .35} ${sc * .35}" stroke="#fff" stroke-width="${sc * .2}"/></g>`; }
    if (g.kind === 'free') { const p = usAt(g.p), c = usAt(g.from);
      if (p && c) marks += `<line x1="${c.x}" y1="${c.y}" x2="${p.x}" y2="${p.y}" stroke="#7FDDA6" stroke-width="${sc * .3}" stroke-dasharray="${sc * .7} ${sc * .5}"/>`;
      if (p) marks += `<circle cx="${p.x}" cy="${p.y}" r="${sc * 1.7}" fill="none" stroke="#7FDDA6" stroke-width="${sc * .32}"/>`; }
    if (g.kind === 'tight') { const p = usAt(g.p); if (p) marks += `<circle cx="${p.x}" cy="${p.y}" r="${sc * 1.7}" fill="none" stroke="#FFB27F" stroke-width="${sc * .32}" stroke-dasharray="${sc * .5} ${sc * .35}"/>`; }
    // The players involved, lit up and labelled, when this finding is shown alone.
    if (focus && f.who) {
      const ourLit = f.who.us.map(([id]) => usAt(id)).filter(Boolean);
      f.who.them.forEach(([id, l]) => { let o = oppAt(id); if (o) {
        // Standing on one of ours: draw her just beside, with a line to where she really is, so both show.
        const near = ourLit.find(p => d2(p, o) < sc * 2.2);
        if (near) { const dx = o.x - near.x, dy = o.y - near.y, n = Math.hypot(dx, dy) || 1; const at = { x: near.x + dx / n * sc * 2.4, y: near.y + dy / n * sc * 2.4 };
          lit += `<line x1="${o.x}" y1="${o.y}" x2="${at.x}" y2="${at.y}" stroke="#FFD34D" stroke-width="${sc * .15}"/>`; o = { ...o, ...at }; }
        litOpp += oppTok(o, { hot: true, size: .95 }); drawnAt.push(o); if (l) tags += pill(o.x, o.y, `Their ${o.lab} · ${l}`, '#E4572E'); } });
      f.who.us.forEach(([id, l]) => { const p = usAt(id); if (p) { lit += usTok(p); drawnAt.push(p); if (l) tags += pill(p.x, p.y, `${p.num} · ${l}`, '#FFD34D'); } });
      if (f.who.spotLab) tags += pill(f.who.spot.x, f.who.spot.y, f.who.spotLab, '#E4572E', 1.1);
    }
    // The finding's number from the list, beside where it happens.
    if (!focus && f.who && numbers) { const n = numbers.get(f.key); if (n) { const c = scr(f.who.spot.x, f.who.spot.y, sc * 1.6, -sc * 1.6);
      nums += `<g transform="translate(${c.x} ${c.y})${rot}"><circle r="${sc * .95}" fill="#FFD34D" stroke="#0B0F19" stroke-width="${sc * .16}"/><text font-size="${sc * .95}" text-anchor="middle" dy=".36em" fill="#0B0F19" font-weight="800" font-family="Inter,Arial,sans-serif">${n}</text></g>`; } }
  });
  const hot = new Set(shown.flatMap(f => (f.who ? f.who.them : []).map(w => w[0])));
  under += F.opp.map((o, i) => oppTok({ ...o, ...oppPos[i] }, { hot: !focus && hot.has(o.id) })).join('');
  const avoid = [];
  drawnAt.forEach(p => { const c = toS(p.x, p.y); avoid.push({ x: c.x, y: c.y, r: sc * 1.5 }); });
  tags = layout(avoid);
  const veil = focus ? `<rect x="-6" y="-6" width="80" height="117" fill="#0B0F19" fill-opacity=".58"/>` : '';
  return { under: `<g class="testlayer">${under}</g>`, over: `<g class="testmarks">${veil}${focus ? under.replace(/<g transform[^]*$/, '') : ''}${marks}${lit}${litOpp}${tags}${nums}</g>` };
}
