// Practice ideas: drill and session templates drawn from top-level coaching, in our own words,
// each credited to the coach whose session it is based on, with a link to the original.
//
// The link to a coach's own game model is the THEME. Principles are written by the coach in their
// own words, so they can't be matched by text. Each principle is tagged with one theme from the
// fixed list below (the same words every coach and course uses), and every template carries the
// themes it trains. Pick a principle and the library shows what trains it.
//
// Sizes are in metres. Where a source did not give a size, `sizeNote` says so and the size is our
// suggestion.

export const THEMES = {
  build: { phase: 'ip', lab: 'Playing out from the back', words: /play(ing)? out|build|from the back|keeper|goalkeeper|centre-?backs?/i },
  progress: { phase: 'ip', lab: 'Breaking lines through midfield', words: /between the lines|break(ing)? lines|progress|midfield|third (man|player)|half-turn|the 6|the 8|pocket/i },
  switch: { phase: 'ip', lab: 'Keeping the ball and switching play', words: /keep (the )?ball|possession|switch|circulat|patient|rest defence/i },
  final: { phase: 'ip', lab: 'Creating chances in the final third', words: /final third|chance|combin|in behind|runs? beyond|one-?two|overlap|underlap/i },
  lowblock: { phase: 'ip', lab: 'Breaking down a low block', words: /low block|break(ing)? down|deep defence|stubborn|parked/i },
  cross: { phase: 'ip', lab: 'Crossing and finishing', words: /cross|cut-?back|wide areas?|wingers?|finish/i },
  press: { phase: 'op', lab: 'Pressing high', words: /press|high block|front foot|hunt|trigger/i },
  mid: { phase: 'op', lab: 'Mid-block: compact and patient', words: /mid-?block|compact|patient|shape|force (it|play) wide|protect the (centre|middle)/i },
  low: { phase: 'op', lab: 'Low block: protecting the box', words: /low block|box|defend (the )?cross|deep|protect the goal|clear/i },
  counter: { phase: 'ta', lab: 'Counter-attacking', words: /counter|break|fast|forward quickly|in behind|run(s)? forward|transition/i },
  secure: { phase: 'ta', lab: 'Keeping the ball after winning it', words: /secure|keep it|first pass (out|safe)|calm|control/i },
  counterpress: { phase: 'td', lab: 'Counter-pressing: win it back', words: /counter-?press|win it back|seconds|react|immediate|gegen/i },
  recover: { phase: 'td', lab: 'Recovering shape', words: /recover|get back|behind the ball|drop|retreat|shape/i },
  spfor: { phase: 'sp', lab: 'Set pieces: attacking', words: /corner|free[- ]kick|throw|attacking set/i },
  spagainst: { phase: 'sp', lab: 'Set pieces: defending', words: /defend(ing)? (corners|set)|zonal|marking|against/i }
};
export const THEME_KEYS = Object.keys(THEMES);
export const themesFor = phase => THEME_KEYS.filter(k => THEMES[k].phase === phase);

// The theme a principle is about: the one the coach chose, otherwise a best guess from its words.
export function themeOf(p) {
  if (!p) return '';
  if (p.theme && THEMES[p.theme]) return p.theme;
  if (p.theme === 'none') return '';
  const text = [p.title, p.why, p.trigger, ...(p.subs || []).map(s => typeof s === 'string' ? s : (s && s.t) || '')].join(' ');
  const opts = themesFor(p.phase);
  return opts.find(k => THEMES[k].words.test(text)) || '';
}
export const themeGuessed = p => !!p && !(p.theme && THEMES[p.theme]) && !!themeOf(p);

/* ---------- Diagram helpers (drill coordinates: x across, y down, metres) ---------- */
let n = 0;
const id = () => 'tp' + (n++);
const P = (kind, x, y, label) => ({ id: id(), kind, x, y, ...(label ? { label } : {}) });
const box = (w, h, inset = 0.6, color) => [[inset, inset], [w - inset, inset], [inset, h - inset], [w - inset, h - inset]].map(([x, y]) => ({ id: id(), kind: 'disc', x, y, ...(color ? { color } : {}) }));
const ring = (kind, k, cx, cy, r, start = -90) => Array.from({ length: k }, (_, i) => { const a = (start + i * 360 / k) * Math.PI / 180; return P(kind, +(cx + r * Math.cos(a)).toFixed(1), +(cy + r * Math.sin(a)).toFixed(1)); });
const row = (kind, k, y, x0, x1) => Array.from({ length: k }, (_, i) => P(kind, +(k === 1 ? (x0 + x1) / 2 : x0 + i * (x1 - x0) / (k - 1)).toFixed(1), y));
const line = (x0, y, x1) => { const out = []; const steps = Math.max(2, Math.round((x1 - x0) / 5)); for (let i = 0; i <= steps; i++) out.push({ id: id(), kind: 'disc', x: +(x0 + i * (x1 - x0) / steps).toFixed(1), y, color: '#FFFFFF' }); return out; };
const vline = (x, y0, y1) => { const out = []; const steps = Math.max(2, Math.round((y1 - y0) / 5)); for (let i = 0; i <= steps; i++) out.push({ id: id(), kind: 'disc', x, y: +(y0 + i * (y1 - y0) / steps).toFixed(1), color: '#FFFFFF' }); return out; };
const goal = (x, y) => ({ id: id(), kind: 'goal', x, y });
const mini = (x, y) => ({ id: id(), kind: 'minigoal', x, y });
const ball = (x, y) => ({ id: id(), kind: 'ball', x, y });
const zone = (x, y, zw, zh) => ({ id: id(), kind: 'zone', x, y, zw, zh });

const FTC = 'FIFA Training Centre';
const src = (who, role, url, note) => ({ who, role, where: FTC, url, ...(note ? { note } : {}) });

