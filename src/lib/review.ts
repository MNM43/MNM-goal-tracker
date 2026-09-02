import type { GoalNode, Checkin, CheckinLog, Category, DisplayStatus } from '../types'
import { format, differenceInCalendarDays, parseISO } from 'date-fns'
import { periodProgress, periodRange, streakDays } from './checkin'
import { buildForest, type TreeNode } from './tree'

export type Level = 'danger' | 'warn' | 'info' | 'good'

export interface Finding {
  level: Level
  title: string
  detail: string
  items?: { label: string; meta?: string }[]
  action?: string
}

export interface ReviewInput {
  nodes: GoalNode[]
  checkins: Checkin[]
  checkinLogs: CheckinLog[]
  categories: Category[]
  progressMap: Record<string, number>
  statusMap: Record<string, DisplayStatus>
  catMap: Record<string, string | null>
}

const TODAY = () => format(new Date(), 'yyyy-MM-dd')

function depthMap(forest: TreeNode[], d = 0, out: Record<string, number> = {}): Record<string, number> {
  for (const n of forest) { out[n.id] = d; depthMap(n.children, d + 1, out) }
  return out
}

export function analyze(input: ReviewInput): Finding[] {
  const out: Finding[] = []
  const { nodes, checkins, checkinLogs, categories, progressMap, statusMap, catMap } = input
  const live = nodes.filter(n => !n.deleted_at)
  const liveCheckins = checkins.filter(c => !c.deleted_at)
  if (!live.length && !liveCheckins.length) return out

  const forest = buildForest(live)
  const depths = depthMap(forest)

  /* 1. 超时 */
  const overdue = live.filter(n => statusMap[n.id] === 'overdue')
  if (overdue.length) {
    const ratio = overdue.length / Math.max(1, live.length)
    out.push({
      level: ratio > 0.25 ? 'danger' : 'warn',
      title: `${overdue.length} 项已超期未闭环`,
      detail: `占全部节点的 ${Math.round(ratio * 100)}%。超期项如果不处理，会持续污染上层目标的进度统计，建议要么重排时间，要么明确放弃。`,
      items: overdue
        .sort((a, b) => (a.planned_end || '').localeCompare(b.planned_end || ''))
        .slice(0, 6)
        .map(n => ({ label: n.emoji ? `${n.emoji} ${n.title}` : n.title, meta: `超期 ${Math.abs(differenceInCalendarDays(parseISO(n.planned_end!), new Date()))} 天 · 进度 ${progressMap[n.id] ?? 0}%` })),
      action: '给每项一个明确动作：改期 / 拆解 / 放弃。',
    })
  }

  /* 2. 时间过半但进度不足 */
  const lagging = live.filter(n => {
    const st = statusMap[n.id]
    if (st === 'completed' || st === 'abandoned') return false
    if (!n.planned_start || !n.planned_end) return false
    const total = differenceInCalendarDays(parseISO(n.planned_end), parseISO(n.planned_start))
    const passed = differenceInCalendarDays(new Date(), parseISO(n.planned_start))
    if (total <= 0 || passed < 0) return false
    const timeRatio = passed / total
    return timeRatio > 0.5 && (progressMap[n.id] ?? 0) < timeRatio * 100 - 15
  })
  if (lagging.length) {
    out.push({
      level: 'warn',
      title: `${lagging.length} 项进度明显落后于时间`,
      detail: '这些事项已消耗过半时间，但完成度还差 15% 以上。常见原因是目标切得太大，或起步被推迟。',
      items: lagging.slice(0, 6).map(n => {
        const total = differenceInCalendarDays(parseISO(n.planned_end!), parseISO(n.planned_start!))
        const passed = differenceInCalendarDays(new Date(), parseISO(n.planned_start!))
        return {
          label: n.emoji ? `${n.emoji} ${n.title}` : n.title,
          meta: `时间 ${Math.round((passed / total) * 100)}% · 进度 ${progressMap[n.id] ?? 0}%`,
        }
      }),
      action: '把剩余部分拆成 2–3 个能在 3 天内完成的小任务，先把进度推起来。',
    })
  }

  /* 3. 缺少计划时间 */
  const noDates = live.filter(n => !n.planned_start || !n.planned_end)
  if (noDates.length) {
    out.push({
      level: 'warn',
      title: `${noDates.length} 项没有计划起止时间`,
      detail: '没有时间锚点的目标无法进入甘特图，也不会被周期视图统计，等于脱离了你的计划体系。',
      items: noDates.slice(0, 5).map(n => ({ label: n.emoji ? `${n.emoji} ${n.title}` : n.title })),
      action: '至少补上「计划完成日」。',
    })
  }

  /* 4. 时间倒挂 */
  const inverted = live.filter(n => n.planned_start && n.planned_end && n.planned_start > n.planned_end)
  if (inverted.length) {
    out.push({
      level: 'danger',
      title: `${inverted.length} 项计划时间倒挂`,
      detail: '计划开始晚于计划结束，数据异常，会导致甘特图无法绘制。',
      items: inverted.map(n => ({ label: n.title, meta: `${n.planned_start} → ${n.planned_end}` })),
    })
  }

  /* 5. 目标未拆解 */
  const undecomposed = live.filter(n => n.node_type === 'goal' && !live.some(c => c.parent_id === n.id))
  if (undecomposed.length >= 2) {
    out.push({
      level: 'info',
      title: `${undecomposed.length} 个目标还没有拆子项`,
      detail: '没有子任务的目标，进度只能靠手动填写，容易停在 0% 或一把跳到 100%。拆到「一次能做完」的粒度，进度才会自然流动。',
      items: undecomposed.slice(0, 5).map(n => ({ label: n.emoji ? `${n.emoji} ${n.title}` : n.title })),
    })
  }

  /* 6. 层级过深 */
  const tooDeep = live.filter(n => (depths[n.id] ?? 0) >= 4)
  if (tooDeep.length) {
    out.push({
      level: 'info',
      title: `${tooDeep.length} 个节点层级超过 4 层`,
      detail: '层级太深通常意味着管理成本已经超过收益，执行时你很少会翻到第 5 层。',
      items: tooDeep.slice(0, 4).map(n => ({ label: n.title, meta: `第 ${(depths[n.id] ?? 0) + 1} 层` })),
      action: '考虑合并或把中间层降为备注。',
    })
  }

  /* 7. 打卡未达标 */
  const ckLagging = liveCheckins.filter(c => {
    const p = periodProgress(c, checkinLogs, periodRange(c, new Date()))
    return p < 100
  })
  const ckDone = liveCheckins.length - ckLagging.length
  if (liveCheckins.length) {
    out.push({
      level: ckLagging.length === 0 ? 'good' : ckLagging.length > liveCheckins.length / 2 ? 'warn' : 'info',
      title: `打卡：本期 ${ckDone}/${liveCheckins.length} 项已达标`,
      detail: ckLagging.length === 0
        ? '本期所有打卡项都已达标，节奏稳定，注意保持。'
        : '未达标的项按缺口大小排序如下。若连续多期完不成，通常是目标次数定得过高，而不是执行力问题。',
      items: ckLagging
        .map(c => ({ c, p: periodProgress(c, checkinLogs, periodRange(c, new Date())) }))
        .sort((a, b) => a.p - b.p)
        .slice(0, 6)
        .map(({ c, p }) => ({ label: `${c.emoji || '✓'} ${c.title}`, meta: `${p}%` })),
      action: ckLagging.length ? '把目标次数下调到「懒的时候也能完成」的水平，再逐步加码。' : undefined,
    })
  }

  /* 8. 断签 */
  const broken = liveCheckins.filter(c => {
    const s = streakDays(c.id, checkinLogs)
    return s === 0 && checkinLogs.some(l => l.checkin_id === c.id)
  })
  if (broken.length) {
    out.push({
      level: 'info',
      title: `${broken.length} 个打卡项已断签`,
      detail: '连续记录已经中断。断签本身不可怕，怕的是就此搁置——补一次就能重新接上。',
      items: broken.slice(0, 5).map(c => ({ label: `${c.emoji || '✓'} ${c.title}` })),
    })
  }

  /* 9. 分类失衡 */
  const catCount: Record<string, number> = {}
  for (const n of live) {
    const k = catMap[n.id] || '__none__'
    catCount[k] = (catCount[k] || 0) + 1
  }
  const entries = Object.entries(catCount).sort((a, b) => b[1] - a[1])
  if (entries.length && entries[0][1] / Math.max(1, live.length) > 0.7 && live.length >= 5) {
    const name = entries[0][0] === '__none__' ? '未分类' : (categories.find(c => c.id === entries[0][0])?.name || '已删除分类')
    out.push({
      level: 'info',
      title: `精力过度集中在「${name}」`,
      detail: `该分类占了 ${Math.round((entries[0][1] / live.length) * 100)}% 的节点。如果这不是你本周期的主战场，说明其他重要但不紧急的事正在被挤掉。`,
      action: '检查健康、学习等长周期分类是否还有活跃目标。',
    })
  }

  /* 10. 长期无更新 */
  const stale = live.filter(n => {
    if (statusMap[n.id] === 'completed' || statusMap[n.id] === 'abandoned') return false
    return differenceInCalendarDays(new Date(), parseISO(n.updated_at)) >= 14
  })
  if (stale.length) {
    out.push({
      level: 'warn',
      title: `${stale.length} 项超过 14 天没有动静`,
      detail: '长期没有更新的进行中事项，往往已经实际停滞，只是还没被标记为放弃。',
      items: stale.slice(0, 5).map(n => ({
        label: n.emoji ? `${n.emoji} ${n.title}` : n.title,
        meta: `${differenceInCalendarDays(new Date(), parseISO(n.updated_at))} 天未动`,
      })),
      action: '每周复盘时扫一遍，该放弃就放弃。',
    })
  }

  /* 11. 周期结构 */
  const hasYear = live.some(n => n.cycle_type === 'year')
  const hasMonthOrWeek = live.some(n => n.cycle_type === 'month' || n.cycle_type === 'week')
  if (hasYear && !hasMonthOrWeek) {
    out.push({
      level: 'info',
      title: '有年度目标，但缺少月度和周度落脚点',
      detail: '年度目标离日常太远，执行时会一直"还早"。补一层月度和周度任务，年度目标才有推进路径。',
      action: '把年度目标拆成 3–4 个季度里程碑。',
    })
  }
  if (!hasYear && live.length >= 3) {
    out.push({
      level: 'info',
      title: '还没有年度目标',
      detail: '当前目标都是中短周期的。建议至少立 1 个年度目标作为锚点，其他目标挂在它下面，避免各忙各的。',
    })
  }

  /* 12. 亮点 */
  const completedThisPeriod = live.filter(n => n.actual_end && n.actual_end >= format(new Date(Date.now() - 30 * 864e5), 'yyyy-MM-dd'))
  if (completedThisPeriod.length) {
    out.push({
      level: 'good',
      title: `近 30 天完成了 ${completedThisPeriod.length} 项`,
      detail: '保持这个节奏。可以把完成情况回填到上层目标，看看整体推进了多少。',
      items: completedThisPeriod.slice(0, 5).map(n => ({ label: n.emoji ? `${n.emoji} ${n.title}` : n.title, meta: n.actual_end! })),
    })
  }

  const order: Record<Level, number> = { danger: 0, warn: 1, info: 2, good: 3 }
  return out.sort((a, b) => order[a.level] - order[b.level])
}

