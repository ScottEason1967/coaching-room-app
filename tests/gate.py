# Sign-in screen (Nov 2026): with cloud set up, nothing shows until someone is signed in.
# Run from tests/ with the app served on 8765.
import asyncio, json
from playwright.async_api import async_playwright
from mockserver import Server
U = 'http://localhost:8765/'
srv = Server(); MOCK = open('mocksb.js').read()
FAILS = []
def check(label, ok):
    print(('ok   ' if ok else 'FAIL ') + label)
    if not ok: FAILS.append(label)

async def device(b, w=390, h=844):
    ctx = await b.new_context(viewport={'width': w, 'height': h}, has_touch=True, service_workers='block')
    await ctx.route('**/js/config.js', lambda r: r.fulfill(content_type='text/javascript', body="export default {url:'https://example.supabase.co',anonKey:'test-anon'};"))
    await ctx.route('**/vendor/supabase.js', lambda r: r.fulfill(content_type='text/javascript', body='/* blocked in test */'))
    await ctx.expose_function('__srv', lambda op, p: srv.handle(op, p))
    await ctx.add_init_script(MOCK)
    pg = await ctx.new_page(); pg.errs = []
    pg.on('pageerror', lambda e: pg.errs.append(str(e)))
    return pg

async def visible(pg, sel):
    return await pg.evaluate(f"(() => {{ const e = document.querySelector('{sel}'); if (!e || getComputedStyle(e).display === 'none') return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }})()")

async def main():
    srv.op_signup({'email': 'joe@example.com', 'password': 'correct-horse-1'})
    srv.op_signup({'email': 'other@example.com', 'password': 'other-pass-99'})
    async with async_playwright() as p:
        b = await p.chromium.launch()
        A = await device(b)
        for route in ['#/home', '#/squad', '#/player/pl-9', '#/cloud']:
            await A.goto(U + 'index.html' + route); await A.wait_for_timeout(500)
            body = await A.inner_text('body')
            check(f'signed out, {route}: sign-in screen shows', await visible(A, '#gate'))
            check(f'signed out, {route}: no team data on screen', 'Thornaby' not in body and 'Player 9' not in body and not await visible(A, '#app'))
        await A.screenshot(path='shots/gate-phone.png')
        await A.fill('#cE', 'joe@example.com'); await A.fill('#cP', 'wrong-one'); await A.click('#cIn'); await A.wait_for_timeout(500)
        check('wrong password: plain message', 'don’t match' in await A.inner_text('#gM'))
        await A.click('#cFg'); await A.wait_for_timeout(300)
        await A.fill('#cE', ''); await A.click('#cFg'); await A.wait_for_timeout(200)
        check('forgot password without email asks for it', 'Type your email' in await A.inner_text('#gM'))
        await A.fill('#cE', 'joe@example.com'); await A.fill('#cP', 'correct-horse-1'); await A.click('#cIn'); await A.wait_for_timeout(1200)
        check('signed in: app shows, gate gone', await visible(A, '#app') and not await A.query_selector('#gate'))
        check('signed in: lands on the screen asked for (cloud)', 'Signed in' in await A.inner_text('#view') or 'joe@example.com' in await A.inner_text('#view'))
        await A.goto(U + 'index.html#/player/pl-9'); await A.wait_for_timeout(400)
        await A.fill('[data-f="name"]', 'Beth Smith'); await A.wait_for_timeout(2200)
        check('edit reached the cloud', any(v['data'].get('name') == 'Beth Smith' for v in srv.items.values()))
        await A.reload(); await A.wait_for_timeout(800)
        check('reload: stays signed in, no gate', not await A.query_selector('#gate') and 'Beth' in await A.input_value('[data-f="name"]'))
        # sign out from the Cloud screen
        await A.goto(U + 'index.html#/cloud'); await A.wait_for_timeout(400)
        await A.click('#cOut'); await A.wait_for_timeout(300); await A.click('.sheet [data-x="1"]'); await A.wait_for_timeout(600)
        check('sign out: back to the sign-in screen', await visible(A, '#gate') and not await visible(A, '#app'))
        check('sign out: data no longer on screen', 'Beth' not in await A.inner_text('body'))
        # a different account on the same device must not get Joe's data
        await A.fill('#cE', 'other@example.com'); await A.fill('#cP', 'other-pass-99'); await A.click('#cIn'); await A.wait_for_timeout(1500)
        oid = srv.users['other@example.com'][1]['id']
        other = [v for (o, _), v in srv.items.items() if o == oid]
        print('   rows under the other account:', len(other), [v['id'] for v in other][:6])
        check('other account: none of Joe’s edits pushed into it', not any(v['data'].get('name') == 'Beth Smith' for v in other))
        d = await A.evaluate("JSON.parse(localStorage.getItem('coachingroom.v1'))")
        check('other account: Joe’s data cleared from this device', 'pl-9' not in d['recs'] or d['recs']['pl-9'].get('name') != 'Beth Smith')
        # a second device: gate, sign in, gets Joe's data
        B = await device(b, 1194, 834)
        await B.goto(U + 'index.html#/home'); await B.wait_for_timeout(500)
        check('iPad: sign-in screen first', await visible(B, '#gate'))
        await B.screenshot(path='shots/gate-ipad.png')
        await B.fill('#cE', 'joe@example.com'); await B.fill('#cP', 'correct-horse-1'); await B.press('#cP', 'Enter'); await B.wait_for_timeout(1500)
        await B.goto(U + 'index.html#/player/pl-9'); await B.wait_for_timeout(500)
        check('iPad: Joe’s edit arrived', 'Beth' in await B.input_value('[data-f="name"]'))
        # password reset link
        C = await device(b)
        await C.goto(U + 'index.html#/home'); await C.wait_for_timeout(300)
        await C.fill('#cE', 'joe@example.com'); await C.fill('#cP', 'correct-horse-1'); await C.click('#cIn'); await C.wait_for_timeout(800)
        await C.goto(U + 'manifest.webmanifest'); await C.goto(U + 'index.html#access_token=x&type=recovery'); await C.wait_for_timeout(800)
        check('reset link: asks for a new password', await C.query_selector('#gP') is not None)
        await C.fill('#gP', 'new-password-1'); await C.click('#gF button[type=submit]'); await C.wait_for_timeout(600)
        check('reset link: after saving, the app opens', not await C.query_selector('#gate') and await visible(C, '#app'))
        print('errors', A.errs + B.errs + C.errs)
        print('FAILS:', FAILS)
        await b.close()
asyncio.run(main())
