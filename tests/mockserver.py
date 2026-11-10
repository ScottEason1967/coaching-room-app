import json, time, uuid
class Server:
    def __init__(s): s.users={}; s.items={}; s.shares={}; s.members=[]; s.invites={}; s.t=time.time()
    def now(s):
        s.t=max(s.t+0.001,time.time()); return time.strftime('%Y-%m-%dT%H:%M:%S',time.gmtime(s.t))+('%.6f'%(s.t%1))[1:]+'+00:00'
    def handle(s, op, payload):
        p=json.loads(payload); return json.dumps(getattr(s,'op_'+op)(p))
    def op_signup(s,p):
        if p['email'] in s.users: return {'error':{'message':'User already registered'}}
        u={'id':str(uuid.uuid4()),'email':p['email']}; s.users[p['email']]=(p['password'],u); return {'user':u}
    def op_signin(s,p):
        x=s.users.get(p['email'])
        if not x or x[0]!=p['password']: return {'error':{'message':'Invalid login credentials'}}
        return {'user':x[1]}
    # ---- coaching staff (mirrors schema.sql section 3) ----
    def role(s,uid,team):
        for m in s.members:
            if m['team_id']==team and m['user_id']==uid: return m['role']
        return None
    def can_see(s,uid,team): return s.role(uid,team) in ('owner','admin','coach','viewer')
    def can_edit(s,uid,team): return s.role(uid,team) in ('owner','admin','coach')
    def can_admin(s,uid,team): return s.role(uid,team) in ('owner','admin')
    def colleague(s,uid,other,edit):
        if uid==other: return True
        for a in s.members:
            if a['user_id']!=uid or a['role'] not in ('owner','admin','coach','viewer'): continue
            if edit and a['role'] not in ('owner','admin','coach'): continue
            for b in s.members:
                if b['team_id']==a['team_id'] and b['user_id']==other and b['role'] in ('owner','admin','coach'): return True
        return False
    def email_of(s,uid):
        for em,(pw,u) in s.users.items():
            if u['id']==uid: return em
        return None
    def visible(s,uid,r):
        return r['owner']==uid or (r.get('team_id') and s.can_see(uid,r['team_id'])) or (r['kind']=='drill' and s.colleague(uid,r['owner'],False))
    def add_member(s,team,uid,role,name=None,email=None):
        for m in s.members:
            if m['team_id']==team and m['user_id']==uid:
                if m['role']!='owner': m['role']=role
                m['name']=m.get('name') or name; return
        s.members.append({'team_id':team,'user_id':uid,'role':role,'name':name,'email':email,'added_at':s.now()})
    @staticmethod
    def merge(old,new):
        f=(new['data'] or {}).get('_f') or {}; of=(old['data'] or {}).get('_f') or {}
        if not f:
            if new['updated_at']<old['updated_at']: return None
            return dict(new,owner=old['owner'])
        d=json.loads(json.dumps(old['data'])); nf=dict(of)
        for p_,ts in f.items():
            if ts>(of.get(p_) or ''):
                path=p_.split('.'); v=new['data']
                for k in path: v=v.get(k) if isinstance(v,dict) else None
                missing=False; x=new['data']
                for k in path:
                    if not isinstance(x,dict) or k not in x: missing=True; break
                    x=x[k]
                if len(path)>1 and not isinstance(d.get(path[0]),dict): d[path[0]]={}
                tgt=d
                for k in path[:-1]: tgt=tgt[k]
                if missing: tgt.pop(path[-1],None)
                else: tgt[path[-1]]=v
                nf[p_]=ts
        d['_f']=nf
        return dict(new,data=d,owner=old['owner'],updated_at=max(new['updated_at'],old['updated_at']),deleted=new['deleted'] if new['updated_at']>=old['updated_at'] else old['deleted'])
    def op_query(s,p):
        uid=p['uid']
        if not uid: return {'error':{'message':'not signed in'},'data':None}
        eqs={c:v for f,c,v in p['filters'] if f=='eq'}
        if p['table']=='items':
            if p['op']=='upsert':
                ids=[r['id'] for r in p['rows']]
                if len(ids)!=len(set(ids)): return {'error':{'message':'ON CONFLICT DO UPDATE command cannot affect row a second time','code':'21000'}}
                out=[]; staged={}
                for r in p['rows']:
                    r=dict(r); r.setdefault('deleted',False)
                    if r['owner']!=uid: return {'error':{'message':'new row violates row-level security policy','code':'42501'}}
                    old=staged.get(r['id']) or s.items.get(r['id'])
                    if not old:
                        if r['kind']=='team': r['team_id']=r['id']
                        unclaimed=r.get('team_id') and not any(m['team_id']==r['team_id'] for m in s.members)
                        if not (r.get('team_id') is None or unclaimed or s.can_edit(uid,r['team_id'])):
                            return {'error':{'message':'new row violates row-level security policy','code':'42501'}}
                        row=dict(r,synced_at=s.now()); staged[r['id']]=row; out.append(row)
                        if unclaimed: s.add_member(r['team_id'],uid,'owner',None,s.email_of(uid))
                        continue
                    using=old['owner']==uid or (old.get('team_id') and s.can_edit(uid,old['team_id'])) or (old['kind']=='drill' and s.colleague(uid,old['owner'],True))
                    if not using: return {'error':{'message':'new row violates row-level security policy (USING expression)','code':'42501'}}
                    if old['kind']=='team': r['team_id']=old['team_id']
                    m=s.merge(old,r)
                    if m is None: continue
                    ok=(m.get('team_id') is None and (m['owner']==uid or (m['kind']=='drill' and s.colleague(uid,m['owner'],True)))) or (m.get('team_id') is not None and s.can_edit(uid,m['team_id']))
                    if not ok: return {'error':{'message':'new row violates row-level security policy','code':'42501'}}
                    row=dict(m,synced_at=s.now()); staged[r['id']]=row; out.append(row)
                s.items.update(staged)
                return {'error':None,'data':[{k:x.get(k) for k in ('id','kind','team_id','data','updated_at','deleted','synced_at')} for x in out]}
            rows=[v for v in s.items.values() if s.visible(uid,v)]
            for f,c,v in p['filters']:
                if f=='gt': rows=[r for r in rows if r[c]>v]
            rows.sort(key=lambda r:r['synced_at']); rows=rows[:p.get('limit') or 1000]
            return {'error':None,'data':[{k:x.get(k) for k in ('id','kind','team_id','data','updated_at','deleted','synced_at')} for x in rows]}
        if p['table']=='team_members':
            if p['op']=='select':
                rows=[dict(m) for m in s.members if m['user_id']==uid or s.can_see(uid,m['team_id'])]
                rows.sort(key=lambda m:m['added_at']); return {'error':None,'data':rows}
            tgt=[m for m in s.members if all(m.get(c)==v for c,v in eqs.items())]
            for m in tgt:
                if p['op']=='update':
                    if not (s.can_admin(uid,m['team_id']) and m['role']!='owner' and p['patch'].get('role')!='owner'): continue
                    m.update(p['patch'])
                if p['op']=='delete':
                    if m['role']=='owner' or not (s.can_admin(uid,m['team_id']) or m['user_id']==uid): continue
                    s.members.remove(m)
            return {'error':None,'data':None}
        if p['table']=='invites':
            if p['op']=='insert':
                for r in p['rows']:
                    if not s.can_admin(uid,r['team_id']) or len(r['token'])<20: return {'error':{'message':'new row violates row-level security policy','code':'42501'}}
                    s.invites[r['token']]=dict(r,created_by=uid,created_at=s.now(),expires_at='2099-01-01T00:00:00+00:00',used_at=None,used_by=None)
                return {'error':None,'data':None}
            rows=[i for i in s.invites.values() if s.can_admin(uid,i['team_id']) and all(i.get(c)==v for c,v in eqs.items())]
            if p['op']=='delete':
                for i in rows: del s.invites[i['token']]
                return {'error':None,'data':None}
            return {'error':None,'data':[dict(i) for i in rows]}
        if p['table']=='shares':
            toks=[v for f,c,v in p['filters'] if c=='token']
            if not toks:   # Joe's app collecting player photos
                rows=[{'ref_id':sh.get('ref'),'photo':sh.get('photo'),'photo_at':sh.get('photo_at')} for sh in s.shares.values() if sh['owner']==uid and sh['kind']=='player' and sh.get('photo_at')]
                for f,c,v in p['filters']:
                    if f=='gt': rows=[r for r in rows if r[c]>v]
                rows.sort(key=lambda r:r['photo_at']); return {'error':None,'data':rows}
            tok=toks[0]; sh=s.shares.get(tok)
            if not sh or sh['owner']!=uid: return {'error':None,'data':None}
            if p['op']=='update':
                sh.update(p['patch'])
                if 'photo' in p['patch']: sh['photo_at']=s.now()
                return {'error':None,'data':None}
            if p['op']=='delete': del s.shares[tok]; return {'error':None,'data':None}
            return {'error':None,'data':{k:sh[k] for k in ('token','enabled','updated_at','comments')}}
    def op_rpc(s,p):
        n=p['name']; a=p['params']; uid=p['uid']
        if n=='invite_info':
            i=s.invites.get(a['p_token'])
            if not i: return {'data':{'ok':False,'reason':'gone'},'error':None}
            if i['used_at']: return {'data':{'ok':False,'reason':'used'},'error':None}
            t=s.items.get(i['team_id']) or {'data':{}}; c=s.items.get('coach:'+i['created_by']) or {'data':{}}
            return {'data':{'ok':True,'role':i['role'],'name':i.get('name'),'email':i.get('email'),'team':t['data'].get('name'),'from':c['data'].get('name')},'error':None}
        if n=='accept_invite':
            if not uid: return {'error':{'message':'Not signed in'}}
            i=s.invites.get(a['p_token'])
            if not i: return {'data':{'ok':False,'reason':'gone'},'error':None}
            if i['used_at']: return {'data':{'ok':i['used_by']==uid,'reason':'used','team_id':i['team_id']},'error':None}
            em=s.email_of(uid)
            if i.get('email') and i['email'].strip().lower()!=(em or '').lower(): return {'data':{'ok':False,'reason':'email'},'error':None}
            s.add_member(i['team_id'],uid,i['role'],i.get('name'),em); i['used_at']=s.now(); i['used_by']=uid
            return {'data':{'ok':True,'team_id':i['team_id']},'error':None}
        if n=='save_share':
            if not uid: return {'error':{'message':'Not signed in'}}
            sh=s.shares.get(a['p_token'])
            if sh and sh['owner']!=uid: return {'error':{'message':'Not your link'}}
            if not sh and not a['p_pin']: return {'error':{'message':'A new link needs a PIN'}}
            new=dict(sh or {'comments':[],'fails':0,'locked':0})
            new.update(owner=uid,token=a['p_token'],kind=a['p_kind'],ref=a['p_ref'],title=a['p_title'],data=a['p_data'],enabled=a['p_enabled'],updated_at=s.now())
            if a['p_pin']: new['pin']=a['p_pin']; new['fails']=0; new['locked']=0
            s.shares[a['p_token']]=new; return {'data':None,'error':None}
        if n in ('open_share','add_share_comment','set_share_photo'):
            sh=s.shares.get(a['p_token'])
            if not sh or not sh['enabled']: return {'data':{'ok':False,'reason':'gone'},'error':None}
            if sh['locked']>time.time(): return {'data':{'ok':False,'reason':'locked'},'error':None}
            if a['p_pin']!=sh['pin']:
                sh['fails']+=1
                if sh['fails']>=5: sh['fails']=0; sh['locked']=time.time()+900; return {'data':{'ok':False,'reason':'locked'},'error':None}
                return {'data':{'ok':False,'reason':'pin','left':5-sh['fails']},'error':None}
            sh['fails']=0
            if n=='set_share_photo':
                ph=a['p_photo']
                if sh['kind']!='player': return {'data':{'ok':False,'reason':'kind'},'error':None}
                if ph is not None and (not ph.startswith('data:image/jpeg;base64,') or len(ph)>200000): return {'data':{'ok':False,'reason':'photo'},'error':None}
                sh['photo']=ph; sh['photo_at']=s.now(); return {'data':{'ok':True,'photo':ph},'error':None}
            if n=='add_share_comment':
                sh['comments'].append({'at':s.now(),'name':a['p_name'] or 'Someone','text':a['p_text']}); return {'data':{'ok':True,'comments':sh['comments']},'error':None}
            return {'data':{'ok':True,'kind':sh['kind'],'title':sh['title'],'data':sh['data'],'comments':sh['comments'],'updated_at':sh['updated_at'],'photo':sh.get('photo')},'error':None}