/** 生成可粘贴给任意 AI 的完整复盘提示词 */
export function buildAIPrompt(input: ReviewInput, findings: Finding[]): string {
  const { nodes, checkins, checkinLogs, progressMap, statusMap, catMap, categories } = input
  const live = nodes.filter(n => !n.deleted_at)
  const catName = (id: string | null) => (id ? (categories.find(c => c.id === id)?.name ?? '未知') : '未分类')

  const rows = live.map(n => ({
    标题: n.title,
    类型: n.node_type === 'goal' ? '目标' : '任务',
    层级分类: catName(catMap[n.id]),
    周期: n.cycle_type ?? '自定义',
    计划: `${n.planned_start ?? '未定'} → ${n.planned_end ?? '未定'}`,
    实际完成: n.actual_end ?? '',
    状态: statusMap[n.id],
    进度: `${progressMap[n.id] ?? 0}%`,
    备注: n.note || '',
  }))

  const ckRows = checkins.filter(c => !c.deleted_at).map(c => ({
    打卡项: c.title,
    周期: c.period_type === 'week' ? '每周' : '每月',
    目标次数: c.target_count,
    本期完成: periodProgress(c, checkinLogs, periodRange(c, new Date())) + '%',
    连续天数: streakDays(c.id, checkinLogs),
    记录总数: checkinLogs.filter(l => l.checkin_id === c.id && l.status === 'done').length,
  }))

  const localFindings = findings.map(f => `- [${f.level}] ${f.title}：${f.detail}`).join('\n')

  return `# 个人目标复盘请求

今天是 ${TODAY()}。下面是我的目标管理数据快照，以及本地规则引擎已经跑出的初步诊断。请你在此基础上做一次深入复盘。

## 一、请重点回答这四件事

1. **合理性**：我的目标结构是否合理？有没有目标之间互相冲突、或者明显偏离我真实优先级的地方？
2. **可行性**：以我现在已完成的数据和节奏看，剩下的目标在同一周期内是否还来得及？哪些注定完不成？
3. **调整建议**：哪些目标该改期限、哪些该降低标准、哪些该直接砍掉？请给出具体的取舍理由，不要和稀泥。
4. **执行建议**：接下来 7 天我最该推进哪 3 件事？请按"投入产出比"排序，并说明理由。

## 二、输出要求

- 直接说结论，不要复述我的数据。
- 每条建议都要指向具体的目标名称。
- 语气直接，发现问题就明确指出，不用铺垫。

## 三、目标与任务数据（共 ${rows.length} 条）

\`\`\`json
${JSON.stringify(rows, null, 2)}
\`\`\`

## 四、打卡数据（共 ${ckRows.length} 条）

\`\`\`json
${JSON.stringify(ckRows, null, 2)}
\`\`\`

## 五、本地规则引擎的初步诊断

${localFindings || '（暂无异常）'}

---
请开始你的复盘。`
}
