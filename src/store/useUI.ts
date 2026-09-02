import { create } from 'zustand'
import type { CycleType, Period } from '../types'

export type ViewKey = 'gantt' | 'outline' | 'board' | 'checkin' | 'tag' | 'stats'
export type QuickFilter = 'all' | 'in_progress' | 'overdue' | 'completed' | 'not_started' | 'abandoned'

export interface EditorState {
  mode: 'new' | 'edit'
  nodeId?: string | null
  parentId?: string | null
  defaultCycle?: CycleType | null
  defaultStart?: string | null
  defaultEnd?: string | null
}

interface UIState {
  view: ViewKey
  expanded: Record<string, boolean>
  search: string
  quickFilter: QuickFilter
  editor: EditorState | null
  drawerId: string | null
  sidebarOpen: boolean
  periodAnchor: string   // ISO date，用于周期前后翻页
  settingsOpen: boolean

  setView: (v: ViewKey) => void
  shiftPeriod: (dir: -1 | 1, unit: Period) => void
  resetPeriod: () => void
  openSettings: (v: boolean) => void
  toggleExpand: (id: string) => void
  setExpanded: (ids: string[], v: boolean) => void
  setSearch: (s: string) => void
  setQuickFilter: (f: QuickFilter) => void
  openEditor: (s: EditorState) => void
  closeEditor: () => void
  openDrawer: (id: string | null) => void
  toggleSidebar: () => void
}

export const useUI = create<UIState>((set) => ({
  view: 'gantt',
  expanded: {},
  search: '',
  quickFilter: 'all',
  editor: null,
  drawerId: null,
  sidebarOpen: true,
  periodAnchor: new Date().toISOString().slice(0, 10),
  settingsOpen: false,

  setView: v => set({ view: v }),
  shiftPeriod: (dir, unit) => set(s => {
    const d = new Date(s.periodAnchor)
    if (unit === 'year') d.setFullYear(d.getFullYear() + dir)
    else if (unit === 'quarter') d.setMonth(d.getMonth() + dir * 3)
    else if (unit === 'month') d.setMonth(d.getMonth() + dir)
    else if (unit === 'week') d.setDate(d.getDate() + dir * 7)
    return { periodAnchor: d.toISOString().slice(0, 10) }
  }),
  resetPeriod: () => set({ periodAnchor: new Date().toISOString().slice(0, 10) }),
  openSettings: v => set({ settingsOpen: v }),
  toggleExpand: id => set(s => ({ expanded: { ...s.expanded, [id]: !s.expanded[id] } })),
  setExpanded: (ids, v) => set(s => {
    const next = { ...s.expanded }
    for (const id of ids) next[id] = v
    return { expanded: next }
  }),
  setSearch: s => set({ search: s }),
  setQuickFilter: f => set({ quickFilter: f }),
  openEditor: s => set({ editor: s }),
  closeEditor: () => set({ editor: null }),
  openDrawer: id => set({ drawerId: id }),
  toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),
}))
