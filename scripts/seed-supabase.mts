// 可靠地把示例数据灌进云库（逐表，带日志）。运行：
//   npx tsx --env-file=.env scripts/seed-supabase.mts
import { createClient } from '@supabase/supabase-js'
import { buildSeed } from '../src/lib/seed.ts'
import type { Attendance, ClassRoom, Session, Student, Transaction } from '../src/lib/types.ts'

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)

const classCols = (c: ClassRoom) => ({ id: c.id, name: c.name, book: c.book ?? null, color: c.color, type: c.type })
const studentCols = (s: Student) => ({ id: s.id, name: s.name, class_id: s.classId, level: s.level ?? null, weekday: s.weekday ?? null, status: s.status, queue_tag: s.queueTag ?? null, notes: s.notes ?? null, cycle_size: s.cycleSize, alert_at: s.alertAt })
const sessionCols = (x: Session) => ({ id: x.id, class_id: x.classId, date: x.date, status: x.status, note: x.note ?? null })
const attCols = (a: Attendance) => ({ id: a.id, session_id: a.sessionId, student_id: a.studentId, status: a.status, topic: a.topic ?? null, note: a.note ?? null })
const txnCols = (t: Transaction) => ({ id: t.id, student_id: t.studentId, type: t.type, date: t.date, delta: t.delta, notes: t.notes ?? null, amount: t.amount ?? null, new_level: t.newLevel ?? null })

const seed = buildSeed()
console.log(`seed 生成: classes=${seed.classes.length} students=${seed.students.length} sessions=${seed.sessions.length} attendances=${seed.attendances.length} txns=${seed.txns.length}`)

// 清空（子→父）
for (const t of ['attendances', 'sessions', 'transactions', 'students', 'classes']) {
  await sb.from(t).delete().neq('id', '__none__')
}

// 按外键顺序逐表 upsert
const steps: Array<[string, () => Promise<any>]> = [
  ['classes', () => sb.from('classes').upsert(seed.classes.map(classCols), { onConflict: 'id' })],
  ['students', () => sb.from('students').upsert(seed.students.map(studentCols), { onConflict: 'id' })],
  ['sessions', () => sb.from('sessions').upsert(seed.sessions.map(sessionCols), { onConflict: 'id' })],
  ['attendances', () => sb.from('attendances').upsert(seed.attendances.map(attCols), { onConflict: 'id' })],
  ['transactions', () => sb.from('transactions').upsert(seed.txns.map(txnCols), { onConflict: 'id' })],
]

for (const [name, fn] of steps) {
  const r = await fn()
  if (r.error) {
    console.error(`❌ ${name}:`, r.error.message)
    process.exit(1)
  }
  console.log(`✓ ${name} 已灌入`)
}
console.log('🎉 全部灌入完成')
