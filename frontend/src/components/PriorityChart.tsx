import type { Task } from '../types'

interface Props {
  tasks: Task[]
}

function countByPriority(tasks: Task[]): { high: number; medium: number; low: number } {
  const counts = { high: 0, medium: 0, low: 0 }
  const walk = (list: Task[]) => {
    for (const t of list) {
      counts[t.priority] = (counts[t.priority] || 0) + 1
      if (t.children?.length) walk(t.children)
    }
  }
  walk(tasks)
  return counts
}

const R = 36
const C = 2 * Math.PI * R

export default function PriorityChart({ tasks }: Props) {
  const { high, medium, low } = countByPriority(tasks)
  const total = high + medium + low

  const parts = [
    { value: high, color: '#1e3a5f', label: 'High' },
    { value: medium, color: '#d4a017', label: 'Medium' },
    { value: low, color: '#e8a0a0', label: 'Low' },
  ]

  let acc = 0
  const segments =
    total === 0
      ? []
      : parts
          .filter(p => p.value > 0)
          .map(p => {
            const len = (p.value / total) * C
            const offset = -acc
            acc += len
            return { ...p, len, offset }
          })

  return (
    <div className="bg-white rounded-card shadow-card p-5 h-full">
      <h3 className="text-sm font-bold text-navy mb-4">Task Priority</h3>

      <div className="flex justify-center py-2">
        <svg viewBox="0 0 100 100" className="w-36 h-36">
          {/* track */}
          <circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke="#eef1f6"
            strokeWidth="14"
          />
          {total === 0 ? null : (
            <g transform="rotate(-90 50 50)">
              {segments.map((seg, i) => (
                <circle
                  key={i}
                  cx="50"
                  cy="50"
                  r={R}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth="14"
                  strokeDasharray={`${seg.len} ${C - seg.len}`}
                  strokeDashoffset={seg.offset}
                />
              ))}
            </g>
          )}
        </svg>
      </div>

      <ul className="mt-3 space-y-2">
        {parts.map(p => (
          <li key={p.label} className="flex items-center gap-2 text-xs text-slate-600">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: p.color }}
            />
            <span className="flex-1 font-medium">{p.label}</span>
            <span className="text-slate-400 tabular-nums">{p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
