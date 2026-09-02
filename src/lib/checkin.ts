import type { Checkin, CheckinLog } from '../types'
import { format, startOfWeek, startOfMonth, addDays, addMonths, parseISO, differenceInCalendarDays } from 'date-fns'
import { today } from './cycle'

/** 某打卡项在指定日期所处周期的 [起, 止] */
export function periodRange(ck: Checkin, date: Date): { start: Date; end: Date; key: string } {
  if (ck.period_type === 'week') {
    const s = startOfWeek(date, { weekStartsOn: 1 })
    return { start: s, end: addDays(s, 6), key: format(s, 'yyyy-MM-dd') }
  }
  const s = startOfMonth(date)
  return { start: s, end: addDays(addMonths(s, 1), -1), key: format(s, 'yyyy-MM') }
}

/** 当前所处周期 */
export function currentPeriod(ck: Checkin): { start: Date; end: Date; key: string } {
  return periodRange(ck, new Date())
}

/** 该周期内的已完成次数 */
export function countInPeriod(ck: Checkin, logs: CheckinLog[], range: { start: Date; end: Date }): number {
  const s = format(range.start, 'yyyy-MM-dd')
  const e = format(range.end, 'yyyy-MM-dd')
  return logs.filter(l => l.checkin_id === ck.id && l.status === 'done' && l.record_date >= s && l.record_date <= e).length
}

/** 周期内每一天的打卡状态 */
export function dayMap(logs: CheckinLog[], ckId: string): Map<string, CheckinLog> {
  const m = new Map<string, CheckinLog>()
  for (const l of logs) if (l.checkin_id === ckId) m.set(l.record_date, l)
  return m
}

/** 周期完成度 0-100 */
export function periodProgress(ck: Checkin, logs: CheckinLog[], range: { start: Date; end: Date }): number {
  const done = countInPeriod(ck, logs, range)
  return Math.min(100, Math.round((done / Math.max(1, ck.target_count)) * 100))
}

/** 节点由打卡驱动的进度：取其名下所有打卡项当前周期完成度的平均 */
export function checkinDrivenProgress(
  checkins: Checkin[],
  logs: CheckinLog[],
): Record<string, number> {
  const out: Record<string, number> = {}
  const byNode = new Map<string, Checkin[]>()
  for (const c of checkins) {
    if (c.deleted_at) continue
    const arr = byNode.get(c.node_id) || []
    arr.push(c)
    byNode.set(c.node_id, arr)
  }
  for (const [nodeId, list] of byNode) {
    let sum = 0
    for (const ck of list) sum += periodProgress(ck, logs, currentPeriod(ck))
    out[nodeId] = Math.round(sum / list.length)
  }
  return out
}

/** 连续打卡天数（截至今天，今天没打则从昨天算起） */
export function streakDays(ckId: string, logs: CheckinLog[]): number {
  const set = new Set(logs.filter(l => l.checkin_id === ckId && l.status === 'done').map(l => l.record_date))
  let cursor = new Date()
  if (!set.has(format(cursor, 'yyyy-MM-dd'))) cursor = addDays(cursor, -1)
  let n = 0
  while (set.has(format(cursor, 'yyyy-MM-dd')) && n < 3650) {
    n++
    cursor = addDays(cursor, -1)
  }
  return n
}

/** 生成某周期内的日期列表 */
export function daysOf(range: { start: Date; end: Date }): string[] {
  const out: string[] = []
  const n = differenceInCalendarDays(range.end, range.start) + 1
  for (let i = 0; i < n; i++) out.push(format(addDays(range.start, i), 'yyyy-MM-dd'))
  return out
}

/** 最近 n 天的日期（倒序 → 正序） */
export function recentDays(n: number): string[] {
  const out: string[] = []
  const t = new Date()
  for (let i = n - 1; i >= 0; i--) out.push(format(addDays(t, -i), 'yyyy-MM-dd'))
  return out
}

export function isFuture(dateStr: string): boolean {
  return dateStr > today()
}

export function parseDay(s: string | null): Date | null {
  if (!s) return null
  try { return parseISO(s) } catch { return null }
}
