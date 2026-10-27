import { studyRooms } from '../rooms/data/rooms.ts'
import { dayKey } from '../../shared/lib/format.ts'
import type { DemoState, StudyRecord } from './types.ts'

const DAY = 86400000
const companions = studyRooms.flatMap((room) =>
  room.characters.map((character) => ({ id: character.id, roomId: room.id })),
)

/** Repeatable demo measurements, independent of rendering and aggregate summaries. */
export function sampleFocusBasisPoints(characterId: string, at: number, variation = 0) {
  const index = Math.max(
    0,
    companions.findIndex((character) => character.id === characterId),
  )
  const [, month, day] = dayKey(at).split('-').map(Number) as [number, number, number]
  return 6800 + index * 140 + (month - 1) * 36 + day * 7 + (variation % 17)
}

export function createSampleRecords(now: number): StudyRecord[] {
  const today = dayKey(now)
  const year = Number(today.slice(0, 4))
  const start = new Date(`${year}-01-01T00:00:00+09:00`).getTime()
  const todayStart = new Date(`${today}T00:00:00+09:00`).getTime()
  const dayIndex = Math.floor((todayStart - start) / DAY)
  const weekday = (new Date(`${today}T12:00:00+09:00`).getUTCDay() + 6) % 7
  const monthStartDay = dayIndex - Number(today.slice(8)) + 1
  const records: StudyRecord[] = []

  function add(day: number, characterIndex: number, slot: number, tag: string) {
    // A smaller circle in recent periods also varies the companion count.
    if (day >= dayIndex - weekday && characterIndex >= 8) return
    if (day >= monthStartDay && characterIndex >= 14) return
    const character = companions[characterIndex]!
    const localStart = start + day * DAY
    const endedAt = Math.min(now - 1000, localStart + (12 * 60 + slot * 37) * 60000)
    if (endedAt < localStart) return
    const minutes =
      tag === 'recent'
        ? 8 + ((day * 3 + characterIndex * 7) % 25)
        : 21 + ((day * 17 + characterIndex * 11 + slot * 7) % 79)
    const seconds = minutes * 60 + ((day * 19 + characterIndex * 7 + slot * 13) % 59)
    const focusSeconds = Math.round(
      (seconds * sampleFocusBasisPoints(character.id, endedAt, day + slot * 17)) / 10000,
    )
    records.push({
      id: `sample-v3-${tag}-${day}-${characterIndex}-${slot}`,
      roomId: character.roomId,
      characterIds: [character.id],
      tier: 'standard',
      startedAt: endedAt - seconds * 1000,
      endedAt,
      studySeconds: seconds,
      focusSeconds,
      awaySeconds: seconds - focusSeconds,
      returns: 1 + ((day + characterIndex) % 5),
      completed: (day + characterIndex + slot) % 7 !== 0,
      automatic: (day + characterIndex) % 13 === 0,
    })
  }

  // Spread activity through every elapsed month, leaving genuine rest days.
  for (let day = 0; day <= dayIndex; day++) {
    if ((day * 5 + 2) % 7 > 3) continue
    const count = 1 + (day % 3)
    for (let slot = 0; slot < count; slot++) {
      add(day, (day * 7 + slot * 11) % companions.length, slot, 'year')
    }
  }

  // Individual monthly visits make week/month/year comparisons meaningful for
  // every companion, including those in rooms with several characters.
  for (let month = 0; month < Number(today.slice(5, 7)); month++) {
    const monthStart = Date.UTC(year, month, 1) - 9 * 3600000
    const firstDay = Math.round((monthStart - start) / DAY)
    const elapsed = Math.min(dayIndex - firstDay, 20)
    companions.forEach((_, index) => {
      add(firstDay + ((index * 3 + month * 2) % Math.max(1, elapsed)), index, index % 3, 'month')
    })
  }

  // Recent individual visits avoid assigning group members identical totals.
  companions.forEach((_, index) => {
    const offset = index % (weekday + 1)
    add(dayIndex - offset, index, 3 + Math.floor(index / (weekday + 1)), 'recent')
  })
  return records.sort((a, b) => b.endedAt - a.endedAt)
}

/** Replace only the obsolete built-in fixtures; preserve actual study/history/state. */
export function migrateSampleRecords(state: DemoState, now = Date.now()): DemoState {
  const legacy = (id: string) => /^sample-\d+-\d+$/.test(id) || id.startsWith('sample-v2-')
  if (!state.records.some((record) => legacy(record.id))) return state
  const samples = createSampleRecords(now)
  const records = [...state.records.filter((record) => !legacy(record.id)), ...samples].sort(
    (a, b) => b.endedAt - a.endedAt,
  )
  return {
    ...state,
    records,
    latestRecordId:
      state.latestRecordId && legacy(state.latestRecordId)
        ? (records[0]?.id ?? null)
        : state.latestRecordId,
  }
}
