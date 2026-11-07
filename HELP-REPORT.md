# Help layer: report

Built to `HELP-SPEC.md`. All six test scripts ran from `/home/claude/cr/tests` without the -I flag and finished with no page errors (details at the end).

## Files changed

| File | Change |
|---|---|
| `js/help.js` | **New.** `helpFor(routeName, params)`, `openHelp(routeName, params, { goTab })`, `findShown(show, root)` (used by the test), and all the guide text. |
| `js/app.js` | Imports `helpFor`, `openHelp`, `focusField`. `renderTop` adds the round **?** button (`aria-label="How to use this screen"`, same shape and 44 px size as the avatar, between the stuff in `top.actions` and the sync dot) when `helpFor(current.name, current.params)` returns a guide, and wires it to `openHelp` with a `goTab` that sets `matchTab`, refreshes, then calls `focusField`. |
| `js/challenges.js` | `focusField` only: a selector starting with `[` or `.` is now used with `querySelector` directly. `data-f`, `#id` and `#/route` behave as before. |
| `js/views/home.js` | The **Start here** card (`#startHere`, first thing on Home, until `meta().startHereDone`), **Got it** sets the flag. |
| `js/views/more.js` | A **Start here** item in the list that sets `startHereDone` to false and goes to `#/home`. |
| `css/app.css` | One rule: `body.helpflash .flash { outline-color: var(--accent) !important }`. The existing `.flash` outline is yellow (`--lamp`), which the spec reserves for the Coach's challenge, so Show me turns it blue while it flashes. Challenge jumps still flash yellow. |
| `sw.js` | One line: `js/help.js` added to the offline file list (not in the spec; without it the app would not start offline). |
| `README.md` | New "Using it" section above "Player and staff links". |
| `tests/help.py` | **New.** |

No existing test file was changed. `view.html`, `index.html`, `js/cloud.js`, `js/store.js`, the data model and `supabase/` are untouched.

## Guides (steps / steps with Show me), counted in the state `help.py` seeds

| Screen | Steps | With Show me |
|---|---|---|
| Home | 9 | 8 |
| Game model | 8 | 7 |
| A principle | 11 | 10 |
| Tactics board (list) | 3 | 2 |
| A board | 14 | 14 |
| Plans: Sessions | 3 | 3 |
| Plans: Matches | 3 | 3 |
| Plans: Reviews | 3 | 2 |
| Plans: Programme | 3 | 3 |
| Plans: Drills (also `helpFor('drills')`) | 5 | 5 |
| A training block | 8 | 7 |
| A drill | 20 | 20 |
| A session plan | 17 | 14 to 16 (depends on the record) |
| A match plan | 24 | 18 to 24 (depends on the record); 22 selectors over 5 tabs for an upcoming match |
| Review (session) | 13 | 12 |
| Review (match) | 18 | 16 |
| Squad | 6 | 5 |
| A player | 6 | 5 |
| Pathway | 5 | 5 |
| Logbook | 3 | 2 |
| Teams | 3 | 2 |
| A team | 4 | 4 |
| New team (`#/team/new`) | 4 | 4 |
| Cloud sync and backup | 6 | 2 (see below) |
| More | 6 | 6 |

The Board guide follows the spec's frame-by-frame walk with the real controls: `[data-tool="select"]` (Move), `[data-tool="arrow:pass"]` (Pass, Run, Dribble, Press), `[data-act="addFrame"]` (Next frame), `#fT`, `[data-act="play"]`, `[data-act="frameMenu"]`, `[data-act="zoom"]`, `[data-act="shape"]`, `[data-act="png"]` (Image, Print, Link), `#insp` (player inspector and bench chips) and `#bSP` (Show on player pages, and what it sends). The tool names on screen are Move, Pass, Run, Dribble, Press, Opponent, Ball, Label, Cone, Mannequin.

## Output of `python3 help.py`

