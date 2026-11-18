import {
  AdditiveBlending, AgXToneMapping, BoxGeometry, CanvasTexture, CylinderGeometry, DirectionalLight, Group,
  HemisphereLight, InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial, NoBlending, Object3D,
  PerspectiveCamera, PlaneGeometry, PMREMGenerator, PointLight, Scene, SRGBColorSpace, TorusGeometry, Vector3,
  WebGLRenderer,
} from 'three'
import type { Material, Texture } from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { designColors } from '@/shared/design/tokens'
import { createCapsuleHalves } from '@/features/reports/capsule-shell'
import { GUIDE, GUIDE_COLORS, type GuidePose } from '../guide-timeline'
import { createNotebookPencil } from './notebook-pencil'
import type { Quad } from './screen-projection'

const BEZEL = 0.018
const CHIN = 0.04
const NECK = 0.2
/** Depth in front of the camera where the notebook and pencil float. */
const FLOAT_DEPTH = 3
const SCREEN_LIGHT = 2.4

function glowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(124, 92, 255, 0.55)')
  gradient.addColorStop(0.5, 'rgba(124, 92, 255, 0.16)')
  gradient.addColorStop(1, 'rgba(124, 92, 255, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

/**
 * A desk with a monitor, keyboard, mug, books and a capsule pill, plus a floating notebook and pencil.
 * The canvas is opaque except the monitor screen, which writes transparent pixels so the picture placed behind the
 * canvas shows through it; `screenQuad` reports where that hole is so the picture can be fitted to it.
 */
export function createGuideScene(canvas: HTMLCanvasElement) {
  // three.js needs WebGL2; without it this throws and the intro falls back to the 2D version.
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  renderer.toneMapping = AgXToneMapping
  renderer.toneMappingExposure = 1.15
  // Clear colours skip tone mapping, so this matches the page background exactly.
  renderer.setClearColor(designColors.canvas, 1)

  const scene = new Scene()
  const pmrem = new PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const environment = pmrem.fromScene(room, 0.04).texture
  room.dispose()
  scene.environment = environment
  scene.environmentIntensity = 0.35

  const camera = new PerspectiveCamera(GUIDE.fov, 1, 0.05, 40)
  scene.add(camera)
  scene.add(new HemisphereLight(0xc9bcff, 0x0f0e17, 0.7))
  const key = new DirectionalLight(0xfff3ea, 1.7)
  key.position.set(2.2, 3, 3)
  const rim = new DirectionalLight(0xb9a6ff, 1.2)
  rim.position.set(-3, 1.5, -2)
  scene.add(key, rim)

  // The desk turns around a pivot in front of it, so it sweeps in from the right like a wall of a room.
  const pivot = new Group()
  pivot.position.z = GUIDE.pivotRadius
  const rig = new Group()
  rig.position.z = -GUIDE.pivotRadius
  pivot.add(rig)
  scene.add(pivot)

  const dark = new MeshStandardMaterial({ color: '#1C1A24', roughness: 0.5, metalness: 0.35 })
  const deskMaterial = new MeshStandardMaterial({ color: '#2A2534', roughness: 0.75 })
  const screenH = GUIDE.screenHeight
  const bodyBottom = -screenH / 2 - BEZEL - CHIN
  const deskY = bodyBottom - NECK

  // The screen writes (0, 0, 0, 0) without blending: a see-through hole that still occludes what is behind it.
  const screen = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ color: 0x000000, opacity: 0, blending: NoBlending }))
  const body = new Mesh(new BoxGeometry(1, 1, 1), dark)
  const neck = new Mesh(new BoxGeometry(0.08, NECK, 0.05), dark)
  neck.position.set(0, bodyBottom - NECK / 2, -0.08)
  const base = new Mesh(new BoxGeometry(0.36, 0.014, 0.2), dark)
  base.position.set(0, deskY + 0.007, -0.08)
  const screenLight = new PointLight(0x9d86ff, SCREEN_LIGHT, 2.6, 2)
  screenLight.position.set(0, -0.1, 0.45)
  const glowMaterial = new MeshBasicMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: AdditiveBlending })
  const glow = new Mesh(new PlaneGeometry(1, 1), glowMaterial)
  glow.position.z = -0.35
  rig.add(screen, body, neck, base, screenLight, glow)

  const desk = new Mesh(new BoxGeometry(1, 0.05, 1.5), deskMaterial)
  desk.position.set(0, deskY - 0.025, 0.25)
  const keyboard = new Mesh(new BoxGeometry(0.62, 0.016, 0.2), dark)
  keyboard.position.set(-0.02, deskY + 0.008, 0.45)
  const keys = new InstancedMesh(new BoxGeometry(0.036, 0.008, 0.034), new MeshStandardMaterial({ color: '#34303F', roughness: 0.6 }), 56)
  const holder = new Object3D()
  for (let row = 0; row < 4; row++) {
    for (let column = 0; column < 14; column++) {
      holder.position.set(-0.02 - 0.273 + column * 0.042, deskY + 0.02, 0.45 - 0.063 + row * 0.042)
      holder.updateMatrix()
      keys.setMatrixAt(row * 14 + column, holder.matrix)
    }
  }
  const mug = new Group()
  const mugMaterial = new MeshStandardMaterial({ color: GUIDE_COLORS.lavender, roughness: 0.4 })
  const cup = new Mesh(new CylinderGeometry(0.055, 0.05, 0.12, 24), mugMaterial)
  cup.position.y = 0.06
  const handle = new Mesh(new TorusGeometry(0.032, 0.009, 8, 16, Math.PI), mugMaterial)
  handle.position.set(0.056, 0.062, 0)
  handle.rotation.z = -Math.PI / 2
  mug.add(cup, handle)
  const books = new Group()
  ;[
    { w: 0.42, h: 0.05, d: 0.3, color: '#3A3150', y: 0.025 },
    { w: 0.38, h: 0.045, d: 0.27, color: GUIDE_COLORS.purple, y: 0.0725 },
  ].forEach(({ w, h, d, color, y }, i) => {
    const book = new Mesh(new BoxGeometry(w, h, d), new MeshStandardMaterial({ color, roughness: 0.7 }))
    book.position.y = y
    book.rotation.y = i * 0.18
    books.add(book)
  })
  const { cap, body: pillBody } = createCapsuleHalves(GUIDE_COLORS.purple, GUIDE_COLORS.lavender)
  const pill = new Group()
  pill.add(cap.group, pillBody.group)
  pill.scale.setScalar(0.07)
  pill.rotation.set(0, 0.5, Math.PI / 2)
  rig.add(desk, keyboard, keys, mug, books, pill)

  const notebook = createNotebookPencil()
  const float = new Group()
  float.add(notebook.group)
  camera.add(float)

  let width = 1
  let height = 1
  /** Layout pieces whose size follows the viewport aspect, because the screen must match the viewport. */
  function setSize(nextWidth: number, nextHeight: number) {
    width = Math.max(1, nextWidth)
    height = Math.max(1, nextHeight)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    // A lens shift, not a turn: the whole picture slides right to leave the left side for the copy.
    camera.setViewOffset(width, height, -GUIDE.sceneShift * width, 0, width, height)
    camera.updateProjectionMatrix()
    const screenW = screenH * camera.aspect
    screen.scale.set(screenW, screenH, 1)
    body.scale.set(screenW + BEZEL * 2, screenH + BEZEL * 2 + CHIN, 0.045)
    body.position.set(0, -CHIN / 2, -0.0235)
    glow.scale.set(screenW * 2.4, screenH * 3.2, 1)
    desk.scale.x = screenW + 2.4
    mug.position.set(screenW / 2 + 0.2, deskY, 0.32)
    books.position.set(-screenW / 2 - 0.42, deskY, 0.1)
    pill.position.set(-screenW / 2 - 0.08, deskY + 0.024, 0.5)
  }

  const pointer = { x: 0, y: 0 }
  /** Applies a pose; `target` is the pointer in [-1, 1] on both axes. */
  function update(pose: GuidePose, time: number, dt: number, target: { x: number; y: number }) {
    // Positive yaw starts the desk off to the right, so the scene turns left as it settles.
    pivot.rotation.y = -pose.yaw
    camera.position.set(0, pose.cameraHeight, pose.cameraDistance)
    camera.lookAt(0, 0, 0)
    // The monitor's own glow fades with its picture while the notebook has the stage.
    screenLight.intensity = SCREEN_LIGHT * (1 - pose.screenDim)
    glowMaterial.opacity = 1 - pose.screenDim

    const follow = 1 - Math.exp(-4 * Math.min(dt, 0.1))
    pointer.x += (target.x - pointer.x) * follow
    pointer.y += (target.y - pointer.y) * follow
    const halfH = FLOAT_DEPTH * Math.tan((GUIDE.fov * Math.PI) / 360)
    const halfW = halfH * camera.aspect
    // Idle bob, a lean toward the pointer and the scroll pose layered together.
    float.position.set(
      pose.floatX * halfW + pointer.x * 0.08,
      pose.floatY * halfH + Math.sin(time * 0.9) * 0.05 - pointer.y * 0.05,
      -FLOAT_DEPTH,
    )
    float.rotation.set(-0.55 + Math.sin(time * 0.7) * 0.04 + pointer.y * 0.18, pose.floatTurn + pointer.x * 0.3, Math.sin(time * 0.5) * 0.05)
    float.scale.setScalar(pose.floatScale)
    notebook.update(time, dt)
  }

  const corner = new Vector3()
  const corners: [number, number][] = [[-0.5, 0.5], [0.5, 0.5], [0.5, -0.5], [-0.5, -0.5]]
  /** The monitor screen's corners in canvas pixels: top left, top right, bottom right, bottom left. */
  function screenQuad(): Quad {
    scene.updateMatrixWorld()
    camera.updateMatrixWorld()
    return corners.map(([x, y]) => {
      corner.set(x, y, 0)
      screen.localToWorld(corner).project(camera)
      return [((corner.x + 1) / 2) * width, ((1 - corner.y) / 2) * height] as const
    }) as unknown as Quad
  }

  function render() {
    renderer.render(scene, camera)
  }

  function dispose() {
    const materials = new Set<Material>()
    scene.traverse((object) => {
      if (object instanceof Mesh || object instanceof InstancedMesh) {
        object.geometry.dispose()
        ;(Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => materials.add(material))
      }
    })
    materials.forEach((material) => {
      ;(material as Material & { map?: Texture | null }).map?.dispose()
      material.dispose()
    })
    environment.dispose()
    pmrem.dispose()
    renderer.dispose()
    // Hand the WebGL context back now rather than whenever the canvas is collected; browsers cap live contexts.
    renderer.forceContextLoss()
  }

  return { setSize, update, screenQuad, render, dispose }
}

export type GuideScene = ReturnType<typeof createGuideScene>
