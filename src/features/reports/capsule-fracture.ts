import { Color, CurvePath, InstancedMesh, LineCurve3, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, Object3D, TetrahedronGeometry, TubeGeometry, Vector3 } from 'three'
import type { Group } from 'three'

const rand = (min: number, max: number) => min + Math.random() * (max - min)
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1))
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Cracks stay on the straight wall, before the rounded ends. */
const CRACK_LIMIT = 0.6
const WIDTHS = [0.0034, 0.0022, 0.0014]
const BRANCH_CHANCE = [0.42, 0.25, 0]
/** Forks per line: the chance is rolled at every stride, and unlimited it grew dense, root-like webs. */
const MAX_FORKS = 2
/** Impact points on the seam's camera-facing side, and when (in crack progress) each starts. */
const IMPACTS = [{ theta: 1.35, t0: 0 }, { theta: 1.95, t0: 0.25 }, { theta: 1.0, t0: 0.5 }]
const FIRST_BUDGET = 0.45

type Joint = { theta: number; y: number }
type Branch = { joints: Joint[]; generation: number; t0: number; t1: number }

/**
 * A crack walks away from the seam in short straight strides, its heading wandering; it may fork, and forks are
 * thinner, shorter and start when the parent reaches the fork. Points are (angle around the axis, height).
 */
function grow(radius: number, direction: 1 | -1, from: Joint, heading: number, generation: number, t0: number, budget: number, out: Branch[]) {
  const steps = generation === 0 ? randInt(7, 11) : randInt(3, 5)
  const [shortest, longest] = generation === 0 ? [0.03, 0.06] : [0.022, 0.052]
  const t1 = Math.min(1, t0 + budget * rand(0.6, 1))
  const joints = [from]
  let { theta, y } = from
  let h = heading
  let forks = 0
  for (let step = 0; step < steps; step++) {
    h = clamp(h + rand(-0.55, 0.55), -1.25, 1.25)
    const stride = rand(shortest, longest)
    theta += (Math.sin(h) * stride) / radius
    y += direction * Math.cos(h) * stride
    if (Math.abs(y) > CRACK_LIMIT) break
    joints.push({ theta, y })
    if (forks < MAX_FORKS && Math.random() < BRANCH_CHANCE[generation]!) {
      forks++
      const at = t0 + ((t1 - t0) * (joints.length - 1)) / steps
      const turn = (Math.random() < 0.5 ? -1 : 1) * rand(0.6, 1.1)
      grow(radius, direction, { theta, y }, h + turn, generation + 1, at, budget * 0.6, out)
    }
  }
  if (joints.length > 1) out.push({ joints, generation, t0, t1 })
}

/** Straight pieces between joints keep the crack angular; `lift` moves the line toward the top of the screen. */
function crackTube(joints: Joint[], radius: number, width: number, lift = 0) {
  const at = ({ theta, y }: Joint) => new Vector3(radius * Math.cos(theta) - lift, y, radius * Math.sin(theta))
  const path = new CurvePath<Vector3>()
  for (let index = 1; index < joints.length; index++) path.add(new LineCurve3(at(joints[index - 1]!), at(joints[index]!)))
  const segments = (joints.length - 1) * 6
  const geometry = new TubeGeometry(path, segments, width, 4, false)
  geometry.setDrawRange(0, 0)
  return { geometry, segments }
}

type Half = { group: Group; radius: number; direction: 1 | -1; color: Color }
/** A point a crack passes, and the crack progress at which it is reached. */
export type CrackPoint = { half: Half; local: Vector3; at: number }

/**
 * Cracks on both halves, spreading from three impact points on the seam. Each line is a dark groove; first
 * generation lines also get a thin white edge just above it, which catches light and reads as an opening gap.
 */
