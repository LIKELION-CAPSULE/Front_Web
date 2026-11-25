export type DocumentPipApi = {
  requestWindow(options: { width: number; height: number }): Promise<Window>
  readonly window?: Window | null
  addEventListener?: EventTarget['addEventListener']
  removeEventListener?: EventTarget['removeEventListener']
}
type PipSnapshot = { status: 'closed' | 'opening' | 'open'; window: Window | null; error: string }

/** One native PiP request at a time. No window.open fallback: an ordinary popup is not PiP. */
export class DocumentPipController {
  private snapshot: PipSnapshot = { status: 'closed', window: null, error: '' }
  private listeners = new Set<() => void>()
  private generation = 0
  private pending: Promise<boolean> | null = null
  private cleanup: (() => void) | null = null
  private readonly api: DocumentPipApi | null
  constructor(api: DocumentPipApi | null) { this.api = api }
  getSnapshot = () => this.snapshot
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private update(value: PipSnapshot) { this.snapshot = value; this.listeners.forEach(listener => listener()) }
  /** `size`: the window size asked for (T-9 PIP 창 크기; the browser may adjust it). */
  open = (size: { width: number; height: number } = { width: 360, height: 520 }): Promise<boolean> => {
    if (this.snapshot.window && !this.snapshot.window.closed) { this.snapshot.window.focus(); return Promise.resolve(true) }
    if (this.pending) return this.pending
    if (!this.api) {
      this.update({ status: 'closed', window: null, error: 'PIP를 지원하지 않는 브라우저예요.' })
      return Promise.resolve(false)
    }
    const generation = ++this.generation
    this.update({ status: 'opening', window: null, error: '' })
    // Call before the first await so the browser receives the button's user activation.
    const task = this.request(this.api, generation, size).finally(() => { if (this.pending === task) this.pending = null })
    this.pending = task
    return task
  }
  private async request(api: DocumentPipApi, generation: number, size: { width: number; height: number }) {
    let opened: Window | null = null
    try {
      opened = await api.requestWindow({ width: size.width, height: size.height })
      if (generation !== this.generation || opened.closed) { if (!opened.closed) opened.close(); return false }
      const current = opened
      const closed = () => {
        if (this.snapshot.window !== current) return
        this.cleanup?.(); this.cleanup = null
        this.generation++
        this.update({ status: 'closed', window: null, error: '' })
      }
      current.addEventListener('pagehide', closed, { once: true })
      this.cleanup = () => current.removeEventListener('pagehide', closed)
      this.update({ status: 'open', window: current, error: '' })
      return true
    } catch {
      opened?.close()
      if (generation === this.generation) this.update({ status: 'closed', window: null, error: '요청을 처리하지 못했어요.' })
      return false
    }
  }
  close = () => {
    this.generation++
    this.pending = null
    this.cleanup?.(); this.cleanup = null
    const current = this.snapshot.window
    this.update({ status: 'closed', window: null, error: '' })
    if (current && !current.closed) current.close()
  }
}

export function documentPipApi(source: Window): DocumentPipApi | null {
  const api = (source as Window & { documentPictureInPicture?: DocumentPipApi }).documentPictureInPicture
  return typeof api?.requestWindow === 'function' ? api : null
}

/** A visible PiP is still the connection surface while the main tab is in the background. */
export function connectionVisible(source: { hidden: boolean }, pip: { closed: boolean; document: { hidden: boolean } } | null | undefined) {
  return !source.hidden || !!pip && !pip.closed && !pip.document.hidden
}
export function isConnectionVisible() {
  return connectionVisible(document, documentPipApi(window)?.window)
}

/** Keep camera sampling on the visible window's timer while the original tab is in the background. */
export function connectionInterval(callback: () => void, delay: number, source: Window = window) {
  const api = documentPipApi(source)
  let timer = 0
  let owner = source
  let pip: Window | null = null
  const restore = () => start(source)
  function start(target: Window) {
    owner.clearInterval(timer)
    pip?.removeEventListener('pagehide', restore)
    owner = target
    pip = target === source ? null : target
    timer = owner.setInterval(callback, delay)
    pip?.addEventListener('pagehide', restore, { once: true })
  }
  const refresh = () => start(api?.window && !api.window.closed ? api.window : source)
  refresh()
  api?.addEventListener?.('enter', refresh)
  return () => { api?.removeEventListener?.('enter', refresh); pip?.removeEventListener('pagehide', restore); owner.clearInterval(timer) }
}
