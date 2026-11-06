import { AdditiveBlending, BufferAttribute, BufferGeometry, CatmullRomCurve3, Color, Group, Mesh, MeshBasicMaterial, Points, ShaderMaterial, TubeGeometry, Vector3 } from 'three'
import type { Object3D } from 'three'
import { designPalette } from '@/shared/design/tokens'

const rand = (min: number, max: number) => min + Math.random() * (max - min)
const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

const RIBBON_COUNT = 6
const RIBBON_SEGMENTS = 160
/** Core brightness in high quality: above 1 so the bloom threshold picks the ribbons up. */
const RIBBON_HDR = 2.4 * 1.2

/** Six light ribbons spiralling out of the opening, alternately up and down. Each has a bright core and a soft halo. */
export function createRibbons() {
  const group = new Group()
  const base = new Color(designPalette.violet['400'])
  const core = new MeshBasicMaterial({ color: base.clone(), transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false })
  const halo = new MeshBasicMaterial({ color: base.clone(), transparent: true, opacity: 0.13, blending: AdditiveBlending, depthWrite: false })
  const tubes: TubeGeometry[][] = []
  for (let k = 0; k < RIBBON_COUNT; k++) {
    const up = k % 2 === 0 ? 1 : -1
    const start = (k / RIBBON_COUNT) * Math.PI * 2 + Math.random() * 0.5
    const turns = rand(0.95, 1.5)
    const reach = rand(1.05, 1.65)
    const rise = up * rand(0.7, 1.6)
    const points = Array.from({ length: 49 }, (_, index) => {
      const s = index / 48
      const angle = start + s * turns * Math.PI * 2
      const radius = 0.05 + (reach - 0.05) * s ** 0.75
      return new Vector3(Math.cos(angle) * radius, rise * s + Math.sin(s * 3 * Math.PI + k) * 0.07, Math.sin(angle) * radius * 0.7)
    })
    const curve = new CatmullRomCurve3(points)
    const pair = [new TubeGeometry(curve, RIBBON_SEGMENTS, rand(0.005, 0.009), 5, false), new TubeGeometry(curve, RIBBON_SEGMENTS, 0.026, 5, false)]
    pair.forEach(geometry => geometry.setDrawRange(0, 0))
    group.add(new Mesh(pair[0], core), new Mesh(pair[1], halo))
    tubes.push(pair)
  }
  /** `progress` runs 0 → 1.55: each ribbon's head leads its tail by half its length, later ribbons a little behind. */
  function update(progress: number) {
    const perSegment = 5 * 6
    tubes.forEach((pair, k) => {
      const p = progress - k * 0.07
      const head = Math.floor(clamp01(p) * RIBBON_SEGMENTS) * perSegment
      const tail = Math.floor(clamp01(p - 0.5) * RIBBON_SEGMENTS) * perSegment
      pair.forEach(geometry => geometry.setDrawRange(tail, Math.max(0, head - tail)))
    })
  }
  function setHighQuality(high: boolean) {
    core.color.copy(base).multiplyScalar(high ? RIBBON_HDR : 1)
    halo.opacity = high ? 0.07 : 0.13
  }
  return { group, update, setHighQuality }
}

const sparkleVertex = /* glsl */ `
  attribute float size;
  attribute float alpha;
  attribute vec3 color;
  uniform float uScale;
  uniform float uFocus;
  uniform float uDof;
  uniform float uGain;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vBlur;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float dist = -mv.z;
    // Circle of confusion: out-of-focus sparkles grow into soft, dimmer discs (bokeh).
    float coc = min(abs(dist - uFocus) * 0.55, 2.5) * uDof;
    gl_PointSize = size * uScale / dist * (1.0 + coc * 2.2);
    gl_Position = projectionMatrix * mv;
    vBlur = clamp(coc, 0.0, 1.0);
    vColor = color * mix(1.0, uGain, 1.0 - vBlur);
    vAlpha = alpha / (1.0 + coc * coc * 3.0);
  }
`
const sparkleFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vBlur;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5 || vAlpha <= 0.0) discard;
    float glow = smoothstep(0.5, 0.0, d);
    float core = smoothstep(0.16, 0.0, d);
    float sharp = glow * 0.65 + core;
    float disc = smoothstep(0.5, 0.36, d) * 0.7;
    vec3 tint = mix(vColor, vColor + vec3(1.0), core * 0.7 * (1.0 - vBlur));
    gl_FragColor = vec4(tint, mix(sharp, disc, vBlur) * vAlpha);
    #include <colorspace_fragment>
  }
