import { useState } from 'react'
import { Check, ClipboardCheck, FileDown, Minus } from 'lucide-react'
import { useDB } from '../lib/db'
import { classPeriodGrid, remainingCredits } from '../lib/selectors'
import { exportClassPeriodPDF } from '../lib/pdf'
import { fmtDateShort, toISO } from '../lib/format'
import { WEEKDAYS, type AttendanceStatus } from '../lib/types'
import { Button, Card, CreditPill, EmptyState, PageHeader, cn, useToast } from '../components/common'

function monthRange(ym: string): { start: string; end: string; label: string } {
  const [y, m] = ym.split('-').map(Number)
  return {
    start: toISO(new Date(y, m - 1, 1)),
    end: toISO(new Date(y, m, 0)),
    label: `${y}年${m}月`,
  }
}
function thisMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function Attendance() {
  const db = useDB()
  const toast = useToast()
  const [classId, setClassId] = useState<string>(db.classes[0]?.id ?? '')
  const [month, setMonth] = useState(thisMonth())
  const { start, end, label } = monthRange(month)
  const grid = classPeriodGrid(db, classId, start, end)
  const { students, dates, status } = grid

  function exportPDF() {
    exportClassPeriodPDF(db, classId, start, end, label).then(() => toast('已生成 PDF 📄'))
  }

  return (
    <div>
      <PageHeader
        title="考勤统计"
        subtitle="按班级 + 月份查看，可导出周期出勤单给甲方"
        icon={
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-mint/15 text-mint">
            <ClipboardCheck size={20} />
          </span>
        }
        actions={
          <Button variant="grad" onClick={exportPDF} disabled={!classId || dates.length === 0}>
            <FileDown size={16} /> 导出 {label} PDF
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
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
        <label className="ml-auto flex items-center gap-2 rounded-2xl border border-line bg-white/70 px-3 py-1.5 text-xs font-semibold text-ink-soft">
          月份
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="bg-transparent text-ink outline-none" />
        </label>
      </div>

      <div className="mb-3 flex items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-mint/15 text-mint"><Check size={12} strokeWidth={3} /></span>出勤
        </span>
        <span className="flex items-center gap-1">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-neg/15 text-neg"><Minus size={12} strokeWidth={3} /></span>缺勤
        </span>
        <span className="ml-auto">{dates.length} 次课 · {label}</span>
      </div>

      {students.length === 0 || dates.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck size={22} />}
          title={dates.length === 0 ? `${label} 没有上课记录` : '这个班没有在读学生'}
          hint={dates.length === 0 ? '换个月份，或去「每日课程/课程日历」记课后再来' : undefined}
        />
      ) : (
        <Card className="overflow-hidden p-0">
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
                  <th className="px-2 py-2 text-center font-semibold">到</th>
                  <th className="px-2 py-2 text-center font-semibold">缺</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  let present = 0
                  let absent = 0
                  return (
                    <tr key={s.id} className="border-b border-line/60 last:border-0 hover:bg-brand-50/40">
                      <td className="sticky left-0 z-10 bg-white/80 px-5 py-2.5 backdrop-blur">
                        <div className="flex items-center gap-2.5">
                          <span className="grid h-8 w-8 place-items-center rounded-lg text-xs font-bold text-white" style={{ backgroundColor: db.classes.find((c) => c.id === s.classId)?.color }}>
                            {s.name.slice(0, 1)}
                          </span>
                          <span className="font-semibold text-ink">{s.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center"><CreditPill n={remainingCredits(db, s.id)} /></td>
                      {dates.map((d) => {
                        const st = status[s.id]?.[d]
                        if (st === 'present') present += 1
                        if (st === 'absent') absent += 1
                        return (
                          <td key={d} className="px-2 py-2.5 text-center">
                            <Cell st={st} />
                          </td>
                        )
                      })}
                      <td className="px-2 py-2.5 text-center text-xs font-bold tabular-nums text-mint">{present}</td>
                      <td className="px-2 py-2.5 text-center text-xs font-bold tabular-nums text-neg">{absent}</td>
                    </tr>
                  )
                })}
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
    return <span className="mx-auto grid h-6 w-6 place-items-center rounded-full bg-mint/15 text-mint"><Check size={14} strokeWidth={3} /></span>
  if (st === 'absent')
    return <span className="mx-auto grid h-6 w-6 place-items-center rounded-full bg-neg/15 text-neg"><Minus size={14} strokeWidth={3} /></span>
  return <span className="mx-auto block h-1.5 w-1.5 rounded-full bg-line" />
}
