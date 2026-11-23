export type LoginFallbackReason =
  | 'no_webgl2'
  | 'reduced_motion'
  | 'low_fps_stage1'
  | 'low_fps_stage2'
  | 'low_fps_stage3'

export type LoginDesktopEvent =
  | { name: 'login_fallback_static'; payload: { reason: LoginFallbackReason; fps?: number } }
  | { name: 'login_mate_secret_found'; payload: { source: 'hover' } }
  | { name: 'login_shiny_capsule_found'; payload: { x: number; y: number } }
  | { name: 'login_mate_window_moved'; payload: { x: number; y: number } }
  | { name: 'login_desktop_icon_opened'; payload: { iconId: string } }
  | { name: 'login_photos_unlocked'; payload: { taps: number } }
  | { name: 'login_photo_viewed'; payload: { photoId: string } }

type LoginEventListener = (event: LoginDesktopEvent) => void

const listeners = new Set<LoginEventListener>()

/** Hook for future analytics/logging integration. Does not send any network request. */
export function subscribeLoginDesktopEvents(listener: LoginEventListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function emitLoginDesktopEvent(event: LoginDesktopEvent): void {
  for (const listener of listeners) {
    try {
      listener(event)
    } catch {
      // Never let analytics hooks break login UX
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('capsule:login-event', { detail: event }))
  }
}
