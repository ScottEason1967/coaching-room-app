# Interface pass at phone size: the challenge drawer (open, tap a question, land on its field, set an ask aside),
# tab strips fit, opponent suggestions, bigger touch targets on the drill canvas, zoom and pan.
import asyncio, datetime
from playwright.async_api import async_playwright
U='http://localhost:8765/index.html'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,service_workers='block')
        pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e))); pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
        # --- drawer on a session plan
        await pg.goto(U+'#/plans/sessions'); await pg.wait_for_timeout(700); await pg.evaluate("import('./tests/fixtures.js').then(F => F.examples())"); await pg.wait_for_timeout(300); await pg.click('[data-act="newS"]'); await pg.wait_for_timeout(500)
        dock=pg.locator('#chalDock'); print('dock visible on phone:', await dock.is_visible(), '| side panel hidden:', not await pg.locator('#chal').is_visible())
        bar=await pg.inner_text('#dockBar'); print('dock bar:', bar.replace('\n',' '))
        print('page padded so the drawer does not cover the form:', await pg.evaluate("getComputedStyle(document.querySelector('.content')).paddingBottom"))
        await pg.click('#dockBar'); await pg.wait_for_timeout(300)
        print('open: must-dos listed first:', (await pg.evaluate("[...document.querySelectorAll('#chalDock .q')].slice(0,3).map(q=>q.className)")))
        print('asks collapsed (detail hidden):', await pg.evaluate("[...document.querySelectorAll('#chalDock .q.ask .qd')].every(d=>getComputedStyle(d).display==='none')"))
        # tap the theme question -> drawer closes, theme field focused and flashed
        await pg.click('#chalDock [data-go="theme"]'); await pg.wait_for_timeout(700)
        print('tap-to-field: drawer closed:', not await pg.evaluate("document.querySelector('#chalDock').classList.contains('open')"), '| theme focused:', await pg.evaluate("document.activeElement===document.querySelector('[data-f=theme]')"), '| flashed:', await pg.evaluate("document.querySelector('[data-f=theme]').classList.contains('flash')"))
        # expand an ask and set it aside
        await pg.click('#dockBar'); await pg.wait_for_timeout(200)
        n0=await pg.evaluate("document.querySelectorAll('#chalDock .q.ask').length")
        await pg.click('#chalDock .q.ask [data-toggle]'); await pg.wait_for_timeout(150)
        print('ask expanded shows detail + Not this time:', await pg.evaluate("(()=>{const q=document.querySelector('#chalDock .q.ask.open');return q&&getComputedStyle(q.querySelector('.qd')).display!=='none'&&!!q.querySelector('[data-dismiss]')})()"))
        await pg.click('#chalDock .q.ask.open [data-dismiss]'); await pg.wait_for_timeout(300)
        n1=await pg.evaluate("document.querySelectorAll('#chalDock .q.ask').length")
        print('set aside: asks', n0, '->', n1, '| "set aside" link:', 'set aside' in await pg.inner_text('#chalDock'))
        await pg.reload(); await pg.wait_for_timeout(500)
        print('set aside persists after reload:', await pg.evaluate("document.querySelectorAll('#chalDock .q.ask').length")==n1)
        await pg.click('#dockBar'); await pg.wait_for_timeout(150); await pg.click('#chalDock [data-showgone]'); await pg.wait_for_timeout(150)
        print('bring back offered:', bool(await pg.query_selector('#chalDock [data-undismiss]')))
        await pg.screenshot(path='shots/ui-drawer.png')
        # --- dock disappears on screens without a challenge
        await pg.goto(U+'#/home'); await pg.wait_for_timeout(300); print('dock hidden on Home:', await pg.evaluate("document.querySelector('#chalDock').hidden"), '| padding back:', await pg.evaluate("getComputedStyle(document.querySelector('.content')).paddingBottom"))
        # --- match: tab strip fits; tap a question on another tab switches tab and lands on the field
        await pg.goto(U+'#/match/mt-cls'); await pg.wait_for_timeout(400)
        tabs=await pg.evaluate("[...document.querySelectorAll('[role=tablist] [role=tab]')].map(t=>[t.textContent.trim(), t.getBoundingClientRect().right<=390])"); print('match tabs all on screen:', tabs)
        await pg.click('#dockBar'); await pg.wait_for_timeout(200)
        await pg.click('#chalDock [data-go="plan.planB"]'); await pg.wait_for_timeout(900)
        print('tab switched to Plan:', await pg.evaluate("document.querySelector('[role=tab][aria-selected=true]').textContent.trim()"), '| plan B focused:', await pg.evaluate("document.activeElement===document.querySelector('[data-f=\"plan.planB\"]')"))
        print('opponent suggestions:', await pg.evaluate("[...document.querySelectorAll('#oppList option')].map(o=>o.value)"))
        await pg.goto(U+'#/plans/reviews'); await pg.wait_for_timeout(300)
        print('plans tabs on screen:', await pg.evaluate("[...document.querySelectorAll('[role=tablist] [role=tab]')].map(t=>[t.textContent.trim(), t.getBoundingClientRect().right<=390])"))
        # --- drill canvas: hit targets and zoom
        await pg.goto(U+'#/drill/dr-rondo'); await pg.wait_for_timeout(500)
        r=await pg.evaluate("(()=>{const s=document.querySelector('#dc');const g=s.querySelector('[data-id]');const c=g.querySelector('circle');const b=c.getBoundingClientRect();return [Math.round(b.width), Math.round(s.getBoundingClientRect().width)]})()")
        print('smallest token hit diameter (px) on phone:', r[0], '(svg width', r[1], ') >= 44:', r[0]>=44)
        vb0=await pg.evaluate("document.querySelector('#dc').getAttribute('viewBox')")
        await pg.click('#zoomB'); await pg.wait_for_timeout(200); vb1=await pg.evaluate("document.querySelector('#dc').getAttribute('viewBox')")
        await pg.click('[data-act="pan"][data-arg="1,0"]'); await pg.wait_for_timeout(200); vb2=await pg.evaluate("document.querySelector('#dc').getAttribute('viewBox')")
        print('zoom:', vb0, '->', vb1, '-> pan right ->', vb2)
        # drag a token while zoomed: it must land under the finger
        await pg.click('[data-tool="select"]'); await pg.wait_for_timeout(200)
        pos=await pg.evaluate("(()=>{const S=document.querySelector('#dc').getBoundingClientRect();const g=[...document.querySelectorAll('#dc [data-id]')].find(g=>{const b=g.getBoundingClientRect();return b.x>S.x+30&&b.right<S.right-60&&b.y>S.y+30&&b.bottom<S.bottom-60});const b=g.getBoundingClientRect();return [g.dataset.id,b.x+b.width/2,b.y+b.height/2]})()")
        cdp=await ctx.new_cdp_session(pg)
        await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':pos[1],'y':pos[2]}]})
        for i in range(1,7): await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':pos[1]+40*i/6,'y':pos[2]+30*i/6}]})
        await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]}); await pg.wait_for_timeout(300)
        after=await pg.evaluate(f"(()=>{{const g=document.querySelector('#dc [data-id=\"{pos[0]}\"]');const b=g.getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]}})()")
        print('dragged while zoomed: moved by', [round(after[0]-pos[1]), round(after[1]-pos[2])], '(expected ~[40,30])')
        await pg.screenshot(path='shots/ui-zoom.png')
        await pg.click('#zoomB'); await pg.wait_for_timeout(100); print('zoom off restores view:', await pg.evaluate("document.querySelector('#dc').getAttribute('viewBox')")==vb0)
        # --- laptop: side panel shown, no dock
        await pg.set_viewport_size({'width':1440,'height':900}); await pg.goto(U+'#/session/'+(await pg.evaluate("(async()=>{const S=await import('./js/store.js');return S.sessions(S.team().id)[0].id})()"))); await pg.wait_for_timeout(400)
        print('laptop: side panel visible:', await pg.locator('#chal').is_visible(), '| dock hidden:', not await pg.locator('#chalDock').is_visible())
        await pg.click('#chal [data-go="theme"]'); await pg.wait_for_timeout(600); print('laptop tap-to-field focuses theme:', await pg.evaluate("document.activeElement===document.querySelector('[data-f=theme]')"))
        print('errors', errs); await b.close()
asyncio.run(main())