```
ok   Start here shows on first run
ok   Start here: has the set-up links, the loop, the ? hint
ok   Start here: links go to model, squad, programme, cloud ['#/model', '#/squad', '#/plans/programme', '#/cloud']
ok   Start here is the first thing on Home startHere
ok   home (card open): ? button exists
ok   home (card open): ? button shows "?" '?'
ok   home (card open): sheet "HOME" opens with >= 3 steps (9 steps, 8 with Show me)
ok   home (card open): sheet fits 390 px (no sideways scroll)
ok   home (card open): has purpose, loop line and Close
ok   home (card open): Show me works on all 8 steps that have it
ok   Got it hides the card
ok   card stays hidden after reload
ok   flag is saved
ok   More has a Start here item
ok   More > Start here goes Home and brings the card back
ok   no guide for an unknown route; "drills" alias gives the drills guide [None, 'Plans: Drills']
ok   home: ? button exists
ok   home: ? button shows "?" '?'
ok   home: sheet "HOME" opens with >= 3 steps (9 steps, 8 with Show me)
ok   home: sheet fits 390 px (no sideways scroll)
ok   home: has purpose, loop line and Close
ok   home: Show me works on all 8 steps that have it
ok   model: ? button exists
ok   model: ? button shows "?" '?'
ok   model: sheet "GAME MODEL" opens with >= 3 steps (8 steps, 7 with Show me)
ok   model: sheet fits 390 px (no sideways scroll)
ok   model: has purpose, loop line and Close
ok   model: Show me works on all 7 steps that have it
ok   principle: ? button exists
ok   principle: ? button shows "?" '?'
ok   principle: sheet "A PRINCIPLE" opens with >= 3 steps (11 steps, 10 with Show me)
ok   principle: sheet fits 390 px (no sideways scroll)
ok   principle: has purpose, loop line and Close
ok   principle: Show me works on all 10 steps that have it
ok   boards: ? button exists
ok   boards: ? button shows "?" '?'
ok   boards: sheet "TACTICS BOARD" opens with >= 3 steps (3 steps, 2 with Show me)
ok   boards: sheet fits 390 px (no sideways scroll)
ok   boards: has purpose, loop line and Close
ok   boards: Show me works on all 2 steps that have it
ok   board: ? button exists
ok   board: ? button shows "?" '?'
ok   board: sheet "A BOARD" opens with >= 3 steps (14 steps, 14 with Show me)
ok   board: sheet fits 390 px (no sideways scroll)
ok   board: has purpose, loop line and Close
ok   board: Show me works on all 14 steps that have it
ok   plans: sessions: ? button exists
ok   plans: sessions: ? button shows "?" '?'
ok   plans: sessions: sheet "PLANS: SESSIONS" opens with >= 3 steps (3 steps, 3 with Show me)
ok   plans: sessions: sheet fits 390 px (no sideways scroll)
ok   plans: sessions: has purpose, loop line and Close
ok   plans: sessions: Show me works on all 3 steps that have it
ok   plans: matches: ? button exists
ok   plans: matches: ? button shows "?" '?'
ok   plans: matches: sheet "PLANS: MATCHES" opens with >= 3 steps (3 steps, 3 with Show me)
ok   plans: matches: sheet fits 390 px (no sideways scroll)
ok   plans: matches: has purpose, loop line and Close
ok   plans: matches: Show me works on all 3 steps that have it
ok   plans: reviews: ? button exists
ok   plans: reviews: ? button shows "?" '?'
ok   plans: reviews: sheet "PLANS: REVIEWS" opens with >= 3 steps (3 steps, 2 with Show me)
ok   plans: reviews: sheet fits 390 px (no sideways scroll)
ok   plans: reviews: has purpose, loop line and Close
ok   plans: reviews: Show me works on all 2 steps that have it
ok   plans: programme: ? button exists
ok   plans: programme: ? button shows "?" '?'
ok   plans: programme: sheet "PLANS: PROGRAMME" opens with >= 3 steps (3 steps, 3 with Show me)
ok   plans: programme: sheet fits 390 px (no sideways scroll)
ok   plans: programme: has purpose, loop line and Close
ok   plans: programme: Show me works on all 3 steps that have it
ok   plans: drills: ? button exists
ok   plans: drills: ? button shows "?" '?'
ok   plans: drills: sheet "PLANS: DRILLS" opens with >= 3 steps (5 steps, 5 with Show me)
ok   plans: drills: sheet fits 390 px (no sideways scroll)
ok   plans: drills: has purpose, loop line and Close
ok   plans: drills: Show me works on all 5 steps that have it
ok   block: ? button exists
ok   block: ? button shows "?" '?'
ok   block: sheet "A TRAINING BLOCK" opens with >= 3 steps (8 steps, 7 with Show me)
ok   block: sheet fits 390 px (no sideways scroll)
ok   block: has purpose, loop line and Close
ok   block: Show me works on all 7 steps that have it
ok   drill: ? button exists
ok   drill: ? button shows "?" '?'
ok   drill: sheet "A DRILL" opens with >= 3 steps (20 steps, 20 with Show me)
ok   drill: sheet fits 390 px (no sideways scroll)
ok   drill: has purpose, loop line and Close
ok   drill: Show me works on all 20 steps that have it
ok   session (today): ? button exists
ok   session (today): ? button shows "?" '?'
ok   session (today): sheet "A SESSION PLAN" opens with >= 3 steps (17 steps, 16 with Show me)
ok   session (today): sheet fits 390 px (no sideways scroll)
ok   session (today): has purpose, loop line and Close
ok   session (today): Show me works on all 16 steps that have it
ok   session (past, reviewed): ? button exists
ok   session (past, reviewed): ? button shows "?" '?'
ok   session (past, reviewed): sheet "A SESSION PLAN" opens with >= 3 steps (17 steps, 16 with Show me)
ok   session (past, reviewed): sheet fits 390 px (no sideways scroll)
ok   session (past, reviewed): has purpose, loop line and Close
ok   session (past, reviewed): Show me works on all 16 steps that have it
ok   session (empty): ? button exists
ok   session (empty): ? button shows "?" '?'
ok   session (empty): sheet "A SESSION PLAN" opens with >= 3 steps (17 steps, 14 with Show me)
ok   session (empty): sheet fits 390 px (no sideways scroll)
ok   session (empty): has purpose, loop line and Close
ok   session (empty): Show me works on all 14 steps that have it
ok   match (example): ? button exists
ok   match (example): ? button shows "?" '?'
ok   match (example): sheet "A MATCH PLAN" opens with >= 3 steps (24 steps, 18 with Show me)
ok   match (example): sheet fits 390 px (no sideways scroll)
ok   match (example): has purpose, loop line and Close
ok   match (example): Show me works on all 18 steps that have it
ok   match (upcoming): ? button exists
ok   match (upcoming): ? button shows "?" '?'
ok   match (upcoming): sheet "A MATCH PLAN" opens with >= 3 steps (24 steps, 22 with Show me)
ok   match (upcoming): sheet fits 390 px (no sideways scroll)
ok   match (upcoming): has purpose, loop line and Close
ok   match (upcoming): Show me works on all 22 steps that have it
ok   match (played): ? button exists
ok   match (played): ? button shows "?" '?'
ok   match (played): sheet "A MATCH PLAN" opens with >= 3 steps (24 steps, 24 with Show me)
ok   match (played): sheet fits 390 px (no sideways scroll)
ok   match (played): has purpose, loop line and Close
ok   match (played): Show me works on all 24 steps that have it
ok   review (session): ? button exists
ok   review (session): ? button shows "?" '?'
ok   review (session): sheet "SESSION REVIEW" opens with >= 3 steps (13 steps, 12 with Show me)
ok   review (session): sheet fits 390 px (no sideways scroll)
ok   review (session): has purpose, loop line and Close
ok   review (session): Show me works on all 12 steps that have it
ok   review (match): ? button exists
ok   review (match): ? button shows "?" '?'
ok   review (match): sheet "MATCH REVIEW" opens with >= 3 steps (18 steps, 16 with Show me)
ok   review (match): sheet fits 390 px (no sideways scroll)
ok   review (match): has purpose, loop line and Close
ok   review (match): Show me works on all 16 steps that have it
ok   squad: ? button exists
ok   squad: ? button shows "?" '?'
ok   squad: sheet "SQUAD" opens with >= 3 steps (6 steps, 5 with Show me)
ok   squad: sheet fits 390 px (no sideways scroll)
ok   squad: has purpose, loop line and Close
ok   squad: Show me works on all 5 steps that have it
ok   player: ? button exists
ok   player: ? button shows "?" '?'
ok   player: sheet "A PLAYER" opens with >= 3 steps (6 steps, 5 with Show me)
ok   player: sheet fits 390 px (no sideways scroll)
ok   player: has purpose, loop line and Close
ok   player: Show me works on all 5 steps that have it
ok   pathway: ? button exists
ok   pathway: ? button shows "?" '?'
ok   pathway: sheet "PATHWAY" opens with >= 3 steps (5 steps, 5 with Show me)
ok   pathway: sheet fits 390 px (no sideways scroll)
ok   pathway: has purpose, loop line and Close
ok   pathway: Show me works on all 5 steps that have it
ok   logbook: ? button exists
ok   logbook: ? button shows "?" '?'
ok   logbook: sheet "LOGBOOK" opens with >= 3 steps (3 steps, 2 with Show me)
ok   logbook: sheet fits 390 px (no sideways scroll)
ok   logbook: has purpose, loop line and Close
ok   logbook: Show me works on all 2 steps that have it
ok   teams: ? button exists
ok   teams: ? button shows "?" '?'
ok   teams: sheet "TEAMS" opens with >= 3 steps (3 steps, 2 with Show me)
ok   teams: sheet fits 390 px (no sideways scroll)
ok   teams: has purpose, loop line and Close
ok   teams: Show me works on all 2 steps that have it
ok   team: ? button exists
ok   team: ? button shows "?" '?'
ok   team: sheet "A TEAM" opens with >= 3 steps (4 steps, 4 with Show me)
ok   team: sheet fits 390 px (no sideways scroll)
ok   team: has purpose, loop line and Close
ok   team: Show me works on all 4 steps that have it
ok   team (new): ? button exists
ok   team (new): ? button shows "?" '?'
ok   team (new): sheet "NEW TEAM" opens with >= 3 steps (4 steps, 4 with Show me)
ok   team (new): sheet fits 390 px (no sideways scroll)
ok   team (new): has purpose, loop line and Close
ok   team (new): Show me works on all 4 steps that have it
ok   cloud: ? button exists
ok   cloud: ? button shows "?" '?'
ok   cloud: sheet "CLOUD SYNC AND BACKUP" opens with >= 3 steps (6 steps, 2 with Show me)
ok   cloud: sheet fits 390 px (no sideways scroll)
ok   cloud: has purpose, loop line and Close
ok   cloud: Show me works on all 2 steps that have it
ok   more: ? button exists
ok   more: ? button shows "?" '?'
ok   more: sheet "MORE" opens with >= 3 steps (6 steps, 6 with Show me)
ok   more: sheet fits 390 px (no sideways scroll)
ok   more: has purpose, loop line and Close
ok   more: Show me works on all 6 steps that have it
ok   match (upcoming): every Show me selector resolves on its own tab (22 selectors over 5 tabs)
ok   match (played): every Show me selector resolves on its own tab (24 selectors over 5 tabs)
ok   match: Show me on a Day step from the Them tab switches to Day and flashes it
ok   board guide names Next frame, Play, Frame, Zoom, Shapes, Image, Print, Link
ok   board guide points at addFrame, play, frameMenu, #fT and the tools
board tools on screen: ['select=Move', 'arrow:pass=Pass', 'arrow:run=Run', 'arrow:dribble=Dribble', 'arrow:press=Press', 'add:opp=Opponent', 'add:ball=Ball', 'add:text=AaLabel', 'add:cone=Cone', 'add:mannequin=Mannequin']
top bar right group [label, left, right, w, h]: [['How to use this screen', 234, 278, 44, 44], ['Sync: This device only', 286, 322, 36, 44], ['Joe’s profile, pathway and settings', 330, 374, 44, 44]]
ok   top bar: ?, dot and avatar all inside 390 px

guides (screen: steps, with Show me):
  home: 9, 8
  model: 8, 7
  principle: 11, 10
  boards: 3, 2
  board: 14, 14
  plans: sessions: 3, 3
  plans: matches: 3, 3
  plans: reviews: 3, 2
  plans: programme: 3, 3
  plans: drills: 5, 5
  block: 8, 7
  drill: 20, 20
  session (today): 17, 16
  session (past, reviewed): 17, 16
  session (empty): 17, 14
  match (example): 24, 18
  match (upcoming): 24, 22
  match (played): 24, 24
  review (session): 13, 12
  review (match): 18, 16
  squad: 6, 5
  player: 6, 5
  pathway: 5, 5
  logbook: 3, 2
  teams: 3, 2
  team: 4, 4
  team (new): 4, 4
  cloud: 6, 2
  more: 6, 6

FAILS: []
errors []
```

