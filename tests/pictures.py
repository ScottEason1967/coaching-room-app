# Profile photo, club badge and player photos (Nov 2026). Run from tests/ with the app served on 8765.
import asyncio, json, os
from PIL import Image
from playwright.async_api import async_playwright
from mockserver import Server
U = 'http://localhost:8765/'
srv = Server(); MOCK = open('mocksb.js').read()
FAILS = []
def check(label, ok):
    print(('ok   ' if ok else 'FAIL ') + label)
    if not ok: FAILS.append(label)

os.makedirs('shots', exist_ok=True)
Image.new('RGB', (3000, 2000), (200, 40, 40)).save('/tmp/big-photo.jpg', quality=95)          # a phone-sized photo
im = Image.new('RGBA', (800, 800), (0, 0, 0, 0))
for x in range(200, 600):
    for y in range(150, 650): im.putpixel((x, y), (30, 90, 220, 255))
im.save('/tmp/badge.png')                                                                       # a badge with a see-through background

async def device(b, w=390, h=844):
    ctx = await b.new_context(viewport={'width': w, 'height': h}, has_touch=True, service_workers='block')
    await ctx.route('**/js/config.js', lambda r: r.fulfill(content_type='text/javascript', body="export default {url:'https://example.supabase.co',anonKey:'test-anon'};"))
    await ctx.route('**/vendor/supabase.js', lambda r: r.fulfill(content_type='text/javascript', body='/* blocked in test */'))
    await ctx.expose_function('__srv', lambda op, p: srv.handle(op, p))
    await ctx.add_init_script(MOCK)
    pg = await ctx.new_page(); pg.errs = []
    pg.on('pageerror', lambda e: pg.errs.append(str(e)))
    return pg

async def pick(pg, click_sel, path):
    async with pg.expect_file_chooser() as fc:
        await pg.click(click_sel)
    await (await fc.value).set_files(path)
    await pg.wait_for_timeout(700)

def rec(pg, id): return pg.evaluate(f"(JSON.parse(localStorage.getItem('coachingroom.v1')).recs['{id}']||null)")

