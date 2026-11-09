-- Coaching staff working together (Nov 2026). Run after pg_stub.sql, the OLD schema (first part of
-- schema.sql, before section 3) and pg_team_before.sql, then the full schema.sql twice. Prints ok/FAIL lines.
\set ON_ERROR_STOP 0
\pset tuples_only on
\pset format unaligned
create or replace function pg_temp.ok(name text, cond boolean) returns text language sql as $$ select case when cond then 'ok   ' else 'FAIL ' end || name $$;

\echo '--- after the upgrade'
reset role;
select pg_temp.ok('Joe''s profile row renamed to coach:<his id>', exists (select 1 from items where id = 'coach:11111111-1111-1111-1111-111111111111') and not exists (select 1 from items where id = 'coach'));
select pg_temp.ok('records are keyed by id alone', (select array_length(conkey, 1) from pg_constraint where conname = 'items_pkey') = 1);
select pg_temp.ok('Joe owns his existing team', (select role from team_members where team_id = 't-thornaby' and user_id = '11111111-1111-1111-1111-111111111111') = 'owner');
select pg_temp.ok('owner row picked up his name and email', (select name || '|' || email from team_members where team_id = 't-thornaby') = 'Joe|joe@x');
select pg_temp.ok('Joe owns a team whose own record was never uploaded', (select role from team_members where team_id = 't-two') = 'owner');
select pg_temp.ok('team record belongs to its own team', (select team_id from items where id = 't-thornaby') = 't-thornaby');
select pg_temp.ok('nothing parked (no clashing ids)', (select count(*) from items_parked) = 0);

\echo '--- the manager (not yet invited) sees nothing of Joe''s'
set role authenticated; set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select pg_temp.ok('manager sees no rows', (select count(*) from items) = 0);
select pg_temp.ok('manager cannot read invite tokens', (select count(*) from invites) = 0);

\echo '--- Joe invites the manager and a viewer'
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into invites (token, team_id, role, name, email) values ('tok-manager-aaaaaaaaaaaaaaaa', 't-thornaby', 'coach', 'Dave', 'Manager@x');
insert into invites (token, team_id, role, name, email) values ('tok-viewer-bbbbbbbbbbbbbbbbbb', 't-thornaby', 'viewer', 'Viv', 'viewer@x');
select pg_temp.ok('Joe can list his invites', (select count(*) from invites) = 2);
\echo '--- someone who is not an admin cannot invite to Joe''s team'
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
insert into invites (token, team_id, role) values ('tok-hack-cccccccccccccccccccccc', 't-thornaby', 'admin');
select pg_temp.ok('outsider invite refused', (select count(*) from invites) = 0);

\echo '--- the link, before signing in'
reset role; set role anon;
select pg_temp.ok('invite_info shows team, inviter and role', (select (r->>'team') || '|' || (r->>'from') || '|' || (r->>'role') from (select invite_info('tok-manager-aaaaaaaaaaaaaaaa') r) x) = 'Thornaby FC Women|Joe|coach');
select pg_temp.ok('unknown token says gone', invite_info('nope')->>'reason' = 'gone');

\echo '--- wrong account cannot use it; the right one can'
reset role; set role authenticated; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select pg_temp.ok('other email refused', accept_invite('tok-manager-aaaaaaaaaaaaaaaa')->>'reason' = 'email');
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select pg_temp.ok('manager accepts (email case ignored)', (accept_invite('tok-manager-aaaaaaaaaaaaaaaa')->>'ok')::boolean);
select pg_temp.ok('accepting twice is harmless', (accept_invite('tok-manager-aaaaaaaaaaaaaaaa')->>'ok')::boolean);
select pg_temp.ok('manager now sees the team''s records', (select count(*) from items where team_id = 't-thornaby') = 4);
select pg_temp.ok('manager does not see Joe''s profile or logbook', (select count(*) from items where kind in ('coach', 'cpd')) = 0);
select pg_temp.ok('manager sees Joe''s drills (colleagues)', (select count(*) from items where kind = 'drill') = 1);
select pg_temp.ok('manager sees the staff list', (select count(*) from team_members where team_id = 't-thornaby') = 2);
reset role; set role anon;
select pg_temp.ok('used link now says used', invite_info('tok-manager-aaaaaaaaaaaaaaaa')->>'reason' = 'used');

