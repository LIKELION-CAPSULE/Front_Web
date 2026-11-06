/** Load only a readable image; a missing/CORS-blocked poster must never block a study session. */
export function loadPreparePoster(source: string | undefined, signal: AbortSignal): Promise<HTMLImageElement | null> {
  if (!source || signal.aborted) return Promise.resolve(null)
  return new Promise(resolve => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    let done = false
    const timeout = window.setTimeout(cancel, 1000)
    function finish(value: HTMLImageElement | null) {
      if (done) return
      done = true
      clearTimeout(timeout)
      signal.removeEventListener('abort', cancel)
      image.onload = image.onerror = null
      resolve(value)
    }
    function cancel() { finish(null); image.src = '' }
    signal.addEventListener('abort', cancel, { once: true })
    image.onload = () => finish(image)
    image.onerror = cancel
    image.src = source
  })
}
