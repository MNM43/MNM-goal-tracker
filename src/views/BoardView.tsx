import { useMemo, useRef, useState } from 'react'
import { useDerived, dueText } from '../lib/derive'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { getPastel } from '../lib/pastel'
import { cn } from '../lib/cn'
import { Empty, ProgressBar } from '../components/ui'
import { IconPlus, IconBoard, IconClock, IconLayers, IconCheck, IconClose } from '../components/icons'
import type { GoalNode, Status } from '../types'

const COLUMNS: { key: Status; label: string; color: string; icon: typeof IconClock }[] = [
  { key: 'not_started', label: '未开始', color: '#8E8E93', icon: IconClock },
  { key: 'in_progress', label: '进行中', color: '#5C5CE0', icon: IconLayers },
  { key: 'completed', label: '已完成', color: '#2E9E63', icon: IconCheck },
  { key: 'abandoned', label: '已放弃', color: '#B0B0BA', icon: IconClose },
]

export function BoardView() {
  const { live, progressMap, statusMap, catMap } = useDerived()
  const { categories, updateNode } = useStore()
  const { openDrawer, openEditor, search, quickFilter } = useUI()

  const [dragOver, setDragOver] = useState<Status | null>(null)
  const dragIdRef = useRef<string | null>(null)

  const grouped = useMemo(() => {
    const g: Record<Status, GoalNode[]> = { not_started: [], in_progress: [], completed: [], abandoned: [] }
    const kw = search.trim().toLowerCase()
    for (const n of live) {
      if (kw && !n.title.toLowerCase().includes(kw) && !(n.note || '').toLowerCase().includes(kw)) continue
      if (quickFilter !== 'all' && statusMap[n.id] !== quickFilter) continue
      g[n.status].push(n)
    }
    for (const k of Object.keys(g) as Status[]) {
      g[k].sort((a, b) => (a.planned_end || '9999').localeCompare(b.planned_end || '9999'))
    }
    return g
  }, [live, statusMap, search, quickFilter])

  const changeStatus = (id: string, status: Status) => {
    const today = new Date().toISOString().slice(0, 10)
    if (status === 'completed') updateNode(id, { status, progress: 100, actual_end: today })
    else updateNode(id, { status, actual_end: null })
  }

  if (!live.length) {
    return (
      <Empty icon={<IconBoard size={22} />} title="还没有目标" desc="看板会按状态把目标自动分列，拖动卡片即可快速改状态。" />
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2.5">
        <span className="text-[12px] text-[var(--color-fg-mute)]">拖动卡片可改状态；「已超时」为实时计算，会以红标提示（不影响所在列）</span>
        <button className="btn-ghost h-7 text-[12px]" onClick={() => openEditor({ mode: 'new', parentId: null, defaultCycle: 'month' })}>
          <IconPlus size={13} /> 新建
        </button>
      </div>

      <div className="scroll-thin flex-1 overflow-auto p-4">
        <div className="flex gap-3" style={{ minWidth: 960 }}>
          {COLUMNS.map(col => {
            const list = grouped[col.key]
            const Icon = col.icon
            const over = dragOver === col.key
            return (
              <div
                key={col.key}
                className="flex w-[230px] shrink-0 flex-col"
                onDragOver={e => { e.preventDefault(); if (dragOver !== col.key) setDragOver(col.key) }}
                onDragLeave={e => { if (e.currentTarget === e.target) setDragOver(null) }}
                onDrop={e => {
                  e.preventDefault()
                  const id = e.dataTransfer.getData('text/plain')
                  if (id && dragIdRef.current !== id) changeStatus(id, col.key)
                  setDragOver(null)
                  dragIdRef.current = null
                }}
              >
                <div className="mb-2 flex items-center gap-1.5 px-1">
                  <span className="flex h-4 w-4 items-center justify-center" style={{ color: col.color }}><Icon size={13} /></span>
                  <span className="text-[12.5px] font-medium">{col.label}</span>
                  <span className="rounded-full bg-[var(--color-surface-2)] px-1.5 text-[10.5px] tabular-nums text-[var(--color-fg-mute)]">{list.length}</span>
                </div>

                <div
                  className="flex flex-col gap-2 rounded-[14px] bg-[var(--color-surface)] p-2 transition-colors"
                  style={{
                    minHeight: 120,
                    boxShadow: over ? 'inset 0 0 0 2px var(--color-brand-soft-2)' : undefined,
                    background: over ? 'var(--color-brand-soft)' : undefined,
                  }}
                >
                  {list.map(n => {
                    const cat = categories.find(c => c.id === catMap[n.id])
                    const tone = n.color ? getPastel(n.color) : cat ? getPastel(cat.color) : getPastel('pastel-blue-purple')
                    const prog = progressMap[n.id] ?? 0
                    const isOverdue = statusMap[n.id] === 'overdue'
                    const due = dueText(n.planned_end)
                    const childCount = live.filter(x => x.parent_id === n.id).length
                    return (
                      <div
                        key={n.id}
                        draggable
                        onDragStart={e => {
                          e.dataTransfer.setData('text/plain', n.id)
                          e.dataTransfer.effectAllowed = 'move'
                          dragIdRef.current = n.id
                        }}
                        onDragEnd={() => { setDragOver(null); dragIdRef.current = null }}
                        onClick={() => { if (!dragIdRef.current) openDrawer(n.id) }}
                        className={cn(
                          'card cursor-grab p-2.5 transition-shadow hover:shadow-[var(--shadow-soft)] active:cursor-grabbing',
                          dragIdRef.current === n.id && 'opacity-50',
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <span className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] text-[12px]" style={{ background: tone.bg }}>
                            {n.emoji || ''}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className={cn('text-[13px] leading-snug', n.status === 'completed' && 'text-[var(--color-fg-mute)] line-through')}>
                              {n.title}
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              {isOverdue && (
                                <span className="chip" style={{ background: 'var(--color-danger-soft)', color: 'var(--color-danger)', height: 18, fontSize: 10.5 }}>
                                  已超时
                                </span>
                              )}
                              {cat && (
                                <span className="chip" style={{ background: tone.bg, color: tone.fg, height: 18, fontSize: 10.5 }}>
                                  {cat.emoji} {cat.name}
                                </span>
                              )}
                              {due && n.status !== 'completed' && !isOverdue && (
                                <span className={cn('text-[10.5px] tabular-nums', due.tone === 'danger' ? 'text-[var(--color-danger)]' : due.tone === 'warn' ? 'text-[var(--color-warn)]' : 'text-[var(--color-fg-mute)]')}>
                                  {due.text}
                                </span>
                              )}
                              {childCount > 0 && (
                                <span className="text-[10.5px] text-[var(--color-fg-mute)]">· {childCount} 子项</span>
                              )}
                            </div>
                            <div className="mt-2"><ProgressBar value={prog} height={4} /></div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {!list.length && (
                    <div className="flex h-[80px] items-center justify-center text-[11.5px] text-[var(--color-fg-mute)]">
                      {over ? '释放以改为「' + col.label + '」' : '暂无'}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
