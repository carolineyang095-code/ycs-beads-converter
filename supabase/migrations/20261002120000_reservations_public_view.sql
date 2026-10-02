-- Step A (additive, nothing breaks): public read-only view without client names.
-- The view runs with its owner's rights, so anonymous visitors can read it even
-- after their direct access to public.reservations is removed in step B.
create view public.reservations_public as
  select date, poste, start_hour, type, status, craft_type
  from public.reservations;

-- A simple view is writable by default in Postgres: strip every right first,
-- then give back SELECT only, so nobody can insert/update/delete through it.
revoke all on public.reservations_public from anon, authenticated;
grant select on public.reservations_public to anon, authenticated;
