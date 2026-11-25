import { useEffect, useState } from 'react'
import { mateArtwork, mateHeroPortrait } from './artwork.ts'
import { mateWorldsForStage, worldContentFromServer, type MateWorld, type MateWorldContent, type ServerUnlockItem } from './mate-worlds.ts'

type Samples = typeof import('./mate-world-samples.ts')

/** Development with the local mock (not `VITE_DATA_SOURCE=api`): the worlds get the planning examples. */
export const WORLD_SAMPLES_ON = import.meta.env.DEV && import.meta.env.VITE_DATA_SOURCE !== 'api'

/** The planning examples, loaded only in development (production bundles drop the import with the branch). */
function useWorldSamples(wanted: boolean): Samples | null {
  const [samples, setSamples] = useState<Samples | null>(null)
  useEffect(() => {
    if (!import.meta.env.DEV || !wanted) return
    let alive = true
    void import('./mate-world-samples.ts').then((module) => {
      if (alive) setSamples(module)
    })
    return () => {
      alive = false
    }
  }, [wanted])
  return import.meta.env.DEV && wanted ? samples : null
}

/**
 * The planning examples for a mate in development with the local mock (or when `samples` is forced: preview mates);
 * null otherwise — production always gets null (no made-up worlds), so the server's content (or 「준비 중」) is used.
 */
export function useMateWorldContent({
  enabled,
  mateId,
  mateName,
  mateImage,
  samples = WORLD_SAMPLES_ON,
}: {
  enabled: boolean
  mateId: string | undefined
  mateName: string | undefined
  mateImage?: string | null
  samples?: boolean
}): MateWorldContent[] | null {
  const module = useWorldSamples(enabled && samples)
  if (!import.meta.env.DEV || !enabled || !samples || !module || !mateId || !mateName) return null
  return module.sampleMateWorlds(mateId, mateName, {
    outfit: mateArtwork(mateId)?.full ?? mateHeroPortrait(mateId, mateImage ?? undefined),
    background: mateArtwork(mateId)?.callBackground.landscape,
  })
}

/**
 * A mate's five worlds for any screen (내 메이트, 메이트 상세): the lock state from the affinity stage, the content
 * from the server (none until its type is named: 「준비 중」) or, in development with the local mock or `samples`, the
 * planning examples. Null when `enabled` is off (feature flag) — the screens leave the worlds out.
 */
export function useMateWorlds({
  enabled,
  mateId,
  mateName,
  mateImage,
  stage,
  met,
  unlocks,
  samples = WORLD_SAMPLES_ON,
}: {
  enabled: boolean
  mateId: string
  mateName: string
  mateImage?: string | null
  stage: number | null | undefined
  met: boolean
  unlocks?: readonly ServerUnlockItem[] | null
  samples?: boolean
}): MateWorld[] | null {
  const content = useMateWorldContent({ enabled, mateId, mateName, mateImage, samples })
  if (!enabled) return null
  return mateWorldsForStage(stage, { met, content: content ?? worldContentFromServer(unlocks) })
}
