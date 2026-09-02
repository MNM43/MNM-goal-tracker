import { useMemo, useRef } from 'react'
import { format } from 'date-fns'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { useDerived } from '../lib/derive'
import { getCycleRange, type CycleType } from '../lib/cycle'
import { Segmented } from './ui'
import {
  IconPlus, IconSearch, IconSparkles, IconSettings, IconChevronLeft, IconChevronRight,
  IconUpload, IconDownload,
} from './icons'
import { toast } from './Toast'
import type { Period } from '../types'

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'year', label: '年' },
  { value: 'quarter', label: '季' },
  { value: 'month', label: '月' },
  { value: 'week', label: '周' },
]

export function Topbar() {
  const { selectedPeriod, setPeriod } = useStore()
  const { periodAnchor, shiftPeriod, resetPeriod, search, setSearch, openEditor, setView, openSettings, sidebarOpen, toggleSidebar } = useUI()
  const { overview } = useDerived()
  const fileRef = useRef<HTMLInputElement>(null)

  const label = useMemo(() => {
    if (selectedPeriod === 'all') return `全部 ${overview.total} 项`
    const r = getCycleRange(selectedPeriod as CycleType, new Date(periodAnchor))
    if (selectedPeriod === 'year') return `${format(r.start, 'yyyy')} 年`
    if (selectedPeriod === 'quarter') return `${format(r.start, 'yyyy')} Q${Math.floor(r.start.getMonth() / 3) + 1}`
    if (selectedPeriod === 'month') return format(r.start, 'yyyy 年 M 月')
    return `${format(r.start, 'M/d')} – ${format(r.end, 'M/d')}`
  }, [selectedPeriod, periodAnchor, overview.total])

  const onExport = () => {
    const json = useStore.getState().exportAll()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `目标台备份-${format(new Date(), 'yyyyMMdd-HHmm')}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast('备份已导出')
  }

  const onImport = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const ok = useStore.getState().importAll(String(reader.result), 'merge')
      toast(ok ? '导入完成（按 id 合并）' : '文件格式不正确', ok ? 'success' : 'error')
    }
    reader.readAsText(file)
  }

  return (
    <header className="z-30 flex h-[52px] shrink-0 items-center gap-3 border-b border-[var(--color-border)] bg-white px-3">
      {/* 左侧 */}
      <button
        className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-fg-mute)] hover:bg-[var(--color-surface-2)]"
        onClick={toggleSidebar}
        title={sidebarOpen ? '收起侧边栏' : '展开侧边栏'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-[9px] text-[15px]" style={{ background: 'var(--color-brand-soft-2)' }}>
          🎯
        </span>
        <span className="text-[15px] font-semibold tracking-tight">目标台</span>
      </div>

      <div className="mx-1 h-5 w-px bg-[var(--color-border)]" />

      {/* 周期切换 */}
      <div className="flex items-center gap-1.5">
        <Segmented size="sm" value={selectedPeriod} onChange={setPeriod} options={PERIOD_OPTIONS} />
        {selectedPeriod !== 'all' && (
          <div className="flex items-center gap-0.5">
            <button className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-fg-mute)] hover:bg-[var(--color-surface-2)]" onClick={() => shiftPeriod(-1, selectedPeriod)}>
              <IconChevronLeft size={14} />
            </button>
            <button className="min-w-[86px] rounded-md px-1.5 py-1 text-center text-[12px] font-medium tabular-nums hover:bg-[var(--color-surface-2)]" onClick={resetPeriod} title="回到当前周期">
              {label}
            </button>
            <button className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-fg-mute)] hover:bg-[var(--color-surface-2)]" onClick={() => shiftPeriod(1, selectedPeriod)}>
              <IconChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      <span className="flex-1" />

      {/* 搜索 */}
      <div className="relative hidden md:block">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-fg-mute)]">
          <IconSearch size={14} />
        </span>
        <input
          className="h-8 w-[180px] rounded-[10px] border border-transparent bg-[var(--color-surface-2)] pl-8 pr-2.5 text-[12.5px] transition-all focus:w-[240px] focus:border-[var(--color-brand)] focus:bg-white"
          style={{ boxShadow: 'none' }}
          placeholder="搜索目标、备注…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* 操作 */}
      <button className="btn-primary h-8" onClick={() => openEditor({ mode: 'new', parentId: null, defaultCycle: selectedPeriod === 'all' ? 'quarter' : (selectedPeriod as CycleType) })}>
        <IconPlus size={15} /> 新建
      </button>

      <button className="btn-ghost h-8" onClick={() => setView('stats')} title="AI 复盘">
        <IconSparkles size={15} />
        {overview.overdue > 0 && (
          <span className="ml-0.5 rounded-full px-1.5 text-[10.5px] font-semibold" style={{ background: 'var(--color-danger-soft)', color: 'var(--color-danger)' }}>
            {overview.overdue}
          </span>
        )}
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = '' }}
      />
      <button className="btn-ghost h-8 px-2" onClick={() => fileRef.current?.click()} title="导入 JSON 备份">
        <IconUpload size={15} />
      </button>
      <button className="btn-ghost h-8 px-2" onClick={onExport} title="导出 JSON 备份">
        <IconDownload size={15} />
      </button>
      <button className="btn-ghost h-8 px-2" onClick={() => openSettings(true)} title="设置与数据管理">
        <IconSettings size={15} />
      </button>
    </header>
  )
}
