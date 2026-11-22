import * as THREE from 'three'

export interface RoundedPolylineSpec {
  /** Axis-aligned or clean geometric waypoints in 2D (world units before scale). */
  points: ReadonlyArray<readonly [number, number]>
  /** Corner fillet radius for 90°/180° turns. */
  cornerRadius: number
  /** Number of parallel concentric tracks in this bundle (1..3). */
  tracks?: number
  /** Offset direction multiplier (+1 or -1) for multi-track bundles. */
  offsetSign?: 1 | -1
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
