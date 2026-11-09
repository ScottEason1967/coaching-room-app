# Templates on every planning screen (Nov 2026): Programme, a block's weeks, Sessions, an empty session,
# a session with practices, and Drills all offer a way into the library. Block templates make a block
# with four sessions of practices that get more game-like week by week.
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
    pg.evaluate("location.hash='#/training/programme'"); pg.wait_for_timeout(400)
    check('Programme offers Create your own and Pick a template', pg.locator('#newBlock').count() == 1 and pg.locator('#pickBlock').count() == 1)
    pg.click('#pickBlock'); pg.wait_for_timeout(400)
    check('block templates: one per theme (15)', pg.locator('[data-act=useB]').count() == 15)
    pg.click('[data-act=useB][data-arg=build]'); pg.wait_for_timeout(800)
    info = pg.evaluate("""async()=>{const S=await import('./js/store.js');const T=S.team().id;const b=S.blocks(T)[0];
      const R={'Warm-up':0,'Technical (unopposed)':1,'Skill (opposed)':2,'Functional':3,'Set piece':3,'Small-sided game':4,'Phase of play':5,'Game (11v11)':6};
      const ss=S.blockSessions(T,b).sort((x,y)=>x.date.localeCompare(y.date));
      return {hash:location.hash, weeks:b.weeks, plans:b.weeksPlan.filter(Boolean).length, n:ss.length, per:ss.map(s=>s.blocks.length),
        weekOf:ss.map(s=>S.weekOf(b,s.date)), rank:ss.map(s=>Math.max(...s.blocks.map(x=>R[S.get(x.drillId).type]??4))),
        credited:ss.every(s=>s.blocks.every(x=>!!S.get(x.drillId).src))}}""")
    check('Plan this block opens the new block', info['hash'].startswith('#/block/'))
    check('block has 4 weeks, each with what it adds', info['weeks'] == 4 and info['plans'] == 4)
    check('four sessions, one in each week', info['n'] == 4 and info['weekOf'] == [1, 2, 3, 4], info['weekOf'])
    check('three practices in each session', info['per'] == [3, 3, 3, 3], info['per'])
    check('practices get more game-like (never less) week by week', info['rank'] == sorted(info['rank']), info['rank'])
    check('every practice keeps its credit', info['credited'])
    check('block weeks offer Create a session and Pick a template', pg.locator('[data-act=newS]').count() == 4 and pg.locator('[data-act=tplS]').count() == 4)
    pg.click('[data-act=newS][data-arg="0"]'); pg.wait_for_timeout(600)
    check('empty session offers Create your own and Pick a template', pg.locator('.bigpick[data-act=add]').count() == 1 and pg.locator('#sessTpl').count() == 1)
    sid = pg.evaluate('location.hash').split('/')[-1]
    pg.click('#sessTpl'); pg.wait_for_timeout(400)
    check('Pick a template opens the library for this session', pg.evaluate('location.hash') == '#/ideas/s/' + sid)
    first = pg.evaluate("import('./js/store.js').then(S=>{const T=S.team().id;return S.blockSessions(T,S.blocks(T)[0]).find(s=>s.blocks.length).id})")
    pg.evaluate(f"location.hash='#/session/{first}'"); pg.wait_for_timeout(500)
    check('a session with practices still offers Pick from templates', pg.locator('#sessTpl').count() == 1 and pg.locator('[data-act=add]').count() == 1)
    pg.evaluate("location.hash='#/training/sessions'"); pg.wait_for_timeout(400)
    check('Sessions offers Create your own and Pick a template', pg.locator('#newSession').count() == 1 and pg.locator('#pickSession').count() == 1)
    pg.evaluate("location.hash='#/training/drills'"); pg.wait_for_timeout(400)
    check('Drills offers Create your own and Pick from the library', pg.locator('#newDrill').count() == 1 and pg.locator('#pickDrill').count() == 1)
    check('no page errors', not errs, errs)
    b.close()
print('FAILS:', fails)
