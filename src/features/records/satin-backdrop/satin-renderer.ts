/*
 * Adapted from Originkit "Satin Ribbon" (originkit.dev) — 상업 서비스 사용 허용, 재배포·판매 금지
 * (사용자 확인 2026-11-25, docs/REFERENCE_COMMERCIAL_USE.md).
 *
 * Kept from the original: one full-screen triangle; per band a centre line of two travelling sine waves with its
 * slope; a cross-section normal (rounded across, rippled along) lit by an environment reflection, a specular glint,
 * a grazing sheen and thin edge threads.
 * Redesigned for 내 기록: the brand violets on the page canvas instead of silver on white and gold threads; ribbons
 * added over the canvas with a low gain (a dark backdrop under glass blocks); bands pushed to the top and bottom on
 * a diagonal and the middle dimmed (the board stays clear); a wave every ~35 s; softer edges; no pointer hover — the
 * light only drifts a little toward the pointer; a drawing buffer at 0.4× the CSS size (device pixel ratio ignored);
 * at most 30 fps; paused when hidden or off-screen; one still frame under reduced motion; WebGL context loss handled.
 * Entrance (satin-config.ts `reveal`): the ribbons' light eases up from the canvas while the bands drift in from beyond
 * their edges of the screen and widen a little.
 */
import { hexToRgb, revealAt, SATIN, type SatinReveal } from './satin-config.ts'

const VERTEX = /* glsl */ `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

const BANDS = SATIN.bands.length

const FRAGMENT = /* glsl */ `
precision mediump float;

uniform vec2 uRes;
uniform float uTime;
uniform vec2 uLight;
uniform vec3 uBg;
uniform vec3 uDeep;
uniform vec3 uLightTone;
uniform vec3 uFil;
uniform float uGain;
uniform float uSpec;
uniform float uSheen;
uniform float uFilament;
uniform float uCentreDim;
uniform float uWaveA;
uniform float uWaveB;
uniform float uReveal;
uniform vec4 uBand[${BANDS}];
uniform vec2 uBandB[${BANDS}];

float sat(float x) { return clamp(x, 0.0, 1.0); }

// A dark violet room: the band's tone, lighter toward the top, with one soft light stripe.
vec3 env(vec3 r, vec3 tint) {
  float y = r.y * 0.5 + 0.5;
  vec3 c = tint * (0.35 + 0.65 * pow(sat(y), 1.3));
  c += vec3(1.0) * pow(sat(1.0 - abs(r.y - 0.3) * 3.0), 3.0) * 0.12;
  return c;
}

