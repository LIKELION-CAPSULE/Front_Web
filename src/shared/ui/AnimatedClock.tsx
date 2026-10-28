import { useLayoutEffect, useRef } from 'react'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'
import './animated-clock.css'

function ClockDigit({ digit, direction, reduced }: { digit: string; direction: 'up' | 'down'; reduced: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  const previous = useRef(digit)
  useLayoutEffect(() => {
    const node = ref.current
    const before = previous.current
    previous.current = digit
    if (!node || reduced || before === digit) return
    const outgoing = document.createElement('span')
    outgoing.className = 'clock-digit-outgoing'
    outgoing.textContent = before
    node.parentElement?.append(outgoing)
    const offset = direction === 'up' ? '65%' : '-65%'
    const exit = direction === 'up' ? '-65%' : '65%'
    const options: KeyframeAnimationOptions = { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)' }
    const incoming = node.animate([{ transform: `translateY(${offset})`, opacity: 0, filter: 'blur(3px)' }, { transform: 'translateY(0)', opacity: 1, filter: 'blur(0)' }], options)
    const leaving = outgoing.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: `translateY(${exit})`, opacity: 0, filter: 'blur(3px)' }], options)
    leaving.onfinish = () => outgoing.remove()
    return () => { incoming.cancel(); leaving.cancel(); outgoing.remove() }
  }, [digit, direction, reduced])
  return <span className="clock-digit"><span ref={ref}>{digit}</span></span>
}

export function AnimatedClock({ value, direction = 'up' }: { value: string; direction?: 'up' | 'down' }) {
  const reduced = useReducedMotion()
  return (
    <span role="img" aria-label={value} className="animated-clock" data-direction={direction}>
      <span aria-hidden="true">
        {Array.from(value, (digit, index) => /\d/.test(digit)
          ? <ClockDigit key={index} digit={digit} direction={direction} reduced={reduced} />
          : <span key={index} className="clock-separator">{digit}</span>)}
      </span>
    </span>
  )
}
