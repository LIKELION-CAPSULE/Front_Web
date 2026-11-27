import {
  AdditiveBlending, AmbientLight, BufferAttribute, BufferGeometry, Color, DirectionalLight, DynamicDrawUsage, Euler, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, NoToneMapping, OrthographicCamera,
  PlaneGeometry, PMREMGenerator, PointLight, Points, Quaternion, Raycaster, Scene, ShaderMaterial, Sphere, Sprite,
  SpriteMaterial, SRGBColorSpace, Vector2, Vector3, WebGLRenderer,
} from 'three'
import type { Material, Object3D, Texture } from 'three'
import {
  CAPSULE_SEAM_X, capsuleGeometry, capsuleStudioEnvironment, coreMaterial, haloMaterial, radialGlowTexture, shellMaterial,
} from '../../../shared/three/capsule-model.ts'
import { PILE, pileBinAt, type FloorLayout } from './capsule-floor-layout.ts'
import { carryByIds, isStillPresent, planPour, POUR } from './capsule-pour.ts'
import type { CapsuleJarTheme } from './capsule-jar-types.ts'
import { capsuleBandTheme } from './capsule-jar-theme.ts'
import type { TimeBand } from './capsule-moments.ts'
import type { BodyPose, CapsulePhysics } from './capsule-physics.ts'

/**
 * WebGL scene of the my-mates page: a flat, side-on (2D) pile of capsules at the bottom of the mate panel, behind
 * the big Live2D mate (a separate layer above this canvas). An orthographic camera shows exactly `PILE.viewHeight`
 * units of height with the floor at the panel bottom (the width follows the panel's shape, `layout.width`); every
 * capsule lies in the screen plane and the physics keeps it there. Owns its canvas, renderer and GPU resources; everything is released in `dispose`. The record card and
 * tooltip are React.
 *
 * Entry: the capsules pour down (physics: fall, bounce, roll, push) and settle. Then everything sleeps; only hover,
 * shaking and openings move again.
 */

export type JarScenePoint = { x: number; y: number }

export type SceneLayout = FloorLayout

export type JarSceneOptions = {
  host: HTMLElement
  theme: CapsuleJarTheme
  reducedMotion: boolean
  /** Rigid-body physics (its own chunk). Null: the still final state only. */
  physics: CapsulePhysics | null
  /** Bundle (connection) under the pointer. */
  onHover: (groupId: string | null) => void
  onSelect: (groupId: string) => void
  /** Called after every rendered frame so the DOM overlay (tooltip) can follow. */
  onFrame?: () => void
  /** An intro is over (played out, skipped, or shown at once under reduced motion / without physics). */
  onIntroEnd?: (kind: IntroKind) => void
}

export type JarBenchmark = { fps: number; frameMsP50: number; frameMsP95: number; frames: number; instances: number }

export type IntroKind = 'enter' | 'switch' | 'arrival'

export type JarSceneController = {
  /** New capsules / records. Poses of capsules that stay are kept; an opened bundle that is gone is closed. */
  setLayout(layout: SceneLayout): void
  /**
   * Entry: capsules pour (`enter` ~1.5 s, `switch` ~0.6 s), then settle. `arrival`: only `newGroupIds` fall
   * (records that arrived while the page is open). Reduced motion or no physics: the final state at once.
   */
  intro(options: { kind: IntroKind; newGroupIds: readonly string[] }): void
  /** Ends a running intro at once (final state). True when one was running. */
  finishIntro(): boolean
  /**
   * Whether the mate (the layer above the canvas) covers a viewport point: pointing there is pointing at her, never
   * at the capsules behind her. Null: nothing covers the pile.
   */
  setOccluder(covers: ((clientX: number, clientY: number) => boolean) | null): void
  /** Bundle lit from outside the scene (e.g. the recent list), or null. */
  setHighlight(groupId: string | null): void
  setReducedMotion(value: boolean): void
  setRunning(running: boolean): void
  /** Screen position (CSS px, relative to the host) above a bundle (its hovered or highest capsule). */
  capsulePoint(groupId: string): JarScenePoint | null
  /**
   * Plays the opening of one capsule of the bundle and resolves, at the moment the light peaks, with the screen point
   * the record card unfolds from. Null when cancelled (the bundle left the layout, the scene was disposed); with
   * reduced motion it resolves at once.
   */
  open(groupId: string, options: { beside: boolean }): Promise<JarScenePoint | null>
  /** Moves the view aside (or back) without an opening, e.g. for a card opened from the list. */
  setBeside(beside: boolean): void
  close(): Promise<void>
  benchmark(durationMs: number): Promise<JarBenchmark>
  dispose(): void
}

// Geometry and materials: the canonical capsule (src/shared/three/capsule-model.ts), shared with the records board,
// the empty records jar, the invite dome and the still renders.

