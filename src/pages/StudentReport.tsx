import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  CalendarCheck,
  Coins,
  Crown,
  Download,
  GraduationCap,
  Layers,
} from 'lucide-react'
import { useDB } from '../lib/db'
import {
  classOf,
  cycleProgress,
  lastActivity,
  presentCount,
  remainingCredits,
  studentHistory,
  totalRecharged,
  type HistoryItem,
  type HistoryKind,
} from '../lib/selectors'
import { fmtDate, todayISO } from '../lib/format'
import { Badge, Button, Card, EmptyState, Logo, cn } from '../components/common'
import { RechargeModal, LevelUpModal, CheckInInline } from './reportModals'

export default function StudentReport() {
  const { id = '' } = useParams()
  const db = useDB()
  const student = db.students.find((s) => s.id === id)

  const [rechargeOpen, setRechargeOpen] = useState(false)
  const [levelOpen, setLevelOpen] = useState(false)
  const [checkInOpen, setCheckInOpen] = useState(false)

  if (!student) {
    return (
      <EmptyState
        icon={<GraduationCap size={22} />}
        title="找不到这位学生"
        hint={<Link to="/students" className="text-brand-500 underline">返回全部学生</Link>}
      />
    )
  }

  const cls = classOf(db, student)
  const credits = remainingCredits(db, student.id)
  const history = studentHistory(db, student.id)
  const cyc = cycleProgress(db, student)
  const isPrivate = cls?.type === 'private'

  const stats = [
    { label: 'Total Classes', cn: '已上课数', value: presentCount(db, student.id), icon: <BookOpen size={18} />, tint: 'var(--color-pos)' },
    { label: 'Total Recharged', cn: '总充值课时', value: totalRecharged(db, student.id), icon: <Coins size={18} />, tint: 'var(--color-mint)' },
    { label: 'Last Activity', cn: '最后活动', value: lastActivity(db, student.id) ? fmtDate(lastActivity(db, student.id)) : '—', icon: <CalendarCheck size={18} />, tint: 'var(--color-brand-500)' },
  ]

  return (
    <div className="print-area">
      <div className="mb-5 no-print">
        <Link to="/students" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-ink">
          <ArrowLeft size={16} /> 返回全部学生
        </Link>
      </div>

      <Card className="mb-6 overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-4 px-6 py-6 sm:px-8">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-3xl text-2xl font-bold text-white shadow-soft" style={{ backgroundColor: cls?.color ?? 'var(--color-brand-500)' }}>
              {student.name.slice(0, 1)}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-ink">{student.name}</h1>
                <Badge color={cls?.color}>{cls?.name}</Badge>
                <Badge color={isPrivate ? '#ef7aa0' : '#5b8def'}>{isPrivate ? '私教' : '班课'}</Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                <span className="flex items-center gap-1">
                  <Layers size={13} /> 当前级别 <b className="ml-1 text-brand-600">{student.level ?? '—'}</b>
                </span>
                <span className="flex items-center gap-1"><BookOpen size={13} /> {cls?.book}</span>
              </div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-6">
            <div className="text-right">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">剩余课时</div>
              <div className="text-3xl font-bold tabular-nums text-ink">{credits}</div>
            </div>
            <div className="hidden text-right sm:block">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">报告日期</div>
              <div className="text-sm font-bold text-ink">{fmtDate(todayISO())}</div>
            </div>
          </div>
        </div>

        {/* 私教周期进度 */}
        {isPrivate && (
          <div className="border-t border-line bg-white/40 px-6 py-3 sm:px-8">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-semibold text-ink-soft">收费周期</span>
              <div className="h-2 w-40 overflow-hidden rounded-full bg-black/5">
                <div
                  className={cn('h-full rounded-full', cyc.alert || cyc.over ? 'bg-neg' : 'bg-brand-400')}
                  style={{ width: `${Math.min(100, (cyc.taken / cyc.cycleSize) * 100)}%` }}
                />
              </div>
              <span className="tabular-nums text-ink-soft">
                第 <b>{cyc.taken}</b> / {cyc.cycleSize} 节
              </span>
              {cyc.alert && <Badge color="#f1a13a">第 {cyc.alertAt} 节 · 该提醒续费</Badge>}
              {cyc.over && <Badge color="#e96a5b">已满周期 · 请续费</Badge>}
            </div>
          </div>
        )}

        <div className="no-print flex flex-wrap gap-2 border-t border-line bg-white/40 px-6 py-3 sm:px-8">
          <Button variant="grad" onClick={() => setCheckInOpen(true)}><CalendarCheck size={16} /> 打卡</Button>
          <Button variant="soft" onClick={() => setRechargeOpen(true)} style={{ color: 'var(--color-mint)' }}><Coins size={16} /> 充值</Button>
          <Button variant="soft" onClick={() => setLevelOpen(true)} style={{ color: 'var(--color-zero)' }}><Crown size={16} /> 升级</Button>
          <Button variant="ghost" className="ml-auto" onClick={() => window.print()}><Download size={16} /> 导出 PDF</Button>
        </div>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((st) => (
          <Card key={st.label} className="flex items-center gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-2xl text-white shadow-soft" style={{ backgroundColor: st.tint }}>{st.icon}</span>
            <div>
              <div className="text-xl font-bold tabular-nums text-ink">{st.value}</div>
              <div className="text-xs font-semibold text-muted">{st.cn} · <span className="opacity-70">{st.label}</span></div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-lg font-bold text-ink">所有历史记录</h2>
          <span className="text-xs text-muted">Detailed Records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-line bg-white/50 text-xs text-muted">
                <th className="px-6 py-2.5 text-left font-semibold">日期</th>
                <th className="px-4 py-2.5 text-left font-semibold">类型</th>
                <th className="px-4 py-2.5 text-left font-semibold">描述 / 主题</th>
                <th className="px-6 py-2.5 text-right font-semibold">备注 / 金额</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-10 text-center text-muted">暂无记录</td></tr>
              ) : (
                history.map((h, i) => <HistoryRow key={i} h={h} />)
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted">
        <Logo size={18} /> Generated by Ruby's Room · {fmtDate(todayISO())}
      </div>

      <RechargeModal open={rechargeOpen} onClose={() => setRechargeOpen(false)} studentId={student.id} />
      <LevelUpModal open={levelOpen} onClose={() => setLevelOpen(false)} studentId={student.id} cur={student.level} />
      <CheckInInline open={checkInOpen} onClose={() => setCheckInOpen(false)} studentId={student.id} />
    </div>
  )
}

const KIND_META: Record<HistoryKind, { label: string; emoji: string; color: string }> = {
  class: { label: 'CLASS', emoji: '📚', color: '#4f86e0' },
  absent: { label: 'ABSENT', emoji: '❌', color: '#e96a5b' },
  recharge: { label: 'RECHARGE', emoji: '💰', color: '#5bbf7a' },
  level_up: { label: 'LEVEL UP', emoji: '🏆', color: '#f1a13a' },
}

function HistoryRow({ h }: { h: HistoryItem }) {  const m = KIND_META[h.kind]
  const right =
    h.kind === 'recharge' && h.amount ? (
      <span className="font-bold text-mint">实收 ¥{h.amount.toLocaleString('zh-CN')}</span>
    ) : h.note ? (
      <span className="text-ink-soft">{h.note}</span>
    ) : (
      <span className="text-muted">—</span>
    )
  return (
    <tr className="border-b border-line/60 last:border-0 hover:bg-brand-50/40">
      <td className="whitespace-nowrap px-6 py-3 font-medium text-ink">{fmtDate(h.date)}</td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ backgroundColor: `${m.color}1f`, color: m.color }}>
          {m.emoji} {m.label}
        </span>
      </td>
      <td className="px-4 py-3 text-ink-soft">{h.title}</td>
      <td className="px-6 py-3 text-right">{right}</td>
    </tr>
  )
}
