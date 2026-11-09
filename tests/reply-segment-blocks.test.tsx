import { expect, test } from './testing'
import type { Plugin } from 'claude-code/testing'
import type { RenderElement, RenderNode } from 'claude-code'

const NATIVE = '7c1e2d3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f'
const ANSWER = 'answer:7c1e2d3f-4a5b-4c6d-8e9f:A1'

const longCode = ['```text', ...Array.from({ length: 60 }, (_, i) => `line ${i}`), '```'].join('\n')

const BODIES: [string, string][] = [
  ['a bullet list', 'Yes.\n\n- **one:** a\n- **two:** b'],
  ['a short code block', 'Yes.\n\n```bash\necho hi\n```'],
  ['a long code block', `Yes.\n\n${longCode}`],
  ['a table', 'Yes.\n\n| a | b |\n|---|---|\n| 1 | 2 |'],
  ['a mermaid diagram', 'Yes.\n\n```mermaid\nflowchart LR\n  A --> B\n```'],
]

const ownerFor = (tier: 'prepend' | 'append'): Plugin => ({
  name: 'segment-owner',
  tier,
  register(on) {
    on('ui.render', { component: 'AssistantMessage' }, async ($, e) => {
      const segments = [
        { kind: 'markdown' as const, key: 'answer:7c1e2d3f-4a5b-4c6d-8e9f:A1', text: e.props.text },
        { kind: 'note' as const, key: 'ack:7c1e2d3f-4a5b-4c6d-8e9f:A1', text: '✓ Q1. answered' },
      ]
      const { Text } = $.ui.resolve(e)
      let drawn: RenderElement | undefined
      try {
        drawn = await $.prismantis.reply({ surface: e.surface, requestId: e.requestId, text: e.props.text, isFirstOfReply: e.props.isFirstOfReply === true, columns: e.viewport?.columns ?? 100, segments })
      } catch {
        drawn = undefined
      }
      return drawn ?? <Text key="owner-fallback">owner fallback</Text>
    })
  },
})

const propsOf = (node: RenderElement): Record<string, unknown> | undefined => ('props' in node ? (node.props as Record<string, unknown>) : undefined)

const keyOf = (node: RenderElement): string | undefined => (node as { key?: string }).key ?? (propsOf(node)?.key as string | undefined)

const pathTo = (node: RenderNode, key: string, trail: RenderElement[] = []): RenderElement[] | undefined => {
  if (typeof node === 'string') return undefined
  const here = [...trail, node]
  if (keyOf(node) === key) return here
  const children = 'children' in node && node.children ? node.children : []
  for (const child of children) {
    const found = pathTo(child, key, here)
    if (found) return found
  }
  return undefined
}

const insideFrame = (trail: RenderElement[]): boolean => {
  const frame = trail.findIndex(node => propsOf(node)?.borderStyle === 'round')
  return frame >= 0 && frame < trail.length - 1
}

for (const surface of ['terminal', 'desktop'] as const) {
  for (const tier of ['prepend', 'append'] as const) {
    for (const [name, body] of BODIES) {
      test(`a segment holding ${name} still comes back framed to the ${tier === 'prepend' ? 'outer' : 'inner'} mod on ${surface}`, { plugins: [ownerFor(tier)], options: { replyStyle: 'bubble' } }, async $ => {
        const ui = await $.ui.mount({ plugin: 'prismantis', component: 'AssistantMessage', requestId: NATIVE, props: { text: body, isFirstOfReply: true }, surface, viewport: { columns: 100, rows: 40 } })
        const drawn = await ui.drawn()
        expect(await ui.find({ type: 'Text', text: /^owner fallback$/ })).toBeUndefined()
        expect(insideFrame(pathTo(drawn, ANSWER) ?? [])).toBe(true)
        await ui.unmount()
      })
    }
  }
}
