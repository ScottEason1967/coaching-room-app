// In-app help: one guide per screen, shown in a bottom sheet from the ? button in the top bar.
// A step with `show` gets a "Show me" button: it closes the sheet, scrolls to the control, opens any
// fold-out it is inside, flashes it and (for inputs) focuses it.
//   show: a data-f path ('theme'), '#id', a selector in square brackets or starting with a dot
//         ('[data-act="addFrame"]'), or a hash route ('#/plans/programme').
//   tab:  match screen only. The tab the control lives on; Show me switches to it first.
// Guides are text written here. Nothing from Joe's own data is put into them unescaped.
import * as S from './store.js';
import * as cloud from './cloud.js';
import { esc, sheet, closeSheet, toast, today } from './util.js';
import { focusField } from './challenges.js';

const LOOP = 'Model → Programme → Session → Match → Review → Model';
const st = (text, show, tab) => { const o = { text }; if (show) o.show = show; if (tab) o.tab = tab; return o; };
const when = (cond, sel) => cond ? sel : undefined;
const T = () => (S.team() || {}).id;
const phone = () => matchMedia('(max-width:899px)').matches;

// The Coach's challenge, explained once and reused on every screen that has one.
const chalStep = name => st(`**${name}** is the Coach’s challenge for this screen. ${phone() ? 'It is the yellow bar above the bottom menu: tap it to open it. ' : 'It is the yellow panel on the right. '}Questions with a red **!** are must-dos. They block nothing, but they are what the licence looks for. Questions with a **?** are things to think about: tap **Not this time** to set one aside (**Show … set aside** brings it back). Tap a question to jump to the box it is about.`, phone() ? '#dockBar' : '#chal');

// The review gate, explained the same way wherever it comes up.
const GATE = 'Once a session or match date has passed, you cannot plan a new session or match until its review is finished or you mark it **Didn’t happen**. The reason: your next session is built from what you write in the review. Without it, the loop does not close.';

const fmtGuide = g => ({ loop: LOOP + '.', ...g });

/* ------------------------------------------------------------------ Home */
const home = () => {
  const open = !S.meta().startHereDone;
  const due = T() ? S.reviewsDue(T()).length : 0;
  return {
    title: 'Home',
    purpose: 'Home shows where you are in the loop and what needs doing next. Start at the top and work down.',
    loop: `Home is not a step in the loop. It shows which step you are on: ${LOOP}.`,
    steps: [
      st('The **ring** is the loop: Model, Plan, Coach, Review. The bright part is where you are now. Tap a word on it to go there.', '.cycle'),
      st('If a **Review due** panel is at the top, a session or match has been played and its review is not finished. Tap **Review** (or **Finish**) first. ' + GATE, when(due, '[aria-label="Reviews due"]')),
      st('**Start here** is the set-up list for your first week. Tap **Got it** when you have finished with it. You can bring it back from More > Start here.', when(open, '#startHere')),
      st('**Carried forward** is the one thing you decided to change in your last review. It stays here until a session acts on it. When one does, you get a link to that session.', '[aria-label="Carried forward"]'),
      st('**Training block** shows the block that is running, which week you are in and what that week adds. Tap the block’s name to open it. With none running, tap **Plan four to six weeks**.', '[aria-label="Training block"]'),
      st('**Next match** shows who you play next and whether the opposition report and the plan are ready. Tap **Open match plan**. With nothing in the diary it says **New match plan**.', '[aria-label="Next match"]'),
      st('**New session**, **Board** and **Game model** are shortcuts to the three things you open most.', '[data-act="newSession"]'),
      st('**Coming up** lists the next sessions and matches by date. Tap one to open it.', '[aria-label="Coming up"]'),
      st('Every screen has a **?** at the top right. Tap it for the guide to that screen.', '[aria-label="How to use this screen"]')
    ]
  };
};

/* ----------------------------------------------------------------- Model */
const model = () => ({
  title: 'Game model',
  purpose: 'Your game model is how the team plays, written down: an identity, then principles for each phase of the game. Sessions, matches and reviews are all tested against it.',
  loop: `Model is where the loop starts: ${LOOP}. Reviews send you back here to change it.`,
  steps: [
    st('Write the **Identity** first: one paragraph on how the team plays, what it always does and what it never does. Every principle should follow from it.', 'identity'),
    st('The tabs are the phases: **In possession**, **Out of possession**, **When we win it**, **When we lose it** and **Set pieces**. The number is how many principles each has. Tap one to see its principles. Players carry three or four per phase, so keep each list short.', '[aria-label="Phases"]'),
    st('Each principle is a card. Tap it to open it. The pill on the right says **Draft** or **Agreed**. Under the title you see its “why”, its sub-principles, when it applies, and how many drills and sessions back it up.', '[href^="#/principle/"]'),
    st('Tap **Add a principle** at the bottom to write a new one in the phase you are looking at.', '[data-act="add"]'),
    st('**Draft or agreed.** The starter principles are drafts. Rewrite each in your own words, then open it and tap **Agreed**. Agreeing saves version 1. Players only see agreed principles on their pages.'),
    st('**Shape & roles** is the last tab. It holds your base formation, how you build, where you defend from, rest defence, and what you expect of each position. The match plan uses these to test your plan against how each opponent presses.', '[data-act="phase"][data-arg="shape"]'),
    chalStep('Model check'),
    st('**Version … · history** (top right of the heading) lists every saved version of every principle, newest first. It is your record of how the model has changed and why.', '[data-act="history"]')
  ]
});

