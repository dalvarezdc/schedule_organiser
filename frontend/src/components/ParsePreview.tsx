import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { ParsedTask } from '../types'
import { createTask, getSettings } from '../api/client'

interface Props {
  tasks: ParsedTask[]
  onConfirm: () => void
  onCancel: () => void
}

export default function ParsePreview({ tasks: initialTasks, onConfirm, onCancel }: Props) {
  const [tasks, setTasks] = useState<ParsedTask[]>(initialTasks)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [syncCalendar, setSyncCalendar] = useState(true)
  const [notifySlack, setNotifySlack] = useState(true)
  const [notifyDiscord, setNotifyDiscord] = useState(true)
  const navigate = useNavigate()

  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: getSettings })

  const hasCalendar = !!settings?.google_connected
  const hasSlack = !!settings?.slack_webhook_url
  const hasDiscord = !!settings?.discord_webhook_url
  const hasAnyIntegration = hasCalendar || hasSlack || hasDiscord

  const updateTaskField = (index: number, field: keyof ParsedTask, value: string) => {
    setTasks(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t))
  }

  const removeTask = (index: number) => {
    setTasks(prev => prev.filter((_, i) => i !== index))
  }

  const confirm = async () => {
    if (tasks.length === 0) return
    setSaving(true)
    setError('')
    try {
      for (const task of tasks) {
        await createTask({
          title: task.title,
          description: task.description,
          priority: task.priority,
          due_date: task.due_date ? new Date(task.due_date).toISOString() : undefined,
          scheduled_date: task.scheduled_date ? new Date(task.scheduled_date).toISOString() : undefined,
          subtasks: task.subtasks.map((s, i) => ({ title: s.title, done: false, order: i })) as any,
          sync_calendar: hasCalendar && syncCalendar,
          notify_slack: hasSlack && notifySlack,
          notify_discord: hasDiscord && notifyDiscord,
        } as any)
      }
      onConfirm()
      navigate('/')
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to save tasks.')
    } finally {
      setSaving(false)
    }
  }

  const priorityColors: Record<string, string> = {
    low: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    high: 'bg-red-100 text-red-700',
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">
            {tasks.length} ticket{tasks.length !== 1 ? 's' : ''} suggested
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">Review and edit before saving. You can remove any you don't need.</p>
        </div>
        <button onClick={onCancel} className="text-sm text-gray-400 hover:text-gray-600">← Edit text</button>
      </div>

      {/* Task cards */}
      {tasks.map((task, i) => (
        <div key={i} className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm space-y-3">
          {/* Title row */}
          <div className="flex items-start justify-between gap-3">
            <input
              value={task.title}
              onChange={e => updateTaskField(i, 'title', e.target.value)}
              className="flex-1 text-base font-semibold text-gray-800 border-b border-transparent hover:border-gray-200 focus:border-blue-400 outline-none bg-transparent pb-0.5"
              placeholder="Task title"
            />
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColors[task.priority] || 'bg-gray-100 text-gray-600'}`}>
                {task.priority}
              </span>
              <button
                onClick={() => removeTask(i)}
                className="text-gray-300 hover:text-red-400 text-lg leading-none"
                title="Remove this task"
              >×</button>
            </div>
          </div>

          {/* Description */}
          <textarea
            value={task.description}
            onChange={e => updateTaskField(i, 'description', e.target.value)}
            rows={2}
            className="w-full text-sm text-gray-600 border border-gray-100 rounded-lg p-2.5 focus:outline-none focus:border-blue-300 resize-none bg-gray-50"
            placeholder="Description…"
          />

          {/* Subtasks */}
          {task.subtasks.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5">Subtasks</p>
              <ul className="space-y-1">
                {task.subtasks.map((sub, j) => (
                  <li key={j} className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="w-4 h-4 rounded border border-gray-300 flex items-center justify-center shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                    </span>
                    {sub.title}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Meta */}
          {task.due_date && (
            <p className="text-xs text-gray-400">
              📅 Due: <span className="text-gray-600">{new Date(task.due_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            </p>
          )}
        </div>
      ))}

      {tasks.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">All tasks removed. <button onClick={onCancel} className="text-blue-500 underline">Go back to edit.</button></div>
      )}

      {/* Integrations section */}
      {hasAnyIntegration && tasks.length > 0 && (
        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Also send to</p>
          {hasCalendar && (
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={syncCalendar}
                onChange={e => setSyncCalendar(e.target.checked)}
                className="w-4 h-4 rounded accent-blue-600"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">
                📅 <span className="font-medium">Google Calendar</span>
                <span className="text-gray-400 ml-1">— create events for tasks with dates</span>
              </span>
            </label>
          )}
          {hasSlack && (
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={notifySlack}
                onChange={e => setNotifySlack(e.target.checked)}
                className="w-4 h-4 rounded accent-blue-600"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">
                💬 <span className="font-medium">Slack</span>
                <span className="text-gray-400 ml-1">— post a message for each task</span>
              </span>
            </label>
          )}
          {hasDiscord && (
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={notifyDiscord}
                onChange={e => setNotifyDiscord(e.target.checked)}
                className="w-4 h-4 rounded accent-blue-600"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">
                🎮 <span className="font-medium">Discord</span>
                <span className="text-gray-400 ml-1">— post a message for each task</span>
              </span>
            </label>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {/* Action buttons */}
      {tasks.length > 0 && (
        <div className="flex gap-3 pt-1">
          <button
            onClick={confirm}
            disabled={saving}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : `Confirm & save ${tasks.length} task${tasks.length !== 1 ? 's' : ''}`}
          </button>
          <button
            onClick={onCancel}
            className="px-4 text-gray-500 text-sm hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
