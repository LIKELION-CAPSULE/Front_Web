// Canvas erasure and completion threshold adapted from UI Beats (MIT).
// See LICENSE.md and upstream.json. Hover, image layers, looping and mask sampling are local.
import { erasedFraction, farthestCorner, type Point } from './geometry'

const MASK_WIDTH = 512
const MASK_HEIGHT = 256
const IGNORE = 'a, button, input, select, textarea, [data-scratch-ignore]'

type Options = {
  root: HTMLElement
  frame: HTMLElement
  canvas: HTMLCanvasElement
  brushSize: number
  threshold: number
  completionDuration: number
  onComplete: () => void
}

/** Owns all drawing outside React; the only React update is the completed slide change. */
export function createScratchController({
  root,
  frame,
  canvas,
  brushSize,
  threshold,
  completionDuration,
  onComplete,
}: Options) {
  let disposed = false
  let ready = false
  let finishing = false
  let width = 0
  let height = 0
  let paintFrame = 0
  let finishFrame = 0
  let last: Point | null = null
  // A fresh movement after this interval is required; holding still never advances slides.
  const cooldownUntil = performance.now() + 650
  canvas.width = MASK_WIDTH
  canvas.height = MASK_HEIGHT
  const maskContext = canvas.getContext('2d', { willReadFrequently: true })
  const current = frame.querySelector<HTMLElement>('.scratch-slide[data-layer="current"]')
  const images = [...frame.querySelectorAll<HTMLImageElement>('.scratch-image')]
  frame.dataset.scratch = 'static'
  frame.dataset.phase = 'loading'
  frame.dataset.erased = '0'

  const supportsMask =
    CSS.supports('mask-image', 'linear-gradient(black, black)') ||
    CSS.supports('-webkit-mask-image', 'linear-gradient(black, black)')
  if (!maskContext || !current || !supportsMask) {
    frame.dataset.phase = 'static'
    current?.style.removeProperty('mask-image')
    current?.style.removeProperty('-webkit-mask-image')
    return () => {}
  }

  maskContext.fillStyle = '#fff'
  maskContext.fillRect(0, 0, MASK_WIDTH, MASK_HEIGHT)

  function resetPoint() {
    last = null
  }

  function disable() {
    ready = false
    cancelAnimationFrame(paintFrame)
    cancelAnimationFrame(finishFrame)
    frame.dataset.scratch = 'static'
    frame.dataset.phase = 'static'
    current?.style.removeProperty('mask-image')
    current?.style.removeProperty('-webkit-mask-image')
    resetPoint()
  }

  function paint() {
    if (!current || !width || !height) return
    // One alpha mask clips the complete HTML slide: image, glass, border and text.
    // Only this small bitmap is encoded; full-resolution artwork remains native HTML.
    const source = `url("${canvas.toDataURL('image/png')}")`
    current.style.setProperty('-webkit-mask-image', source)
    current.style.setProperty('mask-image', source)
  }

  function resize() {
    if (disposed) return
    width = frame.clientWidth
    height = frame.clientHeight
    resetPoint()
    // The normalized mask survives a resize, including a partially erased image.
    if (ready) paint()
  }

  function erase(point: Point, radius: number, from = point) {
    if (!maskContext || !width || !height) return
    maskContext.setTransform(MASK_WIDTH / width, 0, 0, MASK_HEIGHT / height, 0, 0)
    maskContext.globalCompositeOperation = 'destination-out'
    maskContext.strokeStyle = '#000'
    maskContext.fillStyle = '#000'
    maskContext.lineWidth = radius * 2
    maskContext.lineCap = 'round'
    maskContext.lineJoin = 'round'
    maskContext.beginPath()
    maskContext.moveTo(from.x, from.y)
    maskContext.lineTo(point.x, point.y)
    maskContext.stroke()
    maskContext.beginPath()
    maskContext.arc(point.x, point.y, radius, 0, Math.PI * 2)
    maskContext.fill()
  }

  function finish(point: Point) {
    finishing = true
    frame.dataset.phase = 'finishing'
    const origin = { x: point.x / width, y: point.y / height }
    const started = performance.now()
    function tick(now: number) {
      if (disposed || !ready) return
      const t = Math.min(1, (now - started) / completionDuration)
      const center = { x: origin.x * width, y: origin.y * height }
      const radius =
        brushSize + (farthestCorner(center, width, height) + 2 - brushSize) * (1 - (1 - t) ** 3)
      erase(center, radius)
      paint()
      if (t < 1) finishFrame = requestAnimationFrame(tick)
      else {
        frame.dataset.erased = '1'
        onComplete()
      }
    }
    finishFrame = requestAnimationFrame(tick)
  }

  function schedulePaint(point: Point) {
    if (paintFrame) return
    paintFrame = requestAnimationFrame(() => {
      paintFrame = 0
      if (disposed || !ready || finishing) return
      paint()
      const fraction = erasedFraction(maskContext!.getImageData(0, 0, MASK_WIDTH, MASK_HEIGHT).data)
      frame.dataset.erased = fraction.toFixed(4)
      if (fraction >= threshold) finish(point)
    })
  }

  function move(event: PointerEvent) {
    if (!ready || finishing || event.pointerType !== 'mouse' || performance.now() < cooldownUntil)
      return
    if (event.target instanceof Element && event.target.closest(IGNORE)) {
      resetPoint()
      return
    }
    const bounds = frame.getBoundingClientRect()
    const point = {
      x: ((event.clientX - bounds.left) * width) / bounds.width,
      y: ((event.clientY - bounds.top) * height) / bounds.height,
    }
    if (point.x < 0 || point.y < 0 || point.x > width || point.y > height) {
      resetPoint()
      return
    }
    erase(point, brushSize, last ?? point)
    last = point
    frame.dataset.phase = 'scratching'
    schedulePaint(point)
  }

  const observer = new ResizeObserver(resize)
  observer.observe(frame)
  root.addEventListener('pointermove', move)
  root.addEventListener('pointerleave', resetPoint)
  root.addEventListener('pointercancel', resetPoint)
  window.addEventListener('resize', resize)
  document.addEventListener('visibilitychange', resetPoint)
  canvas.addEventListener('contextlost', disable)

  // Decode every destination before exposing any hole; otherwise keep the static current image.
  Promise.all(images.map((image) => image.decode()))
    .then(() => {
      if (disposed) return
      ready = true
      resize()
      frame.dataset.scratch = 'ready'
      frame.dataset.phase = 'ready'
    })
    .catch(() => {
      if (!disposed) disable()
    })

  return () => {
    disposed = true
    disable()
    observer.disconnect()
    root.removeEventListener('pointermove', move)
    root.removeEventListener('pointerleave', resetPoint)
    root.removeEventListener('pointercancel', resetPoint)
    window.removeEventListener('resize', resize)
    document.removeEventListener('visibilitychange', resetPoint)
    canvas.removeEventListener('contextlost', disable)
  }
}
