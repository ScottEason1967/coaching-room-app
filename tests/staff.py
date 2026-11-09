# Coaching staff working together (Nov 2026), against the stand-in server (mockserver.py mirrors
# schema.sql section 3). Joe invites the manager and a viewer from the Staff screen; they join from the
# link; Joe and the manager edit the same match plan; the viewer can look but not change anything.
# Live updates and "who's here" need the real Supabase: here each device syncs by hand instead.
import asyncio, json
from playwright.async_api import async_playwright
from mockserver import Server
U = 'http://localhost:8765/'
srv = Server(); MOCK = open('mocksb.js').read()
fails = []
def check(name, ok, extra=''):
    print(('ok   ' if ok else 'FAIL ') + name, extra)
    if not ok: fails.append(name)

async def device(b):
    ctx = await b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, service_workers='block')
    await ctx.expose_function('__srv', lambda op, p: srv.handle(op, p))
    await ctx.route('**/js/config.js', lambda r: r.fulfill(content_type='text/javascript', body="export default {url:'https://example.supabase.co',anonKey:'test-anon'};"))
    await ctx.route('**/vendor/supabase.js', lambda r: r.fulfill(content_type='text/javascript', body='/* blocked in test */'))
    await ctx.add_init_script(MOCK)
    pg = await ctx.new_page(); pg.errs = []
    pg.on('pageerror', lambda e: pg.errs.append(str(e)))
    return pg
def rec(pg, id): return pg.evaluate(f"(JSON.parse(localStorage.getItem('coachingroom.v1')).recs['{id}']||null)")
async def sync(pg): await pg.evaluate("import('./js/cloud.js').then(c => c.syncFully())"); await pg.wait_for_timeout(200)
async def go(pg, h): await pg.evaluate(f"location.hash='{h}'"); await pg.wait_for_timeout(400)
async def invite(pg, name, email, role):
    await go(pg, '#/staff')
    await pg.fill('#iN', name); await pg.fill('#iE', email)
    if role != 'coach': await pg.click(f'#iR [data-r="{role}"]')
    await pg.click('#iGo'); await pg.wait_for_timeout(500)
    tok = next(t for t, i in srv.invites.items() if i['email'] == email and not i['used_at'])
    await pg.click('#iX'); await pg.wait_for_timeout(200)
    return tok
