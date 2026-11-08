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
    b.close()
print('FAILS:', FAILS)
