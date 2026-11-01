import { Fragment, useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Icon, type IconName } from '@/shared/ui/Icon'
import type { StudyInteractionMode } from '../study-interaction'
import type { DeviceState } from '@/features/media/types'
import type { CameraBackgroundId } from '@/features/media/camera-backgrounds'
import { CameraBackgroundPicker } from '@/features/media/components/CameraBackgroundPicker'
import '../study-dock.css'

export function StudyDock({ mode, onModeChange, paused, onPause, onFinish, camera, microphone, showCamera, onCamera, onMicrophone, onViewChange, background, onBackgroundChange, resting = false, restFinished = false }: {
  mode: StudyInteractionMode
  onModeChange: (mode: StudyInteractionMode) => void
  paused: boolean
  onPause: () => void
  onFinish: () => void
  camera: DeviceState
  microphone: DeviceState
  showCamera: boolean
  onCamera: () => void
  onMicrophone: () => void
  onViewChange: () => void
  background: CameraBackgroundId
  onBackgroundChange: (background: CameraBackgroundId) => void
  resting?: boolean
  restFinished?: boolean
}) {
  const root = useRef<HTMLDivElement>(null)
  const [focusIndex, setFocusIndex] = useState(0)
  const [tooltipDismissed, setTooltipDismissed] = useState(false)
  const [backgroundOpen, setBackgroundOpen] = useState(false)
  const id = useId()
  type DockItem = { key: string; label: string; hint: string; icon: IconName; pressed?: boolean; expanded?: boolean; shortcut?: string; disabled?: boolean; device?: boolean; divider?: boolean; action: () => void }
  const cameraBusy = camera.status === 'requesting'
  const microphoneBusy = microphone.status === 'requesting'
  const cameraOn = !!camera.stream, microphoneOn = !!microphone.stream
  const backgroundVisible = backgroundOpen && cameraOn
  useEffect(() => {
    if (!backgroundVisible) return
    const outside = (event: PointerEvent) => {
      const slot = root.current?.querySelector('[data-dock-popover-slot]')
      if (event.target instanceof Node && !slot?.contains(event.target)) setBackgroundOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [backgroundVisible])
  const items: DockItem[] = [
    { key: 'microphone', label: microphoneBusy ? '마이크 연결 중' : microphoneOn ? '마이크 끄기' : '마이크 켜기', hint: microphoneOn ? '마이크 끄기' : '마이크 켜기', icon: microphoneOn ? 'microphone' : 'microphoneOff', pressed: microphoneOn, device: true, disabled: microphoneBusy, action: onMicrophone },
    { key: 'camera', label: cameraBusy ? '카메라 연결 중' : cameraOn ? '카메라 끄기' : '카메라 켜기', hint: cameraOn ? '카메라 끄기' : '카메라 켜기 · 집중률 측정', icon: cameraOn ? 'video' : 'videoOff', pressed: cameraOn, device: true, disabled: cameraBusy, action: onCamera },
    { key: 'self-view', label: showCamera ? '아바타 보기' : '실제 카메라 보기', hint: showCamera ? '아바타 보기 · 측정은 계속해요' : cameraOn ? '실제 카메라 보기' : '카메라를 켜고 내 모습 보기', icon: showCamera ? 'user' : 'camera', pressed: showCamera, disabled: cameraBusy, action: onViewChange },
    { key: 'background', label: '배경 바꾸기', hint: cameraOn ? '배경 바꾸기' : '카메라를 켜고 배경 바꾸기', icon: 'image', expanded: backgroundVisible, disabled: !cameraOn || cameraBusy, action: () => setBackgroundOpen((open) => !open) },
    ...(!resting ? [
      { key: 'focus', label: '확대 모드', hint: '친구를 눌러 확대 · V', icon: 'zoomIn', pressed: mode === 'focus', shortcut: 'V', divider: true, action: () => onModeChange('focus') },
      { key: 'talk', label: '말 걸기 모드', hint: '친구를 눌러 대화 · C', icon: 'chat', pressed: mode === 'talk', shortcut: 'C', action: () => onModeChange('talk') },
    ] satisfies DockItem[] : []),
    { key: 'pause', label: restFinished ? '휴식 완료' : paused ? '계속하기' : '일시정지', hint: restFinished ? '새 목표를 정해 공부를 이어가세요' : paused ? '타이머 계속하기' : '타이머 일시정지', icon: restFinished ? 'check' : paused ? 'play' : 'pause', divider: true, disabled: restFinished, action: onPause },
    { key: 'finish', label: '공부 끝내기', hint: '공부 끝내기', icon: 'stop', action: onFinish },
  ]
  const tabStop = items[focusIndex]?.disabled || !items[focusIndex] ? items.findIndex(item => !item.disabled) : focusIndex

  function magnify(clientX: number) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    root.current?.querySelectorAll<HTMLElement>('[data-dock-slot]').forEach((slot) => {
      const rect = slot.getBoundingClientRect()
      const weight = Math.max(0, 1 - Math.abs(clientX - rect.left - rect.width / 2) / 120)
      slot.style.setProperty('--dock-weight', weight.toFixed(3))
    })
  }
  function reset() {
    root.current?.querySelectorAll<HTMLElement>('[data-dock-slot]').forEach((slot) => slot.style.setProperty('--dock-weight', '0'))
  }
  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && backgroundVisible) {
      setBackgroundOpen(false)
      root.current?.querySelector<HTMLButtonElement>('[data-action="background"]')?.focus()
      event.stopPropagation()
      return
    }
    // Arrow keys inside the background popover move between its radios, not toolbar buttons.
    if (event.target instanceof Element && event.target.closest('.study-dock-popover')) return
    if (event.key === 'Escape') {
      setTooltipDismissed(true)
      event.stopPropagation()
      return
    }
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const enabled = items.flatMap((item, index) => item.disabled ? [] : [index])
    const current = Math.max(0, enabled.indexOf(tabStop))
    const next = event.key === 'Home' ? enabled[0] : event.key === 'End' ? enabled.at(-1)
      : enabled[(current + (event.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length]
    if (next === undefined) return
    root.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus()
  }

  return (
    <div
      ref={root}
      role="toolbar"
      aria-label="공부 컨트롤"
      className="study-dock"
      data-tooltip-dismissed={tooltipDismissed || undefined}
      onKeyDown={navigate}
      onPointerMove={(event) => {
        if (tooltipDismissed) setTooltipDismissed(false)
        if (event.pointerType === 'mouse') magnify(event.clientX)
      }}
      onPointerLeave={reset}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) reset() }}
    >
      {items.map((item, index) => (
        <Fragment key={item.key}>
          {item.divider && <span role="separator" aria-orientation="vertical" className="study-dock-divider" />}
          <div
            className="study-dock-item"
            data-dock-slot
            data-dock-popover-slot={item.key === 'background' || undefined}
            onBlur={item.key === 'background' ? (event) => { if (!event.currentTarget.contains(event.relatedTarget)) setBackgroundOpen(false) } : undefined}
          >
            <button
              type="button"
              data-action={item.key}
              data-device={item.device || undefined}
              aria-label={item.label}
              aria-describedby={`${id}-${item.key}`}
              aria-pressed={item.pressed}
              aria-expanded={item.expanded}
              aria-haspopup={item.expanded === undefined ? undefined : 'true'}
              aria-keyshortcuts={item.shortcut}
              disabled={item.disabled}
              aria-busy={item.disabled && (item.key === 'camera' || item.key === 'microphone' || item.key === 'self-view') || undefined}
              tabIndex={tabStop === index ? 0 : -1}
              onClick={item.action}
              onFocus={(event) => {
                setFocusIndex(index)
                setTooltipDismissed(false)
                if (event.currentTarget.matches(':focus-visible')) {
                  const rect = event.currentTarget.getBoundingClientRect()
                  magnify(rect.left + rect.width / 2)
                }
              }}
            >
              <Icon name={item.icon} size={22} motion={item.key === 'talk' ? 'draw' : 'pulse'} />
            </button>
            <span id={`${id}-${item.key}`} role="tooltip" className="study-dock-tooltip">{item.hint}</span>
            {item.key === 'background' && backgroundVisible && (
              <div
                className="study-dock-popover"
                onPointerMove={(event) => event.stopPropagation()}
                // Thumbnail labels are not focusable, so pressing one would move focus to the page and close the popover first.
                onMouseDown={(event) => event.preventDefault()}
              >
                <CameraBackgroundPicker value={background} onChange={onBackgroundChange} legend="캠 배경" />
              </div>
            )}
          </div>
        </Fragment>
      ))}
    </div>
  )
}
