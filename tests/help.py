# Help layer: the ? button, one guide per screen, Show me on every step, and the Start here card.
# Serve the app first:  cd /home/claude/cr && python3 -m http.server 8765 &
# Run from this folder:  PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 help.py
# Prints one line per screen and a FAIL line for anything that does not hold. Ends with `errors` (must be []).
import asyncio, os, socket, subprocess, sys, time
from playwright.async_api import async_playwright
U = 'http://localhost:8765/index.html'
HELPBTN = '[aria-label="How to use this screen"]'
fails = []
def check(label, ok, extra=''):
    print(('ok   ' if ok else 'FAIL ') + label + (' ' + str(extra) if extra != '' else ''))
    if not ok: fails.append(label)

def ensure_server():
    s = socket.socket(); s.settimeout(0.5)
    try: s.connect(('localhost', 8765)); s.close(); return None
    except Exception: pass
    p = subprocess.Popen([sys.executable, '-m', 'http.server', '8765'], cwd=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1); return p

async def go(pg, h):
    await pg.evaluate(f"location.hash='#/{h}'"); await pg.wait_for_timeout(350)

# Create enough data that every conditional control exists: a running block, a session today with a practice and a
# focus player, a past session and a past match with unfinished reviews, a match earlier against the same opponent,
# and an upcoming match with a squad, boards and a session in the week before it.
SEED = """async () => {
  const S = await import('./js/store.js'); const U = await import('./js/util.js'); const R = await import('./js/views/review.js');
  const T = S.team().id; const td = U.today(); const add = n => U.addDays(td, n); const out = {};
  out.team = T;
  const blk = S.create('block', T, { title: 'Help test block', principleIds: ['pr-1'], start: td, weeks: 4, aim: 'x', weeksPlan: ['one', '', '', ''], outcome: '' }); out.block = blk.id;
  const mkSession = (date, extra) => S.create('session', T, { date, time: '19:00', venue: '', length: 90, theme: 'Play out through the 6', principleIds: ['pr-1'], blocks: [{ id: U.uid(), drillId: 'dr-rondo', minutes: 15, talk: 3, note: '' }], injuryPrev: false, addresses: false, addressesHow: '', matchPrep: false, lookFor: 'The 6 shows before the pass', focusIds: ['pl-7'], focusHow: '', staff: '', notes: '', ...extra });
  const past = mkSession(add(-3), {}); out.pastSession = past.id;
  const pastMatchEarlier = S.create('match', T, { opponent: 'Test Town', date: add(-30), ko: '', venue: '', comp: '', src: '', tags: {}, opp: { ip: 'a', op: 'b' }, plan: { keys: 'Win it high', threat: '', first: '', planB: '', subs: '', ip: '', op: '', sp: '', spAgainst: '', selection: '', talk: '', focusIds: [], principleNotes: {} }, instructions: {}, boardIds: [], squadIds: [], result: { us: 1, them: 1 } });
  const played = S.create('match', T, { opponent: 'Test Town', date: add(-1), ko: '', venue: '', comp: '', src: '', tags: {}, opp: {}, plan: { keys: 'Keep it\\nWin second balls', threat: '', first: '', planB: '', subs: '', ip: '', op: '', sp: '', spAgainst: '', selection: '', talk: '', focusIds: ['pr-1'], principleNotes: {} }, instructions: {}, boardIds: ['bd-shape'], squadIds: ['pl-1', 'pl-2', 'pl-3'], result: { us: '', them: '' } }); out.playedMatch = played.id;
  // reviews: started, unfinished. One carries a decision from before.
  R.startReview('session', past); const rs = S.get(past.reviewId); rs.change = 'Play out earlier'; rs.carried = { id: 'x', text: 'Count my stoppages', how: 'Ask a helper' }; S.put(rs); out.sessionReview = rs.id;
  R.startReview('match', played); const rm = S.get(played.reviewId); rm.trained = ['Play out through the 6']; S.put(rm); out.matchReview = rm.id;
  const today_s = mkSession(td, {}); out.todaySession = today_s.id;
  const bare = S.create('session', T, { date: add(40), time: '', venue: '', length: 90, theme: '', principleIds: [], blocks: [], injuryPrev: false, addresses: false, addressesHow: '', matchPrep: false, lookFor: '', focusIds: [], focusHow: '', staff: '', notes: '' }); out.bareSession = bare.id;
  const up = S.create('match', T, { opponent: 'Test Town', date: add(3), ko: '15:00', venue: '', comp: '', src: '', tags: {}, opp: {}, plan: { keys: 'a\\nb', threat: '', first: '', planB: '', subs: '', ip: '', op: '', sp: '', spAgainst: '', selection: '', talk: '', focusIds: ['pr-1'], principleNotes: {} }, instructions: {}, boardIds: ['bd-shape'], squadIds: ['pl-1', 'pl-2', 'pl-3'], result: { us: '', them: '' } }); out.upMatch = up.id;
  location.hash = '#/home';
  return out;
}"""