/* ------------------------------------------------------------- Principle */
const principle = () => ({
  title: 'A principle',
  purpose: 'One principle of your game model. Write it so a player could say it back to you.',
  loop: `Principles are the Model step: ${LOOP}. Blocks, sessions, drills and reviews all point back at them.`,
  steps: [
    st('**Status.** It starts as **Draft**. When you are happy with it in your own words, tap **Agreed**. That needs a title, and it saves version 1.', '[data-act="status"][data-arg="agreed"]'),
    st('**Principle**: the title. Short enough that a player can remember it.', 'title'),
    st('**Why**: what it means and why you do it.', 'why'),
    st('**When**: the trigger or cue that tells players it is on. For example, “keeper has it in her hands and their front two are split”.', 'trigger'),
    st('**If it’s not on**: what you do instead. A principle with no answer to “and if not?” is a hope.', 'ifNot'),
    st('**Principles of play** are the course words (penetration, support, width, delay, cover and so on). Tap the ones this principle expresses. Drills and sessions are then read in the same language.', '[data-act="pop"]'),
    st('**Picture**: pick a board that shows it, then tap **Open the board**. A principle with no picture gets a question in the Model check.', 'boardId'),
    st('**Sub-principles**: what the principle looks like for each unit or moment. Tap **Add**, type it, and put finer detail underneath, one per line. The arrow moves it up; the cross removes it.', '[data-act="addSub"]'),
    st('**Versions**: tap **Save a version** after you change the wording and say what changed and why (“After the review v Chester-le-Street”). Old versions stay in the list.', '[data-act="version"]'),
    st('**Evidence** (on a laptop it is on the right, on a phone it is at the bottom): the drills that train this principle, how many sessions used it, which blocks it is in, and how each review scored it. Green is seen, amber partly, red not seen.'),
    st('**Move up** and **Move down** change its order in the phase. **Delete** removes it, and the links from drills and sessions go with it.', '[data-act="move"]')
  ]
});

/* ------------------------------------------------------------ Board list */
const boards = () => ({
  title: 'Tactics board',
  purpose: 'All the boards for this team: shapes, phases of play and set pieces. A board can have many frames, so it can show a move from start to finish.',
  loop: `Boards support every step: they are the picture on a principle, the plan in a match, and the thing players see on their pages. ${LOOP}.`,
  steps: [
    st('Tap **New board**. Give it a name and choose **Shape**, **Phase of play** or **Set piece**. Pick your shape, and add an opposition shape if you want one. Set pieces start with “Show on player pages” ticked.', '[data-act="new"]'),
    st('Tap a board to open it. Each card shows the first frame, its type, how many frames it has and when you last edited it. “On player pages” means players can see it.', '[href^="#/board/"]'),
    st('Boards are used in three places. A **principle** can point at one as its picture. A **match plan** can attach shapes and set pieces so they print with the plan. And boards marked for players show on their player pages.')
  ]
});

/* ----------------------------------------------------------------- Board */
const board = () => ({
  title: 'A board',
  purpose: 'Draw a shape or a move and play it through frame by frame. Each frame is one moment; the next frame is what happens next.',
  loop: `Boards support the whole loop: ${LOOP}. Attach them to a match plan or a principle so the picture travels with it.`,
  steps: [
    st('**Open a board** from the list, or make a new one. The pitch shows frame 1. The small pictures under the pitch are the frames, in order. Tap one to go to it.', '#frames'),
    st('**Move** is the tool that is on when you open a board. Drag a player to where you want her.', '[data-tool="select"]'),
    st('**Pass**, **Run**, **Dribble** and **Press** each draw an arrow: pick the tool, then drag on the pitch from the start to the end. Tap an arrow afterwards to change its type or remove it. The tool stays on, so tap **Move** again when you have finished drawing.', '[data-tool="arrow:pass"]'),
    st('**Opponent**, **Ball**, **Label**, **Cone** and **Mannequin** put something on the pitch: pick the tool, then tap where it goes. Opponent, Ball and Label switch back to Move by themselves.', '[data-tool="add:opp"]'),
    st('To show what happens next, tap **Next frame**. It copies the positions into a new frame without the arrows. Move the players to where they go next and draw the new arrows.', '[data-act="addFrame"]'),
    st('Each frame has a **Name**, a **Phase** and **Coaching notes for this moment** under the pitch. Write the notes for players: what they should see and do here.', '#fT'),
    st('**Play** runs the frames through one after another so you can see the move. You need at least two frames.', '[data-act="play"]'),
    st('**Frame** opens a menu: duplicate this frame, move it earlier or later, clear its arrows, or delete it.', '[data-act="frameMenu"]'),
    st('**Zoom** magnifies the pitch (arrow buttons appear so you can move around it). The button that says **Upright** or **Sideways** turns the pitch the other way. **Undo** takes back your last change.', '[data-act="zoom"]'),
    st('**Shapes** puts our team (or the opposition) into a formation. It keeps the same players on where it can and leaves the arrows and the ball alone.', '[data-act="shape"]'),
    st('**Tap a player** to open the inspector. You can **Swap for** another player from the squad (it changes this frame and every later one), or **Take off the pitch**. Opponents and labels have a text box for their number or words.', '#insp'),
    st('The **bench chips** under the inspector (“Not on the pitch · tap to bring on”) are squad players who are not in this frame. Tap one to put her on.', '#insp'),
    st('**Image** saves the pitch as a picture, **Print** prints every frame, and **Link** makes a private staff link (it needs cloud sync).', '[data-act="png"]'),
    st('**Show on player pages** is in **Board settings** at the bottom. When it is ticked, players with a link can see this board on their page (the “Boards marked show on player pages” tick in Squad must be on too). It sends every frame’s coaching notes and names every player on the board, so write the notes for the players, not about them. Tap **Update player pages** (on a match plan) or **Update all** (in Squad) to send changes.', '#bSP')
  ]
});

