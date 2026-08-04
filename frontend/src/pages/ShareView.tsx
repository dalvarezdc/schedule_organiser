import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getSharedTask } from '../api/client'
import type { Task } from '../types'

function ChildList({ children }: { children: Task[] }) {
  if (!children.length) return null
  return (
    <ul className="space-y-1.5 mt-2">
      {children.map(child => (
        <li key={child.id} className="ml-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className={child.status === 'done' ? 'text-brand-tealDark' : 'text-slate-300'}>
              {child.status === 'done' ? '✓' : '○'}
            </span>
            <span className={child.status === 'done' ? 'line-through text-slate-400' : ''}>
              {child.title}
            </span>
          </div>
          {child.children.length > 0 && <ChildList children={child.children} />}
        </li>
      ))}
    </ul>
  )
}

export default function ShareView() {
  const { token } = useParams<{ token: string }>()
  const { data: task, isLoading, isError } = useQuery({
    queryKey: ['share', token],
    queryFn: () => getSharedTask(token!),
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center text-slate-400 font-sans">
        Loading…
      </div>
    )
  }
  if (isError || !task) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center text-rose-500 font-sans">
        This link is invalid or has been revoked.
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface font-sans py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-card shadow-card p-8 space-y-4">
        <div className="text-xs text-slate-400 uppercase tracking-wide font-bold">Shared task</div>
        <h1 className="text-2xl font-bold text-navy">{task.title}</h1>
        <div className="flex gap-2 text-sm flex-wrap">
          <span className="bg-slate-100 px-2.5 py-0.5 rounded-full text-slate-600 capitalize text-xs font-semibold">
            {task.status.replace('_', ' ')}
          </span>
          <span className="bg-sky-100 px-2.5 py-0.5 rounded-full text-sky-700 capitalize text-xs font-bold">
            {task.priority}
          </span>
          {task.due_date && (
            <span className="text-slate-500 text-xs self-center">
              Due: {new Date(task.due_date).toLocaleDateString()}
            </span>
          )}
        </div>
        {task.description && (
          <p className="text-slate-600 text-sm leading-relaxed">{task.description}</p>
        )}
        {task.children.length > 0 && (
          <div>
            <h3 className="font-bold text-navy mb-2 text-sm">Subtasks</h3>
            <ChildList children={task.children} />
          </div>
        )}
        <p className="text-xs text-slate-300 pt-4 border-t border-slate-100">
          Read-only view. Powered by Schedule Organiser.
        </p>
      </div>
    </div>
  )
}
