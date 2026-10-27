import { dayKey } from '../../shared/lib/format.ts'
import type { DemoState, Memory } from './types.ts'

export const SCHEDULE_SAMPLE_VERSION = 1

export function createPastScheduleSamples(now = Date.now()): Memory[] {
  return [
    { id: 'sample-schedule-v1-exam', kind: '시험', title: '영어 모의고사', daysAgo: 2, time: '' },
    { id: 'sample-schedule-v1-goal', kind: '목표', title: '독서 목표 마무리', daysAgo: 5, time: '' },
    { id: 'sample-schedule-v1-promise', kind: '약속', title: '주간 복습', daysAgo: 9, time: '19:00' },
  ].map(({ daysAgo, ...memory }) => ({
    ...memory,
    kind: memory.kind as Memory['kind'],
    date: dayKey(now - daysAgo * 86400000),
  }))
}

/** Add the new fixtures once, so saved edits and deletions survive later loads. */
export function migrateScheduleSamples(state: DemoState, now = Date.now()): DemoState {
  if ((state.scheduleSampleVersion ?? 0) >= SCHEDULE_SAMPLE_VERSION) return state
  const ids = new Set(state.memories.map((memory) => memory.id))
  return {
    ...state,
    scheduleSampleVersion: SCHEDULE_SAMPLE_VERSION,
    memories: [
      ...state.memories,
      ...createPastScheduleSamples(now).filter((memory) => !ids.has(memory.id)),
    ],
  }
}
