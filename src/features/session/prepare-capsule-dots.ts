import { CanvasTexture, Color, DynamicDrawUsage, InstancedMesh, Matrix4, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, Vector3 } from 'three'
import type { Group } from 'three'
import type { PreparePaper } from './prepare-paper-snapshot'
import { dotFlight, DOT_BURST_MS, DOT_CLEAR_MS, ease, prepareFormLayout, seededRandom, type DotRoute } from './prepare-capsule-motion'

/** Poster-colored halftone circles share one draw call, then follow individual ballistic/curved routes. */
export function createPrepareDots(paper: PreparePaper, poster: HTMLImageElement | null, width: number, height: number, seed: number) {
  const random = seededRandom(seed)
  const budget = width < 600 || navigator.hardwareConcurrency <= 4 ? 1100 : 2200
  const originalColumns = Math.max(12, Math.round(Math.sqrt(budget * paper.bounds.width / paper.bounds.height)))
  const originalRows = Math.max(12, Math.round(budget / originalColumns))
  const layout = prepareFormLayout(width, height, paper.bounds.width, paper.bounds.height)
  // Half the previous screen-space pitch/radius; account for the fixed panel's smaller display area.
  const density = 2 * layout.scale / layout.baselineScale
  const columns = Math.max(12, Math.round(originalColumns * density))
  const rows = Math.max(12, Math.round(originalRows * density))
  const stepX = paper.bounds.width / columns, stepY = paper.bounds.height / rows
  function sample(source: CanvasImageSource, sourceWidth: number, sourceHeight: number) {
    const canvas = document.createElement('canvas')
    canvas.width = columns; canvas.height = rows
    const context = canvas.getContext('2d', { willReadFrequently: true })!
    const cover = Math.max(columns / sourceWidth, rows / sourceHeight)
    context.drawImage(source, (columns - sourceWidth * cover) / 2, (rows - sourceHeight * cover) / 2, sourceWidth * cover, sourceHeight * cover)
    return context.getImageData(0, 0, columns, rows).data
  }
  let pixels: Uint8ClampedArray
  let sampledPoster = false
  try {
    if (!poster) throw new Error('No readable poster')
    pixels = sample(poster, poster.naturalWidth, poster.naturalHeight)
    sampledPoster = true
  } catch { pixels = sample(paper.canvas, paper.canvas.width, paper.canvas.height) }

  const cells: { local: Vector3; radius: number; growth: number; scatterAngle: number; scatterDistance: number; scatterDepth: number; route: DotRoute; target: Vector3; approach: Vector3; initialized: boolean }[] = []
  const colors: Color[] = []
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const x = (column + .5) * stepX, y = (row + .5) * stepY
    const cornerX = Math.max(0, 24 - Math.min(x, paper.bounds.width - x))
    const cornerY = Math.max(0, 24 - Math.min(y, paper.bounds.height - y))
    if (cornerX ** 2 + cornerY ** 2 > 24 ** 2) continue
    const offset = (row * columns + column) * 4
    const r = pixels[offset]! / 255, g = pixels[offset + 1]! / 255, b = pixels[offset + 2]! / 255
    const luminance = r * .2126 + g * .7152 + b * .0722
    colors.push(new Color().setRGB(r, g, b, SRGBColorSpace).lerp(new Color('#d9d5ce'), .09))
    cells.push({
      local: new Vector3(x - paper.bounds.width / 2, paper.bounds.height / 2 - y, 0),
      radius: Math.min(stepX, stepY) * (.2 + .27 * Math.sqrt(luminance)),
      growth: .7 + random() * 1.25,
      scatterAngle: Math.atan2(paper.bounds.height / 2 - y, x - paper.bounds.width / 2) + (random() - .5) * 1.7,
      scatterDistance: Math.min(width, height) * (.15 + random() * .24),
      scatterDepth: 70 + random() * 150,
      route: { origin: { x: 0, y: 0, z: 0 }, scatter: { x: 0, y: 0, z: 0 }, delay: random() * 140, scatterMs: 360 + random() * 140, flightMs: 850 + random() * 200 },
      target: new Vector3((random() - .5) * .18, -.16, (random() - .5) * .18),
      approach: new Vector3(random() * .08, (random() - .5) * .16, (random() - .5) * .1),
      initialized: false,
    })
  }
  const circle = document.createElement('canvas')
  circle.width = circle.height = 64
  const ink = circle.getContext('2d')!
  const edge = ink.createRadialGradient(32, 32, 0, 32, 32, 32)
  edge.addColorStop(0, '#fff'); edge.addColorStop(.78, '#fff'); edge.addColorStop(.9, '#ffffffcc'); edge.addColorStop(1, '#ffffff00')
  ink.fillStyle = edge; ink.fillRect(0, 0, 64, 64)
  const texture = new CanvasTexture(circle)
  const material = new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false, opacity: 0 })
  const mesh = new InstancedMesh(new PlaneGeometry(1, 1), material, cells.length)
  mesh.instanceMatrix.setUsage(DynamicDrawUsage)
  mesh.frustumCulled = false
  cells.forEach((_, index) => mesh.setColorAt(index, colors[index]!))
  const matrix = new Matrix4(), inverse = new Matrix4(), origin = new Vector3(), scatter = new Vector3(), position = new Vector3()
  return {
    mesh, sampledPoster, count: cells.length, pitchRatio: layout.scale / layout.baselineScale * originalColumns / columns,
    update(elapsed: number, form: Group, capsule: Group) {
      const formation = ease((elapsed - 850) / 1000)
      material.opacity = formation
      mesh.visible = elapsed >= 850 && elapsed < DOT_CLEAR_MS
      if (!mesh.visible) return
      form.updateMatrixWorld(true); capsule.updateMatrixWorld(true)
      inverse.copy(capsule.matrixWorld).invert()
      for (let index = 0; index < cells.length; index++) {
        const cell = cells[index]!, route = cell.route
        origin.copy(cell.local).applyMatrix4(form.matrixWorld)
        if (elapsed >= DOT_BURST_MS && !cell.initialized) {
          scatter.set(
            Math.max(-width * .46, Math.min(width * .46, origin.x + Math.cos(cell.scatterAngle) * cell.scatterDistance)),
            Math.max(-height * .44, Math.min(-height * .08, origin.y + Math.sin(cell.scatterAngle) * cell.scatterDistance)),
            cell.scatterDepth,
          ).applyMatrix4(inverse)
          origin.applyMatrix4(inverse)
          Object.assign(route.origin, origin)
          const tangent = route.flightMs * .65 / (3 * route.scatterMs)
          scatter.x = Math.max(.4, (.4 + tangent * origin.x) / (1 + tangent), scatter.x)
          Object.assign(route.scatter, scatter)
          cell.initialized = true
        }
        const point = elapsed >= DOT_BURST_MS ? dotFlight(route, elapsed, cell.target, cell.approach) : { ...origin, size: 1 }
        position.set(point.x, point.y, point.z)
        if (elapsed >= DOT_BURST_MS) position.applyMatrix4(capsule.matrixWorld)
        const burst = ease((elapsed - DOT_BURST_MS - route.delay) / 180)
        const radius = cell.radius * form.scale.x * point.size * (1 + (cell.growth - 1) * burst)
        matrix.makeScale(radius * 2, radius * 2, 1).setPosition(position)
        mesh.setMatrixAt(index, matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    },
    dispose() { texture.dispose(); mesh.dispose() },
    formation: (elapsed: number) => ease((elapsed - 850) / 1000),
  }
}
