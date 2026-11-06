import type { Live2DStatus } from '@/features/live2d/live2d-stage'
import type { SessionModelFactory, SessionModelStage } from '@/features/live2d/session-model'

/** Local artwork for UI review only; production keeps the real Live2D stage. */
class ReviewImageStage implements SessionModelStage {
  private readonly image = new Image()
  private readonly listeners = new Set<() => void>()
  private status: Live2DStatus = 'loading'
  private hosts: HTMLElement[] = []
  private destroyed = false

  constructor(url: string) {
    this.image.className = 'review-character-image'
    this.image.alt = ''
    this.image.setAttribute('aria-hidden', 'true')
    this.image.style.cssText = 'display:block;width:100%;height:100%;object-fit:cover;object-position:center bottom'
    this.image.src = url
    void this.image.decode().then(() => this.setStatus('ready'), () => this.setStatus('error'))
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

  private mount() {
    const host = this.hosts.at(-1)
    if (host) {
      // The seated review uses a transparent full figure, fitted like the model canvas.
      this.image.style.objectFit = host.closest('.study-character-scene') ? 'contain' : 'cover'
      host.append(this.image)
    }
    else this.image.remove()
  }

  // Static review artwork has no tracking or expression animation.
  setTracking() {}
  setExpression() {}

  destroy() {
    this.destroyed = true
    this.hosts = []
    this.listeners.clear()
    this.image.remove()
    this.image.removeAttribute('src')
  }
}

export const createReviewImageStage: SessionModelFactory = url => new ReviewImageStage(url)
