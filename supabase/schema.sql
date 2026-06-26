-- ============================================================
--  Ruby's Room · Supabase 建表脚本 v2（班型 + 周期 + 课次 + 出勤）
--  使用方法：Supabase Dashboard → SQL Editor → 粘贴 → Run（可重复执行）
-- ============================================================

drop table if exists public.attendances cascade;
drop table if exists public.sessions cascade;
drop table if exists public.transactions cascade;
drop table if exists public.students cascade;
drop table if exists public.classes cascade;

-- ---------- 班级 / 课程 ----------
create table public.classes (
  id         text primary key,
  name       text not null,
  book       text,
  color      text not null default '#9b6bef',
  type       text not null default 'group' check (type in ('private','group')),  -- 私教 / 班课
  created_at timestamptz not null default now()
);

-- ---------- 学生 ----------
create table public.students (
  id         text primary key,
  name       text not null,
  class_id   text references public.classes(id) on delete set null,
  level      text,
  weekday    int,                         -- 1=周一 … 7=周日（固定排课）
  status     text not null default 'active' check (status in ('active','queued')),
  queue_tag  text,
  notes      text,
  cycle_size int not null default 10,      -- 私教收费周期长度（默认10节）
  alert_at   int not null default 9,       -- 周期内第几节提醒续费（默认第9节）
  created_at timestamptz not null default now()
);

-- ---------- 课次（一次具体的课）----------
create table public.sessions (
  id         text primary key,
  class_id   text not null references public.classes(id) on delete cascade,
  date       date not null,
  status     text not null default 'scheduled' check (status in ('scheduled','done','cancelled','postponed')),
  note       text,
  created_at timestamptz not null default now(),
  unique (class_id, date)
);

-- ---------- 出勤（每个学生在某课次的出勤状态）----------
create table public.attendances (
  id         text primary key,
  session_id text not null references public.sessions(id) on delete cascade,
  student_id text not null references public.students(id) on delete cascade,
  status     text not null default 'present' check (status in ('present','absent','late')),
  topic      text,
  note       text,
  created_at timestamptz not null default now(),
  unique (session_id, student_id)
);

-- ---------- 流水（仅充值 / 升级；上课次数由 attendances 派生）----------
create table public.transactions (
  id         text primary key,
  student_id text not null references public.students(id) on delete cascade,
  type       text not null check (type in ('recharge','level_up')),
  date       date not null,
  delta      int not null default 0,
  notes      text,
  amount     int,                          -- 充值金额 ¥
  new_level  text,                          -- 升级后级别
  created_at timestamptz not null default now()
);

create index on public.sessions (class_id, date);
create index on public.attendances (session_id);
create index on public.attendances (student_id);
create index on public.transactions (student_id);

-- ---------- 行级安全（个人单用户，先全开放；加登录时改 auth.uid()）----------
alter table public.classes      enable row level security;
alter table public.students     enable row level security;
alter table public.sessions     enable row level security;
alter table public.attendances  enable row level security;
alter table public.transactions enable row level security;

create policy "cls r" on public.classes for select using (true);
create policy "cls c" on public.classes for insert with check (true);
create policy "cls u" on public.classes for update using (true) with check (true);
create policy "cls d" on public.classes for delete using (true);
create policy "stu r" on public.students for select using (true);
create policy "stu c" on public.students for insert with check (true);
create policy "stu u" on public.students for update using (true) with check (true);
create policy "stu d" on public.students for delete using (true);
create policy "ses r" on public.sessions for select using (true);
create policy "ses c" on public.sessions for insert with check (true);
create policy "ses u" on public.sessions for update using (true) with check (true);
create policy "ses d" on public.sessions for delete using (true);
create policy "att r" on public.attendances for select using (true);
create policy "att c" on public.attendances for insert with check (true);
create policy "att u" on public.attendances for update using (true) with check (true);
create policy "att d" on public.attendances for delete using (true);
create policy "txn r" on public.transactions for select using (true);
create policy "txn c" on public.transactions for insert with check (true);
create policy "txn u" on public.transactions for update using (true) with check (true);
create policy "txn d" on public.transactions for delete using (true);
