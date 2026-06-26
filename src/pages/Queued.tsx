import { useState } from 'react'
import { Clock, Search, UserPlus, CalendarPlus } from 'lucide-react'
import { actions, useDB } from '../lib/db'
import { classOf, remainingCredits } from '../lib/selectors'
import { WEEKDAYS, type Student, type Weekday } from '../lib/types'
import {
  Badge,
  Button,
  Card,
  CreditPill,
  EmptyState,
  Modal,
  PageHeader,
  TextInput,
  useToast,
  cn,
} from '../components/common'
import { StudentFormModal } from '../components/StudentForm'

export default function Queued() {
  const db = useDB()
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [assignFor, setAssignFor] = useState<Student | null>(null)

  const list = db.students
    .filter((s) => s.status === 'queued')
    .filter((s) => s.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <div>
      <PageHeader
        title="待排课"
        subtitle={list.length ? `还有 ${list.length} 位同学没有安排时间哦` : '全部同学都已排课 🎉'}
        icon={
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-neg/15 text-neg">
            <Clock size={20} />
          </span>
        }
        actions={
          <Button variant="grad" onClick={() => setAdding(true)}>
            <UserPlus size={16} /> 添加
          </Button>
        }
      />

      <div className="relative mb-5 max-w-sm">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索学生姓名…" className="pl-10" />
      </div>

      {list.length === 0 ? (
        <EmptyState icon={<Clock size={22} />} title="没有待排课的同学" hint="点击「添加」录入新同学" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((s) => {
            const cls = classOf(db, s)
            const credits = remainingCredits(db, s.id)
            return (
              <Card key={s.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between">
                  <Badge color={cls?.color}>{s.queueTag ?? '待组班'}</Badge>
                  <CreditPill n={credits} />
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className="grid h-11 w-11 place-items-center rounded-2xl text-base font-bold text-white"
                    style={{ backgroundColor: cls?.color ?? 'var(--color-brand-400)' }}
                  >
                    {s.name.slice(0, 1)}
                  </div>
                  <div>
                    <div className="font-bold text-ink">{s.name}</div>
                    <div className="text-xs text-muted">
                      {cls?.name} · {s.level}
                    </div>
                  </div>
                </div>
                <Button variant="soft" className="w-full" onClick={() => setAssignFor(s)}>
                  <CalendarPlus size={16} /> 安排上课
                </Button>
              </Card>
            )
          })}
        </div>
      )}

      <AssignModal student={assignFor} onClose={() => setAssignFor(null)} />
      <StudentFormModal open={adding} onClose={() => setAdding(false)} defaultStatus="queued" />
    </div>
  )
}

function AssignModal({ student, onClose }: { student: Student | null; onClose: () => void }) {
  const toast = useToast()
  const [weekday, setWeekday] = useState<Weekday>(2)
  const open = !!student

  function submit() {
    if (!student) return
    actions.updateStudent(student.id, { status: 'active', weekday, queueTag: undefined })
    toast(`${student.name} 已排到 ${WEEKDAYS[weekday - 1].cn} 📅`)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="安排上课"
      accent="#5b8def"
      icon={<CalendarPlus size={18} />}
      footer={
        <>
          <Button variant="soft" onClick={onClose}>
            取消
          </Button>
          <Button variant="grad" onClick={submit}>
            确认排课
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {student && (
          <div className="text-sm text-muted">
            为 <b className="text-ink">{student.name}</b> 选择固定的上课星期
          </div>
        )}
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((d) => (
            <button
              key={d.value}
              onClick={() => setWeekday(d.value)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-2xl border py-2.5 transition',
                weekday === d.value
                  ? 'border-transparent text-white shadow-soft'
                  : 'border-line bg-white text-ink-soft hover:bg-brand-50/60',
              )}
              style={weekday === d.value ? { backgroundColor: d.color } : undefined}
            >
              <span className="text-[10px] font-bold uppercase">{d.short}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">排课后该同学将从「待排课」移到对应星期的课表中。</p>
      </div>
    </Modal>
  )
}
