# Captain and vice-captain (Nov 2026): one of each per team, from the squad list, the player page and a pasted list.
from playwright.sync_api import sync_playwright
U = 'http://localhost:8765/index.html'
fails = []
def check(name, ok, extra=''):
    print(('ok   ' if ok else 'FAIL ') + name, extra)
    if not ok: fails.append(name)
cap = "import('./js/store.js').then(S => S.players(S.team().id).filter(p => p.capt).map(p => p.num + ':' + p.capt).sort())"
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 390, 'height': 844}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(U); pg.wait_for_timeout(700)
    pg.evaluate("import('./js/store.js').then(S => S.setMeta('startHereDone', true))")
    pg.evaluate("location.hash='#/squad'"); pg.wait_for_timeout(400)
    pg.click('[data-act=import]'); pg.wait_for_timeout(200)
    pg.fill('#imT', '1 Elen Valentine\n2 Isabelle Moore\n19 Marina Boni\n24 Jen Knowles (c)\n4 Liv Little (vc)'); pg.wait_for_timeout(200)
    pg.click('#imS'); pg.wait_for_timeout(400)
    if pg.locator('[data-x="1"]').count(): pg.click('[data-x="1"]'); pg.wait_for_timeout(500)
    check('a pasted list sets the captain and vice-captain', pg.evaluate(cap) == ['24:c', '4:vc'], pg.evaluate(cap))
    check('number 1 imported', pg.evaluate("import('./js/store.js').then(S => S.players(S.team().id).some(p => p.num === 1 && p.name === 'Elen Valentine'))"))
    pid = pg.evaluate("import('./js/store.js').then(S => S.players(S.team().id).find(p => p.num === 2).id)")
    pg.click(f'[data-capt="{pid}"][data-v="c"]'); pg.wait_for_timeout(400)
    check('C on another player moves the armband', pg.evaluate(cap) == ['2:c', '4:vc'], pg.evaluate(cap))
    check('the list says Captain under her name', 'Captain' in pg.inner_text('#squadList'))
    pg.click(f'[data-capt="{pid}"][data-v="c"]'); pg.wait_for_timeout(400)
    check('tapping C again takes it off', pg.evaluate(cap) == ['4:vc'])
    pg.evaluate(f"location.hash='#/player/{pid}'"); pg.wait_for_timeout(400)
    pg.check('[data-cap="vc"]'); pg.wait_for_timeout(400)
    check('the player page tick box moves the vice-captaincy', pg.evaluate(cap) == ['2:vc'], pg.evaluate(cap))
    check('no page errors', not errs, errs)
    b.close()
print('FAILS:', fails)
