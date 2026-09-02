// 轻量级 LLM 客户端：仅依赖浏览器原生 fetch，调用 OpenAI 兼容的 /chat/completions 接口。
// 支持流式（SSE）逐字返回，便于在大段复盘报告上做打字机效果。
// 密钥仅保存在本机 localStorage，除用户所填接口外不会上传到任何第三方。

export type LLMProvider = 'openai' | 'deepseek' | 'moonshot' | 'qwen' | 'custom'

export interface LLMConfig {
  provider: LLMProvider
  baseUrl: string   // 例如 https://api.deepseek.com/v1
  apiKey: string
  model: string
}

const PRESETS: Record<Exclude<LLMProvider, 'custom'>, { baseUrl: string; model: string }> = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  moonshot: { baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
}

const STORE_KEY = 'goal-tracker-llm'

export function presetBaseUrl(p: LLMProvider): string {
  return p === 'custom' ? '' : PRESETS[p].baseUrl
}
export function presetModel(p: LLMProvider): string {
  return p === 'custom' ? '' : PRESETS[p].model
}

export function getLLMConfig(): LLMConfig | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return null
    const c = JSON.parse(raw) as LLMConfig
    if (!c.baseUrl || !c.apiKey || !c.model) return null
    return c
  } catch {
    return null
  }
}

export function saveLLMConfig(cfg: LLMConfig) {
  localStorage.setItem(STORE_KEY, JSON.stringify(cfg))
}

export function clearLLMConfig() {
  localStorage.removeItem(STORE_KEY)
}

const SYSTEM_PROMPT =
  '你是一位专注个人目标管理的复盘教练。请基于用户给出的目标/任务数据快照与本地诊断，' +
  '做出直接、有结构、可执行的复盘。少说套话，多给针对具体目标的取舍建议与接下来 7 天的行动清单。'

/**
 * 调用大模型。
 * @param onToken 传入则启用流式，每收到一个片段就回调（用于打字机渲染）。
 * @returns 完整回复文本
 */
export async function callLLM(
  prompt: string,
  cfg: LLMConfig,
  onToken?: (t: string) => void,
): Promise<string> {
  const base = cfg.baseUrl.replace(/\/+$/, '')
  const url = `${base}/chat/completions`
  const body = {
    model: cfg.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    stream: !!onToken,
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`接口返回 ${res.status}：${txt.slice(0, 240) || res.statusText}`)
  }

  // 非流式
  if (!onToken) {
    const json = await res.json()
    return json?.choices?.[0]?.message?.content || ''
  }

  // 流式 SSE 解析
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let full = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() || ''
    for (const line of lines) {
      const s = line.trim()
      if (!s.startsWith('data:')) continue
      const data = s.slice(5).trim()
      if (!data || data === '[DONE]') continue
      try {
        const json = JSON.parse(data)
        const delta = json?.choices?.[0]?.delta?.content
        if (delta) {
          full += delta
          onToken(delta)
        }
      } catch {
        /* 跳过无法解析的分片 */
      }
    }
  }
  return full
}
