# Sketch (Nov 2026): tactics and drill sketches, Save to (set piece, principle, match plan, drill,
# my drills, a session), Recent sketches and Clear all.
from playwright.sync_api import sync_playwright
U = 'http://localhost:8765/'
FAILS = []
def check(label, ok):
    print(('ok   ' if ok else 'FAIL ') + label)
    if not ok: FAILS.append(label)
G = lambda pg, js: pg.evaluate("import('./js/store.js').then(S => (" + js + "))")
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 390, 'height': 844}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(U + '#/home'); pg.wait_for_timeout(900)
    pg.click('#hSketch'); pg.wait_for_timeout(500)
    check('Sketch offers Tactics and Drill', pg.query_selector('#newSketch') is not None and pg.query_selector('#newDrillSketch') is not None)
    # tactics sketch -> set piece
    pg.click('#newSketch'); pg.wait_for_timeout(700)
    bid = pg.url.split('/board/')[1]
    check('a tactics sketch opens with the team and a Save to bar', pg.query_selector('#sketchBar') is not None and len(G(pg, f"S.get('{bid}').frames[0].items.filter(i => i.kind === 'us')")) == 11)
    check('it is not with the saved boards yet', G(pg, f"S.get('{bid}').type") == 'sketch')
    pg.click('#saveToBtn'); pg.wait_for_timeout(300); pg.fill('#svN', 'Corner: back post'); pg.click('[data-to="setpiece"]'); pg.wait_for_timeout(600)
    r = G(pg, f"S.get('{bid}')")
    check('Save to a set piece keeps it as a named set piece on player pages', r['type'] == 'setpiece' and r['name'] == 'Corner: back post' and r['sharePlayers'] and pg.query_selector('#sketchBar') is None)
    # tactics sketch -> principle picture
    pg.goto(U + '#/sketch'); pg.wait_for_timeout(400); pg.click('#newSketch'); pg.wait_for_timeout(600)
    b2 = pg.url.split('/board/')[1]
    pg.click('#saveToBtn'); pg.wait_for_timeout(300); pg.click('[data-to="principle"]'); pg.wait_for_timeout(200); pg.click('[data-pk="pr-1"]'); pg.wait_for_timeout(600)
    check('Save to a principle sets its picture and opens it', G(pg, "S.get('pr-1').boardId") == b2 and '/principle/pr-1' in pg.url)
    # tactics sketch -> match plan
    mid = G(pg, "S.create('match', S.team().id, { opponent: 'Test FC', date: '2027-01-10', boardIds: [], plan: {}, opp: {}, tags: {}, instructions: {}, squadIds: [], result: {} }).id")
    pg.goto(U + '#/sketch'); pg.wait_for_timeout(400); pg.click('#newSketch'); pg.wait_for_timeout(600)
    b3 = pg.url.split('/board/')[1]
    pg.click('#saveToBtn'); pg.wait_for_timeout(300); pg.click('[data-to="match"]'); pg.wait_for_timeout(200); pg.click(f'[data-pk="{mid}"]'); pg.wait_for_timeout(700)
    check('Save to a match plan attaches it and opens the plan’s boards', b3 in G(pg, f"S.get('{mid}').boardIds") and '/match/' in pg.url and pg.query_selector('#boards') is not None)
    # tactics sketch -> drill
    pg.goto(U + '#/sketch'); pg.wait_for_timeout(400); pg.click('#newSketch'); pg.wait_for_timeout(600)
    pg.click('#saveToBtn'); pg.wait_for_timeout(300); pg.fill('#svN', 'Build from the back'); pg.click('[data-to="drill"]'); pg.wait_for_timeout(700)
    d = G(pg, "S.drills().find(d => d.name === 'Build from the back')")
    check('Save to a new drill makes a full-pitch drill with the players', bool(d) and d['area'] == 'full' and len([i for i in d['items'] if i['kind'] in ('att', 'gk')]) == 11)
    # drill sketch -> session
    sid = G(pg, "S.create('session', S.team().id, { date: '2027-01-08', theme: 'Tuesday', blocks: [], principleIds: [] }).id")
    pg.goto(U + '#/sketch'); pg.wait_for_timeout(400); pg.click('#newDrillSketch'); pg.wait_for_timeout(700)
    ds = pg.url.split('/drill/')[1]
    check('a drill sketch opens with no drill check and is not in My drills', pg.query_selector('#sketchBar') is not None and pg.query_selector('#dockBar') is None and G(pg, f"S.drills().some(d => d.id === '{ds}')") is False)
    pg.goto(U + '#/sketch'); pg.wait_for_timeout(400)
    check('Recent sketches lists the drill sketch and the tactics sketch saved as a drill', len(pg.query_selector_all('#sketches .card')) == 2)
    pg.goto(U + '#/drill/' + ds); pg.wait_for_timeout(500)
    pg.click('#saveToBtn'); pg.wait_for_timeout(300); pg.fill('#svN', '6v4 first line'); pg.click(f'[data-s="{sid}"]'); pg.wait_for_timeout(700)
    check('Save into a session keeps it as a drill and adds it to the session', G(pg, f"S.drills().some(d => d.id === '{ds}' && d.name === '6v4 first line')") and G(pg, f"S.get('{sid}').blocks.some(x => x.drillId === '{ds}')"))
    # clear all
    pg.goto(U + '#/sketch'); pg.wait_for_timeout(400)
    n = len(pg.query_selector_all('#sketches .card'))
    pg.click('#clearSketches'); pg.wait_for_timeout(300); pg.click('[data-x="1"]'); pg.wait_for_timeout(500)
    check('Clear all removes the sketches and keeps what was saved', pg.query_selector('#sketches') is None and G(pg, f"!!S.get('{bid}') && !!S.get('{ds}')"))
    pg.screenshot(path='shots/sketch.png', full_page=True)
    check('no page errors', not errs); print('   errors:', errs, '| sketches cleared:', n)
    b.close()
print('FAILS:', FAILS)
