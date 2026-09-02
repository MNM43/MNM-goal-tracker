import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { useStore } from '../store/useStore'
import type { GoalNode, Category, Checkin, CheckinLog } from '../types'

const KEY_URL = 'goal-tracker-cloud-url'
const KEY_ANON = 'goal-tracker-cloud-key'
const KEY_AUTO = 'goal-tracker-cloud-auto'
const KEY_EMAIL = 'goal-tracker-cloud-email'

export interface CloudConfig {
  url: string
  anonKey: string
}

export function getCloudConfig(): CloudConfig | null {
  const url = localStorage.getItem(KEY_URL)
  const anonKey = localStorage.getItem(KEY_ANON)
  if (!url || !anonKey) return null
  return { url, anonKey }
}

export function saveCloudConfig(url: string, anonKey: string) {
  localStorage.setItem(KEY_URL, url.trim())
  localStorage.setItem(KEY_ANON, anonKey.trim())
}

export function clearCloudConfig() {
  localStorage.removeItem(KEY_URL)
  localStorage.removeItem(KEY_ANON)
}

export function getAutoSync() {
  return localStorage.getItem(KEY_AUTO) === '1'
}

export function setAutoSync(v: boolean) {
  localStorage.setItem(KEY_AUTO, v ? '1' : '0')
}

export function getCloudEmail() {
  return localStorage.getItem(KEY_EMAIL) || ''
}

export function setCloudEmail(e: string) {
  localStorage.setItem(KEY_EMAIL, e)
}

let _client: SupabaseClient | null = null

export function getClient(): SupabaseClient | null {
  const cfg = getCloudConfig()
  if (!cfg) return null
  if (!_client) {
    _client = createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  }
  return _client
}

export async function currentUser(): Promise<{ id: string; email: string | null } | null> {
  const c = getClient()
  if (!c) return null
  const { data } = await c.auth.getUser()
  return data.user ? { id: data.user.id, email: data.user.email ?? null } : null
}

/** 监听登录态变化（魔法链接回调后刷新页面即生效） */
export function onAuthChange(cb: (user: { id: string; email: string | null } | null) => void) {
  const c = getClient()
  if (!c) return () => {}
  const { data } = c.auth.onAuthStateChange((_e, session) => {
    cb(session?.user ? { id: session.user.id, email: session.user.email ?? null } : null)
  })
  return () => data.subscription.unsubscribe()
}

export async function signIn(email: string) {
  const c = getClient()
  if (!c) throw new Error('请先填写 Project URL 与 anon key')
  const { error } = await c.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: location.origin },
  })
  if (error) throw error
  setCloudEmail(email.trim())
}

export async function signOut() {
  const c = getClient()
  if (!c) return
  await c.auth.signOut()
  clearCloudConfig()
  setAutoSync(false)
}

/** 把本地数据上传到云端（按 id upsert，软删除一并同步） */
export async function pushAll(): Promise<void> {
  const c = getClient()
  if (!c) throw new Error('未配置云端')
  const user = await currentUser()
  if (!user) throw new Error('请先登录')
  const uid = user.id
  const s = useStore.getState()

  const tables: [string, Record<string, unknown>[]][] = [
    ['nodes', s.nodes.map(n => ({ ...n, user_id: uid }))],
    ['categories', s.categories.map(x => ({ ...x, user_id: uid }))],
    ['checkins', s.checkins.map(x => ({ ...x, user_id: uid }))],
    ['checkin_logs', s.checkinLogs.map(x => ({ ...x, user_id: uid }))],
  ]
  for (const [table, rows] of tables) {
    if (!rows.length) continue
    const { error } = await c.from(table).upsert(rows, { onConflict: 'id' })
    if (error) throw error
  }
}

/** 从云端拉取并合并到本地（last-write-wins by updated_at） */
export async function pullAll(): Promise<void> {
  const c = getClient()
  if (!c) throw new Error('未配置云端')
  const user = await currentUser()
  if (!user) throw new Error('请先登录')

  const strip = (rows: Record<string, unknown>[]) => rows.map(({ user_id, ...rest }) => rest)

  const [n, cat, ck, log] = await Promise.all([
    c.from('nodes').select('*').eq('user_id', user.id),
    c.from('categories').select('*').eq('user_id', user.id),
    c.from('checkins').select('*').eq('user_id', user.id),
    c.from('checkin_logs').select('*').eq('user_id', user.id),
  ])
  if (n.error) throw n.error
  if (cat.error) throw cat.error
  if (ck.error) throw ck.error
  if (log.error) throw log.error

  useStore.getState().syncMerge({
    nodes: strip(n.data as any) as unknown as GoalNode[],
    categories: strip(cat.data as any) as unknown as Category[],
    checkins: strip(ck.data as any) as unknown as Checkin[],
    checkinLogs: strip(log.data as any) as unknown as CheckinLog[],
  })
}

export async function syncNow(): Promise<{ pushed: number }> {
  _syncing = true
  try {
    await pushAll()
    await pullAll()
  } finally {
    _syncing = false
  }
  const s = useStore.getState()
  return { pushed: s.nodes.length + s.categories.length + s.checkins.length + s.checkinLogs.length }
}

/* ---------- 自动同步：本地变更后防抖上传 ---------- */
let _timer: ReturnType<typeof setTimeout> | null = null
let _autoStarted = false
let _syncing = false

export function startAutoSync() {
  if (_autoStarted) return
  _autoStarted = true
  useStore.subscribe(() => {
    if (_syncing) return
    if (!getAutoSync()) return
    if (!getCloudConfig()) return
    currentUser().then(u => {
      if (!u) return
      if (_timer) clearTimeout(_timer)
      _timer = setTimeout(() => {
        _syncing = true
        pushAll()
          .catch(() => {/* 静默失败，下次变更重试 */})
          .finally(() => { _syncing = false })
      }, 1500)
    })
  })
}
