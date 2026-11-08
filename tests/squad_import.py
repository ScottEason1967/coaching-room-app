# Squad import (Nov 2026): paste a real list over the example squad.
# Run from tests/ with the app served on 8765.
from playwright.sync_api import sync_playwright
U = 'http://localhost:8765/'
FAILS = []
def check(label, ok):
    print(('ok   ' if ok else 'FAIL ') + label)
    if not ok: FAILS.append(label)
LIST = """1 Elen Valentine
2 Isabelle Moore
3 Hannah Robson
4 Liv Little
5 Jane Harland
6 Brooke Newton
7 Amber Rodgers
8 Faye Dale
9 Sophie Curle
11 Ella Baker
12 Eve Gatens
14 Ebonie Knox
15 Raian Ferido
16 Taylor Donaldson
17 Danielle Nanga
18 Sophie Tierney
19 Marina Boni
21 Kiara Eveleth
23 Nicki Ord
24 Jen Knowles (c)"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 390, 'height': 844}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(U + '#/squad'); pg.wait_for_timeout(900)
    pg.click('[data-act="import"]'); pg.wait_for_timeout(300)
    check('remove-examples box offered and ticked', pg.is_checked('#imR'))
    pg.fill('#imT', LIST); pg.click('#imS'); pg.wait_for_timeout(800)
    ps = pg.evaluate("import('./js/store.js').then(S => S.players(S.team().id).map(p => [p.num, p.name, p.pos]))")
    print('  ', ps)
    check('20 players, no examples left', len(ps) == 20 and not any(n.startswith('Player ') for _, n, _ in ps))
    check('captain mark stripped', any(n == 'Jen Knowles' for _, n, _ in ps))
    check('no made-up positions', all(pos == '' for _, _, pos in ps))
    check('list says Position not set', 'Position not set' in pg.inner_text('body'))
    pg.screenshot(path='shots/squad-imported.png')
    pg.goto(U + '#/board'); pg.wait_for_timeout(800)
    pg.goto(U + '#/match'); pg.wait_for_timeout(500)
    check('no page errors', not errs); print('   errors:', errs)
    b.close()
print('FAILS:', FAILS)
