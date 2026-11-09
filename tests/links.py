# My links (Nov 2026): England Football Learning by default, your own course link, in the profile menu and on the Pathway.
from playwright.sync_api import sync_playwright
U = 'http://localhost:8765/index.html'
fails = []
def check(name, ok, extra=''):
    print(('ok   ' if ok else 'FAIL ') + name, extra)
    if not ok: fails.append(name)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 390, 'height': 844}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(U); pg.wait_for_timeout(700)
    pg.evaluate("import('./js/store.js').then(S => S.setMeta('startHereDone', true))")
    pg.click('#meBtn'); pg.wait_for_timeout(300)
    a = pg.locator('#meLinks a[target=_blank]').first
    check('the profile menu links to England Football Learning, in a new tab', a.get_attribute('href') == 'https://learn.englandfootball.com/' and 'England Football Learning' in a.inner_text())
    pg.click('#meLinks a.add'); pg.wait_for_timeout(400)
    check('Add or change links opens Profile and settings', pg.evaluate('location.hash') == '#/more' and pg.locator('#myLinks').count() == 1)
    pg.click('#addLink'); pg.wait_for_timeout(400)
    pg.fill('[data-li="1"] [data-lk="label"]', 'My UEFA C course')
    pg.fill('[data-li="1"] [data-lk="url"]', 'learn.englandfootball.com/courses/uefa-c'); pg.press('[data-li="1"] [data-lk="url"]', 'Tab'); pg.wait_for_timeout(700)
    links = pg.evaluate("import('./js/store.js').then(S => S.coach().links)")
    check('a new link is saved, with https:// added', any(l['label'] == 'My UEFA C course' and l['url'] == 'https://learn.englandfootball.com/courses/uefa-c' for l in links), links)
    pg.evaluate("location.hash='#/pathway'"); pg.wait_for_timeout(400)
    check('the Pathway shows the course link', 'My UEFA C course' in pg.inner_text('#pathLinks'))
    pg.click('#meBtn'); pg.wait_for_timeout(300)
    check('and so does the profile menu', 'My UEFA C course' in pg.inner_text('#meLinks'))
    pg.keyboard.press('Escape'); pg.evaluate("location.hash='#/more'"); pg.wait_for_timeout(400)
    pg.click('[data-act=rmLink][data-arg="0"]'); pg.wait_for_timeout(400)
    check('a link can be removed', pg.evaluate("import('./js/store.js').then(S => S.coachLinks().map(l => l.label))") == ['My UEFA C course'])
    check('links are kept on the private profile record', pg.evaluate("import('./js/store.js').then(S => S.get('coach').kind)") == 'coach')
    check('no page errors', not errs, errs)
    b.close()
print('FAILS:', fails)
