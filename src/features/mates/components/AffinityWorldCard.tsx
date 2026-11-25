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
 * 친밀도 + 세계관 in one card (user decision 2026-11-26; replaces the separate affinity and 표정 컬렉션 blocks).
 * Top: the stage, one progress bar and what is left. Bottom (when `worlds` is given): the five worlds (mate-worlds.ts),
 * one at a time — `<` / `>` (no wrap; the ends are disabled), five dots (the current stage's dot is longer); a world is
 * a MateWorldTile (a locked one shows where it opens), an open one opens its detail (MateWorldDialog).
 *
 * Not tied to 내 메이트: the surface comes from `className` (the column passes its glass block class), ids are its own,
 * and the tour anchors are optional.
 */
export function AffinityWorldCard({
  affinity,
  worlds,
  mateName,
  resetKey,
  className,
  tour,
}: {
  affinity: AffinityProgressView
  /** Null: the world area is left out (feature off). */
  worlds: readonly MateWorld[] | null
  mateName: string
  /** Changing it (another mate, another stage) shows that mate's current world again. */
  resetKey: string
  className?: string
  /** `data-tour` anchors of the two parts (the service tour). */
  tour?: { affinity?: string; world?: string }
}) {
  const id = useId()
  const [view, setView] = useState<View | null>(null)
  const [detail, setDetail] = useState<MateWorld | null>(null)
  const list = worlds ?? []
  const current = view && view.key === resetKey ? view : null
  const index = Math.min(list.length - 1, Math.max(0, current ? current.index : initialWorldIndex(list)))
  const world = list[index]
  // The stage the user is at: the last open world (its dot is marked).
  const stageIndex = list.reduce((at, item, itemIndex) => (item.unlocked ? itemIndex : at), -1)

  const go = (step: -1 | 1) => {
    const next = index + step
    if (next < 0 || next >= list.length) return
    setView({ key: resetKey, index: next, direction: step, moved: true })
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') go(-1)
    else if (event.key === 'ArrowRight') go(1)
    else return
    event.preventDefault()
  }

  const progress = affinity.isLast ? 1 : affinity.progress
  const caption =
    affinity.nextCaption ??
    (affinity.nextStageName ? `다음 단계: ${affinity.nextStageName}` : affinity.isLast ? '가장 가까운 사이가 됐어요' : null)
  const position = world ? `${index + 1} / ${list.length}` : ''
  const announcement = current?.moved && world
    ? `${WORLD_COPY.title} ${position}, ${worldLabel(world)}, ${world.unlocked ? (world.sampleLine ?? '열림') : worldLockedCaption(world.unlockStage)}`
    : ''

  return (
    <section className={cn('affinity-world-card', className)} aria-labelledby={`${id}-affinity`}>
      <div className="affinity-world-top" data-tour={tour?.affinity}>
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
      </div>

      {world && (
        <div className="affinity-world" role="group" aria-labelledby={`${id}-world`} data-tour={tour?.world} onKeyDown={onKeyDown}>
          <div className="affinity-world-head">
            <BlockLabel id={`${id}-world`} icon="book">{WORLD_COPY.title}</BlockLabel>
            <div className="affinity-world-nav">
              <button
                type="button"
                className="affinity-world-arrow affinity-world-arrow--prev"
                aria-label={WORLD_COPY.previous}
                aria-disabled={index === 0 || undefined}
                onClick={() => go(-1)}
              >
                <Icon name="chevron" size={16} />
              </button>
              <span className="affinity-world-dots" aria-hidden="true">
                {list.map((item, itemIndex) => (
                  <span
                    key={item.id}
                    className="affinity-world-dot"
                    data-shown={itemIndex === index || undefined}
                    data-open={item.unlocked || undefined}
                    data-stage={itemIndex === stageIndex || undefined}
                  />
                ))}
              </span>
              <span className="sr-only">{position}</span>
              <button
                type="button"
                className="affinity-world-arrow"
                aria-label={WORLD_COPY.next}
                aria-disabled={index === list.length - 1 || undefined}
                onClick={() => go(1)}
              >
                <Icon name="chevron" size={16} />
              </button>
            </div>
          </div>

          <div
            key={`${resetKey}:${index}`}
            className="affinity-world-slide"
            data-moved={current?.moved || undefined}
            style={{ '--world-from': `${(current?.direction ?? 1) * 10}px` } as CSSProperties}
          >
            <MateWorldTile world={world} layout="row" onOpen={setDetail} />
          </div>
          <p className="sr-only" aria-live="polite">{announcement}</p>
        </div>
      )}

      {detail && <MateWorldDialog world={detail} mateName={mateName} onClose={() => setDetail(null)} />}
    </section>
  )
}
