import React from 'react'

// 极简 Markdown 渲染器：只支持报告常用的语法，且全程输出 React 文本节点，
// 不使用 dangerouslySetInnerHTML，天然避免 LLM 输出中的 XSS 风险。
// 支持：# ~ #### 标题、> 引用、-/* 无序列表、1. 有序列表、--- 分割线、
//       ``` 代码块、行内 **粗体** 与 `行内代码`。

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[2] != null) out.push(<strong key={`${keyBase}-b${i}`}>{m[2]}</strong>)
    else if (m[3] != null) out.push(<code key={`${keyBase}-c${i}`} className="mk-code">{m[3]}</code>)
    last = m.index + m[0].length
    i++
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function Markdown({ content }: { content: string }) {
  const lines = content.split('\n')
  const blocks: React.ReactNode[] = []
  let para: string[] = []
  let k = 0

  const flushPara = () => {
    if (!para.length) return
    const joined = para.join(' ')
    blocks.push(
      <p key={`p${k++}`} className="mk-p">{renderInline(joined, `p${k}`)}</p>,
    )
    para = []
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') { flushPara(); i++; continue }

    if (line.trim() === '---') { flushPara(); blocks.push(<hr key={`h${k++}`} className="mk-hr" />); i++; continue }

    if (line.startsWith('```')) {
      flushPara()
      const code: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) { code.push(lines[i]); i++ }
      i++ // 跳过结束 ```
      blocks.push(<pre key={`pre${k++}`} className="mk-pre"><code>{code.join('\n')}</code></pre>)
      continue
    }

    const h = line.match(/^(#{1,4})\s+(.*)$/)
    if (h) {
      flushPara()
      const lv = h[1].length
      const tag = `h${lv}` as 'h1' | 'h2' | 'h3' | 'h4'
      blocks.push(
        React.createElement(tag, { key: `hh${k++}`, className: `mk-h mk-h${lv}` }, renderInline(h[2], `hh${k}`)),
      )
      i++; continue
    }

    if (/^>\s/.test(line)) {
      flushPara()
      blocks.push(<blockquote key={`q${k++}`} className="mk-quote">{renderInline(line.replace(/^>\s/, ''), `q${k}`)}</blockquote>)
      i++; continue
    }

    if (/^[-*]\s/.test(line)) {
      flushPara()
      const items: string[] = []
      while (i < lines.length && /^[-*]\s/.test(lines[i])) { items.push(lines[i].replace(/^[-*]\s/, '')); i++ }
      blocks.push(
        <ul key={`ul${k++}`} className="mk-ul">
          {items.map((t, idx) => <li key={idx}>{renderInline(t, `ul${k}-${idx}`)}</li>)}
        </ul>,
      )
      continue
    }

    if (/^\d+\.\s/.test(line)) {
      flushPara()
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s/, '')); i++ }
      blocks.push(
        <ol key={`ol${k++}`} className="mk-ol">
          {items.map((t, idx) => <li key={idx}>{renderInline(t, `ol${k}-${idx}`)}</li>)}
        </ol>,
      )
      continue
    }

    para.push(line)
    i++
  }
  flushPara()

  return <div className="mk">{blocks}</div>
}