export function createFracture(cap: Half, body: Half, seamY: number) {
  const groove = new MeshBasicMaterial({ color: '#2C1A6B', transparent: true, opacity: 0.9 })
  const glint = new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35 })
  const lines: { geometries: TubeGeometry[]; segments: number; t0: number; t1: number }[] = []
  const points: CrackPoint[] = []
  for (const half of [cap, body]) {
    const branches: Branch[] = []
    for (const impact of IMPACTS) {
      for (let count = 0; count < 2; count++) {
        const start = { theta: impact.theta + rand(-0.15, 0.15), y: seamY }
        grow(half.radius, half.direction, start, rand(-0.7, 0.7), 0, impact.t0, FIRST_BUDGET, branches)
      }
    }
    for (const branch of branches) {
      const width = WIDTHS[branch.generation]!
      const line = crackTube(branch.joints, half.radius * 1.006, width)
      half.group.add(new Mesh(line.geometry, groove))
      const geometries = [line.geometry]
      if (branch.generation === 0) {
        const edge = crackTube(branch.joints, half.radius * 1.009, width * 0.45, 0.0035)
        half.group.add(new Mesh(edge.geometry, glint))
        geometries.push(edge.geometry)
      }
      lines.push({ geometries, segments: line.segments, t0: branch.t0, t1: branch.t1 })
      const last = branch.joints.length - 1
      branch.joints.forEach(({ theta, y }, index) => points.push({
        half, local: new Vector3(half.radius * Math.cos(theta), y, half.radius * Math.sin(theta)), at: branch.t0 + ((branch.t1 - branch.t0) * index) / last,
      }))
    }
  }

  /** `progress` 0 → 1: every line reveals itself between its own t0 and t1. */
  function update(progress: number) {
    for (const line of lines) {
      const p = line.t1 > line.t0 ? clamp((progress - line.t0) / (line.t1 - line.t0), 0, 1) : progress >= line.t0 ? 1 : 0
      const count = Math.floor(p * line.segments) * 4 * 6
      line.geometries.forEach(geometry => geometry.setDrawRange(0, count))
    }
  }
  return { update, points, materials: [groove, glint] }
}

const CHIPS = 140

/** Small flat shards knocked off the crack lines and the seam. They tumble, fall and shrink away. */
export function createChips() {
  const geometry = new TetrahedronGeometry(1)
  geometry.scale(1, 0.32, 0.8)
  const material = new MeshPhysicalMaterial({ roughness: 0.25, clearcoat: 1 })
  const mesh = new InstancedMesh(geometry, material, CHIPS)
  mesh.frustumCulled = false
  const position = new Float32Array(CHIPS * 3)
  const velocity = new Float32Array(CHIPS * 3)
  const rotation = new Float32Array(CHIPS * 3)
  const spin = new Float32Array(CHIPS * 3)
  const size = new Float32Array(CHIPS)
  const age = new Float32Array(CHIPS)
  const life = new Float32Array(CHIPS)
  const dummy = new Object3D()
  const world = new Vector3()
  let next = 0
  dummy.scale.setScalar(0)
  dummy.updateMatrix()
  for (let i = 0; i < CHIPS; i++) {
    mesh.setMatrixAt(i, dummy.matrix)
    mesh.setColorAt(i, new Color('#ffffff'))
  }

  function spawn(at: Vector3, color: Color, power: number) {
    const i = next
    next = (next + 1) % CHIPS
    const p = i * 3
    const speed = power * rand(0.4, 1.3)
    position.set([at.x, at.y, at.z], p)
    // Out toward the camera and a little up, then gravity takes over.
    velocity.set([rand(-0.7, 0.7) * speed, rand(0.3, 1.2) * speed, rand(0.4, 1.2) * speed], p)
    rotation.set([rand(0, Math.PI * 2), rand(0, Math.PI * 2), rand(0, Math.PI * 2)], p)
    spin.set([rand(-7, 7), rand(-7, 7), rand(-7, 7)], p)
    size[i] = Math.random() < 0.15 ? rand(0.03, 0.05) : rand(0.009, 0.025)
    age[i] = 0
    life[i] = rand(0.9, 1.7)
    mesh.setColorAt(i, color)
    mesh.instanceColor!.needsUpdate = true
  }

  /** Shards from random points the cracks have already reached (`progress` is the current crack progress). */
  function breakChips(all: CrackPoint[], progress: number, count: number, power: number) {
    const reached = all.filter(point => point.at <= progress)
    const points = reached.length ? reached : all
    if (!points.length) return
    for (let n = 0; n < count; n++) {
      const point = points[Math.floor(Math.random() * points.length)]!
      spawn(point.half.group.localToWorld(world.copy(point.local)), point.half.color, power)
    }
  }

  function update(dt: number) {
    for (let i = 0; i < CHIPS; i++) {
      if (life[i] === 0) continue
      const elapsed = age[i]! + dt
      age[i] = elapsed
      const span = life[i]!
      const p = i * 3
      if (elapsed >= span) {
        life[i] = 0
        dummy.scale.setScalar(0)
      } else {
        velocity[p + 1] = velocity[p + 1]! - 3.2 * dt
        for (let axis = 0; axis < 3; axis++) {
          position[p + axis] = position[p + axis]! + velocity[p + axis]! * dt
          rotation[p + axis] = rotation[p + axis]! + spin[p + axis]! * dt
        }
        const t = elapsed / span
        dummy.position.set(position[p]!, position[p + 1]!, position[p + 2]!)
        dummy.rotation.set(rotation[p]!, rotation[p + 1]!, rotation[p + 2]!)
        dummy.scale.setScalar(size[i]! * (t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1))
      }
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }

  return { mesh, spawn, breakChips, update }
}
