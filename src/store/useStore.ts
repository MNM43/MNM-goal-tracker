import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GoalNode, Category, Checkin, CheckinLog, Period } from '../types'
import { subtreeIds } from '../lib/tree'

interface State {
  nodes: GoalNode[]
  categories: Category[]
  checkins: Checkin[]
  checkinLogs: CheckinLog[]
  selectedPeriod: Period
  selectedCategoryId: string | null
}

interface Actions {
  addNode(input: Partial<GoalNode>): GoalNode
  updateNode(id: string, patch: Partial<GoalNode>): void
  moveNode(id: string, target: { parentId: string | null; index: number }): void
  softDeleteNode(id: string): void
  restoreNode(id: string): void
  addCategory(input: Partial<Category>): Category
  updateCategory(id: string, patch: Partial<Category>): void
  deleteCategory(id: string): void
  addCheckin(input: Partial<Checkin>): Checkin
  updateCheckin(id: string, patch: Partial<Checkin>): void
  addCheckinLog(checkin_id: string, date: string, is_makeup?: boolean): CheckinLog | null
  removeCheckinLog(id: string): void
  setPeriod(p: Period): void
  setCategory(id: string | null): void
  exportAll(): string
  importAll(json: string, mode: 'merge' | 'overwrite'): boolean
  syncMerge(data: { nodes?: GoalNode[]; categories?: Category[]; checkins?: Checkin[]; checkinLogs?: CheckinLog[] }): void
  clearAll(): void
}

export type Store = State & Actions

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2))
const now = () => new Date().toISOString()

