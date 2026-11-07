import { expect, test } from './testing'
import type { Plugin } from 'claude-code/testing'

const TEXT = 'Render chain body'

const observer: Plugin = {
  name: 'render-observer',
  tier: 'append',
  register(on) {
    on('ui.render', async ($, e, next) => {
      if (e.component !== 'UserMessage' && e.component !== 'AssistantMessage') return next(e)
      const { Box, Text, Button } = $.ui.resolve(e)
      return <Box key="downstream-wrapper">
        <Text>Downstream decoration</Text>
        <Button key="downstream-action" onPress={() => $.ui.toast('Downstream action pressed')}>Downstream action</Button>
        {await next(e)}
      </Box>
    })
  },
}

const replacement: Plugin = {
  name: 'render-owner',
  tier: 'append',
  register(on) {
    on('ui.render', { component: 'AssistantMessage' }, ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text color="#010203">Downstream owns this message</Text>
    })
  },
}

const ambiguous: Plugin = {
  name: 'render-owner',
  tier: 'append',
  register(on) {
    on('ui.render', { component: 'AssistantMessage' }, ($, e) => {
      const { Box, Text } = $.ui.resolve(e)
      return <Box key="ambiguous-wrapper"><Text>Ambiguous downstream content</Text>{{ type: 'engine', ref: 0 }}{{ type: 'engine', ref: 0 }}</Box>
    })
  },
}

const answers: Plugin = {
  name: 'answer-owner',
  tier: 'append',
  register(on) {
    on('ui.render', { component: 'AssistantMessage' }, ($, e) => {
      const { Box, Markdown, Text } = $.ui.resolve(e)
      return <Box flexDirection="column">
        <Markdown text="Before the answers" />
        <Box key="answer:first"><Markdown text="First **answer**" /></Box>
        <Text dimColor>✓ Q1. answered</Text>
        <Box key="answer:second"><Markdown text="Second **answer**" /></Box>
        <Text dimColor>✓ Q2. answered</Text>
      </Box>
    })
  },
}

for (const component of ['UserMessage', 'AssistantMessage'] as const) {
  for (const surface of ['terminal', 'desktop'] as const) {
    test(`${component} on ${surface} passes the original request through and preserves a downstream wrapper action`, { plugins: [observer] }, async ($, on) => {
      const observed: { requestId: string; text: string }[] = []
      const requestId = `chain-${component}-${surface}`
      let presses = 0
      on('ui.render', (_, e) => {
        if (e.component === component && (e.component === 'UserMessage' || e.component === 'AssistantMessage')) {
          observed.push({ requestId: e.requestId, text: e.props.text })
        }
        return { type: 'engine', ref: 0 }
      })
      on('ui.toast', (_, e) => {
        if (e.text === 'Downstream action pressed') presses += 1
        return { value: undefined }
      })
      const request = component === 'UserMessage'
        ? { component: 'UserMessage' as const, props: { text: TEXT, origin: { kind: 'composer' as const }, isExpanded: false } }
        : { component: 'AssistantMessage' as const, props: { text: TEXT, isFirstOfReply: true } }
      const ui = await $.ui.mount({ ...request, requestId, plugin: 'prismantis', surface, viewport: { columns: 120, rows: 40 } })
      expect(observed.length).toBeGreaterThan(0)
      expect(observed.every(row => row.requestId === requestId && row.text === TEXT)).toBe(true)
      expect(await ui.find({ key: 'downstream-wrapper' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /^Downstream decoration$/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /^Render chain body$/ })).toBeDefined()
      await ui.press({ plugin: 'render-observer', key: 'downstream-action' })
      expect(presses).toBe(1)
      await ui.unmount()
    })
  }
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`a downstream replacement with no native engine leaf remains unchanged on ${surface}`, { plugins: [replacement] }, async $ => {
    const ui = await $.ui.mount({ plugin: 'prismantis', component: 'AssistantMessage', props: { text: TEXT, isFirstOfReply: true }, surface })
    expect(await ui.drawn()).toMatchObject({ type: 'Text', props: { color: '#010203' }, children: ['Downstream owns this message'], part: { plugin: 'render-owner' } })
    expect(await ui.find({ type: 'Text', text: /^Render chain body$/ })).toBeUndefined()
    await ui.unmount()
  })

  test(`an ambiguous downstream tree keeps its two native leaves on ${surface}`, { plugins: [ambiguous] }, async $ => {
    const ui = await $.ui.mount({ plugin: 'prismantis', component: 'AssistantMessage', props: { text: TEXT, isFirstOfReply: true }, surface })
    expect(await ui.find({ key: 'ambiguous-wrapper' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^Ambiguous downstream content$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^Render chain body$/ })).toBeUndefined()
    await ui.unmount()
  })

  test(`a downstream answer layout retains its distinct answer keys and acknowledgements on ${surface}`, { plugins: [answers] }, async $ => {
    const ui = await $.ui.mount({ plugin: 'prismantis', component: 'AssistantMessage', props: { text: TEXT, isFirstOfReply: true }, surface })
    expect(await ui.find({ key: 'answer:first' })).toBeDefined()
    expect(await ui.find({ key: 'answer:second' })).toBeDefined()
    expect(await ui.findAll({ type: 'Markdown' })).toHaveLength(3)
    expect(await ui.find({ type: 'Text', text: /^✓ Q1\. answered$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^✓ Q2\. answered$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^Render chain body$/ })).toBeUndefined()
    await ui.unmount()
  })
}
