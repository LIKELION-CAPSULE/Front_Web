import assert from 'node:assert/strict'
import test from 'node:test'
import type { StudyRecord } from '../src/features/demo/types.ts'
import {
  capsuleJarSummary,
  capsuleRecordsFromStudyRecords,
  formatTogether,
  groupCapsulesByDay,
} from '../src/features/mates/capsule-jar/capsule-jar-data.ts'
import { generateDummyCapsules } from '../src/features/mates/capsule-jar/capsule-jar-dummy.ts'
import { AFFINITY_STAGE_COUNT, MATE_FEATURES_OFF, resolveMateFeatures } from '../src/features/mates/mate-features.ts'
import { AFFINITY_STAGES, sampleRelation } from '../src/features/mates/mate-sample-data.ts'
import { affinityStageLabel, affinityUnlockCondition, normalizeAffinityStage } from '../src/features/mates/affinity-stages.ts'
import {
  capsuleVisitKey,
  clearLastVisit,
  readLastVisit,
  splitNewCapsules,
  writeLastVisit,
} from '../src/features/mates/capsule-jar/capsule-jar-visit.ts'
import type { CapsuleRecord } from '../src/features/mates/capsule-jar/capsule-jar-types.ts'
import { CAPSULE_COUNT, KEEPSAKE_SCALE, PILE, capsulesForConnection, floorCapsuleLength, layoutFloor, pileBinAt, pileBins, pileHalfWidth } from '../src/features/mates/capsule-jar/capsule-floor-layout.ts'

const NOW = Date.UTC(2026, 10, 24, 3, 0, 0)

function record(overrides: Partial<StudyRecord> & { id: string }): StudyRecord {
  const endedAt = overrides.endedAt ?? NOW - 3_600_000
  return {
    roomId: '101',
    characterIds: ['201'],
    tier: 'basic',
    startedAt: endedAt - 1_800_000,
    endedAt,
    studySeconds: 1_800,
    focusSeconds: 0,
    awaySeconds: 0,
    returns: 0,
    completed: true,
    automatic: false,
    serverReport: { connectionId: 1, connectedSeconds: 1_800 },
    ...overrides,
  }
}

function capsule(id: string, endedAt: number, durationSeconds = 3_600): CapsuleRecord {
  return { id, startedAt: endedAt - durationSeconds * 1000, endedAt, durationSeconds }
}

// ── Mapping ──────────────────────────────────────────────────────────────────

test('maps server-reported records of the mate to capsules, oldest first', () => {
  const records = [
    record({ id: 'b', endedAt: NOW - 1_000, serverReport: { closingLine: '  내일 봐  ', connectedSeconds: 1_800 } }),
    record({ id: 'a', endedAt: NOW - 90_000_000, studySeconds: 5_400 }),
    record({ id: 'other-mate', characterIds: ['999'] }),
    record({ id: 'local-only', serverReport: undefined }),
  ]
  const capsules = capsuleRecordsFromStudyRecords(records, '201')
  assert.deepEqual(capsules.map((item) => item.id), ['a', 'b'])
  assert.equal(capsules[0]!.durationSeconds, 5_400)
  assert.equal(capsules[0]!.connectionId, 'a')
  assert.equal(capsules[0]!.line, undefined)
  assert.equal(capsules[1]!.line, '내일 봐')
  assert.equal(capsules[1]!.endedAt, NOW - 1_000)
})

test('falls back to the server study seconds and derives a missing start time', () => {
  const [mapped] = capsuleRecordsFromStudyRecords(
    [record({ id: 'x', startedAt: 0, endedAt: NOW, studySeconds: 0, serverReport: { connectedSeconds: 600 } })],
    '201',
  )
  assert.equal(mapped!.durationSeconds, 600)
  assert.equal(mapped!.startedAt, NOW - 600_000)
})

test('summary uses the right particle and total time', () => {
  const capsules = [capsule('1', NOW, 3_600), capsule('2', NOW - 1, 1_200)]
  assert.equal(capsuleJarSummary('채린', capsules, 9), '채린과 연결 2번, 캡슐 9개, 함께한 시간 1시간 20분')
  assert.equal(capsuleJarSummary('하나', []), '하나와의 캡슐 보관함, 아직 캡슐이 없어요')
  assert.equal(formatTogether(59), '0분')
  assert.equal(formatTogether(7_200), '2시간')
})

test('groups capsules by Seoul day, newest day first', () => {
  const day = 86_400_000
  const groups = groupCapsulesByDay([capsule('old', NOW - 2 * day), capsule('new', NOW), capsule('new2', NOW - 60_000)])
  assert.equal(groups.length, 2)
  assert.deepEqual(groups[0]!.capsules.map((item) => item.id), ['new', 'new2'])
})

