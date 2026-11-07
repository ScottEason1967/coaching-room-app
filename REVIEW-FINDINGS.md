# Review findings: The Coaching Room

Reviewed 6 November 2026 against REVIEW-BRIEF.md. I read every file in `js/`, `css/`, `supabase/`, `sw.js`, both HTML pages and all the tests; ran the app at phone (390), iPad (1194) and laptop (1440) sizes with touch emulation; ran the builder's five Playwright scripts and the Postgres rule tests; then wrote my own tests for what those did not cover. Fixes I made are already in the folder (list at the end). Line numbers below refer to the files as I found them.

Short version: the loop is the right idea and most of it is built properly, but as delivered the loop had a hole in it (an empty review satisfied the "compulsory" review), the first device Joe set up would not have uploaded anything he did that day, and the coaching questions were a decent UEFA C checklist rather than the thing that would make him better. The first two are fixed. The third was the subject of a second pass the same evening: Scott asked for the app to be built to Pro-licence standard, not C, and section G describes what was added, what it changes, and what is still not there.

Sections A to F are the review as first written; where a later fix supersedes a finding it is marked. Section G is the Pro layer.

---

## A. Confirmed bugs (ranked by effect on Joe)

### A1. The compulsory review was satisfied by opening it. FIXED.
`startReview()` (review.js:19) set `rec.reviewId` the moment the review record was created, and `reviewsDue()` (store.js:138-139) only checked that a `reviewId` existed. So: match on Sunday, tap "Review" on Monday, tap Back, plan the next session. "Review due" vanished, the gate never appeared, the review sat in the Reviews tab as "Unfinished" and nothing cared. The one rule the whole app is built on was not enforced.
Evidence: `tests/my_sync.py` T2: "after opening an EMPTY review and leaving: home still shows review due? False … gate shown = False".
Fix: `store.reviewDone()` defines a finished review (what worked, what didn't, one thing to change, what I learned about myself; for a match, every key to winning scored). The gate, Home, the Plans lists, the session and match banners and the challenge panels all use it. Started-but-unfinished reviews show as "Finish".

### A2. On the device Joe signs in on, nothing uploads until the app is killed and reopened. FIXED.
`cloud.init()` (cloud.js:30) returned before registering the periodic sync, the focus/online/visibility triggers and the push-on-edit hook (lines 33-37). Those only ran if the app loaded already signed in. The README has Joe create his account on his phone first, so his first day of work on the phone would sit there, with the status dot green and "Synced", until the PWA happened to be restarted. iOS can keep a home-screen app alive for days.
Evidence: `my_sync.py` T1: "after sign-in (no reload), edit then wait 3s: server rows = 0", still 0 after focus and visibility events, 1 only after reload. The builder's `sync_and_links.py` never saw this because it presses "Sync now" after every edit.
Fix: listeners are registered before the signed-in check.

### A3. Text typed just before the phone is locked is saved locally but never synced. FIXED.
Every editor saves through a 400 ms debounce (`debounce(() => S.put(x), 400)`). `store.flush()` on `pagehide`/`visibilitychange` writes localStorage, but the record it writes already carries the mutation (views edit the live object) without the `upd` bump or the dirty flag that `put()` adds. The text is on that phone, but it never goes to the other devices, and the next time another device touches that record the local text is overwritten.
Evidence: `tests/my_flush.py`: "upd changed? False | marked dirty for sync? False". After the fix: True, True.
Fix: `util.js` keeps a set of pending debounces and flushes them all on `pagehide`/hidden, before the store's own flush (util.js is evaluated first).

### A4. The "keys to winning not scored" review requirement never fired.
`reviewChallenges` (challenges.js:173) tested `r.kind === 'match'`. A review record's `kind` is always `'review'`; the match/session flag is `r.type` (review.js:14). Dead code. Fixed to `r.type`, and the gate now also requires keys to be scored.

### A5. A device with a wrong clock silently wins every edit, forever. PARTLY FIXED (warning, not prevention).
Records are stamped with the device clock (store.js:70) and the database keeps the newer stamp (schema.sql:39). The brief lists this as known; I confirmed it: with one device set a day ahead, an edit made later in real time on the correct device is dropped, and both devices show "Synced" with no warning.
Evidence: `my_sync.py` T3.
Fix: after each push, the pull brings the pushed rows back with the server's own timestamp; if it is more than two minutes from when the device sent them, the Cloud screen shows a red "Check this device's clock" card with the size and direction of the error. The cause (client timestamps) is a design choice I have not changed.

### A6. An edit lost to last-write-wins vanished without trace. PARTLY FIXED (kept, not merged).
Known weakness, confirmed: phone offline edits the "why" of a principle, laptop edits the same principle's title, phone reconnects, phone's edit is gone, no message anywhere (`my_sync.py` T4). Note the laptop changed a different field; whole-record LWW threw the phone's field away anyway.
Fix: the push now asks the database to return the rows it accepted (verified on Postgres 16 that a row dropped by the LWW trigger is not returned). Any dropped record is kept under More > Cloud sync as "Edits replaced by another device", showing the text that was lost field by field, with a toast at the time. Still LWW; Joe has to copy the text back by hand. A field-level merge is the proper fix and is a bigger job.

### A7. Back from a drill always went to the drill library. FIXED.
Add a practice to a session, choose "Design a new drill", finish it, tap Back: you land in the library, not the session you were building (drill.js:28 hard-coded `#/plans/drills`). On a phone that is two extra taps and a scroll every time, in the most common planning flow. The drill route now carries the session id (`#/drill/<id>/<sessionId>`).

### A8. Small ones, fixed in passing
- Home said the carried-forward change "appears here until you act on it" but never cleared (home.js:72; `lastChange()` has no notion of acted-on). It now says "Acted on in the session of <date>" when a later session has the box ticked, using the `fromReview` field the builder stored but never read.
- Pathway counted "delivered sessions at 70%+ ball rolling" from the *planned* talk minutes (more.js:48). Relabelled as planned. See C3.
- Pathway said coaching Thornaby Women "puts Joe in that group" for UEFA's September 2026 Pro-licence places. UEFA's text does not define the group and the FA allocates the places; the context is the professional women's game. Reworded. (UEFA announcement 11 Sept 2026, checked.)
- New session defaulted to today's date. It now defaults to the team's usual training night (weekday of recent sessions).
- The match-plan question "Are your keys part of your game model, or one-off tweaks?" (challenges.js:164) could never be cleared and appeared on every match plan with keys. Moved into the match review, asked only about keys that scored "Yes", and it clears when Joe writes a model change.

### A9. Builder's tests: three "False" results were false alarms, and none of the tests assert
`sync_and_links.py` printed `player page shows name: False`, `next match: False` and `staff page: False`. Those names sit in headings rendered uppercase by CSS, and `inner_text` follows CSS, so a case-sensitive check fails. The pages were correct (screenshot `tests/shots/t7-player.png`). Fixed the checks. More important: every script prints and nothing asserts, so a regression only shows if someone reads the output. `loop.py` prints "evidence shows rondo? False" every run (it looks at the wrong principle) and nobody noticed.

---

## B. Design weaknesses (ranked)

### B1. The loop closes with a tick box — FIXED IN G
"Your last review said X. Does this session act on it? Tick the box if it does." (challenges.js:114, session.js:51). A tick is not evidence. The session has no field for *how* it acts on the change, the review does not ask whether the change worked, and nothing links the next review back to it. For the loop to teach anything, the next review needs "Last time you decided to change X. Did you? What happened?" with the answer feeding the model. This is the single most valuable change to make; it is what turns the app from a planner into a coach developer.

### B2. Rules that check boxes, not quality (known) — and a few that nag — MOSTLY FIXED IN G
The brief admits the rule engine cannot tell a sharp principle from a vague one. The practical consequence is that everything is gameable with one word, and some rules are just noise:
- Ball rolling % is `(minutes − talk) / minutes` with `talk` defaulting to 3 per block (session.js:94), so a session is at 80% before Joe types anything. The England DNA figure is something you *measure* ("ask somebody to time the interventions", The FA). The review should ask for a rough actual figure; the plan figure is a target.
- Match plan: a textarea per principle ("does it hold up against how they play?") for every principle in the model, every match (match.js:45, challenges.js:160-163). With 12-15 principles that is 15 nags a week. The engine already knows from the tags which principles are under threat (play-out v high press, etc.); it should name two or three and ask about those.
- Match review scores every principle in the model with a three-way toggle (review.js:15, 55). Same problem. Score the principles the plan said mattered, offer the rest.
- "Only one corner covered" / "developing 2 of the four corners" on nearly every drill and session. Right in spirit, but it fires so often it will be ignored within a fortnight.
- The drill "Space per player" line is marked as done (✓) while asking a question (challenges.js:85). Pick one.

### B3. Player pages go stale silently
A player's page is a snapshot updated only when Joe presses "Update player pages" (match day tab) or "Update all" (Squad). Edit her match instruction on Saturday, forget the button, she reads last week's job on Sunday. Known, but the app never warns: nothing on the match plan or the player profile says "3 player pages are older than this plan". A `share.at < rec.upd` check already exists for staff links (sharing.js:80); the same comparison could badge the "Update player pages" button. Boards also never refresh their own links (session and match do on leaving the plan; `board.js` cleanup does not call `refreshIfShared`). And share refreshes that fail offline are dropped (sharing.js:82, console only), never retried.

### B4. Board frame notes go to players
A board marked "Show on player pages" sends every frame's "Coaching notes for this moment" and the name and number of every player on it (sharing.js:13-17, view.js:59). The README promise is "never Joe's private notes or anyone else's profile"; it is true for the notes field on the player record, but a coach writing on a set-piece frame will write about individuals ("Sarah too slow to track the runner"). I added a line under the checkbox saying so. The better fix is a separate "note for players" on the frame, or stripping notes from player snapshots.

### B5. The gate blocks adding fixtures, not just planning
`newMatch()` is behind `reviewGate` (match.js:16). Fixtures are known weeks ahead; with one review outstanding Joe cannot put next month's games in the diary. The gate should protect *planning* (the Them / Our plan / Squad tabs), not the diary entry.

### B6. Heavy first month
The drill library starts with one rondo. A drill has around fifteen fields; a match plan has six selects, twelve textareas and one per player; a session needs three or four drills. The required set is small (objective, principle link, coaching points; opposition in/out, two keys, threat) and that is the right call, but there is no "copy last session", "copy last match plan v this opponent", no session template (warm-up / practice / game / cool-down with minutes pre-set), and no starter library. The first six weeks are where he decides whether to keep using it. Also: the drill back button (fixed) and the default date (fixed) were the two biggest tap-wasters in the Tuesday flow; what is left is reasonable (about 15-20 taps for a session with drills in the library, 20-25 for a match review).

### B7. Nothing persists across matches against the same opponent — FIXED IN G
A match is one record. Next time Thornaby play Chester-le-Street, Joe starts from a blank "Them" tab. A Pro coach keeps an opponent file: what we saw last time, what we planned, what happened, what to try next. Minimum: "copy analysis from last time we played them" and the previous review's "what didn't" on the new plan.

### B8. Scroll trap on the pitch
`svg.pitch { touch-action: none }` (app.css:158) is what makes dragging work, and it also means the page cannot be scrolled by touching the pitch. On a phone the board fills most of the screen; Joe scrolls from the margins. Workable, but it feels broken the first few times. Drill tokens on a 20 x 20 m area at phone size have a hit circle of about 27 px for players and 20 px for discs (pitch.js:159, `drillScale`); Apple's guidance is 44. The board (38 px) is fine. In the rain, one-handed, the drill designer is fiddly; the board is usable.

### B9. The example match never goes away
`nextMatch()` falls back to an undated match (store.js:129), so the seeded, undated Chester-le-Street example is "Next match" on Home until Joe deletes it or dates it, and comes back as "next" whenever there is no real dated fixture.

### B10. The view page needs signal
`view.html` fetches the snapshot through the RPC on every open and caches nothing (view.js:39-56). A player at a ground with no signal cannot see her instruction. The last successful snapshot could be kept in localStorage for that link.

### B11. Staff comments are hidden
Comments only appear inside the "Share with staff" sheet of that one plan (sharing.js:120). No count, no badge on Home. Joe will not see them unless he goes looking.

### B12. Safari storage, if he never installs
If Joe uses the site in Safari without adding it to the Home Screen and does not open it for seven days, Safari can clear its storage; without cloud sync set up, that is everything. Installed apps are exempt. Could not test (no iPhone); worth a line in the README and the install card.

---

## C. Coaching substance: what a UEFA C coach developer and a Pro-licence coach would say

Checked against the FA's published UEFA C assessment (six competencies in four themes: Player — player development; Game — game understanding, principles of play; Coaching — short-term programme planning, coaching behaviours and practice; Self — coaching strengths and areas for development), the England Football UEFA B page (modules: developing a game model, coaching approach, individual tactics, consolidation; 12 months post-C; Tiers 3-4 of the women's game), the England DNA coaching fundamentals as published by The FA, and the UEFA Pro syllabus of minimum content. The pathway page's factual claims are accurate (hours 60/120/180/360, the FA themes, the B modules, the 12 months). Two overclaims fixed (A8). The Pro competence list is a fair paraphrase of the 2020 syllabus; UEFA published 2025 editions, now noted on the page.