async def main():
    srv.op_signup({'email': 'joe@example.com', 'password': 'correct-horse-1'})
    async with async_playwright() as p:
        b = await p.chromium.launch()
        A = await device(b)
        await A.goto(U + 'index.html#/more'); await A.wait_for_timeout(400)
        await A.fill('#cE', 'joe@example.com'); await A.fill('#cP', 'correct-horse-1'); await A.click('#cIn'); await A.wait_for_timeout(1000)
        # profile photo
        await pick(A, '#mePhoto', '/tmp/big-photo.jpg')
        c = await rec(A, 'coach')
        check('profile photo saved, shrunk (under 120 KB of text)', bool(c.get('photo')) and c['photo'].startswith('data:image/jpeg') and len(c['photo']) < 120000)
        print('   profile photo size', len(c.get('photo') or ''))
        check('top bar shows the photo', await A.query_selector('#topbar a[href="#/more"] img.avatar') is not None)
        # club badge
        await A.goto(U + 'index.html#/team/t-thornaby'); await A.wait_for_timeout(400)
        await pick(A, '#teamLogo [data-act="logo"]', '/tmp/badge.png')
        t = await rec(A, 't-thornaby')
        check('badge saved as PNG (keeps see-through background)', bool(t.get('logo')) and t['logo'].startswith('data:image/png'))
        print('   badge size', len(t.get('logo') or ''))
        await A.goto(U + 'index.html#/home'); await A.wait_for_timeout(400)
        check('team switcher shows the badge', await A.query_selector('#topbar .team-switch img.logo') is not None)
        await A.screenshot(path='shots/pictures-home.png')
        await A.wait_for_timeout(1800)
        check('badge and photo synced to the cloud', any(v['id'] == 't-thornaby' and v['data'].get('logo') for v in srv.items.values()) and any(v['id'] == 'coach' and v['data'].get('photo') for v in srv.items.values()))
        # print header carries the badge
        html = await A.evaluate("import('./js/print.js').then(m => m.sessionHtml ? 'n/a' : 'n/a')")
        # player link
        await A.goto(U + 'index.html#/player/pl-9'); await A.wait_for_timeout(400)
        check('player page explains photos come from her', 'add their own' in await A.inner_text('#photoNote'))
        await A.click('[data-act="link"]'); await A.wait_for_timeout(300); await A.click('#shMake'); await A.wait_for_timeout(900)
        pl = await rec(A, 'pl-9'); tok = pl['share']['token']; pin = pl['share']['pin']
        check('player page snapshot carries the badge', bool(srv.shares[tok]['data']['team'].get('logo')))
        # she opens her page and adds a photo
        C = await device(b)
        await C.goto(U + 'view.html#' + tok); await C.wait_for_timeout(500)
        await C.fill('.pinbox input[data-i="0"]', pin); await C.wait_for_timeout(800)
        check('her page offers the choice', 'Your photo' in await C.inner_text('#vp') and 'Optional' in await C.inner_text('#vp'))
        await C.set_input_files('#phIn', '/tmp/big-photo.jpg'); await C.wait_for_timeout(900)
        check('her photo saved on her link', (srv.shares[tok].get('photo') or '').startswith('data:image/jpeg'))
        check('her page shows it', await C.query_selector('#vp img.avatar') is not None)
        await C.screenshot(path='shots/pictures-playerpage.png', full_page=True)
        # Joe's app picks it up on the next sync
        await A.goto(U + 'index.html#/cloud'); await A.wait_for_timeout(300); await A.click('#cSync'); await A.wait_for_timeout(900)
        await A.goto(U + 'index.html#/squad'); await A.wait_for_timeout(400)
        check('squad list shows her photo', await A.query_selector('a[href="#/player/pl-9"] img.avatar') is not None)
        await A.screenshot(path='shots/pictures-squad.png')
        d = await A.evaluate("JSON.parse(localStorage.getItem('coachingroom.v1'))")
        check('the photo is not in her player record (so Joe’s edits can’t overwrite it)', 'photo' not in d['recs']['pl-9'])
        # Joe edits her record and updates her page: photo stays
        await A.goto(U + 'index.html#/player/pl-9'); await A.wait_for_timeout(400)
        await A.fill('[data-f="notes"]', 'private'); await A.wait_for_timeout(600)
        await A.click('[data-act="link"]'); await A.wait_for_timeout(300); await A.click('#shUpd'); await A.wait_for_timeout(800)
        check('Joe updating her page keeps her photo', (srv.shares[tok].get('photo') or '').startswith('data:image/jpeg'))
        # she removes it
        C.on('dialog', lambda dlg: asyncio.ensure_future(dlg.accept()))
        await C.click('#phDel'); await C.wait_for_timeout(800)
        check('she can remove it', not srv.shares[tok].get('photo') and await C.query_selector('#vp img.avatar') is None)
        await A.goto(U + 'index.html#/cloud'); await A.wait_for_timeout(300); await A.click('#cSync'); await A.wait_for_timeout(900)
        await A.goto(U + 'index.html#/squad'); await A.wait_for_timeout(400)
        check('removal reaches Joe’s squad list', await A.query_selector('a[href="#/player/pl-9"] img.avatar') is None)
        # Joe can remove one too
        await C.set_input_files('#phIn', '/tmp/big-photo.jpg'); await C.wait_for_timeout(900)
        await A.goto(U + 'index.html#/cloud'); await A.wait_for_timeout(300); await A.click('#cSync'); await A.wait_for_timeout(900)
        await A.goto(U + 'index.html#/player/pl-9'); await A.wait_for_timeout(400)
        await A.click('[data-act="unphoto"]'); await A.wait_for_timeout(300); await A.click('.sheet [data-x="1"]'); await A.wait_for_timeout(800)
        check('Joe can remove it', not srv.shares[tok].get('photo') and await A.query_selector('#view img.avatar') is None)
        # remove profile photo
        await A.goto(U + 'index.html#/more'); await A.wait_for_timeout(300)
        await A.click('[data-act="unphoto"]'); await A.wait_for_timeout(300)
        check('profile photo can be removed', not (await rec(A, 'coach')).get('photo'))
        print('errors', A.errs + C.errs)
        print('FAILS:', FAILS)
        await b.close()
asyncio.run(main())
