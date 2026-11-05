import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://snkfvlizxogimhsdgcim.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable__3lCFKzLxY6hUiSj88vE4Q_CAbN8Zej'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type UserRole = 'manager' | 'executor'

export type TaskStatus = 'Новая' | 'В работе' | 'На проверке' | 'Принята' | 'На доработке'

export interface Profile {
  id: string
  email: string
  role: UserRole
  created_at?: string
}

export interface ObjectItem {
  id: string
  name: string
  address: string
  created_at?: string
}

export interface TaskItem {
  id: string
  title: string
  description: string
  object_id: string
  executor_id: string | null
  author_id: string
  status: TaskStatus
  created_at: string
  object?: ObjectItem
  executor?: Profile
  author?: Profile
}

export interface TaskHistoryItem {
  id: string
  task_id: string
  changed_by: string
  old_status: TaskStatus | null
  new_status: TaskStatus
  comment: string | null
  created_at: string
  changer?: Profile
}
