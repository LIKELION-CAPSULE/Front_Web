import type { SegmenterMessage, SegmenterRequest } from './types'

export type SegmentationStatus = 'idle' | 'loading' | 'ready'
export type Segmentation = { frame: ImageBitmap; mask: ImageBitmap }

/**
 * Owns the single person-segmentation worker. It is created on the first non-default background and kept
 * across routes by MediaProvider, so moving from the prepare screen to the study screen never reloads the model.
 */
export class SegmentationClient {
  private worker: Worker | null = null
  private status: SegmentationStatus = 'idle'
  private listeners = new Set<() => void>()
  private pending = new Map<number, (result: Segmentation | null) => void>()
  private nextId = 0
  private startupTimeout = 0
  private readonly baseUrl: string
  private readonly onError: () => void

  constructor(baseUrl: string, onError: () => void) {
    this.baseUrl = baseUrl
    this.onError = onError
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  getStatus = () => this.status

  private setStatus(status: SegmentationStatus) {
    if (this.status === status) return
    this.status = status
    this.listeners.forEach((listener) => listener())
  }

  private settlePending() {
    this.pending.forEach((resolve) => resolve(null))
    this.pending.clear()
  }

  private fail = () => {
    if (!this.worker) return
    this.worker.terminate()
    this.worker = null
    clearTimeout(this.startupTimeout)
    this.settlePending()
    this.setStatus('idle')
    this.onError()
  }

  ensure() {
    if (this.worker) return
    try {
      const worker = new Worker(new URL('./segmenter.worker.ts', import.meta.url), { type: 'module' })
      this.worker = worker
      this.setStatus('loading')
      this.startupTimeout = window.setTimeout(this.fail, 60000)
      worker.onmessage = (event: MessageEvent<SegmenterMessage>) => {
        const message = event.data
        if (this.worker !== worker) {
          // A closed worker can still deliver a late frame.
          if (message.type === 'result') { message.frame.close(); message.mask?.close() }
          return
        }
        if (message.type === 'status') {
          clearTimeout(this.startupTimeout)
          if (message.value === 'error') this.fail()
          else this.setStatus('ready')
          return
        }
        const resolve = this.pending.get(message.id)
        this.pending.delete(message.id)
        if (resolve && message.mask) resolve({ frame: message.frame, mask: message.mask })
        else {
          message.frame.close()
          message.mask?.close()
          resolve?.(null)
        }
      }
      worker.onerror = worker.onmessageerror = () => { if (this.worker === worker) this.fail() }
      worker.postMessage({ type: 'init', baseUrl: this.baseUrl } satisfies SegmenterRequest)
    } catch {
      this.worker = null
      this.setStatus('idle')
      this.onError()
    }
  }

  /** Takes ownership of the frame; the caller must close both bitmaps of a non-null result. */
  segment(frame: ImageBitmap): Promise<Segmentation | null> {
    if (!this.worker || this.status !== 'ready') {
      frame.close()
      return Promise.resolve(null)
    }
    const id = this.nextId++
    const worker = this.worker
    return new Promise((resolve) => {
      this.pending.set(id, resolve)
      worker.postMessage({ type: 'frame', id, frame } satisfies SegmenterRequest, [frame])
    })
  }

  close() {
    const worker = this.worker
    if (!worker) return
    this.worker = null
    clearTimeout(this.startupTimeout)
    this.settlePending()
    // Let the worker close() the segmenter before it exits; terminate in case it is stuck.
    worker.postMessage({ type: 'close' } satisfies SegmenterRequest)
    window.setTimeout(() => worker.terminate(), 1000)
    this.setStatus('idle')
  }
}
