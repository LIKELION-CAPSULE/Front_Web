import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'
import {
  ART_PIXEL_CSS,
  SPRITES,
  SPRITE_SIZE,
  SPRITE_TONES,
  particleLook,
  seededRandom,
  snowMix,
  snowTarget,
  spawnParticle,
  stepParticle,
  type SnowKind,
  type SnowParticle,
} from './pixel-snow-model'
import './pixel-snow.css'

/** Redraws at most this often: the art pixels move a few times a second, so 30 fps is plenty. */
const FRAME_MS = 1000 / 30
/** When the target grows (stage up, bigger window), new particles come in one by one, this far apart. */
const SPAWN_GAP_S = 0.12
/**
 * A stage that changes this soon after the start (the page settling its data) refills the background instead of
 * blending, so the first picture never shows particles of a stage the page is not at.
 */
const SETTLE_S = 2

type Sprite = HTMLCanvasElement

/**
 * Behind glass (`glowBehind`): a backdrop blur of 18px or so wipes out a 2–4px pixel completely, so a particle that
 * passes behind a glass block also draws a soft light (radius `GLOW_RADIUS` art px, `GLOW_GAIN` × its opacity, at
 * most `GLOW_MAX`), clipped to the glass. Through the blur it reads as a faint moving light; outside the glass
 * nothing changes.
 */
const GLOW_RADIUS = 10
const GLOW_GAIN = 2.6
const GLOW_MAX = 0.85
/** How often the glass blocks' boxes are measured again (they move only with the layout). */
const GLASS_MEASURE_MS = 1000

/** A soft round light per colour, one canvas pixel per art pixel. */
function buildGlow(color: string): Sprite {
  const size = GLOW_RADIUS * 2 + 1
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d')!
  const gradient = context.createRadialGradient(GLOW_RADIUS + 0.5, GLOW_RADIUS + 0.5, 0, GLOW_RADIUS + 0.5, GLOW_RADIUS + 0.5, GLOW_RADIUS + 0.5)
  gradient.addColorStop(0, color)
  gradient.addColorStop(0.45, `${color}99`)
  gradient.addColorStop(1, `${color}00`)
  context.fillStyle = gradient
  context.fillRect(0, 0, size, size)
  return canvas
}

/** Each sprite in each tone, drawn once at 1 canvas px per art pixel. */
function buildSprites(): Record<SnowKind, Sprite[]> {
  const out = {} as Record<SnowKind, Sprite[]>
  for (const kind of Object.keys(SPRITES) as SnowKind[]) {
    const rows = SPRITES[kind]
    out[kind] = SPRITE_TONES[kind].map((tone) => {
      const canvas = document.createElement('canvas')
      canvas.width = rows[0]!.length
      canvas.height = rows.length
      const context = canvas.getContext('2d')!
      rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          const cell = row[x]
          if (cell === '.') continue
          context.fillStyle = cell === 'w' ? '#FFFFFF' : cell === 'b' ? tone.b : tone.a
          context.fillRect(x, y, 1, 1)
        }
      })
      return canvas
    })
  }
  return out
}

/**
 * Pixel-art snow and hearts falling behind a page's content (the 내 메이트 background). One canvas 2D, rendered at
 * one canvas pixel per art pixel and scaled up by a whole number of device pixels with `image-rendering: pixelated`.
 * The canvas goes into the page's `<main>` (portal) and sits under its content, so the opaque panels and blocks hide
 * it; it takes no pointer events. `stage` (1–5) sets the mix (pixel-snow-model.ts); a change blends in as particles
 * fall out and new ones come in. Stops when the tab is hidden or the background is off screen; reduced motion shows
 * a few still particles. `glowBehind`: a selector of see-through glass surfaces in the page; particles behind them
 * also glow softly there, so they show through the glass's blur.
 */
