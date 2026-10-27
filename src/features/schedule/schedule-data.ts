import type { Memory } from '../demo/types.ts'

export type SchedulePeriod = 'upcoming' | 'all' | 'past'

export function selectSchedule(
  memories: readonly Memory[],
  characterId: string,
  period: SchedulePeriod,
  today: string,
) {
  return memories
    .filter(
      (memory) =>
        (characterId === 'all' || memory.characterId === characterId) &&
        (period === 'all' || (period === 'past' ? memory.date < today : memory.date >= today)),
    )
    .sort((a, b) => {
      const aPast = a.date < today,
        bPast = b.date < today
      if (aPast !== bPast) return aPast ? 1 : -1
      const order = `${a.date}T${a.time || '00:00'}`.localeCompare(`${b.date}T${b.time || '00:00'}`)
      return (aPast ? -order : order) || a.id.localeCompare(b.id)
    })
}
