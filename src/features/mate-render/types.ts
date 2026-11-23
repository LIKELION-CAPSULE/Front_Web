export type MateRenderStatus = 'loading' | 'ready' | 'error'

export interface MateRenderer {
  attach(host: HTMLElement): void
  detach(): void
  destroy(): void
  subscribe(listener: () => void): () => void
  getStatus(): MateRenderStatus
  setPaused(paused: boolean): void
  lookAt(x: number, y: number): void
  setExpression(name: string | null): void
  talk(ms: number): void
  setView?(zoom: number, cx: number, cy: number): void
}
