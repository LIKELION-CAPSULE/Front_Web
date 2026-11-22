import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  CAPSULE_V2_GEOMETRY,
  HIDDEN_DECOY_BUNDLES,
  HIDDEN_WORDMARK_SPECS,
  LOW_FPS_DEGRADATION,
  SECRET_HOVER_TRIGGER_MS,
  SHINY_CAPSULE_CONFIG,
  TIME_OF_DAY_PALETTES,
  TUBE_STYLE_DEFAULTS,
  type TimeOfDayBand,
  type TimeOfDayMode,
  type TimePalette,
  type WindowRect,
} from './desktop-config'
import { buildConcentricTubeBundles } from './tube-geometry'

export interface DesktopWallpaperProps {
  capsuleCount: number
  capsuleSpeed: number
  purpleAccentRatio: number
  shinySpawnChance: number
  shinyTriggerNonce: number
  disableShiny?: boolean
  timeMode: TimeOfDayMode
  hiddenContrast: number
  hiddenScale: number
  hiddenOffsetX: number
  hiddenOffsetY: number
  hiddenLightAngle: number | null
  decoyDensity: number
  paused: boolean
  inputFocused: boolean
  degradationStage: 0 | 1 | 2 | 3
  windowRects: { mate: WindowRect; login: WindowRect }
  onReady?: () => void
  onFpsSample?: (fps: number) => void
  onSecretHover?: (normPos: { x: number; y: number }) => void
  onShinyFound?: (normPos: { x: number; y: number }) => void
}

interface FloatingCapsule {
  u: number
  v: number
  z: number
  scale: number
  axis: THREE.Vector3
  baseQuat: THREE.Quaternion
  spinSpeed: number
  spinDir: number
  angle: number
  hoverFactor: number
  pushX: number
  pushY: number
  isAccentPurple: boolean
}

const MAX_CAPSULES = 45
const CAPSULE_RADIUS = CAPSULE_V2_GEOMETRY.radius / CAPSULE_V2_GEOMETRY.length
const CAPSULE_HALF_CYL = CAPSULE_V2_GEOMETRY.halfStraight / CAPSULE_V2_GEOMETRY.length

function lerpHex(hexA: string, hexB: string, t: number): string {
  const a = new THREE.Color(hexA)
  const b = new THREE.Color(hexB)
  return '#' + a.lerp(b, Math.max(0, Math.min(1, t))).getHexString()
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = ((b - a + 540) % 360) - 180
  if (diff < -180) diff += 360
  return (a + diff * t + 360) % 360
}

function blendPalettes(a: TimePalette, b: TimePalette, t: number): TimePalette {
  return {
    top: lerpHex(a.top, b.top, t),
    mid: lerpHex(a.mid, b.mid, t),
    bottom: lerpHex(a.bottom, b.bottom, t),
    glow: lerpHex(a.glow, b.glow, t),
    tubeBase: lerpHex(a.tubeBase, b.tubeBase, t),
    tubeSpec: lerpHex(a.tubeSpec, b.tubeSpec, t),
    rimColor: lerpHex(a.rimColor, b.rimColor, t),
    defaultLightAngle: Math.round(lerpAngle(a.defaultLightAngle, b.defaultLightAngle, t)),
    tubeContrastBoost: Math.round(a.tubeContrastBoost + (b.tubeContrastBoost - a.tubeContrastBoost) * t),
  }
}

function resolveTimePalette(mode: TimeOfDayMode, now: Date = new Date()): TimePalette {
  if (mode !== 'auto') return TIME_OF_DAY_PALETTES[mode]

  const hour = now.getHours() + now.getMinutes() / 60
  const bands: Array<{ start: number; band: TimeOfDayBand }> = [
    { start: 0, band: 'dawn' },
    { start: 5, band: 'morning' },
    { start: 11, band: 'day' },
    { start: 16, band: 'sunset' },
    { start: 19, band: 'night' },
  ]

  let idx = 0
  for (let i = bands.length - 1; i >= 0; i--) {
    if (hour >= bands[i]!.start) {
      idx = i
      break
    }
  }
  const current = bands[idx]!
  const next = bands[(idx + 1) % bands.length]!
  const nextStart = idx === bands.length - 1 ? 24 : next.start
  const blendWindow = 0.5
  const distToNext = nextStart - hour

  if (distToNext < blendWindow) {
    const t = 1 - distToNext / blendWindow
    return blendPalettes(TIME_OF_DAY_PALETTES[current.band], TIME_OF_DAY_PALETTES[next.band], t)
  }
  return TIME_OF_DAY_PALETTES[current.band]
}

function createSeededRandom(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function smoothstep(e0: number, e1: number, x: number): number {
  const d = e1 - e0
  const t = Math.min(1, Math.max(0, d === 0 ? 0 : (x - e0) / d))
  return t * t * (3 - 2 * t)
}

function createGradientTexture(stops: ReadonlyArray<readonly [number, string]>): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 16
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 256)
    for (const [offset, color] of stops) {
      grad.addColorStop(offset, color)
    }
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 16, 256)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

function buildCapsuleHalfGeometry(half: 'top' | 'bottom'): THREE.LatheGeometry {
  const points: THREE.Vector2[] = []
  const arcSteps = 16
  if (half === 'top') {
    points.push(new THREE.Vector2(CAPSULE_RADIUS * 0.96, 0.002))
    points.push(new THREE.Vector2(CAPSULE_RADIUS, 0.012))
    points.push(new THREE.Vector2(CAPSULE_RADIUS, CAPSULE_HALF_CYL))
    for (let i = 1; i <= arcSteps; i++) {
      const theta = (i / arcSteps) * (Math.PI / 2)
      points.push(
        new THREE.Vector2(
          Math.max(0, Math.cos(theta) * CAPSULE_RADIUS),
          CAPSULE_HALF_CYL + Math.sin(theta) * CAPSULE_RADIUS,
        ),
      )
    }
  } else {
    for (let i = 0; i <= arcSteps; i++) {
      const theta = -Math.PI / 2 + (i / arcSteps) * (Math.PI / 2)
      points.push(
        new THREE.Vector2(
          Math.max(0, Math.cos(theta) * CAPSULE_RADIUS),
          -CAPSULE_HALF_CYL + Math.sin(theta) * CAPSULE_RADIUS,
        ),
      )
    }
    points.push(new THREE.Vector2(CAPSULE_RADIUS, -0.012))
    points.push(new THREE.Vector2(CAPSULE_RADIUS * 0.96, -0.002))
  }
  const geo = new THREE.LatheGeometry(points, 32)
  geo.computeVertexNormals()
  return geo
}