test('dummy capsules are deterministic and all ended at least an hour ago', () => {
  const first = generateDummyCapsules(200, { now: NOW, seed: 3 })
  const second = generateDummyCapsules(200, { now: NOW, seed: 3 })
  assert.equal(first.length, 200)
  assert.deepEqual(first, second)
  assert.equal(new Set(first.map((item) => item.id)).size, 200)
  for (const item of first) {
    assert.ok(item.endedAt! <= NOW - 3_600_000)
    assert.ok(item.durationSeconds >= 15 * 60 && item.durationSeconds <= 240 * 60)
  }
})

// ── New-capsule decision ─────────────────────────────────────────────────────

test('only capsules that ended after the last visit fall', () => {
  const capsules = [capsule('1', NOW - 5_000), capsule('2', NOW - 3_000), capsule('3', NOW - 1_000)]
  assert.deepEqual(splitNewCapsules(capsules, NOW - 4_000).newIds, ['2', '3'])
  assert.deepEqual(splitNewCapsules(capsules, NOW).newIds, [])
})

test('first visit drops only the latest few; many new capsules are capped', () => {
  const capsules = Array.from({ length: 20 }, (_, index) => capsule(`c${index}`, NOW - (20 - index) * 1_000))
  assert.deepEqual(splitNewCapsules(capsules, null).newIds, ['c14', 'c15', 'c16', 'c17', 'c18', 'c19'])
  assert.equal(splitNewCapsules(capsules, 0 + 1).newIds.length, 12)
  assert.deepEqual(splitNewCapsules(capsules, null, { firstVisitDrop: 0 }).newIds, [])
  assert.deepEqual(splitNewCapsules([], null).newIds, [])
})

test('last visit is stored per account and mate and survives broken storage', () => {
  const map = new Map<string, string>()
  const storage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  }
  const keyA = capsuleVisitKey(7, 'chaerin')
  const keyB = capsuleVisitKey(8, 'chaerin')
  assert.notEqual(keyA, keyB)
  assert.equal(capsuleVisitKey(undefined, 'chaerin'), 'capsule-jar-visit:v1:guest:chaerin')
  assert.equal(readLastVisit(storage, keyA), null)
  writeLastVisit(storage, keyA, NOW)
  assert.equal(readLastVisit(storage, keyA), NOW)
  assert.equal(readLastVisit(storage, keyB), null)
  map.set(keyB, 'garbage')
  assert.equal(readLastVisit(storage, keyB), null)
  clearLastVisit(storage, keyA)
  assert.equal(readLastVisit(storage, keyA), null)

  const throwing = {
    getItem: () => { throw new Error('denied') },
    setItem: () => { throw new Error('denied') },
    removeItem: () => { throw new Error('denied') },
  }
  assert.equal(readLastVisit(throwing, keyA), null)
  assert.doesNotThrow(() => writeLastVisit(throwing, keyA, NOW))
  assert.doesNotThrow(() => clearLastVisit(throwing, keyA))
  assert.equal(readLastVisit(undefined, keyA), null)
})


// ── Capsules on the panel floor, the mate standing in the middle ───────────────────────────────────────

test('a connection becomes a bundle: one capsule per 10 minutes, 3 to 18', () => {
  assert.deepEqual(
    [5, 30, 60, 75, 120, 180, 400].map((minutes) => capsulesForConnection(minutes * 60)),
    [3, 3, 6, 8, 12, 18, 18],
  )
  assert.deepEqual(CAPSULE_COUNT, { minutesPerCapsule: 10, min: 3, max: 18 })
})

test('pile: bundles by connection, flat in the screen plane, inside the panel and inside one bin each, most beside the mate', () => {
  for (const count of [1, 7, 15, 30, 60]) {
    const capsules = generateDummyCapsules(count, { now: NOW })
    const layout = layoutFloor(capsules, { halfWidth: 3.7 })
    assert.equal(layout.width, 7.4)
    const expected = capsules.reduce((sum, capsule) => sum + capsulesForConnection(capsule.durationSeconds), 0)
    assert.equal(layout.placements.length, expected)
    assert.equal(layout.groups.length, count)
    for (const group of layout.groups) {
      const pieces = group.indices.map((index) => layout.placements[index]!)
      assert.ok(pieces.every((piece) => piece.groupId === group.id))
      assert.equal(pieces.length, capsulesForConnection(group.durationSeconds))
      for (const piece of pieces) {
        // A keepsake is KEEPSAKE_SCALE × the base length; the others vary only a little.
        if (piece.keepsake) assert.ok(Math.abs(piece.length / layout.baseLength - KEEPSAKE_SCALE) < 1e-9, 'keepsake size')
        else assert.ok(Math.abs(piece.length / layout.baseLength - 1) <= 0.121, 'only a small natural size variation')
        assert.equal(piece.band, group.band, 'a bundle shares its time band')
      }
      assert.ok(pieces.filter((piece) => piece.keepsake).length <= 1, 'at most one keepsake per connection')
      assert.equal(pieces.some((piece) => piece.keepsake), group.keepsake > 0)
    }
    for (const placement of layout.placements) {
      assert.ok(placement.y >= placement.radius - 1e-6, `${placement.id} sinks into the floor`)
      assert.equal(placement.z, 0, '2D: every capsule lies in the screen plane')
      assert.equal(placement.yaw, 0, '2D: turned only within the plane')
      // The whole capsule inside its bin (never across an inner wall) and so inside the panel.
      const bin = pileBinAt(placement.x, 3.7)
      const reach = (placement.length / 2 - placement.radius) * Math.abs(Math.cos(placement.pitch)) + placement.radius
      assert.ok(placement.x - reach >= bin.from - 1e-6 && placement.x + reach <= bin.to + 1e-6, `${placement.id} crosses a bin wall`)
    }
    // Most capsules lie in the side bins, beside the mate; the middle behind her gets the rest.
    if (count >= 7) {
      const middle = layout.placements.filter((placement) => Math.abs(placement.x) < PILE.binEdge)
      assert.ok(middle.length / layout.placements.length < 0.35, `too many capsules in the middle (${count}: ${middle.length})`)
    }
  }
})

