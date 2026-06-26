// Supabase 客户端 + 行映射（DB snake_case ↔ TS camelCase）
import { createClient } from '@supabase/supabase-js'
import type {
  Attendance,
  ClassRoom,
  DB,
  Session,
  SessionStatus,
  Student,
  Transaction,
  Weekday,
} from './types'

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
  type: r.type ?? 'group',
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
  cycleSize: r.cycle_size ?? 10,
  alertAt: r.alert_at ?? 9,
  createdAt: r.created_at,
})
const rowSession = (r: any): Session => ({
  id: r.id,
  classId: r.class_id,
  date: r.date,
  status: (r.status as SessionStatus) ?? 'scheduled',
  note: r.note ?? undefined,
  createdAt: r.created_at,
})
const rowAtt = (r: any): Attendance => ({
  id: r.id,
  sessionId: r.session_id,
  studentId: r.student_id,
  status: r.status,
  topic: r.topic ?? undefined,
  note: r.note ?? undefined,
  createdAt: r.created_at,
})
const rowTxn = (r: any): Transaction => ({
  id: r.id,
  studentId: r.student_id,
  type: r.type,
  date: r.date,
  delta: r.delta,
  notes: r.notes ?? undefined,
  amount: r.amount ?? undefined,
  newLevel: r.new_level ?? undefined,
  createdAt: r.created_at,
})

/** 从云端一次性拉取全部数据 */
export async function loadDB(): Promise<DB> {
  if (!supabase) throw new Error('Supabase 未配置')
  const [c, s, ses, a, t] = await Promise.all([
    supabase.from('classes').select('*'),
    supabase.from('students').select('*'),
    supabase.from('sessions').select('*'),
    supabase.from('attendances').select('*'),
    supabase.from('transactions').select('*'),
  ])
  if (c.error || s.error || ses.error || a.error || t.error) {
    throw (c.error || s.error || ses.error || a.error || t.error) as Error
  }
  return {
    classes: (c.data ?? []).map(rowClass),
    students: (s.data ?? []).map(rowStudent),
    sessions: (ses.data ?? []).map(rowSession),
    attendances: (a.data ?? []).map(rowAtt),
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
  type: c.type,
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
  cycle_size: s.cycleSize,
  alert_at: s.alertAt,
})
export const sessionCols = (ses: Session) => ({
  id: ses.id,
  class_id: ses.classId,
  date: ses.date,
  status: ses.status,
  note: ses.note ?? null,
})
export const attCols = (a: Attendance) => ({
  id: a.id,
  session_id: a.sessionId,
  student_id: a.studentId,
  status: a.status,
  topic: a.topic ?? null,
  note: a.note ?? null,
})
export const txnCols = (t: Transaction) => ({
  id: t.id,
  student_id: t.studentId,
  type: t.type,
  date: t.date,
  delta: t.delta,
  notes: t.notes ?? null,
  amount: t.amount ?? null,
  new_level: t.newLevel ?? null,
})

/** 把整份 seed 灌进云端（按外键顺序）*/
export async function bootstrapCloud(seed: DB) {
  if (!supabase) return
  const steps: Array<() => PromiseLike<any>> = [
    () => supabase.from('classes').upsert(seed.classes.map(classCols), { onConflict: 'id' }),
    () => supabase.from('students').upsert(seed.students.map(studentCols), { onConflict: 'id' }),
    () => supabase.from('sessions').upsert(seed.sessions.map(sessionCols), { onConflict: 'id' }),
    () => supabase.from('attendances').upsert(seed.attendances.map(attCols), { onConflict: 'id' }),
    () => supabase.from('transactions').upsert(seed.txns.map(txnCols), { onConflict: 'id' }),
  ]
  for (const step of steps) {
    const r = await step()
    if (r.error) throw r.error
  }
}
