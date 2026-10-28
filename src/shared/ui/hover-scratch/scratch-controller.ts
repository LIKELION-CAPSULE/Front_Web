// Canvas mask and completion threshold adapted from UI Beats (MIT).
// See LICENSE.md and upstream.json. Hover, ink edges, restore, looping and mask sampling are local.
import {
  coverageRadius,
  coverAlpha,
  erasedFraction,
  fractalNoise,
  INK_ROUGHNESS,
  INK_SOFTNESS,
  MIN_SPREAD_RATE,
  restoreStrength,
  spreadRate,
  type Point,
} from './geometry'

const MASK_WIDTH = 512
const MASK_HEIGHT = 256
const IGNORE = 'a, button, input, select, textarea, [data-scratch-ignore]'
// The brush field fades to zero at this multiple of brushSize; the ink edge lands near brushSize.
const FIELD_RADIUS = 1.45
// Stroke points closer than this share of brushSize replace each other instead of piling up.
const SPACING = 0.3
const MAX_POINTS = 1500
// Edges slowly morph between two noise fields so a resting reveal still feels alive.
const BOIL_PERIOD = 700
// Completion blooms from this many trail points; few large stamps keep each frame cheap.
const BLOOM_SEEDS = 12
// The slowest bloom's cone reaches this multiple of the widest gap; larger closes gaps early.
const BLOOM_REACH = 1.15
// Extra edge softness at full bloom, for the translucent fringe of wet paint.
const BLOOM_SOFTNESS = 0.05

type Options = {
  root: HTMLElement
  frame: HTMLElement
  canvas: HTMLCanvasElement
  brushSize: number
  threshold: number
  completionDuration: number
  restoreDelay: number
  restoreDuration: number
  onComplete: () => void
}

type Stroke = { x: number; y: number; strength: number; from: number; order: number }

