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

/** Connection time that puts a sample at `stage` (60% of the way to the next one; past 단짝's threshold for 5). */
export function sampleSecondsForStage(stage: number): number {
  const index = Math.min(AFFINITY_STAGES.length, Math.max(1, Math.round(stage))) - 1
  const current = AFFINITY_STAGES[index]!
  const next = AFFINITY_STAGES[index + 1]
  return Math.round((current.hours + (next ? (next.hours - current.hours) * 0.6 : 5)) * 3600)
}

const fileFor = (name: string) =>
  Object.entries(CUBISM_TO_V2_EXPRESSION).find(([, value]) => value === name)?.[0] ?? name
const labelOf = (name: string) => V2_EXPRESSIONS.find((item) => item.name === name)?.label ?? name

type SampleExpression = { name: string; stage: number; label?: string }

/** Two base expressions plus one per stage 2–5, in the order they unlock. */
const SAMPLE_EXPRESSIONS: readonly SampleExpression[] = [
  { name: 'happy', stage: 1 },
  { name: 'laugh', stage: 1 },
  { name: 'shy', stage: 2 },
  { name: 'focus', stage: 3 },
  { name: 'sulky', stage: 4 },
  { name: 'yawn', stage: 5 },
]

/**
 * 서도현's four unlock expressions (persona, 2026-11-25), each on the closest model expression:
 * 기본(무표정) → the default face · 옅은 미소 → laugh (the soft smile; `happy` is a closed-eye grin) ·
 * 어이없음(장난) → contempt · 멋쩍음 → shy (eyes away, blush).
 */
const DOHYUN_EXPRESSIONS: readonly SampleExpression[] = [
  { name: 'neutral', stage: 1, label: '기본' },
  { name: 'laugh', stage: 2, label: '옅은 미소' },
  { name: 'contempt', stage: 3, label: '어이없음' },
  { name: 'shy', stage: 4, label: '멋쩍음' },
]

const SAMPLES_BY_MATE: Readonly<Record<string, readonly SampleExpression[]>> = { dohyun: DOHYUN_EXPRESSIONS }

export function sampleUnlocks(stage: number, firstMetAt?: number, mateId?: string): MateUnlocks {
  const list = (mateId && SAMPLES_BY_MATE[mateId]) || SAMPLE_EXPRESSIONS
  const expressions: MateExpressionUnlock[] = list.map((item) => {
    const stageName = AFFINITY_STAGES.find((value) => value.stage === item.stage)?.name ?? ''
    const unlocked = stage >= item.stage
    return {
      id: `sample-${item.name}`,
      label: item.label ?? labelOf(item.name),
      expressionFile: item.name === 'neutral' ? 'neutral' : fileFor(item.name),
      unlocked,
      ...(unlocked && firstMetAt ? { unlockedAt: firstMetAt } : {}),
      unlockStage: item.stage,
      unlockStageName: stageName,
      ...(unlocked ? {} : { condition: affinityUnlockCondition(item.stage) }),
    }
  })
  return { expressions, voices: [] }
}
