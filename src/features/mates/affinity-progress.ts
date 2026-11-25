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
  /** The highest stage is reached. */
  isLast: boolean
}

/**
 * Builds the affinity progress from the relation (server fields, or the development sample). What the next stage opens
 * is not repeated here: the expression collection's locked slots already say at which stage they open (2026-11-26).
 */
export function affinityProgressView(
  relation: Partial<StudySettlement> & { stage: number; stageName: string },
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
  }
}
