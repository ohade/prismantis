import { test as engineTest } from 'claude-code/testing'
import type { TestOptions, TestRest } from 'claude-code/testing'
import type { RenderNode } from 'claude-code'

export * from 'claude-code/testing'

const containsEngine = (node: RenderNode): boolean => {
  if (typeof node === 'string') return false
  if (node.type === 'engine') return true
  return 'children' in node && node.children !== undefined && node.children.some(containsEngine)
}

export const engineIsDrawn = async (ui: { drawn: () => Promise<RenderNode> }): Promise<boolean> => containsEngine(await ui.drawn())

export const test = (name: string, ...rest: TestRest): void => {
  const options: TestOptions = rest.length === 1 ? {} : rest[0]
  const body = rest.length === 1 ? rest[0] : rest[1]
  engineTest(name, options, async ($, on) => {
    let hasRenderer = false
    const hooks = new Proxy(on, {
      apply(target, receiver, args) {
        if (args[0] === 'ui.render') hasRenderer = true
        return Reflect.apply(target, receiver, args)
      },
    })
    const engine = new Proxy({ ...$ }, {
      get(target, noun) {
        const namespace = Reflect.get(target, noun)
        if (namespace === null || typeof namespace !== 'object') return namespace
        return new Proxy({ ...namespace }, {
          get(target, event) {
            const call = Reflect.get(target, event)
            if (typeof call !== 'function') return call
            return (...args: unknown[]) => {
              if (!hasRenderer) {
                on('ui.render', () => ({ type: 'engine', ref: 0 }))
                hasRenderer = true
              }
              return Reflect.apply(call, target, args)
            }
          },
        })
      },
    })
    return body(engine, hooks)
  })
}
