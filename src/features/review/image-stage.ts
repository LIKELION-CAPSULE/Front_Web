import { CALL_STAGE_IMAGE_LAYOUT, computeStagePlacement } from '@/features/live2d/call-framing'
import type { Live2DStatus } from '@/features/live2d/live2d-stage'
import type { SessionModelFactory, SessionModelStage } from '@/features/live2d/session-model'

/** Local artwork for UI review only; production keeps the real Live2D stage. */
class ReviewImageStage implements SessionModelStage {
  private readonly image = new Image()
  private readonly listeners = new Set<() => void>()
  private status: Live2DStatus = 'loading'
  private hosts: HTMLElement[] = []
  private observer: ResizeObserver | null = null
  private destroyed = false

  constructor(url: string) {
    this.image.className = 'review-character-image'
    this.image.alt = ''
    this.image.setAttribute('aria-hidden', 'true')
    this.image.style.cssText = 'display:block;width:100%;height:100%;object-fit:contain;object-position:center bottom'
    this.image.src = url
    void this.image.decode().then(
      () => {
        this.place()
        this.setStatus('ready')
      },
      () => this.setStatus('error'),
    )
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  getStatus = () => this.status

  private setStatus(status: Live2DStatus) {
    if (this.destroyed) return
    this.status = status
    for (const listener of this.listeners) listener()
  }

  attach(host: HTMLElement) {
    if (this.destroyed) return
    this.hosts = [...this.hosts.filter(value => value !== host), host]
    this.mount()
  }

  detach(host: HTMLElement) {
    this.hosts = this.hosts.filter(value => value !== host)
    this.mount()
  }

  private place() {
    const host = this.hosts.at(-1)
    if (!host) return
    const isCallTile =
      typeof host.closest === 'function' &&
      Boolean(host.closest('.connection-mate, .desktop-mate-stage, .mate-detail-portrait, .mate-welcome-stage'))
    if (isCallTile && this.image.naturalWidth > 0 && this.image.naturalHeight > 0 && host.clientWidth > 0 && host.clientHeight > 0) {
      const placement = computeStagePlacement(
        host.clientWidth,
        host.clientHeight,
        this.image.naturalWidth,
        this.image.naturalHeight,
        CALL_STAGE_IMAGE_LAYOUT,
        'call-height',
      )
      this.image.style.position = 'absolute'
      this.image.style.left = `${placement.left}px`
      this.image.style.top = `${placement.top}px`
      this.image.style.width = `${placement.width}px`
      this.image.style.height = `${placement.height}px`
      this.image.style.maxWidth = 'none'
      this.image.style.objectFit = 'fill'
      return
    }
    this.image.style.position = ''
    this.image.style.left = ''
    this.image.style.top = ''
    this.image.style.width = '100%'
    this.image.style.height = '100%'
    this.image.style.maxWidth = ''
    this.image.style.objectFit = host.closest('.study-character-scene') ? 'contain' : 'cover'
  }

  private mount() {
    const host = this.hosts.at(-1)
    this.observer?.disconnect()
    if (host) {
      host.append(this.image)
      this.observer ??= new ResizeObserver(() => this.place())
      this.observer.observe(host)
      this.place()
    } else {
      this.image.remove()
    }
  }

  // Static review artwork has no tracking animation; reflect expression on dataset for inspection.
  setTracking() {}
  setExpression(file: string | null) {
    this.image.dataset.expression = file ?? ''
  }

  destroy() {
    this.destroyed = true
    this.observer?.disconnect()
    this.observer = null
    this.hosts = []
    this.listeners.clear()
    this.image.remove()
    this.image.removeAttribute('src')
  }
}

export const createReviewImageStage: SessionModelFactory = url => new ReviewImageStage(url)
