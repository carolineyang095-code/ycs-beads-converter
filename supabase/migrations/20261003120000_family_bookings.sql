-- Parent-enfant · 亲子 (family bookings), step 2: additive, nothing existing breaks.
-- Adds group_id / party_role, three check constraints, and book_family(), which
-- books 2-4 postes for one family atomically (all or nothing). Service role only.
--
-- Applied manually on 2026-10-03 in the Supabase SQL Editor (wrapped in a
-- transaction with lock_timeout 5s and statement_timeout 30s), not through
-- the migration tool, so it does not appear in supabase_migrations history.
--
-- Rollback (only while no family rows exist):
--   drop function if exists public.book_family(text, integer, integer, text, text);
--   drop index if exists public.reservations_group_id_idx;
--   alter table public.reservations
--     drop constraint if exists reservations_family_fields_check,
--     drop constraint if exists reservations_party_role_check,
--     drop constraint if exists reservations_type_check;
--   alter table public.reservations
--     drop column if exists party_role,
--     drop column if exists group_id;

begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- 1. 两个新栏（空的，不影响现有数据）
alter table public.reservations
  add column if not exists group_id uuid,
  add column if not exists party_role text;

-- 2. 安全规则
alter table public.reservations
  add constraint reservations_type_check
    check (type in ('hourly', 'journee', 'family')),
  add constraint reservations_party_role_check
    check (party_role is null or party_role in ('parent', 'child')),
  add constraint reservations_family_fields_check
    check ((group_id is null) = (party_role is null)
           and (type = 'family') = (group_id is not null));

-- 3. 按家庭查找时更快
create index if not exists reservations_group_id_idx
  on public.reservations (group_id) where group_id is not null;

-- 4. 亲子预约函数（一次订完整个家庭，或者一行都不订）
create or replace function public.book_family(
  p_date         text,
  p_start_hour   integer,
  p_children     integer,
  p_client_name  text,
  p_line_item_id text default null
) returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_line   text := nullif(trim(p_line_item_id), '');
  v_today  text := to_char(now() at time zone 'Europe/Paris', 'YYYY-MM-DD');
  v_day    date;
  v_free   text[] := '{}';
  v_postes text[];
  v_poste  text;
  v_group  uuid;
  v_dup    record;
begin
  -- ① 检查输入
  if p_children is null or p_children not between 1 and 3 then
    return jsonb_build_object('status', 'invalid', 'reason', 'children must be 1..3');
  end if;
  if p_start_hour is null or p_start_hour not between 12 and 16 then
    return jsonb_build_object('status', 'invalid', 'reason', 'start_hour must be 12..16');
  end if;
  if p_date is null or p_date !~ '^\d{4}-\d{2}-\d{2}$' then
    return jsonb_build_object('status', 'invalid', 'reason', 'bad date');
  end if;
  begin
    v_day := p_date::date;
  exception when others then
    return jsonb_build_object('status', 'invalid', 'reason', 'bad date');
  end;
  if extract(isodow from v_day) in (1, 2) then  -- 周一、周二关店
    return jsonb_build_object('status', 'invalid', 'reason', 'closed day');
  end if;

  -- ② 给这一天上锁：同一天的亲子预约排队处理，不会同时抢工位
  perform pg_advisory_xact_lock(hashtextextended('reservations:' || p_date, 0));

  -- ③ 先查是不是重发（必须放在检查空位之前）
  if v_line is not null then
    select r.group_id, array_agg(r.poste order by r.poste) as postes
      into v_dup
      from public.reservations r
     where r.source_line_item_id = any (array[v_line || '-A', v_line || '-B', v_line || '-C', v_line || '-D'])
     group by r.group_id
     limit 1;
    if found then
      return jsonb_build_object('status', 'duplicate', 'group_id', v_dup.group_id, 'postes', to_jsonb(v_dup.postes));
    end if;
  end if;

  -- ④ 检查每个工位。家庭在 h 开始：占 h 和 h+1，h+2 是缓冲。
  --    已有亲子行在 s 开始：占 s、s+1，缓冲 s+2   -> s 在 h-2 到 h+2 之间就冲突
  --    已有按小时行在 s 开始：占 s，缓冲 s+1       -> s 在 h-1 到 h+2 之间就冲突
  --    （缓冲和缓冲重叠是允许的，上面的范围已经考虑到了）
  foreach v_poste in array array['A', 'B', 'C', 'D'] loop
    if exists (
      select 1 from public.reservations r
       where r.date = p_date and r.poste = v_poste
         and (   r.type = 'journee'
              or (r.type = 'family' and r.start_hour between p_start_hour - 2 and p_start_hour + 2)
              or (coalesce(r.type, 'hourly') not in ('journee', 'family')
                  and r.start_hour between p_start_hour - 1 and p_start_hour + 2))
    ) then
      continue;
    end if;
    -- 只限今天：Timer 上正在使用的工位不能分配
    if p_date = v_today and exists (
      select 1 from public.live_status l where l.poste = v_poste and l.busy is true
    ) then
      continue;
    end if;
    v_free := v_free || v_poste;
  end loop;

  -- ⑤ 工位不够：一行都不插入
  if coalesce(array_length(v_free, 1), 0) < p_children + 1 then
    return jsonb_build_object('status', 'conflict', 'needed', p_children + 1, 'free_postes', to_jsonb(v_free));
  end if;

  -- ⑥ 一次插入整个家庭：第一个工位给家长，后面的给孩子
  v_postes := v_free[1:p_children + 1];
  v_group  := gen_random_uuid();
  begin
    insert into public.reservations
      (date, poste, start_hour, type, status, client_name,
       source_line_item_id, craft_type, group_id, party_role)
    select p_date, p.poste, p_start_hour, 'family', 'confirmed',
           coalesce(nullif(trim(p_client_name), ''), 'Client'),
           case when v_line is null then null else v_line || '-' || p.poste end,
           'fuse_beads', v_group,
           case when p.ord = 1 then 'parent' else 'child' end
      from unnest(v_postes) with ordinality as p(poste, ord);
  exception when unique_violation then
    return jsonb_build_object('status', 'duplicate');
  end;

  return jsonb_build_object('status', 'booked', 'group_id', v_group, 'postes', to_jsonb(v_postes));
end;
$$;

comment on function public.book_family(text, integer, integer, text, text) is
  'Parent-enfant: books 2-4 postes atomically (all or nothing). Service role only.';

-- 5. 只有 service role 能调用
revoke all on function public.book_family(text, integer, integer, text, text) from public, anon, authenticated;
grant execute on function public.book_family(text, integer, integer, text, text) to service_role;

notify pgrst, 'reload schema';
commit;
