# Tests

Automated checks used while building the app. Run from this folder with the app served locally.

Needs: Python 3, `pip install playwright` then `playwright install chromium`. The database tests need PostgreSQL 16.

    cd ..                      # the app folder
    python3 -m http.server 8765 &
    cd tests
    python3 screens.py phone   # every screen at phone size; also ipad, laptop. Screenshots go to tests/shots/
    python3 touch.py           # touch drags, arrows, frames, swaps, drill kit, print
    python3 loop.py            # session -> review gate -> review -> carried forward; squad import; match cards
    python3 sync_and_links.py  # two devices syncing via a stand-in server; player/staff links; PIN lockout
    python3 offline.py         # service worker: loads and works with no network
    python3 my_sync.py         # review (Nov 2026): sign-in-then-edit pushes; empty review does not clear the gate;
                               #   wrong device clock is flagged; an edit lost to last-write-wins is kept on the Cloud screen
    python3 my_flush.py        # review (Nov 2026): text typed just before the app is backgrounded is marked for sync
    python3 gate.py            # sign-in screen (Nov 2026): nothing shows signed out, sign in/out, reset link, a second
                               #   account on the same device never receives or pushes the first account's data
    python3 pictures.py        # profile photo, club badge, player photos set by the player from her page (Nov 2026)
    psql -h /tmp -p 5499 -U postgres -f pg_photos.sql              # player photo rules: her PIN only, JPEG only, size cap
    python3 help.py            # help layer (Nov 2026): every screen's ? guide opens at 390px, every Show me lands on a
                               #   control, the sheet fits the width, the top bar's three buttons fit

None of these scripts assert; they print. Read the output. "player page shows name: False" used to be printed by a
case-sensitive check against an uppercase heading, not by a bug (fixed in the script).

Database rules (needs postgres on a spare port):

    initdb -D /tmp/pgd -A trust && pg_ctl -D /tmp/pgd -o '-p 5499 -k /tmp' start
    psql -h /tmp -p 5499 -U postgres -v ON_ERROR_STOP=1 -f pg_stub.sql       # stand-ins for Supabase roles and auth.uid()
    psql -h /tmp -p 5499 -U postgres -v ON_ERROR_STOP=1 -f ../supabase/schema.sql
    psql -h /tmp -p 5499 -U postgres -f pg_rules.sql                           # RLS, LWW, PIN hashing, lockout

`mocksb.js` and `mockserver.py` stand in for supabase-js and the Supabase API. They mirror the rules in schema.sql but they are not Supabase: a test against a live project is still needed.

- `ideas.py`: practice ideas library. Checks every theme has practices, every diagram sits inside its area, principle theme tags link to ideas, and "Add to my drills" and "Plan a session from this" work.
- `squad_import.py`: pasting a real squad over the example players (no made-up positions, captain mark stripped, leftover examples removed).
- `fixtures.js`: puts back the old example drill (dr-rondo) and match (mt-cls) for tests written against them. The app no longer seeds them.
- `block_build.py`: building a block from the top: sessions per week (new, template, moved in) and drills per session from the block page.
- `sketch.py`: tactics and drill sketches, Save to (set piece, principle, match plan, drill, my drills, a session), Clear all.
- `board_phone.py`: on a phone the frames sit above the pitch and the page scrolls from beside it.
- `templates_everywhere.py`: a template route on every planning screen (Programme, block weeks, Sessions, empty and filled sessions, Drills); block templates make four sessions that get more game-like each week.
- `match_templates.py`: match day templates from Match, the plan overview, Opposition and On the day; using one fills only empty parts and never overwrites; print shows the new parts.
- `pg_team.sql` (with `pg_team_before.sql`): coaching staff rules in a real Postgres. Load pg_stub.sql, the old schema (schema.sql up to section 3), pg_team_before.sql, then schema.sql twice, then run pg_team.sql: upgrade of existing data, invites, roles, merging edits field by field, viewers, privacy. (`pg_rules.sql` is for the rules before section 3.)
- `staff.py`: Joe invites the manager and a viewer from the Staff screen; they join from the link; both edit one match plan; same-box edits; the analysis gate; roles changed and removed. Live updates and who's here need the real Supabase.
- `captain.py`: captain and vice-captain from the squad list (C / VC), the player page and a pasted list; one of each per team.
- `board_nav_filter.py`: locked arrows carry to the next frames and stay on screen when playing; on a laptop the main menu sits in the top bar and stays when scrolling; the practice library filter takes several themes, each card labelled.
- `links.py`: My links: England Football Learning by default, your own course link, shown in the profile menu and on the Pathway.
- `dup_sync.py`: the red dot "ON CONFLICT DO UPDATE command cannot affect row a second time". Plants a profile copy under its cloud name and a record stored under the wrong id, then checks sync recovers, the newer profile reaches the cloud, and the Staff screen loads. The stand-in server now refuses a doubled id in one upload, as Supabase does.
- `test_it.py`: Test it. A four-frame play-out tested against every style and sharpness: the press reaches the ball, nobody moves faster than allowed, every "they get to the pass" finding has them arriving first by its own numbers, a low block flags nothing serious in our half, the man-marker stays on the 6, a problem over several frames is listed once. Then the screens: button, sheet with the next match first, header, Show me, answers kept, change opponent, help.
