import type { Application } from 'pixi.js'
import type { Live2DModel } from 'untitled-pixi-live2d-engine/cubism'
import { createBlinkState, stepBlink, type BlinkState } from './blink.ts'
import {
  BREATH_DEPTH, CUBISM_CORE_PATH, FALLBACK_EYE_BLINK_IDS, FOCUS_ORIGIN_Y, FOCUS_STRENGTH, OFFSET_PERCENT,
} from './live2d-constants.ts'

export type Live2DLayout = { scale: number; offsetX: number; offsetY: number }
export type Live2DStatus = 'loading' | 'ready' | 'error'

type Engine = typeof import('untitled-pixi-live2d-engine/cubism')
type Pixi = typeof import('pixi.js')
type ModelSettings = {
  FileReferences?: { Expressions?: { Name?: string; File?: string }[] } & Record<string, unknown>
  Groups?: { Name?: string; Ids?: string[] }[]
} & Record<string, unknown>
/** The parts of the library's expression manager used to add server-provided expressions at runtime. */
type ExpressionManager = {
  definitions: { Name?: string; File: string }[]
  reserveExpressionIndex: number
  currentExpression: unknown
  defaultExpression: unknown
  setExpression(index: number): Promise<boolean>
  resetExpression(): void
}
type CoreModel = {
  getParameterCount(): number
  getParameterId(index: number): { getString(): { s: string } }
  getParameterValueByIndex(index: number): number
  setParameterValueByIndex(index: number, value: number): void
}

let corePromise: Promise<void> | null = null
function loadCore(baseUrl: string) {
  if ('Live2DCubismCore' in window) return Promise.resolve()
  corePromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = new URL(CUBISM_CORE_PATH, baseUrl).href
    script.onload = () => resolve()
    script.onerror = () => {
      corePromise = null
      script.remove()
      reject(new Error('Cubism Core를 불러오지 못했어요.'))
    }
    document.head.append(script)
  })
  return corePromise
}

let enginePromise: Promise<{ pixi: Pixi; engine: Engine }> | null = null
/** The engine checks for the Core global when its module runs, so it is imported only after the Core script loads. */
function loadEngine(baseUrl: string) {
  enginePromise ??= loadCore(baseUrl)
    .then(() => Promise.all([import('pixi.js'), import('untitled-pixi-live2d-engine/cubism')]))
    .then(([pixi, engine]) => {
      pixi.extensions.add(engine.Live2DPlugin)
      // The default start-up logs every Cubism message; keep only errors.
      engine.startUpCubism({ logFunction: (message: string) => console.error(message), loggingLevel: 4 } as unknown as Parameters<Engine['startUpCubism']>[0])
      return { pixi, engine }
    })
  enginePromise.catch(() => { enginePromise = null })
  return enginePromise
}

const clamp = (value: number) => Math.max(-1, Math.min(1, value))
/**
 * While a tile keeps changing size (the chat panel sliding open), the drawing buffer is reallocated once this long
 * after the last change instead of on every frame. Reallocating a full-screen buffer each frame stutters.
 */
export const RESIZE_SETTLE_MS = 140

/**
 * One WebGL canvas and one model for the study page.
 * The canvas moves between tiles (grid, focus, small, rest) instead of creating a new context per tile.
 */
export class Live2DStage {
  private status: Live2DStatus = 'loading'
  private readonly listeners = new Set<() => void>()
  private app: Application | null = null
  private model: Live2DModel | null = null
  private hosts: HTMLElement[] = []
  private observer: ResizeObserver | null = null
  /** The host the drawing buffer was last sized for; a new host is sized at once. */
  private sizedHost: HTMLElement | null = null
  private settleTimer: ReturnType<typeof setTimeout> | undefined
  private destroyed = false
  private tracking = false
  private expression: string | null = null
  private blink: BlinkState = createBlinkState(performance.now())
  private readonly modelJsonUrl: string
  private readonly layout: Live2DLayout

