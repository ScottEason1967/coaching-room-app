-- The Coaching Room: database setup.
-- Paste all of this into Supabase > SQL Editor > New query, then press Run. Safe to run again.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------
-- 1. Joe's data. One row per record (team, player, drill, session...).
--    Only the signed-in owner can read or write their own rows.
-- ---------------------------------------------------------------
create table if not exists public.items (
  owner      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null,
  kind       text not null,
  team_id    text,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted    boolean not null default false,
  synced_at  timestamptz not null default clock_timestamp(),
  primary key (owner, id)
);
create index if not exists items_owner_synced on public.items (owner, synced_at);

alter table public.items enable row level security;
drop policy if exists items_select on public.items;
drop policy if exists items_insert on public.items;
drop policy if exists items_update on public.items;
drop policy if exists items_delete on public.items;
create policy items_select on public.items for select to authenticated using (owner = (select auth.uid()));
create policy items_insert on public.items for insert to authenticated with check (owner = (select auth.uid()));
create policy items_update on public.items for update to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy items_delete on public.items for delete to authenticated using (owner = (select auth.uid()));
revoke all on public.items from anon;

-- Last edit wins across devices, and every write gets a server timestamp
-- so each device can ask for "everything changed since I last looked".
create or replace function public.items_lww() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null; -- an older edit from another device: keep the newer one
  end if;
  new.synced_at := clock_timestamp();
  return new;
end $$;
drop trigger if exists items_lww on public.items;
create trigger items_lww before insert or update on public.items
  for each row execute function public.items_lww();

