import type { ExpressionRef, Figure } from '../../shared/api/types.ts'
import type { Live2DLayout, Live2DStage } from './live2d-stage.ts'
import { detectModelFormat, resolvePreviewSource, type AllowlistOptions, type PreviewMateSource } from '../mate-render/mate-source.ts'

export type SessionModelStage = Pick<Live2DStage, 'subscribe' | 'getStatus' | 'attach' | 'detach' | 'setTracking' | 'setExpression' | 'destroy'> & {
  /**
   * The key this stage draws for a server expression. Absent (Cubism, review image): the scheduler keys by the
   * server `file`. v2 (Aliving2D) draws by expression name, so it maps `file` (legacy Cubism files) or `name`
   * (the Korean label the backend sends) to a v2 name; `null` when it has no matching face.
   */
  expressionKey?(expression: ExpressionRef | null | undefined): string | null
  /**
   * v2 only: mouth movement while a line is typing on screen. The screen turns it on when text starts appearing and
   * off when it finishes, is skipped or is cancelled (while a voice plays, the voice moves the mouth instead).
   */
  setTalking?(active: boolean): void
  /**
   * The mouth follows a voice (voice-player.ts `level`): read every frame the model draws, 0–1, `null` while no voice
   * plays (the mouth is then the model's own). Cubism and v2 stages both have it.
   */
  setMouthSource?(source: (() => number | null) | null): void
  /** A small nod (a tap on the mate); v2 stages only. */
  nudge?(): void
  /** v2 only: plays a backend trigger from the model's reaction table (`reactionsUrl`). False when it has none. */
  react?(trigger: string, intensity?: number): boolean
}
/** Legacy stage (Cubism `.model3.json`, or the review workbench's image stage). */
export type SessionModelFactory = (url: string, layout: Live2DLayout) => SessionModelStage
export type AlivingSessionSource = Extract<PreviewMateSource, { kind: 'aliving' }>
export type SessionModelOptions = {
  /** Still image the v2 stage shows if the live model breaks after it was ready (the screen's own fallback image). */
  stillImage?: string
}
/** v2 (Aliving2D) stage. Injected by the app so this module stays free of DOM/engine code. */
export type AlivingStageFactory = (source: AlivingSessionSource, options: SessionModelOptions) => SessionModelStage

/**
 * The session's character (`Figure`) plus the draft v2 fields (docs/MATE_MODEL_V2_CONTRACT.md). Read from the raw
 * start/resume response, so they need no change to the OpenAPI-mirrored `Figure` type.
 */
export type SessionFigure = Figure & { format?: unknown; engineUrl?: unknown; playerUrl?: unknown; reactionsUrl?: unknown }

const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : undefined

function waitForModel(stage: SessionModelStage, signal: AbortSignal, timeoutMs: number) {
  return new Promise<void>((resolve, reject) => {
    let finished = false
    let unsubscribe = () => {}
    const timer = Number.isFinite(timeoutMs) ? setTimeout(() => finish(new Error('메이트를 불러오는 데 시간이 걸리고 있어요. 다시 시도해 주세요.')), timeoutMs) : undefined
    function finish(error?: unknown) {
      if (finished) return
      finished = true
      clearTimeout(timer)
      unsubscribe()
      signal.removeEventListener('abort', abort)
      if (error) reject(error)
      else resolve()
    }
    function abort() { finish(new Error('메이트 불러오기를 취소했어요.')) }
    function check() {
      if (stage.getStatus() === 'ready') finish()
      else if (stage.getStatus() === 'error') finish(new Error('메이트를 불러오지 못했어요. 다시 시도해 주세요.'))
    }
    unsubscribe = stage.subscribe(check)
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
    else check()
  })
}

