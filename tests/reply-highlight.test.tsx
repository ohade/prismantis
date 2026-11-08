import { expect, test } from './testing'
import type { Plugin } from 'claude-code/testing'
import type { RenderElement, RenderNode } from 'claude-code'

const NATIVE = '7c1e2d3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f'
const PROMPT = '91aa02bc-33cd-44de-85ef-96a0b1c2d3e4'
const ROW = '7c1e2d3f-4a5b-4c6d-8e9f'
const K1 = `answer:${ROW}:A1`
const K2 = `answer:${ROW}:A2`
const TINT = '#123456'
const OTHER = '#654321'

type Engine = Parameters<NonNullable<Parameters<typeof test>[2]>>[0]

const PANEL = { plugin: 'tinter', surface: 'terminal' as const, component: 'Pane' as const, requestId: 'tinter', viewport: { columns: 80, rows: 20, isFullscreen: false }, props: { title: 'Tinter', isFocused: false, bodyColumns: 60, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 10 }, view: {} } }

const tint = async ($: Engine, key: string, color: string | null): Promise<void> => {
  const panel = await $.ui.mount(PANEL)
  try {
    await panel.press({ plugin: 'tinter', key: `${key}=${color ?? 'null'}` })
  } catch {
    return
  } finally {
    await panel.unmount()
  }
}

const tinter: Plugin = {
  name: 'tinter',
  tier: 'append',
  register(on) {
    on('ui.render', { component: 'Pane', requestId: 'tinter' }, ($, e) => {
      const { Box, Button } = $.ui.resolve(e)
      const row = '7c1e2d3f-4a5b-4c6d-8e9f'
      const keys = [`answer:${row}:A1`, `answer:${row}:A2`, '7c1e2d3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f', '91aa02bc-33cd-44de-85ef-96a0b1c2d3e4']
      const colors = ['#123456', '#654321', 'null']
      const presses = keys.flatMap(key => colors.map(color => ({ key, color })))
      return <Box flexDirection="column">{presses.map(({ key, color }) => <Button key={`${key}=${color}`} label={`${key}=${color}`} onPress={() => $.prismantis.tint({ key, color: color === 'null' ? null : color })} />)}</Box>
    })
  },
}

const ownerRegister: Plugin['register'] = on => {
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const row = '7c1e2d3f-4a5b-4c6d-8e9f'
    const segments = [
      { kind: 'markdown' as const, key: 'before', text: 'Before the answers' },
      { kind: 'markdown' as const, key: `answer:${row}:A1`, text: 'First **answer**' },
      { kind: 'note' as const, key: `ack:${row}:A1`, text: '✓ Q1. answered' },
      { kind: 'markdown' as const, key: `answer:${row}:A2`, text: 'Second **answer**' },
      { kind: 'note' as const, key: `ack:${row}:A2`, text: '✓ Q2. answered' },
      { kind: 'markdown' as const, key: 'after', text: 'After the answers' },
    ]
    let drawn: RenderElement | undefined
    try {
      drawn = await $.prismantis.reply({ surface: e.surface, requestId: e.requestId, text: e.props.text, isFirstOfReply: e.props.isFirstOfReply === true, columns: e.viewport?.columns ?? 100, segments })
    } catch {
      drawn = undefined
    }
    return drawn ?? next(e)
  })
}

const outer: Plugin = { name: 'segment-owner', tier: 'prepend', register: ownerRegister }
const inner: Plugin = { name: 'segment-owner', tier: 'append', register: ownerRegister }

const propsOf = (node: RenderElement): Record<string, unknown> | undefined => ('props' in node ? (node.props as Record<string, unknown>) : undefined)

const keyOf = (node: RenderElement): string | undefined =>
  (node as { key?: string }).key ?? (propsOf(node)?.key as string | undefined)

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

const backgroundOf = (node: RenderElement | undefined): unknown => (node === undefined ? undefined : propsOf(node)?.backgroundColor)

const isFrame = (node: RenderElement): boolean => propsOf(node)?.borderStyle === 'round'

const tintedNodes = (node: RenderNode, color: string): RenderElement[] => {
  if (typeof node === 'string') return []
  const own = backgroundOf(node) === color ? [node] : []
  const children = 'children' in node && node.children ? node.children : []
  return [...own, ...children.flatMap(child => tintedNodes(child, color))]
}

const insideFrame = (trail: RenderElement[]): boolean => {
  const frame = trail.findIndex(isFrame)
  return frame >= 0 && frame < trail.length - 1
}

const mountReply = ($: Engine, surface: 'terminal' | 'desktop', text: string) =>
  $.ui.mount({ plugin: 'prismantis', component: 'AssistantMessage', requestId: NATIVE, props: { text, isFirstOfReply: true }, surface, viewport: { columns: 100, rows: 40 } })

