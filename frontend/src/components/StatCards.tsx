import type { Task } from '../types'

interface Props {
  tasks: Task[]
}

function flatten(tasks: Task[]): Task[] {
  return tasks.flatMap(t => [t, ...flatten(t.children || [])])
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfToday() {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d
}

export function computeStats(tasks: Task[]) {
  const all = flatten(tasks)
  const todayStart = startOfToday()
  const todayEnd = endOfToday()

  const incomplete = all.filter(t => t.status !== 'done')
  const overdue = all.filter(t => {
    if (t.status === 'done' || !t.due_date) return false
    return new Date(t.due_date) < todayStart
  })
  const dueToday = all.filter(t => {
    if (t.status === 'done' || !t.due_date) return false
    const d = new Date(t.due_date)
    return d >= todayStart && d <= todayEnd
  })

  return {
    all: all.length,
    incomplete: incomplete.length,
    overdue: overdue.length,
    dueToday: dueToday.length,
  }
}

const cards = [
  {
    key: 'all' as const,
    label: 'All Tasks',
    iconBg: 'bg-brand-blueSoft',
    iconColor: 'text-brand-blue',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    key: 'incomplete' as const,
    label: 'Incomplete',
    iconBg: 'bg-teal-50',
    iconColor: 'text-brand-tealDark',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    ),
  },
  {
    key: 'overdue' as const,
    label: 'Overdue',
    iconBg: 'bg-brand-goldSoft',
    iconColor: 'text-brand-gold',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    key: 'dueToday' as const,
    label: 'Due Today',
    iconBg: 'bg-sky-50',
    iconColor: 'text-sky-500',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
]

export default function StatCards({ tasks }: Props) {
  const stats = computeStats(tasks)

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      {cards.map(c => (
        <div
          key={c.key}
          className="bg-white rounded-card shadow-card px-4 py-3.5 flex items-center gap-3"
        >
          <div className={`w-9 h-9 rounded-full ${c.iconBg} ${c.iconColor} flex items-center justify-center shrink-0`}>
            {c.icon}
          </div>
          <div className="min-w-0">
            <div className="text-xl font-bold text-navy tabular-nums leading-tight">
              {stats[c.key]}
            </div>
            <div className="text-xs text-slate-500 font-medium truncate">{c.label}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
