import {
  AdditiveBlending, Color, Group, LatheGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry, Scene,
  SRGBColorSpace, NoToneMapping, Vector2, WebGLRenderer,
} from 'three'
import {
  BRAND_CAPSULE_COLORS, createCapsuleFigure, forAlphaCanvas, fresnelGlassMaterial, radialGlowTexture,
} from '../../../shared/three/capsule-model.ts'

/**
 * WebGL scene of the empty records page (「아직 함께한 기록이 없어요」): the bottom of an empty glass jar — the same
 * jar 내 메이트 fills — with one capsule of the canonical model floating in it, its light breathing on a 4 s cycle.
 * `hop()` makes it jump a little (the 「메이트 만나러 가기」 button is pointed at).
 *
 * One WebGL context on a transparent canvas, device pixel ratio at most 1.75. The loop runs only while it is
 * running, motion is allowed and the scene is on screen; under reduced motion it draws one still frame. A lost
 * context is reported (`onContextFailure`) so the page can show the still picture instead.
 */

export type EmptyJarSceneOptions = {
  host: HTMLElement
  reducedMotion: boolean
  /** The WebGL context was lost: the page shows the still picture. */
  onContextFailure?: () => void
}

export type EmptyJarSceneController = {
  hop(): void
  setReducedMotion(value: boolean): void
  /** On screen and the tab visible: the loop may run. */
  setRunning(running: boolean): void
  dispose(): void
}

/** Breathing of the capsule's light (seconds per cycle), the float and the hop. */
const BREATH_S = 4
const FLOAT = { height: 0.82, amplitude: 0.07, periodS: 3.2 } as const
const HOP = { ms: 560, height: 0.38 } as const
const MAX_DPR = 1.75

/** Lathe profile of the jar's lower part (radius, height): a rounded bottom and straight walls up past the frame. */
function jarProfile() {
  const points: Vector2[] = []
  const radius = 1.55
  const corner = 0.34
  points.push(new Vector2(0, 0))
  points.push(new Vector2(radius - corner, 0))
  for (let step = 1; step <= 8; step++) {
    const angle = (step / 8) * (Math.PI / 2)
    points.push(new Vector2(radius - corner + Math.sin(angle) * corner, corner - Math.cos(angle) * corner))
  }
  points.push(new Vector2(radius, 2.6))
  return points
}

export function createEmptyJarScene(options: EmptyJarSceneOptions): EmptyJarSceneController {
  const { host } = options
  let reducedMotion = options.reducedMotion
  let running = true
  let disposed = false
  let contextLost = false
  let raf = 0
  let hopStart = -Infinity

  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.className = 'records-empty-jar-canvas'
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' })
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = NoToneMapping
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR))
  host.appendChild(canvas)

  const scene = new Scene()
  const camera = new PerspectiveCamera(24, 1, 0.1, 50)
  camera.position.set(0, 1.9, 7.4)
  camera.lookAt(0, 0.98, 0)

  const glow = new Color(BRAND_CAPSULE_COLORS.glow)

  // The jar: its glass and a soft pool of light on its bottom (brighter while the capsule floats low).
  const jarGeometry = new LatheGeometry(jarProfile(), 64)
  const jarMaterial = forAlphaCanvas(
    fresnelGlassMaterial({ tint: glow.clone().lerp(new Color('#ffffff'), 0.25), body: 0.025, rim: 0.42, streak: 0.42 }),
  )
  const jar = new Mesh(jarGeometry, jarMaterial)
  jar.renderOrder = 5
  scene.add(jar)

  const poolTexture = radialGlowTexture([[0, 'rgba(255,255,255,0.85)'], [0.35, 'rgba(255,255,255,0.28)'], [1, 'rgba(255,255,255,0)']])
  const flat = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
  const poolMaterial = new MeshBasicMaterial({ map: poolTexture, color: glow, blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5 })
  const pool = new Mesh(flat, poolMaterial)
  pool.position.y = 0.012
  pool.scale.set(1.9, 1, 1.9)
  pool.renderOrder = 1
  scene.add(pool)
  // Outside the jar: a wide, faint glow on the floor it stands on.
  const floorMaterial = new MeshBasicMaterial({ map: poolTexture, color: glow, blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.22 })
  const floor = new Mesh(flat, floorMaterial)
  floor.position.y = -0.01
  floor.scale.set(5.4, 1, 2.8)
  floor.renderOrder = 0
  scene.add(floor)

  // The capsule: lying a little tilted, turning slowly as it floats.
  const figure = createCapsuleFigure({ state: 'filled', length: 1.3, alphaCanvas: true })
  const capsule = new Group()
  capsule.add(figure.group)
  figure.group.rotation.z = 0.32
  capsule.rotation.y = -0.5
  capsule.position.y = FLOAT.height
  scene.add(capsule)

  function resize() {
    const width = Math.max(1, host.clientWidth)
    const height = Math.max(1, host.clientHeight)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    // Wide hosts keep the jar's size: the view height is fixed, the sides just show more of the dark.
    camera.updateProjectionMatrix()
    render(performance.now())
  }

  function pose(now: number) {
    const t = now / 1000
    const still = reducedMotion
    const float = still ? 0 : Math.sin((t * 2 * Math.PI) / FLOAT.periodS) * FLOAT.amplitude
    const hopProgress = still ? 1 : (now - hopStart) / HOP.ms
    const hop = hopProgress >= 0 && hopProgress < 1 ? Math.sin(Math.PI * hopProgress) * HOP.height * (1 - hopProgress * 0.35) : 0
    capsule.position.y = FLOAT.height + float + hop
    capsule.rotation.y = -0.5 + (still ? 0 : Math.sin(t * 0.35) * 0.25)
    figure.group.rotation.x = hop * 1.2
    // Light: breathes on a 4 s cycle (still: the middle of the breath).
    const breath = still ? 0 : Math.sin((t * 2 * Math.PI) / BREATH_S)
    figure.setGlow(1.45 + 0.3 * breath + hop * 0.8)
    figure.setTime(t, still ? 0 : 1)
    const lift = capsule.position.y - FLOAT.height
    poolMaterial.opacity = (0.5 + 0.12 * breath) * Math.max(0.35, 1 - lift * 1.6)
  }

  function render(now: number) {
    if (disposed || contextLost) return
    pose(now)
    renderer.render(scene, camera)
  }

  function frame(now: number) {
    raf = 0
    render(now)
    schedule()
  }

  function schedule() {
    if (!raf && running && !reducedMotion && !disposed && !contextLost) raf = requestAnimationFrame(frame)
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }

  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(host)
  resize()
  schedule()

  const onContextLost = (event: Event) => {
    event.preventDefault()
    contextLost = true
    stop()
    options.onContextFailure?.()
  }
  canvas.addEventListener('webglcontextlost', onContextLost)

  return {
    hop() {
      if (reducedMotion || disposed) return
      const now = performance.now()
      // A hop already in the air finishes first.
      if (now - hopStart < HOP.ms) return
      hopStart = now
      schedule()
    },
    setReducedMotion(value) {
      reducedMotion = value
      if (value) {
        stop()
        render(performance.now())
      } else schedule()
    },
    setRunning(value) {
      running = value
      if (value) schedule()
      else stop()
    },
    dispose() {
      disposed = true
      stop()
      resizeObserver.disconnect()
      canvas.removeEventListener('webglcontextlost', onContextLost)
      figure.dispose()
      for (const disposable of [jarGeometry, jarMaterial, flat, poolTexture, poolMaterial, floorMaterial]) disposable.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    },
  }
}
