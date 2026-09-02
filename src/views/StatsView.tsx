import { useMemo, useState } from 'react'
import { format, addDays, startOfWeek, differenceInCalendarDays } from 'date-fns'
import { useDerived } from '../lib/derive'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { analyze, buildAIPrompt, type Finding } from '../lib/review'
import { getPastel } from '../lib/pastel'
import { getLLMConfig, callLLM } from '../lib/llm'
import { Markdown } from '../lib/markdown'
import { ProgressBar, Empty } from '../components/ui'
import { IconSparkles, IconCopy, IconAlert, IconCheck, IconClock, IconChart, IconRefresh } from '../components/icons'
import { toast } from '../components/Toast'

const LEVEL_STYLE = {
  danger: { bg: 'var(--color-danger-soft)', bd: '#F2C9C6', fg: 'var(--color-danger)' },
  warn: { bg: 'var(--color-warn-soft)', bd: '#F2DCB8', fg: 'var(--color-warn)' },
  info: { bg: 'var(--color-brand-soft)', bd: 'var(--color-brand-soft-2)', fg: 'var(--color-brand)' },
  good: { bg: 'var(--color-success-soft)', bd: '#BFE6D2', fg: 'var(--color-success)' },
} as const

export function StatsView() {
  const { live, progressMap, statusMap, catMap, overview, catStats } = useDerived()
  const { nodes, checkins, checkinLogs, categories } = useStore()
  const { openSettings } = useUI()
  const [findings, setFindings] = useState<Finding[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState('')
  const [genBusy, setGenBusy] = useState(false)

  /* 近 12 周完成趋势 */
  const trend = useMemo(() => {
    const weeks: { start: string; label: string; count: number }[] = []
    const thisMon = startOfWeek(new Date(), { weekStartsOn: 1 })
    for (let i = 11; i >= 0; i--) {
      const s = addDays(thisMon, -7 * i)
      weeks.push({ start: format(s, 'yyyy-MM-dd'), label: format(s, 'M/d'), count: 0 })
    }
    for (const n of live) {
      if (!n.actual_end) continue
      for (const w of weeks) {
        const d = differenceInCalendarDays(new Date(n.actual_end), new Date(w.start))
        if (d >= 0 && d < 7) { w.count++; break }
      }
    }
    return weeks
  }, [live])

  const maxTrend = Math.max(1, ...trend.map(t => t.count))

  /* 状态分布 */
  const dist = useMemo(() => {
    const d = { not_started: 0, in_progress: 0, overdue: 0, completed: 0, abandoned: 0 }
    for (const n of live) d[statusMap[n.id]]++
    return d
  }, [live, statusMap])

  const runReview = () => {
    setBusy(true)
    setTimeout(() => {
      const f = analyze({ nodes, checkins, checkinLogs, categories, progressMap, statusMap, catMap })
      setFindings(f)
      setBusy(false)
    }, 260)
  }

  const copyPrompt = async () => {
    const f = findings ?? analyze({ nodes, checkins, checkinLogs, categories, progressMap, statusMap, catMap })
    const text = buildAIPrompt({ nodes, checkins, checkinLogs, categories, progressMap, statusMap, catMap }, f)
    try {
      await navigator.clipboard.writeText(text)
      toast('复盘提示词已复制，粘贴给任意 AI 即可', 'success')
    } catch {
      toast('复制失败，请手动选择文本', 'error')
    }
  }

  /* 一键出报告：把本地诊断 + 完整数据交给 LLM 生成深度复盘 */
  const genReport = async () => {
    const cfg = getLLMConfig()
    if (!cfg) {
      toast('请先在「设置 → AI 复盘」配置接口', 'error')
      openSettings(true)
      return
    }
    const f = findings ?? analyze({ nodes, checkins, checkinLogs, categories, progressMap, statusMap, catMap })
    const prompt = buildAIPrompt({ nodes, checkins, checkinLogs, categories, progressMap, statusMap, catMap }, f)
    setGenBusy(true)
    setReport('')
    try {
      const text = await callLLM(prompt, cfg, t => setReport(prev => prev + t))
      if (!text && !report) setReport('（未收到内容，可能是跨域限制或密钥无效，请检查设置）')
    } catch (e: any) {
      toast(e?.message || '生成失败', 'error')
      if (!report) setReport(`⚠️ 生成失败：${e?.message || '未知错误'}`)
    } finally {
      setGenBusy(false)
    }
  }

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(report)
      toast('报告已复制', 'success')
    } catch {
      toast('复制失败，请手动选择', 'error')
    }
  }

  if (!live.length) {
    return <Empty icon={<IconChart size={22} />} title="还没有数据" desc="先录入一些目标和打卡，统计与 AI 复盘才有依据。" />
  }

  return (
    <div className="scroll-thin h-full overflow-auto">
      <div className="mx-auto max-w-[1080px] space-y-4 p-5">
        {/* 概览卡 */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="总节点" value={overview.total} sub={`${overview.dueSoon} 项 7 天内到期`} />
          <StatCard label="进行中" value={overview.inProgress} sub={`${overview.notStarted} 项未开始`} tone="var(--color-brand)" />
          <StatCard label="已超时" value={overview.overdue} sub={overview.overdue ? '需要立刻处理' : '节奏正常'} tone={overview.overdue ? 'var(--color-danger)' : 'var(--color-success)'} />
          <StatCard label="平均进度" value={`${overview.avgProgress}%`} sub={`已完 ${overview.completed} 项`} tone="var(--color-success)" />
        </div>

        <div className="grid grid-cols-[1fr_1fr] gap-3">
          {/* 状态分布 */}
          <div className="card p-4">
            <div className="mb-3 text-[13px] font-semibold">状态分布</div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
              {(['in_progress', 'completed', 'overdue', 'not_started', 'abandoned'] as const).map(k => {
                const pct = live.length ? (dist[k] / live.length) * 100 : 0
                if (!pct) return null
                const color = k === 'in_progress' ? 'var(--color-brand)' : k === 'completed' ? 'var(--color-success)' : k === 'overdue' ? 'var(--color-danger)' : k === 'not_started' ? '#C7C7D1' : '#E0E0E6'
                return <div key={k} style={{ width: `${pct}%`, background: color }} title={`${k} ${dist[k]}`} />
              })}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
              {([
                { k: 'in_progress', label: '进行中', c: 'var(--color-brand)' },
                { k: 'completed', label: '已完成', c: 'var(--color-success)' },
                { k: 'overdue', label: '已超时', c: 'var(--color-danger)' },
                { k: 'not_started', label: '未开始', c: '#C7C7D1' },
                { k: 'abandoned', label: '已放弃', c: '#E0E0E6' },
              ] as const).map(x => (
                <div key={x.k} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: x.c }} />
                  <span className="flex-1 text-[12px] text-[var(--color-fg-soft)]">{x.label}</span>
                  <span className="text-[12px] font-medium tabular-nums">{dist[x.k]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 12 周趋势 */}
          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[13px] font-semibold">近 12 周完成量</span>
              <span className="text-[11.5px] text-[var(--color-fg-mute)]">按实际完成日统计</span>
            </div>
            <div className="flex h-[104px] items-end gap-1.5">
              {trend.map(t => (
                <div key={t.start} className="group flex flex-1 flex-col items-center gap-1">
                  <div className="relative flex w-full flex-1 items-end justify-center">
                    <div
                      className="w-full rounded-t-[4px] transition-all"
                      style={{
                        height: `${Math.max(3, (t.count / maxTrend) * 100)}%`,
                        background: t.count ? 'var(--color-brand-soft-2)' : 'var(--color-surface-2)',
                      }}
                      title={`${t.start} 起当周完成 ${t.count} 项`}
                    />
                    {t.count > 0 && (
                      <span className="absolute -top-4 text-[10px] tabular-nums text-[var(--color-fg-soft)] opacity-0 group-hover:opacity-100">{t.count}</span>
                    )}
                  </div>
                  <span className="text-[9.5px] tabular-nums text-[var(--color-fg-mute)]">{t.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 分类分布 */}
        <div className="card p-4">
          <div className="mb-3 text-[13px] font-semibold">分类投入分布</div>
          <div className="space-y-2.5">
            {Object.entries(catStats)
              .sort((a, b) => b[1].total - a[1].total)
              .map(([k, v]) => {
                const cat = categories.find(c => c.id === k)
                const tone = getPastel(cat?.color)
                const name = cat ? cat.name : '未分类'
                const emoji = cat?.emoji
                return (
                  <div key={k} className="flex items-center gap-3">
                    <span className="w-[92px] shrink-0 truncate text-[12.5px]" style={{ color: cat ? tone.fg : 'var(--color-fg-soft)' }}>
                      {emoji} {name}
                    </span>
                    <div className="flex-1"><ProgressBar value={v.avg} color={cat ? tone.fg : '#C7C7D1'} /></div>
                    <span className="w-[112px] shrink-0 text-right text-[11.5px] tabular-nums text-[var(--color-fg-mute)]">
                      {v.total} 项 · 均 {v.avg}%
                      {v.overdue > 0 && <span style={{ color: 'var(--color-danger)' }}> · 超{v.overdue}</span>}
                    </span>
                  </div>
                )
              })}
          </div>
        </div>

        {/* AI 复盘 */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
            <div className="flex items-center gap-2">
              <IconSparkles size={16} style={{ color: 'var(--color-brand)' }} />
              <span className="text-[13.5px] font-semibold">AI 复盘</span>
              <span className="text-[11.5px] text-[var(--color-fg-mute)]">本地规则诊断 + 一键生成可粘贴给 AI 的完整提示词</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-ghost h-8 text-[12px]" onClick={runReview} disabled={busy}>
                <IconRefresh size={13} /> {findings ? '重新诊断' : '开始诊断'}
              </button>
              <button className="btn-primary h-8" onClick={genReport} disabled={genBusy}>
                <IconSparkles size={13} /> {genBusy ? '生成中…' : '一键出报告'}
              </button>
              <button className="btn-outline h-8 text-[12px]" onClick={copyPrompt}>
                <IconCopy size={13} /> 复制提示词
              </button>
            </div>
          </div>

          {!findings ? (
            <div className="px-4 py-10 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
                <IconSparkles size={20} />
              </div>
              <div className="text-[13.5px] font-medium">先跑一次本地诊断</div>
              <div className="mx-auto mt-1 max-w-[420px] text-[12.5px] leading-relaxed text-[var(--color-fg-mute)]">
                会基于超期、进度滞后、层级过深、打卡断签等 12 条规则给出体检结果；
                也可以直接复制提示词，把完整数据快照交给 ChatGPT / Claude 做深度复盘。
              </div>
              <button className="btn-primary mt-4" onClick={runReview} disabled={busy}>
                {busy ? '分析中…' : '开始诊断'}
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {findings.length === 0 && (
                <div className="px-4 py-8 text-center text-[13px] text-[var(--color-fg-mute)]">没有发现明显问题，保持当前节奏。</div>
              )}
              {findings.map((f, i) => {
                const s = LEVEL_STYLE[f.level]
                return (
                  <div key={i} className="px-4 py-3.5">
                    <div className="flex gap-3">
                      <span className="mt-[2px] flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px]" style={{ background: s.bg, color: s.fg, border: `1px solid ${s.bd}` }}>
                        {f.level === 'good' ? <IconCheck size={13} /> : f.level === 'info' ? <IconClock size={13} /> : <IconAlert size={13} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-medium">{f.title}</div>
                        <div className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-fg-soft)]">{f.detail}</div>
                        {f.items && f.items.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {f.items.map((it, j) => (
                              <span
                                key={j}
                                className="inline-flex items-center gap-1.5 rounded-[7px] px-2 py-1 text-[11.5px]"
                                style={{ background: 'var(--color-surface-2)', color: 'var(--color-fg-soft)' }}
                              >
                                <span className="max-w-[240px] truncate">{it.label}</span>
                                {it.meta && <span className="shrink-0 tabular-nums text-[var(--color-fg-mute)]">{it.meta}</span>}
                              </span>
                            ))}
                          </div>
                        )}
                        {f.action && (
                          <div className="mt-2 rounded-[8px] px-2.5 py-1.5 text-[12px]" style={{ background: s.bg, color: s.fg, border: `1px solid ${s.bd}` }}>
                            建议：{f.action}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div className="flex items-center justify-between bg-[var(--color-surface)] px-4 py-3">
                <span className="text-[12px] text-[var(--color-fg-mute)]">
                  以上是规则诊断。想要更个性化的判断，复制提示词交给 AI。
                </span>
                <button className="btn-outline h-8 text-[12px]" onClick={copyPrompt}>
                  <IconCopy size={13} /> 复制提示词
                </button>
              </div>
            </div>
          )}

          {/* AI 深度报告 */}
          {(report || genBusy) && (
            <div className="border-t border-[var(--color-border)] px-4 py-4">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[13px] font-semibold">
                  <IconSparkles size={15} style={{ color: 'var(--color-brand)' }} />
                  AI 深度复盘报告
                </span>
                <div className="flex items-center gap-2">
                  {genBusy && <span className="text-[11.5px] text-[var(--color-fg-mute)]">生成中…</span>}
                  {report && !genBusy && (
                    <button className="btn-ghost h-7 px-2 text-[12px]" onClick={copyReport}>
                      <IconCopy size={12} /> 复制报告
                    </button>
                  )}
                </div>
              </div>
              <div className="max-h-[440px] overflow-auto scroll-thin rounded-[10px] bg-[var(--color-surface)] p-3.5">
                {report
                  ? <Markdown content={report} />
                  : <span className="text-[12.5px] text-[var(--color-fg-mute)]">正在生成，请稍候…</span>}
              </div>
            </div>
          )}
        </div>

        <div className="h-4" />
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: string }) {
  return (
    <div className="card p-4">
      <div className="text-[12px] text-[var(--color-fg-mute)]">{label}</div>
      <div className="mt-1 text-[26px] font-semibold leading-none tabular-nums" style={{ color: tone }}>{value}</div>
      {sub && <div className="mt-1.5 text-[11.5px] text-[var(--color-fg-mute)]">{sub}</div>}
    </div>
  )
}
