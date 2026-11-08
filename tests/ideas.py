# Practice ideas (Nov 2026): template library, theme link to principles, add to drills and sessions.
# Run from tests/ with the app served on 8765.
import json
from playwright.sync_api import sync_playwright
U = 'http://localhost:8765/'
FAILS = []
def check(label, ok):
    print(('ok   ' if ok else 'FAIL ') + label)
    if not ok: FAILS.append(label)
G = lambda pg, js: pg.evaluate("import('./js/store.js').then(S => (" + js + "))")
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 390, 'height': 844}, has_touch=True); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(U + '#/home'); pg.wait_for_timeout(1000)
    # every template draws, stays inside its area, and has the fields a drill needs
    bad = pg.evaluate("""import('./js/templates.js').then(T => T.DRILL_TEMPLATES.flatMap(t => {
      const out = []; const its = t.items();
      ['name','type','objective','org','how','points','src'].forEach(k => { if (!t[k]) out.push(t.id + ' missing ' + k); });
      if (!t.src.url) out.push(t.id + ' no source link');
      its.forEach(i => { if (i.x < -1.6 || i.y < -1.6 || i.x > t.w + 1.6 || i.y > t.h + 1.6) out.push(t.id + ' item off the area ' + i.kind + ' ' + i.x + ',' + i.y); });
      const ids = new Set(its.map(i => i.id)); if (ids.size !== its.length) out.push(t.id + ' duplicate item ids');
      return out; }))""")
    print('   template problems:', bad[:8])
    check('every practice template is complete and its diagram fits', not bad)
    sbad = pg.evaluate("import('./js/templates.js').then(T => T.SESSION_TEMPLATES.flatMap(s => s.parts.filter(id => !T.tplById(id)).map(id => s.id + ' -> ' + id)))")
    check('every session template points at real practices', not sbad)
    n = pg.evaluate("import('./js/templates.js').then(T => [T.DRILL_TEMPLATES.length, T.SESSION_TEMPLATES.length, T.THEME_KEYS.filter(k => !T.DRILL_TEMPLATES.some(t => !t.general && t.themes.includes(k))).join(',')])")
    print('   practices, sessions, themes with no practice:', n)
    # starter principles get a sensible guess
    guesses = pg.evaluate("Promise.all([import('./js/store.js'), import('./js/templates.js')]).then(([S, T]) => S.principles(S.team().id).map(p => [p.title, T.themeOf(p)]))")
    print('   theme guesses:', guesses)
    check('starter principle “Play out from the back” guessed as build-up', any(t == 'Play out from the back' and g == 'build' for t, g in guesses))
    # Drills tab entry, ideas list, filter by principle
    pg.goto(U + '#/plans/drills'); pg.wait_for_timeout(600)
    check('Drills tab shows Practice ideas', pg.query_selector('#ideasCard') is not None)
    pg.click('#ideasCard'); pg.wait_for_timeout(600)
    allN = len(pg.query_selector_all('#ideaDrills .card'))
    pg.click('#ideaFilter [data-act="pick"] >> nth=0'); pg.wait_for_timeout(600)
    print('   url after picking a principle:', pg.url.split('#')[1], '| practices:', allN, '->', len(pg.query_selector_all('#ideaDrills .card')))
    check('picking a principle filters the list', 0 < len(pg.query_selector_all('#ideaDrills .card')) < allN)
    pg.screenshot(path='shots/ideas-list.png', full_page=False)
    # open a practice and add it
    pg.click('#ideaDrills .card >> nth=0'); pg.wait_for_timeout(600)
    pg.screenshot(path='shots/idea-detail.png', full_page=True)
    check('detail shows source link', pg.query_selector('#ideaSrc a[href^="https://"]') is not None)
    pg.click('#addD'); pg.wait_for_timeout(800)
    d = G(pg, "S.drills().find(d => d.tplId)")
    check('Add to my drills creates a drill from the template', bool(d) and len(d['items']) > 3 and d['src']['who'])
    check('new drill is linked to the matching principle', bool(d) and len((d.get('links') or {}).get('t-thornaby', [])) > 0)
    check('drill page shows the credit', pg.query_selector('#drillSrc') is not None)
    pg.screenshot(path='shots/idea-drill.png')
    # adding again doesn't duplicate
    pg.go_back(); pg.wait_for_timeout(500); pg.click('#addD'); pg.wait_for_timeout(600)
    check('adding twice reuses the same drill', G(pg, "S.drills().filter(d => d.tplId).length") == 1)
    # whole session from an idea
    pg.goto(U + '#/idea/s-press'); pg.wait_for_timeout(600)
    pg.click('#useS'); pg.wait_for_timeout(1200)
    if pg.query_selector('.sheet'): print('   a sheet opened (review gate?):', pg.inner_text('.sheet')[:120].replace('\n',' | '))
    s = G(pg, "S.sessions(S.team().id).find(s => s.fromTemplate === 's-press')")
    check('Plan a session from this creates a session with 4 practices', bool(s) and len(s['blocks']) == 4)
    pg.screenshot(path='shots/idea-session.png')
    # from a session's Add a practice
    if s:
        pg.goto(U + '#/session/' + s['id']); pg.wait_for_timeout(600)
        pg.click('[data-act="add"]'); pg.wait_for_timeout(400)
        check('Add a practice offers practice ideas', pg.query_selector('#pdIdeas') is not None)
        pg.click('#pdIdeas'); pg.wait_for_timeout(700)
        print('   url:', pg.url.split('#')[1])
        pg.click('[data-act="theme"][data-arg="counterpress"]'); pg.wait_for_timeout(500)
        check('theme chip filters in place and keeps the session', '/ideas/s/' in pg.url and 'Counter-pressing' in pg.inner_text('#view'))
        pg.click('#ideaDrills .card >> nth=0'); pg.wait_for_timeout(500)
        pg.click('#addS'); pg.wait_for_timeout(800)
        s2 = G(pg, "S.get('" + s['id'] + "')")
        check('Add to this session adds a fifth practice and returns to the session', len(s2['blocks']) == 5 and '/session/' in pg.url)
    # principle theme field
    pg.goto(U + '#/principle/pr-3'); pg.wait_for_timeout(600)
    check('principle shows the theme field', pg.query_selector('#thSel') is not None)
    pg.select_option('#thSel', 'progress'); pg.wait_for_timeout(700)
    check('choosing a theme saves and shows the ideas link', G(pg, "S.get('pr-3').theme") == 'progress' and pg.query_selector('#ideasFor') is not None)
    pg.click('#ideasFor'); pg.wait_for_timeout(600)
    check('ideas link opens filtered by that principle', 'Breaking lines' in pg.inner_text('#view'))
    print('errors', errs); print('FAILS:', FAILS); b.close()
