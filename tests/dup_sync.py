# Nov 2026: Joe's red dot "ON CONFLICT DO UPDATE command cannot affect row a second time".
# One upload held the same id twice, so sync stopped and the Staff screen said "Not switched on yet".
# Plants both ways that happens on a device's saved data, then checks sync recovers.
import asyncio
from playwright.async_api import async_playwright
src = open('staff.py').read().split('async def main():')[0]
exec(src)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        srv.op_signup({'email': 'joe@example.com', 'password': 'joe-pass-123'})
        J = await device(b)
        await J.goto(U + 'index.html'); await J.wait_for_timeout(600)
        await J.fill('#cE', 'joe@example.com'); await J.fill('#cP', 'joe-pass-123'); await J.click('#cIn'); await J.wait_for_timeout(1500)
        await J.evaluate("import('./js/store.js').then(S => S.setMeta('startHereDone', true))")
        await sync(J)
        jid = srv.users['joe@example.com'][1]['id']
        # Plant from a page that isn't the app, so the app's save-on-close can't overwrite it.
        ctx = J.context; errs = J.errs; await J.close()
        J = await ctx.new_page(); J.errs = errs; J.on('pageerror', lambda e: J.errs.append(str(e)))
        await J.goto(U + 'README.md')
        # Break the saved data the two ways: a profile copy under its cloud name, and a player whose id
        # was changed to another player's after it was stored. Both dirty.
        await J.evaluate(f"""(() => {{
          const k = 'coachingroom.v1', d = JSON.parse(localStorage.getItem(k));
          const c = d.recs.coach; c.name = 'Joe Eason'; c.upd = new Date().toISOString();
          d.recs['coach:{jid}'] = {{ ...c, id: 'coach:{jid}', name: 'Joe Eason (newer)', upd: new Date(Date.now() + 1000).toISOString() }};
          d.dirty.coach = 1; d.dirty['coach:{jid}'] = 1;
          d.recs['pl-9'].id = 'pl-8'; d.recs['pl-9'].name = 'Beth Smith'; d.dirty['pl-9'] = 1; d.dirty['pl-8'] = 1;
          delete d.meta.members;
          localStorage.setItem(k, JSON.stringify(d));
        }})()""")
        # The old app would send this as one upload: confirm the stand-in server refuses it like Supabase.
        r = srv.op_query({'uid': jid, 'table': 'items', 'op': 'upsert', 'filters': [], 'rows': [
            {'id': 'x', 'owner': jid, 'kind': 'drill', 'data': {}, 'updated_at': '2026-01-01T00:00:00Z'},
            {'id': 'x', 'owner': jid, 'kind': 'drill', 'data': {}, 'updated_at': '2026-01-01T00:00:00Z'}]}) if hasattr(srv, 'op_query') else None
        check('the test server refuses a doubled id, as Supabase does', bool(r and r.get('error') and 'second time' in r['error']['message']))
        await J.goto(U + 'index.html'); await J.wait_for_timeout(1500)
        await sync(J)
        st = await J.evaluate("import('./js/cloud.js').then(c => c.status ? c.status() : null)")
        loc = await J.evaluate("JSON.parse(localStorage.getItem('coachingroom.v1'))")
        check('sync works again (nothing left waiting to upload)', len(loc['dirty']) == 0, list(loc['dirty'])[:5])
        check('no record stored under another id', all(v.get('id') == k for k, v in loc['recs'].items()))
        check('the profile copy is folded into the profile, newer name kept', 'coach:' + jid not in loc['recs'] and loc['recs']['coach']['name'] == 'Joe Eason (newer)', loc['recs']['coach'].get('name'))
        check('the newer profile reached the cloud', srv.items.get('coach:' + jid, {}).get('data', {}).get('name') == 'Joe Eason (newer)')
        check('both players still there, each matching the cloud', all(loc['recs'][i]['name'] == srv.items[i]['data']['name'] for i in ('pl-8', 'pl-9')), (loc['recs']['pl-9'].get('name'), loc['recs']['pl-8'].get('name')))
        check('the staff list loads again', loc['meta'].get('members') is not None)
        await go(J, '#/staff')
        txt = await J.inner_text('#view') if await J.locator('#view').count() else await J.inner_text('body')
        check('Staff screen shows the staff, not "Not switched on yet"', 'Not switched on' not in txt and 'owner' in txt.lower())
        check('no page errors', not J.errs, J.errs)
        await b.close()
    print('FAILS:', fails)
asyncio.run(main())
