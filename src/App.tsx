import { useEffect, useMemo } from 'react'
import { useStore } from './store/useStore'
import { useUI, type ViewKey } from './store/useUI'
import { Topbar } from './components/Topbar'
import { Sidebar } from './components/Sidebar'
import { NodeEditor } from './components/NodeEditor'
import { NodeDrawer } from './components/NodeDrawer'
import { SettingsModal } from './components/SettingsModal'
import { Toaster } from './components/Toast'
import { GanttView } from './views/GanttView'
import { OutlineView } from './views/OutlineView'
import { BoardView } from './views/BoardView'
import { CheckinView } from './views/CheckinView'
import { TagView } from './views/TagView'
import { StatsView } from './views/StatsView'
import { startAutoSync } from './lib/sync'
import {
  IconGantt, IconList, IconBoard, IconCheckCircle, IconTag, IconChart,
} from './components/icons'
import { cn } from './lib/cn'

const TABS: { key: ViewKey; label: string; icon: typeof IconGantt }[] = [
  { key: 'gantt', label: '甘特图', icon: IconGantt },
  { key: 'outline', label: '大纲', icon: IconList },
  { key: 'board', label: '看板', icon: IconBoard },
  { key: 'checkin', label: '打卡', icon: IconCheckCircle },
  { key: 'tag', label: '标签', icon: IconTag },
  { key: 'stats', label: '统计与复盘', icon: IconChart },
]

export default function App() {
  const { nodes } = useStore()
  const { view, setView, editor, closeEditor, sidebarOpen } = useUI()

  const editingNode = useMemo(
    () => (editor?.mode === 'edit' && editor.nodeId ? nodes.find(n => n.id === editor.nodeId) || null : null),
    [editor, nodes],
  )

  useEffect(() => { startAutoSync() }, [])

  return (
    <div className="flex h-full flex-col bg-white">
      <Topbar />

      <div className="flex min-h-0 flex-1">
        {sidebarOpen && <Sidebar />}

        <main className="flex min-w-0 flex-1 flex-col">
          {/* 视图切换 */}
          <div className="flex h-[42px] shrink-0 items-center gap-0.5 border-b border-[var(--color-border)] px-3">
            {TABS.map(t => {
              const Icon = t.icon
              const on = view === t.key
              return (
                <button
                  key={t.key}
                  onClick={() => setView(t.key)}
                  className={cn(
                    'relative flex h-full items-center gap-1.5 px-3 text-[13px] transition-colors',
                    on ? 'font-medium text-[var(--color-fg)]' : 'text-[var(--color-fg-soft)] hover:text-[var(--color-fg)]',
                  )}
                >
                  <Icon size={15} />
                  {t.label}
                  {on && (
                    <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-t-full" style={{ background: 'var(--color-brand)' }} />
                  )}
                </button>
              )
            })}
          </div>

          {/* 视图内容 */}
          <div className="min-h-0 flex-1">
            {view === 'gantt' && <GanttView />}
            {view === 'outline' && <OutlineView />}
            {view === 'board' && <BoardView />}
            {view === 'checkin' && <CheckinView />}
            {view === 'tag' && <TagView />}
            {view === 'stats' && <StatsView />}
          </div>
        </main>
      </div>

      <NodeEditor
        open={!!editor}
        node={editingNode}
        parentId={editor?.parentId ?? null}
        defaultCycle={editor?.defaultCycle ?? null}
        defaultStart={editor?.defaultStart ?? null}
        defaultEnd={editor?.defaultEnd ?? null}
        onClose={closeEditor}
      />

      <NodeDrawer />
      <SettingsModal />
      <Toaster />
    </div>
  )
}