/* ---------- Drill templates ---------- */
export const DRILL_TEMPLATES = [
  // ===== Counter-pressing and pressing rondos =====
  {
    id: 't-milly', name: '5v2 pressing rondo (“Milly’s rondo”)', themes: ['counterpress', 'press'], pops: ['del', 'com'],
    type: 'Warm-up', w: 10, h: 10, players: 7, minutes: 12,
    objective: 'The two in the middle hunt the ball together and try to win it in the first few passes, the way you want to react the moment you lose it.',
    org: '10 x 10 m box. Five on the outside, two in the middle. Spare balls at a corner.',
    how: 'The five keep the ball. The two in the middle press as a pair. If they intercept within the first six passes, both come out and the two who lost it go in. If it takes longer, only the player who won it comes out.',
    points: 'First presser goes at full speed and bends the run to cut off one side. Second presser reads the next pass, not the ball. Outside players keep moving so the middle pair have to keep re-pressing.',
    prog: 'Reward an interception in the first three passes with a point. Two touches for the outside.', reg: 'Bigger box. Unlimited touches.',
    transition: 'Whoever loses the ball goes straight into the middle: no walking.', questions: 'Who presses first, and which way do you make them pass?\nWhere does the second presser stand when the first one goes?',
    stepIn: 'the middle pair press one at a time, or both chase the ball', success: 'The middle pair win it inside six passes at least one time in three',
    corners: { tech: 'Interceptions; body shape when pressing', psych: 'Hunger to win it back', phys: 'Repeated short sprints', soc: 'Pressing as a pair' },
    src: { who: 'Pep Lijnders and Jürgen Klopp', role: 'Liverpool coaching staff', where: 'Training Ground Guru', url: 'https://archive.trainingground.guru/articles/lijnders-how-liverpool-build-counterpressing-into-every-session', note: 'Named after James Milner, who kept winning it in the first few passes. Lijnders calls it a pressing rondo, not a possession game.' },
    items: () => [...box(10, 10), ...ring('att', 5, 5, 5, 4.2), P('def', 4.2, 5), P('def', 6, 5.6), ball(5, 1.4)]
  },
  {
    id: 't-6v3', name: '6v3 tactical rondo: press as a triangle', themes: ['counterpress', 'press'], pops: ['del', 'cov', 'com'],
    type: 'Skill (opposed)', w: 11, h: 11, players: 9, minutes: 15,
    objective: 'Three defenders hunt the ball as a unit: one presses, one blocks the next pass, one reorganises behind.',
    org: 'About 11 x 11 m (12 x 12 yards). Six keep the ball, three press.',
    how: 'The six keep possession. The three try to win it working as a triangle. Swap the three regularly, or swap whoever loses it with whoever wins it.',
    points: 'Closest player presses at full effort. The next blocks the passing line to the obvious receiver. The third reads the pass after that. When the ball goes past, all three reset together.',
    prog: 'Limit the six to two touches. Make the box smaller.', reg: 'Seven on the outside. Bigger box.',
    transition: 'When the three win it, they play out of the box to a target or a mini-goal.', questions: 'When the first presser goes, where does the second stand?\nWhat tells you the press has been beaten and it is time to reset?',
    stepIn: 'two of the three press the same player', success: 'The three win it back inside 10 seconds most of the time',
    corners: { tech: 'Pressing angles', psych: 'Accepting that a pressing team makes mistakes', phys: 'High intensity in short bursts', soc: 'Talking to the next presser' },
    src: { who: 'Jürgen Klopp', role: 'Liverpool manager', where: 'Training Ground Guru, from Elite Soccer', url: 'https://archive.trainingground.guru/articles/lijnders-how-liverpool-build-counterpressing-into-every-session', note: 'Liverpool followed 20 minutes of this with a 30-minute 8v6 game.' },
    items: () => [...box(11, 11), ...ring('att', 6, 5.5, 5.5, 4.6), ...ring('def', 3, 5.5, 5.5, 1.6, -90), ball(5.5, 1.2)]
  },
  {
    id: 't-trans-rondos', name: 'Transitional rondos: lose it, go and win one back', themes: ['counterpress'], pops: ['del', 'com'],
    type: 'Warm-up', w: 28, h: 28, players: 14, minutes: 12,
    objective: 'Turn losing the ball into an instant reaction: the player who loses it sprints to another box to win one back.',
    org: 'Four 8 x 8 m boxes about 10 m apart. Two boxes are 3v1 rondos; the other two hold three players waiting.',
    how: 'In the 3v1s, the outside three keep the ball. Whoever loses it runs to another box to press there, so every box keeps changing.',
    points: 'React before you think: the run starts the moment the ball is lost. Arrive at speed and slow down at the last moment so you are not beaten by one pass.',
    prog: 'Three 10 x 10 m boxes with a 4v2, two touches. The player who loses it and the one on their left both go to another box.', reg: 'Bigger boxes, unlimited touches.',
    transition: 'Defenders who win it pass into another box; the group that lost it can try to win it back before the pass gets out.', questions: 'What is the first thing you do when you lose it?\nWho goes with you?',
    stepIn: 'players walk to the next box', success: 'Every loss is followed by a sprint within a second',
    corners: { tech: 'Passing in tight areas', psych: 'Reaction to losing the ball', phys: 'Repeated sprints', soc: 'Pairing up to press' },
    src: src('Noureddine Boubou', 'Morocco U-13 coach', 'https://www.fifatrainingcentre.com/en/practice/elite-sessions/transition-to-defending/counter-pressing.php'),
    items: () => [
      ...box(8, 8, 0).map(d => ({ ...d, x: d.x + 1, y: d.y + 1 })), ...box(8, 8, 0).map(d => ({ ...d, x: d.x + 19, y: d.y + 1 })),
      ...box(8, 8, 0).map(d => ({ ...d, x: d.x + 1, y: d.y + 19 })), ...box(8, 8, 0).map(d => ({ ...d, x: d.x + 19, y: d.y + 19 })),
      ...ring('att', 3, 5, 5, 3), P('def', 5, 5.6), ...ring('att', 3, 23, 23, 3), P('def', 23, 23.6),
      ...ring('neu', 3, 23, 5, 2.5), ...ring('neu', 3, 5, 23, 2.5), ball(5, 2.2), ball(23, 20.2)]
  },
  {
    id: 't-4v4p4', name: '4v4 + 4 possession: win it, score in a mini-goal', themes: ['counterpress', 'counter', 'switch'], pops: ['sup', 'del', 'com'],
    type: 'Small-sided game', w: 18, h: 12, players: 12, minutes: 15,
    objective: 'Keep the ball with the help of four neutrals; the moment you lose it, win it back before they score.',
    org: '18 x 12 m with a halfway line. Four mini-goals about 5 m outside the corners. Two teams of four, four neutrals (two inside, one at each end outside).',
    how: 'The team in possession keeps it with the neutrals. Every turnover swaps roles. Three touches for the teams, two for the neutrals.',
    points: 'Nearest player presses the ball straight away to win it or stop the forward pass. The others close the space around the ball. Protect the middle first so they have to go wide.',
    prog: 'Two touches for the teams, one for the neutrals. The team that wins it can score in any mini-goal.', reg: 'Unlimited touches. No mini-goals.',
    transition: 'Once mini-goals are in: the team that wins it attacks them straight away; the team that lost it must stop them.', questions: 'Where do they want to go once they win it?\nWho blocks that pass?',
    stepIn: 'the nearest player waits for help instead of pressing', success: 'Lost balls are won back before a mini-goal is scored most of the time',
    corners: { tech: 'Two-touch passing under pressure', psych: 'Reacting to mistakes', phys: 'Intensity', soc: 'Communicating to the player in front' },
    src: src('Noureddine Boubou', 'Morocco U-13 coach', 'https://www.fifatrainingcentre.com/en/practice/elite-sessions/transition-to-defending/counter-pressing.php'),
    items: () => [...box(18, 12, 0), { id: id(), kind: 'disc', x: 9, y: 0, color: '#FFFFFF' }, { id: id(), kind: 'disc', x: 9, y: 12, color: '#FFFFFF' },
      mini(-1.2, -1.2), mini(19.2, -1.2), mini(-1.2, 13.2), mini(19.2, 13.2),
      ...[[4, 3], [4, 9], [13, 3], [13, 9]].map(([x, y]) => P('att', x, y)), ...[[6, 6], [8, 3], [11, 9], [14, 6]].map(([x, y]) => P('def', x, y)),
      P('neu', 9, 4), P('neu', 9, 8), P('neu', -1.5, 6), P('neu', 19.5, 6), ball(4.8, 3.6)]
  },

  // ===== Playing out from the back =====
  {
    id: 't-cb-step', name: 'Centre-back step-in: one-two, then drive past the 9', themes: ['build'], pops: ['pen', 'mob'],
    type: 'Skill (opposed)', w: 15, h: 20, players: 8, minutes: 12,
    objective: 'Give centre-backs the confidence to step into midfield with the ball when the striker presses.',
    org: '20 m long x 15 m wide. Three starting points: centre-back (A), midfielder (B) at a mannequin, striker (C). Two gates at the far end.',
    how: 'A plays a one-two with B, then takes on C and drives through either gate. C closes down but does not tackle at first. Rotate: A to C, C to B, B to A.',
    points: 'The lay-off has to be weighted perfectly. First touch into the space ahead. Change direction, then burst away. Be brave stepping into gaps.',
    prog: 'The striker presses for real.', reg: 'Striker only shadows.',
    transition: 'Once the striker presses fully, if C wins it they can score in a mini-goal behind A.', questions: 'Where is the space when the 9 commits to you?\nWhen do you pass instead of carrying?',
    stepIn: 'centre-backs take their first touch backwards', success: 'Centre-back drives through a gate on most turns once the striker presses fully',
    corners: { tech: 'First touch forward; carrying with the ball', psych: 'Bravery on the ball', phys: 'Acceleration', soc: '' },
    src: src('Claire Lynne Smith', 'Stoke City coach', 'https://www.fifatrainingcentre.com/en/practice/elite-sessions/in-possession/playing-out-centrally.php'),
    items: () => [...box(15, 20, 0), P('att', 7.5, 18, 'A'), P('att', 4, 12, 'B'), { id: id(), kind: 'mannequin', x: 4, y: 10.5 }, P('def', 7.5, 10, 'C'),
      { id: id(), kind: 'pole', x: 3, y: 1 }, { id: id(), kind: 'pole', x: 6, y: 1 }, { id: id(), kind: 'pole', x: 9, y: 1 }, { id: id(), kind: 'pole', x: 12, y: 1 }, ball(7.5, 17)]
  },
  {
    id: 't-spare', name: 'Find the spare midfielder: receive on the half-turn', themes: ['build', 'progress'], pops: ['sup', 'mob', 'pen'],
    type: 'Skill (opposed)', w: 15, h: 15, players: 8, minutes: 15,
    objective: 'Centre-back receives side-on and finds the midfielder who has got free from the striker’s cover shadow.',
    org: '15 x 15 m. Two mini-goals outside the far corners. A server, a centre-back (B) between two cones, a striker (C) screening between two central cones, two midfielders (D and E).',
    how: 'Server passes to B. B plays either side of C to D or E, who have moved to receive on the half-turn and finish into the diagonally opposite mini-goal. Rotate with players waiting.',
    points: 'B receives on the half-turn and scans before the ball arrives. Midfielders time their run and use blindside movement. Open the body so the first touch goes forward.',
    prog: 'C can press anywhere. Add a second defender (E) so the midfielders play 2v1 after receiving; defenders score by winning it and finding the server.', reg: 'Make the area bigger. C stays between the cones.',
    transition: 'In the progression: defenders who win it score by passing back to the server or coach.', questions: 'Which midfielder is free, and how do you know before the ball comes?\nWhat makes the pass easy to receive?',
    stepIn: 'midfielders stand still and wait for the ball', success: 'The pass finds a midfielder facing forward 7 times in 10',
    corners: { tech: 'Receiving on the half-turn; crisp passing', psych: 'Scanning', phys: '', soc: 'Timing runs off each other' },
    src: src('Claire Lynne Smith', 'Stoke City coach', 'https://www.fifatrainingcentre.com/en/practice/elite-sessions/in-possession/playing-out-centrally.php'),
    items: () => [...box(15, 15, 0), mini(1.5, -1.4), mini(13.5, -1.4), P('coach', 7.5, 16.5, 'S'), P('att', 7.5, 12.5, 'B'), P('def', 7.5, 8, 'C'), P('att', 3, 5, 'D'), P('att', 12, 5, 'E'),
      { id: id(), kind: 'disc', x: 6, y: 8 }, { id: id(), kind: 'disc', x: 9, y: 8 }, ball(7.5, 15.5)]
  },
  {
    id: 't-gk-build', name: 'Build up centrally from the keeper: 5v3 into 5v4', themes: ['build'], pops: ['sup', 'wid', 'pen'],
    type: 'Phase of play', w: 40, h: 33, players: 9, minutes: 20,
    objective: 'Put the step-ins and half-turns into a real build-up against a press.',
    org: 'An area two penalty boxes long. One full-size goal with a keeper; two mini-goals at the other end. Five (keeper plus four) build out; three pressers start at the mini-goals. A server feeds the keeper.',
    how: 'Play starts with the keeper. Pressers wait outside the box until the keeper passes to a centre-back, then press. The five try to play out and score in a mini-goal; pressers who win it can score in the big goal.',
    points: 'Centre-backs stretch wide to open angles. Midfielders never stand level with the centre-backs. Recognise the press and answer it: against man-to-man, stretch the pitch and look for the switch.',
    prog: 'Add a fourth presser. Pressers start man-to-man, then switch to a half-press using cover shadows to funnel play.', reg: 'Pressers can only intercept, not tackle.',
    transition: 'Pressers who win it attack the big goal at once.', questions: 'How are they pressing us, and where is the free player?\nWhen is going long the right answer?',
    stepIn: 'the midfielders stand level with the centre-backs', success: 'The ball reaches a mini-goal from a central route 4 times in 10',
    corners: { tech: 'Weight and angle of pass', psych: 'Composure under pressure', phys: '', soc: 'Reading the press together' },
    src: src('Claire Lynne Smith', 'Stoke City coach', 'https://www.fifatrainingcentre.com/en/practice/elite-sessions/in-possession/playing-out-centrally.php'),
    items: () => [goal(20, 33), P('gk', 20, 31.5), P('att', 10, 27), P('att', 30, 27), P('att', 16, 21), P('att', 24, 17),
      P('def', 14, 14), P('def', 26, 14), P('def', 20, 9), mini(12, 0), mini(28, 0), ...line(0, 16.5, 40), ball(20, 30.5)]
  },
  {
    id: 't-thirds', name: 'Play through the thirds in a tight area', themes: ['build', 'progress'], pops: ['pen', 'sup', 'wid'],
    type: 'Skill (opposed)', w: 15, h: 30, players: 9, minutes: 15,
    objective: 'Get the ball from one end to the other through a crowded middle, playing forward whenever it is on.',
    org: '30 x 15 m split into thirds, keepers at both ends. Two attackers in each end zone. Three attackers and two defenders (plus two mannequins) in the middle third.',
    how: 'Work the ball from one keeper to the other through the middle. The two defenders try to stop passes through the middle. The ball must reach a keeper before going back the other way. Rotate defenders often.',
    points: 'Treat the thirds as the back, middle and front lines. Pass to feet so the receiver can break the line. If they are narrow, go wide; if they are stretched, the central player is free. The central player must not drop out of the middle.',
    prog: 'The two defenders can leave the middle to press the end zones.', reg: 'Take a mannequin out. Unlimited touches.',
    transition: 'Add: if a defender wins it, they score by passing to either keeper.', questions: 'Are they narrow or stretched, and what does that tell you?\nWhat happens if the central player drops?',
    stepIn: 'the ball goes sideways in the end zone more than twice', success: 'Ball travels keeper to keeper without losing it 6 times in 10',
    corners: { tech: 'Line-breaking passes', psych: 'Reading the defenders', phys: '', soc: 'Movement to give angles' },
    src: src('Rehanne Skinner', 'then Tottenham Hotspur Women head coach', 'https://www.fifatrainingcentre.com/en/practice/elite-sessions/in-possession/building_from_the_back_skinner.php'),
    items: () => [...box(15, 30, 0), ...line(0, 10, 15), ...line(0, 20, 15), P('gk', 7.5, 0.5), P('gk', 7.5, 29.5), P('att', 4, 4), P('att', 11, 4), P('att', 4, 26), P('att', 11, 26),
      P('att', 3, 15), P('att', 7.5, 13), P('att', 12, 15), P('def', 6, 16), P('def', 9.5, 14), { id: id(), kind: 'mannequin', x: 5, y: 12 }, { id: id(), kind: 'mannequin', x: 10, y: 18 }, ball(7.5, 28.5)]
  },
  {
    id: 't-wide-10v10', name: '10v10: overload the wide areas in build-up', themes: ['build', 'progress'], pops: ['wid', 'mob', 'pen'],
    type: 'Small-sided game', w: 40, h: 50, players: 20, minutes: 20,
    objective: 'Full-backs use the wide channels to progress when the middle is closed.',
    org: '50 x 40 m in thirds, with a 10 m channel on each side of the middle third. Both teams 4-3-2 plus keeper. Only four players per team in either end zone at a time.',
    how: 'Normal game. Only the full-backs of the team in possession may enter the wide channels; any defender may go in to close them down. Centre-backs may carry into the middle if there is space.',
    points: 'Full-backs read who is closing them down: a full-back or a midfielder leaves different space. First touch to see the whole pitch. Quick decisions on where to progress.',
    prog: 'One or two forwards may drop into the middle; the defending centre-backs cannot follow. Then: no more than two per team in the middle, so the channels must be overloaded.', reg: 'Make the channels wider.',
    transition: 'Normal game: whoever wins it can attack straight away.', questions: 'Who is coming to press you, and where does that leave space?\nWhen do you go inside instead?',
    stepIn: 'full-backs receive facing their own goal', success: 'A full-back in the channel plays forward on most build-ups',
    corners: { tech: 'First touch out wide', psych: 'Decision-making', phys: 'Overlapping runs', soc: 'Wide triangles' },
    src: src('Rehanne Skinner', 'then Tottenham Hotspur Women head coach', 'https://www.fifatrainingcentre.com/en/practice/elite-sessions/in-possession/building_from_the_back_skinner.php'),
    items: () => [...box(40, 50, 0), ...line(0, 16.7, 40), ...line(0, 33.3, 40), ...vline(10, 16.7, 33.3), ...vline(30, 16.7, 33.3), goal(20, 0), goal(20, 50),
      P('gk', 20, 48.5), P('att', 6, 40), P('att', 15, 44), P('att', 25, 44), P('att', 34, 40), P('att', 13, 27), P('att', 20, 30), P('att', 27, 27), P('att', 15, 12), P('att', 25, 12),
      P('gk', 20, 1.5), P('def', 6, 10), P('def', 15, 6), P('def', 25, 6), P('def', 34, 10), P('def', 14, 22), P('def', 20, 20), P('def', 26, 22), P('def', 16, 37), P('def', 24, 37), ball(20, 47)]
  },
  {
    id: 't-11v9', name: '11v9: play through the press from the keeper', themes: ['build'], pops: ['pen', 'sup', 'wid'],
    type: 'Phase of play', w: 50, h: 75, players: 20, minutes: 20,
    objective: 'Play out against a front three in a real shape, choosing the right route.',
    org: 'Three-quarters of a pitch (75 x 50 m). Team of 11 in 4-3-3; team of 9 in 2-3-3 with two mannequins as full-backs.',
    how: 'Play always starts with the 11’s keeper. Full-backs start on the back shoulder of their midfield; wingers stay high outside the full-backs; centre-forwards stay high on the centre-backs.',
    points: 'Centre-backs carry and step into midfield to draw players out. If the lane to the winger is closed, the full-back is free, and the other way round. If the keeper is under real pressure, clip over the first line.',
    prog: 'Wingers press the centre-backs from the outside and force them inside, so play has to go through the middle.', reg: 'Pressing team plays at walking pace for the first two minutes.',
    transition: 'If the 9 win it, they attack the goal at once.', questions: 'Who is free when their winger presses our centre-back?\nWhen should the keeper go over the top?',
    stepIn: 'centre-backs pass sideways without looking to carry', success: 'Build-ups reach the halfway line under control 6 in 10',
    corners: { tech: 'Carrying; clipped passes', psych: 'Patience', phys: '', soc: 'Full-back and winger timing' },
    src: src('Rehanne Skinner', 'then Tottenham Hotspur Women head coach', 'https://www.fifatrainingcentre.com/en/practice/elite-sessions/in-possession/building_from_the_back_skinner.php'),
    items: () => [goal(25, 75), P('gk', 25, 73.5), P('att', 6, 62), P('att', 18, 68), P('att', 32, 68), P('att', 44, 62), P('att', 25, 56), P('att', 17, 48), P('att', 33, 48), P('att', 6, 36), P('att', 44, 36), P('att', 25, 34),
      goal(25, 0), P('gk', 25, 1.5), P('def', 19, 22), P('def', 31, 22), P('def', 25, 40), P('def', 18, 45), P('def', 32, 45), P('def', 10, 58), P('def', 40, 58), P('def', 25, 62), { id: id(), kind: 'mannequin', x: 8, y: 28 }, { id: id(), kind: 'mannequin', x: 42, y: 28 }, ball(25, 72)]
  },
  {
    id: 't-5v4-zones', name: '5v4 attack v defence: play out against a high block', themes: ['build', 'progress'], pops: ['pen', 'sup'],
    type: 'Phase of play', w: 20, h: 60, players: 11, minutes: 15,
    objective: 'The spine of the team plays forward through a high press, and can’t go back once it has.',
    org: '60 x 20 m split into three zones across, with a full-size goal at each end. Three players stay in their build-up zone; others move between zones. Offside applies.',
    how: 'The team playing out works the ball through the zones to score. Once the ball leaves the build-up zone it can’t be played back into it.',
    points: 'Create passing lines to bypass the first press. Blindside runs to get away from markers. Each zone tells you which action is needed: build, progress, finish.',
    prog: 'Add a defender to make it 5v5.', reg: 'Allow one pass back into the build-up zone.',
    transition: 'Defenders who win it attack the other goal.', questions: 'Which line do we have to break first?\nWhat run makes the pass easy?',
    stepIn: 'the team plays backwards into trouble once the ball has left the zone', success: 'Ball leaves the build-up zone under control 6 in 10',
    corners: { tech: 'Passing through lines', psych: 'Commitment to playing forward', phys: '', soc: 'Spine of the team working together' },
    src: { who: 'FIFA Talent Coach Programme', role: 'FIFA', where: FTC, url: 'https://fifatrainingcentre.com/en/practice/talent-coach-programme/build-and-progress/5v4-attack-v-defence-playing-out-from-the-back.php' },
    items: () => [...box(20, 60, 0), ...line(0, 20, 20), ...line(0, 40, 20), goal(10, 0), goal(10, 60), P('gk', 10, 58.5), P('att', 5, 50), P('att', 15, 50), P('att', 10, 43), P('att', 10, 30), P('att', 10, 15),
      P('def', 7, 45), P('def', 13, 45), P('def', 10, 35), P('def', 10, 22), P('gk', 10, 1.5), ball(10, 57)]
  },

  // ===== Breaking lines and keeping the ball =====
  {
    id: 't-6v6p4', name: '6v6 + 4: find pockets and the third player', themes: ['progress', 'switch'], pops: ['sup', 'mob', 'cre'],
    type: 'Small-sided game', w: 30, h: 30, players: 20, minutes: 15,
    objective: 'Keep the ball by receiving in the pockets between opponents and using the third player when pressed.',
    org: '30 x 30 m. Two teams of ten: 6v6 inside, four of each team outside (one on each side).',
    how: 'Keep possession. You can use your outside players, but whoever passes to an outside player swaps places with them.',
    points: 'Find the space between opponents to open a line and receive past them. Under pressure from behind, play into a supporting team-mate to free a third player. Take the easy pass to keep the ball moving.',
    prog: 'Two touches inside. Score a point for a pass that goes between two opponents.', reg: 'Outside players stay outside, no swap.',
    transition: 'Every turnover: the team that wins it must make two passes before the opponents can win it back to score a point.', questions: 'Where is the pocket right now?\nWho is the third player when you have a defender on your back?',
    stepIn: 'players stand in the same line as the opponent marking them', success: 'At least one line-breaking pass in most possessions',
    corners: { tech: 'Receiving between lines', psych: 'Scanning', phys: '', soc: 'Third-player combinations' },
    src: src('Nils Nielsen', 'former Switzerland and Denmark women’s head coach', 'https://fifatrainingcentre.com/en/practice/elite-sessions/in-possession/nils-nielsen-solutions-in-the-final-third.php'),
    items: () => [...box(30, 30, 0), ...[[6, 8], [15, 6], [24, 9], [8, 20], [16, 18], [23, 23]].map(([x, y]) => P('att', x, y)), ...[[10, 12], [19, 11], [12, 24], [21, 17], [6, 15], [26, 14]].map(([x, y]) => P('def', x, y)),
      P('att', 15, -1.5), P('att', 31.5, 15), P('def', 15, 31.5), P('def', -1.5, 15), ball(16, 17)]
  },
  {
    id: 't-3team-switch', name: 'Three teams: keep it, then switch it end to end', themes: ['switch'], pops: ['wid', 'sup', 'con'],
    type: 'Skill (opposed)', w: 18, h: 36, players: 15, minutes: 15,
    objective: 'Keep the ball under pressure, then switch it to the far end at the right moment.',
    org: 'Three zones in a line: an end zone at each end, a middle zone. Three teams of five: one in each end zone, the third team in the middle. Size not given in the source: about 36 x 18 m works.',
    how: 'The team with the ball keeps it in its end zone and must make three to five passes before switching it to the team at the far end. Only two of the middle team may go into an end zone to press.',
    points: 'Stretch the zone before switching. The pass across has to be firm and in the air or on the ground through a gap. Receivers take their first touch away from pressure.',
    prog: 'Three of the middle team may press. Two touches.', reg: 'One presser only.',
    transition: 'If the middle team wins it, they swap with the team that lost it.', questions: 'When is the switch on?\nHow do you make space before you switch?',
    stepIn: 'teams force the switch before it is on', success: 'Switches arrive under control most of the time',
    corners: { tech: 'Long passing; first touch', psych: 'Patience', phys: '', soc: '' },
    src: src('Lamia Boumehdi', 'coach and FIFA technical expert', 'https://www.fifatrainingcentre.com/en/practice/elite-sessions/in-possession/switching_play.php'),
    sizeNote: 'Size is our suggestion; the source does not give one.',
    items: () => [...box(18, 36, 0), ...line(0, 10, 18), ...line(0, 26, 18), ...ring('att', 5, 9, 5, 4), ...ring('def', 5, 9, 18, 4), ...ring('neu', 5, 9, 31, 4), ball(9, 2)]
  },
  {
    id: 't-switch-9v8', name: '9v8: goals count double after a switch', themes: ['switch', 'lowblock'], pops: ['wid', 'pen', 'sup'],
    type: 'Phase of play', w: 50, h: 60, players: 17, minutes: 20,
    objective: 'Move the ball side to side to attack where they have the fewest defenders.',
    org: 'Large pitch with goals and keepers at each end and a line down the middle. Blues 3-3-3 (a 4-3-3 in miniature), oranges 3-3-2 (a 3-5-2). Size not given in the source: about 60 x 50 m works.',
    how: 'Normal game. A goal is worth 1, or 2 if the move switched play across the middle line.',
    points: 'Use central players as anchors to switch through. Stretch the pitch before switching. Decide: build possession first, or switch now? A quick switch hits the side with the fewest defenders.',
    prog: 'Only first-time finishes count. Then: 3 points for a goal after eight or more passes. Then: if you lose it but win it back before they cross halfway, carry on the move.', reg: 'Allow the defending team only 7.',
    transition: 'In the last progression, counter-press to win it back before halfway.', questions: 'Which side has fewer of them right now?\nWho is the anchor for the switch?',
    stepIn: 'the switch is forced with the defence already shifted', success: 'Half the goals come after a switch',
    corners: { tech: 'Range of passing', psych: 'Timing the switch', phys: '', soc: '' },
    src: src('Ben Bartlett', 'Fulham FC head of academy coaching', 'https://fifatrainingcentre.com/en/practice/elite-sessions/in-possession/switching--play.php'),
    sizeNote: 'Size is our suggestion; the source does not give one.',
    items: () => [...box(50, 60, 0), ...vline(25, 0, 60), goal(25, 0), goal(25, 60), P('gk', 25, 58.5), ...row('att', 3, 50, 12, 38), ...row('att', 3, 36, 10, 40), ...row('att', 3, 20, 8, 42),
      P('gk', 25, 1.5), ...row('def', 3, 12, 14, 36), ...row('def', 3, 26, 10, 40), ...row('def', 2, 42, 18, 32), ball(25, 48)]
  },

  // ===== Final third, low blocks, crossing =====
  {
    id: 't-1v3', name: '1v3 with support: beat players on your own', themes: ['lowblock', 'final'], pops: ['cre', 'pen'],
    type: 'Skill (opposed)', w: 40, h: 30, players: 12, minutes: 20,
    objective: 'Give attackers the confidence to take players on in the final third, using support only when it helps.',
    org: '30 m long x 40 m wide with a full-size goal and keeper. Three groups of four: action players inside, wide support (two each side), central support spread across.',
    how: 'Central support plays the ball in. Whoever receives attacks; the other three action players defend (1v3). The attacker can use the support players. A defender who wins it becomes the attacker.',
    points: 'Use skills, dribbles and changes of pace to get into scoring positions. Attack without fear of mistakes. Win it and think attack straight away.',
    prog: 'Support players one touch.', reg: '1v2.',
    transition: 'Built in: a defender who wins it attacks at once.', questions: 'When do you go on your own and when do you use support?\nWhere is the shooting chance?',
    stepIn: 'attackers pass back instead of trying the 1v1', success: 'Attackers get a shot off in most attempts',
    corners: { tech: 'Dribbling; finishing', psych: 'Bravery', phys: 'Change of pace', soc: '' },
    src: src('Aidy Boothroyd', 'former England U-21 coach', 'https://www.fifatrainingcentre.com/en/practice/elite-sessions/in-possession/boothroyd-breaking-down-a-low-block.php'),
    items: () => [goal(20, 0), P('gk', 20, 1.5), ...box(40, 30, 0), P('att', 20, 16), ...ring('def', 3, 20, 13, 4), P('neu', 2, 10), P('neu', 2, 20), P('neu', 38, 10), P('neu', 38, 20), ...row('neu', 4, 29, 8, 32), ball(20, 18)]
  },
  {
    id: 't-3v2', name: '3v2 into the box: penetrating passes and combinations', themes: ['final', 'lowblock'], pops: ['pen', 'sup', 'mob'],
    type: 'Skill (opposed)', w: 40, h: 30, players: 12, minutes: 20,
    objective: 'Break a back line with passes and runs, and finish first time.',
    org: '30 m x 40 m, full-size goal and keeper. Wide support (two each side), three central support, and inside: two attackers, a floater and two defenders.',
    how: 'Central support plays in; the floater joins the attackers to make 3v2. Support players can be used. If the defenders win it, they attack and the others try to win it back.',
    points: 'Think about movement with and without the ball. Create space for one-touch finishes. Support players who pass follow into the box to new spaces.',
    prog: 'Only first-time finishes count. Then: support players follow their pass in and join the attack.', reg: '3v1.',
    transition: 'Defenders who win it attack the far end through the support players.', questions: 'Which run pulls a defender away?\nWhere does the finish come from?',
    stepIn: 'the three all want the ball to feet', success: 'A first-time chance in most attacks',
    corners: { tech: 'One-twos; first-time finishing', psych: '', phys: '', soc: 'Combination timing' },
    src: src('Aidy Boothroyd', 'former England U-21 coach', 'https://www.fifatrainingcentre.com/en/practice/elite-sessions/in-possession/boothroyd-breaking-down-a-low-block.php'),
    items: () => [goal(20, 0), P('gk', 20, 1.5), ...box(40, 30, 0), P('att', 14, 14), P('att', 26, 14), P('neu', 20, 18), P('def', 17, 9), P('def', 23, 9), P('neu', 2, 10), P('neu', 2, 20), P('neu', 38, 10), P('neu', 38, 20), ...row('neu', 3, 29, 12, 28), ball(20, 27)]
  },
  {
    id: 't-4v4-cross', name: '4v4 in the box: goals only from crosses and cut-backs', themes: ['cross', 'lowblock'], pops: ['wid', 'pen', 'mob'],
    type: 'Small-sided game', w: 40, h: 30, players: 13, minutes: 20,
    objective: 'Wide players pick out runners instead of crossing blindly, and runners time their arrival.',
    org: '30 m x 40 m, full-size goal and keeper. 4v4 inside; five support players outside (two each side, one central).',
    how: 'Central support plays in. The team with the ball works it wide; the wide player crosses early from the edge of the box or goes to the byline and cuts back. Only goals from crosses count. If the other team wins it, they use a support player to start their own attack.',
    points: 'Pick out a runner, don’t just hit the area. The cross depends on the build-up and the space. Central runners time their run to the delivery: near post, far post, cut-back zone.',
    prog: 'Wide players one touch. Then: wide players can carry into the box first. Then: full-backs overlap and cross.', reg: 'Unopposed crosses first.',
    transition: 'Defenders who win it play to a support player and attack the other way.', questions: 'Where are the three places to attack a cross?\nWhen is the cut-back better than the cross?',
    stepIn: 'runners all arrive in the same place', success: 'Most crosses find a team-mate',
    corners: { tech: 'Crossing technique; finishing', psych: '', phys: 'Timed sprints into the box', soc: 'Crosser and runner understanding' },
    src: src('Aidy Boothroyd', 'former England U-21 coach', 'https://www.fifatrainingcentre.com/en/practice/elite-sessions/in-possession/boothroyd-breaking-down-a-low-block.php'),
    items: () => [goal(20, 0), P('gk', 20, 1.5), ...box(40, 30, 0), ...[[12, 12], [20, 16], [28, 12], [20, 8]].map(([x, y]) => P('att', x, y)), ...[[15, 9], [25, 9], [20, 5], [18, 13]].map(([x, y]) => P('def', x, y)),
      P('neu', 2, 6), P('neu', 2, 18), P('neu', 38, 6), P('neu', 38, 18), P('neu', 20, 29), ball(20, 27.5)]
  },
  {
    id: 't-low-11v11', name: '11v11 on a half pitch: break down a 4-4-2 low block', themes: ['lowblock', 'final', 'cross'], pops: ['wid', 'pen', 'cre'],
    type: 'Game (11v11)', w: 68, h: 52, players: 22, minutes: 20,
    objective: 'Put it all together against a deep, compact 4-4-2.',
    org: 'Half a pitch, one full-size goal. Defending team in a 4-4-2 low block; attacking team in a 4-3-3. The attacking keeper starts every move.',
    how: 'Attacking team must score; the block only has to defend. Restart from the attacking keeper after a goal, a ball out, or when an attack breaks down.',
    points: 'Width and depth to pull defenders out. Find the pockets between and inside the lines. Pass into the path of a run so the winger can turn and face a defender who has been dragged out. One-twos through the middle. Coordinated near- and far-post runs on crosses.',
    prog: 'Make the pitch 75 m. Give the defending team a goal to counter into, so the attackers must organise their rest defence. Defending team switches to 4-2-3-1 with a 9.', reg: 'Defending team plays 4-4-1.',
    transition: 'Once the counter goal is in: the defending team scores if it wins it, so attackers must be set to defend.', questions: 'Where is the pocket in their block right now?\nWho is the spare player if they stay compact?',
    stepIn: 'the ball goes round the outside of the block with no runs in behind', success: 'Chances created from inside the block, not only crosses',
    corners: { tech: 'Combination play; crossing', psych: 'Patience', phys: '', soc: 'Rest defence' },
    src: src('Aidy Boothroyd', 'former England U-21 coach', 'https://www.fifatrainingcentre.com/en/practice/elite-sessions/in-possession/boothroyd-breaking-down-a-low-block.php'),
    items: () => [goal(34, 0), P('gk', 34, 1.5), ...row('def', 4, 9, 18, 50), ...row('def', 4, 18, 14, 54), P('def', 28, 27), P('def', 40, 27),
      P('att', 34, 8), P('att', 8, 12), P('att', 60, 12), P('att', 24, 24), P('att', 44, 24), P('att', 34, 33), P('att', 6, 34), P('att', 62, 34), P('att', 26, 44), P('att', 42, 44), P('gk', 34, 51), ball(34, 32)]
  },
  {
    id: 't-5v3-final', name: '5v3 and 6v4 + keeper: unlock the back line', themes: ['final'], pops: ['pen', 'mob', 'sup'],
    type: 'Phase of play', w: 68, h: 40, players: 11, minutes: 20,
    objective: 'Use the extra numbers, timed runs and weighted passes to get in behind.',
    org: 'Half a pitch with one goal. Five attackers in a 2-3 shape against three defenders and a keeper; defenders start about 5 m outside the box. Offside applies.',
    how: 'A midfielder plays into the centre-forward, who lays it first time to the other midfielder. Wide attackers can stay wide to cross or come inside to combine. Then go.',
    points: 'Use the spare player to pin a defender and open a lane. Time runs so you are available, or to drag a defender away. The weight and timing of the final pass, matched to the run, is what breaks the line.',
    prog: '6v4 against a flat back four in a 1-2-3. Attackers have ten minutes to score more than one; the defence wins if they keep it to one or none.', reg: '5v2.',
    transition: 'Defenders who win it score by passing to a coach on halfway.', questions: 'Which defender do you pin, and who does that free?\nWhen do you make the run so you stay onside?',
    stepIn: 'everyone stands still waiting for a through ball', success: 'A chance on goal in most attacks',
    corners: { tech: 'Weighted through passes', psych: '', phys: 'Timed runs', soc: 'Decoy runs' },
    src: src('Nils Nielsen', 'former Switzerland and Denmark women’s head coach', 'https://fifatrainingcentre.com/en/practice/elite-sessions/in-possession/nils-nielsen-solutions-in-the-final-third.php'),
    items: () => [goal(34, 0), P('gk', 34, 1.5), ...row('def', 3, 21.5, 26, 42), P('att', 34, 18), P('att', 28, 30), P('att', 40, 30), P('att', 12, 24), P('att', 56, 24), ball(28, 31.5)]
  },

  // ===== Out of possession: blocks =====
  {
    id: 't-shuffle', name: 'Close down, cover and shuffle: 3 + 3 v 4', themes: ['mid', 'low'], pops: ['del', 'cov', 'bal', 'com'],
    type: 'Skill (opposed)', w: 15, h: 20, players: 10, minutes: 15,
    objective: 'A back four moves as one: one presses, the others shift across and cover the diagonals.',
    org: '20 x 15 m in three strips. Four defenders in the middle strip, three attackers in each outside strip. Everyone stays in their strip.',
    how: 'Attackers pass along the ground, two touches maximum, and try to get the ball across to the other side without it being cut out. When defenders win it, they give it back and play restarts.',
    points: 'Nearest defender presses the moment the pass goes; the others shuffle to cover the diagonal lanes. Stay about 3 m apart and move as a unit. A defender who steps out drops straight back when the ball moves on.',
    prog: 'Attackers one touch. Defenders score a point per interception.', reg: 'Attackers unlimited touches but must stay still until the pass arrives.',
    transition: 'Add a target: defenders who win it pass to a coach behind them for a point.', questions: 'When the ball goes wide, where does the far defender go?\nWho steps up, and who drops back?',
    stepIn: 'the four spread wide to cover everyone', success: 'Fewer than 3 passes get across in a minute',
    corners: { tech: 'Defensive footwork', psych: 'Concentration', phys: '', soc: 'Talking as a line' },
    src: src('Saïd Chiba', 'coach and FIFA technical expert', 'https://www.fifatrainingcentre.com/en/practice/elite-sessions/out-of-possession/chiba_said-defending-in-a-mid-block.php'),
    items: () => [...box(15, 20, 0), ...vline(5, 0, 20), ...vline(10, 0, 20), ...row('def', 4, 0, 0, 0).map((d, i) => ({ ...d, x: 7.5, y: 4 + i * 4 })), P('att', 2.5, 4), P('att', 2.5, 10), P('att', 2.5, 16), P('att', 12.5, 4), P('att', 12.5, 10), P('att', 12.5, 16), ball(2.5, 11.5)]
  },
  {
    id: 't-stopball', name: 'Mid-block stop-ball game', themes: ['mid'], pops: ['del', 'com', 'bal', 'con'],
    type: 'Phase of play', w: 40, h: 75, players: 20, minutes: 20,
    objective: 'Stay patient and compact, let them pass in front, press at the right moment, and protect the space between the lines.',
    org: 'Box to box, penalty-box width. A 6 m stop-ball zone at each end; a 25 m middle zone whose edges are each team’s offside line. Two teams of ten in 4-2-3-1. No passes in the air.',
    how: 'Score a point by passing to a team-mate who stops the ball in the end zone. A pass into the zone played from before the offside line scores 3. Teams can’t defend inside the stop-ball zones, and defend in front of their own offside line until play goes there.',
    points: 'Don’t let the 9 overcommit: keep ten behind the ball for as long as possible. Let them pass in front of you, then press on the trigger. Prioritise the gap between the lines; a defender who steps out returns once the danger has gone. Back four three-quarters on, ready to drop if the ball isn’t pressed. Push play wide.',
    prog: 'One team gets a keeper and a goal instead of the stop-ball zone (11v10).', reg: 'Allow passes in the air.',
    transition: 'Normal: the team that wins it goes for the other zone.', questions: 'What is our trigger to press?\nIf the ball carrier isn’t pressed, what does the back four do?',
    stepIn: 'the 9 chases the centre-backs on her own', success: 'Opponents rarely get a pass between our lines',
    corners: { tech: 'Body shape', psych: 'Patience', phys: '', soc: 'Coordinated shifting' },
    src: src('Saïd Chiba', 'coach and FIFA technical expert', 'https://www.fifatrainingcentre.com/en/practice/elite-sessions/out-of-possession/chiba_said-defending-in-a-mid-block.php'),
    items: () => [...box(40, 75, 0), ...line(0, 6, 40), ...line(0, 69, 40), ...line(0, 25, 40), ...line(0, 50, 40), zone(20, 3, 40, 6), zone(20, 72, 40, 6),
      ...row('def', 4, 20, 6, 34), P('def', 15, 30), P('def', 25, 30), ...row('def', 3, 36, 8, 32), P('def', 20, 42),
      ...row('att', 4, 62, 6, 34), P('att', 15, 54), P('att', 25, 54), ...row('att', 3, 46, 8, 32), P('att', 20, 40), ball(20, 60)]
  },
  {
    id: 't-low-8v4', name: 'Low block walk-through: 8 + keeper v 4', themes: ['low'], pops: ['cov', 'bal', 'com', 'del'],
    type: 'Functional', w: 68, h: 52, players: 14, minutes: 10,
    objective: 'Two banks of four shuffle together, with the keeper organising behind.',
    org: 'Half a pitch. Back four just outside the box, midfield four about 6 m in front, a keeper in goal. Four attackers spread across the width; a server on halfway.',
    how: 'The server passes to one of the attackers. The block reacts to the pass and where the receiver is, without challenging. The attacker returns it; the block resets. Near the end, attackers pass among themselves.',
    points: 'The presser decelerates with short steps and blocks the forward pass. The whole block shuffles: each defender follows the midfielder in front. Don’t move early for wide passes, which opens the middle. The keeper talks, corrects and sweeps. The presser rejoins the line as soon as the ball goes sideways.',
    prog: 'Attackers pass freely among themselves.', reg: 'Walk it through first.',
    transition: 'None in the walk-through on purpose. The next practice (6 + 2 v 8) adds the break-out.', questions: 'When the midfielder steps out, who covers her?\nWhy don’t we move before the wide pass is played?',
    stepIn: 'the lines go flat or the gaps between them open', success: 'The two lines stay within about 10 m of each other throughout',
    corners: { tech: 'Footwork when pressing', psych: 'Discipline', phys: '', soc: 'The keeper as organiser' },
    src: src('Oumarou Diabaté', 'former Niger coach', 'https://fifatrainingcentre.com/en/practice/elite-sessions/out-of-possession/collective-ball-recovery-in-a-low-block.php'),
    items: () => [goal(34, 0), P('gk', 34, 1.5), ...row('def', 4, 18, 16, 52), ...row('def', 4, 24, 14, 54), ...row('att', 4, 34, 6, 62), P('gk', 34, 51, 'S'), ball(34, 49.5)]
  },
  {
    id: 't-low-counter', name: '6 + 2 v 8 + keeper: low block, then counter in 10 seconds', themes: ['low', 'counter'], pops: ['bal', 'cov', 'pen'],
    type: 'Phase of play', w: 68, h: 52, players: 17, minutes: 15,
    objective: 'Defend the box compactly, then break out quickly once you win it.',
    org: 'Half a pitch. Three cone goals on halfway. Attack: six forwards (2-4) plus two support players behind halfway. Defence: 4-4 plus keeper.',
    how: 'A support player starts each attack (two touches). Attackers try to find gaps and score. Defenders who win it have 10 seconds to score in a cone goal or carry it over halfway.',
    points: 'Lines shift across together to keep the middle tight. The far full-back tucks in against crosses and switches. The far wide midfielder drops into the back line when the near full-back presses. Defend on the front foot so you can counter. React to loose and under-hit passes.',
    prog: 'Make it 9 v 8 + keeper with attackers in a 3-4-2.', reg: '6 v 8 with no support players.',
    transition: 'Built in: 10 seconds to break.', questions: 'Who tucks in when the ball is on the far side?\nWhat is the first pass when we win it?',
    stepIn: 'defenders win it and then pass it straight back to the attackers', success: 'Half our regains turn into a cone goal or a carry over halfway',
    corners: { tech: 'Clearances; first pass after winning it', psych: 'Concentration', phys: 'Sprints on the break', soc: '' },
    src: src('Oumarou Diabaté', 'former Niger coach', 'https://fifatrainingcentre.com/en/practice/elite-sessions/out-of-possession/collective-ball-recovery-in-a-low-block.php'),
    items: () => [goal(34, 0), P('gk', 34, 1.5), ...row('def', 4, 15, 16, 52), ...row('def', 4, 23, 12, 56), P('att', 26, 12), P('att', 42, 12), ...row('att', 4, 30, 8, 60), P('att', 24, 51), P('att', 44, 51),
      ...[14, 34, 54].flatMap(x => [{ id: id(), kind: 'cone', x: x - 2, y: 52 }, { id: id(), kind: 'cone', x: x + 2, y: 52 }]), ball(24, 49.5)]
  },
  {
    id: 't-win-keep', name: '6v6 + keepers: win it, then keep it for 10 passes', themes: ['secure', 'low', 'mid'], pops: ['cov', 'bal', 'sup'],
    type: 'Phase of play', w: 68, h: 52, players: 14, minutes: 15,
    objective: 'Defend compactly, and when you win it, don’t give it straight back: keep it and calm the game.',
    org: 'Half a pitch, a keeper in each goal. Six attackers in a 2-4 start with their keeper; six defenders in a 4-2.',
    how: 'Attackers are patient and pass to pull the block apart. Defenders who win it score a point by completing 10 passes. The coach can stop play to fix defensive positions.',
    points: 'The two central midfielders cover each other and never stand flat; when one steps out, the other drops behind. Stay central so the middle stays shut. Ball goes wide: full-back presses, midfielder covers behind and blocks the pass inside. Once it is won: first pass away from pressure, then make the pitch big.',
    prog: 'Defenders can score in the big goal instead after five passes.', reg: 'Five passes for a point.',
    transition: 'Built in: win it, then keep it.', questions: 'When we win it, where is the safe first pass?\nWho makes the pitch big?',
    stepIn: 'defenders win it and hit it long straight away', success: 'Half our regains reach 10 passes',
    corners: { tech: 'Passing under pressure after winning it', psych: 'Composure', phys: '', soc: 'Midfield pair covering each other' },
    src: src('Oumarou Diabaté', 'former Niger coach', 'https://fifatrainingcentre.com/en/practice/elite-sessions/out-of-possession/collective-ball-recovery-in-a-low-block.php'),
    items: () => [goal(34, 0), P('gk', 34, 1.5), ...row('def', 4, 15, 16, 52), P('def', 28, 22), P('def', 40, 22), ...row('att', 4, 28, 10, 58), P('att', 28, 38), P('att', 40, 38), goal(34, 52), P('gk', 34, 50.5), ball(34, 49)]
  },
  {
    id: 't-cb-crosses', name: 'Centre-back pair: high balls and crosses, 2v2 into 3v2', themes: ['low', 'spagainst'], pops: ['cov', 'bal'],
    type: 'Functional', w: 68, h: 52, players: 10, minutes: 15,
    objective: 'Centre-backs win the first ball, clear with height and distance, and deal with crosses from both sides.',
    org: 'A strip the width of the six-yard box running half the pitch. Two defenders on the edge of the box, two attackers at the halfway end, crossers at two stations each side.',
    how: 'Three sequences in a row: a high ball into the centre-backs, then a cross from the left, then a cross from the right. Each ends when the ball is cleared or goes out. Then two new defenders.',
    points: 'Clear with height and distance, then step out and press the attackers. Attack the cross; don’t wait for it. Organise each other before the ball comes in.',
    prog: 'Supporting defenders can’t talk at first, then can after 5 minutes. Add a third attacker (3v2).', reg: 'Attackers passive on the first ball.',
    transition: 'Add: a clearance that reaches a coach on halfway scores a point.', questions: 'Who attacks the ball, and who covers?\nWhere does the clearance need to go?',
    stepIn: 'both centre-backs go for the same ball', success: 'First contact won on most deliveries',
    corners: { tech: 'Heading; clearing', psych: 'Courage', phys: 'Jumping', soc: 'Calling the ball' },
    src: src('Michael Johnson', 'England U-18 assistant coach', 'https://www.fifatrainingcentre.com/en/practice/elite-sessions/out-of-possession/johnson-defending-principles.php'),
    items: () => [goal(34, 0), P('gk', 34, 1.5), ...vline(25, 0, 52), ...vline(43, 0, 52), P('def', 30, 17), P('def', 38, 17), P('att', 31, 45), P('att', 37, 45), P('neu', 8, 12), P('neu', 8, 22), P('neu', 60, 12), P('neu', 60, 22), ball(34, 46.5)]
  },

  // ===== Pressing high =====
  {
    id: 't-press-rondo', name: '5v3 pressing rondo: first, second and third presser', themes: ['press'], pops: ['del', 'cov', 'com'],
    type: 'Warm-up', w: 15, h: 15, players: 8, minutes: 10,
    objective: 'Learn the jobs in a press: who goes, who covers, who reads the interception.',
    org: '15 x 15 m. Five pressing, three keeping the ball. Two areas if you have the numbers.',
    how: 'The three try to keep the ball; the five try to intercept or force it out. Three score with 10 passes in a row; five score with an interception or forcing it out. Rotate every couple of minutes.',
    points: 'First presser closes quickly and blocks a passing lane. Second covers the first and blocks the pass that gets past. If the first is beaten, the second steps up and the first becomes cover. Third covers the second and looks to intercept.',
    prog: 'Pressing team must win it inside 8 seconds.', reg: '4v3.',
    transition: 'When the five win it, they must keep it for three passes before it counts.', questions: 'You are the second presser. Where do you stand?\nWhat do you do if the first presser gets beaten?',
    stepIn: 'everyone presses the ball at once', success: 'Pressing team wins it before 10 passes most of the time',
    corners: { tech: 'Pressing angles', psych: '', phys: '', soc: 'Roles in the press' },
    src: src('Belinda Wilson', 'FIFA women’s football technical expert', 'https://www.fifatrainingcentre.com/en/practice/elite-sessions/out-of-possession/defending-as-a-unit.php'),
    items: () => [...box(15, 15), ...ring('def', 5, 7.5, 7.5, 6), ...ring('att', 3, 7.5, 7.5, 2.5, -30), ball(9.5, 6.5)]
  },
  {
    id: 't-press-halves', name: 'Stop the forward pass: 3v3 + 1v1 in two halves', themes: ['press'], pops: ['del', 'com'],
    type: 'Skill (opposed)', w: 20, h: 30, players: 9, minutes: 15,
    objective: 'Arrive on the receiver’s first touch so they can’t turn and play forward.',
    org: '30 x 20 m split into two halves, a keeper at one end. 3v3 in one half, 1v1 in the other.',
    how: 'The keeper plays to the team building out. They score by getting the ball into their team-mate in the other half; play then carries on there. The other team tries to stop the forward pass and win it.',
    points: 'Closest player starts the press and gets touch-tight. Body side-on to push the pass into crowded areas. Get to a player with their back to goal before their first touch. When the keeper has it, the attackers spread; the defenders shrink the space.',
    prog: '4v4 in the half.', reg: 'Pressers can only intercept.',
    transition: 'Pressers who win it score by dribbling over the end line.', questions: 'When does the press start?\nWhich way do you show them?',
    stepIn: 'pressers arrive after the receiver has turned', success: 'Forward passes stopped most of the time',
    corners: { tech: 'Closing down; body shape', psych: 'Aggression with control', phys: 'Acceleration', soc: '' },
    src: src('Belinda Wilson', 'FIFA women’s football technical expert', 'https://www.fifatrainingcentre.com/en/practice/elite-sessions/out-of-possession/defending-as-a-unit.php'),
    items: () => [...box(20, 30, 0), ...line(0, 15, 20), goal(10, 30), P('gk', 10, 28.5), ...row('att', 3, 23, 4, 16), ...row('def', 3, 20, 5, 15), P('att', 10, 6), P('def', 10, 9), ball(10, 27)]
  },
  {
    id: 't-press-8v6', name: '8v6 phase: press high from a mid-block shape', themes: ['press', 'mid'], pops: ['del', 'com', 'cov'],
    type: 'Phase of play', w: 68, h: 52, players: 15, minutes: 20,
    objective: 'The front line presses together on clear triggers and the midfield moves behind them.',
    org: 'Half a pitch, with an end line 10 m in from halfway. Seven attackers and a keeper build out; six defenders press.',
    how: 'The keeper starts; attackers try to build and dribble over the end line (a point). Defenders who win it have 30 seconds to score in the goal.',
    points: 'The 9 closes a centre-back at an angle that forces a bad pass. Wide forwards press with the 9 and block passes to the full-backs. A ball into a full-back is the trigger for midfield to shift: nearest goes across, far one tucks in. If the keeper goes long, defenders get goal-side.',
    prog: 'Fewer goes each, to raise the stakes.', reg: 'Five attackers.',
    transition: 'Built in: 30 seconds to score after winning it.', questions: 'What is our trigger to press?\nWhen the ball goes to their full-back, who moves where?',
    stepIn: 'the 9 presses straight at the centre-back and lets her pass either way', success: 'Win it in their half 3 times in 10',
    corners: { tech: 'Curved pressing runs', psych: '', phys: 'Repeated sprints', soc: 'Pressing together' },
    src: src('Michael Johnson', 'England U-18 assistant coach', 'https://www.fifatrainingcentre.com/en/practice/elite-sessions/out-of-possession/johnson-defending-principles.php'),
    items: () => [goal(34, 52), P('gk', 34, 50.5), ...line(0, 10, 68), P('att', 24, 44), P('att', 44, 44), P('att', 8, 36), P('att', 60, 36), P('att', 34, 34), P('att', 22, 26), P('att', 46, 26),
      P('def', 30, 38), P('def', 12, 30), P('def', 56, 30), P('def', 26, 22), P('def', 42, 22), P('def', 34, 16), ball(34, 49)]
  },
  {
    id: 't-press-8v8', name: '8v8: press high in three lines', themes: ['press'], pops: ['del', 'com', 'con'],
    type: 'Small-sided game', w: 30, h: 70, players: 18, minutes: 20,
    objective: 'Press as a team in a real game: three lines, short distances, arrive on the first touch.',
    org: '70 x 30 m, full-size goals and keepers at both ends. Both teams 4-3-1.',
    how: 'Blues build from their keeper; oranges press high and try to stop forward play. Restart from the blue keeper whenever the attack ends. Swap roles.',
    points: 'Three lines. Pressers go as the ball leaves the passer’s foot and arrive on the receiver’s first touch. Cover players cut off the next pass and push play where it is hard to get out. Win it, then get control before attacking.',
    prog: 'Free game with both teams pressing; teams that win it high attack quickly. Coach encourages rather than stopping play.', reg: 'Wider pitch.',
    transition: 'Win it high and attack straight away.', questions: 'Where do we want to win it?\nAfter we win it, what is the first job?',
    stepIn: 'gaps open between the lines', success: 'Most blue build-ups stopped before halfway',
    corners: { tech: '', psych: 'Collective effort', phys: 'High intensity', soc: 'Compact team' },
    src: src('Belinda Wilson', 'FIFA women’s football technical expert', 'https://www.fifatrainingcentre.com/en/practice/elite-sessions/out-of-possession/defending-as-a-unit.php'),
    items: () => [...box(30, 70, 0), goal(15, 0), goal(15, 70), P('gk', 15, 68.5), ...row('att', 4, 60, 4, 26), ...row('att', 3, 48, 6, 24), P('att', 15, 38),
      P('gk', 15, 1.5), ...row('def', 4, 34, 4, 26).map(d => ({ ...d, y: 52 })), ...row('def', 3, 42, 6, 24), P('def', 15, 58), ball(15, 66)]
  },

  // ===== Transition to attack =====
  {
    id: 't-run-behind', name: 'Counter waves: one pass, three runners, finish fast', themes: ['counter', 'final'], pops: ['pen', 'mob', 'wid'],
    type: 'Technical (unopposed)', w: 40, h: 70, players: 8, minutes: 15,
    objective: 'The first pass after winning it goes into a runner’s path, and the runners split the space.',
    org: '70 x 40 m, one goal and keeper. A player at a cone in the middle; three runners on cones about 10 m into the other half; ball stations either side.',
    how: 'A ball from the station to the middle player, who half-turns and plays a through ball into one of the three runners. They attack together and finish as fast as possible. Teams take turns; most goals wins.',
    points: 'Maximum intensity. Weight the through ball so the runner gets there and the keeper can’t. The 9 holds back for the cut-back. The two not on the ball don’t run into the same space; bend runs to stay onside and arrive in better positions.',
    prog: 'Wide runners go outside the outer cones; the 9 bends around the inner ones. Then add two recovering defenders with offside.', reg: 'Two runners.',
    transition: '', questions: 'Where does the first pass go?\nWho holds back for the cut-back?',
    stepIn: 'all three runners chase the ball', success: 'A shot within 8 seconds of the first pass',
    corners: { tech: 'Through passes; finishing at speed', psych: '', phys: 'Sprinting', soc: 'Splitting runs' },
    src: src('Jonas Urias', 'Brazil U-20 women’s head coach and FIFA technical expert', 'https://www.fifatrainingcentre.com/en/practice/elite-sessions/transition-to-attacking/opening-space-on-the-counter-attack.php'),
    items: () => [goal(20, 0), P('gk', 20, 1.5), P('att', 20, 45), P('att', 8, 25), P('att', 20, 25), P('att', 32, 25), P('neu', 34, 52), P('neu', 6, 52), ...line(0, 35, 40), ball(34, 53.5)]
  },
  {
    id: 't-3v3-counter', name: '3v3 in the middle: win it and break', themes: ['counter', 'counterpress'], pops: ['pen', 'mob'],
    type: 'Small-sided game', w: 40, h: 70, players: 18, minutes: 20,
    objective: 'Win it in the middle and get the first pass out to the runners before the defence is set.',
    org: '70 x 40 m, goals and keepers at both ends, a 20 x 20 m box in the middle. Inside: 3v3. Outside: a blue neutral on each side, two blue defenders and three orange attackers at each end.',
    how: 'Blue keep the ball in the box (using their neutrals). Orange try to win it; when they do, they pass to their attackers at either end, who break on goal against the two blue defenders. Each team does this four to eight times.',
    points: 'Players outside are on their toes. Start the counter with a pass straight after the tackle or interception. Play away from pressure into space, through the gaps between defenders. Keep an open body shape to give angles.',
    prog: 'Two orange players from the box can join the break; one blue can recover. Then play 4v4 or 5v5 in the middle.', reg: 'Attackers play 3v1.',
    transition: 'Built in both ways.', questions: 'Which end is the break on?\nWho joins it and who stays?',
    stepIn: 'the first pass goes sideways or back', success: 'A shot in most breaks',
    corners: { tech: 'Passing at pace', psych: 'Alertness', phys: 'Sprints', soc: '' },
    src: src('Jonas Urias', 'Brazil U-20 women’s head coach and FIFA technical expert', 'https://www.fifatrainingcentre.com/en/practice/elite-sessions/transition-to-attacking/opening-space-on-the-counter-attack.php'),
    items: () => [goal(20, 0), goal(20, 70), P('gk', 20, 1.5), P('gk', 20, 68.5), zone(20, 35, 20, 20), ...[[15, 31], [25, 31], [20, 39]].map(([x, y]) => P('att', x, y)), ...[[17, 35], [23, 36], [20, 30]].map(([x, y]) => P('def', x, y)),
      P('neu', 8, 35), P('neu', 32, 35), P('att', 16, 10), P('att', 24, 10), P('att', 16, 60), P('att', 24, 60), ...row('def', 3, 18, 10, 30), ...row('def', 3, 52, 10, 30), ball(15, 32.5)]
  },
  {
    id: 't-6v6p4-trans', name: '6v6 + 4: win it and play forward through the lines', themes: ['counter', 'press'], pops: ['pen', 'com'],
    type: 'Small-sided game', w: 32, h: 20, players: 16, minutes: 15,
    objective: 'Press to win it, then go forward as directly as possible to the 9.',
    org: 'About 30 x 20 m in four strips. Orange groups of three in strips 1 and 3, blue groups of three in 2 and 4. Four neutrals, one on each side. Mini-goals behind the end zones.',
    how: 'Orange pass to each other through the blue lines (a point per pass through). Blue shut the lanes and win it, then score in a mini-goal as fast as possible, using the neutrals. The team that loses it can’t defend outside the area.',
    points: 'Close the lanes, stay compact, nearest player always pressing. Once you win it, play forward and be direct; link with the 9 straight away.',
    prog: 'The neutrals behind the end zones step in as 9s to press, then link once it is won (goal after linking with a 9 is worth 2). Last two minutes: defenders can chase outside their zones.', reg: 'Two in each strip.',
    transition: 'Built in.', questions: 'When we win it, where is the 9?\nWhat closes the lane they want?',
    stepIn: 'the team that wins it passes sideways', success: 'Most regains end in a shot within three passes',
    corners: { tech: 'Forward passing', psych: '', phys: '', soc: 'Pressing as a unit' },
    src: src('Simon Jennings', 'Moroccan FA elite coach educator', 'https://www.fifatrainingcentre.com/en/practice/elite-sessions/transition-to-attacking/transition-into-attack.php', 'The source gives 30 x 20 m with four 8 m strips, which doesn’t add up; 32 x 20 m keeps the strips.'),
    items: () => [...box(32, 20, 0), ...vline(8, 0, 20), ...vline(16, 0, 20), ...vline(24, 0, 20), ...row('def', 3, 0, 0, 0).map((d, i) => ({ ...d, x: 4, y: 4 + i * 6 })), ...row('att', 3, 0, 0, 0).map((d, i) => ({ ...d, x: 12, y: 4 + i * 6 })),
      ...row('def', 3, 0, 0, 0).map((d, i) => ({ ...d, x: 20, y: 4 + i * 6 })), ...row('att', 3, 0, 0, 0).map((d, i) => ({ ...d, x: 28, y: 4 + i * 6 })), P('neu', 16, -1.4), P('neu', 16, 21.4), P('neu', -1.4, 10), P('neu', 33.4, 10), mini(-1.3, 4), mini(33.3, 16), ball(4, 5.5)]
  },
  {
    id: 't-9v9-counter', name: '9v9: defend low, counter at pace', themes: ['counter', 'low'], pops: ['pen', 'bal', 'con'],
    type: 'Small-sided game', w: 50, h: 60, players: 20, minutes: 20,
    objective: 'Defend deep on purpose to leave space to counter into, then break before they recover.',
    org: '60 x 50 m with goals and keepers at both ends, plus two mini-goals either side of one goal. Cones mark the defending team’s third.',
    how: 'Blue attack the goal with the mini-goals beside it. Orange defend in a low block and counter. Scoring: blue goal 3; orange goal in the big goal 3, but only 1 if any orange player is still in their defensive third when they score; orange goal in a mini-goal 1.',
    points: 'Push up as a unit to get the 3. Be in the pockets before the transition. Move the ball away from pressure and run in behind straight away. When defending: protect the box and show them wide.',
    prog: 'Blue can score in the mini-goals too.', reg: 'Blue play with one fewer.',
    transition: 'Built in: the whole team must leave its third when the counter goes.', questions: 'Why defend deep in this game?\nWho is already in the pocket when we win it?',
    stepIn: 'the team wins it and nobody runs forward', success: 'Counters reach the far third in under 10 seconds',
    corners: { tech: 'First pass after winning it', psych: 'Patience then speed', phys: 'Repeated sprints', soc: 'Moving up together' },
    src: src('Jonas Urias', 'Brazil U-20 women’s head coach and FIFA technical expert', 'https://www.fifatrainingcentre.com/en/practice/elite-sessions/transition-to-attacking/opening-space-on-the-counter-attack.php'),
    items: () => [...box(50, 60, 0), goal(25, 0), goal(25, 60), mini(10, 60), mini(40, 60), P('gk', 25, 1.5), P('gk', 25, 58.5), ...line(0, 40, 50),
      ...row('def', 4, 50, 8, 42), ...row('def', 4, 42, 10, 40), P('def', 25, 34), ...row('att', 3, 36, 12, 38), ...row('att', 3, 26, 10, 40), ...row('att', 3, 16, 14, 36), ball(25, 35)]
  },

  // ===== Transition to defence =====
  {
    id: 't-recover', name: 'Lose it, get back: recover the shape before they can attack', themes: ['recover', 'counterpress'], pops: ['bal', 'com', 'del'],
    type: 'Small-sided game', w: 40, h: 40, players: 16, minutes: 15,
    objective: 'When the press isn’t on, sprint back into a compact block behind the ball.',
    org: '40 x 40 m in three zones (a 22 m middle zone). Goals and keepers at each end. Our version: the team building out does so in its own end zone with an extra player; once it loses the ball, the extra player drops out.',
    how: 'One team builds through the zones. If they lose it, they must get back into shape (back four squeezed, lines compact) before the other team can get a shot away, or win it straight back.',
    points: 'Decide in a second: press to win it back, or get back. Sprint goal-side. The back line squeezes up and stays together; midfield gets in front of it.',
    prog: 'The team that won it scores double if it scores within 8 seconds.', reg: 'The attacking team waits 3 seconds after winning it.',
    transition: 'This is the transition.', questions: 'What decides press or drop?\nWho is the first one back?',
    stepIn: 'players jog back or watch', success: 'Seven or more behind the ball within 5 seconds of losing it',
    corners: { tech: '', psych: 'Responsibility', phys: 'Recovery runs', soc: 'Organising the block' },
    src: { who: 'Abdallah Idrissi', role: 'Morocco U-15 coach', where: FTC, url: 'https://www.fifatrainingcentre.com/en/practice/elite-sessions/transition-to-defending/defensive-transitions.php', note: 'The 40 x 40 m zones come from his session; the rules here are our version of the idea.' },
    items: () => [...box(40, 40, 0), ...line(0, 9, 40), ...line(0, 31, 40), goal(20, 0), goal(20, 40), P('gk', 20, 1.5), P('gk', 20, 38.5), ...row('att', 4, 34, 6, 34), ...row('att', 3, 24, 10, 30), ...row('def', 3, 18, 10, 30), ...row('def', 4, 6, 6, 34), ball(10, 35.5)]
  },

  // ===== Set pieces =====
  {
    id: 't-corners', name: 'Corners attack v defence, with a second ball', themes: ['spfor', 'spagainst'], pops: [],
    type: 'Set piece', w: 68, h: 52, players: 22, minutes: 20,
    objective: 'Rehearse your corner routines and your defending set-up, and train what happens straight after.',
    org: 'Half a pitch, two teams of ten plus a keeper. The four takers warm up their delivery separately first.',
    how: 'Corner from the right. Whatever happens, a coach by the post plays a second ball straight in: either to the keeper to start a counter, or to a defender of the attacking team for a second cross. Then corner from the left, free kicks from the left and right. Swap roles after the corners and after the free kicks.',
    points: 'Use your own routines and your own marking set-up: the practice is the vehicle. Everyone knows their job before the ball is placed. The second phase is where goals are conceded: react, don’t admire.',
    prog: 'The coach calls the routine at the last moment.', reg: 'Walk through each routine unopposed first.',
    transition: 'The second ball is the transition.', questions: 'What is your job on this corner?\nWhat happens if it is cleared to the edge of the box?',
    stepIn: 'defenders switch off after the first header', success: 'Every player in the right place before each delivery',
    corners: { tech: 'Delivery; attacking the ball', psych: 'Concentration', phys: 'Explosive jumps', soc: 'Communication' },
    src: { who: 'Jean-Luc Vannuchi and Vincent Hamonic', role: 'France U-17 men’s national team', where: FTC, url: 'https://fifatrainingcentre.com/en/practice/elite-sessions/youth-national-teams/france-u17-men/wednesday-session-set-pieces.php' },
    items: () => [goal(34, 0), P('gk', 34, 1.5), P('att', 67, 0.5), P('att', 30, 8), P('att', 36, 11), P('att', 40, 7), P('att', 28, 13), P('att', 34, 18), P('def', 31, 6), P('def', 37, 6), P('def', 34, 10), P('def', 30, 11), P('def', 39, 12), P('coach', 39, 1), ball(67.5, 0.5)]
  },

  // ===== Start every session with a game =====
  {
    id: 't-arrival', name: 'Start with a game', themes: THEME_KEYS, pops: [], general: true,
    type: 'Small-sided game', w: 30, h: 40, players: 12, minutes: 12,
    objective: 'Players arrive and play straight away, with one challenge linked to today’s theme.',
    org: 'A pitch to suit the theme: bigger to encourage counter-attacks and running with the ball, smaller to make players find space and play under pressure.',
    how: 'Let the players pick two even teams. Play. Drop in one or two individual challenges that link to the session (for example: “every goal kick is played short”, or “win it back within five seconds”).',
    points: 'Watch more than you talk. Note what you see against today’s theme: it tells you where to start the next part.',
    prog: 'Add a condition that brings out the theme more often.', reg: 'Add a floater who plays for the team with the ball.',
    transition: 'A real game has it already.', questions: 'What did you notice about the challenge?',
    stepIn: 'only to set the challenge', success: 'Everyone is playing within two minutes of arriving',
    corners: { tech: '', psych: 'Motivation', phys: 'Gradual warm-up', soc: 'Players choosing fair teams' },
    src: { who: 'The FA (England DNA)', role: 'The Boot Room', where: 'thefa.com', url: 'https://www.thefa.com/learning/coaching/how-to-use-the-england-dna-in-your-coaching-session', note: 'The FA asks coaches to consider starting with a game rather than a technique practice.' },
    items: () => [...box(30, 40, 0), mini(10, 0), mini(20, 0), mini(10, 40), mini(20, 40), ...[[8, 10], [22, 10], [15, 16], [8, 26], [22, 26], [15, 32]].map(([x, y]) => P('att', x, y)), ...[[10, 14], [20, 14], [15, 22], [10, 30], [20, 30], [15, 6]].map(([x, y]) => P('def', x, y)), ball(15, 20)]
  }
];

