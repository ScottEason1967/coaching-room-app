# Nov 2026 feedback: locked arrows carry to the next frames and stay on screen while playing;
# on a laptop the main menu sits in the top bar and stays there when scrolling; the practice
# library filter takes several themes at once and labels each card.
from playwright.sync_api import sync_playwright
U = 'http://localhost:8765/index.html'
fails = []
def check(name, ok, extra=''):
    print(('ok   ' if ok else 'FAIL ') + name, extra)
    if not ok: fails.append(name)
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1366, 'height': 800}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(U); pg.wait_for_timeout(700)
    pg.evaluate("import('./js/store.js').then(S => S.setMeta('startHereDone', true))")
    # a board with one arrow on frame 1
    bid = pg.evaluate("""import('./js/store.js').then(S => { const b = S.boards(S.team().id)[0]; b.frames = [b.frames[0]]; b.frames[0].arrows = [{ id: 'ar1', style: 'run', x1: 30, y1: 60, x2: 30, y2: 40 }, { id: 'ar2', style: 'pass', x1: 20, y1: 60, x2: 40, y2: 60 }]; S.put(b); return b.id; })""")
    pg.evaluate(f"location.hash='#/board/{bid}'"); pg.wait_for_timeout(700)
    bb = pg.locator('g[data-id="ar1"]').first.bounding_box()
    pg.mouse.click(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2); pg.wait_for_timeout(300)
    check('selecting an arrow shows “Keep on the next frames”', pg.locator('#keepA').count() == 1)
    if pg.locator('#keepA').count():
        pg.check('#keepA'); pg.wait_for_timeout(300)
        pg.click('[data-act=addFrame]'); pg.wait_for_timeout(500)
        fr = pg.evaluate(f"import('./js/store.js').then(S => S.get('{bid}').frames.map(f => f.arrows.map(a => a.id + (a.keep ? '*' : ''))))")
        check('a new frame carries the locked arrow, not the others', fr == [['ar1*', 'ar2'], ['ar1*']], fr)
        # mid-play: the locked arrow is drawn the whole time
        pg.click('[data-act=play]'); pg.wait_for_timeout(900)
        seen = []
        for _ in range(8):
            seen.append(pg.locator('#pitch g[data-id="ar1"]').count()); pg.wait_for_timeout(120)
        check('while playing, the locked arrow stays on the pitch the whole time', all(seen), seen)
        pg.wait_for_timeout(2500)
    # main menu in the top bar, still there after scrolling
    check('the main menu is in the top bar', pg.locator('#topbar nav.topnav a').count() == 5 and not pg.locator('#bottomnav').is_visible())
    pg.mouse.wheel(0, 1500); pg.wait_for_timeout(400)
    nb = pg.locator('#topbar nav.topnav').bounding_box()
    check('after scrolling down the menu is still at the top of the screen', nb is not None and nb['y'] < 80, nb)
    # library: two themes at once
    pg.evaluate("location.hash='#/ideas/drills'"); pg.wait_for_timeout(500)
    pg.evaluate("import('./js/store.js').then(S => S.setMeta('ideaTheme', ''))"); pg.evaluate("location.hash='#/home'"); pg.wait_for_timeout(200); pg.evaluate("location.hash='#/ideas/drills'"); pg.wait_for_timeout(500)
    pg.click('#ideaFilter [data-act=theme][data-arg=press]'); pg.wait_for_timeout(400)
    n1 = pg.locator('#ideaDrills > a').count()
    pg.click('#ideaFilter [data-act=theme][data-arg=build]'); pg.wait_for_timeout(400)
    n2 = pg.locator('#ideaDrills > a').count()
    exp = pg.evaluate("import('./js/templates.js').then(T => new Set([...T.drillsForTheme('press'), ...T.drillsForTheme('build')].map(t => t.id)).size)")
    check('two themes picked: both stay ticked', pg.locator('#ideaFilter [data-act=theme].on').count() == 2)
    check('the list shows practices for either theme', n2 == exp and n2 > n1, (n1, n2, exp))
    lab = pg.inner_text('#ideaDrills')
    check('each card is labelled with its theme', 'Pressing high' in lab or 'press' in lab.lower(), lab[:120])
    check('the heading names both', '+' in pg.inner_text('#ideaHeading'), pg.inner_text('#ideaHeading'))
    pg.click('#ideaFilter [data-act=theme][data-arg=press]'); pg.wait_for_timeout(400)
    check('tapping one again takes it off', pg.locator('#ideaFilter [data-act=theme].on').count() == 1)
    check('no page errors', not errs, errs)
    # phone keeps its bottom bar
    ph = b.new_page(viewport={'width': 390, 'height': 844}); ph.goto(U); ph.wait_for_timeout(700)
    check('on a phone the bottom bar stays', ph.locator('#bottomnav').is_visible() and not ph.locator('#topbar nav.topnav').is_visible())
    b.close()
print('FAILS:', fails)
