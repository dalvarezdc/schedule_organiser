import axios from 'axios'
import type { Task, ParsedTask, Settings, ImproveResult } from '../types'

const api = axios.create({ baseURL: '/api' })

// Tasks
export const getTasks = () => api.get<Task[]>('/tasks').then(r => r.data)
export const getTask = (id: string) => api.get<Task>(`/tasks/${id}`).then(r => r.data)
export const createTask = (payload: Partial<Task> & {
  subtasks?: { title: string; done?: boolean; order?: number }[]
  parent_id?: string | null
  notify_slack?: boolean
  notify_discord?: boolean
  sync_calendar?: boolean
}) => api.post<Task>('/tasks', payload).then(r => r.data)
export const updateTask = (id: string, payload: Partial<Task>) =>
  api.put<Task>(`/tasks/${id}`, payload).then(r => r.data)
export const deleteTask = (id: string) => api.delete(`/tasks/${id}`)

// Link an existing task as a child of another
export const linkAsChild = (childId: string, parentId: string) =>
  api.put<Task>(`/tasks/${childId}`, { parent_id: parentId }).then(r => r.data)

// Move a task back to root (unlink from parent)
export const unlinkTask = (taskId: string) =>
  api.put<Task>(`/tasks/${taskId}`, { parent_id: null }).then(r => r.data)

// AI Improve
export const improveTask = (id: string) =>
  api.post<ImproveResult>(`/tasks/${id}/improve`).then(r => r.data)

// Parse
export const parseText = (text: string) =>
  api.post<{ tasks: ParsedTask[] }>('/parse', { text }).then(r => r.data)

// Settings
export const getSettings = () => api.get<Settings>('/settings').then(r => r.data)
export const updateSettings = (payload: Partial<Settings> & { ai_api_key?: string }) =>
  api.put<Settings>('/settings', payload).then(r => r.data)

// Share
export const generateShareLink = (taskId: string) =>
  api.post<{ share_token: string; share_url: string }>(`/tasks/${taskId}/share`).then(r => r.data)
export const revokeShareLink = (taskId: string) => api.delete(`/tasks/${taskId}/share`)
export const getSharedTask = (token: string) => api.get<Task>(`/share/${token}`).then(r => r.data)