/* ---------- Session templates: a sequence of practices on one theme ---------- */
export const SESSION_TEMPLATES = [
  { id: 's-play-out', name: 'Playing out centrally under pressure', themes: ['build'], parts: ['t-arrival', 't-cb-step', 't-spare', 't-gk-build'],
    why: 'Builds from one centre-back’s step-in to a full build-up against a press.', src: 'Claire Lynne Smith (Stoke City)' },
  { id: 's-thirds', name: 'Building from the back through the thirds', themes: ['build', 'progress'], parts: ['t-thirds', 't-wide-10v10', 't-11v9'],
    why: 'Tight-space line-breaking, then using the wide areas, then the whole picture against a press.', src: 'Rehanne Skinner (Tottenham Hotspur Women)' },
  { id: 's-lines', name: 'Breaking lines and playing forward', themes: ['progress', 'build'], parts: ['t-arrival', 't-6v6p4', 't-5v4-zones', 't-thirds'],
    why: 'Find pockets and the third player, then play forward through zones with no way back.', src: 'Nils Nielsen; FIFA Talent Coach Programme; Rehanne Skinner' },
  { id: 's-switch', name: 'Switching play', themes: ['switch'], parts: ['t-3team-switch', 't-switch-9v8', 't-switch-9v8'],
    why: 'Keep it, then switch it; then a game where switching doubles the goal. Bartlett alternates the big game with a 5v5 on a small pitch using the same scoring.', src: 'Lamia Boumehdi; Ben Bartlett (Fulham)' },
  { id: 's-low-block', name: 'Breaking down a low block', themes: ['lowblock', 'final', 'cross'], parts: ['t-1v3', 't-3v2', 't-4v4-cross', 't-low-11v11'],
    why: 'Individual skill, then combinations, then crosses and cut-backs, then the full 11v11 against a 4-4-2 block.', src: 'Aidy Boothroyd (former England U-21s)' },
  { id: 's-final-third', name: 'Solutions in the final third', themes: ['final'], parts: ['t-arrival', 't-6v6p4', 't-5v3-final', 't-3v2'],
    why: 'Find pockets in possession, then use numbers and runs to get in behind.', src: 'Nils Nielsen (former Switzerland and Denmark women)' },
  { id: 's-crossing', name: 'Crossing and finishing', themes: ['cross'], parts: ['t-arrival', 't-4v4-cross', 't-low-11v11'],
    why: 'Goals only from crosses in a tight game, then against a real low block.', src: 'Aidy Boothroyd' },
  { id: 's-mid-block', name: 'Defending in a mid-block', themes: ['mid'], parts: ['t-shuffle', 't-stopball', 't-press-8v6'],
    why: 'Shuffle as a line, then the patient block in a game, then when to step out and press.', src: 'Saïd Chiba; Michael Johnson (England U-18s)' },
  { id: 's-low-def', name: 'Defending in a low block, then countering', themes: ['low'], parts: ['t-shuffle', 't-low-8v4', 't-low-counter', 't-cb-crosses'],
    why: 'From the walk-through of the two banks of four to defending the box and breaking out.', src: 'Oumarou Diabaté; Michael Johnson' },
  { id: 's-press', name: 'Pressing high as a team', themes: ['press'], parts: ['t-press-rondo', 't-press-halves', 't-press-8v6', 't-press-8v8'],
    why: 'Roles in the press, then stopping the forward pass, then the front line’s triggers, then a full pressing game.', src: 'Belinda Wilson (FIFA); Michael Johnson (England U-18s)' },
  { id: 's-counterpress', name: 'Counter-pressing: win it back', themes: ['counterpress'], parts: ['t-trans-rondos', 't-milly', 't-6v3', 't-4v4p4'],
    why: 'Make the reaction to losing it automatic, then press as a unit with a consequence.', src: 'Noureddine Boubou; Liverpool (Klopp and Lijnders)' },
  { id: 's-counter', name: 'Counter-attacking', themes: ['counter'], parts: ['t-run-behind', 't-3v3-counter', 't-6v6p4-trans', 't-9v9-counter'],
    why: 'From the first pass and runs, to winning it in the middle, to a whole game built on breaking quickly.', src: 'Jonas Urias (Brazil U-20 women); Simon Jennings' },
  { id: 's-win-keep', name: 'Win it, then keep it', themes: ['secure', 'mid'], parts: ['t-arrival', 't-shuffle', 't-win-keep', 't-4v4p4'],
    why: 'Defend compactly, then make the first pass after winning it count instead of giving it straight back.', src: 'Oumarou Diabaté; Saïd Chiba; Noureddine Boubou' },
  { id: 's-recover', name: 'Losing it: press or recover', themes: ['recover', 'counterpress'], parts: ['t-trans-rondos', 't-recover', 't-4v4p4'],
    why: 'React, then decide: win it back or get back into shape.', src: 'Abdallah Idrissi (Morocco U-15s); Noureddine Boubou' },
  { id: 's-set-pieces', name: 'Set pieces with a second ball', themes: ['spfor', 'spagainst'], parts: ['t-cb-crosses', 't-corners'],
    why: 'Win the first contact, then rehearse your routines with the second phase built in.', src: 'France U-17s; Michael Johnson' }
];

export const tplById = idv => DRILL_TEMPLATES.find(t => t.id === idv);
export const sessionTplById = idv => SESSION_TEMPLATES.find(t => t.id === idv);
// Templates that train a theme. The general opener is left out of single-theme lists.
export const drillsForTheme = th => DRILL_TEMPLATES.filter(t => !t.general && (!th || t.themes.includes(th)));
export const sessionsForTheme = th => SESSION_TEMPLATES.filter(t => !th || t.themes.includes(th));
