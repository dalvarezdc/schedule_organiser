import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getTasks } from '../api/client'
import TaskCard from '../components/TaskCard'
import { useState } from 'react'
import type { TaskStatus, TaskPriority } from '../types'

export default function Dashboard() {
  const { data: tasks = [], isLoading } = useQuery({ queryKey: ['tasks'], queryFn: getTasks })
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all')

  const filtered = tasks.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
    return true
  })

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">My Tasks</h1>
        <Link to="/" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          + Add Tasks
        </Link>
      </div>
      <div className="flex gap-3 mb-4">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as TaskStatus | 'all')} className="border rounded px-3 py-1.5 text-sm">
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
        </select>
        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value as TaskPriority | 'all')} className="border rounded px-3 py-1.5 text-sm">
          <option value="all">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>
      {isLoading && <p className="text-gray-400">Loading...</p>}
      {!isLoading && filtered.length === 0 && (
        <p className="text-gray-400 text-center py-16">No tasks yet. <Link to="/" className="text-blue-500">Add some!</Link></p>
      )}
      <div className="space-y-3">
        {filtered.map(task => <TaskCard key={task.id} task={task} />)}
      </div>
    </div>
  )
}
