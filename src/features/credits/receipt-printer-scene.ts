import {
  AgXToneMapping, AmbientLight, CanvasTexture, DirectionalLight, Group, Mesh, MeshBasicMaterial,
  MeshPhysicalMaterial, MeshStandardMaterial, OrthographicCamera, PlaneGeometry,
  PMREMGenerator, Scene, SphereGeometry, Sprite, SpriteMaterial, SRGBColorSpace, Vector3, WebGLRenderer,
} from 'three'
import type { Material } from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { designColors, designPalette } from '@/shared/design/tokens'

const SLOT_SPAN = 3.04
const TURN = -0.48

function brandTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 768
  const ctx = canvas.getContext('2d')!
  ctx.translate(384, 270)
  ctx.save()
  ctx.rotate(-Math.PI / 4)
  ctx.fillStyle = designColors.primary
  ctx.beginPath()
  ctx.roundRect(-84, -145, 168, 290, 84)
  ctx.fill()
  ctx.fillStyle = designPalette.violet['300']
  ctx.beginPath()
  ctx.roundRect(-65, -125, 130, 130, [65, 65, 0, 0])
  ctx.fill()
  ctx.restore()
  ctx.fillStyle = designPalette.violet['900']
  ctx.textAlign = 'center'
  ctx.font = '600 68px sans-serif'
  ctx.fillText('CAPSULE', 0, 250)
  ctx.fillStyle = designPalette.neutral['600']
  ctx.font = '400 23px sans-serif'
  ctx.fillText('A LITTLE MORE TIME', 0, 302)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function shadowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(64, 64, 12, 64, 64, 64)
  gradient.addColorStop(0, '#000000b0')
  gradient.addColorStop(1, '#00000000')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)
  return new CanvasTexture(canvas)
}

