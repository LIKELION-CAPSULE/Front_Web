import * as THREE from 'three'

export interface RoundedPolylineSpec {
  /** Waypoints in 2D (world units before scale). */
  points: ReadonlyArray<readonly [number, number]>
  /** Corner fillet radius for rounded polylines. */
  cornerRadius: number
  /** Number of parallel concentric tracks/layers in this bundle (1..8). */
  tracks?: number
  /** Offset direction multiplier (+1 or -1) for multi-track bundles. */
  offsetSign?: 1 | -1
  /** Optional Z depth bias so foreground ribbons can weave slightly in front of hidden wordmark strokes. */
  zBias?: number
  /** When true, uses a sweeping Catmull-Rom spline instead of orthogonal fillets (macOS silk ribbon wave). */
  smooth?: boolean
}

/**
 * Offsets a 2D polyline perpendicularly by `dist` with clean miter joins,
 * so parallel tracks stay evenly spaced and turn concentrically around every corner.
 */
function offsetPolyline2D(
  pts: ReadonlyArray<readonly [number, number]>,
  dist: number,
): Array<[number, number]> {
  if (Math.abs(dist) < 1e-5 || pts.length < 2) {
    return pts.map(([x, y]) => [x, y])
  }

  const segNormals: Array<[number, number]> = []
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i + 1]![0] - pts[i]![0]
    const dy = pts[i + 1]![1] - pts[i]![1]
    const len = Math.hypot(dx, dy) || 1
    // Left-hand perpendicular normal
    segNormals.push([-dy / len, dx / len])
  }

  const out: Array<[number, number]> = []
  for (let i = 0; i < pts.length; i++) {
    const [px, py] = pts[i]!
    if (i === 0) {
      const [nx, ny] = segNormals[0]!
      out.push([px + nx * dist, py + ny * dist])
    } else if (i === pts.length - 1) {
      const [nx, ny] = segNormals[segNormals.length - 1]!
      out.push([px + nx * dist, py + ny * dist])
    } else {
      const [n1x, n1y] = segNormals[i - 1]!
      const [n2x, n2y] = segNormals[i]!
      const bx = n1x + n2x
      const by = n1y + n2y
      const bLen = Math.hypot(bx, by)
      if (bLen < 1e-4) {
        out.push([px + n1x * dist, py + n1y * dist])
      } else {
        const ux = bx / bLen
        const uy = by / bLen
        const dot = Math.max(0.35, ux * n1x + uy * n1y)
        const scale = dist / dot
        out.push([px + ux * scale, py + uy * scale])
      }
    }
  }
  return out
}

/**
 * Exact 2D circular arc curve embedded in XY plane (z = 0) for Three.js CurvePath.
 */
class ArcCurve3 extends THREE.Curve<THREE.Vector3> {
  private readonly cx: number
  private readonly cy: number
  private readonly radius: number
  private readonly startAngle: number
  private readonly deltaAngle: number

  constructor(cx: number, cy: number, radius: number, startAngle: number, deltaAngle: number) {
    super()
    this.cx = cx
    this.cy = cy
    this.radius = radius
    this.startAngle = startAngle
    this.deltaAngle = deltaAngle
  }

  override getPoint(t: number, optionalTarget = new THREE.Vector3()): THREE.Vector3 {
    const a = this.startAngle + this.deltaAngle * t
    return optionalTarget.set(
      this.cx + Math.cos(a) * this.radius,
      this.cy + Math.sin(a) * this.radius,
      0,
    )
  }
}

/**
 * Converts a 2D polyline into a mathematically exact CurvePath composed ONLY of
 * straight LineCurve3 segments and exact circular ArcCurve3 fillets (90°/180°).
 * Zero Catmull-Rom wobble.
 */
