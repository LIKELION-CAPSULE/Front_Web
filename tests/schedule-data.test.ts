import assert from 'node:assert/strict'
import test from 'node:test'
import { selectSchedule } from '../src/features/schedule/schedule-data.ts'
import type { Memory } from '../src/features/demo/types.ts'

const memory = (id: string, date: string, time = '', characterId = 'chaerin'): Memory => ({
  id,
  date,
  time,
  characterId,
  title: id,
  kind: time ? '약속' : '시험',
})
const memories = [
  memory('old', '2026-10-20'),
  memory('tomorrow', '2026-10-28', '19:00', 'doyun'),
  memory('late', '2026-10-27', '20:00'),
  memory('yesterday', '2026-10-26'),
  memory('all-day', '2026-10-27'),
  memory('early', '2026-10-27', '10:00'),
]

test('central schedule combines characters in upcoming date/time order, followed by newest past days', () => {
  const sourceOrder = memories.map((item) => item.id)
  assert.deepEqual(
    selectSchedule(memories, 'all', 'all', '2026-10-27').map((item) => item.id),
    ['all-day', 'early', 'late', 'tomorrow', 'yesterday', 'old'],
  )
  assert.deepEqual(
    memories.map((item) => item.id),
    sourceOrder,
  )
})

test('schedule filters compose without hiding same-day and undated-time events', () => {
  assert.deepEqual(
    selectSchedule(memories, 'chaerin', 'upcoming', '2026-10-27').map((item) => item.id),
    ['all-day', 'early', 'late'],
  )
  assert.deepEqual(
    selectSchedule(memories, 'all', 'past', '2026-10-27').map((item) => item.id),
    ['yesterday', 'old'],
  )
  assert.deepEqual(
    selectSchedule(memories, 'doyun', 'all', '2026-10-27').map((item) => item.id),
    ['tomorrow'],
  )
  assert.deepEqual(selectSchedule(memories, 'sua', 'all', '2026-10-27'), [])
})