## What I did differently, or could not do

- **`drills` is not a route.** The spec lists it, but `ROUTES` in `app.js` has no `drills` key; drills live under `#/plans/drills`. I made `helpFor('drills')` an alias for the Plans > Drills guide. Plans guides are chosen from `params[0]`, falling back to the remembered tab.
- **Player inspector on the board has no colour.** The spec says "swap, label, colour". The real inspector has **Swap for**, **Take off the pitch** and, for opponents and labels, a text box. Players have no colour control, so the guide does not mention one.
- **Cloud: sign-in controls are not exercised.** `js/config.js` is blank, so the Cloud screen shows only "This device only" and the sign-in form, **Sync now** and the sign-in selectors do not exist. The guide switches on `cloud.configured()` and `cloud.signedIn()`: it gives those steps a Show me only when the control is there. `help.py` therefore only exercises Backup and the sync dot (2 Show me buttons). The sign-in and signed-in variants were not run in a browser. "Edits replaced by another device" and the clock warning are explained in text only, because they only appear in certain states.
- **Show me is only offered when the control exists on that record.** Several controls are conditional (the Review due panel, `#startHere` after Got it, the carried-forward tick, match prep, the opponent file, Trained this week, individual instructions, the result boxes, the review bar). `helpFor` looks at the record on screen and leaves `show` off when the control is not there, so a button never leads nowhere. The text of the step is still shown.
- **Challenge step.** On a screen narrower than 900 px it points at `#dockBar` (the drawer bar); wider, at `#chal` (the side panel). The choice is made when the sheet opens. `help.py` runs at 390 px only, so the `#chal` branch was not run by it. `ui_pass.py` does check the laptop panel exists, but not through Show me.
- **Show me from help passes `document` as the root to `focusField`**, because the drawer bar and the top-bar ? sit outside `#view`.
- **Show me on inputs focuses them**, so on a phone it also opens the keyboard. That is what the spec asks for.
- **`help.py` starts `python3 -m http.server 8765` itself if nothing is listening**, and stops it at the end. It seeds its own data in a fresh browser context (a running block, a session today, a past session and match with unfinished reviews, an earlier and an upcoming match against the same opponent), so Review due, the opponent file, Trained this week and the rest exist.
- **How I checked control names.** I read every view file, then `help.py` clicks Show me on every step on every screen (and checks the sheet closes, something flashes and is visible, inputs get focus). For the names in bold in the guides I ran a throwaway script (not in the repo) that looked for each name in the text, labels or aria-labels of that screen. What it did not find were names that only appear in a state it was not in (for example **Open the board**, **Link and PIN**, **Open review**, **Plan one**, **Show … set aside**, the Edits-replaced card) or in a sheet that was closed (**Duplicate this frame**, the New board sheet). I checked those against the source by eye. I did not look at every screen at iPad or laptop width.
- **Not tested:** iOS Safari, the installed home-screen app, and the offline path with the new file (`offline.py` is not one of the six scripts and I did not run it).
- Screenshots from the run are in `tests/shots/help-*.png`.

## The six scripts

Run from `/home/claude/cr/tests`, with `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`:

| Script | Exit | Result |
|---|---|---|
| `python3 screens.py phone` | 0 | `phone done 0 issues` |
| `python3 screens.py laptop` | 0 | `laptop done 0 issues` |
| `python3 touch.py` | 0 | `errors: []` |
| `python3 pro_loop.py` | 0 | `errors []` |
| `python3 ui_pass.py` | 0 | `errors []` |
| `python3 help.py` | 0 | `FAILS: []`, `errors []` |

Output of the first five is identical to what they printed before my change.