export function buildExactRoundedCurvePath(
  pts: ReadonlyArray<readonly [number, number]>,
  cornerRadius: number,
): { path: THREE.CurvePath<THREE.Vector3>; start: THREE.Vector3; end: THREE.Vector3 } | null {
  if (pts.length < 2) return null

  const path = new THREE.CurvePath<THREE.Vector3>()
  const n = pts.length

  // Precompute tangent entry/exit points and arc centers for each interior corner
  const corners: Array<{
    inPt: [number, number]
    outPt: [number, number]
    cx: number
    cy: number
    r: number
    startA: number
    deltaA: number
  } | null> = new Array(n).fill(null)

  for (let i = 1; i < n - 1; i++) {
    const [ax, ay] = pts[i - 1]!
    const [bx, by] = pts[i]!
    const [cx, cy] = pts[i + 1]!

    const v1x = ax - bx
    const v1y = ay - by
    const v2x = cx - bx
    const v2y = cy - by
    const len1 = Math.hypot(v1x, v1y)
    const len2 = Math.hypot(v2x, v2y)
    if (len1 < 1e-4 || len2 < 1e-4) continue

    const u1x = v1x / len1
    const u1y = v1y / len1
    const u2x = v2x / len2
    const u2y = v2y / len2

    const dot = Math.max(-1, Math.min(1, u1x * u2x + u1y * u2y))
    const angle = Math.acos(dot)
    if (Math.abs(angle - Math.PI) < 0.02 || angle < 0.05) continue

    const tanHalf = Math.tan(angle / 2)
    const maxTrim = Math.min(len1, len2) * 0.48
    const desiredTrim = cornerRadius / tanHalf
    const trim = Math.min(maxTrim, desiredTrim)
    const actualR = trim * tanHalf
    if (actualR < 0.02) continue

    const inPt: [number, number] = [bx + u1x * trim, by + u1y * trim]
    const outPt: [number, number] = [bx + u2x * trim, by + u2y * trim]

    // Bisector points from corner B toward circle center
    const bisX = u1x + u2x
    const bisY = u1y + u2y
    const bisLen = Math.hypot(bisX, bisY) || 1
    const centerDist = actualR / Math.sin(angle / 2)
    const centerX = bx + (bisX / bisLen) * centerDist
    const centerY = by + (bisY / bisLen) * centerDist

    const startA = Math.atan2(inPt[1] - centerY, inPt[0] - centerX)
    const endA = Math.atan2(outPt[1] - centerY, outPt[0] - centerX)
    let deltaA = endA - startA
    while (deltaA > Math.PI) deltaA -= Math.PI * 2
    while (deltaA < -Math.PI) deltaA += Math.PI * 2

    corners[i] = { inPt, outPt, cx: centerX, cy: centerY, r: actualR, startA, deltaA }
  }

  let cursor: [number, number] = [pts[0]![0], pts[0]![1]]
  const start = new THREE.Vector3(cursor[0], cursor[1], 0)

  for (let i = 1; i < n; i++) {
    const corner = corners[i]
    if (corner) {
      if (Math.hypot(corner.inPt[0] - cursor[0], corner.inPt[1] - cursor[1]) > 1e-4) {
        path.add(
          new THREE.LineCurve3(
            new THREE.Vector3(cursor[0], cursor[1], 0),
            new THREE.Vector3(corner.inPt[0], corner.inPt[1], 0),
          ),
        )
      }
      path.add(new ArcCurve3(corner.cx, corner.cy, corner.r, corner.startA, corner.deltaA))
      cursor = corner.outPt
    } else {
      const target = pts[i]!
      if (Math.hypot(target[0] - cursor[0], target[1] - cursor[1]) > 1e-4) {
        path.add(
          new THREE.LineCurve3(
            new THREE.Vector3(cursor[0], cursor[1], 0),
            new THREE.Vector3(target[0], target[1], 0),
          ),
        )
      }
      cursor = [target[0], target[1]]
    }
  }

  if (path.curves.length === 0) return null
  return { path, start, end: new THREE.Vector3(cursor[0], cursor[1], 0) }
}

/**
 * Builds concentric parallel tube bundles (straight lines + exact 90°/180° circular arcs).
 * Returns separate groups per bundle so decoy density can be toggled cleanly.
 */