/** 4-point star sparkle sprite texture for the shiny capsule. */
function createSparkleTexture(): THREE.CanvasTexture {
  const size = 96
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const c = size / 2

  const glow = ctx.createRadialGradient(c, c, 0, c, c, c)
  glow.addColorStop(0, 'rgba(255, 250, 255, 1)')
  glow.addColorStop(0.22, 'rgba(249, 180, 224, 0.85)')
  glow.addColorStop(0.55, 'rgba(180, 148, 255, 0.25)')
  glow.addColorStop(1, 'rgba(180, 148, 255, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, size, size)

  ctx.fillStyle = 'rgba(255, 255, 255, 0.96)'
  ctx.beginPath()
  ctx.moveTo(c, 4)
  ctx.quadraticCurveTo(c + 4, c - 4, size - 4, c)
  ctx.quadraticCurveTo(c + 4, c + 4, c, size - 4)
  ctx.quadraticCurveTo(c - 4, c + 4, 4, c)
  ctx.quadraticCurveTo(c - 4, c - 4, c, 4)
  ctx.closePath()
  ctx.fill()

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

interface ShinyCorridor {
  startU: number
  startV: number
  endU: number
  endV: number
}

function pointInsideObstacles(
  px: number,
  py: number,
  rects: { mate: WindowRect; login: WindowRect },
  margin = 48,
): boolean {
  // Top-left desktop icons column
  if (px < 148 + margin * 0.5 && py < 320 + margin * 0.5) return true
  const mateH = rects.mate.height ?? 540
  if (
    px >= rects.mate.x - margin &&
    px <= rects.mate.x + rects.mate.width + margin &&
    py >= rects.mate.y - margin &&
    py <= rects.mate.y + mateH + margin
  ) {
    return true
  }
  if (
    px >= rects.login.x - margin &&
    px <= rects.login.x + rects.login.width + margin &&
    py >= rects.login.y - margin &&
    py <= rects.login.y + 560 + margin
  ) {
    return true
  }
  return false
}

/**
 * Picks an edge-to-edge drift corridor for the shiny capsule that avoids
 * current window positions and the top-left desktop icon column.
 */
function pickShinyCorridor(
  viewportW: number,
  viewportH: number,
  rects: { mate: WindowRect; login: WindowRect },
): ShinyCorridor {
  const candidates: ShinyCorridor[] = [
    // Bottom open strip left -> right (below both windows)
    { startU: -0.06, startV: 0.87, endU: 1.06, endV: 0.84 },
    // Bottom open strip right -> left
    { startU: 1.06, startV: 0.86, endU: -0.06, endV: 0.88 },
    // Left open strip below icons (enters from left, exits bottom)
    { startU: -0.06, startV: 0.58, endU: 0.22, endV: 1.06 },
    // Top open strip above Mate window
    { startU: 0.2, startV: -0.06, endU: 0.62, endV: 0.14 },
  ]

  let best = candidates[0]!
  let bestHits = Number.POSITIVE_INFINITY
  for (const cand of candidates) {
    let hits = 0
    for (let s = 1; s <= 9; s++) {
      const t = s / 10
      const u = cand.startU + (cand.endU - cand.startU) * t
      const v = cand.startV + (cand.endV - cand.startV) * t
      if (pointInsideObstacles(u * viewportW, v * viewportH, rects, 38)) {
        hits++
      }
    }
    if (hits < bestHits) {
      bestHits = hits
      best = cand
      if (hits === 0) break
    }
  }
  return best
}

function distToSegmentSq(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax
  const vy = by - ay
  const wx = px - ax
  const wy = py - ay
  const lenSq = vx * vx + vy * vy
  const t = lenSq > 1e-6 ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / lenSq)) : 0
  const dx = px - (ax + t * vx)
  const dy = py - (ay + t * vy)
  return dx * dx + dy * dy
}