/* ----------------------------------------------------------------- Plans */
const PLANS_TABS = ['sessions', 'matches', 'reviews', 'programme', 'drills'];
const plansTab = params => PLANS_TABS.includes((params || [])[0]) ? params[0] : (S.meta().plansTab || 'sessions');

const plans = params => {
  const tab = plansTab(params);
  const strip = st('The tabs along the top are **Sessions**, **Matches**, **Reviews**, **Programme** and **Drills**.', '[role="tablist"]');
  if (tab === 'sessions') return {
    title: 'Plans: Sessions',
    purpose: 'Every training session you have planned or done. Sessions coming up are first; sessions already done are under Done.',
    loop: `Sessions are the middle of the loop: ${LOOP}. Each is built from the block and from your last review.`,
    steps: [
      strip,
      st('Tap **New session**. The app picks your usual training night as the date and fills in the block’s principles. If a review is outstanding it stops you first. ' + GATE, '[data-act="newS"]'),
      st('Tap a session to open it. The row shows the date, minutes, number of practices and the block and week it falls in. The pill on the right tells you its review state: **Today**, **Needs review**, **Review unfinished**, **Reviewed** or **Didn’t happen**.', '[href^="#/session/"]')
    ]
  };
  if (tab === 'matches') return {
    title: 'Plans: Matches',
    purpose: 'Every match plan, coming up and played. A match plan tests your game model against one opponent.',
    loop: `Matches come after sessions: ${LOOP}. The review you write afterwards feeds the opponent file.`,
    steps: [
      strip,
      st('Tap **New match plan**. If a review is outstanding the app asks for it first. ' + GATE, '[data-act="newM"]'),
      st('Tap a match to open it. The row shows the opponent, the date and, once played, the score. The pill says whether it is waiting for a review. “Example” marks the starter plan built from your Hudl notes.', '[href^="#/match/"]')
    ]
  };
  if (tab === 'reviews') return {
    title: 'Plans: Reviews',
    purpose: 'Every review you have written. There is one for each session and match that has been played.',
    loop: `Reviews close the loop: ${LOOP}. The “one thing to change” from the latest review is what your next session is built from.`,
    steps: [
      strip,
      st('Each row is a review: the session theme or the opponent, the date, and the one thing you decided to change. **Done** means every part that feeds the next session is written. **Unfinished** means it is not, and it still counts as outstanding. Tap one to open it.', '[href^="#/review/"]'),
      st('You start a review from the session or match itself (**Review now** on a session, **Review** on a match) or from the **Review due** panel on Home. There is no New button here on purpose. ' + GATE)
    ]
  };
  if (tab === 'programme') return {
    title: 'Plans: Programme',
    purpose: 'Your training blocks. A block is four to six weeks on one or two principles, with something new each week. Sessions in a block’s dates belong to it automatically.',
    loop: `Programme sits between the model and the session: ${LOOP}.`,
    steps: [
      strip,
      st('Tap **New block**. It starts when your last block ends, or today. You then give it a title, choose the principles and write what each week adds.', '[data-act="newB"]'),
      st('Blocks are listed as **Running now**, **Coming up** and **Finished**. Tap one to open it. The pill shows the week you are in.', '[href^="#/block/"]')
    ]
  };
  return {
    title: 'Plans: Drills',
    purpose: 'Your drill library. It comes with you to every team; each drill links to principles separately for each team.',
    loop: `Drills are what you build a session from: ${LOOP}.`,
    steps: [
      strip,
      st('Type in **Search drills** to find one by name, type or objective.', '#dq'),
      st('**Linked to this team** shows only drills that serve at least one of this team’s principles.', '[data-act="mine"]'),
      st('Tap **New drill** to design one.', '[data-act="newD"]'),
      st('Each card shows the diagram, the type, minutes and linked principles. The pill says **Ready** or how many must-dos are left (**to do**). Tap one to open it.', '[href^="#/drill/"]')
    ]
  };
};

/* ----------------------------------------------------------------- Block */
const block = params => {
  const b = S.get((params || [])[0]) || {};
  const live = b.start && b.start <= today();
  return {
    title: 'A training block',
    purpose: 'A block puts four to six weeks behind one or two principles, with something new each week. One-off sessions do not add up; blocks do.',
    loop: `Block is the Programme step: ${LOOP}. It is built from what the reviews and fixtures say, and it fills in the principles on each new session.`,
    steps: [
      st('**Block title**: what the team will be able to do by the end.', 'title'),
      st('**Starts** and **Weeks**. Sessions dated inside these weeks belong to the block. Changing either redraws the week-by-week list.', 'start'),
      st('Choose the **Principles this block is about**. One or two. Tap a chip to add or remove it. New sessions in the block start with these ticked.', '[data-act="pr"]'),
      st('**Why now**: what the reviews or the fixtures say. This is your evidence for choosing it.', 'aim'),
      st('**Week by week**: write what each week adds, simple to complex or part to whole. Sessions and matches in each week are listed under it. A session on other principles is marked.', 'weeksPlan.0'),
      st('**End of block** appears once the block is running or finished. Did the team get there? What is the evidence, and what is next? Write it before you plan the next block.', when(live, 'outcome')),
      st('**Evidence in this block** (right on a laptop, bottom on a phone) counts sessions, matches and reviews, and how each principle scored.'),
      st('**Delete block** keeps the sessions; they just stop belonging to a block.', '[data-act="del"]')
    ]
  };
};

