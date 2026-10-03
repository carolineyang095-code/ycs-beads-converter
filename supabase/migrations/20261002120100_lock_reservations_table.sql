-- Step B: anonymous visitors lose all direct access to public.reservations.
-- The Shopify webhook (reservation-email) and studio-admin use the service
-- role key, which bypasses RLS, so they keep working.
--
-- Applied manually on 2026-10-02 in the Supabase SQL Editor (wrapped in a
-- transaction with lock_timeout 5s and statement_timeout 30s), not through
-- the migration tool, so it does not appear in supabase_migrations history.
drop policy if exists "public read reservations"   on public.reservations;
drop policy if exists "public insert reservations" on public.reservations;
drop policy if exists "public update reservations" on public.reservations;
drop policy if exists "public delete reservations" on public.reservations;

revoke all on public.reservations from anon, authenticated;