`

const SPARKLES = 2400
/** Depth of field strength in high quality. */
const HIGH_DOF = 0.45
type Emitter = 'crackSpark' | 'burst' | 'ambient'

/** Pooled point sparkles that swirl around the opening, drift upward and twinkle out. */
export function createSparkles(pill: Object3D, seamRadius: number, seamY: number) {
  const position = new Float32Array(SPARKLES * 3)
  const velocity = new Float32Array(SPARKLES * 3)
  const color = new Float32Array(SPARKLES * 3)
  const size = new Float32Array(SPARKLES)
  const alpha = new Float32Array(SPARKLES)
  const base = new Float32Array(SPARKLES)
  const age = new Float32Array(SPARKLES)
  const life = new Float32Array(SPARKLES)
  const phase = new Float32Array(SPARKLES)
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(position, 3))
  geometry.setAttribute('color', new BufferAttribute(color, 3))
  geometry.setAttribute('size', new BufferAttribute(size, 1))
  geometry.setAttribute('alpha', new BufferAttribute(alpha, 1))
  const uniforms = { uScale: { value: 1 }, uFocus: { value: 6 }, uDof: { value: 0 }, uGain: { value: 1 } }
  const material = new ShaderMaterial({
    uniforms, vertexShader: sparkleVertex, fragmentShader: sparkleFragment,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  })
  const points = new Points(geometry, material)
  points.frustumCulled = false
  /** Emitted per second; the timeline animates these. */
  const rates: Record<Emitter, number> = { crackSpark: 0, burst: 0, ambient: 0 }
  const owed: Record<Emitter, number> = { crackSpark: 0, burst: 0, ambient: 0 }
  const tint = new Color(designPalette.violet['300'])
  const white = new Color('#ffffff')
  const swatch = new Color()
  const point = new Vector3()
  const normal = new Vector3()
  let next = 0

  function emit(kind: Emitter) {
    const i = next
    next = (next + 1) % SPARKLES
    const p = i * 3
    let hot = false
    if (kind === 'crackSpark') {
      // A short spit from a point on the seam's camera-facing side.
      const theta = rand(0.35, 2.8)
      normal.set(Math.cos(theta), 0, Math.sin(theta))
      point.copy(normal).multiplyScalar(seamRadius).setY(seamY + rand(-0.04, 0.04))
      pill.localToWorld(point)
      normal.transformDirection(pill.matrixWorld).multiplyScalar(rand(0.3, 0.9))
      position.set([point.x, point.y, point.z], p)
      velocity.set([normal.x + rand(-0.15, 0.15), normal.y + rand(0, 0.3), normal.z + rand(-0.15, 0.15)], p)
      life[i] = rand(0.5, 1.1)
      size[i] = rand(0.02, 0.04)
      base[i] = 1
      hot = true
    } else if (kind === 'burst') {
      // Out of the opening in every direction, flattened vertically.
      normal.set(rand(-1, 1), rand(-1, 1) * 0.6, rand(-1, 1)).normalize()
      const speed = rand(0.6, 2.8)
      position.set([normal.x * 0.05, normal.y * 0.05, normal.z * 0.05], p)
      velocity.set([normal.x * speed, normal.y * speed, normal.z * speed], p)
      life[i] = rand(2, 4.4)
      const bokeh = Math.random() < 0.1
      size[i] = bokeh ? rand(0.09, 0.16) : rand(0.02, 0.055)
      base[i] = bokeh ? 0.35 : 1
      hot = !bokeh && Math.random() < 0.25
    } else {
      // Dust slowly rising through a wide box around the capsule.
      position.set([rand(-4, 4), rand(-2.2, 1.6), rand(-2.5, 1.5)], p)
      velocity.set([rand(-0.05, 0.05), rand(0.05, 0.18), rand(-0.05, 0.05)], p)
      life[i] = rand(2.5, 5)
      size[i] = rand(0.012, 0.03)
      base[i] = 0.55
    }
    swatch.copy(tint).lerp(white, hot ? 0.75 : rand(0, 0.3))
    color.set([swatch.r, swatch.g, swatch.b], p)
    age[i] = 0
    phase[i] = rand(0, Math.PI * 2)
  }

  function update(dt: number) {
    let emitted = false
    for (const kind of ['crackSpark', 'burst', 'ambient'] as const) {
      owed[kind] += rates[kind] * dt
      while (owed[kind] >= 1) { emit(kind); owed[kind] -= 1; emitted = true }
      if (rates[kind] === 0) owed[kind] = 0
    }
    const damping = 0.5 ** dt
    for (let i = 0; i < SPARKLES; i++) {
      const span = life[i]!
      if (span === 0) continue
      const elapsed = age[i]! + dt
      age[i] = elapsed
      if (elapsed >= span) { life[i] = 0; alpha[i] = 0; size[i] = 0; continue }
      const p = i * 3
      const x = position[p]!, z = position[p + 2]!
      const radius = Math.hypot(x, z) + 1e-4
      // Swirl around the vertical axis through the opening, stronger close to it.
      const swirl = 0.9 / (0.6 + radius)
      velocity[p] = (velocity[p]! - (z / radius) * swirl * dt) * damping
      velocity[p + 1] = (velocity[p + 1]! + 0.06 * dt) * damping
      velocity[p + 2] = (velocity[p + 2]! + (x / radius) * swirl * dt) * damping
      position[p] = x + velocity[p]! * dt
      position[p + 1] = position[p + 1]! + velocity[p + 1]! * dt
      position[p + 2] = z + velocity[p + 2]! * dt
      const t = elapsed / span
      const fadeIn = Math.min(1, elapsed / 0.08)
      const fadeOut = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1
      alpha[i] = base[i]! * fadeIn * fadeOut * (0.6 + 0.4 * Math.sin(elapsed * 7 + phase[i]!))
    }
    geometry.attributes.position!.needsUpdate = true
    geometry.attributes.alpha!.needsUpdate = true
    geometry.attributes.size!.needsUpdate = true
    if (emitted) geometry.attributes.color!.needsUpdate = true
  }

  function setHighQuality(high: boolean) {
    // At full strength most of the burst, flying far from the focus plane, turned into large discs over the card.
    uniforms.uDof.value = high ? HIGH_DOF : 0
    uniforms.uGain.value = high ? 2.2 : 1
  }

  return { points, rates, update, uniforms, setHighQuality }
}
