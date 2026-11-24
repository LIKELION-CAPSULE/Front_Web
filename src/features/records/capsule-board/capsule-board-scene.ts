import {
  AdditiveBlending, AmbientLight, Box3, BufferAttribute, BufferGeometry, CanvasTexture, Color, CylinderGeometry, DirectionalLight,
  DoubleSide, DynamicDrawUsage, Group, InstancedBufferAttribute, InstancedMesh, LatheGeometry, Matrix4,
  MeshLambertMaterial, NoToneMapping, OrthographicCamera, PlaneGeometry, Quaternion, Ray, Raycaster, Scene,
  ShaderMaterial, SRGBColorSpace, TorusGeometry, Vector2, Vector3, WebGLRenderer,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { capsuleGeometry, capsuleRadiusAt, coreMaterial, haloMaterial, shellMaterial } from '../../mates/capsule-jar/capsule-jar-scene.ts'
import { CAPSULE_ASPECT, CAPSULE_SEAM_OFFSET } from '../../mates/capsule-jar/capsule-jar-layout.ts'
import { CHAERIN_JAR_THEME } from '../../mates/capsule-jar/capsule-jar-theme.ts'
import { BOARD, boardRiseTiming, isMonthSelectable, type BoardCapsule, type BoardLabel, type BoardTile, type CapsuleBoardModel } from './capsule-board-layout.ts'
import {
  guideHours,
  longestDayKey,
  pillarDims,
  pillarLayout,
  pillarScaleHours,
  pillarsApply,
  type PillarCapsule,
  type PillarLayout,
  type PillarMode,
} from './capsule-board-pillars.ts'
import {
  chipSlots,
  requestView,
  settleViewRequest,
  type BoardView,
  type ViewApply,
  type ViewRequestState,
} from './capsule-board-view.ts'

/**
 * WebGL scene of the 「함께 쌓은 시간」 board: floor tiles with a column of upright glass capsules on every day (2.5D,
 * seen at an angle) or, seen from straight above, the same capsules lying as chips in the tile (2D). The capsules are
 * the very same objects as in 내 메이트: the stadium geometry with its seam (`capsuleGeometry`), the additive glass
 * shell with its two tones and keepsake stars (`shellMaterial`), the inner core light (`coreMaterial`) and the soft
 * halo (`haloMaterial`), instanced (one draw call each).
 *
 * One mechanism moves everything: every day is an *entry* (by its day key) with a position and a scale, and the camera
 * is a state {azimuth, elevation, centre, world units per pixel}. Changing the period moves the entries of the same
 * days to their new grid places while the camera zooms (the morph); 2D ↔ 2.5D turns the camera between straight above
 * and the angle while the capsules lie down / stand up. The two never run together: a new one finishes the running
 * one at once.
 *
 * Renders on demand (only while something moves), pauses when hidden, releases everything in `dispose`.
 */

export type BoardPoint = { x: number; y: number }
export type BoardBenchmark = { fps: number; frameMsP50: number; frameMsP95: number; frames: number; capsules: number; tiles: number }
export type BoardTransition = 'rise' | 'morph' | 'none'
export type BoardTarget = { kind: 'day'; key: string } | { kind: 'month'; month: number }

export type BoardSceneOptions = {
  host: HTMLElement
  reducedMotion: boolean
  view: BoardView
  /** DEV draft (capsule-board-pillars.ts): glass pillars instead of the upright columns. Default: off. */
  pillars?: PillarMode
  /** Day (week/month) or month board (year) under the pointer, or null. */
  onHover: (target: BoardTarget | null) => void
  onSelect: (target: BoardTarget) => void
  /** After every rendered frame, so the DOM tooltip can follow. */
  onFrame?: () => void
  /** The WebGL context was lost and did not come back (the page shows the 2D CSS calendar instead). */
  onContextFailure?: () => void
}

export type BoardSceneController = {
  setBoard(model: CapsuleBoardModel, transition: BoardTransition): void
  setView(view: BoardView, animate: boolean): void
  /** DEV draft: switches the pillars (the columns rise again in the new form). */
  setPillars(mode: PillarMode): void
  /** The aid's marked day (the period's longest), when the pillars with the aid are shown in 2.5D. */
  markedDay(): string | null
  /** The month's graduation step (hours) with the aid, else null (the page says what a tick is). */
  guideStep(): number | null
  replay(): void
  setReducedMotion(value: boolean): void
  /** Target lit from outside (keyboard focus), or null. */
  setActive(target: BoardTarget | null): void
  setSelected(key: string | null): void
  /** Days the mate's comment speaks about; `streak` days are joined by a line of light. */
  setEmphasis(emphasis: { days: readonly string[]; streak: readonly string[] }): void
  /** Typing progress of the comment (0…1); `finished` lets the emphasis fade after a moment. */
  setEmphasisProgress(progress: number, finished: boolean): void
  /** Screen point (CSS px, relative to the host) above a target. */
  targetPoint(target: BoardTarget): BoardPoint | null
  setRunning(running: boolean): void
  benchmark(durationMs: number): Promise<BoardBenchmark>
  dispose(): void
}

/** Clear colour: the glass block's colour over the page (the canvas edges fade into the block with a CSS mask). */
const CLEAR = '#13121B'

/** View direction per period (degrees): azimuth from +z towards +x, elevation. 2D is straight above (0°, 90°). */
const VIEW = {
  week: { azimuth: 24, elevation: 32 },
  month: { azimuth: 28, elevation: 42 },
  year: { azimuth: 10, elevation: 52 },
} as const
/** Narrow hosts: the week row and the month grid turn further so they stay large. */
const NARROW_VIEW = { week: { azimuth: 50, elevation: 34 }, month: { azimuth: 36, elevation: 46 }, year: { azimuth: 4, elevation: 60 } } as const
const NARROW_WIDTH = 560
const FLAT_VIEW = { azimuth: 0, elevation: 90 } as const

const TILE_COLOR = {
  empty: new Color('#272533'),
  emptyYear: new Color('#22202D'),
  filled: new Color('#2F2C40'),
  future: new Color('#1B1A24'),
  /** Selection colour (`selected`, a little lifted for the lit top face). */
  selected: new Color('#3A2E68'),
  hover: new Color('#3A3750'),
  emphasis: new Color('#3B3263'),
} as const

/** Pointer tilt (radians), hover lift (tile units) and timings (ms). Small on purpose. */
const TILT = { x: 0.022, y: 0.035 } as const
const LIFT = 0.09
const MORPH_MS = 850
const FLAT_MS = 800
/** The comment's emphasis stays this long after the line is typed, then fades. */
const EMPHASIS_HOLD_MS = 1600

const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeOutBack = (t: number) => 1 + 2.5 * Math.pow(t - 1, 3) + 1.5 * Math.pow(t - 1, 2)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const damp = (current: number, target: number, lambda: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-lambda * dt))

/** Floor labels (dates, months) from one canvas atlas, lying flat on the floor. */
function labelMaterial(map: CanvasTexture) {
  return new ShaderMaterial({
    uniforms: { uMap: { value: map } },
    vertexShader: /* glsl */ `
      attribute vec4 instanceUv;
      attribute vec4 instanceTint;
      varying vec2 vUv;
      varying vec4 vTint;
      void main() {
        vUv = vec2(mix(instanceUv.x, instanceUv.z, uv.x), mix(instanceUv.y, instanceUv.w, uv.y));
        vTint = instanceTint;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      varying vec2 vUv;
      varying vec4 vTint;
      void main() {
        float a = texture2D(uMap, vUv).a * vTint.a;
        if (a < 0.02) discard;
        gl_FragColor = vec4(vTint.rgb, a);
      }
    `,
    transparent: true,
    depthWrite: false,
  })
}

/**
 * Soft light on the floor (additive): `round` pools under the columns, `streak` = the line of light joining the days
 * of a streak (soft across, rounded at the ends).
 */
function floorLightMaterial(kind: 'round' | 'streak') {
  return new ShaderMaterial({
    defines: kind === 'round' ? { ROUND: '' } : {},
    vertexShader: /* glsl */ `
      attribute vec4 instanceLight;
      varying vec2 vUv;
      varying vec4 vLight;
      void main() {
        vUv = uv;
        vLight = instanceLight;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec4 vLight;
      void main() {
        #ifdef ROUND
          float d = length(vUv - 0.5) * 2.0;
          float a = pow(max(0.0, 1.0 - d), 2.2);
        #else
          float across = abs(vUv.y - 0.5) * 2.0;
          float a = pow(max(0.0, 1.0 - across), 1.6) * smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
          a += exp(-across * across * 40.0) * 0.6;
        #endif
        gl_FragColor = vec4(vLight.rgb * a * vLight.a, 1.0);
      }
    `,
    transparent: false,
    depthWrite: false,
    blending: AdditiveBlending,
  })
}

/**
 * Glass pillars (DEV draft): additive like the capsules' glass. `glass` = the tube (a fresnel rim in the capsules'
 * lavender, almost clear across), `fill` = the light filling it (soft, brighter towards the rim and the top of its
 * layer), `cap` = the bright ring on top that marks the height. Per instance: rgb + strength.
 */
