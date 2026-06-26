import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarCheck, CheckCheck, ChevronDown, ClipboardList, UserPlus } from 'lucide-react'
import { actions, useDB } from '../lib/db'
import { classOf, remainingCredits, studentTxns, studentsOnWeekday } from '../lib/selectors'
import { fmtDateShort, relativeDay, todayISO } from '../lib/format'
import { WEEKDAYS, type Student, type Weekday } from '../lib/types'
import {
  Badge,
  Button,
  Card,
  CreditPill,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  Select,
  TextArea,
  TextInput,
  useToast,
  cn,
} from '../components/common'
import { StudentFormModal } from '../components/StudentForm'

export default function DailyClasses() {
  const db = useDB()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const todayWd = (new Date().getDay() || 7) as Weekday
  const day = (Number(params.get('day')) || todayWd) as Weekday
  const dayInfo = WEEKDAYS[day - 1]
  const list = studentsOnWeekday(db, day)

  const [checkInFor, setCheckInFor] = useState<Student | null>(null)
  const [batchOpen, setBatchOpen] = useState(false)
  const [adding, setAdding] = useState(false)

  function setDay(d: Weekday) {
    setParams({ day: String(d) }, { replace: true })
  }

  return (
    <div>
      <PageHeader
        title={`${dayInfo.en} Classes`}
        subtitle={`今天是 ${dayInfo.cn}，共 ${list.length} 节课，保持好心情！`}
        icon={
          <span
            className="grid h-11 w-11 place-items-center rounded-2xl text-white"
            style={{ backgroundColor: dayInfo.color }}
          >
            <CalendarCheck size={20} />
          </span>
        }
        actions={
          <div className="flex gap-2">
            <Button variant="soft" onClick={() => setBatchOpen(true)}>
              <CheckCheck size={16} /> 批量打卡
            </Button>
            <Button variant="grad" onClick={() => setAdding(true)}>
              <UserPlus size={16} /> 添加
            </Button>
          </div>
        }
      />

      {/* 星期切换 */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {WEEKDAYS.map((d) => {
          const n = studentsOnWeekday(db, d.value).length
          const active = d.value === day
          const isToday = d.value === todayWd
          return (
            <button
              key={d.value}
              onClick={() => setDay(d.value)}
              className={cn(
                'flex shrink-0 flex-col items-center gap-1 rounded-2xl border px-4 py-2 transition',
                active ? 'border-transparent text-white shadow-soft' : 'border-line bg-white/60 text-ink-soft hover:bg-white',
              )}
              style={active ? { backgroundColor: d.color } : undefined}
            >
              <span className={cn('text-xs font-bold uppercase', !active && '')} style={!active ? { color: d.color } : undefined}>
                {d.short}
              </span>
              <span className="flex items-center gap-1 text-lg font-bold tabular-nums">
                {n}
                {isToday && !active && <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />}
              </span>
            </button>
          )
        })}
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck size={22} />}
          title={`${dayInfo.cn}没有课`}
          hint="换个星期看看，或添加学生到这一天"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((s) => (
            <DayCard key={s.id} s={s} onCheckIn={() => setCheckInFor(s)} />
          ))}
        </div>
      )}

      {/* 单个打卡 */}
      <CheckInModal student={checkInFor} onClose={() => setCheckInFor(null)} />

      {/* 批量打卡 */}
      <BatchCheckInModal
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        onDone={(n) => toast(`已为 ${n} 位同学打卡 ✅`)}
      />

      <StudentFormModal open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}

