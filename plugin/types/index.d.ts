export type PrismantisMarkdownArgs<Surface> = {
  surface: Surface
  text: string
  columns: number
}

export type PrismantisReplySegment =
  | { kind: 'markdown'; key: string; text: string }
  | { kind: 'note'; key: string; text: string }

export type PrismantisReplyArgs<Surface> = {
  surface: Surface
  requestId: string
  text: string
  isFirstOfReply: boolean
  columns: number
  segments: PrismantisReplySegment[]
}

export type PrismantisTintArgs = {
  key: string
  color: string | null
}

export type Prismantis<Surface, Drawing> = {
  markdown: (args: PrismantisMarkdownArgs<Surface>) => Promise<Drawing | undefined>
  reply: (args: PrismantisReplyArgs<Surface>) => Promise<Drawing | undefined>
  tint: (args: PrismantisTintArgs) => Promise<void>
}

declare module 'claude-code' {
  interface EngineInterface {
    prismantis: Prismantis<RenderSurface, RenderElement>
  }
  interface PluginState {
    prismantis: {
      formulas: Record<string, unknown>
      dir: string
      unfolded: string[]
      sent: { text: string; at: number }[]
      turnEnds: { durationMs: number; at: number }[]
      setupAt: number
      setupFocus: string
      setupLand: string
      foundPaths: string[]
      awaiting: { key: string; at: number }[]
      blink: boolean
      drawn: StateFamily<number>
      tints: StateFamily<string | null>
    }
  }
}
