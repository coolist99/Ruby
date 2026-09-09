-- ============================================================
--  Ruby's Class · 增量迁移 2026-09-09（不丢数据，可重复执行）
--  用途：
--   1) classes.type 新增 'semi'（一对二班型，扣费方式与私教一致）
--   2) attendances 新增 gift 列（赠课标记：不消耗课时、不计收费周期）
--  使用方法：Supabase Dashboard → SQL Editor → 粘贴 → Run。
--  全部语句幂等（drop if exists / add column if not exists），
--  重复执行不会报错、不会改动已有数据。
--
--  说明：classes 的 type 约束在 schema.sql 全量建表时由 Postgres
--  自动命名为 classes_type_check（默认命名 {table}_{column}_check）。
--  为稳妥起见，先查 information_schema 拿到实际约束名再 drop，
--  若不存在则直接 add（首次在空库上执行的情况）。
-- ============================================================

-- ---------- 1. classes.type 允许 'semi' ----------
do $$
declare
  constraint_name text;
begin
  select tc.constraint_name
    into constraint_name
    from information_schema.table_constraints tc
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name
     and ccu.table_schema = tc.table_schema
   where tc.table_schema = 'public'
     and tc.table_name = 'classes'
     and tc.constraint_type = 'CHECK'
     and ccu.column_name = 'type';

  if constraint_name is not null then
    execute format('alter table public.classes drop constraint %I', constraint_name);
  end if;

  alter table public.classes
    add constraint classes_type_check check (type in ('private','semi','group'));
end $$;

-- ---------- 2. attendances.gift 赠课标记 ----------
alter table public.attendances
  add column if not exists gift boolean not null default false;

comment on column public.attendances.gift is '赠课：true 时该节 present 不消耗课时、不计收费周期';
