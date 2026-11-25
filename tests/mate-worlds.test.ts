import assert from 'node:assert/strict'
import test from 'node:test'
import {
  episodeLabel,
  initialWorldIndex,
  LEGACY_UNLOCK_TYPES,
  mateWorldsForStage,
  WORLD_COPY,
  WORLD_COUNT,
  WORLD_UNLOCK_TYPES,
  worldContentFromServer,
  worldCount,
  worldLabel,
  worldLockedCaption,
  worldOpenedAt,
  worldStageUpLine,
  type ServerUnlockItem,
} from '../src/features/mates/mate-worlds.ts'
import { sampleMateWorlds } from '../src/features/mates/mate-world-samples.ts'
import { notMetAffinity } from '../src/features/mates/affinity-stages.ts'

const item = (over: Partial<ServerUnlockItem>): ServerUnlockItem => ({
  id: '1', type: 'WORLD', title: '학교', unlockStage: 1, assetUrl: null, unlocked: null, unlockedAt: null, ...over,
})

test('세계관: five per mate, one per affinity level; the stage opens every world up to it', () => {
  assert.equal(WORLD_COUNT, 5)
  for (const stage of [1, 2, 3, 4, 5]) {
    const worlds = mateWorldsForStage(stage)
    assert.deepEqual(worlds.map((world) => world.episode), [1, 2, 3, 4, 5])
    assert.deepEqual(worlds.map((world) => world.unlockStage), [1, 2, 3, 4, 5])
    assert.deepEqual(worlds.map((world) => world.unlocked), [1, 2, 3, 4, 5].map((level) => level <= stage), `stage ${stage}`)
    assert.equal(worldCount(worlds).unlocked, stage)
  }
  // Never met (or no relation): all five locked — 「0개 열림」.
  assert.equal(worldCount(mateWorldsForStage(1, { met: false })).unlocked, 0)
  assert.equal(worldCount(mateWorldsForStage(null)).unlocked, 0)
  assert.equal(worldCount(mateWorldsForStage(Number.NaN)).unlocked, 0)
})

test('세계관: a mate never met (production, no server relation) is 「1단계 · 처음 만남」 at its start, all five locked', () => {
  const start = notMetAffinity()
  assert.deepEqual(start, { stage: 1, stageName: '처음 만남', nextStageName: '아는 사이', stageProgress: 0 })
  assert.equal('nextLevelSeconds' in start, false, 'no made-up remaining time')
  assert.equal(worldCount(mateWorldsForStage(start.stage, { met: false })).unlocked, 0)
})

test('세계관: starts at the current level, or EP.01 when none is open', () => {
  assert.equal(initialWorldIndex(mateWorldsForStage(3)), 2)
  assert.equal(initialWorldIndex(mateWorldsForStage(5)), 4)
  assert.equal(initialWorldIndex(mateWorldsForStage(1, { met: false })), 0)
  assert.equal(initialWorldIndex([]), 0)
})

test('세계관 copy: 「EP.03 · 도서관」, 「Lv.4에서 열려요」, 「새 세계관이 열렸어요 · EP.03 도서관」', () => {
  assert.equal(episodeLabel(3), 'EP.03')
  const [library] = mateWorldsForStage(3, { content: [{ episode: 3, place: '도서관' }] }).slice(2)
  assert.equal(worldLabel(library!), 'EP.03 · 도서관')
  assert.equal(worldStageUpLine(library!), '새 세계관이 열렸어요 · EP.03 도서관')
  assert.equal(worldLockedCaption(4), 'Lv.4에서 열려요')
  assert.equal(worldLockedCaption(1), 'Lv.1에서 열려요')
})

test('세계관: production has no content — 「준비 중」 places, no pictures or lines, never a made-up world', () => {
  const worlds = mateWorldsForStage(2, { content: worldContentFromServer([]) })
  for (const world of worlds) {
    assert.equal(world.placeholder, true)
    assert.equal(world.place, WORLD_COPY.placeholderPlace)
    assert.equal(world.backgroundUrl, undefined)
    assert.equal(world.outfitPreviewUrl, undefined)
    assert.equal(world.sampleLine, undefined)
  }
  assert.equal(worldLabel(worlds[1]!), 'EP.02')
  assert.equal(worldStageUpLine(worlds[1]!), '새 세계관이 열렸어요 · EP.02')
  // No story text or prompt fields on the model.
  for (const key of ['title', 'summary', 'body', 'prompt']) assert.ok(!(key in worlds[0]!), key)
})

