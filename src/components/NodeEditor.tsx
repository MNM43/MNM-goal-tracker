import { useEffect, useMemo, useState } from 'react'
import type { GoalNode, Status, ProgressSource, Priority } from '../types'
import { useStore } from '../store/useStore'
import { cn } from '../lib/cn'
import { getCycleRange, CYCLE_LABEL, cycleKeyOf, type CycleType } from '../lib/cycle'
import { getPastel } from '../lib/pastel'
import { descendantCount, subtreeIds, buildForest, flattenForest } from '../lib/tree'
import {
  Modal, Field, Segmented, EmojiPicker, ColorPicker, EmojiChip, Popover,
} from './ui'
import { IconChevronDown, IconTarget } from './icons'

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'not_started', label: '未开始' },
  { value: 'in_progress', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'abandoned', label: '已放弃' },
]

const CYCLE_OPTIONS: { value: CycleType; label: string }[] = (
  ['year', 'quarter', 'month', 'week', 'custom'] as CycleType[]
).map(v => ({ value: v, label: CYCLE_LABEL[v] }))

const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

interface Props {
  open: boolean
  node: GoalNode | null          // null = 新建
  parentId: string | null        // 新建时的父节点
  defaultCycle?: CycleType | null
  defaultStart?: string | null
  defaultEnd?: string | null
  onClose: () => void
  onSaved?: (id: string) => void
}

