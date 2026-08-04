import { updateSubtask } from '../api/client'
import type { Subtask } from '../types'
import { useQueryClient } from '@tanstack/react-query'

interface Props {
  taskId: string
  subtasks: Subtask[]
}

export default function SubtaskList({ taskId, subtasks }: Props) {
  const queryClient = useQueryClient()

  const toggle = async (sub: Subtask) => {
    await updateSubtask(taskId, sub.id, { done: !sub.done })
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
    queryClient.invalidateQueries({ queryKey: ['task', taskId] })
  }

  if (!subtasks.length) return null

  return (
    <ul className="mt-2 space-y-1">
      {subtasks.map(sub => (
        <li key={sub.id} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={sub.done}
            onChange={() => toggle(sub)}
            className="rounded"
          />
          <span className={sub.done ? 'line-through text-gray-400' : ''}>{sub.title}</span>
        </li>
      ))}
    </ul>
  )
}