/** Owns all drawing outside React; the only React update is the completed slide change. */
export function createScratchController({
  root,
  frame,
  canvas,
  brushSize,
  threshold,
  completionDuration,
  restoreDelay,
  restoreDuration,
  onComplete,
}: Options) {
  let disposed = false
  let ready = false
  let width = 0
  let height = 0
  let frameId = 0
  let restoreTimer = 0
  let restoreStarted = 0
  let finishStarted = 0
  let bloom: { stroke: Stroke; rate: number }[] = []
  let bloomGrowth = 0
  let checkPending = false
  let strokes: Stroke[] = []
  let noiseA = new Float32Array()
  let noiseB = new Float32Array()
  let anchor: Point | null = null
  let head: Stroke | null = null
  let lastClient = ''
  // A fresh movement after this interval is required; holding still never advances slides.
  const cooldownUntil = performance.now() + 650
  canvas.width = MASK_WIDTH
  canvas.height = MASK_HEIGHT
  const field = document.createElement('canvas')
  field.width = MASK_WIDTH
  field.height = MASK_HEIGHT
  const maskContext = canvas.getContext('2d')
  const fieldContext = field.getContext('2d', { willReadFrequently: true })
  const current = frame.querySelector<HTMLElement>('.scratch-slide[data-layer="current"]')
  const images = [...frame.querySelectorAll<HTMLImageElement>('.scratch-image')]
  frame.dataset.scratch = 'static'
  frame.dataset.phase = 'loading'
  frame.dataset.erased = '0'

  const supportsMask =
    CSS.supports('mask-image', 'linear-gradient(black, black)') ||
    CSS.supports('-webkit-mask-image', 'linear-gradient(black, black)')
  if (!maskContext || !fieldContext || !current || !supportsMask) {
    frame.dataset.phase = 'static'
    current?.style.removeProperty('mask-image')
    current?.style.removeProperty('-webkit-mask-image')
    return () => {}
  }

  // White RGB with per-pixel alpha; only the alpha channel changes per frame.
  const output = maskContext.createImageData(MASK_WIDTH, MASK_HEIGHT)
  output.data.fill(255)

  function resetPoint() {
    anchor = null
    head = null
  }

  function clearMask() {
    current?.style.removeProperty('mask-image')
    current?.style.removeProperty('-webkit-mask-image')
  }

  function stopRestore() {
    clearTimeout(restoreTimer)
    restoreTimer = 0
    restoreStarted = 0
  }

  function disable() {
    ready = false
    cancelAnimationFrame(frameId)
    frameId = 0
    stopRestore()
    strokes = []
    frame.dataset.scratch = 'static'
    frame.dataset.phase = 'static'
    clearMask()
    resetPoint()
  }

  function paint() {
    if (!current) return
    // One alpha mask clips the complete HTML slide: image, glass, border and text.
    // Only this small bitmap is encoded; full-resolution artwork remains native HTML.
    const source = `url("${canvas.toDataURL('image/png')}")`
    current.style.setProperty('-webkit-mask-image', source)
    current.style.setProperty('mask-image', source)
  }

  function stamp(x: number, y: number, radius: number, strength: number) {
    const level = Math.round(strength * 255)
    if (level <= 0) return
    const gradient = fieldContext!.createRadialGradient(x, y, 0, x, y, radius)
    gradient.addColorStop(0, `rgb(${level},${level},${level})`)
    gradient.addColorStop(1, '#000')
    fieldContext!.fillStyle = gradient
    fieldContext!.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  }

  /** Brush cones (max-blended) plus edge noise become a ragged, hard-edged ink mask. */
  function render(now: number, spread = 0) {
    if (!width || !height || noiseA.length !== MASK_WIDTH * MASK_HEIGHT) return
    fieldContext!.setTransform(1, 0, 0, 1, 0, 0)
    fieldContext!.globalCompositeOperation = 'source-over'
    fieldContext!.fillStyle = '#000'
    fieldContext!.fillRect(0, 0, MASK_WIDTH, MASK_HEIGHT)
    fieldContext!.globalCompositeOperation = 'lighten'
    fieldContext!.setTransform(MASK_WIDTH / width, 0, 0, MASK_HEIGHT / height, 0, 0)
    const radius = brushSize * FIELD_RADIUS
    for (const stroke of strokes) stamp(stroke.x * width, stroke.y * height, radius, stroke.strength)
    // Bloom cones span the whole frame, so they are evaluated per pixel instead of drawn:
    // filling a few frame-sized gradients on the CPU-backed canvas costs far more.
    const seeds = spread ? bloom.length : 0
    const seedX = new Float32Array(seeds)
    const seedY = new Float32Array(seeds)
    const seedScale = new Float32Array(seeds)
    bloom.slice(0, seeds).forEach(({ stroke, rate }, s) => {
      const reach = radius * (1 + bloomGrowth * rate * spread)
      seedX[s] = stroke.x * width
      seedY[s] = stroke.y * height
      seedScale[s] = 1 / (reach * reach)
    })
    // Wider blooms keep lobes near brush scale instead of scattering islands ahead of the edge.
    const roughness = INK_ROUGHNESS / Math.sqrt(1 + bloomGrowth * spread)
    const softness = INK_SOFTNESS + BLOOM_SOFTNESS * spread
    const levels = fieldContext!.getImageData(0, 0, MASK_WIDTH, MASK_HEIGHT).data
    const mix = 0.5 + 0.5 * Math.sin(now / BOIL_PERIOD)
    const alpha = output.data
    const cellX = width / MASK_WIDTH
    const cellY = height / MASK_HEIGHT
    for (let y = 0, p = 0; y < MASK_HEIGHT; y++) {
      const py = (y + 0.5) * cellY
      for (let x = 0; x < MASK_WIDTH; x++, p++) {
        let level = levels[p * 4]! / 255
        if (seeds) {
          const px = (x + 0.5) * cellX
          let nearest = Infinity
          for (let s = 0; s < seeds; s++) {
            const dx = px - seedX[s]!
            const dy = py - seedY[s]!
            nearest = Math.min(nearest, (dx * dx + dy * dy) * seedScale[s]!)
          }
          level = Math.max(level, 1 - Math.sqrt(nearest))
        }
        const noise = noiseA[p]! + (noiseB[p]! - noiseA[p]!) * mix
        alpha[p * 4 + 3] = coverAlpha(level, noise, roughness, softness) * 255
      }
    }
    maskContext!.putImageData(output, 0, 0)
    paint()
  }

  function request() {
    if (!frameId) frameId = requestAnimationFrame(tick)
  }

  function tick(now: number) {
    frameId = 0
    if (disposed || !ready) return
    if (finishStarted) {
      const t = Math.min(1, Math.max(0, (now - finishStarted) / completionDuration))
      if (t >= 1) {
        maskContext!.clearRect(0, 0, MASK_WIDTH, MASK_HEIGHT)
        paint()
        frame.dataset.erased = '1'
        onComplete()
        return
      }
      // Blooms swell gently, spread, then settle, like paint spreading through water.
      render(now, t * t * (3 - 2 * t))
      request()
      return
    }
    if (restoreStarted) {
      const elapsed = now - restoreStarted
      for (const stroke of strokes)
        stroke.strength = restoreStrength(stroke.from, stroke.order, elapsed, restoreDuration)
      strokes = strokes.filter((stroke) => stroke.strength > 0)
      if (!strokes.length) {
        restoreStarted = 0
        clearMask()
        frame.dataset.erased = '0'
        frame.dataset.phase = 'ready'
        return
      }
    }
    render(now)
    if (checkPending) {
      checkPending = false
      const fraction = erasedFraction(output.data)
      frame.dataset.erased = fraction.toFixed(4)
      if (fraction >= threshold) startBloom(now)
    }
    if (strokes.length || finishStarted) request()
  }

  /** Picks trail points that bloom at uneven rates until the slowest one covers every gap. */
  function startBloom(now: number) {
    stopRestore()
    const step = Math.max(1, Math.ceil(strokes.length / BLOOM_SEEDS))
    const seeds = strokes.filter((_, i) => i % step === 0 || i === strokes.length - 1)
    const reach = coverageRadius(
      seeds.map((stroke) => ({ x: stroke.x * width, y: stroke.y * height })),
      width,
      height,
    )
    bloomGrowth = ((reach * BLOOM_REACH) / (brushSize * FIELD_RADIUS) - 1) / MIN_SPREAD_RATE
    bloom = seeds.map((stroke, i) => ({ stroke, rate: spreadRate(i) }))
    finishStarted = now
    frame.dataset.phase = 'finishing'
  }

  // An idle partial reveal recedes oldest-first back to the current image.
  function restore() {
    restoreTimer = 0
    if (disposed || !ready || finishStarted || !strokes.length) return
    resetPoint()
    frame.dataset.phase = 'restoring'
    const newest = strokes.length - 1
    strokes.forEach((stroke, i) => {
      stroke.from = stroke.strength
      stroke.order = newest ? i / newest : 0
    })
    restoreStarted = performance.now()
    request()
  }

  function addStroke(point: Point) {
    const index = strokes.findIndex(
      (stroke) =>
        Math.hypot(stroke.x * width - point.x, stroke.y * height - point.y) < brushSize * SPACING * 0.5,
    )
    // Retracing refreshes a stroke and makes it the newest, so it recedes last.
    if (index >= 0) strokes.splice(index, 1)
    else if (strokes.length >= MAX_POINTS) strokes.shift()
    const stroke = { x: point.x / width, y: point.y / height, strength: 1, from: 1, order: 1 }
    strokes.push(stroke)
    return stroke
  }

  /** Commits evenly spaced strokes along the path; a head stroke tracks the pointer between them. */
  function trace(point: Point) {
    const spacing = brushSize * SPACING
    if (!anchor) {
      anchor = point
      head = addStroke(point)
      return
    }
    const previous = head ? strokes.indexOf(head) : -1
    if (previous >= 0) strokes.splice(previous, 1)
    let distance = Math.hypot(point.x - anchor.x, point.y - anchor.y)
    for (let k = 0; distance >= spacing && k < 64; k++) {
      anchor = {
        x: anchor.x + ((point.x - anchor.x) * spacing) / distance,
        y: anchor.y + ((point.y - anchor.y) * spacing) / distance,
      }
      addStroke(anchor)
      distance -= spacing
    }
    if (distance >= spacing) anchor = point
    head ={ x: point.x / width, y: point.y / height, strength: 1, from: 1, order: 1 }
    strokes.push(head)
  }

  function resize() {
    if (disposed) return
    const nextWidth = frame.clientWidth
    const nextHeight = frame.clientHeight
    resetPoint()
    if (!nextWidth || !nextHeight) return
    if (Math.abs(nextWidth - width) > 1 || Math.abs(nextHeight - height) > 1) {
      noiseA = fractalNoise(MASK_WIDTH, MASK_HEIGHT, nextWidth, nextHeight, brushSize, 11)
      noiseB = fractalNoise(MASK_WIDTH, MASK_HEIGHT, nextWidth, nextHeight, brushSize, 29)
    }
    width = nextWidth
    height = nextHeight
    // Strokes are normalized, so a partially revealed image survives a resize.
    if (ready && strokes.length) request()
  }

  function move(event: PointerEvent) {
    if (!ready || finishStarted || event.pointerType !== 'mouse' || performance.now() < cooldownUntil)
      return
    // Browsers re-send moves for a resting cursor; those must not postpone the idle restore.
    const client = `${event.clientX},${event.clientY}`
    if (client === lastClient) return
    lastClient = client
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
    // Scratching again keeps whatever the restore has not taken back yet.
    stopRestore()
    trace(point)
    frame.dataset.phase = 'scratching'
    checkPending = true
    request()
    restoreTimer = window.setTimeout(restore, restoreDelay)
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