export function buildConcentricTubeBundles(
  specs: ReadonlyArray<RoundedPolylineSpec>,
  material: THREE.MeshPhysicalMaterial,
  tubeRadius: number,
  trackPitch: number,
  worldScale = 2.35,
): {
  group: THREE.Group
  bundleGroups: THREE.Group[]
  geometries: THREE.BufferGeometry[]
} {
  const group = new THREE.Group()
  const bundleGroups: THREE.Group[] = []
  const geometries: THREE.BufferGeometry[] = []
  const capGeo = new THREE.SphereGeometry(tubeRadius, 16, 12)
  geometries.push(capGeo)

  for (const spec of specs) {
    const bundle = new THREE.Group()
    const tracks = Math.max(1, spec.tracks ?? 1)
    const sign = spec.offsetSign ?? 1
    const scaledPts = spec.points.map(([x, y]) => [x * worldScale, y * worldScale] as const)
    const baseR = spec.cornerRadius * worldScale

    for (let t = 0; t < tracks; t++) {
      // Center track (t=0) sits on the exact path; additional tracks offset concentrically
      const offsetIndex = t === 0 ? 0 : t === 1 ? sign : -sign
      const dist = offsetIndex * trackPitch
      const offsetPts = offsetPolyline2D(scaledPts, dist)
      // Adjust corner radius concentrically so parallel arcs share the same center
      const trackR = Math.max(tubeRadius * 1.4, baseR - dist * 0.35)
      const built = buildExactRoundedCurvePath(offsetPts, trackR)
      if (!built) continue

      const approxLen = built.path.getLength()
      const segments = Math.max(24, Math.min(220, Math.round(approxLen * 18)))
      const tubeGeo = new THREE.TubeGeometry(built.path, segments, tubeRadius, 16, false)
      geometries.push(tubeGeo)
      bundle.add(new THREE.Mesh(tubeGeo, material))

      const startCap = new THREE.Mesh(capGeo, material)
      startCap.position.copy(built.start)
      bundle.add(startCap)

      const endCap = new THREE.Mesh(capGeo, material)
      endCap.position.copy(built.end)
      bundle.add(endCap)
    }

    group.add(bundle)
    bundleGroups.push(bundle)
  }

  return { group, bundleGroups, geometries }
}

/**
 * 6-point terraced flat matte-silk ribbon cross-section (width:depth ≈ 4:1):
 * - Inner edge sits lower/recessed (-0.58 -> 0.08) and steps upward toward the outer rim (0.34 -> 0.48 -> 0.52)
 *   so stacked sub-ribbons read like a cascading silk staircase.
 */
const RIBBON_PROFILE: ReadonlyArray<readonly [number, number, number]> = [
  [-0.5, -0.58, 0.0],
  [-0.46, 0.08, 0.12],
  [-0.22, 0.34, 0.36],
  [0.24, 0.48, 0.70],
  [0.46, 0.52, 0.90],
  [0.5, -0.45, 1.0],
]

/**
 * Builds MacBook-style multi-layered parallel flat-bevel ribbons (5–8 layers per bundle),
 * merging all layers of each bundle into a single BufferGeometry for low draw-call overhead.
 * Stores per-vertex `aLayer` (0..1 normalized layer index) and `uv` (length, cross-section).
 */
