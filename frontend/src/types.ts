export type TaskStatus = 'pending' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  scheduled_date: string | null
  google_event_id: string | null
  share_token: string | null
  parent_id: string | null
  order: number
  created_at: string
  updated_at: string
  children: Task[]
}

export interface ParsedSubtask {
  title: string
}

export interface ParsedTask {
  title: string
  description: string
  subtasks: ParsedSubtask[]
  due_date: string | null
  scheduled_date: string | null
  priority: TaskPriority
}

export interface ImproveResult {
  title: string
  description: string
  suggested_subtasks: ParsedSubtask[]
}

export interface Settings {
  ai_provider: string
  ai_model: string
  ai_base_url: string
  ai_api_key_set: boolean
  slack_webhook_url: string
  discord_webhook_url: string
  google_calendar_id: string
  google_connected: boolean
}

export interface SlackBulkNotifyResponse {
  success: boolean
  sent_count: number
  message: string
}

