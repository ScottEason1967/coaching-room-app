# Review brief: The Coaching Room

You are reviewing a coaching app that someone else built. You have not seen it being built and you should not trust any claim about it, including the ones in this brief. Check everything against the code and by running it.

## What it is

A web app for Joe Eason, coach of Thornaby FC Women (an amateur women's team, 4-3-3 with one 6 and two 8s, possession, playing out from the back). Joe starts the FA's UEFA C licence in around May 2027. The UEFA Pro Licence is the long-term destination. The app is meant to make him a better coach now and to build the habits and evidence the licences ask for.

It is an installable web app (PWA) hosted on GitHub Pages, with a Supabase database for sync between phone, iPad and laptop, and PIN-protected links for players and staff. No build step: plain HTML, CSS and ES modules. The code is in the folder `coaching-room-app` (read README.md first, then this file).

The owner's standard for this is "an absolutely amazing product". Review it against that standard, not against "does it work".

## The core idea (the thing to protect)

The app is a loop:

1. **Game model**: principles of play by phase (in possession, out of possession, when we win it, when we lose it, set pieces), each with sub-principles, versioned.
2. **Sessions** are built from principles. A rule-based "coach's challenge" panel questions each drill and session: which principle does this serve, is it game-like, is the ball rolling 70% of the time, does it act on the last review.
3. **Match plans** set an opposition analysis against the game model and challenge what will win the game.
4. **Reviews are compulsory**: once a session or match date has passed, Joe cannot plan anything new until he reviews it (or marks it as didn't happen). His "one thing to change" is carried into the next session plan.

The question that matters most: does this loop actually make a coach better, and does the app make it easy enough that a busy amateur coach will keep doing it after the novelty wears off?

## What to do

1. Read README.md, then the code in `js/`. `store.js` is the data model, `challenges.js` is the rule engine, `cloud.js` is sync, `supabase/schema.sql` is the database, `views/` are the screens, `view.html` + `js/view.js` is the page players and staff see.
2. Run it: `python3 -m http.server 8765` in the app folder, open http://localhost:8765/index.html. Try it at phone size (390 wide) with touch emulation, iPad size and laptop size.
3. Run the tests in `tests/` (instructions in tests/README.md). Then decide what they don't cover and test that.
4. Report findings ranked by how much each one affects Joe, with the evidence (file and line, or what you did and what happened). Separate: confirmed bugs; design weaknesses; things that would make it genuinely better. Say which findings you only suspect and couldn't confirm.

## Known weaknesses (verify, don't assume)

- Sync is last-write-wins on whole records, by device clock. Two devices editing the same plan before syncing lose one side's changes. A device with a wrong clock could win or lose wrongly.
- The challenge questions are rules: they check fields are filled, drill types, opposition tags. They can't tell a sharp principle from a vague one.
- Player pages are a saved copy and only update when Joe presses "Update player pages". Session and match links refresh when he leaves the plan.
- Never tested on a real iPhone or iPad, or against a live Supabase project. Only against a stand-in server and a local Postgres 16.
- Board arrows are straight lines only. No pinch-to-zoom.
- Any Thornaby players under 18 raise safeguarding questions for player links. Not researched.

## Where I most want your judgement

- **Coaching substance.** Test the challenge questions, the review questions and the pathway page against what the FA UEFA C and B courses actually assess, the England DNA coaching fundamentals, and how a Pro-licence coach would think about a game model, opposition analysis and match planning. Where are the questions shallow, wrong, or missing? What would a UEFA Pro coach say is absent?
- **Will Joe keep using it?** Walk through a real week: Tuesday session, Sunday match, review on Monday. Count taps. Find the friction. Find anything that nags without helping.
- **Data loss and privacy.** Any way to lose work. Any way a player link exposes something it shouldn't (other players, private notes, health data). Any way someone without the PIN gets in.
- **Touch.** Dragging players and drawing arrows on a phone, one-handed, in the rain on a touchline.
- **Honesty of the app's own claims.** The pathway page paraphrases UEFA and FA material. Check it isn't overclaiming.

## What not to spend time on

- Code style, naming, "would be nicer in a framework".
- Replacing the design direction (dark, Barlow Condensed + Inter, team-blue accent, yellow reserved for challenge questions) unless something is unusable.
- Features for other coaches or clubs. This is for Joe.

## Constraints that stay

- No health data stored, ever (including menstrual tracking).
- Must stay a static site plus Supabase; no server to run. A later step could add an AI-powered challenge via a small server, but that is out of scope for this review.
- UK English. Written for Joe, not for a developer.
