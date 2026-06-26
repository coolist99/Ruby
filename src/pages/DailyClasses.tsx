import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarCheck, ClipboardCheck, UserPlus } from 'lucide-react'
import { useDB } from '../lib/db'
import { classById, studentsOnWeekday } from '../lib/selectors'
import { fmtDate, relativeDay, todayISO } from '../lib/format'
import { WEEKDAYS, type Weekday } from '../lib/types'
import { Badge, Button, Card, EmptyState, PageHeader, cn } from '../components/common'
import { StudentFormModal } from '../components/StudentForm'
import { AttendanceEditor } from '../components/AttendanceEditor'

export default function DailyClasses() {
  const db = useDB()
  const [params, setParams] = useSearchParams()
  const todayWd = (new Date().getDay() || 7) as Weekday
  const day = (Number(params.get('day')) || todayWd) as Weekday
  const dayInfo = WEEKDAYS[day - 1]
  const [date, setDate] = useState(todayISO())
  const [editorFor, setEditorFor] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  // 按班级分组当天学生
  const groups = useMemo(() => {
    const list = studentsOnWeekday(db, day)
    const map = new Map<string, typeof list>()
    for (const s of list) {
      const key = s.classId || '__none__'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    }
    return [...map.entries()]
  }, [db, day])

  function setDay(d: Weekday) {
    setParams({ day: String(d) }, { replace: true })
  }

  return (
    <div>
      <PageHeader
        title={`${dayInfo.en} Classes`}
        subtitle={`今天是 ${dayInfo.cn}，共 ${studentsOnWeekday(db, day).length} 节课，保持好心情！`}
        icon={
          <span className="grid h-11 w-11 place-items-center rounded-2xl text-white" style={{ backgroundColor: dayInfo.color }}>
            <CalendarCheck size={20} />
          </span>
        }
        actions={
          <Button variant="grad" onClick={() => setAdding(true)}>
            <UserPlus size={16} /> 添加学生
          </Button>
        }
      />

      {/* 星期切换 + 记课日期 */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1">
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
                <span style={!active ? { color: d.color } : undefined} className="text-xs font-bold uppercase">{d.short}</span>
                <span className="flex items-center gap-1 text-lg font-bold tabular-nums">
                  {n}
                  {isToday && !active && <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />}
                </span>
              </button>
            )
          })}
        </div>
        <label className="flex items-center gap-2 rounded-2xl border border-line bg-white/70 px-3 py-2 text-xs font-semibold text-ink-soft">
          记课日期
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-transparent text-ink outline-none"
          />
          <span className="text-muted">{relativeDay(date)}</span>
        </label>
      </div>

      {groups.length === 0 ? (
        <EmptyState icon={<CalendarCheck size={22} />} title={`${dayInfo.cn}没有课`} hint="换个星期看看，或添加学生到这一天" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map(([classId, students]) => (
            <ClassGroup
              key={classId}
              classId={classId === '__none__' ? '' : classId}
              students={students}
              date={date}
              onTakeRoll={() => setEditorFor(classId === '__none__' ? '' : classId)}
            />
          ))}
        </div>
      )}

      <AttendanceEditor open={editorFor !== null} onClose={() => setEditorFor(null)} classId={editorFor ?? ''} date={date} />
      <StudentFormModal open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}

function ClassGroup({
  classId,
  students,
  date,
  onTakeRoll,
}: {
  classId: string
  students: { id: string; name: string }[]
  date: string
  onTakeRoll: () => void
}) {
  const db = useDB()
  const cls = classId ? classById(db, classId) : undefined
  // 该班当天已有的考勤统计
  const session = db.sessions.find((s) => s.classId === classId && s.date === date)
  const atts = session ? db.attendances.filter((a) => a.sessionId === session.id) : []
  const present = atts.filter((a) => a.status === 'present').length
  const absent = atts.filter((a) => a.status === 'absent').length

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <span className="h-9 w-9 shrink-0 rounded-xl" style={{ backgroundColor: cls?.color ?? '#ccc' }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-bold text-ink">{cls?.name ?? '未分班'}</span>
            {cls && <Badge color={cls.type === 'private' ? '#ef7aa0' : '#5b8def'}>{cls.type === 'private' ? '私教' : '班课'}</Badge>}
          </div>
          <div className="mt-0.5 text-xs text-muted">
            {students.length} 名学生
            {session && <span> · <span className="text-mint">到 {present}</span> <span className="text-neg">缺 {absent}</span></span>}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {students.map((s) => (
          <span key={s.id} className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-semibold text-ink-soft">
            {s.name}
          </span>
        ))}
      </div>

      <Button variant="grad" className="w-full" onClick={onTakeRoll} disabled={!classId}>
        <ClipboardCheck size={16} /> 记考勤（名单）
      </Button>
      {!classId && <p className="text-center text-xs text-muted">该学生未分班，先去「班级」分配</p>}
      {session && (
        <p className="text-center text-xs text-muted">已记录 {fmtDate(date)} 的考勤</p>
      )}
    </Card>
  )
}
