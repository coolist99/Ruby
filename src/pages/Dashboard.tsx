import { Link } from 'react-router-dom'
import { AlertCircle, CalendarHeart, Clock4, Sparkles, Users } from 'lucide-react'
import { useDB } from '../lib/db'
import {
  activeStudents,
  classOf,
  queuedStudents,
  remainingCredits,
  studentsOnWeekday,
  weeklyCounts,
} from '../lib/selectors'
import { WEEKDAYS, type Weekday } from '../lib/types'
import { Badge, Card, CreditPill, EmptyState } from '../components/common'

export default function Dashboard() {
  const db = useDB()
  const active = activeStudents(db)
  const queued = queuedStudents(db)
  const counts = weeklyCounts(db)
  const today = (new Date().getDay() || 7) as Weekday
  const todayName = WEEKDAYS[today - 1]

  const withCredits = active
    .map((s) => ({ s, c: remainingCredits(db, s.id) }))
    .sort((a, b) => a.c - b.c)
  const attention = withCredits.filter((x) => x.c <= 0)
  const weekTotal = counts.reduce((a, b) => a + b, 0)

  const hour = new Date().getHours()
  const greet = hour < 11 ? '早安' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好'

  const stats = [
    {
      label: '全部学生',
      value: active.length,
      icon: <Users size={18} />,
      tint: 'var(--color-brand-500)',
      to: '/students',
    },
    {
      label: '待排课',
      value: queued.length,
      icon: <Clock4 size={18} />,
      tint: 'var(--color-neg)',
      to: '/queued',
    },
    {
      label: `${todayName.cn}课节`,
      value: studentsOnWeekday(db, today).length,
      icon: <CalendarHeart size={18} />,
      tint: 'var(--color-rose)',
      to: `/daily?day=${today}`,
    },
    {
      label: '本周课节',
      value: weekTotal,
      icon: <Sparkles size={18} />,
      tint: 'var(--color-mint)',
      to: '/daily',
    },
  ]

  return (
    <div>
      {/* 问候 */}
      <div className="card mb-6 overflow-hidden p-0">
        <div
          className="relative px-6 py-7 sm:px-8"
          style={{
            backgroundImage:
              'linear-gradient(120deg, var(--color-brand-400), var(--color-brand-500) 55%, var(--color-rose))',
          }}
        >
          <div className="relative z-10">
            <div className="text-sm font-semibold text-white/80">{greet}，欢迎回来</div>
            <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
              Hello, Ruby! <span className="ml-1">☁️</span>
            </h1>
            <p className="mt-1 text-sm text-white/85">愿你拥有温柔的一天，今天也是被小朋友们治愈的一天。</p>
          </div>
          <div className="pointer-events-none absolute -right-6 -top-8 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
          <div className="pointer-events-none absolute bottom-0 right-10 h-24 w-24 rounded-full bg-white/10 blur-xl" />
        </div>
      </div>

      {/* 统计卡 */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((st) => (
          <Link
            key={st.label}
            to={st.to}
            className="card group flex items-center gap-4 p-5 transition hover:-translate-y-0.5 hover:shadow-pop"
          >
            <span
              className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white shadow-soft"
              style={{ backgroundColor: st.tint }}
            >
              {st.icon}
            </span>
            <div>
              <div className="text-2xl font-bold tabular-nums text-ink">{st.value}</div>
              <div className="text-xs font-semibold text-muted">{st.label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* 需要关注 */}
      {attention.length > 0 && (
        <div
          className="mb-6 flex flex-wrap items-center gap-3 rounded-3xl border border-neg/20 bg-neg/8 px-5 py-4"
          style={{ backgroundColor: 'rgba(233,106,91,0.08)' }}
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-neg/15 text-neg">
            <AlertCircle size={18} />
          </span>
          <div className="text-sm font-semibold text-ink">
            有 {attention.length} 位同学课时不足，记得提醒续费哦
          </div>
          <div className="flex flex-wrap gap-2">
            {attention.map(({ s, c }) => (
              <Link
                key={s.id}
                to={`/student/${s.id}`}
                className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink shadow-sm transition hover:bg-brand-50"
              >
                {s.name} <span className="text-neg">{c}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* 剩余课时榜 */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-ink">剩余课时</h2>
            <Link to="/students" className="text-xs font-semibold text-brand-500 hover:underline">
              查看全部 →
            </Link>
          </div>
          {withCredits.length === 0 ? (
            <EmptyState title="还没有学生" hint="去「待排课」或「全部学生」添加吧" />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {withCredits.slice(0, 10).map(({ s, c }) => {
                const cls = classOf(db, s)
                return (
                  <Link
                    key={s.id}
                    to={`/student/${s.id}`}
                    className="group flex items-center gap-3 rounded-2xl border border-line bg-white/60 px-3.5 py-2.5 transition hover:border-brand-200 hover:bg-white"
                  >
                    <div
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold text-white"
                      style={{ backgroundColor: cls?.color ?? 'var(--color-brand-400)' }}
                    >
                      {s.name.slice(0, 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-ink">{s.name}</div>
                      <div className="truncate text-xs text-muted">
                        {cls?.name} · {s.level}
                      </div>
                    </div>
                    <CreditPill n={c} />
                  </Link>
                )
              })}
            </div>
          )}
        </Card>

        {/* 本周课表 + 待排课 */}
        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-4 text-lg font-bold text-ink">本周课表</h2>
            <div className="flex items-end justify-between gap-2">
              {WEEKDAYS.map((d) => {
                const n = counts[d.value - 1]
                const max = Math.max(...counts, 1)
                const h = Math.max(8, (n / max) * 96)
                const isToday = d.value === today
                return (
                  <Link
                    key={d.value}
                    to={`/daily?day=${d.value}`}
                    className="flex flex-1 flex-col items-center gap-2"
                  >
                    <span className="text-xs font-bold tabular-nums text-ink-soft">{n}</span>
                    <span
                      className="w-full rounded-t-xl transition group-hover:opacity-90"
                      style={{
                        height: h,
                        backgroundColor: d.color,
                        opacity: isToday ? 1 : 0.55,
                      }}
                    />
                    <span
                      className="text-[10px] font-bold uppercase"
                      style={{ color: isToday ? d.color : 'var(--color-muted)' }}
                    >
                      {d.short}
                    </span>
                  </Link>
                )
              })}
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink">待排课</h2>
              <Link to="/queued" className="text-xs font-semibold text-brand-500 hover:underline">
                排课 →
              </Link>
            </div>
            {queued.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">全部同学都已排课 🎉</p>
            ) : (
              <div className="flex flex-col gap-2">
                {queued.slice(0, 4).map((s) => {
                  const cls = classOf(db, s)
                  return (
                    <Link
                      key={s.id}
                      to={`/student/${s.id}`}
                      className="flex items-center gap-3 rounded-2xl px-2 py-1.5 transition hover:bg-white"
                    >
                      <Badge color={cls?.color}>{s.queueTag ?? cls?.name}</Badge>
                      <span className="flex-1 text-sm font-semibold text-ink">{s.name}</span>
                      <span className="text-xs text-muted">{cls?.name}</span>
                    </Link>
                  )
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
