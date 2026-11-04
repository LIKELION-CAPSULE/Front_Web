import type { DemoState } from '../demo/types.ts'
import { isMvpRoom, MVP_CHARACTER_ID, MVP_GOAL_MINUTES } from './policy.ts'

/** Preserve history while bringing an existing live session into the presentation scope. */
export function migrateMvpSession(state: DemoState): DemoState {
  const active = state.activeSession
  if (!active) return state
  if (!isMvpRoom(active.roomId)) return { ...state, activeSession: null }
  if (active.characterIds.length === 1 && active.characterIds[0] === MVP_CHARACTER_ID &&
    active.tier === 'basic' && active.paidCredits === 0 && active.targetSeconds === MVP_GOAL_MINUTES * 60) return state
  return {
    ...state,
    activeSession: {
      ...active,
      characterIds: [MVP_CHARACTER_ID],
      tier: 'basic',
      paidCredits: 0,
      targetSeconds: MVP_GOAL_MINUTES * 60,
    },
  }
}
