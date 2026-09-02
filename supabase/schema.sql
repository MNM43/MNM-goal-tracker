-- ============================================================
-- 目标台 (Goal Tracker) 云端同步 schema
-- 数据库: Supabase (PostgreSQL)
-- 说明:
--   1. 复制本文件全部内容到 Supabase 控制台 → SQL Editor → 运行
--   2. 然后在 Authentication → Providers 中开启 "Email" (魔法链接/OTP)
--   3. 前端「设置 → 云同步」填入 Project URL 与 anon key 即可
-- 行级安全 (RLS) 已开启，所有数据按 user_id 隔离，互不可见。
-- ============================================================

-- ---------- 扩展 ----------
create extension if not exists "uuid-ossp";

-- ---------- 资料 ----------
-- 与 auth.users 一一对应，登录后自动写入
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_self" on public.profiles;
create policy "profiles_self" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- 新用户注册时自动建 profile
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 目标 / 任务 ----------
create table if not exists public.nodes (
  id            text primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  parent_id     text,
  title         text not null default '未命名目标',
  node_type     text not null default 'goal',
  cycle_type    text,
  cycle_key     text,
  planned_start date,
  planned_end   date,
  actual_start  date,
  actual_end    date,
  status        text not null default 'not_started',
  status_locked boolean not null default false,
  depends_on    jsonb not null default '[]'::jsonb,
  progress      integer not null default 0,
  progress_source text not null default 'manual',
  weight        integer not null default 1,
  priority      integer,
  emoji         text,
  note          text not null default '',
  category_id   text,
  color         text,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- ---------- 分类 ----------
create table if not exists public.categories (
  id          text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  parent_id   text,
  name        text not null default '未命名分类',
  color       text not null default 'pastel-blue-purple',
  emoji       text,
  sort_order  integer not null default 0,
  deleted_at  timestamptz
);

-- ---------- 打卡项 ----------
create table if not exists public.checkins (
  id            text primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  node_id       text not null default '',
  title         text not null default '打卡',
  emoji         text,
  period_type   text not null default 'week',
  target_count  integer not null default 3,
  anchor_date   date,
  start_date    date not null default current_date,
  end_date      date,
  category_id   text,
  color         text,
  sort_order    integer not null default 0,
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- ---------- 打卡记录 ----------
create table if not exists public.checkin_logs (
  id           text primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  checkin_id   text not null,
  record_date  date not null,
  status       text not null default 'done',
  is_makeup    boolean not null default false,
  note         text not null default '',
  created_at   timestamptz not null default now()
);

-- ---------- 索引 ----------
create index if not exists nodes_user_idx on public.nodes (user_id);
create index if not exists nodes_parent_idx on public.nodes (user_id, parent_id);
create index if not exists categories_user_idx on public.categories (user_id);
create index if not exists checkins_user_idx on public.checkins (user_id);
create index if not exists checkin_logs_user_idx on public.checkin_logs (user_id, checkin_id);

-- ---------- RLS ----------
alter table public.nodes enable row level security;
alter table public.categories enable row level security;
alter table public.checkins enable row level security;
alter table public.checkin_logs enable row level security;

drop policy if exists "nodes_owner" on public.nodes;
create policy "nodes_owner" on public.nodes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "categories_owner" on public.categories;
create policy "categories_owner" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "checkins_owner" on public.checkins;
create policy "checkins_owner" on public.checkins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "checkin_logs_owner" on public.checkin_logs;
create policy "checkin_logs_owner" on public.checkin_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
