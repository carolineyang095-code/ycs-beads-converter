# Supabase RLS policies backup

Project: `rfhvvendmvfcfclsxjxb`
Captured: 2026-10-02 (read from `pg_policies`, before any security change)

Use this file to restore the original access rules if a later change has to be rolled back.

## public.reservations

RLS enabled: yes (not forced)

| Policy name | Command | Roles | USING | WITH CHECK |
|---|---|---|---|---|
| public read reservations | SELECT | public | `true` | |
| public insert reservations | INSERT | public | | `true` |
| public update reservations | UPDATE | public | `true` | |
| public delete reservations | DELETE | public | `true` | |

Table grants (anon and authenticated): SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER.

## public.live_status

RLS enabled: yes (not forced)

| Policy name | Command | Roles | USING | WITH CHECK |
|---|---|---|---|---|
| public read live_status | SELECT | public | `true` | |
| public update live_status | UPDATE | public | `true` | |

Table grants (anon and authenticated): SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER.

## Restore SQL

Running this recreates the original policies exactly as captured above.

```sql
-- reservations
drop policy if exists "public read reservations"   on public.reservations;
drop policy if exists "public insert reservations" on public.reservations;
drop policy if exists "public update reservations" on public.reservations;
drop policy if exists "public delete reservations" on public.reservations;
create policy "public read reservations"   on public.reservations for select to public using (true);
create policy "public insert reservations" on public.reservations for insert to public with check (true);
create policy "public update reservations" on public.reservations for update to public using (true);
create policy "public delete reservations" on public.reservations for delete to public using (true);
grant select, insert, update, delete on public.reservations to anon, authenticated;

-- live_status
drop policy if exists "public read live_status"   on public.live_status;
drop policy if exists "public update live_status" on public.live_status;
create policy "public read live_status"   on public.live_status for select to public using (true);
create policy "public update live_status" on public.live_status for update to public using (true);
grant select, update on public.live_status to anon, authenticated;
```
