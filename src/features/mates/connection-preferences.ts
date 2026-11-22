/** Presentation preference on this browser; never a server voice, credit or account setting. */
export const pipSpeechKey = (userId: number) => `capsule-pip-speech:v1:${userId}`

export class PipSpeechPreference {
  private visible = true
  private readonly listeners = new Set<() => void>()
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null
  private readonly userId: number | null
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'> | null, userId: number | null) {
    this.storage = storage
    this.userId = userId
    if (!userId) return
    try {
      const saved: unknown = JSON.parse(storage?.getItem(pipSpeechKey(userId)) ?? 'null')
      if (typeof saved === 'boolean') this.visible = saved
    } catch { /* Keep the original visible bubble if storage is unavailable or invalid. */ }
  }
  getSnapshot = () => this.visible
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  setVisible = (visible: boolean) => {
    if (this.visible === visible) return
    this.visible = visible
    if (this.userId) try { this.storage?.setItem(pipSpeechKey(this.userId), JSON.stringify(visible)) } catch { /* Keep the choice in memory. */ }
    this.listeners.forEach(listener => listener())
  }
}
