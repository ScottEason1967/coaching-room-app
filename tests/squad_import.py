# Squad import (Nov 2026): paste a real list over the example squad.
# Run from tests/ with the app served on 8765.
from playwright.sync_api import sync_playwright
U = 'http://localhost:8765/'
FAILS = []
def check(label, ok):
    print(('ok   ' if ok else 'FAIL ') + label)
    if not ok: FAILS.append(label)
LIST = """1 Elen Valentine
2 Isabelle Moore
3 Hannah Robson
4 Liv Little
5 Jane Harland
6 Brooke Newton
7 Amber Rodgers
8 Faye Dale
9 Sophie Curle
11 Ella Baker
12 Eve Gatens
14 Ebonie Knox
15 Raian Ferido
16 Taylor Donaldson
17 Danielle Nanga
18 Sophie Tierney
19 Marina Boni
21 Kiara Eveleth
23 Nicki Ord
24 Jen Knowles (c)"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 390, 'height': 844}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(U + '#/squad'); pg.wait_for_timeout(900)
    pg.click('[data-act="import"]'); pg.wait_for_timeout(300)
    check('replace-squad box offered and ticked', pg.is_checked('#imR'))
    pg.fill('#imT', LIST); pg.click('#imS'); pg.wait_for_timeout(800)
    ps = pg.evaluate("import('./js/store.js').then(S => S.players(S.team().id).map(p => [p.num, p.name, p.pos]))")
    print('  ', ps)
    check('20 players, no examples left', len(ps) == 20 and not any(n.startswith('Player ') for _, n, _ in ps))
    check('captain mark stripped', any(n == 'Jen Knowles' for _, n, _ in ps))
    check('no made-up positions', all(pos == '' for _, _, pos in ps))
    check('every player has a position dropdown, all blank', len(pg.query_selector_all('#squadList select[data-pos]')) == 20 and all(x == '' for x in pg.eval_on_selector_all('#squadList select[data-pos]', 'els => els.map(e => e.value)')))
    pg.select_option('#squadList select[data-pos] >> nth=0', 'GK'); pg.wait_for_timeout(600)
    check('picking a position in the list saves it', pg.evaluate("import('./js/store.js').then(S => S.players(S.team().id).find(p => p.num === 1).pos)") == 'GK')
    opts = pg.eval_on_selector('#squadList select[data-pos]', 'e => [...e.options].map(o => o.value)')
    check('dropdown offers only the fixed list', opts == ['', 'GK', 'RB', 'CB', 'LB', 'FB', '6', '8', 'CM', '10', 'RW', 'LW', 'W', 'CF'])
    pg.screenshot(path='shots/squad-imported.png')
    nums = sorted(n for n, _, _ in ps)
    check('squad numbers kept', nums == [1,2,3,4,5,6,7,8,9,11,12,14,15,16,17,18,19,21,23,24])
    # parser: line breaks lost on paste, numeric positions at line end, captain mark
    got = pg.evaluate("""import('./js/views/squad.js').then(M => [
      M.parseSquad('1 Elen Valentine 2 Isabelle Moore 24 Jen Knowles (c)'),
      M.parseSquad('6 Brooke Newton 8\\n9 Sophie Curle CF'),
      M.parseSquad('19\\tmarina boni\\r\\n4. Liv Little'), M.parseSquad('7 Jane Smith ST\\n5 Amy Jones RWB')])""")
    print('  ', got)
    check('joined-up list split into players with their numbers', [(r['num'], r['name']) for r in got[0]] == [(1,'Elen Valentine'),(2,'Isabelle Moore'),(24,'Jen Knowles')])
    check('numeric position at end of line kept', got[1][0]['pos'] == '8' and got[1][1] == {'num': 9, 'name': 'Sophie Curle', 'pos': 'CF', 'capt': ''} and got[0][2]['capt'] == 'c')
    check('tabs, CRLF and "4." handled', [(r['num'], r['name']) for r in got[2]] == [(19,'marina boni'),(4,'Liv Little')])
    check('typed positions mapped onto the dropdown list', [r['pos'] for r in got[3]] == ['CF', 'RB'])
    # the mess: one player with the whole list as her name, plus others; replace fixes it
    pg.evaluate("""import('./js/store.js').then(S => { const T = S.team().id; S.players(T).forEach(p => S.del(p.id));
      S.create('player', T, { num: 1, name: 'Elen Valentine 2 Isabelle Moore 3 Hannah Robson', short: '', pos: 'GK', pos2: '', foot: '', notes: '', goals: [], obs: [] });
      S.create('player', T, { num: 40, name: 'Junk', short: '', pos: 'CM', pos2: '', foot: '', notes: '', goals: [], obs: [] }); })""")
    pg.goto(U + '#/squad'); pg.wait_for_timeout(500)
    pg.click('[data-act="import"]'); pg.wait_for_timeout(300)
    pg.fill('#imT', LIST.replace('\n', ' ')); pg.wait_for_timeout(200)
    check('preview counts 20 even with line breaks gone', pg.inner_text('#imP').startswith('20 players found'))
    pg.click('#imS'); pg.wait_for_timeout(500)
    check('asks before removing a real player', 'remove 1 player?' in pg.inner_text('body').lower())
    pg.click('[data-x="1"]'); pg.wait_for_timeout(700)
    ps = pg.evaluate("import('./js/store.js').then(S => S.players(S.team().id).map(p => [p.num, p.name, p.pos]))")
    check('squad replaced cleanly', len(ps) == 20 and sorted(n for n, _, _ in ps) == nums and any(x == [1, 'Elen Valentine', 'GK'] for x in ps))
    pg.goto(U + '#/board'); pg.wait_for_timeout(800)
    pg.goto(U + '#/match'); pg.wait_for_timeout(500)
    check('no page errors', not errs); print('   errors:', errs)
    b.close()
print('FAILS:', FAILS)