export default function DesktopWallpaper({
  capsuleCount,
  capsuleSpeed,
  purpleAccentRatio,
  shinySpawnChance,
  shinyTriggerNonce,
  disableShiny = false,
  timeMode,
  hiddenContrast,
  hiddenScale,
  hiddenOffsetX,
  hiddenOffsetY,
  hiddenLightAngle,
  decoyDensity,
  paused,
  inputFocused,
  degradationStage,
  windowRects,
  onReady,
  onFpsSample,
  onSecretHover,
  onShinyFound,
}: DesktopWallpaperProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const resumeLoopRef = useRef<(() => void) | null>(null)

  const palette = useMemo(() => resolveTimePalette(timeMode), [timeMode])

  const propsRef = useRef({
    capsuleCount,
    capsuleSpeed,
    purpleAccentRatio,
    shinySpawnChance,
    disableShiny,
    palette,
    hiddenContrast,
    hiddenScale,
    hiddenOffsetX,
    hiddenOffsetY,
    hiddenLightAngle,
    decoyDensity,
    paused,
    inputFocused,
    degradationStage,
    windowRects,
    onReady,
    onFpsSample,
    onSecretHover,
    onShinyFound,
  })

  useEffect(() => {
    propsRef.current = {
      capsuleCount,
      capsuleSpeed,
      purpleAccentRatio,
      shinySpawnChance,
      disableShiny,
      palette,
      hiddenContrast,
      hiddenScale,
      hiddenOffsetX,
      hiddenOffsetY,
      hiddenLightAngle,
      decoyDensity,
      paused,
      inputFocused,
      degradationStage,
      windowRects,
      onReady,
      onFpsSample,
      onSecretHover,
      onShinyFound,
    }
    if (!paused) {
      resumeLoopRef.current?.()
    }
  }, [
    capsuleCount,
    capsuleSpeed,
    purpleAccentRatio,
    shinySpawnChance,
    disableShiny,
    palette,
    hiddenContrast,
    hiddenScale,
    hiddenOffsetX,
    hiddenOffsetY,
    hiddenLightAngle,
    decoyDensity,
    paused,
    inputFocused,
    degradationStage,
    windowRects,
    onReady,
    onFpsSample,
    onSecretHover,
    onShinyFound,
  ])

  const manualShinyRef = useRef(0)
  useEffect(() => {
    if (shinyTriggerNonce > 0) {
      manualShinyRef.current = shinyTriggerNonce
    }
  }, [shinyTriggerNonce])

  useEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current
    if (!root || !canvas) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      })
      const w = window as unknown as {
        __capsuleDesktopMetrics?: { webglContextCount: number; live2dLoadCount: number }
      }
      w.__capsuleDesktopMetrics ??= { webglContextCount: 0, live2dLoadCount: 0 }
      w.__capsuleDesktopMetrics.webglContextCount += 1
    } catch {
      return
    }

    const computeDpr = (stage: 0 | 1 | 2 | 3) => {
      const base = Math.min(window.devicePixelRatio || 1, 2) * 0.9
      return stage >= 1 ? base * LOW_FPS_DEGRADATION.stage1ResolutionScale : base
    }
    let appliedDpr = computeDpr(propsRef.current.degradationStage)
    renderer.setPixelRatio(appliedDpr)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.12
    renderer.setClearColor(0x000000, 0)

    const scene = new THREE.Scene()
    const fov = 36
    const camera = new THREE.PerspectiveCamera(fov, 16 / 9, 0.1, 45)
    const camZ = 6.8
    camera.position.set(0, 0, camZ)

    const hemiLight = new THREE.HemisphereLight(0xf3f0ff, 0x161426, 0.88)
    scene.add(hemiLight)

    const keyLight = new THREE.DirectionalLight(0xfff9fd, 2.15)
    keyLight.position.set(-4.8, 5.6, 5.2)
    scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0x966dfc, 0.95)
    fillLight.position.set(5.2, -2.5, 4.2)
    scene.add(fillLight)

    const rimLight = new THREE.DirectionalLight(0xf4a9c9, 1.45)
    rimLight.position.set(2.5, 3.8, -5.0)
    scene.add(rimLight)

    const ribbonRoot = new THREE.Group()
    ribbonRoot.position.set(0, 0, -3.5)
    scene.add(ribbonRoot)

    const wordmarkMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(propsRef.current.palette.tubeBase),
      emissive: new THREE.Color(propsRef.current.palette.tubeSpec),
      emissiveIntensity: 0.03,
      roughness: 0.3,
      metalness: 0.22,
      clearcoat: 0.72,
      clearcoatRoughness: 0.22,
      sheen: 0.45,
      sheenColor: new THREE.Color(propsRef.current.palette.tubeSpec),
      transparent: true,
      opacity: 0.24,
    })
    const decoyMat = wordmarkMat.clone()

    const tubeRadius = TUBE_STYLE_DEFAULTS.radius
    const trackPitch = tubeRadius * (2 + TUBE_STYLE_DEFAULTS.gapRatio)
    const wordmarkBuilt = buildConcentricTubeBundles(HIDDEN_WORDMARK_SPECS, wordmarkMat, tubeRadius, trackPitch)
    const decoyBuilt = buildConcentricTubeBundles(HIDDEN_DECOY_BUNDLES, decoyMat, tubeRadius, trackPitch)
    decoyBuilt.group.position.z = -0.1
    ribbonRoot.add(decoyBuilt.group)
    ribbonRoot.add(wordmarkBuilt.group)

    const topGeo = buildCapsuleHalfGeometry('top')
    const bottomGeo = buildCapsuleHalfGeometry('bottom')
    const seamDiscGeo = new THREE.CylinderGeometry(CAPSULE_RADIUS * 0.95, CAPSULE_RADIUS * 0.95, 0.055, 32)
    seamDiscGeo.scale(1.0, 1.0, 0.88)
    seamDiscGeo.rotateZ(0.08)

    const bodyLeftTex = createGradientTexture([
      [0.0, '#F5F0FF'],
      [0.45, '#E4D8FC'],
      [1.0, '#D4C3FA'],
    ])
    const bodyRightTex = createGradientTexture([
      [0.0, '#F1EAFF'],
      [0.5, '#DACBFA'],
      [1.0, '#CAB2F9'],
    ])
    const seamPurpleTex = createGradientTexture([
      [0.0, '#B397FC'],
      [0.55, '#966DFC'],
      [1.0, '#8053F2'],
    ])
    const accentPurpleTex = createGradientTexture([
      [0.0, '#B397FC'],
      [0.5, '#7E54F6'],
      [1.0, '#6B2CD1'],
    ])

    const symbolTopMat = new THREE.MeshPhysicalMaterial({
      map: bodyLeftTex,
      emissive: new THREE.Color('#4A327A'),
      emissiveIntensity: 0.1,
      roughness: 0.14,
      metalness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      sheen: 0.55,
      sheenColor: new THREE.Color('#E4D8FC'),
      transparent: true,
      opacity: 0.92,
    })

    const symbolBottomMat = new THREE.MeshPhysicalMaterial({
      map: bodyRightTex,
      emissive: new THREE.Color('#502D96'),
      emissiveIntensity: 0.14,
      roughness: 0.08,
      metalness: 0.06,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      sheen: 0.75,
      sheenColor: new THREE.Color('#D4C3FA'),
      transparent: true,
      opacity: 0.54,
      depthWrite: false,
      side: THREE.DoubleSide,
    })

    const seamOvalMat = new THREE.MeshPhysicalMaterial({
      map: seamPurpleTex,
      emissive: new THREE.Color('#8053F2'),
      emissiveIntensity: 0.42,
      roughness: 0.18,
      metalness: 0.1,
      clearcoat: 0.9,
      clearcoatRoughness: 0.12,
    })

    const accentTopMat = new THREE.MeshPhysicalMaterial({
      map: accentPurpleTex,
      emissive: new THREE.Color('#502D96'),
      emissiveIntensity: 0.2,
      roughness: 0.14,
      metalness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      sheen: 0.5,
      sheenColor: new THREE.Color('#F4A9C9'),
    })

    const accentBottomMat = new THREE.MeshPhysicalMaterial({
      map: bodyRightTex,
      emissive: new THREE.Color('#6B2CD1'),
      emissiveIntensity: 0.18,
      roughness: 0.08,
      metalness: 0.06,
      transparent: true,
      opacity: 0.46,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      depthWrite: false,
      side: THREE.DoubleSide,
    })

    const symbolTopInst = new THREE.InstancedMesh(topGeo, symbolTopMat, MAX_CAPSULES)
    const symbolBottomInst = new THREE.InstancedMesh(bottomGeo, symbolBottomMat, MAX_CAPSULES)
    const symbolSeamInst = new THREE.InstancedMesh(seamDiscGeo, seamOvalMat, MAX_CAPSULES)

    const accentTopInst = new THREE.InstancedMesh(topGeo, accentTopMat, MAX_CAPSULES)
    const accentBottomInst = new THREE.InstancedMesh(bottomGeo, accentBottomMat, MAX_CAPSULES)
    const accentSeamInst = new THREE.InstancedMesh(seamDiscGeo, seamOvalMat, MAX_CAPSULES)

    symbolSeamInst.renderOrder = 1
    symbolTopInst.renderOrder = 2
    symbolBottomInst.renderOrder = 3
    accentSeamInst.renderOrder = 1
    accentTopInst.renderOrder = 2
    accentBottomInst.renderOrder = 3

    for (const inst of [
      symbolSeamInst,
      symbolTopInst,
      symbolBottomInst,
      accentSeamInst,
      accentTopInst,
      accentBottomInst,
    ]) {
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      scene.add(inst)
    }

    // Shiny (rare) capsule: same v2 geometry at 1.8x scale, Blush Pink (#F4A9C9 -> #F971B3) + iridescent rim + Purple seam (#966DFC)
    const shinyBodyTex = createGradientTexture([
      [0, '#F4A9C9'],
      [0.52, '#F78BBF'],
      [1, '#F971B3'],
    ])
    const shinyTopMat = new THREE.MeshPhysicalMaterial({
      map: shinyBodyTex,
      emissive: new THREE.Color('#F971B3'),
      emissiveIntensity: 0.22,
      roughness: 0.12,
      metalness: 0.14,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      iridescence: 1.0,
      iridescenceIOR: 1.48,
      iridescenceThicknessRange: [180, 520],
      sheen: 0.8,
      sheenColor: new THREE.Color('#FFE0F0'),
      transparent: true,
      opacity: 1,
    })
    const shinyBottomMat = new THREE.MeshPhysicalMaterial({
      map: shinyBodyTex,
      emissive: new THREE.Color('#F4A9C9'),
      emissiveIntensity: 0.18,
      roughness: 0.09,
      metalness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      iridescence: 1.0,
      iridescenceIOR: 1.5,
      iridescenceThicknessRange: [200, 560],
      sheen: 0.85,
      sheenColor: new THREE.Color('#E8D5FF'),
      transparent: true,
      opacity: 0.82,
    })
    const shinySeamMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#966DFC'),
      emissive: new THREE.Color('#966DFC'),
      emissiveIntensity: 0.45,
      roughness: 0.16,
      metalness: 0.12,
      clearcoat: 1.0,
      iridescence: 0.75,
      iridescenceIOR: 1.4,
      transparent: true,
      opacity: 1,
    })

    const shinyGroup = new THREE.Group()
    shinyGroup.visible = false
    const shinyTopMesh = new THREE.Mesh(topGeo, shinyTopMat)
    const shinyBottomMesh = new THREE.Mesh(bottomGeo, shinyBottomMat)
    const shinySeamMesh = new THREE.Mesh(seamDiscGeo, shinySeamMat)
    shinySeamMesh.renderOrder = 4
    shinyTopMesh.renderOrder = 5
    shinyBottomMesh.renderOrder = 6
    shinyGroup.add(shinySeamMesh, shinyTopMesh, shinyBottomMesh)
    scene.add(shinyGroup)

    // Sparkle sprites for periodic twinkle (2-3) and click burst (10)
    const sparkleTex = createSparkleTexture()
    const SPARKLE_COUNT = 10
    const sparkles: Array<{
      sprite: THREE.Sprite
      mat: THREE.SpriteMaterial
      dirX: number
      dirY: number
      offsetAngle: number
      offsetDist: number
      phase: number
    }> = []
    for (let i = 0; i < SPARKLE_COUNT; i++) {
      const mat = new THREE.SpriteMaterial({
        map: sparkleTex,
        color: i % 2 === 0 ? '#FFE6F4' : '#D9C2FF',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const sprite = new THREE.Sprite(mat)
      sprite.visible = false
      sprite.renderOrder = 10
      scene.add(sprite)
      const a = (i / SPARKLE_COUNT) * Math.PI * 2 + 0.35
      sparkles.push({
        sprite,
        mat,
        dirX: Math.cos(a),
        dirY: Math.sin(a),
        offsetAngle: a,
        offsetDist: 0.55 + (i % 3) * 0.2,
        phase: (i * 0.27) % 1,
      })
    }

    const sizeRef = { w: root.clientWidth || 1440, h: root.clientHeight || 900 }
    const syncSize = () => {
      sizeRef.w = Math.max(1, root.clientWidth)
      sizeRef.h = Math.max(1, root.clientHeight)
      camera.aspect = sizeRef.w / sizeRef.h
      camera.updateProjectionMatrix()
      appliedDpr = computeDpr(propsRef.current.degradationStage)
      renderer.setPixelRatio(appliedDpr)
      renderer.setSize(sizeRef.w, sizeRef.h, false)
    }
    syncSize()

    const ro = new ResizeObserver(() => {
      syncSize()
      if (reducedMedia.matches || propsRef.current.degradationStage >= 2) {
        renderFrame(0, performance.now())
      }
    })
    ro.observe(root)

    const reducedMedia = window.matchMedia('(prefers-reduced-motion: reduce)')

    let bodies: FloatingCapsule[] = []
    let bodyKey = ''

    function rebuildBodies(count: number, aspect: number, accentRatio: number) {
      if (count <= 0) {
        symbolTopInst.count = 0
        symbolBottomInst.count = 0
        symbolSeamInst.count = 0
        accentTopInst.count = 0
        accentBottomInst.count = 0
        accentSeamInst.count = 0
        bodies = []
        return
      }
      const rnd = createSeededRandom(20261122 + count * 41 + Math.round(aspect * 7) + accentRatio * 13)
      const margin = 0.14
      const span = 1 + margin * 2

      const minSeamPurple = count >= 16 ? 4 : Math.max(2, Math.floor(count * 0.2))
      const accentTarget = Math.max(minSeamPurple, Math.round((count * accentRatio) / 100))
      const symbolTarget = Math.max(6, count - accentTarget)

      const cols = Math.max(3, Math.round(Math.sqrt(count * 1.4 * aspect)))
      const rows = Math.max(2, Math.ceil((count * 1.4) / cols))
      const spots: Array<[number, number]> = []

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const u = -margin + ((c + rnd()) / cols) * span
          const v = -margin + ((r + rnd()) / rows) * span
          spots.push([u, v])
        }
      }
      for (let i = spots.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1))
        const tmp = spots[i]!
        spots[i] = spots[j]!
        spots[j] = tmp
      }

      const depthLevels = [-1.95, -0.45, 0.95]
      const next: FloatingCapsule[] = []
      let symbolIdx = 0
      let accentIdx = 0

      for (let i = 0; i < count; i++) {
        const [u, v] = spots[i % spots.length]!
        let z = depthLevels[i % depthLevels.length]! + (rnd() - 0.5) * 0.35
        if (u < 0.16 && v < 0.46) {
          z = -2.1 - rnd() * 0.4
        }
        const axis = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize()
        const baseQuat = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(rnd() * Math.PI * 2, rnd() * Math.PI * 2, rnd() * Math.PI * 2),
        )
        const isAccentPurple = i >= symbolTarget

        next.push({
          u,
          v,
          z,
          scale: 0.86 + rnd() * 0.28,
          axis,
          baseQuat,
          spinSpeed: 0.24 + rnd() * 0.65,
          spinDir: rnd() < 0.5 ? -1 : 1,
          angle: rnd() * Math.PI * 2,
          hoverFactor: 0,
          pushX: 0,
          pushY: 0,
          isAccentPurple,
        })

        if (isAccentPurple) accentIdx++
        else symbolIdx++
      }

      symbolTopInst.count = symbolIdx
      symbolBottomInst.count = symbolIdx
      symbolSeamInst.count = symbolIdx
      accentTopInst.count = accentIdx
      accentBottomInst.count = accentIdx
      accentSeamInst.count = accentIdx
      bodies = next
    }

    const pointer = {
      x: 0.5,
      y: 0.5,
      overOpenDesktop: false,
      secretHoverMs: 0,
      secretFiredOnThisHover: false,
    }

    const isUiElement = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false
      return Boolean(
        target.closest(
          '.desktop-window, .desktop-menubar, .desktop-icons, .login-bg-dev-panel, .poster-mosaic-motion-toggle, dialog',
        ),
      )
    }

    // Shiny capsule state machine (at most 1 automatic spawn per visit)
    const initialWillSpawn =
      !propsRef.current.disableShiny &&
      !reducedMedia.matches &&
      propsRef.current.degradationStage < 2 &&
      Math.random() * 100 < propsRef.current.shinySpawnChance
    const initialSpawnDelayMs =
      SHINY_CAPSULE_CONFIG.spawnDelayMinMs +
      Math.random() * (SHINY_CAPSULE_CONFIG.spawnDelayMaxMs - SHINY_CAPSULE_CONFIG.spawnDelayMinMs)

    const shiny = {
      state: (initialWillSpawn ? 'waiting' : 'done') as 'waiting' | 'active' | 'popping' | 'done',
      spawnAtMs: performance.now() + initialSpawnDelayMs,
      corridor: { startU: -0.06, startV: 0.87, endU: 1.06, endV: 0.84 } as ShinyCorridor,
      progress: 0,
      u: -0.06,
      v: 0.87,
      nudgeV: 0,
      pushX: 0,
      pushY: 0,
      angle: 0.4,
      axis: new THREE.Vector3(0.28, 0.88, 0.38).normalize(),
      baseQuat: new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0.18, 0.12, (-CAPSULE_V2_GEOMETRY.angleDegrees * Math.PI) / 180),
      ),
      screenX: -999,
      screenY: -999,
      normX: 0.5,
      normY: 0.5,
      worldX: 0,
      worldY: 0,
      worldZ: 0.25,
      nextSparkleAt: performance.now() + 2200,
      sparkleUntil: 0,
      popElapsedMs: 0,
      hovering: false,
    }
    let seenManualShinyNonce = manualShinyRef.current

    const spawnShinyNow = (now: number, forceMidScreen = false) => {
      shiny.corridor = pickShinyCorridor(sizeRef.w, sizeRef.h, propsRef.current.windowRects)
      shiny.progress = forceMidScreen ? 0.14 : 0
      shiny.u = shiny.corridor.startU + (shiny.corridor.endU - shiny.corridor.startU) * shiny.progress
      shiny.v = shiny.corridor.startV + (shiny.corridor.endV - shiny.corridor.startV) * shiny.progress
      shiny.nudgeV = 0
      shiny.pushX = 0
      shiny.pushY = 0
      shiny.popElapsedMs = 0
      shiny.state = 'active'
      shiny.nextSparkleAt = now + 900
      shiny.sparkleUntil = now + 1500
      shinyTopMat.opacity = 1
      shinyBottomMat.opacity = 0.82
      shinySeamMat.opacity = 1
      shinyGroup.visible = true
      root.dataset.shinyState = 'active'
    }

    const hitTestShiny = (clientX: number, clientY: number): boolean => {
      if (shiny.state !== 'active') return false
      const rect = root.getBoundingClientRect()
      const lx = clientX - rect.left
      const ly = clientY - rect.top
      return Math.hypot(lx - shiny.screenX, ly - shiny.screenY) <= 72
    }

    const onPointerMove = (e: PointerEvent) => {
      const rect = root.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      const nx = (e.clientX - rect.left) / rect.width
      const ny = (e.clientY - rect.top) / rect.height
      pointer.x = nx
      pointer.y = ny
      pointer.overOpenDesktop =
        !isUiElement(e.target) &&
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom

      const isOverShiny = pointer.overOpenDesktop && hitTestShiny(e.clientX, e.clientY)
      if (isOverShiny !== shiny.hovering) {
        shiny.hovering = isOverShiny
        document.body.style.cursor = isOverShiny ? 'pointer' : ''
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      if (isUiElement(e.target)) return
      if (shiny.state !== 'active') return
      if (!hitTestShiny(e.clientX, e.clientY)) return

      shiny.state = 'popping'
      shiny.popElapsedMs = 0
      shiny.hovering = false
      document.body.style.cursor = ''
      root.dataset.shinyState = 'popping'
      propsRef.current.onShinyFound?.({ x: shiny.normX, y: shiny.normY })
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerdown', onPointerDown)

    const projA = new THREE.Vector3()
    const projB = new THREE.Vector3()
    function isPointerOverHiddenWordmark(nx: number, ny: number): boolean {
      const ndcX = nx * 2 - 1
      const ndcY = -(ny * 2 - 1)
      const hitRadiusSq = 0.068 * 0.068
      ribbonRoot.updateMatrixWorld(true)

      for (const spec of HIDDEN_WORDMARK_SPECS) {
        const pts = spec.points
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i]!
          const b = pts[i + 1]!
          projA.set(a[0] * 2.35, a[1] * 2.35, 0).applyMatrix4(wordmarkBuilt.group.matrixWorld).project(camera)
          projB.set(b[0] * 2.35, b[1] * 2.35, 0).applyMatrix4(wordmarkBuilt.group.matrixWorld).project(camera)
          if (distToSegmentSq(ndcX, ndcY, projA.x, projA.y, projB.x, projB.y) <= hitRadiusSq) {
            return true
          }
        }
      }
      return false
    }

    let offU = 0
    let offV = 0
    let smoothPx = 0.5
    let smoothPy = 0.5
    let smoothOver = 0
    let lastTime = 0
    let rafId = 0
    let disposed = false
    let readyNotified = false
    let fpsFrames = 0
    let fpsStart = performance.now()

    const dummy = new THREE.Object3D()
    const spinQuat = new THREE.Quaternion()
    const shinyProj = new THREE.Vector3()

    function renderFrame(dt: number, now: number) {
      const cfg = propsRef.current
      const aspect = sizeRef.w / sizeRef.h

      // Stage 1 degradation halves capsule count and lowers DPR
      const targetDpr = computeDpr(cfg.degradationStage)
      if (Math.abs(targetDpr - appliedDpr) > 0.02) {
        appliedDpr = targetDpr
        renderer.setPixelRatio(appliedDpr)
        renderer.setSize(sizeRef.w, sizeRef.h, false)
      }

      const rawCount =
        cfg.capsuleCount <= 0 ? 0 : Math.max(10, Math.min(MAX_CAPSULES, Math.round(cfg.capsuleCount)))
      const effectiveCount =
        rawCount === 0 ? 0 : cfg.degradationStage >= 1 ? Math.max(8, Math.ceil(rawCount / 2)) : rawCount
      const key = `${effectiveCount}|${Math.round(aspect * 5)}|${cfg.purpleAccentRatio}`
      if (key !== bodyKey) {
        bodyKey = key
        rebuildBodies(effectiveCount, aspect, cfg.purpleAccentRatio)
      }

      const isReduced = reducedMedia.matches
      const isFrozen = isReduced || cfg.paused || document.hidden || cfg.degradationStage >= 2

      const lightAngleDeg = cfg.hiddenLightAngle ?? cfg.palette.defaultLightAngle
      const lightRad = (lightAngleDeg * Math.PI) / 180
      keyLight.position.set(Math.cos(lightRad) * 6.8, Math.sin(lightRad) * 6.0 + 1.4, 4.8)
      rimLight.color.set(cfg.palette.rimColor)

      // Apply subtle night/dawn tube contrast boost so dark bands keep sleek 3D depth without revealing letters
      const boostedContrast = Math.min(100, cfg.hiddenContrast + cfg.palette.tubeContrastBoost)
      const contrastNorm = Math.max(0, Math.min(1, boostedContrast / 100))
      wordmarkMat.color.set(cfg.palette.tubeBase)
      wordmarkMat.emissive.set(cfg.palette.tubeSpec)
      wordmarkMat.emissiveIntensity = 0.015 + contrastNorm * 0.36
      wordmarkMat.sheenColor.set(cfg.palette.tubeSpec)
      wordmarkMat.opacity = 0.16 + contrastNorm * 0.78
      wordmarkMat.roughness = 0.31 - contrastNorm * 0.14

      // Identical material at default low contrast; slightly softer decoy at high inspection contrast (>70%)
      const rawNorm = Math.max(0, Math.min(1, cfg.hiddenContrast / 100))
      const inspectionSoften = rawNorm > 0.7 ? (rawNorm - 0.7) / 0.3 : 0
      decoyMat.color.set(cfg.palette.tubeBase)
      decoyMat.emissive.set(cfg.palette.tubeSpec)
      decoyMat.emissiveIntensity = wordmarkMat.emissiveIntensity * (1 - inspectionSoften * 0.62)
      decoyMat.sheenColor.set(cfg.palette.tubeSpec)
      decoyMat.opacity = wordmarkMat.opacity * (1 - inspectionSoften * 0.5)
      decoyMat.roughness = wordmarkMat.roughness + inspectionSoften * 0.1

      const visibleDecoys = Math.round(
        (Math.max(0, Math.min(3, cfg.decoyDensity)) / 3) * decoyBuilt.bundleGroups.length,
      )
      for (let i = 0; i < decoyBuilt.bundleGroups.length; i++) {
        decoyBuilt.bundleGroups[i]!.visible = i < visibleDecoys
      }

      ribbonRoot.scale.setScalar(cfg.hiddenScale)
      ribbonRoot.position.set(
        (cfg.hiddenOffsetX / 100) * 6.5,
        (cfg.hiddenOffsetY / 100) * 4.0,
        -3.5,
      )

      // Shiny capsule trigger & lifecycle (never shown on reduced motion, disableShiny, or low-FPS stage 2+)
      const shinyAllowed = !cfg.disableShiny && !isReduced && cfg.degradationStage < 2
      if (!shinyAllowed) {
        shinyGroup.visible = false
        for (const sp of sparkles) sp.sprite.visible = false
        if (shiny.hovering) {
          shiny.hovering = false
          document.body.style.cursor = ''
        }
        if (root) root.dataset.shinyState = 'disabled'
      } else {
        if (manualShinyRef.current !== seenManualShinyNonce) {
          seenManualShinyNonce = manualShinyRef.current
          spawnShinyNow(now, true)
        } else if (shiny.state === 'waiting' && !isFrozen && now >= shiny.spawnAtMs) {
          spawnShinyNow(now, false)
        }
      }

      if (!isFrozen && dt > 0 && pointer.overOpenDesktop) {
        if (isPointerOverHiddenWordmark(pointer.x, pointer.y)) {
          pointer.secretHoverMs += dt * 1000
          if (pointer.secretHoverMs >= SECRET_HOVER_TRIGGER_MS && !pointer.secretFiredOnThisHover) {
            pointer.secretFiredOnThisHover = true
            cfg.onSecretHover?.({ x: pointer.x, y: pointer.y })
          }
        } else {
          pointer.secretHoverMs = 0
          pointer.secretFiredOnThisHover = false
        }
      } else if (!pointer.overOpenDesktop) {
        pointer.secretHoverMs = 0
        pointer.secretFiredOnThisHover = false
      }

      const speedFactor = isFrozen
        ? 0
        : (Math.max(0, Math.min(80, cfg.capsuleSpeed)) / 50) * (cfg.inputFocused ? 0.5 : 1)
      const driftRad = (145 * Math.PI) / 180
      offU += Math.cos(driftRad) * 0.02 * dt * speedFactor
      offV += Math.sin(driftRad) * 0.02 * aspect * dt * speedFactor

      const margin = 0.14
      const span = 1 + margin * 2
      const wrap = (val: number) => ((((val + margin) % span) + span) % span) - margin

      if (dt > 0) {
        const kPos = 1 - Math.exp(-dt / 0.085)
        smoothPx += (pointer.x - smoothPx) * kPos
        smoothPy += (pointer.y - smoothPy) * kPos
        smoothOver += ((pointer.overOpenDesktop && !isFrozen ? 1 : 0) - smoothOver) * (1 - Math.exp(-dt / 0.22))
      }

      const hoverR = 0.16
      const pushStrength = (0.1 * smoothOver) / (hoverR * 0.65)
      const pushSigma = 1 / (hoverR * hoverR * 0.42)
      const kHover = dt > 0 ? 1 - Math.exp(-dt / 0.2) : 1
      const kPush = dt > 0 ? 1 - Math.exp(-dt / 0.18) : 1

      const halfFovTan = Math.tan(((fov * Math.PI) / 180) / 2)
      const worldHeightAt0 = 2 * camZ * halfFovTan
      const baseWorldSize = (112 / Math.max(400, sizeRef.h)) * worldHeightAt0

      let symbolIdx = 0
      let accentIdx = 0

      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i]!
        let u = wrap(b.u + offU)
        let v = wrap(b.v + offV)

        const dx = u - smoothPx
        const dy = (v - smoothPy) / aspect
        const dist = Math.hypot(dx, dy)
        const targetHover = smoothstep(hoverR, 0, dist) * smoothOver
        b.hoverFactor += (targetHover - b.hoverFactor) * kHover

        const pushAmt = pushStrength * Math.exp(-dist * dist * pushSigma)
        b.pushX += (dx * pushAmt - b.pushX) * kPush
        b.pushY += (dy * pushAmt * aspect - b.pushY) * kPush
        u += b.pushX
        v += b.pushY

        let z = b.z
        if (u < 0.16 && v < 0.46 && z > -1.8) {
          z = -2.05
        }

        const spinBoost = 1 + b.hoverFactor * 2.2
        b.angle += b.spinSpeed * b.spinDir * dt * speedFactor * spinBoost
        spinQuat.setFromAxisAngle(b.axis, b.angle)

        const depthScale = (camZ - z) / camZ
        const halfH = camZ * halfFovTan * depthScale
        const halfW = halfH * aspect

        const wx = (u * 2 - 1) * halfW
        const wy = (1 - v * 2) * halfH
        const wz = z
        const capsuleScale = baseWorldSize * b.scale

        dummy.quaternion.copy(spinQuat).multiply(b.baseQuat)
        dummy.position.set(wx, wy, wz)
        dummy.scale.setScalar(capsuleScale)
        dummy.updateMatrix()

        if (b.isAccentPurple) {
          accentTopInst.setMatrixAt(accentIdx, dummy.matrix)
          accentBottomInst.setMatrixAt(accentIdx, dummy.matrix)
          accentSeamInst.setMatrixAt(accentIdx, dummy.matrix)
          accentIdx++
        } else {
          symbolTopInst.setMatrixAt(symbolIdx, dummy.matrix)
          symbolBottomInst.setMatrixAt(symbolIdx, dummy.matrix)
          symbolSeamInst.setMatrixAt(symbolIdx, dummy.matrix)
          symbolIdx++
        }
      }

      // Update Shiny Capsule + Sparkles
      if (!shinyAllowed) {
        shinyGroup.visible = false
        for (const sp of sparkles) sp.sprite.visible = false
      } else if (shiny.state === 'active' || shiny.state === 'popping') {
        const shinyZ = shiny.worldZ
        const shinyDepthScale = (camZ - shinyZ) / camZ
        const shinyHalfH = camZ * halfFovTan * shinyDepthScale
        const shinyHalfW = shinyHalfH * aspect
        const shinyBaseScale = baseWorldSize * SHINY_CAPSULE_CONFIG.scaleMultiplier

        if (shiny.state === 'active') {
          if (!isFrozen && dt > 0) {
            // Slower than normal capsules (~36s across screen)
            const shinySpeed = 0.028 * Math.max(0.45, speedFactor)
            shiny.progress += dt * shinySpeed
            if (shiny.progress >= 1.04) {
              shiny.state = 'done'
              shinyGroup.visible = false
              for (const sp of sparkles) sp.sprite.visible = false
              if (root) {
                root.dataset.shinyState = 'done'
                delete root.dataset.shinyPos
              }
            }
          }

          if (shiny.state === 'active') {
            const baseU =
              shiny.corridor.startU + (shiny.corridor.endU - shiny.corridor.startU) * shiny.progress
            const baseV =
              shiny.corridor.startV +
              (shiny.corridor.endV - shiny.corridor.startV) * shiny.progress +
              Math.sin(shiny.progress * Math.PI * 3) * 0.022

            // Gently steer away if a dragged window overlaps current path
            const curPx = baseU * sizeRef.w
            const curPy = (baseV + shiny.nudgeV) * sizeRef.h
            const targetNudge = pointInsideObstacles(curPx, curPy, cfg.windowRects, 42)
              ? curPy < sizeRef.h * 0.5
                ? -0.09
                : 0.09
              : 0
            shiny.nudgeV += (targetNudge - shiny.nudgeV) * (dt > 0 ? 1 - Math.exp(-dt * 2.5) : 1)

            // Gentle hover push (same feel as other capsules, never scatters)
            const sdx = baseU - smoothPx
            const sdy = (baseV + shiny.nudgeV - smoothPy) / aspect
            const sdist = Math.hypot(sdx, sdy)
            const sPushAmt = pushStrength * 0.72 * Math.exp(-sdist * sdist * pushSigma)
            shiny.pushX += (sdx * sPushAmt - shiny.pushX) * kPush
            shiny.pushY += (sdy * sPushAmt * aspect - shiny.pushY) * kPush

            shiny.u = baseU + shiny.pushX
            shiny.v = Math.max(0.06, Math.min(0.94, baseV + shiny.nudgeV + shiny.pushY))
            shiny.worldX = (shiny.u * 2 - 1) * shinyHalfW
            shiny.worldY = (1 - shiny.v * 2) * shinyHalfH

            if (!isFrozen && dt > 0) {
              shiny.angle += 0.34 * dt * Math.max(0.4, speedFactor)
            }
            spinQuat.setFromAxisAngle(shiny.axis, shiny.angle)
            shinyGroup.quaternion.copy(spinQuat).multiply(shiny.baseQuat)
            shinyGroup.position.set(shiny.worldX, shiny.worldY, shinyZ)
            shinyGroup.scale.setScalar(shinyBaseScale)
            shinyGroup.visible = true

            // Project to screen coords for hit-testing and inspection
            shinyProj.set(shiny.worldX, shiny.worldY, shinyZ).project(camera)
            shiny.normX = (shinyProj.x + 1) * 0.5
            shiny.normY = (1 - shinyProj.y) * 0.5
            shiny.screenX = shiny.normX * sizeRef.w
            shiny.screenY = shiny.normY * sizeRef.h
            if (root) root.dataset.shinyPos = `${Math.round(shiny.screenX)},${Math.round(shiny.screenY)}`

            // Periodic 2-3 sparkles every 4-6s
            if (now >= shiny.nextSparkleAt) {
              const interval =
                SHINY_CAPSULE_CONFIG.sparkleIntervalMinMs +
                Math.random() *
                  (SHINY_CAPSULE_CONFIG.sparkleIntervalMaxMs -
                    SHINY_CAPSULE_CONFIG.sparkleIntervalMinMs)
              shiny.sparkleUntil = now + 680
              shiny.nextSparkleAt = now + interval
            }
            const sparkleActive = now <= shiny.sparkleUntil
            const sparklePhase = sparkleActive ? 1 - (shiny.sparkleUntil - now) / 680 : 0
            for (let i = 0; i < sparkles.length; i++) {
              const sp = sparkles[i]!
              if (sparkleActive && i < 3) {
                const wave = Math.sin(Math.min(1, Math.max(0, sparklePhase)) * Math.PI)
                const ang = sp.offsetAngle + now * 0.0008
                const rad = shinyBaseScale * sp.offsetDist
                sp.sprite.position.set(
                  shiny.worldX + Math.cos(ang) * rad,
                  shiny.worldY + Math.sin(ang) * rad,
                  shinyZ + 0.12,
                )
                const sz = shinyBaseScale * (0.28 + wave * 0.24)
                sp.sprite.scale.set(sz, sz, 1)
                sp.mat.opacity = wave * 0.92
                sp.sprite.visible = true
              } else {
                sp.sprite.visible = false
              }
            }
          }
        } else if (shiny.state === 'popping') {
          shiny.popElapsedMs += dt * 1000
          const t = Math.min(1, shiny.popElapsedMs / SHINY_CAPSULE_CONFIG.popDurationMs)
          const eased = 1 - Math.pow(1 - t, 3)

          shinyGroup.position.set(shiny.worldX, shiny.worldY, shinyZ)
          shinyGroup.scale.setScalar(shinyBaseScale * (1 + eased * 0.78))
          shinyTopMat.opacity = Math.max(0, 1 - eased)
          shinyBottomMat.opacity = Math.max(0, 0.82 * (1 - eased))
          shinySeamMat.opacity = Math.max(0, 1 - eased)

          // Radial sparkle burst (10 sprites)
          for (let i = 0; i < sparkles.length; i++) {
            const sp = sparkles[i]!
            const dist = shinyBaseScale * (0.35 + eased * (1.25 + (i % 3) * 0.35))
            sp.sprite.position.set(
              shiny.worldX + sp.dirX * dist,
              shiny.worldY + sp.dirY * dist,
              shinyZ + 0.16,
            )
            const sz = shinyBaseScale * (0.42 * (1 - eased * 0.45))
            sp.sprite.scale.set(sz, sz, 1)
            sp.mat.opacity = Math.max(0, (1 - t) * 0.98)
            sp.sprite.visible = t < 0.98
          }

          if (t >= 1) {
            shiny.state = 'done'
            shinyGroup.visible = false
            for (const sp of sparkles) sp.sprite.visible = false
            if (root) {
              root.dataset.shinyState = 'done'
              delete root.dataset.shinyPos
            }
          }
        }
      }

      for (const inst of [
        symbolTopInst,
        symbolBottomInst,
        symbolSeamInst,
        accentTopInst,
        accentBottomInst,
        accentSeamInst,
      ]) {
        inst.instanceMatrix.needsUpdate = true
      }

      renderer.render(scene, camera)
      if (!readyNotified) {
        readyNotified = true
        cfg.onReady?.()
      }
    }

    let loopRunning = false
    const tick = (now: number) => {
      if (disposed) return
      // Stage 2+ or paused stops the 3D RAF loop completely so no GPU frames render in background routes
      if (propsRef.current.degradationStage >= 2 || propsRef.current.paused) {
        loopRunning = false
        renderFrame(0, now)
        return
      }
      rafId = requestAnimationFrame(tick)
      if (document.hidden) {
        lastTime = now
        return
      }
      const dt = lastTime === 0 ? 1 / 60 : Math.min((now - lastTime) / 1000, 1 / 20)
      lastTime = now
      renderFrame(dt, now)

      fpsFrames++
      if (now - fpsStart >= 500) {
        const fps = Math.round((fpsFrames * 1000) / (now - fpsStart))
        propsRef.current.onFpsSample?.(fps)
        fpsFrames = 0
        fpsStart = now
      }
    }

    const startLoop = () => {
      if (disposed || loopRunning || reducedMedia.matches || propsRef.current.degradationStage >= 2 || propsRef.current.paused) {
        return
      }
      loopRunning = true
      lastTime = 0
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(tick)
    }
    resumeLoopRef.current = startLoop

    const onVisibility = () => {
      if (!document.hidden) lastTime = 0
    }
    const onReducedChange = () => {
      if (reducedMedia.matches) {
        loopRunning = false
        cancelAnimationFrame(rafId)
        renderFrame(0, performance.now())
      } else {
        startLoop()
      }
    }

    document.addEventListener('visibilitychange', onVisibility)
    reducedMedia.addEventListener('change', onReducedChange)

    if (reducedMedia.matches || propsRef.current.degradationStage >= 2 || propsRef.current.paused) {
      renderFrame(0, performance.now())
    } else {
      startLoop()
    }

    return () => {
      disposed = true
      loopRunning = false
      resumeLoopRef.current = null
      cancelAnimationFrame(rafId)
      ro.disconnect()
      if (shiny.hovering) document.body.style.cursor = ''
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('visibilitychange', onVisibility)
      reducedMedia.removeEventListener('change', onReducedChange)
      wordmarkBuilt.geometries.forEach((g) => g.dispose())
      decoyBuilt.geometries.forEach((g) => g.dispose())
      wordmarkMat.dispose()
      decoyMat.dispose()
      topGeo.dispose()
      bottomGeo.dispose()
      seamDiscGeo.dispose()
      bodyLeftTex.dispose()
      bodyRightTex.dispose()
      seamPurpleTex.dispose()
      accentPurpleTex.dispose()
      shinyBodyTex.dispose()
      sparkleTex.dispose()
      symbolTopMat.dispose()
      symbolBottomMat.dispose()
      seamOvalMat.dispose()
      accentTopMat.dispose()
      accentBottomMat.dispose()
      shinyTopMat.dispose()
      shinyBottomMat.dispose()
      shinySeamMat.dispose()
      sparkles.forEach((sp) => sp.mat.dispose())
      renderer.dispose()
    }
  }, [])

  return (
    <div ref={rootRef} className="desktop-wallpaper-canvas-host">
      <canvas ref={canvasRef} aria-hidden="true" className="login-bg-canvas" />
    </div>
  )
}
