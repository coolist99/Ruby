// 派生查询：把原始 DB 计算成各视图需要的数据

import type { ClassRoom, DB, Student, Transaction } from './types'

export function classById(db: DB, id: string): ClassRoom | undefined {
  return db.classes.find((c) => c.id === id)
}

export function classOf(db: DB, student: Student): ClassRoom | undefined {
  return classById(db, student.classId)
}

export function studentTxns(db: DB, studentId: string): Transaction[] {
  return db.txns
    .filter((t) => t.studentId === studentId)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.createdAt < b.createdAt ? 1 : -1))
}

/** 剩余课时 = 所有流水 delta 之和 */
export function remainingCredits(db: DB, studentId: string): number {
  return studentTxns(db, studentId).reduce((sum, t) => sum + t.delta, 0)
}

export function totalClasses(db: DB, studentId: string): number {
  return studentTxns(db, studentId).filter((t) => t.type === 'class').length
}

export function totalRecharged(db: DB, studentId: string): number {
  return studentTxns(db, studentId)
    .filter((t) => t.type === 'recharge')
    .reduce((s, t) => s + t.delta, 0)
}

export function lastActivity(db: DB, studentId: string): string {
  const dates = studentTxns(db, studentId).map((t) => t.date)
  return dates.length ? dates.sort().reverse()[0] : ''
}

/** 课时状态颜色 */
export function creditColor(n: number): 'pos' | 'zero' | 'neg' {
  if (n > 0) return 'pos'
  if (n < 0) return 'neg'
  return 'zero'
}

/** 当天上课的学生（按星期排课） */
export function studentsOnWeekday(db: DB, weekday: number): Student[] {
  return db.students.filter((s) => s.status === 'active' && s.weekday === weekday)
}

/** 待排课学生 */
export function queuedStudents(db: DB): Student[] {
  return db.students.filter((s) => s.status === 'queued')
}

/** 在读学生 */
export function activeStudents(db: DB): Student[] {
  return db.students.filter((s) => s.status === 'active')
}

/** 每个星期几的课节数 */
export function weeklyCounts(db: DB): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0] // index 0 = Mon
  db.students.forEach((s) => {
    if (s.status === 'active' && s.weekday) counts[s.weekday - 1] += 1
  })
  return counts
}

/** 某个班最近 N 天的考勤网格 */
export function attendanceGrid(
  db: DB,
  classId: string,
  days: number,
  endISO: string,
): { students: Student[]; dates: string[]; present: Record<string, Set<string>> } {
  const students = db.students.filter((s) => s.classId === classId && s.status === 'active')
  const dates: string[] = []
  // 从 endISO 往前推 days 天（含）
  const start = new Date(endISO + 'T00:00:00')
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(start)
    d.setDate(d.getDate() - i)
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    dates.push(`${d.getFullYear()}-${m}-${day}`)
  }
  const present: Record<string, Set<string>> = {}
  const classTxns = db.txns.filter((t) => t.type === 'class')
  students.forEach((s) => {
    present[s.id] = new Set(classTxns.filter((t) => t.studentId === s.id).map((t) => t.date))
  })
  return { students, dates, present }
}
