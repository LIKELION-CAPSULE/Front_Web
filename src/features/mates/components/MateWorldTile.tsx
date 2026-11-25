import type { CSSProperties } from 'react'
import { WORLD_COPY, worldLabel, worldLockedCaption, type MateWorld } from '@/features/mates/mate-worlds'
import { cn } from '@/shared/lib/cn'
import { Dialog } from '@/shared/ui/Dialog'
import { Icon } from '@/shared/ui/Icon'
import './mate-world.css'

/** The place's background, or a soft placeholder (a quiet gradient keyed by the episode). */
function WorldBackdrop({ world, className }: { world: MateWorld; className?: string }) {
  return (
    <span className={cn('mate-world-backdrop', className)} style={{ '--world-hue': 250 + world.episode * 14 } as CSSProperties} aria-hidden="true">
      {world.backgroundUrl && <img src={world.backgroundUrl} alt="" loading="lazy" decoding="async" />}
      {!world.unlocked && (
        <span className="mate-world-lock">
          <Icon name="lock" size={16} />
        </span>
      )}
    </span>
  )
}

/**
 * One world: the background thumbnail, 「EP.03 · 도서관」 and, open, the sample line (locked: a lock and 「Lv.4에서
 * 열려요」 — the place stays visible so there is something to look forward to). An open world is a button that opens
 * its detail (`onOpen`); a locked one is not interactive. `layout`: `row` (the affinity card) or `card` (the strip).
 */
export function MateWorldTile({ world, layout, onOpen }: { world: MateWorld; layout: 'row' | 'card'; onOpen?: (world: MateWorld) => void }) {
  const body = (
    <>
      <WorldBackdrop world={world} className="mate-world-thumb" />
      <span className="mate-world-text">
        <span className="mate-world-label" data-placeholder={world.placeholder || undefined}>{worldLabel(world)}</span>
        {world.unlocked ? (
          <span className="mate-world-line">
            {world.sampleLine ? `「${world.sampleLine}」` : WORLD_COPY.placeholderLine}
          </span>
        ) : (
          <span className="mate-world-line mate-world-line--locked">{worldLockedCaption(world.unlockStage)}</span>
        )}
      </span>
    </>
  )
  const className = cn('mate-world-tile', `mate-world-tile--${layout}`, !world.unlocked && 'mate-world-tile--locked')
  if (!world.unlocked || !onOpen) {
    return <div className={className} data-episode={world.episode}>{body}</div>
  }
  return (
    <button type="button" className={className} data-episode={world.episode} aria-haspopup="dialog" onClick={() => onOpen(world)}>
      {body}
      <span className="sr-only">{WORLD_COPY.open}</span>
    </button>
  )
}

/** A world's detail: the background large, the outfit still (when there is one), the place and the sample line. */
export function MateWorldDialog({ world, mateName, onClose }: { world: MateWorld; mateName: string; onClose: () => void }) {
  return (
    <Dialog open onClose={onClose} title={worldLabel(world)} tone="celebrate" className="mate-world-dialog">
      <div className="mate-world-scene">
        <WorldBackdrop world={world} className="mate-world-scene-backdrop" />
        {world.outfitPreviewUrl && (
          <img className="mate-world-outfit" src={world.outfitPreviewUrl} alt={`${WORLD_COPY.outfit}을 입은 ${mateName}`} loading="lazy" decoding="async" />
        )}
      </div>
      {world.placeholder ? (
        <p className="mate-world-dialog-note">{WORLD_COPY.placeholderLine}</p>
      ) : (
        <dl className="mate-world-facts">
          <div>
            <dt>장소</dt>
            <dd>{world.place}</dd>
          </div>
          {world.sampleLine && (
            <div>
              <dt>{WORLD_COPY.sampleLine}</dt>
              <dd className="mate-world-quote">「{world.sampleLine}」</dd>
            </div>
          )}
        </dl>
      )}
    </Dialog>
  )
}
