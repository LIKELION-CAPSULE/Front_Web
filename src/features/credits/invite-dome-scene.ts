import {
  AdditiveBlending, AmbientLight, BufferAttribute, BufferGeometry, Color, CylinderGeometry, DirectionalLight, DoubleSide,
  ExtrudeGeometry, Group, LatheGeometry, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial,
  NoToneMapping, PerspectiveCamera, PlaneGeometry, PMREMGenerator, RingGeometry, Scene, Shape, SphereGeometry,
  SRGBColorSpace, TorusGeometry, Vector2, WebGLRenderer,
} from 'three'
import type { Material, Texture } from 'three'
import {
  capsuleGeometry, capsuleStudioEnvironment, createCapsuleFigure, forAlphaCanvas,
  fresnelGlassMaterial, radialGlowTexture, type CapsuleFigure,
} from '../../shared/three/capsule-model.ts'

/**
 * Real-time 친구 초대 capsule dome (the hero art of /credits/invite), rebuilt in code from its front reference
 * (src/assets/invite/invite-dome.webp): a lathed lavender-grey metal base with the round capsule emblem on its front,
 * a lathed clear glass dome (fresnel rim and reflected soft boxes, no refraction), the knob with its pole and pennant
 * on top, two rows of five capsule wells inside and a violet ring of light on the floor. The capsules in the wells
 * are the canonical capsule (src/shared/three/capsule-model.ts).
 *
 * Motion: on entry the first `filled` capsules drop into their wells 140 ms apart and bounce a little (one fixed
 * path); a new invite drops one capsule, sweeps a highlight over the glass and waves the flag; the whole dome tilts
 * up to ±4° with the pointer. Renders only while something moves, only on screen; under reduced motion one still frame
 * with every capsule seated. Units: 1 = 100 px of the reference art, y up from the floor (y = (770 − py) / 100).
 */

export type InviteDomeSceneOptions = {
  host: HTMLElement
  /** Element whose pointer moves tilt the dome (the hero). */
  pointerTarget: HTMLElement
  reducedMotion: boolean
  /** The WebGL context was lost: the page shows the picture instead. */
  onContextFailure?: () => void
  /** Fires only after the first successful draw, never merely after creating the canvas. */
  onFirstFrame?: () => void
}

export type InviteDomeStats = { triangles: number; calls: number; dpr: number; animating: boolean }

export type InviteDomeSceneController = {
  /** Capsules in the wells (0–10). Those from `enterFrom` on drop in, 140 ms apart; the ones before sit already. */
  setFilled(filled: number, enterFrom: number): void
  /** A friend joined: a highlight sweeps over the glass and the flag waves. */
  celebrate(): void
  setReducedMotion(value: boolean): void
  /** On screen and the tab visible: the loop may run. */
  setRunning(running: boolean): void
  stats(): InviteDomeStats
  dispose(): void
}

export const DOME_SLOTS = { columns: 5, rows: 2, pitchX: 0.9, rowY: [4.32, 2.68], z: 0.55 } as const
/** The drop: 140 ms apart, a fall from at most `height` above the well (never from above the glass), a small bounce. */
export const DOME_DROP = { staggerMs: 140, fallMs: 330, settleMs: 230, height: 2.1, ceiling: 5.25 } as const
const MAX_DPR = 1.75
const TILT_MAX = (4 * Math.PI) / 180
const SWEEP_MS = 1100
const WAVE_MS = 1700
/** View of the art box: what the canvas shows, in model units (the host is a little larger than the art box). */
const VIEW = { centerY: 3.25, height: 9.62 } as const

/** Height of the base's top (where the dome stands). */
const BASE_TOP = 1.7
const LAVENDER_METAL = '#D9D1F7'
/** Light of a seated capsule (1 = as in 내 메이트). */
const CAPSULE_GLOW = 2.5
const VIOLET = '#7B4DF2'
const VIOLET_DEEP = '#5A2FD0'

/** Rounded-stadium outline (a slot well), centred, `w` wide and `h` tall. */
function stadiumShape(w: number, h: number, shape = new Shape()) {
  const r = w / 2
  const straight = h / 2 - r
  shape.moveTo(-r, -straight)
  shape.lineTo(-r, straight)
  shape.absarc(0, straight, r, Math.PI, 0, true)
  shape.lineTo(r, -straight)
  shape.absarc(0, -straight, r, 0, Math.PI, true)
  return shape
}