### C1. "Principles of play" means something specific on the C course, and the app does not have it — FIXED IN G
The app's "principles" are team-specific game-model statements ("Play out from the back"). The C competency *Principles of play* is the generic set: in possession — penetration, support, mobility, width, creativity/improvisation; out of possession — pressure/delay, cover, balance, compactness, control. A coach developer will ask Joe which of *those* a practice develops. The app never mentions them. Each team principle (and each drill) should be tagged with the generic principles it expresses; the challenge "which principle of play does this serve?" would then mean what the course means.

### C2. Transition is an England DNA fundamental and the drill designer ignores it — FIXED IN G
The DNA fundamentals (FA Boot Room): realistic game-related practices; *include elements of transition in all practices where possible*; carousel; varied coaching styles; at least 70% ball rolling. The drill has no "what happens when the ball is won/lost in this practice" and no challenge about it. Same for direction: nothing asks "is there a direction of play and a way to score?", which is the first question a C-course tutor asks about a practice. Both are one field and one rule each.

### C3. Ball rolling is a measurement, not a plan figure — FIXED IN G
See B2. The pathway page counted planned figures as "delivered sessions at 70%+" (relabelled). Ask in the session review: "roughly what share of the session was the ball rolling?" and "how many times did you stop it, and for how long?" — that is what the course does.

