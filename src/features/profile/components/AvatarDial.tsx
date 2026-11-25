import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { AvatarItem, ModelInfo } from '@/shared/api/types'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'
import { AvatarModelPreview } from './AvatarModelPreview'
import { AvatarArcRail } from './AvatarArcRail'
import {
  AVATAR_LEAVE_MS,
  choosePreview,
  emptyPreview,
  mountedPreviews,
  previewFailed,
  previewReleased,
  previewShown,
  standInVisible,
  type PreviewView,
} from '../avatar-preview-state'
import './avatar-dial.css'

/** Shown wherever the Live2D sample avatars can be picked (Live2D free material license, attribution duty). */
/** No avatar to choose (an empty `GET /avatars`): the server gives the default avatar. */
const EMPTY_AVATARS = '선택할 수 있는 아바타가 없어요. 기본 아바타로 시작해요.'

export const LIVE2D_CREDIT = '본 서비스의 아바타 캐릭터에는 주식회사 Live2D의 저작물이 이용되었습니다.'

type PreviewEntry = { key: string; model: ModelInfo; name: string }


const wrap = (index: number, count: number) => count ? ((index % count) + count) % count : 0

function AvatarPortrait({ avatar, fallback, className = 'avatar-picker-image' }: { avatar?: AvatarItem; fallback: ReactNode; className?: string }) {
  const [failedSource, setFailedSource] = useState<string | null>(null)
  return avatar?.thumbnailUrl && failedSource !== avatar.thumbnailUrl
    ? <img src={avatar.thumbnailUrl} alt="" className={className} draggable={false} onError={() => setFailedSource(avatar.thumbnailUrl!)} />
    : fallback
}

/**
 * Picks the user's avatar: a large preview (the chosen avatar as a moving Live2D model on a soft violet halo, fading
 * into the page at the waist), its name, an optional greeting, and a row of round stills whose centre is the choice.
 * Shared by onboarding step 1 and the account settings profile tab.
 *
 * - Only the chosen avatar loads Live2D; the row is still images. Two avatars are never on the stage together: the
 *   previous model fades out quickly and is released, the chosen avatar's still stands in while its model loads, and
 *   the model fades in over it (avatar-preview-state.ts).
 * - Arrow keys / Home / End on the row, a click on any still, or a horizontal swipe on the preview or the row.
 * - Reduced motion: the row and the preview switch instantly, and the preview is the still image (no live model)
 *   whenever one exists.
 * - The model itself is never recoloured, filtered or reshaped (license); only the light behind it and the fade at
 *   the bottom edge belong to the stage.
 */
