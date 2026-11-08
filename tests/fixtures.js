// Test fixtures: the drill and match the app used to plant as examples. The app no longer seeds them,
// but many tests were written against them, so tests put them back with this.
//   await pg.evaluate("import('./tests/fixtures.js').then(F => F.examples())")
import * as S from '../js/store.js';
import { uid } from '../js/util.js';

export function examples() {
  const T = 't-thornaby';
  if (!S.get('dr-rondo')) {
    const disc = (x, y) => ({ id: uid(), kind: 'disc', color: '#F2B705', x, y });
    S.put({ id: 'dr-rondo', kind: 'drill', team: null, created: '2026-11-06', name: 'Example: 5v2 rondo', type: 'Warm-up', area: 'custom', preset: 'custom', w: 14, h: 14,
      items: [disc(1, 1), disc(13, 1), disc(1, 13), disc(13, 13),
        { id: uid(), kind: 'att', x: 7, y: 1.6 }, { id: uid(), kind: 'att', x: 12.4, y: 7 }, { id: uid(), kind: 'att', x: 7, y: 12.4 }, { id: uid(), kind: 'att', x: 1.6, y: 7 }, { id: uid(), kind: 'att', x: 9.5, y: 9.5 },
        { id: uid(), kind: 'def', x: 6, y: 6 }, { id: uid(), kind: 'def', x: 8, y: 7.6 }, { id: uid(), kind: 'ball', x: 7.8, y: 2.6 }],
      arrows: [], objective: 'EXAMPLE (edit or delete). Players keep the ball under pressure by giving angles of support.',
      links: { [T]: ['pr-2'] }, corners: { tech: 'Receiving on the half-turn; weight of pass', psych: 'Composure under pressure', phys: '', soc: '' },
      org: '14 x 14 m box. 5 attackers (blue) v 2 defenders (red). Spare balls at each corner.',
      how: 'Blues keep the ball. A defender who wins it swaps with the player who lost it.',
      points: 'Open body before receiving. Second and third player give angles. Play away from pressure.',
      prog: 'One touch. Smaller box. Add a third defender.', reg: 'Bigger box. Unlimited touches.',
      interventions: ['qa', 'obs'], players: 7, minutes: 12 });
  }
  if (!S.get('mt-cls')) {
    S.put({ id: 'mt-cls', kind: 'match', team: T, created: '2026-11-06', opponent: 'Chester-le-Street', example: true, date: '', ko: '', venue: '', comp: '', src: '',
      tags: { formation: '4-3-3', build: 'long/direct', press: 'individual/unorganised', aerial: 'weak', transition: 'slow/blunt', setpiece: 'average' },
      opp: { ip: 'Little interest in playing out. GK has a big kick.', op: 'Two modes: sit in a 4-5-1 with one screening, or press as individuals.',
        ta: 'Midfield slow, second to everything.', td: 'Want fast breaks but lack numbers and quality.', sp: 'Corners: defenders on both posts.', people: 'LW quick but just runs at the ball.' },
      plan: { keys: 'Attack their weak full-back with our strongest winger at every chance.\nBack-post runs on every cross: they defend crosses badly.\nInswinging set pieces on top of their keeper.',
        threat: 'Physical, reckless early fouls; long throws.', ip: 'Full-back could roll inside in build-up.', op: '', sp: 'Captain delivers inswingers onto the keeper.', selection: '', talk: '', principleNotes: {} },
      instructions: {}, boardIds: ['bd-shape'], squadIds: [], result: { us: '', them: '' } });
  }
  return true;
}
