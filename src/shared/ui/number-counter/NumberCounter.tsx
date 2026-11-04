// Adapted from Tween UI Number Counter. Copyright (c) 2026 StaticMania, MIT.
// Official source and license: ./upstream.json and ./LICENSE.txt.
import { useRef, useState, type ComponentPropsWithoutRef } from 'react'
import { useGSAP } from '@gsap/react'
import NumberFlow, { continuous, type Format } from '@number-flow/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { cn } from '@/shared/lib/cn'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'
import './number-counter.css'

gsap.registerPlugin(useGSAP, ScrollTrigger)

type NumberCounterProps = ComponentPropsWithoutRef<'span'> & {
  value: number
  delay?: number
  duration?: number
  instant?: boolean
  format?: Format
}

export function NumberCounter({ value, delay = 0, duration = 1.8, instant = false, format, className, ...props }: NumberCounterProps) {
  const rootRef = useRef<HTMLSpanElement>(null)
  const played = useRef(false)
  const [displayValue, setDisplayValue] = useState(0)
  const reduced = useReducedMotion()
  const target = Number.isFinite(value) ? value : 0
  const numberFormat = { useGrouping: true, ...format }
  const formatter = new Intl.NumberFormat('ko-KR', numberFormat)
  const parts = formatter.formatToParts(target)
  const finalText = parts.map(part => part.value).join('')
  // Give 0 the final number's columns before playing: 000 → 595, 00.0 → 44.6.
  const integerDigits = parts.filter(part => part.type === 'integer').reduce((sum, part) => sum + part.value.length, 0)
  const fractionDigits = parts.find(part => part.type === 'fraction')?.value.length ?? 0
  const reelFormat = { ...numberFormat, minimumIntegerDigits: Math.min(21, Math.max(1, integerDigits)), minimumFractionDigits: fractionDigits }

  useGSAP(() => {
    const root = rootRef.current
    if (!root || reduced) return
    let startTween: gsap.core.Tween | undefined
    const play = () => {
      played.current = true
      startTween = gsap.delayedCall(Math.max(0, delay), () => setDisplayValue(target))
    }
    if (instant || played.current) {
      play()
      return () => { startTween?.kill() }
    }
    const trigger = ScrollTrigger.create({
      trigger: root,
      scroller: root.closest('[data-counter-scroller]') ?? undefined,
      start: 'top 85%',
      once: true,
      onEnter: play,
    })
    return () => { startTween?.kill(); trigger.kill() }
  }, { scope: rootRef, dependencies: [target, delay, instant, reduced], revertOnUpdate: true })

  const durationMs = reduced ? 0 : Math.max(0, duration) * 1000
  return (
    <span ref={rootRef} data-counter-trigger className={cn('number-counter', className)} {...props}>
      <span className="sr-only">{finalText}</span>
      <span className="number-counter-reserve" aria-hidden="true">{finalText}</span>
      <NumberFlow
        aria-hidden="true"
        value={reduced ? target : displayValue}
        locales="ko-KR"
        format={reelFormat}
        trend={1}
        plugins={[continuous]}
        animated={!reduced}
        transformTiming={{ duration: durationMs, easing: 'ease-out' }}
        spinTiming={{ duration: durationMs, easing: 'ease-out' }}
        opacityTiming={{ duration: reduced ? 0 : Math.max(250, duration * 450), easing: 'ease-out' }}
      />
    </span>
  )
}