export function PixelSnow({ stage, glowBehind }: { stage: number | null | undefined; glowBehind?: string }) {
  const markerRef = useRef<HTMLSpanElement>(null)
  const [host, setHost] = useState<HTMLElement | null>(null)
  const reduced = useReducedMotion()
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mixRef = useRef(snowMix(stage))
  const stillStage = reduced ? snowMix(stage).stage : 0

  useLayoutEffect(() => {
    setHost(markerRef.current?.closest('main') ?? null)
  }, [])

  // Layout effect: runs before the drawing effect, so a rebuilt still picture already uses the new stage.
  useLayoutEffect(() => {
    mixRef.current = snowMix(stage)
  }, [stage])

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!wrap || !canvas || !context) return
    const sprites = buildSprites()
    const glows = new Map<string, Sprite>()
    const glowFor = (kind: SnowKind, tone: number) => {
      const color = (SPRITE_TONES[kind][tone] ?? SPRITE_TONES[kind][0]!).a
      let glow = glows.get(color)
      if (!glow) {
        glow = buildGlow(color)
        glows.set(color, glow)
      }
      return glow
    }
    /** Glass boxes in art px, relative to the canvas. */
    let glass: { x0: number; y0: number; x1: number; y1: number; radius: number }[] = []
    let artCss = ART_PIXEL_CSS
    let glassMeasuredAt = 0
    const measureGlass = () => {
      glassMeasuredAt = performance.now()
      if (!glowBehind || !host) {
        glass = []
        return
      }
      const origin = wrap.getBoundingClientRect()
      glass = [...host.querySelectorAll(glowBehind)].map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          x0: (rect.left - origin.left) / artCss,
          y0: (rect.top - origin.top) / artCss,
          x1: (rect.right - origin.left) / artCss,
          y1: (rect.bottom - origin.top) / artCss,
          // The block's rounded corners: the glow is clipped to them, or it shows outside the corner as a light wedge.
          radius: (parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0) / artCss,
        }
      })
    }
    // The still picture (reduced motion) is the same every time: a seeded random, restarted for each fill.
    let random = reduced ? seededRandom(20261124) : Math.random
    let particles: SnowParticle[] = []
    let width = 0 // art px
    let height = 0
    let cssWidth = 0
    let cssHeight = 0
    let frame = 0
    let last = 0
    let drawnAt = 0
    let clock = 0
    let spawnDebt = 0
    let visible = true
    let filledWith = mixRef.current

    const free = () => ({
      big: !particles.some((particle) => particle.kind === 'heartBig'),
      capsule: !particles.some((particle) => particle.kind === 'capsule'),
    })

    const resize = () => {
      const rect = wrap.getBoundingClientRect()
      cssWidth = rect.width
      cssHeight = rect.height
      const ratio = window.devicePixelRatio || 1
      // Whole device pixels per art pixel, so every art pixel is the same size and sharp.
      const devicePerArt = Math.max(1, Math.round(ART_PIXEL_CSS * ratio))
      const nextWidth = Math.max(1, Math.ceil((cssWidth * ratio) / devicePerArt))
      const nextHeight = Math.max(1, Math.ceil((cssHeight * ratio) / devicePerArt))
      canvas.width = nextWidth
      canvas.height = nextHeight
      canvas.style.width = `${(nextWidth * devicePerArt) / ratio}px`
      canvas.style.height = `${(nextHeight * devicePerArt) / ratio}px`
      context.imageSmoothingEnabled = false
      artCss = devicePerArt / ratio
      measureGlass()
      const first = width === 0
      // Keep particles where they are on a resize; drop the ones now outside.
      particles = particles.filter((particle) => particle.x < nextWidth + 4)
      width = nextWidth
      height = nextHeight
      if (first || reduced) {
        // The first fill (and the still picture): spread over the whole height, fading in.
        fill()
      }
      draw(clock)
    }

    function fill() {
      const target = snowTarget(cssWidth, cssHeight, mixRef.current, reduced)
      if (reduced) random = seededRandom(20261124)
      filledWith = mixRef.current
      particles = []
      for (let index = 0; index < target; index++) particles.push(spawnParticle(mixRef.current, width, random, free(), random() * height))
      if (reduced) for (const particle of particles) particle.age = 10
    }

    const draw = (t: number) => {
      context.clearRect(0, 0, width, height)
      if (glass.length) {
        // Soft lights for the particles behind glass, clipped to it.
        context.save()
        context.beginPath()
        // Rounded like the block and one art px inside it: the canvas is coarse (pixelated), so a clip on the edge
        // itself would still step out past the block's smooth corner.
        for (const box of glass) {
          if (box.radius > 0 && typeof context.roundRect === 'function') {
            context.roundRect(box.x0 + 1, box.y0 + 1, box.x1 - box.x0 - 2, box.y1 - box.y0 - 2, Math.max(0, box.radius - 1))
          } else context.rect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0)
        }
        context.clip()
        for (const particle of particles) {
          const look = particleLook(particle, reduced ? 0 : t)
          const [spriteWidth, spriteHeight] = SPRITE_SIZE[particle.kind]
          const cx = look.x
          const cy = look.y + spriteHeight / 2
          const behind = glass.some(
            (box) => cx > box.x0 - GLOW_RADIUS && cx < box.x1 + GLOW_RADIUS && cy > box.y0 - GLOW_RADIUS && cy < box.y1 + GLOW_RADIUS,
          )
          if (!behind || look.alpha <= 0.005) continue
          context.globalAlpha = Math.min(GLOW_MAX, look.alpha * GLOW_GAIN * (spriteWidth > 7 ? 1.2 : 1))
          context.drawImage(glowFor(particle.kind, particle.tone), cx - GLOW_RADIUS, cy - GLOW_RADIUS)
        }
        context.restore()
      }
      for (const particle of particles) {
        const look = particleLook(particle, reduced ? 0 : t)
        if (look.alpha <= 0.005) continue
        context.globalAlpha = look.alpha
        const sprite = sprites[particle.kind][particle.tone] ?? sprites[particle.kind][0]!
        context.drawImage(sprite, look.x - (sprite.width >> 1), look.y)
      }
      context.globalAlpha = 1
    }

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      if (now - drawnAt < FRAME_MS - 2) return
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0
      last = now
      drawnAt = now
      clock += dt
      if (now - glassMeasuredAt > GLASS_MEASURE_MS) measureGlass()
      const mix = mixRef.current
      if (mix !== filledWith && clock < SETTLE_S) fill()
      const target = snowTarget(cssWidth, cssHeight, mix)
      // Fallen particles start again at the top (with the current mix) while the target allows.
      const alive: SnowParticle[] = []
      let fallen = 0
      for (const particle of particles) {
        if (stepParticle(particle, dt, height)) alive.push(particle)
        else fallen++
      }
      particles = alive
      for (let index = 0; index < fallen && particles.length < target; index++) particles.push(spawnParticle(mix, width, random, free()))
      // Growing target: new ones one by one from the top.
      if (particles.length < target) {
        spawnDebt += dt
        while (spawnDebt >= SPAWN_GAP_S && particles.length < target) {
          spawnDebt -= SPAWN_GAP_S
          particles.push(spawnParticle(mix, width, random, free()))
        }
      } else spawnDebt = 0
      draw(clock)
    }

    const update = () => {
      cancelAnimationFrame(frame)
      frame = 0
      last = 0
      if (reduced || !visible || document.hidden) return
      frame = requestAnimationFrame(tick)
    }

    const resizeObserver = new ResizeObserver(() => resize())
    resizeObserver.observe(wrap)
    const intersection = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting)
      update()
    })
    intersection.observe(wrap)
    document.addEventListener('visibilitychange', update)
    resize()
    update()
    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      intersection.disconnect()
      document.removeEventListener('visibilitychange', update)
      particles = []
    }
    // Under reduced motion the still picture is rebuilt for a new stage (`stillStage`); moving snow blends instead.
  }, [host, reduced, stillStage, glowBehind])

  return (
    <>
      <span ref={markerRef} hidden />
      {host &&
        createPortal(
          <div ref={wrapRef} className="pixel-snow" aria-hidden="true" data-stage={snowMix(stage).stage}>
            <canvas ref={canvasRef} className="pixel-snow-canvas" />
          </div>,
          host,
        )}
    </>
  )
}
