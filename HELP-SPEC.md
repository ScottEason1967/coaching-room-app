# Spec: in-app help layer for The Coaching Room

You are adding a help layer to an existing, working web app. Do not redesign anything, do not rename anything, do not touch the data model, the sync code (`js/cloud.js`), the rule engine (`js/challenges.js` except where this spec says), or `supabase/`. Keep the look: dark, Barlow Condensed headings, Inter body, team-blue accent (`var(--accent)`). Yellow (`--lamp`) is reserved for the Coach's challenge questions; help uses the blue accent. UK English. Written for Joe, a 20-something amateur coach, not for a developer: short sentences, no jargon, say what to tap.

The app is in `/home/claude/cr`. It is plain HTML/CSS/ES modules, no build step. Read `README.md`, `REVIEW-FINDINGS.md` (sections G and H describe what the app does now), `js/app.js` (router and top bar), `js/util.js` (`sheet`, `closeSheet`, `actions`, `bindFields`, `esc`), `js/store.js` (`meta()`, `setMeta()`), `js/challenges.js` (`focusField`, the `.flash` highlight) and every file in `js/views/` before writing anything.

## What to build

### 1. `js/help.js`: the guide content and the help sheet
Export `helpFor(routeName, params)` returning a guide or null, and `openHelp(routeName, params)` which opens a bottom sheet (`sheet()` from util.js) showing it. One guide per screen. Route names are the keys of `ROUTES` in `js/app.js` (home, model, principle, board, boards, drill, drills, session, match, review, squad, player, plans, block, pathway, logbook, teams, team, cloud, more). For `plans` the guide depends on the tab in `params[0]` (sessions, matches, reviews, programme, drills).

Each guide: `{ title, purpose (one or two sentences), loop (one line on where this screen sits in the loop: Model → Programme → Session → Match → Review → Model), steps: [{ text, show }] }`. `show` is optional and is a selector for the control the step is about: a `data-f` path (e.g. `theme`), a `#id`, a CSS selector in square brackets (e.g. `[data-act="addFrame"]`, `[data-tool="pass"]`, `[data-act="tab"][data-arg="plan"]`), or a hash route (`#/plans/programme`).

Each step in the sheet has a **Show me** button when `show` is set: it closes the sheet, scrolls the control into the centre of the screen, opens any collapsed `<details>` it is inside, flashes it (add the `flash` class for 1.6 s; the CSS exists) and, for inputs, focuses it. Extend `focusField` in `js/challenges.js` so a selector starting with `[` or `.` is used with `querySelector` directly; keep its existing behaviour for `data-f`, `#id` and `#/route`. On the match screen, a step on another tab must switch the tab first: give `openHelp` an optional `goTab(tab, show)` like the challenge drawer uses (see `match.js`, `chal`), and pass the tab in the step as `tab: 'plan'`.

The sheet: guide title as `.h2`, purpose, the loop line in `.small.muted`, then numbered steps. Keep it readable on a 390 px phone. A "Close" button at the end.

Guides must be accurate to the app as it is. Open each screen in the browser (serve with `python3 -m http.server 8765` from `/home/claude/cr`, open `http://localhost:8765/index.html#/...`) and check every button name and every selector you reference exists. Write them from what you see, not from what you assume.

The Board guide must walk frame-by-frame play exactly like this, with the real controls:
1. Open a board or make a new one; the pitch shows frame 1; thumbnails underneath are the frames.
2. Move is the default tool; drag a player. Pass, Run, Dribble, Press draw an arrow when you drag from one point to another. (Check the actual `data-tool` values in `board.js`.)
3. Tap **Next frame** (`[data-act="addFrame"]`): copies the positions into a new frame without the arrows; move players to where they go next and draw the new arrows.
4. Each frame has a name, a phase and "Coaching notes for this moment" under the pitch (`#fT`).
5. **Play** (`[data-act="play"]`) runs it through; **Frame** (`[data-act="frameMenu"]`) duplicates, reorders, clears arrows, deletes; **Zoom** and the orientation button are on the same row; **Shapes** places a formation; **Image/Print/Link** export it.
Also cover: tapping a player opens the inspector (swap for another squad player, label, colour), bench chips bring players on, "Show on player pages" and what it sends.