function pillarMaterial(kind: 'glass' | 'fill' | 'cap') {
  return new ShaderMaterial({
    defines: { [kind.toUpperCase()]: '' },
    vertexShader: /* glsl */ `
      attribute vec4 instanceLight;
      varying vec3 vN;
      varying vec3 vV;
      varying vec4 vLight;
      varying float vY;
      void main() {
        mat4 m = modelViewMatrix * instanceMatrix;
        vec4 mv = m * vec4(position, 1.0);
        vN = normalize(mat3(m) * normal);
        vV = normalize(-mv.xyz);
        vLight = instanceLight;
        vY = position.y;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      varying vec4 vLight;
      varying float vY;
      void main() {
        float facing = abs(dot(normalize(vN), normalize(vV)));
        float rim = pow(max(0.0, 1.0 - facing), 2.2);
        #ifdef GLASS
          float a = 0.035 + 0.55 * rim;
          // A faint vertical gloss line on the front left.
          a += 0.08 * pow(facing, 18.0);
        #elif defined(FILL)
          float a = (0.16 + 0.42 * rim) * (0.75 + 0.25 * vY);
        #else
          float a = 0.6 + 0.6 * facing;
        #endif
        gl_FragColor = vec4(vLight.rgb * a * vLight.a * (gl_FrontFacing ? 1.0 : 0.55), 1.0);
      }
    `,
    transparent: false,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  })
}

