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
