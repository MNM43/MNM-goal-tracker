import { useMemo, useState } from 'react'
import { useDerived, dueText } from '../lib/derive'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { flattenForest, subtreeIds, type TreeNode } from '../lib/tree'
import { getPastel } from '../lib/pastel'
import { CYCLE_LABEL } from '../lib/cycle'
import { cn } from '../lib/cn'
import { Empty, StatusChip, ProgressBar, Confirm } from '../components/ui'
import {
  IconPlus, IconEdit, IconTrash, IconChevronDown, IconChevronRight, IconList, IconCheck,
} from '../components/icons'
import { toast } from '../components/Toast'
import type { GoalNode } from '../types'

const ROW_H = 40

export function OutlineView() {
  const { visibleForest, progressMap, statusMap, live } = useDerived()
  const { updateNode, softDeleteNode, moveNode } = useStore()
  const { expanded, toggleExpand, setExpanded, openDrawer, openEditor, search, quickFilter } = useUI()
  const [delTarget, setDelTarget] = useState<GoalNode | null>(null)

  const rows = useMemo(() => {
    let forest = visibleForest
    if (search.trim() || quickFilter !== 'all') {
      const kw = search.trim().toLowerCase()
      const match = new Set<string>()
      const walk = (list: TreeNode[]) => {
        for (const n of list) {
          walk(n.children)
          const okKw = !kw || n.title.toLowerCase().includes(kw) || (n.note || '').toLowerCase().includes(kw)
          const okF = quickFilter === 'all' || statusMap[n.id] === quickFilter
          if ((okKw && okF) || n.children.some(c => match.has(c.id))) match.add(n.id)
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
      return flattenForest(forest, new Set(), true)
    }
    return flattenForest(forest, new Set(Object.keys(expanded).filter(k => expanded[k])))
  }, [visibleForest, expanded, search, quickFilter, statusMap])

  const allIds = useMemo(() => rows.filter(r => r.children.length).map(r => r.id), [rows])
  const allExpanded = allIds.length > 0 && allIds.every(id => expanded[id])

  /* 拖拽调层级 */
  const [drag, setDrag] = useState<{ id: string; overId: string; pos: 'before' | 'inside' } | null>(null)

  const handleDrop = (row: GoalNode) => {
    const d = drag
    setDrag(null)
    if (!d || d.id === row.id) return
    const all = useStore.getState().nodes
    // 防环：不能拖到自身子树里
    if (subtreeIds(all, d.id).includes(row.id)) {
      toast('不能把节点拖到它自己的子级下', 'error')
      return
    }
    if (d.pos === 'inside') {
      moveNode(d.id, { parentId: row.id, index: 99999 })
    } else {
      const sibs = all
        .filter(n => !n.deleted_at && (n.parent_id ?? null) === (row.parent_id ?? null) && n.id !== d.id)
        .sort((a, b) => a.sort_order - b.sort_order)
      let idx = sibs.findIndex(n => n.id === row.id)
      if (idx < 0) idx = sibs.length
      moveNode(d.id, { parentId: row.parent_id ?? null, index: idx })
    }
    toast('已调整层级', 'info')
  }

  const toggleDone = (n: GoalNode) => {
    const done = statusMap[n.id] === 'completed'
    if (done) {
      updateNode(n.id, { status: 'in_progress', actual_end: null })
      toast('已取消完成', 'info')
    } else {
      updateNode(n.id, {
        status: 'completed',
        progress: 100,
        actual_end: new Date().toISOString().slice(0, 10),
        actual_start: n.actual_start || new Date().toISOString().slice(0, 10),
      })
      toast('已完成 🎉')
    }
  }

  if (!live.length) {
    return (
      <Empty
        icon={<IconList size={22} />}
        title="还没有目标"
        desc="大纲视图适合逐层拆解：年度目标 → 季度里程碑 → 月度任务 → 周任务。"
        action={<button className="btn-primary" onClick={() => openEditor({ mode: 'new', parentId: null, defaultCycle: 'year' })}><IconPlus size={15} /> 新建年度目标</button>}
      />
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <button className="btn-ghost h-7 text-[12px]" onClick={() => setExpanded(allIds, !allExpanded)}>
            {allExpanded ? '全部折叠' : '全部展开'}
          </button>
          <span className="text-[12px] text-[var(--color-fg-mute)]">{rows.length} 个节点 · 拖拽行可调整层级与顺序</span>
        </div>
        <button className="btn-ghost h-7 text-[12px]" onClick={() => openEditor({ mode: 'new', parentId: null, defaultCycle: 'year' })}>
          <IconPlus size={13} /> 新建顶层目标
        </button>
      </div>

      <div className="scroll-thin flex-1 overflow-auto">
        <table className="w-full min-w-[880px] border-collapse">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="border-b border-[var(--color-border)] text-left text-[11.5px] text-[var(--color-fg-mute)]">
              <th className="px-4 py-2 font-medium" style={{ minWidth: 320 }}>目标 / 任务</th>
              <th className="w-[74px] px-2 py-2 font-medium">周期</th>
              <th className="w-[168px] px-2 py-2 font-medium">计划时间</th>
              <th className="w-[86px] px-2 py-2 font-medium">剩余</th>
              <th className="w-[84px] px-2 py-2 font-medium">状态</th>
              <th className="w-[150px] px-2 py-2 font-medium">进度</th>
              <th className="w-[104px] px-2 py-2 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const st = statusMap[row.id]
              const prog = progressMap[row.id] ?? 0
              const tone = getPastel(row.color)
              const due = dueText(row.planned_end)
              const hasKids = row.children.length > 0
              return (
                <tr
                  key={row.id}
                  className={cn(
                    'group border-b border-[var(--color-border)] hover:bg-[#FCFCFE]',
                    drag?.id === row.id && 'opacity-40',
                    drag?.overId === row.id && drag.pos === 'inside' && 'bg-[var(--color-brand-soft)]',
                    drag?.overId === row.id && drag.pos === 'before' && 'shadow-[inset_0_2px_0_var(--color-brand)]',
                  )}
                  style={{ height: ROW_H }}
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData('text/plain', row.id)
                    setDrag({ id: row.id, overId: '', pos: 'before' })
                  }}
                  onDragOver={e => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    const half = (e.clientY - rect.top) < rect.height / 2
                    setDrag(d => (d ? { id: d.id, overId: row.id, pos: half ? 'before' : 'inside' } : d))
                  }}
                  onDrop={e => { e.preventDefault(); handleDrop(row) }}
                  onDragEnd={() => setDrag(null)}
                >
                  <td className="px-4" style={{ paddingLeft: 16 + row.depth * 20 }}>
                    <div className="flex items-center gap-1.5">
                      {hasKids ? (
                        <button className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[var(--color-fg-mute)] hover:bg-[var(--color-surface-2)]" onClick={() => toggleExpand(row.id)}>
                          {expanded[row.id] ? <IconChevronDown size={13} /> : <IconChevronRight size={13} />}
                        </button>
                      ) : <span className="h-4 w-4 shrink-0" />}

                      <button
                        className={cn(
                          'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] text-[12px] leading-none transition-transform hover:scale-110',
                        )}
                        style={{ background: st === 'completed' ? 'var(--color-success-soft)' : tone.bg }}
                        onClick={() => toggleDone(row)}
                        title="标记完成 / 取消完成"
                      >
                        {st === 'completed' ? <IconCheck size={11} style={{ color: 'var(--color-success)' }} /> : (row.emoji || '')}
                      </button>

                      <span
                        className={cn(
                          'min-w-0 flex-1 cursor-pointer truncate text-[13px]',
                          row.depth === 0 && 'font-medium',
                          st === 'completed' && 'text-[var(--color-fg-mute)] line-through',
                          st === 'overdue' && 'text-[var(--color-danger)]',
                          st === 'abandoned' && 'text-[var(--color-fg-mute)] line-through',
                        )}
                        onClick={() => openDrawer(row.id)}
                      >
                        {row.title}
                      </span>

                      {hasKids && (
                        <span className="shrink-0 text-[10.5px] tabular-nums text-[var(--color-fg-mute)]">{row.children.length}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-2">
                    <span className="text-[11.5px] text-[var(--color-fg-soft)]">
                      {row.cycle_type ? CYCLE_LABEL[row.cycle_type as keyof typeof CYCLE_LABEL] : '—'}
                    </span>
                  </td>
                  <td className="px-2">
                    <span className="text-[11.5px] tabular-nums text-[var(--color-fg-soft)]">
                      {row.planned_start ? `${row.planned_start.slice(5)} → ${row.planned_end ? row.planned_end.slice(5) : '未定'}` : '—'}
                    </span>
                  </td>
                  <td className="px-2">
                    {st === 'completed' || st === 'abandoned' ? (
                      <span className="text-[11.5px] text-[var(--color-fg-mute)]">—</span>
                    ) : due ? (
                      <span className={cn('text-[11.5px] tabular-nums', due.tone === 'danger' ? 'text-[var(--color-danger)]' : due.tone === 'warn' ? 'text-[var(--color-warn)]' : 'text-[var(--color-fg-mute)]')}>
                        {due.text}
                      </span>
                    ) : <span className="text-[11.5px] text-[var(--color-fg-mute)]">—</span>}
                  </td>
                  <td className="px-2"><StatusChip status={st} small /></td>
                  <td className="px-2"><ProgressBar value={prog} /></td>
                  <td className="px-2">
                    <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-fg-mute)] hover:bg-[var(--color-surface-2)]" title="添加子任务" onClick={() => openEditor({ mode: 'new', parentId: row.id, defaultStart: row.planned_start, defaultEnd: row.planned_end })}>
                        <IconPlus size={14} />
                      </button>
                      <button className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-fg-mute)] hover:bg-[var(--color-surface-2)]" title="编辑" onClick={() => openEditor({ mode: 'edit', nodeId: row.id })}>
                        <IconEdit size={14} />
                      </button>
                      <button className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-fg-mute)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]" title="删除" onClick={() => setDelTarget(row)}>
                        <IconTrash size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="px-4 py-3">
          <button className="btn-ghost h-7 text-[12px]" onClick={() => openEditor({ mode: 'new', parentId: null, defaultCycle: 'year' })}>
            <IconPlus size={13} /> 新建顶层目标
          </button>
        </div>
      </div>

      <Confirm
        open={!!delTarget}
        title="删除节点"
        danger
        confirmText="删除"
        message={
          <>
            确定删除「{delTarget?.title}」吗？其下所有子任务会一并删除。
            <br />删除后可在「设置 → 回收站」中恢复。
          </>
        }
        onCancel={() => setDelTarget(null)}
        onConfirm={() => {
          if (delTarget) { softDeleteNode(delTarget.id); toast('已删除', 'info') }
          setDelTarget(null)
        }}
      />
    </div>
  )
}
