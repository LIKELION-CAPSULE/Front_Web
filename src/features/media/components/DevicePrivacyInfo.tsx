import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from '@/shared/ui/Icon'

export function DevicePrivacyInfo() {
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
      className="device-privacy-info"
      onPointerEnter={(event) => { if (event.pointerType === 'mouse') setOpen(true) }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse' && !event.currentTarget.contains(document.activeElement)) setOpen(false)
      }}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}
    >
      <button
        type="button"
        aria-label="카메라·마이크 권한 안내"
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        className="inline-flex size-8 items-center justify-center rounded-full text-subtle hover:text-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
      >
        <Icon name="help" size={20} />
      </button>
      {open && (
        <div id={id} role="tooltip" className="device-privacy-tooltip">
          <div className="rounded-card bg-surface px-4 py-3 text-xs leading-6 text-ink shadow-xl">
            <p>카메라는 얼굴 감지로 집중 시간을 측정하고, 마이크는 소리가 잘 들어오는지 확인하는 데 사용해요.</p>
            <p className="mt-2">영상과 소리는 내 기기에서만 처리하며 서버로 전송하거나 저장하지 않아요. 공부 화면에는 내 아바타가 보여요.</p>
          </div>
        </div>
      )}
    </div>
  )
}
