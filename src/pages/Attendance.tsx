import { useMemo, useState } from 'react'
import { Check, ClipboardCheck } from 'lucide-react'
import { useDB } from '../lib/db'
import { attendanceGrid, remainingCredits } from '../lib/selectors'
import { fmtDateShort, todayISO } from '../lib/format'
import { WEEKDAYS } from '../lib/types'
import { Card, CreditPill, EmptyState, PageHeader, cn } from '../components/common'

const DAYS = 10

export default function Attendance() {
  const db = useDB()
  const [classId, setClassId] = useState<string>(db.classes[0]?.id ?? '')

  const grid = useMemo(
    () => attendanceGrid(db, classId, DAYS, todayISO()),
    [db, classId],
  )

  const { students, dates, present } = grid

  return (
    <div>
      <PageHeader
        title="考勤统计"
        subtitle="按班级查看最近出勤记录"
        icon={
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-mint/15 text-mint">
            <ClipboardCheck size={20} />
          </span>
        }
      />

      {/* 班级切换 */}
      <div className="mb-5 flex flex-wrap gap-2">
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

      {students.length === 0 ? (
        <EmptyState icon={<ClipboardCheck size={22} />} title="这个班还没有在读学生" />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between px-5 py-3.5">
            <div className="font-bold text-ink">
              {db.classes.find((c) => c.id === classId)?.name}
            </div>
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-600">
              共 {students.length} 人
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-y border-line bg-white/50 text-xs text-muted">
                  <th className="sticky left-0 z-10 bg-white/80 px-5 py-2.5 text-left font-semibold backdrop-blur">
                    学生
                  </th>
                  <th className="px-3 py-2.5 text-center font-semibold">剩余</th>
                  {dates.map((d) => {
                    const wd = WEEKDAYS[(new Date(d + 'T00:00:00').getDay() || 7) - 1]
                    return (
                      <th key={d} className="px-2 py-2 text-center font-semibold">
                        <div className="text-[10px]" style={{ color: wd.color }}>
                          {wd.short}
                        </div>
                        <div className="tabular-nums text-ink-soft">{fmtDateShort(d)}</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const set = present[s.id]
                  return (
                    <tr key={s.id} className="border-b border-line/60 last:border-0 hover:bg-brand-50/40">
                      <td className="sticky left-0 z-10 bg-white/80 px-5 py-2.5 backdrop-blur">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="grid h-8 w-8 place-items-center rounded-lg text-xs font-bold text-white"
                            style={{
                              backgroundColor: db.classes.find((c) => c.id === s.classId)?.color,
                            }}
                          >
                            {s.name.slice(0, 1)}
                          </span>
                          <span className="font-semibold text-ink">{s.name}</span>
                          <span className="text-xs text-muted">{s.level}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <CreditPill n={remainingCredits(db, s.id)} />
                      </td>
                      {dates.map((d) => {
                        const on = set.has(d)
                        return (
                          <td key={d} className="px-2 py-2.5 text-center">
                            {on ? (
                              <span className="mx-auto grid h-6 w-6 place-items-center rounded-full bg-mint/15 text-mint">
                                <Check size={14} strokeWidth={3} />
                              </span>
                            ) : (
                              <span className="mx-auto block h-1.5 w-1.5 rounded-full bg-line" />
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-white/50 text-xs font-semibold text-muted">
                  <td className="sticky left-0 bg-white/80 px-5 py-2.5 backdrop-blur">出勤人次</td>
                  <td />
                  {dates.map((d) => (
                    <td key={d} className="px-2 py-2 text-center tabular-nums text-ink-soft">
                      {students.filter((s) => present[s.id].has(d)).length}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="px-5 py-3 text-xs text-muted">
            绿色对勾 = 当日已上课打卡。最近 {DAYS} 天记录。
          </div>
        </Card>
      )}
    </div>
  )
}
