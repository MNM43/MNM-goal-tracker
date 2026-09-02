import { useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { Modal, Confirm, Empty, Field, Segmented } from './ui'
import { IconDownload, IconUpload, IconTrash, IconRefresh, IconCloud, IconCheck, IconSparkles } from './icons'
import { toast } from './Toast'
import {
  getCloudConfig, saveCloudConfig, clearCloudConfig, getAutoSync, setAutoSync,
  getCloudEmail, signIn, signOut, syncNow, currentUser, onAuthChange,
} from '../lib/sync'
import {
  getLLMConfig, saveLLMConfig, clearLLMConfig, presetBaseUrl, presetModel,
  type LLMProvider,
} from '../lib/llm'

export function SettingsModal() {
  const open = useUI(s => s.settingsOpen)
  const openSettings = useUI(s => s.openSettings)
  const { nodes, restoreNode, exportAll, importAll, clearAll } = useStore()
  const [tab, setTab] = useState<'data' | 'trash' | 'cloud' | 'ai'>('data')
  const [clearOpen, setClearOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const deleted = useMemo(() => nodes.filter(n => n.deleted_at).sort((a, b) => (b.deleted_at || '').localeCompare(a.deleted_at || '')), [nodes])

  /* 云同步状态 */
  const cfg = getCloudConfig()
  const [url, setUrl] = useState(cfg?.url ?? '')
  const [anonKey, setAnonKey] = useState(cfg?.anonKey ?? '')
  const [email, setEmail] = useState(getCloudEmail())
  const [user, setUser] = useState<{ id: string; email: string | null } | null>(null)
  const [cloudBusy, setCloudBusy] = useState(false)
  const [cloudMsg, setCloudMsg] = useState<{ tone: 'ok' | 'err' | 'info'; text: string } | null>(null)

  /* AI 复盘配置 */
  const llm = getLLMConfig()
  const [provider, setProvider] = useState<LLMProvider>(llm?.provider ?? 'deepseek')
  const [baseUrl, setBaseUrl] = useState(llm?.baseUrl ?? presetBaseUrl('deepseek'))
  const [apiKey, setApiKey] = useState(llm?.apiKey ?? '')
  const [model, setModel] = useState(llm?.model ?? presetModel('deepseek'))

  const pickProvider = (p: LLMProvider) => {
    setProvider(p)
    if (p !== 'custom') {
      setBaseUrl(presetBaseUrl(p))
      setModel(presetModel(p))
    }
  }
  const saveLLM = () => {
    if (!baseUrl.trim() || !apiKey.trim() || !model.trim()) { toast('请填写完整的接口地址、密钥与模型', 'error'); return }
    saveLLMConfig({ provider, baseUrl: baseUrl.trim(), apiKey: apiKey.trim(), model: model.trim() })
    toast('已保存 AI 配置')
  }

  useEffect(() => {
    if (open && cfg) {
      currentUser().then(u => setUser(u)).catch(() => setUser(null))
    }
    const off = onAuthChange(u => setUser(u))
    return () => off()
  }, [open, cfg?.url])

  const saveCfg = () => {
    if (!url.trim() || !anonKey.trim()) { toast('请填写完整的 URL 与 anon key', 'error'); return }
    saveCloudConfig(url, anonKey)
    setCloudMsg({ tone: 'ok', text: '已保存项目配置，下一步用邮箱登录。' })
    toast('已保存云端配置')
  }

  const doSignIn = async () => {
    setCloudBusy(true); setCloudMsg(null)
    try {
      await signIn(email)
      setCloudMsg({ tone: 'info', text: '登录链接已发送到邮箱，点击链接后本页面会自动登录。' })
    } catch (e: any) {
      setCloudMsg({ tone: 'err', text: e?.message || '发送失败，请检查配置' })
    } finally { setCloudBusy(false) }
  }

  const doSignOut = async () => {
    await signOut(); setUser(null); setUrl(''); setAnonKey(''); setAutoSync(false)
    setCloudMsg({ tone: 'info', text: '已退出登录并清除云端配置。' })
  }

  const doSync = async () => {
    if (!user) { toast('请先登录', 'error'); return }
    setCloudBusy(true); setCloudMsg({ tone: 'info', text: '同步中…' })
    try {
      const r = await syncNow()
      setCloudMsg({ tone: 'ok', text: `同步完成，已合并 ${r.pushed} 条记录。` })
      toast('云端同步完成', 'success')
    } catch (e: any) {
      setCloudMsg({ tone: 'err', text: e?.message || '同步失败' })
    } finally { setCloudBusy(false) }
  }

  const doExport = () => {
    const blob = new Blob([exportAll()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `目标台备份-${format(new Date(), 'yyyyMMdd-HHmm')}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast('备份已导出')
  }

  const doImport = (file: File, mode: 'merge' | 'overwrite') => {
    const reader = new FileReader()
    reader.onload = () => {
      const ok = importAll(String(reader.result), mode)
      toast(ok ? (mode === 'merge' ? '已按 id 合并导入' : '已覆盖导入') : '文件格式不正确', ok ? 'success' : 'error')
      openSettings(false)
    }
    reader.readAsText(file)
  }

  const TABS = [
    { key: 'data', label: '数据备份' },
    { key: 'trash', label: `回收站${deleted.length ? ` (${deleted.length})` : ''}` },
    { key: 'cloud', label: '云同步' },
    { key: 'ai', label: 'AI 复盘' },
  ] as const

  return (
    <Modal
      open={open}
      onClose={() => openSettings(false)}
      title="数据与设置"
      width={560}
      footer={<button className="btn-primary" onClick={() => openSettings(false)}>完成</button>}
    >
      <div className="mb-4 flex gap-1 rounded-[10px] bg-[var(--color-surface-2)] p-1">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex-1 rounded-[8px] py-1.5 text-[12.5px] font-medium transition-colors"
            style={tab === t.key ? { background: '#fff', boxShadow: '0 1px 2px rgba(17,17,20,0.06)' } : { color: 'var(--color-fg-soft)' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'data' && (
        <div className="space-y-3">
          <Row
            icon={<IconDownload size={16} />}
            title="导出备份"
            desc="把全部目标、任务、打卡记录导出为 JSON 文件，可用于本地存档或换设备迁移。"
            action={<button className="btn-outline h-8 text-[12.5px]" onClick={doExport}>导出 JSON</button>}
          />
          <Row
            icon={<IconUpload size={16} />}
            title="导入备份"
            desc="合并模式保留现有数据、仅补充新条目；覆盖模式会用文件完全替换当前数据。"
            action={
              <div className="flex gap-2">
                <button className="btn-outline h-8 text-[12.5px]" onClick={() => fileRef.current?.click()}>合并导入</button>
              </div>
            }
          />
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) doImport(f, 'merge'); e.target.value = '' }}
          />
          <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <div className="mb-2 text-[12.5px] font-medium">当前数据</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat n={nodes.filter(n => !n.deleted_at).length} label="目标/任务" />
              <Stat n={useStore.getState().checkins.filter(c => !c.deleted_at).length} label="打卡项" />
              <Stat n={useStore.getState().checkinLogs.length} label="打卡记录" />
            </div>
          </div>
          <Row
            icon={<IconTrash size={16} />}
            title="清空全部数据"
            desc="删除所有目标、任务与打卡记录。此操作不可撤销，请先导出备份。"
            danger
            action={<button className="btn-outline h-8 text-[12.5px]" style={{ color: 'var(--color-danger)', borderColor: '#F2C9C6' }} onClick={() => setClearOpen(true)}>清空</button>}
          />
        </div>
      )}

      {tab === 'trash' && (
        <div>
          {!deleted.length ? (
            <Empty icon={<IconTrash size={20} />} title="回收站是空的" desc="删除的目标会先进入回收站，可以在此恢复。" />
          ) : (
            <div className="max-h-[340px] space-y-1 overflow-y-auto">
              {deleted.map(n => (
                <div key={n.id} className="flex items-center gap-2 rounded-[10px] px-2.5 py-2 hover:bg-[var(--color-surface)]">
                  <span className="text-[13px]">{n.emoji || '·'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] line-through">{n.title}</div>
                    <div className="text-[10.5px] text-[var(--color-fg-mute)]">删除于 {n.deleted_at?.slice(0, 16).replace('T', ' ')}</div>
                  </div>
                  <button
                    className="btn-ghost h-7 shrink-0 px-2 text-[12px]"
                    onClick={() => { restoreNode(n.id); toast('已恢复') }}
                  >
                    <IconRefresh size={13} /> 恢复
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'cloud' && (
        <div className="space-y-3">
          {!cfg ? (
            <>
              <div className="flex gap-2.5 rounded-[12px] border border-[var(--color-brand-soft-2)] bg-[var(--color-brand-soft)] p-3.5">
                <IconCloud size={16} style={{ color: 'var(--color-brand)', flexShrink: 0, marginTop: 2 }} />
                <div className="text-[12.5px] leading-relaxed" style={{ color: 'var(--color-brand)' }}>
                  第一步：粘贴你的 Supabase 项目 URL 与 anon key（在 Project Settings → API 获取）。
                  建表 SQL 见项目根目录 <code className="rounded bg-white/70 px-1">supabase/schema.sql</code>。
                </div>
              </div>
              <div className="space-y-2.5">
                <Field label="Project URL">
                  <input className="field" placeholder="https://xxxx.supabase.co" value={url} onChange={e => setUrl(e.target.value)} />
                </Field>
                <Field label="anon key (public)">
                  <input className="field" placeholder="eyJhbGci..." value={anonKey} onChange={e => setAnonKey(e.target.value)} />
                </Field>
                <button className="btn-primary h-9 w-full" onClick={saveCfg}>保存配置</button>
              </div>
            </>
          ) : !user ? (
            <>
              <div className="flex items-center gap-2 rounded-[10px] bg-[var(--color-success-soft)] px-3 py-2.5 text-[12.5px]" style={{ color: 'var(--color-success)' }}>
                <IconCheck size={15} /> 项目已连接，用邮箱登录后即可同步（魔法链接，无需密码）。
              </div>
              <div className="space-y-2.5">
                <Field label="登录邮箱">
                  <input className="field" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
                </Field>
                <button className="btn-primary h-9 w-full" disabled={cloudBusy} onClick={doSignIn}>
                  {cloudBusy ? '发送中…' : '发送登录链接'}
                </button>
                <button className="btn-ghost h-8 w-full text-[12px]" onClick={() => { clearCloudConfig(); setUrl(''); setAnonKey('') }}>清除配置</button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-[10px] bg-[var(--color-success-soft)] px-3 py-2.5">
                <span className="flex items-center gap-2 text-[12.5px] font-medium" style={{ color: 'var(--color-success)' }}>
                  <IconCheck size={15} /> 已登录 {user.email || user.id.slice(0, 8)}
                </span>
                <button className="btn-ghost h-7 px-2 text-[12px]" style={{ color: 'var(--color-danger)' }} onClick={doSignOut}>退出</button>
              </div>
              <Row
                icon={<IconRefresh size={16} />}
                title="立即同步"
                desc="把本机数据上传到云端并拉取其他设备的变更（按时间 last-write-wins 合并）。"
                action={<button className="btn-primary h-8 text-[12.5px]" disabled={cloudBusy} onClick={doSync}>{cloudBusy ? '同步中…' : '同步'}</button>}
              />
              <Row
                icon={<IconCloud size={16} />}
                title="自动同步"
                desc="开启后，每次本地数据变更会在 1.5 秒后自动上传到云端。"
                action={
                  <button
                    className="chip"
                    style={{ background: getAutoSync() ? 'var(--color-brand)' : 'var(--color-surface-2)', color: getAutoSync() ? '#fff' : 'var(--color-fg-soft)' }}
                    onClick={() => setAutoSync(!getAutoSync())}
                  >
                    {getAutoSync() ? '已开启' : '已关闭'}
                  </button>
                }
              />
              <Row
                icon={<IconDownload size={16} />}
                title="本地自动备份"
                desc="数据已实时写入本机存储，关闭浏览器不会丢失。建议每周导出一次 JSON 做离线存档。"
                action={<span className="chip" style={{ background: 'var(--color-success-soft)', color: 'var(--color-success)' }}>已启用</span>}
              />
            </>
          )}

          {cloudMsg && (
            <div
              className="rounded-[10px] px-3 py-2.5 text-[12.5px] leading-relaxed"
              style={{
                background: cloudMsg.tone === 'err' ? 'var(--color-danger-soft)' : cloudMsg.tone === 'ok' ? 'var(--color-success-soft)' : 'var(--color-brand-soft)',
                color: cloudMsg.tone === 'err' ? 'var(--color-danger)' : cloudMsg.tone === 'ok' ? 'var(--color-success)' : 'var(--color-brand)',
                border: `1px solid ${cloudMsg.tone === 'err' ? '#F2C9C6' : cloudMsg.tone === 'ok' ? '#BFE6D2' : 'var(--color-brand-soft-2)'}`,
              }}
            >
              {cloudMsg.text}
            </div>
          )}
        </div>
      )}

      {tab === 'ai' && (
        <div className="space-y-3">
          <div className="flex gap-2.5 rounded-[12px] border border-[var(--color-brand-soft-2)] bg-[var(--color-brand-soft)] p-3.5">
            <IconSparkles size={16} style={{ color: 'var(--color-brand)', flexShrink: 0, marginTop: 2 }} />
            <div className="text-[12.5px] leading-relaxed" style={{ color: 'var(--color-brand)' }}>
              配置后，在「统计」页点「一键出报告」即可把本地诊断 + 完整数据交给 AI 生成深度复盘。
              密钥仅保存在本机浏览器，不会上传到你所填接口之外的任何地方。
            </div>
          </div>

          <Field label="服务商">
            <Segmented
              size="sm"
              value={provider}
              onChange={v => pickProvider(v as LLMProvider)}
              options={[
                { value: 'deepseek', label: 'DeepSeek' },
                { value: 'moonshot', label: 'Kimi' },
                { value: 'qwen', label: '通义' },
                { value: 'openai', label: 'OpenAI' },
                { value: 'custom', label: '自定义' },
              ]}
            />
          </Field>

          <Field label="接口地址 (Base URL)">
            <input className="field" placeholder="https://api.deepseek.com/v1" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} />
          </Field>

          <Field label="API Key">
            <input className="field" type="password" placeholder="sk-..." value={apiKey} onChange={e => setApiKey(e.target.value)} />
          </Field>

          <Field label="模型名称">
            <input className="field" placeholder="deepseek-chat" value={model} onChange={e => setModel(e.target.value)} />
          </Field>

          <div className="flex items-center gap-2">
            <button className="btn-primary h-9 flex-1" onClick={saveLLM}>保存配置</button>
            {llm && (
              <button className="btn-ghost h-9 px-3 text-[12px] text-[var(--color-fg-mute)]" onClick={() => { clearLLMConfig(); setApiKey(''); toast('已清除 AI 配置', 'info') }}>
                清除
              </button>
            )}
          </div>

          <div className="rounded-[10px] bg-[var(--color-surface)] px-3 py-2.5 text-[11.5px] leading-relaxed text-[var(--color-fg-mute)]">
            提示：浏览器直连大模型接口可能受跨域（CORS）限制。若调用报错，请使用支持 CORS 的接口，或自备代理转发。
          </div>
        </div>
      )}

      <Confirm
        open={clearOpen}
        title="清空全部数据"
        danger
        confirmText="确认清空"
        message="将删除所有目标、任务、分类与打卡记录，且无法恢复。建议先导出一份备份。"
        onCancel={() => setClearOpen(false)}
        onConfirm={() => { clearAll(); setClearOpen(false); openSettings(false); toast('已清空', 'info') }}
      />
    </Modal>
  )
}

function Row({
  icon, title, desc, action, danger,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  action: React.ReactNode
  danger?: boolean
}) {
  return (
    <div className="flex items-start gap-3 rounded-[12px] border border-[var(--color-border)] p-3">
      <span className="mt-0.5 shrink-0" style={{ color: danger ? 'var(--color-danger)' : 'var(--color-fg-soft)' }}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium">{title}</div>
        <div className="mt-0.5 text-[12px] leading-relaxed text-[var(--color-fg-mute)]">{desc}</div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  )
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-[9px] bg-white py-2">
      <div className="text-[17px] font-semibold tabular-nums">{n}</div>
      <div className="text-[10.5px] text-[var(--color-fg-mute)]">{label}</div>
    </div>
  )
}