/* --------------------------------------------------------------- Session */
const session = params => {
  const s = S.get((params || [])[0]) || {}; const t = s.team || T();
  const lc = t ? S.lastChange(t) : null; const nm = t ? S.nextMatch(t) : null;
  const happened = s.date && s.date <= today() && !s.cancelled;
  return {
    title: 'A session plan',
    purpose: 'Plan one training session: what the team will get better at, which practices, and what you will look for. Build it from the block and from your last review.',
    loop: `Session is the middle of the loop: ${LOOP}. You plan it from the block, coach it, then review it.`,
    steps: [
      st('**Theme**: one sentence on what the team will be better at by the end.', 'theme'),
      st('Set the **Date**, **Time**, **Venue** and **Length**. The date decides which training block the session belongs to.', 'date'),
      st('The **Block** line shows the training block this date falls in, the week, and what that week adds. If there is none, tap **Plan one** to make a block so sessions add up.', blockSel(t, s)),
      st('Tap the **Principles this session is about**. If the session is in a block, the block’s principles are already ticked.', '#sessionPrinciples'),
      st('**Carried forward**: the one thing you decided to change in your last review. Tick **This session acts on it**, then say **How**: which practice, which players, what will look different. The next review asks whether you did it.', when(lc, 'addresses')),
      st('**What I’m looking for tonight**: two or three things you could see or count. The review asks whether you saw them.', 'lookFor'),
      st('**Focus players**: pick one or two and the goal you are working on with them (it shows in brackets). Then write what you will watch for and what you will say to them.', '#focusChips'),
      st('**Add a practice** chooses from your drill library or designs a new one. Tap a practice’s picture to open the drill; Back brings you here. Use the arrow to move a practice up and the cross to remove it.', '[data-act="add"]'),
      st('Each practice has **Minutes** and **Talk**. Talk is the time you expect to spend explaining, stopping and setting up. Ball rolling is minutes minus talk, as a percentage. The England DNA aim is 70% or more. The pill above the list adds it up.', '#rollPill'),
      st('Tick **Warm-up includes injury-prevention work** if it does. If not, plan it in.', 'injuryPrev'),
      st('**Kit to bring** is worked out from the drill diagrams once you have added practices.'),
      st('**This session prepares for them** appears when a match is coming up. Tick it if the session is aimed at that opponent.', when(nm && nm.date && (!s.date || nm.date >= s.date), 'matchPrep')),
      chalStep('Session check'),
      st('**Share with staff** makes a private link and PIN so staff can see the plan on their phones. It needs cloud sync. Staff can comment, and their comments show in the same panel.', '[data-act="share"]'),
      st('**Print** makes a clean one-page plan with the diagrams. On an iPhone, printing from the home-screen app may not work; use Safari.', '[data-act="print"]'),
      st('When the session day arrives, a bar at the top offers **Review now**. Do it the same night, while you remember. **Open review** and **Finish review** appear later.', when(happened, '#reviewBar')),
      st('**Didn’t happen** is for a session that was called off (weather, no pitch). It clears the review you would otherwise owe. ' + GATE, when(!s.cancelled, '[data-act="cancel"]'))
    ]
  };
};
// A block link when the date is in a block; otherwise the link to plan one.
const blockSel = (t, s) => t && S.blockFor(t, s.date) ? '[href^="#/block/"]' : '[href="#/plans/programme"]';

