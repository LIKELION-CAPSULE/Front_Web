import {
  AdditiveBlending, AgXToneMapping, BufferAttribute, BufferGeometry, CanvasTexture, Color, DirectionalLight, DoubleSide,
  Group, InstancedMesh, Mesh, MeshBasicMaterial, PerspectiveCamera, Plane,
  PlaneGeometry, PMREMGenerator, Points, Raycaster, Scene, Sprite, SpriteMaterial, SRGBColorSpace, Vector2, Vector3,
  WebGLRenderer,
} from 'three'
import type { Material, Object3D, Texture } from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { designColors, designPalette } from '@/shared/design/tokens'
import { createChips, createFracture } from './capsule-fracture'
import { createRibbons, createSparkles } from './capsule-light'
import { createPost } from './capsule-post'
import { CAPSULE_CAP_RADIUS as CAP_R, CAPSULE_SEAM_Y as SEAM_Y, createCapsuleHalves } from './capsule-shell'

/** The card's four corners in viewport pixels (top left, top right, bottom right, bottom left). */
export type CardQuad = readonly (readonly [number, number])[]
export type CapsuleQuality = 'high' | 'normal'

/** Frames skipped before timing (shader compiles land there), then frames averaged to judge the device. */
const WARMUP_FRAMES = 5
const SAMPLE_FRAMES = 30
const SLOW_FRAME_MS = 25

const rand = (min: number, max: number) => min + Math.random() * (max - min)

function radialTexture(stops: [number, string][]) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
  stops.forEach(([offset, color]) => gradient.addColorStop(offset, color))
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 256, 256)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

/** Whether the device can likely afford bloom; the frame time check can still lower it later. */
function initialQuality(): CapsuleQuality {
  const cores = navigator.hardwareConcurrency
  return cores !== undefined && cores <= 4 ? 'normal' : 'high'
}

/**
 * The capsule card intro scene: a lying two-tone pill that cracks in three blows, splits toward the camera and
 * releases light ribbons, sparkles and shards. The page's card sits under this transparent canvas, so an invisible
 * occluder at the card's corners (projected to the z = 0 plane) writes depth and hides whatever passes behind it.
 */
