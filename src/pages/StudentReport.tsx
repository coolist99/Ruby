import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  CalendarCheck,
  Coins,
  Crown,
  Download,
  GraduationCap,
  Layers,
  Pencil,
  Trash2,
} from 'lucide-react'
import { actions, useDB } from '../lib/db'
import {
  classOf,
  cycleProgress,
  giftCount,
  lastActivity,
  presentCount,
  remainingCredits,
  studentHistory,
  totalRecharged,
  type HistoryItem,
  type HistoryKind,
} from '../lib/selectors'
import { isPrivateLike, type AttendanceStatus } from '../lib/types'
import { fmtDate, todayISO } from '../lib/format'
import { Badge, Button, Card, ClassTypeBadge, EmptyState, Field, GiftBadge, Logo, Modal, TextInput, cn, useToast } from '../components/common'
import { StudentFormModal } from '../components/StudentForm'
import { DeleteStudentModal } from '../components/DeleteStudentModal'
import { RechargeModal, LevelUpModal, CheckInInline } from './reportModals'

export default function StudentReport() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const db = useDB()
  const student = db.students.find((s) => s.id === id)

  const [rechargeOpen, setRechargeOpen] = useState(false)
  const [levelOpen, setLevelOpen] = useState(false)
  const [checkInOpen, setCheckInOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  // 编辑某条出勤记录（补录 / 改状态 / 改赠课）
  const [editAtt, setEditAtt] = useState<{
    sessionId: string
    date: string
    status: AttendanceStatus
    topic: string
    note: string
    gift: boolean
  } | null>(null)

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
  const isPrivate = isPrivateLike(cls?.type)
  const gifts = giftCount(db, student.id)

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
                <ClassTypeBadge type={cls?.type} />
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
              {gifts > 0 && <div className="mt-0.5 text-[11px] font-semibold text-mint">含赠课 {gifts} 节</div>}
            </div>
            <div className="hidden text-right sm:block">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">报告日期</div>
              <div className="text-sm font-bold text-ink">{fmtDate(todayISO())}</div>
            </div>
          </div>
        </div>

        {/* 私教/一对二周期进度 */}
        {isPrivate && (
          <div className="border-t border-line bg-white/40 px-6 py-3 sm:px-8">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-semibold text-ink-soft">收费周期{cls?.type === 'semi' ? '（一对二）' : ''}</span>
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
          <Button variant="soft" onClick={() => setEditOpen(true)}><Pencil size={16} /> 编辑资料</Button>
          <Button variant="danger" className="ml-auto" onClick={() => setDeleteOpen(true)}><Trash2 size={16} /> 删除</Button>
          <Button variant="ghost" onClick={() => window.print()}><Download size={16} /> 导出 PDF</Button>
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
                history.map((h, i) => (
                  <HistoryRow
                    key={i}
                    h={h}
                    onEditAtt={(payload) => setEditAtt(payload)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted">
        <Logo size={18} /> Generated by Ruby's Class · {fmtDate(todayISO())}
      </div>

      <RechargeModal open={rechargeOpen} onClose={() => setRechargeOpen(false)} studentId={student.id} />
      <LevelUpModal open={levelOpen} onClose={() => setLevelOpen(false)} studentId={student.id} cur={student.level} />
      <CheckInInline open={checkInOpen} onClose={() => setCheckInOpen(false)} studentId={student.id} />
      <StudentFormModal open={editOpen} initial={student} onClose={() => setEditOpen(false)} />
      <DeleteStudentModal
        open={deleteOpen}
        student={student}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => navigate('/students')}
      />
      <EditAttendanceModal
        target={editAtt}
        studentId={student.id}
        onClose={() => setEditAtt(null)}
      />
    </div>
  )
}

// ── 编辑历史里的某条出勤：状态 / topic / note / 赠课，可删除 ──
function EditAttendanceModal({
  target,
  studentId,
  onClose,
}: {
  target: {
    sessionId: string
    date: string
    status: AttendanceStatus
    topic: string
    note: string
    gift: boolean
  } | null
  studentId: string
  onClose: () => void
}) {
  const toast = useToast()
  const open = !!target
  const [status, setStatus] = useState<AttendanceStatus>('present')
  const [topic, setTopic] = useState('')
  const [note, setNote] = useState('')
  const [gift, setGift] = useState(false)

  // target 变化时重置表单
  useEffect(() => {
    if (target) {
      setStatus(target.status)
      setTopic(target.topic)
      setNote(target.note)
      setGift(target.gift)
    }
  }, [target])

  const t = target
  if (!t) return null
  const setAtt = (sid: string) =>
    actions.setAttendanceFor(sid, studentId, status, {
      topic: topic.trim() || undefined,
      note: note.trim() || undefined,
      gift: status === 'present' ? gift : false,
    })
  const save = () => {
    setAtt(t!.sessionId)
    toast('已更新出勤记录 ✏️')
    onClose()
  }
  function remove() {
    actions.removeAttendance(t!.sessionId, studentId)
    toast('已删除该条出勤')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`编辑出勤 · ${fmtDate(t.date)}`}      accent="#ef7aa0"
      icon={<Pencil size={18} />}
      footer={
        <>
          <Button variant="danger" className="mr-auto" onClick={remove}>
            <Trash2 size={16} /> 删除
          </Button>
          <Button variant="soft" onClick={onClose}>取消</Button>
          <Button variant="grad" onClick={save}>保存</Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="flex items-center gap-1.5">
          {(['present', 'late', 'absent'] as AttendanceStatus[]).map((st) => (
            <button
              key={st}
              onClick={() => setStatus(st)}
              className={cn(
                'flex-1 rounded-2xl border px-3 py-2 text-sm font-bold transition',
                status === st
                  ? 'border-transparent text-white'
                  : 'border-line bg-white text-ink-soft',
              )}
              style={
                status === st
                  ? { backgroundColor: st === 'present' ? 'var(--color-mint)' : st === 'late' ? 'var(--color-zero)' : 'var(--color-neg)' }
                  : undefined
              }
            >
              {st === 'present' ? '到课' : st === 'late' ? '迟到' : '缺勤'}
            </button>
          ))}
        </div>
        {status === 'present' && (
          <div className="flex items-center justify-between rounded-2xl border border-line bg-white/60 px-4 py-3">
            <div>
              <div className="text-sm font-bold text-ink">🎁 赠课</div>
              <div className="text-xs text-muted">本节不消耗课时、不计收费周期</div>
            </div>
            <button
              type="button"
              onClick={() => setGift((g) => !g)}
              className={cn('relative h-7 w-12 rounded-full transition', gift ? 'bg-mint' : 'bg-black/15')}
              aria-pressed={gift}
            >
              <span
                className={cn(
                  'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all',
                  gift ? 'left-6' : 'left-1',
                )}
              />
            </button>
          </div>
        )}
        <Field label="内容（Topic）">
          <TextInput value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Chapter 1-Chapter 2" />
        </Field>
        <Field label={status === 'absent' ? '缺勤原因' : '反馈（Notes）'}>
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder={status === 'absent' ? '如 请假 / 生病' : '复述做得非常棒❤️'} />
        </Field>
      </div>
    </Modal>
  )
}

const KIND_META: Record<HistoryKind, { label: string; emoji: string; color: string }> = {
  class: { label: 'CLASS', emoji: '📚', color: '#4f86e0' },
  absent: { label: 'ABSENT', emoji: '❌', color: '#e96a5b' },
  recharge: { label: 'RECHARGE', emoji: '💰', color: '#5bbf7a' },
  level_up: { label: 'LEVEL UP', emoji: '🏆', color: '#f1a13a' },
}

function HistoryRow({ h, onEditAtt }: { h: HistoryItem; onEditAtt: (payload: { sessionId: string; date: string; status: AttendanceStatus; topic: string; note: string; gift: boolean }) => void }) {
  const m = KIND_META[h.kind]
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
      <td className="whitespace-nowrap px-6 py-3 font-medium text-ink">
        {fmtDate(h.date)}
        {h.att?.gift && h.att.status === 'present' && (
          <span className="ml-1.5 inline-flex align-middle"><GiftBadge /></span>
        )}
        {h.att?.status === 'late' && (
          <span className="ml-1.5 inline-flex align-middle"><Badge color="#f1a13a" className="px-1.5 py-0 text-[10px]">迟到</Badge></span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ backgroundColor: `${m.color}1f`, color: m.color }}>
          {m.emoji} {m.label}
        </span>
      </td>
      <td className="px-4 py-3 text-ink-soft">
        {h.title}
        {h.kind === 'recharge' && h.txn && (
          <span className="ml-2 whitespace-nowrap text-xs font-semibold text-muted tabular-nums">
            已消耗 {h.txn.consumed} / 剩 {h.txn.remaining}
          </span>
        )}
        {h.att && (
          <button
            onClick={() =>
              onEditAtt({
                sessionId: h.att!.sessionId,
                date: h.date,
                status: h.att!.status,
                topic: h.att!.topic ?? '',
                note: h.note ?? '',
                gift: h.att!.gift,
              })
            }
            className="ml-2 rounded-lg px-1.5 py-0.5 text-[11px] font-bold text-brand-500 transition hover:bg-brand-50"
          >
            编辑
          </button>
        )}
      </td>
      <td className="px-6 py-3 text-right">{right}</td>
    </tr>
  )
}
