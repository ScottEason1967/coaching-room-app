import json, time, uuid
class Server:
    def __init__(s): s.users={}; s.items={}; s.shares={}; s.t=time.time()
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
    def op_query(s,p):
        uid=p['uid']
        if not uid: return {'error':{'message':'not signed in'},'data':None}
        if p['table']=='items':
            if p['op']=='upsert':
                acc=[]
                for r in p['rows']:
                    if r['owner']!=uid: return {'error':{'message':'RLS'}}
                    k=(uid,r['id']); old=s.items.get(k)
                    if old and r['updated_at']<old['updated_at']: continue   # LWW trigger: dropped rows are not returned
                    s.items[k]=dict(r,synced_at=s.now()); acc.append({'id':r['id'],'updated_at':r['updated_at']})
                return {'error':None,'data':acc}   # what PostgREST returns for upsert(...).select()
            rows=[v for (o,_),v in s.items.items() if o==uid]
            for f,c,v in p['filters']:
                if f=='gt': rows=[r for r in rows if r[c]>v]
            rows.sort(key=lambda r:r['synced_at']); rows=rows[:p.get('limit') or 1000]
            return {'error':None,'data':rows}
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
