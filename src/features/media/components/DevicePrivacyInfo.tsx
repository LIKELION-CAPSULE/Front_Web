import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Icon } from '@/shared/ui/Icon'
import { FloatingSurface } from '@/shared/ui/FloatingSurface'

/**
 * A 「?」 that opens a short note on hover, focus or click and closes on Esc or a click outside. The study screen uses
 * the default note; the connection screen passes its own (`label`, `children`).
 */
export function DevicePrivacyInfo({ label = '카메라·마이크 권한 안내', className, children }: { label?: string; className?: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  return (
    <div
      ref={root}
      className={className ? `device-privacy-info ${className}` : 'device-privacy-info'}
      onPointerEnter={(event) => { if (event.pointerType === 'mouse') setOpen(true) }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse' && !event.currentTarget.contains(document.activeElement)) setOpen(false)
      }}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        className="inline-flex size-11 items-center justify-center rounded-full text-subtle hover:text-text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus-ring"
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
      >
        <Icon name="help" size={20} />
      </button>
      {open && (
        <div id={id} role="tooltip" className="device-privacy-tooltip">
          <FloatingSurface className="rounded-card px-4 py-3 type-body-compact">
            {children ?? (
              <>
                <p>카메라를 켜면 얼굴 감지로 집중 시간을 측정해요. 카메라와 마이크는 연결 화면에서 각각 켜고 끌 수 있어요.</p>
                <p className="mt-2">영상과 소리는 내 기기에서만 처리하며 서버로 전송하거나 저장하지 않아요. 연결 화면에는 내 아바타가 보여요.</p>
              </>
            )}
          </FloatingSurface>
        </div>
      )}
    </div>
  )
}
