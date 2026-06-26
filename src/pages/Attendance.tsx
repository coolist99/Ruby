import { useState } from 'react'
import { Check, ClipboardCheck, Minus } from 'lucide-react'
import { useDB } from '../lib/db'
import { attendanceGrid, remainingCredits } from '../lib/selectors'
import { fmtDateShort } from '../lib/format'
import { WEEKDAYS, type AttendanceStatus } from '../lib/types'
import { Card, CreditPill, EmptyState, PageHeader, cn } from '../components/common'

export default function Attendance() {
  const db = useDB()
  const [classId, setClassId] = useState<string>(db.classes[0]?.id ?? '')
  const grid = attendanceGrid(db, classId)
  const { students, dates, status } = grid

  return (
    <div>
      <PageHeader
        title="考勤统计"
        subtitle="按班级查看最近出勤 / 缺勤记录"
        icon={
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-mint/15 text-mint">
            <ClipboardCheck size={20} />
          </span>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {db.classes.map((c) => {
          const n = db.students.filter((s) => s.classId === c.id && s.status === 'active').length
          return (
            <button
              key={c.id}
              onClick={() => setClassId(c.id)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
                classId === c.id ? 'text-white shadow-soft' : 'bg-white text-ink-soft hover:bg-brand-50',
              )}
              style={classId === c.id ? { backgroundColor: c.color } : undefined}
            >
              {c.name} · {n}
            </button>
          )
        })}
      </div>

      <div className="mb-3 flex items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-mint/15 text-mint"><Check size={12} strokeWidth={3} /></span>
          出勤
        </span>
        <span className="flex items-center gap-1">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-neg/15 text-neg"><Minus size={12} strokeWidth={3} /></span>
          缺勤
        </span>
      </div>

      {students.length === 0 || dates.length === 0 ? (
        <EmptyState icon={<ClipboardCheck size={22} />} title="还没有考勤记录" hint="去「每日课程」给学生打卡后，这里会自动统计" />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between px-5 py-3.5">
            <div className="font-bold text-ink">{db.classes.find((c) => c.id === classId)?.name}</div>
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-600">共 {students.length} 人</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-y border-line bg-white/50 text-xs text-muted">
                  <th className="sticky left-0 z-10 bg-white/80 px-5 py-2.5 text-left font-semibold backdrop-blur">学生</th>
                  <th className="px-3 py-2.5 text-center font-semibold">剩余</th>
                  {dates.map((d) => {
                    const wd = WEEKDAYS[(new Date(d + 'T00:00:00').getDay() || 7) - 1]
                    return (
                      <th key={d} className="px-2 py-2 text-center font-semibold">
                        <div className="text-[10px]" style={{ color: wd.color }}>{wd.short}</div>
                        <div className="tabular-nums text-ink-soft">{fmtDateShort(d)}</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id} className="border-b border-line/60 last:border-0 hover:bg-brand-50/40">
                    <td className="sticky left-0 z-10 bg-white/80 px-5 py-2.5 backdrop-blur">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 place-items-center rounded-lg text-xs font-bold text-white" style={{ backgroundColor: db.classes.find((c) => c.id === s.classId)?.color }}>
                          {s.name.slice(0, 1)}
                        </span>
                        <span className="font-semibold text-ink">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <CreditPill n={remainingCredits(db, s.id)} />
                    </td>
                    {dates.map((d) => (
                      <td key={d} className="px-2 py-2.5 text-center">
                        <Cell st={status[s.id]?.[d]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

function Cell({ st }: { st: AttendanceStatus | undefined }) {
  if (st === 'present')
    return (
      <span className="mx-auto grid h-6 w-6 place-items-center rounded-full bg-mint/15 text-mint">
        <Check size={14} strokeWidth={3} />
      </span>
    )
  if (st === 'absent')
    return (
      <span className="mx-auto grid h-6 w-6 place-items-center rounded-full bg-neg/15 text-neg">
        <Minus size={14} strokeWidth={3} />
      </span>
    )
  return <span className="mx-auto block h-1.5 w-1.5 rounded-full bg-line" />
}