export function NodeEditor({
  open, node, parentId, defaultCycle, defaultStart, defaultEnd, onClose, onSaved,
}: Props) {
  const { nodes, categories, addNode, updateNode } = useStore()

  const [title, setTitle] = useState('')
  const [emoji, setEmoji] = useState<string | null>(null)
  const [nodeType, setNodeType] = useState<'goal' | 'task'>('goal')
  const [cycle, setCycle] = useState<CycleType>('quarter')
  const [anchor, setAnchor] = useState(fmt(new Date()))
  const [start, setStart] = useState<string>('')
  const [end, setEnd] = useState<string>('')
  const [status, setStatus] = useState<Status>('not_started')
  const [progress, setProgress] = useState(0)
  const [pSource, setPSource] = useState<ProgressSource>('manual')
  const [priority, setPriority] = useState<Priority>(null)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [color, setColor] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [touchedDates, setTouchedDates] = useState(false)
  const [dependsOn, setDependsOn] = useState<string[]>([])

  // 初始化
  useEffect(() => {
    if (!open) return
    setTouchedDates(false)
    if (node) {
      setTitle(node.title)
      setEmoji(node.emoji)
      setNodeType(node.node_type)
      setCycle((node.cycle_type as CycleType) || 'custom')
      setAnchor(node.planned_start || fmt(new Date()))
      setStart(node.planned_start || '')
      setEnd(node.planned_end || '')
      setStatus(node.status)
      setProgress(node.progress)
      setPSource(node.progress_source)
      setPriority(node.priority)
      setCategoryId(node.category_id)
      setColor(node.color)
      setNote(node.note)
      setDependsOn(node.depends_on || [])
    } else {
      const c = defaultCycle || (parentId ? null : 'quarter')
      setTitle('')
      setEmoji(null)
      setNodeType(parentId ? 'task' : 'goal')
      setCycle(c || 'custom')
      setAnchor(defaultStart || fmt(new Date()))
      // 继承父节点分类
      let inherited: string | null = null
      let cur = parentId ? nodes.find(n => n.id === parentId) : null
      let guard = 0
      while (cur && guard++ < 30) {
        if (cur.category_id) { inherited = cur.category_id; break }
        cur = cur.parent_id ? nodes.find(n => n.id === cur!.parent_id) || null : null
      }
      setCategoryId(inherited)
      setColor(null)
      setStatus('not_started')
      setProgress(0)
      setPSource('manual')
      setPriority(null)
      setNote('')
      setDependsOn([])
      if (defaultStart || defaultEnd) {
        setStart(defaultStart || '')
        setEnd(defaultEnd || '')
        setTouchedDates(true)
      } else if (c && c !== 'custom') {
        const r = getCycleRange(c, defaultStart ? new Date(defaultStart) : new Date())
        setStart(fmt(r.start)); setEnd(fmt(r.end))
      } else {
        setStart(''); setEnd('')
      }
    }
  }, [open, node?.id, parentId]) // eslint-disable-line react-hooks/exhaustive-deps

  // 周期变化时自动填充起止（用户手动改过日期则不再覆盖）
  useEffect(() => {
    if (!open || touchedDates || cycle === 'custom') return
    const r = getCycleRange(cycle, anchor ? new Date(anchor) : new Date())
    setStart(fmt(r.start))
    setEnd(fmt(r.end))
  }, [cycle, anchor, touchedDates, open])

  const parent = parentId ? nodes.find(n => n.id === parentId) : null
  const liveCategories = useMemo(() => categories.filter(c => !c.deleted_at), [categories])

  const canSave = title.trim().length > 0

  const pickCategoryLabel = (id: string | null) => {
    if (!id) return '未分类'
    const c = liveCategories.find(x => x.id === id)
    return c ? `${c.emoji ? c.emoji + ' ' : ''}${c.name}` : '未分类'
  }

  const save = () => {
    if (!canSave) return
    const cycleKey = cycle === 'custom' ? null : cycleKeyOf(start || anchor, cycle)
    const patch: Partial<GoalNode> = {
      title: title.trim(),
      emoji,
      node_type: nodeType,
      cycle_type: cycle,
      cycle_key: cycleKey,
      planned_start: start || null,
      planned_end: end || null,
      status,
      progress: pSource === 'manual' ? progress : progress,
      progress_source: pSource,
      priority,
      category_id: categoryId,
      color,
      note,
      depends_on: dependsOn,
    }

    if (node) {
      // 状态联动实际时间
      const prev = node
      if (status === 'completed' && !prev.actual_end) {
        patch.actual_end = fmt(new Date())
        if (!prev.actual_start) patch.actual_start = prev.actual_start || fmt(new Date())
      }
      if (status !== 'completed' && prev.actual_end) patch.actual_end = null
      if ((status === 'in_progress' || status === 'completed') && !prev.actual_start) {
        patch.actual_start = fmt(new Date())
      }
      if (status === 'not_started') { patch.actual_start = null; patch.actual_end = null }
      updateNode(node.id, patch)
      onSaved?.(node.id)
    } else {
      const created = addNode({
        ...patch,
        parent_id: parentId,
        actual_start: status === 'in_progress' ? fmt(new Date()) : null,
        actual_end: status === 'completed' ? fmt(new Date()) : null,
        sort_order: Date.now() % 100000,
      })
      onSaved?.(created.id)
    }
    onClose()
  }

  const depCandidates = useMemo(() => {
    const live = nodes.filter(n => !n.deleted_at)
    const forest = buildForest(live)
    const flat = flattenForest(forest, new Set(), true)
    const blocked = new Set(node ? subtreeIds(nodes, node.id) : [])
    return flat.filter(n => !blocked.has(n.id))
  }, [nodes, node?.id])

  const catGroups = useMemo(() => {
    const roots = liveCategories.filter(c => !c.parent_id)
    const childrenOf = (id: string) => liveCategories.filter(c => c.parent_id === id)
    return { roots, childrenOf }
  }, [liveCategories])

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={620}
      title={
        <div className="flex items-center gap-2">
          <IconTarget size={16} className="text-[var(--color-brand)]" />
          <span>{node ? '编辑' : parent ? `在「${parent.emoji ?? ''}${parent.title}」下新建` : '新建目标'}</span>
        </div>
      }
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>取消</button>
          <button className="btn-primary" disabled={!canSave} onClick={save}>
            {node ? '保存' : '创建'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* 标题 + 图标 */}
        <div className="flex gap-2">
          <Popover
            align="left"
            width={308}
            trigger={() => (
              <button className="mt-[1px] flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] border border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]">
                <EmojiChip emoji={emoji} color={color} />
              </button>
            )}
          >
            {() => (
              <EmojiPicker
                value={emoji}
                onChange={e => { setEmoji(e); }}
              />
            )}
          </Popover>
          <input
            autoFocus
            className="field flex-1"
            placeholder={parent ? '子任务名称，例如「完成竞品调研」' : '目标名称，例如「Q3 完成产品改版上线」'}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && canSave) save() }}
          />
        </div>

        {/* 类型 + 周期 */}
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3">
          <Field label="类型">
            <Segmented
              size="sm"
              value={nodeType}
              onChange={v => setNodeType(v)}
              options={[{ value: 'goal', label: '目标' }, { value: 'task', label: '任务' }]}
            />
          </Field>

          <Field label="周期">
            <Segmented
              size="sm"
              value={cycle}
              onChange={v => { setCycle(v); setTouchedDates(false) }}
              options={CYCLE_OPTIONS}
            />
          </Field>

          <Field label="计划开始">
            <input
              type="date"
              className="field w-[150px]"
              value={start}
              onChange={e => { setStart(e.target.value); setTouchedDates(true) }}
            />
          </Field>

          <Field label="计划完成">
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="field w-[150px]"
                value={end}
                onChange={e => { setEnd(e.target.value); setTouchedDates(true) }}
              />
              {cycle !== 'custom' && (
                <span className="text-[11.5px] text-[var(--color-fg-mute)]">
                  按所选周期自动推算
                </span>
              )}
            </div>
          </Field>
        </div>

        {/* 状态 + 进度来源 */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="状态">
            <Segmented size="sm" value={status} onChange={v => setStatus(v)} options={STATUS_OPTIONS} />
          </Field>
          <Field label="优先级" hint="可选">
            <Segmented
              size="sm"
              value={String(priority ?? 0)}
              onChange={v => setPriority(v === '0' ? null : (Number(v) as Priority))}
              options={[
                { value: '0', label: '无' },
                { value: '3', label: '高' },
                { value: '2', label: '中' },
                { value: '1', label: '低' },
              ]}
            />
          </Field>
        </div>

        <Field label="进度来源">
          <Segmented
            size="sm"
            value={pSource}
            onChange={v => setPSource(v)}
            options={[
              { value: 'manual', label: '手动填写' },
              { value: 'children', label: '由子级汇总' },
              { value: 'checkin', label: '由打卡驱动' },
            ]}
          />
        </Field>

        {node && (
          <Field label="前置依赖" hint="甘特图以紫色虚线连接，表示需先完成前置">
            {depCandidates.length === 0 ? (
              <div className="text-[12px] text-[var(--color-fg-mute)]">暂无其他节点可作为前置</div>
            ) : (
              <Popover
                align="left"
                width={264}
                trigger={() => (
                  <button className="field flex items-center justify-between text-left">
                    <span className={cn(!dependsOn.length && 'text-[var(--color-fg-mute)]')}>
                      {dependsOn.length ? `已选 ${dependsOn.length} 项前置` : '选择前置任务'}
                    </span>
                    <IconChevronDown size={14} className="rotate-90 text-[var(--color-fg-mute)]" />
                  </button>
                )}
              >
                {() => (
                  <div className="max-h-[280px] overflow-y-auto">
                    {depCandidates.map(c => {
                      const on = dependsOn.includes(c.id)
                      return (
                        <button
                          key={c.id}
                          className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-[var(--color-surface-2)]', on && 'bg-[var(--color-brand-soft)]')}
                          onClick={() => setDependsOn(on ? dependsOn.filter(x => x !== c.id) : [...dependsOn, c.id])}
                        >
                          <span
                            className="h-3.5 w-3.5 shrink-0 rounded-[4px] border"
                            style={{ borderColor: on ? 'var(--color-brand)' : 'var(--color-border-strong)', background: on ? 'var(--color-brand)' : 'transparent' }}
                          />
                          <span className="min-w-0 flex-1 truncate" style={{ paddingLeft: c.depth * 12 }}>
                            {c.emoji} {c.title}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </Popover>
            )}
          </Field>
        )}

        {pSource === 'manual' && (
          <Field label={`进度 ${progress}%`}>
            <div className="flex items-center gap-3">
              <input
                type="range" min={0} max={100} step={5}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--color-surface-2)] accent-[var(--color-brand)]"
                value={progress}
                onChange={e => setProgress(Number(e.target.value))}
              />
              <input
                type="number" min={0} max={100}
                className="field h-7 w-[64px] text-center"
                value={progress}
                onChange={e => setProgress(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
              />
            </div>
          </Field>
        )}

        {/* 分类 + 颜色 */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="分类" hint="子级自动继承">
            <Popover
              align="left"
              width={220}
              trigger={() => (
                <button className="field flex items-center justify-between text-left">
                  <span className={cn(!categoryId && 'text-[var(--color-fg-mute)]')}>
                    {pickCategoryLabel(categoryId)}
                  </span>
                  <IconChevronDown size={14} className="rotate-90 text-[var(--color-fg-mute)]" />
                </button>
              )}
            >
              {close => (
                <div className="max-h-[260px] overflow-y-auto">
                  <button
                    className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-[var(--color-surface-2)]', !categoryId && 'bg-[var(--color-brand-soft)]')}
                    onClick={() => { setCategoryId(null); close() }}
                  >
                    未分类
                  </button>
                  {catGroups.roots.map(c => {
                    const kids = catGroups.childrenOf(c.id)
                    return (
                      <div key={c.id}>
                        <button
                          className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-[var(--color-surface-2)]', categoryId === c.id && 'bg-[var(--color-brand-soft)]')}
                          onClick={() => { setCategoryId(c.id); close() }}
                        >
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: getPastel(c.color).bg, border: `1px solid ${getPastel(c.color).border}` }} />
                          {c.emoji} {c.name}
                        </button>
                        {kids.map(k => (
                          <button
                            key={k.id}
                            className={cn('flex w-full items-center gap-2 rounded-md py-1.5 pl-7 pr-2 text-left text-[13px] hover:bg-[var(--color-surface-2)]', categoryId === k.id && 'bg-[var(--color-brand-soft)]')}
                            onClick={() => { setCategoryId(k.id); close() }}
                          >
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: getPastel(k.color).bg, border: `1px solid ${getPastel(k.color).border}` }} />
                            {k.emoji} {k.name}
                          </button>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )}
            </Popover>
          </Field>

          <Field label="标记色" hint="留空则用分类色">
            <div className="flex items-center gap-2">
              <ColorPicker value={color} onChange={setColor} columns={10} />
              {color && <button className="btn-ghost h-7 shrink-0 px-2 text-[12px]" onClick={() => setColor(null)}>清除</button>}
            </div>
          </Field>
        </div>

        <Field label="备注">
          <textarea
            className="field min-h-[70px]"
            placeholder="衡量标准、卡点、相关链接…"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </Field>

        {node && descendantCount({ ...node, children: [] } as never) > 0 && pSource === 'manual' && (
          <div className="rounded-[10px] bg-[var(--color-surface)] px-3 py-2 text-[12px] text-[var(--color-fg-soft)]">
            该节点下有子级，建议把进度来源改为「由子级汇总」，父级进度会自动跟随子任务推进。
          </div>
        )}
      </div>
    </Modal>
  )
}
