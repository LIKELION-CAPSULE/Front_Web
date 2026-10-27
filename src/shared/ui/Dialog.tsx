import { useEffect, useId, useRef } from 'react'
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
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const startedOnBackdrop = useRef(false)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog?.open) dialog?.showModal()
    if (!open && dialog?.open) dialog.close()
  }, [open])
  function dismiss() {
    ref.current?.close()
    onClose()
  }
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        dismiss()
      }}
      onClose={onClose}
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
        <h2 id={titleId} className="text-xl font-bold">
          {title}
        </h2>
        <button
          type="button"
          onClick={dismiss}
          aria-label="닫기"
          className="-mt-1 flex size-9 shrink-0 items-center justify-center rounded-full text-xl text-subtle hover:bg-surface"
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  )
}
