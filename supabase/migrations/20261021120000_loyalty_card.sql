-- ============================================================
-- Carte de fidélité Open Studio · 印章卡
-- 4 个章一张卡：第 2 个章送智能板升级券，第 4 个章送免费日兑换码。
-- 只有拼豆全天，或按小时满 4 小时才盖章；一人一天最多一个章。
-- 章、升级券、兑换码都是一年有效。
--
-- 所有新表都锁住（RLS 打开、没有 policy、anon/authenticated 没有权限），
-- 只有 Edge Function（service role）能读写。现有表只加 4 个可空字段。
-- ============================================================

-- 1) reservations：记住客人邮箱、订单、语言、是否用了奖励码（全部可空，旧数据不受影响）
alter table public.reservations add column if not exists client_email text;
alter table public.reservations add column if not exists client_locale text;
alter table public.reservations add column if not exists shopify_order_id text;
alter table public.reservations add column if not exists reward_code text;

-- 2) 会员：一个邮箱一个人，card_token 是客人印章卡私人链接里的钥匙
create table if not exists public.loyalty_members (
  email        text primary key check (email = lower(email) and position('@' in email) > 1),
  display_name text,
  lang         text not null default 'fr' check (lang in ('fr', 'en', 'zh')),
  card_token   uuid not null unique default gen_random_uuid(),
  created_at   timestamptz not null default now()
);

-- 3) 印章
create table if not exists public.loyalty_stamps (
  id             bigint generated always as identity primary key,
  email          text not null references public.loyalty_members(email) on update cascade,
  stamped_on     date not null,
  card_no        int not null check (card_no >= 1),
  position       smallint not null check (position between 1 and 4),
  reason         text not null check (reason in ('journee', 'hourly_4h', 'manual')),
  reservation_id bigint references public.reservations(id) on delete set null,
  created_at     timestamptz not null default now(),
  revoked_at     timestamptz
);
create unique index if not exists loyalty_stamps_one_per_day
  on public.loyalty_stamps (email, stamped_on) where revoked_at is null;
create index if not exists loyalty_stamps_email_idx on public.loyalty_stamps (email);

-- 4) 兑换码池：预先在 Shopify 建好的一批码（每个码只能用一次），集满时取一个
create table if not exists public.loyalty_codes (
  code                text primary key check (code = upper(code)),
  shopify_discount_id text not null,
  created_at          timestamptz not null default now()
);

-- 5) 奖励：upgrade = 智能板升级券（第 2 个章），free_day = 免费日（第 4 个章，带兑换码）
create table if not exists public.loyalty_rewards (
  id         bigint generated always as identity primary key,
  email      text not null references public.loyalty_members(email) on update cascade,
  card_no    int not null,
  kind       text not null check (kind in ('upgrade', 'free_day')),
  stamp_id   bigint not null references public.loyalty_stamps(id),
  code       text references public.loyalty_codes(code),
  issued_at  timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at    timestamptz,
  used_note  text,
  revoked_at timestamptz
);
create unique index if not exists loyalty_rewards_one_per_card
  on public.loyalty_rewards (email, card_no, kind) where revoked_at is null;
-- 一个码永远只属于一个奖励（撤销后也不回收，避免同一个码发给两个人）
create unique index if not exists loyalty_rewards_code_once
  on public.loyalty_rewards (code) where code is not null;

-- 6) 锁表
alter table public.loyalty_members enable row level security;
alter table public.loyalty_stamps  enable row level security;
alter table public.loyalty_codes   enable row level security;
alter table public.loyalty_rewards enable row level security;
revoke all on public.loyalty_members, public.loyalty_stamps, public.loyalty_codes, public.loyalty_rewards
  from anon, authenticated;

