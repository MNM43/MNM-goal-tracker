import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  eachDayOfInterval, eachMonthOfInterval, format, differenceInCalendarDays,
  addDays, startOfMonth, endOfMonth, isWeekend, startOfWeek,
} from 'date-fns'
import { useDerived } from '../lib/derive'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { getPastel } from '../lib/pastel'
import { cn } from '../lib/cn'
import { flattenForest, type TreeNode } from '../lib/tree'
import { Segmented, Empty } from '../components/ui'
import {
  IconChevronRight, IconChevronDown, IconPlus, IconGantt, IconClock, IconCalendar,
} from '../components/icons'

type Zoom = 'day' | 'week' | 'month' | 'quarter' | 'year'
const ZOOM: Record<Zoom, { label: string; dayW: number }> = {
  day: { label: '日', dayW: 30 },
  week: { label: '周', dayW: 12 },
  month: { label: '月', dayW: 4.4 },
  quarter: { label: '季', dayW: 1.7 },
  year: { label: '年', dayW: 0.75 },
}

const ROW_H = 38
const HEAD_H = 56
const NAME_W = 300

export function GanttView() {
  const { visibleForest, progressMap, statusMap, live } = useDerived()
  const { categories } = useStore()
  const { expanded, toggleExpand, setExpanded, openDrawer, openEditor, search, quickFilter } = useUI()
  const [zoom, setZoom] = useState<Zoom>('month')
  const scrollRef = useRef<HTMLDivElement>(null)

  /* 展开/折叠 */
  const rows = useMemo(() => {
    let forest = visibleForest
    if (search.trim() || quickFilter !== 'all') {
      const kw = search.trim().toLowerCase()
      const match = new Set<string>()
      const walk = (list: TreeNode[]) => {
        for (const n of list) {
          walk(n.children)
          const okKw = !kw || n.title.toLowerCase().includes(kw) || (n.note || '').toLowerCase().includes(kw)
          const st = statusMap[n.id]
          const okF = quickFilter === 'all' || st === quickFilter
          const childHit = n.children.some(c => match.has(c.id))
          if ((okKw && okF) || childHit) match.add(n.id)
        }
      }
      walk(forest)
      const prune = (list: TreeNode[]): TreeNode[] => {
        const out: TreeNode[] = []
        for (const n of list) {
          const kids = prune(n.children)
          if (match.has(n.id)) out.push({ ...n, children: kids })
        }
        return out
      }
      forest = prune(forest)
      return flattenForest(forest, new Set(Object.keys(expanded).filter(k => expanded[k])), true)
    }
    return flattenForest(forest, new Set(Object.keys(expanded).filter(k => expanded[k])))
  }, [visibleForest, expanded, search, quickFilter, statusMap])

  /* 时间范围 */
  const { rangeStart, rangeEnd } = useMemo(() => {
    const dates: Date[] = []
    for (const n of live) {
      if (n.planned_start) dates.push(new Date(n.planned_start))
      if (n.planned_end) dates.push(new Date(n.planned_end))
    }
    const now = new Date()
    dates.push(now)
    if (!dates.length) return { rangeStart: startOfMonth(now), rangeEnd: endOfMonth(now) }
    let min = new Date(Math.min(...dates.map(d => d.getTime())))
    let max = new Date(Math.max(...dates.map(d => d.getTime())))
    min = addDays(startOfMonth(min), -8)
    max = addDays(endOfMonth(max), 8)
    return { rangeStart: min, rangeEnd: max }
  }, [live])

  const dayW = ZOOM[zoom].dayW
  const totalDays = Math.max(1, differenceInCalendarDays(rangeEnd, rangeStart) + 1)
  const totalW = Math.round(totalDays * dayW)

  /* 表头刻度 */
  const header = useMemo(() => {
    const months = eachMonthOfInterval({ start: rangeStart, end: rangeEnd }).map(m => {
      const s = m < rangeStart ? rangeStart : m
      const e = endOfMonth(m) > rangeEnd ? rangeEnd : endOfMonth(m)
      const x = differenceInCalendarDays(s, rangeStart) * dayW
      const w = (differenceInCalendarDays(e, s) + 1) * dayW
      return { key: format(m, 'yyyy-MM'), label: `${m.getFullYear()}年${m.getMonth() + 1}月`, x, w }
    })

    let ticks: { x: number; label: string; sub?: string; weekend?: boolean; w: number }[] = []
    if (dayW >= 18) {
      ticks = eachDayOfInterval({ start: rangeStart, end: rangeEnd }).map(d => ({
        x: differenceInCalendarDays(d, rangeStart) * dayW,
        w: dayW,
        label: String(d.getDate()),
        sub: '日一二三四五六'[d.getDay()],
        weekend: isWeekend(d),
      }))
    } else if (dayW >= 5) {
      const weeks: Date[] = []
      let cur = startOfWeek(rangeStart, { weekStartsOn: 1 })
      while (cur <= rangeEnd) { weeks.push(cur); cur = addDays(cur, 7) }
      ticks = weeks.map(d => ({
        x: differenceInCalendarDays(d, rangeStart) * dayW,
        w: Math.min(7, differenceInCalendarDays(rangeEnd, d) + 1) * dayW,
        label: String(d.getDate()),
        sub: `${d.getMonth() + 1}月`,
      }))
    }
    return { months, ticks }
  }, [rangeStart, rangeEnd, dayW])

  /* 网格线（月） */
  const monthLines = useMemo(() => {
    return eachMonthOfInterval({ start: rangeStart, end: rangeEnd })
      .map(m => differenceInCalendarDays(m, rangeStart) * dayW)
      .filter(x => x > 0)
  }, [rangeStart, rangeEnd, dayW])

  const todayX = useMemo(() => {
    const t = new Date()
    if (t < rangeStart || t > rangeEnd) return null
    return differenceInCalendarDays(t, rangeStart) * dayW + dayW / 2
  }, [rangeStart, rangeEnd, dayW])

  const xOf = (d: string) => differenceInCalendarDays(new Date(d), rangeStart) * dayW

  /* 首次定位到今天 */
  useLayoutEffect(() => {
    if (!scrollRef.current || todayX == null) return
    scrollRef.current.scrollLeft = Math.max(0, todayX - 260)
  }, [zoom]) // eslint-disable-line react-hooks/exhaustive-deps

  const scrollToToday = () => {
    if (!scrollRef.current || todayX == null) return
    scrollRef.current.scrollTo({ left: Math.max(0, todayX - 260), behavior: 'smooth' })
  }

  const allIds = useMemo(() => rows.filter(r => r.children.length).map(r => r.id), [rows])
  const allExpanded = allIds.length > 0 && allIds.every(id => expanded[id])

  /* 依赖连线：基于节点 depends_on，从前置任务完成点指向后继任务起点 */
  const rowIndex = useMemo(() => {
    const m = new Map<string, number>()
    rows.forEach((r, i) => m.set(r.id, i))
    return m
  }, [rows])

  const depLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number; depId: string; succId: string }[] = []
    if (!rows.length) return lines
    const barEndX = (r: { planned_start: string | null; planned_end: string | null }) => {
      if (!r.planned_start || !r.planned_end) return 0
      return xOf(r.planned_end) + Math.max(6, (differenceInCalendarDays(new Date(r.planned_end), new Date(r.planned_start)) + 1) * dayW)
    }
    for (const r of rows) {
      const deps = r.depends_on || []
      if (!r.planned_start) continue
      const x2 = xOf(r.planned_start)
      const y2 = (rowIndex.get(r.id) ?? 0) * ROW_H + ROW_H / 2
      for (const depId of deps) {
        const pi = rowIndex.get(depId)
        if (pi == null) continue
        const pre = rows[pi]
        if (!pre.planned_start || !pre.planned_end) continue
        const x1 = barEndX(pre)
        const y1 = pi * ROW_H + ROW_H / 2
        lines.push({ x1, y1, x2, y2, depId, succId: r.id })
      }
    }
    return lines
  }, [rows, rowIndex, rangeStart, dayW])

  if (!live.length) {
    return (
      <Empty
        icon={<IconGantt size={22} />}
        title="还没有目标"
        desc="先创建一个年度或季度目标，再往下拆成可执行的任务，甘特图会自动铺开。"
        action={
          <button className="btn-primary" onClick={() => openEditor({ mode: 'new', parentId: null, defaultCycle: 'quarter' })}>
            <IconPlus size={15} /> 新建目标
          </button>
        }
      />
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* 工具条 */}
      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] text-[var(--color-fg-mute)]">缩放</span>
          <Segmented
            size="sm"
            value={zoom}
            onChange={setZoom}
            options={(Object.keys(ZOOM) as Zoom[]).map(k => ({ value: k, label: ZOOM[k].label }))}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <button className="btn-ghost h-7 text-[12px]" onClick={() => setExpanded(allIds, !allExpanded)}>
            {allExpanded ? '全部折叠' : '全部展开'}
          </button>
          <button className="btn-ghost h-7 text-[12px]" onClick={scrollToToday}>
            <IconCalendar size={13} /> 回到今天
          </button>
        </div>
      </div>

      {/* 图体 */}
      <div ref={scrollRef} className="scroll-thin relative flex-1 overflow-auto">
        <div className="relative" style={{ width: NAME_W + totalW, minHeight: '100%' }}>
          {/* 表头 */}
          <div className="sticky top-0 z-20 flex bg-white" style={{ height: HEAD_H }}>
            <div className="sticky left-0 z-30 flex shrink-0 items-end border-r border-b border-[var(--color-border)] bg-white px-4 pb-2" style={{ width: NAME_W }}>
              <span className="text-[11.5px] font-medium text-[var(--color-fg-mute)]">目标 / 任务</span>
            </div>
            <div className="relative shrink-0 border-b border-[var(--color-border)]" style={{ width: totalW }}>
              <div className="relative h-[26px]">
                {header.months.map(m => (
                  <div
                    key={m.key}
                    className="absolute top-0 flex h-[26px] items-center overflow-hidden border-r border-[var(--color-border)] px-2"
                    style={{ left: m.x, width: m.w }}
                  >
                    <span className="whitespace-nowrap text-[11.5px] font-medium text-[var(--color-fg-soft)]">{m.label}</span>
                  </div>
                ))}
              </div>
              <div className="relative h-[30px]">
                {header.ticks.map((t, i) => (
                  <div
                    key={i}
                    className={cn('absolute top-0 flex h-[30px] flex-col items-center justify-center leading-none', t.weekend && 'bg-[#FBFBFB]')}
                    style={{ left: t.x, width: t.w }}
                  >
                    <span className={cn('text-[11px] tabular-nums', t.weekend ? 'text-[var(--color-fg-mute)]' : 'text-[var(--color-fg-soft)]')}>{t.label}</span>
                    {t.sub && <span className="mt-[2px] text-[9.5px] text-[var(--color-fg-mute)]">{t.sub}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 主体 */}
          <div className="relative">
            {/* 网格背景 */}
            <div className="pointer-events-none absolute z-0" style={{ left: NAME_W, top: 0, bottom: 0, width: totalW }}>
              {monthLines.map((x, i) => (
                <div key={i} className="absolute top-0 bottom-0 w-px bg-[var(--color-border)]" style={{ left: x }} />
              ))}
              {todayX != null && (
                <div className="absolute top-0 bottom-0 w-[1.5px] bg-[var(--color-danger)] opacity-45" style={{ left: todayX }}>
                  <div className="absolute -left-[3px] top-0 h-1.5 w-1.5 rounded-full bg-[var(--color-danger)]" />
                </div>
              )}
            </div>

            {rows.map(row => {
              const p = getPastel(row.color)
              const cat = categories.find(c => c.id === row.category_id)
              const tone = row.color ? p : cat ? getPastel(cat.color) : getPastel('pastel-blue-purple')
              const prog = progressMap[row.id] ?? 0
              const st = statusMap[row.id]
              const hasKids = row.children.length > 0
              const isOpen = !!expanded[row.id]
              const hasDates = !!row.planned_start && !!row.planned_end
              const barX = hasDates ? xOf(row.planned_start!) : 0
              const barW = hasDates ? Math.max(6, (differenceInCalendarDays(new Date(row.planned_end!), new Date(row.planned_start!)) + 1) * dayW) : 0
              const dim = st === 'abandoned'

              return (
                <div key={row.id} className="group relative flex border-b border-[var(--color-border)] hover:bg-[#FCFCFE]" style={{ height: ROW_H }}>
                  {/* 名称列 */}
                  <div
                    className="sticky left-0 z-10 flex shrink-0 items-center gap-1.5 border-r border-[var(--color-border)] bg-white pr-3 group-hover:bg-[#FCFCFE]"
                    style={{ width: NAME_W, paddingLeft: 10 + row.depth * 16 }}
                  >
                    {hasKids ? (
                      <button
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[var(--color-fg-mute)] hover:bg-[var(--color-surface-2)]"
                        onClick={() => toggleExpand(row.id)}
                      >
                        {isOpen ? <IconChevronDown size={13} /> : <IconChevronRight size={13} />}
                      </button>
                    ) : (
                      <span className="h-4 w-4 shrink-0" />
                    )}

                    <span
                      className="flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-[5px] text-[11px] leading-none"
                      style={{ background: row.emoji ? tone.bg : 'var(--color-surface-2)' }}
                    >
                      {row.emoji || ''}
                    </span>

                    <span
                      className={cn(
                        'min-w-0 flex-1 cursor-pointer truncate text-[13px]',
                        row.depth === 0 ? 'font-medium' : '',
                        dim && 'text-[var(--color-fg-mute)] line-through',
                        st === 'overdue' && 'text-[var(--color-danger)]',
                      )}
                      onClick={() => openDrawer(row.id)}
                    >
                      {row.title}
                    </span>

                    <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-[var(--color-fg-mute)]">{prog}%</span>

                    <button
                      className="hidden h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--color-fg-mute)] hover:bg-[var(--color-surface-2)] group-hover:flex"
                      title="新建子任务"
                      onClick={() => openEditor({
                        mode: 'new',
                        parentId: row.id,
                        defaultStart: row.planned_start,
                        defaultEnd: row.planned_end,
                      })}
                    >
                      <IconPlus size={13} />
                    </button>
                  </div>

                  {/* 时间轴列 */}
                  <div className="relative shrink-0" style={{ width: totalW }}>
                    {hasDates ? (
                      <div
                        className={cn('absolute cursor-pointer', dim && 'opacity-45')}
                        style={{
                          left: barX,
                          width: barW,
                          top: hasKids ? (ROW_H - 14) / 2 : (ROW_H - 20) / 2,
                          height: hasKids ? 14 : 20,
                        }}
                        onClick={() => openDrawer(row.id)}
                        title={`${row.title}\n${row.planned_start} → ${row.planned_end}　进度 ${prog}%`}
                      >
                        {hasKids ? (
                          <>
                            {/* 汇总条 */}
                            <div className="absolute inset-0 rounded-[4px]" style={{ background: tone.bg, border: `1px solid ${tone.border}` }} />
                            <div
                              className="absolute inset-y-0 left-0 rounded-l-[4px]"
                              style={{ width: `${prog}%`, background: tone.fg, opacity: 0.32 }}
                            />
                            <div className="absolute -left-[1px] top-[-3px] h-[20px] w-[3px] rounded-sm" style={{ background: tone.fg }} />
                            <div className="absolute -right-[1px] top-[-3px] h-[20px] w-[3px] rounded-sm" style={{ background: tone.fg }} />
                          </>
                        ) : (
                          <>
                            <div className="absolute inset-0 rounded-[6px]" style={{ background: tone.bg, border: `1px solid ${tone.border}` }} />
                            <div
                              className="absolute inset-y-0 left-0 rounded-l-[6px] transition-all duration-300"
                              style={{ width: `${prog}%`, background: tone.fg, opacity: st === 'completed' ? 0.75 : 0.42 }}
                            />
                            {st === 'completed' && (
                              <span className="absolute inset-0 flex items-center justify-center text-[11px]" style={{ color: tone.fg }}>✓</span>
                            )}
                          </>
                        )}
                        {barW > 64 && (
                          <span
                            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 whitespace-nowrap text-[10.5px] leading-none"
                            style={{ color: tone.fg, opacity: 0.9 }}
                          >
                            {row.planned_end!.slice(5)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <button
                        className="absolute flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-[var(--color-fg-mute)] opacity-0 transition-opacity hover:bg-[var(--color-surface-2)] group-hover:opacity-100"
                        style={{ left: 12, top: (ROW_H - 20) / 2, height: 20 }}
                        onClick={() => openEditor({ mode: 'edit', nodeId: row.id })}
                      >
                        <IconClock size={12} /> 设置时间
                      </button>
                    )}
                  </div>
                </div>
              )
            })}

            {/* 依赖连线层 */}
            <svg
              className="pointer-events-none absolute z-[15]"
              style={{ left: NAME_W, top: 0, width: totalW, height: rows.length * ROW_H + 80 }}
            >
              <defs>
                <marker id="gt-dep-arrow" markerWidth="8" markerHeight="8" refX="5" refY="4" orient="auto">
                  <path d="M0,0 L8,4 L0,8 Z" fill="#9A97E0" />
                </marker>
              </defs>
              {depLines.map((l, i) => {
                const gap = 10
                const c1 = l.x1 + gap
                const c2 = l.x2 - gap
                const d = c2 >= c1
                  ? `M${l.x1},${l.y1} H${c1} V${l.y2} H${l.x2}`
                  : `M${l.x1},${l.y1} H${c1} V${l.y1 + (l.y2 > l.y1 ? 18 : -18)} H${(l.x1 + l.x2) / 2} V${l.y2 + (l.y2 > l.y1 ? -18 : 18)} H${c2} V${l.y2} H${l.x2}`
                return (
                  <g key={i}>
                    <path d={d} fill="none" stroke="#9A97E0" strokeWidth={1.5} strokeOpacity={0.85} strokeDasharray="4 3" markerEnd="url(#gt-dep-arrow)" />
                    <circle cx={l.x1} cy={l.y1} r={2.5} fill="#9A97E0" />
                    <circle cx={l.x2} cy={l.y2} r={2.5} fill="#9A97E0" />
                  </g>
                )
              })}
            </svg>

            <div className="flex items-center gap-2 px-4 py-3" style={{ paddingLeft: 14 }}>
              <button
                className="btn-ghost h-7 text-[12px]"
                onClick={() => openEditor({ mode: 'new', parentId: null, defaultCycle: 'quarter' })}
              >
                <IconPlus size={13} /> 新建顶层目标
              </button>
              <span className="text-[11.5px] text-[var(--color-fg-mute)]">
                共 {rows.length} 个节点 · 拖动横向滚动条查看时间轴 · 紫色虚线为任务依赖
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
