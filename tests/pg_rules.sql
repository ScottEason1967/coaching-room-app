\set ON_ERROR_STOP 0
\echo '--- Joe writes, LWW keeps newer'
set role authenticated; set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into items (owner,id,kind,data,updated_at) values (auth.uid(),'p1','player','{"name":"A"}','2026-11-06T10:00:00Z');
insert into items (owner,id,kind,data,updated_at) values (auth.uid(),'p1','player','{"name":"OLDER"}','2026-11-06T09:00:00Z') on conflict (owner,id) do update set data=excluded.data, updated_at=excluded.updated_at;
select data->>'name' as after_older_write from items where id='p1';
insert into items (owner,id,kind,data,updated_at) values (auth.uid(),'p1','player','{"name":"NEWER"}','2026-11-06T11:00:00Z') on conflict (owner,id) do update set data=excluded.data, updated_at=excluded.updated_at;
select data->>'name' as after_newer_write from items where id='p1';
\echo '--- Other user cannot see or write Joe''s rows'
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select count(*) as other_sees from items;
insert into items (owner,id,kind) values ('11111111-1111-1111-1111-111111111111','x','player');
update items set data='{"name":"HACKED"}' where id='p1';
\echo '--- anon cannot read tables'
reset role; set role anon; select count(*) from items; select count(*) from shares;
select save_share('abcdefghijklmnopqrstuv','player','p1','t','{}','1234',true);
\echo '--- Joe makes a link'
reset role; set role authenticated; set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select save_share('abcdefghijklmnopqrstuv','player','p1','Beth','{"player":{"name":"Beth"}}','1234',true);
select pin_hash like '$2a$%' as pin_is_hashed, pin_hash <> '1234' as not_plain from shares;
\echo '--- Other user cannot take over the link'
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select save_share('abcdefghijklmnopqrstuv','player','p1','x','{}','9999',true);
\echo '--- Player opens it'
reset role; set role anon;
select open_share('abcdefghijklmnopqrstuv','1234')->>'ok' as right_pin;
select open_share('abcdefghijklmnopqrstuv','0000') as wrong1;
select open_share('abcdefghijklmnopqrstuv','0000')->>'left' as left_after2;
select open_share('abcdefghijklmnopqrstuv','0000'), open_share('abcdefghijklmnopqrstuv','0000');
select open_share('abcdefghijklmnopqrstuv','0000')->>'reason' as fifth;
select open_share('abcdefghijklmnopqrstuv','1234')->>'reason' as right_pin_while_locked;
select add_share_comment('abcdefghijklmnopqrstuv','1234','Sam','hi')->>'reason' as comment_while_locked;
reset role; update shares set locked_until = now() - interval '1 minute'; set role anon;
select open_share('abcdefghijklmnopqrstuv','1234')->>'ok' as right_pin_after_lock;
select jsonb_array_length((add_share_comment('abcdefghijklmnopqrstuv','1234','Sam','Swap the rondo?'))->'comments') as comments;
select open_share('nope-nope-nope-nope-nope','1234')->>'reason' as unknown_token;
\echo '--- Joe turns it off, keeps PIN when updating content'
reset role; set role authenticated; set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select save_share('abcdefghijklmnopqrstuv','player','p1','Beth','{"v":2}',null,true);
reset role; set role anon; select open_share('abcdefghijklmnopqrstuv','1234')->'data' as data_v2_same_pin;
reset role; set role authenticated; set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
update shares set enabled=false where token='abcdefghijklmnopqrstuv';
reset role; set role anon; select open_share('abcdefghijklmnopqrstuv','1234')->>'reason' as when_off;
