import type { GoalNode, DisplayStatus } from '../types'

export function clamp(v: number, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, v)) }

export function isOverdue(n: GoalNode, today = new Date()): boolean {
  if (n.status === 'completed' || n.status === 'abandoned' || n.status_locked) return false
  if (!n.planned_end) return false
  const end = new Date(n.planned_end)
  const t = new Date(today.toDateString())
  return end.getTime() < t.getTime()
}

export function displayStatus(n: GoalNode, today = new Date()): DisplayStatus {
  if (n.actual_end) return 'completed'
  if (isOverdue(n, today)) return 'overdue'
  return n.status
}

/** 父节点进度 = 直接子级进度的算术平均（递归）。叶子节点手动或打卡驱动。 */
export function computeProgress(node: GoalNode, all: GoalNode[], checkinDriven: Record<string, number>): number {
  if (node.progress_source === 'manual') return clamp(node.progress)
  if (node.progress_source === 'checkin') return clamp(checkinDriven[node.id] ?? node.progress)
  const children = all.filter(c => c.parent_id === node.id && !c.deleted_at)
  if (children.length === 0) return clamp(node.progress)
  const sum = children.reduce((acc, c) => acc + computeProgress(c, all, checkinDriven), 0)
  return Math.round(sum / children.length)
}

export function statusColor(s: DisplayStatus): { bg: string; fg: string } {
  switch (s) {
    case 'not_started': return { bg: '#F4F4F8', fg: '#8E8E93' }
    case 'in_progress': return { bg: '#E8E8FA', fg: '#5C5CE0' }
    case 'completed':   return { bg: '#E3F3EA', fg: '#2E9E63' }
    case 'abandoned':   return { bg: '#F0F0F2', fg: '#8E8E93' }
    case 'overdue':     return { bg: '#FCE9E7', fg: '#E5484D' }
  }
}

export function statusLabel(s: DisplayStatus): string {
  return ({ not_started: '未开始', in_progress: '进行中', completed: '已完成', abandoned: '已放弃', overdue: '已超时' } as const)[s]
}