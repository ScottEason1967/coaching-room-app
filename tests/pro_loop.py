# The Pro-level loop end to end, at phone size:
# identity + principle detail -> block -> session in the block with a focus player and "looking for"
# -> match with plan B, focus principles, opponent file -> review with follow-ups -> next session shows the loop closed.
import asyncio, datetime
from playwright.async_api import async_playwright
U='http://localhost:8765/index.html'
D=lambda n: (datetime.date.today()+datetime.timedelta(days=n)).isoformat()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,service_workers='block')
        pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e))); pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
        txt=lambda sel='#view': pg.inner_text(sel)
        async def chal(): return (await pg.inner_text('#chal')).replace('\n',' | ')
        # --- model: identity, trigger, tags, picture
        await pg.goto(U+'#/model'); await pg.wait_for_timeout(700); await pg.evaluate("import('./tests/fixtures.js').then(F => F.examples())"); await pg.wait_for_timeout(400)
        print('model check before:', (await chal())[:140])
        await pg.fill('[data-f="identity"]','We keep the ball and play through the thirds; we never kick it long by default.'); await pg.wait_for_timeout(600)
        await pg.goto(U+'#/principle/pr-1'); await pg.wait_for_timeout(300)
        await pg.fill('[data-f="trigger"]','Keeper has it in her hands, their front two are split'); await pg.fill('[data-f="ifNot"]','Go long to the 9, 8s squeeze for the second ball')
        await pg.click('[data-act="pop"][data-arg="sup"]'); await pg.wait_for_timeout(200); await pg.click('[data-act="pop"][data-arg="pen"]'); await pg.wait_for_timeout(200)
        await pg.select_option('[data-f="boardId"]','bd-shape'); await pg.wait_for_timeout(600)
        await pg.click('[data-act="status"][data-arg="agreed"]'); await pg.wait_for_timeout(300)
        await pg.goto(U+'#/model'); await pg.wait_for_timeout(300)
        t=await txt(); print('model list shows trigger + tags:', 'KEEPER HAS IT' in t.upper(), 'Support' in t)
        # --- programme: block of 4 weeks on pr-1 starting today
        await pg.goto(U+'#/plans/programme'); await pg.wait_for_timeout(300); await pg.click('[data-act="newB"]'); await pg.wait_for_timeout(400)
        bid=(await pg.evaluate('location.hash')).split('/')[-1]
        await pg.fill('[data-f="title"]','Play out against a two-player press'); await pg.click('[data-act="pr"][data-arg="pr-1"]'); await pg.wait_for_timeout(300)
        await pg.fill('[data-f="weeksPlan.0"]','Shape unopposed, the picture'); await pg.fill('[data-f="weeksPlan.1"]','Opposed 7v5, triggers'); await pg.wait_for_timeout(600)
        await pg.goto(U+'#/home'); await pg.wait_for_timeout(300); t=await txt(); print('home shows block:', '1/4' in t, 'Shape unopposed' in t)
        # --- session this week: created inside the block, inherits its principle
        await pg.goto(U+'#/plans/sessions'); await pg.wait_for_timeout(300); await pg.click('[data-act="newS"]'); await pg.wait_for_timeout(400)
        sid=(await pg.evaluate('location.hash')).split('/')[-1]
        t=await txt(); print('session shows block + week:', 'WEEK 1 OF 4' in t.upper(), '| principle pre-selected:', await pg.evaluate("document.querySelector('[data-act=pr][data-arg=\"pr-1\"]').classList.contains('on')"))
        await pg.evaluate("document.querySelectorAll('#sessDetails,#matchDetails').forEach(d=>d.open=true)"); await pg.fill('[data-f="theme"]','Playing out v two'); await pg.evaluate("document.querySelectorAll('#sessDetails,#matchDetails').forEach(d=>d.open=true)"); await pg.fill('[data-f="date"]',D(1)); await pg.wait_for_timeout(500)
        await pg.fill('[data-f="lookFor"]','CBs split on the keeper first touch; 6 shows before the pass')
        # focus player: give pl-6 a goal first, then pick her
        await pg.evaluate("""(async()=>{const S=await import('./js/store.js');const p=S.get('pl-6');p.goals=[{id:'g1',text:'Show early for the CB',status:'on',how:''}];S.put(p);})()""")
        await pg.wait_for_timeout(600); await pg.goto(U+'#/home'); await pg.wait_for_timeout(200); await pg.goto(U+'#/session/'+sid); await pg.wait_for_timeout(400)
        await pg.evaluate("document.querySelector('details[data-fold=focus]').open=true"); await pg.click('[data-act="focus"][data-arg="pl-6"]'); await pg.wait_for_timeout(300)
        await pg.fill('[data-f="focusHow"]','Watch her first movement; ask where the CB wants her'); await pg.wait_for_timeout(500)
        await pg.click('[data-act="add"]'); await pg.wait_for_timeout(300); await pg.click('[data-d="dr-rondo"]'); await pg.wait_for_timeout(400)
        c=await chal(); print('session check mentions focus/lookFor still?', 'looking for tonight' in c, '| focus ask:', 'coaching tonight' in c, '| arc/transition rules present:', 'game-like' in c or 'looks like the game' in c)
        # --- drill: new fields
        await pg.goto(U+'#/drill/dr-rondo'); await pg.wait_for_timeout(300)
        c=await chal(); print('drill check asks direction/transition/questions/success:', all(k in c for k in ['direction','Transition','questions','success']))
        await pg.select_option('[data-f="direction"]','non'); await pg.fill('[data-f="transition"]','Defender who wins it dribbles out; attackers 5 s to win it back'); await pg.fill('[data-f="questions"]','Where is the space when she steps in?'); await pg.fill('[data-f="stepIn"]','same player loses it twice'); await pg.fill('[data-f="success"]','10 passes without losing it, twice'); await pg.wait_for_timeout(600)
        c=await chal(); print('after filling: transition/questions asks gone:', 'Transition:' not in c and 'Planned questions' not in c)
        # --- match on Sunday with plan B etc.
        await pg.goto(U+'#/plans/matches'); await pg.wait_for_timeout(300); await pg.click('[data-act="newM"]'); await pg.wait_for_timeout(400)
        mid=(await pg.evaluate('location.hash')).split('/')[-1]
        await pg.evaluate("document.querySelectorAll('#sessDetails,#matchDetails').forEach(d=>d.open=true)"); await pg.fill('[data-f="opponent"]','Chester-le-Street'); await pg.evaluate("document.querySelectorAll('#sessDetails,#matchDetails').forEach(d=>d.open=true)"); await pg.fill('[data-f="date"]',D(2)); await pg.wait_for_timeout(500)
        t=await txt(); print('opponent file shown (example match is undated so should NOT appear):', 'OPPONENT FILE' in t.upper())
        await pg.select_option('[data-f="tags.press"]','high organised press'); await pg.fill('[data-f="opp.ip"]','Go long'); await pg.fill('[data-f="opp.op"]','Press high in a 4-3-3'); await pg.wait_for_timeout(500)
        await pg.click('#matchPart button:nth-child(2)'); await pg.wait_for_timeout(300); await pg.click('[data-act="tab"][data-arg="plan"]'); await pg.wait_for_timeout(400)
        c=await chal(); print('match check: plan B required:', 'Plan B' in c, '| suggests principles under test:', 'From the tags' in c, '| trained this week mentioned:', 'trained' in c.lower())
        print('suggested chips marked:', await pg.evaluate("[...document.querySelectorAll('[data-act=focus]')].filter(x=>x.textContent.includes('?')).map(x=>x.textContent.trim())"))
        await pg.fill('[data-f="plan.keys"]','Switch early\nBack post runs'); await pg.fill('[data-f="plan.threat"]','Long throws: 6 marks the flick'); await pg.fill('[data-f="plan.planB"]','Lost it in our half 3 times by 20 min: keeper goes long')
        await pg.click('[data-act="focus"][data-arg="pr-1"]'); await pg.wait_for_timeout(400)
        await pg.fill('[data-f="plan.principleNotes.pr-1"]','Keep it: their 9 presses alone, play round her'); await pg.wait_for_timeout(600)
        c=await chal(); print('match must-dos after filling:', c.split('|')[1].strip() if 'must-do' in c else c[:60], '| under test note placeholder shows trigger:', 'Trigger:' in (await pg.evaluate("document.querySelector('[data-f=\"plan.principleNotes.pr-1\"]').placeholder")))
        # --- move the match and the session to the past, review them
        await pg.evaluate("document.querySelectorAll('#sessDetails,#matchDetails').forEach(d=>d.open=true)"); await pg.fill('[data-f="date"]',D(-1)); await pg.wait_for_timeout(500)
        await pg.goto(U+'#/session/'+sid); await pg.wait_for_timeout(300); await pg.evaluate("document.querySelectorAll('#sessDetails,#matchDetails').forEach(d=>d.open=true)"); await pg.fill('[data-f="date"]',D(-2)); await pg.wait_for_timeout(500)
        await pg.goto(U+'#/home'); await pg.wait_for_timeout(400)
        print('home due count 2 (session + match):', (await txt()).count('REVIEW'))
        # review the session first
        await pg.goto(U+'#/session/'+sid); await pg.wait_for_timeout(300); await pg.click('[data-act="review"]'); await pg.wait_for_timeout(400)
        t=await txt(); print('session review shows plan, lookFor, focus:', 'THE PLAN' in t.upper(), 'Did you see it?' in t, 'focus' in t)
        await pg.click('[data-act="seg"][data-arg="lookForSeen:1"]'); await pg.wait_for_timeout(200)
        await pg.fill('[data-f="rollingActual"]','55'); await pg.fill('[data-f="stops"]','9'); await pg.wait_for_timeout(500)
        c=await chal(); print('review asks about low ball rolling:', 'below the 70%' in c, '| focus obs ask:', 'focus player' in c)
        await pg.fill('[data-f="playerObs.pl-6"]','Showed early twice, told her to keep going'); await pg.wait_for_timeout(300)
        for f,v in [('worked','a'),('didnt','b'),('change','Stop talking: max 3 stoppages per practice'),('self','I stop it too much')]: await pg.fill(f'[data-f="{f}"]',v)
        await pg.wait_for_timeout(600); print('session review done (gate):', await pg.evaluate("(async()=>{const S=await import('./js/store.js');return S.reviewDone(S.get(location.hash.split('/').pop()))})()"))
        # match review
        await pg.goto(U+'#/match/'+mid); await pg.wait_for_timeout(300); await pg.click('[data-act="review"]'); await pg.wait_for_timeout(400)
        t=await txt(); print('match review: under test section:', 'UNDER TEST' in t.upper(), '| score the rest:', 'Score the other' in t, '| game fields:', all(k in t for k in ['Goals, both ends','What you changed','moments','opponent file','Clips']), '| trained showed:', 'Did it show in the game' in t)
        c=await chal(); print('match review asks goals/decisions/moments/them/trained:', [k for k in ['Every goal','change during','moments','expect','Did it show'] if k in c])
        await pg.click('[data-act="key"][data-arg="0:2"]'); await pg.click('[data-act="key"][data-arg="1:0"]'); await pg.click('[data-act="ev"][data-arg="pr-1:1"]'); await pg.wait_for_timeout(300)
        await pg.fill('[data-f="them"]','They dropped the 9 onto our 6');
        for f,v in [('worked','a'),('didnt','b'),('change','6 drops between CBs when their 9 marks her'),('self','c')]: await pg.fill(f'[data-f="{f}"]',v)
        await pg.wait_for_timeout(600); c=await chal(); print('match review done (gate):', await pg.evaluate("(async()=>{const S=await import('./js/store.js');return S.reviewDone(S.get(location.hash.split('/').pop()))})()"))
        # --- next session: carried forward + acts on it + how
        await pg.goto(U+'#/plans/sessions'); await pg.wait_for_timeout(300); await pg.click('[data-act="newS"]'); await pg.wait_for_timeout(400)
        print('gate shown?', bool(await pg.query_selector('.sheet')), '| hash:', (await pg.evaluate('location.hash'))[:10])
        sid2=(await pg.evaluate('location.hash')).split('/')[-1]
        t=await txt(); print('new session carries match change:', '6 drops between CBs' in t)
        await pg.check('[data-f="addresses"]'); await pg.wait_for_timeout(500)
        c=await chal(); print('ticked without how -> must-do:', 'Say how' in c)
        await pg.fill('[data-f="addressesHow"]','7v5 build-up with their 9 on the 6; CBs told to wait for the drop'); await pg.wait_for_timeout(600)
        c=await chal(); print('with how -> ok:', 'Acts on the last review' in c)
        # that session happens; its review must ask whether the change was made
        await pg.evaluate("document.querySelectorAll('#sessDetails,#matchDetails').forEach(d=>d.open=true)"); await pg.fill('[data-f="date"]',D(-1)); await pg.wait_for_timeout(500)
        await pg.click('[data-act="review"]'); await pg.wait_for_timeout(400)
        t=await txt(); print('next review asks "did you do it":', 'LAST TIME YOU DECIDED' in t.upper() and 'Did you do it?' in t)
        c=await chal(); print('follow-up is a must-do:', 'Did you do it' in c)
        await pg.click('[data-act="seg"][data-arg="lastChangeDone:2"]'); await pg.wait_for_timeout(300)
        c=await chal(); print('after yes -> asks what happened:', 'What happened' in c)
        # --- opponent file: a second match v the same opponent shows the file + copy
        await pg.goto(U+'#/plans/matches'); await pg.wait_for_timeout(300)
        await pg.evaluate("document.querySelector('[data-act=newM]').click()"); await pg.wait_for_timeout(500)
        if await pg.query_selector('.sheet'):  # gate: finish the session review quickly
            print('gate (unfinished second session review) shown as expected')
            await pg.goto(U+'#/review/'+(await pg.evaluate("(async()=>{const S=await import('./js/store.js');return S.get('"+sid2+"').reviewId})()"))); await pg.wait_for_timeout(300)
            for f,v in [('worked','a'),('didnt','b'),('change','x'),('self','y'),('lastChangeEffect','worked')]: await pg.fill(f'[data-f="{f}"]',v)
            await pg.wait_for_timeout(600); await pg.goto(U+'#/plans/matches'); await pg.wait_for_timeout(300); await pg.click('[data-act="newM"]'); await pg.wait_for_timeout(400)
        await pg.evaluate("document.querySelectorAll('#sessDetails,#matchDetails').forEach(d=>d.open=true)"); await pg.fill('[data-f="opponent"]','chester-le-street'); await pg.evaluate("document.querySelectorAll('#sessDetails,#matchDetails').forEach(d=>d.open=true)"); await pg.fill('[data-f="date"]',D(9)); await pg.wait_for_timeout(500)
        t=await txt(); print('opponent file for 2nd meeting:', 'OPPONENT FILE' in t.upper(), '| shows what they did:', 'dropped the 9' in t, '| copy button:', bool(await pg.query_selector('[data-act=copyPrev]')))
        i=t.upper().find('OPPONENT FILE'); print('FILE TEXT:', t[i:i+400].replace('\n',' | '))
        print('prev matches:', await pg.evaluate("(async()=>{const S=await import('./js/store.js');return S.matches(S.team().id).map(m=>[m.opponent,m.date,!!(m.opp&&m.opp.ip),m.reviewId&&(S.get(m.reviewId)||{}).them])})()"))
        await pg.click('[data-act="copyPrev"]'); await pg.wait_for_timeout(400)
        print('copied tags:', await pg.evaluate("document.querySelector('[data-f=\"tags.press\"]').value"))
        # --- pathway self profile
        await pg.goto(U+'#/pathway'); await pg.wait_for_timeout(400); t=await txt()
        print('pathway: me as a coach + reflections + new evidence lines:', 'ME AS A COACH' in t.upper(), 'reflections' in t, 'focus players' in t, 'plan B' in t, 'ball rolling measured' in t)
        await pg.fill('[data-f="strengths"]','Questions'); await pg.wait_for_timeout(600); await pg.reload(); await pg.wait_for_timeout(400)
        print('profile persisted:', await pg.evaluate("document.querySelector('[data-f=strengths]').value"))
        await pg.goto(U+'#/plans/programme'); await pg.wait_for_timeout(300); await pg.screenshot(path='shots/pro-programme.png', full_page=True)
        await pg.goto(U+'#/block/'+bid); await pg.wait_for_timeout(300); t=await txt(); print('block evidence counts sessions:', 'of' in t and 'sessions' in t); await pg.screenshot(path='shots/pro-block.png', full_page=True)
        await pg.goto(U+'#/session/'+sid); await pg.wait_for_timeout(300); await pg.screenshot(path='shots/pro-session.png', full_page=True)
        await pg.goto(U+'#/match/'+mid); await pg.wait_for_timeout(300); await pg.screenshot(path='shots/pro-match.png', full_page=True)
        print('errors', errs); await b.close()
asyncio.run(main())
