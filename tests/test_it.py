# Test it (Nov 2026): the rules engine and its screens. A four-frame play-out from the back is
# tested against each style; the checks are about behaviour and honesty of the numbers.
import asyncio, re
from playwright.async_api import async_playwright
U = 'http://localhost:8765/'
fails = []
def check(name, ok, extra=''):
    print(('ok   ' if ok else 'FAIL ') + name, extra)
    if not ok: fails.append(name)
MK = """import('./js/store.js').then(async S => { S.setMeta('startHereDone', true); const T = S.team().id;
  const B = await import('./js/views/board.js'); const f0 = B.newBoardFrame(T, S.team().formation, '');
  const us = f0.items.filter(i=>i.kind==='us'); const by = r => us.filter(i=>i.role===r);
  const mv = (f, role, k, x, y) => { const it = f.items.find(i=>i.id===by(role)[k].id); it.x=x; it.y=y; };
  const ball = (f,x,y) => { const b=f.items.find(i=>i.kind==='ball'); b.x=x; b.y=y; };
  const arrow = (f,x1,y1,x2,y2) => f.arrows.push({id:'a'+Math.random(),style:'pass',x1,y1,x2,y2});
  const cl = o => JSON.parse(JSON.stringify(o));
  const f1 = cl(f0); f1.name='Keeper has it'; ball(f1,34,98); arrow(f1,34,98,41,88);
  const f2 = cl(f0); f2.name='Split'; mv(f2,'CB',0,50,92); mv(f2,'CB',1,18,92); mv(f2,'6',0,34,80); mv(f2,'RB',0,62,74); mv(f2,'LB',0,6,74); ball(f2,49,91); arrow(f2,49,91,35,81);
  const f3 = cl(f2); f3.name='Into the 6'; f3.arrows=[]; ball(f3,34,79); arrow(f3,34,79,46,59);
  const f4 = cl(f3); f4.name='Out wide'; f4.arrows=[]; mv(f4,'8',0,47,60); ball(f4,46,59); arrow(f4,46,59,58,40);
  [f1,f2,f3,f4].forEach((f,i)=>f.id='fr'+i);
  const b = S.create('board', T, { name: 'Play out v press', type: 'sketch', sharePlayers:false, frames:[f1,f2,f3,f4] });
  return b.id; })"""