-- ---------------------------------------------------------------
-- 2. Shared links for players and staff (link + PIN).
--    Holds a copy of only what Joe chose to share. Nobody can read
--    this table directly except Joe; viewers go through open_share,
--    which checks the PIN and locks the link for 15 minutes after
--    5 wrong attempts.
-- ---------------------------------------------------------------
create table if not exists public.shares (
  token        text primary key,
  owner        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind         text not null,
  ref_id       text,
  title        text,
  data         jsonb not null default '{}'::jsonb,
  pin_hash     text,
  enabled      boolean not null default true,
  expires_at   timestamptz,
  comments     jsonb not null default '[]'::jsonb,
  fails        int not null default 0,
  locked_until timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
-- Player photos (added Nov 2026). A player adds or removes her own photo from her page; it lives
-- on her link, so nothing Joe edits overwrites it, and deleting the link deletes the photo.
alter table public.shares add column if not exists photo text;
alter table public.shares add column if not exists photo_at timestamptz;
create or replace function public.shares_photo_at() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.photo is distinct from old.photo then new.photo_at := clock_timestamp(); end if;
  return new;
end $$;
drop trigger if exists shares_photo_at on public.shares;
create trigger shares_photo_at before update on public.shares
  for each row execute function public.shares_photo_at();

alter table public.shares enable row level security;
drop policy if exists shares_select on public.shares;
drop policy if exists shares_update on public.shares;
drop policy if exists shares_delete on public.shares;
create policy shares_select on public.shares for select to authenticated using (owner = (select auth.uid()));
create policy shares_update on public.shares for update to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy shares_delete on public.shares for delete to authenticated using (owner = (select auth.uid()));
revoke all on public.shares from anon;

-- Joe creates or updates a link. A null PIN keeps the existing PIN.
create or replace function public.save_share(
  p_token text, p_kind text, p_ref text, p_title text, p_data jsonb, p_pin text, p_enabled boolean default true)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_owner uuid := auth.uid();
  v_existing uuid;
  v_hash text;
begin
  if v_owner is null then raise exception 'Not signed in'; end if;
  if p_token is null or length(p_token) < 20 then raise exception 'Bad link token'; end if;
  if p_pin is not null and p_pin !~ '^[0-9]{4,8}$' then raise exception 'PIN must be 4 to 8 digits'; end if;
  select owner into v_existing from public.shares where token = p_token;
  if v_existing is not null and v_existing <> v_owner then raise exception 'Not your link'; end if;
  if p_pin is not null then v_hash := crypt(p_pin, gen_salt('bf')); end if;
  if v_existing is null and v_hash is null then raise exception 'A new link needs a PIN'; end if;
  insert into public.shares (token, owner, kind, ref_id, title, data, pin_hash, enabled, updated_at)
  values (p_token, v_owner, p_kind, p_ref, p_title, coalesce(p_data, '{}'::jsonb), v_hash, coalesce(p_enabled, true), now())
  on conflict (token) do update set
    kind = excluded.kind, ref_id = excluded.ref_id, title = excluded.title, data = excluded.data,
    enabled = excluded.enabled, updated_at = now(),
    pin_hash = coalesce(v_hash, public.shares.pin_hash),
    fails = case when v_hash is not null then 0 else public.shares.fails end,
    locked_until = case when v_hash is not null then null else public.shares.locked_until end;
end $$;

-- A player or member of staff opens a link with its PIN.
create or replace function public.open_share(p_token text, p_pin text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  s public.shares%rowtype;
  n int;
begin
  select * into s from public.shares where token = p_token for update;
  if not found or not s.enabled or (s.expires_at is not null and s.expires_at < now()) then
    return jsonb_build_object('ok', false, 'reason', 'gone');
  end if;
  if s.locked_until is not null and s.locked_until > now() then
    return jsonb_build_object('ok', false, 'reason', 'locked', 'until', s.locked_until);
  end if;
  if s.pin_hash is null or p_pin is null or crypt(p_pin, s.pin_hash) <> s.pin_hash then
    n := s.fails + 1;
    if n >= 5 then
      update public.shares set fails = 0, locked_until = now() + interval '15 minutes' where token = p_token;
      return jsonb_build_object('ok', false, 'reason', 'locked', 'until', now() + interval '15 minutes');
    end if;
    update public.shares set fails = n, locked_until = null where token = p_token;
    return jsonb_build_object('ok', false, 'reason', 'pin', 'left', 5 - n);
  end if;
  update public.shares set fails = 0, locked_until = null where token = p_token;
  return jsonb_build_object('ok', true, 'kind', s.kind, 'title', s.title, 'data', s.data,
                            'comments', s.comments, 'updated_at', s.updated_at, 'photo', s.photo);
end $$;

-- Staff can leave a comment on a shared plan (needs the PIN too).
create or replace function public.add_share_comment(p_token text, p_pin text, p_name text, p_text text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  r jsonb;
begin
  r := public.open_share(p_token, p_pin);
  if not coalesce((r->>'ok')::boolean, false) then return r; end if;
  if coalesce(length(trim(p_text)), 0) = 0 then return jsonb_build_object('ok', false, 'reason', 'empty'); end if;
  update public.shares
     set comments = (case when jsonb_array_length(comments) >= 200 then comments - 0 else comments end)
                    || jsonb_build_array(jsonb_build_object(
                         'at', now(),
                         'name', left(coalesce(nullif(trim(p_name), ''), 'Someone'), 40),
                         'text', left(trim(p_text), 1000)))
   where token = p_token
   returning comments into r;
  return jsonb_build_object('ok', true, 'comments', r);
end $$;

-- A player adds, changes or removes her own photo (needs the PIN). Small JPEGs only: the app
-- shrinks the picture to 320 px before sending it.
create or replace function public.set_share_photo(p_token text, p_pin text, p_photo text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  r jsonb;
  k text;
begin
  r := public.open_share(p_token, p_pin);
  if not coalesce((r->>'ok')::boolean, false) then return r; end if;
  select kind into k from public.shares where token = p_token;
  if k is distinct from 'player' then return jsonb_build_object('ok', false, 'reason', 'kind'); end if;
  if p_photo is not null and (length(p_photo) > 200000 or p_photo !~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$') then
    return jsonb_build_object('ok', false, 'reason', 'photo');
  end if;
  update public.shares set photo = p_photo where token = p_token;
  return jsonb_build_object('ok', true, 'photo', p_photo);
end $$;

revoke all on function public.save_share(text, text, text, text, jsonb, text, boolean) from public, anon;
grant execute on function public.save_share(text, text, text, text, jsonb, text, boolean) to authenticated;
revoke all on function public.open_share(text, text) from public;
grant execute on function public.open_share(text, text) to anon, authenticated;
revoke all on function public.add_share_comment(text, text, text, text) from public;
grant execute on function public.add_share_comment(text, text, text, text) to anon, authenticated;
revoke all on function public.items_lww() from public, anon, authenticated;
revoke all on function public.shares_photo_at() from public, anon, authenticated;
revoke all on function public.set_share_photo(text, text, text) from public;
grant execute on function public.set_share_photo(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------
-- 3. Coaching staff working together (added Nov 2026).
--    A team has members: owner, admin, coach, viewer (player is kept for later).
--    Owner, admin and coach can change everything about the team; a viewer can only look.
--    Each person's own profile, pathway and logbook stay private to them. Drills belong
--    to whoever made them, and the coaches they share a team with can use and edit them.
--    Two people editing the same record no longer overwrite each other: every field
--    carries its own time, and the newer edit of each field is kept.
-- ---------------------------------------------------------------

-- 3a. Each person's profile row gets its own id, so profiles never clash once records are shared.
update public.items set id = 'coach:' || owner::text where id = 'coach';
-- A team record belongs to its own team.
update public.items set team_id = id where kind = 'team' and team_id is distinct from id;

-- 3b. One copy of each record, shared by the team's staff: rows are now keyed by id alone.
--     If the same id exists under two accounts, the newest is kept and the others are parked here.
create table if not exists public.items_parked (like public.items);
alter table public.items_parked enable row level security;
revoke all on public.items_parked from anon, authenticated;
insert into public.items_parked
  select i.* from public.items i
  where exists (select 1 from public.items j where j.id = i.id and (j.updated_at, j.owner::text) > (i.updated_at, i.owner::text));
delete from public.items i
  where exists (select 1 from public.items j where j.id = i.id and (j.updated_at, j.owner::text) > (i.updated_at, i.owner::text));
do $$ begin
  if exists (select 1 from pg_constraint where conname = 'items_pkey' and conrelid = 'public.items'::regclass and array_length(conkey, 1) = 2) then
    alter table public.items drop constraint items_pkey;
    alter table public.items add primary key (id);
  end if;
end $$;
create index if not exists items_team on public.items (team_id);
create index if not exists items_synced on public.items (synced_at);

-- 3c. Who is on each team.
create table if not exists public.team_members (
  team_id   text not null,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      text not null check (role in ('owner', 'admin', 'coach', 'viewer', 'player')),
  name      text,
  email     text,
  player_id text,
  added_at  timestamptz not null default now(),
  primary key (team_id, user_id)
);
alter table public.team_members enable row level security;
revoke all on public.team_members from anon;

-- Checks used by the rules below. They run with the database's own rights so the rules
-- can look at team_members without going round in circles.
create or replace function public.team_role(p_team text) returns text
language sql stable security definer set search_path = public as $$
  select role from public.team_members where team_id = p_team and user_id = auth.uid()
$$;
create or replace function public.can_see(p_team text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.team_role(p_team) in ('owner', 'admin', 'coach', 'viewer'), false)
$$;
create or replace function public.can_edit(p_team text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.team_role(p_team) in ('owner', 'admin', 'coach'), false)
$$;
create or replace function public.can_admin(p_team text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.team_role(p_team) in ('owner', 'admin'), false)
$$;
-- Someone I coach alongside (for drills): kind 'see' or 'edit'.
create or replace function public.colleague(p_user uuid, p_edit boolean) returns boolean
language sql stable security definer set search_path = public as $$
  select p_user = auth.uid() or exists (
    select 1 from public.team_members a join public.team_members b on a.team_id = b.team_id
    where a.user_id = auth.uid() and b.user_id = p_user
      and b.role in ('owner', 'admin', 'coach')
      and a.role in ('owner', 'admin', 'coach', 'viewer')
      and (not p_edit or a.role in ('owner', 'admin', 'coach')))
$$;

-- Owners of the teams that already exist: whoever's records are in a team owns it.
insert into public.team_members (team_id, user_id, role, name, email)
  select distinct on (t.team_id) t.team_id, t.owner, 'owner',
         (select c.data->>'name' from public.items c where c.id = 'coach:' || t.owner::text),
         (select u.email from auth.users u where u.id = t.owner)
  from public.items t
  where t.team_id is not null
    and not exists (select 1 from public.team_members m where m.team_id = t.team_id)
  order by t.team_id, (t.kind = 'team') desc, t.updated_at
  on conflict (team_id, user_id) do nothing;
-- A team nobody has claimed yet (a new account's first team): whoever saves into it first owns it.
create or replace function public.team_unclaimed(p_team text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.team_members where team_id = p_team)
$$;

drop policy if exists tm_select on public.team_members;
drop policy if exists tm_update on public.team_members;
drop policy if exists tm_delete on public.team_members;
create policy tm_select on public.team_members for select to authenticated
  using (user_id = (select auth.uid()) or public.can_see(team_id));
create policy tm_update on public.team_members for update to authenticated
  using (public.can_admin(team_id) and role <> 'owner') with check (public.can_admin(team_id) and role <> 'owner');
create policy tm_delete on public.team_members for delete to authenticated
  using (role <> 'owner' and (public.can_admin(team_id) or user_id = (select auth.uid())));

-- 3d. The rules for records.
drop policy if exists items_select on public.items;
drop policy if exists items_insert on public.items;
drop policy if exists items_update on public.items;
drop policy if exists items_delete on public.items;
create policy items_select on public.items for select to authenticated using (
  owner = (select auth.uid())
  or (team_id is not null and public.can_see(team_id))
  or (kind = 'drill' and public.colleague(owner, false)));
create policy items_insert on public.items for insert to authenticated with check (
  owner = (select auth.uid())
  and (team_id is null or public.team_unclaimed(team_id) or public.can_edit(team_id)));
create policy items_update on public.items for update to authenticated using (
  owner = (select auth.uid())
  or (team_id is not null and public.can_edit(team_id))
  or (kind = 'drill' and public.colleague(owner, true)))
with check (
  (team_id is null and (owner = (select auth.uid()) or (kind = 'drill' and public.colleague(owner, true))))
  or (team_id is not null and public.can_edit(team_id)));
create policy items_delete on public.items for delete to authenticated using (owner = (select auth.uid()));

-- 3e. Two people, one record: keep the newer edit of each field. The app stamps each field it
--     changes in data._f ("plan.keys": time). A record from an older copy of the app has no
--     stamps, and then the newer whole record wins as before.
create or replace function public.items_merge() returns trigger
language plpgsql set search_path = public as $$
declare
  f jsonb; ofs jsonb; nf jsonb; d jsonb; v jsonb; p text; path text[];
begin
  if tg_op = 'INSERT' then
    if new.kind = 'team' then new.team_id := new.id; end if;
    new.synced_at := clock_timestamp();
    return new;
  end if;
  new.owner := old.owner;                       -- the person who made it stays its owner
  if old.kind = 'team' then new.team_id := old.team_id; end if;
  f := coalesce(new.data->'_f', '{}'::jsonb);
  ofs := coalesce(old.data->'_f', '{}'::jsonb);
  if f = '{}'::jsonb then
    if new.updated_at < old.updated_at then return null; end if;   -- older whole record: keep the newer
    new.synced_at := clock_timestamp();
    return new;
  end if;
  d := old.data; nf := ofs;
  for p in select jsonb_object_keys(f) loop
    if coalesce(f->>p, '') > coalesce(ofs->>p, '') then
      path := string_to_array(p, '.');
      v := new.data #> path;
      if array_length(path, 1) > 1 and jsonb_typeof(d #> path[1:1]) is distinct from 'object' then
        d := jsonb_set(d, path[1:1], '{}'::jsonb, true);
      end if;
      if v is null then d := d #- path; else d := jsonb_set(d, path, v, true); end if;
      nf := jsonb_set(nf, array[p], f->p, true);
    end if;
  end loop;
  new.data := jsonb_set(d, '{_f}', nf, true);
  new.deleted := case when new.updated_at >= old.updated_at then new.deleted else old.deleted end;
  new.updated_at := greatest(new.updated_at, old.updated_at);
  new.synced_at := clock_timestamp();
  return new;
end $$;
drop trigger if exists items_lww on public.items;
drop trigger if exists items_merge on public.items;
create trigger items_merge before insert or update on public.items
  for each row execute function public.items_merge();

-- Whoever creates a team (or saves the first record into an unclaimed one) owns it.
create or replace function public.items_team_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.team_id is not null and not exists (select 1 from public.team_members where team_id = new.team_id) then
    insert into public.team_members (team_id, user_id, role, name, email)
    values (new.team_id, new.owner, 'owner',
            (select c.data->>'name' from public.items c where c.id = 'coach:' || new.owner::text),
            (select u.email from auth.users u where u.id = new.owner))
    on conflict (team_id, user_id) do nothing;
  end if;
  return null;
end $$;
drop trigger if exists items_team_owner on public.items;
create trigger items_team_owner after insert on public.items
  for each row execute function public.items_team_owner();

-- 3f. Invitations. Joe makes one in the app and sends the link himself (WhatsApp, text, email):
--     Supabase's own email only reaches people on the Supabase account's team.
create table if not exists public.invites (
  token      text primary key,
  team_id    text not null,
  role       text not null check (role in ('admin', 'coach', 'viewer')),
  name       text,
  email      text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  used_by    uuid references auth.users(id) on delete set null,
  used_at    timestamptz
);
alter table public.invites enable row level security;
revoke all on public.invites from anon;
drop policy if exists inv_select on public.invites;
drop policy if exists inv_insert on public.invites;
drop policy if exists inv_delete on public.invites;
create policy inv_select on public.invites for select to authenticated using (public.can_admin(team_id));
create policy inv_insert on public.invites for insert to authenticated
  with check (created_by = (select auth.uid()) and public.can_admin(team_id) and length(token) >= 20);
create policy inv_delete on public.invites for delete to authenticated using (public.can_admin(team_id));

-- What the person opening the link sees before they have an account.
create or replace function public.invite_info(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare i public.invites%rowtype;
begin
  select * into i from public.invites where token = p_token;
  if not found then return jsonb_build_object('ok', false, 'reason', 'gone'); end if;
  if i.used_at is not null then return jsonb_build_object('ok', false, 'reason', 'used'); end if;
  if i.expires_at < now() then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;
  return jsonb_build_object('ok', true, 'role', i.role, 'name', i.name, 'email', i.email,
    'team', (select t.data->>'name' from public.items t where t.id = i.team_id and t.kind = 'team'),
    'from', (select c.data->>'name' from public.items c where c.id = 'coach:' || i.created_by::text));
end $$;

-- The signed-in person accepts. The email on the invite must match their account's.
create or replace function public.accept_invite(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare i public.invites%rowtype; em text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into i from public.invites where token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'gone'); end if;
  if i.used_at is not null then
    if i.used_by = auth.uid() then return jsonb_build_object('ok', true, 'team_id', i.team_id); end if;
    return jsonb_build_object('ok', false, 'reason', 'used');
  end if;
  if i.expires_at < now() then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;
  select u.email into em from auth.users u where u.id = auth.uid();
  if i.email is not null and lower(trim(i.email)) <> lower(trim(coalesce(em, ''))) then
    return jsonb_build_object('ok', false, 'reason', 'email');
  end if;
  insert into public.team_members (team_id, user_id, role, name, email)
  values (i.team_id, auth.uid(), i.role, i.name, em)
  on conflict (team_id, user_id) do update
    set role = case when public.team_members.role = 'owner' then 'owner' else excluded.role end,
        name = coalesce(public.team_members.name, excluded.name);
  update public.invites set used_by = auth.uid(), used_at = now() where token = p_token;
  return jsonb_build_object('ok', true, 'team_id', i.team_id);
end $$;

revoke all on function public.invite_info(text) from public;
grant execute on function public.invite_info(text) to anon, authenticated;
revoke all on function public.accept_invite(text) from public, anon;
grant execute on function public.accept_invite(text) to authenticated;
revoke all on function public.items_merge() from public, anon, authenticated;
revoke all on function public.items_team_owner() from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_proc where proname = 'items_lww' and pronamespace = 'public'::regnamespace) then
    drop function public.items_lww();
  end if;
end $$;

-- 3g. Live updates: changes reach the other coaches' screens within a second or two.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'items') then
      alter publication supabase_realtime add table public.items;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'team_members') then
      alter publication supabase_realtime add table public.team_members;
    end if;
  end if;
end $$;
