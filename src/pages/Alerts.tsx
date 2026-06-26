import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Bell, CalendarCheck, Coins, Crown } from 'lucide-react'
import { useDB } from '../lib/db'
import { calendarDay, classById, lowCreditStudents, rechargeAlerts } from '../lib/selectors'
import { addDays, fmtDateShort, relativeDay, todayISO } from '../lib/format'
import { Badge, Card, CreditPill, EmptyState, PageHeader } from '../components/common'

export default function Alerts() {
  const db = useDB()
  const recharges = rechargeAlerts(db)
  const lows = lowCreditStudents(db)
  const today = todayISO()
  const upcoming = Array.from({ length: 7 }, (_, i) => addDays(today, i)).flatMap((d) =>
    calendarDay(db, d).map((e) => ({ date: d, ...e })),
  )

  const empty = recharges.length === 0 && lows.length === 0 && upcoming.length === 0

  return (
    <div>
      <PageHeader
        title="提醒"
        subtitle="续费 · 课时 · 今日与近期课程"
        icon={
          <span className="relative grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-500">
            <Bell size={20} />
          </span>
        }
      />

      {empty && (
        <EmptyState icon={<Bell size={22} />} title="暂无待办，一切就绪 🎉" hint="有学生到提醒节点或课时不足时，这里会提示" />
      )}

      {/* 续费提醒 */}
      {recharges.length > 0 && (
        <Section title="该提醒续费" icon={<Crown size={16} />} tone="#f1a13a" count={recharges.length}>
          {recharges.map(({ student, taken, cycleSize, over }) => (
            <AlertRow key={student.id} to={`/student/${student.id}`} color="#f1a13a">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-ink">{student.name}</div>
                <div className="text-xs text-muted">
                  {classById(db, student.classId)?.name} · 第 {taken}/{cycleSize} 节
                </div>
              </div>
              <Badge color={over ? '#e96a5b' : '#f1a13a'}>{over ? '已满周期' : '第 9 节'}</Badge>
            </AlertRow>
          ))}
        </Section>
      )}

      {/* 课时不足 */}
      {lows.length > 0 && (
        <Section title="课时不足 / 欠费" icon={<Coins size={16} />} tone="#e96a5b" count={lows.length}>
          {lows.map(({ student, credits }) => (
            <AlertRow key={student.id} to={`/student/${student.id}`} color="#e96a5b">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-ink">{student.name}</div>
                <div className="text-xs text-muted">{classById(db, student.classId)?.name}</div>
              </div>
              <CreditPill n={credits} />
            </AlertRow>
          ))}
        </Section>
      )}

      {/* 今日与近期课程 */}
      {upcoming.length > 0 && (
        <Section title="今日与近期课程" icon={<CalendarCheck size={16} />} tone="#5b8def" count={upcoming.length}>
          {upcoming.slice(0, 12).map(({ date, classId, session, present, absent }) => {
            const cls = classById(db, classId)
            const cancelled = session?.status === 'cancelled'
            const postponed = session?.status === 'postponed'
            return (
              <Link
                key={`${date}-${classId}`}
                to="/calendar"
                className="flex items-center gap-3 rounded-2xl border border-line bg-white/60 px-3.5 py-2.5 transition hover:bg-white"
              >
                <div className="w-16 shrink-0 text-center">
                  <div className="text-[11px] font-bold uppercase text-muted">{relativeDay(date)}</div>
                  <div className="text-xs font-bold tabular-nums text-ink">{fmtDateShort(date)}</div>
                </div>
                <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: cls?.color }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink">{cls?.name}</div>
                  <div className="text-xs text-muted">
                    {cancelled ? '已取消' : postponed ? '已推迟' : present + absent > 0 ? `到 ${present} · 缺 ${absent}` : '待上课'}
                  </div>
                </div>
              </Link>
            )
          })}
        </Section>
      )}
    </div>
  )
}

function Section({
  title,
  icon,
  tone,
  count,
  children,
}: {
  title: string
  icon: ReactNode
  tone: string
  count: number
  children: ReactNode
}) {
  return (
    <Card className="mb-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg text-white" style={{ backgroundColor: tone }}>{icon}</span>
        <h2 className="text-base font-bold text-ink">{title}</h2>
        <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-bold text-muted">{count}</span>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </Card>
  )
}

function AlertRow({ to, color, children }: { to: string; color: string; children: ReactNode }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-2xl border border-line bg-white/60 px-3.5 py-2.5 transition hover:bg-white">
      <AlertCircle size={16} style={{ color }} />
      {children}
    </Link>
  )
}
