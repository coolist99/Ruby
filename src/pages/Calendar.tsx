import { useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, RotateCcw, XCircle, Clock } from 'lucide-react'
import { actions, useDB } from '../lib/db'
import { calendarDay, classById } from '../lib/selectors'
import { addDays, fmtDateShort, toISO, todayISO } from '../lib/format'
import { WEEKDAYS, type Weekday } from '../lib/types'
import { Badge, Button, Card, EmptyState, Modal, PageHeader, cn } from '../components/common'
import { AttendanceEditor } from '../components/AttendanceEditor'

function mondayOf(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  const dow = d.getDay() || 7
  d.setDate(d.getDate() - (dow - 1))
  return toISO(d)
}

export default function Calendar() {
  const db = useDB()
  const [weekStart, setWeekStart] = useState(mondayOf(todayISO()))
  const [editor, setEditor] = useState<{ classId: string; date: string } | null>(null)
  const [postpone, setPostpone] = useState<{ classId: string; date: string } | null>(null)

  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const today = todayISO()

  return (
    <div>
      <PageHeader
        title="课程日历"
        subtitle="固定时段自动排课；单次课可取消 / 推迟"
        icon={
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-500">
            <CalendarDays size={20} />
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="soft" onClick={() => setWeekStart(addDays(weekStart, -7))}>
              <ChevronLeft size={16} />
            </Button>
            <Button variant="soft" onClick={() => setWeekStart(mondayOf(todayISO()))}>本周</Button>
            <Button variant="soft" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              <ChevronRight size={16} />
            </Button>
          </div>
        }
      />

      <div className="mb-4 text-sm font-semibold text-muted">
        {fmtDateShort(dates[0])} – {fmtDateShort(dates[6])}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-7">
        {dates.map((date) => {
          const wd = WEEKDAYS[(new Date(date + 'T00:00:00').getDay() || 7) as Weekday - 1]
          const entries = calendarDay(db, date)
          const isToday = date === today
          return (
            <div key={date} className={cn('rounded-3xl border p-3', isToday ? 'border-brand-200 bg-brand-50/40' : 'border-line bg-white/50')}>
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase" style={{ color: wd.color }}>{wd.cn}</span>
                <span className={cn('text-xs font-bold tabular-nums', isToday ? 'rounded-full bg-brand-500 px-2 py-0.5 text-white' : 'text-muted')}>
                  {fmtDateShort(date)}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {entries.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-line py-4 text-center text-xs text-muted">无课</div>
                ) : (
                  entries.map((e) => (
                    <Entry
                      key={e.classId}
                      classId={e.classId}
                      sessionStatus={e.session?.status}
                      present={e.present}
                      absent={e.absent}
                      hasOverride={!!e.session}
                      date={date}
                      onRoll={() => setEditor({ classId: e.classId, date })}
                      onCancel={() => actions.setSessionStatus(e.classId, date, 'cancelled')}
                      onPostpone={() => setPostpone({ classId: e.classId, date })}
                      onRestore={() => actions.deleteSession(e.classId, date)}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      <AttendanceEditor
        open={!!editor}
        onClose={() => setEditor(null)}
        classId={editor?.classId ?? ''}
        date={editor?.date ?? todayISO()}
      />
      <PostponeModal
        target={postpone}
        onClose={() => setPostpone(null)}
      />
    </div>
  )
}

function Entry({
  classId,
  sessionStatus,
  present,
  absent,
  hasOverride,
  date,
  onRoll,
  onCancel,
  onPostpone,
  onRestore,
}: {
  classId: string
  sessionStatus?: string
  present: number
  absent: number
  hasOverride: boolean
  date: string
  onRoll: () => void
  onCancel: () => void
  onPostpone: () => void
  onRestore: () => void
}) {
  const db = useDB()
  const cls = classById(db, classId)
  if (!cls) return null
  const cancelled = sessionStatus === 'cancelled'
  const postponed = sessionStatus === 'postponed'
  const recorded = present + absent > 0

  return (
    <div className="rounded-2xl border border-line bg-white p-2.5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: cls.color }} />
        <span className="truncate text-sm font-semibold text-ink">{cls.name}</span>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {cancelled && <Badge color="#e96a5b">已取消</Badge>}
        {postponed && <Badge color="#f1a13a">已推迟</Badge>}
        {!cancelled && !postponed && recorded && (
          <span className="text-[11px] font-semibold text-mint">到 {present}</span>
        )}
        {!cancelled && !postponed && recorded && absent > 0 && (
          <span className="text-[11px] font-semibold text-neg">缺 {absent}</span>
        )}
        {!cancelled && !postponed && !recorded && (
          <span className="text-[11px] text-muted">待上课</span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {!cancelled && !postponed && (
          <>
            <button onClick={onRoll} className="rounded-lg bg-brand-50 px-2 py-1 text-[11px] font-bold text-brand-600 hover:bg-brand-100">
              记考勤
            </button>
            <button onClick={onCancel} className="grid h-6 w-6 place-items-center rounded-lg bg-black/5 text-neg hover:bg-neg/10" title="取消">
              <XCircle size={12} />
            </button>
            <button onClick={onPostpone} className="grid h-6 w-6 place-items-center rounded-lg bg-black/5 text-zero hover:bg-zero/10" title="推迟">
              <Clock size={12} />
            </button>
          </>
        )}
        {(cancelled || postponed) && (
          <button onClick={onRoll} className="rounded-lg bg-brand-50 px-2 py-1 text-[11px] font-bold text-brand-600 hover:bg-brand-100">
            记考勤
          </button>
        )}
        {hasOverride && (
          <button onClick={onRestore} className="ml-auto grid h-6 w-6 place-items-center rounded-lg bg-black/5 text-muted hover:bg-black/10" title="恢复默认">
            <RotateCcw size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

function PostponeModal({ target, onClose }: { target: { classId: string; date: string } | null; onClose: () => void }) {
  const [newDate, setNewDate] = useState(addDays(todayISO(), 1))
  const open = !!target
  function submit() {
    if (!target) return
    actions.postponeSession(target.classId, target.date, newDate)
    onClose()
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="推迟到哪天？"
      accent="#f1a13a"
      icon={<Clock size={18} />}
      footer={
        <>
          <Button variant="soft" onClick={onClose}>取消</Button>
          <Button variant="grad" onClick={submit} style={{ backgroundImage: 'linear-gradient(135deg,#f5be64,#f1a13a)' }}>确认推迟</Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-muted">原课次会标记为「已推迟」，并在新日期自动排一次课。</p>
      <input
        type="date"
        value={newDate}
        onChange={(e) => setNewDate(e.target.value)}
        className="w-full rounded-2xl border border-line bg-white/80 px-3.5 py-2.5 text-sm outline-none focus:border-brand-300"
      />
    </Modal>
  )
}
