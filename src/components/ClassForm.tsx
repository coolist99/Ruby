// 新增 / 编辑班级弹窗（私教 / 班课）—— 建班/编辑时直接勾选学生成员
import { useEffect, useState } from 'react'
import { FolderPlus } from 'lucide-react'
import { actions, useDB } from '../lib/db'
import { classOf } from '../lib/selectors'
import type { ClassRoom, ClassType } from '../lib/types'
import { Button, Field, Modal, Select, TextInput, useToast, cn } from './common'

const COLORS = [
  '#b89bff', '#9b6bef', '#5b8def', '#5bbf7a', '#5bbfa0',
  '#f5a623', '#ef7aa0', '#ef6c5b', '#4f86e0', '#c08bef',
]

export function ClassFormModal({
  open,
  onClose,
  initial,
}: {
  open: boolean
  onClose: () => void
  initial?: ClassRoom
}) {
  const db = useDB()
  const toast = useToast()
  const isEdit = !!initial
  const [name, setName] = useState('')
  const [type, setType] = useState<ClassType>('group')
  const [book, setBook] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!open) return
    if (initial) {
      setName(initial.name)
      setType(initial.type)
      setBook(initial.book ?? '')
      setColor(initial.color)
      setMemberIds(new Set(db.students.filter((s) => s.classId === initial.id).map((s) => s.id)))
    } else {
      setName('')
      setType('group')
      setBook('')
      setColor(COLORS[Math.floor(Date.now() / 1000) % COLORS.length])
      setMemberIds(new Set())
    }
  }, [open, initial, db.students])

  function toggleMember(id: string) {
    const s = db.students.find((x) => x.id === id)
    if (!s) return
    if (memberIds.has(id)) {
      setMemberIds((cur) => {
        const next = new Set(cur)
        next.delete(id)
        return next
      })
      return
    }
    // 加入：若已在别的班，先确认转班（防选错）
    const cur = classOf(db, s)
    const inOther = !!cur && (!initial || cur.id !== initial.id)
    if (inOther) {
      const ok = window.confirm(`「${s.name}」已在「${cur!.name}」，确认转入本班？`)
      if (!ok) return
    }
    setMemberIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
    if (type === 'private' && memberIds.size + 1 > 1) {
      toast(`私教为一对一，你已选 ${memberIds.size + 1} 个学生`, 'info')
    }
  }

  function submit() {
    const ids = [...memberIds]
    // 班名：班课必填；私教可留空（用首位成员自动命名）
    let className = name.trim()
    if (type === 'private' && !className) {
      if (ids.length === 0) {
        toast('请填写班名，或至少选择一名学生', 'info')
        return
      }
      const first = db.students.find((x) => x.id === ids[0])
      className = `私教·${first?.name ?? '未命名'}`
    }
    if (!className) {
      toast('请填写班级名称', 'info')
      return
    }
    const payload = { name: className, type, book: book.trim() || undefined, color }
    if (isEdit && initial) {
      actions.updateClass(initial.id, payload)
      actions.applyClassMembership(initial.id, ids)
      toast('已更新班级')
    } else {
      const cls = actions.addClass(payload)
      if (ids.length) actions.applyClassMembership(cls.id, ids)
      toast(type === 'private' ? '已创建私教班级 ✨' : '已创建班课 ✨')
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? '编辑班级' : '新建班级'}
      icon={<FolderPlus size={18} />}
      width="max-w-lg"
      footer={
        <>
          <Button variant="soft" onClick={onClose}>
            取消
          </Button>
          <Button variant="grad" onClick={submit}>
            {isEdit ? '保存' : '创建'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="名称">
            <TextInput
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === 'private' ? '私教可留空（按学生自动命名）' : '如 Fancy Nancy'}
            />
          </Field>
          <Field label="班型">
            <Select value={type} onChange={(e) => setType(e.target.value as ClassType)}>
              <option value="group">班课（多名学生）</option>
              <option value="private">私教（一对一）</option>
            </Select>
          </Field>
        </div>
        <Field label="教材 / 备注">
          <TextInput value={book} onChange={(e) => setBook(e.target.value)} placeholder="如 Reading Explorer 1" />
        </Field>
        <Field label="主题色">
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn(
                  'h-8 w-8 rounded-full transition',
                  color === c ? 'ring-2 ring-offset-2 ring-brand-400' : 'hover:scale-110',
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </Field>

        {/* 班级成员：勾选归入本班，别班学生转班确认，取消勾选变未分班 */}
        <Field label={`班级成员（已选 ${memberIds.size}）`}>
          <div className="max-h-56 overflow-y-auto rounded-2xl border border-line bg-white/60 p-1.5">
            {db.students.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted">
                还没有学生。可先建班，之后回来编辑把学生加进来。
              </p>
            ) : (
              <div className="grid gap-1">
                {db.students.map((s) => {
                  const on = memberIds.has(s.id)
                  const cur = classOf(db, s)
                  const inOther = !!cur && (!initial || cur.id !== initial.id)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleMember(s.id)}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-2.5 py-2 text-left transition',
                        on ? 'bg-brand-50 ring-1 ring-brand-300' : 'hover:bg-black/5',
                      )}
                    >
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold text-white"
                        style={{ backgroundColor: cur?.color ?? 'var(--color-brand-400)' }}
                      >
                        {s.name.slice(0, 1)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{s.name}</span>
                        <span className="block truncate text-[11px] text-muted">
                          {cur ? (inOther ? `在「${cur.name}」· 点此转入` : '本班') : '未分班'}
                        </span>
                      </span>
                      <span
                        className={cn(
                          'grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold',
                          on ? 'bg-brand-500 text-white' : 'bg-black/10 text-transparent',
                        )}
                      >
                        ✓
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </Field>

        <p className="text-xs text-muted">
          勾选学生即归入本班；已在别班的学生会提示转班，取消勾选则变为「未分班」。私教通常选 1 名、班课可选多名，之后随时回来编辑增减。
        </p>
      </div>
    </Modal>
  )
}
