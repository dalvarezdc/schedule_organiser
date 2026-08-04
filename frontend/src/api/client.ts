import axios from 'axios'
import type { Task, ParsedTask, Settings, Subtask } from '../types'

const api = axios.create({ baseURL: '/api' })

// Tasks
export const getTasks = () => api.get<Task[]>('/tasks').then(r => r.data)
export const getTask = (id: string) => api.get<Task>(`/tasks/${id}`).then(r => r.data)
export const createTask = (payload: Partial<Task> & { subtasks?: Partial<Subtask>[] }) =>
  api.post<Task>('/tasks', payload).then(r => r.data)
export const updateTask = (id: string, payload: Partial<Task>) =>
  api.put<Task>(`/tasks/${id}`, payload).then(r => r.data)
export const deleteTask = (id: string) => api.delete(`/tasks/${id}`)

// Subtasks
export const addSubtask = (taskId: string, title: string) =>
  api.post<Subtask>(`/tasks/${taskId}/subtasks`, { title, done: false, order: 0 }).then(r => r.data)
export const updateSubtask = (taskId: string, subtaskId: string, payload: Partial<Subtask>) =>
  api.put<Subtask>(`/tasks/${taskId}/subtasks/${subtaskId}`, payload).then(r => r.data)
export const deleteSubtask = (taskId: string, subtaskId: string) =>
  api.delete(`/tasks/${taskId}/subtasks/${subtaskId}`)

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
