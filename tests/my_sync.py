import asyncio, os, json, datetime
from playwright.async_api import async_playwright
from mockserver import Server
U='http://localhost:8765/'
srv=Server(); MOCK=open('mocksb.js').read()
async def device(b, w=390, h=844, clock_shift_ms=0):
    ctx=await b.new_context(viewport={'width':w,'height':h},has_touch=True,service_workers='block')
    await ctx.expose_function('__srv', lambda op,p: srv.handle(op,p))
    await ctx.route('**/js/config.js', lambda r: r.fulfill(content_type='text/javascript', body="export default {url:'https://example.supabase.co',anonKey:'test-anon'};"))
    await ctx.route('**/vendor/supabase.js', lambda r: r.fulfill(content_type='text/javascript', body='/* blocked in test */'))
    if clock_shift_ms:
        await ctx.add_init_script(f"""(()=>{{const R=Date;const S={clock_shift_ms};
        class D extends R{{constructor(...a){{if(!a.length){{super(R.now()+S);}}else super(...a);}} static now(){{return R.now()+S;}}}}
        window.Date=D;}})();""")
    await ctx.add_init_script(MOCK)
    pg=await ctx.new_page(); pg.errs=[]
    pg.on('pageerror',lambda e: pg.errs.append(str(e)))
    pg.on('console',lambda m: pg.errs.append(m.text) if m.type=='error' else None)
    return pg
def rec(pg,id): return pg.evaluate(f"(JSON.parse(localStorage.getItem('coachingroom.v1')).recs['{id}']||null)")
def dirty(pg): return pg.evaluate("Object.keys(JSON.parse(localStorage.getItem('coachingroom.v1')).dirty)")

