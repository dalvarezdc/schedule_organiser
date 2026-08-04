import { BrowserRouter, Routes, Route, Link, NavLink, useLocation, Outlet } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Dashboard from './pages/Dashboard'
import InputPanel from './pages/InputPanel'
import TaskDetail from './pages/TaskDetail'
import Settings from './pages/Settings'
import ShareView from './pages/ShareView'

const queryClient = new QueryClient()

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  [
    'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
    isActive
      ? 'bg-navy-light text-white'
      : 'text-slate-300 hover:bg-navy-mid hover:text-white',
  ].join(' ')

function IconBriefcase({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
    </svg>
  )
}

function IconTree({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v4m0 0a2 2 0 100 4 2 2 0 000-4zm0 4v4m-4 0a2 2 0 100 4 2 2 0 000-4zm8 0a2 2 0 100 4 2 2 0 000-4z" />
    </svg>
  )
}

function IconHourglass({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 2h12M6 22h12M8 2v3a4 4 0 002.5 3.7L12 10l1.5-1.3A4 4 0 0016 5V2M8 22v-3a4 4 0 012.5-3.7L12 14l1.5 1.3A4 4 0 0016 19v3" />
    </svg>
  )
}

function IconGear({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function IconCheck({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function IconArchive({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
    </svg>
  )
}

function IconBell({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  )
}

function IconPlus({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  )
}

function pageTitle(pathname: string): string {
  if (pathname === '/' || pathname === '/input') return 'Add Tasks'
  if (pathname.startsWith('/tasks/') && pathname !== '/tasks') return 'Task Detail'
  if (pathname.startsWith('/tasks')) return 'My Tasks'
  if (pathname.startsWith('/settings')) return 'Settings'
  return 'Schedule Organiser'
}

function AppLayout() {
  const location = useLocation()
  const title = pageTitle(location.pathname)
  const search = new URLSearchParams(location.search)
  const filter = search.get('filter') || 'all'

  const filterActive = (value: string) =>
    location.pathname.startsWith('/tasks') &&
    !location.pathname.match(/^\/tasks\/[^/]+/) &&
    filter === value

  const filterClass = (value: string) =>
    [
      'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full text-left',
      filterActive(value)
        ? 'bg-navy-light text-white'
        : 'text-slate-300 hover:bg-navy-mid hover:text-white',
    ].join(' ')

  return (
    <div className="flex h-full min-h-0 bg-navy-deep font-sans">
      {/* Sidebar */}
      <aside className="w-[220px] shrink-0 flex flex-col py-6 px-3 bg-navy-deep text-white">
        <div className="px-3 mb-8 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-navy-light flex items-center justify-center">
            <IconBriefcase className="w-4 h-4 text-brand-teal" />
          </div>
          <span className="font-bold text-sm tracking-tight">Organiser</span>
        </div>

        <nav className="flex-1 space-y-1">
          <Link to="/tasks?filter=all" className={filterClass('all')}>
            <IconBriefcase />
            All Tasks
          </Link>
          <Link to="/tasks?filter=hierarchy" className={filterClass('hierarchy')}>
            <IconTree />
            My Hierarchy
          </Link>
          <Link to="/tasks?filter=pending" className={filterClass('pending')}>
            <IconHourglass />
            Pending
          </Link>
          <Link to="/tasks?filter=in_progress" className={filterClass('in_progress')}>
            <IconGear />
            In Progress
          </Link>
          <Link to="/tasks?filter=done" className={filterClass('done')}>
            <IconCheck />
            Done
          </Link>
          <Link to="/tasks?filter=archive" className={filterClass('archive')}>
            <IconArchive />
            Archive
          </Link>
        </nav>

        <div className="pt-4 border-t border-navy-light/40 space-y-1">
          <NavLink to="/" end className={navItemClass}>
            <IconPlus />
            Add Tasks
          </NavLink>
          <NavLink to="/settings" className={navItemClass}>
            <IconGear />
            Settings
          </NavLink>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        {/* Top bar */}
        <header className="h-14 shrink-0 flex items-center justify-between px-8 bg-navy-deep">
          <div className="flex items-center gap-2.5 text-white">
            <IconBriefcase className="w-5 h-5 text-slate-300" />
            <h1 className="text-base font-bold tracking-tight">{title}</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="text-slate-300 hover:text-white transition-colors"
              aria-label="Notifications"
            >
              <IconBell />
            </button>
            <div
              className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-teal to-brand-blue flex items-center justify-center text-white text-xs font-bold shadow-soft"
              title="You"
            >
              You
            </div>
          </div>
        </header>

        {/* Content panel */}
        <main className="flex-1 min-h-0 bg-surface rounded-tl-panel overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto panel-scroll p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

function AppRoutes() {
  const location = useLocation()
  const isShare = location.pathname.startsWith('/share/')

  if (isShare) {
    return (
      <Routes>
        <Route path="/share/:token" element={<ShareView />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<InputPanel />} />
        <Route path="/input" element={<InputPanel />} />
        <Route path="/tasks" element={<Dashboard />} />
        <Route path="/tasks/:id" element={<TaskDetail />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
