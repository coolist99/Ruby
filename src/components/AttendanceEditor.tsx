// 考勤编辑器：对某班某天的课，逐个学生标记 到 / 迟到 / 缺（含缺勤原因、内容、赠课）
// 到/迟到/缺互改会覆盖；赠课标记只作用于到课（不消耗课时）。
import { useEffect, useState } from 'react'
import { ClipboardCheck, Download } from 'lucide-react'
import { actions, useDB } from '../lib/db'
import { classById } from '../lib/selectors'
import { exportAttendancePDF } from '../lib/pdf'
import { fmtDate, relativeDay } from '../lib/format'
import type { AttendanceStatus } from '../lib/types'
import { Badge, Button, GiftBadge, Modal, useToast, cn } from './common'

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
  const toast = useToast()
  const [sessionId, setSessionId] = useState<string>('')
  const [editing, setEditing] = useState<string | null>(null) // 学生 id：展开编辑 topic/note/赠课

  useEffect(() => {
    if (open && classId && date) {
      setSessionId(actions.ensureSession(classId, date, 'done'))
      setEditing(null)
    }
  }, [open, classId, date])

  const cls = classById(db, classId)
  const roster = db.students.filter((s) => s.classId === classId && s.status === 'active')
  const attFor = (studentId: string) =>
    db.attendances.find((a) => a.sessionId === sessionId && a.studentId === studentId)

  const present = roster.filter((s) => attFor(s.id)?.status === 'present').length
  const late = roster.filter((s) => attFor(s.id)?.status === 'late').length
  const absent = roster.filter((s) => attFor(s.id)?.status === 'absent').length
  const unmarked = roster.length - present - late - absent

  function mark(studentId: string, status: AttendanceStatus) {
    actions.setAttendanceFor(sessionId, studentId, status)
  }
  // 批量「全部到齐」只对班课有效；一对二/私教按学生逐个打卡（保持各自的赠课/迟到标记）
  function markAllPresent() {
    if (cls && cls.type !== 'group') {
      toast('一对二 / 私教请按学生逐个标记哦', 'info')
      return
    }
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
          {cls?.type === 'group' && (
            <Button
              variant="soft"
              className="mr-auto"
              onClick={() => exportAttendancePDF(db, classId, date).then(() => toast('已生成 PDF 📄'))}
            >
              <Download size={16} /> 导出 PDF
            </Button>
          )}
          {cls?.type === 'group' && (
            <Button variant="soft" onClick={markAllPresent}>全部到齐</Button>
          )}
          <Button variant="grad" onClick={onClose}>完成</Button>
        </>
      }
    >
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="text-muted">{relativeDay(date)} · {fmtDate(date)}</span>
        <span className="flex gap-2 text-xs font-semibold">
          <span className="text-mint">到 {present}</span>
          {late > 0 && <span className="text-zero">迟 {late}</span>}
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
            const isEditing = editing === s.id
            return (
              <div key={s.id} className="rounded-2xl border border-line bg-white/60 px-3 py-2">
                <div className="flex items-center gap-3">
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold text-white"
                    style={{ backgroundColor: cls?.color ?? 'var(--color-brand-400)' }}
                  >
                    {s.name.slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-ink">{s.name}</span>
                      {cur?.gift && st === 'present' && <GiftBadge />}
                      {st === 'late' && <Badge color="#f1a13a">迟到</Badge>}
                    </div>
                    {st === 'absent' && !isEditing && (
                      <AbsentNote
                        studentId={s.id}
                        sessionId={sessionId}
                        initial={cur?.note ?? ''}
                      />
                    )}
                    {st !== 'absent' && cur?.topic && !isEditing && (
                      <div className="mt-0.5 truncate text-xs text-muted">📖 {cur.topic}{cur.note ? ` · ${cur.note}` : ''}</div>
                    )}
                  </div>
                  <Seg
                    status={st}
                    onPresent={() => mark(s.id, 'present')}
                    onLate={() => mark(s.id, 'late')}
                    onAbsent={() => mark(s.id, 'absent')}
                    onClear={() => actions.removeAttendance(sessionId, s.id)}
                  />
                  {st && (
                    <button
                      onClick={() => setEditing(isEditing ? null : s.id)}
                      className={cn(
                        'shrink-0 rounded-lg px-1.5 py-1.5 text-[11px] font-bold transition',
                        isEditing ? 'bg-brand-100 text-brand-600' : 'text-muted hover:bg-brand-50 hover:text-brand-500',
                      )}
                      title="编辑内容 / 备注 / 赠课"
                    >
                      详情
                    </button>
                  )}
                </div>

                {/* 展开编辑：状态 / topic / note / 赠课 */}
                {isEditing && (
                  <AttDetailEditor
                    sessionId={sessionId}
                    studentId={s.id}
                    onDone={() => setEditing(null)}
                  />
                )}
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
  onLate,
  onAbsent,
  onClear,
}: {
  status: AttendanceStatus | undefined
  onPresent: () => void
  onLate: () => void
  onAbsent: () => void
  onClear: () => void
}) {
  const btn = 'px-2.5 py-1.5 text-xs font-bold rounded-xl transition'
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button onClick={onPresent} className={cn(btn, status === 'present' ? 'bg-mint text-white' : 'bg-black/5 text-ink-soft hover:bg-mint/15')}>
        到
      </button>
      <button onClick={onLate} className={cn(btn, status === 'late' ? 'bg-zero text-white' : 'bg-black/5 text-ink-soft hover:bg-zero/15')}>
        迟
      </button>
      <button onClick={onAbsent} className={cn(btn, status === 'absent' ? 'bg-neg text-white' : 'bg-black/5 text-ink-soft hover:bg-neg/15')}>
        缺
      </button>
      {status && (
        <button onClick={onClear} className="px-1 py-1.5 text-xs text-muted hover:text-ink" title="撤销">
          ✕
        </button>
      )}
    </div>
  )
}

