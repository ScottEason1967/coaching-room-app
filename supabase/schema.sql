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
                            'comments', s.comments, 'updated_at', s.updated_at);
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

revoke all on function public.save_share(text, text, text, text, jsonb, text, boolean) from public, anon;
grant execute on function public.save_share(text, text, text, text, jsonb, text, boolean) to authenticated;
revoke all on function public.open_share(text, text) from public;
grant execute on function public.open_share(text, text) to anon, authenticated;
revoke all on function public.add_share_comment(text, text, text, text) from public;
grant execute on function public.add_share_comment(text, text, text, text) to anon, authenticated;
revoke all on function public.items_lww() from public, anon, authenticated;
