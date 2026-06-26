// 数据仓库 v2：Supabase 云端优先，连不上回退 localStorage。
// 课时 = 充值合计 - 出勤(present)次数。打卡 = 创建/复用课次 + 写一条 present 出勤。

import { useSyncExternalStore } from 'react'
import type {
  Attendance,
  AttendanceStatus,
  ClassRoom,
  DB,
  Session,
  Student,
  Transaction,
} from './types'
import { uid } from './format'
import { buildSeed } from './seed'
import {
  attCols,
  bootstrapCloud,
  classCols,
  isSupabaseConfigured,
  loadDB,
  sessionCols,
  studentCols,
  supabase,
  txnCols,
} from './supabase'

const STORAGE_KEY = 'rubys-room-db-v2'
const SEED_FLAG = 'rubys-room-cloud-seeded-v2'

let state: DB = { classes: [], students: [], sessions: [], attendances: [], txns: [] }
let ready = false
let cloudMode = false
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((l) => l())
}
function persistLocal() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}
function loadLocal(): DB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as DB
  } catch {
    /* ignore */
  }
  return buildSeed()
}
function commit(next: DB) {
  state = next
  if (!cloudMode) persistLocal()
  notify()
}

async function safeRemote(op: () => PromiseLike<unknown>) {
  if (!cloudMode || !supabase) return
  try {
    await op()
  } catch (e) {
    console.error('[db] 远程写入失败，重新同步云端', e)
    try {
      commit(await loadDB())
    } catch {
      /* ignore */
    }
  }
}

// ── 初始化 ──
;(async function init() {
  if (isSupabaseConfigured) {
    try {
      let remote = await loadDB()
      if (remote.students.length === 0 && !localStorage.getItem(SEED_FLAG)) {
        await bootstrapCloud(buildSeed())
        localStorage.setItem(SEED_FLAG, '1')
        remote = await loadDB()
      }
      cloudMode = true
      commit(remote)
    } catch (e) {
      console.warn('[db] Supabase 不可用，回退本地存储', e)
      cloudMode = false
      commit(loadLocal())
    }
  } else {
    cloudMode = false
    commit(loadLocal())
  }
  ready = true
  notify()
})()

// ── React 绑定 ──
export function useDB(): DB {
  return useSyncExternalStore(subscribe, () => state, () => state)
}
export function useDBReady(): boolean {
  return useSyncExternalStore(subscribe, () => ready, () => ready)
}
export function isCloud(): boolean {
  return cloudMode
}
function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

// ── 内部：课次 / 出勤 ──
function ensureSession(classId: string, date: string, status: Session['status'] = 'done'): string {
  const existing = state.sessions.find((s) => s.classId === classId && s.date === date)
  if (existing) return existing.id
  const ses: Session = { id: uid('ses_'), classId, date, status, createdAt: new Date().toISOString() }
  commit({ ...state, sessions: [...state.sessions, ses] })
  void safeRemote(() => supabase!.from('sessions').upsert(sessionCols(ses), { onConflict: 'id' }))
  return ses.id
}
function setAttendance(
  sessionId: string,
  studentId: string,
  status: AttendanceStatus,
  topic?: string,
  note?: string,
) {
  const cur = state.attendances.find((a) => a.sessionId === sessionId && a.studentId === studentId)
  let att: Attendance
  let next: Attendance[]
  if (cur) {
    att = { ...cur, status, topic: topic ?? cur.topic, note: note ?? cur.note }
    next = state.attendances.map((a) => (a.id === cur.id ? att : a))
  } else {
    att = { id: uid('a_'), sessionId, studentId, status, topic, note, createdAt: new Date().toISOString() }
    next = [...state.attendances, att]
  }
  commit({ ...state, attendances: next })
  void safeRemote(() => supabase!.from('attendances').upsert(attCols(att), { onConflict: 'id' }))
}

