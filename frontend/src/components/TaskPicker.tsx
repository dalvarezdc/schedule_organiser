import { useState } from 'react'
import type { Task } from '../types'

interface Props {
  allTasks: Task[]
  excludeIds: Set<string>
  onSelect: (taskId: string) => void
  onClose: () => void
}

function flattenTasks(tasks: Task[], exclude: Set<string>): Task[] {
  const result: Task[] = []
  const walk = (list: Task[]) => {
    for (const t of list) {
      if (!exclude.has(t.id)) result.push(t)
      walk(t.children)
    }
  }
  walk(tasks)
  return result
}

export default function TaskPicker({ allTasks, excludeIds, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('')
  const candidates = flattenTasks(allTasks, excludeIds)
  const filtered = query.trim()
    ? candidates.filter(t => t.title.toLowerCase().includes(query.toLowerCase()))
    : candidates

  return (
    <div className="border border-slate-200 rounded-xl bg-white shadow-lg p-3 w-80">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-600">Link existing task as subtask</span>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 text-xs leading-none"
          aria-label="Close picker"
        >
          ✕
        </button>
      </div>
      <input
        autoFocus
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search tasks…"
        className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400 mb-2"
      />
      <ul className="max-h-48 overflow-y-auto space-y-0.5">
        {filtered.length === 0 && (
          <li className="text-xs text-slate-400 px-2 py-2">No matching tasks</li>
        )}
        {filtered.map(t => (
          <li key={t.id}>
            <button
              onClick={() => onSelect(t.id)}
              className="w-full text-left text-sm px-2 py-1.5 rounded-lg hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 transition-colors"
            >
              {t.title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
