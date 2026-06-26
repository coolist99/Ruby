import { useState } from 'react'
import { Check, ClipboardCheck, FileDown, Minus } from 'lucide-react'
import { useDB } from '../lib/db'
import { classById, classPeriodGrid, remainingCredits } from '../lib/selectors'
import { exportClassesPeriodPDF } from '../lib/pdf'
import { fmtDateShort, toISO } from '../lib/format'
import { WEEKDAYS, type AttendanceStatus } from '../lib/types'
import { Button, Card, CreditPill, EmptyState, PageHeader, cn, useToast } from '../components/common'

function monthRange(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return { start: toISO(new Date(y, m - 1, 1)), end: toISO(new Date(y, m, 0)), label: `${y}年${m}月` }
}
function thisMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function Attendance() {
  const db = useDB()
  const toast = useToast()
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(db.classes.filter((c) => c.type === 'group').map((c) => c.id)),
  )
  const [mode, setMode] = useState<'month' | 'range'>('month')
  const [month, setMonth] = useState(thisMonth())
  const mr = monthRange(thisMonth())
  const [rangeStart, setRangeStart] = useState(mr.start)
  const [rangeEnd, setRangeEnd] = useState(mr.end)
  const [focus, setFocus] = useState<string>('')

  const period =
    mode === 'month'
      ? monthRange(month)
      : { start: rangeStart, end: rangeEnd, label: `${fmtDateShort(rangeStart)} – ${fmtDateShort(rangeEnd)}` }

  const ids = [...selected]
  const rows = ids.map((id) => {
    const g = classPeriodGrid(db, id, period.start, period.end)
    let present = 0
    let absent = 0
    g.students.forEach((s) => g.dates.forEach((d) => {
      const st = g.status[s.id]?.[d]
      if (st === 'present') present += 1
      if (st === 'absent') absent += 1
    }))
    return { id, cls: classById(db, id), sessions: g.dates.length, present, absent, grid: g }
  })
  const totalSessions = rows.reduce((a, r) => a + r.sessions, 0)
  const totalPresent = rows.reduce((a, r) => a + r.present, 0)
  const totalAbsent = rows.reduce((a, r) => a + r.absent, 0)
  const rate = (p: number, n: number) => (p + n > 0 ? `${Math.round((p / (p + n)) * 100)}%` : '—')

  const focusId = focus && selected.has(focus) ? focus : ids[0] ?? ''
  const focusRow = rows.find((r) => r.id === focusId)

  function toggle(id: string) {
    setSelected((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function selectAll() {
    setSelected(new Set(db.classes.map((c) => c.id)))
  }
  function clearAll() {
    setSelected(new Set())
  }
  function exportPDF() {
    exportClassesPeriodPDF(db, ids, period.start, period.end, period.label).then(() =>
      toast(`已导出 ${ids.length} 个班 · ${period.label} 📄`),
    )
  }

  return (
    <div>
      <PageHeader
        title="考勤统计"
        subtitle="多选班级 + 选周期，合并导出一份给机构/甲方"
        icon={
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-mint/15 text-mint">
            <ClipboardCheck size={20} />
          </span>
        }
        actions={
          <Button variant="grad" onClick={exportPDF} disabled={ids.length === 0}>
            <FileDown size={16} /> 导出 PDF（{ids.length} 个班）
          </Button>
        }
      />

      {/* 周期 + 班级多选 */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {db.classes.map((c) => {
            const on = selected.has(c.id)
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
                  on ? 'text-white shadow-soft' : 'bg-white text-ink-soft hover:bg-brand-50',
                )}
                style={on ? { backgroundColor: c.color } : undefined}
              >
                {on ? '✓ ' : ''}{c.name}
                <span className="opacity-70"> · {c.type === 'private' ? '私教' : '班课'}</span>
              </button>
            )
          })}
          <button onClick={selectAll} className="rounded-full bg-black/5 px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-black/10">全选</button>
          <button onClick={clearAll} className="rounded-full bg-black/5 px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-black/10">清空</button>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex gap-1 rounded-2xl bg-black/5 p-1 text-xs font-bold">
            <button onClick={() => setMode('month')} className={cn('rounded-xl px-3 py-1', mode === 'month' ? 'bg-white text-ink shadow-sm' : 'text-muted')}>按月</button>
            <button onClick={() => setMode('range')} className={cn('rounded-xl px-3 py-1', mode === 'range' ? 'bg-white text-ink shadow-sm' : 'text-muted')}>自定义区间</button>
          </div>
          {mode === 'month' ? (
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-2xl border border-line bg-white/80 px-3 py-1.5 text-sm outline-none" />
          ) : (
            <div className="flex items-center gap-1 text-xs">
              <input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} className="rounded-xl border border-line bg-white/80 px-2 py-1.5 outline-none" />
              <span className="text-muted">~</span>
              <input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} className="rounded-xl border border-line bg-white/80 px-2 py-1.5 outline-none" />
            </div>
          )}
        </div>
      </div>

      {ids.length === 0 ? (
        <EmptyState icon={<ClipboardCheck size={22} />} title="还没选班级" hint="点上面的班级彩片选择要统计的班" />
      ) : (
        <>
          {/* 汇总表 */}
          <Card className="mb-5 overflow-hidden p-0">
            <div className="flex items-center justify-between px-5 py-3">
              <div className="font-bold text-ink">{period.label} 汇总</div>
              <span className="text-xs text-muted">点某行查看该班明细</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-y border-line bg-white/50 text-xs text-muted">
                    <th className="px-5 py-2 text-left font-semibold">班级</th>
                    <th className="px-3 py-2 text-center font-semibold">课次</th>
                    <th className="px-3 py-2 text-center font-semibold">到课人次</th>
                    <th className="px-3 py-2 text-center font-semibold">缺勤人次</th>
                    <th className="px-5 py-2 text-center font-semibold">出勤率</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => setFocus(r.id)}
                      className={cn('cursor-pointer border-b border-line/60 last:border-0 hover:bg-brand-50/40', focusId === r.id && 'bg-brand-50/70')}
                    >
                      <td className="px-5 py-2.5">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.cls?.color }} />
                          <span className="font-semibold text-ink">{r.cls?.name}</span>
                          <span className="text-xs text-muted">{r.cls?.type === 'private' ? '私教' : '班课'}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{r.sessions}</td>
                      <td className="px-3 py-2.5 text-center font-bold tabular-nums text-mint">{r.present}</td>
                      <td className="px-3 py-2.5 text-center font-bold tabular-nums text-neg">{r.absent}</td>
                      <td className="px-5 py-2.5 text-center tabular-nums">{rate(r.present, r.absent)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-white/50 text-sm font-bold">
                    <td className="px-5 py-2.5 text-ink-soft">合计</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{totalSessions}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-mint">{totalPresent}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-neg">{totalAbsent}</td>
                    <td className="px-5 py-2.5 text-center tabular-nums">{rate(totalPresent, totalAbsent)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {/* 明细矩阵 */}
          {focusRow && focusRow.grid.dates.length > 0 && (
            <Card className="overflow-hidden p-0">
              <div className="flex items-center gap-2 px-5 py-3">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: focusRow.cls?.color }} />
                <span className="font-bold text-ink">{focusRow.cls?.name}</span>
                <span className="text-xs text-muted">· {focusRow.grid.dates.length} 次课</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-y border-line bg-white/50 text-xs text-muted">
                      <th className="sticky left-0 z-10 bg-white/80 px-5 py-2.5 text-left font-semibold backdrop-blur">学生</th>
                      <th className="px-3 py-2.5 text-center font-semibold">剩余</th>
                      {focusRow.grid.dates.map((d) => {
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
                    {focusRow.grid.students.map((s) => {
                      let present = 0
                      let absent = 0
                      return (
                        <tr key={s.id} className="border-b border-line/60 last:border-0 hover:bg-brand-50/40">
                          <td className="sticky left-0 z-10 bg-white/80 px-5 py-2.5 backdrop-blur">
                            <span className="flex items-center gap-2.5">
                              <span className="grid h-8 w-8 place-items-center rounded-lg text-xs font-bold text-white" style={{ backgroundColor: focusRow.cls?.color }}>
                                {s.name.slice(0, 1)}
                              </span>
                              <span className="font-semibold text-ink">{s.name}</span>
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center"><CreditPill n={remainingCredits(db, s.id)} /></td>
                          {focusRow.grid.dates.map((d) => {
                            const st = focusRow.grid.status[s.id]?.[d]
                            if (st === 'present') present += 1
                            if (st === 'absent') absent += 1
                            return <td key={d} className="px-2 py-2.5 text-center"><Cell st={st} /></td>
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
        </>
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
