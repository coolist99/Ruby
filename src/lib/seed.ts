// 示例数据 v2（不依赖 React；App 与云端灌数共用）
// 课时 = 充值合计 - 出勤(present)次数。私教带收费周期；含一位"上到第9节"用于演示提醒。
import type {
  Attendance,
  ClassRoom,
  DB,
  Student,
  Transaction,
  Weekday,
} from './types'
import { addDays, uid } from './format'

export function buildSeed(): DB {
  const classes: ClassRoom[] = []
  const students: Student[] = []
  const sessions: { id: string; classId: string; date: string }[] = []
  const attendances: Attendance[] = []
  const txns: Transaction[] = []
  const today = '2025-11-25'

  const sessionMap = new Map<string, string>()
  function ensureSession(classId: string, date: string): string {
    const key = `${classId}|${date}`
    let id = sessionMap.get(key)
    if (!id) {
      id = uid('ses_')
      sessionMap.set(key, id)
      sessions.push({ id, classId, date })
    }
    return id
  }
  function lessonDate(i: number) {
    return addDays(today, -(i * 7 + 3))
  }

  // 班级定义
  type CDef = { id: string; name: string; type: 'private' | 'group'; color: string; book: string }
  const cdefs: CDef[] = [
    { id: 'c_fn', name: 'Fancy Nancy', type: 'group', color: '#b89bff', book: 'Fancy Nancy' },
    { id: 'c_wk', name: '外刊', type: 'group', color: '#5b8def', book: '英语外刊精读' },
    { id: 'c_k1', name: '科一', type: 'group', color: '#5bbf7a', book: '科学一级' },
    { id: 'c_re1', name: 'RE1', type: 'group', color: '#9b6bef', book: 'Reading Explorer 1' },
    { id: 'c_ref', name: 'RE-F', type: 'group', color: '#c08bef', book: 'Reading Explorer F' },
    { id: 'c_ft', name: 'Frog and Toad', type: 'group', color: '#5bbfa0', book: 'Frog and Toad' },
    { id: 'c_mth', name: 'Magic Tree House#2', type: 'group', color: '#f5a623', book: 'Magic Tree House #2' },
    { id: 'c_dm', name: 'Dragon Masters#1', type: 'group', color: '#ef6c8a', book: 'Dragon Masters #1' },
    { id: 'c_p_emma', name: '私教 · Emma', type: 'private', color: '#9b6bef', book: 'Harry Potter' },
    { id: 'c_p_liam', name: '私教 · Liam', type: 'private', color: '#ef7aa0', book: 'Magic Tree House' },
  ]
  for (const c of cdefs) {
    classes.push({ id: c.id, name: c.name, type: c.type, color: c.color, book: c.book, createdAt: '2025-09-01' })
  }

  // 学生定义
  type SDef = {
    name: string
    classId: string
    level?: string
    weekday?: Weekday
    taken: number
    target: number
    status?: 'active' | 'queued'
    queueTag?: string
    cycleSize?: number
    alertAt?: number
  }
  const sdefs: SDef[] = [
    { name: 'Iris', classId: 'c_fn', level: 'L1', weekday: 2, taken: 4, target: -4 },
    { name: 'Cici', classId: 'c_fn', level: 'L1', weekday: 2, taken: 3, target: -3 },
    { name: 'Molly', classId: 'c_wk', level: 'L2', weekday: 3, taken: 3, target: 7 },
    { name: 'Shelly', classId: 'c_k1', level: 'L2', weekday: 3, taken: 3, target: 7 },
    { name: 'Antonio', classId: 'c_k1', level: 'L1', weekday: 3, taken: 2, target: 3 },
    { name: 'Lily', classId: 'c_re1', level: 'L1', weekday: 2, taken: 2, target: 0 },
    { name: 'Tom', classId: 'c_ref', level: 'L1', weekday: 2, taken: 2, target: 6 },
    { name: 'Tim', classId: 'c_ref', level: 'L1', weekday: 4, taken: 2, target: 8 },
    { name: 'Lucy', classId: 'c_ref', level: 'L3', weekday: 4, taken: 2, target: 6 },
    { name: 'Chard', classId: 'c_ft', level: 'L1', weekday: 3, taken: 2, target: 4 },
    { name: 'Eason', classId: 'c_ft', level: 'L1', weekday: 3, taken: 3, target: 1 },
    { name: 'Eden', classId: 'c_ft', level: 'L1', weekday: 3, taken: 1, target: 0 }, // 有一次缺勤
    { name: 'Leo', classId: 'c_ft', level: 'L1', weekday: 3, taken: 2, target: 1 },
    { name: 'Amelia', classId: 'c_mth', level: 'L2', weekday: 5, taken: 2, target: 1 },
    { name: 'Jasmine', classId: 'c_mth', level: 'L2', weekday: 5, taken: 2, target: 3 },
    { name: 'Kane', classId: 'c_dm', level: 'L3', weekday: 6, taken: 2, target: 10 },
    // 私教
    { name: 'Emma', classId: 'c_p_emma', level: 'Harry Potter', weekday: 6, taken: 2, target: 13, cycleSize: 10, alertAt: 9 },
    { name: 'Liam', classId: 'c_p_liam', level: 'L2', weekday: 6, taken: 9, target: 1, cycleSize: 10, alertAt: 9 }, // 上到第9节 → 提醒
    // 待排课
    { name: 'Kay', classId: 'c_re1', taken: 0, target: 0, status: 'queued', queueTag: 'RE1待组班' },
    { name: 'Sarah', classId: 'c_fn', taken: 0, target: 0, status: 'queued', queueTag: '试听' },
    { name: 'Kelly', classId: 'c_re1', taken: 0, target: 0, status: 'queued', queueTag: 'RE2待组班' },
    { name: 'Harry', classId: 'c_mth', taken: 0, target: 0, status: 'queued', queueTag: '待组班' },
  ]

  let si = 0
  for (const d of sdefs) {
    si += 1
    const id = d.status === 'queued' ? `q_${si}` : `s_${si}`
    students.push({
      id,
      name: d.name,
      classId: d.classId,
      level: d.level ?? 'L1',
      weekday: d.weekday,
      status: d.status ?? 'active',
      queueTag: d.queueTag,
      cycleSize: d.cycleSize ?? 10,
      alertAt: d.alertAt ?? 9,
      createdAt: today,
    })

    if ((d.status ?? 'active') !== 'active') continue

    // 充值：使剩余课时落在 target（日期早于所有上课记录，保证都在同一周期内）
    const recharge = Math.max(0, d.target + d.taken)
    if (recharge > 0) {
      txns.push({
        id: uid('t_'),
        studentId: id,
        type: 'recharge',
        date: addDays(today, -120),
        delta: recharge,
        amount: recharge * 200,
        notes: '充值',
        createdAt: addDays(today, -120),
      })
    }

    // 上课记录（出勤 present）
    for (let i = 0; i < d.taken; i += 1) {
      const date = lessonDate(i)
      const sid = ensureSession(d.classId, date)
      attendances.push({
        id: uid('a_'),
        sessionId: sid,
        studentId: id,
        status: 'present',
        topic: d.name === 'Emma' && i === 0 ? 'Chapter 1-Chapter 2' : `Chapter ${i + 1}`,
        note: d.name === 'Emma' && i === 0 ? '复述做得非常棒❤️' : undefined,
        createdAt: date,
      })
    }
  }

  // Eden 在 Frog and Toad 某次课缺勤（演示缺勤统计；用与她出勤不同的日期，避免唯一约束冲突）
  {
    const date = lessonDate(1)
    const sid = ensureSession('c_ft', date)
    attendances.push({
      id: uid('a_'),
      sessionId: sid,
      studentId: students.find((s) => s.name === 'Eden')!.id,
      status: 'absent',
      note: '请假',
      createdAt: date,
    })
  }

  // Emma 升级
  const emma = students.find((s) => s.name === 'Emma')!
  txns.push({
    id: uid('t_'),
    studentId: emma.id,
    type: 'level_up',
    date: addDays(today, -2),
    delta: 0,
    newLevel: 'Harry Potter',
    notes: '升级为 Harry Potter',
    createdAt: addDays(today, -2),
  })

  return {
    classes,
    students,
    sessions: sessions.map((s) => ({ ...s, status: 'done', createdAt: s.date })),
    attendances,
    txns,
  }
}
