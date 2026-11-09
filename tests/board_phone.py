# Board on a phone (Nov 2026): the frames sit above the pitch, and the page still scrolls from beside it.
from playwright.sync_api import sync_playwright
FAILS = []
def check(label, ok):
    print(('ok   ' if ok else 'FAIL ') + label)
    if not ok: FAILS.append(label)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
    pg.goto('http://localhost:8765/#/board/bd-shape'); pg.wait_for_timeout(1200)
    fr = pg.evaluate("document.querySelector('#frames').getBoundingClientRect().top"); pt = pg.evaluate("document.querySelector('#pitch').getBoundingClientRect().toJSON()")
    check('frames are above the pitch and on screen', fr < pt['top'] and fr < 844)
    check('the pitch leaves room beside it to scroll from', pt['left'] > 30)
    cdp = pg.context.new_cdp_session(pg); x, y0 = 20, 600
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y0}]})
    for i in range(1, 11): cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x, 'y': y0 - 30 * i}]})
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); pg.wait_for_timeout(600)
    check('a swipe beside the pitch scrolls the page', pg.evaluate('scrollY') > 100)
    G = lambda js: pg.evaluate("import('./js/store.js').then(S => (" + js + "))")
    opp = lambda: G("S.get('bd-shape').frames.map(f => f.items.filter(i => i.kind === 'opp').length)")
    pg.evaluate('scrollTo(0, 0)'); pg.wait_for_timeout(300)
    pg.select_option('#oppSel', '4-4-2'); pg.wait_for_timeout(700)
    check('Opposition puts eleven on every frame', all(n == 11 for n in opp()))
    # unmoved: changing shape needs no warning
    pg.select_option('#oppSel', '4-3-3'); pg.wait_for_timeout(600)
    check('changing shape with nothing moved needs no warning', pg.query_selector('.sheet') is None and all(n == 11 for n in opp()))
    # move one opponent on the last frame, then take them off: warned first
    G("(() => { const b = S.get('bd-shape'); const o = b.frames[b.frames.length - 1].items.find(i => i.kind === 'opp'); o.x += 6; S.put(b); })()")
    pg.reload(); pg.wait_for_timeout(1000)
    pg.select_option('#oppSel', ''); pg.wait_for_timeout(400)
    check('taking them off after moving one asks first', pg.query_selector('.sheet') is not None and 'every frame' in pg.inner_text('.sheet').lower())
    pg.click('[data-x="0"]'); pg.wait_for_timeout(400)
    check('Cancel keeps them and the dropdown shows them still on', all(n == 11 for n in opp()) and pg.eval_on_selector('#oppSel', 'e => e.value') != '')
    pg.select_option('#oppSel', ''); pg.wait_for_timeout(400); pg.click('[data-x="1"]'); pg.wait_for_timeout(600)
    check('confirming takes them off every frame', all(n == 0 for n in opp()))
    # Play centres the pitch
    pg.evaluate('scrollTo(0, document.body.scrollHeight)'); pg.wait_for_timeout(300)
    pg.click('[data-act="play"]'); pg.wait_for_timeout(900)
    r = pg.evaluate("document.querySelector('#pitch').getBoundingClientRect().toJSON()")
    mid = (r['top'] + r['bottom']) / 2
    print('   pitch top/bottom after Play:', round(r['top']), round(r['bottom']))
    check('Play brings the whole pitch into the middle of the screen', r['top'] >= 0 and r['bottom'] <= 844 and abs(mid - 422) < 80)
    b.close()
print('FAILS:', FAILS)
