import { useMemo, useState } from 'react'
import { useDerived, dueText } from '../lib/derive'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { getPastel } from '../lib/pastel'
import { CYCLE_LABEL } from '../lib/cycle'
import { periodProgress, periodRange, streakDays } from '../lib/checkin'
import { cn } from '../lib/cn'
import { Drawer, StatusChip, ProgressBar, Confirm, EmojiChip, CycleChip } from './ui'
import {
  IconEdit, IconTrash, IconPlus, IconCheck, IconCheckCircle, IconFlame, IconClock,
} from './icons'
import { toast } from './Toast'
import { format } from 'date-fns'
import type { GoalNode } from '../types'

export function NodeDrawer() {
  const { drawerId, openDrawer, openEditor } = useUI()
  const { live, progressMap, statusMap, catMap } = useDerived()
  const { nodes, categories, checkins, checkinLogs, updateNode, softDeleteNode, addNode, addCheckinLog, removeCheckinLog } = useStore()

  const node = useMemo(() => live.find(n => n.id === drawerId) || null, [live, drawerId])
  const [delOpen, setDelOpen] = useState(false)
  const [quickTitle, setQuickTitle] = useState('')

  const children = useMemo(() => node ? live.filter(n => n.parent_id === node.id) : [], [live, node])
  const myCheckins = useMemo(() => node ? checkins.filter(c => !c.deleted_at && c.node_id === node.id) : [], [checkins, node])
  const cat = useMemo(() => node ? categories.find(c => c.id === catMap[node.id]) : null, [node, categories, catMap])
  const tone = getPastel(node?.color || cat?.color)

  const breadcrumb = useMemo(() => {
    if (!node) return []
    const byId = new Map(nodes.map(n => [n.id, n]))
    const out: GoalNode[] = []
    let cur: GoalNode | undefined = node
    let guard = 0
    while (cur?.parent_id && guard++ < 30) {
      const p: GoalNode | undefined = byId.get(cur.parent_id)
      if (!p) break
      out.unshift(p)
      cur = p
    }
    return out
  }, [node, nodes])

  if (!node) return null

  const st = statusMap[node.id]
  const prog = progressMap[node.id] ?? 0
  const due = dueText(node.planned_end)
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const addChild = () => {
    if (!quickTitle.trim()) return
    addNode({
      title: quickTitle.trim(),
      parent_id: node.id,
      node_type: 'task',
      cycle_type: node.cycle_type,
      planned_start: node.planned_start,
      planned_end: node.planned_end,
      category_id: null,
      progress_source: 'manual',
    })
    setQuickTitle('')
    toast('已添加子任务')
  }

  const toggleDone = () => {
    if (st === 'completed') {
      updateNode(node.id, { status: 'in_progress', actual_end: null })
    } else {
      updateNode(node.id, {
        status: 'completed', progress: 100,
        actual_end: todayStr,
        actual_start: node.actual_start || todayStr,
      })
      toast('已完成 🎉')
    }
  }

  const toggleCheckinToday = (ckId: string) => {
    const exist = checkinLogs.find(l => l.checkin_id === ckId && l.record_date === todayStr)
    if (exist) removeCheckinLog(exist.id)
    else addCheckinLog(ckId, todayStr, false)
  }

  return (
    <Drawer
      open
      onClose={() => openDrawer(null)}
      title={
        <div className="flex min-w-0 items-center gap-2">
          <EmojiChip emoji={node.emoji} color={node.color || cat?.color} />
          <span className="truncate">{node.title}</span>
        </div>
      }
      footer={
        <div className="flex items-center gap-2">
          <button className="btn-primary flex-1" onClick={() => openEditor({ mode: 'edit', nodeId: node.id })}>
            <IconEdit size={14} /> 编辑
          </button>
          <button className="btn-outline" onClick={() => openEditor({ mode: 'new', parentId: node.id, defaultStart: node.planned_start, defaultEnd: node.planned_end })}>
            <IconPlus size={14} /> 子任务
          </button>
          <button className="btn-outline" onClick={() => setDelOpen(true)}>
            <IconTrash size={14} />
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* 面包屑 */}
        {breadcrumb.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 text-[11.5px] text-[var(--color-fg-mute)]">
            {breadcrumb.map((b, i) => (
              <span key={b.id} className="flex items-center gap-1">
                {i > 0 && <span className="opacity-50">/</span>}
                <button className="hover:text-[var(--color-fg)] hover:underline" onClick={() => openDrawer(b.id)}>
                  {b.emoji} {b.title}
                </button>
              </span>
            ))}
          </div>
        )}

        {/* 状态 + 进度 */}
        <div className="rounded-[14px] border border-[var(--color-border)] p-3.5">
          <div className="mb-2.5 flex items-center gap-2">
            <StatusChip status={st} />
            {node.cycle_type && <CycleChip label={CYCLE_LABEL[node.cycle_type as keyof typeof CYCLE_LABEL]} />}
            {cat && (
              <span className="chip" style={{ background: tone.bg, color: tone.fg }}>
                {cat.emoji} {cat.name}
              </span>
            )}
            <span className="flex-1" />
            <button className="btn-ghost h-7 px-2 text-[12px]" onClick={toggleDone}>
              {st === 'completed' ? '取消完成' : <><IconCheckCircle size={13} /> 标记完成</>}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1"><ProgressBar value={prog} height={7} /></div>
            <span className="text-[15px] font-semibold tabular-nums" style={{ color: tone.fg }}>{prog}%</span>
          </div>
          <div className="mt-2 text-[11.5px] text-[var(--color-fg-mute)]">
            进度来源：{node.progress_source === 'manual' ? '手动填写' : node.progress_source === 'children' ? '子级汇总' : '打卡驱动'}
            {due && st !== 'completed' && st !== 'abandoned' && (
              <span className={cn('ml-2', due.tone === 'danger' ? 'text-[var(--color-danger)]' : due.tone === 'warn' ? 'text-[var(--color-warn)]' : '')}>
                · {due.text}
              </span>
            )}
          </div>
        </div>

        {/* 元信息 */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Meta label="计划开始" value={node.planned_start || '未设置'} icon={<IconClock size={12} />} />
          <Meta label="计划完成" value={node.planned_end || '未设置'} />
          <Meta label="实际开始" value={node.actual_start || '—'} />
          <Meta label="实际完成" value={node.actual_end || '—'} highlight={!!node.actual_end} />
          <Meta label="周期" value={node.cycle_type ? CYCLE_LABEL[node.cycle_type as keyof typeof CYCLE_LABEL] : '自定义'} />
          <Meta label="优先级" value={node.priority === 3 ? '高' : node.priority === 2 ? '中' : node.priority === 1 ? '低' : '未设置'} />
        </div>

        {node.note && (
          <div>
            <div className="mb-1.5 text-[12px] font-medium text-[var(--color-fg-soft)]">备注</div>
            <div className="whitespace-pre-wrap rounded-[10px] bg-[var(--color-surface)] px-3 py-2.5 text-[12.5px] leading-relaxed text-[var(--color-fg-soft)]">
              {node.note}
            </div>
          </div>
        )}

        {/* 打卡 */}
        {myCheckins.length > 0 && (
          <div>
            <SectionLabel label="打卡" extra={`${myCheckins.length} 项`} />
            <div className="space-y-1.5">
              {myCheckins.map(c => {
                const pct = periodProgress(c, checkinLogs, periodRange(c, new Date()))
                const doneToday = checkinLogs.some(l => l.checkin_id === c.id && l.record_date === todayStr)
                const streak = streakDays(c.id, checkinLogs)
                return (
                  <div key={c.id} className="flex items-center gap-2 rounded-[10px] border border-[var(--color-border)] px-2.5 py-2">
                    <span className="text-[14px]">{c.emoji || '✓'}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px]">{c.title}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-[var(--color-fg-mute)]">
                        <span>{c.period_type === 'week' ? '每周' : '每月'} {c.target_count} 次</span>
                        <span style={{ color: pct >= 100 ? 'var(--color-success)' : undefined }}>本期 {pct}%</span>
                        {streak > 0 && <span style={{ color: 'var(--color-warn)' }}><IconFlame size={9} className="inline" /> {streak}天</span>}
                      </div>
                    </div>
                    <button
                      className="btn-outline h-7 shrink-0 px-2 text-[11.5px]"
                      style={doneToday ? { background: 'var(--color-success-soft)', color: 'var(--color-success)', borderColor: '#BFE6D2' } : undefined}
                      onClick={() => toggleCheckinToday(c.id)}
                    >
                      {doneToday ? <><IconCheck size={12} /> 今日</> : '打卡'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 子任务 */}
        <div>
          <SectionLabel label="子任务" extra={`${children.length} 项`} />
          <div className="space-y-1">
            {children.map(c => {
              const cst = statusMap[c.id]
              const cprog = progressMap[c.id] ?? 0
              const cdue = dueText(c.planned_end)
              return (
                <div key={c.id} className="group flex items-center gap-2 rounded-[10px] px-2 py-1.5 hover:bg-[var(--color-surface)]">
                  <button
                    className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] transition-transform hover:scale-110"
                    style={{ background: cst === 'completed' ? 'var(--color-success-soft)' : getPastel(c.color || cat?.color).bg }}
                    onClick={() => {
                      if (cst === 'completed') updateNode(c.id, { status: 'in_progress', actual_end: null })
                      else updateNode(c.id, { status: 'completed', progress: 100, actual_end: todayStr, actual_start: c.actual_start || todayStr })
                    }}
                  >
                    {cst === 'completed' ? <IconCheck size={11} style={{ color: 'var(--color-success)' }} /> : <span className="text-[11px]">{c.emoji || ''}</span>}
                  </button>
                  <span
                    className={cn('min-w-0 flex-1 cursor-pointer truncate text-[12.5px]', cst === 'completed' && 'text-[var(--color-fg-mute)] line-through', cst === 'overdue' && 'text-[var(--color-danger)]')}
                    onClick={() => openDrawer(c.id)}
                  >
                    {c.title}
                  </span>
                  {cdue && cst !== 'completed' && (
                    <span className={cn('shrink-0 text-[10.5px] tabular-nums', cdue.tone === 'danger' ? 'text-[var(--color-danger)]' : 'text-[var(--color-fg-mute)]')}>{cdue.text}</span>
                  )}
                  <div className="w-[48px] shrink-0"><ProgressBar value={cprog} height={4} /></div>
                </div>
              )
            })}
            {!children.length && (
              <div className="py-3 text-center text-[12px] text-[var(--color-fg-mute)]">
                还没有子任务。拆得越小，进度越容易自己动起来。
              </div>
            )}
          </div>

          <div className="mt-2 flex gap-1.5">
            <input
              className="field h-8 flex-1"
              placeholder="快速添加子任务，回车确认"
              value={quickTitle}
              onChange={e => setQuickTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addChild() }}
            />
            <button className="btn-outline h-8 shrink-0" onClick={addChild} disabled={!quickTitle.trim()}>
              <IconPlus size={14} />
            </button>
          </div>
        </div>
      </div>

      <Confirm
        open={delOpen}
        title="删除节点"
        danger
        confirmText="删除"
        message={`确定删除「${node.title}」吗？${children.length ? `其下 ${children.length} 个子任务会一并删除。` : ''}`}
        onCancel={() => setDelOpen(false)}
        onConfirm={() => {
          softDeleteNode(node.id)
          setDelOpen(false)
          openDrawer(null)
          toast('已删除', 'info')
        }}
      />
    </Drawer>
  )
}

function SectionLabel({ label, extra }: { label: string; extra?: string }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="text-[12.5px] font-semibold">{label}</span>
      {extra && <span className="text-[11px] text-[var(--color-fg-mute)]">{extra}</span>}
    </div>
  )
}

function Meta({ label, value, icon, highlight }: { label: string; value: string; icon?: React.ReactNode; highlight?: boolean }) {
  return (
    <div>
      <div className="mb-0.5 flex items-center gap-1 text-[11px] text-[var(--color-fg-mute)]">
        {icon}{label}
      </div>
      <div className={cn('text-[12.5px] tabular-nums', highlight ? 'font-medium text-[var(--color-success)]' : 'text-[var(--color-fg)]')}>
        {value}
      </div>
    </div>
  )
}
