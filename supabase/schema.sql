-- ============================================================
--  Ruby's Room · Supabase 建表脚本
--  使用方法：
--   1. 打开 https://supabase.com/dashboard → 选你的项目
--   2. 左侧 SQL Editor → New query
--   3. 把本文件全部内容粘进去 → Run
--   可重复执行（带 if not exists / drop）。
-- ============================================================

-- 干净起见：先删旧表（首次运行无所谓；想保留旧数据就注释掉这三行）
drop table if exists public.transactions cascade;
drop table if exists public.students cascade;
drop table if exists public.classes cascade;

-- ---------- 班级 / 课程 ----------
create table public.classes (
  id         text primary key,
  name       text not null,
  book       text,
  color      text not null default '#9b6bef',
  created_at timestamptz not null default now()
);

-- ---------- 学生 ----------
create table public.students (
  id         text primary key,
  name       text not null,
  class_id   text references public.classes(id) on delete set null,
  level      text,
  weekday    int,                         -- 1=周一 … 7=周日
  status     text not null default 'active' check (status in ('active','queued')),
  queue_tag  text,
  notes      text,
  created_at timestamptz not null default now()
);

-- ---------- 课时流水（不可变账本）----------
create table public.transactions (
  id         text primary key,
  student_id text not null references public.students(id) on delete cascade,
  type       text not null check (type in ('class','recharge','level_up')),
  date       date not null,
  delta      int not null default 0,       -- class: -1, recharge: +N, level_up: 0
  topic      text,
  notes      text,
  amount     int,                          -- 充值金额 ¥（仅 recharge）
  new_level  text,                         -- 升级后级别（仅 level_up）
  created_at timestamptz not null default now()
);

create index on public.transactions (student_id);
create index on public.transactions (date);
create index on public.students (class_id);

-- ---------- 行级安全 RLS ----------
-- 当前是个人工具、单用户，先用「全开放」策略（持有 anon key 即可读写）。
-- 以后加登录时，把 using/check 改成 auth.uid() 校验即可。
alter table public.classes      enable row level security;
alter table public.students     enable row level security;
alter table public.transactions enable row level security;

-- classes
create policy "cls read"   on public.classes for select using (true);
create policy "cls insert" on public.classes for insert with check (true);
create policy "cls update" on public.classes for update using (true) with check (true);
create policy "cls delete" on public.classes for delete using (true);
-- students
create policy "stu read"   on public.students for select using (true);
create policy "stu insert" on public.students for insert with check (true);
create policy "stu update" on public.students for update using (true) with check (true);
create policy "stu delete" on public.students for delete using (true);
-- transactions
create policy "txn read"   on public.transactions for select using (true);
create policy "txn insert" on public.transactions for insert with check (true);
create policy "txn update" on public.transactions for update using (true) with check (true);
create policy "txn delete" on public.transactions for delete using (true);

-- 跑完后，App 首次启动会自动把示例数据同步进来（见 scripts/seed）。
