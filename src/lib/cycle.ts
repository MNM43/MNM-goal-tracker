import {
  format, startOfWeek, getISOWeek, startOfYear, startOfMonth, startOfQuarter,
  endOfYear, endOfMonth, endOfQuarter, addDays,
} from 'date-fns'

export type CycleType = 'year' | 'quarter' | 'month' | 'week' | 'custom'

export const CYCLE_LABEL: Record<CycleType, string> = {
  year: '年度', quarter: '季度', month: '月度', week: '周度', custom: '自定义',
}

export function yearKey(d: Date) { return String(d.getFullYear()) }
export function quarterKey(d: Date) { return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}` }
export function monthKey(d: Date) { return format(d, 'yyyy-MM') }
export function weekKey(d: Date) {
  const ws = startOfWeek(d, { weekStartsOn: 1 })
  return `${ws.getFullYear()}-W${String(getISOWeek(ws)).padStart(2, '0')}`
}

export function cycleKeyOf(d: Date | string | null, type: CycleType | null): string | null {
  if (!d || !type || type === 'custom') return null
  const dt = typeof d === 'string' ? new Date(d) : d
  switch (type) {
    case 'year': return yearKey(dt)
    case 'quarter': return quarterKey(dt)
    case 'month': return monthKey(dt)
    case 'week': return weekKey(dt)
  }
  return null
}

export function getCycleRange(type: CycleType, anchor?: Date | null): { start: Date; end: Date; key: string } {
  const d = anchor || new Date()
  switch (type) {
    case 'year': return { start: startOfYear(d), end: endOfYear(d), key: yearKey(d) }
    case 'quarter': return { start: startOfQuarter(d), end: endOfQuarter(d), key: quarterKey(d) }
    case 'month': return { start: startOfMonth(d), end: endOfMonth(d), key: monthKey(d) }
    case 'week': {
      const s = startOfWeek(d, { weekStartsOn: 1 })
      return { start: s, end: addDays(s, 6), key: weekKey(d) }
    }
    default: return { start: d, end: d, key: '' }
  }
}

export function today(): string { return format(new Date(), 'yyyy-MM-dd') }