/** The aid's guide lines: thin light lines on the back wall, brighter in the middle. */
function guideLineMaterial() {
  return new ShaderMaterial({
    uniforms: { uStrength: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uStrength;
      varying vec2 vUv;
      void main() {
        float across = abs(vUv.y - 0.5) * 2.0;
        float a = (1.0 - across) * smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x);
        gl_FragColor = vec4(vec3(0.72, 0.66, 0.98) * a * uStrength, 1.0);
      }
    `,
    transparent: false,
    depthWrite: false,
    blending: AdditiveBlending,
  })
}

/** Above this many capsules (and in the year) the board uses the light capsule mesh. */
const LIGHT_MESH_FROM = 300

/**
 * The same capsule as `capsuleGeometry` (the same stadium profile `capsuleRadiusAt`, the seam, the two vertex-colour
 * halves) with fewer rings and sides: ~10× fewer triangles for many small capsules.
 */
function lightCapsuleGeometry(frosted: Color, tint: Color) {
  const radius = CAPSULE_ASPECT / 2
  const straight = 0.5 - radius
  const seam = CAPSULE_SEAM_OFFSET * 0.5
  const samples = new Set<number>([-0.5, 0.5, seam - 0.004, seam + 0.004, -straight, straight])
  for (let step = 1; step < 5; step++) {
    const angle = (step / 5) * (Math.PI / 2)
    samples.add(-straight - radius * Math.cos(angle))
    samples.add(straight + radius * Math.cos(angle))
  }
  const ys = [...samples].sort((a, b) => a - b)
  const geometry = new LatheGeometry(ys.map((x) => new Vector2(capsuleRadiusAt(x), x)), 12)
  geometry.rotateZ(-Math.PI / 2)
  const position = geometry.getAttribute('position')
  const colors = new Float32Array(position.count * 3)
  for (let index = 0; index < position.count; index++) {
    const color = position.getX(index) < seam ? frosted : tint
    colors.set([color.r, color.g, color.b], index * 3)
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  return geometry
}

type Pose = { x: number; z: number; s: number }
/** One day (tile + column + date label) or one year month label, moving between views. */
type Entry = {
  key: string
  tile: BoardTile | null
  label: BoardLabel | null
  from: Pose
  to: Pose
  /** Hover / keyboard lift, 0…1 (damped). */
  lift: number
  /** Comment emphasis, 0…1 (damped). */
  emphasis: number
}
type CapsuleRef = {
  entry: number
  capsule: BoardCapsule
  piece: number
  count: number
  start: number | null
  slot: { x: number; z: number; length: number }
  /** Its place lying in the day's glass pillar (DEV draft), or null with the upright columns. */
  pillar: PillarCapsule | null
}
type Camera = { azimuth: number; elevation: number; center: Vector3; upp: number }
type Anim = { start: number; duration: number } | null

export function createCapsuleBoardScene(options: BoardSceneOptions): BoardSceneController {
  const { host } = options
  let reducedMotion = options.reducedMotion

  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.className = 'capsule-board-canvas'
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' })
  host.appendChild(canvas)
  renderer.setClearColor(CLEAR, 1)
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = NoToneMapping
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

  const scene = new Scene()
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 400)
  scene.add(new AmbientLight(0xffffff, 1.6))
  const sun = new DirectionalLight(0xffffff, 1.5)
  sun.position.set(-4, 10, 6)
  scene.add(sun)
  const board = new Group()
  scene.add(board)

  // ── Meshes (rebuilt per entry set; geometries and materials live as long as the scene) ──
  const tileGeometry = new RoundedBoxGeometry(BOARD.tileSize, BOARD.tileHeight, BOARD.tileSize, 2, 0.05)
  const tileMaterial = new MeshLambertMaterial({ color: '#ffffff' })
  const flatGeometry = () => {
    const geometry = new PlaneGeometry(1, 1)
    geometry.rotateX(-Math.PI / 2)
    return geometry
  }
  const labelGeometry = flatGeometry()
  const poolGeometry = flatGeometry()
  const beamGeometry = flatGeometry()
  const poolShader = floorLightMaterial('round')
  const beamShader = floorLightMaterial('streak')
  const theme = CHAERIN_JAR_THEME
  const glowColor = new Color(theme.glow)
  const fullShellGeometry = capsuleGeometry(-0.5, 0.5, new Color(theme.lightHalf), new Color(theme.tintHalf))
  const lightShellGeometry = lightCapsuleGeometry(new Color(theme.lightHalf), new Color(theme.tintHalf))
  let shellGeometry = fullShellGeometry
  const shellShader = shellMaterial(true, glowColor)
  const coreGeometry = new PlaneGeometry(1, 1)
  const coreShader = coreMaterial(glowColor)
  coreShader.uniforms.uBreath!.value = 0
  coreShader.uniforms.uStrength!.value = 0.95
  const haloGeometry = new PlaneGeometry(1, 1)
  const haloShader = haloMaterial(glowColor)
  haloShader.uniforms.strength!.value = 0.1

  // Glass pillars (DEV draft): the tube (open, base at y = 0, unit radius and height), the fill inside it, the top ring.
  const tubeGeometry = new CylinderGeometry(1, 1, 1, 28, 1, true).translate(0, 0.5, 0)
  const fillGeometry = new CylinderGeometry(0.84, 0.84, 1, 24, 1, false).translate(0, 0.5, 0)
  const capGeometry = new TorusGeometry(1, 0.055, 6, 32).rotateX(Math.PI / 2)
  const tubeShader = pillarMaterial('glass')
  const fillShader = pillarMaterial('fill')
  const capShader = pillarMaterial('cap')
  const guideGeometry = new PlaneGeometry(1, 1)
  const guideShader = guideLineMaterial()
  let pillarMode: PillarMode = options.pillars ?? 'off'

  let tileMesh: InstancedMesh | null = null
  let labelMesh: InstancedMesh | null = null
  let labelTexture: CanvasTexture | null = null
  let labelShader: ShaderMaterial | null = null
  let labelTint: InstancedBufferAttribute | null = null
  let labelAspect: number[] = []
  let shellMesh: InstancedMesh | null = null
  let coreMesh: InstancedMesh | null = null
  let haloMesh: InstancedMesh | null = null
  let glowAttribute: InstancedBufferAttribute | null = null
  let poolMesh: InstancedMesh | null = null
  let poolLight: InstancedBufferAttribute | null = null
  let beamMesh: InstancedMesh | null = null
  let beamLight: InstancedBufferAttribute | null = null
  let tubeMesh: InstancedMesh | null = null
  let capMesh: InstancedMesh | null = null
  let fillMesh: InstancedMesh | null = null
  let tubeLight: InstancedBufferAttribute | null = null
  let capLight: InstancedBufferAttribute | null = null
  let fillLight: InstancedBufferAttribute | null = null
  let guideMesh: InstancedMesh | null = null
  let guideLabelMesh: InstancedMesh | null = null
  let guideLabelTexture: CanvasTexture | null = null
  let guideLabelShader: ShaderMaterial | null = null
  let guideLabelTint: InstancedBufferAttribute | null = null
  const guideLabelGeometry = new PlaneGeometry(1, 1)
  /** Per entry: its pillar (pillars on), else null. */
  let entryPillars: (PillarLayout | null)[] = []
  /** Pillar instances: the entry of each tube / cap, and of each fill layer with its run. */
  let pillarEntries: number[] = []
  let fillRuns: { entry: number; y0: number; y1: number; color: Color }[] = []
  /** The aid's guide lines (height above the tile top) and the back wall they stand on. */
  let guides: { hour: number; y: number }[] = []
  /**
   * The aid's guides: the week has lines on the back wall (along x). The month has graduation ticks on every pillar
   * instead (a measuring cylinder): lines on its back wall would raise the top of the grid and shrink the board in its
   * wide stage by about a third, and a side wall is seen almost edge-on and crosses the tiles.
   */
  let guideWall = { a0: 0, a1: 0, at: 0 }
  let tickMesh: InstancedMesh | null = null
  let tickLight: InstancedBufferAttribute | null = null
  const tickGeometry = new TorusGeometry(1, 0.028, 4, 28).rotateX(Math.PI / 2)
  /** Per tick: its pillar (entry) and height. */
  let ticks: { entry: number; y: number }[] = []
  let guideLabelAspect: number[] = []

  // ── State ──
  let model: CapsuleBoardModel | null = null
  let entries: Entry[] = []
  let entryByKey = new Map<string, number>()
  let capsules: CapsuleRef[] = []
  let poolEntries: number[] = []
  let labelEntries: number[] = []
  let morph: Anim = null
  let riseStartedAt = -Infinity
  let riseMs = 420
  let riseEnd = 0
  /** The asked view and the shown one: a request during a morph waits for it (capsule-board-view.ts). */
  let viewState: ViewRequestState = { applied: options.view, requested: options.view }
  /** The WebGL context is lost (nothing is drawn until it is restored). */
  let contextLost = false
  let contextTimer = 0
  /** 0 = 2.5D, 1 = 2D. */
  let flatFrom = options.view === '2d' ? 1 : 0
  let flatTo = flatFrom
  let flatAnim: Anim = null
  let cam: Camera = { azimuth: 0, elevation: 90, center: new Vector3(), upp: 0.01 }
  let camFrom: Camera = cam
  let camTo: Camera = cam
  let camAnim: Anim = null
  let hovered: BoardTarget | null = null
  let active: BoardTarget | null = null
  let selectedKey: string | null = null
  let emphasisDays = new Set<string>()
  let streakKeys: string[] = []
  let emphasisProgress = 0
  let emphasisTarget = 0
  let emphasisFinishedAt = -Infinity
  /** The emphasis of the current comment has played and faded (typing callbacks after that are ignored). */
  let emphasisDone = false
  let beamProgress = 0
  const tilt = new Vector2()
  const tiltTarget = new Vector2()
  let running = true
  let disposed = false
  let raf = 0
  let lastTime = 0
  let benchmarking = false
  let width = 1
  let height = 1

  const matrix = new Matrix4()
  const position = new Vector3()
  const quaternion = new Quaternion()
  const scale = new Vector3()
  const upright = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2)
  const spin = new Quaternion()
  const lying = new Quaternion()
  const standing = new Quaternion()
  const zero = new Matrix4().makeScale(0, 0, 0)
  const yAxis = new Vector3(0, 1, 0)
  const xAxis = new Vector3(1, 0, 0)
  const zAxis = new Vector3(0, 0, 1)

  const now = () => performance.now()
  const progressOf = (anim: Anim, at: number) => (anim ? clamp01((at - anim.start) / anim.duration) : 1)
  /** 2D share now (eased): 0 = 2.5D, 1 = 2D. */
  const flatNow = (at: number) => lerp(flatFrom, flatTo, easeInOut(progressOf(flatAnim, at)))
  const mode = () => model?.mode ?? 'week'
  /** Glass pillars on for this period (DEV draft; the year keeps its columns). */
  const pillarsOn = () => model !== null && pillarsApply(pillarMode, mode())
  const aidOn = () => pillarsOn() && pillarMode === 'glass-aid'
  const dims = () => pillarDims(mode(), pillarMode === 'glass-aid')
  let scaleCache: { model: CapsuleBoardModel; hours: number } | null = null
  const scaleHours = () => {
    if (!model) return 2
    if (scaleCache?.model !== model) scaleCache = { model, hours: pillarScaleHours(model.tiles) }
    return scaleCache.hours
  }
  /** Standing height of a day: its pillar with the pillars on, else its column. */
  function columnHeight(tile: BoardTile) {
    if (!pillarsOn()) return tile.height
    return tile.capsules.length ? pillarLayoutOf(tile).height : 0
  }
  function pillarLayoutOf(tile: BoardTile) {
    const { maxHeight, radius } = dims()
    return pillarLayout(tile.capsules, tile.day.connectionSeconds, { scaleHours: scaleHours(), maxHeight, radius })
  }

  function entryPose(entry: Entry, at: number): Pose {
    const t = easeInOut(progressOf(morph, at))
    return { x: lerp(entry.from.x, entry.to.x, t), z: lerp(entry.from.z, entry.to.z, t), s: lerp(entry.from.s, entry.to.s, t) }
  }

  // ── Building the instanced meshes for the current entries ──
  function disposeMeshes() {
    for (const mesh of [tileMesh, labelMesh, shellMesh, coreMesh, haloMesh, poolMesh, beamMesh, tubeMesh, capMesh, fillMesh, guideMesh, guideLabelMesh, tickMesh]) {
      if (!mesh) continue
      board.remove(mesh)
      mesh.dispose()
    }
    tileMesh = labelMesh = shellMesh = coreMesh = haloMesh = poolMesh = beamMesh = null
    tubeMesh = capMesh = fillMesh = guideMesh = guideLabelMesh = tickMesh = null
    // Per-instance attributes live on the shared geometries: disposing frees their GPU buffers.
    for (const geometry of [fullShellGeometry, lightShellGeometry, coreGeometry, haloGeometry, labelGeometry, poolGeometry, beamGeometry, tubeGeometry, fillGeometry, capGeometry, guideGeometry, guideLabelGeometry, tickGeometry]) {
      geometry.dispose()
    }
    labelTexture?.dispose()
    labelShader?.dispose()
    labelTexture = null
    labelShader = null
    guideLabelTexture?.dispose()
    guideLabelShader?.dispose()
    guideLabelTexture = null
    guideLabelShader = null
  }

  function buildLabels() {
    labelEntries = entries.flatMap((entry, index) => (entry.label ? [index] : []))
    if (labelEntries.length === 0) return
    const small = labelEntries.length > 60
    const cell = small ? { width: 128, height: 32, perRow: 16 } : { width: 256, height: 64, perRow: 8 }
    const rows = Math.ceil(labelEntries.length / cell.perRow)
    const atlas = document.createElement('canvas')
    atlas.width = cell.width * cell.perRow
    atlas.height = cell.height * rows
    const context = atlas.getContext('2d')!
    context.fillStyle = '#ffffff'
    context.textBaseline = 'middle'
    const family = getComputedStyle(host).fontFamily || 'system-ui, sans-serif'
    const uv = new Float32Array(labelEntries.length * 4)
    labelAspect = []
    labelEntries.forEach((entryIndex, index) => {
      const label = entries[entryIndex]!.label!
      const cx = (index % cell.perRow) * cell.width
      const cy = Math.floor(index / cell.perRow) * cell.height
      context.font = `${label.today ? 700 : 600} ${Math.round(cell.height * 0.7)}px ${family}`
      const text = label.today && label.kind === 'date' ? `${label.text} •` : label.text
      const textWidth = Math.min(cell.width - 4, Math.ceil(context.measureText(text).width) + 4)
      context.fillText(text, cx + 2, cy + cell.height / 2 + 1)
      labelAspect.push(textWidth / cell.height)
      uv.set([cx / atlas.width, 1 - (cy + cell.height) / atlas.height, (cx + textWidth) / atlas.width, 1 - cy / atlas.height], index * 4)
    })
    labelTexture = new CanvasTexture(atlas)
    labelTexture.anisotropy = 4
    labelShader = labelMaterial(labelTexture)
    labelGeometry.setAttribute('instanceUv', new InstancedBufferAttribute(uv, 4))
    labelTint = new InstancedBufferAttribute(new Float32Array(labelEntries.length * 4), 4)
    labelTint.setUsage(DynamicDrawUsage)
    labelGeometry.setAttribute('instanceTint', labelTint)
    labelMesh = new InstancedMesh(labelGeometry, labelShader, labelEntries.length)
    labelMesh.frustumCulled = false
    labelMesh.renderOrder = 1
    labelMesh.instanceMatrix.setUsage(DynamicDrawUsage)
    board.add(labelMesh)
  }

  function buildCapsules() {
    capsules = []
    poolEntries = []
    for (const [entryIndex, entry] of entries.entries()) {
      const tile = entry.tile
      if (!tile || tile.capsules.length === 0) continue
      poolEntries.push(entryIndex)
      const slots = chipSlots(tile.capsules.map((capsule) => capsule.length))
      const pillar = entryPillars[entryIndex] ?? null
      tile.capsules.forEach((capsule, piece) => {
        capsules.push({ entry: entryIndex, capsule, piece, count: tile.capsules.length, start: null, slot: slots[piece]!, pillar: pillar?.capsules[piece] ?? null })
      })
    }
    const count = capsules.length
    if (count > 0) {
      glowAttribute = new InstancedBufferAttribute(new Float32Array(count), 1)
      glowAttribute.setUsage(DynamicDrawUsage)
      const weight = new InstancedBufferAttribute(new Float32Array(count), 1)
      const light = new InstancedBufferAttribute(new Float32Array(count * 3), 3)
      const tintColor = new InstancedBufferAttribute(new Float32Array(count * 3), 3)
      const glow = new InstancedBufferAttribute(new Float32Array(count * 3), 3)
      const keepsake = new InstancedBufferAttribute(new Float32Array(count), 1)
      const color = new Color()
      capsules.forEach(({ capsule }, index) => {
        weight.setX(index, capsule.glow)
        color.set(capsule.colors.light)
        light.setXYZ(index, color.r, color.g, color.b)
        color.set(capsule.colors.tint)
        tintColor.setXYZ(index, color.r, color.g, color.b)
        color.set(capsule.colors.glow)
        glow.setXYZ(index, color.r, color.g, color.b)
        keepsake.setX(index, capsule.keepsake ? 1 : 0)
      })
      shellGeometry = model?.mode === 'year' || count > LIGHT_MESH_FROM ? lightShellGeometry : fullShellGeometry
      for (const geometry of [shellGeometry, coreGeometry, haloGeometry]) {
        geometry.setAttribute('instanceGlow', glowAttribute)
        geometry.setAttribute('instanceWeight', weight)
        geometry.setAttribute('instanceLight', light)
        geometry.setAttribute('instanceTint', tintColor)
        geometry.setAttribute('instanceGlowColor', glow)
        geometry.setAttribute('instanceKeepsake', keepsake)
      }
      shellMesh = new InstancedMesh(shellGeometry, shellShader, count)
      shellMesh.instanceMatrix.setUsage(DynamicDrawUsage)
      coreMesh = new InstancedMesh(coreGeometry, coreShader, count)
      haloMesh = new InstancedMesh(haloGeometry, haloShader, count)
      for (const [mesh, order] of [[coreMesh, 7], [shellMesh, 8], [haloMesh, 9]] as const) {
        mesh.frustumCulled = false
        mesh.renderOrder = order
        if (mesh !== shellMesh) mesh.instanceMatrix = shellMesh.instanceMatrix
        board.add(mesh)
      }
    }
    // Pools of light under the columns (they seat the columns on their tiles).
    if (poolEntries.length > 0) {
      poolLight = new InstancedBufferAttribute(new Float32Array(poolEntries.length * 4), 4)
      poolLight.setUsage(DynamicDrawUsage)
      poolGeometry.setAttribute('instanceLight', poolLight)
      poolMesh = new InstancedMesh(poolGeometry, poolShader, poolEntries.length)
      poolMesh.instanceMatrix.setUsage(DynamicDrawUsage)
      poolMesh.frustumCulled = false
      poolMesh.renderOrder = 2
      board.add(poolMesh)
    }
    // The streak's line of light: up to one segment per day.
    beamLight = new InstancedBufferAttribute(new Float32Array(64 * 4), 4)
    beamLight.setUsage(DynamicDrawUsage)
    beamGeometry.setAttribute('instanceLight', beamLight)
    beamMesh = new InstancedMesh(beamGeometry, beamShader, 64)
    beamMesh.count = 0
    beamMesh.instanceMatrix.setUsage(DynamicDrawUsage)
    beamMesh.frustumCulled = false
    beamMesh.renderOrder = 3
    board.add(beamMesh)
  }

  /** Glass pillars (DEV draft): tubes, top rings and the fill's layers; with the aid, the guide lines too. */
  function buildPillars() {
    pillarEntries = []
    fillRuns = []
    guides = []
    if (!pillarsOn()) return
    entries.forEach((_, index) => {
      const pillar = entryPillars[index]
      if (!pillar || pillar.height <= 0) return
      pillarEntries.push(index)
      for (const segment of pillar.segments) fillRuns.push({ entry: index, y0: segment.y0, y1: segment.y1, color: new Color(segment.colors.glow) })
    })
    const instanced = (geometry: BufferGeometry, material: ShaderMaterial, count: number, order: number) => {
      const light = new InstancedBufferAttribute(new Float32Array(Math.max(1, count) * 4), 4)
      light.setUsage(DynamicDrawUsage)
      geometry.setAttribute('instanceLight', light)
      const mesh = new InstancedMesh(geometry, material, Math.max(1, count))
      mesh.count = count
      mesh.instanceMatrix.setUsage(DynamicDrawUsage)
      mesh.frustumCulled = false
      mesh.renderOrder = order
      board.add(mesh)
      return { mesh, light }
    }
    if (pillarEntries.length) {
      ;({ mesh: fillMesh, light: fillLight } = instanced(fillGeometry, fillShader, fillRuns.length, 5))
      ;({ mesh: tubeMesh, light: tubeLight } = instanced(tubeGeometry, tubeShader, pillarEntries.length, 6))
      ;({ mesh: capMesh, light: capLight } = instanced(capGeometry, capShader, pillarEntries.length, 10))
    }
    ticks = []
    if (!aidOn() || !model) return
    // Guides at whole hours (pillar-scale heights): the month's ticks on the pillars, the week's lines on the back wall.
    const { maxHeight } = dims()
    const hours = guideHours(scaleHours())
    const levels = hours.map((hour) => ({ hour, y: (hour / scaleHours()) * maxHeight }))
    if (mode() === 'month') {
      for (const entryIndex of pillarEntries) {
        const height = entryPillars[entryIndex]!.height
        for (const level of levels) if (level.y < height - 0.02) ticks.push({ entry: entryIndex, y: level.y })
      }
      if (ticks.length) ({ mesh: tickMesh, light: tickLight } = instanced(tickGeometry, capShader, ticks.length, 10))
      return
    }
    guides = levels
    guideWall = guideWallOf(model)
    guideMesh = new InstancedMesh(guideGeometry, guideShader, Math.max(1, guides.length))
    guideMesh.count = guides.length
    guideMesh.frustumCulled = false
    guideMesh.renderOrder = 4
    board.add(guideMesh)
    // Their labels (「1시간」…), at the left end of each line.
    const cell = { width: 192, height: 48 }
    const atlas = document.createElement('canvas')
    atlas.width = cell.width
    atlas.height = cell.height * Math.max(1, guides.length)
    const context = atlas.getContext('2d')!
    context.fillStyle = '#ffffff'
    context.textBaseline = 'middle'
    context.font = `600 ${Math.round(cell.height * 0.62)}px ${getComputedStyle(host).fontFamily || 'system-ui, sans-serif'}`
    const uv = new Float32Array(Math.max(1, guides.length) * 4)
    guideLabelAspect = []
    guides.forEach((guide, index) => {
      const text = `${guide.hour}시간`
      const textWidth = Math.min(cell.width - 4, Math.ceil(context.measureText(text).width) + 4)
      context.fillText(text, 2, index * cell.height + cell.height / 2 + 1)
      guideLabelAspect.push(textWidth / cell.height)
      uv.set([0, 1 - ((index + 1) * cell.height) / atlas.height, textWidth / atlas.width, 1 - (index * cell.height) / atlas.height], index * 4)
    })
    guideLabelTexture = new CanvasTexture(atlas)
    guideLabelShader = labelMaterial(guideLabelTexture)
    guideLabelGeometry.setAttribute('instanceUv', new InstancedBufferAttribute(uv, 4))
    guideLabelTint = new InstancedBufferAttribute(new Float32Array(Math.max(1, guides.length) * 4), 4)
    guideLabelTint.setUsage(DynamicDrawUsage)
    guideLabelGeometry.setAttribute('instanceTint', guideLabelTint)
    guideLabelMesh = new InstancedMesh(guideLabelGeometry, guideLabelShader, Math.max(1, guides.length))
    guideLabelMesh.count = guides.length
    guideLabelMesh.frustumCulled = false
    guideLabelMesh.renderOrder = 4
    board.add(guideLabelMesh)
  }

  function guideWallOf(next: CapsuleBoardModel) {
    let x0 = Infinity
    let x1 = -Infinity
    let z0 = Infinity
    for (const tile of next.tiles) {
      x0 = Math.min(x0, tile.x)
      x1 = Math.max(x1, tile.x)
      z0 = Math.min(z0, tile.z)
    }
    return { a0: x0 - 0.5, a1: x1 + 0.5, at: z0 - 0.56 }
  }

  function rebuild() {
    disposeMeshes()
    entryPillars = entries.map((entry) => (pillarsOn() && entry.tile && entry.tile.capsules.length ? pillarLayoutOf(entry.tile) : null))
    entryByKey = new Map(entries.map((entry, index) => [entry.key, index]))
    tileMesh = new InstancedMesh(tileGeometry, tileMaterial, Math.max(1, entries.length))
    tileMesh.count = entries.length
    tileMesh.instanceMatrix.setUsage(DynamicDrawUsage)
    tileMesh.frustumCulled = false
    tileMesh.renderOrder = 0
    board.add(tileMesh)
    for (let index = 0; index < entries.length; index++) tileMesh.setColorAt(index, TILE_COLOR.empty)
    buildLabels()
    buildCapsules()
    buildPillars()
  }

  function entriesOf(next: CapsuleBoardModel): Entry[] {
    const labelByTile = new Map(next.labels.flatMap((label) => (label.tile === null ? [] : [[label.tile, label] as const])))
    const list: Entry[] = next.tiles.map((tile) => ({
      key: tile.day.key,
      tile,
      label: labelByTile.get(tile.index) ?? null,
      from: { x: tile.x, z: tile.z, s: 1 },
      to: { x: tile.x, z: tile.z, s: 1 },
      lift: 0,
      emphasis: 0,
    }))
    for (const label of next.labels) {
      if (label.kind !== 'month') continue
      const pose = { x: label.x, z: label.z, s: 1 }
      list.push({ key: `month:${label.key}`, tile: null, label, from: { ...pose }, to: { ...pose }, lift: 0, emphasis: 0 })
    }
    return list
  }

  function settleCamera() {
    if (!camAnim) return
    cam = camTo
    camAnim = null
  }

  function finishMorph({ interrupted = false }: { interrupted?: boolean } = {}) {
    if (!morph) return
    morph = null
    const kept = entries.filter((entry) => entry.to.s > 0)
    for (const entry of kept) entry.from = { ...entry.to }
    if (kept.length !== entries.length) {
      entries = kept
      rebuild()
      updateTileColors()
    }
    settleCamera()
    settleView(interrupted)
  }

  /** Applies a view request that waited for a morph (animated when the morph played out, at once when cut short). */
  function settleView(interrupted: boolean) {
    const { state, apply } = settleViewRequest(viewState, { interrupted })
    viewState = state
    applyView(apply)
  }

  function finishFlat() {
    if (!flatAnim) return
    flatAnim = null
    flatFrom = flatTo
    settleCamera()
  }

  function setBoard(next: CapsuleBoardModel, transition: BoardTransition) {
    finishFlat()
    const at = now()
    const previous = model
    const nextEntries = entriesOf(next)
    const shared = previous ? nextEntries.some((entry) => entry.tile && entryByKey.has(entry.key)) : false
    const doMorph =
      transition === 'morph' && !reducedMotion && previous !== null && shared && previous.rangeKey !== next.rangeKey
    model = next
    if (doMorph) {
      // From where everything is now to the new grid; new days grow in place, days that leave shrink away.
      const current = new Map(entries.map((entry) => [entry.key, { pose: entryPose(entry, at), entry }]))
      const merged: Entry[] = nextEntries.map((entry) => {
        const old = current.get(entry.key)
        return { ...entry, from: old ? old.pose : { ...entry.to, s: 0 }, lift: old?.entry.lift ?? 0, emphasis: old?.entry.emphasis ?? 0 }
      })
      const nextKeys = new Set(nextEntries.map((entry) => entry.key))
      for (const { pose, entry } of current.values()) {
        if (nextKeys.has(entry.key) || pose.s <= 0.001) continue
        merged.push({ ...entry, from: pose, to: { ...pose, s: 0 } })
      }
      entries = merged
      morph = { start: at, duration: MORPH_MS }
      riseStartedAt = -Infinity
      rebuild()
      startCamera(MORPH_MS, at)
    } else {
      // A running morph is cut short by the new board: a view asked for meanwhile is applied right away.
      morph = null
      const { state, apply } = settleViewRequest(viewState, { interrupted: true })
      viewState = state
      if (apply) {
        flatFrom = flatTo = apply.view === '2d' ? 1 : 0
        flatAnim = null
      }
      entries = nextEntries
      rebuild()
      riseTiming(next)
      riseStartedAt = transition === 'rise' && !reducedMotion ? at : -Infinity
      cam = camFrom = camTo = fitCamera(flatTo)
      camAnim = null
    }
    if (hovered) {
      hovered = null
      options.onHover(null)
    }
    active = null
    updateTileColors()
    schedule()
  }

  /** Every capsule's start in the rise (days in date order, each column bottom-up). */
  function riseTiming(next: CapsuleBoardModel) {
    const timing = boardRiseTiming(next.tiles)
    riseMs = timing.riseMs
    riseEnd = timing.totalMs
    for (const ref of capsules) {
      const tile = entries[ref.entry]!.tile!
      const start = timing.starts[tile.index]
      ref.start = start === null || start === undefined ? null : start + ref.piece * timing.pieceStepMs
    }
  }

  /** DEV draft: pillars on / off / with the aid. The columns rise again in the new form. */
  function setPillars(next: PillarMode) {
    if (next === pillarMode) return
    finishMorph()
    finishFlat()
    pillarMode = next
    if (!model) return
    rebuild()
    riseTiming(model)
    riseStartedAt = reducedMotion ? -Infinity : now()
    cam = camFrom = camTo = fitCamera(flatTo)
    camAnim = null
    updateTileColors()
    schedule()
  }

  function setView(next: BoardView, animate: boolean) {
    const { state, apply } = requestView(viewState, next, { morphing: morph !== null, animate: animate && !reducedMotion })
    viewState = state
    if (apply && morph) finishMorph()
    applyView(apply)
    schedule()
  }

  function applyView(apply: ViewApply) {
    if (!apply) return
    const target = apply.view === '2d' ? 1 : 0
    const at = now()
    if (!apply.animate || reducedMotion || !model) {
      flatFrom = flatTo = target
      flatAnim = null
      cam = camFrom = camTo = fitCamera(target)
      camAnim = null
    } else {
      flatFrom = flatNow(at)
      flatTo = target
      flatAnim = { start: at, duration: FLAT_MS }
      startCamera(FLAT_MS, at)
    }
    schedule()
  }

  function startCamera(duration: number, at: number) {
    camFrom = currentCamera(at)
    camTo = fitCamera(flatTo)
    camAnim = { start: at, duration }
  }

  function currentCamera(at: number): Camera {
    if (!camAnim) return cam
    const t = easeInOut(progressOf(camAnim, at))
    return {
      azimuth: lerp(camFrom.azimuth, camTo.azimuth, t),
      elevation: lerp(camFrom.elevation, camTo.elevation, t),
      center: camFrom.center.clone().lerp(camTo.center, t),
      // Zoom in scale space, so zooming out and in feel even.
      upp: Math.exp(lerp(Math.log(camFrom.upp), Math.log(camTo.upp), t)),
    }
  }

  // ── Camera ──
  function direction(targetFlat: number) {
    const base = (width < NARROW_WIDTH ? NARROW_VIEW : VIEW)[mode()]
    // The aid's month looks down a little more steeply, so front pillars hide less of the rows behind.
    const elevation = base.elevation + (pillarsOn() ? dims().elevation : 0)
    return {
      azimuth: lerp(base.azimuth, FLAT_VIEW.azimuth, targetFlat),
      elevation: lerp(elevation, FLAT_VIEW.elevation, targetFlat),
    }
  }

  function basis(azimuth: number, elevation: number) {
    const az = (azimuth * Math.PI) / 180
    const el = (elevation * Math.PI) / 180
    const forward = new Vector3(-Math.sin(az) * Math.cos(el), -Math.sin(el), -Math.cos(az) * Math.cos(el))
    const right = new Vector3(Math.cos(az), 0, -Math.sin(az))
    const up = new Vector3().crossVectors(right, forward).normalize()
    return { forward, right, up }
  }

  /** Camera that shows the target model (its grid places) with its columns, at a 2D share. */
  function fitCamera(targetFlat: number): Camera {
    const { azimuth, elevation } = direction(targetFlat)
    if (!model) return { azimuth, elevation, center: new Vector3(), upp: 0.01 }
    const { right, up } = basis(azimuth, elevation)
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    const point = new Vector3()
    const add = (x: number, y: number, z: number) => {
      point.set(x, y, z)
      const vx = point.dot(right)
      const vy = point.dot(up)
      minX = Math.min(minX, vx)
      maxX = Math.max(maxX, vx)
      minY = Math.min(minY, vy)
      maxY = Math.max(maxY, vy)
    }
    const half = BOARD.tileSize / 2
    const standingShare = 1 - targetFlat
    for (const tile of model.tiles) {
      for (const dx of [-half, half]) for (const dz of [-half, half]) add(tile.x + dx, 0, tile.z + dz)
      const columnTop = columnHeight(tile)
      if (columnTop > 0 && standingShare > 0) {
        add(tile.x, (BOARD.tileHeight + columnTop + BOARD.capsuleLength + LIFT) * standingShare, tile.z)
      }
    }
    // The week's highest guide line and its label stay in view.
    if (aidOn() && mode() === 'week' && standingShare > 0) {
      const top = guideHours(scaleHours()).at(-1) ?? 0
      const y = (BOARD.tileHeight + (top / scaleHours()) * dims().maxHeight) * standingShare
      const wall = guideWallOf(model)
      add(wall.a0 - 0.7, y, wall.at)
      add(wall.a1, y, wall.at)
    }
    for (const label of model.labels) {
      if (label.kind !== 'month') continue
      add(label.x, 0, label.z + label.size)
      add(label.x + label.size * 2.4, 0, label.z + label.size)
    }
    const pad = 1.12
    const upp = Math.max(((maxX - minX) * pad) / width, ((maxY - minY) * pad) / height, 1e-4)
    const center = right.clone().multiplyScalar((minX + maxX) / 2).add(up.clone().multiplyScalar((minY + maxY) / 2))
    return { azimuth, elevation, center, upp }
  }

  function applyCamera(state: Camera) {
    const { forward, up } = basis(state.azimuth, state.elevation)
    camera.position.copy(state.center).addScaledVector(forward, -120)
    camera.up.copy(up)
    camera.lookAt(state.center)
    const halfW = (width * state.upp) / 2
    const halfH = (height * state.upp) / 2
    camera.left = -halfW
    camera.right = halfW
    camera.top = halfH
    camera.bottom = -halfH
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
  }

  function resize() {
    const rect = host.getBoundingClientRect()
    width = Math.max(1, Math.round(rect.width))
    height = Math.max(1, Math.round(rect.height))
    renderer.setSize(width, height, false)
    if (camAnim) camTo = fitCamera(flatTo)
    else cam = camFrom = camTo = fitCamera(flatTo)
    // Resizing clears the canvas: draw at once so it never shows empty until the next frame.
    if (model && !disposed && !contextLost) {
      const at = now()
      applyCamera(currentCamera(at))
      compose(at)
      renderer.render(scene, camera)
    }
    schedule()
  }
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(host)
  resize()

  // ── Colours ──
  const sameTarget = (a: BoardTarget | null, b: BoardTarget | null) => {
    if (!a || !b || a.kind !== b.kind) return a === b
    return a.kind === 'day' ? a.key === (b as { key: string }).key : a.month === (b as { month: number }).month
  }
  const isLit = (entry: Entry, target: BoardTarget | null) =>
    Boolean(target && entry.tile && (target.kind === 'day' ? target.key === entry.key : target.month === entry.tile.month))

  function updateTileColors() {
    if (!tileMesh) return
    const color = new Color()
    entries.forEach((entry, index) => {
      const tile = entry.tile
      if (!tile) {
        tileMesh!.setColorAt(index, TILE_COLOR.empty)
        return
      }
      const base = tile.day.isFuture
        ? TILE_COLOR.future
        : tile.capsules.length > 0
          ? TILE_COLOR.filled
          : mode() === 'year'
            ? TILE_COLOR.emptyYear
            : TILE_COLOR.empty
      color.copy(base)
      if (entry.emphasis > 0.01) color.lerp(TILE_COLOR.emphasis, entry.emphasis)
      if (entry.key === selectedKey && mode() !== 'year') color.copy(TILE_COLOR.selected)
      else if (isLit(entry, hovered) || isLit(entry, active)) color.lerp(TILE_COLOR.hover, 0.85)
      tileMesh!.setColorAt(index, color)
    })
    if (tileMesh.instanceColor) tileMesh.instanceColor.needsUpdate = true
  }

  // ── Per frame ──
  function riseOf(ref: CapsuleRef, at: number) {
    if (ref.start === null || riseStartedAt === -Infinity) return 1
    return clamp01((at - riseStartedAt - ref.start) / riseMs)
  }

  function compose(at: number) {
    if (!tileMesh) return
    const flatValue = flatNow(at)
    const standingShare = 1 - flatValue
    const poses = entries.map((entry) => entryPose(entry, at))
    const lifts = entries.map((entry) => (reducedMotion ? 0 : entry.lift * LIFT * standingShare))

    entries.forEach((entry, index) => {
      const pose = poses[index]!
      if (!entry.tile || pose.s <= 0.001) {
        tileMesh!.setMatrixAt(index, zero)
        return
      }
      matrix.makeScale(pose.s, 1, pose.s).setPosition(pose.x, BOARD.tileHeight / 2 + lifts[index]!, pose.z)
      tileMesh!.setMatrixAt(index, matrix)
    })
    tileMesh.instanceMatrix.needsUpdate = true

    // Labels: 2.5D at the tile's front-right corner (right-aligned, never under a column), 2D at its top-left like a
    // wall calendar and larger.
    if (labelMesh && labelTint) {
      labelEntries.forEach((entryIndex, index) => {
        const entry = entries[entryIndex]!
        const label = entry.label!
        const pose = poses[entryIndex]!
        const aspect = labelAspect[index]!
        let x: number
        let z: number
        let size: number
        let alpha: number
        let y = 0.004
        if (label.kind === 'month') {
          size = label.size
          x = pose.x + (size * aspect) / 2
          z = pose.z + size / 2
          alpha = label.today ? 0.95 : 0.7
        } else {
          const half = BOARD.tileSize / 2
          const yearDay = mode() === 'year'
          size = lerp(label.size, yearDay ? 0.34 : mode() === 'week' ? 0.3 : 0.27, flatValue)
          const w = size * aspect
          x = lerp(pose.x + half - 0.05 - w / 2, pose.x - half + 0.07 + w / 2, flatValue)
          z = lerp(pose.z + half - 0.05 - size / 2, pose.z - half + 0.06 + size / 2, flatValue)
          y = BOARD.tileHeight + 0.004 + lifts[entryIndex]!
          // The year's 365 dates read only from above.
          alpha = (yearDay ? flatValue : 1) * (label.today ? 0.95 : lerp(0.62, 0.8, flatValue))
        }
        const s = pose.s
        matrix.makeScale(size * aspect * s, 1, size * s).setPosition(x, y, z)
        labelMesh!.setMatrixAt(index, matrix)
        const ink = label.today ? 0.98 : 0.8
        labelTint!.setXYZW(index, ink, ink, Math.min(1, ink + 0.03), alpha * Math.min(1, s * 1.5))
      })
      labelMesh.instanceMatrix.needsUpdate = true
      labelTint.needsUpdate = true
    }

    // Capsules: standing in the column (2.5D) ↔ lying as chips in the tile (2D). The bottom one stands up first.
    // With the glass pillars (DEV draft) they lie in the pillar instead and sink with it into the chips.
    const pillarRise = pillarEntries.length ? new Float32Array(entries.length) : null
    if (shellMesh && glowAttribute) {
      capsules.forEach((ref, index) => {
        const entry = entries[ref.entry]!
        const pose = poses[ref.entry]!
        const capsule = ref.capsule
        const rise = riseOf(ref, at)
        if (pillarRise && ref.pillar) pillarRise[ref.entry]! += rise / ref.count
        if (rise <= 0 || pose.s <= 0.001) {
          shellMesh!.setMatrixAt(index, zero)
          return
        }
        const order = ref.count > 1 ? ref.piece / (ref.count - 1) : 0
        const stand = easeInOut(clamp01((standingShare - 0.3 * order) / 0.7))
        const grow = easeOutBack(rise)
        const inPillar = ref.pillar
        const drop = (1 - easeOut(rise)) * (inPillar ? 0.6 : capsule.length * 0.9)
        if (inPillar) {
          // Lying across the pillar, leaning a little to fill its 30-minute step; heading turned per capsule.
          spin.setFromAxisAngle(yAxis, inPillar.yaw)
          standing.setFromAxisAngle(zAxis, inPillar.tilt)
          standing.premultiply(spin)
        } else {
          spin.setFromAxisAngle(yAxis, capsule.roll)
          standing.copy(spin).multiply(upright)
        }
        lying.setFromAxisAngle(xAxis, capsule.roll)
        quaternion.slerpQuaternions(lying, standing, stand)
        const chipLength = ref.slot.length
        const standLength = inPillar ? (inPillar.visible ? inPillar.length : 0) : capsule.length
        const length = Math.max(0.0005, lerp(chipLength, standLength, stand) * Math.max(0.001, grow) * pose.s)
        const chipRadius = (chipLength * CAPSULE_ASPECT) / 2
        // In a pillar the capsules sink with it (its height shrinks with the 2D share).
        const yStand = BOARD.tileHeight + lifts[ref.entry]! + (inPillar ? inPillar.y * standingShare : capsule.y) - drop
        const yLie = BOARD.tileHeight + chipRadius * 0.9
        position.set(
          pose.x + lerp(ref.slot.x, 0, stand) * pose.s,
          lerp(yLie, yStand, stand),
          pose.z + lerp(ref.slot.z, 0, stand) * pose.s,
        )
        scale.setScalar(length)
        matrix.compose(position, quaternion, scale)
        shellMesh!.setMatrixAt(index, matrix)
        const highlight = Math.max(entry.lift, entry.key === selectedKey ? 0.6 : 0, entry.emphasis * 0.9)
        glowAttribute!.setX(index, 0.5 + capsule.glow * 0.42 + highlight * 1.0 + (capsule.keepsake ? 0.6 : 0))
      })
      shellMesh.instanceMatrix.needsUpdate = true
      glowAttribute.needsUpdate = true
    }

    // Glass pillars: they grow with their capsules' rise and sink into the floor towards 2D.
    if (pillarRise && tubeMesh && capMesh && fillMesh && tubeLight && capLight && fillLight) {
      const { radius } = dims()
      const marked = aidOn() ? longestDayKey(model?.tiles ?? []) : null
      const visibleShare = new Float32Array(entries.length)
      pillarEntries.forEach((entryIndex, index) => {
        const entry = entries[entryIndex]!
        const pose = poses[entryIndex]!
        const pillar = entryPillars[entryIndex]!
        const share = clamp01(pillarRise[entryIndex]!) * standingShare
        visibleShare[entryIndex] = share
        const h = pillar.height * share
        if (h <= 0.002 || pose.s <= 0.001) {
          tubeMesh!.setMatrixAt(index, zero)
          capMesh!.setMatrixAt(index, zero)
          return
        }
        const base = BOARD.tileHeight + lifts[entryIndex]!
        const r = radius * pose.s
        matrix.makeScale(r, h, r).setPosition(pose.x, base, pose.z)
        tubeMesh!.setMatrixAt(index, matrix)
        matrix.makeScale(r, r, r).setPosition(pose.x, base + h, pose.z)
        capMesh!.setMatrixAt(index, matrix)
        const highlight = Math.max(entry.lift, entry.key === selectedKey ? 0.6 : 0, entry.emphasis)
        const fade = Math.min(1, standingShare * 1.6)
        tubeLight!.setXYZW(index, 0.82, 0.76, 0.98, (0.55 + 0.45 * highlight) * fade)
        const top = entry.key === marked ? 1.35 : 1
        capLight!.setXYZW(index, 0.86, 0.8, 1.0, (0.42 + 0.4 * highlight) * top * fade)
      })
      fillRuns.forEach((run, index) => {
        const entry = entries[run.entry]!
        const pose = poses[run.entry]!
        const pillar = entryPillars[run.entry]!
        const share = visibleShare[run.entry]!
        if (share <= 0.002 || pose.s <= 0.001) {
          fillMesh!.setMatrixAt(index, zero)
          return
        }
        const r = dims().radius * pose.s
        const base = BOARD.tileHeight + lifts[run.entry]! + run.y0 * share
        matrix.makeScale(r, Math.max(0.0005, (run.y1 - run.y0) * share), r).setPosition(pose.x, base, pose.z)
        fillMesh!.setMatrixAt(index, matrix)
        // The fill is the light of the day's capsules: stronger where few capsules are drawn (the filled pillar).
        const highlight = Math.max(entry.lift, entry.key === selectedKey ? 0.6 : 0, entry.emphasis)
        const strength = (pillar.simplified ? 0.62 : 0.4) + 0.3 * highlight
        fillLight!.setXYZW(index, run.color.r, run.color.g, run.color.b, strength * Math.min(1, standingShare * 1.6))
      })
      for (const [mesh, light] of [[tubeMesh, tubeLight], [capMesh, capLight], [fillMesh, fillLight]] as const) {
        mesh.instanceMatrix.needsUpdate = true
        light.needsUpdate = true
      }
      // The month's graduation ticks on the glass (whole hours), sinking with the pillar.
      if (tickMesh && tickLight) {
        const radius = dims().radius * 1.02
        ticks.forEach((tick, index) => {
          const pose = poses[tick.entry]!
          const share = visibleShare[tick.entry]!
          const pillar = entryPillars[tick.entry]!
          if (share <= 0.002 || pose.s <= 0.001 || tick.y > pillar.height * share) {
            tickMesh!.setMatrixAt(index, zero)
            return
          }
          const r = radius * pose.s
          matrix.makeScale(r, r, r).setPosition(pose.x, BOARD.tileHeight + lifts[tick.entry]! + tick.y * standingShare, pose.z)
          tickMesh!.setMatrixAt(index, matrix)
          tickLight!.setXYZW(index, 0.9, 0.86, 1.0, 0.32 * Math.min(1, standingShare * 1.6))
        })
        tickMesh.instanceMatrix.needsUpdate = true
        tickLight.needsUpdate = true
      }
    }

    // The aid's guide lines on the back wall (2.5D only).
    if (guideMesh && guideLabelMesh && guideLabelTint) {
      const strength = Math.max(0, standingShare * 1.4 - 0.4)
      guideShader.uniforms.uStrength!.value = 0.62 * strength
      const { a0, a1, at: wallAt } = guideWall
      guides.forEach((guide, index) => {
        const y = BOARD.tileHeight + guide.y * standingShare
        // Upright on the back wall, facing the viewer (both draw on the XY plane); the label before its left end.
        matrix.makeScale(a1 - a0, 0.016, 1).setPosition((a0 + a1) / 2, y, wallAt)
        guideMesh!.setMatrixAt(index, matrix)
        const size = 0.22
        const w = size * guideLabelAspect[index]!
        matrix.makeScale(w, size, 1).setPosition(a0 - 0.08 - w / 2, y, wallAt)
        guideLabelMesh!.setMatrixAt(index, matrix)
        guideLabelTint!.setXYZW(index, 0.78, 0.74, 0.92, 0.7 * strength)
      })
      guideMesh.instanceMatrix.needsUpdate = true
      guideLabelMesh.instanceMatrix.needsUpdate = true
      guideLabelTint.needsUpdate = true
    }

    // Pools of light under the columns.
    if (poolMesh && poolLight) {
      const color = new Color()
      poolEntries.forEach((entryIndex, index) => {
        const entry = entries[entryIndex]!
        const pose = poses[entryIndex]!
        const size = 0.62 * pose.s
        matrix.makeScale(size, 1, size).setPosition(pose.x, BOARD.tileHeight + 0.003 + lifts[entryIndex]!, pose.z)
        poolMesh!.setMatrixAt(index, matrix)
        color.set(entry.tile!.capsules[0]!.colors.glow)
        const strength = (0.22 + entry.emphasis * 0.35 + entry.lift * 0.2) * (1 - 0.7 * flatValue)
        poolLight!.setXYZW(index, color.r, color.g, color.b, strength)
      })
      poolMesh.instanceMatrix.needsUpdate = true
      poolLight.needsUpdate = true
    }

    // The streak's line of light, growing with the comment.
    if (beamMesh && beamLight) {
      const path = streakKeys
        .map((key) => entryByKey.get(key))
        .filter((index): index is number => index !== undefined && Boolean(entries[index]!.tile))
      const segments = Math.min(64, Math.max(0, path.length - 1))
      const lengths: number[] = []
      let total = 0
      for (let index = 0; index < segments; index++) {
        const a = poses[path[index]!]!
        const b = poses[path[index + 1]!]!
        const length = Math.hypot(b.x - a.x, b.z - a.z)
        lengths.push(length)
        total += length
      }
      const strength = path.reduce((max, index) => Math.max(max, entries[index]!.emphasis), 0)
      let walked = 0
      const reach = beamProgress * total
      beamMesh.count = segments
      for (let index = 0; index < segments; index++) {
        const a = poses[path[index]!]!
        const b = poses[path[index + 1]!]!
        const length = lengths[index]!
        const shown = clamp01((reach - walked) / Math.max(1e-6, length))
        walked += length
        const visible = length * shown
        const ux = (b.x - a.x) / Math.max(1e-6, length)
        const uz = (b.z - a.z) / Math.max(1e-6, length)
        quaternion.setFromAxisAngle(yAxis, Math.atan2(-(b.z - a.z), b.x - a.x))
        position.set(a.x + ux * visible * 0.5, BOARD.tileHeight + 0.012, a.z + uz * visible * 0.5)
        scale.set(Math.max(0.0001, visible + 0.12), 1, 0.16)
        matrix.compose(position, quaternion, scale)
        beamMesh.setMatrixAt(index, matrix)
        beamLight.setXYZW(index, 0.8, 0.72, 1.0, shown > 0 ? 0.9 * strength : 0)
      }
      beamMesh.instanceMatrix.needsUpdate = true
      beamLight.needsUpdate = true
    }
  }

  // ── Picking ──
  const raycaster = new Raycaster()
  const pointer = new Vector2()
  const localRay = new Ray()
  const box = new Box3()
  const hit = new Vector3()
  const inverseBoard = new Matrix4()

  function pick(clientX: number, clientY: number): BoardTarget | null {
    if (!model) return null
    const rect = host.getBoundingClientRect()
    pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
    board.updateMatrixWorld()
    inverseBoard.copy(board.matrixWorld).invert()
    localRay.copy(raycaster.ray).applyMatrix4(inverseBoard)
    const at = now()
    const standingShare = 1 - flatNow(at)
    let best: Entry | null = null
    let bestDistance = Infinity
    for (const entry of entries) {
      if (!entry.tile) continue
      const pose = entryPose(entry, at)
      if (pose.s < 0.5) continue
      const top = BOARD.tileHeight + LIFT + columnHeight(entry.tile) * standingShare + 0.05
      box.min.set(pose.x - 0.5, 0, pose.z - 0.5)
      box.max.set(pose.x + 0.5, top, pose.z + 0.5)
      if (!localRay.intersectBox(box, hit)) continue
      const distance = hit.distanceToSquared(localRay.origin)
      if (distance < bestDistance) {
        bestDistance = distance
        best = entry
      }
    }
    if (!best?.tile) return null
    // Year: a month board that has begun (any of its tiles), the same rule as the keyboard list.
    if (mode() === 'year') return isMonthSelectable(model, best.tile.month) ? { kind: 'month', month: best.tile.month } : null
    return best.tile.day.isFuture ? null : { kind: 'day', key: best.key }
  }

  function setHovered(target: BoardTarget | null) {
    if (sameTarget(target, hovered)) return
    hovered = target
    canvas.style.cursor = target ? 'pointer' : ''
    updateTileColors()
    options.onHover(target)
    schedule()
  }

  const onPointerMove = (event: PointerEvent) => {
    if (morph || flatAnim) return
    setHovered(pick(event.clientX, event.clientY))
    if (!reducedMotion) {
      const rect = host.getBoundingClientRect()
      tiltTarget.set(((event.clientX - rect.left) / rect.width) * 2 - 1, ((event.clientY - rect.top) / rect.height) * 2 - 1)
      schedule()
    }
  }
  const onPointerLeave = () => {
    setHovered(null)
    tiltTarget.set(0, 0)
    schedule()
  }
  const onClick = (event: MouseEvent) => {
    if (morph || flatAnim) return
    const target = pick(event.clientX, event.clientY)
    if (target) options.onSelect(target)
  }
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerleave', onPointerLeave)
  canvas.addEventListener('click', onClick)

  // ── Loop ──
  const liftTarget = (entry: Entry) => (isLit(entry, hovered) || isLit(entry, active) ? 1 : 0)
  const emphasisOf = (entry: Entry) => (emphasisDays.has(entry.key) ? emphasisTarget : 0)

  function animating(at: number) {
    if (benchmarking || morph || flatAnim || camAnim) return true
    if (riseStartedAt !== -Infinity && at - riseStartedAt < riseEnd + 50) return true
    if (emphasisTarget > 0 && !reducedMotion && emphasisFinishedAt !== -Infinity) return true
    for (const entry of entries) {
      if (Math.abs(entry.lift - liftTarget(entry)) > 0.002) return true
      if (Math.abs(entry.emphasis - emphasisOf(entry)) > 0.002) return true
    }
    if (Math.abs(beamProgress - emphasisProgress) > 0.002) return true
    return Math.abs(tilt.x - tiltTarget.x) > 0.002 || Math.abs(tilt.y - tiltTarget.y) > 0.002
  }

  function frame(at: number) {
    raf = 0
    if (disposed || contextLost) return
    const dt = Math.min(0.05, lastTime ? (at - lastTime) / 1000 : 0.016)
    lastTime = at
    if (morph && progressOf(morph, at) >= 1) finishMorph()
    if (flatAnim && progressOf(flatAnim, at) >= 1) finishFlat()
    if (camAnim && progressOf(camAnim, at) >= 1) settleCamera()
    // The comment's emphasis fades a moment after the line is typed (it stays, still, under reduced motion).
    if (!reducedMotion && emphasisTarget > 0 && emphasisFinishedAt !== -Infinity && at - emphasisFinishedAt > EMPHASIS_HOLD_MS) {
      emphasisTarget = 0
      emphasisFinishedAt = -Infinity
      emphasisDone = true
    }
    let colorsChanged = false
    for (const entry of entries) {
      const target = liftTarget(entry)
      entry.lift = reducedMotion ? target : damp(entry.lift, target, 14, dt)
      const emphasis = emphasisOf(entry)
      const next = reducedMotion ? emphasis : damp(entry.emphasis, emphasis, 6, dt)
      if (Math.abs(next - entry.emphasis) > 0.0005) colorsChanged = true
      entry.emphasis = Math.abs(next - emphasis) < 0.002 ? emphasis : next
    }
    if (colorsChanged) updateTileColors()
    beamProgress = reducedMotion ? emphasisProgress : damp(beamProgress, emphasisProgress, 10, dt)
    if (reducedMotion) tilt.set(0, 0)
    else {
      tilt.x = damp(tilt.x, tiltTarget.x, 5, dt)
      tilt.y = damp(tilt.y, tiltTarget.y, 5, dt)
    }
    const standingShare = 1 - flatNow(at)
    board.rotation.set(tilt.y * TILT.x * standingShare, tilt.x * TILT.y * standingShare, 0)
    applyCamera(currentCamera(at))
    compose(at)
    renderer.render(scene, camera)
    options.onFrame?.()
    if (animating(at)) schedule()
    else lastTime = 0
  }

  function schedule() {
    if (!raf && running && !disposed && !contextLost) raf = requestAnimationFrame(frame)
  }

  // ── WebGL context loss: stop drawing; when the context comes back (three.js re-uploads everything on its own),
  // draw again even if nothing moves; when it does not come back within a moment, hand over to the 2D calendar. ──
  const CONTEXT_RESTORE_MS = 3000
  const onContextLost = (event: Event) => {
    event.preventDefault()
    contextLost = true
    if (raf) cancelAnimationFrame(raf)
    raf = 0
    lastTime = 0
    window.clearTimeout(contextTimer)
    contextTimer = window.setTimeout(() => {
      if (contextLost && !disposed) options.onContextFailure?.()
    }, CONTEXT_RESTORE_MS)
  }
  const onContextRestored = () => {
    contextLost = false
    window.clearTimeout(contextTimer)
    // three.js resets its GL state on restore (the clear colour back to black): set ours again.
    renderer.setClearColor(CLEAR, 1)
    updateTileColors()
    schedule()
  }
  canvas.addEventListener('webglcontextlost', onContextLost)
  canvas.addEventListener('webglcontextrestored', onContextRestored)

  // ── Projection for the DOM tooltip ──
  const projected = new Vector3()
  function targetPoint(target: BoardTarget): BoardPoint | null {
    if (!model) return null
    const at = now()
    const standingShare = 1 - flatNow(at)
    if (target.kind === 'month') {
      const month = model.months[target.month]
      if (!month) return null
      const tallest = model.tiles.reduce((max, tile) => (tile.month === target.month ? Math.max(max, columnHeight(tile)) : max), 0)
      projected.set((month.x0 + month.x1) / 2, BOARD.tileHeight + (tallest + 0.2) * standingShare, month.z0 + 0.5)
    } else {
      const index = entryByKey.get(target.key)
      const entry = index === undefined ? undefined : entries[index]
      if (!entry?.tile) return null
      const pose = entryPose(entry, at)
      const lift = reducedMotion ? 0 : entry.lift * LIFT * standingShare
      const top = BOARD.tileHeight + lift + columnHeight(entry.tile) * standingShare + 0.06
      projected.set(pose.x, top, pose.z - (BOARD.tileSize / 2) * (1 - standingShare))
    }
    board.updateMatrixWorld()
    projected.applyMatrix4(board.matrixWorld).project(camera)
    return { x: ((projected.x + 1) / 2) * width, y: ((1 - projected.y) / 2) * height }
  }

  return {
    setBoard,
    setView,
    setPillars,
    guideStep() {
      if (!aidOn() || mode() !== 'month') return null
      const hours = guideHours(scaleHours())
      return hours.length ? hours[0]! : null
    },
    markedDay() {
      if (!aidOn() || !model || flatNow(now()) > 0.5) return null
      return longestDayKey(model.tiles)
    },
    replay() {
      if (!model || reducedMotion) return
      finishMorph()
      finishFlat()
      riseStartedAt = now()
      schedule()
    },
    setReducedMotion(value) {
      reducedMotion = value
      if (value) {
        riseStartedAt = -Infinity
        finishMorph()
        finishFlat()
        tiltTarget.set(0, 0)
      }
      schedule()
    },
    setActive(target) {
      active = target
      updateTileColors()
      schedule()
    },
    setSelected(key) {
      selectedKey = key
      updateTileColors()
      schedule()
    },
    setEmphasis({ days, streak }) {
      emphasisDays = new Set([...days, ...streak])
      streakKeys = [...streak]
      emphasisTarget = 0
      emphasisProgress = 0
      beamProgress = 0
      emphasisFinishedAt = -Infinity
      emphasisDone = false
      schedule()
    },
    setEmphasisProgress(progress, finished) {
      if (emphasisDays.size === 0 || emphasisDone) return
      emphasisProgress = clamp01(progress)
      emphasisTarget = 1
      if (finished && !reducedMotion && emphasisFinishedAt === -Infinity) emphasisFinishedAt = now()
      schedule()
    },
    targetPoint,
    setRunning(value) {
      running = value
      if (!value && raf) {
        cancelAnimationFrame(raf)
        raf = 0
        lastTime = 0
      }
      if (value) schedule()
    },
    benchmark(durationMs) {
      return new Promise((resolve) => {
        const times: number[] = []
        let previous = 0
        const started = now()
        benchmarking = true
        const probe = (at: number) => {
          if (disposed) return
          if (previous) times.push(at - previous)
          previous = at
          // Keep the board moving: a slow tilt sweep and a wandering hover, as under a moving pointer.
          const t = (at - started) / 1000
          tiltTarget.set(Math.sin(t * 1.3), Math.cos(t * 0.9) * 0.6)
          const days = entries.filter((entry) => entry.tile)
          if (days.length) {
            const entry = days[Math.floor(t * 12) % days.length]!
            setHovered(mode() === 'year' ? { kind: 'month', month: entry.tile!.month } : { kind: 'day', key: entry.key })
          }
          if (at - started < durationMs) requestAnimationFrame(probe)
          else {
            benchmarking = false
            setHovered(null)
            tiltTarget.set(0, 0)
            const sorted = [...times].sort((a, b) => a - b)
            const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0
            const mean = times.reduce((sum, value) => sum + value, 0) / Math.max(1, times.length)
            resolve({
              fps: Math.round((1000 / Math.max(0.001, mean)) * 10) / 10,
              frameMsP50: Math.round(q(0.5) * 100) / 100,
              frameMsP95: Math.round(q(0.95) * 100) / 100,
              frames: times.length,
              capsules: capsules.length,
              tiles: entries.filter((entry) => entry.tile).length,
            })
          }
        }
        requestAnimationFrame(probe)
        schedule()
      })
    },
    dispose() {
      disposed = true
      if (raf) cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerleave', onPointerLeave)
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)
      window.clearTimeout(contextTimer)
      disposeMeshes()
      for (const disposable of [tileGeometry, tileMaterial, poolShader, beamShader, shellShader, coreShader, haloShader, tubeShader, fillShader, capShader, guideShader]) disposable.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    },
  }
}
