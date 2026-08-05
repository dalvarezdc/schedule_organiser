import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getTasks, getSettings, sendTasksToSlack } from '../api/client'
import Markdown from '../components/Markdown'
import type { Task, TaskPriority, TaskStatus } from '../types'

const priorityBadge: Record<TaskPriority, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-sky-100 text-sky-700',
  high: 'bg-rose-500 text-white',
}

const statusBadge: Record<TaskStatus, string> = {
  pending: 'bg-slate-100 text-slate-500',
  in_progress: 'bg-indigo-50 text-indigo-600',
  done: 'bg-emerald-50 text-emerald-600',
}

function IconSlack({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521a2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.521A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.523v-2.52h2.52zM15.165 17.684a2.527 2.527 0 0 1-2.52-2.521 2.527 2.527 0 0 1 2.52-2.521h6.322A2.528 2.528 0 0 1 24 15.163a2.528 2.528 0 0 1-2.522 2.521h-6.313z" />
    </svg>
  )
}

function flattenTasks(tasks: Task[]): Task[] {
  const result: Task[] = []
  function traverse(list: Task[]) {
    for (const t of list) {
      result.push(t)
      if (t.children && t.children.length > 0) {
        traverse(t.children)
      }
    }
  }
  traverse(tasks)
  return result
}