/* ----------------------------------------------------------------- Drill */
const drill = () => ({
  title: 'A drill',
  purpose: 'Design one practice: the diagram, what it is for and how you will coach it. The same drill can be used in many sessions.',
  loop: `Drills are what a session is built from: ${LOOP}. A drill should serve a principle, or it does not belong.`,
  steps: [
    st('**Name**, **Practice type**, **Area**, **Players** and **Minutes**. Area sets the real size of the pitch drawing; choose **Custom** for your own width and length.', 'name'),
    st('**Practice type** matters: Skill (opposed), Small-sided game, Phase of play, Functional and Game (11v11) count as opposed, and the last four count as game-like. The Drill check asks different questions depending on the type.', 'type'),
    st('**Area**: pick a standard area or Custom. The check works out the space per player from it.', '#area'),
    st('The **kit palette** is the strip of buttons above the diagram: **Move**, then the kit (**Disc**, **Cone**, **Mannequin**, **Pole**, **Hurdle**, **Ladder**, **Mini goal**, **Goal**, **Ball**, **Attacker**, **Defender**, **Neutral**, **Keeper**, **Coach**, **Zone**, **Label**) and the arrows **Pass**, **Run**, **Dribble**, **Press**. Pick an item, then tap the area to place it. Pick **Move** to drag things around.', '[aria-label="Kit"]'),
    st('The **Colour** circles set the colour of the next disc or cone you place. Tap one while a disc or cone is selected to recolour it.', '[data-col]'),
    st('The **diagram**: tap an item to select it and change its text, turn it, copy it or remove it (the box under the buttons). Pick an arrow tool and drag to draw. **Undo**, **Clear arrows**, **Zoom**, **Image** and **Print** are under the diagram.', '#dc'),
    st('**Objective**: what the players will be better at by the end. Write it as that, not as what they will do.', 'objective'),
    st('**Principles it serves** for this team: tap the ones it trains. The links are per team, so the same drill can serve different principles at another club.', '#drillPrinciples'),
    st('**Organisation**: area, numbers, rotation.', 'org'),
    st('**How it works**: the rules and the sequence.', 'how'),
    st('**Coaching points**: what you will look for, and what you will say when it goes wrong.', 'points'),
    st('**Success looks like**: something you can see or count, so you know when to progress it.', 'success'),
    st('**Progress** (harder) and **Regress** (easier): the change you will make if it is too easy or falling apart. Think space, task, equipment, players.', 'prog'),
    st('**Realism**: the **Direction** of play (is there a way to score?) and **Transition** (what happens the moment the ball is won or lost).', 'direction'),
    st('**Planned questions**: two or three, one per line, that open the decision up. Questions made up on the spot tend to be “what should you have done?”', 'questions'),
    st('**I step in when…**: the picture that makes you stop the practice, so you do not stop it for everything.', 'stepIn'),
    st('**Four corners**: only fill in the corners you are developing on purpose (technical / tactical, physical, psychological, social) and say how.', 'corners.tech'),
    st('**How you plan to intervene**: tap at least one style, from Command to Trial and error. Mixing styles reaches more players.', '#interventions'),
    chalStep('Drill check'),
    st('**Duplicate** makes a copy to change. **Delete drill** removes it, and sessions that used it show it as missing.', '[data-act="dup"]')
  ]
});

/* ----------------------------------------------------------------- Match */
const match = params => {
  const m = S.get((params || [])[0]) || {}; const t = m.team || T();
  const played = m.date && m.date <= today();
  const prev = t && m.id ? S.previousMeetings(t, m).length : 0;
  const trained = t && m.id ? S.trainedBefore(t, m).length : 0;
  const hasSquad = (m.squadIds || []).length > 0;
  return {
    title: 'A match plan',
    purpose: 'Test your game model against one opponent: how they play, what wins you the game, your plan B, who is in the squad and what each player has to do.',
    loop: `Match comes after the sessions: ${LOOP}. The review you write afterwards feeds the opponent file and the model.`,
    steps: [
      st('**Opponent**, **Date**, **Kick-off**, **Venue** and **Competition** are at the top. Type the opponent’s name and the app offers names you have played before. Playing the same team again shows their opponent file on the Them tab.', 'opponent'),
      st('The tabs are **Them**, **Plan**, **Squad**, **Boards** and **Day**. Tap one to switch. Your changes are saved as you type.', '[role="tablist"]'),
      st('**Opponent file** (Them tab) appears when you have played this team before. It shows last time’s keys, what they did that you did not expect, and what did not work. If this plan is empty, **Start from last time’s analysis** copies it for you to update.', when(prev, '#oppFile'), 'them'),
      st('**How they play**: the tags (shape, how they build, how they press, their transitions, in the air, set-piece threat). They drive the questions in the challenge and the suggested principles under test. Pick **Not known** if you do not know.', 'tags.press', 'them'),
      st('**Where this comes from**: Hudl, watched live, league table. It tells you how far to trust the report.', 'src', 'them'),
      st('**In possession**, **Out of possession**, **When they win it**, **When they lose it**, **Set pieces** and **Key individuals**: write what you saw.', 'opp.ip', 'them'),
      st('**What wins us the game?** At least two things, one per line. The review scores each one afterwards.', 'plan.keys', 'plan'),
      st('**Their biggest threat, and our answer.**', 'plan.threat', 'plan'),
      st('**The first ten minutes**: what you expect from them and what you want from your team.', 'plan.first', 'plan'),
      st('**Plan B**: the trigger that tells you it is not working, and what you change. A plan with no plan B is a hope.', 'plan.planB', 'plan'),
      st('**Substitutions**: who comes on for what, and who moves where. Decide it now, not in the 70th minute.', 'plan.subs', 'plan'),
      st('**Our plan in possession / out of possession**, **Our set pieces** and **Their set pieces**.', 'plan.ip', 'plan'),
      st('**Trained this week** lists the sessions in the seven days before the match. If what you trained is not in the keys or the principles under test, either put it in or ask why you trained it.', when(trained, '#trained'), 'plan'),
      st('**Principles under test**: pick the two or three principles this opponent threatens most. A “?” on a chip is the app’s suggestion from the tags. Each one you pick gets a box: keep it, tweak it for this game, or accept the risk. The review scores these first.', '#focusPrinciples', 'plan'),
      st('**Squad**: tap the players in the squad (**All** and **None** help). Add selection notes, such as the starting XI.', '#squadChips', 'squad'),
      st('**Individual instructions**: one box per squad player. Each player sees only her own, on her player page. Write her job against this opponent.', when(hasSquad, '#instructions'), 'squad'),
      st('**Boards**: **Attach a board** adds a shape or set piece you have drawn, or **New board for this match** makes one. Attached boards print with the plan and, if marked for players, appear on their pages.', '#boards', 'boards'),
      st('**Team talk** (Day tab): three things, in their language.', 'plan.talk', 'day'),
      st('**Print match plan** and **Print player cards** (one instruction card per player) give you paper for the day. **Share with staff** makes a private link and PIN.', '[data-act="print"]', 'day'),
      st('**Update player pages** sends the latest to every player who has a link: her own instruction, the keys, and boards marked for players. It needs cloud sync, and links are made in Squad.', '[data-act="players"]', 'day'),
      st('**Result** (Day tab) appears once the match date has come. Put the score in so the opponent file keeps it.', when(played, 'result.us'), 'day'),
      chalStep('What wins this game?'),
      st('Once the date arrives a bar at the top offers **Review**. Do it on Monday at the latest. ' + GATE, when(played && !m.cancelled, '#reviewBar')),
      st('**Didn’t happen** is for a postponed or cancelled match. It clears the review you would otherwise owe.', when(!m.cancelled && m.date, '[data-act="cancel"]'))
    ]
  };
};

