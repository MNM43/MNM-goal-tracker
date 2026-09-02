import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../lib/cn'
import { PASTEL_KEYS, PASTEL, getPastel } from '../lib/pastel'
import type { DisplayStatus } from '../types'
import { statusColor, statusLabel } from '../lib/progress'
import { IconCheck, IconClose } from './icons'

/* ---------------- Modal ---------------- */

export function Modal({
  open, onClose, title, children, footer, width = 560,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: number
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-[8vh]">
      <div className="fixed inset-0 bg-black/25 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="animate-pop-in relative w-full rounded-[18px] bg-white shadow-[var(--shadow-pop)]"
        style={{ maxWidth: width }}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3.5">
            <div className="text-[14.5px] font-semibold">{title}</div>
            <button onClick={onClose} className="rounded-md p-1 text-[var(--color-fg-mute)] hover:bg-[var(--color-surface-2)]">
              <IconClose size={16} />
            </button>
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

export function Confirm({
  open, title = '确认操作', message, confirmText = '确定', danger, onCancel, onConfirm,
}: {
  open: boolean
  title?: string
  message: ReactNode
  confirmText?: string
  danger?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      width={420}
      footer={
        <>
          <button className="btn-ghost" onClick={onCancel}>取消</button>
          <button
            className="btn-primary"
            style={danger ? { background: 'var(--color-danger)' } : undefined}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </>
      }
    >
      <div className="text-[13.5px] leading-relaxed text-[var(--color-fg-soft)]">{message}</div>
    </Modal>
  )
}

/* ---------------- Drawer ---------------- */

export function Drawer({
  open, onClose, title, children, footer, width = 460,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: number
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div
        className="animate-slide-in-right absolute inset-y-0 right-0 flex flex-col bg-white shadow-[var(--shadow-pop)]"
        style={{ width: Math.min(width, window.innerWidth) }}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3.5">
          <div className="text-[14.5px] font-semibold">{title}</div>
          <button onClick={onClose} className="rounded-md p-1 text-[var(--color-fg-mute)] hover:bg-[var(--color-surface-2)]">
            <IconClose size={16} />
          </button>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-[var(--color-border)] px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

/* ---------------- Segmented ---------------- */

export function Segmented<T extends string>({
  value, onChange, options, size = 'md',
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode; title?: string }[]
  size?: 'sm' | 'md'
}) {
  return (
    <div className="seg" style={size === 'sm' ? { padding: 2, borderRadius: 9 } : undefined}>
      {options.map(o => (
        <button
          key={o.value}
          title={o.title}
          className="seg-item"
          style={size === 'sm' ? { height: 24, padding: '0 9px', fontSize: 12 } : undefined}
          data-active={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ---------------- ProgressBar ---------------- */

export function ProgressBar({
  value, height = 5, color, bg, showLabel,
}: {
  value: number
  height?: number
  color?: string
  bg?: string
  showLabel?: boolean
}) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className="flex items-center gap-2">
      <div
        className="relative flex-1 overflow-hidden rounded-full"
        style={{ height, background: bg || 'var(--color-surface-2)' }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
          style={{ width: `${v}%`, background: color || 'var(--color-brand)' }}
        />
      </div>
      {showLabel && (
        <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-[var(--color-fg-mute)]">{v}%</span>
      )}
    </div>
  )
}

/* ---------------- Chips ---------------- */

export function StatusChip({ status, small }: { status: DisplayStatus; small?: boolean }) {
  const c = statusColor(status)
  return (
    <span
      className="chip"
      style={{ background: c.bg, color: c.fg, height: small ? 18 : 20, fontSize: small ? 10.5 : 11 }}
    >
      {statusLabel(status)}
    </span>
  )
}

export function CycleChip({ label }: { label: string }) {
  return (
    <span
      className="chip"
      style={{ background: 'var(--color-surface-2)', color: 'var(--color-fg-soft)' }}
    >
      {label}
    </span>
  )
}

export function EmojiChip({ emoji, color }: { emoji: string | null; color?: string | null }) {
  const p = getPastel(color)
  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] text-[13px] leading-none"
      style={{ background: emoji ? p.bg : 'var(--color-surface-2)' }}
    >
      {emoji || ''}
    </span>
  )
}

/* ---------------- Picker ---------------- */

const EMOJI_GROUPS: { name: string; list: string[] }[] = [
  { name: '目标', list: ['🎯', '🚀', '⭐', '🏆', '🥇', '💎', '🔥', '⚡', '🌱', '🧭'] },
  { name: '工作', list: ['💼', '📊', '📈', '📋', '🗂', '💻', '⌨️', '📎', '🏢', '🤝'] },
  { name: '学习', list: ['📚', '✏️', '🧠', '💡', '🔬', '🎓', '📝', '🗒', '🔍', '🖊'] },
  { name: '健康', list: ['🏃', '💪', '🧘', '🥗', '💧', '😴', '🏋️', '🚴', '🏊', '🩺'] },
  { name: '生活', list: ['🏠', '🍳', '🧹', '🌿', '🐱', '🐶', '☕', '🎵', '🎨', '📷'] },
  { name: '财务', list: ['💰', '💳', '🏦', '📉', '🧾', '🪙', '💵', '📦', '🛒', '🎁'] },
  { name: '其他', list: ['❤️', '✨', '🌈', '⏰', '📌', '🔔', '🎪', '🧩', '🪄', '🌙'] },
]

export function EmojiPicker({
  value, onChange,
}: {
  value: string | null
  onChange: (e: string | null) => void
}) {
  const [custom, setCustom] = useState('')
  return (
    <div className="space-y-2.5">
      {EMOJI_GROUPS.map(g => (
        <div key={g.name}>
          <div className="mb-1 text-[11px] font-medium text-[var(--color-fg-mute)]">{g.name}</div>
          <div className="grid grid-cols-10 gap-1">
            {g.list.map(e => (
              <button
                key={e}
                onClick={() => onChange(e === value ? null : e)}
                className={cn(
                  'flex h-7 items-center justify-center rounded-md text-[15px] transition-colors',
                  value === e ? 'bg-[var(--color-brand-soft-2)] ring-1 ring-[var(--color-brand)]' : 'hover:bg-[var(--color-surface-2)]',
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2 pt-1">
        <input
          className="field h-7 w-16 text-center text-[14px]"
          placeholder="自定义"
          value={custom}
          onChange={e => setCustom(e.target.value)}
        />
        <button
          className="btn-outline h-7 text-[12px]"
          onClick={() => { if (custom.trim()) { onChange(custom.trim().slice(0, 4)); setCustom('') } }}
        >
          使用
        </button>
        {value && (
          <button className="btn-ghost h-7 text-[12px]" onClick={() => onChange(null)}>清除</button>
        )}
      </div>
    </div>
  )
}

export function ColorPicker({
  value, onChange, columns = 10,
}: {
  value: string | null
  onChange: (c: string) => void
  columns?: number
}) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {PASTEL_KEYS.map(k => {
        const p = PASTEL[k]
        const on = value === k
        return (
          <button
            key={k}
            title={p.name}
            onClick={() => onChange(k)}
            className={cn(
              'relative h-7 rounded-md transition-all',
              on ? 'ring-2 ring-[var(--color-fg)] ring-offset-1' : 'hover:scale-105',
            )}
            style={{ background: p.bg, border: `1px solid ${p.border}` }}
          >
            {on && <span className="absolute inset-0 flex items-center justify-center" style={{ color: p.fg }}><IconCheck size={13} /></span>}
          </button>
        )
      })}
    </div>
  )
}

/* ---------------- Form bits ---------------- */

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline gap-2">
        <label className="text-[12px] font-medium text-[var(--color-fg-soft)]">{label}</label>
        {hint && <span className="text-[11px] text-[var(--color-fg-mute)]">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

export function Empty({
  icon, title, desc, action,
}: {
  icon?: ReactNode
  title: string
  desc?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon && <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-surface-2)] text-[var(--color-fg-mute)]">{icon}</div>}
      <div className="text-[14px] font-medium text-[var(--color-fg)]">{title}</div>
      {desc && <div className="mt-1 max-w-[320px] text-[12.5px] leading-relaxed text-[var(--color-fg-mute)]">{desc}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/* ---------------- Popover ---------------- */

export function Popover({
  trigger, children, align = 'right', width = 300,
}: {
  trigger: (open: boolean) => ReactNode
  children: ReactNode | ((close: () => void) => ReactNode)
  align?: 'left' | 'right'
  width?: number
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen(o => !o)}>{trigger(open)}</div>
      {open && (
        <div
          className="animate-pop-in absolute top-[calc(100%+6px)] z-40 rounded-[14px] border border-[var(--color-border)] bg-white p-3 shadow-[var(--shadow-pop)]"
          style={{ [align]: 0, width }}
        >
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  )
}
