import test from 'node:test'
import assert from 'node:assert/strict'
import { ageRatingLabel, availableMates, launchMates, mateProfile } from '../src/features/mates/catalog.ts'
import { MATE_LINES, mateLine, mateLineForState } from '../src/features/mates/mate-lines.ts'
import { sampleUnlocks } from '../src/features/mates/mate-sample-data.ts'
import { capsuleJarTheme, mateThemeFromHue } from '../src/features/mates/capsule-jar/capsule-jar-theme.ts'
import { toV2ExpressionName } from '../src/features/mate-render/expression-map.ts'
import { V2_MATE_ALLOW } from '../server/local-assets.ts'
import { LOCAL_MATES, LocalBetaStore, localMate } from '../src/features/local-demo/store.ts'

test('서도현 is a launch mate (id dohyun, 전연령) matched by his server name', () => {
  const profile = mateProfile('dohyun')
  assert.equal(profile?.name, '서도현')
  // 15세 이용가 until 2026-11-25; now 전연령 like 채린 (no age badge on his card).
  assert.equal(profile?.ageRating, 'all')
  assert.equal(ageRatingLabel(profile?.ageRating), '전연령')
  assert.equal(ageRatingLabel('15'), '15세 이용가')
  assert.equal(ageRatingLabel(mateProfile('chaerin')?.ageRating), '전연령')
  assert.equal(profile?.introduction, '말은 퉁명스러워도 늘 곁에 있는 무뚝뚝한 소꿉친구')
  assert.equal(profile?.role, '어릴 때부터 함께 자란 소꿉친구이자 공부 메이트')
  assert.equal(profile?.firstLine, '왔냐. 네 자리 맡아놨으니까 앉아. …뭐 해, 공부 안 하고.')
  const mates = availableMates({ mates: [{ id: 42, name: '채린' }, { id: 43, name: '서도현' }] })
  assert.deepEqual(mates.map((mate) => [mate.id, mate.roomId, mate.characterId]), [['chaerin', '42', '42'], ['dohyun', '43', '43']])
  // The production server name 「서진」 maps to the same persona (name to be settled with the backend).
  assert.equal(availableMates({ mates: [{ id: 2, name: '서진' }] })[0]?.id, 'dohyun')
  // Only the two approved mates.
  assert.deepEqual(launchMates.map((mate) => mate.id), ['chaerin', 'dohyun'])
})

test('each mate keeps its own lines: 서도현 never says 채린\'s, 채린 has hers and the shared table', () => {
  assert.equal(mateLine('dohyun', 'greet'), '왔냐. 자리 맡아놨어. 가방 내려놓고 앉아.')
  assert.equal(mateLine('dohyun', 'farewell'), '벌써 가냐. …그래, 내일 보자. 조심히 가고.')
  assert.equal(Object.keys(MATE_LINES.dohyun!).length, 13)
  const shared = (state: string) => `채린:${state}`
  assert.equal(mateLineForState('dohyun', 'greet', shared), mateLine('dohyun', 'greet'))
  assert.equal(mateLineForState('dohyun', 'idleLong', shared), mateLine('dohyun', 'quiet'))
  // A state 서도현 has no line for shows no bubble rather than 채린's.
  assert.equal(mateLineForState('dohyun', 'error', shared), null)
  // 채린 greets with her persona line too, and keeps the shared (login) table for the states only it covers.
  assert.equal(mateLineForState('chaerin', 'greet', shared), '…왔냐. 늦었잖아. 빨리 앉기나 해.')
  assert.equal(mateLineForState('chaerin', 'error', shared), '채린:error')
  assert.equal(mateLineForState('someone-new', 'greet', shared), '채린:greet')
})

test('서도현\'s four unlock expressions map to his model expressions', () => {
  const stage4 = sampleUnlocks(4, undefined, 'dohyun').expressions
  assert.deepEqual(stage4.map((item) => [item.label, toV2ExpressionName(item.expressionFile), item.unlockStage, item.unlocked]), [
    ['기본', null, 1, true],
    ['옅은 미소', 'laugh', 2, true],
    ['어이없음', 'contempt', 3, true],
    ['멋쩍음', 'shy', 4, true],
  ])
  assert.equal(sampleUnlocks(2, undefined, 'dohyun').expressions.filter((item) => item.unlocked).length, 2)
  // 채린 keeps her sample list.
  assert.equal(sampleUnlocks(5).expressions.length, 6)
})

test('서도현 takes the blue-violet kept for the 남학생 placeholder', () => {
  assert.deepEqual(capsuleJarTheme('dohyun'), mateThemeFromHue(230))
  assert.notDeepEqual(capsuleJarTheme('dohyun'), capsuleJarTheme('chaerin'))
})

test('the seojin bundle is served like chaerin-v2: runtime files only', () => {
  for (const path of ['/model/model.json', '/model/parts/045_front_hair@body.png', '/engine/engine.js', '/engine/player.js', '/engine/reactions.default.json']) {
    assert.ok(V2_MATE_ALLOW.test(path), path)
  }
  for (const path of ['/README.txt', '/index.html', '/model/../README.txt', '/model/expressions/happy.exp3.json', '/engine/other.js']) {
    assert.ok(!V2_MATE_ALLOW.test(path), path)
  }
})

test('the local mock has both mates and gives every third generated connection to 서도현', () => {
  assert.deepEqual(LOCAL_MATES.map((mate) => [mate.mateId, mate.name]), [['chaerin', '채린'], ['dohyun', '서진']], 'server names, as in production')
  assert.equal(localMate(undefined).mateId, 'chaerin', 'sessions saved before 서도현 existed')
  const store = new LocalBetaStore(null)
  const byMate = new Map<string, number>()
  for (const record of store.data.records) byMate.set(record.characterName ?? '', (byMate.get(record.characterName ?? '') ?? 0) + 1)
  assert.ok((byMate.get('서도현') ?? 0) > 0 && (byMate.get('채린') ?? 0) > (byMate.get('서도현') ?? 0), JSON.stringify([...byMate]))
  assert.equal(Object.keys(store.snapshot().affinities).length, 2)
})

test('채린 follows the same template: 전연령, study-partner copy, her own lines and four unlock expressions', () => {
  const profile = mateProfile('chaerin')
  assert.equal(profile?.ageRating, 'all')
  assert.equal(profile?.relationTag, '짝꿍형')
  assert.equal(profile?.tagline, undefined, 'the card shows the introduction')
  assert.ok((profile?.introduction.length ?? 99) <= 30, profile?.introduction)
  assert.equal(profile?.role, '함께 공부하는 학생')
  assert.equal(profile?.intro, '모든 수업이 끝나고 교실에 남아서 자습을 하는 상황')
  assert.equal(profile?.farewellLine, mateLine('chaerin', 'farewell'))
  for (const key of Object.keys(MATE_LINES.dohyun!)) assert.ok(mateLine('chaerin', key as never), key)
  const unlocks = sampleUnlocks(4, undefined, 'chaerin').expressions
  assert.deepEqual(unlocks.map((item) => [item.label, toV2ExpressionName(item.expressionFile), item.unlockStage]), [
    ['기본', null, 1], ['웃음', 'laugh', 2], ['짜증(장난)', 'sulky', 3], ['부끄러움', 'shy', 4],
  ])
})