export function AvatarDial({ avatars, value, onChange, disabled = false, size = 'large', layout = 'row', previewActive = true, fallback, greeting }: {
  avatars: readonly AvatarItem[]
  value?: number
  onChange: (id: number) => void
  disabled?: boolean
  /** `large`: onboarding. `compact`: the account settings dialog. Same layout, smaller stage and row. */
  size?: 'large' | 'compact'
  /**
   * `row`: the stage with a row of stills under it (account settings). `arc`: onboarding's big stage with the stills on
   * a vertical arc at the left edge of the screen (AvatarArcRail), the name and greeting over the stage's faded foot.
   */
  layout?: 'row' | 'arc'
  /** False keeps the still image (e.g. the dialog tab is hidden). */
  previewActive?: boolean
  fallback: ReactNode
  /** A short line under the avatar's name (onboarding greets the nickname being typed). */
  greeting?: ReactNode
}) {
  const reduced = useReducedMotion()
  const choices = avatars.filter((avatar): avatar is AvatarItem & { id: number } => typeof avatar.id === 'number')
  const found = choices.findIndex(avatar => avatar.id === value)
  const selectedIndex = Math.max(0, found)
  const selected = choices[selectedIndex]
  const model = selected?.model
  const previewKey = JSON.stringify([selected?.id, model?.modelJsonUrl, model?.scale, model?.offsetX, model?.offsetY])
  const live = Boolean(model?.modelJsonUrl) && previewActive && !(reduced && selected?.thumbnailUrl)
  const current: PreviewEntry | null = live && model ? { key: previewKey, model, name: selected?.name || '아바타' } : null
  // The previous model fades out and is released before the chosen one mounts; meanwhile the chosen avatar's still
  // stands in (avatar-preview-state.ts). Never two avatars visible; at most two models exist at once.
  const [view, setView] = useState<PreviewView<PreviewEntry>>(() => emptyPreview(current))
  const nextView = choosePreview(view, current, reduced)
  if (nextView !== view) setView(nextView)
  const previews = mountedPreviews(nextView).map(({ entry, leaving }) => ({ entry: !leaving && current && entry.key === current.key ? current : entry, leaving }))
  const standIn = Boolean(current) && standInVisible(nextView)
  const leavingKeys = nextView.leaving.map(entry => entry.key).join('|')
  useEffect(() => {
    if (!leavingKeys) return
    const keys = leavingKeys.split('|')
    const timer = setTimeout(() => setView(previous => keys.reduce((next, key) => previewReleased(next, key), previous)), AVATAR_LEAVE_MS)
    return () => clearTimeout(timer)
  }, [leavingKeys])
  const hasLive2D = choices.some(avatar => avatar.model?.modelJsonUrl)
  const root = useRef<HTMLFieldSetElement>(null)
  const rail = useRef<HTMLDivElement>(null)
  // Every choice in one row when the row is wide enough (the choice just grows); otherwise a carousel that slides the
  // choice to the centre.
  const [fits, setFits] = useState(true)
  useEffect(() => {
    const node = rail.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const slot = parseFloat(getComputedStyle(node).getPropertyValue('--slot')) || 80
      setFits(node.clientWidth >= choices.length * slot)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [choices.length])
  const gesture = useRef<{ id: number; x: number; y: number; dragging: boolean } | null>(null)
  const suppressClick = useRef(false)
  const hintId = useId()
  const nameId = useId()
  const selectedName = selected?.name || (choices.length ? `아바타 ${selectedIndex + 1}` : '기본 아바타')
  const radioName = useId()

  function choose(index: number, focus = false) {
    if (disabled || !choices.length) return
    onChange(choices[wrap(index, choices.length)]!.id)
    if (focus) requestAnimationFrame(() => root.current?.querySelector<HTMLInputElement>('input:checked:not(:disabled)')?.focus({ preventScroll: true }))
  }
  function navigate(event: KeyboardEvent<HTMLInputElement>, index: number) {
    let next: number
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = index + 1
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = index - 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = choices.length - 1
    else return
    event.preventDefault()
    choose(next, true)
  }
  function startGesture(event: PointerEvent<HTMLDivElement>) {
    if (disabled || choices.length < 2 || !event.isPrimary || event.button !== 0) return
    suppressClick.current = false
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false }
  }
  function moveGesture(event: PointerEvent<HTMLDivElement>) {
    const start = gesture.current
    if (!start || start.id !== event.pointerId) return
    const dx = event.clientX - start.x, dy = event.clientY - start.y
    if (!start.dragging && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      start.dragging = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }
  }
  function endGesture(event: PointerEvent<HTMLDivElement>) {
    const start = gesture.current
    gesture.current = null
    if (!start || start.id !== event.pointerId || !start.dragging) return
    suppressClick.current = true
    const dx = event.clientX - start.x
    if (Math.abs(dx) >= 36) choose(selectedIndex + (dx < 0 ? 1 : -1), true)
  }
  const swipe = {
    onPointerDown: startGesture,
    onPointerMove: moveGesture,
    onPointerUp: endGesture,
    onPointerCancel: () => { gesture.current = null },
    onClickCapture: (event: MouseEvent) => {
      if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false }
    },
  }
  const fade = reduced ? { duration: 0 } : { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const }

  const stage = <div className="avatar-picker-stage" data-no-native-drag data-draggable={!disabled && choices.length > 1 || undefined} {...swipe}>
      {/* Keyed so the light swells once on every change (CSS; none under reduced motion). */}
      <div key={selected?.id ?? 'none'} className="avatar-picker-halo" aria-hidden="true" />
      <figure className="avatar-picker-figure" aria-labelledby={nameId}>
        {current
          ? <>
            {/* The chosen avatar's still while its model loads (after the previous one has gone), under the model. */}
            {nextView.leaving.length === 0 && <div key={current.key} className="avatar-picker-still avatar-picker-stand-in" data-out={!standIn || undefined} data-avatar={current.key} aria-hidden="true">
              <AvatarPortrait avatar={selected} fallback={<div className="avatar-picker-fallback">{fallback}</div>} />
            </div>}
            {previews.map(({ entry, leaving }) => <AvatarModelPreview key={entry.key} avatarKey={entry.key} model={entry.model} name={entry.name} leaving={leaving}
              still={leaving ? undefined : <AvatarPortrait avatar={selected} fallback={<div className="avatar-picker-fallback">{fallback}</div>} />}
              onShown={() => setView(previous => previewShown(previous, entry.key))}
              onFailed={() => setView(previous => previewFailed(previous, entry.key))} />)}
          </>
          : <>
            {previews.map(({ entry }) => <AvatarModelPreview key={entry.key} avatarKey={entry.key} model={entry.model} name={entry.name} leaving />)}
            {!previews.length && <div className="avatar-picker-still" aria-hidden="true"><AvatarPortrait avatar={selected} fallback={<div className="avatar-picker-fallback">{fallback}</div>} /></div>}
          </>}
      </figure>
    </div>
  const caption = <div className="avatar-picker-caption">
      <AnimatePresence mode="wait" initial={false}>
        <motion.p key={selected?.id ?? 'none'} id={nameId} className="avatar-picker-name" title={selectedName}
          initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? { opacity: 1 } : { opacity: 0, y: -4 }} transition={fade}>
          {selectedName}
        </motion.p>
      </AnimatePresence>
      {greeting && <p className="avatar-picker-greeting">{greeting}</p>}
    </div>
  const credit = hasLive2D && <p className="avatar-picker-credit">{LIVE2D_CREDIT}</p>

  if (layout === 'arc') {
    return <fieldset ref={root} disabled={disabled} className="avatar-picker" data-layout="arc" data-size={size} aria-describedby={choices.length > 1 ? hintId : undefined}>
      <legend className="sr-only">내 아바타 선택</legend>
      {choices.length > 1 && <p id={hintId} className="sr-only">위아래 방향키, 휠, 위아래로 끌기로 다른 아바타를 고를 수 있어요.</p>}
      {choices.length
        ? <AvatarArcRail choices={choices} selectedIndex={selectedIndex} disabled={disabled} reduced={reduced} name={radioName}
          portraitOf={avatar => <AvatarPortrait avatar={avatar} fallback={fallback} />} onChoose={(index, focus) => choose(index, focus)} />
        // The rail keeps its place: one empty slot where the choice would sit, the note under it.
        : <div className="avatar-arc" data-empty>
          <span className="avatar-arc-empty-slot" aria-hidden="true" />
          <p className="avatar-picker-empty" role="status">{EMPTY_AVATARS}</p>
        </div>}
      <div className="avatar-picker-main">
        {stage}
        {caption}
        {credit}
      </div>
    </fieldset>
  }

  return <fieldset ref={root} disabled={disabled} className="avatar-picker" data-size={size} aria-describedby={choices.length > 1 ? hintId : undefined}>
    <legend className="sr-only">내 아바타 선택</legend>
    {choices.length > 1 && <p id={hintId} className="sr-only">방향키나 좌우로 밀어서 다른 아바타를 고를 수 있어요.</p>}

    {stage}

    {caption}

    {choices.length
      ? <div ref={rail} className="avatar-picker-rail" data-fit={fits || undefined} data-no-native-drag data-draggable={!disabled && choices.length > 1 || undefined} {...swipe}>
        <div className="avatar-picker-track" style={{ '--rail-index': selectedIndex } as CSSProperties}>
          {choices.map((avatar, index) => {
            const checked = index === selectedIndex
            return <label key={avatar.id} className="avatar-picker-option" title={avatar.name}
              data-distance={Math.min(3, Math.abs(index - selectedIndex))} data-checked={checked || undefined}>
              <input className="sr-only" type="radio" name={radioName} value={avatar.id} aria-label={avatar.name || `아바타 ${index + 1}`}
                checked={checked} disabled={disabled} tabIndex={checked ? 0 : -1} onChange={() => choose(index)} onKeyDown={event => navigate(event, index)} />
              <span className="avatar-picker-thumb"><AvatarPortrait avatar={avatar} fallback={fallback} /></span>
            </label>
          })}
        </div>
      </div>
      : <div className="avatar-picker-rail" data-empty><p className="avatar-picker-empty" role="status">{EMPTY_AVATARS}</p></div>}

    {credit}
  </fieldset>
}
