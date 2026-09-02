import { useMemo, useState } from 'react'
import { format, addWeeks, addMonths, parseISO } from 'date-fns'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { getPastel } from '../lib/pastel'
import { cn } from '../lib/cn'
import {
  periodRange, daysOf, streakDays, countInPeriod, periodProgress,
} from '../lib/checkin'
import { Modal, Field, Segmented, EmojiPicker, ColorPicker, Empty, Popover, ProgressBar, Confirm } from '../components/ui'
import { IconPlus, IconFlame, IconCheck, IconClose, IconChevronLeft, IconChevronRight } from '../components/icons'
import { toast } from '../components/Toast'
import type { Checkin } from '../types'

const WEEKDAY = ['一', '二', '三', '四', '五', '六', '日']

export function CheckinView() {
  const { checkins, checkinLogs, nodes, categories } = useStore()
  const { openDrawer } = useUI()
  const [offset, setOffset] = useState(0)
  const [editing, setEditing] = useState<Checkin | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [delTarget, setDelTarget] = useState<Checkin | null>(null)

  const live = useMemo(() => checkins.filter(c => !c.deleted_at), [checkins])

  const stats = useMemo(() => {
    let todayDone = 0
    const t = format(new Date(), 'yyyy-MM-dd')
    for (const c of live) {
      if (checkinLogs.some(l => l.checkin_id === c.id && l.record_date === t && l.status === 'done')) todayDone++
    }
    const metTarget = live.filter(c => periodProgress(c, checkinLogs, periodRange(c, new Date())) >= 100).length
    return { todayDone, metTarget, total: live.length }
  }, [live, checkinLogs])

  const openNew = () => { setEditing(null); setEditorOpen(true) }
  const openEdit = (c: Checkin) => { setEditing(c); setEditorOpen(true) }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-fg-mute)] hover:bg-[var(--color-surface-2)]" onClick={() => setOffset(o => o - 1)}>
              <IconChevronLeft size={15} />
            </button>
            <button className="btn-ghost h-7 px-2 text-[12px]" onClick={() => setOffset(0)}>本期</button>
            <button className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-fg-mute)] hover:bg-[var(--color-surface-2)]" onClick={() => setOffset(o => Math.min(o + 1, 0))} disabled={offset >= 0}>
              <IconChevronRight size={15} style={{ opacity: offset >= 0 ? 0.3 : 1 }} />
            </button>
          </div>
          <span className="text-[12px] text-[var(--color-fg-mute)]">
            今日已打 {stats.todayDone}/{stats.total} · 本期达标 {stats.metTarget}/{stats.total}
          </span>
        </div>
        <button className="btn-primary h-8" onClick={openNew}><IconPlus size={15} /> 新建打卡</button>
      </div>

      <div className="scroll-thin flex-1 overflow-auto p-4">
        {!live.length ? (
          <Empty
            icon={<IconFlame size={22} />}
            title="还没有打卡项"
            desc="给需要持续投入的目标配一个打卡项，比如「每周健身 3 次」「每月读 2 本书」。打卡完成度会直接驱动对应目标的进度。"
            action={<button className="btn-primary" onClick={openNew}><IconPlus size={15} /> 新建打卡</button>}
          />
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
            {live.map(ck => (
              <CheckinCard
                key={ck.id}
                ck={ck}
                offset={offset}
                logs={checkinLogs}
                nodes={nodes}
                categories={categories}
                onEdit={() => openEdit(ck)}
                onDelete={() => setDelTarget(ck)}
                onOpenNode={() => ck.node_id && openDrawer(ck.node_id)}
              />
            ))}
          </div>
        )}
      </div>

      <CheckinEditor
        open={editorOpen}
        ck={editing}
        onClose={() => setEditorOpen(false)}
        onSaved={() => toast(editing ? '已保存' : '打卡项已创建')}
      />

      <Confirm
        open={!!delTarget}
        title="删除打卡项"
        danger
        confirmText="删除"
        message={`确定删除「${delTarget?.title}」吗？历史打卡记录会一并清除。`}
        onCancel={() => setDelTarget(null)}
        onConfirm={() => {
          const s = useStore.getState()
          s.checkinLogs.filter(l => l.checkin_id === delTarget!.id).forEach(l => s.removeCheckinLog(l.id))
          s.updateCheckin(delTarget!.id, { deleted_at: new Date().toISOString() })
          setDelTarget(null)
          toast('已删除', 'info')
        }}
      />
    </div>
  )
}

