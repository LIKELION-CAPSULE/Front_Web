import assert from 'node:assert/strict'
import test from 'node:test'
import { availableMates, mateCatalogIdMap, selectedCatalogMate } from '../src/features/mates/catalog.ts'
import {
  capsuleBandTheme,
  capsuleJarTheme,
  CHAERIN_JAR_THEME,
  mateColorStyle,
  mateThemeFromHue,
} from '../src/features/mates/capsule-jar/capsule-jar-theme.ts'
import { buildCapsuleBoard } from '../src/features/records/capsule-board/capsule-board-layout.ts'
import { getRecordRange } from '../src/features/reports/record-period.ts'
import type { HomeResponse } from '../src/shared/api/types.ts'
import type { StudyRecord } from '../src/features/demo/types.ts'

for (const [source, cards] of [
  ['mock', [{ id: 990301, name: '채린' }, { id: 990302, name: '서진' }]],
  ['mock-small-ids', [{ id: 1, name: '채린' }, { id: 2, name: '서도현' }]],
  ['api', [{ id: 4, name: '채린' }, { id: 2, name: '서진' }]],
] as const) {
  test(`${source}: catalogue and server links keep the selected mate colour, regardless of order`, () => {
    // Reverse order puts 서도현 first (simulating 서도현 as the most recently connected mate).
    const mates = availableMates({ mates: [...cards] } as HomeResponse).reverse()
    for (const [id, serverId, expected] of [
      ['chaerin', String(cards[0].id), CHAERIN_JAR_THEME],
      ['dohyun', String(cards[1].id), mateThemeFromHue(230)],
    ] as const) {
      for (const link of [id, serverId, cards[id === 'chaerin' ? 0 : 1].name]) {
        const selected = selectedCatalogMate(link, mates)
        assert.ok(selected, `${source}:${link}`)
        assert.equal(selected.id, id)
        assert.deepEqual(capsuleJarTheme(selected.id), expected)
        assert.deepEqual(capsuleJarTheme(selected.characterId, selected.name), expected)
      }
    }
  })
}

test('records board includes all server aliases and keeps registered mate colours', () => {
  const ids = mateCatalogIdMap([
    { id: 'chaerin', characterId: '4', serverIds: [4] },
    { id: 'dohyun', characterId: '2', serverIds: [2, 3] },
  ])
  assert.deepEqual(capsuleJarTheme(ids.get('4')), CHAERIN_JAR_THEME)
  for (const id of ['2', '3', 'dohyun']) assert.deepEqual(capsuleJarTheme(ids.get(id)), mateThemeFromHue(230))
  assert.deepEqual(capsuleJarTheme('1', '채린'), CHAERIN_JAR_THEME)
  assert.deepEqual(capsuleJarTheme('4', '채린'), CHAERIN_JAR_THEME)
  assert.deepEqual(capsuleJarTheme(undefined, '채린'), CHAERIN_JAR_THEME)
  assert.deepEqual(capsuleJarTheme('3', '서진'), mateThemeFromHue(230))
  assert.deepEqual(capsuleJarTheme(undefined, '서도현'), mateThemeFromHue(230))

  const now = Date.parse('2026-11-28T12:00:00+09:00')
  const range = getRecordRange('week', now, 0)
  const record = (id: string, charId: string, name: string): StudyRecord => ({
    id,
    roomId: charId,
    characterIds: [charId],
    characterName: name,
    tier: 'basic',
    startedAt: Date.parse('2026-11-27T14:00:00+09:00'),
    endedAt: Date.parse('2026-11-27T14:40:00+09:00'),
    studySeconds: 2400,
    focusSeconds: 2000,
    awaySeconds: 400,
    returns: 0,
    completed: true,
    automatic: false,
  })
  const board = buildCapsuleBoard([record('r1', '4', '채린'), record('r2', '3', '서진')], range, {
    mateOf: (item) => ids.get(item.characterIds[0] ?? '') ?? 'chaerin',
    mateOrder: ['chaerin', 'dohyun'],
    mateNames: new Map([['chaerin', '채린'], ['dohyun', '서도현']]),
    colorMode: 'mate',
  })
  assert.deepEqual(
    board.mates.map((entry) => [entry.mateId, entry.color]),
    [
      ['chaerin', CHAERIN_JAR_THEME.tintHalfShade],
      ['dohyun', mateThemeFromHue(230).tintHalfShade],
    ],
  )
})

test('채린 dawn capsules stay distinct from 서도현 blue-violet, and mateColorStyle exposes CSS variables', () => {
  const chaerinDawn = capsuleBandTheme(CHAERIN_JAR_THEME, 'dawn')
  const dohyunBase = mateThemeFromHue(230)
  assert.notEqual(chaerinDawn.tintHalfShade, dohyunBase.tintHalfShade)

  const chaerinStyle = mateColorStyle('chaerin', '채린')
  const dohyunStyle = mateColorStyle('dohyun', '서도현')
  assert.equal(chaerinStyle['--mate-tint'], CHAERIN_JAR_THEME.tintHalfShade)
  assert.equal(chaerinStyle['--mate-glow'], CHAERIN_JAR_THEME.glow)
  assert.equal(chaerinStyle['--mate-color-rotation'], '0deg')

  assert.equal(dohyunStyle['--mate-tint'], dohyunBase.tintHalfShade)
  assert.equal(dohyunStyle['--mate-glow'], dohyunBase.glow)
  assert.notEqual(dohyunStyle['--mate-color-rotation'], '0deg')
  // Server id + name also yields the canonical CSS variables.
  assert.deepEqual(mateColorStyle('4', '채린'), chaerinStyle)
  assert.deepEqual(mateColorStyle('2', '서진'), dohyunStyle)
})
