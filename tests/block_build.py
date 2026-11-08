# Building a training block from the top (Nov 2026): add sessions to each week, from scratch, from a
# template, or by moving one in; add drills to a session from the block page.
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
    pg.goto(U + '#/training/programme'); pg.wait_for_timeout(900)
    pg.click('#newBlock'); pg.wait_for_timeout(600)
    bid = pg.url.split('/block/')[1]
    pg.fill('[data-f="title"]', 'Play through a high press'); pg.click('[data-act="pr"][data-arg="pr-1"]'); pg.wait_for_timeout(500)
    check('each week has New session, From a template and Move one here', len(pg.query_selector_all('[data-act="newS"]')) == 4 and len(pg.query_selector_all('[data-act="tplS"]')) == 4 and len(pg.query_selector_all('[data-act="moveS"]')) == 4)
    # new session in week 2
    pg.click('[data-act="newS"][data-arg="1"]'); pg.wait_for_timeout(700)
    s = G(pg, "S.sessions(S.team().id)[0]"); blk = G(pg, f"S.get('{bid}')")
    wk = G(pg, f"S.weekOf(S.get('{bid}'), '{s['date']}')")
    check('New session lands in week 2 on the block’s principles', wk == 2 and 'pr-1' in s['principleIds'])
    # template session into week 3
    pg.goto(U + '#/block/' + bid); pg.wait_for_timeout(500)
    pg.click('[data-act="tplS"][data-arg="2"]'); pg.wait_for_timeout(600)
    check('template list says which week it goes into', 'week 3' in pg.inner_text('#view'))
    pg.click('#ideaSessions .card >> nth=0'); pg.wait_for_timeout(500); pg.click('#useS'); pg.wait_for_timeout(900)
    s2 = G(pg, "S.sessions(S.team().id).find(s => s.fromTemplate)")
    check('template session lands in week 3 with its drills', bool(s2) and G(pg, f"S.weekOf(S.get('{bid}'), '{s2['date']}')") == 3 and len(s2['blocks']) >= 3)
    # drills shown and added from the block page
    pg.goto(U + '#/block/' + bid); pg.wait_for_timeout(500)
    check('block page lists the template session’s drills', s2['theme'] and len(pg.query_selector_all('[data-act="addDrill"]')) == 2)
    pg.click(f'[data-act="addDrill"][data-arg="{s["id"]}"]'); pg.wait_for_timeout(400)
    pg.click('#pdl [data-d] >> nth=0'); pg.wait_for_timeout(600)
    check('Drill on a session adds a drill to it', len(G(pg, f"S.get('{s['id']}').blocks")) == 1)
    # move a session from outside the block into week 4
    G(pg, "(() => { const t = S.team().id; const x = S.create('session', t, { date: '2027-06-01', theme: 'Loose one', principleIds: [], blocks: [] }); return x.id; })()")
    pg.goto(U + '#/block/' + bid); pg.wait_for_timeout(500)
    pg.click('[data-act="moveS"][data-arg="3"]'); pg.wait_for_timeout(400)
    pg.click('.sheet [data-s] >> text=Loose one'); pg.wait_for_timeout(600)
    lo = G(pg, "S.sessions(S.team().id).find(s => s.theme === 'Loose one')")
    check('Move one here puts it in week 4 and on the block’s principles', G(pg, f"S.weekOf(S.get('{bid}'), '{lo['date']}')") == 4 and 'pr-1' in lo['principleIds'])
    pg.screenshot(path='shots/block-build.png', full_page=True)
    # Training > Sessions template picker isn't tied to the block any more
    pg.goto(U + '#/training/sessions'); pg.wait_for_timeout(400); pg.click('#pickSession'); pg.wait_for_timeout(500)
    check('template from Training is not tied to a block week', 'week ' not in pg.inner_text('#view').lower().split('whole sessions')[0])
    check('no page errors', not errs); print('   errors:', errs)
    b.close()
print('FAILS:', FAILS)
