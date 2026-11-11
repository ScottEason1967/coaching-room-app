# Nov 2026: one header on every screen. The tabs, badge and title sit in exactly the same place on
# every page (the Start here button on Home must not push the tabs), and there is no back link that
# only repeats a tab; deeper screens keep theirs.
import asyncio
from playwright.async_api import async_playwright
U = 'http://localhost:8765/'
fails = []
def check(name, ok, extra=''):
    print(('ok   ' if ok else 'FAIL ') + name, extra)
    if not ok: fails.append(name)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for w, h in [(1280, 900), (390, 844)]:
            pg = await b.new_page(viewport={'width': w, 'height': h}, service_workers='block')
            errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(U + 'index.html'); await pg.wait_for_timeout(700)
            bid = await pg.evaluate("""import('./js/store.js').then(async S => { S.setMeta('startHereDone', false); const B = await import('./js/views/board.js'); const T = S.team().id;
              return S.create('board', T, { name: 'Shape', type: 'sketch', sharePlayers: false, frames: [B.newBoardFrame(T, S.team().formation, '')] }).id; })""")
            spots = {}
            for r in ['home', 'teamhome', 'training', 'matches', 'analysis', 'sketch', 'squad', 'staff', 'model', 'more', 'board/' + bid]:
                await pg.evaluate("location.hash='#/x'"); await pg.wait_for_timeout(100)
                await pg.evaluate(f"location.hash='#/{r}'"); await pg.wait_for_timeout(500)
                spots[r] = await pg.evaluate("""(() => { const q = s => { const e = document.querySelector('#topbar ' + s); if (!e) return null; const b = e.getBoundingClientRect(); return b.width ? [Math.round(b.left), Math.round(b.top)] : null; };
                  return { nav: q('.topnav'), badge: q('.hbadge'), title: q('#bandTitle'), back: !!document.querySelector('#topbar .backlink'), navy: getComputedStyle(document.querySelector('#topbar')).backgroundImage.includes('gradient') }; })()""")
            first = spots['home']
            if w > 900:
                check(f'{w}: the tabs sit in the same place on every page, Home included', all(v['nav'] == first['nav'] for v in spots.values()), {k: v['nav'] for k, v in spots.items()})
            check(f'{w}: the badge sits in the same place on every page', all(v['badge'] == first['badge'] for v in spots.values()), {k: v['badge'] for k, v in spots.items()})
            check(f'{w}: the title starts in the same place on every page', len({v['title'][0] for v in spots.values()}) == 1, {k: v['title'] for k, v in spots.items()})
            check(f'{w}: every header is the navy band', all(v['navy'] for v in spots.values()))
            check(f'{w}: no back link that only repeats a tab (Sketch, Squad, Staff, Settings)', not any(spots[r]['back'] for r in ['sketch', 'squad', 'staff', 'model', 'more']))
            check(f'{w}: a deeper screen keeps its way back (a board goes back to Sketch)', spots['board/' + bid]['back'])
            check(f'{w}: no page errors', not errs, errs)
            await pg.close()
        await b.close()
    print('FAILS:', fails)
asyncio.run(main())
