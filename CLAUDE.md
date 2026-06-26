# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 这是什么

**Ruby's Room** — 独立英语老师的私人学生管理 CRM（"SOFT & HEALING" 柔和治愈风格）。支持**私教（一对一）+ 班课（多名学生）**两种班型。功能：仪表盘、班级管理、全部学生、每日课程/考勤、课程日历（固定排课+临时调整）、待排课、考勤统计、学生档案与报告（可导出 PDF）、提醒面板（续费/课时/日程）。

## 技术栈

- **前端**：Vite + React 18 + TypeScript + React Router v6（纯客户端 SPA）
- **样式**：Tailwind CSS v4（`@tailwindcss/vite` 插件；设计 token 全在 `src/index.css` 的 `@theme`，**没有 tailwind.config**）
- **数据**：Supabase（Postgres）优先，localStorage 兜底
- **PDF**：jsPDF + jspdf-autotable（**动态 import**，导出时才加载，避免拖大主包）
- 图标 lucide-react；字体 Quicksand/Nunito（`index.html`）

## 常用命令

```bash
npm run dev       # 开发服务器 http://localhost:5173
npm run build     # tsc 类型检查 + 生产构建
npm run preview   # 预览构建
npm run seed      # 重新把示例数据灌进 Supabase（清空后重灌，scripts/seed-supabase.mts）
npm run ping      # 自检 Supabase 连通性
```

## 数据模型（核心心智模型）

课时是**派生量**，不是存储字段。五张表（`src/lib/types.ts`；DB 列 snake_case 见 `supabase/schema.sql`）：

- **classes**：`type: 'private' | 'group'`，name/book/color
- **students**：classId、level、`weekday`(1=Mon..7=Sun 固定排课)、`status: 'active'|'queued'`、`cycleSize`(默认10)/`alertAt`(默认9，私教收费周期)
- **sessions**（课次）：classId + date + `status: 'scheduled'|'done'|'cancelled'|'postponed'`，唯一 (class_id,date)
- **attendances**（出勤）：sessionId + studentId + `status: 'present'|'absent'|'late'` + topic/note，唯一 (session_id,student_id)
- **transactions**（流水）：只记 `recharge`(+N,amount) / `level_up`；**上课不在这里**

**派生关系（别冗余存储）**：
- `剩余课时 = Σ充值delta − present出勤数` → `selectors.remainingCredits`
- 私教周期进度 = 「最近一次充值后的 present 数」，到 `alertAt` 提醒续费 → `selectors.cycleProgress`
- 考勤 = attendances；日历条目 = 固定排课(班级星期) + 当天已存在的 sessions → `selectors.calendarDay`
- 打卡 = `ensureSession(classId,date)` + 写一条 present 出勤

派生查询集中在 `src/lib/selectors.ts`。改表或派生逻辑时，仪表盘/考勤/报告/提醒会自动联动。

## 数据层（`src/lib/db.ts`）

- `useDB()` / `useDBReady()`：`useSyncExternalStore` + 模块级单例 `state`。
- **写入乐观**：先同步更新本地 `state`（UI 立即响应），再异步写 Supabase；失败则 `loadDB()` 重拉同步（`safeRemote`）。
- **启动**：配了 Supabase → `loadDB()`；表空且无 `SEED_FLAG` → `bootstrapCloud(buildSeed())` 自动灌示例；连不上/未配 → 回退 localStorage。
- **`actions.*` 是唯一变更入口**（班级/学生 CRUD、recordLesson/batchCheckIn/markAbsent、setAttendanceFor/removeAttendance、ensureSession/setSessionStatus/postponeSession/deleteSession、recharge/levelUp、resetDemo/clearAll）。UI 不直接碰 Supabase。
- 行映射（camel↔snake）在 `src/lib/supabase.ts`（`*Cols` + `row*`）。

## 关键页面

- `pages/Calendar.tsx`：一周日历，固定排课自动显示，课次可取消/推迟/恢复/记考勤。
- `components/AttendanceEditor.tsx`：班课名单考勤（到/缺/撤销+原因、全部到齐、导出PDF）。
- `pages/Alerts.tsx` + `selectors.rechargeAlerts/lowCreditStudents/alertCount`：提醒面板，侧栏红点。
- `pages/StudentReport.tsx`：档案+周期进度条+统一历史（`selectors.studentHistory` 合并 出勤/充值/升级）。

## Supabase 接入（⚠️ 重要约束）

- 凭据在 `.env`（gitignored）：`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`（publishable，客户端可见）。`SUPABASE_DB_URL` 仅一次性建表用。
- **本机无法对用户的 Supabase 执行 DDL**：该项目 DB 是 IPv6-only 直连，本机无 IPv6 路由；Supavisor pooler 租户未开通。→ **建表/改表只能让用户在 Supabase Dashboard → SQL Editor 跑 `supabase/schema.sql`**（跑在 Supabase 服务器，不经过本机）。
- 表建好后，**anon REST 从本机完全可用**（读/写/删都验证过，RLS 当前全开放）——灌数(`npm run seed`)/校验/业务读写都走这条路。
- 改了表结构后：用户重跑 schema.sql（drop+recreate）→ `npm run seed` 重灌示例。
- RLS 全开放（个人单用户）。加多用户/登录时改成 `auth.uid()` 校验。

## 约定

- 设计 token（`--color-brand-*`、`pos/zero/neg`、阴影、动画）在 `src/index.css` 的 `@theme`，新增配色优先扩这里，**别找 tailwind.config**。
- `src/lib/seed.ts` 不能依赖 React（Node 脚本 `scripts/seed-supabase.mts` 也会 import 它灌云库）。
- 学生报告/打印：`window.print()` + `@media print`（`.print-area` / `.no-print`）。
- 部署到大陆可访问：用腾讯云 COS 静态托管（`scripts/upload-cos.mjs`，设 SPA 错误文档=index.html）。Vercel/Netlify 在大陆不可用。