-- 7) 盖章：一次完成「建会员 → 检查今天有没有盖过 → 盖章 → 第 2/4 个章发奖励」
create or replace function public.loyalty_add_stamp(
  p_email          text,
  p_name           text,
  p_date           date,
  p_reason         text,
  p_reservation_id bigint,
  p_lang           text
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_email  text := lower(trim(coalesce(p_email, '')));
  v_lang   text := case when p_lang in ('fr', 'en', 'zh') then p_lang else 'fr' end;
  v_card   int;
  v_count  int;
  v_pos    int;
  v_stamp  bigint;
  v_code   text;
  v_reward text;
  v_token  uuid;
begin
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return jsonb_build_object('status', 'invalid_email');
  end if;
  if p_reason not in ('journee', 'hourly_4h', 'manual') then
    return jsonb_build_object('status', 'invalid_reason');
  end if;
  if p_date is null or p_date > (now() at time zone 'Europe/Paris')::date then
    return jsonb_build_object('status', 'invalid_date');
  end if;

  insert into loyalty_members (email, display_name, lang)
  values (v_email, nullif(trim(coalesce(p_name, '')), ''), v_lang)
  on conflict (email) do update
    set display_name = coalesce(loyalty_members.display_name, excluded.display_name);

  -- 同一个客人同时只处理一次盖章
  perform 1 from loyalty_members where email = v_email for update;

  if exists (select 1 from loyalty_stamps
             where email = v_email and stamped_on = p_date and revoked_at is null) then
    return jsonb_build_object('status', 'already_today');
  end if;

  -- 当前这张卡 = 已集满的卡数 + 1
  select coalesce(max(card_no), 0) + 1 into v_card
  from loyalty_rewards
  where email = v_email and kind = 'free_day' and revoked_at is null;

  -- 这张卡上还有效（一年内、没撤销）的章
  select count(*) into v_count
  from loyalty_stamps
  where email = v_email and card_no = v_card and revoked_at is null
    and stamped_on > (now() at time zone 'Europe/Paris')::date - 365;

  if p_date <= (now() at time zone 'Europe/Paris')::date - 365 then
    return jsonb_build_object('status', 'too_old');
  end if;

  v_pos := least(v_count + 1, 4);

  insert into loyalty_stamps (email, stamped_on, card_no, position, reason, reservation_id)
  values (v_email, p_date, v_card, v_pos, p_reason, p_reservation_id)
  returning id into v_stamp;

  if v_pos = 2 then
    insert into loyalty_rewards (email, card_no, kind, stamp_id, expires_at)
    values (v_email, v_card, 'upgrade', v_stamp, now() + interval '1 year')
    on conflict do nothing;
    if found then v_reward := 'upgrade'; end if;
  elsif v_pos = 4 then
    select c.code into v_code
    from loyalty_codes c
    where not exists (select 1 from loyalty_rewards r where r.code = c.code)
    order by c.created_at, c.code
    limit 1
    for update skip locked;
    if v_code is null then
      raise exception 'loyalty code pool empty';
    end if;
    insert into loyalty_rewards (email, card_no, kind, stamp_id, code, expires_at)
    values (v_email, v_card, 'free_day', v_stamp, v_code, now() + interval '1 year');
    v_reward := 'free_day';
  end if;

  select card_token into v_token from loyalty_members where email = v_email;

  return jsonb_build_object(
    'status', 'ok', 'stamp_id', v_stamp, 'position', v_pos, 'card_no', v_card,
    'reward', v_reward, 'code', v_code, 'token', v_token
  );
end;
$$;

-- 8) 撤销：只能撤销这个客人最近的一个章，而且它发出的奖励还没用过
create or replace function public.loyalty_revoke_stamp(p_stamp_id bigint)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  s        record;
  v_latest bigint;
begin
  select * into s from loyalty_stamps where id = p_stamp_id and revoked_at is null;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  perform 1 from loyalty_members where email = s.email for update;

  select id into v_latest from loyalty_stamps
  where email = s.email and revoked_at is null
  order by stamped_on desc, id desc limit 1;
  if v_latest <> s.id then
    return jsonb_build_object('status', 'not_latest');
  end if;

  if exists (select 1 from loyalty_rewards
             where stamp_id = s.id and used_at is not null and revoked_at is null) then
    return jsonb_build_object('status', 'reward_used');
  end if;

  update loyalty_rewards set revoked_at = now() where stamp_id = s.id and revoked_at is null;
  update loyalty_stamps  set revoked_at = now() where id = s.id;
  return jsonb_build_object('status', 'ok');
end;
$$;

-- 9) 兑换：Shopify 订单里出现兑换码时调用（webhook）
create or replace function public.loyalty_redeem_code(p_code text, p_email text, p_order text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  r       record;
  v_first boolean;
begin
  select * into r from loyalty_rewards
  where code = upper(trim(coalesce(p_code, ''))) and kind = 'free_day'
  for update;
  if not found then
    return jsonb_build_object('status', 'not_loyalty');
  end if;

  v_first := r.used_at is null;
  if v_first then
    update loyalty_rewards set used_at = now(), used_note = p_order where id = r.id;
  end if;

  return jsonb_build_object(
    'status', case when v_first then 'ok' else 'already_used' end,
    'owner', r.email,
    'used_note', r.used_note,
    'email_match', r.email = lower(trim(coalesce(p_email, ''))),
    'expired', r.expires_at < now(),
    'revoked', r.revoked_at is not null
  );
end;
$$;

revoke all on function public.loyalty_add_stamp(text, text, date, text, bigint, text) from public, anon, authenticated;
revoke all on function public.loyalty_revoke_stamp(bigint) from public, anon, authenticated;
revoke all on function public.loyalty_redeem_code(text, text, text) from public, anon, authenticated;
grant execute on function public.loyalty_add_stamp(text, text, date, text, bigint, text) to service_role;
grant execute on function public.loyalty_revoke_stamp(bigint) to service_role;
grant execute on function public.loyalty_redeem_code(text, text, text) to service_role;
