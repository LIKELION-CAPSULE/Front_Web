import type { MateServerRelationStats } from './my-mates-utils.ts'
import { AFFINITY_STAGES } from './affinity-stages.ts'

/**
 * Sample affinity data for development and the local mock only (never production: see mate-features.ts). Stages and
 * hours follow the beta PRD (docs/CAPSULE_WEB_BETA_PRD_2026-11-22.md §8, "추천값"). Must stay in step with
 * `AFFINITY_STAGE_COUNT` (tested). The world examples are in mate-world-samples.ts.
 */
export { AFFINITY_STAGES } from './affinity-stages.ts'


/** Sample relation from the total connection time (the PRD's rule without its daily cap). */
export function sampleRelation(totalSeconds: number): MateServerRelationStats & { stage: number; stageName: string } {
  const hours = Math.max(0, totalSeconds) / 3600
  let index = 0
  for (let i = 0; i < AFFINITY_STAGES.length; i++) if (hours >= AFFINITY_STAGES[i]!.hours) index = i
  const current = AFFINITY_STAGES[index]!
  const next = AFFINITY_STAGES[index + 1]
  return {
    stage: current.stage,
    stageName: current.name,
    ...(next
      ? {
          nextStageName: next.name,
          nextLevelSeconds: Math.max(0, Math.round((next.hours - hours) * 3600)),
          stageProgress: (hours - current.hours) / (next.hours - current.hours),
        }
      : { stageProgress: 1 }),
  }
}

/** Connection time that puts a sample at `stage` (60% of the way to the next one; past 단짝's threshold for 5). */
export function sampleSecondsForStage(stage: number): number {
  const index = Math.min(AFFINITY_STAGES.length, Math.max(1, Math.round(stage))) - 1
  const current = AFFINITY_STAGES[index]!
  const next = AFFINITY_STAGES[index + 1]
  return Math.round((current.hours + (next ? (next.hours - current.hours) * 0.6 : 5)) * 3600)
}
