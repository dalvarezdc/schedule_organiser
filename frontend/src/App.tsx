import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Dashboard from './pages/Dashboard'
import InputPanel from './pages/InputPanel'
import TaskDetail from './pages/TaskDetail'
import Settings from './pages/Settings'
import ShareView from './pages/ShareView'

const queryClient = new QueryClient()

function Nav() {
  const location = useLocation()
  const isShare = location.pathname.startsWith('/share/')

  if (isShare) return null // No nav on public share pages

  return (
    <nav className="border-b border-gray-100 bg-white px-6 py-3 flex items-center gap-6 sticky top-0 z-10">
      <Link to="/" className="font-bold text-gray-900 text-sm tracking-tight hover:text-blue-600 transition-colors">
        Schedule Organiser
      </Link>
      <div className="flex items-center gap-4 ml-2">
        <Link
          to="/"
          className={`text-sm transition-colors ${location.pathname === '/' ? 'text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-800'}`}
        >
          + New
        </Link>
        <Link
          to="/tasks"
          className={`text-sm transition-colors ${location.pathname === '/tasks' ? 'text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-800'}`}
        >
          My Tasks
        </Link>
        <Link
          to="/settings"
          className={`text-sm transition-colors ${location.pathname === '/settings' ? 'text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-800'}`}
        >
          Settings
        </Link>
      </div>
    </nav>
  )
}

function AppRoutes() {
  return (
    <>
      <Nav />
      <Routes>
        <Route path="/" element={<InputPanel />} />
        <Route path="/tasks" element={<Dashboard />} />
        <Route path="/input" element={<InputPanel />} />  {/* keep old route working */}
        <Route path="/tasks/:id" element={<TaskDetail />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/share/:token" element={<ShareView />} />
      </Routes>
    </>
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
