// 派生查询 v2：课时由出勤派生（赠课除外）；私教/一对二收费周期；考勤基于课次。
import { isPrivateLike, type Attendance, type AttendanceStatus, type ClassRoom, type DB, type Session, type Student } from './types'

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

/** 赠课节数（present 且 gift）*/
export function giftCount(db: DB, studentId: string): number {
  return db.attendances.filter((a) => a.studentId === studentId && a.status === 'present' && a.gift).length
}

/** 计费到课数（present 且非赠课）—— 剩余课时 / FIFO 消耗都基于这个 */
export function billableCount(db: DB, studentId: string): number {
  return db.attendances.filter((a) => a.studentId === studentId && a.status === 'present' && !a.gift).length
}
export function absentCount(db: DB, studentId: string): number {
  return db.attendances.filter((a) => a.studentId === studentId && a.status === 'absent').length
}

/** 剩余课时 = 充值合计 - 非赠课 present 数（赠课不扣课时）*/
export function remainingCredits(db: DB, studentId: string): number {
  const recharged = db.txns
    .filter((t) => t.studentId === studentId && t.type === 'recharge')
    .reduce((s, t) => s + t.delta, 0)
  return recharged - billableCount(db, studentId)
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
 * 私教/一对二收费周期进度。
 * 周期 =「最近一次充值」之后的非赠课 present 次数；充值即开新周期（赠课不计）。
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
    (a) =>
      a.studentId === student.id &&
      a.status === 'present' &&
      !a.gift &&
      sessionDate(db, a.sessionId) >= cutoff,
  ).length
  return {
    taken,
    cycleSize: student.cycleSize,
    alertAt: student.alertAt,
    alert: taken >= student.alertAt && taken < student.cycleSize,
    over: taken >= student.cycleSize,
  }
}

// ── 充值台账（FIFO 先充先用）──
export interface LedgerEntry {
  txn: { id: string; date: string; delta: number; amount?: number; notes?: string }
  /** 本笔已被消耗的课时 */
  consumed: number
  /** 本笔剩余课时 */
  remaining: number
}

/**
 * 把该学生的充值按日期升序、非赠课 present 按上课日期升序排列，
 * 逐节从最早的还有剩余的充值里扣（FIFO）。
 * 校验恒等式：Σconsumed = 非赠课 present 总数；Σremaining = remainingCredits。
 */
export function rechargeLedger(db: DB, studentId: string): LedgerEntry[] {
  const recharges = db.txns
    .filter((t) => t.studentId === studentId && t.type === 'recharge')
    .map((t) => ({ id: t.id, date: t.date, delta: t.delta, amount: t.amount, notes: t.notes }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  // 非赠课 present，按上课日期升序（无 session 的用 createdAt 兜底）
  const consumptions = db.attendances
    .filter((a) => a.studentId === studentId && a.status === 'present' && !a.gift)
    .map((a) => sessionDate(db, a.sessionId) !== '0000-00-00' ? sessionDate(db, a.sessionId) : a.createdAt.slice(0, 10))
    .sort()

  let cursor = 0 // 已分配到第几节课
  const entries: LedgerEntry[] = recharges.map((txn) => {
    let consumed = 0
    // 逐节从本笔扣，直到本笔扣完（后面的课留给下一笔）
    while (cursor < consumptions.length && consumed < txn.delta) {
      consumed += 1
      cursor += 1
    }
    return { txn, consumed, remaining: txn.delta - consumed }
  })
  // cursor 之后若还有课（欠费/没充值就上课），不计入任何笔 —— Σremaining 不为负，
  // 欠多少看 remainingCredits（可为负）。
  return entries
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

/** 私教/一对二：到达提醒节点（第 alertAt 节）或已满周期该续费的 */
export function rechargeAlerts(db: DB): { student: Student; taken: number; cycleSize: number; over: boolean }[] {
  const out: { student: Student; taken: number; cycleSize: number; over: boolean }[] = []
  for (const s of activeStudents(db)) {
    if (!isPrivateLike(classOf(db, s)?.type)) continue
    const cyc = cycleProgress(db, s)
    if (cyc.alert || cyc.over) out.push({ student: s, taken: cyc.taken, cycleSize: cyc.cycleSize, over: cyc.over })
  }
  return out
}

/** 课时 ≤ 0 的在读学生（欠费 / 用完）*/
export function lowCreditStudents(db: DB): { student: Student; credits: number }[] {
  return activeStudents(db)
    .map((s) => ({ student: s, credits: remainingCredits(db, s.id) }))
    .filter((x) => x.credits <= 0)
}

/** 提醒面板待办总数（续费 + 课时不足）*/
export function alertCount(db: DB): number {
  return rechargeAlerts(db).length + lowCreditStudents(db).length
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

/** 某班在指定日期区间内的考勤矩阵（学生 × 课次日期），用于按月/周期导出 */
export function classPeriodGrid(
  db: DB,
  classId: string,
  startISO: string,
  endISO: string,
): {
  students: Student[]
  dates: string[]
  status: Record<string, Record<string, AttendanceStatus | undefined>>
} {
  const students = db.students.filter((s) => s.classId === classId && s.status === 'active')
  const dates = db.sessions
    .filter((s) => s.classId === classId && s.date >= startISO && s.date <= endISO)
    .map((s) => s.date)
    .sort()
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

/** 班级的固定上课星期（取该班在读学生的；私教/一对二即该学生）*/
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
  /** 出勤条目：状态与赠课标记（编辑考勤用）*/
  att?: { id: string; status: AttendanceStatus; gift: boolean; sessionId: string; topic?: string }
  /** 充值条目：流水 id 与课时（编辑/删除充值用）*/
  txn?: { id: string; delta: number; consumed: number; remaining: number }
}

/** 学生档案：把出勤 + 充值 + 升级合并成按时间倒序的历史 */
export function studentHistory(db: DB, studentId: string): HistoryItem[] {
  const items: HistoryItem[] = []
  const ledger = new Map(rechargeLedger(db, studentId).map((e) => [e.txn.id, e]))
  studentAttendances(db, studentId).forEach(({ att, date }) => {
    if (att.status === 'absent') {
      items.push({ date, kind: 'absent', title: att.topic ? `缺勤 · ${att.topic}` : '缺勤', note: att.note, att: { id: att.id, status: att.status, gift: !!att.gift, sessionId: att.sessionId, topic: att.topic } })
    } else {
      items.push({ date, kind: 'class', title: att.topic || '上课', note: att.note, att: { id: att.id, status: att.status, gift: !!att.gift, sessionId: att.sessionId, topic: att.topic } })
    }
  })
  db.txns
    .filter((t) => t.studentId === studentId)
    .forEach((t) => {
      if (t.type === 'recharge') {
        const e = ledger.get(t.id)
        items.push({
          date: t.date,
          kind: 'recharge',
          title: `充值 ${t.delta} 课时`,
          amount: t.amount,
          note: t.notes,
          txn: { id: t.id, delta: t.delta, consumed: e?.consumed ?? 0, remaining: e?.remaining ?? t.delta },
        })
      } else {
        items.push({ date: t.date, kind: 'level_up', title: t.notes || `升级为 ${t.newLevel}` })
      }
    })
  return items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}
