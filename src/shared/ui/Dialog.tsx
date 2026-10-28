import { useId, useLayoutEffect, useRef } from 'react'
import type { MouseEvent, PointerEvent, ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

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
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  className?: string
  presentation?: 'modal' | 'sheet' | 'popover'
  label?: string
  closeLabel?: string
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
    if (open && !dialog?.open) dialog?.showModal()
    if (!open && dialog?.open) dialog.close()
    return () => { if (dialog?.open) dialog.close() }
  }, [open])
  function dismiss() {
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
      className={cn(
        'app-dialog m-auto max-h-[90dvh] w-[calc(100%_-_32px)] max-w-lg overflow-y-auto rounded-3xl bg-canvas p-6 text-ink shadow-2xl sm:p-8',
        className,
      )}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <h2 id={titleId} className={cn(presentation === 'modal' ? 'text-dialog-title' : 'text-card-title', 'font-semibold')}>
          {title}
        </h2>
        <button
          type="button"
          onClick={dismiss}
          aria-label={closeLabel}
          className="-mt-1 flex size-9 shrink-0 items-center justify-center rounded-full text-xl text-subtle transition-colors hover:bg-button-subtle-hover"
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  )
}
