// 新增 / 编辑学生弹窗
import { useEffect, useState } from 'react'
import { UserPlus } from 'lucide-react'
import { actions, useDB } from '../lib/db'
import { WEEKDAYS, type Student, type StudentStatus, type Weekday } from '../lib/types'
import { Button, Field, Modal, Select, TextInput, useToast } from './common'

export function StudentFormModal({
  open,
  onClose,
  initial,
  defaultStatus = 'active',
}: {
  open: boolean
  onClose: () => void
  initial?: Student
  defaultStatus?: StudentStatus
}) {
  const db = useDB()
  const toast = useToast()
  const isEdit = !!initial

  const [name, setName] = useState('')
  const [classId, setClassId] = useState(db.classes[0]?.id ?? '')
  const [level, setLevel] = useState('L1')
  const [status, setStatus] = useState<StudentStatus>(defaultStatus)
  const [weekday, setWeekday] = useState<Weekday | ''>(2)
  const [queueTag, setQueueTag] = useState('待组班')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open) return
    if (initial) {
      setName(initial.name)
      setClassId(initial.classId)
      setLevel(initial.level ?? 'L1')
      setStatus(initial.status)
      setWeekday(initial.weekday ?? '')
      setQueueTag(initial.queueTag ?? '待组班')
      setNotes(initial.notes ?? '')
    } else {
      setName('')
      setClassId(db.classes[0]?.id ?? '')
      setLevel('L1')
      setStatus(defaultStatus)
      setWeekday(2)
      setQueueTag('待组班')
      setNotes('')
    }
  }, [open, initial, defaultStatus, db.classes])

  function submit() {
    if (!name.trim()) {
      toast('请填写学生姓名', 'info')
      return
    }
    const payload = {
      name: name.trim(),
      classId,
      level,
      status,
      weekday: status === 'active' ? (weekday || (2 as Weekday)) : undefined,
      queueTag: status === 'queued' ? queueTag : undefined,
      notes: notes.trim() || undefined,
    }
    if (isEdit && initial) {
      actions.updateStudent(initial.id, payload)
      toast('已更新学生信息')
    } else {
      actions.addStudent(payload)
      toast('已添加学生 ✨')
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? '编辑学生' : '添加学生'}
      icon={<UserPlus size={18} />}
      width="max-w-lg"
      footer={
        <>
          <Button variant="soft" onClick={onClose}>
            取消
          </Button>
          <Button variant="grad" onClick={submit}>
            {isEdit ? '保存' : '添加'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="姓名">
            <TextInput
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如 Iris"
            />
          </Field>
        </div>
        <Field label="班级 / 课程">
          <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
            {db.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="级别">
          <TextInput value={level} onChange={(e) => setLevel(e.target.value)} placeholder="L1 / Harry Potter" />
        </Field>

        <Field label="状态">
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as StudentStatus)}
          >
            <option value="active">在读（已排课）</option>
            <option value="queued">待排课</option>
          </Select>
        </Field>

        {status === 'active' ? (
          <Field label="上课星期">
            <Select
              value={weekday}
              onChange={(e) => setWeekday(Number(e.target.value) as Weekday)}
            >
              {WEEKDAYS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.cn}（{d.en}）
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label="排队标签">
            <TextInput
              value={queueTag}
              onChange={(e) => setQueueTag(e.target.value)}
              placeholder="如 RE1待组班 / 试听"
            />
          </Field>
        )}

        <div className="sm:col-span-2">
          <Field label="备注（可选）">
            <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="教材 / 进度" />
          </Field>
        </div>
      </div>
    </Modal>
  )
}
