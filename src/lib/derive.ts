import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import type { DisplayStatus, GoalNode } from '../types'
import { buildForest, effectiveCategoryId, type TreeNode } from './tree'
import { computeProgress, displayStatus } from './progress'
import { checkinDrivenProgress } from './checkin'
import { getCycleRange, type CycleType } from './cycle'
import { useUI } from '../store/useUI'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'

/** 剪枝：保留命中节点及其全部祖先链 */
function pruneForest(forest: TreeNode[], match: Set<string>): TreeNode[] {
  const walk = (list: TreeNode[]): TreeNode[] => {
    const out: TreeNode[] = []
    for (const n of list) {
      const kids = walk(n.children)
      if (match.has(n.id) || kids.length) out.push({ ...n, children: kids })
    }
    return out
  }
  return walk(forest)
}

export interface Overview {
  total: number
  completed: number
  overdue: number
  inProgress: number
  notStarted: number
  avgProgress: number
  dueSoon: number      // 7 天内到期
  checkinToday: number // 今日待打卡数（本周/本月未达标的项）
}

export function useDerived() {
  const nodes = useStore(s => s.nodes)
  const checkins = useStore(s => s.checkins)
  const checkinLogs = useStore(s => s.checkinLogs)
  const categories = useStore(s => s.categories)
  const period = useStore(s => s.selectedPeriod)
  const anchorStr = useUI(s => s.periodAnchor)
  const selectedCategoryId = useStore(s => s.selectedCategoryId)

  return useMemo(() => {
    const live = nodes.filter(n => !n.deleted_at)

    /* 打卡驱动进度 */
    const ckProgress = checkinDrivenProgress(checkins, checkinLogs)

    /* 进度（递归汇总） */
    const progressMap: Record<string, number> = {}
    for (const n of live) progressMap[n.id] = computeProgress(n, live, ckProgress)

    /* 展示状态（含超时计算） */
    const statusMap: Record<string, DisplayStatus> = {}
    for (const n of live) statusMap[n.id] = displayStatus(n)

    /* 分类归属（继承） */
    const catMap: Record<string, string | null> = {}
    for (const n of live) catMap[n.id] = effectiveCategoryId(live, n.id)

    const forest = buildForest(live)

    /* 周期过滤 */
    let pr: { start: Date; end: Date } | null = null
    if (period !== 'all') {
      const r = getCycleRange(period as CycleType, parseISO(anchorStr))
      pr = { start: r.start, end: r.end }
    }
    const match = new Set<string>()
    if (!pr) {
      for (const n of live) match.add(n.id)
    } else {
      const s = format(pr.start, 'yyyy-MM-dd')
      const e = format(pr.end, 'yyyy-MM-dd')
      for (const n of live) {
        if (!n.planned_start && !n.planned_end) continue
        const ns = n.planned_start || n.planned_end!
        const ne = n.planned_end || n.planned_start!
        if (ns <= e && ne >= s) match.add(n.id)
      }
      // 周期属性命中也算
      const ck = getCycleRange(period as CycleType, parseISO(anchorStr)).key
      for (const n of live) {
        if (n.cycle_type === period) match.add(n.id)
        if (n.cycle_key && n.cycle_key === ck) match.add(n.id)
      }
    }
    /* 分类筛选（含子分类） */
    const periodMatchIds = new Set(match)
    if (selectedCategoryId) {
      const allowed = new Set<string>([selectedCategoryId])
      let changed = true
      while (changed) {
        changed = false
        for (const c of categories) {
          if (c.parent_id && allowed.has(c.parent_id) && !allowed.has(c.id)) { allowed.add(c.id); changed = true }
        }
      }
      for (const id of [...match]) {
        if (!allowed.has(catMap[id] || '__none__')) match.delete(id)
      }
    }
    const visibleForest = selectedCategoryId ? pruneForest(forest, match) : (pr ? pruneForest(forest, periodMatchIds) : forest)

    /* 概览统计 */
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const in7 = format(new Date(Date.now() + 7 * 864e5), 'yyyy-MM-dd')
    const ov: Overview = {
      total: live.length,
      completed: 0, overdue: 0, inProgress: 0, notStarted: 0,
      avgProgress: 0, dueSoon: 0, checkinToday: 0,
    }
    let pSum = 0
    for (const n of live) {
      const st = statusMap[n.id]
      if (st === 'completed') ov.completed++
      else if (st === 'overdue') ov.overdue++
      else if (st === 'in_progress') ov.inProgress++
      else if (st === 'not_started') ov.notStarted++
      if (st !== 'abandoned') pSum += progressMap[n.id] ?? 0
      if (n.planned_end && st !== 'completed' && st !== 'abandoned' && n.planned_end >= todayStr && n.planned_end <= in7) ov.dueSoon++
    }
    ov.avgProgress = live.length ? Math.round(pSum / Math.max(1, live.filter(n => statusMap[n.id] !== 'abandoned').length)) : 0

    /* 分类统计（含继承归属） */
    const catStats: Record<string, { total: number; completed: number; overdue: number; avg: number; nodes: GoalNode[] }> = {}
    const catOf = (n: GoalNode) => catMap[n.id] || '__none__'
    for (const n of live) {
      const k = catOf(n)
      if (!catStats[k]) catStats[k] = { total: 0, completed: 0, overdue: 0, avg: 0, nodes: [] }
      catStats[k].total++
      catStats[k].nodes.push(n)
      const st = statusMap[n.id]
      if (st === 'completed') catStats[k].completed++
      if (st === 'overdue') catStats[k].overdue++
    }
    for (const k of Object.keys(catStats)) {
      const g = catStats[k]
      g.avg = g.nodes.length ? Math.round(g.nodes.reduce((a, n) => a + (progressMap[n.id] ?? 0), 0) / g.nodes.length) : 0
    }

    return {
      live, forest, visibleForest, matchIds: match, periodMatchIds,
      progressMap, statusMap, catMap, ckProgress,
      periodRange: pr, overview: ov, catStats,
    }
  }, [nodes, checkins, checkinLogs, categories, period, anchorStr, selectedCategoryId])
}

/** 距今天的天数差文案 */
export function dueText(endDate: string | null): { text: string; tone: 'normal' | 'warn' | 'danger' } | null {
  if (!endDate) return null
  const d = differenceInCalendarDays(new Date(endDate), new Date())
  if (d < 0) return { text: `超时 ${-d} 天`, tone: 'danger' }
  if (d === 0) return { text: '今天截止', tone: 'warn' }
  if (d <= 3) return { text: `剩 ${d} 天`, tone: 'warn' }
  return { text: `剩 ${d} 天`, tone: 'normal' }
}
