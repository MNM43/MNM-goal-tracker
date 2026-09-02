import type { GoalNode } from '../types'

export interface TreeNode extends GoalNode {
  children: TreeNode[]
  depth: number
}

/** 由扁平列表构建森林（自动忽略已删除节点） */
export function buildForest(nodes: GoalNode[]): TreeNode[] {
  const live = nodes.filter(n => !n.deleted_at)
  const map = new Map<string, TreeNode>()
  for (const n of live) map.set(n.id, { ...n, children: [], depth: 0 })

  const roots: TreeNode[] = []
  for (const n of live) {
    const tn = map.get(n.id)!
    const p = n.parent_id ? map.get(n.parent_id) : null
    if (p && p.id !== n.id) p.children.push(tn)
    else roots.push(tn)
  }

  const sortRec = (list: TreeNode[]) => {
    list.sort((a, b) => (a.sort_order - b.sort_order) || a.created_at.localeCompare(b.created_at))
    for (const c of list) sortRec(c.children)
  }
  sortRec(roots)

  const setDepth = (list: TreeNode[], d: number) => {
    for (const n of list) { n.depth = d; setDepth(n.children, d + 1) }
  }
  setDepth(roots, 0)

  return roots
}

/** 按展开状态把森林拍平成可渲染的行 */
export function flattenForest(
  forest: TreeNode[],
  expanded: Set<string>,
  forceAll = false,
): TreeNode[] {
  const out: TreeNode[] = []
  const walk = (list: TreeNode[]) => {
    for (const n of list) {
      out.push(n)
      if (n.children.length && (forceAll || expanded.has(n.id))) walk(n.children)
    }
  }
  walk(forest)
  return out
}

/** 收集某节点的全部后代 id（含自身） */
export function subtreeIds(nodes: GoalNode[], id: string): string[] {
  const byParent = new Map<string, string[]>()
  for (const n of nodes) {
    if (n.deleted_at || !n.parent_id) continue
    const arr = byParent.get(n.parent_id) || []
    arr.push(n.id)
    byParent.set(n.parent_id, arr)
  }
  const out: string[] = []
  const stack = [id]
  while (stack.length) {
    const cur = stack.pop()!
    out.push(cur)
    for (const c of byParent.get(cur) || []) stack.push(c)
  }
  return out
}

/** 从根到该节点的路径（不含自身） */
export function ancestorsOf(nodes: GoalNode[], id: string): GoalNode[] {
  const byId = new Map(nodes.map(n => [n.id, n]))
  const out: GoalNode[] = []
  let cur = byId.get(id)
  let guard = 0
  while (cur?.parent_id && guard++ < 50) {
    const p = byId.get(cur.parent_id)
    if (!p) break
    out.unshift(p)
    cur = p
  }
  return out
}

/**
 * 生效分类：自身未设置时向最近祖先继承。
 * 这样"父目标属于工作"时，其下所有子任务自动归属工作，无需逐个打标签。
 */
export function effectiveCategoryId(nodes: GoalNode[], id: string): string | null {
  const byId = new Map(nodes.map(n => [n.id, n]))
  let cur = byId.get(id)
  let guard = 0
  while (cur && guard++ < 50) {
    if (cur.category_id) return cur.category_id
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined
  }
  return null
}

/** 后代中的叶子节点数量 */
export function leafCount(n: TreeNode): number {
  if (!n.children.length) return 1
  return n.children.reduce((a, c) => a + leafCount(c), 0)
}

/** 后代总数（不含自身） */
export function descendantCount(n: TreeNode): number {
  return n.children.reduce((a, c) => a + 1 + descendantCount(c), 0)
}
