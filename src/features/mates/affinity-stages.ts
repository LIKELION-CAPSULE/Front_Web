/**
 * The one table of affinity stages (beta PRD, docs/CAPSULE_WEB_BETA_PRD_2026-11-22.md §8): number, name and the
 * recommended hours. Everything that shows a stage or an unlock condition maps through here, so "3단계 · 친구"
 * means the same in the panel caption, in the progress and on a locked expression. Dependency-free for unit tests.
 */
export const AFFINITY_STAGES = [
  { stage: 1, name: '처음 만남', hours: 0 },
  { stage: 2, name: '아는 사이', hours: 1 },
  { stage: 3, name: '친구', hours: 5 },
  { stage: 4, name: '친한 친구', hours: 15 },
  { stage: 5, name: '단짝', hours: 40 },
] as const

/** "3단계 · 친구" */
export function affinityStageLabel(stage: number, name: string) {
  return `${stage}단계 · ${name}`
}

/** "4단계 · 친한 친구에서 열려요" */
export function affinityUnlockCondition(stage: number) {
  const item = AFFINITY_STAGES.find((value) => value.stage === stage)
  return item ? `${affinityStageLabel(item.stage, item.name)}에서 열려요` : `${stage}단계에서 열려요`
}

/**
 * A stage as the server (or a fixture) sends it, put on the table: a known stage name decides the number, so a
 * source that counts from another base never shows "2단계 · 친구" next to "3단계 · 친구에서 열려요". Unknown names
 * keep what was sent.
 */
export function normalizeAffinityStage(stage: number | undefined, stageName: string | undefined) {
  const name = stageName?.trim()
  const byName = name ? AFFINITY_STAGES.find((item) => item.name === name) : undefined
  if (byName) return { stage: byName.stage, stageName: byName.name }
  if (stage && name) return { stage, stageName: name }
  return null
}

/**
 * A mate never met, when the server sends no relation (production): the first stage at its very start, so the card
 * shows 「1단계 · 처음 만남」 with an empty bar and the next stage's name — no times (those are the server's), and the
 * five worlds stay locked (mate-worlds.ts, `met: false`). Table data, not a sample.
 */
export function notMetAffinity() {
  const [first, second] = AFFINITY_STAGES
  return { stage: first.stage, stageName: first.name as string, nextStageName: second.name as string, stageProgress: 0 }
}
