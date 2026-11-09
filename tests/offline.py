import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':390,'height':844})
        pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/index.html#/home')
        await pg.evaluate("navigator.serviceWorker.ready"); await pg.wait_for_timeout(1500)
        n=await pg.evaluate("caches.open('coaching-room-v1').then(c=>c.keys()).then(k=>k.length)")
        print('cached files:', n, '| controlled:', await pg.evaluate('!!navigator.serviceWorker.controller'))
        await pg.reload(); await pg.wait_for_timeout(800)
        print('controlled after reload:', await pg.evaluate('!!navigator.serviceWorker.controller'))
        await ctx.set_offline(True)
        await pg.reload(); await pg.wait_for_timeout(1500)
        t=await pg.inner_text('#view'); print('offline reload shows app:', 'THIS WEEK' in t.upper() and await pg.locator('#nextMatch').count()==1)
        await pg.evaluate("location.hash='#/board/bd-shape'"); await pg.wait_for_timeout(600)
        print('offline board renders tokens:', await pg.evaluate("document.querySelectorAll('#pitch [data-t=i]').length"))
        fonts=await pg.evaluate("document.fonts.check('700 20px \"Barlow Condensed\"')"); print('display font available offline:', fonts)
        print('errors', errs)
        await b.close()
asyncio.run(main())
