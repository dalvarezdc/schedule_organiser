import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getTasks } from '../api/client'
import TaskTree from '../components/TaskTree'
import { useState } from 'react'
import type { TaskStatus, TaskPriority, Task } from '../types'

export default function Dashboard() {
  const qc = useQueryClient()
  const { data: tasks = [], isLoading, refetch } = useQuery({
    queryKey: ['tasks'],
    queryFn: getTasks,
  })
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all')

  const filtered = (tasks as Task[]).filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
    return true
  })

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">My Tasks</h1>
        <Link
          to="/"
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          + Add Tasks
        </Link>
      </div>

      <div className="flex gap-3 mb-6">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as TaskStatus | 'all')}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400 bg-white text-slate-700"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
        </select>
        <select
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value as TaskPriority | 'all')}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400 bg-white text-slate-700"
        >
          <option value="all">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {isLoading && <p className="text-slate-400">Loading…</p>}

      {!isLoading && filtered.length === 0 && (
        <p className="text-slate-400 text-center py-16">
          No tasks yet.{' '}
          <Link to="/" className="text-indigo-500 hover:text-indigo-700 transition-colors">
            Add some!
          </Link>
        </p>
      )}

      {filtered.length > 0 && (
        <div className="border border-slate-200 rounded-xl bg-white shadow-sm p-4">
          <TaskTree
            tasks={filtered}
            onRefresh={() => {
              qc.invalidateQueries({ queryKey: ['tasks'] })
              refetch()
            }}
          />
        </div>
      )}
    </div>
  )
}
