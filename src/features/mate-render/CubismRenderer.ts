import type { Live2DLayout, Live2DStage } from '@/features/live2d/live2d-stage'
import type { MateRenderStatus, MateRenderer } from './types'

/**
 * Cubism (.model3.json) adapter wrapping the existing Live2DStage without altering its behavior.
 */
export class CubismRenderer implements MateRenderer {
  private stage: Live2DStage | null = null
  private host: HTMLElement | null = null
  private status: MateRenderStatus = 'loading'
  private paused = false
  private pendingExpression: string | null | undefined = undefined
  private pendingLook: { x: number; y: number } | null = null
  private destroyed = false
  private unsubscribeStage: (() => void) | null = null
  private readonly listeners = new Set<() => void>()
  private readonly modelJsonUrl: string
  private readonly layout: Live2DLayout
  private readonly baseUrl: string

  constructor(modelJsonUrl: string, layout: Live2DLayout, baseUrl: string) {
    this.modelJsonUrl = modelJsonUrl
    this.layout = layout
    this.baseUrl = baseUrl
    void this.init()
  }

  private async init() {
    try {
      const { Live2DStage: StageClass } = await import('@/features/live2d/live2d-stage')
      if (this.destroyed) return
      const stage = new StageClass(this.modelJsonUrl, this.layout, this.baseUrl)
      this.stage = stage
      if (this.host) stage.attach(this.host)
      stage.setTracking(true)
      stage.setPaused(this.paused)
      this.unsubscribeStage = stage.subscribe(() => {
        const next = stage.getStatus()
        this.setStatus(next)
        if (next === 'ready') {
          if (this.pendingExpression !== undefined) stage.setExpression(this.pendingExpression)
          if (this.pendingLook) stage.lookAt(this.pendingLook.x, this.pendingLook.y)
        }
      })
      this.setStatus(stage.getStatus())
    } catch {
      if (!this.destroyed) this.setStatus('error')
    }
  }

  private setStatus(next: MateRenderStatus) {
    if (this.status === next) return
    this.status = next
    for (const listener of this.listeners) listener()
  }

  attach(host: HTMLElement): void {
    this.host = host
    this.stage?.attach(host)
  }

  detach(): void {
    if (this.host && this.stage) this.stage.detach(this.host)
    this.host = null
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.unsubscribeStage?.()
    this.unsubscribeStage = null
    if (this.host && this.stage) this.stage.detach(this.host)
    this.stage?.destroy()
    this.stage = null
    this.host = null
    this.listeners.clear()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getStatus(): MateRenderStatus {
    return this.status
  }

  setPaused(paused: boolean): void {
    this.paused = paused
    this.stage?.setPaused(paused)
  }

  lookAt(x: number, y: number): void {
    this.pendingLook = { x, y }
    this.stage?.lookAt(x, y)
  }

  setExpression(name: string | null): void {
    this.pendingExpression = name
    this.stage?.setExpression(name)
  }

  talk(_ms: number): void {
    void _ms
    // Cubism login stage does not loop talk motions directly.
  }
}
