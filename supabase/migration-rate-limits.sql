-- Rate limits per visitor for the public forms and actions (Plan phase 1).
--
-- Run order: after migration-usd-pricing.sql. Run the whole file once in the Supabase
-- SQL editor; it is idempotent and safe to run again.
--
-- Backward compatible: the app fails open (allows the request) while this table or
-- function is missing, so deploying the code before running this file is safe.
--
-- Visitors are identified by a keyed hash of their IP address, never the raw IP.

create table if not exists rate_limit_hits (
  id bigint generated always as identity primary key,
  bucket text not null,
  key text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_rate_limit_hits_lookup on rate_limit_hits (bucket, key, created_at);
create index if not exists idx_rate_limit_hits_created on rate_limit_hits (created_at);

-- RLS on with no policies: only the server's service key can read or write it.
alter table rate_limit_hits enable row level security;

-- Records one hit and says whether it is allowed. Blocked attempts are not recorded,
-- so hammering doesn't extend the wait. The advisory lock makes check-then-insert
-- atomic per (bucket, key), so parallel requests can't slip past the limit.
create or replace function rate_limit_hit(
  p_bucket text,
  p_key text,
  p_max integer,
  p_window_seconds integer
) returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_bucket || ':' || p_key));

  select count(*) into v_count
  from rate_limit_hits
  where bucket = p_bucket
    and key = p_key
    and created_at > now() - make_interval(secs => p_window_seconds);

  if v_count >= p_max then
    return false;
  end if;

  insert into rate_limit_hits (bucket, key) values (p_bucket, p_key);
  return true;
end;
$$;

-- Server only. Supabase grants new functions to anon/authenticated by default.
revoke execute on function rate_limit_hit(text, text, integer, integer) from public, anon, authenticated;

-- Housekeeping, called by the daily cron: no limit window is longer than a day.
create or replace function purge_rate_limit_hits() returns integer
language sql
set search_path = public
as $$
  with deleted as (
    delete from rate_limit_hits where created_at < now() - interval '1 day' returning 1
  )
  select count(*)::integer from deleted;
$$;
revoke execute on function purge_rate_limit_hits() from public, anon, authenticated;

-- ROLLBACK (the app keeps working without these; limits simply stop applying):
-- drop function if exists purge_rate_limit_hits();
-- drop function if exists rate_limit_hit(text, text, integer, integer);
-- drop table if exists rate_limit_hits;
