import type { StudySettlement } from '../../shared/api/types.ts'

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value))
}

/**
 * Resolves a server-provided affinity stage progress ratio in [0, 1].
 * Returns null when the server does not provide a progress ratio or both stage accumulated/target seconds.
 */
export function resolveStageProgress(relation?: Pick<StudySettlement, 'stageProgress' | 'stageSeconds' | 'stageTargetSeconds'>): number | null {
  if (!relation) return null
  if (typeof relation.stageProgress === 'number' && Number.isFinite(relation.stageProgress)) {
    return clampUnit(relation.stageProgress)
  }
  if (
    typeof relation.stageSeconds === 'number' &&
    Number.isFinite(relation.stageSeconds) &&
    typeof relation.stageTargetSeconds === 'number' &&
    Number.isFinite(relation.stageTargetSeconds) &&
    relation.stageTargetSeconds > 0
  ) {
    return clampUnit(relation.stageSeconds / relation.stageTargetSeconds)
  }
  return null
}

/**
 * Formats the next-stage remaining time caption shared between ConnectionRecordPage and MyMatesPage.
 * Returns null when nextLevelSeconds is absent or not positive.
 */
export function formatNextStageCaption(
  relation: Pick<StudySettlement, 'nextStageName' | 'nextLevelSeconds'> | undefined,
  formatDuration: (seconds: number) => string,
): string | null {
  const nextSeconds = relation?.nextLevelSeconds
  if (typeof nextSeconds !== 'number' || !Number.isFinite(nextSeconds) || nextSeconds <= 0) {
    return null
  }
  const targetLabel = relation?.nextStageName?.trim()
    ? `${relation.nextStageName.trim()}까지`
    : '다음 단계까지'
  return `${targetLabel} ${formatDuration(nextSeconds)}`
}

/** What the my-mates page shows of the affinity: the only progress on that page. */
export type AffinityProgressView = {
  stage: number
  stageName: string
  /** 0…1 inside the current stage, when known. */
  progress: number | null
  /** E.g. "친구까지 3시간 25분", or null when the server sends no remaining time. */
  nextCaption: string | null
  nextStageName: string | null
  /** Locked expressions that the next stage opens (0 when none or unknown). */
  nextUnlocks: number
  /** The highest stage is reached. */
  isLast: boolean
}

/** A locked expression that the stage after `stage` opens (by its unlock stage, else by the stage name in its condition). */
export function opensAtNextStage(
  item: { unlocked: boolean; unlockStage?: number; condition?: string },
  stage: number,
  nextStageName: string | null,
) {
  if (item.unlocked) return false
  return item.unlockStage !== undefined ? item.unlockStage === stage + 1 : Boolean(nextStageName && item.condition?.includes(nextStageName))
}

/**
 * Builds the affinity progress from the relation (server fields, or the development sample) and the expression
 * collection: an expression counts for the next stage by its `unlockStage`, or else when its condition names the
 * next stage.
 */
export function affinityProgressView(
  relation: Partial<StudySettlement> & { stage: number; stageName: string },
  expressions: readonly { unlocked: boolean; unlockStage?: number; condition?: string }[],
  stageCount: number,
  formatDuration: (seconds: number) => string,
): AffinityProgressView {
  const nextStageName = relation.nextStageName?.trim() || null
  return {
    stage: relation.stage,
    stageName: relation.stageName,
    progress: resolveStageProgress(relation),
    nextCaption: formatNextStageCaption(relation, formatDuration),
    nextStageName,
    isLast: relation.stage >= stageCount,
    nextUnlocks: expressions.filter((item) => opensAtNextStage(item, relation.stage, nextStageName)).length,
  }
}
