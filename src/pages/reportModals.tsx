// 学生档案页用到的弹窗：充值 / 升级 / 打卡（记一节课）
import { useState } from 'react'
import { CalendarCheck, Coins, Crown } from 'lucide-react'
import { actions } from '../lib/db'
import { todayISO } from '../lib/format'
import { Button, Field, Modal, TextInput, useToast } from '../components/common'

export function NumInput({
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
        <button onClick={() => onChange(value + step)} className="grid h-1/2 w-9 place-items-center text-muted hover:bg-brand-50 hover:text-brand-500">▲</button>
        <button onClick={() => onChange(Math.max(0, value - step))} className="grid h-1/2 w-9 place-items-center border-t border-line text-muted hover:bg-brand-50 hover:text-brand-500">▼</button>
      </div>
    </div>
  )
}

export function RechargeModal({ open, onClose, studentId }: { open: boolean; onClose: () => void; studentId: string }) {
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
          <Button variant="soft" onClick={onClose}>取消</Button>
          <Button variant="grad" onClick={submit} style={{ backgroundImage: 'linear-gradient(135deg,#7fd49a,#5bbf7a)' }}>确认充值</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="充值日期">
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label="课时数"><NumInput value={credits} onChange={setCredits} step={1} /></Field>
        <Field label="金额 (Price)"><NumInput value={amount} onChange={setAmount} step={100} prefix="¥" /></Field>
      </div>
      <p className="mt-3 text-xs text-muted">充值后会开一个新的收费周期（私教的上次充值后重新计数）。</p>
    </Modal>
  )
}

export function LevelUpModal({ open, onClose, studentId, cur }: { open: boolean; onClose: () => void; studentId: string; cur?: string }) {
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
          <Button variant="soft" onClick={onClose}>Cancel</Button>
          <Button variant="grad" onClick={submit} style={{ backgroundImage: 'linear-gradient(135deg,#f5be64,#f1a13a)' }}>Confirm 🎉</Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="rounded-2xl px-4 py-3 text-center text-sm font-semibold text-ink-soft" style={{ backgroundColor: 'rgba(241,161,58,0.1)' }}>
          Congratulations! 🎉
        </div>
        <Field label="升级后的级别">
          <TextInput autoFocus value={level} onChange={(e) => setLevel(e.target.value)} placeholder="如 Harry Potter" />
        </Field>
      </div>
    </Modal>
  )
}

export function CheckInInline({ open, onClose, studentId }: { open: boolean; onClose: () => void; studentId: string }) {
  const toast = useToast()
  const [date, setDate] = useState(todayISO())
  const [status, setStatus] = useState<'present' | 'absent'>('present')
  const [topic, setTopic] = useState('')
  const [notes, setNotes] = useState('')

  function submit() {
    if (status === 'present') {
      actions.recordLesson(studentId, date, topic.trim(), notes.trim())
      toast('已记一节课（到）✅')
    } else {
      actions.markAbsent(studentId, date, notes.trim() || undefined)
      toast('已记缺勤（不扣课时）')
    }
    setTopic('')
    setNotes('')
    setStatus('present')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="上课记录"
      accent={status === 'present' ? '#ef7aa0' : '#e96a5b'}
      icon={<CalendarCheck size={18} />}
      footer={
        <>
          <Button variant="soft" onClick={onClose}>取消</Button>
          <Button variant="grad" onClick={submit} style={{ backgroundImage: status === 'present' ? 'linear-gradient(135deg,#f7a3c0,#ef7aa0)' : 'linear-gradient(135deg,#f3a094,#e96a5b)' }}>
            {status === 'present' ? '确认到课' : '确认缺勤'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="日期">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="这次是">
          <div className="flex gap-2">
            <button
              onClick={() => setStatus('present')}
              className={`flex-1 rounded-2xl border px-3 py-2 text-sm font-bold transition ${status === 'present' ? 'border-transparent bg-mint text-white' : 'border-line bg-white text-ink-soft'}`}
            >
              到课（扣1课时）
            </button>
            <button
              onClick={() => setStatus('absent')}
              className={`flex-1 rounded-2xl border px-3 py-2 text-sm font-bold transition ${status === 'absent' ? 'border-transparent bg-neg text-white' : 'border-line bg-white text-ink-soft'}`}
            >
              缺勤（不扣）
            </button>
          </div>
        </Field>
        {status === 'present' ? (
          <Field label="内容（Topic）">
            <TextInput value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Chapter 1-Chapter 2" />
          </Field>
        ) : null}
        <Field label={status === 'present' ? '反馈（Notes）' : '缺勤原因'}>
          <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={status === 'present' ? '复述做得非常棒❤️' : '如 请假 / 生病'} />
        </Field>
      </div>
    </Modal>
  )
}