for (const surface of ['terminal', 'desktop'] as const) {
  for (const owner of [outer, inner]) {
    const order = owner.tier === 'prepend' ? 'outer' : 'inner'

    test(`a segmented reply from an ${order} mod keeps the bubble and every segment key on ${surface}`, { plugins: [owner], options: { replyStyle: 'bubble' } }, async $ => {
      const ui = await mountReply($, surface, 'Before\n\nFirst\n\nSecond\n\nAfter')
      const drawn = await ui.drawn()
      for (const key of ['before', K1, K2, 'after']) {
        const trail = pathTo(drawn, key)
        expect(trail).toBeDefined()
        expect(insideFrame(trail ?? [])).toBe(true)
      }
      expect(await ui.find({ type: 'Text', text: /^✓ Q1\. answered$/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /^✓ Q2\. answered$/ })).toBeDefined()
      await ui.unmount()
    })

    test(`a segmented reply from an ${order} mod under replyStyle off draws themed segments with the reply marker on ${surface}`, { plugins: [owner], options: { replyStyle: 'off' } }, async $ => {
      const ui = await mountReply($, surface, 'Before\n\nFirst\n\nSecond\n\nAfter')
      const drawn = await ui.drawn()
      expect(pathTo(drawn, K1)).toBeDefined()
      expect(pathTo(drawn, K2)).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /^●$/ })).toBeDefined()
      expect(await ui.findAll({ type: 'Markdown' })).toHaveLength(0)
      await ui.unmount()
    })

    test(`a tint on one answer paints only that answer inside the bubble and clears back on ${surface} (${order} mod)`, { plugins: [owner, tinter], options: { replyStyle: 'bubble' } }, async $ => {
      const ui = await mountReply($, surface, 'Before\n\nFirst\n\nSecond\n\nAfter')
      expect(tintedNodes(await ui.drawn(), TINT)).toHaveLength(0)
      await tint($, K2, TINT)
      const lit = await ui.drawn()
      const tinted = tintedNodes(lit, TINT)
      expect(tinted).toHaveLength(1)
      expect(keyOf(tinted[0]!)).toBe(K2)
      expect(insideFrame(pathTo(lit, K2) ?? [])).toBe(true)
      await tint($, K2, null)
      expect(tintedNodes(await ui.drawn(), TINT)).toHaveLength(0)
      expect(pathTo(await ui.drawn(), K2)).toBeDefined()
      await ui.unmount()
    })

    test(`moving a tint from the first answer to the second leaves only the second lit on ${surface} (${order} mod)`, { plugins: [owner, tinter], options: { replyStyle: 'bubble' } }, async $ => {
      const ui = await mountReply($, surface, 'Before\n\nFirst\n\nSecond\n\nAfter')
      await tint($, K1, OTHER)
      expect(tintedNodes(await ui.drawn(), OTHER).map(keyOf)).toEqual([K1])
      await tint($, K1, null)
      await tint($, K2, TINT)
      const drawn = await ui.drawn()
      expect(tintedNodes(drawn, OTHER)).toHaveLength(0)
      expect(tintedNodes(drawn, TINT).map(keyOf)).toEqual([K2])
      await ui.unmount()
    })
  }

  test(`a tint on a plain reply's request id paints inside its bubble on ${surface}`, { plugins: [tinter], options: { replyStyle: 'bubble' } }, async $ => {
    const ui = await mountReply($, surface, 'A plain **reply** with no answers')
    expect(tintedNodes(await ui.drawn(), TINT)).toHaveLength(0)
    await tint($, NATIVE, TINT)
    const drawn = await ui.drawn()
    const tinted = tintedNodes(drawn, TINT)
    expect(tinted).toHaveLength(1)
    const key = keyOf(tinted[0]!)
    expect(key).toBeDefined()
    expect(insideFrame(pathTo(drawn, key ?? '') ?? [])).toBe(true)
    await tint($, NATIVE, null)
    expect(tintedNodes(await ui.drawn(), TINT)).toHaveLength(0)
    await ui.unmount()
  })

  test(`a tint on a prompt's request id paints inside the prompt bubble on ${surface}`, { plugins: [tinter], options: { promptStyle: 'bubble' } }, async $ => {
    const ui = await $.ui.mount({ plugin: 'prismantis', component: 'UserMessage', requestId: PROMPT, props: { text: 'Where is the prompt?', origin: { kind: 'composer' }, isExpanded: false }, surface, viewport: { columns: 100, rows: 40 } })
    expect(tintedNodes(await ui.drawn(), TINT)).toHaveLength(0)
    await tint($, PROMPT, TINT)
    expect(tintedNodes(await ui.drawn(), TINT)).toHaveLength(1)
    await tint($, PROMPT, null)
    expect(tintedNodes(await ui.drawn(), TINT)).toHaveLength(0)
    await ui.unmount()
  })

  test(`a tint for another request id leaves this reply unlit on ${surface}`, { plugins: [tinter], options: { replyStyle: 'bubble' } }, async $ => {
    const ui = await mountReply($, surface, 'A plain **reply** with no answers')
    await tint($, PROMPT, TINT)
    expect(tintedNodes(await ui.drawn(), TINT)).toHaveLength(0)
    await ui.unmount()
  })
}
