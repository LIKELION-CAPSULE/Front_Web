import assert from 'node:assert/strict'
import test from 'node:test'
import { studyHeatmap } from '../src/features/reports/heatmap-data.ts'
import { getRecordRange } from '../src/features/reports/record-period.ts'
import { createDemoState } from '../src/features/demo/seed.ts'

test('annual contribution cells preserve every leap day and Monday-first coordinates', () => {
  const range = getRecordRange('year', Date.parse('2024-08-15T12:00:00+09:00'))
  const chart = studyHeatmap([], range)
  assert.equal(chart.cells.length, 366)
  assert.equal(chart.cells[0]!.row, 0)
  assert.equal(chart.cells.at(-1)!.day, '2024-12-31')
  assert.equal(new Set(chart.cells.map((cell) => `${cell.column}:${cell.row}`)).size, 366)
  assert.equal(chart.cells.find((cell) => cell.day === '2024-02-29')!.row, 3)
  assert.equal(chart.cells.find((cell) => cell.day === '2024-08-16')!.disabled, true)
})
test('daily intensity counts study seconds rather than a fixed number of study sets', () => {
  const now = Date.parse('2026-10-27T18:00:00+09:00'),
    range = getRecordRange('month', now)
  const base = createDemoState(now).records[0]!
  const records = [
    { ...base, studySeconds: 1200 },
    { ...base, studySeconds: 900 },
  ]
  const cell = studyHeatmap(records, range).cells.find((cell) => cell.day === range.today)!
  assert.equal(cell.seconds, 2100)
  assert.equal(cell.level, 2)
  assert.equal(studyHeatmap(records, range).attended, 1)
})
