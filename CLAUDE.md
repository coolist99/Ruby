# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 这是什么

**Ruby's Room** — 独立英语老师的私人学生管理 CRM（"SOFT & HEALING" 柔和治愈风格）。单用户工具，覆盖：仪表盘、全部学生（剩余课时）、每日课程/打卡、待排课排队、考勤统计、学生档案与报告（可导出 PDF）。

## 技术栈

- **前端**：Vite + React 18 + TypeScript + React Router v6（纯客户端 SPA）
- **样式**：Tailwind CSS v4（通过 `@tailwindcss/vite` 插件；设计 token 全在 `src/index.css` 的 `@theme` 里，**没有 tailwind.config 文件**）
- **数据**：Supabase（Postgres）优先，浏览器 localStorage 兜底
- 图标：lucide-react；字体：Quicksand / Nunito（`index.html` 引入）

## 常用命令

```bash
npm run dev       # 启动开发服务器（http://localhost:5173）
npm run build     # tsc 类型检查 + 生产构建到 dist/
npm run preview   # 预览构建产物

node --env-file=.env scripts/ping-supabase.mjs   # 自检能否连上 Supabase
```

## 数据模型（核心心智模型）

课时是**不可变流水账（ledger）**，只有三张表（`src/lib/types.ts`，DB 列为 snake_case 见 `supabase/schema.sql`）：

- **classes**：班级/课程（name, book, color）
- **students**：学生（classId, level, weekday 1=Mon…7=Sun, status: `active`|`queued`, queueTag）
- **transactions**：流水（type: `class`(-1) / `recharge`(+N, amount) / `level_up`(newLevel)，date, topic, notes）

**派生关系（不要冗余存储）**：
- 剩余课时 = 该学生所有 `transactions.delta` 之和 → `selectors.remainingCredits`
- 考勤 = type 为 `class` 的 transactions → `selectors.attendanceGrid`
- 排课 = `student.weekday`；待排课 = `status==='queued'`

派生查询集中在 `src/lib/selectors.ts`。改这三张表或派生逻辑时，仪表盘/考勤/报告会自动联动。

## 数据层架构（`src/lib/db.ts`）

- `useDB()` / `useDBReady()`：基于 `useSyncExternalStore`，模块级单例 `state`。
- **写入是乐观的**：先同步更新本地 `state`（UI 立即响应），再异步写 Supabase；写失败则 `loadDB()` 重新拉取以同步真相（`safeRemote`）。
- **启动流程**：若配置了 Supabase → `loadDB()`；成功且表为空 → `bootstrapCloud(buildSeed())` 自动灌示例数据（用 `SEED_FLAG` 防重复）；连不上/未配置 → 回退 localStorage。
- `actions.*`（checkIn / batchCheckIn / recharge / levelUp / addStudent / updateStudent …）是唯一的变更入口，UI 不直接碰 Supabase。
- 云端读写映射在 `src/lib/supabase.ts`（`studentCols`/`txnCols`/`classCols` + row→camel 映射）。

## Supabase 接入

1. 复制 `.env.example` → `.env`，填 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`（publishable key，客户端可见，OK）。
2. 在 Supabase Dashboard → SQL Editor 跑一次 `supabase/schema.sql`（建表 + 开放 RLS）。
3. 首次启动 App 会自动灌示例数据。

> RLS 当前是**全开放**（个人单用户工具）。加多用户/登录时，把策略改成 `auth.uid()` 校验。

## 目录约定

- 页面在 `src/pages/`（Dashboard / Students / DailyClasses / Queued / Attendance / StudentReport）。
- 通用 UI 原语在 `src/components/common.tsx`（Button / Card / Modal / CreditPill / EmptyState / Toast / PageHeader）。
- 设计 token（颜色 `--color-brand-*`、`pos/zero/neg`、阴影、动画）在 `src/index.css` 的 `@theme`，新增配色优先扩这里。
- 学生报告页用 `window.print()` + `@media print`（`.print-area` / `.no-print`）实现"导出 PDF"。

## 注意事项

- `src/lib/seed.ts` 不能依赖 React（Node 脚本也会 import 它来给云库灌数）。
- Tailwind v4：自定义颜色用 `@theme` 的 `--color-*`，会自动生成 `bg-*`/`text-*` 工具类；**不要**去找 tailwind.config。
