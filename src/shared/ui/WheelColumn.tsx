import { useEffect, useId, useLayoutEffect, useRef, type KeyboardEvent } from 'react'

type Option = { value: string; label: string }
const rowHeight = 40

function drawWheel(node: HTMLDivElement) {
  const center = node.scrollTop / rowHeight
  Array.from(node.children).forEach((child, index) => {
    const distance = index - center
    const item = child as HTMLElement
    item.style.transform = `perspective(240px) rotateX(${Math.max(-65, Math.min(65, distance * -18))}deg)`
    item.style.opacity = String(Math.max(0.12, 1 - Math.abs(distance) * 0.28))
  })
}

/** Native momentum scrolling and snapping keep the wheel usable with touch, mouse and keyboard. */
export function WheelColumn({
  label,
  hideLabel = false,
  options,
  value,
  onChange,
}: {
  label: string
  hideLabel?: boolean
  options: readonly Option[]
  value: string
  onChange: (value: string) => void
}) {
  const id = useId()
  const ref = useRef<HTMLDivElement>(null)
  const scrolling = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const count = useRef(options.length)
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value))
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    if (!scrolling.current || count.current !== options.length) {
      clearTimeout(timer.current)
      scrolling.current = false
      node.scrollTop = selectedIndex * rowHeight
      drawWheel(node)
    }
    count.current = options.length
  }, [selectedIndex, options.length])
  useEffect(() => () => clearTimeout(timer.current), [])

  function choose(index: number) {
    const option = options[Math.max(0, Math.min(options.length - 1, index))]
    const node = ref.current
    if (!option || !node) return
    clearTimeout(timer.current)
    scrolling.current = false
    node.scrollTop = options.indexOf(option) * rowHeight
    drawWheel(node)
    onChange(option.value)
  }
  function move(event: KeyboardEvent<HTMLDivElement>) {
    const next = event.key === 'ArrowDown' ? selectedIndex + 1
      : event.key === 'ArrowUp' ? selectedIndex - 1
        : event.key === 'PageDown' ? selectedIndex + 5
          : event.key === 'PageUp' ? selectedIndex - 5
            : event.key === 'Home' ? 0
              : event.key === 'End' ? options.length - 1 : null
    if (next !== null) {
      event.preventDefault()
      choose(next)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
    }
  }
  return (
    <div className="wheel-column">
      {!hideLabel && <span className="wheel-column-label" aria-hidden="true">{label}</span>}
      <div className="wheel-column-drum">
        <div
          ref={ref}
          className="wheel-column-scroll"
          role="listbox"
          aria-label={label}
          aria-orientation="vertical"
          aria-activedescendant={`${id}-${selectedIndex}`}
          tabIndex={0}
          onKeyDown={move}
          onScroll={(event) => {
            const node = event.currentTarget
            scrolling.current = true
            drawWheel(node)
            const index = Math.max(0, Math.min(options.length - 1, Math.round(node.scrollTop / rowHeight)))
            const option = options[index]
            if (option && option.value !== value) onChange(option.value)
            clearTimeout(timer.current)
            timer.current = setTimeout(() => {
              scrolling.current = false
              node.scrollTo({ top: index * rowHeight, behavior: 'instant' })
            }, 140)
          }}
        >
          {options.map((option, index) => (
            <div
              key={option.value}
              id={`${id}-${index}`}
              role="option"
              aria-selected={option.value === value}
              className="wheel-column-option"
              onClick={() => {
                ref.current?.focus({ preventScroll: true })
                choose(index)
              }}
            >
              {option.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
