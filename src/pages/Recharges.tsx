// 充值记录页：全部 type === 'recharge' 流水 + FIFO 消耗台账 + 新增/编辑/删除 + 月度收入审计
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Coins,
  FileDown,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react'
import { actions, useDB } from '../lib/db'
import { classOf, monthlyRevenue, rechargeLedger } from '../lib/selectors'
import { fmtDate, fmtYM, shiftYM, todayISO } from '../lib/format'
import { exportMonthlyBillPDF } from '../lib/pdf'
import type { Transaction } from '../lib/types'
import {
  Badge,
  Button,
  Card,
  CLASS_TYPE_META,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  Select,
  TextInput,
  cn,
  useToast,
} from '../components/common'

export default function Recharges() {
  const db = useDB()
  const toast = useToast()
  const currentYM = todayISO().slice(0, 7)
  const [studentFilter, setStudentFilter] = useState('all')
  // 月度审计选中月：与列表月份筛选用同一 state（联动），学生筛选独立
  const [month, setMonth] = useState(currentYM)
  // 「未填金额」审计高亮的流水 id；换月/换学生后自动清除
  const [highlight, setHighlight] = useState<Set<string> | null>(null)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState<Transaction | null>(null)

  // 全部充值（含各学生 FIFO 台账）
  const ledgerByStudent = useMemo(() => {
    const map = new Map<string, Map<string, { consumed: number; remaining: number }>>()
    const ids = new Set(db.txns.filter((t) => t.type === 'recharge').map((t) => t.studentId))
    for (const sid of ids) {
      map.set(sid, new Map(rechargeLedger(db, sid).map((e) => [e.txn.id, { consumed: e.consumed, remaining: e.remaining }])))
    }
    return map
  }, [db])

  const rows = useMemo(() => {
    return db.txns
      .filter((t) => t.type === 'recharge')
      .filter((t) => (studentFilter === 'all' ? true : t.studentId === studentFilter))
      .filter((t) => t.date.slice(0, 7) === month)
      .map((t) => {
        const stu = db.students.find((s) => s.id === t.studentId)
        const cls = stu ? classOf(db, stu) : undefined
        const led = ledgerByStudent.get(t.studentId)?.get(t.id)
        return {
          t,
          stu,
          cls,
          consumed: led?.consumed ?? 0,
          remaining: led?.remaining ?? t.delta,
        }
      })
      .sort((a, b) => (a.t.date < b.t.date ? 1 : a.t.date > b.t.date ? -1 : 0))
  }, [db, studentFilter, month, ledgerByStudent])

  // 月份选项：从已有充值日期里聚合（补上当前月与选中月），倒序
  const months = useMemo(() => {
    const set = new Set(db.txns.filter((t) => t.type === 'recharge').map((t) => t.date.slice(0, 7)))
    set.add(currentYM)
    set.add(month)
    return [...set].sort().reverse()
  }, [db, month, currentYM])

  const totalCredits = rows.reduce((s, r) => s + r.t.delta, 0)
  const totalAmount = rows.reduce((s, r) => s + (r.t.amount ?? 0), 0)
  const totalRemaining = rows.reduce((s, r) => s + r.remaining, 0)

  const studentsSorted = useMemo(
    () => [...db.students].sort((a, b) => a.name.localeCompare(b.name, 'zh')),
    [db.students],
  )

  // ── 月度收入审计（收付实现制）──
  const rev = useMemo(() => monthlyRevenue(db, month), [db, month])
  const prevRev = useMemo(() => monthlyRevenue(db, shiftYM(month, -1)), [db, month])

  // 环比：上月 0 且本月 0 不显示；上月 0 本月>0 → 新增
  const mom = useMemo(() => {
    if (prevRev.total === 0 && rev.total === 0) return null
    if (prevRev.total === 0) return { kind: 'new' as const }
    const pct = Math.round(((rev.total - prevRev.total) / prevRev.total) * 100)
    if (pct === 0) return { kind: 'flat' as const }
    return pct > 0
      ? { kind: 'up' as const, text: `↑${pct}%` }
      : { kind: 'down' as const, text: `↓${Math.abs(pct)}%` }
  }, [rev.total, prevRev.total])

  // 班型分布胶囊：当月有充值的类型才显示（金额 0 = 该型充值都未填金额）
  const typePills = useMemo(
    () =>
      (
        [
          { key: 'private', label: '私教', color: CLASS_TYPE_META.private.color },
          { key: 'semi', label: '一对二', color: CLASS_TYPE_META.semi.color },
          { key: 'group', label: '班课', color: CLASS_TYPE_META.group.color },
          { key: 'none', label: '未分班', color: '#9b95ad' },
        ] as const
      ).filter((p) => rev.byType[p.key] != null),
    [rev],
  )

  /** 换月：同步列表筛选并清掉未填金额高亮 */
  function pickMonth(m: string) {
    setMonth(m)
    setHighlight(null)
  }

  /** 点警示条：清学生筛选、月份保持当前月，高亮/取消高亮未填金额的行 */
  function toggleMissing() {
    if (highlight) {
      setHighlight(null)
      return
    }
    setStudentFilter('all')
    setHighlight(new Set(rev.missingIds))
  }

  async function exportBill() {
    try {
      await exportMonthlyBillPDF(db, month)
      toast(`已导出 ${fmtYM(month)}收入账单 📄`)
    } catch {
      toast('导出失败，请重试', 'info')
    }
  }

  return (
    <div>
      <PageHeader
        title="充值记录"
        subtitle={`共 ${rows.length} 笔 · ${totalCredits} 课时 · ¥${totalAmount.toLocaleString('zh-CN')} · 未耗 ${totalRemaining} 课时`}
        icon={
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-mint/15 text-mint">
            <Coins size={20} />
          </span>
        }
        actions={
          <Button variant="grad" onClick={() => setAdding(true)} style={{ backgroundImage: 'linear-gradient(135deg,#7fd49a,#5bbf7a)' }}>
            <Plus size={16} /> 新增充值
          </Button>
        }
      />

      {/* ── 月度收入审计：月份切换 + 导出 ── */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            title="上一月"
            onClick={() => pickMonth(shiftYM(month, -1))}
            className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-white text-muted transition hover:border-brand-200 hover:text-brand-600"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="min-w-[7.25rem] text-center text-sm font-bold text-ink">{fmtYM(month)}</div>
          <button
            type="button"
            title="下一月"
            onClick={() => pickMonth(shiftYM(month, 1))}
            className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-white text-muted transition hover:border-brand-200 hover:text-brand-600"
          >
            <ChevronRight size={16} />
          </button>
          <Button
            variant="ghost"
            className="px-3 py-1.5 text-xs"
            disabled={month === currentYM}
            onClick={() => pickMonth(currentYM)}
          >
            本月
          </Button>
        </div>
        <Button variant="soft" onClick={exportBill}>
          <FileDown size={15} /> 导出月账单
        </Button>
      </div>

      {/* 汇总卡：收入 / 笔数 / 新增课时 / 学生数 */}
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-mint/15 text-mint">
              <Wallet size={16} />
            </span>
            当月收入
          </div>
          <div className="mt-2 truncate text-2xl font-bold tabular-nums text-mint">
            ¥{rev.total.toLocaleString('zh-CN')}
          </div>
          {mom && (
            <div
              className={cn(
                'mt-1 text-xs font-semibold',
                mom.kind === 'down' ? 'text-neg' : mom.kind === 'flat' ? 'text-muted' : 'text-mint',
              )}
            >
              {mom.kind === 'new' ? '新增' : mom.kind === 'flat' ? '与上月持平' : `${mom.text} 较上月`}
            </div>
          )}
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-50 text-brand-500">
              <Receipt size={16} />
            </span>
            充值笔数
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-ink">{rev.count}</div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-pos/10 text-pos">
              <Coins size={16} />
            </span>
            新增课时
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-ink">+{rev.credits}</div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-rose/15 text-rose">
              <Users size={16} />
            </span>
            涉及学生
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-ink">{rev.students}</div>
        </div>
      </div>

      {/* 班型分布 */}
      {typePills.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted">班型分布</span>
          {typePills.map((p) => (
            <Badge key={p.key} color={p.color} className="tabular-nums">
              {p.label} ¥{(rev.byType[p.key] ?? 0).toLocaleString('zh-CN')}
            </Badge>
          ))}
        </div>
      )}

      {/* 审计提示：未填金额（统计区与列表之间） */}
      {rev.missingAmount > 0 && (
        <button
          type="button"
          onClick={toggleMissing}
          className="mb-5 flex w-full flex-wrap items-center gap-3 rounded-3xl border border-zero/25 px-5 py-4 text-left transition hover:border-zero/50"
          style={{ backgroundColor: 'rgba(241,161,58,0.08)' }}
        >
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-zero"
            style={{ backgroundColor: 'rgba(241,161,58,0.15)' }}
          >
            <AlertTriangle size={18} />
          </span>
          <span className="text-sm font-semibold text-ink">
            本月有 {rev.missingAmount} 笔充值未填金额，收入合计可能偏低
            <span className="ml-1.5 font-bold text-zero">→ {highlight ? '取消高亮' : '点击查看'}</span>
          </span>
        </button>
      )}

      {/* 筛选：学生 + 月份 */}
      <div className="mb-5 flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 sm:w-64">
          <span className="shrink-0 text-xs font-semibold text-muted">学生</span>
          <Select
            value={studentFilter}
            onChange={(e) => {
              setStudentFilter(e.target.value)
              setHighlight(null)
            }}
          >
            <option value="all">全部学生</option>
            {studentsSorted.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </div>
        <div className="flex items-center gap-2 sm:w-56">
          <span className="shrink-0 text-xs font-semibold text-muted">月份</span>
          <Select value={month} onChange={(e) => pickMonth(e.target.value)}>
            {months.map((m) => (
              <option key={m} value={m}>{m.replace('-', ' 年 ')} 月</option>
            ))}
          </Select>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Coins size={22} />}
          title={db.txns.some((t) => t.type === 'recharge') ? '没有符合筛选的充值记录' : '还没有充值记录'}
          hint="点右上角「新增充值」记录第一笔，支持补录历史日期"
        />
      ) : (
        <Card className="p-2 sm:p-3">
          <div className="grid gap-1.5">
            {rows.map(({ t, stu, cls, consumed, remaining }) => (
              <div
                key={t.id}
                className={cn(
                  'group flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-3 py-3 transition hover:bg-brand-50/60 sm:flex-nowrap',
                  highlight?.has(t.id) && 'bg-zero/10 ring-2 ring-zero/50',
                )}
              >
                {/* 充值日期（完整日期，prominent）*/}
                <div className="w-28 shrink-0">
                  <div className="text-sm font-bold tabular-nums text-ink">{fmtDate(t.date)}</div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Recharge</div>
                </div>

                {/* 学生 + 班级 */}
                <div className="min-w-0 flex-1">
                  {stu ? (
                    <Link to={`/student/${stu.id}`} className="flex flex-wrap items-center gap-2">
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold text-white"
                        style={{ backgroundColor: cls?.color ?? 'var(--color-brand-400)' }}
                      >
                        {stu.name.slice(0, 1)}
                      </span>
                      <span className="font-semibold text-ink hover:text-brand-600">{stu.name}</span>
                      {cls && (
                        <Badge color={cls.color} className="hidden sm:inline-flex">
                          {cls.name}
                          <span className="opacity-70">· {cls.type === 'private' ? '一对一' : cls.type === 'semi' ? '一对二' : '班课'}</span>
                        </Badge>
                      )}
                    </Link>
                  ) : (
                    <span className="text-sm font-semibold text-neg">已删除的学生</span>
                  )}
                  {t.notes && <div className="mt-0.5 truncate text-xs text-muted">{t.notes}</div>}
                </div>

                {/* 课时 / 金额 / FIFO 消耗 */}
                <div className="flex shrink-0 items-center gap-4 sm:gap-6">
                  <div className="text-right">
                    <div className="text-sm font-bold tabular-nums text-mint">+{t.delta} 课时</div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Credits</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold tabular-nums text-ink">
                      {t.amount != null ? `¥${t.amount.toLocaleString('zh-CN')}` : '—'}
                    </div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Amount</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold tabular-nums text-ink-soft">
                      已消耗 <b className={consumed >= t.delta ? 'text-zero' : 'text-ink'}>{consumed}</b>
                      <span className="text-muted"> / </span>
                      剩 <b className={remaining > 0 ? 'text-pos' : 'text-muted'}>{remaining}</b>
                    </div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">FIFO</div>
                  </div>
                </div>

                {/* 操作 */}
                <div className="flex shrink-0 items-center gap-1 pl-1 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
                  <button
                    type="button"
                    title="编辑充值"
                    onClick={() => setEditing(t)}
                    className="grid h-8 w-8 place-items-center rounded-xl text-muted transition hover:bg-brand-100 hover:text-brand-600"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    title="删除充值"
                    onClick={() => setDeleting(t)}
                    className="grid h-8 w-8 place-items-center rounded-xl text-muted transition hover:bg-red-50 hover:text-neg"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <RechargeFormModal
        key={adding ? 'add' : 'idle-add'}
        open={adding}
        onClose={() => setAdding(false)}
        students={studentsSorted}
      />
      <RechargeFormModal
        key={editing?.id ?? 'idle-edit'}
        open={!!editing}
        initial={editing ?? undefined}
        onClose={() => setEditing(null)}
        students={studentsSorted}
      />
      <DeleteTxnModal txn={deleting} onClose={() => setDeleting(null)} />
    </div>
  )
}

// ── 新增 / 编辑充值弹窗 ──
function RechargeFormModal({
  open,
  onClose,
  initial,
  students,
}: {
  open: boolean
  onClose: () => void
  initial?: Transaction
  students: { id: string; name: string }[]
}) {
  const toast = useToast()
  const isEdit = !!initial
  const [studentId, setStudentId] = useState(initial?.studentId ?? students[0]?.id ?? '')
  const [date, setDate] = useState(initial?.date ?? todayISO())
  const [credits, setCredits] = useState(initial?.delta ?? 10)
  const [amount, setAmount] = useState(initial?.amount ?? 2000)
  const [notes, setNotes] = useState(initial?.notes ?? '')

  function submit() {
    if (!studentId) {
      toast('请选择学生', 'info')
      return
    }
    if (!date) {
      toast('请选择充值日期', 'info')
      return
    }
    if (!credits || credits <= 0) {
      toast('课时数要大于 0 哦', 'info')
      return
    }
    if (isEdit && initial) {
      actions.updateTxn(initial.id, {
        date,
        delta: credits,
        amount: amount || undefined,
        notes: notes.trim() || undefined,
      })
      toast('已更新充值记录 ✏️')
    } else {
      actions.recharge(studentId, date, credits, amount || undefined, notes.trim() || undefined)
      toast(`已记录充值 ${credits} 课时 💰`)
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? '编辑充值' : '新增充值'}
      accent="#5bbf7a"
      icon={<Coins size={18} />}
      footer={
        <>
          <Button variant="soft" onClick={onClose}>取消</Button>
          <Button variant="grad" onClick={submit} style={{ backgroundImage: 'linear-gradient(135deg,#7fd49a,#5bbf7a)' }}>
            {isEdit ? '保存' : '确认充值'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {!isEdit && (
          <div className="sm:col-span-2">
            <Field label="学生">
              <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                <option value="">请选择学生</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </Field>
          </div>
        )}
        <div className="sm:col-span-2">
          <Field label="充值日期（可选过去日期补录）">
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label="课时数">
          <TextInput
            type="number"
            min={1}
            value={credits}
            onChange={(e) => setCredits(Number(e.target.value) || 0)}
          />
        </Field>
        <Field label="金额 (Price)">
          <div className="flex items-center rounded-2xl border border-line bg-white/80">
            <span className="pl-3.5 text-sm font-bold text-muted">¥</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              className="w-full bg-transparent px-3.5 py-2.5 text-sm font-semibold text-ink outline-none"
            />
          </div>
        </Field>
        <div className="sm:col-span-2">
          <Field label="备注（可选）">
            <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="如 续费 / 活动赠送 / 补录 8 月充值" />
          </Field>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">
        {isEdit ? '修改日期/课时后，课时消耗与提醒会自动重新计算。' : '充值后会开一个新的收费周期（私教/一对二从上次充值后重新计数）。'}
      </p>
    </Modal>
  )
}

// ── 删除充值二次确认（沿用 DeleteStudentModal 风格）──
function DeleteTxnModal({ txn, onClose }: { txn: Transaction | null; onClose: () => void }) {
  const db = useDB()
  const toast = useToast()
  const open = !!txn
  const stu = txn ? db.students.find((s) => s.id === txn.studentId) : undefined

  function confirm() {
    if (!txn) return
    actions.removeTxn(txn.id)
    toast('已删除该笔充值')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="删除充值记录"
      accent="#e96a5b"
      icon={<Trash2 size={18} />}
      footer={
        <>
          <Button variant="soft" onClick={onClose}>再想想</Button>
          <Button
            variant="grad"
            onClick={confirm}
            style={{ backgroundImage: 'linear-gradient(135deg,#f3a094,#e96a5b)' }}
          >
            <Trash2 size={16} /> 确认删除
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <div
          className="rounded-2xl px-4 py-3 text-sm font-semibold text-neg"
          style={{ backgroundColor: 'rgba(233,106,91,0.1)' }}
        >
          删除 <b className="text-ink">{stu?.name ?? '该学生'}</b> 在 {txn ? fmtDate(txn.date) : ''} 的充值
          <b className="text-ink"> {txn?.delta} 课时</b>？
        </div>
        <p className="text-sm leading-relaxed text-muted">
          删除后该生的<b className="text-neg">剩余课时会立刻减少 {txn?.delta}</b>，
          收费周期与提醒会自动重算，<b className="text-neg">不可恢复</b>。
          如只是金额/日期填错，建议用「编辑」修改。
        </p>
      </div>
    </Modal>
  )
}
