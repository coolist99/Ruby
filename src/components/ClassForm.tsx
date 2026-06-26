// 新增 / 编辑班级弹窗（私教 / 班课）
import { useEffect, useState } from 'react'
import { FolderPlus } from 'lucide-react'
import { actions } from '../lib/db'
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
  const toast = useToast()
  const isEdit = !!initial
  const [name, setName] = useState('')
  const [type, setType] = useState<ClassType>('group')
  const [book, setBook] = useState('')
  const [color, setColor] = useState(COLORS[0])

  useEffect(() => {
    if (!open) return
    if (initial) {
      setName(initial.name)
      setType(initial.type)
      setBook(initial.book ?? '')
      setColor(initial.color)
    } else {
      setName('')
      setType('group')
      setBook('')
      setColor(COLORS[Math.floor(Date.now() / 1000) % COLORS.length])
    }
  }, [open, initial])

  function submit() {
    if (!name.trim()) {
      toast('请填写班级名称', 'info')
      return
    }
    const payload = { name: name.trim(), type, book: book.trim() || undefined, color }
    if (isEdit && initial) {
      actions.updateClass(initial.id, payload)
      toast('已更新班级')
    } else {
      actions.addClass(payload)
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
            <TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="如 Fancy Nancy / 私教·Emma" />
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
        <p className="text-xs text-muted">
          {type === 'private'
            ? '私教班级通常只对应一名学生；建好后可在「全部学生」里把学生加进来，并单独设置收费周期。'
            : '班课可有多名学生；之后可对某天的课做名单考勤并导出给甲方。'}
        </p>
      </div>
    </Modal>
  )
}
