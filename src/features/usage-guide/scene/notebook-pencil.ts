import {
  BackSide, CanvasTexture, ConeGeometry, CylinderGeometry, FrontSide, Group, InstancedMesh, Mesh,
  MeshStandardMaterial, Object3D, PlaneGeometry, BoxGeometry, Quaternion, SRGBColorSpace, TorusGeometry, Vector3,
} from 'three'
import { easeInOutCubic, GUIDE_COLORS, smoothstep } from '../guide-timeline'

const PAGE_W = 0.42
const PAGE_H = 0.56
/** The two halves meet in a shallow V towards the viewer. */
const OPEN = 0.16
const TEXTURE_W = 256
const TEXTURE_H = Math.round((TEXTURE_W * PAGE_H) / PAGE_W)
const RULE_TOP = 46
const RULE_GAP = 22
const LINES_PER_PAGE = 3
const LINE_SECONDS = 3.2
const LIFT_SECONDS = 0.45
const FLIP_SECONDS = 1.5

function ruledPaper(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = GUIDE_COLORS.paper
  ctx.fillRect(0, 0, TEXTURE_W, TEXTURE_H)
  ctx.strokeStyle = 'rgba(124, 92, 255, 0.22)'
  ctx.lineWidth = 1.5
  for (let y = RULE_TOP; y < TEXTURE_H - 18; y += RULE_GAP) {
    ctx.beginPath()
    ctx.moveTo(14, y)
    ctx.lineTo(TEXTURE_W - 14, y)
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(185, 166, 255, 0.55)'
  ctx.beginPath()
  ctx.moveTo(34, 0)
  ctx.lineTo(34, TEXTURE_H)
  ctx.stroke()
}

function paperTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = TEXTURE_W
  canvas.height = TEXTURE_H
  const ctx = canvas.getContext('2d')!
  ruledPaper(ctx)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return { canvas, ctx, texture }
}

/** Cursive-looking loops along one ruled line; `t` in [0, 1] runs from the margin to the right edge. */
function scribble(line: number, t: number) {
  const phase = t * 46
  const u = 0.17 + t * 0.68 + Math.sin(phase) * 0.012
  const v = (RULE_TOP + RULE_GAP * (line + 1) - 7) / TEXTURE_H + (Math.cos(phase) * 0.011 + Math.sin(t * 19) * 0.004)
  return { u, v }
}

function pencil() {
  const group = new Group()
  const part = (geometry: CylinderGeometry | ConeGeometry, color: string, y: number, extra: Partial<MeshStandardMaterial> = {}) => {
    const mesh = new Mesh(geometry, new MeshStandardMaterial({ color, roughness: 0.45, ...extra }))
    mesh.position.y = y
    group.add(mesh)
    return mesh
  }
  // Built tip-down from the origin so the tip can be placed straight on the page.
  part(new ConeGeometry(0.006, 0.018, 6), '#2B2833', 0.009, { roughness: 0.3, metalness: 0.4 }).rotation.x = Math.PI
  part(new ConeGeometry(0.021, 0.07, 6), '#E9CFA4', 0.047, { roughness: 0.8 }).rotation.x = Math.PI
  part(new CylinderGeometry(0.021, 0.021, 0.18, 6), GUIDE_COLORS.purple, 0.172)
  part(new CylinderGeometry(0.021, 0.021, 0.18, 6), GUIDE_COLORS.lavender, 0.352)
  part(new CylinderGeometry(0.0225, 0.0225, 0.035, 18), '#D9D6E4', 0.4595, { metalness: 0.9, roughness: 0.25 })
  part(new CylinderGeometry(0.02, 0.02, 0.04, 18), '#EDE6FF', 0.497, { roughness: 0.8 })
  return group
}

/**
 * An open spiral notebook with a two-tone pencil that writes loops on the right page and now and then turns
 * the page. Everything is plain three.js geometry; the writing is drawn into a small canvas texture.
 */
