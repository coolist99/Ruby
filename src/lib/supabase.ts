// Supabase 客户端 + 行映射（DB snake_case ↔ TS camelCase）
import { createClient } from '@supabase/supabase-js'
import type { ClassRoom, DB, Student, Transaction, Weekday } from './types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anon)

export const supabase = isSupabaseConfigured
  ? createClient(url!, anon!, { auth: { persistSession: false } })
  : null

// ── 读：DB 行 → 领域对象 ──
const rowClass = (r: any): ClassRoom => ({
  id: r.id,
  name: r.name,
  book: r.book ?? undefined,
  color: r.color,
  createdAt: r.created_at,
})
const rowStudent = (r: any): Student => ({
  id: r.id,
  name: r.name,
  classId: r.class_id ?? '',
  level: r.level ?? undefined,
  weekday: (r.weekday as Weekday) ?? undefined,
  status: r.status,
  queueTag: r.queue_tag ?? undefined,
  notes: r.notes ?? undefined,
  createdAt: r.created_at,
})
const rowTxn = (r: any): Transaction => ({
  id: r.id,
  studentId: r.student_id,
  type: r.type,
  date: r.date,
  delta: r.delta,
  topic: r.topic ?? undefined,
  notes: r.notes ?? undefined,
  amount: r.amount ?? undefined,
  newLevel: r.new_level ?? undefined,
  createdAt: r.created_at,
})

/** 从云端一次性拉取全部数据 */
export async function loadDB(): Promise<DB> {
  if (!supabase) throw new Error('Supabase 未配置')
  const [c, s, t] = await Promise.all([
    supabase.from('classes').select('*'),
    supabase.from('students').select('*'),
    supabase.from('transactions').select('*'),
  ])
  if (c.error || s.error || t.error) {
    throw (c.error || s.error || t.error) as Error
  }
  return {
    classes: (c.data ?? []).map(rowClass),
    students: (s.data ?? []).map(rowStudent),
    txns: (t.data ?? []).map(rowTxn),
  }
}

/** 云端是否为空（用于判断是否需要灌示例数据）*/
export async function isCloudEmpty(): Promise<boolean> {
  if (!supabase) return true
  const { count, error } = await supabase
    .from('students')
    .select('*', { count: 'exact', head: true })
  if (error) throw error
  return (count ?? 0) === 0
}

// ── 写：领域对象 → DB 行 ──
export const classCols = (c: ClassRoom) => ({
  id: c.id,
  name: c.name,
  book: c.book ?? null,
  color: c.color,
})
export const studentCols = (s: Student) => ({
  id: s.id,
  name: s.name,
  class_id: s.classId,
  level: s.level ?? null,
  weekday: s.weekday ?? null,
  status: s.status,
  queue_tag: s.queueTag ?? null,
  notes: s.notes ?? null,
})
export const txnCols = (t: Transaction) => ({
  id: t.id,
  student_id: t.studentId,
  type: t.type,
  date: t.date,
  delta: t.delta,
  topic: t.topic ?? null,
  notes: t.notes ?? null,
  amount: t.amount ?? null,
  new_level: t.newLevel ?? null,
})

/** 把整份 seed 灌进云端（按外键顺序：班级 → 学生 → 流水）*/
export async function bootstrapCloud(seed: DB) {
  if (!supabase) return
  const cls = await supabase
    .from('classes')
    .upsert(seed.classes.map(classCols), { onConflict: 'id' })
  if (cls.error) throw cls.error
  const st = await supabase
    .from('students')
    .upsert(seed.students.map(studentCols), { onConflict: 'id' })
  if (st.error) throw st.error
  const tx = await supabase
    .from('transactions')
    .upsert(seed.txns.map(txnCols), { onConflict: 'id' })
  if (tx.error) throw tx.error
}