const SEED_CATEGORIES: Category[] = [
  { id: 'cat-work', parent_id: null, name: '工作', color: 'pastel-blue-purple', emoji: null, sort_order: 0, deleted_at: null },
  { id: 'cat-health', parent_id: null, name: '健康', color: 'pastel-green', emoji: null, sort_order: 1, deleted_at: null },
  { id: 'cat-study', parent_id: null, name: '学习', color: 'pastel-yellow', emoji: null, sort_order: 2, deleted_at: null },
]

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      nodes: [],
      categories: SEED_CATEGORIES,
      checkins: [],
      checkinLogs: [],
      selectedPeriod: 'all',
      selectedCategoryId: null,

      addNode: (input) => {
        const n: GoalNode = {
          id: uid(),
          parent_id: input.parent_id ?? null,
          title: input.title || '未命名目标',
          node_type: input.node_type || 'goal',
          cycle_type: input.cycle_type ?? null,
          cycle_key: input.cycle_key ?? null,
          planned_start: input.planned_start ?? null,
          planned_end: input.planned_end ?? null,
          actual_start: input.actual_start ?? null,
          actual_end: input.actual_end ?? null,
          status: input.status || 'not_started',
          status_locked: input.status_locked ?? false,
          depends_on: input.depends_on ?? [],
          progress: input.progress ?? 0,
          progress_source: input.progress_source ?? 'manual',
          weight: input.weight ?? 1,
          priority: input.priority ?? null,
          emoji: input.emoji ?? null,
          note: input.note ?? '',
          category_id: input.category_id ?? null,
          color: input.color ?? null,
          sort_order: input.sort_order ?? get().nodes.length,
          created_at: now(),
          updated_at: now(),
          deleted_at: null,
        }
        set(s => ({ nodes: [...s.nodes, n] }))
        return n
      },

      updateNode: ( id, patch) => set(s => ({
        nodes: s.nodes.map(n => n.id === id ? { ...n, ...patch, updated_at: now() } : n),
      })),

      moveNode: (id, target) => {
        const all = get().nodes
        // 防环：不能把节点拖到它自己的子树下面
        if (target.parentId) {
          const sub = subtreeIds(all, id)
          if (sub.includes(target.parentId)) return
        }
        set(s => {
          const live = s.nodes.filter(n => !n.deleted_at)
          const siblings = live
            .filter(n => (n.parent_id ?? null) === (target.parentId ?? null) && n.id !== id)
            .sort((a, b) => a.sort_order - b.sort_order)
          const idx = Math.max(0, Math.min(target.index, siblings.length))
          const ordered = [...siblings.slice(0, idx), id, ...siblings.slice(idx)]
          const order = new Map(ordered.map((nid, i) => [nid, i]))
          return {
            nodes: s.nodes.map(n => {
              if (n.id === id) return { ...n, parent_id: target.parentId ?? null, updated_at: now() }
              if (order.has(n.id)) return { ...n, sort_order: order.get(n.id)!, updated_at: now() }
              return n
            }),
          }
        })
      },

      softDeleteNode: (id) => {
        const ts = now()
        const toDel = new Set<string>([id])
        let changed = true
        while (changed) {
          changed = false
          for (const n of get().nodes) {
            if (n.parent_id && toDel.has(n.parent_id) && !toDel.has(n.id) && !n.deleted_at) {
              toDel.add(n.id); changed = true
            }
          }
        }
        set(s => ({ nodes: s.nodes.map(n => toDel.has(n.id) ? { ...n, deleted_at: ts } : n) }))
      },

      restoreNode: (id) => set(s => ({
        nodes: s.nodes.map(n => n.id === id ? { ...n, deleted_at: null } : n),
      })),

      addCategory: (input) => {
        const c: Category = {
          id: uid(),
          parent_id: input.parent_id ?? null,
          name: input.name || '未命名分类',
          color: input.color || 'pastel-blue-purple',
          emoji: input.emoji ?? null,
          sort_order: input.sort_order ?? get().categories.length,
          deleted_at: null,
        }
        set(s => ({ categories: [...s.categories, c] }))
        return c
      },

      updateCategory: (id, patch) => set(s => ({
        categories: s.categories.map(c => c.id === id ? { ...c, ...patch } : c),
      })),

      deleteCategory: (id) => set(s => ({
        categories: s.categories.map(c => c.id === id ? { ...c, deleted_at: now() } : c),
      })),

      addCheckin: (input) => {
        const ck: Checkin = {
          id: uid(),
          node_id: input.node_id || '',
          title: input.title || '打卡',
          emoji: input.emoji ?? null,
          period_type: input.period_type || 'week',
          target_count: input.target_count ?? 3,
          anchor_date: input.anchor_date ?? null,
          start_date: input.start_date || new Date().toISOString().slice(0, 10),
          end_date: input.end_date ?? null,
          category_id: input.category_id ?? null,
          color: input.color ?? null,
          sort_order: input.sort_order ?? get().checkins.length,
          updated_at: now(),
          deleted_at: null,
        }
        set(s => ({ checkins: [...s.checkins, ck] }))
        return ck
      },

      updateCheckin: (id, patch) => set(s => ({
        checkins: s.checkins.map(c => c.id === id ? { ...c, ...patch, updated_at: now() } : c),
      })),

      addCheckinLog: (checkin_id, date, is_makeup = false) => {
        const exists = get().checkinLogs.find(l => l.checkin_id === checkin_id && l.record_date === date)
        if (exists) return null
        const l: CheckinLog = {
          id: uid(), checkin_id, record_date: date, status: 'done', is_makeup, note: '', created_at: now(),
        }
        set(s => ({ checkinLogs: [...s.checkinLogs, l] }))
        return l
      },

      removeCheckinLog: (id) => set(s => ({
        checkinLogs: s.checkinLogs.filter(l => l.id !== id),
      })),

      setPeriod: (p) => set({ selectedPeriod: p }),
      setCategory: (id) => set({ selectedCategoryId: id }),

      exportAll: () => {
        const s = get()
        return JSON.stringify({
          version: 1,
          exported_at: now(),
          nodes: s.nodes, categories: s.categories, checkins: s.checkins, checkinLogs: s.checkinLogs,
        }, null, 2)
      },

      importAll: (json, mode) => {
        try {
          const data = JSON.parse(json)
          if (mode === 'overwrite') {
            set({
              nodes: data.nodes || [],
              categories: data.categories || [],
              checkins: data.checkins || [],
              checkinLogs: data.checkinLogs || [],
            })
          } else {
            set(s => {
              const mergeById = <T extends { id: string }>(cur: T[], inc: T[]) => {
                const m = new Map(cur.map(x => [x.id, x]))
                for (const x of inc || []) if (!m.has(x.id)) m.set(x.id, x)
                return [...m.values()]
              }
              return {
                nodes: mergeById(s.nodes, data.nodes || []),
                categories: mergeById(s.categories, data.categories || []),
                checkins: mergeById(s.checkins, data.checkins || []),
                checkinLogs: mergeById(s.checkinLogs, data.checkinLogs || []),
              }
            })
          }
          return true
        } catch (e) {
          console.error('import failed', e)
          return false
        }
      },

      clearAll: () => set({ nodes: [], checkins: [], checkinLogs: [] }),

      syncMerge: (data) => set(s => {
        const newer = <T extends { id: string; updated_at?: string }>(a: T, b: T): T => {
          const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0
          const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0
          return tb >= ta ? b : a
        }
        const merge = <T extends { id: string; updated_at?: string }>(cur: T[], inc?: T[]): T[] => {
          const m = new Map(cur.map(x => [x.id, x]))
          for (const x of inc || []) {
            const ex = m.get(x.id)
            m.set(x.id, ex ? newer(ex, x) : x)
          }
          return [...m.values()]
        }
        return {
          nodes: merge(s.nodes, data.nodes),
          categories: merge(s.categories, data.categories),
          checkins: merge(s.checkins, data.checkins),
          checkinLogs: merge(s.checkinLogs, data.checkinLogs),
        }
      }),
    }),
    { name: 'goal-tracker-v1' },
  ),
)