// 展开的考勤详情编辑：状态（到/迟到/缺）+ 内容 + 备注 + 赠课开关
function AttDetailEditor({
  sessionId,
  studentId,
  onDone,
}: {
  sessionId: string
  studentId: string
  onDone: () => void
}) {
  const db = useDB()
  const cur = db.attendances.find((a) => a.sessionId === sessionId && a.studentId === studentId)
  const [status, setStatus] = useState<AttendanceStatus>(cur?.status ?? 'present')
  const [topic, setTopic] = useState(cur?.topic ?? '')
  const [note, setNote] = useState(cur?.note ?? '')
  const [gift, setGift] = useState(!!cur?.gift)

  if (!cur) return null

  function save() {
    actions.setAttendanceFor(sessionId, studentId, status, {
      topic: topic.trim() || undefined,
      note: note.trim() || undefined,
      gift: status === 'present' ? gift : false,
    })
    onDone()
  }

  return (
    <div className="mt-2 grid gap-2.5 rounded-xl bg-brand-50/60 p-3">
      <div className="flex items-center gap-1.5">
        {(['present', 'late', 'absent'] as AttendanceStatus[]).map((st) => (
          <button
            key={st}
            onClick={() => setStatus(st)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-bold transition',
              status === st
                ? st === 'present'
                  ? 'bg-mint text-white'
                  : st === 'late'
                    ? 'bg-zero text-white'
                    : 'bg-neg text-white'
                : 'bg-white text-ink-soft hover:bg-black/5',
            )}
          >
            {st === 'present' ? '到' : st === 'late' ? '迟到' : '缺勤'}
          </button>
        ))}
        {status === 'present' && (
          <button
            onClick={() => setGift((g) => !g)}
            className={cn(
              'ml-auto flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition',
              gift ? 'bg-mint text-white' : 'bg-white text-ink-soft hover:bg-mint/15',
            )}
            title="赠课不消耗课时、不计收费周期"
          >
            🎁 赠课{gift ? ' ✓' : ''}
          </button>
        )}
      </div>
      <input
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="内容（Topic）如 Chapter 1-Chapter 2"
        className="w-full rounded-lg border border-line bg-white/80 px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand-300"
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={status === 'absent' ? '缺勤原因（如 请假 / 生病）' : '反馈（Notes）'}
        className="w-full rounded-lg border border-line bg-white/80 px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand-300"
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted">互改状态会覆盖原记录；赠课不扣课时</span>
        <div className="flex gap-1.5">
          <button
            onClick={() => {
              actions.removeAttendance(sessionId, studentId)
              onDone()
            }}
            className="rounded-lg px-2.5 py-1 text-[11px] font-bold text-neg transition hover:bg-neg/10"
          >
            删除记录
          </button>
          <button
            onClick={save}
            className="rounded-lg bg-brand-500 px-3 py-1 text-[11px] font-bold text-white transition hover:bg-brand-600"
          >
            保存
          </button>
        </div>
      </div>
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