export function createNotebookPencil() {
  const group = new Group()
  const coverMaterial = new MeshStandardMaterial({ color: GUIDE_COLORS.purple, roughness: 0.55 })
  const blockMaterial = new MeshStandardMaterial({ color: '#E9E4FA', roughness: 0.9 })
  const ruled = paperTexture()
  const writing = paperTexture()
  const flipped = paperTexture()

  const half = (side: 1 | -1, texture: CanvasTexture) => {
    const pivot = new Group()
    pivot.rotation.y = -side * OPEN
    const cover = new Mesh(new BoxGeometry(PAGE_W + 0.02, PAGE_H + 0.02, 0.012), coverMaterial)
    cover.position.set(side * (PAGE_W / 2 + 0.008), 0, -0.016)
    const block = new Mesh(new BoxGeometry(PAGE_W, PAGE_H, 0.008), blockMaterial)
    block.position.set(side * (PAGE_W / 2 + 0.004), 0, -0.005)
    const page = new Mesh(new PlaneGeometry(PAGE_W, PAGE_H), new MeshStandardMaterial({ map: texture, roughness: 0.95 }))
    page.position.set(side * (PAGE_W / 2 + 0.004), 0, 0.0002)
    pivot.add(cover, block, page)
    group.add(pivot)
    return pivot
  }
  half(-1, ruled.texture)
  const right = half(1, writing.texture)

  const rings = new InstancedMesh(
    new TorusGeometry(0.024, 0.0045, 8, 20),
    new MeshStandardMaterial({ color: '#DAD4F0', metalness: 0.85, roughness: 0.3 }),
    10,
  )
  const holder = new Object3D()
  for (let i = 0; i < 10; i++) {
    holder.position.set(0, -PAGE_H / 2 + 0.04 + (i * (PAGE_H - 0.08)) / 9, -0.004)
    holder.rotation.set(Math.PI / 2, 0, 0)
    holder.updateMatrix()
    rings.setMatrixAt(i, holder.matrix)
  }
  group.add(rings)

  // The turning page: hinged at the spine (x = 0), written side in front, blank ruled back.
  const flipGeometry = new PlaneGeometry(PAGE_W, PAGE_H, 16, 1)
  flipGeometry.translate(PAGE_W / 2 + 0.004, 0, 0)
  const flatX = Float32Array.from(flipGeometry.attributes.position!.array as Float32Array)
  const flip = new Group()
  flip.add(
    new Mesh(flipGeometry, new MeshStandardMaterial({ map: flipped.texture, roughness: 0.95, side: FrontSide })),
    new Mesh(flipGeometry, new MeshStandardMaterial({ map: ruled.texture, roughness: 0.95, side: BackSide })),
  )
  flip.visible = false
  group.add(flip)

  const pen = pencil()
  right.add(pen)
  const lean = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(0.5, -0.35, 0.9).normalize())
  const wobble = new Quaternion()
  const axisZ = new Vector3(0, 0, 1)

  const pagePoint = (u: number, v: number, lift: number) =>
    pen.position.set(0.004 + u * PAGE_W, (0.5 - v) * PAGE_H, 0.003 + lift)

  let line = 0
  let phase: 'write' | 'lift' | 'flip' = 'write'
  let clock = 0
  let lastInk: { x: number; y: number } | null = null

  function ink(u: number, v: number) {
    const x = u * TEXTURE_W
    const y = v * TEXTURE_H
    if (lastInk) {
      const ctx = writing.ctx
      ctx.strokeStyle = GUIDE_COLORS.ink
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(lastInk.x, lastInk.y)
      ctx.lineTo(x, y)
      ctx.stroke()
      writing.texture.needsUpdate = true
    }
    lastInk = { x, y }
  }

  function bendFlip(t: number) {
    const position = flipGeometry.attributes.position!
    const array = position.array as Float32Array
    const lift = Math.sin(Math.PI * t)
    for (let i = 0; i < position.count; i++) {
      const x = flatX[i * 3]!
      const edge = x / (PAGE_W + 0.004)
      // The free edge trails behind the hinge, so the sheet curls instead of swinging like a board.
      array[i * 3 + 2] = -0.09 * edge * edge * lift
    }
    position.needsUpdate = true
    flip.rotation.y = -OPEN - (Math.PI - 2 * OPEN) * easeInOutCubic(t)
  }

  function startFlip() {
    flipped.ctx.drawImage(writing.canvas, 0, 0)
    flipped.texture.needsUpdate = true
    ruledPaper(writing.ctx)
    writing.texture.needsUpdate = true
    flip.visible = true
    bendFlip(0)
  }

  /** Advances the writing and page turning by `dt` seconds. */
  function update(time: number, dt: number) {
    clock += Math.min(dt, 0.1)
    let lift = 0
    if (phase === 'write') {
      const t = Math.min(1, clock / LINE_SECONDS)
      const { u, v } = scribble(line, t)
      ink(u, v)
      pagePoint(u, v, 0)
      if (t >= 1) {
        phase = 'lift'
        clock = 0
        lastInk = null
      }
    } else if (phase === 'lift') {
      const t = Math.min(1, clock / LIFT_SECONDS)
      const nextLine = line + 1 < LINES_PER_PAGE ? line + 1 : 0
      const from = scribble(line, 1)
      const to = scribble(nextLine, 0)
      lift = Math.sin(Math.PI * t) * 0.05
      pagePoint(from.u + (to.u - from.u) * smoothstep(t), from.v + (to.v - from.v) * smoothstep(t), lift)
      if (t >= 1) {
        clock = 0
        if (line + 1 < LINES_PER_PAGE) {
          line += 1
          phase = 'write'
        } else {
          phase = 'flip'
          startFlip()
        }
      }
    } else {
      const t = Math.min(1, clock / FLIP_SECONDS)
      bendFlip(t)
      // The pencil steps back off the page while it turns.
      const start = scribble(0, 0)
      lift = 0.06 + Math.sin(Math.PI * t) * 0.1
      pagePoint(start.u + 0.25 * Math.sin(Math.PI * t), start.v, lift)
      if (t >= 1) {
        flip.visible = false
        line = 0
        phase = 'write'
        clock = 0
      }
    }
    wobble.setFromAxisAngle(axisZ, Math.sin(time * 9) * 0.05 * (lift ? 0.3 : 1))
    pen.quaternion.copy(lean).premultiply(wobble)
  }

  return { group, update }
}
