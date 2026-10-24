---
name: gagrafa-supabase-migrations
description: Use when changing the Gagrafa database, RLS policies, SQL migrations, storage buckets or Supabase client code. Keeps migrations ordered, idempotent and reversible.
---

# Gagrafa Supabase and migrations

## Files and order
`supabase/schema.sql` (run once only) → `migration-booking-safety.sql` (steps A, B, C run one at a time) → `migration-portal-and-ops.sql` → any later `migration-*.sql`.
Never tell anyone to re-run all of `schema.sql` on an existing database (it fails with "type user_role already exists").

## Writing a migration
- New file `supabase/migration-<topic>.sql`. Idempotent: `create ... if not exists`, `add column if not exists`, `drop policy if exists` before `create policy`, guarded `do $$` blocks for types and constraints.
- Backward compatible with the currently deployed app (additive first; destructive changes in a later release).
- Include a commented `-- ROLLBACK:` block with the reverse statements.
- State the exact run order and any step that must be run separately in the file header and in the README.
- Add indexes only for queries that need them (lookups, filters, joins, sorts).

## Booking integrity (do not weaken)
- `is_unit_available()` ignores unpaid pending holds older than 30 minutes.
- `expire_stale_pending_bookings()` cancels stale holds.
- GiST exclusion constraint `bookings_no_overlap` blocks overlapping bookings (error 23P01). Handle 23P01 in actions with a friendly "dates just taken" message.
- `booking_code` is unique and doubles as the Paystack reference.

## RLS
- Every table has RLS on. Guests read only their own rows; staff/admin by role from `profiles.role`.
- Never trust a client-supplied user ID; use the session's `auth.uid()`.
- Service-role client (`createServiceClient`) is server-only and only after an `isStaff()` / `isAdmin()` or verified-portal check.

## Client code
- `await createClient()` (async) in server code; browser client only in client components.
- Row types come from `src/types/database.ts`, generated from the SQL files by `npm run db:types` (`scripts/gen-db-types.mjs`, runs them in PGlite). After adding a migration, add it to `SQL_FILES` in that script, regenerate, and commit the result. Never hand-write row types; use `Tables<"x">`, `TablesInsert`, `TablesUpdate`, `Enums` and `Constants`.
- Photo uploads: browser → Supabase Storage via signed upload URL (avoids Vercel's ~4.5 MB body limit).

## Verify
Run the SQL against a scratch Supabase project or a local Postgres before handing it over. If it cannot be run, say so explicitly and label the migration untested.
