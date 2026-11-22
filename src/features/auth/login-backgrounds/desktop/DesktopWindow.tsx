import { useRef, useState, type ReactNode } from 'react'
import { MENU_BAR_HEIGHT } from './desktop-config'

interface DesktopWindowProps {
  id: string
  x: number
  y: number
  width: number
  height?: number
  maxHeight?: number
  zIndex: number
  active: boolean
  title: ReactNode
  titleRight?: ReactNode
  className?: string
  bodyClassName?: string
  showControls?: boolean
  draggable?: boolean
  role?: 'dialog'
  ariaModal?: boolean
  ariaLabelledBy?: string
  onClose?: () => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLElement>) => void
  onMove: (x: number, y: number) => void
  onFocus: () => void
  onDragStateChange?: (dragging: boolean) => void
  children: ReactNode
}

export function DesktopWindow({
  id,
  x,
  y,
  width,
  height,
  maxHeight,
  zIndex,
  active,
  title,
  titleRight,
  className,
  bodyClassName,
  showControls = true,
  draggable = true,
  role,
  ariaModal,
  ariaLabelledBy,
  onClose,
  onKeyDown,
  onMove,
  onFocus,
  onDragStateChange,
  children,
}: DesktopWindowProps) {
  const [shaking, setShaking] = useState(false)
  const dragRef = useRef<{
    pointerId: number
    startClientX: number
    startClientY: number
    originX: number
    originY: number
  } | null>(null)
  const winRef = useRef<HTMLElement>(null)

  const triggerShake = () => {
    setShaking(false)
    requestAnimationFrame(() => setShaking(true))
    setTimeout(() => setShaking(false), 320)
  }

  const handleTitlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    if ((e.target as Element).closest('button, a, input')) return
    onFocus()
    if (!draggable) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originX: x,
      originY: y,
    }
    onDragStateChange?.(true)
  }

  const handleTitlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const vw = window.innerWidth
    const vh = window.innerHeight
    const winHeight = winRef.current?.offsetHeight ?? height ?? 460
    const nextX = Math.max(8, Math.min(vw - width - 8, drag.originX + (e.clientX - drag.startClientX)))
    const maxY = Math.max(MENU_BAR_HEIGHT + 8, vh - Math.min(winHeight, 80) - 8)
    const nextY = Math.max(MENU_BAR_HEIGHT + 8, Math.min(maxY, drag.originY + (e.clientY - drag.startClientY)))
    onMove(Math.round(nextX), Math.round(nextY))
  }

  const finishDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    dragRef.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    onDragStateChange?.(false)
  }

  return (
    <section
      ref={winRef}
      data-desktop-window={id}
      role={role}
      aria-modal={ariaModal !== undefined ? ariaModal : undefined}
      aria-labelledby={ariaLabelledBy}
      className={`desktop-window${active ? ' desktop-window--active' : ''}${shaking ? ' desktop-window--shake' : ''}${className ? ` ${className}` : ''}`}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: height ? `${height}px` : undefined,
        maxHeight: maxHeight ? `${maxHeight}px` : undefined,
        zIndex,
      }}
      onPointerDown={onFocus}
      onKeyDown={onKeyDown}
    >
      <div
        className={draggable ? 'desktop-window-titlebar' : 'desktop-window-titlebar desktop-window-titlebar--static'}
        onPointerDown={handleTitlePointerDown}
        onPointerMove={handleTitlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        <div className="desktop-window-title-left">{title}</div>
        <div className="desktop-window-title-right">
          {titleRight}
          {onClose ? (
            <div className="desktop-window-controls">
              <button
                type="button"
                className="desktop-window-dot desktop-window-dot--close"
                aria-label="닫기"
                onClick={onClose}
              >
                <span aria-hidden="true">×</span>
              </button>
              <button
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                className="desktop-window-dot"
                onClick={triggerShake}
              />
              <button
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                className="desktop-window-dot"
                onClick={triggerShake}
              />
            </div>
          ) : (
            showControls && (
              <div className="desktop-window-controls" aria-hidden="true">
                <button
                  type="button"
                  tabIndex={-1}
                  className="desktop-window-dot"
                  onClick={triggerShake}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="desktop-window-dot"
                  onClick={triggerShake}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="desktop-window-dot"
                  onClick={triggerShake}
                />
              </div>
            )
          )}
        </div>
      </div>
      <div className={bodyClassName ? `desktop-window-body ${bodyClassName}` : 'desktop-window-body'}>
        {children}
      </div>
    </section>
  )
}