export function buildLayeredRibbonBundles(
  specs: ReadonlyArray<RoundedPolylineSpec>,
  material: THREE.Material,
  options: {
    ribbonWidth: number
    ribbonDepth: number
    layerGapRatio: number
    defaultLayers: number
    worldScale?: number
  },
): {
  group: THREE.Group
  bundleGroups: THREE.Group[]
  geometries: THREE.BufferGeometry[]
} {
  const {
    ribbonWidth,
    ribbonDepth,
    layerGapRatio,
    defaultLayers,
    worldScale = 2.35,
  } = options

  const pitch = ribbonWidth * (1 + layerGapRatio)
  const profileCount = RIBBON_PROFILE.length
  const group = new THREE.Group()
  const bundleGroups: THREE.Group[] = []
  const geometries: THREE.BufferGeometry[] = []

  const tmpPos = new THREE.Vector3()
  const tmpTan = new THREE.Vector3()

  for (const spec of specs) {
    const bundle = new THREE.Group()
    const layerCount = Math.max(1, spec.tracks ?? defaultLayers)
    const sign = spec.offsetSign ?? 1
    const zBias = spec.zBias ?? 0
    const scaledPts = spec.points.map(([x, y]) => [x * worldScale, y * worldScale] as const)
    const baseR = spec.cornerRadius * worldScale

    const positions: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const layers: number[] = []
    const indices: number[] = []
    let vertexOffset = 0

    for (let k = 0; k < layerCount; k++) {
      const layerNorm = layerCount > 1 ? k / (layerCount - 1) : 0.5
      const centeredIdx = k - (layerCount - 1) * 0.5
      const dist = centeredIdx * pitch * sign
      const offsetPts = offsetPolyline2D(scaledPts, dist)

      const curve: THREE.Curve<THREE.Vector3> | null =
        spec.smooth && offsetPts.length >= 3
          ? new THREE.CatmullRomCurve3(
              offsetPts.map(([x, y]) => new THREE.Vector3(x, y, 0)),
              false,
              'centripetal',
              0.5,
            )
          : buildExactRoundedCurvePath(offsetPts, Math.max(ribbonWidth * 1.15, baseR - dist * 0.25))?.path ?? null
      if (!curve) continue

      const approxLen = curve.getLength()
      const segments = Math.max(20, Math.min(48, Math.round(approxLen * 5.5)))
      // Gentle Z-cascade so stacked flat silk ribbons layer cleanly without heavy parallax drift
      const layerZ = zBias + layerNorm * 0.14 - 0.07

      // Precompute smoothed curve points & tangents
      const ringCenters: Array<{ x: number; y: number; nx: number; ny: number; uLen: number }> = []
      for (let i = 0; i <= segments; i++) {
        const u = i / segments
        curve.getPointAt(u, tmpPos)
        curve.getTangentAt(u, tmpTan)
        const tLen = Math.hypot(tmpTan.x, tmpTan.y) || 1
        const tx = tmpTan.x / tLen
        const ty = tmpTan.y / tLen
        // In-plane normal perpendicular to curve tangent
        ringCenters.push({ x: tmpPos.x, y: tmpPos.y, nx: -ty, ny: tx, uLen: u })
      }

      for (let i = 0; i <= segments; i++) {
        const c = ringCenters[i]!
        // Subtle depth taper only at very ends so flat ribbons enter/exit screen edges smoothly
        const endFade = Math.min(1, c.uLen / 0.05, (1 - c.uLen) / 0.05)
        // RIBBON_PROFILE spans [-0.5 .. +0.5], so multiplying by ribbonWidth produces exact ribbonWidth (4:1 vs ribbonDepth) and 15% layer gap
        const halfW = ribbonWidth
        const depth = ribbonDepth * (0.4 + 0.6 * endFade)

        for (let p = 0; p < profileCount; p++) {
          const [latFactor, zFactor, uV] = RIBBON_PROFILE[p]!
          const lat = latFactor * halfW
          const px = c.x + c.nx * lat
          const py = c.y + c.ny * lat
          const pz = layerZ + zFactor * depth

          positions.push(px, py, pz)
          // Analytical cross-section normal (approximate smooth silk bevel)
          const prevP = RIBBON_PROFILE[Math.max(0, p - 1)]!
          const nextP = RIBBON_PROFILE[Math.min(profileCount - 1, p + 1)]!
          const dLat = (nextP[0] - prevP[0]) * halfW
          const dZ = (nextP[1] - prevP[1]) * depth
          // Normal in (lateral, Z) plane rotated 90° toward +Z
          const nLat = -dZ
          const nZ = dLat
          const nLen = Math.hypot(nLat, nZ) || 1
          const worldNx = (c.nx * nLat) / nLen
          const worldNy = (c.ny * nLat) / nLen
          const worldNz = nZ / nLen
          normals.push(worldNx, worldNy, worldNz)
          uvs.push(c.uLen, uV)
          layers.push(layerNorm)
        }
      }

      for (let i = 0; i < segments; i++) {
        for (let p = 0; p < profileCount - 1; p++) {
          const a = vertexOffset + i * profileCount + p
          const b = a + 1
          const cIdx = a + profileCount
          const d = cIdx + 1
          indices.push(a, cIdx, b, b, cIdx, d)
        }
      }
      vertexOffset += (segments + 1) * profileCount
    }

    if (positions.length > 0) {
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
      geo.setAttribute('aLayer', new THREE.Float32BufferAttribute(layers, 1))
      geo.setIndex(indices)
      geo.computeBoundingSphere()
      geometries.push(geo)
      bundle.add(new THREE.Mesh(geo, material))
    }

    group.add(bundle)
    bundleGroups.push(bundle)
  }

  return { group, bundleGroups, geometries }
}
