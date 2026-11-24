import {
  AmbientLight, BufferAttribute, Box3, CanvasTexture, LatheGeometry, Color, DirectionalLight, DynamicDrawUsage, Group, InstancedBufferAttribute,
  InstancedMesh, Matrix4, MeshLambertMaterial, NoToneMapping, OrthographicCamera, PlaneGeometry, Quaternion,
  Ray, Raycaster, Scene, ShaderMaterial, SRGBColorSpace, Vector2, Vector3, WebGLRenderer,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { capsuleGeometry, capsuleRadiusAt, coreMaterial, haloMaterial, shellMaterial } from '../../mates/capsule-jar/capsule-jar-scene.ts'
import { CAPSULE_ASPECT, CAPSULE_SEAM_OFFSET } from '../../mates/capsule-jar/capsule-jar-layout.ts'
import { CHAERIN_JAR_THEME, capsuleBandTheme } from '../../mates/capsule-jar/capsule-jar-theme.ts'
import type { TimeBand } from '../../mates/capsule-jar/capsule-moments.ts'
import { BOARD, boardRiseTiming, type CapsuleBoardModel } from './capsule-board-layout.ts'

/**
 * WebGL scene of the 「함께 쌓은 시간」 board: floor tiles seen from above at an angle (orthographic, 2.5D) with a
 * column of upright glass capsules on every day. The capsules are the very same objects as in 내 메이트: the same
 * stadium geometry with its seam (`capsuleGeometry`), the additive glass shell with its time-band tones and keepsake
 * stars (`shellMaterial`), the inner core light (`coreMaterial`) and the soft halo (`haloMaterial`), all instanced
 * (one draw call each), coloured per capsule by its connection's time band (`capsuleBandTheme`).
 *
 * Renders on demand: frames run only while something moves (the rise, a hover lift, the pointer tilt) and stop when the
 * board is still, hidden or off-screen. Owns its canvas and GPU resources; everything is released in `dispose`.
 */

export type BoardPoint = { x: number; y: number }
export type BoardBenchmark = { fps: number; frameMsP50: number; frameMsP95: number; frames: number; capsules: number; tiles: number }

export type BoardSceneOptions = {
  host: HTMLElement
  reducedMotion: boolean
  /** Tile under the pointer (index in `model.tiles`), or null. */
  onHover: (index: number | null) => void
  onSelect: (index: number) => void
  /** After every rendered frame, so the DOM tooltip can follow the tilt and the lift. */
  onFrame?: () => void
  /** Width / height the board wants at its current shape (the host sizes itself from it). */
  onAspect?: (aspect: number) => void
}

export type BoardSceneController = {
  setBoard(model: CapsuleBoardModel, options: { animate: boolean }): void
  /** Plays the rise again. */
  replay(): void
  setReducedMotion(value: boolean): void
  /** Tile lit from outside (keyboard focus), or null. */
  setActive(index: number | null): void
  setSelected(index: number | null): void
  /** Screen point (CSS px, relative to the host) above a tile's column. */
  tilePoint(index: number): BoardPoint | null
  setRunning(running: boolean): void
  benchmark(durationMs: number): Promise<BoardBenchmark>
  dispose(): void
}

/** Clear colour: the glass block's colour over the page (the canvas edges fade into the block with a CSS mask). */
const CLEAR = '#13121B'

/** View direction per period: azimuth from +z towards +x and elevation (degrees). The year's long strip stays wide. */
const VIEW = {
  week: { azimuth: 24, elevation: 32 },
  month: { azimuth: 28, elevation: 42 },
  year: { azimuth: 8, elevation: 62 },
} as const
/** Narrow hosts: the week row and the month grid turn further so they run down the screen and stay large. */
const NARROW_VIEW = { week: { azimuth: 52, elevation: 34 }, month: { azimuth: 38, elevation: 48 }, year: VIEW.year } as const
const NARROW_WIDTH = 560

const TILE_COLOR = {
  empty: new Color('#272533'),
  emptyYear: new Color('#1F1E29'),
  filled: new Color('#2F2C40'),
  future: new Color('#1B1A24'),
  /** Selection colour (`selected`, a little lifted for the lit top face). */
  selected: new Color('#3A2E68'),
  hover: new Color('#3A3750'),
} as const

/** Pointer tilt (radians) and hover lift (tile units). Small on purpose. */
const TILT = { x: 0.022, y: 0.035 } as const
const LIFT = 0.09

const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
const easeOutBack = (t: number) => {
  const c1 = 1.5
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}
const damp = (current: number, target: number, lambda: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-lambda * dt))

