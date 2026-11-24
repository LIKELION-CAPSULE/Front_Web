/**
 * Small browser plumbing of the login stage, kept out of React so Node tests can check that everything it starts is
 * also stopped (frames, listeners, timers) — the stage's effects only call these and return the stop functions.
 */

export interface FrameHost {
  requestAnimationFrame(callback: (now: number) => void): number
  cancelAnimationFrame(id: number): void
}

/** Calls `onFrame` every animation frame until the returned stop function runs (no frame after that). */
export function startFrameLoop(host: FrameHost, onFrame: (now: number) => void): () => void {
  let stopped = false
  let id = 0
  const tick = (now: number) => {
    if (stopped) return
    id = host.requestAnimationFrame(tick)
    onFrame(now)
  }
  id = host.requestAnimationFrame(tick)
  return () => {
    stopped = true
    host.cancelAnimationFrame(id)
  }
}

export interface ListenTarget {
  addEventListener(type: string, listener: EventListener, options?: AddEventListenerOptions | boolean): void
  removeEventListener(type: string, listener: EventListener): void
}

/** Adds one handler for several event types; the returned function removes all of them. */
export function listenAll<E extends Event>(
  target: ListenTarget,
  types: readonly string[],
  handler: (event: E) => void,
  options?: AddEventListenerOptions,
): () => void {
  const listener = handler as unknown as EventListener
  for (const type of types) target.addEventListener(type, listener, options)
  return () => {
    for (const type of types) target.removeEventListener(type, listener)
  }
}

export interface TimerHost {
  setTimeout(callback: () => void, ms: number): number
  clearTimeout(id: number): void
}

/**
 * Waits for the heatmap shader's canvas (the Paper Shaders mount creates it asynchronously), then reports it ready and
 * watches it for `webglcontextlost` (the package does not handle it). Gives up after `maxTries`. The returned function
 * clears the pending timer and the listener; call it before the mount disposes the context on unmount, so a normal
 * teardown never reads as a lost context.
 */
export function watchShaderCanvas(
  findCanvas: () => ListenTarget | null,
  callbacks: { onReady: () => void; onLost: () => void; onGiveUp: () => void },
  timers: TimerHost,
  { firstDelayMs = 450, retryDelayMs = 150, maxTries = 20 } = {},
): () => void {
  let canvas: ListenTarget | null = null
  let tries = 0
  let timer = 0
  let stopped = false
  const lost: EventListener = (event) => {
    event.preventDefault()
    callbacks.onLost()
  }
  const check = () => {
    if (stopped) return
    canvas = findCanvas()
    if (canvas) {
      canvas.addEventListener('webglcontextlost', lost)
      callbacks.onReady()
      return
    }
    if (++tries > maxTries) callbacks.onGiveUp()
    else timer = timers.setTimeout(check, retryDelayMs)
  }
  timer = timers.setTimeout(check, firstDelayMs)
  return () => {
    stopped = true
    timers.clearTimeout(timer)
    canvas?.removeEventListener('webglcontextlost', lost)
  }
}
