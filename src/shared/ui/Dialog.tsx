import { useId, useLayoutEffect, useRef } from 'react'
import type { MouseEvent, PointerEvent, ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import { CloseButton } from './CloseButton'
import { PixelRoofStrip, PixelSnowfall, PixelToneIcon, type PixelTone } from './pixel/PixelFrame'

export type DialogTone = PixelTone

function isBackdrop(event: MouseEvent<HTMLDialogElement> | PointerEvent<HTMLDialogElement>) {
  if (event.target !== event.currentTarget) return false
  const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect()
  return event.clientX < left || event.clientX >= right || event.clientY < top || event.clientY >= bottom
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
  presentation = 'modal',
  label,
  closeLabel = '닫기',
  showCloseButton = true,
  showHeader = true,
  titleAlign = 'start',
  dismissible = true,
  onOpen,
  tone,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  className?: string
  presentation?: 'modal' | 'sheet' | 'popover'
  label?: string
  closeLabel?: string
  showCloseButton?: boolean
  showHeader?: boolean
  titleAlign?: 'start' | 'center'
  dismissible?: boolean
  onOpen?: (dialog: HTMLDialogElement) => void | (() => void)
  /**
   * Optional pixel icon in front of the title (same line): danger, info, celebrate (also denser snow and sparkles on the
   * roof), credit (credit gold). Without a tone the header shows the title alone.
   */
  tone?: DialogTone
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const startedOnBackdrop = useRef(false)
  const titleId = useId()
  // Sheet and popover describe placement; every presentation remains a native modal.
  useLayoutEffect(() => {
    const dialog = ref.current
    const anchor = dialog?.parentElement
    if (!open || presentation === 'modal' || !dialog || !anchor) return
    function position() {
      if (!dialog || !anchor) return
      const bounds = anchor.getBoundingClientRect()
      const inset = 16
      const width = Math.min(window.innerWidth - inset * 2, Math.max(280, bounds.width - (presentation === 'popover' ? 80 : 0)))
      const left = Math.max(inset, Math.min(bounds.right - width - (presentation === 'popover' ? 20 : 0), window.innerWidth - width - inset))
      const availableHeight = window.innerHeight - inset * 2
      Object.assign(dialog.style, { position: 'fixed', inset: 'auto', margin: '0', width: `${width}px`, maxWidth: 'none', left: `${left}px` })
      if (presentation === 'sheet') {
        dialog.style.bottom = `${Math.max(inset, window.innerHeight - bounds.bottom)}px`
        dialog.style.maxHeight = `${Math.min(availableHeight, Math.max(240, bounds.height * 0.85))}px`
      } else {
        const top = Math.max(inset, Math.min(bounds.top + 154, window.innerHeight - 256))
        dialog.style.top = `${top}px`
        dialog.style.maxHeight = `${Math.min(Math.max(240, bounds.height - 170), window.innerHeight - top - inset)}px`
      }
    }
    position()
    const observer = new ResizeObserver(position)
    observer.observe(anchor)
    window.addEventListener('resize', position)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', position)
    }
  }, [open, presentation])
  useLayoutEffect(() => {
    const dialog = ref.current
    let cleanup: void | (() => void)
    if (open && dialog && !dialog.open) {
      dialog.showModal()
      dialog.querySelector<HTMLElement>('[data-dialog-initial-focus]')?.focus({ preventScroll: true })
      cleanup = onOpen?.(dialog)
    }
    if (!open && dialog?.open) dialog.close()
    return () => {
      cleanup?.()
      if (dialog?.open) dialog.close()
    }
  }, [open, onOpen])
  function dismiss() {
    if (!dismissible) return
    ref.current?.close()
    onClose()
  }
  return (
    <dialog
      ref={ref}
      data-presentation={presentation}
      aria-label={label}
      aria-labelledby={label ? undefined : titleId}
      onCancel={(event) => {
        event.preventDefault()
        event.stopPropagation()
        dismiss()
      }}
      onClose={() => { if (open && !ref.current?.open) onClose() }}
      onPointerDown={(event) => {
        startedOnBackdrop.current = event.button === 0 && event.isPrimary && isBackdrop(event)
      }}
      onPointerCancel={() => { startedOnBackdrop.current = false }}
      onClick={(event) => {
        const shouldDismiss = startedOnBackdrop.current && isBackdrop(event)
        startedOnBackdrop.current = false
        if (shouldDismiss) dismiss()
      }}
      data-frame={showHeader ? 'header' : 'custom'}
      data-tone={tone}
      className={cn(
        // Pixel frame (design B2): surface, stepped corners, roof, motion in src/shared/ui/pixel/pixel-frame.css.
        'app-dialog m-auto max-h-[90dvh] w-[calc(100%_-_32px)] max-w-lg text-ink',
        // With the header the dialog owns its layout (roof, header, scrolling body); without it the content does.
        showHeader ? 'p-0' : cn('overflow-y-auto', presentation === 'modal' ? 'p-6 sm:p-8' : presentation === 'sheet' ? 'p-panel-compact' : 'p-content-compact'),
        className,
      )}
    >
      {showHeader ? <>
        <PixelSnowfall celebrate={tone === 'celebrate'} />
        <div className={cn('app-dialog-head', titleAlign === 'center' && 'justify-center')}>
          {tone && <PixelToneIcon tone={tone} />}
          <h2 id={titleId} className={cn(presentation === 'modal' ? 'type-dialog-title' : 'type-card-title', titleAlign === 'center' && 'text-center', titleAlign === 'center' && showCloseButton && 'px-12')}>
            {title}
          </h2>
          {showCloseButton && dismissible && (
            <CloseButton
              onClick={dismiss}
              label={closeLabel}
              className={cn('app-dialog-close', titleAlign === 'center' && 'absolute right-[var(--px-pad)]')}
            />
          )}
        </div>
        <div className="app-dialog-body">{children}</div>
      </> : <>
        <h2 id={titleId} className="sr-only">{title}</h2>
        {presentation === 'modal' && <PixelRoofStrip />}
        {children}
      </>}
    </dialog>
  )
}
