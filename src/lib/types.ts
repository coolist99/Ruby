// Cathy's Room — 数据模型
// 设计原则：课时是"流水账(ledger)"。剩余课时 = 该学生所有 transaction.delta 之和。
// 考勤 = type:'class' 的 transaction。排课 = student.weekday。
// 这样一套表能同时支撑「剩余课时 / 考勤统计 / 学生档案报告」三大视图。

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7 // 1=周一 … 7=周日

export const WEEKDAYS: {
  value: Weekday
  short: string // Mon
  en: string // Monday
  cn: string // 周一
  color: string // 主题色 hex
  emoji: string
}[] = [
  { value: 1, short: 'Mon', en: 'Monday', cn: '周一', color: '#ef6c5b', emoji: '🔴' },
  { value: 2, short: 'Tue', en: 'Tuesday', cn: '周二', color: '#f59e42', emoji: '🟠' },
  { value: 3, short: 'Wed', en: 'Wednesday', cn: '周三', color: '#f5c842', emoji: '🟡' },
  { value: 4, short: 'Thu', en: 'Thursday', cn: '周四', color: '#5bbf7a', emoji: '🟢' },
  { value: 5, short: 'Fri', en: 'Friday', cn: '周五', color: '#5b8def', emoji: '🔵' },
  { value: 6, short: 'Sat', en: 'Saturday', cn: '周六', color: '#9b6bef', emoji: '🟣' },
  { value: 7, short: 'Sun', en: 'Sunday', cn: '周日', color: '#ef5b8a', emoji: '🌸' },
]

// 班级 / 课程（一个班对应一本教材/一套进度）
export interface ClassRoom {
  id: string
  name: string // "Fancy Nancy" / "外刊" / "科一"
  book?: string // 教材备注
  color: string // 主题色 hex
  createdAt: string
}

export type StudentStatus = 'active' | 'queued' // 在读 / 待排课

// 学生
export interface Student {
  id: string
  name: string // Iris / Cici …
  classId: string
  level?: string // 当前级别：L1 / L3 / Harry Potter
  weekday?: Weekday // 排课星期；待排课学生通常没有
  status: StudentStatus
  queueTag?: string // 待排课标签："RE1待组班" / "试听"
  notes?: string // 备注 / 近期教材
  createdAt: string
}

export type TxnType = 'class' | 'recharge' | 'level_up'

// 课时流水（不可变账本）
export interface Transaction {
  id: string
  studentId: string
  type: TxnType
  date: string // YYYY-MM-DD
  delta: number // class: -1, recharge: +N, level_up: 0
  topic?: string // "Chapter 1-Chapter 2"
  notes?: string // 反馈 / 课堂记录："复述做得非常棒❤️"
  amount?: number // 充值金额 ¥（仅 recharge）
  newLevel?: string // 升级后的级别（仅 level_up）
  createdAt: string
}

export interface DB {
  classes: ClassRoom[]
  students: Student[]
  txns: Transaction[]
}
