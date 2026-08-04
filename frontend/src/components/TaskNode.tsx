import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import type { Task } from '../types'
import { createTask, updateTask, deleteTask, linkAsChild } from '../api/client'
import TaskPicker from './TaskPicker'

const priorityBadge: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-sky-100 text-sky-700',
  high: 'bg-rose-500 text-white',
}

const statusBadge: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-500',
  in_progress: 'bg-indigo-50 text-indigo-600',
  done: 'bg-emerald-50 text-emerald-600',
}

interface Props {
  task: Task
  depth?: number
  onRefresh: () => void
  allRootTasks?: Task[]
}

function collectDescendantIds(task: Task): string[] {
  return task.children.flatMap(c => [c.id, ...collectDescendantIds(c)])
}

export default function TaskNode({ task, depth = 0, onRefresh, allRootTasks = [] }: Props) {
  const [expanded, setExpanded] = useState(true)
  const [showDesc, setShowDesc] = useState(false)
  const [addingChild, setAddingChild] = useState(false)
  const [newChildTitle, setNewChildTitle] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const qc = useQueryClient()

  const hasChildren = task.children.length > 0
  const isRoot = depth === 0
  const padLeft = 12 + depth * 22

  const toggleDone = async () => {
    const next = task.status === 'done' ? 'pending' : 'done'
    await updateTask(task.id, { status: next })
    qc.invalidateQueries({ queryKey: ['tasks'] })
    qc.invalidateQueries({ queryKey: ['task', task.id] })
    onRefresh()
  }

  const handleAddChild = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newChildTitle.trim()) return
    await createTask({
      title: newChildTitle.trim(),
      parent_id: task.id,
      order: task.children.length,
      notify_slack: false,
      notify_discord: false,
      sync_calendar: false,
    })
    setNewChildTitle('')
    setAddingChild(false)
    qc.invalidateQueries({ queryKey: ['tasks'] })
    qc.invalidateQueries({ queryKey: ['task', task.id] })
    onRefresh()
  }

  const handleDelete = async () => {
    const n = collectDescendantIds(task).length
    const msg =
      n > 0
        ? `Delete "${task.title}" and all ${n} subtask(s) under it?`
        : `Delete "${task.title}"?`
    if (!confirm(msg)) return
    await deleteTask(task.id)
    qc.invalidateQueries({ queryKey: ['tasks'] })
    onRefresh()
  }

  const handleLink = async (selectedId: string) => {
    await linkAsChild(selectedId, task.id)
    setShowPicker(false)
    qc.invalidateQueries({ queryKey: ['tasks'] })
    onRefresh()
  }

  const excludeIds = new Set([task.id, ...collectDescendantIds(task)])

  return (
    <div>
      <div
        className="group flex items-center gap-2 py-2.5 pr-3 hover:bg-slate-50/80 rounded-lg transition-colors"
        style={{ paddingLeft: padLeft }}
      >
        {/* Expand / collapse */}
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="w-5 h-5 shrink-0 flex items-center justify-center text-slate-300 hover:text-slate-500"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {hasChildren ? (
            <svg
              className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M6 4l8 6-8 6V4z" />
            </svg>
          ) : (
            <span className="w-1 h-1 rounded-full bg-slate-200" />
          )}
        </button>

        {/* Checkbox */}
        <input
          type="checkbox"
          checked={task.status === 'done'}
          onChange={toggleDone}
          className="task-checkbox"
          aria-label={`Mark ${task.title} done`}
        />

        {/* Title + badges */}
        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <Link
            to={`/tasks/${task.id}`}
            className={[
              'text-sm transition-colors truncate max-w-[min(100%,28rem)]',
              isRoot ? 'font-bold text-navy hover:text-brand-blue' : 'font-medium text-slate-700 hover:text-brand-blue',
              task.status === 'done' ? 'line-through text-slate-400' : '',
            ].join(' ')}
          >
            {task.title}
          </Link>

          <span
            className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${priorityBadge[task.priority]}`}
          >
            {task.priority}
          </span>

          {isRoot && (
            <span
              className={`text-[10px] font-semibold lowercase px-2 py-0.5 rounded-full ${statusBadge[task.status]}`}
            >
              {task.status.replace('_', ' ')}
            </span>
          )}
        </div>

        {/* Description toggle */}
        {task.description ? (
          <button
            type="button"
            onClick={() => setShowDesc(s => !s)}
            className="text-xs text-slate-400 hover:text-slate-600 shrink-0 hidden sm:inline transition-colors"
          >
            {showDesc ? 'Hide description' : 'Show description'}
          </button>
        ) : (
          <span className="text-xs text-slate-300 shrink-0 hidden sm:inline">Show description</span>
        )}

        {/* Hover actions */}
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            type="button"
            onClick={() => {
              setAddingChild(a => !a)
              setShowPicker(false)
            }}
            className="text-[11px] font-semibold text-brand-tealDark hover:text-teal-800 px-1.5"
          >
            + Sub
          </button>
          <button
            type="button"
            onClick={() => {
              setShowPicker(s => !s)
              setAddingChild(false)
            }}
            className="text-[11px] font-medium text-slate-400 hover:text-slate-600 px-1.5"
          >
            Link
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="text-[11px] text-rose-400 hover:text-rose-600 px-1.5"
            aria-label="Delete"
          >
            ✕
          </button>
        </div>
      </div>

      {showDesc && task.description && (
        <p
          className="text-sm text-slate-500 leading-relaxed pb-2 pr-4"
          style={{ paddingLeft: padLeft + 40 }}
        >
          {task.description}
        </p>
      )}

      {addingChild && (
        <form
          onSubmit={handleAddChild}
          className="flex gap-2 py-2 pr-3"
          style={{ paddingLeft: padLeft + 28 }}
        >
          <input
            autoFocus
            value={newChildTitle}
            onChange={e => setNewChildTitle(e.target.value)}
            placeholder="New subtask title…"
            className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-brand-teal bg-white"
          />
          <button
            type="submit"
            className="bg-navy text-white px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-navy-mid transition-colors"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setAddingChild(false)}
            className="text-slate-400 text-sm px-2 hover:text-slate-600"
          >
            Cancel
          </button>
        </form>
      )}

      {showPicker && (
        <div className="py-2" style={{ paddingLeft: padLeft + 28 }}>
          <TaskPicker
            excludeIds={excludeIds}
            allTasks={allRootTasks}
            onSelect={handleLink}
            onClose={() => setShowPicker(false)}
          />
        </div>
      )}

      {expanded && hasChildren && (
        <div>
          {task.children.map(child => (
            <TaskNode
              key={child.id}
              task={child}
              depth={depth + 1}
              onRefresh={onRefresh}
              allRootTasks={allRootTasks}
            />
          ))}
        </div>
      )}
    </div>
  )
}
