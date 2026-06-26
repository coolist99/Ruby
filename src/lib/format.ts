// 小工具：ID、日期、金额格式化

export const uid = (prefix = '') =>
  prefix + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)

function toISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function todayISO(): string {
  return toISO(new Date())
}

/** 当前是周几，返回 1=Mon … 7=Sun */
export function todayWeekday(): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const day = new Date().getDay() // 0=Sun … 6=Sat
  return (day === 0 ? 7 : day) as 1 | 2 | 3 | 4 | 5 | 6 | 7
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return toISO(d)
}

/** 2025-11-25 -> 2025/11/25 */
export function fmtDate(iso: string): string {
  return iso ? iso.replace(/-/g, '/') : ''
}

/** 2025-11-25 -> 11/25 */
export function fmtDateShort(iso: string): string {
  return iso ? iso.slice(5).replace(/-/g, '/') : ''
}

export const money = (n: number) => `¥${n.toLocaleString('zh-CN')}`

export function relativeDay(iso: string): string {
  if (iso === todayISO()) return '今天'
  if (iso === addDays(todayISO(), -1)) return '昨天'
  return fmtDate(iso)
}
