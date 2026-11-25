import { useState } from 'react'
import { WORLD_COPY, worldCount, type MateWorld } from '@/features/mates/mate-worlds'
import { MateWorldDialog, MateWorldTile } from './MateWorldTile'

/**
 * The five worlds in one row (메이트 상세, under the mate): five cards, side-scrolling on narrow screens. A mate not
 * met yet shows all five locked with the level that opens each.
 */
export function MateWorldStrip({ worlds, mateName, className }: { worlds: readonly MateWorld[]; mateName: string; className?: string }) {
  const [detail, setDetail] = useState<MateWorld | null>(null)
  const { unlocked, total } = worldCount(worlds)
  return (
    <section className={['mate-world-strip', className].filter(Boolean).join(' ')} aria-labelledby="mate-world-strip-title">
      <p className="mate-world-strip-head">
        <span id="mate-world-strip-title">{WORLD_COPY.title}</span>
        <span className="mate-world-strip-count">
          {unlocked} / {total}
          <span className="sr-only">개 열림</span>
        </span>
      </p>
      <ul className="mate-world-strip-list">
        {worlds.map((world) => (
          <li key={world.id}>
            <MateWorldTile world={world} layout="card" onOpen={setDetail} />
          </li>
        ))}
      </ul>
      {detail && <MateWorldDialog world={detail} mateName={mateName} onClose={() => setDetail(null)} />}
    </section>
  )
}
