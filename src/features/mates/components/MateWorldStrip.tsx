import { useState } from 'react'
import { WORLD_COPY, worldCount, type MateWorld } from '@/features/mates/mate-worlds'
import { MateWorldDialog, MateWorldTile } from './MateWorldTile'

/**
 * The five worlds in one row: five cards, side-scrolling on narrow screens. A mate not met yet shows all five locked
 * with the level that opens each. Not placed on any screen yet (taken off 메이트 상세 2026-11-26; its owner places it
 * to the Figma frame). Use: `const worlds = useMateWorlds({ enabled, mateId, mateName, stage, met, unlocks })`
 * (use-mate-worlds.ts; the stage and `met` from 37 내 메이트), then `{worlds && <MateWorldStrip worlds={worlds} mateName={name} />}`.
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