async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        # ---- TEST 1: sign in on a fresh device, then edit WITHOUT reloading. Does it push on its own?
        A=await device(b)
        await A.goto(U+'index.html#/cloud'); await A.wait_for_timeout(400)
        await A.fill('#cE','joe@example.com'); await A.fill('#cP','correct-horse-1'); srv.op_signup({'email':'joe@example.com','password':'correct-horse-1'}); await A.click('#cIn'); await A.wait_for_timeout(1000)
        await A.goto(U+'index.html#/player/pl-9'); await A.wait_for_timeout(300)
        await A.fill('[data-f="name"]','Beth Smith'); await A.wait_for_timeout(3000)   # debounce 400 + pushSoon 1500
        print('T1 after sign-in (no reload), edit then wait 3s: server rows =', len(srv.items), '| local dirty =', await dirty(A))
        # switch tab / focus events (what a phone does) – still nothing?
        await A.evaluate("document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus'))"); await A.wait_for_timeout(800)
        print('T1 after focus/visibility events: server rows =', len(srv.items))
        await A.reload(); await A.wait_for_timeout(1500)
        print('T1 after app restart: server rows =', len(srv.items), '| dirty =', await dirty(A))

        # ---- TEST 2: review gate bypass. Session yesterday -> tap Review -> leave -> plan new session.
        yest=(datetime.date.today()-datetime.timedelta(days=1)).isoformat()
        await A.goto(U+'index.html#/plans/sessions'); await A.wait_for_timeout(300)
        await A.click('[data-act="newS"]'); await A.wait_for_timeout(400)
        sid=(await A.evaluate('location.hash')).split('/')[-1]
        await A.fill('[data-f="theme"]','Session to be reviewed'); await A.fill('[data-f="date"]',yest); await A.wait_for_timeout(700)
        await A.goto(U+'index.html#/home'); await A.wait_for_timeout(400)
        print('T2 home shows review due:', 'ANALYSIS DUE' in (await A.inner_text('#view')).upper())
        await A.click('[data-act="rev"]'); await A.wait_for_timeout(400)   # opens the review (empty)
        rid=(await A.evaluate('location.hash')).split('/')[-1]
        await A.goto(U+'index.html#/home'); await A.wait_for_timeout(400)
        t=await A.inner_text('#view')
        print('T2 after opening an EMPTY review and leaving: home still shows review due?', 'ANALYSIS DUE' in t.upper())
        await A.goto(U+'#/training/sessions'); await A.wait_for_timeout(300); await A.click('#newSession'); await A.wait_for_timeout(400)
        print('T2 can plan a new session with the review empty? gate shown =', bool(await A.query_selector('.sheet')), '| hash =', await A.evaluate('location.hash'))
        r=await rec(A,rid); print('T2 review content:', {k:r.get(k) for k in ('worked','didnt','change','self')})

        # ---- TEST 3: clock skew. Phone clock 1 day ahead edits a principle; iPad edits later (real time); whose edit survives?
        await A.goto(U+'index.html#/cloud'); await A.click('#cSync'); await A.wait_for_timeout(800)
        F=await device(b, 1194, 834, clock_shift_ms=86400000)  # 'fast' clock, +1 day
        await F.goto(U+'index.html#/cloud'); await F.wait_for_timeout(400)
        await F.fill('#cE','joe@example.com'); await F.fill('#cP','correct-horse-1'); await F.click('#cIn'); await F.wait_for_timeout(1500)
        await F.goto(U+'index.html#/principle/pr-1'); await F.wait_for_timeout(300)
        await F.fill('[data-f="title"]','Edited on the device with the WRONG clock'); await F.wait_for_timeout(600)
        await F.goto(U+'index.html#/cloud'); await F.click('#cSync'); await F.wait_for_timeout(800)
        # Now A (correct clock) edits the same principle later in real time
        await A.goto(U+'index.html#/cloud'); await A.click('#cSync'); await A.wait_for_timeout(800)
        await A.goto(U+'index.html#/principle/pr-1'); await A.wait_for_timeout(300)
        await A.fill('[data-f="title"]','Edited LATER on the phone with the right clock'); await A.wait_for_timeout(600)
        await A.goto(U+'index.html#/cloud'); await A.click('#cSync'); await A.wait_for_timeout(800)
        await A.click('#cSync'); await A.wait_for_timeout(800)
        print('T3 after both synced, phone (right clock) sees:', (await rec(A,'pr-1'))['title'])
        print('T3 any warning shown to Joe? cloud screen says:', (await A.inner_text('#view'))[:120].replace('\n',' | '))
        await F.goto(U+'index.html#/cloud'); await F.click('#cSync'); await F.wait_for_timeout(900)
        tf=await F.inner_text('#view'); print('T3 wrong-clock device warns?', 'CHECK THIS DEVICE' in tf.upper(), '|', [l for l in tf.split('\n') if 'clock is about' in l][:1])

        # ---- TEST 4: offline edit, other device edits meanwhile, come back online: is the offline edit lost silently?
        G=await device(b)
        await G.goto(U+'index.html#/cloud'); await G.wait_for_timeout(300)
        await G.fill('#cE','joe@example.com'); await G.fill('#cP','correct-horse-1'); await G.click('#cIn'); await G.wait_for_timeout(1500)
        await G.reload(); await G.wait_for_timeout(1200)
        await G.context.set_offline(True)
        await G.goto(U+'index.html#/principle/pr-2'); await G.wait_for_timeout(300)
        await G.fill('[data-f="why"]','OFFLINE EDIT: written on the bus with no signal'); await G.wait_for_timeout(2500)
        # meanwhile the laptop edits the same principle's title
        await A.goto(U+'index.html#/principle/pr-2'); await A.wait_for_timeout(300)
        await A.fill('[data-f="title"]','Title changed on the laptop while the phone was offline'); await A.wait_for_timeout(600)
        await A.goto(U+'index.html#/cloud'); await A.click('#cSync'); await A.wait_for_timeout(800)
        await G.context.set_offline(False)
        await G.goto(U+'index.html#/cloud'); await G.wait_for_timeout(300); await G.click('#cSync'); await G.wait_for_timeout(1000)
        r=await rec(G,'pr-2'); print('T4 phone after reconnect: title =', r['title'], '| why =', r['why'][:40])
        print('T4 offline edit survived anywhere?', 'OFFLINE' in json.dumps([v for v in srv.items.values()]))
        tg=await G.evaluate("document.querySelector('#view').textContent"); print('T4 phone keeps a copy of the lost edit on the cloud screen?', 'OFFLINE EDIT' in tg, '| heading:', 'EDITS REPLACED' in tg.upper())

        for pg in (A,F,G): print('errs', pg.errs) if pg.errs else None
        await b.close()
asyncio.run(main())
