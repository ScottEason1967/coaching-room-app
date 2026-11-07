import asyncio, os, sys
os.makedirs("shots", exist_ok=True)
from playwright.async_api import async_playwright
ROUTES=['home','model','boards','board/bd-shape','plans/sessions','plans/matches','plans/drills','plans/reviews','drill/dr-rondo','match/mt-cls','squad','player/pl-7','principle/pr-1','more','pathway','logbook','teams','team/t-thornaby','cloud','team/new']
async def main(dev):
    async with async_playwright() as p:
        b=await p.chromium.launch()
        if dev=='phone': ctx=await b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,has_touch=True,is_mobile=True)
        elif dev=='ipad': ctx=await b.new_context(viewport={'width':1194,'height':834},device_scale_factor=1,has_touch=True)
        else: ctx=await b.new_context(viewport={'width':1440,'height':900})
        pg=await ctx.new_page(); errs=[]
        pg.on('console',lambda m: errs.append(('console',m.type,m.text)) if m.type in('error','warning') else None)
        pg.on('pageerror',lambda e: errs.append(('pageerror',str(e))))
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(800)
        for r in ROUTES:
            await pg.evaluate(f"location.hash='#/{r}'"); await pg.wait_for_timeout(350)
            await pg.screenshot(path=f'shots/{dev}-{r.replace("/","_")}.png',full_page=True)
            t=await pg.inner_text('#view')
            if 'Something went wrong' in t: errs.append(('view',r,t[:300]))
        for e in errs: print(e)
        print(dev,'done',len(errs),'issues')
        await b.close()
asyncio.run(main(sys.argv[1]))
