import {
  AdditiveBlending, BackSide, BoxGeometry, BufferAttribute, CanvasTexture, Color, CustomBlending, DoubleSide,
  Group, InstancedBufferAttribute, InstancedMesh, LatheGeometry, Matrix4, Mesh, MeshBasicMaterial, OneFactor,
  OneMinusSrcAlphaFactor, PlaneGeometry, Scene, ShaderMaterial, SRGBColorSpace, Vector2,
} from 'three'
import type { BufferGeometry } from 'three'
import { BRAND_CAPSULE_COLORS, CAPSULE_SEAM_X, capsuleProfileSamples, capsuleRadiusAt, type CapsuleColors } from './capsule-shape.ts'

/**
 * The capsule every 3D scene of the service draws (canonical model): the logo v2 stadium lathe with its seam, the
 * additive frosted-glass shell in two tones, the small light inside and the soft halo around it. 내 메이트's pile and the
 * records board draw it instanced; the records' empty jar, the invite dome and the still renders
 * (`src/assets/capsule/capsule-render.html`) draw single ones through `createCapsuleFigure`.
 *
 * Every material is additive light, made for a dark page: no outline, no refraction — the glass is a fresnel rim and
 * the studio's soft boxes. On an opaque canvas (내 메이트, the board) the light adds onto the clear colour. On a
 * transparent canvas, `forAlphaCanvas` makes each fragment carry an alpha equal to its brightest channel, so the page
 * behind shows through the clear middle and the canvas composites like light over it.
 */

export { CAPSULE_ASPECT, CAPSULE_SEAM_OFFSET, CAPSULE_SEAM_X, capsuleRadiusAt, BRAND_CAPSULE_COLORS } from './capsule-shape.ts'
export type { CapsuleColors } from './capsule-shape.ts'

/**
 * Appended to every additive fragment shader here. Inert unless `CAPSULE_ALPHA_CANVAS` is defined (forAlphaCanvas):
 * then the colour is premultiplied by the alpha the additive blend used to apply, and the alpha becomes the brightest
 * channel — light over a transparent canvas.
 */
const ALPHA_CANVAS_OUTPUT = /* glsl */ `
        #ifdef CAPSULE_ALPHA_CANVAS
          gl_FragColor.rgb *= gl_FragColor.a;
          gl_FragColor.a = clamp(max(max(gl_FragColor.r, gl_FragColor.g), gl_FragColor.b), 0.0, 1.0);
        #endif`

/**
 * Makes one of this module's additive materials composite correctly on a transparent canvas (`alpha: true`): light
 * adds onto what is already drawn, and the canvas alpha grows with it (over-blending), so the page shows through.
 */
export function forAlphaCanvas<T extends ShaderMaterial>(material: T): T {
  material.defines = { ...material.defines, CAPSULE_ALPHA_CANVAS: '' }
  material.blending = CustomBlending
  material.blendSrc = OneFactor
  material.blendDst = OneFactor
  material.blendSrcAlpha = OneFactor
  material.blendDstAlpha = OneMinusSrcAlphaFactor
  material.needsUpdate = true
  return material
}

// ── Geometry ──────────────────────────────────────────────────────────────────

/**
 * The part [fromX, toX] of the unit-length capsule, lying along +x. Vertex colours: frosted half below the seam,
 * tinted half above it (logo v2 two tones).
 */
