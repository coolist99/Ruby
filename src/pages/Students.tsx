import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, UserPlus, Users } from 'lucide-react'
import { useDB } from '../lib/db'
import { activeStudents, classOf, remainingCredits } from '../lib/selectors'
import { WEEKDAYS } from '../lib/types'
import {
  Button,
  Card,
  CreditPill,
  EmptyState,
  PageHeader,
  TextInput,
  cn,
} from '../components/common'
import { StudentFormModal } from '../components/StudentForm'

export default function Students() {
  const db = useDB()
  const [q, setQ] = useState('')
  const [classFilter, setClassFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'private' | 'group'>('all')
  const [adding, setAdding] = useState(false)

  const list = useMemo(() => {
    return activeStudents(db)
      .filter((s) => (typeFilter === 'all' ? true : classOf(db, s)?.type === typeFilter))
      .filter((s) => (classFilter === 'all' ? true : s.classId === classFilter))
      .filter((s) => s.name.toLowerCase().includes(q.toLowerCase()))
      .map((s) => ({ s, c: remainingCredits(db, s.id) }))
      .sort((a, b) => a.s.name.localeCompare(b.s.name, 'zh'))
  }, [db, q, classFilter, typeFilter])

  return (
    <div>
      <PageHeader
        title="全部学生"
        subtitle={`${activeStudents(db).length} 位在读同学`}
        icon={
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-500">
            <Users size={20} />
          </span>
        }
        actions={
          <Button variant="grad" onClick={() => setAdding(true)}>
            <UserPlus size={16} /> 添加学生
          </Button>
        }
      />

      {/* 搜索 */}
      <div className="relative mb-5">
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
        />
        <TextInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索学生姓名…"
          className="pl-10"
        />
      </div>

      {/* 类型 + 班级筛选 */}
      <div className="mb-5 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted">类型</span>
          <Chip active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>
            全部
          </Chip>
          <Chip active={typeFilter === 'group'} color="#5b8def" onClick={() => setTypeFilter('group')}>
            班课
          </Chip>
          <Chip active={typeFilter === 'private'} color="#ef7aa0" onClick={() => setTypeFilter('private')}>
            私教
          </Chip>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted">班级</span>
          <Chip active={classFilter === 'all'} onClick={() => setClassFilter('all')}>
            全部
          </Chip>
          {db.classes.map((c) => (
            <Chip
              key={c.id}
              active={classFilter === c.id}
              color={c.color}
              onClick={() => setClassFilter(c.id)}
            >
              {c.name}
            </Chip>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={<Users size={22} />}
          title="没有匹配的学生"
          hint="试试别的名字或筛选条件"
        />
      ) : (
        <Card className="p-2 sm:p-3">
          <div className="grid gap-1.5">
            {list.map(({ s, c }) => {
              const cls = classOf(db, s)
              const wd = s.weekday ? WEEKDAYS[s.weekday - 1] : null
              const isPrivate = cls?.type === 'private'
              const typeColor = isPrivate ? '#ef7aa0' : '#5b8def'
              return (
                <Link
                  key={s.id}
                  to={`/student/${s.id}`}
                  className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 transition hover:bg-brand-50/60"
                >
                  <div
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold text-white"
                    style={{ backgroundColor: cls?.color ?? 'var(--color-brand-400)' }}
                  >
                    {s.name.slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink">{s.name}</span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                        style={{ backgroundColor: `${typeColor}1f`, color: typeColor }}
                      >
                        {isPrivate ? '私教' : '班课'}
                      </span>
                      {wd && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{ backgroundColor: `${wd.color}1f`, color: wd.color }}
                        >
                          {wd.cn}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted">
                      {cls ? (
                        `${cls.name} · ${s.level}`
                      ) : (
                        <>
                          <span className="font-semibold text-neg">未分班</span> · {s.level}
                        </>
                      )}
                    </div>
                  </div>
                  {s.notes && <span className="hidden text-xs text-muted sm:block">{s.notes}</span>}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted">剩余</span>
                    <CreditPill n={c} />
                  </div>
                </Link>
              )
            })}
          </div>
        </Card>
      )}

      <StudentFormModal open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}

function Chip({
  children,
  active,
  color,
  onClick,
}: {
  children: React.ReactNode
  active: boolean
  color?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
        active ? 'text-white shadow-soft' : 'bg-white text-ink-soft hover:bg-brand-50',
      )}
      style={active ? { backgroundColor: color ?? 'var(--color-brand-500)' } : undefined}
    >
      {children}
    </button>
  )
}
