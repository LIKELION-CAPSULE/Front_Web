import { CUBISM_TO_V2_EXPRESSION, V2_EXPRESSIONS } from '../mate-render/expression-map.ts'
import type { MateExpressionUnlock, MateServerRelationStats, MateUnlocks } from './my-mates-utils.ts'
import { AFFINITY_STAGES, affinityUnlockCondition } from './affinity-stages.ts'

/**
 * Sample affinity and expression data for development and the local mock only (never production: see
 * mate-features.ts). Stages and hours follow the beta PRD (docs/CAPSULE_WEB_BETA_PRD_2026-11-22.md §8, "추천값"):
 * one expression unlocks at each stage from 2 to 5. Must stay in step with `AFFINITY_STAGE_COUNT` (tested). Expression names are the model's own labels; no new copy.
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

const fileFor = (name: string) =>
  Object.entries(CUBISM_TO_V2_EXPRESSION).find(([, value]) => value === name)?.[0] ?? name
const labelOf = (name: string) => V2_EXPRESSIONS.find((item) => item.name === name)?.label ?? name

/** Two base expressions plus one per stage 2–5, in the order they unlock. */
const SAMPLE_EXPRESSIONS: readonly { name: string; stage: number }[] = [
  { name: 'happy', stage: 1 },
  { name: 'laugh', stage: 1 },
  { name: 'shy', stage: 2 },
  { name: 'focus', stage: 3 },
  { name: 'sulky', stage: 4 },
  { name: 'yawn', stage: 5 },
]

export function sampleUnlocks(stage: number, firstMetAt?: number): MateUnlocks {
  const expressions: MateExpressionUnlock[] = SAMPLE_EXPRESSIONS.map((item) => {
    const stageName = AFFINITY_STAGES.find((value) => value.stage === item.stage)?.name ?? ''
    const unlocked = stage >= item.stage
    return {
      id: `sample-${item.name}`,
      label: labelOf(item.name),
      expressionFile: fileFor(item.name),
      unlocked,
      ...(unlocked && firstMetAt ? { unlockedAt: firstMetAt } : {}),
      unlockStage: item.stage,
      unlockStageName: stageName,
      ...(unlocked ? {} : { condition: affinityUnlockCondition(item.stage) }),
    }
  })
  return { expressions, voices: [] }
}
