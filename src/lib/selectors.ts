// 派生查询 v2：课时由出勤派生；私教收费周期；考勤基于课次。
import type { Attendance, AttendanceStatus, ClassRoom, DB, Session, Student } from './types'

export function classById(db: DB, id: string): ClassRoom | undefined {
  return db.classes.find((c) => c.id === id)
}
export function classOf(db: DB, student: Student): ClassRoom | undefined {
  return classById(db, student.classId)
}

export function studentAttendances(db: DB, studentId: string): { att: Attendance; date: string }[] {
  return db.attendances
    .filter((a) => a.studentId === studentId)
    .map((a) => ({ att: a, date: db.sessions.find((s) => s.id === a.sessionId)?.date ?? a.createdAt.slice(0, 10) }))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
}

export function presentCount(db: DB, studentId: string): number {
  return db.attendances.filter((a) => a.studentId === studentId && a.status === 'present').length
}
export function absentCount(db: DB, studentId: string): number {
  return db.attendances.filter((a) => a.studentId === studentId && a.status === 'absent').length
}

/** 剩余课时 = 充值合计 - 出勤(present)次数 */
export function remainingCredits(db: DB, studentId: string): number {
  const recharged = db.txns
    .filter((t) => t.studentId === studentId && t.type === 'recharge')
    .reduce((s, t) => s + t.delta, 0)
  return recharged - presentCount(db, studentId)
}

export function totalRecharged(db: DB, studentId: string): number {
  return db.txns
    .filter((t) => t.studentId === studentId && t.type === 'recharge')
    .reduce((s, t) => s + t.delta, 0)
}

export function lastActivity(db: DB, studentId: string): string {
  const dates: string[] = []
  studentAttendances(db, studentId).forEach((x) => dates.push(x.date))
  db.txns.filter((t) => t.studentId === studentId).forEach((t) => dates.push(t.date))
  return dates.length ? dates.sort().reverse()[0] : ''
}

export function creditColor(n: number): 'pos' | 'zero' | 'neg' {
  if (n > 0) return 'pos'
  if (n < 0) return 'neg'
  return 'zero'
}

/**
 * 私教收费周期进度。
 * 周期 =「最近一次充值」之后的出勤(present)次数；充值即开新周期。
 * alert：上到第 alertAt 节（默认9）该提醒续费；over：已满周期长度还没续费。
 */
export function cycleProgress(db: DB, student: Student): {
  taken: number
  cycleSize: number
  alertAt: number
  alert: boolean
  over: boolean
} {
  const recharges = db.txns
    .filter((t) => t.studentId === student.id && t.type === 'recharge')
    .map((t) => t.date)
    .sort()
  const cutoff = recharges.length ? recharges[recharges.length - 1] : '0000-00-00'
  const taken = db.attendances.filter(
    (a) => a.studentId === student.id && a.status === 'present' && sessionDate(db, a.sessionId) >= cutoff,
  ).length
  return {
    taken,
    cycleSize: student.cycleSize,
    alertAt: student.alertAt,
    alert: taken >= student.alertAt && taken < student.cycleSize,
    over: taken >= student.cycleSize,
  }
}
function sessionDate(db: DB, sessionId: string): string {
  return db.sessions.find((s) => s.id === sessionId)?.date ?? '0000-00-00'
}

export function studentsOnWeekday(db: DB, weekday: number): Student[] {
  return db.students.filter((s) => s.status === 'active' && s.weekday === weekday)
}
export function queuedStudents(db: DB): Student[] {
  return db.students.filter((s) => s.status === 'queued')
}
export function activeStudents(db: DB): Student[] {
  return db.students.filter((s) => s.status === 'active')
}
export function weeklyCounts(db: DB): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0]
  db.students.forEach((s) => {
    if (s.status === 'active' && s.weekday) counts[s.weekday - 1] += 1
  })
  return counts
}

export function classSessions(db: DB, classId: string): Session[] {
  return db.sessions
    .filter((s) => s.classId === classId)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
}

/** 班级的固定上课星期（取该班在读学生的；私教即该学生）*/
export function classWeekday(db: DB, classId: string): number | undefined {
  return db.students.find((s) => s.classId === classId && s.status === 'active' && s.weekday)?.weekday
}

export interface CalEntry {
  classId: string
  session?: Session
  present: number
  absent: number
}

/** 某天的日历条目：固定排课（班级星期=当天）+ 当天已存在的课次（含推迟/调课过来的）*/
export function calendarDay(db: DB, date: string): CalEntry[] {
  const dow = new Date(date + 'T00:00:00').getDay() || 7
  const out: CalEntry[] = []
  for (const c of db.classes) {
    const cw = classWeekday(db, c.id)
    const session = db.sessions.find((s) => s.classId === c.id && s.date === date)
    const isRecurring = cw === dow
    if (!isRecurring && !session) continue
    let present = 0
    let absent = 0
    if (session) {
      const atts = db.attendances.filter((a) => a.sessionId === session.id)
      present = atts.filter((a) => a.status === 'present').length
      absent = atts.filter((a) => a.status === 'absent').length
    }
    out.push({ classId: c.id, session, present, absent })
  }
  return out
}

/** 班课考勤网格：行=学生，列=最近若干次课，单元格=出勤状态 */
export function attendanceGrid(
  db: DB,
  classId: string,
  count = 8,
): {
  students: Student[]
  dates: string[]
  status: Record<string, Record<string, AttendanceStatus | undefined>>
} {
  const students = db.students.filter((s) => s.classId === classId && s.status === 'active')
  const dates = classSessions(db, classId)
    .slice(0, count)
    .map((s) => s.date)
    .sort()
    .reverse()
    .slice(0, count)
    .reverse()
  const status: Record<string, Record<string, AttendanceStatus | undefined>> = {}
  students.forEach((st) => {
    status[st.id] = {}
  })
  db.attendances.forEach((a) => {
    const ses = db.sessions.find((s) => s.id === a.sessionId)
    if (!ses || ses.classId !== classId || !dates.includes(ses.date)) return
    if (status[a.studentId]) status[a.studentId][ses.date] = a.status
  })
  return { students, dates, status }
}

export type HistoryKind = 'class' | 'absent' | 'recharge' | 'level_up'
export interface HistoryItem {
  date: string
  kind: HistoryKind
  title: string
  note?: string
  amount?: number
}

/** 学生档案：把出勤 + 充值 + 升级合并成按时间倒序的历史 */
export function studentHistory(db: DB, studentId: string): HistoryItem[] {
  const items: HistoryItem[] = []
  studentAttendances(db, studentId).forEach(({ att, date }) => {
    if (att.status === 'absent') {
      items.push({ date, kind: 'absent', title: att.topic ? `缺勤 · ${att.topic}` : '缺勤', note: att.note })
    } else {
      items.push({ date, kind: 'class', title: att.topic || '上课', note: att.note })
    }
  })
  db.txns
    .filter((t) => t.studentId === studentId)
    .forEach((t) => {
      if (t.type === 'recharge') {
        items.push({ date: t.date, kind: 'recharge', title: `充值 ${t.delta} 课时`, amount: t.amount })
      } else {
        items.push({ date: t.date, kind: 'level_up', title: t.notes || `升级为 ${t.newLevel}` })
      }
    })
  return items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}
