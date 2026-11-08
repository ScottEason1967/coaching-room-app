import asyncio, os, json
os.makedirs("shots", exist_ok=True)
from playwright.async_api import async_playwright
from mockserver import Server
U='http://localhost:8765/'
srv=Server(); MOCK=open('mocksb.js').read()
async def device(b, name, w, h):
    ctx=await b.new_context(viewport={'width':w,'height':h},has_touch=True,service_workers='block')
    await ctx.expose_function('__srv', lambda op,p: srv.handle(op,p))
    await ctx.route('**/js/config.js', lambda r: r.fulfill(content_type='text/javascript', body="export default {url:'https://example.supabase.co',anonKey:'test-anon'};"))
    await ctx.route('**/vendor/supabase.js', lambda r: r.fulfill(content_type='text/javascript', body='/* blocked in test */'))
    await ctx.add_init_script(MOCK)
    pg=await ctx.new_page(); pg.errs=[]
    pg.on('pageerror',lambda e: pg.errs.append(str(e)))
    pg.on('console',lambda m: pg.errs.append(m.text) if m.type=='error' else None)
    return pg
def rec(pg,id): return pg.evaluate(f"(JSON.parse(localStorage.getItem('coachingroom.v1')).recs['{id}']||null)")
async def sync(pg):
    await pg.goto(U+'index.html#/cloud'); await pg.wait_for_timeout(300)
    await pg.click('#cSync'); await pg.wait_for_timeout(800)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        A=await device(b,'phone',390,844); B=await device(b,'ipad',1194,834)
        await A.goto(U+'index.html#/cloud'); await A.wait_for_timeout(700); await A.evaluate("import('./tests/fixtures.js').then(F => F.examples())"); await A.wait_for_timeout(500)
        print('A cloud screen:', (await A.inner_text('#view'))[:60].replace('\n',' | '))
        await A.fill('#cE','joe@example.com'); await A.fill('#cP','correct-horse-1'); srv.op_signup({'email':'joe@example.com','password':'correct-horse-1'}); await A.click('#cIn'); await A.wait_for_timeout(1200)
        print('A after sign-up:', (await A.inner_text('#view'))[:90].replace('\n',' | '))
        # A edits: rename player, delete a seed player, create a session
        await A.goto(U+'index.html#/player/pl-9'); await A.wait_for_timeout(300)
        await A.fill('[data-f="name"]','Beth Smith'); await A.wait_for_timeout(600)
        await A.evaluate("location.hash='#/player/pl-18'"); await A.wait_for_timeout(300)
        await A.click('[data-act="del"]'); await A.click('.sheet [data-x="1"]'); await A.wait_for_timeout(300)
        await A.goto(U+'index.html#/plans/sessions'); await A.wait_for_timeout(300); await A.click('[data-act="newS"]'); await A.wait_for_timeout(400)
        sid=(await A.evaluate('location.hash')).split('/')[-1]
        await A.fill('[data-f="theme"]','Synced session from the phone'); await A.wait_for_timeout(600)
        await sync(A)
        print('server rows:', len(srv.items))
        # B signs in
        await B.goto(U+'index.html#/cloud'); await B.wait_for_timeout(500)
        await B.fill('#cE','joe@example.com'); await B.fill('#cP','correct-horse-1'); await B.click('#cIn'); await B.wait_for_timeout(1500)
        print('B pl-9:', (await rec(B,'pl-9'))['name'], '| B pl-18 deleted:', (await rec(B,'pl-18') or {}).get('del'), '| B session:', ((await rec(B,sid)) or {}).get('theme'))
        # B edits the session theme; A pulls it
        await B.goto(U+f'index.html#/session/{sid}'); await B.wait_for_timeout(400)
        await B.fill('[data-f="theme"]','Edited on the iPad'); await B.wait_for_timeout(600)
        await sync(B); await sync(A)
        print('A sees iPad edit:', (await rec(A,sid))['theme'])
        # LWW: A edits principle first, B later; both push; B wins everywhere
        await A.goto(U+'index.html#/principle/pr-2'); await A.wait_for_timeout(300); await A.fill('[data-f="title"]','Keep the ball (phone)'); await A.wait_for_timeout(600)
        await B.goto(U+'index.html#/principle/pr-2'); await B.wait_for_timeout(300); await B.fill('[data-f="title"]','Keep the ball (iPad, later)'); await B.wait_for_timeout(600)
        await sync(B); await sync(A); await sync(B)
        print('LWW A:', (await rec(A,'pr-2'))['title'], '| B:', (await rec(B,'pr-2'))['title'])
        # Player link on A
        await A.goto(U+'index.html#/match/mt-cls'); await A.wait_for_timeout(300)
        await A.click('[data-act="unexample"]'); await A.wait_for_timeout(200)
        import datetime; d=(datetime.date.today()+datetime.timedelta(days=2)).isoformat()
        await A.fill('[data-f="date"]',d); await A.wait_for_timeout(300)
        await A.click('#matchPart button:nth-child(2)'); await A.wait_for_timeout(300); await A.click('#planTabs [data-arg="squad"]'); await A.wait_for_timeout(300)
        await A.click('[data-act="sq"][data-arg="pl-9"]'); await A.wait_for_timeout(300)
        await A.fill('[data-f="instructions.pl-9"]','Pin their centre-backs and attack the back post'); await A.wait_for_timeout(700)
        await A.goto(U+'index.html#/player/pl-9'); await A.wait_for_timeout(300)
        await A.fill('[data-f="notes"]','PRIVATE NOTE never to be shared'); await A.wait_for_timeout(600)
        await A.click('[data-act="link"]'); await A.wait_for_timeout(300); await A.click('#shMake'); await A.wait_for_timeout(800)
        pl=await rec(A,'pl-9'); tok=pl['share']['token']; pin=pl['share']['pin']
        print('link token len', len(tok), 'pin', pin, '| snapshot has private note:', 'PRIVATE' in json.dumps(srv.shares[tok]['data']))
        # Player opens the link on her phone
        C=await device(b,'player',390,844)
        await C.goto(U+'view.html#'+tok); await C.wait_for_timeout(600)
        wrong='0000' if pin!='0000' else '1111'
        for i in range(2):
            await C.fill('.pinbox input[data-i="0"]', wrong); await C.wait_for_timeout(500)
        print('after 2 wrong:', (await C.inner_text('#pm')))
        await C.fill('.pinbox input[data-i="0"]', pin); await C.wait_for_timeout(700)
        t=await C.inner_text('#vp')
        # headings are rendered uppercase by CSS, and innerText follows the CSS, so compare upper-cased
        print('player page shows name:', 'BETH SMITH' in t.upper(), '| instruction:', 'back post' in t, '| next match:', 'CHESTER' in t.upper(), '| private note leaked:', 'PRIVATE' in t)
        await C.screenshot(path='shots/t7-player.png', full_page=True)
        # Staff link for a session, plus a comment
        await A.goto(U+f'index.html#/session/{sid}'); await A.wait_for_timeout(300)
        await A.click('[data-act="share"]'); await A.wait_for_timeout(300); await A.click('#shMake'); await A.wait_for_timeout(800)
        s=await rec(A,sid); C2=await device(b,'staff',1194,834)
        await C2.goto(U+'view.html#'+s['share']['token']); await C2.wait_for_timeout(500)
        await C2.fill('.pinbox input[data-i="0"]', s['share']['pin']); await C2.wait_for_timeout(700)
        await C2.fill('#cn','Sam'); await C2.fill('#ct','Can we swap the rondo for a 6v4?'); await C2.click('#cf button'); await C2.wait_for_timeout(600)
        print('staff page:', 'EDITED ON THE IPAD' in (await C2.inner_text('#vp')).upper(), '| comment stored:', srv.shares[s['share']['token']]['comments'][-1]['text'])
        # lockout
        C3=await device(b,'stranger',390,844); await C3.goto(U+'view.html#'+tok); await C3.wait_for_timeout(400)
        for i in range(5):
            await C3.fill('.pinbox input[data-i="0"]', wrong); await C3.wait_for_timeout(350)
        print('after 5 wrong:', await C3.inner_text('#pm'))
        await C3.fill('.pinbox input[data-i="0"]', pin); await C3.wait_for_timeout(500)
        print('right PIN during lock:', await C3.inner_text('#pm'))
        for pg in (A,B,C,C2,C3): print(pg.errs) if pg.errs else None
        await b.close()
asyncio.run(main())