/* ---------------- 卡片 ---------------- */

function CheckinCard({
  ck, offset, logs, nodes, categories, onEdit, onDelete, onOpenNode,
}: {
  ck: Checkin
  offset: number
  logs: ReturnType<typeof useStore.getState>['checkinLogs']
  nodes: ReturnType<typeof useStore.getState>['nodes']
  categories: ReturnType<typeof useStore.getState>['categories']
  onEdit: () => void
  onDelete: () => void
  onOpenNode: () => void
}) {
  const { addCheckinLog, removeCheckinLog } = useStore()
  const tone = getPastel(ck.color)
  const cat = categories.find(c => c.id === ck.category_id)
  const ctone = ck.color ? tone : cat ? getPastel(cat.color) : getPastel('pastel-blue-purple')
  const node = ck.node_id ? nodes.find(n => n.id === ck.node_id) : null

  const base = new Date()
  const anchor = ck.period_type === 'week' ? addWeeks(base, offset) : addMonths(base, offset)
  const range = periodRange(ck, anchor)
  const done = countInPeriod(ck, logs, range)
  const pct = Math.min(100, Math.round((done / Math.max(1, ck.target_count)) * 100))
  const streak = streakDays(ck.id, logs)
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const logMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const l of logs) if (l.checkin_id === ck.id && l.status === 'done') m.set(l.record_date, l.id)
    return m
  }, [logs, ck.id])

  const toggle = (date: string) => {
    const id = logMap.get(date)
    if (id) { removeCheckinLog(id); return }
    addCheckinLog(ck.id, date, date !== todayStr)
  }

  /* 月视图按周分组 */
  const weeks = useMemo(() => {
    const days = daysOf(range)
    const rows: (string | null)[][] = []
    let row: (string | null)[] = []
    for (const d of days) {
      const wd = (parseISO(d).getDay() + 6) % 7
      if (row.length < wd) for (let i = row.length; i < wd; i++) row.push(null)
      row.push(d)
      if (row.length === 7) { rows.push(row); row = [] }
    }
    if (row.length) { while (row.length < 7) row.push(null); rows.push(row) }
    return rows
  }, [range])

  const isWeek = ck.period_type === 'week'

  return (
    <div className="card p-3.5">
      <div className="flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-[16px]" style={{ background: ctone.bg }}>
          {ck.emoji || '✓'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13.5px] font-medium">{ck.title}</span>
            {streak > 0 && (
              <span className="chip shrink-0" style={{ background: '#FDF0DD', color: '#D98324', height: 18, fontSize: 10.5 }}>
                <IconFlame size={10} /> {streak} 天
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-[var(--color-fg-mute)]">
            {cat && <span style={{ color: ctone.fg }}>{cat.emoji} {cat.name}</span>}
            {node && (
              <button className="truncate hover:underline" onClick={onOpenNode} title={node.title}>
                · {node.emoji} {node.title}
              </button>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-fg-mute)] hover:bg-[var(--color-surface-2)]" onClick={onEdit} title="编辑">
            <IconClose size={0} />
            <span className="text-[12px]">✎</span>
          </button>
          <button className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-fg-mute)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]" onClick={onDelete} title="删除">
            <IconClose size={13} />
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="text-[12px] font-medium tabular-nums" style={{ color: pct >= 100 ? 'var(--color-success)' : 'var(--color-fg)' }}>
          {done}/{ck.target_count}
        </span>
        <span className="text-[11.5px] text-[var(--color-fg-mute)]">
          {isWeek
            ? `${format(range.start, 'M/d')} – ${format(range.end, 'M/d')}`
            : `${format(range.start, 'yyyy年M月')}`}
          {offset === 0 ? '（本期）' : ''}
        </span>
        <div className="flex-1"><ProgressBar value={pct} height={5} color={pct >= 100 ? 'var(--color-success)' : ctone.fg} /></div>
        {pct >= 100 && <IconCheck size={15} style={{ color: 'var(--color-success)' }} />}
      </div>

      {/* 日格 */}
      <div className="mt-3">
        {isWeek ? (
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY.map((w, i) => {
              const d = daysOf(range)[i]
              return <DayCell key={d} date={d} label={w + ' ' + Number(d.slice(8))} tone={ctone} done={logMap.has(d)} onToggle={toggle} />
            })}
          </div>
        ) : (
          <div className="space-y-1">
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAY.map(w => <div key={w} className="text-center text-[10px] text-[var(--color-fg-mute)]">{w}</div>)}
            </div>
            {weeks.map((row, i) => (
              <div key={i} className="grid grid-cols-7 gap-1">
                {row.map((d, j) =>
                  d ? (
                    <DayCell key={d} date={d} label={String(Number(d.slice(8)))} tone={ctone} done={logMap.has(d)} onToggle={toggle} compact />
                  ) : <div key={j} />,
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          className="btn-primary h-8 flex-1"
          style={logMap.has(todayStr) ? { background: 'var(--color-surface-2)', color: 'var(--color-fg-soft)' } : { background: ctone.fg }}
          onClick={() => toggle(todayStr)}
        >
          {logMap.has(todayStr) ? '取消今日打卡' : '今日打卡'}
        </button>
        <span className="text-[10.5px] leading-tight text-[var(--color-fg-mute)]">
          点击空格子可补签<br />补签用虚线框标记
        </span>
      </div>
    </div>
  )
}

function DayCell({
  date, label, tone, done, onToggle, compact,
}: {
  date: string
  label: string
  tone: { bg: string; fg: string; border: string }
  done: boolean
  onToggle: (d: string) => void
  compact?: boolean
}) {
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const future = date > todayStr
  const isToday = date === todayStr

  return (
    <button
      disabled={future}
      onClick={() => onToggle(date)}
      className={cn(
        'flex items-center justify-center rounded-[7px] transition-all',
        compact ? 'h-[26px] text-[10.5px]' : 'h-[30px] text-[10px]',
        future ? 'cursor-not-allowed text-[var(--color-fg-mute)] opacity-40' : 'hover:scale-[1.04]',
      )}
      style={{
        background: done ? tone.fg : 'var(--color-surface-2)',
        color: done ? '#fff' : 'var(--color-fg-soft)',
        border: isToday && !done ? `1.5px solid ${tone.fg}` : done ? 'none' : '1px solid transparent',
        outline: done && !isToday ? `1px dashed ${tone.fg}` : undefined,
        outlineOffset: done && !isToday ? -3 : undefined,
      }}
      title={future ? '未来日期' : done ? (date < todayStr ? `${date}（补签）` : date) : date}
    >
      {done ? <IconCheck size={compact ? 12 : 13} /> : label}
    </button>
  )
}

/* ---------------- 编辑器 ---------------- */

function CheckinEditor({
  open, ck, onClose, onSaved,
}: {
  open: boolean
  ck: Checkin | null
  onClose: () => void
  onSaved: () => void
}) {
  const { addCheckin, updateCheckin, nodes, categories, updateNode } = useStore()
  const [title, setTitle] = useState('')
  const [emoji, setEmoji] = useState<string | null>(null)
  const [periodType, setPeriodType] = useState<'week' | 'month'>('week')
  const [target, setTarget] = useState(3)
  const [nodeId, setNodeId] = useState<string>('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [color, setColor] = useState<string | null>(null)
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const liveNodes = useMemo(() => nodes.filter(n => !n.deleted_at), [nodes])
  const liveCats = useMemo(() => categories.filter(c => !c.deleted_at), [categories])

  // 初始化
  useMemo(() => {
    if (!open) return
    setTitle(ck?.title || '')
    setEmoji(ck?.emoji ?? null)
    setPeriodType(ck?.period_type || 'week')
    setTarget(ck?.target_count ?? 3)
    setNodeId(ck?.node_id || '')
    setCategoryId(ck?.category_id || '')
    setColor(ck?.color ?? null)
    setStartDate(ck?.start_date || format(new Date(), 'yyyy-MM-dd'))
  }, [open, ck?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    if (!title.trim()) return
    const payload = {
      title: title.trim(), emoji, period_type: periodType, target_count: target,
      node_id: nodeId || '', category_id: categoryId || null, color, start_date: startDate,
    }
    if (ck) {
      updateCheckin(ck.id, payload)
    } else {
      const created = addCheckin(payload)
      // 若关联节点且节点进度来源为 manual，提示是否切换为打卡驱动
      if (nodeId) {
        const n = nodes.find(x => x.id === nodeId)
        if (n && n.progress_source === 'manual') updateNode(nodeId, { progress_source: 'checkin' })
        void created
      }
    }
    onSaved()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={540}
      title={ck ? '编辑打卡项' : '新建打卡项'}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>取消</button>
          <button className="btn-primary" disabled={!title.trim()} onClick={save}>{ck ? '保存' : '创建'}</button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <Popover
            align="left"
            width={308}
            trigger={() => (
              <button className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] border border-[var(--color-border-strong)] text-[17px] hover:bg-[var(--color-surface-2)]">
                {emoji || '✓'}
              </button>
            )}
          >
            <EmojiPicker value={emoji} onChange={setEmoji} />
          </Popover>
          <input
            autoFocus
            className="field flex-1"
            placeholder="例如：每周健身 3 次"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && title.trim()) save() }}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="打卡周期">
            <Segmented
              size="sm"
              value={periodType}
              onChange={v => setPeriodType(v)}
              options={[
                { value: 'week' as const, label: '每周' },
                { value: 'month' as const, label: '每月' },
              ]}
            />
          </Field>
          <Field label="每期目标次数">
            <div className="flex items-center gap-2">
              <input
                type="range" min={1} max={31}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--color-surface-2)] accent-[var(--color-brand)]"
                value={Math.min(target, 31)}
                onChange={e => setTarget(Number(e.target.value))}
              />
              <input
                type="number" min={1} max={200}
                className="field h-7 w-[64px] text-center"
                value={target}
                onChange={e => setTarget(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
          </Field>
        </div>

        <Field label="关联目标/任务" hint="打卡完成度会驱动它的进度">
          <select className="field" value={nodeId} onChange={e => setNodeId(e.target.value)}>
            <option value="">不关联</option>
            {liveNodes.map(n => (
              <option key={n.id} value={n.id}>
                {'　'.repeat(depthOf(liveNodes, n.id))}{n.emoji ? n.emoji + ' ' : ''}{n.title}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="分类">
            <select className="field" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
              <option value="">未分类</option>
              {liveCats.map(c => <option key={c.id} value={c.id}>{c.emoji ? c.emoji + ' ' : ''}{c.name}</option>)}
            </select>
          </Field>
          <Field label="开始日期">
            <input type="date" className="field" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </Field>
        </div>

        <Field label="标记色" hint="留空则用分类色">
          <ColorPicker value={color} onChange={setColor} columns={10} />
        </Field>

        <div className="rounded-[10px] bg-[var(--color-surface)] px-3 py-2 text-[12px] leading-relaxed text-[var(--color-fg-soft)]">
          关联后该目标的进度会自动切换为「由打卡驱动」：本期完成度 = 已打卡次数 ÷ 目标次数。
          往期未打的可以点击日期格子补签，补签会用虚线框标记，不影响连续天数统计口径。
        </div>
      </div>
    </Modal>
  )
}

function depthOf(nodes: { id: string; parent_id: string | null }[], id: string): number {
  const byId = new Map(nodes.map(n => [n.id, n]))
  let d = 0
  let cur = byId.get(id)
  let guard = 0
  while (cur?.parent_id && guard++ < 30) { d++; cur = byId.get(cur.parent_id) }
  return d
}