export function createCapsuleScene(host: HTMLElement, options: { getCardQuad?: () => CardQuad | null; onQuality?: (quality: CapsuleQuality) => void } = {}) {
  const canvas = document.createElement('canvas')
  host.append(canvas)
  // three.js needs WebGL2; without it this throws and the intro falls back to the card alone.
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true })
  const pixelRatio = Math.min(window.devicePixelRatio, 2)
  renderer.setPixelRatio(pixelRatio)
  renderer.toneMapping = AgXToneMapping
  renderer.toneMappingExposure = 1.2
  renderer.setClearColor(0x000000, 0)

  const scene = new Scene()
  const pmrem = new PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const environment = pmrem.fromScene(room, 0.04).texture
  room.dispose()
  scene.environment = environment

  const camera = new PerspectiveCamera(30, 1, 0.1, 50)
  /** Animated dolly on top of the aspect-based distance. */
  const dolly = { offset: 0 }
  let baseZ = 6.6

  const key = new DirectionalLight(0xfff6ec, 1.3)
  key.position.set(2.5, 3.2, 4)
  const rimLight = new DirectionalLight(0xc4b9f3, 1.6)
  rimLight.position.set(-3, 2.5, -4)
  scene.add(key, rimLight)

  const { cap: capShell, body: bodyShell } = createCapsuleHalves(designColors.primary, designPalette.violet['300'])
  const cap = capShell.group
  const body = bodyShell.group
  const pill = new Group()
  // Lying down: local +y (the cap) points to the right of the screen and local -x to the top.
  pill.rotation.z = -Math.PI / 2 + 0.05
  pill.add(cap, body)
  const floatG = new Group()
  floatG.add(pill)
  scene.add(floatG)
  const fracture = createFracture(capShell, bodyShell, SEAM_Y)

  const shadow = new Mesh(
    new PlaneGeometry(3.2, 0.9),
    new MeshBasicMaterial({ map: radialTexture([[0, 'rgba(0,0,0,0.85)'], [0.45, 'rgba(0,0,0,0.4)'], [1, 'rgba(0,0,0,0)']]), transparent: true, opacity: 0, depthWrite: false }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = -0.8
  scene.add(shadow)

  const glow = new Sprite(new SpriteMaterial({
    map: radialTexture([[0, '#ffffff'], [0.22, designPalette.violet['200']], [0.5, `${designPalette.violet['400']}66`], [1, `${designPalette.violet['400']}00`]]),
    blending: AdditiveBlending, transparent: true, opacity: 0, depthWrite: false, depthTest: false,
  }))
  glow.scale.setScalar(0.6)
  glow.renderOrder = 10
  scene.add(glow)

  const ribbons = createRibbons()
  scene.add(ribbons.group)
  const sparkles = createSparkles(pill, CAP_R, SEAM_Y)
  scene.add(sparkles.points)
  const chips = createChips()
  scene.add(chips.mesh)
  const seamPoint = new Vector3()
  const capColor = new Color(designPalette.violet['300'])
  const bodyColor = new Color(designColors.primary)

  const occluderGeometry = new BufferGeometry()
  occluderGeometry.setAttribute('position', new BufferAttribute(new Float32Array(12), 3))
  occluderGeometry.setIndex([0, 1, 2, 0, 2, 3])
  const occluder = new Mesh(occluderGeometry, new MeshBasicMaterial({ colorWrite: false, side: DoubleSide }))
  occluder.renderOrder = -1
  occluder.frustumCulled = false
  scene.add(occluder)
  const raycaster = new Raycaster()
  const cardPlane = new Plane(new Vector3(0, 0, 1), 0)
  const ndc = new Vector2()
  const hit = new Vector3()

  const post = initialQuality() === 'high' ? createPost(renderer) : null
  let quality: CapsuleQuality = post ? 'high' : 'normal'
  function applyQuality() {
    const high = quality === 'high'
    // Slightly less reflection so highlights do not bloom out.
    capShell.outer.envMapIntensity = bodyShell.outer.envMapIntensity = high ? 1.08 : 1.25
    ribbons.setHighQuality(high)
    sparkles.setHighQuality(high)
    options.onQuality?.(quality)
  }
  applyQuality()

  /** Progress values the timeline animates: crack 0 → 1, ribbon 0 → 1.55. */
  const fx = { crack: 0, ribbon: 0 }
  let width = 1
  let height = 1

  function resize() {
    width = host.clientWidth || window.innerWidth
    height = host.clientHeight || window.innerHeight
    renderer.setSize(width, height, false)
    post?.setSize(width, height, pixelRatio)
    camera.aspect = width / height
    // Narrow portrait screens back off further so the lying pill keeps clear of the edges even when the camera
    // dollies in (-0.7) before the split: about 1.2 units of half width must stay visible.
    const fit = 1.2 / (Math.tan((camera.fov * Math.PI) / 360) * camera.aspect) + 0.7
    baseZ = camera.aspect < 0.85 ? Math.max(8.8, fit) : 6.6
    camera.updateProjectionMatrix()
  }

  function placeOccluder() {
    const quad = options.getCardQuad?.()
    const positions = occluderGeometry.attributes.position as BufferAttribute
    // Kept drawn (as a zero-area quad while the card is hidden) so its shader is ready before the card appears.
    if (!quad) {
      positions.array.fill(0)
      positions.needsUpdate = true
      return
    }
    quad.forEach(([x, y], index) => {
      ndc.set((x / width) * 2 - 1, 1 - (y / height) * 2)
      raycaster.setFromCamera(ndc, camera)
      if (raycaster.ray.intersectPlane(cardPlane, hit)) positions.setXYZ(index, hit.x, hit.y, hit.z)
    })
    positions.needsUpdate = true
  }

  resize()
  window.addEventListener('resize', resize)
  // Compile every shader up front, in parallel where supported, so effects that first appear mid-animation
  // (ribbons, shards, the card occluder) do not stall a frame.
  ;(post ? post.precompile(scene, camera) : renderer.compileAsync(scene, camera)).catch(() => { /* Compiled on first use instead. */ })
  let last = performance.now()
  let frame = 0
  let sampled = 0
  renderer.setAnimationLoop(time => {
    const elapsed = time - last
    last = time
    // Judge the device on settled frames; bloom is the heavy part, so a slow device drops it for good.
    frame++
    if (quality === 'high' && frame > WARMUP_FRAMES && frame <= WARMUP_FRAMES + SAMPLE_FRAMES) {
      sampled += elapsed
      if (frame === WARMUP_FRAMES + SAMPLE_FRAMES && sampled / SAMPLE_FRAMES > SLOW_FRAME_MS) {
        quality = 'normal'
        applyQuality()
      }
    }
    const dt = Math.max(0, Math.min(elapsed / 1000, 1 / 20))
    camera.position.set(0, 0.35, baseZ + dolly.offset)
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld()
    sparkles.uniforms.uScale.value = renderer.domElement.height / (2 * Math.tan((camera.fov * Math.PI) / 360))
    sparkles.uniforms.uFocus.value = camera.position.length()
    fracture.update(fx.crack)
    ribbons.update(fx.ribbon)
    scene.updateMatrixWorld()
    sparkles.update(dt)
    chips.update(dt)
    placeOccluder()
    if (quality === 'high' && post) post.render(scene, camera)
    else renderer.render(scene, camera)
  })

  /** Shards off the cracks reached so far. */
  function breakChips(count: number, power: number) {
    chips.breakChips(fracture.points, fx.crack, count, power)
  }
  /** Shards from the front of the seam as the halves part. */
  function breakSeam(count: number, power: number) {
    for (let n = 0; n < count; n++) {
      const theta = rand(0.35, 2.8)
      seamPoint.set(CAP_R * Math.cos(theta), SEAM_Y + rand(-0.02, 0.02), CAP_R * Math.sin(theta))
      chips.spawn(pill.localToWorld(seamPoint), Math.random() < 0.5 ? capColor : bodyColor, power)
    }
  }

  function dispose() {
    window.removeEventListener('resize', resize)
    renderer.setAnimationLoop(null)
    const materials = new Set<Material>()
    scene.traverse((object: Object3D) => {
      if (object instanceof Mesh || object instanceof Sprite || object instanceof Points || object instanceof InstancedMesh) {
        object.geometry.dispose()
        ;(Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material))
      }
    })
    materials.forEach(material => {
      const map = (material as Material & { map?: Texture | null }).map
      map?.dispose()
      material.dispose()
    })
    chips.mesh.dispose()
    post?.dispose()
    environment.dispose()
    pmrem.dispose()
    renderer.dispose()
    // The canvas is created here and removed below, so losing its context is safe and frees it right away.
    renderer.forceContextLoss()
    canvas.remove()
  }

  return {
    floatG, cap, body, shadow, glow, dolly, fx,
    ribbons: ribbons.group,
    emitters: sparkles.rates,
    /** Every material of both halves, cracks and their edges included, for fading them out together. */
    halfMaterials: [...capShell.materials, ...bodyShell.materials, ...fracture.materials],
    quality: () => quality,
    breakChips,
    breakSeam,
    dispose,
  }
}
