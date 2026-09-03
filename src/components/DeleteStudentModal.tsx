// 删除学生二次确认弹窗：级联删除该生全部出勤与流水，两处（列表行 / 档案页）共用
import { Trash2 } from 'lucide-react'
import { actions } from '../lib/db'
import type { Student } from '../lib/types'
import { Button, Modal, useToast } from './common'

export function DeleteStudentModal({
  open,
  onClose,
  student,
  onDeleted,
}: {
  open: boolean
  onClose: () => void
  student: Student | null
  /** 删除成功后的回调（如档案页跳回列表） */
  onDeleted?: () => void
}) {
  const toast = useToast()

  function confirm() {
    if (!student) return
    actions.removeStudent(student.id)
    toast(`已删除 ${student.name} 的全部档案`)
    onClose()
    onDeleted?.()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="删除学生"
      accent="#e96a5b"
      icon={<Trash2 size={18} />}
      footer={
        <>
          <Button variant="soft" onClick={onClose}>
            再想想
          </Button>
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
          确定要删除 <b className="text-ink">{student?.name}</b> 吗？
        </div>
        <p className="text-sm leading-relaxed text-muted">
          删除后将同时清除该生的<b className="text-neg">全部出勤记录</b>与<b className="text-neg">充值流水</b>，
          且<b className="text-neg">不可恢复</b>。如只是暂时停课，建议改用「编辑资料」调整状态。
        </p>
      </div>
    </Modal>
  )
}
