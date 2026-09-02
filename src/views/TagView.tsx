import { useMemo, useState } from 'react'
import { useDerived, dueText } from '../lib/derive'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { getPastel, PASTEL_KEYS } from '../lib/pastel'
import { cn } from '../lib/cn'
import { periodProgress, periodRange } from '../lib/checkin'
import { Modal, Field, EmojiPicker, ColorPicker, Popover, ProgressBar, StatusChip, Empty, Confirm } from '../components/ui'
import { IconTag, IconPlus, IconEdit, IconTrash, IconLayers } from '../components/icons'
import { toast } from '../components/Toast'
import type { Category } from '../types'

export function TagView() {
  const { live, catMap, statusMap, progressMap, catStats } = useDerived()
  const { categories, checkins, checkinLogs, addCategory, updateCategory, deleteCategory } = useStore()
  const { openDrawer, openEditor } = useUI()
  const [editing, setEditing] = useState<Category | null>(null)
  const [open, setOpen] = useState(false)
  const [delTarget, setDelTarget] = useState<Category | null>(null)

  const liveCats = useMemo(() => categories.filter(c => !c.deleted_at), [categories])
  const roots = useMemo(() => liveCats.filter(c => !c.parent_id), [liveCats])
  const childrenOf = (id: string) => liveCats.filter(c => c.parent_id === id)

  const nodesOf = (catId: string | null) => live.filter(n => (catMap[n.id] || null) === catId)
  const checkinsOf = (catId: string | null) => checkins.filter(c => !c.deleted_at && (c.category_id || null) === catId)

  const groups = useMemo(() => {
    const g: { key: string; cat: Category | null }[] = roots.map(c => ({ key: c.id, cat: c }))
    if (nodesOf(null).length || checkinsOf(null).length) g.push({ key: '__none__', cat: null })
    return g
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roots, live, catMap, checkins])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2.5">
        <div className="flex items-center gap-2 text-[12px] text-[var(--color-fg-mute)]">
          <IconLayers size={14} />
          按分类聚合。子级会自动继承父级分类，无需逐个打标签。
        </div>
        <button
          className="btn-primary h-8"
          onClick={() => { setEditing(null); setOpen(true) }}
        >
          <IconPlus size={15} /> 新建分类
        </button>
      </div>

      <div className="scroll-thin flex-1 overflow-auto p-5">
        {!groups.length ? (
          <Empty icon={<IconTag size={22} />} title="还没有分类" desc="分类是横向聚合维度，和父子目标的纵向拆解互补。" />
        ) : (
          <div className="mx-auto max-w-[1080px] space-y-4">
            {groups.map(g => {
              const catId = g.key === '__none__' ? null : g.key
              const tone = getPastel(g.cat?.color)
              const st = g.cat ? catStats[g.cat.id] : catStats['__none__']
              const list = nodesOf(catId)
              const cks = checkinsOf(catId)
              const kids = g.cat ? childrenOf(g.cat.id) : []

              return (
                <div key={g.key} className="card overflow-hidden">
                  {/* 头 */}
                  <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-3">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[16px]"
                      style={{ background: g.cat ? tone.bg : 'var(--color-surface-2)' }}
                    >
                      {g.cat?.emoji || '📁'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-semibold">{g.cat ? g.cat.name : '未分类'}</span>
                        <span className="text-[11.5px] text-[var(--color-fg-mute)]">
                          {st?.total ?? list.length} 项 · 均 {st?.avg ?? 0}%
                          {st?.overdue ? <span style={{ color: 'var(--color-danger)' }}> · 超时 {st.overdue}</span> : ''}
                        </span>
                      </div>
                      {kids.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {kids.map(k => {
                            const kt = getPastel(k.color)
                            return (
                              <span key={k.id} className="chip" style={{ background: kt.bg, color: kt.fg, height: 18, fontSize: 10.5 }}>
                                {k.emoji} {k.name} · {nodesOf(k.id).length}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    {st && <div className="w-[120px] shrink-0"><ProgressBar value={st.avg} color={g.cat ? tone.fg : '#C7C7D1'} /></div>}
                    {g.cat && (
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-fg-mute)] hover:bg-[var(--color-surface-2)]" onClick={() => { setEditing(g.cat); setOpen(true) }}>
                          <IconEdit size={14} />
                        </button>
                        <button className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-fg-mute)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]" onClick={() => setDelTarget(g.cat)}>
                          <IconTrash size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 内容 */}
                  <div className="grid grid-cols-[1fr_320px] divide-x divide-[var(--color-border)]">
                    <div className="p-3">
                      {!list.length ? (
                        <div className="py-6 text-center text-[12px] text-[var(--color-fg-mute)]">该分类下暂无目标</div>
                      ) : (
                        <div className="space-y-1">
                          {list.map(n => {
                            const due = dueText(n.planned_end)
                            const prog = progressMap[n.id] ?? 0
                            return (
                              <div
                                key={n.id}
                                className="flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 py-2 hover:bg-[var(--color-surface)]"
                                onClick={() => openDrawer(n.id)}
                              >
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] text-[12px]" style={{ background: n.color ? getPastel(n.color).bg : tone.bg }}>
                                  {n.emoji || ''}
                                </span>
                                <span className={cn('min-w-0 flex-1 truncate text-[13px]', statusMap[n.id] === 'completed' && 'text-[var(--color-fg-mute)] line-through')}>
                                  {n.title}
                                </span>
                                {due && statusMap[n.id] !== 'completed' && (
                                  <span className={cn('shrink-0 text-[11px] tabular-nums', due.tone === 'danger' ? 'text-[var(--color-danger)]' : 'text-[var(--color-fg-mute)]')}>{due.text}</span>
                                )}
                                <div className="w-[70px] shrink-0"><ProgressBar value={prog} height={4} /></div>
                                <StatusChip status={statusMap[n.id]} small />
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    <div className="p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[12px] font-medium">打卡项</span>
                        <span className="text-[11px] text-[var(--color-fg-mute)]">{cks.length}</span>
                      </div>
                      {!cks.length ? (
                        <div className="py-6 text-center text-[12px] text-[var(--color-fg-mute)]">无</div>
                      ) : (
                        <div className="space-y-1.5">
                          {cks.map(c => {
                            const pct = periodProgress(c, checkinLogs, periodRange(c, new Date()))
                            const ct = getPastel(c.color || g.cat?.color)
                            return (
                              <div key={c.id} className="flex items-center gap-2 rounded-[10px] px-2 py-1.5">
                                <span className="text-[13px]">{c.emoji || '✓'}</span>
                                <span className="min-w-0 flex-1 truncate text-[12.5px]">{c.title}</span>
                                <span className="shrink-0 text-[11px] tabular-nums" style={{ color: pct >= 100 ? 'var(--color-success)' : 'var(--color-fg-mute)' }}>{pct}%</span>
                                <div className="w-[46px] shrink-0"><ProgressBar value={pct} height={4} color={ct.fg} /></div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            <button
              className="btn-outline w-full py-2.5"
              onClick={() => openEditor({ mode: 'new', parentId: null, defaultCycle: 'quarter' })}
            >
              <IconPlus size={14} /> 新建目标并归入分类
            </button>
          </div>
        )}
      </div>

      <CategoryEditor
        open={open}
        cat={editing}
        parentOptions={roots.filter(c => c.id !== editing?.id)}
        onClose={() => setOpen(false)}
        onSaved={(isNew) => { toast(isNew ? '分类已创建' : '已保存'); setOpen(false) }}
        onCreate={(input) => addCategory(input)}
        onUpdate={(id, patch) => updateCategory(id, patch)}
      />

      <Confirm
        open={!!delTarget}
        title="删除分类"
        danger
        confirmText="删除"
        message={`删除「${delTarget?.name}」后，归到该分类下的目标会变为「未分类」，目标本身不会被删除。`}
        onCancel={() => setDelTarget(null)}
        onConfirm={() => {
          if (delTarget) {
            live.filter(n => catMap[n.id] === delTarget.id).forEach(n => useStore.getState().updateNode(n.id, { category_id: null }))
            deleteCategory(delTarget.id)
            toast('分类已删除', 'info')
          }
          setDelTarget(null)
        }}
      />
    </div>
  )
}

function CategoryEditor({
  open, cat, parentOptions, onClose, onSaved, onCreate, onUpdate,
}: {
  open: boolean
  cat: Category | null
  parentOptions: Category[]
  onClose: () => void
  onSaved: (isNew: boolean) => void
  onCreate: (input: Partial<Category>) => void
  onUpdate: (id: string, patch: Partial<Category>) => void
}) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState<string | null>(null)
  const [color, setColor] = useState<string>('pastel-blue-purple')
  const [parentId, setParentId] = useState<string>('')

  useMemo(() => {
    if (!open) return
    setName(cat?.name || '')
    setEmoji(cat?.emoji ?? null)
    setColor(cat?.color || PASTEL_KEYS[Math.floor(Math.random() * PASTEL_KEYS.length)])
    setParentId(cat?.parent_id || '')
  }, [open, cat?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    if (!name.trim()) return
    const payload = { name: name.trim(), emoji, color, parent_id: parentId || null }
    if (cat) onUpdate(cat.id, payload)
    else onCreate(payload)
    onSaved(!cat)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={480}
      title={cat ? '编辑分类' : '新建分类'}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>取消</button>
          <button className="btn-primary" disabled={!name.trim()} onClick={save}>{cat ? '保存' : '创建'}</button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <Popover
            align="left"
            width={308}
            trigger={() => (
              <button className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] border border-[var(--color-border-strong)] text-[16px] hover:bg-[var(--color-surface-2)]">
                {emoji || '📁'}
              </button>
            )}
          >
            <EmojiPicker value={emoji} onChange={setEmoji} />
          </Popover>
          <input
            autoFocus
            className="field flex-1"
            placeholder="分类名称，例如：成长 / 副业 / 家庭"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && name.trim()) save() }}
          />
        </div>

        <Field label="上级分类" hint="留空则为一级分类">
          <select className="field" value={parentId} onChange={e => setParentId(e.target.value)}>
            <option value="">（无，作为一级分类）</option>
            {parentOptions.map(c => <option key={c.id} value={c.id}>{c.emoji ? c.emoji + ' ' : ''}{c.name}</option>)}
          </select>
        </Field>

        <Field label="分类色">
          <ColorPicker value={color} onChange={setColor} columns={10} />
        </Field>
      </div>
    </Modal>
  )
}
