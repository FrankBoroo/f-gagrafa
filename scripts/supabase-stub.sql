-- The pieces of Supabase that the SQL files lean on. Used by scripts/gen-db-types.mjs and the
-- PGlite tests (src/test/pglite-db.ts), never run on a real database.
create role anon; create role authenticated; create role service_role;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as 'select null::uuid';
