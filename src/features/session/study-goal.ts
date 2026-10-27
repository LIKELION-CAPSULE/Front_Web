export const DEFAULT_GOAL_MINUTES = 50
export const MIN_GOAL_MINUTES = 5
export const MAX_GOAL_MINUTES = 180

export function normalizeGoalMinutes(value: number) {
  return Number.isFinite(value)
    ? Math.max(MIN_GOAL_MINUTES, Math.min(MAX_GOAL_MINUTES, Math.round(value / 5) * 5))
    : DEFAULT_GOAL_MINUTES
}

export function studyGoalSeconds(session: { targetSeconds?: number }) {
  return normalizeGoalMinutes((session.targetSeconds ?? DEFAULT_GOAL_MINUTES * 60) / 60) * 60
}
