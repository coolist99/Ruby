import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FolderPlus, Pencil, Trash2, Users } from 'lucide-react'
import { actions, useDB } from '../lib/db'
import { activeStudents } from '../lib/selectors'
import { WEEKDAYS } from '../lib/types'
import { Badge, Button, Card, EmptyState, PageHeader, useToast } from '../components/common'
import { ClassFormModal } from '../components/ClassForm'

export default function Classes() {
  const db = useDB()
  const toast = useToast()
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const editTarget = db.classes.find((c) => c.id === editing) || undefined

  return (
    <div>
      <PageHeader
        title="班级"
        subtitle={`共 ${db.classes.length} 个班级（私教 + 班课）`}
        icon={
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-500">
            <Users size={20} />
          </span>
        }
        actions={
          <Button variant="grad" onClick={() => setAdding(true)}>
            <FolderPlus size={16} /> 新建班级
          </Button>
        }
      />

      {db.classes.length === 0 ? (
        <EmptyState icon={<Users size={22} />} title="还没有班级" hint="新建一个私教或班课班级开始吧" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {db.classes.map((c) => {
            const members = activeStudents(db).filter((s) => s.classId === c.id)
            const wd = members.find((s) => s.weekday)?.weekday
            return (
              <Card key={c.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start gap-3">
                  <span
                    className="mt-0.5 h-10 w-10 shrink-0 rounded-2xl"
                    style={{ backgroundColor: c.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-bold text-ink">{c.name}</span>
                      <Badge color={c.type === 'private' ? '#ef7aa0' : '#5b8def'}>
                        {c.type === 'private' ? '私教' : '班课'}
                      </Badge>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted">
                      {c.book || '未设教材'}
                      {wd && ` · ${WEEKDAYS[wd - 1].cn}`}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Link
                    to={`/students?class=${c.id}`}
                    className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-ink-soft transition hover:bg-brand-50"
                  >
                    {members.length} 名学生 →
                  </Link>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditing(c.id)}
                      className="grid h-8 w-8 place-items-center rounded-xl text-muted transition hover:bg-brand-50 hover:text-brand-500"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`删除班级「${c.name}」？该班学生不会被删除（会变为未分班）。`)) {
                          actions.removeClass(c.id)
                          toast('已删除班级', 'info')
                        }
                      }}
                      className="grid h-8 w-8 place-items-center rounded-xl text-muted transition hover:bg-red-50 hover:text-neg"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <ClassFormModal open={adding} onClose={() => setAdding(false)} />
      <ClassFormModal open={!!editTarget} initial={editTarget} onClose={() => setEditing(null)} />
    </div>
  )
}
