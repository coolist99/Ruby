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
import { actions, useDB } from '../lib/db'
import {
  classOf,
  lastActivity,
  remainingCredits,
  studentTxns,
  totalClasses,
  totalRecharged,
} from '../lib/selectors'
import { fmtDate, todayISO } from '../lib/format'
import type { Transaction, TxnType } from '../lib/types'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Logo,
  Modal,
  TextInput,
  useToast,
} from '../components/common'

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
        hint={
          <Link to="/students" className="text-brand-500 underline">
            返回全部学生
          </Link>
        }
      />
    )
  }

  const cls = classOf(db, student)
  const credits = remainingCredits(db, student.id)
  const txns = studentTxns(db, student.id)

  const stats = [
    {
      label: 'Total Classes',
      cn: '总课程数',
      value: totalClasses(db, student.id),
      icon: <BookOpen size={18} />,
      tint: 'var(--color-pos)',
    },
    {
      label: 'Total Recharged',
      cn: '总充值课时',
      value: totalRecharged(db, student.id),
      icon: <Coins size={18} />,
      tint: 'var(--color-mint)',
    },
    {
      label: 'Last Activity',
      cn: '最后活动',
      value: lastActivity(db, student.id) ? fmtDate(lastActivity(db, student.id)) : '—',
      icon: <CalendarCheck size={18} />,
      tint: 'var(--color-brand-500)',
    },
  ]

  return (
    <div className="print-area">
      {/* 顶部返回 */}
      <div className="mb-5 no-print">
        <Link
          to="/students"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-ink"
        >
          <ArrowLeft size={16} /> 返回全部学生
        </Link>
      </div>

      {/* 报告头 */}
      <Card className="mb-6 overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-4 px-6 py-6 sm:px-8">
          <div className="flex items-center gap-4">
            <div
              className="grid h-16 w-16 place-items-center rounded-3xl text-2xl font-bold text-white shadow-soft"
              style={{ backgroundColor: cls?.color ?? 'var(--color-brand-500)' }}
            >
              {student.name.slice(0, 1)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-ink">{student.name}</h1>
                <Badge color={cls?.color}>{cls?.name}</Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                <span className="flex items-center gap-1">
                  <Layers size={13} /> 当前级别
                  <b className="ml-1 text-brand-600">{student.level ?? '—'}</b>
                </span>
                <span className="flex items-center gap-1">
                  <BookOpen size={13} /> {cls?.book}
                </span>
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

        {/* 操作按钮 */}
        <div className="no-print flex flex-wrap gap-2 border-t border-line bg-white/40 px-6 py-3 sm:px-8">
          <Button variant="grad" onClick={() => setCheckInOpen(true)}>
            <CalendarCheck size={16} /> 打卡
          </Button>
          <Button
            variant="soft"
            onClick={() => setRechargeOpen(true)}
            style={{ color: 'var(--color-mint)' }}
          >
            <Coins size={16} /> 充值
          </Button>
          <Button
            variant="soft"
            onClick={() => setLevelOpen(true)}
            style={{ color: 'var(--color-zero)' }}
          >
            <Crown size={16} /> 升级
          </Button>
          <Button variant="ghost" className="ml-auto" onClick={() => window.print()}>
            <Download size={16} /> 导出 PDF
          </Button>
        </div>
      </Card>

      {/* 统计卡 */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((st) => (
          <Card key={st.label} className="flex items-center gap-4">
            <span
              className="grid h-12 w-12 place-items-center rounded-2xl text-white shadow-soft"
              style={{ backgroundColor: st.tint }}
            >
              {st.icon}
            </span>
            <div>
              <div className="text-xl font-bold tabular-nums text-ink">{st.value}</div>
              <div className="text-xs font-semibold text-muted">
                {st.cn} · <span className="opacity-70">{st.label}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* 历史流水 */}
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
              {txns.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-muted">
                    暂无记录
                  </td>
                </tr>
              ) : (
                txns.map((t) => <TxnRow key={t.id} t={t} />)
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted">
        <Logo size={18} />
        Generated by Ruby's Room · {fmtDate(todayISO())}
      </div>

      {/* 弹窗 */}
      <RechargeModal open={rechargeOpen} onClose={() => setRechargeOpen(false)} studentId={student.id} />
      <LevelUpModal open={levelOpen} onClose={() => setLevelOpen(false)} studentId={student.id} cur={student.level} />
      <CheckInInline open={checkInOpen} onClose={() => setCheckInOpen(false)} studentId={student.id} />
    </div>
  )
}

function TxnRow({ t }: { t: Transaction }) {
  const meta: Record<TxnType, { label: string; emoji: string; color: string }> = {
    class: { label: 'CLASS', emoji: '📚', color: 'var(--color-pos)' },
    recharge: { label: 'RECHARGE', emoji: '💰', color: 'var(--color-mint)' },
    level_up: { label: 'LEVEL UP', emoji: '🏆', color: 'var(--color-zero)' },
  }
  const m = meta[t.type]
  const desc =
    t.type === 'class'
      ? t.topic || '上课'
      : t.type === 'recharge'
        ? `充值 ${t.delta} 课时`
        : t.notes || `升级为 ${t.newLevel}`
  const right =
    t.type === 'recharge' && t.amount ? (
      <span className="font-bold text-mint">实收 ¥{t.amount.toLocaleString('zh-CN')}</span>
    ) : t.notes ? (
      <span className="text-ink-soft">{t.notes}</span>
    ) : (
      <span className="text-muted">—</span>
    )
  return (
    <tr className="border-b border-line/60 last:border-0 hover:bg-brand-50/40">
      <td className="whitespace-nowrap px-6 py-3 font-medium text-ink">{fmtDate(t.date)}</td>
      <td className="px-4 py-3">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold"
          style={{ backgroundColor: `${m.color === 'var(--color-pos)' ? '#4f86e0' : m.color === 'var(--color-mint)' ? '#5bbf7a' : '#f1a13a'}1f`, color: m.color }}
        >
          {m.emoji} {m.label}
        </span>
      </td>
      <td className="px-4 py-3 text-ink-soft">{desc}</td>
      <td className="px-6 py-3 text-right">{right}</td>
    </tr>
  )
}

function RechargeModal({
  open,
  onClose,
  studentId,
}: {
  open: boolean
  onClose: () => void
  studentId: string
}) {
  const toast = useToast()
  const [date, setDate] = useState(todayISO())
  const [credits, setCredits] = useState(10)
  const [amount, setAmount] = useState(2000)

  function submit() {
    actions.recharge(studentId, date, credits, amount)
    toast(`充值 ${credits} 课时成功 💰`)
    onClose()
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="充值 (Recharge)"
      accent="#5bbf7a"
      icon={<Coins size={18} />}
      footer={
        <>
          <Button variant="soft" onClick={onClose}>
            取消
          </Button>
          <Button variant="grad" onClick={submit} style={{ backgroundImage: 'linear-gradient(135deg,#7fd49a,#5bbf7a)' }}>
            确认充值
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="充值日期">
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label="课时数">
          <NumInput value={credits} onChange={setCredits} step={1} />
        </Field>
        <Field label="金额 (Price)">
          <NumInput value={amount} onChange={setAmount} step={100} prefix="¥" />
        </Field>
      </div>
    </Modal>
  )
}

function LevelUpModal({
  open,
  onClose,
  studentId,
  cur,
}: {
  open: boolean
  onClose: () => void
  studentId: string
  cur?: string
}) {
  const toast = useToast()
  const [level, setLevel] = useState(cur ?? '')

  function submit() {
    if (!level.trim()) {
      toast('请填写新的级别', 'info')
      return
    }
    actions.levelUp(studentId, todayISO(), level.trim())
    toast('恭喜升级！🎉')
    onClose()
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Level Up!"
      accent="#f1a13a"
      icon={<Crown size={18} />}
      footer={
        <>
          <Button variant="soft" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="grad" onClick={submit} style={{ backgroundImage: 'linear-gradient(135deg,#f5be64,#f1a13a)' }}>
            Confirm 🎉
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="rounded-2xl bg-zero/10 px-4 py-3 text-center" style={{ backgroundColor: 'rgba(241,161,58,0.1)' }}>
          <div className="text-sm font-semibold text-ink-soft">Congratulations! 🎉</div>
        </div>
        <Field label="升级后的级别">
          <TextInput autoFocus value={level} onChange={(e) => setLevel(e.target.value)} placeholder="如 Harry Potter" />
        </Field>
      </div>
    </Modal>
  )
}

// 复用打卡（从每日课程借逻辑，简化版）
function CheckInInline({
  open,
  onClose,
  studentId,
}: {
  open: boolean
  onClose: () => void
  studentId: string
}) {
  const toast = useToast()
  const [date, setDate] = useState(todayISO())
  const [topic, setTopic] = useState('')
  const [notes, setNotes] = useState('')
  function submit() {
    actions.checkIn(studentId, date, topic.trim(), notes.trim())
    toast('已打卡 ✅')
    setTopic('')
    setNotes('')
    onClose()
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="上课记录"
      accent="#ef7aa0"
      icon={<CalendarCheck size={18} />}
      footer={
        <>
          <Button variant="soft" onClick={onClose}>
            取消
          </Button>
          <Button variant="grad" onClick={submit} style={{ backgroundImage: 'linear-gradient(135deg,#f7a3c0,#ef7aa0)' }}>
            确认打卡
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="日期">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="内容（Topic）">
          <TextInput value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Chapter 1-Chapter 2" />
        </Field>
        <Field label="反馈（Notes）">
          <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="复述做得非常棒❤️" />
        </Field>
      </div>
    </Modal>
  )
}

function NumInput({
  value,
  onChange,
  step = 1,
  prefix,
}: {
  value: number
  onChange: (n: number) => void
  step?: number
  prefix?: string
}) {
  return (
    <div className="flex items-center rounded-2xl border border-line bg-white/80">
      {prefix && <span className="pl-3.5 text-sm font-bold text-muted">{prefix}</span>}
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full bg-transparent px-3.5 py-2.5 text-sm font-semibold text-ink outline-none"
      />
      <div className="flex flex-col border-l border-line">
        <button
          onClick={() => onChange(value + step)}
          className="grid h-1/2 w-9 place-items-center text-muted hover:bg-brand-50 hover:text-brand-500"
        >
          ▲
        </button>
        <button
          onClick={() => onChange(Math.max(0, value - step))}
          className="grid h-1/2 w-9 place-items-center border-t border-line text-muted hover:bg-brand-50 hover:text-brand-500"
        >
          ▼
        </button>
      </div>
    </div>
  )
}
