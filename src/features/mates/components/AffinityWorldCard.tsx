import { useId, useState, type CSSProperties, type KeyboardEvent } from 'react'
import type { AffinityProgressView } from '@/features/mates/affinity-progress'
import { initialWorldIndex, WORLD_COPY, worldLabel, worldLockedCaption, type MateWorld } from '@/features/mates/mate-worlds'
import { cn } from '@/shared/lib/cn'
import { Icon } from '@/shared/ui/Icon'
import { BlockLabel } from './BlockLabel'
import { MateWorldDialog, MateWorldTile } from './MateWorldTile'
import './affinity-world-card.css'

/** Where the shown world is, per `resetKey` (a new mate or stage starts over at its current world). */
type View = { key: string; index: number; direction: -1 | 1; moved: boolean }

/**
 * 친밀도 card (user decision 2026-11-28: 친밀도 and 세계관 are separate cards again, as 함께한 시간 · 최근 캡슐): the stage,
 * one progress bar and what is left. Not tied to 내 메이트: the surface comes from `className` (the column passes its
 * glass block class), ids are its own, and the tour anchor is optional.
 */
export function AffinityCard({ affinity, className, tour }: {
  affinity: AffinityProgressView
  className?: string
  /** `data-tour` anchor (the service tour). */
  tour?: string
}) {
  const id = useId()
  const progress = affinity.isLast ? 1 : affinity.progress
  const caption =
    affinity.nextCaption ??
    (affinity.nextStageName ? `다음 단계: ${affinity.nextStageName}` : affinity.isLast ? '가장 가까운 사이가 됐어요' : null)
  return (
    <section className={cn('affinity-card', className)} aria-labelledby={`${id}-affinity`} data-tour={tour}>
      <BlockLabel id={`${id}-affinity`} icon="heart">친밀도</BlockLabel>
      <p className="mate-game-level-name">
        {affinity.stage}단계 · {affinity.stageName}
      </p>
      {progress !== null && (
        <div
          className="mate-game-progress"
          role="progressbar"
          aria-label={affinity.nextStageName ? `${affinity.nextStageName}까지` : '친밀도'}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          style={{ '--progress': progress } as CSSProperties}
        />
      )}
      {caption && <p className="mate-game-level-caption">{caption}</p>}
    </section>
  )
}

/**
 * 세계관 card: the five worlds (mate-worlds.ts), one at a time — `<` / `>` (no wrap; the ends are disabled; ← → keys
 * too), five dots (the current stage's dot is longer); a world is a MateWorldTile (a locked one shows where it opens),
 * an open one opens its detail (MateWorldDialog). Its own card beside 친밀도 (2026-11-28), so either can be off alone.
 */
export function WorldCard({ worlds, mateName, resetKey, className, tour }: {
  worlds: readonly MateWorld[]
  mateName: string
  /** Changing it (another mate, another stage) shows that mate's current world again. */
  resetKey: string
  className?: string
  /** `data-tour` anchor (the service tour). */
  tour?: string
}) {
  const id = useId()
  const [view, setView] = useState<View | null>(null)
  const [detail, setDetail] = useState<MateWorld | null>(null)
  const current = view && view.key === resetKey ? view : null
  const index = Math.min(worlds.length - 1, Math.max(0, current ? current.index : initialWorldIndex(worlds)))
  const world = worlds[index]
  // The stage the user is at: the last open world (its dot is marked).
  const stageIndex = worlds.reduce((at, item, itemIndex) => (item.unlocked ? itemIndex : at), -1)

  const go = (step: -1 | 1) => {
    const next = index + step
    if (next < 0 || next >= worlds.length) return
    setView({ key: resetKey, index: next, direction: step, moved: true })
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') go(-1)
    else if (event.key === 'ArrowRight') go(1)
    else return
    event.preventDefault()
  }
  if (!world) return null

  const position = `${index + 1} / ${worlds.length}`
  const announcement = current?.moved
    ? `${WORLD_COPY.title} ${position}, ${worldLabel(world)}${world.title ? `, ${world.place}` : ''}, ${world.unlocked ? (world.sampleLine ?? '열림') : worldLockedCaption(world.unlockStage)}`
    : ''

  return (
    <section className={cn('world-card', className)} aria-labelledby={`${id}-world`} data-tour={tour}>
      {/* ← → move between worlds anywhere in the card (not inside the detail dialog below). */}
      <div onKeyDown={onKeyDown}>
      <div className="world-card-head">
        <BlockLabel id={`${id}-world`} icon="book">{WORLD_COPY.title}</BlockLabel>
        <div className="world-card-nav">
          <button
            type="button"
            className="world-card-arrow world-card-arrow--prev"
            aria-label={WORLD_COPY.previous}
            aria-disabled={index === 0 || undefined}
            onClick={() => go(-1)}
          >
            <Icon name="chevron" size={16} />
          </button>
          <span className="world-card-dots" aria-hidden="true">
            {worlds.map((item, itemIndex) => (
              <span
                key={item.id}
                className="world-card-dot"
                data-shown={itemIndex === index || undefined}
                data-open={item.unlocked || undefined}
                data-stage={itemIndex === stageIndex || undefined}
              />
            ))}
          </span>
          <span className="sr-only">{position}</span>
          <button
            type="button"
            className="world-card-arrow"
            aria-label={WORLD_COPY.next}
            aria-disabled={index === worlds.length - 1 || undefined}
            onClick={() => go(1)}
          >
            <Icon name="chevron" size={16} />
          </button>
        </div>
      </div>

      <div
        key={`${resetKey}:${index}`}
        className="world-card-slide"
        data-moved={current?.moved || undefined}
        style={{ '--world-from': `${(current?.direction ?? 1) * 10}px` } as CSSProperties}
      >
        <MateWorldTile world={world} layout="row" onOpen={setDetail} />
      </div>
      <p className="sr-only" aria-live="polite">{announcement}</p>
      </div>

      {detail && <MateWorldDialog world={detail} mateName={mateName} onClose={() => setDetail(null)} />}
    </section>
  )
}
