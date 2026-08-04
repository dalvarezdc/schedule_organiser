import type { Task } from '../types'
import TaskNode from './TaskNode'

interface Props {
  tasks: Task[]
  onRefresh: () => void
  /** Full forest for the link picker (defaults to `tasks`). */
  allRootTasks?: Task[]
}

export default function TaskTree({ tasks, onRefresh, allRootTasks }: Props) {
  if (tasks.length === 0) return null
  const roots = allRootTasks ?? tasks
  return (
    <div className="divide-y divide-slate-50">
      {tasks.map(task => (
        <TaskNode
          key={task.id}
          task={task}
          depth={0}
          onRefresh={onRefresh}
          allRootTasks={roots}
        />
      ))}
    </div>
  )
}
