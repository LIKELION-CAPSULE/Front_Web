import type { DemoState, Memory } from '../demo/types.ts'

/** Keep saved schedules while removing their former character ownership. */
export function migrateSharedSchedule(state: DemoState): DemoState {
  if (!state.memories.some((memory) => 'characterId' in memory)) return state
  return {
    ...state,
    memories: state.memories.map((memory) => {
      if (!('characterId' in memory)) return memory
      const shared: Memory & { characterId?: unknown } = { ...memory }
      delete shared.characterId
      return shared
    }),
  }
}
