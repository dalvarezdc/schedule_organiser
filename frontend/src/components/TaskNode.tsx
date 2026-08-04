import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import type { Task } from '../types'
import { createTask, updateTask, deleteTask, linkAsChild } from '../api/client'
import TaskPicker from './TaskPicker'

const priorityBadge: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-medium',
  medium: 'bg-amber-50 text-amber-700 border border-amber-200 text-xs px-2 py-0.5 rounded-full font-medium',
  high: 'bg-rose-50 text-rose-700 border border-rose-200 text-xs px-2 py-0.5 rounded-full font-medium',
}

const statusLabel: Record<string, string> = {
  pending: 'text-slate-400',
  in_progress: 'text-indigo-600',
  done: 'text-emerald-600',
}

interface Props {
  task: Task
  depth?: number
  onRefresh: () => void
  allRootTasks?: Task[]
}

/** Collect all descendant IDs of a task (excluding itself). */
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
  const indentPx = depth * 20

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
    const hasKids = task.children.length > 0
    const msg = hasKids
      ? `Delete "${task.title}" and all ${task.children.length} subtask(s) under it?`
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
    <div style={{ marginLeft: indentPx }}>
      <div className="flex items-start gap-2 py-1.5 group">
        {/* Expand/collapse chevron */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-0.5 text-slate-300 hover:text-slate-500 w-4 shrink-0 text-xs leading-none"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {hasChildren ? (expanded ? '▼' : '▶') : '·'}
        </button>

        {/* Done checkbox */}
        <input
          type="checkbox"
          checked={task.status === 'done'}
          onChange={toggleDone}
          className="mt-1 shrink-0 accent-indigo-600 cursor-pointer"
        />

        {/* Title + metadata */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={`/tasks/${task.id}`}
              className={`font-medium hover:text-indigo-600 transition-colors text-sm ${
                task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-800'
              }`}
            >
              {task.title}
            </Link>
            <span className={priorityBadge[task.priority]}>{task.priority}</span>
            <span className={`text-xs ${statusLabel[task.status]}`}>
              {task.status.replace('_', ' ')}
            </span>
            {task.due_date && (
              <span className="text-xs text-slate-400">
                Due {new Date(task.due_date).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Description toggle */}
          {task.description && (
            <button
              onClick={() => setShowDesc(s => !s)}
              className="text-xs text-slate-400 hover:text-slate-600 mt-0.5 transition-colors"
            >
              {showDesc ? '▲ Hide description' : '▼ Show description'}
            </button>
          )}
          {showDesc && task.description && (
            <p className="text-sm text-slate-500 mt-1 leading-relaxed pr-4">{task.description}</p>
          )}
        </div>

        {/* Action buttons — visible on hover */}
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={() => { setAddingChild(a => !a); setShowPicker(false) }}
            className="text-xs text-indigo-500 hover:text-indigo-700 font-medium"
          >
            + Subtask
          </button>
          <button
            onClick={() => { setShowPicker(s => !s); setAddingChild(false) }}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            Link
          </button>
          <button
            onClick={handleDelete}
            className="text-xs text-rose-400 hover:text-rose-600"
            aria-label="Delete"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Inline add-child form */}
      {addingChild && (
        <form
          onSubmit={handleAddChild}
          className="flex gap-2 mt-1 mb-2"
          style={{ marginLeft: 24 }}
        >
          <input
            autoFocus
            value={newChildTitle}
            onChange={e => setNewChildTitle(e.target.value)}
            placeholder="New subtask title…"
            className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
          />
          <button
            type="submit"
            className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-indigo-700 transition-colors"
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

      {/* Link existing task picker */}
      {showPicker && (
        <div style={{ marginLeft: 24 }} className="mb-3">
          <TaskPicker
            excludeIds={excludeIds}
            allTasks={allRootTasks}
            onSelect={handleLink}
            onClose={() => setShowPicker(false)}
          />
        </div>
      )}

      {/* Children (recursive) */}
      {expanded && hasChildren && (
        <div className="border-l border-slate-100 ml-2">
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
