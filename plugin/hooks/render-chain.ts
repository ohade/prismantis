import type { RenderElement, RenderNode } from 'claude-code'

const engineCount = (node: RenderNode): number => {
  if (typeof node === 'string') return 0
  if (node.type === 'engine') return 1
  return 'children' in node && node.children ? node.children.reduce((count, child) => count + engineCount(child), 0) : 0
}

const replaceEngine = (node: RenderNode, body: RenderElement): RenderNode => {
  if (typeof node === 'string') return node
  if (node.type === 'engine') return body
  if (!('children' in node) || !node.children) return node
  const original = node.children
  const children = original.map(child => replaceEngine(child, body))
  return children.some((child, index) => child !== original[index]) ? { ...node, children } as RenderElement : node
}

export const composeEngine = (downstream: RenderElement, body: RenderElement): RenderElement =>
  engineCount(downstream) === 1 ? replaceEngine(downstream, body) as RenderElement : downstream
