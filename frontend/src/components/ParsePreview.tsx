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
      navigate('/tasks?filter=all')
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to save tasks.')
    } finally {
      setSaving(false)
    }
  }

  const priorityColors: Record<string, string> = {
    low: 'bg-slate-100 text-slate-600',
    medium: 'bg-sky-100 text-sky-700',
    high: 'bg-rose-500 text-white',
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-navy">
            {tasks.length} ticket{tasks.length !== 1 ? 's' : ''} suggested
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Review and edit before saving. You can remove any you don&apos;t need.
          </p>
        </div>
        <button onClick={onCancel} className="text-sm text-slate-400 hover:text-navy font-medium">
          ← Edit text
        </button>
      </div>

      {tasks.map((task, i) => (
        <div key={i} className="rounded-card p-5 bg-white shadow-card space-y-3">
          <div className="flex items-start justify-between gap-3">
            <input
              value={task.title}
              onChange={e => updateTaskField(i, 'title', e.target.value)}
              className="flex-1 text-base font-bold text-navy border-b border-transparent hover:border-slate-200 focus:border-brand-teal outline-none bg-transparent pb-0.5"
              placeholder="Task title"
            />
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full font-bold ${priorityColors[task.priority] || 'bg-slate-100 text-slate-600'}`}
              >
                {task.priority}
              </span>
              <button
                onClick={() => removeTask(i)}
                className="text-slate-300 hover:text-rose-400 text-lg leading-none"
                title="Remove this task"
              >
                ×
              </button>
            </div>
          </div>

          <textarea
            value={task.description}
            onChange={e => updateTaskField(i, 'description', e.target.value)}
            rows={2}
            className="w-full text-sm text-slate-600 border border-slate-100 rounded-lg p-2.5 focus:outline-none focus:border-brand-teal resize-none bg-surface"
            placeholder="Description…"
          />

          {task.subtasks.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide font-bold mb-1.5">
                Subtasks
              </p>
              <ul className="space-y-1">
                {task.subtasks.map((sub, j) => (
                  <li key={j} className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center shrink-0" />
                    {sub.title}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {task.due_date && (
            <p className="text-xs text-slate-400">
              Due:{' '}
              <span className="text-slate-600 font-medium">
                {new Date(task.due_date).toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </p>
          )}
        </div>
      ))}

      {tasks.length === 0 && (
        <div className="text-center py-8 text-slate-400 text-sm">
          All tasks removed.{' '}
          <button onClick={onCancel} className="text-brand-tealDark underline font-medium">
            Go back to edit.
          </button>
        </div>
      )}

      {hasAnyIntegration && tasks.length > 0 && (
        <div className="rounded-card p-4 bg-white shadow-card space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">
            Also send to
          </p>
          {hasCalendar && (
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={syncCalendar}
                onChange={e => setSyncCalendar(e.target.checked)}
                className="task-checkbox"
              />
              <span className="text-sm text-slate-700">
                <span className="font-semibold">Google Calendar</span>
                <span className="text-slate-400 ml-1">— create events for tasks with dates</span>
              </span>
            </label>
          )}
          {hasSlack && (
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={notifySlack}
                onChange={e => setNotifySlack(e.target.checked)}
                className="task-checkbox"
              />
              <span className="text-sm text-slate-700">
                <span className="font-semibold">Slack</span>
                <span className="text-slate-400 ml-1">— post a message for each task</span>
              </span>
            </label>
          )}
          {hasDiscord && (
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={notifyDiscord}
                onChange={e => setNotifyDiscord(e.target.checked)}
                className="task-checkbox"
              />
              <span className="text-sm text-slate-700">
                <span className="font-semibold">Discord</span>
                <span className="text-slate-400 ml-1">— post a message for each task</span>
              </span>
            </label>
          )}
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">
          {error}
        </div>
      )}

      {tasks.length > 0 && (
        <div className="flex gap-3 pt-1">
          <button
            onClick={confirm}
            disabled={saving}
            className="flex-1 bg-navy text-white py-2.5 rounded-xl text-sm font-bold hover:bg-navy-mid disabled:opacity-50 transition-colors shadow-soft"
          >
            {saving
              ? 'Saving…'
              : `Confirm & save ${tasks.length} task${tasks.length !== 1 ? 's' : ''}`}
          </button>
          <button
            onClick={onCancel}
            className="px-4 text-slate-500 text-sm hover:text-slate-700 font-medium"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