### C4. Short-term programme planning is a C competency and the app plans one session at a time — FIXED IN G
The FA theme is a *programme*: a block of sessions with a theme that progresses week to week. The app has no block, no "this is week 3 of 6 on playing out", no view of what the next three sessions are for. The model page shows what was trained in the last four weeks (useful), but nothing looks forward. A Pro coach periodises (the Pro syllabus: "designing weekly, monthly and seasonal plans"). A simple "current block: principle, 4-6 weeks, what each week adds" would cover the C requirement and start the Pro habit.

### C5. The individual is missing from sessions and reviews — FIXED IN G
Player development is the first C theme. Players have development goals (good) and the review has an optional one-liner per player. But a session never asks "which player's goal are you working on tonight, and how?", the drill never asks "who are you coaching in this?", and the review never asks about a focus player. The C assessment watches you coach individuals within the group. One "focus players this session" chip row, pre-filled from open goals, would do it.

### C6. Coaching behaviours: planned questions, not just a style tick — FIXED IN G
Interventions are five chips (command, Q&A, guided discovery, trial and error, observation/feedback). Ticking "Q&A" is not planning a question. The drill should hold two or three planned questions and the trigger for stepping in ("if I see X, I stop it"). The review's "you haven't ticked your own delivery" nudge is good and should stay.