/** A fixed camera keeps the DOM receipt aligned with the printer's right-hand outlet. */
export function createReceiptPrinterScene(host: HTMLElement, outlet: HTMLElement) {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
  renderer.toneMapping = AgXToneMapping
  renderer.toneMappingExposure = 0.95
  renderer.setClearColor(0x000000, 0)
  host.append(renderer.domElement)
  const scene = new Scene()
  const camera = new OrthographicCamera(0, 1, 1, 0, 0.1, 2000)
  camera.position.z = 1000
  const pmrem = new PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const environment = pmrem.fromScene(room, 0.04)
  room.dispose()
  scene.environment = environment.texture
  scene.add(new AmbientLight(0xffffff, 0.65))
  const key = new DirectionalLight(0xffffff, 2.8)
  key.position.set(-200, 400, 600)
  const rim = new DirectionalLight(designPalette.violet['300'], 2)
  rim.position.set(300, -100, 200)
  scene.add(key, rim)
  const assembly = new Group()
  const body = new Group()
  body.rotation.y = TURN
  assembly.add(body)
  scene.add(assembly)

  const shell = new MeshPhysicalMaterial({ color: designPalette.violet['100'], roughness: 0.38, metalness: 0.04, clearcoat: 0.35 })
  const lid = new MeshPhysicalMaterial({ color: designPalette.neutral['100'], roughness: 0.45, clearcoat: 0.2 })
  const plum = new MeshStandardMaterial({ color: designPalette.violet['900'], roughness: 0.58 })
  const seam = new MeshStandardMaterial({ color: designPalette.violet['300'], roughness: 0.62 })
  const black = new MeshStandardMaterial({ color: designPalette.neutral['950'], roughness: 0.85 })
  const button = new MeshPhysicalMaterial({ color: designPalette.violet['200'], roughness: 0.32, clearcoat: 0.4 })
  const led = new MeshStandardMaterial({ color: designColors.success, emissive: designColors.success, emissiveIntensity: 0.5 })
  function rounded(width: number, height: number, depth: number, radius: number, material: Material, x = 0, y = 0, z = 0) {
    const mesh = new Mesh(new RoundedBoxGeometry(width, height, depth, 4, radius), material)
    mesh.position.set(x, y, z)
    body.add(mesh)
    return mesh
  }
  rounded(1.64, 3.48, 0.92, 0.22, plum)
  rounded(1.59, 3.38, 0.88, 0.22, shell, -0.015, 0.025, 0.055)
  rounded(1.42, 2.72, 0.12, 0.17, seam, -0.055, 0.24, 0.5)
  rounded(1.38, 2.68, 0.13, 0.17, lid, -0.065, 0.25, 0.525)
  // The outlet lips overlap the first few pixels of paper to hide the DOM/3D join.
  rounded(0.09, 3.22, 0.58, 0.04, plum, 0.795, 0, 0.01)
  rounded(0.025, SLOT_SPAN, 0.18, 0.01, black, 0.846, 0, 0.02)
  rounded(0.055, 3.13, 0.045, 0.018, seam, 0.854, 0, 0.145)
  rounded(0.055, 3.13, 0.045, 0.018, plum, 0.854, 0, -0.105)
  for (let index = 0; index < 5; index++) rounded(0.38, 0.025, 0.016, 0.008, seam, -0.3, 1.29 - index * 0.075, 0.6)
  rounded(0.38, 0.29, 0.06, 0.11, plum, 0.2, -1.28, 0.51)
  rounded(0.3, 0.22, 0.055, 0.09, button, 0.2, -1.26, 0.55)
  rounded(0.13, 0.022, 0.015, 0.008, plum, 0.2, -1.26, 0.584)
  const indicator = new Mesh(new SphereGeometry(0.039, 16, 12), led)
  indicator.position.set(-0.4, -1.27, 0.525)
  body.add(indicator)
  rounded(0.22, 0.025, 0.01, 0.008, seam, -0.4, -1.4, 0.51)
  const brand = brandTexture()
  const badge = new Mesh(new PlaneGeometry(1.14, 1.14), new MeshBasicMaterial({ map: brand, transparent: true, depthWrite: false, toneMapped: false }))
  badge.position.set(-0.08, 0.22, 0.598)
  body.add(badge)
  const shadowMap = shadowTexture()
  const shadow = new Sprite(new SpriteMaterial({ map: shadowMap, transparent: true, opacity: 0.42, depthWrite: false }))
  scene.add(shadow)

  const media = window.matchMedia('(max-width: 699px)')
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const anchor = new Vector3()
  const axis = new Vector3(0, 0, 1)
  let printing = false
  let frame = 0
  let disposed = false
  let baseX = 0
  let baseY = 0
  function render() {
    if (!disposed && !renderer.getContext().isContextLost()) renderer.render(scene, camera)
  }
  function resize() {
    if (disposed) return
    const bounds = host.getBoundingClientRect()
    const paper = outlet.getBoundingClientRect()
    if (!bounds.width || !bounds.height || !paper.width || !paper.height) return
    renderer.setSize(bounds.width, bounds.height, false)
    camera.right = bounds.width
    camera.top = bounds.height
    camera.updateProjectionMatrix()
    const vertical = media.matches
    const scale = (vertical ? paper.width : paper.height) / SLOT_SPAN
    assembly.rotation.z = vertical ? -Math.PI / 2 : 0
    assembly.scale.setScalar(scale)
    body.rotation.y = TURN
    badge.rotation.z = vertical ? Math.PI / 2 : 0
    anchor.set(0.846, 0, 0.02).applyEuler(body.rotation).applyAxisAngle(axis, assembly.rotation.z)
    const mouthX = paper.left - bounds.left + (vertical ? paper.width / 2 : 0)
    const mouthY = paper.top - bounds.top + (vertical ? 0 : paper.height / 2)
    baseX = mouthX - anchor.x * scale
    baseY = bounds.height - mouthY - anchor.y * scale
    assembly.position.set(baseX, baseY, 0)
    shadow.position.set(baseX + 5, baseY - 12, -150)
    shadow.scale.set((vertical ? 4.1 : 2.4) * scale, (vertical ? 2.4 : 4.1) * scale, 1)
    render()
  }
  function animate(time: number) {
    frame = 0
    if (!printing || disposed || reducedMotion.matches) return
    assembly.position.x = baseX + Math.sin(time * 0.065) * 0.35
    assembly.position.y = baseY + Math.sin(time * 0.09) * 0.25
    led.emissiveIntensity = 0.65 + (Math.sin(time * 0.012) + 1) * 0.65
    render()
    frame = requestAnimationFrame(animate)
  }
  function setPrinting(value: boolean) {
    printing = value
    cancelAnimationFrame(frame)
    frame = 0
    assembly.position.set(baseX, baseY, 0)
    led.emissiveIntensity = 0.5
    if (printing && !reducedMotion.matches) frame = requestAnimationFrame(animate)
    else render()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  observer.observe(outlet)
  const motionChanged = () => setPrinting(printing)
  const contextLost = (event: Event) => {
    event.preventDefault()
    cancelAnimationFrame(frame)
    host.parentElement?.setAttribute('data-renderer', 'fallback')
  }
  const contextRestored = () => {
    resize()
    host.parentElement?.setAttribute('data-renderer', 'webgl')
    setPrinting(printing)
  }
  renderer.domElement.addEventListener('webglcontextlost', contextLost)
  renderer.domElement.addEventListener('webglcontextrestored', contextRestored)
  media.addEventListener('change', resize)
  reducedMotion.addEventListener('change', motionChanged)
  resize()
  return {
    setPrinting,
    dispose() {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      media.removeEventListener('change', resize)
      reducedMotion.removeEventListener('change', motionChanged)
      renderer.domElement.removeEventListener('webglcontextlost', contextLost)
      renderer.domElement.removeEventListener('webglcontextrestored', contextRestored)
      const materials = new Set<Material>()
      scene.traverse(object => {
        if (object instanceof Mesh) {
          object.geometry.dispose()
          ;(Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material))
        } else if (object instanceof Sprite) materials.add(object.material)
      })
      materials.forEach(material => material.dispose())
      brand.dispose()
      shadowMap.dispose()
      environment.dispose()
      pmrem.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    },
  }
}

export type ReceiptPrinterScene = ReturnType<typeof createReceiptPrinterScene>
