import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getTask,
  updateTask,
  deleteTask,
  createTask,
  generateShareLink,
  revokeShareLink,
  improveTask,
} from '../api/client'
import TaskTree from '../components/TaskTree'
import ImprovePanel from '../components/ImprovePanel'
import { useState } from 'react'
import type { ImproveResult } from '../types'

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const {
    data: task,
    isLoading,
    refetch,
  } = useQuery({ queryKey: ['task', id], queryFn: () => getTask(id!) })

  const [shareUrl, setShareUrl] = useState('')
  const [improving, setImproving] = useState(false)
  const [improveError, setImproveError] = useState('')
  const [improveResult, setImproveResult] = useState<ImproveResult | null>(null)

  if (isLoading) return <div className="p-8 text-slate-400">Loading…</div>
  if (!task) return <div className="p-8 text-rose-500">Task not found.</div>

  const update = async (field: string, value: string | null) => {
    await updateTask(task.id, { [field]: value } as any)
    qc.invalidateQueries({ queryKey: ['task', id] })
    qc.invalidateQueries({ queryKey: ['tasks'] })
  }

  const handleDelete = async () => {
    if (!confirm('Delete this task and all its subtasks?')) return
    await deleteTask(task.id)
    qc.invalidateQueries({ queryKey: ['tasks'] })
    navigate('/tasks')
  }

  const handleShare = async () => {
    const result = await generateShareLink(task.id)
    setShareUrl(result.share_url)
    qc.invalidateQueries({ queryKey: ['task', id] })
  }

  const handleRevoke = async () => {
    await revokeShareLink(task.id)
    setShareUrl('')
    qc.invalidateQueries({ queryKey: ['task', id] })
  }

  const handleImprove = async () => {
    setImproving(true)
    setImproveError('')
    setImproveResult(null)
    try {
      const result = await improveTask(task.id)
      setImproveResult(result)
    } catch (e: any) {
      const detail = e?.response?.data?.detail || 'AI improve failed.'
      setImproveError(detail)
    } finally {
      setImproving(false)
    }
  }

  const handleApplyImprove = async (
    newTitle: string,
    newDesc: string,
    subtaskTitles: string[],
  ) => {
    await updateTask(task.id, { title: newTitle, description: newDesc })
    for (let i = 0; i < subtaskTitles.length; i++) {
      await createTask({
        title: subtaskTitles[i],
        parent_id: task.id,
        order: task.children.length + i,
        notify_slack: false,
        notify_discord: false,
        sync_calendar: false,
      })
    }
    setImproveResult(null)
    qc.invalidateQueries({ queryKey: ['task', id] })
    qc.invalidateQueries({ queryKey: ['tasks'] })
    refetch()
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/tasks')}
          className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={handleDelete}
          className="text-sm text-rose-400 hover:text-rose-600 transition-colors"
        >
          Delete task
        </button>
      </div>

      {/* Title */}
      <input
        defaultValue={task.title}
        onBlur={e => update('title', e.target.value)}
        className="w-full text-2xl font-bold text-slate-800 border-b border-transparent hover:border-slate-200 focus:border-indigo-400 outline-none pb-1 bg-transparent transition-colors"
      />

      {/* Status + Priority */}
      <div className="flex gap-3 flex-wrap">
        <select
          defaultValue={task.status}
          onChange={e => update('status', e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400 bg-white text-slate-700"
        >
          <option value="pending">Pending</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
        </select>
        <select
          defaultValue={task.priority}
          onChange={e => update('priority', e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400 bg-white text-slate-700"
        >
          <option value="low">Low priority</option>
          <option value="medium">Medium priority</option>
          <option value="high">High priority</option>
        </select>
      </div>

      {/* Description */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-slate-500 font-semibold uppercase tracking-wide">
            Description
          </label>
          <button
            onClick={handleImprove}
            disabled={improving}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-40 flex items-center gap-1.5 transition-colors"
          >
            {improving ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                Improving…
              </>
            ) : (
              '✦ Improve with AI'
            )}
          </button>
        </div>
        <textarea
          defaultValue={task.description}
          onBlur={e => update('description', e.target.value)}
          rows={12}
          placeholder="Describe the task in detail…"
          className="w-full border border-slate-200 rounded-xl p-4 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-400 resize-vertical leading-relaxed transition-colors"
          style={{ minHeight: '200px' }}
        />

        {improveError && (
          <div className="mt-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">
            {improveError}
          </div>
        )}

        {improveResult && (
          <ImprovePanel
            result={improveResult}
            onApply={handleApplyImprove}
            onCancel={() => setImproveResult(null)}
          />
        )}
      </div>

      {/* Dates */}
      <div className="flex gap-4 flex-wrap">
        <div>
          <label className="block text-xs text-slate-500 mb-1 font-medium">Due date</label>
          <input
            type="date"
            defaultValue={task.due_date ? task.due_date.split('T')[0] : ''}
            onBlur={e =>
              update('due_date', e.target.value ? new Date(e.target.value).toISOString() : '')
            }
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400 bg-white"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1 font-medium">Scheduled date</label>
          <input
            type="date"
            defaultValue={task.scheduled_date ? task.scheduled_date.split('T')[0] : ''}
            onBlur={e =>
              update('scheduled_date', e.target.value ? new Date(e.target.value).toISOString() : '')
            }
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400 bg-white"
          />
        </div>
      </div>

      {task.google_event_id && (
        <p className="text-xs text-indigo-500">Synced to Google Calendar</p>
      )}

      {/* Subtask tree */}
      <div>
        <h3 className="font-semibold text-slate-700 mb-3 text-sm uppercase tracking-wide">
          Subtasks
        </h3>
        {task.children.length > 0 ? (
          <div className="border border-slate-100 rounded-xl p-3">
            <TaskTree
              tasks={task.children}
              onRefresh={() => {
                qc.invalidateQueries({ queryKey: ['task', id] })
                refetch()
              }}
            />
          </div>
        ) : (
          <p className="text-sm text-slate-400">No subtasks yet.</p>
        )}
        <QuickAddChild
          parentId={task.id}
          onAdded={() => {
            qc.invalidateQueries({ queryKey: ['task', id] })
            qc.invalidateQueries({ queryKey: ['tasks'] })
            refetch()
          }}
        />
      </div>

      {/* Share */}
      <div>
        <h3 className="font-semibold text-slate-700 mb-2 text-sm uppercase tracking-wide">Share</h3>
        {task.share_token ? (
          <div className="space-y-2">
            <p className="text-sm text-slate-600 break-all">
              {shareUrl || `${window.location.origin}/share/${task.share_token}`}
            </p>
            <button
              onClick={handleRevoke}
              className="text-sm text-rose-400 hover:text-rose-600 transition-colors"
            >
              Revoke link
            </button>
          </div>
        ) : (
          <button
            onClick={handleShare}
            className="text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            Generate share link
          </button>
        )}
      </div>
    </div>
  )
}

function QuickAddChild({
  parentId,
  onAdded,
}: {
  parentId: string
  onAdded: () => void
}) {
  const [title, setTitle] = useState('')
  const [open, setOpen] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    await createTask({
      title: title.trim(),
      parent_id: parentId,
      notify_slack: false,
      notify_discord: false,
      sync_calendar: false,
    })
    setTitle('')
    setOpen(false)
    onAdded()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 text-sm text-indigo-500 hover:text-indigo-700 font-medium transition-colors"
      >
        + Add subtask
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mt-3">
      <input
        autoFocus
        value={title}
        onChange={e => setTitle(e.target.value)}
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
        onClick={() => setOpen(false)}
        className="text-slate-400 text-sm px-2 hover:text-slate-600 transition-colors"
      >
        Cancel
      </button>
    </form>
  )
}
