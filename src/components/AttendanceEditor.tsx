// 考勤编辑器：对某班某天的课，逐个学生标记 到 / 缺（含缺勤原因）
import { useEffect, useState } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { actions, useDB } from '../lib/db'
import { classById } from '../lib/selectors'
import { fmtDate, relativeDay } from '../lib/format'
import type { AttendanceStatus } from '../lib/types'
import { Button, Modal, cn } from './common'

export function AttendanceEditor({
  open,
  onClose,
  classId,
  date,
}: {
  open: boolean
  onClose: () => void
  classId: string
  date: string
}) {
  const db = useDB()
  const [sessionId, setSessionId] = useState<string>('')

  useEffect(() => {
    if (open && classId && date) {
      setSessionId(actions.ensureSession(classId, date, 'done'))
    }
  }, [open, classId, date])

  const cls = classById(db, classId)
  const roster = db.students.filter((s) => s.classId === classId && s.status === 'active')
  const attFor = (studentId: string) =>
    db.attendances.find((a) => a.sessionId === sessionId && a.studentId === studentId)

  const present = roster.filter((s) => attFor(s.id)?.status === 'present').length
  const absent = roster.filter((s) => attFor(s.id)?.status === 'absent').length
  const unmarked = roster.length - present - absent

  function mark(studentId: string, status: AttendanceStatus) {
    actions.setAttendanceFor(sessionId, studentId, status)
  }
  function markAllPresent() {
    roster.forEach((s) => {
      if (attFor(s.id)?.status !== 'present') actions.setAttendanceFor(sessionId, s.id, 'present')
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={cls ? `${cls.name} · 考勤` : '考勤'}
      accent={cls?.color}
      icon={<ClipboardCheck size={18} />}
      width="max-w-lg"
      footer={
        <>
          <Button variant="soft" onClick={markAllPresent}>全部到齐</Button>
          <Button variant="grad" onClick={onClose}>完成</Button>
        </>
      }
    >
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="text-muted">{relativeDay(date)} · {fmtDate(date)}</span>
        <span className="flex gap-2 text-xs font-semibold">
          <span className="text-mint">到 {present}</span>
          <span className="text-neg">缺 {absent}</span>
          <span className="text-muted">未记 {unmarked}</span>
        </span>
      </div>

      {roster.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">这个班还没有在读学生</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {roster.map((s) => {
            const cur = attFor(s.id)
            const st = cur?.status
            return (
              <div key={s.id} className="flex items-center gap-3 rounded-2xl border border-line bg-white/60 px-3 py-2">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold text-white"
                  style={{ backgroundColor: cls?.color ?? 'var(--color-brand-400)' }}
                >
                  {s.name.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink">{s.name}</div>
                  {st === 'absent' && (
                    <AbsentNote
                      studentId={s.id}
                      sessionId={sessionId}
                      initial={cur?.note ?? ''}
                    />
                  )}
                </div>
                <Seg status={st} onPresent={() => mark(s.id, 'present')} onAbsent={() => mark(s.id, 'absent')} onClear={() => actions.removeAttendance(sessionId, s.id)} />
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}

function Seg({
  status,
  onPresent,
  onAbsent,
  onClear,
}: {
  status: AttendanceStatus | undefined
  onPresent: () => void
  onAbsent: () => void
  onClear: () => void
}) {
  const btn =
    'px-3 py-1.5 text-xs font-bold rounded-xl transition'
  return (
    <div className="flex items-center gap-1">
      <button onClick={onPresent} className={cn(btn, status === 'present' ? 'bg-mint text-white' : 'bg-black/5 text-ink-soft hover:bg-mint/15')}>
        到
      </button>
      <button onClick={onAbsent} className={cn(btn, status === 'absent' ? 'bg-neg text-white' : 'bg-black/5 text-ink-soft hover:bg-neg/15')}>
        缺
      </button>
      {status && (
        <button onClick={onClear} className="px-1.5 py-1.5 text-xs text-muted hover:text-ink" title="撤销">
          ✕
        </button>
      )}
    </div>
  )
}

function AbsentNote({
  studentId,
  sessionId,
  initial,
}: {
  studentId: string
  sessionId: string
  initial: string
}) {
  const [val, setVal] = useState(initial)
  return (
    <input
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => actions.setAttendanceFor(sessionId, studentId, 'absent', { note: val.trim() || undefined })}
      placeholder="缺勤原因（可选）"
      className="mt-1 w-full rounded-lg border border-line bg-white/70 px-2 py-1 text-xs text-ink outline-none focus:border-brand-300"
    />
  )
}