test('pile: the same data gives the same layout; capsules shrink with the count so the side heaps keep their height', () => {
  const capsules = generateDummyCapsules(15, { now: NOW })
  assert.deepEqual(layoutFloor(capsules).placements, layoutFloor(capsules).placements)
  const lengths = [10, 60, 120, 300, 1000].map((count) => floorCapsuleLength(count))
  assert.equal(lengths[0], PILE.maxLength)
  assert.equal(lengths[4], PILE.minLength)
  for (let index = 1; index < lengths.length; index++) assert.ok(lengths[index]! <= lengths[index - 1]!)
  // Many capsules fill the side bins to about `sideFill`; the middle stays low.
  const big = layoutFloor(generateDummyCapsules(50, { now: NOW }), { halfWidth: 3.7 })
  const sideTop = Math.max(...big.placements.filter((placement) => Math.abs(placement.x) > PILE.binEdge).map((placement) => placement.y + placement.radius))
  const middleTop = Math.max(...big.placements.filter((placement) => Math.abs(placement.x) < PILE.binEdge).map((placement) => placement.y + placement.radius))
  assert.ok(sideTop > PILE.sideFill * 0.75 && sideTop < PILE.sideFill * 1.35, `side heaps ${sideTop}`)
  assert.ok(middleTop < sideTop * 0.5, `middle ${middleTop}`)
  assert.equal(pileBins(3.7).reduce((sum, bin) => sum + bin.share, 0), 1)
  // The panel's shape sets the floor's width (the panel is PILE.viewHeight high); the side bins never vanish.
  assert.equal(pileHalfWidth(740 / 560), 4.3)
  assert.ok(pileHalfWidth(0.3) >= PILE.binEdge + PILE.minSideWidth)
  // A wider panel spreads the same capsules over more room: longer capsules (until the cap).
  assert.ok(floorCapsuleLength(300, 4.3) > floorCapsuleLength(300, 3.2))
})

// ── Feature flags and sample data ────────────────────────────────────────────

test('mate features: all off in production, on in development unless ?features=off', () => {
  assert.deepEqual(resolveMateFeatures(false, null), MATE_FEATURES_OFF)
  assert.deepEqual(resolveMateFeatures(false, 'on'), MATE_FEATURES_OFF)
  assert.deepEqual(resolveMateFeatures(true, 'off'), MATE_FEATURES_OFF)
  const dev = resolveMateFeatures(true, null)
  assert.equal(dev.affinity, true)
  assert.equal(dev.world, true)
  assert.equal(dev.voices, false, 'voice lines stay hidden until the samples ship')
})

test('sample affinity follows the PRD stages from connection time', () => {
  assert.equal(AFFINITY_STAGES.length, AFFINITY_STAGE_COUNT)
  assert.deepEqual(sampleRelation(0), { stage: 1, stageName: '처음 만남', nextStageName: '아는 사이', nextLevelSeconds: 3600, stageProgress: 0 })
  const friend = sampleRelation(7 * 3600)
  assert.equal(friend.stage, 3)
  assert.equal(friend.stageName, '친구')
  assert.equal(friend.nextStageName, '친한 친구')
  assert.equal(friend.nextLevelSeconds, 8 * 3600)
  assert.equal(sampleRelation(100 * 3600).stage, 5)
  assert.equal(sampleRelation(100 * 3600).nextStageName, undefined)
})

test('affinity stages: one table of five stage names and conditions', () => {
  assert.deepEqual(AFFINITY_STAGES.map((item) => `${item.stage}:${item.name}`), ['1:처음 만남', '2:아는 사이', '3:친구', '4:친한 친구', '5:단짝'])
  assert.equal(affinityStageLabel(3, '친구'), '3단계 · 친구')
  assert.equal(affinityUnlockCondition(4), '4단계 · 친한 친구에서 열려요')
  // A source counting from another base is put on the table by the stage name.
  assert.deepEqual(normalizeAffinityStage(2, '친구'), { stage: 3, stageName: '친구' })
  assert.deepEqual(normalizeAffinityStage(7, '새 단계'), { stage: 7, stageName: '새 단계' })
  assert.equal(normalizeAffinityStage(undefined, undefined), null)
})

