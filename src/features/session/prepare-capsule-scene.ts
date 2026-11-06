import {
  AgXToneMapping, AmbientLight, BufferGeometry, CanvasTexture, DirectionalLight, Group,
  Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry,
  PMREMGenerator, Scene, SRGBColorSpace, TorusGeometry, WebGLRenderer,
} from 'three'
import type { Material } from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { designColors, designPalette } from '@/shared/design/tokens'
import { capsuleLanding, capsuleLidPose, clamp01, ease, prepareFormLayout, prepareCapsuleScale, PREPARE_SHAPE, LID_OPEN_START_MS, LID_OPEN_END_MS, LID_CLOSE_START_MS, PREPARE_DEPARTURE_MS, PREPARE_STORE_MS, PREPARE_TRAVEL_MS } from './prepare-capsule-motion'
import type { PreparePaper } from './prepare-paper-snapshot'
import type { CapsuleInscription } from './prepare-capsule-personalization'
import { engravePrepareCapsule } from './prepare-capsule-engraving'
import { createPrepareDots } from './prepare-capsule-dots'
import { createPrepareCapsuleHalves } from './prepare-capsule-shape'

export type PrepareCapsulePhase = 'dropping' | 'opening' | 'halftone' | 'burst' | 'gathering' | 'closing' | 'sealed'
export type PrepareCapsuleScene = {
  canvas: HTMLCanvasElement
  finished: Promise<void>
  depart: (onArrival: () => void) => Promise<void>
  settle: () => void
  dispose: () => void
}