/* ---------------------------------------------------------------- Review */
const review = params => {
  const r = S.get((params || [])[0]) || {}; const isMatch = r.type === 'match';
  const steps = [
    st('**The plan** is a fold-out at the top. It shows what you planned, so you review against that and not against what you remember.', '.card.inset'),
    st('**Last time you decided** shows the one thing you chose to change after the previous review. Answer **Did you do it?** with Yes, Partly or No, then say what happened, or what got in the way.', when(r.carried, '#carried'))
  ];
  if (isMatch) steps.push(
    st('Put the score in at the top (**Us** and **Them**). It goes on the match plan and the opponent file.', '#rsUs'),
    st('**Did the keys to winning happen?** Score each key you wrote on the match plan: Yes, Partly or No.', when((r.keys || []).length, '#keys')),
    st('**Goals, both ends**: how each one happened. Say the phase, which principle held or failed and who was where. It is the most honest data you have.', 'goalsHow'),
    st('**What you changed during the game**, when, and whether it worked. If you changed nothing, was that a decision or a lapse?', 'decisions'),
    st('**The two or three moments that decided it.**', 'moments'),
    st('**Did it show in the game?** asks whether what you trained in the week showed up on the pitch.', when((r.trained || []).length, '#trainedShowed')),
    st('**What they did that you didn’t expect** goes into the opponent file for next time you play them. **Clips to cut** is for Hudl timestamps.', 'them')
  );
  else steps.push(
    st('**What actually happened** starts with “Did you see it?” for the thing you said you were looking for. Answer Yes, Partly or No.', when(r.lookFor, '#lookForSeen')),
    st('**Ball rolling, actual %** and **Times you stopped it**. Rough is fine. The point is to notice how it compares with the plan.', 'rollingActual')
  );
  steps.push(
    st(`**${isMatch ? 'Principles under test: did they hold?' : 'Principles: did you see them?'}** Score each principle **Not seen**, **Partly** or **Seen**. Not seen twice running is a flag in the Model check. Other principles are in a fold-out if you want to score them too.`, '#scores'),
    st('**What worked?** and **What didn’t?** Both halves. A review with only good news teaches nothing.', 'worked'),
    st('**Why?** Tick all that apply: the plan, my delivery, the players, the opposition, numbers or conditions. Be honest about your own delivery.', '#why'),
    st('**One thing to change next time** is the most important box. It appears on Home and in your next session plan until you act on it.', 'change'),
    st('**Does the game model need to change?** Leave it blank if not. If yes, say which principle and how, then tap the principle’s name to edit it.', 'modelChange'),
    st('**Me as a coach**: what you learned about yourself. These lines build the strengths-and-development profile on the Pathway screen.', 'self'),
    st('**Player observations**: one line per player on what you saw, what you said and what next. Focus players come first. They show under Observations on that player’s screen in Squad.', '#playerObs'),
    chalStep('Review check'),
    st('**Why the review is compulsory.** ' + GATE)
  );
  return {
    title: isMatch ? 'Match review' : 'Session review',
    purpose: 'Write down what happened while you remember. The review decides what your next session works on and feeds the model, the opponent file and your own profile.',
    loop: `Review closes the loop: ${LOOP}. What you write here appears on Home and in the next session plan.`,
    steps
  };
};

/* ----------------------------------------------------------------- Squad */
const squad = () => ({
  title: 'Squad',
  purpose: 'Your players for this team. Each has a number, a position, development goals and, if you want, a private page of her own.',
  loop: `Squad feeds the Session step (focus players and their goals) and the Match step (the squad and each instruction): ${LOOP}.`,
  steps: [
    st('**Paste a list** sets up the whole squad at once. One player per line: number, name, position, for example `7 Jane Smith RW`. If a number already exists, that player’s name and position are replaced, so you can swap the dummy names in one go.', '[data-act="import"]'),
    st('**Add player** adds one: number, name and position.', '[data-act="add"]'),
    st('Tap a player to open her page: goals, notes and her link. The green **Link** tag means she has a player page.', '[href^="#/player/"]'),
    st('**Player pages** (the box on the right, below the list on a phone): tick what goes on every page: agreed principles, the keys to winning for the next match, and boards marked “show on player pages”. Her number, goals and her own match instruction are always on. Your private notes never are.', '[data-o="principles"]'),
    st('**Update all … player pages** sends the latest to every player who has a link. You need to be signed in (More > Cloud sync).', '[data-act="pushAll"]'),
    st('If any players are under 18, check your club’s safeguarding policy before sending links. For example, send them through a parent.')
  ]
});

