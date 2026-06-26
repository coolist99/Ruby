// 数据仓库：Supabase 云端优先，连不上时回退到 localStorage。
// 对外 API（useDB / useDBReady / actions）保持同步语义：写入先乐观更新本地，
// 再异步写云端；写失败则从云端重新拉取以同步真相。

import { useSyncExternalStore } from 'react'
import type { ClassRoom, DB, Student, Transaction, TxnType, Weekday } from './types'
import { uid } from './format'
import { buildSeed } from './seed'
import {
  bootstrapCloud,
  isSupabaseConfigured,
  loadDB,
  studentCols,
  supabase,
  txnCols,
} from './supabase'

const STORAGE_KEY = 'rubys-room-db-v1'
const SEED_FLAG = 'rubys-room-cloud-seeded-v1'

let state: DB = { classes: [], students: [], txns: [] }
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

// 远程写入：失败时重新拉取云端
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
      // 首次为空则自动灌入示例数据
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
  return useSyncExternalStore(subscribeReady, () => ready, () => ready)
}
export function isCloud(): boolean {
  return cloudMode
}
function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}
function subscribeReady(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

// ── 写操作 ──
export const actions = {
  resetDemo() {
    if (cloudMode && supabase) {
      void (async () => {
        await supabase.from('transactions').delete().neq('id', '__none__')
        await supabase.from('students').delete().neq('id', '__none__')
        await supabase.from('classes').delete().neq('id', '__none__')
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
        await supabase.from('transactions').delete().neq('id', '__none__')
        await supabase.from('students').delete().neq('id', '__none__')
        await supabase.from('classes').delete().neq('id', '__none__')
        commit(await loadDB())
      })()
    } else {
      commit({ classes: [], students: [], txns: [] })
    }
  },
  addStudent(input: Omit<Student, 'id' | 'createdAt'>) {
    const s: Student = { ...input, id: uid('s_'), createdAt: new Date().toISOString() }
    commit({ ...state, students: [...state.students, s] })
    void safeRemote(() => supabase!.from('students').insert(studentCols(s)))
    return s
  },
  updateStudent(id: string, patch: Partial<Student>) {
    const cur = state.students.find((s) => s.id === id)
    if (!cur) return
    const merged: Student = { ...cur, ...patch }
    commit({ ...state, students: state.students.map((s) => (s.id === id ? merged : s)) })
    void safeRemote(() => supabase!.from('students').update(studentCols(merged)).eq('id', id))
  },
  removeStudent(id: string) {
    commit({
      ...state,
      students: state.students.filter((s) => s.id !== id),
      txns: state.txns.filter((t) => t.studentId !== id),
    })
    void safeRemote(async () => {
      await supabase!.from('transactions').delete().eq('student_id', id)
      await supabase!.from('students').delete().eq('id', id)
    })
  },
  addTxn(input: Omit<Transaction, 'id' | 'createdAt'>) {
    const txn: Transaction = { ...input, id: uid('t_'), createdAt: new Date().toISOString() }
    commit({ ...state, txns: [txn, ...state.txns] })
    void safeRemote(() => supabase!.from('transactions').insert(txnCols(txn)))
    return txn
  },
  checkIn(studentId: string, date: string, topic: string, notes: string) {
    return this.addTxn({ studentId, type: 'class', date, delta: -1, topic, notes })
  },
  batchCheckIn(classId: string, date: string) {
    const targets = state.students.filter((s) => s.classId === classId && s.status === 'active')
    const newTxns: Transaction[] = targets.map((s) => ({
      id: uid('t_'),
      studentId: s.id,
      type: 'class',
      date,
      delta: -1,
      topic: '',
      createdAt: new Date().toISOString(),
    }))
    commit({ ...state, txns: [...newTxns, ...state.txns] })
    void safeRemote(() => supabase!.from('transactions').insert(newTxns.map(txnCols)))
    return targets.length
  },
  recharge(studentId: string, date: string, credits: number, amount?: number) {
    return this.addTxn({ studentId, type: 'recharge', date, delta: credits, amount })
  },
  levelUp(studentId: string, date: string, newLevel: string) {
    const t = this.addTxn({ studentId, type: 'level_up', date, delta: 0, newLevel })
    this.updateStudent(studentId, { level: newLevel })
    return t
  },
}

export function weekdayOfToday(): Weekday {
  const day = new Date().getDay()
  return (day === 0 ? 7 : day) as Weekday
}

export type { ClassRoom, Student, Transaction, TxnType }