async def guide(pg, name, params):
    return await pg.evaluate("async ([n, p]) => { const H = await import('./js/help.js'); const g = H.helpFor(n, p); return g ? { title: g.title, purpose: g.purpose, loop: g.loop, steps: g.steps } : null; }", [name, params])

async def check_screen(pg, label, hash_, expect_steps_min=3):
    """? button exists; sheet opens with >= 3 steps; every Show me works from the real sheet."""
    await go(pg, hash_)
    btn = await pg.query_selector(HELPBTN)
    check(f'{label}: ? button exists', btn is not None)
    if not btn: return
    txt = (await btn.inner_text()).strip()
    check(f'{label}: ? button shows "?"', txt == '?', repr(txt))
    await btn.click(); await pg.wait_for_timeout(250)
    n = await pg.locator('#helpSheet ol li').count(); shows = await pg.locator('#helpSheet [data-show]').count()
    title = await pg.inner_text('#helpSheet .h2')
    fit = await pg.evaluate("(() => { const s = document.querySelector('#scrim .sheet'); return s.scrollWidth <= s.clientWidth + 1; })()")
    check(f'{label}: sheet "{title}" opens with >= {expect_steps_min} steps', n >= expect_steps_min, f'({n} steps, {shows} with Show me)')
    check(f'{label}: sheet fits 390 px (no sideways scroll)', fit)
    sheet_text = await pg.inner_text('#helpSheet')
    check(f'{label}: has purpose, loop line and Close', 'Model → Programme' in sheet_text and await pg.locator('#helpX').count() == 1)
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(100)
    bad = []
    for i in range(shows):
        before = await pg.evaluate("location.hash")
        await pg.evaluate("document.querySelectorAll('.flash').forEach(e => e.classList.remove('flash'))")
        await pg.click(HELPBTN); await pg.wait_for_timeout(120)
        btns = pg.locator('#helpSheet [data-show]')
        step_no = await btns.nth(i).get_attribute('aria-label')
        await btns.nth(i).click(); await pg.wait_for_timeout(120)
        sheet_gone = await pg.locator('#scrim').count() == 0
        info = await pg.evaluate("""() => { const f = [...document.querySelectorAll('.flash')]; return { n: f.length, vis: f.some(e => e.getClientRects().length > 0), tag: f[0] ? f[0].tagName : '', hash: location.hash, blue: document.body.classList.contains('helpflash') }; }""")
        routeish = info['hash'] != before
        if not sheet_gone: bad.append(f'{step_no}: sheet still open')
        elif routeish: pass  # a hash-route step navigated
        elif info['n'] == 0: bad.append(f'{step_no}: nothing flashed')
        elif not info['vis']: bad.append(f'{step_no}: flashed element not visible')
        elif info['tag'] in ('INPUT', 'TEXTAREA', 'SELECT'):
            await pg.wait_for_timeout(450)
            if not await pg.evaluate("(() => { const f = document.querySelector('.flash'); return !!f && document.activeElement === f; })()"): bad.append(f'{step_no}: input not focused')
        if routeish: await go(pg, hash_)
        await pg.wait_for_timeout(60)
    check(f'{label}: Show me works on all {shows} steps that have it', not bad, bad if bad else '')
    return {'steps': n, 'shows': shows, 'title': title}

