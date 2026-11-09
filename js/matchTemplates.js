// Match day templates: ways top coaches and The FA structure the day, the half-time break and the
// plan. Written in our own words from the published source, with a link to each original. Using one
// fills only the parts of the match plan that are still empty; anything Joe has written is kept.
// Times are only those the source gives; "KO" is kick-off.

// The extra parts of the match plan these templates fill (stored on m.plan).
export const MATCH_FIELDS = {
  whatIf: { lab: 'What if…', tab: 'plan', ph: 'Score early, concede early, go down to ten, leading or chasing with 15 to go: what changes?' },
  units: { lab: 'Unit jobs', tab: 'plan', ph: 'Goalkeeper, defenders, midfield, forwards: one or two jobs each against this opponent' },
  targets: { lab: 'Team targets', tab: 'day', ph: 'In possession, out of possession, and one mental or physical target. Check them at half-time.' },
  timeline: { lab: 'Match day timeline', tab: 'day', ph: 'Arrival, changing room, warm-up, final words, kick-off' },
  staffRoles: { lab: 'Staff roles', tab: 'day', ph: 'Who watches what, who stays with the players at half-time, who briefs the subs' },
  halftime: { lab: 'Half-time plan', tab: 'day', ph: 'Who speaks first, how many points, how long' }
};

