import { Link } from 'react-router-dom'
import type { Task } from '../types'
import SubtaskList from './SubtaskList'

const priorityColors: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700',
}

const statusColors: Record<string, string> = {
  pending: 'text-gray-500',
  in_progress: 'text-blue-600',
  done: 'text-green-600',
}

export default function TaskCard({ task }: { task: Task }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <Link to={`/tasks/${task.id}`} className="font-semibold text-gray-800 hover:text-blue-600">
          {task.title}
        </Link>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColors[task.priority]}`}>
          {task.priority}
        </span>
      </div>
      {task.description && (
        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{task.description}</p>
      )}
      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
        <span className={statusColors[task.status]}>{task.status.replace('_', ' ')}</span>
        {task.due_date && <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>}
        {task.google_event_id && <span className="text-blue-400">📅 Synced</span>}
      </div>
      <SubtaskList taskId={task.id} subtasks={task.subtasks} />
    </div>
  )
}