### C7. The match plan has no in-game layer — FIXED IN G
Pro-level match planning has: what we expect in the first ten minutes, what we change if it is not working (plan B, triggers), the substitution plan and who plays where if someone goes off, set pieces for *and* against separately, and what we trained this week that should show. The app has keys, threat, in/out possession, one set-piece box, selection notes, team talk. Missing: plan B / triggers; subs plan; "what we trained this week" (the match plan does not look at the sessions that preceded it, so the loop runs session → review → session but not session → match).

### C8. The review does not review decisions, goals or moments — FIXED IN G
A match review asks keys, principles, worked, didn't, why, change, model change, self. It does not ask: how did we concede (which phase, which principle failed), what did you change during the game and did it work, what were the two moments that decided it, what did the opposition do that you did not expect (which should update the opponent file, B7). It also shows none of the plan while you review it — Joe has to open the plan in another tab to remember what he planned. Hudl clip timestamps (he already uses Hudl) would make reviews evidence rather than memory, which is what both licences want.

### C9. The game model is thinner than the word suggests — MOSTLY FIXED IN G
Phases, principles, sub-principles, versions, roles by position, build/press/rest-defence settings. That is a good C/B-level model. What a Pro coach would want and the app cannot hold: a one-paragraph identity statement; triggers for each principle (when do we press, what is the cue to go long); a picture per principle (boards exist but cannot be linked to a principle); roles per position *per phase* rather than one text box; a cap on the number of principles per phase (the engine never says "that's twelve in-possession principles, nobody can carry twelve"). The "evidence" line per principle (drills, sessions, review scores) is the best idea in the app and should be pushed further (C4).

### C10. Self theme — FIXED IN G
"What did I learn about myself as a coach?" every review is right and is now required. What is missing is the thing the course asks for: a standing "strengths / areas for development / what I am working on" that the reviews feed. The Pro self-ratings on the pathway page are the Pro version; the C version is absent.

### C11. Does the loop make him better, and will he keep using it?
Honest answer: as built, it builds a habit of writing things down, and the Home ring makes the stage of the loop visible, which matters. It would make him *organised*. It would not yet make him *better*, because the review feeds the next session only as a tick box (B1), the questions are field checks (B2), and nothing accumulates into a view of his coaching over time beyond counts. He would keep using it through pre-season if the first weeks are made lighter (B6) and the nags are thinned (B2); otherwise the pattern for apps like this is three good weeks and then paper.

---

## D. Data loss and privacy, checked

