import { useMemo } from 'react'
import { useDerived } from '../lib/derive'
import { useStore } from '../store/useStore'
import { useUI, type QuickFilter } from '../store/useUI'
import { getPastel } from '../lib/pastel'
import { cn } from '../lib/cn'
import { IconPlus, IconSettings, IconLayers, IconTag } from './icons'
import type { DisplayStatus } from '../types'

const FILTERS: { key: QuickFilter; label: string; color: string }[] = [
  { key: 'all', label: '全部', color: 'var(--color-fg)' },
  { key: 'in_progress', label: '进行中', color: 'var(--color-brand)' },
  { key: 'overdue', label: '已超时', color: 'var(--color-danger)' },
  { key: 'not_started', label: '未开始', color: '#8E8E93' },
  { key: 'completed', label: '已完成', color: 'var(--color-success)' },
  { key: 'abandoned', label: '已放弃', color: '#8E8E93' },
]

export function Sidebar() {
  const { live, catMap, statusMap, periodMatchIds } = useDerived()
  const { categories, selectedCategoryId, setCategory } = useStore()
  const { quickFilter, setQuickFilter, openSettings, setView } = useUI()

  const liveCats = useMemo(() => categories.filter(c => !c.deleted_at), [categories])
  const roots = useMemo(() => liveCats.filter(c => !c.parent_id), [liveCats])
  const childrenOf = (id: string) => liveCats.filter(c => c.parent_id === id)

  /* 周期内的状态计数 */
  const statusCount = useMemo(() => {
    const m: Record<DisplayStatus, number> = { not_started: 0, in_progress: 0, completed: 0, abandoned: 0, overdue: 0 }
    for (const n of live) if (periodMatchIds.has(n.id)) m[statusMap[n.id]]++
    return m
  }, [live, periodMatchIds, statusMap])

  /* 周期内的分类计数（不受当前分类筛选影响） */
  const catCount = useMemo(() => {
    const m: Record<string, number> = {}
    for (const n of live) {
      if (!periodMatchIds.has(n.id)) continue
      const k = catMap[n.id] || '__none__'
      m[k] = (m[k] || 0) + 1
    }
    return m
  }, [live, periodMatchIds, catMap])

  const countOf = (k: QuickFilter) => {
    if (k === 'all') return periodMatchIds.size
    return statusCount[k as DisplayStatus] ?? 0
  }

  return (
    <aside className="flex w-[208px] shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="scroll-thin flex-1 overflow-y-auto px-2.5 py-3">
        {/* 快速筛选 */}
        <SectionTitle>筛选</SectionTitle>
        <div className="mb-4 space-y-0.5">
          {FILTERS.map(f => {
            const on = quickFilter === f.key
            return (
              <button
                key={f.key}
                onClick={() => setQuickFilter(f.key)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-[9px] px-2.5 py-[7px] text-left text-[12.5px] transition-colors',
                  on ? 'bg-white font-medium shadow-[0_1px_2px_rgba(17,17,20,0.05)]' : 'text-[var(--color-fg-soft)] hover:bg-white/60',
                )}
              >
                <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: f.color }} />
                <span className="flex-1 truncate">{f.label}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-[var(--color-fg-mute)]">{countOf(f.key)}</span>
              </button>
            )
          })}
        </div>

        {/* 分类 */}
        <div className="mb-1 flex items-center justify-between px-1">
          <SectionTitle className="mb-0">分类</SectionTitle>
          <button
            className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--color-fg-mute)] hover:bg-white hover:text-[var(--color-fg)]"
            title="新建分类"
            onClick={() => setView('tag')}
          >
            <IconPlus size={13} />
          </button>
        </div>
        <div className="space-y-0.5">
          <CatRow
            label="全部分类"
            emoji={<IconLayers size={13} />}
            count={periodMatchIds.size}
            active={!selectedCategoryId}
            color="#D8D5FA"
            onClick={() => setCategory(null)}
          />
          {roots.map(c => {
            const tone = getPastel(c.color)
            const kids = childrenOf(c.id)
            return (
              <div key={c.id}>
                <CatRow
                  label={c.name}
                  emoji={c.emoji}
                  count={catCount[c.id] || 0}
                  active={selectedCategoryId === c.id}
                  color={tone.bg}
                  border={tone.border}
                  onClick={() => setCategory(selectedCategoryId === c.id ? null : c.id)}
                />
                {kids.map(k => {
                  const kt = getPastel(k.color)
                  return (
                    <CatRow
                      key={k.id}
                      label={k.name}
                      emoji={k.emoji}
                      count={catCount[k.id] || 0}
                      active={selectedCategoryId === k.id}
                      color={kt.bg}
                      border={kt.border}
                      indent
                      onClick={() => setCategory(selectedCategoryId === k.id ? null : k.id)}
                    />
                  )
                })}
              </div>
            )
          })}
          {catCount['__none__'] > 0 && (
            <CatRow
              label="未分类"
              emoji={<IconTag size={12} />}
              count={catCount['__none__']}
              active={selectedCategoryId === '__none__'}
              color="#E5E5EA"
              border="#D0D0D8"
              onClick={() => setCategory(selectedCategoryId === '__none__' ? null : '__none__')}
            />
          )}
        </div>
      </div>

      {/* 底部 */}
      <div className="border-t border-[var(--color-border)] p-2.5">
        <button
          className="flex w-full items-center gap-2 rounded-[9px] px-2.5 py-2 text-left text-[12.5px] text-[var(--color-fg-soft)] hover:bg-white"
          onClick={() => openSettings(true)}
        >
          <IconSettings size={14} />
          数据与设置
        </button>
      </div>
    </aside>
  )
}

function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mb-1.5 px-2.5 text-[11px] font-medium text-[var(--color-fg-mute)]', className)}>{children}</div>
  )
}

function CatRow({
  label, emoji, count, active, color, border, indent, onClick,
}: {
  label: string
  emoji?: React.ReactNode
  count: number
  active: boolean
  color: string
  border?: string
  indent?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-[9px] py-[7px] pr-2.5 text-left text-[12.5px] transition-colors',
        indent ? 'pl-[30px]' : 'pl-2.5',
        active ? 'bg-white font-medium shadow-[0_1px_2px_rgba(17,17,20,0.05)]' : 'text-[var(--color-fg-soft)] hover:bg-white/60',
      )}
    >
      <span
        className="flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-[5px] text-[10px]"
        style={{ background: color, border: `1px solid ${border || 'transparent'}` }}
      >
        {emoji || ''}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="shrink-0 text-[11px] tabular-nums text-[var(--color-fg-mute)]">{count}</span>
    </button>
  )
}