// ── 写操作 ──
export const actions = {
  resetDemo() {
    if (cloudMode && supabase) {
      void (async () => {
        for (const t of ['attendances', 'sessions', 'transactions', 'students', 'classes']) {
          await supabase.from(t).delete().neq('id', '__none__')
        }
        await bootstrapCloud(buildSeed())
        commit(await loadDB())
      })()
    } else {
      commit(buildSeed())
    }
  },
  clearAll() {
    if (cloudMode && supabase) {
      void (async () => {
        for (const t of ['attendances', 'sessions', 'transactions', 'students', 'classes']) {
          await supabase.from(t).delete().neq('id', '__none__')
        }
        commit(await loadDB())
      })()
    } else {
      commit({ classes: [], students: [], sessions: [], attendances: [], txns: [] })
    }
  },

  // —— 班级 ——
  addClass(input: Omit<ClassRoom, 'id' | 'createdAt'>) {
    const c: ClassRoom = { ...input, id: uid('c_'), createdAt: new Date().toISOString() }
    commit({ ...state, classes: [...state.classes, c] })
    void safeRemote(() => supabase!.from('classes').upsert(classCols(c), { onConflict: 'id' }))
    return c
  },
  updateClass(id: string, patch: Partial<ClassRoom>) {
    const cur = state.classes.find((c) => c.id === id)
    if (!cur) return
    const merged = { ...cur, ...patch }
    commit({ ...state, classes: state.classes.map((c) => (c.id === id ? merged : c)) })
    void safeRemote(() => supabase!.from('classes').update(classCols(merged)).eq('id', id))
  },
  removeClass(id: string) {
    const removedSessions = new Set(state.sessions.filter((s) => s.classId === id).map((s) => s.id))
    commit({
      ...state,
      classes: state.classes.filter((c) => c.id !== id),
      students: state.students.map((s) => (s.classId === id ? { ...s, classId: '' } : s)),
      sessions: state.sessions.filter((s) => s.classId !== id),
      attendances: state.attendances.filter((a) => !removedSessions.has(a.sessionId)),
    })
    void safeRemote(() => supabase!.from('classes').delete().eq('id', id))
  },

  // —— 学生 ——
  addStudent(input: Omit<Student, 'id' | 'createdAt'>) {
    const s: Student = { ...input, id: uid('s_'), createdAt: new Date().toISOString() }
    commit({ ...state, students: [...state.students, s] })
    void safeRemote(() => supabase!.from('students').upsert(studentCols(s), { onConflict: 'id' }))
    return s
  },
  updateStudent(id: string, patch: Partial<Student>) {
    const cur = state.students.find((s) => s.id === id)
    if (!cur) return
    const merged = { ...cur, ...patch }
    commit({ ...state, students: state.students.map((s) => (s.id === id ? merged : s)) })
    void safeRemote(() => supabase!.from('students').update(studentCols(merged)).eq('id', id))
  },
  removeStudent(id: string) {
    commit({
      ...state,
      students: state.students.filter((s) => s.id !== id),
      attendances: state.attendances.filter((a) => a.studentId !== id),
      txns: state.txns.filter((t) => t.studentId !== id),
    })
    void safeRemote(() => supabase!.from('students').delete().eq('id', id))
  },

  // —— 课次 / 出勤 ——
  /** 单个学生打卡（记一节 present 课）*/
  recordLesson(studentId: string, date: string, topic: string, note: string) {
    const stu = state.students.find((s) => s.id === studentId)
    if (!stu) return
    const sid = ensureSession(stu.classId, date)
    setAttendance(sid, studentId, 'present', topic || undefined, note || undefined)
  },
  /** 班课批量点名：该班所有在读学生记 present */
  batchCheckIn(classId: string, date: string) {
    const sid = ensureSession(classId, date)
    const targets = state.students.filter((s) => s.classId === classId && s.status === 'active')
    targets.forEach((s) => setAttendance(sid, s.id, 'present'))
    return targets.length
  },
  /** 标记某学生某天缺勤 */
  markAbsent(studentId: string, date: string, note?: string) {
    const stu = state.students.find((s) => s.id === studentId)
    if (!stu) return
    const sid = ensureSession(stu.classId, date)
    setAttendance(sid, studentId, 'absent', undefined, note)
  },
  /** 设置某学生在某课次的出勤状态（含备注，出勤页/日历用）*/
  setAttendanceFor(
    sessionId: string,
    studentId: string,
    status: AttendanceStatus,
    opts?: { topic?: string; note?: string },
  ) {
    setAttendance(sessionId, studentId, status, opts?.topic, opts?.note)
  },
  /** 删除某学生在某课次的出勤记录（撤销标记）*/
  removeAttendance(sessionId: string, studentId: string) {
    commit({
      ...state,
      attendances: state.attendances.filter(
        (a) => !(a.sessionId === sessionId && a.studentId === studentId),
      ),
    })
    void safeRemote(() => supabase!.from('attendances').delete().eq('session_id', sessionId).eq('student_id', studentId))
  },
  /** 确保 (classId, date) 课次存在，返回 id（日历用）*/
  ensureSession(classId: string, date: string, status: Session['status'] = 'scheduled') {
    return ensureSession(classId, date, status)
  },
  updateSession(id: string, patch: Partial<Session>) {
    const cur = state.sessions.find((s) => s.id === id)
    if (!cur) return
    const merged = { ...cur, ...patch }
    commit({ ...state, sessions: state.sessions.map((s) => (s.id === id ? merged : s)) })
    void safeRemote(() => supabase!.from('sessions').update(sessionCols(merged)).eq('id', id))
  },
  /** 设置某班某天课次的状态（取消 / 推迟 / 恢复 / 完成）*/
  setSessionStatus(classId: string, date: string, status: Session['status']) {
    const sid = ensureSession(classId, date, status)
    this.updateSession(sid, { status })
  },
  /** 推迟到某天：原课次标记 postponed，并在新日期建一次课 */
  postponeSession(classId: string, date: string, newDate: string) {
    this.setSessionStatus(classId, date, 'postponed')
    ensureSession(classId, newDate, 'scheduled')
  },
  /** 删除某班某天的课次记录（恢复成"未排"的默认态）*/
  deleteSession(classId: string, date: string) {
    const sid = state.sessions.find((s) => s.classId === classId && s.date === date)?.id
    if (!sid) return
    commit({
      ...state,
      sessions: state.sessions.filter((s) => s.id !== sid),
      attendances: state.attendances.filter((a) => a.sessionId !== sid),
    })
    void safeRemote(() => supabase!.from('sessions').delete().eq('id', sid))
  },

  // —— 充值 / 升级 ——
  recharge(studentId: string, date: string, credits: number, amount?: number) {
    const txn: Transaction = {
      id: uid('t_'),
      studentId,
      type: 'recharge',
      date,
      delta: credits,
      amount,
      createdAt: new Date().toISOString(),
    }
    commit({ ...state, txns: [txn, ...state.txns] })
    void safeRemote(() => supabase!.from('transactions').upsert(txnCols(txn), { onConflict: 'id' }))
    return txn
  },
  levelUp(studentId: string, date: string, newLevel: string) {
    const txn: Transaction = {
      id: uid('t_'),
      studentId,
      type: 'level_up',
      date,
      delta: 0,
      newLevel,
      notes: `升级为 ${newLevel}`,
      createdAt: new Date().toISOString(),
    }
    commit({ ...state, txns: [txn, ...state.txns] })
    void safeRemote(() => supabase!.from('transactions').upsert(txnCols(txn), { onConflict: 'id' }))
    this.updateStudent(studentId, { level: newLevel })
    return txn
  },
}

export type { ClassRoom, Student, Session, Attendance, Transaction }
