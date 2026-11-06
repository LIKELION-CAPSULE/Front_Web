import { CanvasTexture, Color, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, Vector3 } from 'three'
import type { Group } from 'three'
import type { PreparePaper } from './prepare-paper-snapshot'
import { dotFlight, DOT_BURST_MS, DOT_CLEAR_MS, DOT_FORM_START_MS, ease, prepareFormLayout, seededRandom, type DotRoute } from './prepare-capsule-motion'
import { prepareHalftoneProgress, prepareHalftoneReveal, preparePosterBounds } from './prepare-halftone'
import { designColors } from '@/shared/design/tokens'

/** Poster-colored halftone circles share one draw call, then follow individual ballistic/curved routes. */
export function createPrepareDots(paper: PreparePaper, poster: HTMLImageElement | null, width: number, height: number, seed: number) {
  const random = seededRandom(seed)
  const budget = width < 600 || navigator.hardwareConcurrency <= 4 ? 1100 : 2200
  const originalColumns = Math.max(12, Math.round(Math.sqrt(budget * paper.bounds.width / paper.bounds.height)))
  const originalRows = Math.max(12, Math.round(budget / originalColumns))
  const layout = prepareFormLayout(width, height, paper.bounds.width, paper.bounds.height)
  // Preserve the small screen-space circles while the form now remains at its original size.
  const density = 2 * layout.scale / layout.baselineScale
  const wantedColumns = originalColumns * density, wantedRows = originalRows * density
  const limit = width < 600 || navigator.hardwareConcurrency <= 4 ? 6000 : 12000
  const quality = Math.min(1, Math.sqrt(limit / (wantedColumns * wantedRows)))
  const columns = Math.max(12, Math.floor(wantedColumns * quality))
  const rows = Math.max(12, Math.floor(wantedRows * quality))
  const stepX = paper.bounds.width / columns, stepY = paper.bounds.height / rows
  const radiusStep = Math.min(paper.bounds.width / wantedColumns, paper.bounds.height / wantedRows)
  function sample(source: CanvasImageSource, sourceWidth: number, sourceHeight: number) {
    const canvas = document.createElement('canvas')
    canvas.width = columns; canvas.height = rows
    const context = canvas.getContext('2d', { willReadFrequently: true })!
    context.fillStyle = designColors.panel
    context.fillRect(0, 0, columns, rows)
    const fit = preparePosterBounds(sourceWidth, sourceHeight, paper.bounds.width, paper.bounds.height)
    context.drawImage(source, fit.x / paper.bounds.width * columns, fit.y / paper.bounds.height * rows, fit.width / paper.bounds.width * columns, fit.height / paper.bounds.height * rows)
    return context.getImageData(0, 0, columns, rows).data
  }
  let pixels: Uint8ClampedArray
  let sampledPoster = false
  try {
    if (!poster) throw new Error('No readable poster')
    pixels = sample(poster, poster.naturalWidth, poster.naturalHeight)
    sampledPoster = true
  } catch { pixels = sample(paper.canvas, paper.canvas.width, paper.canvas.height) }

  const cells: { local: Vector3; u: number; v: number; radius: number; growth: number; scatterX: number; scatterY: number; depth: number; route: DotRoute; target: Vector3; approach: Vector3; initialized: boolean }[] = []
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
      u: x / paper.bounds.width, v: y / paper.bounds.height,
      radius: radiusStep * (.2 + .27 * Math.sqrt(luminance)),
      growth: .85 + random() * .35,
      scatterX: (random() - .5) * width * .96,
      scatterY: (random() - .5) * height * .94,
      depth: .95 + random() * .12,
      route: { origin: { x: 0, y: 0, z: 0 }, scatter: { x: 0, y: 0, z: 0 }, delay: random() * 200, scatterMs: 700 + random() * 250, flightMs: 1600 + random() * 300 },
      target: new Vector3((random() - .5) * .18, -.42 - random() * .16, (random() - .5) * .18),
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
  const material = new MeshBasicMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false, alphaTest: .02, toneMapped: false, opacity: 0 })
  const reveals = new InstancedBufferAttribute(new Float32Array(cells.length), 1).setUsage(DynamicDrawUsage)
  const intakes = new InstancedBufferAttribute(new Float32Array(cells.length), 1).setUsage(DynamicDrawUsage)
  const geometry = new PlaneGeometry(1, 1)
  geometry.setAttribute('prepareReveal', reveals)
  geometry.setAttribute('prepareIntake', intakes)
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute float prepareReveal;\nattribute float prepareIntake;\nvarying float vPrepareReveal;\nvarying float vPrepareIntake;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPrepareReveal = prepareReveal;\nvPrepareIntake = prepareIntake;')
    shader.fragmentShader = 'varying float vPrepareReveal;\nvarying float vPrepareIntake;\n' + shader.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vPrepareReveal;')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragDepth = mix(1.0, gl_FragCoord.z, vPrepareIntake);')
  }
  material.customProgramCacheKey = () => 'prepare-steady-halftone-cavity-v2'
  const mesh = new InstancedMesh(geometry, material, cells.length)
  mesh.instanceMatrix.setUsage(DynamicDrawUsage)
  mesh.frustumCulled = false
  cells.forEach((_, index) => mesh.setColorAt(index, colors[index]!))
  const matrix = new Matrix4(), inverse = new Matrix4(), origin = new Vector3(), scatter = new Vector3(), position = new Vector3()
  const normal = new Vector3(), planePoint = new Vector3()
  const cameraDistance = height / (2 * Math.tan(35 * Math.PI / 360))
  // Intersect a screen ray with a plane in front of the capsule. Every screen quadrant is available,
  // while all scatter positions remain outside the solid shell, regardless of the capsule's tilt.
  function onPlane(point: Vector3, screenX: number, screenY: number, depth: number, capsule: Group) {
    planePoint.set(0, 0, depth).applyMatrix4(capsule.matrixWorld)
    const distance = normal.x * planePoint.x + normal.y * planePoint.y + normal.z * (planePoint.z - cameraDistance)
    const ray = distance / (normal.x * screenX + normal.y * screenY - normal.z * cameraDistance)
    return point.set(screenX * ray, screenY * ray, cameraDistance * (1 - ray))
  }
  return {
    mesh, sampledPoster, count: cells.length, pitchRatio: layout.scale / layout.baselineScale * originalColumns / columns,
    update(elapsed: number, form: Group, capsule: Group) {
      const formation = prepareHalftoneProgress(elapsed)
      material.opacity = 1
      mesh.visible = elapsed >= DOT_FORM_START_MS && elapsed < DOT_CLEAR_MS
      if (!mesh.visible) return
      form.updateMatrixWorld(true); capsule.updateMatrixWorld(true)
      inverse.copy(capsule.matrixWorld).invert()
      normal.set(0, 0, 1).transformDirection(capsule.matrixWorld)
      for (let index = 0; index < cells.length; index++) {
        const cell = cells[index]!, route = cell.route
        if (elapsed < DOT_BURST_MS || !cell.initialized) {
          origin.copy(cell.local).applyMatrix4(form.matrixWorld)
          onPlane(origin, origin.x, origin.y, cell.depth, capsule)
        }
        if (elapsed >= DOT_BURST_MS && !cell.initialized) {
          onPlane(scatter, cell.scatterX, cell.scatterY, cell.depth, capsule).applyMatrix4(inverse)
          origin.applyMatrix4(inverse)
          Object.assign(route.origin, origin)
          Object.assign(route.scatter, scatter)
          cell.initialized = true
        }
        const point = elapsed >= DOT_BURST_MS ? dotFlight(route, elapsed, cell.target, cell.approach) : { ...origin, size: 1 }
        position.set(point.x, point.y, point.z)
        if (elapsed >= DOT_BURST_MS) position.applyMatrix4(capsule.matrixWorld)
        const burst = ease((elapsed - DOT_BURST_MS - route.delay) / 180)
        const perspective = Math.max(.05, (cameraDistance - position.z) / cameraDistance)
        const reveal = elapsed < DOT_BURST_MS ? prepareHalftoneReveal(formation, cell.u, cell.v) : 1
        // A steady, uniform grid fades along the diagonal instead of thousands of circles growing.
        // Blend back to the existing varied particle sizes only as the accepted burst begins.
        const formedRadius = radiusStep * .3
        const radius = (formedRadius + (cell.radius * cell.growth - formedRadius) * burst) * point.size * perspective * (reveal > 0 ? 1 : 0)
        reveals.setX(index, reveal)
        // Keep the poster and scatter behind even the cavity walls. Restore physical depth only
        // at the gate joining the first gather curve to the approach to the mouth (flight progress .45).
        intakes.setX(index, elapsed - DOT_BURST_MS - route.delay >= route.scatterMs + route.flightMs * .45 ? 1 : 0)
        matrix.makeScale(radius * 2, radius * 2, 1).setPosition(position)
        mesh.setMatrixAt(index, matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
      reveals.needsUpdate = true
      intakes.needsUpdate = true
    },
    dispose() { texture.dispose(); mesh.dispose() },
    formation: prepareHalftoneProgress,
  }
}