const finite = (value: number | undefined, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback

/**
 * Prepares one model before navigation and hands the same canvas to the study screen.
 *
 * - Cubism / any non-v2 model URL: the legacy factory; a load failure blocks entry (unchanged).
 * - v2 (Aliving2D) with an allowlisted engine: the v2 factory. If the engine or model cannot load (or takes longer
 *   than `alivingTimeoutMs`), entry continues with `null`: the screen shows the v2 still image and line bubbles only
 *   (docs/DESIGN_CHANGE_NOTICE_BACKEND.md §11 "이 정보가 없을 때 프런트 동작").
 * - v2 without an engine URL, or one on a foreign origin: `null` (still image) without loading anything.
 * - No `modelJsonUrl` at all: entry is blocked, as before.
 */
export class SessionModel {
  private stage: SessionModelStage | null = null
  private key = ''
  private pending: Promise<SessionModelStage | null> | null = null
  private controller: AbortController | null = null
  private readonly create: SessionModelFactory
  private readonly timeoutMs: number
  private readonly createAliving?: AlivingStageFactory
  private readonly allowlist: () => AllowlistOptions
  private readonly alivingTimeoutMs: number

  constructor(create: SessionModelFactory, timeoutMs = 60_000, options: {
    createAliving?: AlivingStageFactory
    allowlist?: () => AllowlistOptions
    alivingTimeoutMs?: number
  } = {}) {
    this.create = create
    this.timeoutMs = timeoutMs
    this.createAliving = options.createAliving
    this.allowlist = options.allowlist ?? (() => ({}))
    this.alivingTimeoutMs = Math.min(timeoutMs, options.alivingTimeoutMs ?? 20_000)
  }

  prepare(figure: SessionFigure | undefined, options: SessionModelOptions = {}): Promise<SessionModelStage | null> {
    if (!figure?.modelJsonUrl) return Promise.reject(new Error('메이트 모델 정보를 불러오지 못했어요. 다시 시도해 주세요.'))
    const format = text(figure.format)
    if (detectModelFormat(figure.modelJsonUrl, format) === 'aliving2d') {
      const source = resolvePreviewSource({
        modelJsonUrl: figure.modelJsonUrl, format: 'aliving2d',
        engineUrl: text(figure.engineUrl), playerUrl: text(figure.playerUrl), reactionsUrl: text(figure.reactionsUrl),
      }, this.allowlist())
      return this.prepareAliving(source, options)
    }
    const scale = finite(figure.scale, 1)
    const layout = { scale: scale > 0 ? scale : 1, offsetX: finite(figure.offsetX, 0), offsetY: finite(figure.offsetY, 0) }
    const key = JSON.stringify([figure.modelJsonUrl, layout])
    if (this.key === key && this.stage) {
      if (this.pending) return this.pending
      if (this.stage.getStatus() === 'ready') return Promise.resolve(this.stage)
    }
    this.release()
    const stage = this.create(figure.modelJsonUrl, layout)
    const controller = new AbortController()
    this.stage = stage
    this.key = key
    this.controller = controller
    const pending = waitForModel(stage, controller.signal, this.timeoutMs).then(() => stage).catch(error => {
      if (this.stage === stage) this.release()
      throw error
    })
    this.pending = pending
    void pending.then(() => { if (this.pending === pending) this.pending = null }, () => { if (this.pending === pending) this.pending = null })
    return pending
  }

  private prepareAliving(source: PreviewMateSource, options: SessionModelOptions): Promise<SessionModelStage | null> {
    const create = this.createAliving
    if (source.kind !== 'aliving' || !create) {
      // Nothing to load: the screen shows the still image.
      this.release()
      return Promise.resolve(null)
    }
    const key = JSON.stringify(['aliving', source.modelUrl, source.engineUrl, source.playerUrl, source.reactionsUrl ?? ''])
    if (this.key === key && this.stage) {
      if (this.pending) return this.pending
      if (this.stage.getStatus() === 'ready') return Promise.resolve(this.stage)
    }
    this.release()
    const stage = create(source, options)
    const controller = new AbortController()
    this.stage = stage
    this.key = key
    this.controller = controller
    const pending: Promise<SessionModelStage | null> = waitForModel(stage, controller.signal, this.alivingTimeoutMs).then(() => stage, error => {
      // Cancelled by a newer preparation or a release: keep rejecting so stale entries stop.
      if (controller.signal.aborted) throw error
      // The v2 engine or model could not load: degrade to the still image instead of blocking the connection.
      if (this.stage === stage) this.release()
      return null
    })
    this.pending = pending
    void pending.then(() => { if (this.pending === pending) this.pending = null }, () => { if (this.pending === pending) this.pending = null })
    return pending
  }

  release() {
    this.controller?.abort()
    this.controller = null
    this.stage?.destroy()
    this.stage = null
    this.pending = null
    this.key = ''
  }
}