const player = () => ({
  title: 'A player',
  purpose: 'One player’s page: her details, the goals you have agreed with her, what you have seen in reviews and her private link.',
  loop: `Goals set here show up when you pick focus players in a session, and the notes you write in reviews come back here: ${LOOP}.`,
  steps: [
    st('**Number**, **Name**, **Position**, **Also plays**, **Foot** and **Name on the board**. The last one is the short name (up to 12 letters) that shows under her on tactics boards.', 'short'),
    st('**Development goals**: tap **Add**, then write what she is working on and how you will work on it together. Agree it with her. Mark it **Working on it**, **Achieved** or **Parked**. She sees these on her page, except parked ones. Goals that are Working on it show next to her name when you pick focus players.', '[data-act="goal"]'),
    st('**Observations from reviews** collects the one-liners you write about her in session and match reviews. You do not type here.'),
    st('**Private notes** are for staff only and never go on her page. Do not record medical or health details here.', 'notes'),
    st('**Create her link** makes a private link and a 4-digit PIN for her page. It needs cloud sync. After that the button says **Link and PIN**: send the link, give the PIN separately, update, change the PIN, turn it off or delete it. Five wrong PINs locks it for 15 minutes.', '[data-act="link"]'),
    st('**Remove from squad** takes her off boards and match squads and deletes her link.', '[data-act="del"]')
  ]
});

/* -------------------------------------------------------- Pathway and more */
const pathway = () => ({
  title: 'Pathway',
  purpose: 'Where you are on the road from UEFA C to Pro, and the evidence you are building from the work you already do in the app.',
  loop: `Pathway sits outside the loop and collects from it: ${LOOP}. Your review lines and plans become your evidence.`,
  steps: [
    st('**Me as a coach**: write your strengths with evidence, your areas for development, and what you are working on now and how you will know. Rewrite it every few weeks; do not let it become a diary.', 'strengths'),
    st('The “me as a coach” lines you write in reviews collect under **Your last … reflections**. Use them to update the boxes above.', 'develop'),
    st('**What I’m working on now** is one line you can count, such as a maximum of three stoppages per practice.', 'workingOn'),
    st('**UEFA C evidence so far** is counted for you from your plans and reviews across all teams: goals set, opposition analyses, blocks, planned questions, ball-rolling and more. You do not fill it in.', '.grid3'),
    st('**Pro competences**: rate yourself from 1 (not started) to 4 (strong) on each line. Re-rate every few months; the **Rating history** shows your progress for course applications.', '[data-act="rate"]')
  ]
});

const logbook = () => ({
  title: 'Logbook',
  purpose: 'A record of your coaching hours and CPD (courses, workshops, observations, mentor chats, reading). Coaching hours are counted from your delivered sessions.',
  loop: `The logbook records the work around the loop: ${LOOP}.`,
  steps: [
    st('The three numbers at the top are your **CPD hours** (from the entries below), **Hours coaching** (counted from sessions you have delivered, across all your teams) and **Matches** played.', '.grid3'),
    st('Tap **Add to logbook** for a course, workshop, observation or chat. Give the date, hours, type, what it was, and what you learned and how you will use it.', '[data-act="add"]'),
    st('Tap an entry to change it or delete it. Entries are listed newest first.', when(S.cpd().length, '[data-act="edit"]'))
  ]
});

const teams = () => ({
  title: 'Teams',
  purpose: 'Every team you coach. Each has its own squad, game model, boards, sessions, matches and reviews. Your drill library, logbook and pathway stay with you.',
  loop: `Each team has its own loop: ${LOOP}.`,
  steps: [
    st('Tap a team to open its details. You can also switch team from the team button at the top left of Home, Model, Board, Plans and Squad (on a laptop, at the top of the side menu).', '[href^="#/team/"]'),
    st('**Add a team** starts a new one. You can start its game model from a copy of another team’s principles (they come in as drafts).', '[href="#/team/new"]'),
    st('Under each name you see the season, the number of players and whether it is archived or the team you are using now. Switching team changes the squad, model, boards, sessions, matches and reviews you see everywhere.')
  ]
});

const team = params => (params || [])[0] === 'new' ? {
  title: 'New team',
  purpose: 'Add a team you coach. You can fill in the rest later.',
  loop: `A new team starts a new loop: ${LOOP}.`,
  steps: [
    st('**Team name** is the only thing you must fill in.', '#tN'),
    st('**Base formation** is the shape used for new boards and the Shape & roles tab.', '#tF'),
    st('**Start the game model from** copies another team’s principles in as drafts, or begins blank. A new group may need very different principles.', when(S.teams().length, '#tP')),
    st('**Create team** saves it and takes you to Squad to add the players.', '#tGo')
  ]
} : {
  title: 'A team',
  purpose: 'The details of one team.',
  loop: `Each team has its own loop: ${LOOP}.`,
  steps: [
    st('**Team name**, **Short name**, **Club** and **Season**. The short name is used where space is tight.', 'name'),
    st('**Base formation** is the shape used for new boards and the Shape & roles tab.', 'formation'),
    st('**Archived** is for a team you no longer coach. It is kept for your records.', 'archived'),
    st('**Delete team** deletes its squad, game model, boards, sessions, matches and reviews on every device. Archiving keeps them.', '[data-act="del"]')
  ]
};

