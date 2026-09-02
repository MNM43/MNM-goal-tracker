export type NodeType = 'goal' | 'task'
export type CycleType = 'year' | 'quarter' | 'month' | 'week' | 'custom' | null
export type Status = 'not_started' | 'in_progress' | 'completed' | 'abandoned'
export type DisplayStatus = 'not_started' | 'in_progress' | 'completed' | 'abandoned' | 'overdue'
export type Priority = 1 | 2 | 3 | null
export type ProgressSource = 'manual' | 'children' | 'checkin'
export type Period = 'all' | 'year' | 'quarter' | 'month' | 'week'

export interface GoalNode {
  id: string
  parent_id: string | null
  title: string
  node_type: NodeType
  cycle_type: CycleType
  cycle_key: string | null
  planned_start: string | null
  planned_end: string | null
  actual_start: string | null
  actual_end: string | null
  status: Status
  status_locked: boolean
  depends_on: string[]
  progress: number
  progress_source: ProgressSource
  weight: number
  priority: Priority
  emoji: string | null
  note: string
  category_id: string | null
  color: string | null
  sort_order: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Category {
  id: string
  parent_id: string | null
  name: string
  color: string
  emoji: string | null
  sort_order: number
  deleted_at: string | null
}

export interface Checkin {
  id: string
  node_id: string
  title: string
  emoji: string | null
  period_type: 'week' | 'month'
  target_count: number
  anchor_date: string | null
  start_date: string
  end_date: string | null
  category_id: string | null
  color: string | null
  sort_order: number
  updated_at: string
  deleted_at: string | null
}

export interface CheckinLog {
  id: string
  checkin_id: string
  record_date: string
  status: 'done' | 'skipped'
  is_makeup: boolean
  note: string
  created_at: string
}