/** Metal base profile (radius, height): plinth, groove, drum, groove, lip, the top the dome stands on. */
function baseProfile() {
  return [
    [0, 0], [3.42, 0], [3.52, 0.04], [3.56, 0.14], [3.56, 0.36], [3.5, 0.44], [3.38, 0.48], [3.38, 0.54], [3.44, 0.58],
    [3.47, 0.66], [3.47, 1.46], [3.42, 1.54], [3.32, 1.58], [3.32, 1.64], [3.38, 1.68], [3.4, 1.76], [3.4, 1.9],
    [3.34, 1.98], [3.2, 2.0], [0, 2.0],
  ].map(([x, y]) => new Vector2(x!, y! * BASE_TOP / 2))
}

/** Glass dome profile: straight walls from the base lip, then a flattened cap. */
function domeProfile() {
  const points: Vector2[] = [new Vector2(3.14, BASE_TOP), new Vector2(3.14, 4.6)]
  for (let step = 1; step <= 18; step++) {
    const angle = (step / 18) * (Math.PI / 2)
    points.push(new Vector2(3.14 * Math.cos(angle), 4.6 + 1.45 * Math.sin(angle)))
  }
  return points
}

/** The pennant: a small triangle grid (its vertices wave from the pole outward). */
function flagGeometry() {
  const columns = 10
  const geometry = new BufferGeometry()
  const positions: number[] = []
  const indices: number[] = []
  // Two rows of vertices per column: the top edge and the bottom edge closing to the tip.
  for (let column = 0; column <= columns; column++) {
    const u = column / columns
    const half = 0.26 * (1 - u)
    positions.push(u * 0.98, half, 0, u * 0.98, -half, 0)
  }
  for (let column = 0; column < columns; column++) {
    const a = column * 2
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

export function createInviteDomeScene(options: InviteDomeSceneOptions): InviteDomeSceneController {
  const { host, pointerTarget } = options
  let reducedMotion = options.reducedMotion
  let running = true
  let disposed = false
  let contextLost = false
  let raf = 0
  let firstFrame = true

  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.className = 'invite-dome-canvas'
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = NoToneMapping
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR))
  host.appendChild(canvas)

  const scene = new Scene()
  const pmrem = new PMREMGenerator(renderer)
  const studio = capsuleStudioEnvironment()
  const environmentTarget = pmrem.fromScene(studio, 0.04)
  studio.traverse((object) => {
    const mesh = object as Mesh
    if (mesh.isMesh) {
      mesh.geometry.dispose()
      ;(mesh.material as Material).dispose()
    }
  })
  pmrem.dispose()
  scene.environment = environmentTarget.texture
  scene.environmentIntensity = 1.25

  // A long lens: the reference is nearly orthographic (a short one swells the base's front and pushes it down).
  const camera = new PerspectiveCamera(10, 1, 1, 140)
  scene.add(new AmbientLight('#ffffff', 0.9))
  const key = new DirectionalLight('#ffffff', 1.6)
  key.position.set(-4, 7, 8)
  scene.add(key)
  const rim = new DirectionalLight('#b9a3fb', 1.4)
  rim.position.set(5, 3, -6)
  scene.add(rim)

  const geometries: BufferGeometry[] = []
  const materials: Material[] = []
  const textures: Texture[] = []
  const keep = <T extends BufferGeometry>(geometry: T) => (geometries.push(geometry), geometry)
  const own = <T extends Material>(material: T) => (materials.push(material), material)

  /** Everything that tilts with the pointer turns around the dome's middle. */
  const tilt = new Group()
  tilt.position.y = 3.3
  scene.add(tilt)
  const model = new Group()
  model.position.y = -3.3
  tilt.add(model)

  // ── Base: lathed metal, the capsule emblem on its front ──
  const metal = own(new MeshStandardMaterial({ color: LAVENDER_METAL, metalness: 0.5, roughness: 0.3 }))
  const base = new Mesh(keep(new LatheGeometry(baseProfile(), 72)), metal)
  model.add(base)

  const emblem = new Group()
  emblem.position.set(0, 0.82, 3.6)
  const emblemRing = new Mesh(keep(new TorusGeometry(0.66, 0.075, 12, 48)), own(new MeshStandardMaterial({ color: '#E4DEFA', metalness: 0.6, roughness: 0.25 })))
  const emblemDisc = new Mesh(
    keep(new CylinderGeometry(0.6, 0.6, 0.1, 48).rotateX(Math.PI / 2)),
    own(new MeshPhysicalMaterial({ color: VIOLET, emissive: VIOLET_DEEP, emissiveIntensity: 0.55, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 })),
  )
  const iconGeometry = keep(capsuleGeometry(-0.5, 0.5, new Color('#ffffff'), new Color('#ffffff'), 20))
  const icon = new Mesh(iconGeometry, own(new MeshBasicMaterial({ color: '#F7F4FF' })))
  icon.scale.set(0.74, 0.74, 0.3)
  icon.rotation.z = Math.PI / 4
  icon.position.z = 0.07
  const emblemGlow = new Mesh(
    keep(new PlaneGeometry(2.4, 2.4)),
    own(new MeshBasicMaterial({ map: own2Texture(radialGlowTexture([[0, 'rgba(255,255,255,0.7)'], [0.45, 'rgba(255,255,255,0.18)'], [1, 'rgba(255,255,255,0)']])), color: VIOLET, blending: AdditiveBlending, transparent: true, depthWrite: false })),
  )
  emblemGlow.position.z = 0.02
  emblem.add(emblemGlow, emblemRing, emblemDisc, icon)
  model.add(emblem)

  function own2Texture(texture: Texture) {
    textures.push(texture)
    return texture
  }

  // ── Floor: a violet ring of light around the base and a soft pool ──
  const floorPool = new Mesh(
    keep(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2)),
    own(new MeshBasicMaterial({ map: own2Texture(radialGlowTexture([[0, 'rgba(255,255,255,0.4)'], [0.55, 'rgba(255,255,255,0.14)'], [1, 'rgba(255,255,255,0)']])), color: VIOLET, blending: AdditiveBlending, transparent: true, depthWrite: false })),
  )
  floorPool.scale.set(10, 1, 10)
  floorPool.position.y = 0.005
  floorPool.renderOrder = 1
  const floorRing = new Mesh(
    keep(new RingGeometry(3.78, 3.92, 96).rotateX(-Math.PI / 2)),
    own(new MeshBasicMaterial({ color: '#D2C2FF', blending: AdditiveBlending, transparent: true, depthWrite: false, side: DoubleSide })),
  )
  floorRing.position.y = 0.01
  floorRing.renderOrder = 2
  const floorHalo = new Mesh(
    keep(new RingGeometry(3.6, 4.3, 96).rotateX(-Math.PI / 2)),
    own(new MeshBasicMaterial({ color: VIOLET, opacity: 0.42, blending: AdditiveBlending, transparent: true, depthWrite: false, side: DoubleSide })),
  )
  floorHalo.position.y = 0.008
  floorHalo.renderOrder = 1
  model.add(floorPool, floorHalo, floorRing)

  // ── Slot panel: two rows of five wells with a lavender rim and a dark smoky glass inside ──
  const rimShape = stadiumShape(0.8, 1.56)
  rimShape.holes.push(stadiumShape(0.64, 1.4))
  const rimGeometry = keep(new ExtrudeGeometry(rimShape, { depth: 0.1, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 2, curveSegments: 14 }))
  const rimMaterial = own(new MeshStandardMaterial({ color: '#CDC2F7', metalness: 0.35, roughness: 0.32 }))
  const wellGeometry = keep(new ExtrudeGeometry(stadiumShape(0.66, 1.42), { depth: 0.04, bevelEnabled: false, curveSegments: 14 }))
  // Opaque, so the wells draw before the additive capsules in front of them (which write no depth).
  const wellMaterial = own(new MeshStandardMaterial({ color: '#1F1736', metalness: 0.3, roughness: 0.12 }))
  const slots: { x: number; y: number }[] = []
  for (const y of DOME_SLOTS.rowY) {
    for (let column = 0; column < DOME_SLOTS.columns; column++) {
      const x = (column - (DOME_SLOTS.columns - 1) / 2) * DOME_SLOTS.pitchX
      slots.push({ x, y })
      const rimMesh = new Mesh(rimGeometry, rimMaterial)
      rimMesh.position.set(x, y, DOME_SLOTS.z - 0.05)
      const well = new Mesh(wellGeometry, wellMaterial)
      well.position.set(x, y, DOME_SLOTS.z - 0.06)
      model.add(well, rimMesh)
    }
  }
  // The violet glow inside the dome, behind and below the wells.
  const innerGlow = new Mesh(
    keep(new PlaneGeometry(1, 1)),
    own(new MeshBasicMaterial({ map: own2Texture(radialGlowTexture([[0, 'rgba(255,255,255,0.55)'], [0.5, 'rgba(255,255,255,0.16)'], [1, 'rgba(255,255,255,0)']])), color: VIOLET, blending: AdditiveBlending, transparent: true, depthWrite: false })),
  )
  innerGlow.scale.set(6.4, 4.6, 1)
  innerGlow.position.set(0, 2.9, -0.6)
  innerGlow.renderOrder = 2
  const domeFloorGlow = new Mesh(
    keep(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2)),
    own(new MeshBasicMaterial({ map: own2Texture(radialGlowTexture([[0, 'rgba(255,255,255,0.5)'], [0.6, 'rgba(255,255,255,0.16)'], [1, 'rgba(255,255,255,0)']])), color: '#8E66FF', blending: AdditiveBlending, transparent: true, depthWrite: false })),
  )
  domeFloorGlow.scale.set(6.2, 1, 6.2)
  domeFloorGlow.position.y = BASE_TOP + 0.03
  domeFloorGlow.renderOrder = 2
  // The floor under the glass: violet, glossy, lit by the glow (not the bare metal top of the base).
  const domeFloor = new Mesh(
    keep(new CylinderGeometry(3.14, 3.14, 0.02, 72)),
    own(new MeshStandardMaterial({ color: '#5C47A8', emissive: '#2B1A66', emissiveIntensity: 0.6, metalness: 0.1, roughness: 0.18 })),
  )
  domeFloor.position.y = BASE_TOP + 0.01
  model.add(domeFloor, innerGlow, domeFloorGlow)

  // ── Top: the collar, the glossy knob, the pole and its pennant ──
  const collar = new Mesh(keep(new CylinderGeometry(0.7, 0.74, 0.2, 48)), metal)
  collar.position.y = 6.03
  const knobMaterial = own(new MeshPhysicalMaterial({ color: VIOLET, emissive: VIOLET_DEEP, emissiveIntensity: 0.25, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 }))
  const knob = new Mesh(keep(new SphereGeometry(0.5, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2)), knobMaterial)
  knob.position.y = 6.13
  const pole = new Mesh(keep(new CylinderGeometry(0.045, 0.05, 0.95, 12)), metal)
  pole.position.y = 7.0
  const ball = new Mesh(keep(new SphereGeometry(0.09, 16, 12)), metal)
  ball.position.y = 7.52
  const flagGeo = keep(flagGeometry())
  const flagRest = Float32Array.from(flagGeo.getAttribute('position').array as Float32Array)
  const flag = new Mesh(flagGeo, own(new MeshPhysicalMaterial({ color: '#8A5CFF', emissive: VIOLET_DEEP, emissiveIntensity: 0.35, roughness: 0.35, clearcoat: 0.6, side: DoubleSide })))
  flag.position.set(0.04, 7.16, 0)
  model.add(collar, knob, pole, ball, flag)

  // ── The capsules (canonical model), upright in their wells ──
  /** `start`: when its drop began (ms); NaN: begins on the next drawn frame, `delay` ms later. */
  const capsules: { figure: CapsuleFigure; holder: Group; start: number; delay: number; slot: { x: number; y: number } }[] = []
  for (const slot of slots) {
    // Brighter and a little more coloured than in 내 메이트: each one sits alone against a dark well.
    const figure = createCapsuleFigure({ state: 'filled', length: 1.24, alphaCanvas: true, radialSegments: 24, saturation: 1.25 })
    figure.group.rotation.z = Math.PI / 2
    const holder = new Group()
    holder.position.set(slot.x, slot.y, DOME_SLOTS.z + 0.12)
    holder.add(figure.group)
    holder.visible = false
    model.add(holder)
    capsules.push({ figure, holder, start: -Infinity, delay: 0, slot })
  }

  // ── The glass dome (drawn last: additive, double-sided) ──
  const glass = forAlphaCanvas(fresnelGlassMaterial({ tint: new Color('#B094FF'), body: 0.045, rim: 0.75, streak: 0.62 }))
  materials.push(glass)
  const dome = new Mesh(keep(new LatheGeometry(domeProfile(), 72)), glass)
  dome.renderOrder = 10
  const domeLip = new Mesh(keep(new TorusGeometry(3.16, 0.05, 8, 96).rotateX(Math.PI / 2)), own(new MeshStandardMaterial({ color: '#E2DAFF', metalness: 0.4, roughness: 0.25 })))
  domeLip.position.y = BASE_TOP + 0.04
  model.add(domeLip, dome)

  // ── State ──
  let filled = 0
  let sweepStart = -Infinity
  let waveStart = -Infinity
  const pointer = { x: 0, y: 0 }
  const tilted = { x: 0, y: 0 }
  let lastTime = 0

  function resize() {
    const width = Math.max(1, host.clientWidth)
    const height = Math.max(1, host.clientHeight)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    // Fit VIEW.height at the dome's middle, seen a little from above (the base's top shows as an ellipse).
    const distance = VIEW.height / 2 / Math.tan((camera.fov * Math.PI) / 360)
    const elevation = (4 * Math.PI) / 180
    camera.position.set(0, VIEW.centerY + Math.sin(elevation) * distance, Math.cos(elevation) * distance)
    camera.lookAt(0, VIEW.centerY, 0)
    camera.updateProjectionMatrix()
    request()
  }

  /** Capsule `index` at `now`: hidden before its drop, falling, bouncing, seated. Returns whether it still moves. */
  function poseCapsule(index: number, now: number) {
    const capsule = capsules[index]!
    if (Number.isNaN(capsule.start)) capsule.start = now + capsule.delay
    if (index >= filled) {
      capsule.holder.visible = false
      return false
    }
    const elapsed = reducedMotion ? Infinity : now - capsule.start
    capsule.holder.visible = elapsed >= 0
    if (elapsed < 0) return true
    const { fallMs, settleMs, ceiling } = DOME_DROP
    const height = Math.min(DOME_DROP.height, ceiling - capsule.slot.y)
    let y = 0
    let squash = 0
    let glow = 1
    let opacity = 1
    let spin = 0
    if (elapsed < fallMs) {
      const t = elapsed / fallMs
      y = height * (1 - t * t)
      opacity = Math.min(1, t * 3)
      spin = (1 - t) * 0.5
    } else if (elapsed < fallMs + settleMs) {
      const t = (elapsed - fallMs) / settleMs
      y = Math.sin(Math.PI * t) * 0.16 * (1 - t * 0.3)
      squash = Math.sin(Math.PI * Math.min(1, t * 2.2)) * 0.07 * (1 - t)
      glow = 1 + 0.6 * (1 - easeOutCubic(t))
      spin = Math.sin(t * Math.PI * 2) * 0.06 * (1 - t)
    }
    capsule.holder.position.y = capsule.slot.y + y
    capsule.holder.scale.set(1 + squash, 1 - squash, 1)
    capsule.holder.rotation.z = spin
    capsule.figure.setGlow(CAPSULE_GLOW * glow)
    capsule.figure.setOpacity(opacity)
    return elapsed < fallMs + settleMs
  }

  function poseFlag(now: number) {
    const elapsed = reducedMotion ? Infinity : now - waveStart
    const position = flagGeo.getAttribute('position') as BufferAttribute
    const array = position.array as Float32Array
    const waving = elapsed < WAVE_MS
    const amount = waving ? 1 - elapsed / WAVE_MS : 0
    for (let index = 0; index < array.length; index += 3) {
      const u = flagRest[index]! / 0.98
      array[index + 2] = waving ? Math.sin(u * 5.5 - elapsed * 0.014) * 0.16 * u * amount : 0
      array[index + 1] = flagRest[index + 1]! + (waving ? Math.sin(u * 4 - elapsed * 0.011) * 0.04 * u * amount : 0)
    }
    position.needsUpdate = true
    flagGeo.computeVertexNormals()
    return waving
  }

  function render(now: number) {
    if (disposed || contextLost) return false
    // The first frame after a pause steps as one frame at 60 fps (a step of 0 would snap the tilt to its target).
    const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 1 / 60
    lastTime = now
    let moving = false
    for (let index = 0; index < capsules.length; index++) moving = poseCapsule(index, now) || moving
    moving = poseFlag(now) || moving
    const sweeping = !reducedMotion && now - sweepStart < SWEEP_MS
    glass.uniforms.uSweep!.value = sweeping ? -3 + ((now - sweepStart) / SWEEP_MS) * 10 : -20
    moving = sweeping || moving
    // Pointer tilt, damped toward its target (none under reduced motion).
    const targetX = reducedMotion ? 0 : pointer.y * TILT_MAX
    const targetY = reducedMotion ? 0 : pointer.x * TILT_MAX
    const k = 1 - Math.exp(-8 * dt)
    tilted.x += (targetX - tilted.x) * k
    tilted.y += (targetY - tilted.y) * k
    if (Math.abs(targetX - tilted.x) < 1e-4 && Math.abs(targetY - tilted.y) < 1e-4) {
      tilted.x = targetX
      tilted.y = targetY
    } else moving = true
    tilt.rotation.set(tilted.x, tilted.y, 0)
    renderer.render(scene, camera)
    if (firstFrame) {
      firstFrame = false
      options.onFirstFrame?.()
    }
    return moving
  }

  function frame() {
    raf = 0
    // The clock, not the frame's timestamp: a frame queued before a long task (shader compiles) carries a stale one.
    const moving = render(performance.now())
    if (moving) request()
    else lastTime = 0
  }

  function request() {
    if (!raf && running && !disposed && !contextLost) raf = requestAnimationFrame(frame)
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
    lastTime = 0
  }

  const onPointerMove = (event: PointerEvent) => {
    if (reducedMotion) return
    const box = pointerTarget.getBoundingClientRect()
    pointer.x = Math.max(-1, Math.min(1, ((event.clientX - box.left) / box.width) * 2 - 1))
    pointer.y = Math.max(-1, Math.min(1, ((event.clientY - box.top) / box.height) * 2 - 1))
    request()
  }
  const onPointerLeave = () => {
    pointer.x = 0
    pointer.y = 0
    request()
  }
  pointerTarget.addEventListener('pointermove', onPointerMove)
  pointerTarget.addEventListener('pointerleave', onPointerLeave)

  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(host)

  const onContextLost = (event: Event) => {
    event.preventDefault()
    contextLost = true
    stop()
    options.onContextFailure?.()
  }
  canvas.addEventListener('webglcontextlost', onContextLost)
  // Compile every program now (capsules shown for it): the first drawn frame would otherwise stall on it and eat the
  // start of the drop.
  for (const capsule of capsules) capsule.holder.visible = true
  renderer.compile(scene, camera)
  for (const capsule of capsules) capsule.holder.visible = false
  resize()

  return {
    setFilled(next, enterFrom) {
      const count = Math.max(0, Math.min(capsules.length, next))
      for (let index = 0; index < count; index++) {
        const capsule = capsules[index]!
        if (index >= enterFrom && (index >= filled || capsule.start === -Infinity)) {
          // Drops from the next drawn frame on, one after another.
          capsule.start = Number.NaN
          capsule.delay = (index - enterFrom) * DOME_DROP.staggerMs
        } else if (capsule.start === -Infinity) capsule.start = performance.now() - 10_000
      }
      for (let index = count; index < capsules.length; index++) capsules[index]!.start = -Infinity
      filled = count
      request()
    },
    celebrate() {
      if (reducedMotion) return
      const now = performance.now()
      // After the new capsule has landed.
      sweepStart = now + DOME_DROP.fallMs
      waveStart = now
      request()
    },
    setReducedMotion(value) {
      reducedMotion = value
      if (value) {
        pointer.x = pointer.y = 0
        stop()
      }
      request()
    },
    setRunning(value) {
      running = value
      if (value) request()
      else stop()
    },
    stats() {
      renderer.render(scene, camera)
      return { triangles: renderer.info.render.triangles, calls: renderer.info.render.calls, dpr: renderer.getPixelRatio(), animating: raf !== 0 }
    },
    dispose() {
      disposed = true
      stop()
      resizeObserver.disconnect()
      pointerTarget.removeEventListener('pointermove', onPointerMove)
      pointerTarget.removeEventListener('pointerleave', onPointerLeave)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      for (const capsule of capsules) capsule.figure.dispose()
      for (const geometry of geometries) geometry.dispose()
      for (const material of materials) material.dispose()
      for (const texture of textures) texture.dispose()
      environmentTarget.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    },
  }
}
