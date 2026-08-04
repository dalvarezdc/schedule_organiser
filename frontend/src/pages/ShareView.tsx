import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getSharedTask } from '../api/client'
import type { Task } from '../types'

function ChildList({ children }: { children: Task[] }) {
  if (!children.length) return null
  return (
    <ul className="space-y-1 mt-2">
      {children.map(child => (
        <li key={child.id} className="ml-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span>{child.status === 'done' ? '✓' : '○'}</span>
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

  if (isLoading) return <div className="p-8 text-slate-400">Loading…</div>
  if (isError || !task) return (
    <div className="p-8 text-rose-500">This link is invalid or has been revoked.</div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
      <div className="text-xs text-slate-400 uppercase tracking-wide">Shared task</div>
      <h1 className="text-2xl font-bold text-slate-800">{task.title}</h1>
      <div className="flex gap-3 text-sm flex-wrap">
        <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 capitalize">
          {task.status.replace('_', ' ')}
        </span>
        <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 capitalize">
          {task.priority} priority
        </span>
        {task.due_date && (
          <span className="text-slate-500">Due: {new Date(task.due_date).toLocaleDateString()}</span>
        )}
      </div>
      {task.description && (
        <p className="text-slate-600 text-sm leading-relaxed">{task.description}</p>
      )}
      {task.children.length > 0 && (
        <div>
          <h3 className="font-semibold text-slate-700 mb-2 text-sm">Subtasks</h3>
          <ChildList children={task.children} />
        </div>
      )}
      <p className="text-xs text-slate-300 pt-4">Read-only view. Powered by Schedule Organiser.</p>
    </div>
  )
}
