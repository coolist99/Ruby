// 示例数据生成（不依赖 React，App 与云端灌数脚本共用）
import type { ClassRoom, DB, Student, Transaction } from './types'
import { addDays, uid } from './format'

export function buildSeed(): DB {
  const classes: ClassRoom[] = [
    { id: 'c_fn', name: 'Fancy Nancy', book: 'Fancy Nancy', color: '#b89bff', createdAt: '2025-09-01' },
    { id: 'c_wk', name: '外刊', book: '英语外刊精读', color: '#5b8def', createdAt: '2025-09-01' },
    { id: 'c_k1', name: '科一', book: '科学一级', color: '#5bbf7a', createdAt: '2025-09-01' },
    { id: 'c_re1', name: 'RE1', book: 'Reading Explorer 1', color: '#9b6bef', createdAt: '2025-09-01' },
    { id: 'c_ref', name: 'RE-F', book: 'Reading Explorer F', color: '#c08bef', createdAt: '2025-09-01' },
    { id: 'c_ft', name: 'Frog and Toad', book: 'Frog and Toad', color: '#5bbfa0', createdAt: '2025-09-01' },
    { id: 'c_mth', name: 'Magic Tree House#2', book: 'Magic Tree House #2', color: '#f5a623', createdAt: '2025-09-01' },
    { id: 'c_dm', name: 'Dragon Masters#1', book: 'Dragon Masters #1', color: '#ef6c8a', createdAt: '2025-09-01' },
  ]
  const byName = Object.fromEntries(classes.map((c) => [c.name, c.id]))

  const students: Student[] = []
  const txns: Transaction[] = []
  const today = '2025-11-25'

  let si = 0
  function add(
    name: string,
    className: string,
    opts: Partial<Student> & { classes?: number; target?: number } = {},
  ): Student {
    si += 1
    const { classes: taken = 2, target = 4, ...rest } = opts
    const s: Student = {
      id: `s_${si}`,
      name,
      classId: byName[className],
      level: 'L1',
      status: 'active',
      createdAt: today,
      ...rest,
    }
    students.push(s)
    for (let i = 0; i < taken; i += 1) {
      txns.push({
        id: uid('t_'),
        studentId: s.id,
        type: 'class',
        date: addDays(today, -(i * 7 + 3)),
        delta: -1,
        topic: `Chapter ${i + 1}`,
        createdAt: addDays(today, -(i * 7 + 3)),
      })
    }
    const recharge = Math.max(0, target + taken)
    if (recharge > 0) {
      txns.push({
        id: uid('t_'),
        studentId: s.id,
        type: 'recharge',
        date: addDays(today, -(taken * 7 + 10)),
        delta: recharge,
        amount: recharge * 200,
        notes: '充值',
        createdAt: addDays(today, -(taken * 7 + 10)),
      })
    }
    return s
  }

  add('Iris', 'Fancy Nancy', { level: 'L1', weekday: 2, classes: 4, target: -4 })
  add('Cici', 'Fancy Nancy', { level: 'L1', weekday: 2, classes: 3, target: -3 })
  add('Molly', '外刊', { level: 'L2', weekday: 3, classes: 3, target: 7 })
  add('Shelly', '科一', { level: 'L2', weekday: 3, classes: 3, target: 7 })
  add('Antonio', '科一', { level: 'L1', weekday: 3, classes: 2, target: 3 })
  add('Lily', 'RE1', { level: 'L1', weekday: 2, classes: 2, target: 0 })
  add('Tom', 'RE-F', { level: 'L1', weekday: 2, classes: 2, target: 6 })
  add('Tim', 'RE-F', { level: 'L1', weekday: 4, classes: 2, target: 8 })
  add('Lucy', 'RE-F', { level: 'L3', weekday: 4, classes: 2, target: 6 })
  add('Chard', 'Frog and Toad', { level: 'L1', weekday: 3, classes: 2, target: 4 })
  add('Eason', 'Frog and Toad', { level: 'L1', weekday: 3, classes: 3, target: 1 })
  add('Eden', 'Frog and Toad', { level: 'L1', weekday: 3, classes: 2, target: 0 })
  add('Leo', 'Frog and Toad', { level: 'L1', weekday: 3, classes: 2, target: 1 })
  add('Amelia', 'Magic Tree House#2', { level: 'L2', weekday: 5, classes: 2, target: 1 })
  add('Jasmine', 'Magic Tree House#2', { level: 'L2', weekday: 5, classes: 2, target: 3 })
  add('Kane', 'Dragon Masters#1', { level: 'L3', weekday: 6, classes: 2, target: 10 })

  const emma = add('Emma', 'Dragon Masters#1', { level: 'Harry Potter', weekday: 6, classes: 0, target: 0 })
  txns.push(
    {
      id: uid('t_'),
      studentId: emma.id,
      type: 'recharge',
      date: addDays(today, -20),
      delta: 15,
      amount: 3000,
      notes: '充值',
      createdAt: addDays(today, -20),
    },
    {
      id: uid('t_'),
      studentId: emma.id,
      type: 'class',
      date: addDays(today, -7),
      delta: -1,
      topic: 'Chapter 1-Chapter 2',
      notes: '复述做得非常棒❤️',
      createdAt: addDays(today, -7),
    },
    {
      id: uid('t_'),
      studentId: emma.id,
      type: 'level_up',
      date: addDays(today, -2),
      delta: 0,
      newLevel: 'Harry Potter',
      notes: '升级为 Harry Potter',
      createdAt: addDays(today, -2),
    },
    {
      id: uid('t_'),
      studentId: emma.id,
      type: 'class',
      date: today,
      delta: -1,
      topic: 'Chapter 4-Chapter 5',
      createdAt: today,
    },
  )

  let qi = 0
  function queue(name: string, className: string, tag: string, level = 'L1') {
    qi += 1
    students.push({
      id: `q_${qi}`,
      name,
      classId: byName[className],
      level,
      status: 'queued',
      queueTag: tag,
      createdAt: today,
    })
  }
  queue('Kay', 'RE1', 'RE1待组班')
  queue('Sarah', 'Fancy Nancy', '试听')
  queue('Kelly', 'RE1', 'RE2待组班')
  queue('Harry', 'Magic Tree House#2', '待组班')

  return { classes, students, txns }
}
