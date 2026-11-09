-- Joe's data as it is in the cloud before the staff upgrade (old rules, rows keyed by owner + id).
insert into auth.users values ('33333333-3333-3333-3333-333333333333', 'manager@x'), ('44444444-4444-4444-4444-444444444444', 'viewer@x') on conflict do nothing;
set role authenticated; set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into items (owner, id, kind, team_id, data) values
  (auth.uid(), 'coach', 'coach', null, '{"name":"Joe","initials":"JE"}'),
  (auth.uid(), 't-thornaby', 'team', null, '{"name":"Thornaby FC Women"}'),
  (auth.uid(), 'pl-7', 'player', 't-thornaby', '{"name":"Beth"}'),
  (auth.uid(), 'pr-1', 'principle', 't-thornaby', '{"title":"Play out"}'),
  (auth.uid(), 'ss-1', 'session', 't-thornaby', '{"theme":"Playing out"}'),
  (auth.uid(), 'dr-1', 'drill', null, '{"name":"Rondo"}'),
  (auth.uid(), 'cp-1', 'cpd', null, '{"title":"Workshop"}'),
  (auth.uid(), 'pl-90', 'player', 't-two', '{"name":"In a team whose own record was never uploaded"}');
reset role;