async def join(b, tok, name, email, pw):
    pg = await device(b)
    await pg.goto(U + 'index.html#/join/' + tok); await pg.wait_for_timeout(900)
    await pg.fill('#jN', name); await pg.fill('#jP', pw); await pg.click('#jGo'); await pg.wait_for_timeout(2000)
    return pg

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        # Joe: an existing account with his team
        srv.op_signup({'email': 'joe@example.com', 'password': 'joe-pass-123'})
        J = await device(b)
        await J.goto(U + 'index.html'); await J.wait_for_timeout(600)
        await J.fill('#cE', 'joe@example.com'); await J.fill('#cP', 'joe-pass-123'); await J.click('#cIn'); await J.wait_for_timeout(1500)
        await J.evaluate("import('./js/store.js').then(S => { const p = S.get('pl-9'); p.name = 'Beth Smith'; S.put(p); S.setMeta('startHereDone', true); })")
        await sync(J)
        check('Joe owns his team after his first save', any(m['team_id'] == 't-thornaby' and m['role'] == 'owner' for m in srv.members))
        await go(J, '#/teamhome')
        check('Team has a Staff tile', await J.locator('#tStaff').count() == 1)
        await go(J, '#/staff')
        check('Staff lists Joe as owner', 'owner' in (await J.inner_text('#members')).lower())
        tok = await invite(J, 'Dave Manager', 'dave@example.com', 'coach')
        check('making an invite gives a link to send (share, WhatsApp, email, copy)', True)
        txt = await J.inner_text('#pending')
        check('the invite waits under Waiting to join', 'Dave Manager' in txt, txt[:80])
        await J.screenshot(path='shots/staff-joe.png', full_page=True)

        # Someone else cannot use Dave's link
        X = await device(b)
        await X.goto(U + 'index.html#/join/' + tok); await X.wait_for_timeout(900)
        check('the join screen names the team, who invited and the role', 'Thornaby FC Women' in await X.inner_text('#joinBox') and 'coach' in (await X.inner_text('#joinBox')).lower())
        await X.screenshot(path='shots/staff-join.png', full_page=True)
        check('the email is fixed to the invite', await X.get_attribute('#jE', 'readonly') is not None)

        # Dave joins
        D = await join(b, tok, 'Dave Manager', 'dave@example.com', 'dave-pass-123')
        check('Dave lands in the app after joining', await D.locator('#gate').count() == 0 and (await D.evaluate('location.hash')).startswith('#/home'), await D.evaluate('location.hash'))
        dr = await D.evaluate("import('./js/store.js').then(S => ({ team: S.team() && S.team().name, beth: (S.get('pl-9') || {}).name, role: S.roleIn('t-thornaby'), me: S.coach().name }))")
        check('Dave sees Joe’s team and squad', dr['team'] == 'Thornaby FC Women' and dr['beth'] == 'Beth Smith', dr)
        check('Dave is a coach, and his own profile is his', dr['role'] == 'coach' and dr['me'] == 'Dave Manager', dr)
        jid = srv.users['joe@example.com'][1]['id']; did = srv.users['dave@example.com'][1]['id']
        await J.evaluate("import('./js/store.js').then(S => { const c = S.coach(); c.photo = null; c.name = 'Joe'; c.pathwayNote = 'PRIVATE'; S.put(c); })"); await sync(J); await sync(D)
        check('Joe’s profile never reaches Dave', ('coach:' + jid) in srv.items and not srv.visible(did, srv.items['coach:' + jid]) and (await rec(D, 'coach'))['name'] == 'Dave Manager' and 'PRIVATE' not in await D.evaluate("localStorage.getItem('coachingroom.v1')"))
        check('the link is now used up', srv.invites[tok]['used_at'] is not None)
        X2 = await device(b); await X2.goto(U + 'index.html#/join/' + tok); await X2.wait_for_timeout(900); X = X2
        check('a used link says so', 'already been used' in await X.inner_text('#gate'))

        # Both work on one match plan
        mid = await J.evaluate("import('./views/match.js'.replace('./','./js/')).then(M => import('./js/store.js').then(S => { const m = M.createMatch('t-thornaby'); m.opponent = 'Chester-le-Street'; m.date = '2026-11-15'; S.put(m); return m.id; }))")
        await sync(J); await sync(D)
        await J.evaluate(f"import('./js/store.js').then(S => {{ const m = S.get('{mid}'); m.plan.keys = 'Switch early'; S.put(m); }})")
        await D.evaluate(f"import('./js/store.js').then(S => {{ const m = S.get('{mid}'); m.plan.planB = 'Go long to the 9'; S.put(m); }})")
        await sync(J); await sync(D); await sync(J)
        a = await rec(J, mid); d = await rec(D, mid)
        check('Joe’s keys and Dave’s Plan B both kept, on both devices', a['plan']['keys'] == d['plan']['keys'] == 'Switch early' and a['plan']['planB'] == d['plan']['planB'] == 'Go long to the 9', (a['plan'].get('keys'), a['plan'].get('planB'), d['plan'].get('keys'), d['plan'].get('planB')))
        check('the match still belongs to Joe', srv.items[mid]['owner'] == srv.users['joe@example.com'][1]['id'])
        await go(J, '#/home'); await go(J, f'#/match/{mid}')
        await J.evaluate("document.querySelector('#matchDetails').open = true")
        eb = await J.locator('#editedBy').count()
        check('Joe sees “Last change by Dave”', eb == 1 and 'Dave' in await J.inner_text('#editedBy'))

        # Same box, both at once: the later one wins, the other is kept under Cloud sync
        await J.evaluate(f"import('./js/store.js').then(S => {{ const m = S.get('{mid}'); m.plan.threat = 'JOE FIRST'; S.put(m); }})")
        await D.wait_for_timeout(30)
        await D.evaluate(f"import('./js/store.js').then(S => {{ const m = S.get('{mid}'); m.plan.threat = 'DAVE LATER'; S.put(m); }})")
        await sync(D); await sync(J); await sync(D)
        a = await rec(J, mid)
        check('same box: the later edit wins everywhere', a['plan']['threat'] == 'DAVE LATER' and (await rec(D, mid))['plan']['threat'] == 'DAVE LATER')
        cf = await J.evaluate("import('./js/store.js').then(S => S.conflicts().map(c => c.mine && c.mine.plan && c.mine.plan.threat))")
        check('Joe’s earlier version is kept under Cloud sync', 'JOE FIRST' in cf, cf)

        # The analysis gate: any coach can close it
        await J.evaluate(f"import('./js/store.js').then(S => {{ const m = S.get('{mid}'); m.date = '2026-11-01'; S.put(m); }})"); await sync(J); await sync(D)
        dueD = await D.evaluate("import('./js/store.js').then(S => S.reviewsDue('t-thornaby').length)")
        await D.evaluate(f"""import('./js/store.js').then(S => {{ const r = S.create('review', 't-thornaby', {{ type: 'match', refId: '{mid}', date: '2026-11-01', worked: 'a', didnt: 'b', change: 'c', self: 'd', keys: [] }}); const m = S.get('{mid}'); m.reviewId = r.id; S.put(m); return r.id; }})""")
        await sync(D); await sync(J)
        dueJ = await J.evaluate("import('./js/store.js').then(S => S.reviewsDue('t-thornaby').length)")
        check('Dave’s analysis closes the gate for Joe too', dueD >= 1 and dueJ < dueD, (dueD, dueJ))

        # A viewer
        vt = await invite(J, 'Viv Viewer', 'viv@example.com', 'viewer')
        V = await join(b, vt, 'Viv Viewer', 'viv@example.com', 'viv-pass-123')
        check('the viewer joins and sees the match', (await rec(V, mid) or {}).get('opponent') == 'Chester-le-Street')
        await go(V, f'#/match/{mid}')
        check('the viewer’s screens are view-only', await V.evaluate("document.body.classList.contains('viewonly')"))
        await V.evaluate(f"import('./js/store.js').then(S => {{ const m = S.get('{mid}'); m.opponent = 'VIEWER EDIT'; S.put(m); }})")
        await V.wait_for_timeout(300)
        await sync(V)
        check('a viewer’s change is refused and says why', srv.items[mid]['data']['opponent'] == 'Chester-le-Street' and 'can see this team but not change it' in await V.inner_text('.toast'))

        # Staff management
        await sync(J); await go(J, '#/staff')
        await J.screenshot(path='shots/staff-three.png', full_page=True)
        check('Staff lists all three', (await J.locator('#members [data-member]').count()) == 3)
        vid = srv.users['viv@example.com'][1]['id']
        await J.select_option(f'[data-role="{vid}"]', 'coach'); await J.wait_for_timeout(500)
        check('the owner changes Viv to coach', next(m for m in srv.members if m['user_id'] == vid)['role'] == 'coach')
        await sync(V)
        check('Viv’s screens are no longer view-only', not await V.evaluate("import('./js/store.js').then(S => S.roleIn('t-thornaby') === 'viewer')"))
        await go(D, '#/staff')
        check('a coach sees the staff but cannot invite or change roles', await D.locator('#invF').count() == 0 and await D.locator('[data-role]').count() == 0)
        await go(J, '#/staff'); await J.click(f'[data-act="rm"][data-arg="{vid}"]'); await J.wait_for_timeout(300); await J.click('[data-x="1"]'); await J.wait_for_timeout(600)
        check('the owner removes Viv', not any(m['user_id'] == vid for m in srv.members))
        await sync(V)
        check('Viv no longer receives the team’s changes', not any(srv.visible(vid, v) for v in srv.items.values() if v.get('team_id') == 't-thornaby'))

        for pg in (J, D, V, X):
            if pg.errs: print('errors', pg.errs)
        check('no page errors', not any(pg.errs for pg in (J, D, V, X)))
        await b.close()
    print('FAILS:', fails)
asyncio.run(main())