async def main():
    srv = ensure_server()
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True, service_workers='block')
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)

        # ---------- Start here (first run)
        await pg.goto(U); await pg.wait_for_timeout(700)
        sh = pg.locator('#startHere')
        check('Start here shows on first run', await sh.count() == 1 and await sh.is_visible())
        await pg.screenshot(path='shots/help-starthere.png')
        txt = await sh.inner_text()
        check('Start here: has the set-up links, the loop, the ? hint', all(x in txt for x in ['Rewrite the three principles', 'Paste your squad', 'Plan your first block', 'Sign in for sync', 'Add to Home Screen', 'Plan the session from the block', 'Review the match on Monday', 'Every screen has a ?']))
        links = await sh.evaluate("e => [...e.querySelectorAll('a')].map(a => a.getAttribute('href'))")
        check('Start here: links go to model, squad, programme, cloud', links == ['#/model', '#/squad', '#/plans/programme', '#/cloud'], links)
        first = await pg.evaluate("document.querySelector('#view').firstElementChild.id")
        check('Start here is the first thing on Home', first == 'startHere', first)
        # Home guide while the card is open: its Start here step must work
        r = await check_screen(pg, 'home (card open)', 'home')
        await pg.click('#startHere [data-act="startDone"]'); await pg.wait_for_timeout(300)
        check('Got it hides the card', await pg.locator('#startHere').count() == 0)
        await pg.reload(); await pg.wait_for_timeout(600)
        check('card stays hidden after reload', await pg.locator('#startHere').count() == 0)
        check('flag is saved', await pg.evaluate("(async () => (await import('./js/store.js')).meta().startHereDone === true)()"))
        await go(pg, 'more')
        sh_btn = pg.locator('[data-act="startHere"]')
        check('More has a Start here item', await sh_btn.count() == 1 and 'Start here' in await sh_btn.inner_text())
        await sh_btn.click(); await pg.wait_for_timeout(500)
        check('More > Start here goes Home and brings the card back', await pg.evaluate("location.hash") == '#/home' and await pg.locator('#startHere').count() == 1)
        await pg.click('#startHere [data-act="startDone"]'); await pg.wait_for_timeout(300)

        # ---------- data for the rest
        ids = await pg.evaluate(SEED); await pg.wait_for_timeout(400)
        T = ids['team']
        none = await pg.evaluate("(async () => { const H = await import('./js/help.js'); return [H.helpFor('nonsense', []), H.helpFor('drills', []) && H.helpFor('drills', []).title]; })()")
        check('no guide for an unknown route; "drills" alias gives the drills guide', none[0] is None and none[1] == 'Plans: Drills', none)

        # ---------- every screen
        SCREENS = [
            ('home', 'home'), ('model', 'model'), ('principle', 'principle/pr-1'), ('boards', 'boards'), ('board', 'board/bd-shape'),
            ('plans: sessions', 'plans/sessions'), ('plans: matches', 'plans/matches'), ('plans: reviews', 'plans/reviews'), ('plans: programme', 'plans/programme'), ('plans: drills', 'plans/drills'),
            ('block', 'block/' + ids['block']), ('drill', 'drill/dr-rondo'), ('session (today)', 'session/' + ids['todaySession']), ('session (past, reviewed)', 'session/' + ids['pastSession']), ('session (empty)', 'session/' + ids['bareSession']),
            ('match (example)', 'match/mt-cls'), ('match (upcoming)', 'match/' + ids['upMatch']), ('match (played)', 'match/' + ids['playedMatch']),
            ('review (session)', 'review/' + ids['sessionReview']), ('review (match)', 'review/' + ids['matchReview']),
            ('squad', 'squad'), ('player', 'player/pl-7'), ('pathway', 'pathway'), ('logbook', 'logbook'), ('teams', 'teams'), ('team', 'team/' + T), ('team (new)', 'team/new'), ('cloud', 'cloud'), ('more', 'more')
        ]
        summary = []
        for label, h in SCREENS:
            if label == 'match (upcoming)' or label == 'match (played)' or label == 'match (example)':
                await go(pg, h); await pg.evaluate("(async () => (await import('./js/store.js')).setMeta('matchTab', 'them'))()")
            r = await check_screen(pg, label, h)
            if r: summary.append((label, r['steps'], r['shows']))

        # the match: every tab's controls exist once the tab is switched to (resolve each show on its own tab)
        for mlabel, mid in [('upcoming', ids['upMatch']), ('played', ids['playedMatch'])]:
            g = await guide(pg, 'match', [mid])
            miss = []
            for s in g['steps']:
                if not s.get('show'): continue
                tab = s.get('tab')
                await go(pg, 'match/' + mid)
                if tab:
                    await pg.evaluate("(t) => import('./js/store.js').then(S => S.setMeta('matchTab', t))", tab)
                    await pg.evaluate("location.reload()"); await pg.wait_for_timeout(600)
                ok = await pg.evaluate("async (s) => { const H = await import('./js/help.js'); return !!H.findShown(s, document); }", s['show'])
                if not ok: miss.append((tab, s['show']))
            check(f'match ({mlabel}): every Show me selector resolves on its own tab', not miss, miss if miss else f'({sum(1 for s in g["steps"] if s.get("show"))} selectors over {len({s.get("tab") for s in g["steps"] if s.get("tab")})} tabs)')
        # a tab step from the wrong tab switches tab first
        await go(pg, 'match/' + ids['upMatch']); await pg.evaluate("import('./js/store.js').then(S => S.setMeta('matchTab', 'them'))"); await pg.reload(); await pg.wait_for_timeout(600)
        await pg.click(HELPBTN); await pg.wait_for_timeout(200)
        g = await guide(pg, 'match', [ids['upMatch']]); target = next(s for s in g['steps'] if s.get('tab') == 'day' and s.get('show') == '[data-act="players"]')
        k = [s for s in g['steps'] if s.get('show')].index(target)
        await pg.locator('#helpSheet [data-show]').nth(k).click(); await pg.wait_for_timeout(500)
        check('match: Show me on a Day step from the Them tab switches to Day and flashes it', await pg.evaluate("document.querySelector('[role=tab][aria-selected=true]').textContent.trim() === 'Day' && document.querySelector('[data-act=players]').classList.contains('flash')"))

        # board guide walks frame by frame with the real controls
        g = await guide(pg, 'board', [])
        txt = ' '.join(s['text'] for s in g['steps']); shows = [s.get('show') for s in g['steps']]
        check('board guide names Next frame, Play, Frame, Zoom, Shapes, Image, Print, Link', all(w in txt for w in ['Next frame', '**Play**', '**Frame**', '**Zoom**', '**Shapes**', '**Image**', '**Print**', '**Link**']))
        check('board guide points at addFrame, play, frameMenu, #fT and the tools', all(x in shows for x in ['[data-act="addFrame"]', '[data-act="play"]', '[data-act="frameMenu"]', '#fT', '[data-tool="select"]', '[data-tool="arrow:pass"]']))
        tools = await pg.evaluate("(async () => { await new Promise(r => setTimeout(r, 0)); location.hash = '#/board/bd-shape'; await new Promise(r => setTimeout(r, 500)); return [...document.querySelectorAll('[data-tool]')].map(b => b.dataset.tool + '=' + b.textContent.trim()); })()")
        print('board tools on screen:', tools)

        # topbar: ? sits in the right-hand group beside the dot and the avatar, within 390 px
        await go(pg, 'home')
        box = await pg.evaluate("(() => { const k = [...document.querySelectorAll('#topbar .row.nowrap > *')].map(e => { const r = e.getBoundingClientRect(); return [e.getAttribute('aria-label') || e.tagName, Math.round(r.left), Math.round(r.right), Math.round(r.width), Math.round(r.height)]; }); return k; })()")
        print('top bar right group [label, left, right, w, h]:', box)
        check('top bar: ?, dot and avatar all inside 390 px', all(x[2] <= 390 for x in box) and len(box) == 3)
        await pg.screenshot(path='shots/help-home.png')
        await pg.click(HELPBTN); await pg.wait_for_timeout(250); await pg.screenshot(path='shots/help-sheet-home.png')
        await pg.keyboard.press('Escape')
        await go(pg, 'match/' + ids['upMatch']); await pg.click(HELPBTN); await pg.wait_for_timeout(250); await pg.screenshot(path='shots/help-sheet-match.png', full_page=False)

        print('\nguides (screen: steps, with Show me):')
        for l, a, c in summary: print(f'  {l}: {a}, {c}')
        print('\nFAILS:', fails)
        print('errors', errs)
        await b.close()
    if srv: srv.terminate()
asyncio.run(main())