- Items table: RLS verified on Postgres 16 (other user sees 0 rows, cannot insert for Joe, cannot update; anon cannot read either table or call `save_share`). PIN stored as bcrypt; lockout after five wrong; right PIN during lock still refused; comment while locked refused; token takeover by another user refused.
- Token is 22 characters from a 57-character alphabet in the URL fragment (not sent to the server, `no-referrer` set). The 4-digit PIN with 5 tries per 15 minutes allows ~480 guesses a day; the token is the real secret, the PIN protects against a forwarded link. Acceptable for this use. Note a stranger with the link can lock the player out by guessing five times (fails are per link, not per guesser).
- Player snapshot: her number, name, position, non-parked goals, agreed principles, next match (her instruction, keys), boards marked for players, with other players' names and numbers on those boards and frame notes (B4). Not included: her private notes, review observations, anyone else's instruction or goals. Confirmed in code (sharing.js:40-56) and by test.
- Staff snapshots include session notes and staff lines, full opposition analysis, selection notes and every instruction — intended, and behind a PIN.
- PIN is stored in plain text in Joe's own record (synced, owner-only) so he can resend it, and in the viewer's localStorage when "Remember on this phone" is ticked (default on; "Lock" clears it).
- Backup/restore: restore keeps the newer copy by `upd`; an old backup cannot overwrite new work. Delete team asks first and deletes everything on all devices.
- Seed data uses fixed ids and an old timestamp; a second device does not duplicate it. Deleting a seed record on one device deletes it on the next.
- localStorage quota failure shows a toast. Service worker: network-first with 3.5 s timeout, cache fallback, verified offline reload and board render.

---

## E. Suspected, not confirmed

- **Printing from the iOS home-screen app.** `window.print()` from a standalone PWA has historically done nothing on iOS. Boards and drills have an "Image" fallback; session plans and match plans do not. Needs a real iPhone.
- **Safari and microsecond timestamps.** `applyRemote` parses `2026-11-06T18:00:00.123456+00:00` with `new Date()`. Chrome is fine; I believe current Safari is too, but could not test. If it ever returns Invalid Date, every remote record would compare as newer and local edits would be overwritten on every pull.
- **Supabase email confirmation across devices.** Sign up on the phone, open the confirmation email on the laptop: with PKCE the code exchange fails on the laptop, but the email is still confirmed server-side so "then sign in" (README step 8) should work. Not tested against a live project.
- **Safari seven-day storage eviction** (B12).
- **Re-render on remote change** (`safeRefresh` → full `route(true)`) collapses open `<details>` and resets the board's undo stack whenever another device changes anything. Only noticed in code; no multi-device session long enough to feel it.

---

## F. What I changed (all in the app folder, all tests green)

| File | Change |
|---|---|
| `js/store.js` | `reviewDone`, `reviewOf`; `reviewsDue` treats an unfinished review as due; conflict copies (`noteRejected`, `conflicts`, `dropConflict`, `label`) |
| `js/cloud.js` | sync listeners registered before the sign-in check; push asks for accepted rows and records dropped ones; clock-skew check and `clockSkewText` |
| `js/util.js` | pending debounced saves flushed on `pagehide`/hidden |
| `js/app.js` | toast when an edit is replaced |
| `js/challenges.js` | `reviewComplete` uses the store definition; `r.kind` → `r.type`; unfinished match review is a must-do; "keys → principle" question moved into the review |
| `js/views/review.js` | gate shows "Finish" for started reviews |
| `js/views/plans.js`, `session.js`, `match.js`, `home.js` | "Review unfinished" states; Home "acted on" line; "Finish" buttons |
| `js/views/session.js` | default date = usual training night; drill links carry the session id |
| `js/views/drill.js` | Back returns to the session it was opened from |
| `js/views/board.js` | note under "Show on player pages" about frame notes and names |
| `js/views/more.js` | Cloud screen: clock warning, replaced-edits panel; pathway wording corrected |
| `tests/mockserver.py` | upsert returns accepted rows (as PostgREST does) |
| `tests/sync_and_links.py`, `tests/README.md` | case-insensitive checks; new scripts listed |
| `tests/my_sync.py`, `tests/my_flush.py`, `tests/my_nav.py` | new |

Not changed: the design direction, the data model, the schema (`schema.sql` needs no change for any of the above), anything in section C beyond wording. Those need decisions, not patches.


---

## G. The Pro layer (second pass, same evening)

Built to the standard a Pro-licence coach would expect of the loop, within the constraints that stay: static site plus Supabase, no health data, rules not AI, the Floodlit design. Everything below is in the folder, tested end to end at phone size (`tests/pro_loop.py`), and the builder's tests still run clean. `schema.sql` is unchanged: the new fields live inside each record's data, so a Supabase project set up from the original schema needs nothing.

