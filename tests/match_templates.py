# Match day templates (Nov 2026): reachable from Match, a match plan's overview, Opposition and On the day;
# using one fills only empty parts; starting a match from one makes a match with it filled in; print shows them.
from playwright.sync_api import sync_playwright
U = 'http://localhost:8765/index.html'
fails = []
def check(name, ok, extra=''):
    print(('ok   ' if ok else 'FAIL ') + name, extra)
    if not ok: fails.append(name)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(U); pg.wait_for_timeout(700)
    pg.evaluate("import('./js/store.js').then(S=>S.setMeta('startHereDone',true))")
    pg.evaluate("location.hash='#/matches'"); pg.wait_for_timeout(400)
    check('Match offers New match and Pick a template', pg.locator('#newMatch').count() == 1 and pg.locator('#pickMatchTpl').count() == 1)
    pg.click('#pickMatchTpl'); pg.wait_for_timeout(400)
    n = pg.locator('[data-act=use]').count()
    check('seven templates, each with a source link', n == 7 and pg.locator('[data-tpl] a[href^="https://"]').count() == 7, n)
    pg.click('[data-act=use][data-arg=mt-belles-day]'); pg.wait_for_timeout(700)
    mid = pg.evaluate('location.hash').split('/')[-1]
    m = pg.evaluate(f"import('./js/store.js').then(S=>S.get('{mid}'))")
    check('Start a match with this makes a match and fills the day', pg.evaluate('location.hash').startswith('#/match/') and 'KO −90' in m['plan']['timeline'] and 'Players speak first' in m['plan']['halftime'])
    check('opens on On the day, with the timeline showing', pg.locator('[data-f="plan.timeline"]').count() == 1)
    # write my own half-time plan, then use the England process: mine is kept, staff roles filled... already filled by Belles, so kept too
    pg.evaluate(f"""import('./js/store.js').then(S=>{{const m=S.get('{mid}');m.plan.halftime='MY OWN';m.plan.staffRoles='';S.put(m);}})""")
    pg.evaluate(f"location.hash='#/mtemplates/{mid}'"); pg.wait_for_timeout(400)
    check('inside a match the button says Use on this match, and marks the used one', 'Use on this match' in pg.inner_text('[data-act=use][data-arg=mt-england-ht]') and pg.locator('[data-tpl=mt-belles-day] .pill.good').count() == 1)
    pg.click('[data-act=use][data-arg=mt-england-ht]'); pg.wait_for_timeout(600)
    m = pg.evaluate(f"import('./js/store.js').then(S=>S.get('{mid}'))")
    check('using a template never overwrites what you wrote', m['plan']['halftime'] == 'MY OWN')
    check('it fills the parts still empty', 'Stays with the players at half-time' in m['plan']['staffRoles'])
    check('the message says what was added and what was kept', 'Kept what you’d written in Half-time plan' in pg.inner_text('.toast') and 'Added to Staff roles' in pg.inner_text('.toast'), pg.inner_text('.toast'))
    pg.evaluate(f"import('./js/store.js').then(S=>S.setMeta('matchTab','over'))"); pg.evaluate(f"location.hash='#/home'"); pg.wait_for_timeout(200); pg.evaluate(f"location.hash='#/match/{mid}'"); pg.wait_for_timeout(500)
    check('the match day plan overview has Pick a template', pg.locator('#matchTpl').count() == 1)
    pg.click('#matchPart button:nth-child(1)'); pg.wait_for_timeout(400)
    check('the Opposition has Pick a template', pg.locator('#oppTpl').count() == 1)
    pg.click('#oppTpl'); pg.wait_for_timeout(400); pg.click('[data-act=use][data-arg=mt-opp-pack]'); pg.wait_for_timeout(600)
    m = pg.evaluate(f"import('./js/store.js').then(S=>S.get('{mid}'))")
    check('opposition pack fills threats, unit jobs and the source line', 'Main threat 1' in m['opp']['people'] and 'Goalkeeper' in m['plan']['units'] and 'League position' in m['src'])
    check('and opens the Opposition', pg.locator('[data-f="opp.people"]').count() == 1)
    html = pg.evaluate(f"import('./js/print.js').then(P=>import('./js/store.js').then(S=>P.matchHtml(S.get('{mid}'))))")
    check('print includes On the day and unit jobs', 'On the day' in html and 'Unit jobs' in html and 'KO −90' in html)
    check('no page errors', not errs, errs)
    b.close()
print('FAILS:', fails)
