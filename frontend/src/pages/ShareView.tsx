import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getSharedTask } from '../api/client'

export default function ShareView() {
  const { token } = useParams<{ token: string }>()
  const { data: task, isLoading, isError } = useQuery({
    queryKey: ['share', token],
    queryFn: () => getSharedTask(token!),
  })

  if (isLoading) return <div className="p-8 text-gray-400">Loading...</div>
  if (isError || !task) return <div className="p-8 text-red-500">This link is invalid or has been revoked.</div>

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
      <div className="text-xs text-gray-400 uppercase tracking-wide">Shared task</div>
      <h1 className="text-2xl font-bold text-gray-800">{task.title}</h1>
      <div className="flex gap-3 text-sm">
        <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600 capitalize">{task.status.replace('_', ' ')}</span>
        <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600 capitalize">{task.priority} priority</span>
        {task.due_date && <span className="text-gray-500">Due: {new Date(task.due_date).toLocaleDateString()}</span>}
      </div>
      {task.description && <p className="text-gray-600 text-sm leading-relaxed">{task.description}</p>}
      {task.subtasks.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-700 mb-2 text-sm">Subtasks</h3>
          <ul className="space-y-1">
            {task.subtasks.map(sub => (
              <li key={sub.id} className="flex items-center gap-2 text-sm text-gray-600">
                <span>{sub.done ? '✓' : '○'}</span>
                <span className={sub.done ? 'line-through text-gray-400' : ''}>{sub.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-gray-300 pt-4">Read-only view. Powered by Schedule Organiser.</p>
    </div>
  )
}
