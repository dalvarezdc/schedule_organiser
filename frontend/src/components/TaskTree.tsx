import type { Task } from '../types'
import TaskNode from './TaskNode'

interface Props {
  tasks: Task[]
  onRefresh: () => void
}

export default function TaskTree({ tasks, onRefresh }: Props) {
  if (tasks.length === 0) return null
  return (
    <div className="space-y-0.5">
      {tasks.map(task => (
        <TaskNode
          key={task.id}
          task={task}
          depth={0}
          onRefresh={onRefresh}
          allRootTasks={tasks}
        />
      ))}
    </div>
  )
}
