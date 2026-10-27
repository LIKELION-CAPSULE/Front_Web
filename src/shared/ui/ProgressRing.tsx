import { useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
export function ProgressRing({
  value,
  label,
  size = 64,
  children,
  className,
}: {
  value: number
  label: string
  size?: number | string
  children?: ReactNode
  className?: string
}) {
  const percent = Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value * 10) / 10))
    : 0
  const length = 2 * Math.PI * 26
  const gradient = useId()
  const arcRef = useRef<SVGCircleElement>(null)
  const numberRef = useRef<HTMLSpanElement>(null)
  const displayed = useRef(0)
  useLayoutEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    const from = displayed.current
    function paint(next: number) {
      displayed.current = next
      arcRef.current?.setAttribute('stroke-dashoffset', String(length * (1 - next / 100)))
      if (numberRef.current) numberRef.current.textContent = String(Math.round(next * 10) / 10)
    }
    function settle() {
      cancelAnimationFrame(frame)
      paint(percent)
    }
    if (media.matches || from === percent) settle()
    else {
      paint(from)
      const start = performance.now()
      function tick(now: number) {
        const t = Math.min(1, (now - start) / 700)
        paint(from + (percent - from) * (1 - (1 - t) ** 3))
        if (t < 1) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }
    media.addEventListener('change', settle)
    return () => {
      cancelAnimationFrame(frame)
      media.removeEventListener('change', settle)
    }
  }, [percent, length])
  return (
    <span
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={`${percent}%`}
      className={cn('progress-ring', className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#d2b5ff" />
            <stop offset="1" stopColor="#8c64df" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="26" className="progress-ring-track" />
        <circle
          ref={arcRef}
          cx="32"
          cy="32"
          r="26"
          className="progress-ring-value"
          style={{ stroke: `url(#${gradient})`, transitionProperty: 'none' }}
          strokeDasharray={length}
          strokeDashoffset={length * (1 - percent / 100)}
        />
      </svg>
      <span aria-hidden="true">
        {children ?? (
          <strong>
            <span ref={numberRef}>{percent}</span>
            <small>%</small>
          </strong>
        )}
      </span>
    </span>
  )
}
