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
