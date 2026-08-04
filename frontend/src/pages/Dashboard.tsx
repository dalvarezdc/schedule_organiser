import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { getTasks } from '../api/client'
import TaskTree from '../components/TaskTree'
import StatCards from '../components/StatCards'
import PriorityChart from '../components/PriorityChart'
import type { Task, TaskStatus } from '../types'

function filterTasks(tasks: Task[], filter: string): Task[] {
  if (filter === 'all' || filter === 'hierarchy') return tasks
  if (filter === 'archive') {
    // Archive shows completed roots only
    return tasks.filter(t => t.status === 'done')
  }
  const status = filter as TaskStatus
  if (status === 'pending' || status === 'in_progress' || status === 'done') {
    return tasks.filter(t => t.status === status)
  }
  return tasks
}

const titles: Record<string, string> = {
  all: 'All Tasks',
  hierarchy: 'My Hierarchy',
  pending: 'Pending',
  in_progress: 'In Progress',
  done: 'Done',
  archive: 'Archive',
}

export default function Dashboard() {
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const filter = params.get('filter') || 'all'

  const { data: tasks = [], isLoading, refetch } = useQuery({
    queryKey: ['tasks'],
    queryFn: getTasks,
  })

  const filtered = filterTasks(tasks as Task[], filter)
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['tasks'] })
    refetch()
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <StatCards tasks={tasks as Task[]} />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_240px] gap-5 items-start">
        {/* Task hierarchy panel */}
        <section className="bg-white rounded-card shadow-card min-h-[420px]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-navy">
              {titles[filter] || 'Tasks'}
            </h2>
            <Link
              to="/"
              className="text-xs font-semibold text-brand-tealDark hover:text-teal-800 transition-colors"
            >
              + Add Tasks
            </Link>
          </div>

          <div className="px-3 py-2">
            {isLoading && (
              <p className="text-sm text-slate-400 px-3 py-10 text-center">Loading…</p>
            )}

            {!isLoading && filtered.length === 0 && (
              <p className="text-sm text-slate-400 px-3 py-16 text-center">
                No tasks here yet.{' '}
                <Link to="/" className="text-brand-tealDark font-semibold hover:underline">
                  Add some!
                </Link>
              </p>
            )}

            {!isLoading && filtered.length > 0 && (
              <TaskTree tasks={filtered} onRefresh={refresh} allRootTasks={tasks as Task[]} />
            )}
          </div>
        </section>

        {/* Priority donut */}
        <aside className="xl:sticky xl:top-0">
          <PriorityChart tasks={tasks as Task[]} />
        </aside>
      </div>
    </div>
  )
}
