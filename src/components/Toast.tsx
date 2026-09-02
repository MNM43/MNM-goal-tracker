import { useEffect } from 'react'
import { create } from 'zustand'
import { IconAlert, IconCheck, IconClose } from './icons'

interface Toast {
  id: number
  text: string
  type: 'success' | 'error' | 'info'
}

interface ToastState {
  list: Toast[]
  push: (text: string, type?: Toast['type']) => void
  dismiss: (id: number) => void
}

let seq = 0
export const useToastStore = create<ToastState>((set) => ({
  list: [],
  push: (text, type = 'success') => {
    const id = ++seq
    set(s => ({ list: [...s.list, { id, text, type }] }))
    setTimeout(() => set(s => ({ list: s.list.filter(t => t.id !== id) })), 2600)
  },
  dismiss: id => set(s => ({ list: s.list.filter(t => t.id !== id) })),
}))

export const toast = (text: string, type?: Toast['type']) => useToastStore.getState().push(text, type)

export function Toaster() {
  const list = useToastStore(s => s.list)
  const dismiss = useToastStore(s => s.dismiss)

  useEffect(() => {}, [list])

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2">
      {list.map(t => (
        <div
          key={t.id}
          className="animate-fade-up pointer-events-auto flex items-center gap-2 rounded-[11px] px-3.5 py-2.5 text-[13px] font-medium text-white shadow-[var(--shadow-pop)]"
          style={{
            background: t.type === 'error' ? 'var(--color-danger)' : t.type === 'info' ? '#3A3A44' : 'var(--color-success)',
          }}
        >
          {t.type === 'error'
            ? <IconAlert size={15} />
            : <IconCheck size={15} />}
          <span>{t.text}</span>
          <button onClick={() => dismiss(t.id)} className="ml-1 opacity-70 hover:opacity-100">
            <IconClose size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}