SIM = """async ([id, style, sharp]) => { const S = await import('./js/store.js'); const E = await import('./js/tester.js');
  const b = S.get(id); const R = E.simulate(b, S.playerMap(b.team), { style, sharp, shape: '' });
  const d = (a, c) => Math.hypot(a.x - c.x, a.y - c.y);
  return { findings: R.findings.map(f => ({ type: f.type, sev: f.sev, frames: f.frames, title: f.title, measure: f.measure })),
    pressGap: R.frames.map(F => Math.min(...F.opp.filter(o => !o.gk).map(o => d(o, F.fr.ball)))),
    maxMove: Math.max(0, ...R.frames.slice(1).map((F, k) => Math.max(...F.opp.map((o, i) => d(o, R.frames[k].opp[i]))))),
    sixGap: R.frames.map(F => { const six = F.fr.us.find(p => p.role === '6'); return Math.min(...F.opp.map(o => d(o, six))); }),
    speed: E.SHARP[sharp].speed }; }"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 1280, 'height': 900}, service_workers='block')
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(U + 'index.html'); await pg.wait_for_timeout(700)
        bid = await pg.evaluate(MK)
        hi = await pg.evaluate(SIM, [bid, 'high', 'sharp'])
        check('high press: someone presses the keeper on the goal kick (within 3 m)', hi['pressGap'][0] <= 3, hi['pressGap'])
        check('nobody moves further between frames than Sharp allows (6.3 m/s x 3 s)', hi['maxMove'] <= hi['speed'] * 3 + .01, round(hi['maxMove'], 1))
        check('high press finds serious problems in the play-out', any(f['sev'] == 'serious' for f in hi['findings']), [f['title'] for f in hi['findings']][:3])
        ok = True
        for style in ['high', 'mid', 'man6']:
            for sharp in ['steady', 'sharp', 'ruthless']:
                r = await pg.evaluate(SIM, [bid, style, sharp])
                for f in r['findings']:
                    m = re.search(r'ball takes ([\d.]+) s.*needs ([\d.]+) s', f['measure'])
                    if f['type'] == 'pass' and m and float(m.group(2)) > float(m.group(1)): ok = False; print('   inconsistent:', style, sharp, f)
        check('every pass they get to: the numbers show them arriving before the ball', ok)
        st = await pg.evaluate(SIM, [bid, 'high', 'steady']); ru = await pg.evaluate(SIM, [bid, 'high', 'ruthless'])
        check('Ruthless finds at least as many serious problems as Steady', sum(f['sev'] == 'serious' for f in ru['findings']) >= sum(f['sev'] == 'serious' for f in st['findings']))
        lo = await pg.evaluate(SIM, [bid, 'low', 'sharp'])
        check('low block: no serious problems playing out in our own half', not any(f['sev'] == 'serious' and min(f['frames']) < 3 for f in lo['findings']), [f['title'] for f in lo['findings']])
        mm = await pg.evaluate(SIM, [bid, 'man6', 'sharp'])
        check('man-marking: someone is within 3 m of our 6 in every frame', all(g <= 3 for g in mm['sixGap']), [round(g, 1) for g in mm['sixGap']])
        check('outnumbered counts the keeper on the ball: never "0 v" while we have the ball', not any(f['title'].startswith('Outnumbered around the ball: 0 v') for f in hi['findings']), [f['title'] for f in hi['findings'] if f['type'] == 'out'])
        check('a finding never repeats: the same problem over frames is listed once', len({f['title'] for f in hi['findings']}) == len(hi['findings']))
        # The screens
        await pg.evaluate("""import('./js/store.js').then(async S => { const M = await import('./js/views/match.js'); const T = S.team().id; const m = M.createMatch(T); m.opponent = 'Chester-le-Street'; m.date = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10); m.tags = { press: 'mid block', formation: '4-4-2' }; S.put(m); })""")
        await pg.evaluate(f"location.hash='#/board/{bid}'"); await pg.wait_for_timeout(800)
        check('the board has a Test it button', await pg.locator('#testB').count() == 1)
        await pg.click('#testB'); await pg.wait_for_timeout(400)
        txt = await pg.inner_text('#testSheet')
        check('the sheet offers the next match from its opposition file, first and picked', 'Chester-le-Street' in txt and await pg.locator('input[name="tOpp"]').first.is_checked(), txt[:120])
        check('and the four styles', all(s in txt for s in ['High press', 'Mid-block', 'Low block', 'Man-mark our 6']))
        await pg.click('#tSharp [data-s="ruthless"]'); await pg.click('#tRun'); await pg.wait_for_timeout(1200)
        check('Run opens the test', (await pg.evaluate('location.hash')).startswith('#/test/'))
        check('the header says who it was tested against and how sharp', 'Chester-le-Street' in await pg.inner_text('#topbar') and 'Ruthless' in await pg.inner_text('#topbar'))
        check('their players are on the pitch', await pg.locator('#testPitch .testlayer rect').count() >= 10)
        check('findings are listed with Show me', await pg.locator('.tfind .tshow').count() >= 1)
        check('each finding names the players involved', await pg.locator('.tfind .wchip').count() >= 2)
        nums = await pg.evaluate("[...document.querySelectorAll('#testPitch .testmarks text')].map(t => t.textContent)")
        check('the pitch shows the numbered markers for this frame', any(t.strip().isdigit() for t in nums), nums[:6])
        await pg.locator('.tshow').first.click(); await pg.wait_for_timeout(1200)
        check('Show me focuses one finding', await pg.locator('.tfind.on').count() == 1 and await pg.is_visible('#tFocus'))
        labs = await pg.evaluate("[...document.querySelectorAll('#testPitch .testmarks text')].map(t => t.textContent)")
        check('Show me labels the players involved by number', any('·' in t and t.split(' ·')[0].strip().isdigit() for t in labs) and any(t.startswith('Their ') for t in labs), labs)
        boxes = await pg.evaluate('''[...document.querySelectorAll('#testPitch .testmarks g > rect[rx]')].filter(r => r.nextElementSibling && r.nextElementSibling.tagName === 'text').map(r => { const b = r.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; })''')
        over = any(a[0] < b[2] - 1 and a[2] > b[0] + 1 and a[1] < b[3] - 1 and a[3] > b[1] + 1 for i, a in enumerate(boxes) for b in boxes[i + 1:])
        check('no two labels overlap', boxes and not over, len(boxes))
        await pg.click('[data-act="all"]'); await pg.wait_for_timeout(200)
        await pg.locator('.tans summary').first.click(); await pg.fill('textarea[data-note]', 'Show for the ball earlier'); await pg.wait_for_timeout(900)
        await pg.reload(); await pg.wait_for_timeout(1200)
        check('an answer is kept with the board', await pg.locator('textarea[data-note]').first.input_value() == 'Show for the ball earlier')
        check('the run is recorded on the board', await pg.evaluate(f"import('./js/store.js').then(S => !!S.get('{bid}').lastTest)"))
        await pg.click('#tChange'); await pg.wait_for_timeout(300); await pg.click('input[value="low"]'); await pg.click('#tRun'); await pg.wait_for_timeout(1000)
        check('Change opponent re-runs against the new one', 'Low block' in await pg.inner_text('#topbar'))
        await pg.click('[data-act="help"]'); await pg.wait_for_timeout(400)
        check('the screen has its own help guide', 'red squares' in (await pg.inner_text('body')).lower())
        check('no page errors', not errs, errs)
        await b.close()
    print('FAILS:', fails)
asyncio.run(main())
