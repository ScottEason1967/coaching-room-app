import asyncio, datetime
from playwright.async_api import async_playwright
U='http://localhost:8765/index.html'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,service_workers='block')
        pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.goto(U+'#/plans/sessions'); await pg.wait_for_timeout(400)
        await pg.click('[data-act="newS"]'); await pg.wait_for_timeout(400); sid=(await pg.evaluate('location.hash')).split('/')[-1]
        await pg.click('[data-act="add"]'); await pg.wait_for_timeout(300); await pg.click('#pdNew'); await pg.wait_for_timeout(400)
        print('new drill from session, hash:', await pg.evaluate('location.hash'))
        print('back button goes to:', await pg.evaluate("document.querySelector('#topbar a.backlink').getAttribute('href')"), '| session id', sid)
        # review loop -> acted-on line on Home
        yest=(datetime.date.today()-datetime.timedelta(days=1)).isoformat()
        await pg.goto(U+'#/session/'+sid); await pg.wait_for_timeout(300); await pg.evaluate("document.querySelectorAll('#sessDetails,#matchDetails').forEach(d=>d.open=true)"); await pg.fill('[data-f="date"]',yest); await pg.evaluate("document.querySelectorAll('#sessDetails,#matchDetails').forEach(d=>d.open=true)"); await pg.fill('[data-f="theme"]','Old session'); await pg.wait_for_timeout(600)
        await pg.goto(U+'#/home'); await pg.wait_for_timeout(300); await pg.click('[data-act="rev"]'); await pg.wait_for_timeout(300)
        for f,v in [('worked','a'),('didnt','b'),('change','Fewer stoppages in the rondo'),('self','c')]: await pg.fill(f'[data-f="{f}"]',v)
        await pg.wait_for_timeout(600); await pg.goto(U+'#/home'); await pg.wait_for_timeout(300)
        t=await pg.inner_text('#view'); print('home carried:', [l for l in t.split('\n') if 'Not acted on' in l or 'Acted on' in l])
        await pg.goto(U+'#/training/sessions'); await pg.wait_for_timeout(300); await pg.click('#newSession'); await pg.wait_for_timeout(400)
        print('new session default date:', await pg.evaluate("document.querySelector('[data-f=date]').value"), '(last session was', yest, '-> same weekday next week expected)')
        await pg.check('[data-f="addresses"]'); await pg.wait_for_timeout(600); await pg.goto(U+'#/home'); await pg.wait_for_timeout(300)
        t=await pg.inner_text('#view'); print('home carried after tick:', [l for l in t.split('\n') if 'Not acted on' in l or 'Acted on' in l])
        print('errors', errs); await b.close()
asyncio.run(main())