\echo '--- both edit the same match plan, different fields'
reset role; set role authenticated; set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into items (owner, id, kind, team_id, data, updated_at) values (auth.uid(), 'mt-1', 'match', 't-thornaby',
  '{"opponent":"Chester","plan":{"keys":"JOE KEYS","planB":""},"_f":{"plan.keys":"2026-11-09T10:00:01.000Z"}}', '2026-11-09T10:00:01Z')
  on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at, team_id = excluded.team_id, kind = excluded.kind;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
-- the manager's device had loaded the record before Joe typed: its copy has old keys but a new Plan B
insert into items (owner, id, kind, team_id, data, updated_at) values (auth.uid(), 'mt-1', 'match', 't-thornaby',
  '{"opponent":"Chester","plan":{"keys":"","planB":"DAVE PLAN B"},"_f":{"plan.planB":"2026-11-09T10:00:02.000Z"}}', '2026-11-09T10:00:02Z')
  on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at, team_id = excluded.team_id, kind = excluded.kind;
select pg_temp.ok('both edits kept', (select (data#>>'{plan,keys}') || '|' || (data#>>'{plan,planB}') from items where id = 'mt-1') = 'JOE KEYS|DAVE PLAN B');
select pg_temp.ok('the record still belongs to Joe', (select owner from items where id = 'mt-1') = '11111111-1111-1111-1111-111111111111');
\echo '--- same field: the newer edit wins, an older one does not overwrite it'
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into items (owner, id, kind, team_id, data, updated_at) values (auth.uid(), 'mt-1', 'match', 't-thornaby',
  '{"plan":{"planB":"JOE OLDER"},"_f":{"plan.planB":"2026-11-09T10:00:00.500Z"}}', '2026-11-09T10:00:00.5Z')
  on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at;
select pg_temp.ok('older edit of the same field ignored', (select data#>>'{plan,planB}' from items where id = 'mt-1') = 'DAVE PLAN B');
select pg_temp.ok('and the other fields untouched', (select data#>>'{plan,keys}' || '|' || (data->>'opponent') from items where id = 'mt-1') = 'JOE KEYS|Chester');
insert into items (owner, id, kind, team_id, data, updated_at) values (auth.uid(), 'mt-1', 'match', 't-thornaby',
  '{"plan":{"planB":"JOE NEWER"},"_f":{"plan.planB":"2026-11-09T10:00:03.000Z"}}', '2026-11-09T10:00:03Z')
  on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at;
select pg_temp.ok('newer edit of the same field wins', (select data#>>'{plan,planB}' from items where id = 'mt-1') = 'JOE NEWER');

\echo '--- the manager cannot touch private records or move a record out of the team'
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
update items set data = '{"name":"HACKED"}' where id = 'coach:11111111-1111-1111-1111-111111111111';
update items set team_id = null where id = 'mt-1';
reset role;
select pg_temp.ok('Joe''s profile untouched', (select data->>'name' from items where id = 'coach:11111111-1111-1111-1111-111111111111') = 'Joe');
select pg_temp.ok('match still in the team', (select team_id from items where id = 'mt-1') = 't-thornaby');

\echo '--- a viewer sees but cannot change'
set role authenticated; set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select pg_temp.ok('viewer accepts', (accept_invite('tok-viewer-bbbbbbbbbbbbbbbbbb')->>'ok')::boolean);
select pg_temp.ok('viewer sees the match', (select count(*) from items where id = 'mt-1') = 1);
update items set data = '{"opponent":"VIEWER"}' where id = 'mt-1';
insert into items (owner, id, kind, team_id, data) values (auth.uid(), 'v-1', 'session', 't-thornaby', '{}');
reset role;
select pg_temp.ok('viewer edit refused', (select data->>'opponent' from items where id = 'mt-1') = 'Chester');
select pg_temp.ok('viewer insert refused', not exists (select 1 from items where id = 'v-1'));

\echo '--- staff management'
set role authenticated; set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
update team_members set role = 'admin' where user_id = '33333333-3333-3333-3333-333333333333';
delete from team_members where user_id = '44444444-4444-4444-4444-444444444444';
reset role;
select pg_temp.ok('a coach cannot promote herself', (select role from team_members where user_id = '33333333-3333-3333-3333-333333333333') = 'coach');
select pg_temp.ok('a coach cannot remove others', exists (select 1 from team_members where user_id = '44444444-4444-4444-4444-444444444444'));
set role authenticated; set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
update team_members set role = 'admin' where user_id = '33333333-3333-3333-3333-333333333333';
delete from team_members where user_id = '44444444-4444-4444-4444-444444444444';
update team_members set role = 'viewer' where user_id = '11111111-1111-1111-1111-111111111111';
reset role;
select pg_temp.ok('owner promotes the manager to admin', (select role from team_members where user_id = '33333333-3333-3333-3333-333333333333') = 'admin');
select pg_temp.ok('owner removes the viewer', not exists (select 1 from team_members where user_id = '44444444-4444-4444-4444-444444444444'));
select pg_temp.ok('nobody can demote the owner', (select role from team_members where user_id = '11111111-1111-1111-1111-111111111111') = 'owner');
set role authenticated; set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select pg_temp.ok('removed viewer sees nothing now', (select count(*) from items) = 0);
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
delete from team_members where user_id = '11111111-1111-1111-1111-111111111111';
reset role;
select pg_temp.ok('an admin cannot remove the owner', exists (select 1 from team_members where user_id = '11111111-1111-1111-1111-111111111111'));

\echo '--- a new team: whoever makes it owns it; its id cannot be taken from someone else'
set role authenticated; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
insert into items (owner, id, kind, data) values (auth.uid(), 't-other', 'team', '{"name":"Other FC"}');
insert into items (owner, id, kind, data) values (auth.uid(), 't-thornaby', 'team', '{"name":"STOLEN"}') on conflict (id) do update set data = excluded.data;
reset role;
select pg_temp.ok('new team owned by its maker', (select role from team_members where team_id = 't-other' and user_id = '22222222-2222-2222-2222-222222222222') = 'owner');
select pg_temp.ok('existing team cannot be taken over', (select data->>'name' from items where id = 't-thornaby') = 'Thornaby FC Women');
select pg_temp.ok('Thornaby staff cannot see Other FC', (select count(*) from team_members where team_id = 't-other') = 1);

\echo '--- a brand-new account: its first save into an unclaimed team makes it the owner'
set role authenticated; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
insert into items (owner, id, kind, team_id, data) values (auth.uid(), 'pl-new', 'player', 't-new', '{"name":"First"}');
reset role;
select pg_temp.ok('first save claims the team', (select role from team_members where team_id = 't-new' and user_id = '22222222-2222-2222-2222-222222222222') = 'owner');
set role authenticated; set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into items (owner, id, kind, team_id, data) values (auth.uid(), 'pl-sneak', 'player', 't-new', '{}');
reset role;
select pg_temp.ok('nobody else can then save into it', not exists (select 1 from items where id = 'pl-sneak'));
set role authenticated; set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
update items set data = '{"name":"Edited"}', updated_at = now() where id = 'pl-90';
reset role;
select pg_temp.ok('Joe edits in the team that had no team record', (select data->>'name' from items where id = 'pl-90') = 'Edited');

\echo '--- an old copy of the app (no field stamps) still works: newer whole record wins'
insert into items (owner, id, kind, team_id, data, updated_at) values ('11111111-1111-1111-1111-111111111111', 'pl-x', 'player', 't-thornaby', '{"name":"A"}', '2026-11-09T10:00:00Z');
set role authenticated; set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into items (owner, id, kind, team_id, data, updated_at) values (auth.uid(), 'pl-x', 'player', 't-thornaby', '{"name":"OLDER"}', '2026-11-09T09:00:00Z') on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at;
insert into items (owner, id, kind, team_id, data, updated_at) values (auth.uid(), 'pl-x', 'player', 't-thornaby', '{"name":"NEWER"}', '2026-11-09T11:00:00Z') on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at;
reset role;
select pg_temp.ok('older ignored, newer kept', (select data->>'name' from items where id = 'pl-x') = 'NEWER');
