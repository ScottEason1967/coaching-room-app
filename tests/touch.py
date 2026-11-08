import asyncio, os, json
os.makedirs("shots", exist_ok=True)
from playwright.async_api import async_playwright
U='http://localhost:8765/index.html'
async def center(pg, sel):
    return await pg.evaluate(f"""(()=>{{const e=document.querySelector('{sel}');const r0=e.getBoundingClientRect();if(r0.top<120||r0.bottom>innerHeight-90)e.scrollIntoView({{block:'center'}});const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]}})()""")
async def drag(cdp, a, b, steps=8):
    await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':a[0],'y':a[1]}]})
    for i in range(1,steps+1):
        x=a[0]+(b[0]-a[0])*i/steps; y=a[1]+(b[1]-a[1])*i/steps
        await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':y}]})
    await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
async def tap(cdp,a):
    await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':a[0],'y':a[1]}]})
    await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
def rec(pg,id): return pg.evaluate(f"JSON.parse(localStorage.getItem('coachingroom.v1')).recs['{id}']")
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        ctx=await b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,has_touch=True,is_mobile=True)
        pg=await ctx.new_page(); errs=[]
        pg.on('pageerror',lambda e: errs.append(str(e)))
        pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
        await pg.add_init_script("window.print=()=>{window.__printed=(window.__printed||0)+1}")
        cdp=await ctx.new_cdp_session(pg)
        await pg.goto(U+'#/board/bd-shape'); await pg.wait_for_timeout(700); await pg.evaluate("import('./tests/fixtures.js').then(F => F.examples())"); await pg.wait_for_timeout(700)
        # 1 drag CF (u10) on vertical board
        a=await center(pg,'[data-id="u10"] circle:nth-child(2)'); target=[a[0]+60,a[1]+90]
        await drag(cdp,a,target); await pg.wait_for_timeout(500)
        after=await center(pg,'[data-id="u10"] circle:nth-child(2)')
        r=await rec(pg,'bd-shape'); cf=[i for i in r['frames'][0]['items'] if i['id']=='u10'][0]
        print('V drag: token now at',[round(v) for v in after],'finger at',target,'saved',cf['x'],cf['y'])
        # 2 arrow: pick Run tool, drag
        await pg.click('[data-tool="arrow:run"]'); s=await center(pg,'#pitch')
        await drag(cdp,[s[0]-40,s[1]+40],[s[0]+40,s[1]-60]); await pg.wait_for_timeout(500)
        r=await rec(pg,'bd-shape'); print('arrows in frame 1:',len(r['frames'][0]['arrows']), r['frames'][0]['arrows'][-1]['style'] if r['frames'][0]['arrows'] else '')
        # 3 undo
        await pg.click('#undoB'); await pg.wait_for_timeout(500); r=await rec(pg,'bd-shape'); print('after undo arrows:',len(r['frames'][0]['arrows']))
        # 4 sideways
        await pg.click('[data-tool="select"]'); await pg.click('[data-act="orient"]'); await pg.wait_for_timeout(300)
        a=await center(pg,'[data-id="u9"] circle:nth-child(2)'); target=[a[0]+50,a[1]+30]
        await drag(cdp,a,target); await pg.wait_for_timeout(500)
        after=await center(pg,'[data-id="u9"] circle:nth-child(2)')
        print('H drag: token now at',[round(v) for v in after],'finger at',[round(v) for v in target])
        await pg.screenshot(path='shots/t3-board-h.png')
        await pg.click('[data-act="orient"]')
        # 5 add frame + play
        await pg.click('[data-act="addFrame"]'); await pg.wait_for_timeout(300)
        r=await rec(pg,'bd-shape'); print('frames now',len(r['frames']))
        # 6 tap token -> inspector swap
        a=await center(pg,'[data-id="u0"] circle:nth-child(2)'); await tap(cdp,a); await pg.wait_for_timeout(300)
        await pg.select_option('#swap','pl-13'); await pg.wait_for_timeout(900)
        r=await rec(pg,'bd-shape'); print('GK swapped to', [i['pid'] for i in r['frames'][-1]['items'] if i['id']=='u0'])
        await pg.click('[data-act="print"]'); await pg.wait_for_timeout(300); print('print called', await pg.evaluate('window.__printed'), 'print area svgs', await pg.evaluate("document.querySelectorAll('#print svg').length"))
        # 7 drill: add disc and drag it
        await pg.goto(U+'#/drill/dr-rondo'); await pg.wait_for_timeout(500)
        await pg.click('[data-tool="cone"]'); s=await center(pg,'#dc'); await tap(cdp,[s[0]+30,s[1]+30]); await pg.wait_for_timeout(900)
        r=await rec(pg,'dr-rondo'); print('drill items',len(r['items']), r['items'][-1]['kind'], r['items'][-1].get('color'), r['items'][-1].get('x'), r['items'][-1].get('y'))
        await pg.click('[data-tool="select"]')
        print('dock bar text:', await pg.inner_text('#dockBar'))
        print('errors:',errs)
        await b.close()
asyncio.run(main())