test('세계관 adapter: EXPRESSION / VOICE_LINE (and unknown types) are ignored, not errors; the world type maps by episode', () => {
  assert.deepEqual([...LEGACY_UNLOCK_TYPES], ['EXPRESSION', 'VOICE_LINE'])
  assert.deepEqual([...WORLD_UNLOCK_TYPES], [], 'no world type until the API names it')
  const server = [
    item({ id: '11', type: 'EXPRESSION', title: '수줍음', unlockStage: 2, unlocked: true }),
    item({ id: '12', type: 'VOICE_LINE', title: '응원', unlockStage: 3, unlocked: true }),
    item({ id: '13', type: 'STICKER', title: '모르는 종류', unlockStage: 1 }),
    item({ id: '14', type: 'WORLD', title: '학교', unlockStage: 1, assetUrl: 'https://cdn.example/school.webp', unlockedAt: 1000 }),
    item({ id: '15', type: 'WORLD', title: '범위 밖', unlockStage: 9 }),
    item({ id: '16', type: 'WORLD', title: '단계 없음', unlockStage: null }),
  ]
  assert.deepEqual(worldContentFromServer(server), [])
  assert.deepEqual(worldContentFromServer(null), [])
  // Even a type list that names them never lets the old kinds through.
  assert.deepEqual(worldContentFromServer(server, ['EXPRESSION', 'VOICE_LINE']), [])
  const content = worldContentFromServer(server, ['WORLD'])
  assert.deepEqual(content, [{ id: '14', episode: 1, unlockStage: 1, place: '학교', backgroundUrl: 'https://cdn.example/school.webp', unlockedAt: 1000 }])
  const [school, second] = mateWorldsForStage(2, { content })
  assert.deepEqual([school!.place, school!.placeholder, school!.backgroundUrl, school!.unlockedAt], ['학교', false, 'https://cdn.example/school.webp', 1000])
  assert.equal(second!.placeholder, true)
})

test('세계관: a server lock state wins over the stage', () => {
  const content = worldContentFromServer([item({ id: '1', unlockStage: 2, unlocked: false }), item({ id: '2', unlockStage: 4, unlocked: true })], ['WORLD'])
  assert.deepEqual(mateWorldsForStage(3, { content }).map((world) => world.unlocked), [true, false, true, true, false])
})

test('세계관: a stage-up names the world of the new level (server first, then the examples)', () => {
  assert.equal(worldOpenedAt(3)?.episode, 3)
  assert.equal(worldOpenedAt(3)?.unlocked, true)
  assert.equal(worldStageUpLine(worldOpenedAt(3)!), '새 세계관이 열렸어요 · EP.03')
  assert.equal(worldStageUpLine(worldOpenedAt(3, undefined, sampleMateWorlds('chaerin', '채린'))!), '새 세계관이 열렸어요 · EP.03 도서관')
  // 21 · 22 · 23 `unlocked[]` of the old kinds change nothing.
  assert.equal(worldOpenedAt(4, [{ type: 'EXPRESSION', title: '웃음', unlockStage: 4 }])?.placeholder, true)
  assert.equal(worldOpenedAt(0), null)
  assert.equal(worldOpenedAt(6), null)
})

test('세계관 examples (development only): 채린 follows the planning table; 서도현 the same places with temporary lines', () => {
  const chaerin = sampleMateWorlds('chaerin', '채린', { background: '/bg.webp', outfit: '/full.webp' })
  assert.deepEqual(chaerin.map((world) => [episodeLabel(world.episode), world.place, world.sampleLine]), [
    ['EP.01', '학교', '오늘 수업 내용 이해했어?'],
    ['EP.02', '자습실', '조금만 더 공부하고 쉬자.'],
    ['EP.03', '도서관', '여기서는 조용히 해야 돼.'],
    ['EP.04', '카페', '공부 끝나면 디저트 먹고 싶다.'],
    ['EP.05', '채린이네 집', '아, 그냥 침대에 눕고 싶다.'],
  ])
  assert.deepEqual([chaerin[0]!.backgroundUrl, chaerin[0]!.outfitPreviewUrl, chaerin[1]!.backgroundUrl], ['/bg.webp', '/full.webp', undefined])
  const dohyun = sampleMateWorlds('dohyun', '서도현')
  assert.deepEqual(dohyun.map((world) => world.place), ['학교', '자습실', '도서관', '카페', '서도현이네 집'])
  for (const world of dohyun) assert.match(world.sampleLine!, /^\(임시\) /)
})