/** Floor labels (dates, months) from one canvas atlas, lying flat on the tiles. */
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

const LABEL_CELL = { width: 256, height: 64, perRow: 8 } as const

/** Above this many capsules (and in the year's small tiles) the board uses the light capsule mesh. */
const LIGHT_MESH_FROM = 300

/**
 * The same capsule as `capsuleGeometry` (the same stadium profile `capsuleRadiusAt`, the seam, the two vertex-colour
 * halves) with fewer rings and sides: ~10× fewer triangles for the year's small capsules, where the full mesh
 * (≈2,500 triangles each) would add up to millions.
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
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 200)
  scene.add(new AmbientLight(0xffffff, 1.6))
  const sun = new DirectionalLight(0xffffff, 1.5)
  sun.position.set(-4, 10, 6)
  scene.add(sun)

  const board = new Group()
  scene.add(board)

  // ── Tiles ──
  const tileGeometry = new RoundedBoxGeometry(BOARD.tileSize, BOARD.tileHeight, BOARD.tileSize, 2, 0.05)
  const tileMaterial = new MeshLambertMaterial({ color: '#ffffff' })
  let tileMesh: InstancedMesh | null = null

  // ── Labels ──
  const labelGeometry = new PlaneGeometry(1, 1)
  labelGeometry.rotateX(-Math.PI / 2)
  let labelMesh: InstancedMesh | null = null
  let labelTexture: CanvasTexture | null = null
  let labelShader: ShaderMaterial | null = null

  // ── Capsules: shells, cores and halos share one set of instance matrices (as in 내 메이트) ──
  const theme = CHAERIN_JAR_THEME
  const glowColor = new Color(theme.glow)
  const fullShellGeometry = capsuleGeometry(-0.5, 0.5, new Color(theme.lightHalf), new Color(theme.tintHalf))
  const lightShellGeometry = lightCapsuleGeometry(new Color(theme.lightHalf), new Color(theme.tintHalf))
  let shellGeometry = fullShellGeometry
  const shellShader = shellMaterial(true, glowColor)
  const coreGeometry = new PlaneGeometry(1, 1)
  const coreShader = coreMaterial(glowColor)
  // Still (no breathing): the board renders only while something moves.
  coreShader.uniforms.uBreath!.value = 0
  coreShader.uniforms.uStrength!.value = 0.95
  const haloGeometry = new PlaneGeometry(1, 1)
  const haloShader = haloMaterial(glowColor)
  haloShader.uniforms.strength!.value = 0.1
  let shellMesh: InstancedMesh | null = null
  let coreMesh: InstancedMesh | null = null
  let haloMesh: InstancedMesh | null = null
  let glowAttribute: InstancedBufferAttribute | null = null

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

  // ── State ──
  let model: CapsuleBoardModel | null = null
  /** Board centre offset so the grid sits around the origin. */
  const offset = new Vector2()
  /** Per tile: hover lift (0…1), and per capsule: tile index and rise start (ms) or null. */
  let lift: number[] = []
  let capsuleTile: number[] = []
  let capsuleStart: (number | null)[] = []
  let riseMs = 420
  let riseStartedAt = 0
  let riseEnd = 0
  let hovered: number | null = null
  let active: number | null = null
  let selected: number | null = null
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
  const zero = new Matrix4().makeScale(0, 0, 0)
  const yAxis = new Vector3(0, 1, 0)

  function disposeInstances() {
    for (const mesh of [tileMesh, labelMesh, shellMesh, coreMesh, haloMesh]) {
      if (!mesh) continue
      board.remove(mesh)
      mesh.dispose()
    }
    tileMesh = labelMesh = shellMesh = coreMesh = haloMesh = null
    // Per-instance attributes live on the shared geometries: disposing frees their GPU buffers.
    for (const geometry of [fullShellGeometry, lightShellGeometry, coreGeometry, haloGeometry, labelGeometry]) geometry.dispose()
    labelTexture?.dispose()
    labelShader?.dispose()
    labelTexture = null
    labelShader = null
  }

  function buildLabels(next: CapsuleBoardModel) {
    if (next.labels.length === 0) return
    const rows = Math.ceil(next.labels.length / LABEL_CELL.perRow)
    const atlas = document.createElement('canvas')
    atlas.width = LABEL_CELL.width * LABEL_CELL.perRow
    atlas.height = LABEL_CELL.height * rows
    const context = atlas.getContext('2d')!
    context.fillStyle = '#ffffff'
    context.textBaseline = 'middle'
    const family = getComputedStyle(host).fontFamily || 'system-ui, sans-serif'
    const uv = new Float32Array(next.labels.length * 4)
    const tint = new Float32Array(next.labels.length * 4)
    const muted = new Color('#CAC9D4')
    const ink = new Color('#FAFAFD')
    next.labels.forEach((label, index) => {
      const cx = (index % LABEL_CELL.perRow) * LABEL_CELL.width
      const cy = Math.floor(index / LABEL_CELL.perRow) * LABEL_CELL.height
      context.font = `${label.today ? 700 : 600} 44px ${family}`
      context.fillText(label.today ? `${label.text} •` : label.text, cx + 6, cy + LABEL_CELL.height / 2 + 2)
      uv.set(
        [cx / atlas.width, 1 - (cy + LABEL_CELL.height) / atlas.height, (cx + LABEL_CELL.width) / atlas.width, 1 - cy / atlas.height],
        index * 4,
      )
      const color = label.today ? ink : muted
      tint.set([color.r, color.g, color.b, label.kind === 'month' ? 0.75 : label.today ? 0.95 : 0.7], index * 4)
    })
    labelTexture = new CanvasTexture(atlas)
    labelTexture.anisotropy = 4
    labelShader = labelMaterial(labelTexture)
    labelGeometry.setAttribute('instanceUv', new InstancedBufferAttribute(uv, 4))
    labelGeometry.setAttribute('instanceTint', new InstancedBufferAttribute(tint, 4))
    labelMesh = new InstancedMesh(labelGeometry, labelShader, next.labels.length)
    labelMesh.frustumCulled = false
    labelMesh.renderOrder = 1
    labelMesh.instanceMatrix.setUsage(DynamicDrawUsage)
    board.add(labelMesh)
  }

  function buildCapsules(next: CapsuleBoardModel) {
    const count = next.capsuleCount
    capsuleTile = []
    if (count === 0) return
    shellGeometry = next.mode === 'year' || count > LIGHT_MESH_FROM ? lightShellGeometry : fullShellGeometry
    glowAttribute = new InstancedBufferAttribute(new Float32Array(count), 1)
    glowAttribute.setUsage(DynamicDrawUsage)
    const weight = new InstancedBufferAttribute(new Float32Array(count), 1)
    const light = new InstancedBufferAttribute(new Float32Array(count * 3), 3)
    const tintColor = new InstancedBufferAttribute(new Float32Array(count * 3), 3)
    const glow = new InstancedBufferAttribute(new Float32Array(count * 3), 3)
    const keepsake = new InstancedBufferAttribute(new Float32Array(count), 1)
    let index = 0
    for (const tile of next.tiles) {
      for (const capsule of tile.capsules) {
        capsuleTile.push(tile.index)
        weight.setX(index, capsule.glow)
        const colors = colorsOf(capsule.band)
        light.setXYZ(index, colors.light.r, colors.light.g, colors.light.b)
        tintColor.setXYZ(index, colors.tint.r, colors.tint.g, colors.tint.b)
        glow.setXYZ(index, colors.glow.r, colors.glow.g, colors.glow.b)
        keepsake.setX(index, capsule.keepsake ? 1 : 0)
        index++
      }
    }
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

  function setBoard(next: CapsuleBoardModel, { animate }: { animate: boolean }) {
    disposeInstances()
    model = next
    offset.set((next.cols - 1) / 2, (next.rows - 1) / 2)
    lift = next.tiles.map(() => 0)
    const hadHover = hovered !== null
    hovered = active = selected = null
    if (hadHover) options.onHover(null)
    tileMesh = new InstancedMesh(tileGeometry, tileMaterial, Math.max(1, next.tiles.length))
    tileMesh.count = next.tiles.length
    tileMesh.instanceMatrix.setUsage(DynamicDrawUsage)
    tileMesh.frustumCulled = false
    tileMesh.renderOrder = 0
    board.add(tileMesh)
    buildLabels(next)
    buildCapsules(next)
    const timing = boardRiseTiming(next.tiles)
    riseMs = timing.riseMs
    capsuleStart = []
    for (const tile of next.tiles) {
      const start = timing.starts[tile.index]
      tile.capsules.forEach((_, piece) => capsuleStart.push(start === null || start === undefined ? null : start + piece * timing.pieceStepMs))
    }
    riseEnd = timing.totalMs
    riseStartedAt = animate && !reducedMotion ? performance.now() : -Infinity
    fitCamera()
    updateTileColors()
    composeAll(performance.now())
    schedule()
  }

  function updateTileColors() {
    if (!model || !tileMesh) return
    const color = new Color()
    for (const tile of model.tiles) {
      const base = tile.day.isFuture
        ? TILE_COLOR.future
        : tile.capsules.length > 0
          ? TILE_COLOR.filled
          : model.mode === 'year'
            ? TILE_COLOR.emptyYear
            : TILE_COLOR.empty
      color.copy(base)
      if (tile.index === selected) color.copy(TILE_COLOR.selected)
      else if (tile.index === hovered || tile.index === active) color.lerp(TILE_COLOR.hover, 0.85)
      tileMesh.setColorAt(tile.index, color)
    }
    if (tileMesh.instanceColor) tileMesh.instanceColor.needsUpdate = true
  }

  function riseOf(index: number, now: number) {
    const start = capsuleStart[index]
    if (start === null || start === undefined || riseStartedAt === -Infinity) return 1
    return clamp01((now - riseStartedAt - start) / riseMs)
  }

  function composeAll(now: number) {
    if (!model || !tileMesh) return
    const lifted = (tileIndex: number) => (reducedMotion ? 0 : lift[tileIndex]! * LIFT)
    for (const tile of model.tiles) {
      position.set(tile.x - offset.x, BOARD.tileHeight / 2 + lifted(tile.index), tile.z - offset.y)
      matrix.makeTranslation(position.x, position.y, position.z)
      tileMesh.setMatrixAt(tile.index, matrix)
    }
    tileMesh.instanceMatrix.needsUpdate = true

    if (labelMesh) {
      model.labels.forEach((label, index) => {
        const tile = label.kind === 'date' ? model!.tiles.find((item) => item.x === label.x && item.z === label.z) : undefined
        const w = label.size * (LABEL_CELL.width / LABEL_CELL.height)
        const h = label.size
        const x = label.kind === 'month' ? label.x - offset.x - 0.45 + w / 2 : label.x - offset.x - BOARD.tileSize / 2 + 0.05 + w / 2
        const z = label.kind === 'month' ? label.z - offset.y + h / 2 : label.z - offset.y + BOARD.tileSize / 2 - 0.04 - h / 2
        const y = label.kind === 'month' ? 0.005 : BOARD.tileHeight + 0.004 + (tile ? lifted(tile.index) : 0)
        matrix.makeScale(w, 1, h).setPosition(x, y, z)
        labelMesh!.setMatrixAt(index, matrix)
      })
      labelMesh.instanceMatrix.needsUpdate = true
    }

    if (shellMesh && glowAttribute) {
      let index = 0
      for (const tile of model.tiles) {
        const tileLift = lifted(tile.index)
        const highlight = Math.max(lift[tile.index]!, tile.index === selected ? 0.6 : 0)
        for (const capsule of tile.capsules) {
          const rise = riseOf(index, now)
          if (rise <= 0) {
            shellMesh.setMatrixAt(index, zero)
          } else {
            const grow = easeOutBack(rise)
            const size = capsule.length * Math.max(0.001, grow)
            const drop = (1 - easeOut(rise)) * capsule.length * 0.9
            position.set(tile.x - offset.x, BOARD.tileHeight + tileLift + capsule.y - drop, tile.z - offset.y)
            spin.setFromAxisAngle(yAxis, capsule.roll)
            quaternion.copy(spin).multiply(upright)
            scale.setScalar(size)
            matrix.compose(position, quaternion, scale)
            shellMesh.setMatrixAt(index, matrix)
          }
          glowAttribute.setX(index, 0.5 + capsule.glow * 0.42 + highlight * 1.0 + (capsule.keepsake ? 0.6 : 0))
          index++
        }
      }
      shellMesh.instanceMatrix.needsUpdate = true
      glowAttribute.needsUpdate = true
    }
  }

  // ── Camera ──
  function fitCamera() {
    if (!model) return
    const view = (width < NARROW_WIDTH ? NARROW_VIEW : VIEW)[model.mode]
    const az = (view.azimuth * Math.PI) / 180
    const el = (view.elevation * Math.PI) / 180
    const direction = new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))
    camera.position.copy(direction.multiplyScalar(60))
    camera.up.set(0, 1, 0)
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld()
    // Bounds of what is actually drawn: every tile's corners, every column's top, the year's month labels behind,
    // plus one capsule of headroom (the hover lift and the tooltip anchor).
    const points: Vector3[] = []
    const half = BOARD.tileSize / 2
    const headroom = model.capsuleLength + LIFT
    for (const tile of model.tiles) {
      const x = tile.x - offset.x
      const z = tile.z - offset.y
      for (const dx of [-half, half]) for (const dz of [-half, half]) points.push(new Vector3(x + dx, 0, z + dz))
      if (tile.height > 0) points.push(new Vector3(x, BOARD.tileHeight + tile.height + headroom, z))
    }
    for (const label of model.labels) {
      if (label.kind !== 'month') continue
      const z = label.z - offset.y + label.size
      points.push(new Vector3(label.x - offset.x, 0, z), new Vector3(label.x - offset.x + label.size * 2, 0, z))
    }
    const inverse = camera.matrixWorldInverse
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const corner of points) {
      corner.applyMatrix4(inverse)
      minX = Math.min(minX, corner.x)
      maxX = Math.max(maxX, corner.x)
      minY = Math.min(minY, corner.y)
      maxY = Math.max(maxY, corner.y)
    }
    const pad = 0.05
    const contentW = (maxX - minX) * (1 + pad * 2)
    const contentH = (maxY - minY) * (1 + pad * 2)
    options.onAspect?.(contentW / contentH)
    const hostAspect = width / height
    let viewW = contentW
    let viewH = contentH
    if (hostAspect > contentW / contentH) viewW = contentH * hostAspect
    else viewH = contentW / hostAspect
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    camera.left = cx - viewW / 2
    camera.right = cx + viewW / 2
    camera.top = cy + viewH / 2
    camera.bottom = cy - viewH / 2
    camera.updateProjectionMatrix()
  }

  function resize() {
    const rect = host.getBoundingClientRect()
    width = Math.max(1, Math.round(rect.width))
    height = Math.max(1, Math.round(rect.height))
    renderer.setSize(width, height, false)
    fitCamera()
    schedule()
  }
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(host)
  resize()

  // ── Picking ──
  const raycaster = new Raycaster()
  const pointer = new Vector2()
  const localRay = new Ray()
  const box = new Box3()
  const hit = new Vector3()
  const inverseBoard = new Matrix4()

  function pick(clientX: number, clientY: number): number | null {
    if (!model) return null
    const rect = host.getBoundingClientRect()
    pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
    board.updateMatrixWorld()
    inverseBoard.copy(board.matrixWorld).invert()
    localRay.copy(raycaster.ray).applyMatrix4(inverseBoard)
    let best: number | null = null
    let bestDistance = Infinity
    for (const tile of model.tiles) {
      const x = tile.x - offset.x
      const z = tile.z - offset.y
      const top = BOARD.tileHeight + LIFT + Math.max(tile.height, 0)
      box.min.set(x - 0.5, 0, z - 0.5)
      box.max.set(x + 0.5, top, z + 0.5)
      if (!localRay.intersectBox(box, hit)) continue
      const distance = hit.distanceToSquared(localRay.origin)
      if (distance < bestDistance) {
        bestDistance = distance
        best = tile.index
      }
    }
    return best
  }

  function setHovered(index: number | null) {
    if (index === hovered) return
    hovered = index
    const tile = index === null ? undefined : model?.tiles[index]
    canvas.style.cursor = tile && !tile.day.isFuture ? 'pointer' : ''
    updateTileColors()
    options.onHover(index)
    schedule()
  }

  const onPointerMove = (event: PointerEvent) => {
    const index = pick(event.clientX, event.clientY)
    setHovered(index !== null && model?.tiles[index]?.day.isFuture ? null : index)
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
    const index = pick(event.clientX, event.clientY)
    if (index === null || model?.tiles[index]?.day.isFuture) return
    options.onSelect(index)
  }
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerleave', onPointerLeave)
  canvas.addEventListener('click', onClick)

  // ── Loop ──
  function animating(now: number) {
    if (benchmarking) return true
    if (riseStartedAt !== -Infinity && now - riseStartedAt < riseEnd + 50) return true
    if (!model) return false
    for (const tile of model.tiles) {
      const target = tile.index === hovered || tile.index === active ? 1 : 0
      if (Math.abs(lift[tile.index]! - target) > 0.002) return true
    }
    return Math.abs(tilt.x - tiltTarget.x) > 0.002 || Math.abs(tilt.y - tiltTarget.y) > 0.002
  }

  function frame(now: number) {
    raf = 0
    if (disposed) return
    const dt = Math.min(0.05, lastTime ? (now - lastTime) / 1000 : 0.016)
    lastTime = now
    if (model) {
      for (const tile of model.tiles) {
        const target = tile.index === hovered || tile.index === active ? 1 : 0
        lift[tile.index] = reducedMotion ? target : damp(lift[tile.index]!, target, 14, dt)
      }
    }
    if (reducedMotion) tilt.set(0, 0)
    else {
      tilt.x = damp(tilt.x, tiltTarget.x, 5, dt)
      tilt.y = damp(tilt.y, tiltTarget.y, 5, dt)
    }
    board.rotation.set(tilt.y * TILT.x, tilt.x * TILT.y, 0)
    composeAll(now)
    renderer.render(scene, camera)
    options.onFrame?.()
    if (animating(now)) schedule()
    else lastTime = 0
  }

  function schedule() {
    if (!raf && running && !disposed) raf = requestAnimationFrame(frame)
  }

  // ── Projection for the DOM tooltip ──
  const projected = new Vector3()
  function tilePoint(index: number): BoardPoint | null {
    const tile = model?.tiles[index]
    if (!tile) return null
    const lifted = reducedMotion ? 0 : lift[index]! * LIFT
    projected.set(tile.x - offset.x, BOARD.tileHeight + lifted + tile.height + 0.06, tile.z - offset.y)
    board.updateMatrixWorld()
    projected.applyMatrix4(board.matrixWorld).project(camera)
    return { x: ((projected.x + 1) / 2) * width, y: ((1 - projected.y) / 2) * height }
  }

  return {
    setBoard,
    replay() {
      if (!model || reducedMotion) return
      riseStartedAt = performance.now()
      schedule()
    },
    setReducedMotion(value) {
      reducedMotion = value
      if (value) {
        riseStartedAt = -Infinity
        tiltTarget.set(0, 0)
      }
      schedule()
    },
    setActive(index) {
      active = index
      updateTileColors()
      schedule()
    },
    setSelected(index) {
      selected = index
      updateTileColors()
      schedule()
    },
    tilePoint,
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
        const started = performance.now()
        benchmarking = true
        const probe = (now: number) => {
          if (disposed) return
          if (previous) times.push(now - previous)
          previous = now
          // Keep the board moving: a slow tilt sweep and a wandering hover, as under a moving pointer.
          const t = (now - started) / 1000
          tiltTarget.set(Math.sin(t * 1.3), Math.cos(t * 0.9) * 0.6)
          if (model && model.tiles.length) {
            const next = Math.floor(t * 12) % model.tiles.length
            if (next !== hovered) setHovered(next)
          }
          if (now - started < durationMs) requestAnimationFrame(probe)
          else {
            benchmarking = false
            setHovered(null)
            tiltTarget.set(0, 0)
            const sorted = [...times].sort((a, b) => a - b)
            const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0
            const mean = times.reduce((sum, value) => sum + value, 0) / Math.max(1, times.length)
            resolve({
              fps: Math.round((1000 / Math.max(0.001, mean)) * 10) / 10,
              frameMsP50: Math.round(at(0.5) * 100) / 100,
              frameMsP95: Math.round(at(0.95) * 100) / 100,
              frames: times.length,
              capsules: model?.capsuleCount ?? 0,
              tiles: model?.tiles.length ?? 0,
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
      disposeInstances()
      for (const disposable of [tileGeometry, tileMaterial, shellShader, coreShader, haloShader]) disposable.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    },
  }
}
