import asyncio
from playwright.async_api import async_playwright
U='http://localhost:8765/index.html'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,service_workers='block')
        pg=await ctx.new_page()
        await pg.goto(U+'#/principle/pr-1'); await pg.wait_for_timeout(400)
        before=await pg.evaluate("JSON.parse(localStorage.getItem('coachingroom.v1')).recs['pr-1'].upd")
        # type, then the app goes to the background within 400 ms (phone switched off / app swiped away)
        await pg.fill('[data-f="why"]','TYPED THEN PHONE LOCKED IMMEDIATELY')
        await pg.evaluate("window.dispatchEvent(new Event('pagehide'))")   # store.flush() runs here
        st=await pg.evaluate("JSON.parse(localStorage.getItem('coachingroom.v1'))")
        print('saved text:', st['recs']['pr-1']['why'][:40])
        print('upd changed?', st['recs']['pr-1']['upd']!=before, '| marked dirty for sync?', 'pr-1' in st['dirty'])
        await b.close()
asyncio.run(main())
