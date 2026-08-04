import { useState } from 'react'
import type { ImproveResult } from '../types'

interface Props {
  result: ImproveResult
  onApply: (title: string, description: string, acceptedSubtasks: string[]) => void
  onCancel: () => void
}

export default function ImprovePanel({ result, onApply, onCancel }: Props) {
  const [title, setTitle] = useState(result.title)
  const [description, setDescription] = useState(result.description)
  const [checked, setChecked] = useState<boolean[]>(
    result.suggested_subtasks.map(() => true)
  )

  const toggle = (i: number) =>
    setChecked(c => c.map((v, j) => (i === j ? !v : v)))

  const handleApply = () => {
    const accepted = result.suggested_subtasks
      .filter((_, i) => checked[i])
      .map(s => s.title)
    onApply(title, description, accepted)
  }

  return (
    <div className="border border-indigo-200 bg-indigo-50 rounded-xl p-4 space-y-4 mt-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-indigo-800">
          AI suggestions — review before applying
        </h4>
        <button
          onClick={onCancel}
          className="text-slate-400 hover:text-slate-600 text-xs"
          aria-label="Discard suggestions"
        >
          ✕ Discard
        </button>
      </div>

      <div>
        <label className="block text-xs text-slate-500 mb-1 font-medium">Improved title</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 bg-white"
        />
      </div>

      <div>
        <label className="block text-xs text-slate-500 mb-1 font-medium">Improved description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={5}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 resize-vertical bg-white leading-relaxed"
        />
      </div>

      {result.suggested_subtasks.length > 0 && (
        <div>
          <label className="block text-xs text-slate-500 mb-2 font-medium">
            Suggested subtasks (uncheck to skip)
          </label>
          <ul className="space-y-1.5">
            {result.suggested_subtasks.map((sub, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked[i]}
                  onChange={() => toggle(i)}
                  className="accent-indigo-600 cursor-pointer"
                />
                <span className={checked[i] ? 'text-slate-700' : 'text-slate-400 line-through'}>
                  {sub.title}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button
          onClick={handleApply}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          Apply changes
        </button>
        <button
          onClick={onCancel}
          className="text-slate-500 hover:text-slate-700 text-sm px-2 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
