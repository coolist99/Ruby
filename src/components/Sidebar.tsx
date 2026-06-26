// 侧边栏：品牌 + 导航 + WEEKLY 周课表
import { NavLink, useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  ClipboardCheck,
  Clock,
  LayoutDashboard,
  type LucideIcon,
  RotateCcw,
  Users,
} from 'lucide-react'
import { useDB, actions, isCloud } from '../lib/db'
import { activeStudents, queuedStudents, weeklyCounts } from '../lib/selectors'
import { WEEKDAYS, type Weekday } from '../lib/types'
import { useToast, Logo, cn } from './common'

type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  count?: 'active' | 'queued'
}

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/students', label: '全部学生', icon: Users, count: 'active' },
  { to: '/daily', label: '每日课程', icon: CalendarDays },
  { to: '/queued', label: '待排课', icon: Clock, count: 'queued' },
  { to: '/attendance', label: '考勤统计', icon: ClipboardCheck },
]

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const db = useDB()
  const toast = useToast()
  const navigate = useNavigate()
  const active = activeStudents(db).length
  const queued = queuedStudents(db).length
  const counts = weeklyCounts(db)
  const today = (new Date().getDay() || 7) as Weekday

  return (
    <div className="flex h-full flex-col gap-5 p-5">
      {/* 品牌 */}
      <div className="flex items-center gap-3 px-1 pt-1">
        <Logo size={44} />
        <div className="leading-tight">
          <div className="text-lg font-bold tracking-tight text-ink">Ruby's Room</div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-400">
            Soft &amp; Healing
          </div>
        </div>
      </div>

      {/* 导航 */}
      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const Icon = item.icon
          const count =
            item.count === 'active' ? active : item.count === 'queued' ? queued : null
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition',
                  isActive
                    ? 'btn-grad shadow-soft'
                    : 'text-ink-soft hover:bg-white/70 hover:text-ink',
                )
              }
            >
              <Icon size={18} className="shrink-0" />
              <span className="flex-1">{item.label}</span>
              {count !== null && (
                <span
                  className={cn(
                    'min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-bold tabular-nums',
                    item.count === 'queued'
                      ? 'bg-neg/15 text-neg'
                      : 'bg-black/5 text-muted',
                  )}
                >
                  {count}
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* WEEKLY 周课表 */}
      <div className="mt-auto">
        <div className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
          Weekly
        </div>
        <div className="card grid grid-cols-7 gap-1 p-2">
          {WEEKDAYS.map((d) => {
            const isToday = d.value === today
            const n = counts[d.value - 1]
            return (
              <button
                key={d.value}
                type="button"
                onClick={() => {
                  navigate(`/daily?day=${d.value}`)
                  onNavigate?.()
                }}
                className="flex flex-col items-center gap-1 rounded-xl py-1.5 transition hover:bg-black/5"
              >
                <span
                  className="text-[10px] font-bold uppercase"
                  style={{ color: d.color }}
                >
                  {d.short}
                </span>
                <span
                  className={cn(
                    'grid h-6 w-6 place-items-center rounded-full text-xs font-bold tabular-nums',
                    isToday ? 'text-white' : 'text-ink',
                  )}
                  style={
                    isToday
                      ? { backgroundColor: d.color }
                      : n > 0
                        ? { backgroundColor: `${d.color}1f` }
                        : undefined
                  }
                >
                  {n}
                </span>
              </button>
            )
          })}
        </div>

        <button
          onClick={() => {
            actions.resetDemo()
            toast('已重置为示例数据', 'info')
          }}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-semibold text-muted transition hover:bg-white/70 hover:text-ink"
        >
          <RotateCcw size={13} />
          重置示例数据
        </button>

        <div className="mt-2 px-1 text-center text-[10px] font-semibold text-muted">
          {isCloud() ? '☁️ 云端已同步' : '💾 本地存储'}
        </div>
      </div>
    </div>
  )
}