export function capsuleGeometry(fromX: number, toX: number, frosted: Color, tint: Color, radialSegments = 32) {
  const ys = capsuleProfileSamples(fromX, toX)
  const geometry = new LatheGeometry(ys.map((x) => new Vector2(capsuleRadiusAt(x), x)), radialSegments)
  geometry.rotateZ(-Math.PI / 2)
  const position = geometry.getAttribute('position')
  const colors = new Float32Array(position.count * 3)
  for (let index = 0; index < position.count; index++) {
    const color = position.getX(index) < CAPSULE_SEAM_X ? frosted : tint
    colors.set([color.r, color.g, color.b], index * 3)
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  return geometry
}

/** Dark studio with a few soft boxes: glass on a dark page shows crisp highlights, not a bright room. */
export function capsuleStudioEnvironment() {
  const environment = new Scene()
  environment.add(new Mesh(new BoxGeometry(12, 12, 12), new MeshBasicMaterial({ color: '#0c0b13', side: BackSide })))
  const softBox = (w: number, h: number, x: number, y: number, z: number, intensity: number, tint = '#ffffff') => {
    const panel = new Mesh(
      new PlaneGeometry(w, h),
      new MeshBasicMaterial({ color: new Color(tint).multiplyScalar(intensity), side: DoubleSide }),
    )
    panel.position.set(x, y, z)
    panel.lookAt(0, 0, 0)
    environment.add(panel)
  }
  softBox(1.4, 7, -4.5, 0.5, 2.5, 2.4)
  softBox(0.7, 7, 4.8, 0.5, -0.8, 1.4, '#d9d5f1')
  softBox(3, 0.8, 0, 5.2, 0.5, 0.7)
  return environment
}

export function radialGlowTexture(stops: readonly [number, string][]) {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d')!
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  for (const [offset, color] of stops) gradient.addColorStop(offset, color)
  context.fillStyle = gradient
  context.fillRect(0, 0, size, size)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

// ── Materials ─────────────────────────────────────────────────────────────────

/**
 * Glass shell of a capsule, drawn additively: frosted / pale violet glass that is clear in the middle and catches
 * light at the rim, a faint band of light along the seam, lit from inside by its core. Low gloss on purpose.
 * Drawn in the opaque pass (additive, no depth write).
 */
export function shellMaterial(instanced: boolean, glow: Color) {
  return new ShaderMaterial({
    defines: instanced ? {} : { SINGLE_CAPSULE: '' },
    vertexColors: true,
    uniforms: {
      uGlowColor: { value: glow },
      uLight: { value: new Color('#ffffff') },
      uTint: { value: new Color('#ffffff') },
      uKeepsake: { value: 0 },
      uSeamX: { value: CAPSULE_SEAM_X },
      uStrength: { value: 1 },
      uOpacity: { value: 1 },
      uGlow: { value: 1 },
      uWeight: { value: 0.6 },
    },
    vertexShader: /* glsl */ `
      uniform float uSeamX;
      #ifdef SINGLE_CAPSULE
        uniform float uGlow;
        uniform float uWeight;
        uniform vec3 uGlowColor;
        uniform vec3 uLight;
        uniform vec3 uTint;
        uniform float uKeepsake;
      #else
        attribute float instanceGlow;
        attribute float instanceWeight;
        attribute vec3 instanceLight;
        attribute vec3 instanceTint;
        attribute vec3 instanceGlowColor;
        attribute float instanceKeepsake;
      #endif
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vCol;
      varying vec3 vGlowColor;
      varying float vX;
      varying float vAngle;
      varying float vGlow;
      varying float vWeight;
      varying float vKeepsake;
      void main() {
        // Each capsule's two tones and light: its connection's time band (vertex colours only mark the halves).
        #ifdef SINGLE_CAPSULE
          mat4 m = modelViewMatrix;
          vGlow = uGlow;
          vWeight = uWeight;
          vCol = position.x < uSeamX ? uLight : uTint;
          vGlowColor = uGlowColor;
          vKeepsake = uKeepsake;
        #else
          mat4 m = modelViewMatrix * instanceMatrix;
          vGlow = instanceGlow;
          vWeight = instanceWeight;
          vCol = position.x < uSeamX ? instanceLight : instanceTint;
          vGlowColor = instanceGlowColor;
          vKeepsake = instanceKeepsake;
        #endif
        vec4 mv = m * vec4(position, 1.0);
        vN = normalize(mat3(m) * normal);
        vV = normalize(-mv.xyz);
        vX = position.x;
        vAngle = atan(position.z, position.y);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uSeamX;
      uniform float uStrength;
      uniform float uOpacity;
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vCol;
      varying vec3 vGlowColor;
      varying float vX;
      varying float vAngle;
      varying float vGlow;
      varying float vWeight;
      varying float vKeepsake;
      void main() {
        vec3 n = normalize(vN);
        vec3 v = normalize(vV);
        float facing = abs(dot(n, v));
        float fresnel = pow(max(0.0, 1.0 - facing), 2.4);
        vec3 body = vCol * (0.03 + 0.36 * fresnel);
        vec3 inner = mix(vCol, vGlowColor, 0.5) * (0.04 + 0.2 * vWeight) * pow(clamp(facing, 0.0, 1.0), 1.4);
        float seam = exp(-pow((vX - uSeamX) / 0.018, 2.0));
        vec3 seamLight = vGlowColor * seam * (0.12 + 0.22 * vWeight);
        // Keepsake: a wider band of light along the seam with five small white stars on it.
        float band = exp(-pow((vX - uSeamX) / 0.05, 2.0));
        float stars = pow(max(0.0, cos(vAngle * 5.0)), 28.0) * exp(-pow((vX - uSeamX) / 0.03, 2.0));
        vec3 keepsakeLight = vKeepsake * (vGlowColor * band * 0.45 + vec3(1.0, 0.98, 1.0) * stars * 1.3);
        vec3 h = normalize(normalize(vec3(-0.45, 0.75, 0.5)) + v);
        float gloss = pow(max(dot(n, h), 0.0), 40.0) * 0.12;
        float side = gl_FrontFacing ? 1.0 : 0.45;
        vec3 color = ((body + inner + seamLight + keepsakeLight) * vGlow * uStrength + vec3(gloss)) * side * uOpacity;
        gl_FragColor = vec4(color, 1.0);
        ${ALPHA_CANVAS_OUTPUT}
      }
    `,
    transparent: false,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  })
}

/**
 * The small light inside each capsule: a soft star whose size and brightness grow clearly with the time spent
 * together. It breathes very slowly (`uBreath` = 0 when motion is reduced).
 */
export function coreMaterial(glow: Color) {
  return new ShaderMaterial({
    uniforms: { uGlowColor: { value: glow }, uTime: { value: 0 }, uBreath: { value: 1 }, uStrength: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float instanceGlow;
      attribute float instanceWeight;
      attribute vec3 instanceGlowColor;
      uniform float uTime;
      uniform float uBreath;
      varying vec2 vUv;
      varying float vIntensity;
      varying float vWeight;
      varying vec3 vGlowColor;
      void main() {
        vUv = uv;
        vWeight = instanceWeight;
        vGlowColor = instanceGlowColor;
        float breath = 1.0 + uBreath * 0.14 * sin(uTime * 0.85 + float(gl_InstanceID) * 2.399);
        vIntensity = (0.3 + 1.3 * instanceWeight) * instanceGlow * breath;
        vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float size = length(instanceMatrix[0].xyz) * (0.3 + 0.55 * instanceWeight) * (0.95 + 0.05 * breath);
        center.xy += position.xy * size;
        gl_Position = projectionMatrix * center;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uStrength;
      varying vec2 vUv;
      varying float vIntensity;
      varying float vWeight;
      varying vec3 vGlowColor;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float core = exp(-d * d * 26.0) * 0.95 + pow(max(0.0, 1.0 - d), 3.0) * 0.3;
        vec3 color = mix(vGlowColor, vec3(1.0, 0.98, 1.0), exp(-d * d * 70.0) * (0.5 + 0.5 * vWeight));
        gl_FragColor = vec4(color * core * vIntensity * uStrength, 1.0);
        ${ALPHA_CANVAS_OUTPUT}
      }
    `,
    transparent: false,
    depthWrite: false,
    blending: AdditiveBlending,
  })
}

/** Soft light around every capsule (camera-facing quads sharing the capsules' instance matrices). */
export function haloMaterial(glow: Color) {
  return new ShaderMaterial({
    uniforms: { glowColor: { value: glow }, strength: { value: 0.16 } },
    vertexShader: /* glsl */ `
      attribute float instanceGlow;
      attribute vec3 instanceGlowColor;
      varying vec2 vUv;
      varying float vGlow;
      varying vec3 vGlowColor;
      void main() {
        vUv = uv;
        vGlow = instanceGlow;
        vGlowColor = instanceGlowColor;
        vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float size = length(instanceMatrix[0].xyz) * 1.25;
        center.xy += position.xy * size;
        gl_Position = projectionMatrix * center;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float strength;
      varying vec2 vUv;
      varying float vGlow;
      varying vec3 vGlowColor;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float falloff = pow(max(0.0, 1.0 - d), 2.4);
        float value = falloff * strength * vGlow;
        gl_FragColor = vec4(vGlowColor * value, value);
        ${ALPHA_CANVAS_OUTPUT}
      }
    `,
    transparent: false,
    depthWrite: false,
    blending: AdditiveBlending,
  })
}

/** A small five-pointed star of light (camera-facing quad on the capsule's instance matrix): the reward inside. */
export function starMaterial(glow: Color) {
  return new ShaderMaterial({
    uniforms: { uGlowColor: { value: glow }, uStrength: { value: 1 }, uSize: { value: 0.34 }, uSpin: { value: 0 } },
    vertexShader: /* glsl */ `
      uniform float uSize;
      uniform float uSpin;
      varying vec2 vUv;
      void main() {
        float c = cos(uSpin);
        float s = sin(uSpin);
        vUv = mat2(c, -s, s, c) * (uv - 0.5) + 0.5;
        vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        center.xy += position.xy * length(instanceMatrix[0].xyz) * uSize;
        gl_Position = projectionMatrix * center;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uGlowColor;
      uniform float uStrength;
      varying vec2 vUv;
      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        float a = atan(p.x, p.y);
        // Five points: the edge radius swings between the inner and the outer radius around the circle.
        float points = pow(0.5 + 0.5 * cos(a * 5.0), 2.2);
        float edge = mix(0.3, 0.78, points);
        float shape = smoothstep(edge, edge - 0.07, r);
        float glow = exp(-r * r * 5.0) * 0.45;
        vec3 color = mix(uGlowColor, vec3(1.0, 0.99, 1.0), 0.75) * shape + uGlowColor * glow;
        gl_FragColor = vec4(color * uStrength, 1.0);
        ${ALPHA_CANVAS_OUTPUT}
      }
    `,
    transparent: false,
    depthWrite: false,
    blending: AdditiveBlending,
  })
}

// ── A single capsule ──────────────────────────────────────────────────────────

/**
 * What one capsule shows. `filled`: lit, its light inside (an invite that came in, a record kept). `empty`: dark
 * smoky glass, unlit (a place still to fill). `open`: the tinted half lifted off and tilted, the light rising out of
 * the gap. `reward`: lit brighter with a star inside and the keepsake stars on the seam.
 */
export type CapsuleFigureState = 'filled' | 'empty' | 'open' | 'reward'

export type CapsuleFigureOptions = {
  state: CapsuleFigureState
  colors?: CapsuleColors
  /** Full length in scene units (the group itself must not be scaled: the light quads size from this). */
  length?: number
  /** For a canvas created with `alpha: true` (forAlphaCanvas on every material). */
  alphaCanvas?: boolean
  /** Sides of the lathe (32 as in 내 메이트; fewer for many small capsules). */
  radialSegments?: number
  /** 0…1.2: how much colour the tones keep (1 = the colours as given). */
  saturation?: number
}

export type CapsuleFigure = {
  /** The capsule lies along +x around the origin; move and turn the group, never scale it. */
  group: Group
  /** Overall light, 0…(about 1.5): 1 is the state's normal glow. */
  setGlow(value: number): void
  /** Breathing of the inner light (seconds; pass the same clock every frame). 0 strength: still. */
  setTime(seconds: number, breath?: number): void
  /** How far the tinted half is lifted off (0 closed … 1 the open pose). Only for `open`. */
  setOpen(amount: number): void
  /** Light fade for a capsule appearing (0 invisible … 1 full). */
  setOpacity(value: number): void
  dispose(): void
}

const FIGURE = {
  filled: { glow: 1, weight: 0.7, halo: 0.16, core: 1, keepsake: 0 },
  reward: { glow: 1.15, weight: 0.85, halo: 0.2, core: 0.75, keepsake: 1 },
  open: { glow: 1, weight: 0.7, halo: 0.14, core: 1.25, keepsake: 0 },
  empty: { glow: 0.32, weight: 0, halo: 0, core: 0, keepsake: 0 },
} as const satisfies Record<CapsuleFigureState, { glow: number; weight: number; halo: number; core: number; keepsake: number }>

/** The open pose: the tinted half lifted along the axis and tilted, the light between the halves. */
const OPEN_POSE = { lift: 0.2, tilt: 0.34, coreAt: 0.12 } as const

function saturate(hex: string, amount: number) {
  const color = new Color(hex)
  if (amount === 1) return color
  const grey = color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722
  return new Color(grey + (color.r - grey) * amount, grey + (color.g - grey) * amount, grey + (color.b - grey) * amount)
}

function lightQuad(material: ShaderMaterial, glowColor: Color, length: number, glow: number, weight: number) {
  const mesh = new InstancedMesh(new PlaneGeometry(1, 1), material, 1)
  mesh.setMatrixAt(0, new Matrix4().makeScale(length, length, length))
  mesh.geometry.setAttribute('instanceGlow', new InstancedBufferAttribute(new Float32Array([glow]), 1))
  mesh.geometry.setAttribute('instanceWeight', new InstancedBufferAttribute(new Float32Array([weight]), 1))
  mesh.geometry.setAttribute('instanceGlowColor', new InstancedBufferAttribute(new Float32Array([glowColor.r, glowColor.g, glowColor.b]), 3))
  // Camera-facing quads move in the shader: the bounds of the plane say nothing about where they draw.
  mesh.frustumCulled = false
  return mesh
}

/** One capsule of the canonical model in one of its four states (still renders, the empty jar, the invite dome). */
export function createCapsuleFigure(options: CapsuleFigureOptions): CapsuleFigure {
  const { state, length = 1, alphaCanvas = false, radialSegments = 32, saturation = 1 } = options
  const colors = options.colors ?? BRAND_CAPSULE_COLORS
  const look = FIGURE[state]
  const light = saturate(colors.lightHalf, saturation)
  const tint = saturate(colors.tintHalf, saturation)
  const glowColor = saturate(colors.glow, saturation)
  const prepared = <T extends ShaderMaterial>(material: T) => (alphaCanvas ? forAlphaCanvas(material) : material)

  const group = new Group()
  const geometries: BufferGeometry[] = []
  const materials: (ShaderMaterial | MeshBasicMaterial)[] = []

  const shell = prepared(shellMaterial(false, glowColor))
  shell.uniforms.uLight!.value = light
  shell.uniforms.uTint!.value = tint
  shell.uniforms.uGlow!.value = look.glow
  shell.uniforms.uWeight!.value = look.weight
  shell.uniforms.uKeepsake!.value = look.keepsake
  materials.push(shell)

  // Smoky dark glass under the rim light of an empty capsule (normal blending: it darkens what is behind).
  if (state === 'empty') {
    const smokeGeometry = capsuleGeometry(-0.5, 0.5, light, tint, radialSegments)
    const smoke = new MeshBasicMaterial({ color: '#0E0B1A', transparent: true, opacity: 0.62, depthWrite: false })
    const smokeMesh = new Mesh(smokeGeometry, smoke)
    smokeMesh.scale.setScalar(length * 0.97)
    smokeMesh.renderOrder = 0
    group.add(smokeMesh)
    geometries.push(smokeGeometry)
    materials.push(smoke)
  }

  // The shell: whole, or the two halves of the open pose (the tinted half on a pivot at the seam).
  const tintPivot = new Group()
  if (state === 'open') {
    const lower = capsuleGeometry(-0.5, CAPSULE_SEAM_X, light, tint, radialSegments)
    const upper = capsuleGeometry(CAPSULE_SEAM_X, 0.5, light, tint, radialSegments)
    geometries.push(lower, upper)
    const lowerMesh = new Mesh(lower, shell)
    lowerMesh.scale.setScalar(length)
    const upperMesh = new Mesh(upper, shell)
    upperMesh.scale.setScalar(length)
    upperMesh.position.x = -CAPSULE_SEAM_X * length
    tintPivot.position.x = CAPSULE_SEAM_X * length
    tintPivot.add(upperMesh)
    lowerMesh.renderOrder = upperMesh.renderOrder = 1
    group.add(lowerMesh, tintPivot)
  } else {
    const whole = capsuleGeometry(-0.5, 0.5, light, tint, radialSegments)
    geometries.push(whole)
    const mesh = new Mesh(whole, shell)
    mesh.scale.setScalar(length)
    mesh.renderOrder = 1
    group.add(mesh)
  }

  const core = prepared(coreMaterial(glowColor))
  core.uniforms.uBreath!.value = 0
  const coreMesh = lightQuad(core, glowColor, length, 1, look.weight)
  coreMesh.renderOrder = 2
  coreMesh.visible = look.core > 0
  core.uniforms.uStrength!.value = look.core
  const halo = prepared(haloMaterial(glowColor))
  halo.uniforms.strength!.value = look.halo
  const haloMesh = lightQuad(halo, glowColor, length, 1, look.weight)
  haloMesh.renderOrder = 3
  haloMesh.visible = look.halo > 0
  group.add(coreMesh, haloMesh)
  materials.push(core, halo)
  geometries.push(coreMesh.geometry, haloMesh.geometry)

  let star: ShaderMaterial | null = null
  if (state === 'reward') {
    star = prepared(starMaterial(glowColor))
    const starMesh = lightQuad(star, glowColor, length, 1, 1)
    starMesh.renderOrder = 4
    group.add(starMesh)
    materials.push(star)
    geometries.push(starMesh.geometry)
  }

  let glow = 1
  let opacity = 1
  const apply = () => {
    shell.uniforms.uStrength!.value = glow * opacity
    core.uniforms.uStrength!.value = look.core * glow * opacity
    halo.uniforms.strength!.value = look.halo * glow * opacity
    if (star) star.uniforms.uStrength!.value = glow * opacity
    for (const material of materials) if (material instanceof MeshBasicMaterial) material.opacity = 0.62 * opacity
  }
  const setOpen = (amount: number) => {
    if (state !== 'open') return
    tintPivot.position.x = (CAPSULE_SEAM_X + OPEN_POSE.lift * amount) * length
    tintPivot.position.y = OPEN_POSE.lift * 0.35 * amount * length
    tintPivot.rotation.z = OPEN_POSE.tilt * amount
    coreMesh.position.x = OPEN_POSE.coreAt * amount * length
    coreMesh.position.y = 0.06 * amount * length
  }
  setOpen(1)
  apply()

  return {
    group,
    setGlow(value) {
      glow = value
      apply()
    },
    setTime(seconds, breath = 1) {
      core.uniforms.uTime!.value = seconds
      core.uniforms.uBreath!.value = breath
      if (star) star.uniforms.uSpin!.value = Math.sin(seconds * 0.7) * 0.12 * breath
    },
    setOpen,
    setOpacity(value) {
      opacity = value
      apply()
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose()
      for (const material of materials) material.dispose()
    },
  }
}