/** Faint motes of light drifting slowly above the floor (one draw call; positions move in the shader). */
function motesMaterial(glow: Color) {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: glow.clone().lerp(new Color('#ffffff'), 0.5) }, uPixel: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float seed;
      uniform float uTime;
      uniform float uPixel;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        float t = uTime * (0.05 + 0.04 * fract(seed * 7.13)) + seed;
        p.y = mod(p.y + t, 2.4);
        p.x += sin(t * 2.1 + seed * 11.0) * 0.12;
        p.z += cos(t * 1.7 + seed * 5.0) * 0.12;
        vAlpha = smoothstep(0.0, 0.5, p.y) * smoothstep(2.4, 1.6, p.y) * (0.35 + 0.65 * fract(seed * 3.7));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uPixel * (2.0 + 3.0 * fract(seed * 5.3)) * (6.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = pow(max(0.0, 1.0 - d), 2.0) * vAlpha * 0.5;
        gl_FragColor = vec4(uColor * a, a);
      }
    `,
    transparent: false,
    depthWrite: false,
    blending: AdditiveBlending,
  })
}

// ── Animation helpers ─────────────────────────────────────────────────────────

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
const damp = (current: number, target: number, lambda: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-lambda * dt))

/** Small deterministic generator for drop starts (the same data drops the same way). */
function seeded(seed: number) {
  let state = (seed >>> 0) || 1
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

/** Seconds of the intro. The pour itself follows planPour (capsule-pour.ts). */
const INTRO = {
  enter: { pourMs: POUR.enterMs, settleMs: 350 },
  switch: { pourMs: 600, settleMs: 250 },
  arrival: { pourMs: POUR.switchMs, settleMs: 250 },
} as const

const DROP_GRAVITY = 34
/** The floor sits this far above the panel's bottom edge (scene units), so the lowest capsules are not cut. */
const FLOOR_MARGIN = 0.03
/** Panel backdrop (a little lighter than the page, so the rounded panel reads). */
const PANEL_COLOR = '#16141F'
/**
 * Shaking: pointer speed over the scene (viewport heights per second, smoothed) above which the capsules get a
 * nudge, and how hard (scene units/s per unit of extra speed, capped). Kept gentle: a sweep rolls them a little.
 */
const SHAKE = { threshold: 2.2, push: 0.14, maxPush: 0.4 } as const

// Opening timeline (seconds).
const RISE = 0.5
const SPLIT_START = 0.42
const SPLIT = 0.75
const REVEAL_AT = 0.95
const CLOSE_TIME = 0.7

type Pending = { start: number; fall: number; isNew: boolean }
type IntroState = {
  kind: IntroKind
  start: number
  pourEnd: number
  end: number
  pending: Map<number, Pending>
}

export function createCapsuleJarScene(options: JarSceneOptions): JarSceneController {
  const { host, theme, physics } = options
  let reducedMotion = options.reducedMotion

  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.className = 'capsule-jar-canvas'
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' })
  host.appendChild(canvas)
  renderer.setClearColor(PANEL_COLOR, 1)
  renderer.outputColorSpace = SRGBColorSpace
  // No tone mapping: filmic/neutral curves crush the near-black canvas into navy.
  renderer.toneMapping = NoToneMapping

  const scene = new Scene()
  const pmrem = new PMREMGenerator(renderer)
  const studio = capsuleStudioEnvironment()
  // Kept so its render target (not only the texture) is released in `dispose`.
  const environmentTarget = pmrem.fromScene(studio, 0.03)
  const environment = environmentTarget.texture
  studio.traverse((object) => {
    const mesh = object as Mesh
    if (mesh.isMesh) {
      mesh.geometry.dispose()
      ;(mesh.material as Material).dispose()
    }
  })
  scene.environment = environment
  scene.environmentIntensity = 0.7

  // Side-on, no perspective: exactly the panel's width, the floor at the bottom (see fitCamera).
  const camera = new OrthographicCamera(-PILE.defaultHalfWidth, PILE.defaultHalfWidth, PILE.viewHeight, -FLOOR_MARGIN, 0.1, 60)
  camera.position.set(0, 0, 20)
  camera.lookAt(0, 0, 0)

  scene.add(new AmbientLight(0xffffff, 0.18))
  const key = new DirectionalLight(0xffffff, 0.8)
  key.position.set(-3, 6, 3)
  scene.add(key)

  const floorGroup = new Group()
  scene.add(floorGroup)
  const capsuleGroup = new Group()
  floorGroup.add(capsuleGroup)

  const glowColor = new Color(theme.glow)

  // ── Behind the pile: a soft light behind the mate and a low glow of the mate colour over the pile, motes ──
  const backLight = new Mesh(
    new PlaneGeometry(12, 7),
    new MeshBasicMaterial({
      map: radialGlowTexture([[0, 'rgba(255,255,255,0.5)'], [0.5, 'rgba(255,255,255,0.12)'], [1, 'rgba(255,255,255,0)']]),
      color: glowColor.clone().lerp(new Color('#ffffff'), 0.2),
      depthWrite: false,
      blending: AdditiveBlending,
      transparent: false,
      opacity: 0.32,
    }),
  )
  backLight.position.set(0, 3.4, -6)
  backLight.scale.set(0.8, 1.2, 1)
  backLight.renderOrder = 2
  floorGroup.add(backLight)

  const floorGlowMaterial = new MeshBasicMaterial({
    map: radialGlowTexture([[0, 'rgba(255,255,255,0.7)'], [0.4, 'rgba(255,255,255,0.2)'], [1, 'rgba(255,255,255,0)']]),
    color: glowColor,
    depthWrite: false,
    blending: AdditiveBlending,
    transparent: false,
  })
  // Upright behind the pile (the floor itself is seen edge-on): the pile glows softly from behind.
  const floorGlow = new Mesh(new PlaneGeometry(1, 1), floorGlowMaterial)
  floorGlow.position.set(0, 0, -4)
  floorGlow.renderOrder = 3
  floorGroup.add(floorGlow)

  const MOTES = 70
  const motesGeometry = new BufferGeometry()
  {
    const random = seeded(7)
    const positions = new Float32Array(MOTES * 3)
    const seeds = new Float32Array(MOTES)
    for (let index = 0; index < MOTES; index++) {
      positions.set([(random() - 0.5) * PILE.defaultHalfWidth * 3, random() * PILE.sideFill * 1.8, -2 - random() * 2], index * 3)
      seeds[index] = random() * 10
    }
    motesGeometry.setAttribute('position', new BufferAttribute(positions, 3))
    motesGeometry.setAttribute('seed', new BufferAttribute(seeds, 1))
  }
  const motesShader = motesMaterial(glowColor)
  const motes = new Points(motesGeometry, motesShader)
  motes.frustumCulled = false
  motes.renderOrder = 11
  floorGroup.add(motes)

  const pileLight = new PointLight(glowColor, 0, 5, 1.6)
  pileLight.position.set(0, 1.2, 0.6)
  floorGroup.add(pileLight)

  // ── Capsule instancing: glass shells, their cores and soft halos share one set of instance matrices ──
  const frostedColor = new Color(theme.lightHalf)
  const tintColor = new Color(theme.tintHalf)
  const shellGeometry = capsuleGeometry(-0.5, 0.5, frostedColor, tintColor)
  const shellShader = shellMaterial(true, glowColor)
  const coreGeometry = new PlaneGeometry(1, 1)
  const coreShader = coreMaterial(glowColor)
  coreShader.uniforms.uBreath!.value = reducedMotion ? 0 : 1
  // Softer cores and halos than the old pile: with many capsules the floor would otherwise glow everywhere.
  // Seen side-on the glass reads darker than from above: the cores glow a little more than in the old 3D pile.
  coreShader.uniforms.uStrength!.value = 0.95
  const haloGeometry = new PlaneGeometry(1, 1)
  const haloShader = haloMaterial(glowColor)
  haloShader.uniforms.strength!.value = 0.1

  let capacity = 0
  let shellMesh: InstancedMesh | null = null
  let coreMesh: InstancedMesh | null = null
  let haloMesh: InstancedMesh | null = null
  let glowAttribute: InstancedBufferAttribute | null = null
  let weightAttribute: InstancedBufferAttribute | null = null
  /** Per capsule: its time band's two tones and light, and whether it is a keepsake. */
  let lightAttribute: InstancedBufferAttribute | null = null
  let tintAttribute: InstancedBufferAttribute | null = null
  let glowColorAttribute: InstancedBufferAttribute | null = null
  let keepsakeAttribute: InstancedBufferAttribute | null = null
  const bandColors = new Map<TimeBand, { light: Color; tint: Color; glow: Color }>()
  const colorsOf = (band: TimeBand) => {
    let colors = bandColors.get(band)
    if (!colors) {
      const tinted = capsuleBandTheme(theme, band)
      colors = { light: new Color(tinted.lightHalf), tint: new Color(tinted.tintHalf), glow: new Color(tinted.glow) }
      bandColors.set(band, colors)
    }
    return colors
  }

  function ensureCapacity(count: number) {
    if (count <= capacity && shellMesh) return
    for (const mesh of [shellMesh, coreMesh, haloMesh]) {
      if (mesh) {
        capsuleGroup.remove(mesh)
        // Releases the instance matrix buffer.
        mesh.dispose()
      }
    }
    if (shellMesh) {
      // The per-instance glow / weight attributes are replaced below: disposing the geometries frees the GPU buffers
      // of the old ones (the shared vertex data is uploaded again on the next frame).
      for (const geometry of [shellGeometry, coreGeometry, haloGeometry]) geometry.dispose()
    }
    capacity = Math.max(16, Math.ceil(count * 1.25))
    glowAttribute = new InstancedBufferAttribute(new Float32Array(capacity).fill(1), 1)
    glowAttribute.setUsage(DynamicDrawUsage)
    weightAttribute = new InstancedBufferAttribute(new Float32Array(capacity).fill(0.5), 1)
    lightAttribute = new InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3)
    tintAttribute = new InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3)
    glowColorAttribute = new InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3)
    keepsakeAttribute = new InstancedBufferAttribute(new Float32Array(capacity), 1)
    for (const geometry of [shellGeometry, coreGeometry, haloGeometry]) {
      geometry.setAttribute('instanceGlow', glowAttribute)
      geometry.setAttribute('instanceWeight', weightAttribute)
      geometry.setAttribute('instanceLight', lightAttribute)
      geometry.setAttribute('instanceTint', tintAttribute)
      geometry.setAttribute('instanceGlowColor', glowColorAttribute)
      geometry.setAttribute('instanceKeepsake', keepsakeAttribute)
    }
    shellMesh = new InstancedMesh(shellGeometry, shellShader, capacity)
    shellMesh.instanceMatrix.setUsage(DynamicDrawUsage)
    // Covers the whole floor so raycasts never depend on a stale lazily computed bound.
    shellMesh.boundingSphere = new Sphere(new Vector3(0, 0.5, 0), 8)
    coreMesh = new InstancedMesh(coreGeometry, coreShader, capacity)
    haloMesh = new InstancedMesh(haloGeometry, haloShader, capacity)
    for (const [mesh, order] of [[coreMesh, 7], [shellMesh, 8], [haloMesh, 9]] as const) {
      mesh.frustumCulled = false
      mesh.renderOrder = order
      if (mesh !== shellMesh) {
        mesh.instanceMatrix = shellMesh.instanceMatrix
        mesh.raycast = () => {}
      }
      capsuleGroup.add(mesh)
    }
  }

  // ── Per-capsule state ──
  let layout: FloorLayout | null = null
  const newGroupIds = new Set<string>()
  let placements: FloorLayout['placements'] = []
  let groupOf: number[] = []
  let groupIndexById = new Map<string, number>()
  let indexById = new Map<string, number>()
  /** Current pose of every capsule (physics result, or the layout's resting pose). */
  let positions: Vector3[] = []
  let rotations: Quaternion[] = []
  const hover: number[] = []
  const flash: number[] = []
  /** Capsules of bundles new since the last visit: they stay a little brighter. */
  let isNewPiece: boolean[] = []
  let clock = 0
  let firstCapsuleBoost = 0
  let physicsActive = false

  let intro: IntroState | null = null
  /** The mate's silhouette above the canvas: picks under it are hers. */
  let occluder: ((clientX: number, clientY: number) => boolean) | null = null

  // ── Opened capsule (non-instanced copy that rises, splits and dissolves into light) ──
  const openGroup = new Group()
  openGroup.visible = false
  scene.add(openGroup)
  const openShader = shellMaterial(false, glowColor)
  const openLight = new Group()
  const openTint = new Group()
  const openLightGeometry = capsuleGeometry(-0.5, CAPSULE_SEAM_X, frostedColor, tintColor)
  const openTintGeometry = capsuleGeometry(CAPSULE_SEAM_X, 0.5, frostedColor, tintColor)
  openLight.add(new Mesh(openLightGeometry, openShader))
  openTint.add(new Mesh(openTintGeometry, openShader))
  for (const group of [openLight, openTint]) for (const child of group.children) child.renderOrder = 12
  const burstMaterial = new SpriteMaterial({
    map: radialGlowTexture([[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,255,255,0.5)'], [0.55, 'rgba(255,255,255,0.12)'], [1, 'rgba(255,255,255,0)']]),
    color: glowColor.clone().lerp(new Color('#ffffff'), 0.3),
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
    opacity: 0,
  })
  const burst = new Sprite(burstMaterial)
  burst.renderOrder = 13
  const burstLight = new PointLight(glowColor, 0, 4, 1.4)
  openGroup.add(openLight, openTint)
  scene.add(burst, burstLight)

  // Small puffs of light where capsules land.
  const puffTexture = radialGlowTexture([[0, 'rgba(255,255,255,0.9)'], [0.3, 'rgba(255,255,255,0.3)'], [1, 'rgba(255,255,255,0)']])
  const puffs = Array.from({ length: 10 }, () => {
    const material = new SpriteMaterial({
      map: puffTexture,
      color: glowColor.clone().lerp(new Color('#ffffff'), 0.45),
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      opacity: 0,
    })
    const sprite = new Sprite(material)
    sprite.renderOrder = 10
    sprite.visible = false
    floorGroup.add(sprite)
    return { sprite, material, age: 1, size: 0.3 }
  })
  let nextPuff = 0
  function puff(at: { x: number; y: number; z: number }, size: number) {
    const item = puffs[nextPuff]!
    nextPuff = (nextPuff + 1) % puffs.length
    item.sprite.position.set(at.x, at.y, at.z)
    item.age = 0
    item.size = size
    item.sprite.visible = true
  }

  type OpenState = {
    /** Bundle id and the capsule that rises (by id: indices change when the layout does). */
    groupId: string
    pieceId: string
    phase: 'opening' | 'open' | 'closing'
    start: number
    from: { position: Vector3; quaternion: Quaternion; scale: number }
    target: Vector3
    resolveOpen: ((point: JarScenePoint | null) => void) | null
    resolveClose: (() => void) | null
  }
  let openState: OpenState | null = null

  function settleOpening(state: OpenState, cancelled: boolean) {
    const resolve = state.resolveOpen
    state.resolveOpen = null
    if (!resolve) return
    if (cancelled) {
      resolve(null)
      return
    }
    camera.updateMatrixWorld()
    resolve(toScreen(state.phase === 'opening' ? burst.position : state.target))
  }

  function hideOpenCapsule() {
    openGroup.visible = false
    burstMaterial.opacity = 0
    burstLight.intensity = 0
  }

  function cancelOpen() {
    const state = openState
    if (!state) return
    openState = null
    hideOpenCapsule()
    settleOpening(state, true)
    const resolveClose = state.resolveClose
    state.resolveClose = null
    resolveClose?.()
  }

  // ── Interaction state ──
  const pointer = new Vector2()
  /** The last pointer position in viewport px (for the mate's silhouette); not set by the benchmark's sweep. */
  const pointerClient = { x: 0, y: 0, valid: false }
  let pointerInside = false
  let pointerDirty = false
  let hoveredGroup = -1
  let hoveredPiece = -1
  let highlightGroup = -1
  let lastKick = 0
  /** Pointer velocity over the scene (normalized device units per second, decaying). */
  const pointerSpeed = { x: 0, y: 0, at: 0, px: 0, py: 0 }
  const raycaster = new Raycaster()
  const view = { shift: 0, target: 0 }

  let width = 1
  let height = 1
  let wanted = false
  let running = false
  let frame = 0
  let lastTime = 0
  let needsRender = true
  let disposed = false
  let lastRenderAt = 0
  let benchmarkState: { until: number; frames: number[]; resolve: (result: JarBenchmark) => void; start: number } | null = null

  // ── Camera: exactly `PILE.viewHeight` high with the floor at the panel bottom; the width follows the panel ──
  function fitCamera() {
    const halfWidth = (PILE.viewHeight * width) / height / 2
    camera.left = -halfWidth
    camera.right = halfWidth
    camera.bottom = -FLOOR_MARGIN
    camera.top = PILE.viewHeight - FLOOR_MARGIN
    applyViewShift()
    needsRender = true
  }

  function applyViewShift() {
    // The record card opens over the panel's middle; the view itself stays (the panel is narrow).
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
  }

  function resize() {
    const rect = host.getBoundingClientRect()
    width = Math.max(1, Math.round(rect.width))
    height = Math.max(1, Math.round(rect.height))
    const ratio = Math.min(2, window.devicePixelRatio || 1)
    renderer.setPixelRatio(ratio)
    renderer.setSize(width, height, false)
    motesShader.uniforms.uPixel!.value = ratio * (height / 600)
    fitCamera()
  }
  const resizeObserver = new ResizeObserver(() => {
    resize()
    if (!running) renderOnce()
  })
  resizeObserver.observe(host)

  // ── Instance matrices ──
  const matrix = new Matrix4()
  const position = new Vector3()
  const quaternion = new Quaternion()
  const scaleVector = new Vector3()
  const euler = new Euler()
  const zero = new Matrix4().makeScale(0, 0, 0)

  function restQuaternion(placement: FloorLayout['placements'][number]) {
    euler.set(placement.roll, placement.yaw, placement.pitch, 'YZX')
    return new Quaternion().setFromEuler(euler)
  }

  function isPending(index: number) {
    return Boolean(intro?.pending.has(index))
  }

  function composeAt(index: number) {
    const placement = placements[index]!
    if ((openState && openState.pieceId === placement.id) || isPending(index)) {
      shellMesh!.setMatrixAt(index, zero)
      return
    }
    position.copy(positions[index]!)
    quaternion.copy(rotations[index]!)
    let size = placement.length
    const lift = hover[index]!
    if (lift > 0.001 && !reducedMotion) {
      position.y += lift * placement.radius * 1.1
      size *= 1 + lift * 0.06
    }
    const sparkle = flash[index] ?? 0
    if (sparkle > 0.001) size *= 1 + sparkle * 0.12
    scaleVector.setScalar(size)
    matrix.compose(position, quaternion, scaleVector)
    shellMesh!.setMatrixAt(index, matrix)
  }

  function composeAll() {
    for (let index = 0; index < placements.length; index++) composeAt(index)
    if (shellMesh) shellMesh.instanceMatrix.needsUpdate = true
  }

  function updateGlow(index: number) {
    const placement = placements[index]!
    // Quiet by default; the bundle under the pointer (or opened) and the new bundles stand out.
    glowAttribute!.setX(
      index,
      0.34 + placement.glow * 0.42 + hover[index]! * 1.15 + (flash[index] ?? 0) * 2.2 + (isNewPiece[index] ? 0.55 : 0) +
        (placement.keepsake ? 0.5 : 0) + firstCapsuleBoost,
    )
  }

  const pose: BodyPose = { position: { x: 0, y: 0, z: 0 }, quaternion: { x: 0, y: 0, z: 0, w: 1 } }
  const poseOf = (index: number): BodyPose => ({
    position: { x: positions[index]!.x, y: positions[index]!.y, z: positions[index]!.z },
    quaternion: { x: rotations[index]!.x, y: rotations[index]!.y, z: rotations[index]!.z, w: rotations[index]!.w },
  })

  function setLayout(next: FloorLayout) {
    const previous = placements
    const previousPositions = positions
    const previousRotations = rotations
    const previousIndex = indexById
    // A new panel shape moves the bins: everything takes its new resting place.
    const reshaped = layout !== null && layout.width !== next.width
    layout = next
    placements = next.placements
    firstCapsuleBoost = placements.length <= 8 ? 0.35 : 0
    ensureCapacity(placements.length)
    indexById = new Map(placements.map((placement, index) => [placement.id, index]))
    groupOf = placements.map((placement) => placement.group)
    groupIndexById = new Map(next.groups.map((group, index) => [group.id, index]))
    if (openState && !isStillPresent(openState.groupId, next.groups.map((group) => group.id))) cancelOpen()
    if (intro) {
      intro.pending = carryByIds(intro.pending, previous.map((placement) => placement.id), placements.map((placement) => placement.id))
    }
    // Capsules that stay keep where they lie now; new ones take their resting place.
    positions = placements.map((placement) => {
      const old = reshaped ? undefined : previousIndex.get(placement.id)
      return old !== undefined ? previousPositions[old]!.clone() : new Vector3(placement.x, placement.y, placement.z)
    })
    rotations = placements.map((placement) => {
      const old = reshaped ? undefined : previousIndex.get(placement.id)
      return old !== undefined ? previousRotations[old]!.clone() : restQuaternion(placement)
    })
    physics?.setHalfWidth(next.width / 2)
    hover.length = 0
    flash.length = 0
    isNewPiece = placements.map((placement) => newGroupIds.has(placement.groupId))
    for (const [index, placement] of placements.entries()) {
      hover.push(0)
      flash.push(0)
      weightAttribute!.setX(index, placement.glow)
      const colors = colorsOf(placement.band)
      lightAttribute!.setXYZ(index, colors.light.r, colors.light.g, colors.light.b)
      tintAttribute!.setXYZ(index, colors.tint.r, colors.tint.g, colors.tint.b)
      glowColorAttribute!.setXYZ(index, colors.glow.r, colors.glow.g, colors.glow.b)
      keepsakeAttribute!.setX(index, placement.keepsake ? 1 : 0)
      updateGlow(index)
    }
    for (const mesh of [shellMesh!, coreMesh!, haloMesh!]) mesh.count = placements.length
    glowAttribute!.needsUpdate = true
    weightAttribute!.needsUpdate = true
    for (const attribute of [lightAttribute!, tintAttribute!, glowColorAttribute!, keepsakeAttribute!]) attribute.needsUpdate = true
    if (hoveredPiece >= placements.length) hoveredPiece = hoveredGroup = -1
    if (highlightGroup >= next.groups.length) highlightGroup = -1

    physics?.setCapsules(
      placements.map((placement) => ({ length: placement.length, radius: placement.radius })),
      placements.map((_, index) => poseOf(index)),
    )
    if (intro) for (const index of intro.pending.keys()) physics?.hold(index)

    const pileHeight = Math.max(0.6, next.topHeight)
    floorGlow.scale.set(next.width * 1.3, pileHeight * 2.6, 1)
    floorGlowMaterial.opacity = placements.length ? 0.16 : 0.08
    pileLight.position.set(0, pileHeight + 0.6, 1.2)
    pileLight.intensity = placements.length ? 0.35 : 0.1
    fitCamera()
    composeAll()
    needsRender = true
    if (!running) renderOnce()
  }

  // ── Intro: the pour ──
  function intro_(kind: IntroKind, newGroups: readonly string[]) {
    if (!layout) return
    for (const id of newGroups) newGroupIds.add(id)
    isNewPiece = placements.map((placement) => newGroupIds.has(placement.groupId))
    for (let index = 0; index < placements.length; index++) updateGlow(index)
    if (glowAttribute) glowAttribute.needsUpdate = true
    const newGroupIdsList = newGroups
    const timing = INTRO[kind]
    const newPieces = newGroupIdsList.flatMap((id) => {
      const group = groupIndexById.get(id)
      return group === undefined ? [] : layout!.groups[group]!.indices.map((index) => placements[index]!.id)
    })
    if (reducedMotion || !physics || disposed) {
      for (const index of newPieces.map((id) => indexById.get(id)!)) flash[index] = 1
      queueMicrotask(() => {
        if (!disposed) options.onIntroEnd?.(kind)
      })
      return
    }
    // A big pile: only the top part pours, the rest already lies there.
    const maxFalling = kind === 'arrival' ? 0 : placements.length > 250 ? 45 : POUR.maxFalling
    const plan = planPour(placements.map((placement) => placement.id), newPieces, { durationMs: timing.pourMs, maxFalling })
    const pending = new Map<number, Pending>()
    for (const step of plan.steps) {
      pending.set(step.index, { start: step.start, fall: step.fall, isNew: step.isNew })
      physics.hold(step.index)
      // Where it will come down (before the physics moves it): the resting pose of the layout.
      const placement = placements[step.index]!
      positions[step.index]!.set(placement.x, placement.y, placement.z)
      rotations[step.index]!.copy(restQuaternion(placement))
    }
    intro = {
      kind,
      start: clock,
      pourEnd: clock + timing.pourMs / 1000,
      end: clock + (timing.pourMs + timing.settleMs) / 1000,
      pending,
    }
    composeAll()
    needsRender = true
  }

  function launchPending(index: number, pending: Pending) {
    const placement = placements[index]!
    const local = seeded(Math.floor(placement.x * 1e4) ^ Math.floor(placement.y * 1e4) ^ (index * 2654435761))
    // From just above the panel's top edge, straight down in the screen plane (2D: z stays 0).
    const top = camera.top + 0.4 + local() * 0.6
    // Inside its own bin (the inner walls reach above the panel, capsule-floor-layout.ts).
    const bin = pileBinAt(placement.x, (layout?.width ?? 2 * PILE.defaultHalfWidth) / 2)
    const low = bin.from + placement.length / 2 + 0.01
    const high = bin.to - placement.length / 2 - 0.01
    const startX = Math.max(low, Math.min(high, placement.x + (local() - 0.5) * 0.6))
    const fall = pending.fall
    const dy = placement.y + 0.15 - top
    // Reaches its spot at about `fall` seconds, then bounces and rolls on from there.
    const vy = (dy + 0.5 * DROP_GRAVITY * fall * fall) / fall
    euler.set(placement.roll, 0, local() * Math.PI * 2, 'YZX')
    quaternion.setFromEuler(euler)
    physics!.launch(
      index,
      { position: { x: startX, y: top, z: 0 }, quaternion: { x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w } },
      { x: ((placement.x - startX) / fall) * 0.9, y: vy, z: 0 },
      { x: 0, y: 0, z: (local() - 0.5) * 10 },
    )
    if (pending.isNew) flash[index] = 0.01
  }

  function finishIntro() {
    const state = intro
    if (!state) return false
    intro = null
    options.onIntroEnd?.(state.kind)
    if (state.kind !== 'arrival') {
      // Skipped: the still final state (capsules at their resting places).
      for (const [index, placement] of placements.entries()) {
        positions[index]!.set(placement.x, placement.y, placement.z)
        rotations[index]!.copy(restQuaternion(placement))
      }
      physics?.setCapsules(
        placements.map((placement) => ({ length: placement.length, radius: placement.radius })),
        placements.map((_, index) => poseOf(index)),
      )
    } else {
      for (const index of state.pending.keys()) {
        const placement = placements[index]!
        positions[index]!.set(placement.x, placement.y, placement.z)
        rotations[index]!.copy(restQuaternion(placement))
        physics?.place(index, poseOf(index))
      }
      physics?.freeze()
      readPhysics()
    }
    physicsActive = false
    composeAll()
    needsRender = true
    if (!running) renderOnce()
    return true
  }

  function stepIntro() {
    const state = intro!
    const elapsed = clock - state.start
    for (const [index, pending] of state.pending) {
      if (elapsed >= pending.start) {
        state.pending.delete(index)
        launchPending(index, pending)
        physicsActive = true
      }
    }
    if (clock >= state.end && state.pending.size === 0) {
      intro = null
      physics?.freeze()
      readPhysics()
      physicsActive = false
      composeAll()
      options.onIntroEnd?.(state.kind)
    }
  }

  function readPhysics() {
    if (!physics) return
    for (let index = 0; index < placements.length; index++) {
      if (physics.isHeld(index)) continue
      physics.read(index, pose)
      positions[index]!.set(pose.position.x, pose.position.y, pose.position.z)
      rotations[index]!.set(pose.quaternion.x, pose.quaternion.y, pose.quaternion.z, pose.quaternion.w)
    }
  }

  physics?.onLand((index, speed, at) => {
    if (speed < 0.6) return
    const isNew = (flash[index] ?? 0) > 0
    flash[index] = isNew ? 1 : Math.max(flash[index] ?? 0, Math.min(0.4, speed * 0.05))
    if (isNew || speed > 3) puff(at, isNew ? 0.6 : 0.35)
  })

  // ── Projection ──
  const projected = new Vector3()
  function toScreen(vector: Vector3): JarScenePoint | null {
    projected.copy(vector).project(camera)
    if (projected.z > 1) return null
    return { x: ((projected.x + 1) / 2) * width, y: ((1 - projected.y) / 2) * height }
  }

  function pieceOf(groupId: string) {
    const group = groupIndexById.get(groupId)
    if (group === undefined || !layout) return -1
    if (hoveredPiece >= 0 && groupOf[hoveredPiece] === group) return hoveredPiece
    // The highest capsule of the bundle.
    let best = -1
    let bestY = -Infinity
    for (const index of layout.groups[group]!.indices) {
      const p = positions[index]!
      const score = p.y
      if (score > bestY) {
        bestY = score
        best = index
      }
    }
    return best
  }

  function capsulePoint(groupId: string) {
    const index = pieceOf(groupId)
    if (index < 0 || !shellMesh) return null
    const placement = placements[index]!
    shellMesh.getMatrixAt(index, matrix)
    position.setFromMatrixPosition(matrix)
    position.y += placement.radius * 1.4
    position.applyMatrix4(capsuleGroup.matrixWorld)
    return toScreen(position)
  }

  // ── Picking ──
  function pick(): number {
    if (!shellMesh || !placements.length) return -1
    // In front of the pile stands the mate: pointing at her is not pointing at the capsules behind her.
    if (occluder && pointerClient.valid && occluder(pointerClient.x, pointerClient.y)) return -1
    raycaster.setFromCamera(pointer, camera)
    const hits = raycaster.intersectObjects([shellMesh], false)
    for (const hit of hits) {
      if (hit.instanceId !== undefined && hit.instanceId < placements.length && !isPending(hit.instanceId)) return hit.instanceId
    }
    return -1
  }

  function setPointer(event: MouseEvent) {
    pointerClient.x = event.clientX
    pointerClient.y = event.clientY
    pointerClient.valid = true
    const rect = canvas.getBoundingClientRect()
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
  }

  function onPointerMove(event: PointerEvent) {
    setPointer(event)
    const now = event.timeStamp / 1000
    if (pointerSpeed.at > 0) {
      const elapsed = Math.max(1 / 240, now - pointerSpeed.at)
      if (elapsed < 0.1) {
        // Fast moves dominate; the per-frame decay in `step` lets it fade when the pointer slows down.
        pointerSpeed.x = Math.max(-12, Math.min(12, pointerSpeed.x * 0.5 + ((pointer.x - pointerSpeed.px) / elapsed) * 0.5))
        pointerSpeed.y = Math.max(-12, Math.min(12, pointerSpeed.y * 0.5 + ((pointer.y - pointerSpeed.py) / elapsed) * 0.5))
      }
    }
    pointerSpeed.at = now
    pointerSpeed.px = pointer.x
    pointerSpeed.py = pointer.y
    pointerInside = true
    pointerDirty = true
    if (!running) updatePick()
  }

  function onPointerLeave() {
    pointerInside = false
    pointerClient.valid = false
    pointerDirty = true
    if (!running) updatePick()
  }

  function onClick(event: MouseEvent) {
    if (openState) return
    // A click while the intro plays ends it (final state) and opens nothing.
    if (finishIntro()) return
    setPointer(event)
    const index = hoveredPiece >= 0 ? hoveredPiece : pick()
    if (index >= 0) options.onSelect(layout!.groups[groupOf[index]!]!.id)
  }

  function setHoveredPiece(index: number) {
    if (index === hoveredPiece) return
    hoveredPiece = index
    const group = index >= 0 ? groupOf[index]! : -1
    canvas.style.cursor = index >= 0 ? 'pointer' : ''
    if (group !== hoveredGroup) {
      hoveredGroup = group
      options.onHover(group >= 0 ? layout!.groups[group]!.id : null)
    }
    if (reducedMotion) applyHoverNow()
  }

  function lit(index: number) {
    const group = groupOf[index]!
    return group === hoveredGroup || group === highlightGroup || (openState !== null && layout?.groups[group]?.id === openState.groupId)
  }

  function applyHoverNow() {
    for (let index = 0; index < placements.length; index++) {
      hover[index] = lit(index) ? 1 : 0
      updateGlow(index)
    }
    glowAttribute!.needsUpdate = true
    composeAll()
    renderOnce()
  }

  function updatePick() {
    if (!pointerDirty) return
    pointerDirty = false
    setHoveredPiece(pointerInside && !openState ? pick() : -1)
  }

  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerleave', onPointerLeave)
  canvas.addEventListener('click', onClick)

  // ── Frame loop ──
  function step(dt: number) {
    let active = false
    clock += dt

    if (intro) {
      stepIntro()
      active = true
    }

    if (!reducedMotion) {
      // Shaking: a quick sweep of the pointer over the floor (not a slow lean) nudges the capsules the same way;
      // they roll a little and settle again.
      pointerSpeed.x *= Math.exp(-dt * 8)
      pointerSpeed.y *= Math.exp(-dt * 8)
      const shake = Math.hypot(pointerSpeed.x, pointerSpeed.y)
      if (physics && !intro && !openState && shake > SHAKE.threshold && clock - lastKick > 0.12) {
        lastKick = clock
        const strength = Math.min(SHAKE.maxPush, (shake - SHAKE.threshold) * SHAKE.push)
        // In the screen plane: right → +x, up → +y.
        physics.kick((pointerSpeed.x / shake) * strength, (pointerSpeed.y / shake) * strength)
        physicsActive = true
      }

      const nextShift = damp(view.shift, view.target, 7, dt)
      if (Math.abs(nextShift - view.shift) > 1e-4) {
        view.shift = Math.abs(nextShift - view.target) < 1e-3 ? view.target : nextShift
        applyViewShift()
        active = true
      }
    }

    if (physicsActive && physics) {
      const moving = physics.step(dt)
      readPhysics()
      if (!moving && !intro) physicsActive = false
      active = true
    }

    updatePick()

    let glowDirty = false
    for (let index = 0; index < placements.length; index++) {
      const target = lit(index) ? 1 : 0
      const current = hover[index]!
      if (current !== target) {
        const next = reducedMotion ? target : damp(current, target, 14, dt)
        hover[index] = Math.abs(next - target) < 0.002 ? target : next
        updateGlow(index)
        glowDirty = true
      }
      const value = flash[index]!
      if (value > 0.0105) {
        flash[index] = value < 0.012 ? 0 : value * Math.exp(-dt * 2.6)
        updateGlow(index)
        glowDirty = true
      }
    }
    if (glowDirty) glowAttribute!.needsUpdate = true

    for (const item of puffs) {
      if (item.age >= 1) continue
      item.age = Math.min(1, item.age + dt / 0.45)
      item.material.opacity = 0.85 * (1 - item.age) * (1 - item.age)
      item.sprite.scale.setScalar(item.size * (0.4 + 0.9 * easeOut(item.age)))
      if (item.age >= 1) item.sprite.visible = false
      active = true
    }

    active ||= glowDirty
    if (active || openState) composeAll()
    if (openState) active = stepOpen() || active
    return active
  }

  // Opened: level with a slight turn, so both halves read side by side.
  const facing = new Quaternion().setFromEuler(new Euler(0.5, 0, 0.12, 'YZX'))
  const openScale = () => Math.max(0.55, (layout?.baseLength ?? 0.5) * 1.5)

  function setOpenPose(split: number, dissolve: number) {
    openLight.position.x = -split * 0.16
    openLight.rotation.z = split * 0.12
    openTint.position.x = split * 0.18
    openTint.rotation.z = -split * 0.14
    openShader.uniforms.uOpacity!.value = 1 - dissolve
    openShader.uniforms.uGlow!.value = 1.4 + split * 1.2
    openGroup.visible = dissolve < 0.999
  }

  function stepOpen() {
    const state = openState!
    const elapsed = clock - state.start
    if (state.phase === 'opening' || state.phase === 'open') {
      const rise = easeInOut(clamp01(elapsed / RISE))
      openGroup.position.copy(state.from.position).lerp(state.target, rise)
      openGroup.quaternion.copy(state.from.quaternion).slerp(facing, rise)
      openGroup.scale.setScalar(state.from.scale + (openScale() - state.from.scale) * rise)
      const split = easeOut(clamp01((elapsed - SPLIT_START) / (SPLIT * 0.6)))
      const flashOut = clamp01((elapsed - SPLIT_START) / (SPLIT * 0.45))
      const settle = clamp01((elapsed - SPLIT_START - SPLIT * 0.45) / (SPLIT * 0.55))
      const dissolve = easeInOut(clamp01((elapsed - SPLIT_START - SPLIT * 0.35) / (SPLIT * 0.65)))
      setOpenPose(split, dissolve)
      burst.position.copy(openGroup.position)
      burstLight.position.copy(openGroup.position)
      const burstSize = openScale() * (0.4 + 1.9 * easeOut(flashOut) - 0.9 * easeInOut(settle))
      burst.scale.setScalar(Math.max(0.001, burstSize))
      burstMaterial.opacity = Math.max(0.45 * rise * (1 - flashOut), 0.95 * easeOut(flashOut) - 0.55 * easeInOut(settle))
      burstLight.intensity = Math.max(0, 3.2 * easeOut(flashOut) - 2.2 * easeInOut(settle))
      if (state.phase === 'opening' && elapsed >= REVEAL_AT) {
        settleOpening(state, false)
        state.phase = 'open'
      }
      return elapsed < SPLIT_START + SPLIT + 0.05
    }
    const gather = easeInOut(clamp01(elapsed / (CLOSE_TIME * 0.4)))
    const back = easeInOut(clamp01((elapsed - CLOSE_TIME * 0.35) / (CLOSE_TIME * 0.65)))
    setOpenPose(1 - gather, 1 - gather)
    burstMaterial.opacity = 0.4 * (1 - gather)
    burst.scale.setScalar(Math.max(0.001, openScale() * (1.4 - gather)))
    burstLight.intensity = 1 - gather
    openGroup.position.copy(state.target).lerp(state.from.position, back)
    openGroup.quaternion.copy(facing).slerp(state.from.quaternion, back)
    openGroup.scale.setScalar(openScale() + (state.from.scale - openScale()) * back)
    if (elapsed >= CLOSE_TIME) finishClosing(state)
    return true
  }

  function finishClosing(state: OpenState) {
    if (openState !== state) return
    openState = null
    hideOpenCapsule()
    composeAll()
    const resolve = state.resolveClose
    state.resolveClose = null
    resolve?.()
  }

  function renderOnce() {
    if (disposed) return
    lastRenderAt = performance.now()
    renderer.render(scene, camera)
    options.onFrame?.()
    needsRender = false
  }

  function tick(now: number) {
    frame = 0
    if (!running || disposed) return
    const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 1 / 60
    lastTime = now
    const benchmarking = benchmarkState !== null
    if (benchmarking) {
      const state = benchmarkState!
      const t = (now - state.start) / 1000
      pointer.set(Math.sin(t * 2.4) * 0.9, Math.cos(t * 1.7) * 0.4)
      pointerInside = true
      pointerDirty = true
      state.frames.push(now)
    }
    const active = step(dt)
    const breathing = !reducedMotion && placements.length > 0
    coreShader.uniforms.uTime!.value = clock
    motesShader.uniforms.uTime!.value = clock
    // Cores breathe and motes drift slowly; when nothing else moves, ~20 frames a second are plenty.
    if (active || needsRender || benchmarking || (breathing && now - lastRenderAt > 50)) renderOnce()
    if (benchmarkState && now >= benchmarkState.until) finishBenchmark()
    frame = requestAnimationFrame(tick)
  }

  function syncLoop() {
    const shouldRun = wanted && !reducedMotion && !disposed
    if (shouldRun === running) return
    running = shouldRun
    if (running) {
      lastTime = 0
      frame = requestAnimationFrame(tick)
    } else if (frame) {
      cancelAnimationFrame(frame)
      frame = 0
    }
  }

  function setRunning(next: boolean) {
    if (disposed) return
    wanted = next
    // Paused mid-opening (scrolled off screen, tab hidden): finish it now, or the card it waits for never comes.
    if (!next && openState) {
      const state = openState
      if (state.phase === 'closing') finishClosing(state)
      else if (state.phase === 'opening') {
        settleOpening(state, false)
        state.phase = 'open'
        hideOpenCapsule()
      }
    }
    syncLoop()
    if (next && !running) renderOnce()
  }

  function setReducedMotion(value: boolean) {
    if (value === reducedMotion || disposed) return
    reducedMotion = value
    coreShader.uniforms.uBreath!.value = value ? 0 : 1
    if (value) {
      // Everything jumps to its final state: no intro, no tilt, and an opening / closing finishes now.
      finishIntro()
      physics?.freeze()
      physicsActive = false
      for (let index = 0; index < flash.length; index++) flash[index] = 0
      view.shift = view.target
      applyViewShift()
      const state = openState
      if (state?.phase === 'closing') finishClosing(state)
      else if (state) {
        settleOpening(state, false)
        state.phase = 'open'
        hideOpenCapsule()
      }
      if (benchmarkState) finishBenchmark()
      for (let index = 0; index < placements.length; index++) {
        hover[index] = lit(index) ? 1 : 0
        updateGlow(index)
      }
      if (glowAttribute) glowAttribute.needsUpdate = true
      composeAll()
    }
    needsRender = true
    syncLoop()
    if (!running) renderOnce()
  }

  function setBeside(beside: boolean) {
    view.target = beside ? 1 : 0
    if (reducedMotion || !running) {
      view.shift = view.target
      applyViewShift()
      renderOnce()
    }
  }

  function open(groupId: string, { beside }: { beside: boolean }): Promise<JarScenePoint | null> {
    // A capsule still folding back from the last card: finish that at once so the new one can open.
    if (openState?.phase === 'closing') finishClosing(openState)
    const index = pieceOf(groupId)
    if (index < 0 || openState || !shellMesh || disposed) return Promise.resolve(null)
    view.target = beside ? 1 : 0
    capsuleGroup.updateMatrixWorld()
    shellMesh.getMatrixAt(index, matrix)
    openShader.uniforms.uWeight!.value = placements[index]!.glow
    // The opened capsule keeps its time band's colours (and its keepsake light).
    const openColors = colorsOf(placements[index]!.band)
    openShader.uniforms.uLight!.value = openColors.light
    openShader.uniforms.uTint!.value = openColors.tint
    openShader.uniforms.uGlowColor!.value = openColors.glow
    openShader.uniforms.uKeepsake!.value = placements[index]!.keepsake ? 1 : 0
    matrix.premultiply(capsuleGroup.matrixWorld)
    const fromPosition = new Vector3()
    const fromQuaternion = new Quaternion()
    const fromScale = new Vector3()
    matrix.decompose(fromPosition, fromQuaternion, fromScale)
    // Up out of the pile, staying on its side of the mate (she stands in the middle), in front of the other capsules.
    const target = new Vector3(fromPosition.x * 0.85, Math.max(fromPosition.y + 0.9, (layout?.topHeight ?? 0) + 0.7), 2)
    setHoveredPiece(-1)
    // The whole bundle lights up.
    const group = groupOf[index]!
    for (const piece of layout!.groups[group]!.indices) flash[piece] = Math.max(flash[piece]!, 0.8)
    return new Promise((resolve) => {
      const state: OpenState = {
        groupId,
        pieceId: placements[index]!.id,
        phase: 'opening',
        start: clock,
        from: { position: fromPosition, quaternion: fromQuaternion, scale: fromScale.x },
        target,
        resolveOpen: resolve,
        resolveClose: null,
      }
      openState = state
      if (reducedMotion || !running) {
        view.shift = view.target
        applyViewShift()
        settleOpening(state, false)
        state.phase = 'open'
        hideOpenCapsule()
      } else {
        setOpenPose(0, 0)
        openGroup.visible = true
        openGroup.position.copy(fromPosition)
      }
      composeAll()
      if (!running) renderOnce()
    })
  }

  function close(): Promise<void> {
    view.target = 0
    const state = openState
    if (!state) {
      if (reducedMotion || !running) {
        view.shift = 0
        applyViewShift()
        renderOnce()
      }
      return Promise.resolve()
    }
    settleOpening(state, true)
    if (reducedMotion || !running) {
      view.shift = 0
      applyViewShift()
      finishClosing(state)
      renderOnce()
      return Promise.resolve()
    }
    const previous = state.resolveClose
    return new Promise((resolve) => {
      state.phase = 'closing'
      state.start = clock
      state.resolveClose = () => {
        previous?.()
        resolve()
      }
    })
  }

  function finishBenchmark() {
    const state = benchmarkState!
    benchmarkState = null
    pointerInside = false
    const deltas: number[] = []
    for (let index = 1; index < state.frames.length; index++) deltas.push(state.frames[index]! - state.frames[index - 1]!)
    deltas.sort((a, b) => a - b)
    const total = state.frames.length > 1 ? state.frames[state.frames.length - 1]! - state.frames[0]! : 1
    state.resolve({
      fps: Math.round(((state.frames.length - 1) / total) * 1000 * 10) / 10,
      frameMsP50: Math.round((deltas[Math.floor(deltas.length * 0.5)] ?? 0) * 10) / 10,
      frameMsP95: Math.round((deltas[Math.floor(deltas.length * 0.95)] ?? 0) * 10) / 10,
      frames: state.frames.length,
      instances: placements.length,
    })
  }

  function benchmark(durationMs: number): Promise<JarBenchmark> {
    if (reducedMotion || benchmarkState || !running) {
      return Promise.resolve({ fps: 0, frameMsP50: 0, frameMsP95: 0, frames: 0, instances: placements.length })
    }
    return new Promise((resolve) => {
      const start = performance.now()
      benchmarkState = { start, until: start + durationMs, frames: [], resolve }
    })
  }

  function dispose() {
    if (disposed) return
    cancelOpen()
    if (benchmarkState) finishBenchmark()
    intro = null
    disposed = true
    running = false
    if (frame) cancelAnimationFrame(frame)
    resizeObserver.disconnect()
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerleave', onPointerLeave)
    canvas.removeEventListener('click', onClick)
    physics?.dispose()
    const geometries = new Set<BufferGeometry>([shellGeometry, coreGeometry, haloGeometry, openLightGeometry, openTintGeometry, motesGeometry])
    const materials = new Set<Material>([shellShader, coreShader, openShader, burstMaterial, haloShader, motesShader])
    const textures = new Set<Texture>([environment, puffTexture])
    scene.traverse((object: Object3D) => {
      const mesh = object as Mesh
      // Sprites share one module-level geometry with every other three.js scene in the app: never dispose it.
      if (mesh.geometry && !(object instanceof Sprite)) geometries.add(mesh.geometry)
      const material = (mesh as { material?: Material | Material[] }).material
      for (const item of Array.isArray(material) ? material : material ? [material] : []) materials.add(item)
      if (object instanceof InstancedMesh) object.dispose()
    })
    for (const material of materials) {
      const map = (material as { map?: Texture | null }).map
      if (map) textures.add(map)
    }
    for (const geometry of geometries) geometry.dispose()
    for (const material of materials) material.dispose()
    for (const texture of textures) texture.dispose()
    environmentTarget.dispose()
    pmrem.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
    canvas.remove()
  }

  resize()

  return {
    setLayout,
    intro: ({ kind, newGroupIds }) => intro_(kind, newGroupIds),
    finishIntro,
    setOccluder(covers) {
      occluder = covers
    },
    setHighlight(groupId) {
      const group = groupId === null ? -1 : (groupIndexById.get(groupId) ?? -1)
      if (group === highlightGroup) return
      highlightGroup = group
      if (reducedMotion || !running) applyHoverNow()
    },
    setReducedMotion,
    setRunning,
    capsulePoint,
    open,
    setBeside,
    close,
    benchmark,
    dispose,
  }
}
