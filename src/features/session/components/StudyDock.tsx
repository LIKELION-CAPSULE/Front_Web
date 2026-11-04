import { Fragment, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import type { KeyboardEvent } from 'react'
import { Icon, type IconName } from '@/shared/ui/Icon'
import type { DeviceState } from '@/features/media/types'
import type { CameraBackgroundId } from '@/features/media/camera-backgrounds'
import { CameraBackgroundPicker } from '@/features/media/components/CameraBackgroundPicker'
import '../study-dock.css'

const compactQuery = '(max-width: 699px)'
const subscribeCompact = (notify: () => void) => {
  const media = window.matchMedia(compactQuery)
  media.addEventListener('change', notify)
  return () => media.removeEventListener('change', notify)
}
const secondaryKeys = new Set(['self-view', 'background'])

export function StudyDock({ chatOpen, onChatToggle, onPhaseToggle, onFinish, camera, microphone, showCamera, onCamera, onMicrophone, onViewChange, background, onBackgroundChange, resting = false }: {
  chatOpen: boolean
  onChatToggle: () => void
  onPhaseToggle: () => void
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
}) {
  const root = useRef<HTMLDivElement>(null)
  const [focusIndex, setFocusIndex] = useState(0)
  const [tooltipDismissed, setTooltipDismissed] = useState(false)
  const [backgroundOpen, setBackgroundOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const compact = useSyncExternalStore(subscribeCompact, () => window.matchMedia(compactQuery).matches, () => false)
  const id = useId()
  type DockItem = { key: string; label: string; hint: string; icon: IconName; pressed?: boolean; expanded?: boolean; shortcut?: string; disabled?: boolean; device?: boolean; divider?: boolean; action: () => void }
  const cameraBusy = camera.status === 'requesting'
  const microphoneBusy = microphone.status === 'requesting'
  const cameraOn = !!camera.stream, microphoneOn = !!microphone.stream
  const moreVisible = compact && moreOpen
  const backgroundVisible = backgroundOpen && cameraOn && (!compact || moreVisible)
  useEffect(() => {
    if (!backgroundVisible && !moreVisible) return
    const outside = (event: PointerEvent) => {
      const slot = root.current?.querySelector('[data-dock-popover-slot]')
      if (event.target instanceof Node && !slot?.contains(event.target)) {
        setBackgroundOpen(false)
        setMoreOpen(false)
      }
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [backgroundVisible, moreVisible])
  const items: DockItem[] = [
    { key: 'microphone', label: microphoneBusy ? '마이크 연결 중' : microphoneOn ? '마이크 끄기' : '마이크 켜기', hint: microphoneBusy ? '연결 중' : microphoneOn ? '마이크 끄기' : '마이크 켜기', icon: microphoneOn ? 'microphone' : 'microphoneOff', pressed: microphoneOn, device: true, disabled: microphoneBusy, action: onMicrophone },
    { key: 'camera', label: cameraBusy ? '카메라 연결 중' : cameraOn ? '카메라 끄기' : '카메라 켜기', hint: cameraBusy ? '연결 중' : cameraOn ? '카메라 끄기' : '카메라 켜기', icon: cameraOn ? 'video' : 'videoOff', pressed: cameraOn, device: true, disabled: cameraBusy, action: () => { setBackgroundOpen(false); onCamera() } },
    { key: 'self-view', label: showCamera ? '아바타 보기' : '실제 카메라 보기', hint: showCamera ? '아바타 보기' : '카메라 보기', icon: showCamera ? 'user' : 'camera', pressed: showCamera, disabled: cameraBusy, action: () => { setBackgroundOpen(false); onViewChange() } },
    { key: 'background', label: '배경 바꾸기', hint: cameraOn ? '배경 변경' : '카메라 필요', icon: 'image', expanded: backgroundVisible, disabled: !cameraOn || cameraBusy, action: () => {
      setBackgroundOpen(!backgroundVisible)
    } },
    { key: 'chat', label: chatOpen ? '대화 닫기' : '대화 열기', hint: chatOpen ? '대화 닫기' : '대화 열기', icon: 'chat', pressed: chatOpen, expanded: chatOpen, shortcut: 'C', divider: true, action: onChatToggle },
    { key: 'break', label: resting ? '공부 이어가기' : '쉬는 시간', hint: resting ? '공부 재개' : '10분 쉬기', icon: resting ? 'play' : 'coffee', divider: true, action: onPhaseToggle },
    { key: 'finish', label: '공부 끝내기', hint: '공부 종료', icon: 'stop', action: onFinish },
  ]
  const moreItem: DockItem = { key: 'more', label: '추가 도구', hint: '추가 도구', icon: 'more', expanded: moreVisible, action: () => { setMoreOpen(open => !open); setBackgroundOpen(false) } }
  const visibleItems = compact ? [items[0]!, items[1]!, moreItem, ...items.filter(item => item.key === 'chat' || item.key === 'break' || item.key === 'finish')] : items
  const secondaryItems = items.filter(item => secondaryKeys.has(item.key))
  const tabStop = visibleItems[focusIndex]?.disabled || !visibleItems[focusIndex] ? visibleItems.findIndex(item => !item.disabled) : focusIndex

  function magnify(clientX: number) {
    if (compact || backgroundVisible || moreVisible || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
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
    if (event.key === 'Escape' && (backgroundVisible || moreVisible)) {
      setBackgroundOpen(false)
      setMoreOpen(false)
      root.current?.querySelector<HTMLButtonElement>(compact ? '[data-action="more"]' : '[data-action="background"]')?.focus()
      event.preventDefault()
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
    const enabled = visibleItems.flatMap((item, index) => item.disabled ? [] : [index])
    const current = Math.max(0, enabled.indexOf(tabStop))
    const next = event.key === 'Home' ? enabled[0] : event.key === 'End' ? enabled.at(-1)
      : enabled[(current + (event.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length]
    if (next === undefined) return
    root.current?.querySelectorAll<HTMLButtonElement>(':scope > .study-dock-item > button')[next]?.focus()
  }
  function backgroundPicker() {
    // Keep focus in the popover while native thumbnail labels activate their radios.
    return (
      <div onMouseDown={event => event.preventDefault()}>
        <CameraBackgroundPicker value={background} onChange={onBackgroundChange} hideLegend />
      </div>
    )
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
      {visibleItems.map((item, index) => (
        <Fragment key={item.key}>
          {item.divider && <span role="separator" aria-orientation="vertical" className="study-dock-divider" />}
          <div
            className="study-dock-item"
            data-dock-slot
            data-dock-popover-slot={item.key === 'background' || item.key === 'more' || undefined}
            onBlur={item.key === 'background' || item.key === 'more' ? (event) => {
              // A label can briefly focus the document before activating its radio.
              // Only a real move to another control closes the picker; outside clicks are handled above.
              if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) {
                setBackgroundOpen(false)
                setMoreOpen(false)
              }
            } : undefined}
          >
            <button
              type="button"
              data-action={item.key}
              data-device={item.device || undefined}
              aria-label={item.label}
              aria-describedby={`${id}-${item.key}`}
              aria-pressed={item.pressed}
              aria-expanded={item.expanded}
              aria-haspopup={item.key === 'chat' || item.expanded === undefined ? undefined : 'true'}
              aria-controls={item.key === 'chat' ? 'session-chat' : item.key === 'more' && moreVisible ? `${id}-more-tools` : undefined}
              aria-keyshortcuts={item.shortcut}
              disabled={item.disabled}
              aria-busy={item.disabled && (item.key === 'camera' || item.key === 'microphone' || item.key === 'self-view') || undefined}
              tabIndex={tabStop === index ? 0 : -1}
              onClick={() => {
                if (item.key === 'background' || item.key === 'more') reset()
                item.action()
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
            <span id={`${id}-${item.key}`} role="tooltip" className="study-dock-tooltip">{item.hint}</span>
            {item.key === 'background' && backgroundVisible && (
              <div
                className="study-dock-popover"
                onPointerMove={(event) => event.stopPropagation()}
              >
                {backgroundPicker()}
              </div>
            )}
            {item.key === 'more' && moreVisible && (
              <div id={`${id}-more-tools`} role="group" aria-label="추가 공부 도구" className="study-dock-popover study-dock-more" onPointerMove={event => event.stopPropagation()}>
                {secondaryItems.map(tool => (
                  <button key={tool.key} type="button" data-dock-secondary disabled={tool.disabled} aria-pressed={tool.pressed} aria-expanded={tool.expanded} onClick={() => {
                    tool.action()
                    if (tool.key !== 'background') {
                      setMoreOpen(false)
                      root.current?.querySelector<HTMLButtonElement>('[data-action="more"]')?.focus()
                    }
                  }}>
                    <Icon name={tool.icon} size={20} /><span>{tool.label}</span>
                  </button>
                ))}
                {backgroundVisible && <div className="study-dock-more-background">{backgroundPicker()}</div>}
              </div>
            )}
          </div>
        </Fragment>
      ))}
    </div>
  )
}
