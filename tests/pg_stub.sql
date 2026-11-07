-- Minimal stand-ins for what Supabase provides.
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema auth; create schema extensions;
grant usage on schema public, extensions, auth to anon, authenticated;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated;
-- Supabase grants table rights to these roles by default; RLS does the restricting.
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
insert into auth.users values ('11111111-1111-1111-1111-111111111111','joe@x'), ('22222222-2222-2222-2222-222222222222','other@x');