Other guides must cover, at minimum: Home (the ring, review due, carried forward, the block card, the next-match card); Model (identity, phases, principles, status draft/agreed, the model check, the Shape & roles tab); Principle (title, why, when/trigger, if not, principles-of-play tags, picture, sub-principles, versions, evidence); Programme and Block (what a block is, weeks, principles, end-of-block); Session (theme, date, principles, block line, carried forward and "how", what I'm looking for, focus players, Add a practice, minutes and talk, injury-prevention tick, match prep, the challenge drawer, Share with staff, Print, Review); Drill (type, area, kit palette, diagram, objective, principles, organisation, how it works, coaching points, success, progress/regress, realism, questions, step in, four corners, interventions); Match (tabs Them/Plan/Squad/Boards/Day; opponent file; tags; plan B; principles under test; trained this week; individual instructions; Update player pages); Review (the plan panel, last time you decided, actual ball rolling, scoring principles, the game section, why chips, change, me as a coach, player observations, why the gate exists); Squad and Player (paste a list, goals, private notes, her link and PIN, observations); Pathway (me as a coach, UEFA C evidence, Pro competences); Cloud (sign in, sync status, backup, replaced edits, clock warning); Plans tabs and Reviews list.

Explain the two things people will not guess: the **Coach's challenge** (yellow panel/drawer: must-dos "!" block nothing but are what the licence looks for; "to think about" "?" can be set aside with Not this time; tap a question to go to its field) and the **review gate** (once a session or match date has passed you cannot plan a new one until its review is finished or it is marked as didn't happen; why: the next session is built from the review).

### 2. The ? button in the top bar
In `js/app.js`, `setTop` renders the top bar. Add a round help button (same size and style as the existing status dot / avatar controls, `aria-label="How to use this screen"`, visible text "?") to the right-hand group on every screen that has a guide. Tapping it calls `openHelp(current route name, params)`. If there is no guide for a route, don't show the button.

### 3. Start here (first run)
On Home, a dismissable card at the top, shown until `S.meta().startHereDone` is true. Content, in this order, short:
- What this is (two sentences).
- Set-up order with links: 1 Rewrite the three principles in your own words and mark them agreed (`#/model`); 2 Paste your squad (`#/squad`); 3 Plan your first block (`#/plans/programme`); 4 Sign in for sync and links (`#/cloud`); 5 Install it on your phone (one line: Safari > Share > Add to Home Screen).
- The weekly loop in one line each: plan the session from the block, coach it, review it the same night, plan the match, review the match on Monday; the review is what makes it work.
- "Every screen has a ? at the top."
- A **Got it** button that sets `startHereDone` and removes the card; a link in More (`js/views/more.js`, the list of screens) called "Start here" that clears the flag and goes to Home so it can be reopened.

### 4. README
Add one short section "Using it" to `README.md` (above "Player and staff links"): every screen has a ? button; Home shows Start here on first run; it can be reopened from More.

### 5. Tests
Write `tests/help.py` (Playwright, Python, same style as `tests/ui_pass.py`; serve the app from `/home/claude/cr` on port 8765; `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`; viewport 390×844, `has_touch`, `is_mobile`, `service_workers='block'`). It must print, for every route with a guide: that the ? button exists, that the sheet opens with at least three steps, and that every `show` selector in that guide resolves to an element on that screen (for match, check each tab). It must also check: Show me flashes the element and closes the sheet; Start here appears on first run, Got it hides it, it stays hidden after reload, and More > Start here brings it back. Print `errors` (page errors and console errors) at the end; it must be empty.

Then run, from `/home/claude/cr/tests`: `python3 screens.py phone`, `python3 screens.py laptop`, `python3 touch.py`, `python3 pro_loop.py`, `python3 ui_pass.py`, `python3 help.py`. All must finish without page errors. If one fails because of your change, fix your change.

### 6. Report back
When done, write `/home/claude/cr/HELP-REPORT.md`: the files you changed, the list of guides with their step counts, the exact output of `python3 help.py`, and anything in the spec you could not do or did differently and why. Do not claim something works that you did not run.

## Constraints
- No new dependencies, no build step, no external resources.
- Do not change any existing test file except to fix a selector your change broke, and say so in the report.
- Keep `index.html` and `view.html` valid; `view.html` (the player/staff page) gets no help layer.
- Guides are text in `help.js`; no HTML from user data goes into them without `esc()`.
