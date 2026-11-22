import { Fragment, useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, RefObject } from 'react'
import { Icon, type IconName } from '@/shared/ui/Icon'
import { cn } from '@/shared/lib/cn'
import './glass-dock.css'

export interface GlassDockItem {
  key: string
  label: string
  tooltip?: string
  icon: IconName
  pressed?: boolean
  expanded?: boolean
  shortcut?: string
  disabled?: boolean
  busy?: boolean
  device?: boolean
  tone?: 'default' | 'danger'
  dividerBefore?: boolean
  secondary?: boolean
  controls?: string
  hasPopup?: 'menu' | 'dialog' | 'true'
  onAction: () => void
}

export interface GlassDockProps {
  items: readonly GlassDockItem[]
  ariaLabel: string
  className?: string
  /** Stage/container element used to measure compact breakpoint (< compactThreshold px). Defaults to the dock's parent element. */
  containerRef?: RefObject<HTMLElement | null>
  compactThreshold?: number
  moreLabel?: string
  moreMenuLabel?: string
}

export function GlassDock({
  items,
  ariaLabel,
  className,
  containerRef,
  compactThreshold = 700,
  moreLabel = '추가 도구',
  moreMenuLabel = '추가 도구',
}: GlassDockProps) {
  const root = useRef<HTMLDivElement>(null)
  const [focusIndex, setFocusIndex] = useState(0)
  const [tooltipDismissed, setTooltipDismissed] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [compact, setCompact] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < compactThreshold : false,
  )
  const id = useId()

  useEffect(() => {
    const target = containerRef?.current ?? root.current?.parentElement
    if (!target) return
    const update = (width: number) => {
      if (width > 0) setCompact(width < compactThreshold)
    }
    update(target.getBoundingClientRect().width)
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) update(entry.contentRect.width)
    })
    observer.observe(target)
    return () => observer.disconnect()
  }, [containerRef, compactThreshold])

  const secondaryItems = items.filter((item) => item.secondary)
  const moreVisible = compact && moreOpen && secondaryItems.length > 0

  useEffect(() => {
    if (!moreVisible) return
    const outside = (event: PointerEvent) => {
      const slot = root.current?.querySelector('[data-dock-popover-slot]')
      if (event.target instanceof Node && !slot?.contains(event.target)) {
        setMoreOpen(false)
      }
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [moreVisible])

  const moreItem: GlassDockItem = {
    key: 'more',
    label: moreLabel,
    tooltip: moreLabel,
    icon: 'more',
    expanded: moreVisible,
    hasPopup: 'true',
    controls: moreVisible ? `${id}-more-tools` : undefined,
    dividerBefore: secondaryItems[0]?.dividerBefore,
    onAction: () => setMoreOpen((open) => !open),
  }

  const visibleItems: GlassDockItem[] = (() => {
    if (!compact || secondaryItems.length === 0) return [...items]
    const result: GlassDockItem[] = []
    let insertedMore = false
    for (const item of items) {
      if (item.secondary) {
        if (!insertedMore) {
          result.push(moreItem)
          insertedMore = true
        }
      } else {
        result.push(item)
      }
    }
    return result
  })()

  const tabStop =
    !visibleItems[focusIndex] || visibleItems[focusIndex].disabled
      ? visibleItems.findIndex((item) => !item.disabled)
      : focusIndex

  function magnify(clientX: number) {
    if (compact || moreVisible || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    root.current?.querySelectorAll<HTMLElement>('[data-dock-slot]').forEach((slot) => {
      const rect = slot.getBoundingClientRect()
      const weight = Math.max(0, 1 - Math.abs(clientX - rect.left - rect.width / 2) / 120)
      slot.style.setProperty('--dock-weight', weight.toFixed(3))
    })
  }

  function reset() {
    root.current?.querySelectorAll<HTMLElement>('[data-dock-slot]').forEach((slot) => {
      slot.style.setProperty('--dock-weight', '0')
    })
  }

  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && moreVisible) {
      setMoreOpen(false)
      root.current?.querySelector<HTMLButtonElement>('[data-action="more"]')?.focus()
      event.preventDefault()
      event.stopPropagation()
      return
    }
    if (event.target instanceof Element && event.target.closest('.glass-dock-popover')) return
    if (event.key === 'Escape') {
      setTooltipDismissed(true)
      event.stopPropagation()
      return
    }
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const enabled = visibleItems.flatMap((item, index) => (item.disabled ? [] : [index]))
    if (enabled.length === 0) return
    const current = Math.max(0, enabled.indexOf(tabStop))
    const next =
      event.key === 'Home'
        ? enabled[0]
        : event.key === 'End'
          ? enabled.at(-1)
          : enabled[(current + (event.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length]
    if (next === undefined) return
    root.current?.querySelectorAll<HTMLButtonElement>(':scope > .glass-dock-item > button')[next]?.focus()
  }

  return (
    <div
      ref={root}
      role="toolbar"
      aria-label={ariaLabel}
      className={cn('glass-dock', className)}
      data-compact={compact || undefined}
      data-tooltip-dismissed={tooltipDismissed || undefined}
      onKeyDown={navigate}
      onPointerMove={(event) => {
        if (tooltipDismissed) setTooltipDismissed(false)
        if (event.pointerType === 'mouse') magnify(event.clientX)
      }}
      onPointerLeave={reset}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) reset()
      }}
    >
      {visibleItems.map((item, index) => (
        <Fragment key={item.key}>
          {item.dividerBefore && <span role="separator" aria-orientation="vertical" className="glass-dock-divider" />}
          <div
            className="glass-dock-item"
            data-dock-slot
            data-dock-popover-slot={item.key === 'more' || undefined}
            onBlur={
              item.key === 'more'
                ? (event) => {
                    if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) {
                      setMoreOpen(false)
                    }
                  }
                : undefined
            }
          >
            <button
              type="button"
              data-action={item.key}
              data-device={item.device || undefined}
              data-tone={item.tone === 'danger' ? 'danger' : undefined}
              aria-label={item.label}
              aria-describedby={`${id}-${item.key}`}
              aria-pressed={item.pressed}
              aria-expanded={item.expanded}
              aria-haspopup={item.hasPopup}
              aria-controls={item.controls}
              aria-keyshortcuts={item.shortcut}
              disabled={item.disabled}
              aria-busy={item.busy || undefined}
              tabIndex={tabStop === index ? 0 : -1}
              onClick={() => {
                if (item.key === 'more') reset()
                item.onAction()
              }}
              onFocus={(event) => {
                setFocusIndex(index)
                setTooltipDismissed(false)
                if (event.currentTarget.matches(':focus-visible')) {
                  const rect = event.currentTarget.getBoundingClientRect()
                  magnify(rect.left + rect.width / 2)
                }
              }}
            >
              <Icon name={item.icon} size={22} />
            </button>
            <span id={`${id}-${item.key}`} role="tooltip" className="glass-dock-tooltip">
              {item.tooltip ?? item.label}
            </span>
            {item.key === 'more' && moreVisible && (
              <div
                id={`${id}-more-tools`}
                role="group"
                aria-label={moreMenuLabel}
                className="glass-dock-popover glass-dock-more"
                onPointerMove={(event) => event.stopPropagation()}
              >
                {secondaryItems.map((tool) => (
                  <button
                    key={tool.key}
                    type="button"
                    data-dock-secondary={tool.key}
                    disabled={tool.disabled}
                    aria-pressed={tool.pressed}
                    aria-expanded={tool.expanded}
                    aria-haspopup={tool.hasPopup}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setMoreOpen(false)
                      tool.onAction()
                    }}
                  >
                    <Icon name={tool.icon} size={20} />
                    <span>{tool.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Fragment>
      ))}
    </div>
  )
}