### G1. Game model
- **Identity**: one paragraph at the top of the model (how we play, what we never do). The model check asks for it.
- **Per principle**: a trigger (when it's on, the cue), a fallback (if it's not on), a picture (a board), and tags from the generic principles of play (penetration, support, width, mobility, creativity / delay, cover, balance, compactness, control). The attack set is offered for in-possession and when-we-win-it phases, the defending set for the other two, both for set pieces.
- **Cap**: more than five principles in a phase draws "which of these are sub-principles of another?"
- **Noise cut**: the model check now gives one line per principle listing what it lacks, instead of three or four separate lines.
- Not built: roles per position per phase (still one text per position), sub-sub-principles as a structure (they're free text under each sub-principle).

### G2. Programme (new screen: Plans > Programme)
- A **block** is four to six weeks on one or two principles: title written as what the team will be able to do, why now, what each week adds (one line per week, with suggested progression in the placeholders), an end-of-block judgement once it's running or done.
- Sessions fall into a block by date, inherit its principles when created, and show "Block … week N of M · this week: …". A session in a block that isn't on the block's principles is flagged, on the session and on the block. Home shows the running block and this week's focus; the model page and each principle show the blocks they belong to.
- This is the C competency "short-term programme planning" and the start of the Pro syllabus's weekly/monthly/seasonal planning. Not built: a season plan above blocks, physical periodisation (no load data is stored, by design).

### G3. Sessions
- **Focus players**: one to three, picked from players with an open development goal (goal shown on the chip), plus what Joe will watch for and say. The review opens their observation lines first.
- **What I'm looking for tonight**: two or three observable things; the review asks whether he saw them.
- **Acting on the last review** is no longer a tick: ticking it opens "how: which practice, which players, what will look different", and the session check makes that a must-do.
- A practice arc check: a session that ends less game-like than it started is questioned.
- Default date is the usual training night (fixed earlier). Ball rolling is labelled as a plan.

### G4. Drills
- Direction (directional / non-directional), transition (what happens when the ball is won or lost; asked for every opposed practice, as the England DNA fundamentals ask), planned questions (asked for whenever Q&A or guided discovery is the planned style), "I step in when…", and "success looks like" (something you can see or count). All print and go to staff links. The space-per-player line now asks whether the area matches where the principle lives, instead of ticking itself.

### G5. Match plan
- **First ten minutes**, **plan B** (the trigger that says it isn't working and what changes; a must-do), **substitutions** (who for what, who moves where), **our set pieces** and **their set pieces** separately.
- **Principles under test**: Joe picks the two or three this opponent threatens; the engine suggests them from the tags (press v play-out, long v second balls, counter v rest defence, set pieces, aerial weakness) and marks the suggestions. Only those get a "keep it, tweak it, accept the risk" note, and the placeholder shows the principle's own trigger and fallback. The per-principle nag for every principle every week is gone.
- **Trained this week**: the sessions in the seven days before the match, with their principles; a challenge if none of it is in the plan, and one if there was no session at all.
- **Opponent file**: previous meetings with the same name show date, result, the keys then, what didn't work and what they did that we didn't expect (from the review), with a one-tap "start from last time's analysis" that copies the tags and the how-they-play text to be updated.

### G6. Reviews
- **The plan is shown** while reviewing (collapsed): what was planned, what Joe was looking for, the focus players, the practices; for a match the threat, first ten, plan B, subs and what was trained.
- **Last time you decided…**: if the session set out to act on the last review's change, the review asks "did you do it?" (yes / partly / no; a must-do, and part of the gate) and "what happened?" or "what got in the way?". This closes the loop that was previously a tick box.
- **Session**: did you see what you were looking for; actual ball rolling % and number of stoppages (with the planned figure as the placeholder); below 70% draws "what stopped it: your talking, the set-up, the numbers?"; focus-player observations prompted.
- **Match**: principles under test scored first, the rest optional; goals at both ends (phase, principle, who was where); what Joe changed during the game, when, and whether it worked; the two or three moments that decided it; did what was trained this week show; what they did that we didn't expect (feeds the opponent file); Hudl clips to cut.
- The "key that worked → add it to the model" question lives here (not on every match plan).

### G7. Self
- Pathway page: a standing **strengths / areas for development / what I'm working on and how I'll know** profile, with the last eight "me as a coach" reflections underneath to distil from. The evidence block now counts the Pro-level things (focus players named, plan Bs written, goals analysed, triggers set, principles tagged, blocks planned, changes followed up, ball rolling measured) and says when a figure is planned rather than measured.

### G8. What is still not Pro-level, and why
- **The questions are rules.** They can tell a field is empty or a type is wrong; they cannot tell a sharp trigger from a vague one. That stays until a server exists (out of scope by the brief).
- **No video or data.** Hudl timestamps are text. A Pro coach's review is built on clips and numbers; this app records the coach's judgement about them.
- **No physical load or recovery.** The Pro syllabus has it; the no-health-data rule keeps it out. Session length and block structure are the only load the app knows.
- **No staff workflow.** Staff get links and can comment; there is no shared planning, no assistant's view, no analyst's input. For one coach with occasional helpers that is right; a Pro environment would need more.
- **Opponent file is by name match.** "Chester-le-Street" and "Chester le Street" are two opponents. Fine for a league of twelve; fragile at scale.
- **Season plan.** Blocks are the unit; nothing sits above them (pre-season, phases of the season, fixture congestion).
- **Still to decide**: whether to require the Pro-level fields (plan B is a must-do; first ten, subs, goals analysis and in-game decisions are asks). I left them as asks so a C-level coach isn't blocked by a Pro-level form in his first month; the ask count on each screen will tell Scott and Joe whether to tighten.

### G9. Files changed in the second pass
`js/store.js` (principles-of-play vocabulary, blocks, trained-before, previous-meetings, gate includes the carried change), `js/challenges.js` (rewritten: consolidated model check, drill realism and questions, session focus/look-for/arc/block, match management and principles under test, review follow-ups and match analysis, suggested principles from tags), `js/views/block.js` (new), `js/views/plans.js` (Programme tab, block on session rows), `js/app.js` (route), `js/views/model.js`, `session.js`, `drill.js`, `match.js`, `review.js`, `home.js`, `more.js`, `print.js`, `sharing.js`, `view.js`, `README.md`, `tests/pro_loop.py` (new).


---

## H. Interface pass (same evening, after Scott's go-ahead)

Built the items from the design list that are mechanical and testable (`tests/ui_pass.py`, phone size). Items 8 and 9 (a "what now" line on Home, a review progress bar) are deliberately left until Joe has used it for a few weeks.

### H1. The Coach's challenge is now a drawer on the phone
On screens under 900px the panel is no longer at the bottom of the form. A bar sits above the bottom nav ("Session check · 5 open"); tapping it opens the list (max 55% of the screen, scrolls), tapping it again closes it. Screens without a challenge (Home, lists) hide it and the page padding returns. On iPad landscape and laptop the side panel is unchanged.

### H2. Questions are ordered, grouped and short
Must-dos first and always expanded; "to think about" collapsed to one line with a chevron for the detail; completed items collapse to a single "✓ a · b · c" line instead of a stack of green ticks. The headline is the first sentence of the question (so the three-sentence questions in `challenges.js` didn't need rewriting); the rest is the detail. The pill reads "2 must-do · 5 to think about" or "All clear".

### H3. Tap a question, land on its field
Every question now carries the field it is about (`f` in `Q(...)`: a `data-f` path, a `#container` id, or a `#/route`). Tapping the headline closes the drawer, opens any collapsed section the field is in, scrolls it to the centre, focuses it and flashes a yellow outline for 1.6 s. On the match plan, a question about another tab switches the tab first (`goTab`), e.g. "Plan B" from the Them tab lands on the Plan B box. Questions about a principle open that principle; "no block running" opens the Programme.

### H4. "Not this time"
Each "to think about" question has a Not this time button in its detail. Set-aside questions are stored on the plan (`rec.dismissed`, keyed by a hash of the rule and its text with numbers stripped, so a count changing brings it back) and hidden; "Show 1 set aside" lists them with Bring back. Must-dos cannot be set aside.

### H5. Tab strips fit
Match tabs are Them · Plan · Squad · Boards · Day (all on screen at 390px; "Match day" was cut off). Plans tabs are Sessions · Matches · Reviews · Programme · Drills and wrap to two rows on a phone instead of scrolling off (Reviews was the fifth tab and hidden).

### H6. Opponent names suggest themselves
The opponent field offers previous opponents as you type (a datalist), so the opponent file doesn't fork on a spelling.

### H7. Touch targets and zoom on the canvases
Every token's hit circle is at least 22 px in radius on screen whatever the drawing scale (was about 13 px for players and 10 px for discs on a 20 × 20 m drill at phone size). Because larger circles overlap, the canvas now picks the item whose centre is nearest the finger rather than whichever was drawn last; the builder's own touch test caught the overlap (a tap on the goalkeeper was landing on the ball) before the nearest-centre rule went in. Drill designer and tactics board have a Zoom button (half the area, with four pan arrows); drags while zoomed land under the finger (verified); Image export clears the zoom first so the whole area is exported. The pitch is still a scroll trap on a phone (B8); zoom makes the trap smaller, it doesn't remove it.

### H8. Not done, and why
- Touchline/light mode (item 4): a real design decision on a dark-only brand, not a patch. Flagged for Scott and Joe; the CSS is variable-driven so it's a day's work once decided.
- Home "what now" line and first-run checklist (item 8), review progress bar (item 9): wait for real use.
- Yellow used for status pills as well as questions (item 10): left; cosmetic.
- "Saved" indicator: left; autosave is reliable and a toast on every keystroke would be worse.

### H9. Files changed in this pass
`js/challenges.js` (renderer rewritten: `box`, `paintChal`, `focusField`, `resetDock`; `Q` takes `f` and `tab`; anchors on every question), `js/pitch.js` (minimum hit radius, nearest-centre hit test, zoom window and pan), `js/views/drill.js` and `board.js` (zoom controls, ids for anchors), `session.js`, `match.js`, `review.js`, `model.js` (ids, opts for set-aside, `goTab`, opponent datalist, shorter tabs), `plans.js` (tab order, wrap), `app.js` (dock reset on route change), `index.html` (dock element), `css/app.css` (question states, drawer, flash), `tests/ui_pass.py` (new), `tests/touch.py` (one selector).

## I. In-app help (built by a cheaper model to a spec, then checked)

Scott asked for interactive guides, in particular clear instructions for the frame-by-frame play on the board, and asked whether a cheaper model could build it. It was built by Claude Sonnet from `HELP-SPEC.md`; its own account of the work is `HELP-REPORT.md`. This section is what I checked afterwards and what I changed.

### I1. What was built
- A **?** button in the top bar of every screen (next to the sync dot). It opens a bottom sheet: the screen's purpose, where it sits in the loop, then numbered steps. Steps that point at a control have a **Show me** button: it closes the sheet, switches tab if needed (match plan), opens any fold-out, scrolls to the control, flashes it blue and focuses it. If the control isn't on screen right now (for example "Carried forward" with no review yet) it says so instead of doing nothing.
- One guide per screen in `js/help.js`: Home, Game model, a principle, Boards, a board (14 steps, including the frame-by-frame sequence: Next frame copies the positions and drops the arrows, move the players, draw the new arrows, Play runs it through), Plans (a guide per tab), a block, a drill (20 steps), a session, a match plan (24 steps across the five tabs), a review (session and match versions), Squad, a player, Pathway, Logbook, Teams, a team, Cloud sync, More.
- Guides are built when opened, so they reflect state: the review gate text appears on every screen where the gate can bite; "Carried forward" and "Opponent file" steps only show when there is one.
- A **Start here** card on Home on first run (set-up order, the weekly loop) with Got it; More > Start here brings it back. README has a "Using it" section.
- `tests/help.py`: opens every screen at 390px, opens the sheet, presses every Show me and checks something flashed, checks the sheet fits the width and the top bar's three buttons don't overflow. 29 guide variants, 0 failures.

### I2. What I checked
- Every imported function the guides call exists (`cloud.configured`, `cloud.signedIn`, `S.cpd`, `S.lastChange`, `S.nextMatch`, `S.previousMeetings`, `S.trainedBefore`, `S.blockFor`).
- 150 literal names the guides use for buttons, tabs, pills and fields all appear in the real views, so no guide refers to a control that isn't there.
- The behavioural claims, against the code: Opponent/Ball/Label return to Move after one placement (`board.js:136`); Next frame clears arrows (`board.js:229`); Play needs two frames (`board.js:205`); Swap changes this frame and later ones (`board.js:182`); Shapes keeps players and arrows (`board.js:263`); new session defaults to the usual training night (`session.js:16`); a new block starts when the last one ends (`block.js:11`); Paste a list replaces by number (`squad.js:68`); five wrong PINs locks for 15 minutes (`schema.sql:118`); board name is 12 characters (`squad.js:92`); Restore keeps newer copies (`more.js:220`); Agreed needs a title (`model.js:141`); players only see agreed principles (`sharing.js:51`); "not seen twice" is a Model check rule (`challenges.js:114`); Didn't happen clears the review (`store.js:197`); Result appears once the date has come (`match.js:70`); staff comments exist (`schema.sql:136`).
- Re-ran the whole test set after the merge: `help.py`, `offline.py` (the service worker now caches `help.js`; offline reload still works), `screens.py` phone and laptop, `touch.py`, `pro_loop.py`, `ui_pass.py`. All clean.

### I3. What I changed
- The **?** button pushed the team switcher on the phone top bar into two lines ("2026/27 · switch / team"). The subtitle now truncates on one line and the switcher's width is capped at the space left by the three buttons (`app.js` renderTop, `css/app.css` `.team-switch`).

### I4. Verdict on the cheaper build
Sonnet followed the spec closely, produced text in the right register (written for Joe, UK English, no jargon) and its test is a real test, not a smoke test. The two things it could not do are the two things worth keeping on the expensive model: judging whether the guide says what the code does (the claims above were all true, but I had to check each one), and noticing the layout regression it introduced in the top bar. The report it wrote is honest about what it did not test (cloud sign-in, iOS). For a change of this shape, spec on the expensive model, build on the cheap one, check on the expensive one, is the right split.