const cloudGuide = () => {
  const on = cloud.configured(), signed = on && cloud.signedIn();
  return {
    title: 'Cloud sync and backup',
    purpose: 'Cloud sync keeps the same data on your phone, iPad and laptop, and switches on player and staff links. Until it is set up, everything is saved on this device only.',
    loop: `Sync does not change the loop, it protects it: ${LOOP}.`,
    steps: [
      st(on ? (signed ? 'You are signed in. This card shows your email, the sync state and how many changes are waiting to upload.' : '**Sign in** with the same email and password on every device. **Create account** is for the first time. **Forgot password** sends a reset link.') : 'This screen says **This device only** until the one-off Supabase set-up is done. The README walks through it (about 15 minutes). Until then use Backup below to move data between devices.', when(on && !signed, '#cE')),
      st('The dot at the top right shows sync at a glance: green is synced, yellow is syncing or not signed in, red is a problem, grey is offline or this device only. Tap it to come to this screen.', '[aria-label^="Sync:"]'),
      st('**Sync now** sends your changes and fetches anyone else’s. It happens by itself too. If you are offline, changes are saved and go up when you are back online.', when(signed, '#cSync')),
      st('**Download backup** saves everything as one file. Keep a copy somewhere safe. **Restore from file** (next to it) puts a backup back in; newer copies already here are kept.', '#bEx'),
      st('**Edits replaced by another device** appears if the same item was changed on two devices before they synced. Sync keeps the last edit, but the one that lost is kept here. Open the item, copy back what you want, then tap **Dismiss**.'),
      st('**Check this device’s clock** appears if the device clock looks wrong. Sync decides “last edit” by the clock, so fix the time in the device settings.')
    ]
  };
};

const more = () => ({
  title: 'More',
  purpose: 'Your own details, and the screens that are not in the bottom menu.',
  loop: `${LOOP}. More holds the pathway, logbook, teams and cloud sync around it.`,
  steps: [
    st('**Your name** and **Initials**. The initials show in the circle at the top right of every screen.', 'name'),
    st('**Pathway** is your road from UEFA C to Pro and the evidence you are building.', '.list [href="#/pathway"]'),
    st('**Coaching logbook** records CPD and coaching hours.', '.list [href="#/logbook"]'),
    st('**Teams** lists every team you coach.', '.list [href="#/teams"]'),
    st('**Cloud sync and backup** shows whether you are synced and is where you download a backup.', '.list [href="#/cloud"]'),
    st('**Start here** brings back the first-run card on Home, in case you want the set-up list again.', '[data-act="startHere"]')
  ]
});

const GUIDES = { home, model, principle, boards, board, plans, drills: () => plans(['drills']), block, drill, session, match, review, squad, player, pathway, logbook, teams, team, cloud: cloudGuide, more };

export function helpFor(routeName, params) {
  const g = GUIDES[routeName]; if (!g) return null;
  try { return fmtGuide(g(params || [])); } catch (e) { console.error('help guide', routeName, e); return null; }
}

// What Show me will land on. Mirrors focusField so the tests can check a selector resolves.
export function findShown(show, root) {
  root = root || document;
  if (!show || show.startsWith('#/')) return null;
  try { return (show.startsWith('#') || show.startsWith('[') || show.startsWith('.')) ? root.querySelector(show) : root.querySelector(`[data-f="${show}"]`); }
  catch (e) { return null; }
}

const rich = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>');

function showMe(step, opts) {
  closeSheet();
  const sel = step.show;
  setTimeout(() => {
    if (sel.startsWith('#/')) { focusField(sel); return; }
    document.body.classList.add('helpflash'); setTimeout(() => document.body.classList.remove('helpflash'), 1700);
    if (focusField(sel, document)) return;
    if (step.tab && opts.goTab) { opts.goTab(step.tab, sel); return; }
    document.body.classList.remove('helpflash');
    toast('That is not on this screen right now. It may be on another tab, or appear once there is something to show.', 4000);
  }, 0);
}

// opts.goTab(tab, show): switch tab on the match screen, then show the control (see match.js, chal).
export function openHelp(routeName, params, opts = {}) {
  const g = helpFor(routeName, params); if (!g) return false;
  const el = sheet(`<div class="stack" id="helpSheet"><div class="h2">${esc(g.title)}</div>
    <p class="small" style="margin:0">${rich(g.purpose)}</p>
    <p class="small muted" style="margin:0">${esc(g.loop)}</p>
    <ol class="helpsteps" style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:0">${g.steps.map((s, i) => `<li style="display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-top:1px solid var(--line)"><span class="badge-num" style="flex:none;width:26px;height:26px;font-size:13px;background:var(--accent-soft);color:var(--accent)">${i + 1}</span><div class="grow small" style="min-width:0;line-height:1.5">${rich(s.text)}${s.show ? `<div style="margin-top:6px"><button class="btn sm" data-show="${i}" aria-label="Show me, step ${i + 1}">Show me</button></div>` : ''}</div></li>`).join('')}</ol>
    <button class="btn block" id="helpX">Close</button></div>`);
  el.querySelectorAll('[data-show]').forEach(b => b.onclick = () => showMe(g.steps[+b.dataset.show], opts));
  el.querySelector('#helpX').onclick = closeSheet;
  return true;
}
