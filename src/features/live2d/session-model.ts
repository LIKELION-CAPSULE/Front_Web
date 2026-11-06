import type { Figure } from '../../shared/api/types.ts'
import type { Live2DLayout, Live2DStage } from './live2d-stage.ts'

export type SessionModelStage = Pick<Live2DStage, 'subscribe' | 'getStatus' | 'attach' | 'detach' | 'setTracking' | 'setExpression' | 'destroy'>
export type SessionModelFactory = (url: string, layout: Live2DLayout) => SessionModelStage

function waitForModel(stage: SessionModelStage, signal: AbortSignal, timeoutMs: number) {
  return new Promise<void>((resolve, reject) => {
    let finished = false
    let unsubscribe = () => {}
    const timer = Number.isFinite(timeoutMs) ? setTimeout(() => finish(new Error('캐릭터를 불러오는 데 시간이 걸리고 있어요. 다시 시도해 주세요.')), timeoutMs) : undefined
    function finish(error?: unknown) {
      if (finished) return
      finished = true
      clearTimeout(timer)
      unsubscribe()
      signal.removeEventListener('abort', abort)
      if (error) reject(error)
      else resolve()
    }
    function abort() { finish(new Error('캐릭터 불러오기를 취소했어요.')) }
    function check() {
      if (stage.getStatus() === 'ready') finish()
      else if (stage.getStatus() === 'error') finish(new Error('캐릭터를 불러오지 못했어요. 다시 시도해 주세요.'))
    }
    unsubscribe = stage.subscribe(check)
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
    else check()
  })
}

const finite = (value: number | undefined, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback

/** Prepares one model before navigation and hands the same canvas to the study screen. */
export class SessionModel {
  private stage: SessionModelStage | null = null
  private key = ''
  private pending: Promise<SessionModelStage> | null = null
  private controller: AbortController | null = null
  private readonly create: SessionModelFactory
  private readonly timeoutMs: number

  constructor(create: SessionModelFactory, timeoutMs = 60_000) {
    this.create = create
    this.timeoutMs = timeoutMs
  }

  prepare(figure: Figure | undefined): Promise<SessionModelStage> {
    if (!figure?.modelJsonUrl) return Promise.reject(new Error('캐릭터 모델 정보를 불러오지 못했어요. 다시 시도해 주세요.'))
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

  release() {
    this.controller?.abort()
    this.controller = null
    this.stage?.destroy()
    this.stage = null
    this.pending = null
    this.key = ''
  }
}