  constructor(modelJsonUrl: string, layout: Live2DLayout, baseUrl: string) {
    this.modelJsonUrl = modelJsonUrl
    this.layout = layout
    this.load(baseUrl).catch((error: unknown) => {
      if (this.destroyed) return
      console.warn('Live2D 모델을 불러오지 못했어요.', error)
      this.teardown()
      this.setStatus('error')
    })
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  getStatus = () => this.status

  private setStatus(status: Live2DStatus) {
    if (this.status === status) return
    this.status = status
    for (const listener of this.listeners) listener()
  }

  private async load(baseUrl: string) {
    const { pixi, engine } = await loadEngine(baseUrl)
    if (this.destroyed) return
    const response = await fetch(this.modelJsonUrl, { credentials: 'omit' })
    if (!response.ok) throw new Error(`model3.json ${response.status}`)
    const settings = await response.json() as ModelSettings
    if (this.destroyed) return
    // An expression manager exists only when Expressions is declared; server files may be added later.
    const references = settings.FileReferences ?? {}
    settings.FileReferences = { ...references, Expressions: references.Expressions ?? [] }
    const app = new pixi.Application()
    await app.init({
      preference: 'webgl', backgroundAlpha: 0, antialias: true, autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2), width: 1, height: 1,
    })
    if (this.destroyed) { app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true }); return }
    this.app = app
    app.canvas.className = 'live2d-canvas'
    app.canvas.setAttribute('aria-hidden', 'true')
    const model = await engine.Live2DModel.from({ ...settings, url: this.modelJsonUrl }, {
      // Study time keeps the face forward; cursor tracking is driven manually during breaks only.
      autoFocus: false, autoHitTest: false, ticker: app.ticker,
      // Blinking is applied as a multiplier below so it never undoes closed-eye expressions.
      eyeBlink: false, breathDepth: BREATH_DEPTH,
    })
    if (this.destroyed) {
      // The app (and its ticker) is already gone; nothing else holds this model.
      try { model.destroy({ children: true }) } catch { /* Ticker already destroyed. */ }
      return
    }
    this.model = model
    app.stage.addChild(model)
    this.startBlinking(model, settings)
    this.mount()
    if (this.expression) void this.applyExpression()
    this.setStatus('ready')
  }

  private startBlinking(model: Live2DModel, settings: ModelSettings) {
    const group = settings.Groups?.find((value) => value?.Name === 'EyeBlink')
    const ids = group?.Ids?.length ? group.Ids : FALLBACK_EYE_BLINK_IDS
    const core = (model.internalModel as unknown as { coreModel: CoreModel }).coreModel
    const eyes: number[] = []
    for (let index = 0; index < core.getParameterCount(); index++) {
      if (ids.includes(core.getParameterId(index).getString().s)) eyes.push(index)
    }
    if (!eyes.length) return
    model.internalModel.on('beforeModelUpdate', () => {
      const step = stepBlink(this.blink, performance.now())
      this.blink = step.state
      if (step.factor >= 1) return
      for (const index of eyes) core.setParameterValueByIndex(index, core.getParameterValueByIndex(index) * step.factor)
    })
  }

  /** The most recently mounted tile shows the model; earlier tiles keep their place in line. */
  attach(host: HTMLElement) {
    this.hosts = [...this.hosts.filter((value) => value !== host), host]
    this.mount()
  }
  detach(host: HTMLElement) {
    this.hosts = this.hosts.filter((value) => value !== host)
    this.mount()
  }

  private mount() {
    const app = this.app
    const host = this.hosts.at(-1)
    this.observer?.disconnect()
    if (!app || !this.model) return
    if (!host) {
      app.canvas.remove()
      app.ticker.stop()
      return
    }
    if (app.canvas.parentElement !== host) host.append(app.canvas)
    this.observer ??= new ResizeObserver(() => this.place())
    this.observer.observe(host)
    app.ticker.start()
    this.place()
  }

  /**
   * Fits the model to its tile. The first size on a host resizes the buffer at once; later changes keep the current
   * buffer (centered and clipped by the tile, see live2d.css) until the size settles, then resize once.
   */
  private place(settled = false) {
    const app = this.app
    const model = this.model
    const host = this.hosts.at(-1)
    if (!app || !model || !host) return
    const width = host.clientWidth
    const height = host.clientHeight
    if (!width || !height) return
    if (app.renderer.width !== width || app.renderer.height !== height) {
      clearTimeout(this.settleTimer)
      this.settleTimer = undefined
      if (settled || this.sizedHost !== host) {
        app.renderer.resize(width, height)
        this.sizedHost = host
      } else {
        this.settleTimer = setTimeout(() => { this.settleTimer = undefined; this.place(true) }, RESIZE_SETTLE_MS)
      }
    }
    const { originalWidth, originalHeight } = model.internalModel
    const fit = Math.min(width / originalWidth, height / originalHeight) * this.layout.scale
    model.scale.set(fit)
    model.anchor.set(0.5, 0.5)
    // Canvas coordinates: the canvas is centered on the tile, so its center is the tile's center.
    model.position.set(
      app.renderer.width / 2 + (this.layout.offsetX / OFFSET_PERCENT) * width,
      app.renderer.height / 2 + (this.layout.offsetY / OFFSET_PERCENT) * height,
    )
    // ResizeObserver runs after the ticker's animation frame. Resizing clears
    // the canvas, so repaint the newly placed model before the browser presents it.
    app.render()
  }

  /** Breaks only: the face follows the cursor. Turning it off eases the face back to the front. */
  setTracking(enabled: boolean) {
    if (this.tracking === enabled) return
    this.tracking = enabled
    if (enabled) window.addEventListener('pointermove', this.onPointerMove, { passive: true })
    else {
      window.removeEventListener('pointermove', this.onPointerMove)
      this.look(0, 0)
    }
  }

  private onPointerMove = (event: PointerEvent) => {
    const canvas = this.app?.canvas
    if (!canvas?.isConnected) return
    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const x = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)
    const y = (rect.top + rect.height * FOCUS_ORIGIN_Y - event.clientY) / (rect.height / 2)
    this.look(clamp(x) * FOCUS_STRENGTH, clamp(y) * FOCUS_STRENGTH)
  }

  /** The focus controller eases toward the target, so leaving a break returns to the front smoothly. */
  private look(x: number, y: number) {
    this.model?.internalModel.focusController.focus(x, y)
  }

  /** `file` is relative to the model folder (as the server sends it); `null` fades back to the default face. */
  setExpression(file: string | null) {
    this.expression = file
    void this.applyExpression()
  }

  private async applyExpression() {
    const manager = this.model?.internalModel.motionManager.expressionManager as unknown as ExpressionManager | undefined
    if (!manager) return
    const file = this.expression
    if (file === null) {
      manager.reserveExpressionIndex = -1
      manager.resetExpression()
      // The library keeps the old face as "current" after a reset, which would block showing it again.
      manager.currentExpression = manager.defaultExpression
      return
    }
    let index = manager.definitions.findIndex((definition) => definition.File === file)
    if (index < 0) index = manager.definitions.push({ Name: file, File: file }) - 1
    try {
      await manager.setExpression(index)
    } catch (error) {
      console.warn('Live2D 표정을 적용하지 못했어요.', error)
    }
  }

  private teardown() {
    window.removeEventListener('pointermove', this.onPointerMove)
    clearTimeout(this.settleTimer)
    this.settleTimer = undefined
    this.observer?.disconnect()
    this.observer = null
    const app = this.app
    const model = this.model
    this.app = null
    this.model = null
    try {
      // The model unhooks from the ticker on destroy, and Application.destroy tears the ticker down first.
      if (model) {
        model.parent?.removeChild(model)
        model.destroy({ children: true })
      }
      if (!app) return
      const gl = (app.renderer as { gl?: WebGLRenderingContext }).gl
      app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true })
      // Release the context explicitly so GPU memory frees as soon as the page is left.
      if (gl && !gl.isContextLost()) gl.getExtension('WEBGL_lose_context')?.loseContext()
    } catch (error) {
      console.warn('Live2D 정리 중 문제가 있었어요.', error)
    }
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.teardown()
    this.listeners.clear()
  }
}