function DayCard({ s, onCheckIn }: { s: Student; onCheckIn: () => void }) {
  const db = useDB()
  const [open, setOpen] = useState(false)
  const cls = classOf(db, s)
  const credits = remainingCredits(db, s.id)
  const recent = studentTxns(db, s.id).slice(0, 3)

  return (
    <Card className="flex flex-col gap-3 p-4 transition hover:shadow-pop">
      <div className="flex items-start gap-3">
        <div
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-base font-bold text-white"
          style={{ backgroundColor: cls?.color ?? 'var(--color-brand-400)' }}
        >
          {s.name.slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-ink">{s.name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <Badge color={cls?.color}>{cls?.name}</Badge>
            <span className="text-xs font-semibold text-muted">{s.level}</span>
          </div>
        </div>
        <CreditPill n={credits} />
      </div>

      {/* 近期记录 */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between rounded-xl bg-white/60 px-3 py-2 text-xs font-semibold text-ink-soft transition hover:bg-white"
      >
        <span className="flex items-center gap-1.5">
          <ClipboardList size={13} /> 近期记录
        </span>
        <ChevronDown size={14} className={cn('transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="flex animate-rise flex-col gap-1.5 pl-1">
          {recent.length === 0 ? (
            <span className="text-xs text-muted">暂无记录</span>
          ) : (
            recent.map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-xs">
                <span className="text-muted">{fmtDateShort(t.date)}</span>
                <TxnDot type={t.type} />
                <span className="truncate text-ink-soft">
                  {t.topic || t.notes || t.newLevel || typeName(t.type)}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      <Button variant="grad" className="mt-1 w-full" onClick={onCheckIn}>
        <CalendarCheck size={16} /> 打卡上课
      </Button>
    </Card>
  )
}

function CheckInModal({ student, onClose }: { student: Student | null; onClose: () => void }) {
  const toast = useToast()
  const today = todayISO()
  const [date, setDate] = useState(today)
  const [topic, setTopic] = useState('')
  const [notes, setNotes] = useState('')

  const open = !!student
  function submit() {
    if (!student) return
    actions.checkIn(student.id, date, topic.trim(), notes.trim())
    toast(`已为 ${student.name} 打卡 ✅`)
    setTopic('')
    setNotes('')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="上课记录"
      accent="#ef7aa0"
      icon={<CalendarCheck size={18} />}
      footer={
        <>
          <Button variant="soft" onClick={onClose}>
            取消
          </Button>
          <Button variant="grad" onClick={submit} style={{ backgroundImage: 'linear-gradient(135deg,#f7a3c0,#ef7aa0)' }}>
            确认打卡
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {student && (
          <div className="flex items-center gap-2 text-sm text-muted">
            为 <span className="font-bold text-ink">{student.name}</span> 记录一节课
          </div>
        )}
        <Field label="日期">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="内容（Topic）">
          <TextInput value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="如 Chapter 1-Chapter 2" />
        </Field>
        <Field label="反馈（Notes）">
          <TextArea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="如 复述做得非常棒❤️"
          />
        </Field>
        <p className="text-xs text-muted">打卡后会自动扣减 1 节课时。</p>
      </div>
    </Modal>
  )
}

function BatchCheckInModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean
  onClose: () => void
  onDone: (n: number) => void
}) {
  const db = useDB()
  const [classId, setClassId] = useState(db.classes[0]?.id ?? '')
  const [date, setDate] = useState(todayISO())
  const count = useMemo(
    () => db.students.filter((s) => s.classId === classId && s.status === 'active').length,
    [db.students, classId],
  )

  function submit() {
    const n = actions.batchCheckIn(classId, date)
    onDone(n)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="批量点名"
      accent="#5bbf7a"
      icon={<CheckCheck size={18} />}
      footer={
        <>
          <Button variant="soft" onClick={onClose}>
            取消
          </Button>
          <Button variant="grad" onClick={submit} style={{ backgroundImage: 'linear-gradient(135deg,#7fd49a,#5bbf7a)' }}>
            一键打卡（{count}）
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="补卡日期">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="选择班级">
          <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
            {db.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}（{db.students.filter((s) => s.classId === c.id && s.status === 'active').length} 人）
              </option>
            ))}
          </Select>
        </Field>
        <div className="rounded-2xl bg-mint/10 px-4 py-3 text-sm text-ink-soft" style={{ backgroundColor: 'rgba(91,191,122,0.1)' }}>
          将为 <b>{count}</b> 位同学各记 1 节课（共扣 {count} 课时）。日期：{relativeDay(date)}
        </div>
      </div>
    </Modal>
  )
}

function TxnDot({ type }: { type: string }) {
  const map: Record<string, string> = {
    class: '📚',
    recharge: '💰',
    level_up: '🏆',
  }
  return <span>{map[type] ?? '•'}</span>
}
function typeName(t: string) {
  return t === 'class' ? '上课' : t === 'recharge' ? '充值' : '升级'
}