/** One pixel at z=0 maps to one viewport pixel, so the 3D sheet replaces the live card without a jump. */
export function createPrepareCapsuleScene(host: HTMLElement, paper: PreparePaper, inscription: CapsuleInscription, poster: HTMLImageElement | null, onPhase: (phase: PrepareCapsulePhase) => void): PrepareCapsuleScene {
  const renderer = new WebGLRenderer({ alpha: true, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.toneMapping = AgXToneMapping
  renderer.toneMappingExposure = 1.2
  renderer.setClearColor(0, 0)
  renderer.domElement.setAttribute('aria-hidden', 'true')
  host.append(renderer.domElement)
  const scene = new Scene()
  const camera = new PerspectiveCamera(35, 1, 1, 5000)
  const pmrem = new PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const environment = pmrem.fromScene(room, .04).texture
  room.dispose()
  scene.environment = environment
  scene.add(new AmbientLight(0xffffff, .15))
  const key = new DirectionalLight(0xfff5ec, 1.3)
  key.position.set(-250, 400, 700)
  const rim = new DirectionalLight(0xc4b9f3, 1.6)
  rim.position.set(350, 120, -150)
  scene.add(key, rim)

  const texture = new CanvasTexture(paper.canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4)
  const geometry = new PlaneGeometry(paper.bounds.width, paper.bounds.height)
  const front = new MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false, depthWrite: false })
  const sheet = new Group()
  sheet.add(new Mesh(geometry, front))
  scene.add(sheet)
  const seed = Math.floor(Math.random() * 4294967296)
  const dots = createPrepareDots(paper, poster, window.innerWidth, window.innerHeight, seed ^ 0x37a41)
  scene.add(dots.mesh)
  renderer.domElement.dataset.posterSource = dots.sampledPoster ? 'room' : 'form'
  renderer.domElement.dataset.dotCount = String(dots.count)
  renderer.domElement.dataset.dotPitchRatio = dots.pitchRatio.toFixed(3)

  const { cap, body } = createPrepareCapsuleHalves(designColors.primary, designPalette.violet['300'])
  const engraving = engravePrepareCapsule(body, cap, inscription)
  const capsule = new Group()
  capsule.add(cap.group, body.group)
  const seamMaterial = new MeshBasicMaterial({ color: designPalette.violet['200'], transparent: true, opacity: 0, depthWrite: false })
  const seam = new Mesh(new TorusGeometry(PREPARE_SHAPE.radius, .002, 8, 96), seamMaterial)
  seam.rotation.x = Math.PI / 2
  seam.position.y = 0
  capsule.add(seam)
  scene.add(capsule)
  const shadowCanvas = document.createElement('canvas')
  shadowCanvas.width = shadowCanvas.height = 128
  const shadowContext = shadowCanvas.getContext('2d')!
  const gradient = shadowContext.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, '#07041199'); gradient.addColorStop(1, '#07041100')
  shadowContext.fillStyle = gradient; shadowContext.fillRect(0, 0, 128, 128)
  const shadowTexture = new CanvasTexture(shadowCanvas)
  const shadowMaterial = new MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: 0 })
  const shadow = new Mesh(new PlaneGeometry(1, 1), shadowMaterial)
  scene.add(shadow)
  const shellMaterials = [...cap.materials, ...body.materials]
  let width = 1, height = 1, scale = 100, lyingScale = 100
  let frame = 0, disposed = false, complete = false, phase: PrepareCapsulePhase | undefined
  let travelStartedAt: number | null = null, arrived = false, onArrival = () => {}, resolveTravel = () => {}
  let travelling: Promise<void> | null = null
  let resolveFinished = () => {}
  const finished = new Promise<void>(resolve => { resolveFinished = resolve })
  let startedAt = 0
  const interval = (ms: number, from: number, to: number) => ease((ms - from) / (to - from))

  function resize() {
    width = window.innerWidth; height = window.innerHeight
    renderer.setSize(width, height)
    camera.aspect = width / height
    camera.position.z = height / (2 * Math.tan(35 * Math.PI / 360))
    camera.position.x = 0; camera.rotation.y = 0
    camera.updateProjectionMatrix()
    scale = lyingScale = prepareCapsuleScale(width, height)
  }
  function finish() {
    if (complete) return
    complete = true
    resolveFinished()
  }
  function draw(now: number) {
    if (disposed) return
    const elapsed = Math.max(now - startedAt, complete ? PREPARE_DEPARTURE_MS : 0)
    const landing = capsuleLanding(elapsed, width, height, scale, seed)
    const open = clamp01((elapsed - LID_OPEN_START_MS) / (LID_OPEN_END_MS - LID_OPEN_START_MS))
    const close = clamp01((elapsed - LID_CLOSE_START_MS) / (PREPARE_STORE_MS - LID_CLOSE_START_MS))
    const lid = open * (1 - close)
    const center = interval(elapsed, PREPARE_STORE_MS, 4960)
    const reveal = interval(elapsed, 4580, 4960)
    engraving.update(reveal)
    key.position.x = -250 + 600 * interval(elapsed, 4580, 5040)
    const nextPhase = elapsed < LID_OPEN_START_MS ? 'dropping' : elapsed < 1850 ? 'opening' : elapsed < 2240 ? 'halftone' : elapsed < 2900 ? 'burst' : elapsed < LID_CLOSE_START_MS ? 'gathering' : elapsed < PREPARE_STORE_MS ? 'closing' : 'sealed'
    if (!complete && phase !== nextPhase) { phase = nextPhase; onPhase(nextPhase) }
    if (!complete) {
      const makeRoom = interval(elapsed, 0, 320)
      const layout = prepareFormLayout(width, height, paper.bounds.width, paper.bounds.height)
      sheet.scale.setScalar(1 + (layout.scale - 1) * makeRoom)
      sheet.position.set(
        (paper.bounds.x + paper.bounds.width / 2 - width / 2) * (1 - makeRoom),
        (height / 2 - paper.bounds.y - paper.bounds.height / 2) * (1 - makeRoom) + layout.y * makeRoom,
        0,
      )
      sheet.rotation.set(0, 0, 0)
      front.opacity = 1 - dots.formation(elapsed)
      sheet.visible = front.opacity > .001
    } else sheet.visible = false
    capsule.position.set(landing.x * (1 - center), landing.y * (1 - center) + (complete && travelStartedAt === null ? Math.sin(elapsed / 550) * 3 : 0), landing.z)
    capsule.rotation.set(landing.pitch, landing.yaw - .14 * lid, landing.angle)
    capsule.scale.set(scale * landing.squash, scale * (1 + landing.contact * .015), scale)
    const lidPose = capsuleLidPose(lid)
    cap.group.position.set(lidPose.x, lidPose.y, lidPose.z)
    cap.group.rotation.z = lidPose.angle
    const opacity = interval(elapsed, 0, 90)
    shellMaterials.forEach(material => { material.opacity = opacity })
    seamMaterial.opacity = close >= .99 ? .12 : 0
    shadow.position.set(landing.x, height * .08 * (1 - center) - scale * .38, -100)
    shadow.scale.set(scale * 2.8 + landing.altitude * .2, scale * .33 + landing.altitude * .03, 1)
    shadowMaterial.opacity = .65 * (1 - clamp01(landing.altitude / height)) + landing.contact * .12
    dots.update(elapsed, sheet, capsule)
    if (travelStartedAt !== null) {
      const progress = clamp01((now - travelStartedAt) / PREPARE_TRAVEL_MS)
      const roll = progress * progress * (2 - progress)
      const pan = ease((progress - .12) / .88)
      // Portrait cameras see farther right for the same yaw; carry the capsule completely beyond that view.
      capsule.position.x = (width * 1.25 + height * .35) * roll
      capsule.position.y = -height * .07 * roll + Math.sin(progress * Math.PI) * lyingScale * .09
      capsule.rotation.set(progress * Math.PI * 1.4, -.12 * pan, -Math.PI / 2 - roll * Math.PI * .65)
      camera.position.x = width * .16 * pan
      camera.rotation.y = -.18 * pan
      shadow.position.x = capsule.position.x
      shadow.position.y = capsule.position.y - lyingScale * .4
      shadowMaterial.opacity *= 1 - pan
      if (progress >= .16 && !arrived) { arrived = true; onArrival() }
      if (progress >= 1) resolveTravel()
    }
    renderer.render(scene, camera)
    if (elapsed >= PREPARE_DEPARTURE_MS) finish()
    frame = requestAnimationFrame(draw)
  }
  function settle() {
    if (disposed) return
    if (travelStartedAt !== null) {
      if (!arrived) { arrived = true; onArrival() }
      resolveTravel()
      return
    }
    finish()
    resize()
    // The waiting pose is always centered after resizing or returning to a hidden tab.
    sheet.visible = false
    dots.mesh.visible = false
    cap.group.position.set(0, 0, 0); cap.group.rotation.z = 0
    shellMaterials.forEach(material => { material.opacity = 1 })
    capsule.position.set(0, 0, 20); capsule.rotation.set(0, 0, -Math.PI / 2); capsule.scale.setScalar(lyingScale)
    engraving.update(1)
    renderer.render(scene, camera)
  }
  function dispose() {
    if (disposed) return
    disposed = true
    finish()
    resolveTravel()
    cancelAnimationFrame(frame)
    const geometries = new Set<BufferGeometry>(), materials = new Set<Material>()
    scene.traverse(object => {
      if (object instanceof Mesh) {
        geometries.add(object.geometry)
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material)
      }
    })
    geometries.forEach(value => value.dispose())
    materials.forEach(value => value.dispose())
    texture.dispose(); shadowTexture.dispose(); dots.dispose(); engraving.dispose(); environment.dispose(); pmrem.dispose(); renderer.dispose(); renderer.forceContextLoss()
    renderer.domElement.remove()
  }
  try {
    resize()
    renderer.compile(scene, camera)
    startedAt = performance.now()
    draw(startedAt)
  } catch (error) { dispose(); throw error }
  return { canvas: renderer.domElement, finished, settle, dispose, depart(arrival) {
    if (travelling) return travelling
    if (disposed) return Promise.resolve()
    travelling = new Promise<void>(resolve => { resolveTravel = resolve })
    onArrival = arrival
    travelStartedAt = performance.now()
    return travelling
  } }
}
