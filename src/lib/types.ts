// Ruby's Class — 数据模型 v2
// 班型(私教/班课) + 收费周期 + 课次 + 出勤。
// 上课次数 / 课时 = 由 attendances(present) 派生；transactions 只记充值与升级。

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7 // 1=周一 … 7=周日

export const WEEKDAYS: {
  value: Weekday
  short: string
  en: string
  cn: string
  color: string
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

export type ClassType = 'private' | 'group'

// 班级 / 课程
export interface ClassRoom {
  id: string
  name: string
  book?: string
  color: string
  type: ClassType // 私教 / 班课
  createdAt: string
}

export type StudentStatus = 'active' | 'queued'

// 学生
export interface Student {
  id: string
  name: string
  classId: string
  level?: string
  weekday?: Weekday
  status: StudentStatus
  queueTag?: string
  notes?: string
  cycleSize: number // 私教收费周期长度（默认 10）
  alertAt: number // 周期内第几节提醒（默认 9）
  createdAt: string
}

export type SessionStatus = 'scheduled' | 'done' | 'cancelled' | 'postponed'

// 课次：某班在某天的一节课
export interface Session {
  id: string
  classId: string
  date: string // YYYY-MM-DD
  status: SessionStatus
  note?: string
  createdAt: string
}

export type AttendanceStatus = 'present' | 'absent' | 'late'

// 出勤：某学生在某课次的出勤状态
export interface Attendance {
  id: string
  sessionId: string
  studentId: string
  status: AttendanceStatus
  topic?: string // 本节课内容（如 Chapter 1-2）
  note?: string
  createdAt: string
}

export type TxnType = 'recharge' | 'level_up'

// 流水：充值 / 升级
export interface Transaction {
  id: string
  studentId: string
  type: TxnType
  date: string
  delta: number
  notes?: string
  amount?: number
  newLevel?: string
  createdAt: string
}

export interface DB {
  classes: ClassRoom[]
  students: Student[]
  sessions: Session[]
  attendances: Attendance[]
  txns: Transaction[]
}
