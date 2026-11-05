import {
  AdditiveBlending, AgXToneMapping, BackSide, CanvasTexture, Color, DirectionalLight, DoubleSide, Group, LatheGeometry, Mesh,
  MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, PMREMGenerator, Scene,
  Sprite, SpriteMaterial, SRGBColorSpace, TorusGeometry, Vector2, WebGLRenderer,
} from 'three'
import type { Material, Object3D, Texture } from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { designColors, designPalette } from '@/shared/design/tokens'

const R = 0.34
/** The cap is slightly wider so it closes over the body. */
const CAP_R = R * 1.04
const SEGMENTS = 96
const ARC_STEPS = 32
const SEAM_Y = -0.12

/** Lathe profile, ordered bottom to top: a hemisphere and a straight wall up (body) or down (cap) to the rim. */
function profile(radius: number, center: number, rim: number, cap: boolean) {
  const arc = Array.from({ length: ARC_STEPS + 1 }, (_, step) => {
    const angle = (step / ARC_STEPS) * Math.PI / 2
    return cap
      ? new Vector2(radius * Math.cos(angle), center + radius * Math.sin(angle))
      : new Vector2(radius * Math.sin(angle), center - radius * Math.cos(angle))
  })
  return cap ? [new Vector2(radius, rim), ...arc] : [...arc, new Vector2(radius, rim)]
}

function shell(hex: string, radius: number, center: number, rim: number, cap: boolean) {
  const color = new Color(hex)
  const outer = new MeshPhysicalMaterial({
    color, roughness: 0.2, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03,
    sheen: 0.35, sheenRoughness: 0.5, sheenColor: color.clone().lerp(new Color('#ffffff'), 0.65),
    iridescence: 0.3, iridescenceIOR: 1.3, iridescenceThicknessRange: [200, 520],
    envMapIntensity: 1.25, side: DoubleSide,
  })
  const inner = new MeshStandardMaterial({ color: color.clone().multiplyScalar(0.3), roughness: 0.7, side: BackSide })
  const half = new Group()
  const lip = new Mesh(new TorusGeometry(radius * 0.983, radius * 0.022, 16, SEGMENTS), outer)
  lip.rotation.x = Math.PI / 2
  lip.position.y = rim
  half.add(
    new Mesh(new LatheGeometry(profile(radius, center, rim, cap), SEGMENTS), outer),
    new Mesh(new LatheGeometry(profile(radius * 0.965, center, rim, cap), SEGMENTS), inner),
    lip,
  )
  return half
}

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

/** The two-tone pill of the capsule card intro. The caller animates the returned parts; `dispose` frees everything. */
export function createCapsuleScene(host: HTMLElement) {
  const canvas = document.createElement('canvas')
  host.append(canvas)
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
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
  let baseZ = 6.4

  const key = new DirectionalLight(0xfff6ec, 1.3)
  key.position.set(2.5, 3.2, 4)
  const rimLight = new DirectionalLight(0xc4b9f3, 1.6)
  rimLight.position.set(-3, 2.5, -4)
  scene.add(key, rimLight)

  const cap = shell(designPalette.violet['300'], CAP_R, 0.62, SEAM_Y, true)
  const body = shell(designColors.primary, R, -0.62, 0.32, false)
  const seam = new Mesh(
    new TorusGeometry(CAP_R * 1.02, 0.018, 12, SEGMENTS),
    new MeshBasicMaterial({ color: '#e9e2ff', blending: AdditiveBlending, transparent: true, opacity: 0, depthWrite: false }),
  )
  seam.rotation.x = Math.PI / 2
  seam.position.y = SEAM_Y
  const pill = new Group()
  pill.rotation.z = -(Math.PI / 2 - 0.48)
  pill.add(cap, body, seam)
  const floatG = new Group()
  floatG.add(pill)
  scene.add(floatG)

  const shadow = new Mesh(
    new PlaneGeometry(3.0, 0.9),
    new MeshBasicMaterial({ map: radialTexture([[0, 'rgba(0,0,0,0.85)'], [0.45, 'rgba(0,0,0,0.4)'], [1, 'rgba(0,0,0,0)']]), transparent: true, opacity: 0, depthWrite: false }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = -0.9
  scene.add(shadow)

  const glow = new Sprite(new SpriteMaterial({
    map: radialTexture([[0, '#ffffff'], [0.22, designPalette.violet['200']], [0.5, `${designPalette.violet['400']}66`], [1, `${designPalette.violet['400']}00`]]),
    blending: AdditiveBlending, transparent: true, opacity: 0, depthWrite: false, depthTest: false,
  }))
  glow.scale.setScalar(0.6)
  glow.renderOrder = 10
  scene.add(glow)

  function resize() {
    const width = host.clientWidth || window.innerWidth
    const height = host.clientHeight || window.innerHeight
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    baseZ = camera.aspect < 0.85 ? 8.2 : 6.4
    camera.updateProjectionMatrix()
  }
  resize()
  window.addEventListener('resize', resize)
  renderer.setAnimationLoop(() => {
    camera.position.set(0, 1.1, baseZ + dolly.offset)
    camera.lookAt(0, 0, 0)
    renderer.render(scene, camera)
  })

  function dispose() {
    window.removeEventListener('resize', resize)
    renderer.setAnimationLoop(null)
    const materials = new Set<Material>()
    scene.traverse((object: Object3D) => {
      if (object instanceof Mesh || object instanceof Sprite) {
        object.geometry.dispose()
        ;(Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material))
      }
    })
    materials.forEach(material => {
      const map = (material as Material & { map?: Texture | null }).map
      map?.dispose()
      material.dispose()
    })
    environment.dispose()
    pmrem.dispose()
    renderer.dispose()
    // The canvas is created here and removed below, so losing its context is safe and frees it right away.
    renderer.forceContextLoss()
    canvas.remove()
  }

  return { canvas, floatG, cap, body, seam, shadow, glow, dolly, dispose }
}
