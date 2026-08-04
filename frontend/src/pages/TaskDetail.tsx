import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getTask, updateTask, deleteTask, addSubtask, generateShareLink, revokeShareLink } from '../api/client'
import SubtaskList from '../components/SubtaskList'
import { useState } from 'react'

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: task, isLoading } = useQuery({ queryKey: ['task', id], queryFn: () => getTask(id!) })
  const [newSubtask, setNewSubtask] = useState('')
  const [shareUrl, setShareUrl] = useState('')

  if (isLoading) return <div className="p-8 text-gray-400">Loading...</div>
  if (!task) return <div className="p-8 text-red-500">Task not found.</div>

  const update = async (field: string, value: string) => {
    await updateTask(task.id, { [field]: value } as any)
    queryClient.invalidateQueries({ queryKey: ['task', id] })
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
  }

  const handleDelete = async () => {
    if (!confirm('Delete this task?')) return
    await deleteTask(task.id)
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
    navigate('/')
  }

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSubtask.trim()) return
    await addSubtask(task.id, newSubtask.trim())
    setNewSubtask('')
    queryClient.invalidateQueries({ queryKey: ['task', id] })
  }

  const handleShare = async () => {
    const result = await generateShareLink(task.id)
    setShareUrl(result.share_url)
    queryClient.invalidateQueries({ queryKey: ['task', id] })
  }

  const handleRevoke = async () => {
    await revokeShareLink(task.id)
    setShareUrl('')
    queryClient.invalidateQueries({ queryKey: ['task', id] })
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/')} className="text-sm text-gray-400 hover:text-gray-600">← Back</button>
        <button onClick={handleDelete} className="text-sm text-red-400 hover:text-red-600">Delete task</button>
      </div>
      <input
        defaultValue={task.title}
        onBlur={e => update('title', e.target.value)}
        className="w-full text-2xl font-bold text-gray-800 border-b border-transparent hover:border-gray-200 focus:border-blue-400 outline-none pb-1"
      />
      <div className="flex gap-3">
        <select defaultValue={task.status} onChange={e => update('status', e.target.value)} className="border rounded px-3 py-1.5 text-sm">
          <option value="pending">Pending</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
        </select>
        <select defaultValue={task.priority} onChange={e => update('priority', e.target.value)} className="border rounded px-3 py-1.5 text-sm">
          <option value="low">Low priority</option>
          <option value="medium">Medium priority</option>
          <option value="high">High priority</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Description</label>
        <textarea
          defaultValue={task.description}
          onBlur={e => update('description', e.target.value)}
          rows={4}
          className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:border-blue-400 resize-none"
        />
      </div>
      <div className="flex gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Due date</label>
          <input
            type="date"
            defaultValue={task.due_date ? task.due_date.split('T')[0] : ''}
            onBlur={e => update('due_date', e.target.value ? new Date(e.target.value).toISOString() : '')}
            className="border rounded px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Scheduled date</label>
          <input
            type="date"
            defaultValue={task.scheduled_date ? task.scheduled_date.split('T')[0] : ''}
            onBlur={e => update('scheduled_date', e.target.value ? new Date(e.target.value).toISOString() : '')}
            className="border rounded px-3 py-1.5 text-sm"
          />
        </div>
      </div>
      {task.google_event_id && <p className="text-xs text-blue-500">📅 Synced to Google Calendar</p>}
      <div>
        <h3 className="font-semibold text-gray-700 mb-2">Subtasks</h3>
        <SubtaskList taskId={task.id} subtasks={task.subtasks} />
        <form onSubmit={handleAddSubtask} className="flex gap-2 mt-3">
          <input
            value={newSubtask}
            onChange={e => setNewSubtask(e.target.value)}
            placeholder="Add subtask..."
            className="flex-1 border rounded px-3 py-1.5 text-sm"
          />
          <button type="submit" className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-200">Add</button>
        </form>
      </div>
      <div>
        <h3 className="font-semibold text-gray-700 mb-2">Share</h3>
        {task.share_token ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-600 break-all">{shareUrl || `${window.location.origin}/share/${task.share_token}`}</p>
            <button onClick={handleRevoke} className="text-sm text-red-400 hover:text-red-600">Revoke link</button>
          </div>
        ) : (
          <button onClick={handleShare} className="text-sm text-blue-600 hover:text-blue-800">Generate share link</button>
        )}
      </div>
    </div>
  )
}