export const MATCH_TEMPLATES = [
  {
    id: 'mt-fa-plan', name: 'The FA matchday game plan', part: 'plan',
    why: 'A plan to play the game, built on four questions: your coaching values, what you trained this week, how you want to attack, defend and transition (with “what if” scenarios), and your line-up and game-changers.',
    who: 'The FA (Suey Smith and Pav Singh), England Football Learning', url: 'https://learn.englandfootball.com/articles/resources/2023/What-is-a-matchday-game-plan',
    tips: ['Match the detail to the level: a senior side can take formations, unit work and scenarios.', 'Build the targets from what you practised this week, then reflect on them after the game.'],
    fills: {
      whatIf: 'We score early: \nWe concede early: \nWe go down to ten: \nLeading with 15 to go: \nChasing with 15 to go: ',
      targets: 'From this week’s training, the team: \nIndividual targets (who, and what she will try): \n- \n- ',
      subs: 'Game-changers: who comes on, when (minute or trigger) and to do what: \n- \n- '
    }
  },
  {
    id: 'mt-opp-pack', name: 'Opposition pack for the players', part: 'them',
    why: 'Six short parts for the players: an overview, their two or three main threats each with our answer, their weaknesses put in terms of what we do well, details for each unit, simple pictures, and no more than five team objectives.',
    who: 'Women’s Soccer Coaching', url: 'https://www.womenssoccercoaching.com/coaching-advice/how-to-create-an-opposition-pack-for-your-team',
    tips: ['Keep the overview to one screen: league position, recent results, style.', 'Use a board for their shape and one or two “what if” pictures; keep them uncluttered.', 'End with five team objectives at most, in What wins us the game.'],
    fills: {
      'opp.people': 'Main threat 1: \n  Our answer: \nMain threat 2: \n  Our answer: \nMain threat 3: \n  Our answer: ',
      units: 'Goalkeeper: \nDefenders: \nMidfield: \nForwards: ',
      src: 'League position: · Last results: · Style: '
    }
  },
  {
    id: 'mt-belles-day', name: 'Match day timeline (Doncaster Belles)', part: 'day',
    why: 'Amanda Greenslade’s match day at Doncaster Belles: the same arrival time home or away, a warm-up that builds to competitive possession games, every member of staff giving a short final word, and a half-time where the players speak first.',
    who: 'Amanda Greenslade, Doncaster Belles, on The FA’s Coachcast', url: 'https://community.thefa.com/coaching/podcasts/w/coachcast-transcripts/1591/episode-eight-making-matchday-a-success-with-amanda-greenslade',
    tips: ['Give every sub a clear job and enough time to affect the game; tell them who they replace and brief set pieces in the warm-up.', 'Keep the bench watching and feeding information to players.', 'Save the detailed review for about 48 hours later.'],
    fills: {
      timeline: 'KO −90: arrive (same time home or away), bags down, walk the pitch; staff set up\nKO −60: changing room, a few quick reminders, then time to change\nWarm-up (10–15 min): movement with S&C, one- and two-touch passing, 45-second possession games\nUnits: forwards finish, midfield move with the ball, defenders cover and balance\nBefore kick-off: one-to-ones (how do you feel, what’s your target today?)\nKO −15: own preparation, fully changed\nLast thing: a short word from every member of staff\nFirst 5 minutes: staff quiet, watch their shape and approach\nFull time: players first, then staff: what went well, what needs changing, what’s next; end positive, huddle',
      halftime: 'Players speak first: what are you seeing?\nStaff add two or three points only\nStaff with the team for about 5 minutes; players on their own for the last 10',
      staffRoles: 'Set-up of changing room and warm-up: \nWarm-up (with S&C): \nOne-to-ones before the game: \nBench and subs briefing: '
    }
  },
  {
    id: 'mt-england-ht', name: 'Half-time process (England youth teams)', part: 'day',
    why: 'Aidy Boothroyd’s half-time with England’s youth teams: a calm, consistent process whatever the score. Each coach notes three points through their own lens, the head coach picks only what helps win or stay in the game, and the messages go to the players as questions.',
    who: 'Aidy Boothroyd, England U21, The FA Boot Room', url: 'https://www.thefa.com/bootroom/resources/coaching/what-does-half-time-look-like-for-englands-youth-teams',
    tips: ['About 10 minutes with the players.', 'Save everything else for the review: half-time is only for what helps now.', 'A board in the middle of the room gets the players talking about their own positions.'],
    fills: {
      halftime: '1. Players settle, drink and talk; one of the staff stays with them and reports back\n2. Coaches each write their three key points (in possession, out of possession, goalkeepers)\n3. Head coach picks the messages: only what helps win or stay in the game\n4. Deliver them as questions; give a direct answer only if they need a push\n5. About 10 minutes with the players; use the board',
      staffRoles: 'Watches in possession: \nWatches out of possession: \nGoalkeepers: \nStays with the players at half-time: '
    }
  },
  {
    id: 'mt-three-targets', name: 'Three team targets', part: 'day',
    why: 'Five minutes before kick-off the players set three team targets: one in possession, one out of possession, and one mental or physical. At half-time they rate themselves against them and reset them if needed.',
    who: 'Ian Bateman, FA youth coach educator, The FA Boot Room', url: 'https://www.thefa.com/bootroom/resources/coaching/countdown-to-kick-off',
    tips: ['Make the targets measurable where you can.', 'Touchline: short and positive, linked to the targets, in natural breaks.', 'Full time: two positives; then one development point each, later.'],
    fills: {
      targets: 'Set by the players, 5 minutes before kick-off:\nIn possession: \nOut of possession: \nMental or physical: \nHalf-time: rate each one, reset if needed',
      halftime: 'Review the three targets: players rate them\nA moment of calm\nReset a target if needed'
    }
  },
  {
    id: 'mt-dna-gameplan', name: 'Plan, do, review (England DNA)', part: 'plan',
    why: 'How the England teams run a fixture: a specific tactical plan for each game built from the last games and training, learning objectives for the team and individuals, short half-time feedback with unit discussions, and a review against those objectives that agrees what to take into the next fixture.',
    who: 'The FA, England DNA: game strategy', url: 'https://www.thefa.com/bootroom/resources/england-dna/how-we-coach/game-strategy',
    tips: ['The review afterwards measures the game against these objectives, so write them so you could see them.', 'Agree with your staff what goes into the next fixture.'],
    fills: {
      targets: 'Team learning objective: \nUnit objectives: \nIndividual objectives (Four Corner): ',
      halftime: 'Short feedback: two or three points\nUnits talk together: defenders, midfield, forwards\nIndividual words where needed'
    }
  },
  {
    id: 'mt-sadler', name: 'Match day planning for the women’s game (Abbie Sadler)', part: 'day',
    why: 'Abbie Sadler, The FA’s Women’s Pathway Coach Developer Lead: give individuals, units and partnerships small targets to review, align the staff before the game, keep the messages the same in training, the talk and on the touchline, and at half-time ask before you tell.',
    who: 'Abbie Sadler, The FA, on The FA’s Coachcast', url: 'https://community.thefa.com/coaching/podcasts/w/coachcast-transcripts/1544/episode-twenty-two-matchday-planning-with-abbie-sadler',
    tips: ['Watch the quiet ones before the game: nerves don’t always show.', 'Give subs a task while they wait (count shots, blocks) so they can feed back.', 'Afterwards: praise specific things, give each player one thing to work on, link it to next week’s training.'],
    fills: {
      targets: 'Individuals: \nPartnerships: \nUnits: ',
      staffRoles: 'Plan shared with staff (when, how): \nSubs’ task while they wait: ',
      halftime: 'Ask first: how do you feel, what went well?\nThen two or three points\nKeep it short'
    }
  }
];

export const matchTplById = id => MATCH_TEMPLATES.find(t => t.id === id) || null;

// Labels for every field a template can fill, for the "added to" message.
export const FILL_LABEL = { ...Object.fromEntries(Object.entries(MATCH_FIELDS).map(([k, v]) => [k, v.lab])), subs: 'Substitutions', talk: 'Team talk', 'opp.people': 'Key individuals', src: 'Where this comes from' };
