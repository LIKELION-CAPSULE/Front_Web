import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

type Particle = {
  x: number; y: number; vx: number; vy: number
  size: number; color: string; born: number; life: number
  kind: 'spark' | 'confetti'
  rotation: number; spin: number; sway: number; swayPhase: number; width: number; height: number
}

export type AttendanceEffectsHandle = {
  /** Light sparks scattering from a point (widget coordinates), easing out as they fade. */
  burst: (x: number, y: number) => void
  /** Confetti falling over the widget for `ms`, then fading out. */
  confetti: (ms: number) => void
}

const SPARK_COLORS = ['#FFFFFF', '#E6DDFF', '#B9A6FF', '#FFE7A3']
const CONFETTI_COLORS = ['#7C5CFF', '#B9A6FF', '#FFD66B', '#FF9EC4', '#FFFFFF', '#8EE8FF']
const random = (min: number, max: number) => min + Math.random() * (max - min)

/**
 * A canvas laid over the widget that exists only while something is flying: it is created for the first particle
 * and removed (with its animation loop) as soon as the last one has faded. Particle counts are capped.
 */
export const AttendanceEffects = forwardRef<AttendanceEffectsHandle>(function AttendanceEffects(_, ref) {
  const host = useRef<HTMLDivElement>(null)
  const runtime = useRef<{ canvas: HTMLCanvasElement; raf: number } | null>(null)
  const particles = useRef<Particle[]>([])
  const confettiEnd = useRef(0)

  function stop() {
    if (!runtime.current) return
    cancelAnimationFrame(runtime.current.raf)
    runtime.current.canvas.remove()
    runtime.current = null
    particles.current = []
  }

  function start() {
    const element = host.current
    if (!element || runtime.current) return
    const canvas = document.createElement('canvas')
    canvas.className = 'att-effects-canvas'
    element.append(canvas)
    const ctx = canvas.getContext('2d')
    if (!ctx) return canvas.remove()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      const { width, height } = element.getBoundingClientRect()
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
    }
    resize()
    let last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const { width, height } = element.getBoundingClientRect()
      if (Math.round(width * dpr) !== canvas.width || Math.round(height * dpr) !== canvas.height) resize()
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      const fadeOut = confettiEnd.current ? Math.min(1, Math.max(0, (confettiEnd.current - now) / 500)) : 1
      particles.current = particles.current.filter((p) => {
        const age = now - p.born
        if (age > p.life) return false
        if (p.kind === 'spark') {
          // Exponential drag: fast out of the burst, gently settling as it fades.
          const drag = Math.exp(-6 * dt)
          p.vx *= drag
          p.vy = p.vy * drag + 60 * dt
          p.x += p.vx * dt
          p.y += p.vy * dt
          const t = age / p.life
          ctx.globalAlpha = (1 - t) * (1 - t)
          ctx.fillStyle = p.color
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * (1 - t * 0.5), 0, Math.PI * 2)
          ctx.fill()
        } else {
          p.vy = Math.min(p.vy + 820 * dt, 260)
          p.vx *= Math.exp(-1.2 * dt)
          p.x += (p.vx + Math.sin(now / 1000 * p.sway + p.swayPhase) * 40) * dt
          p.y += p.vy * dt
          p.rotation += p.spin * dt
          ctx.globalAlpha = fadeOut
          ctx.save()
          ctx.translate(p.x, p.y)
          ctx.rotate(p.rotation)
          // A paper strip turning over: its visible height follows the cosine of the flip.
          ctx.scale(1, Math.cos(now / 1000 * p.sway * 1.7 + p.swayPhase))
          ctx.fillStyle = p.color
          ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height)
          ctx.restore()
          if (p.y > height + 20) return false
        }
        return true
      })
      ctx.globalAlpha = 1
      if (!particles.current.length) {
        confettiEnd.current = 0
        return stop()
      }
      if (runtime.current) runtime.current.raf = requestAnimationFrame(frame)
    }
    runtime.current = { canvas, raf: requestAnimationFrame(frame) }
  }

  useImperativeHandle(ref, () => ({
    burst(x, y) {
      const now = performance.now()
      const count = 12 + Math.floor(Math.random() * 5)
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + random(-0.3, 0.3)
        const speed = random(140, 340)
        particles.current.push({
          x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 40,
          size: random(1.6, 4.2), color: SPARK_COLORS[i % SPARK_COLORS.length]!, born: now, life: random(380, 560),
          kind: 'spark', rotation: 0, spin: 0, sway: 0, swayPhase: 0, width: 0, height: 0,
        })
      }
      start()
    },
    confetti(ms) {
      const element = host.current
      if (!element) return
      const { width } = element.getBoundingClientRect()
      const now = performance.now()
      confettiEnd.current = now + ms
      for (let i = 0; i < 60; i++) {
        particles.current.push({
          x: random(width * 0.05, width * 0.95), y: random(-60, -6), vx: random(-60, 60), vy: random(20, 140),
          size: 0, color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!, born: now - random(0, 300), life: ms + 300,
          kind: 'confetti', rotation: random(0, Math.PI), spin: random(-5, 5), sway: random(2, 4.5), swayPhase: random(0, Math.PI * 2),
          width: random(5, 8), height: random(9, 13),
        })
      }
      start()
    },
  }))

  useEffect(() => stop, [])

  return <div ref={host} className="att-effects" aria-hidden="true" />
})