export default function SlackNotifications() {
  const { data: rawTasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: getTasks,
  })

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  })

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [customWebhookUrl, setCustomWebhookUrl] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const allTasks = useMemo(() => flattenTasks(rawTasks as Task[]), [rawTasks])

  const filteredTasks = useMemo(() => {
    return allTasks.filter(task => {
      const matchesSearch =
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [allTasks, searchQuery, statusFilter])

  const activeWebhookUrl = customWebhookUrl.trim() || settings?.slack_webhook_url || ''

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedIds.size === filteredTasks.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredTasks.map(t => t.id)))
    }
  }

  const handleSendToSlack = async () => {
    if (selectedIds.size === 0) return
    setSending(true)
    setFeedback(null)
    try {
      const res = await sendTasksToSlack(Array.from(selectedIds), activeWebhookUrl || undefined)
      setFeedback({
        type: 'success',
        message: res.message || `Successfully sent ${res.sent_count} task(s) to Slack!`,
      })
      setSelectedIds(new Set())
    } catch (err: any) {
      const errorDetail = err?.response?.data?.detail || err?.message || 'Failed to send notification to Slack.'
      setFeedback({
        type: 'error',
        message: errorDetail,
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-navy via-navy-mid to-slate-900 rounded-card shadow-card p-6 text-white relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center text-teal-400">
                <IconSlack className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold tracking-tight">Slack Task Notifications</h2>
            </div>
            <p className="text-sm text-slate-300">
              Select multiple tasks below and send them directly to your Slack channel via Webhook. Each message includes full task descriptions and direct URL links.
            </p>
          </div>

          <div className="shrink-0 bg-navy-deep/60 p-3 rounded-xl border border-white/10 backdrop-blur-sm max-w-sm">
            <div className="text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
              <span>Slack Webhook URL</span>
              {settings?.slack_webhook_url ? (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full">
                  Configured
                </span>
              ) : (
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full">
                  Not set in Settings
                </span>
              )}
            </div>
            <input
              type="text"
              placeholder={settings?.slack_webhook_url ? 'Override configured webhook URL...' : 'https://hooks.slack.com/services/...'}
              value={customWebhookUrl}
              onChange={e => setCustomWebhookUrl(e.target.value)}
              className="w-full text-xs bg-navy-light/60 text-white placeholder-slate-400 px-2.5 py-1.5 rounded-lg border border-white/10 focus:outline-none focus:border-brand-teal transition-colors"
            />
            {!settings?.slack_webhook_url && !customWebhookUrl && (
              <p className="text-[11px] text-slate-400 mt-1">
                Configure it in{' '}
                <Link to="/settings" className="text-brand-teal underline hover:text-white">
                  Settings
                </Link>{' '}
                or enter a webhook URL above.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-sm flex items-center justify-between shadow-soft transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="font-bold">{feedback.type === 'success' ? '✓ Success:' : '✕ Error:'}</span>
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs font-semibold hover:opacity-75"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Toolbar / Action Menu */}
      <div className="bg-white rounded-card shadow-card p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Main Action Button */}
          <button
            type="button"
            onClick={handleSendToSlack}
            disabled={selectedIds.size === 0 || !activeWebhookUrl || sending}
            className={[
              'flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm shadow-soft transition-all',
              selectedIds.size > 0 && activeWebhookUrl && !sending
                ? 'bg-[#4A154B] text-white hover:bg-[#611f69] hover:shadow-md cursor-pointer'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed',
            ].join(' ')}
          >
            <IconSlack className="w-4 h-4" />
            {sending ? (
              <span>Sending to Slack…</span>
            ) : (
              <span>Send {selectedIds.size > 0 ? `${selectedIds.size} Task(s)` : 'Selected'} to Slack</span>
            )}
          </button>

          {/* Multi-select toggle */}
          <button
            type="button"
            onClick={handleSelectAll}
            disabled={filteredTasks.length === 0}
            className="text-xs font-semibold text-slate-600 hover:text-navy px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
          >
            {selectedIds.size === filteredTasks.length && filteredTasks.length > 0 ? 'Deselect All' : 'Select All'}
          </button>

          <span className="text-xs text-slate-400 font-medium hidden md:inline">
            {selectedIds.size} of {filteredTasks.length} selected
          </span>
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-teal bg-white text-slate-700 w-full sm:w-48"
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-teal bg-white text-slate-700 shrink-0"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </select>
        </div>
      </div>

      {/* Task List */}
      <div className="bg-white rounded-card shadow-card divide-y divide-slate-100 overflow-hidden">
        {loadingTasks && (
          <p className="text-sm text-slate-400 px-6 py-12 text-center">Loading tasks...</p>
        )}

        {!loadingTasks && filteredTasks.length === 0 && (
          <div className="px-6 py-16 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-600">No matching tasks found.</p>
            <p className="text-xs text-slate-400">Try clearing search filters or create new tasks.</p>
          </div>
        )}

        {!loadingTasks &&
          filteredTasks.map(task => {
            const isSelected = selectedIds.has(task.id)
            const taskUrl = `${window.location.origin}/tasks/${task.id}`

            return (
              <div
                key={task.id}
                onClick={() => toggleSelect(task.id)}
                className={[
                  'p-4 transition-colors cursor-pointer flex flex-col md:flex-row md:items-start gap-4 hover:bg-slate-50/80',
                  isSelected ? 'bg-purple-50/40 border-l-4 border-l-[#4A154B]' : '',
                ].join(' ')}
              >
                {/* Selection Checkbox */}
                <div className="pt-0.5 shrink-0 flex items-center">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}} // handled by parent onClick
                    className="w-4 h-4 text-[#4A154B] rounded border-slate-300 focus:ring-[#4A154B] cursor-pointer"
                    aria-label={`Select ${task.title}`}
                  />
                </div>

                {/* Main Task Content */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-navy text-sm hover:text-brand-blue">
                      {task.title}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${priorityBadge[task.priority]}`}>
                      {task.priority}
                    </span>
                    <span className={`text-[10px] font-semibold lowercase px-2 py-0.5 rounded-full ${statusBadge[task.status]}`}>
                      {task.status.replace('_', ' ')}
                    </span>
                    {task.due_date && (
                      <span className="text-[11px] text-slate-400">
                        Due: {new Date(task.due_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {/* Description preview */}
                  {task.description ? (
                    <div className="text-xs text-slate-600 bg-slate-50/80 p-2.5 rounded-lg border border-slate-100 max-h-32 overflow-y-auto">
                      <Markdown content={task.description} className="text-slate-600" />
                    </div>
                  ) : (
                    <p className="text-xs text-slate-300 italic">No description provided.</p>
                  )}

                  {/* Direct Task Link (showing description URL) */}
                  <div className="pt-1 flex items-center gap-2 text-xs">
                    <span className="text-slate-400 font-medium">Task Description URL:</span>
                    <a
                      href={`/tasks/${task.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-brand-blue font-mono text-[11px] hover:underline truncate max-w-md"
                    >
                      {taskUrl}
                    </a>
                  </div>
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