void main() {
  float ar = uRes.x / max(uRes.y, 1.0);
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (uv - 0.5) * vec2(ar, 1.0);
  float t = uTime;
  vec3 L = normalize(vec3(uLight.x, uLight.y + 0.35, 0.82));
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 col = uBg;
  // The middle of the screen (the board) gets less ribbon.
  float centre = 1.0 - uCentreDim * (1.0 - smoothstep(0.12, 0.34, abs(p.y)));

  // Entrance: 0 → 1 (ease-out). Until then the bands sit a little beyond their edge of the screen and narrower.
  float enter = 1.0 - uReveal;
  for (int i = 0; i < ${BANDS}; i++) {
    vec4 b = uBand[i];
    b.x += sign(b.x) * enter * ${SATIN.reveal.drift.toFixed(3)};
    b.z *= 1.0 - enter * ${SATIN.reveal.narrow.toFixed(3)};
    vec2 b2 = uBandB[i];
    float ph = b2.y;
    float a1 = p.x * 2.15 + 0.6 + ph + t;
    float a2 = p.x * 1.05 - 1.2 + ph * 0.7 - t * 0.6;
    float py = b.x + b.y * p.x + uWaveA * sin(a1) + uWaveB * sin(a2);
    float dpdx = b.y + uWaveA * 2.15 * cos(a1) + uWaveB * 1.05 * cos(a2);
    float w = b.z * (0.85 + 0.3 * sin(p.x * 1.7 + 2.0 + ph));
    float s = (p.y - py) / max(w, 1e-3);
    float cov = 1.0 - smoothstep(0.7, 1.0, abs(s));
    if (cov <= 0.001) continue;

    float sc = clamp(s, -1.0, 1.0);
    float nz = sqrt(max(1.0 - sc * sc, 0.0));
    vec2 T2 = normalize(vec2(1.0, dpdx));
    vec3 along = vec3(T2, 0.0);
    vec3 across = vec3(-T2.y, T2.x, 0.0);
    float na = 0.42 * sin(p.x * 6.5 + sc * 2.0 + ph) + 0.12 * sin(p.x * 17.0 - t * 0.5);
    vec3 N = normalize(across * sc + V * nz + along * na);

    vec3 tint = mix(uDeep, uLightTone, b.w);
    vec3 base = env(reflect(-V, N), tint);
    float spec = pow(sat(dot(reflect(-L, N), V)), 40.0);
    float sheen = pow(sat(1.0 - abs(dot(N, V))), 2.4);
    vec3 body = base * (0.8 + 0.25 * sat(dot(N, L))) + vec3(1.0) * (spec * uSpec + sheen * uSheen);

    float k = abs(sc);
    float fil = exp(-pow((k - 0.885) / 0.014, 2.0)) + 0.5 * exp(-pow((k - 0.56) / 0.01, 2.0));
    body += uFil * fil * uFilament * (0.35 + 0.65 * sat(dot(N, L)));
    body *= 0.86 + 0.3 * pow(sat(1.0 - k), 0.7);

    col = mix(col, uBg + body * uGain * uReveal, cov * b2.x * centre);
  }

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`

export type SatinRenderer = {
  setReducedMotion(value: boolean): void
  dispose(): void
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    if (import.meta.env.DEV) console.warn('SatinBackdrop shader:', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

/**
 * Starts the backdrop on a canvas; null when WebGL (or the shader) is not available. `reveal`: the entrance's timing
 * (none: the ribbons are there at once).
 */
export function createSatinRenderer(canvas: HTMLCanvasElement, options: { reducedMotion: boolean; reveal?: SatinReveal | null }): SatinRenderer | null {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' })
  if (!gl) return null
  let reducedMotion = options.reducedMotion

  type Resources = { program: WebGLProgram; vertex: WebGLShader; fragment: WebGLShader; buffer: WebGLBuffer; uniform: (name: string) => WebGLUniformLocation | null }
  let resources: Resources | null = null

  function build(): Resources | null {
    const vertex = compile(gl!, gl!.VERTEX_SHADER, VERTEX)
    const fragment = compile(gl!, gl!.FRAGMENT_SHADER, FRAGMENT)
    const program = gl!.createProgram()
    const buffer = gl!.createBuffer()
    if (!vertex || !fragment || !program || !buffer) return null
    gl!.attachShader(program, vertex)
    gl!.attachShader(program, fragment)
    gl!.linkProgram(program)
    if (!gl!.getProgramParameter(program, gl!.LINK_STATUS)) return null
    gl!.useProgram(program)
    gl!.bindBuffer(gl!.ARRAY_BUFFER, buffer)
    gl!.bufferData(gl!.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl!.STATIC_DRAW)
    const position = gl!.getAttribLocation(program, 'aPos')
    gl!.enableVertexAttribArray(position)
    gl!.vertexAttribPointer(position, 2, gl!.FLOAT, false, 0, 0)
    const cache = new Map<string, WebGLUniformLocation | null>()
    const uniform = (name: string) => {
      if (!cache.has(name)) cache.set(name, gl!.getUniformLocation(program, name))
      return cache.get(name)!
    }
    // Everything that never changes is set once.
    const set3 = (name: string, hex: string) => {
      const [r, g, b] = hexToRgb(hex)
      gl!.uniform3f(uniform(name), r, g, b)
    }
    set3('uBg', SATIN.background)
    set3('uDeep', SATIN.deep)
    set3('uLightTone', SATIN.light)
    set3('uFil', SATIN.filamentColor)
    gl!.uniform1f(uniform('uGain'), SATIN.gain)
    gl!.uniform1f(uniform('uSpec'), SATIN.specular)
    gl!.uniform1f(uniform('uSheen'), SATIN.sheen)
    gl!.uniform1f(uniform('uFilament'), SATIN.filament)
    gl!.uniform1f(uniform('uCentreDim'), SATIN.centreDim)
    gl!.uniform1f(uniform('uWaveA'), SATIN.waveA)
    gl!.uniform1f(uniform('uWaveB'), SATIN.waveB)
    gl!.uniform4fv(uniform('uBand'), SATIN.bands.flatMap((band) => [band.offset, band.slope, band.width, band.tone]))
    gl!.uniform2fv(uniform('uBandB'), SATIN.bands.flatMap((band) => [band.opacity, band.phase]))
    return { program, vertex, fragment, buffer, uniform }
  }

  function release() {
    if (!resources || gl!.isContextLost()) {
      resources = null
      return
    }
    gl!.deleteBuffer(resources.buffer)
    gl!.detachShader(resources.program, resources.vertex)
    gl!.detachShader(resources.program, resources.fragment)
    gl!.deleteShader(resources.vertex)
    gl!.deleteShader(resources.fragment)
    gl!.deleteProgram(resources.program)
    resources = null
  }

  resources = build()
  if (!resources) {
    release()
    return null
  }

  // ── State ──
  let raf = 0
  let lastFrame = 0
  let clock = SATIN.stillTime
  /** Seconds of the entrance played (frames only: it waits while the page is hidden). Reduced motion skips it. */
  const reveal = options.reveal ?? null
  let revealClock = 0
  const revealed = () => (reveal && !reducedMotion ? revealAt(revealClock, reveal) : 1)
  let visible = true
  let disposed = false
  let lost = false
  const light = { x: 0, y: 0, tx: 0, ty: 0 }

  function resize() {
    const width = Math.max(1, Math.round(canvas.clientWidth * SATIN.resolutionScale))
    const height = Math.max(1, Math.round(canvas.clientHeight * SATIN.resolutionScale))
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
  }

  function draw() {
    if (!resources || lost) return
    resize()
    gl!.viewport(0, 0, canvas.width, canvas.height)
    gl!.uniform2f(resources.uniform('uRes'), canvas.width, canvas.height)
    gl!.uniform1f(resources.uniform('uTime'), clock * SATIN.flow)
    gl!.uniform2f(resources.uniform('uLight'), light.x, light.y)
    gl!.uniform1f(resources.uniform('uReveal'), revealed())
    gl!.drawArrays(gl!.TRIANGLES, 0, 3)
  }

  const running = () => visible && !reducedMotion && !disposed && !lost && document.visibilityState === 'visible'

  function frame(now: number) {
    raf = 0
    if (!running()) return
    const minGap = 1000 / SATIN.maxFps
    if (lastFrame && now - lastFrame < minGap - 1) {
      raf = requestAnimationFrame(frame)
      return
    }
    const dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 0
    lastFrame = now
    clock = (clock + dt) % 3600
    revealClock += dt
    const follow = 1 - Math.exp(-SATIN.lightFollow * dt)
    light.x += (light.tx - light.x) * follow
    light.y += (light.ty - light.y) * follow
    draw()
    raf = requestAnimationFrame(frame)
  }

  function update() {
    if (running()) {
      if (!raf) {
        lastFrame = 0
        raf = requestAnimationFrame(frame)
      }
    } else {
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      // Reduced motion: one still frame.
      if (reducedMotion && !lost && !disposed) {
        clock = SATIN.stillTime
        light.x = light.y = 0
        draw()
      }
    }
  }

  const onPointer = (event: PointerEvent) => {
    light.tx = ((event.clientX / Math.max(1, window.innerWidth)) * 2 - 1) * SATIN.lightRange
    light.ty = (1 - (event.clientY / Math.max(1, window.innerHeight)) * 2) * SATIN.lightRange
  }
  const onVisibility = () => update()
  const observer = new IntersectionObserver(([entry]) => {
    visible = Boolean(entry?.isIntersecting)
    update()
  })
  observer.observe(canvas)
  const resizeObserver = new ResizeObserver(() => {
    if (!running()) draw()
  })
  resizeObserver.observe(canvas)
  const onLost = (event: Event) => {
    event.preventDefault()
    lost = true
    resources = null
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }
  const onRestored = () => {
    lost = false
    resources = build()
    if (resources) {
      draw()
      update()
    }
  }
  window.addEventListener('pointermove', onPointer, { passive: true })
  document.addEventListener('visibilitychange', onVisibility)
  canvas.addEventListener('webglcontextlost', onLost)
  canvas.addEventListener('webglcontextrestored', onRestored)
  draw()
  update()

  return {
    setReducedMotion(value) {
      reducedMotion = value
      update()
    },
    dispose() {
      disposed = true
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      observer.disconnect()
      resizeObserver.disconnect()
      window.removeEventListener('pointermove', onPointer)
      document.removeEventListener('visibilitychange', onVisibility)
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      // Buffers, program and shaders are freed; the context itself is left to the canvas (forcing its loss would
      // break a remount on the same canvas, e.g. React's development double mount).
      release()
    },
  }
}
