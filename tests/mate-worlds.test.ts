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
  worldName,
  serverItemsFromUnlocked,
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

test('세계관 copy: 「EP.03 · 도서관」, 「4단계에서 열려요」, 「첫 연결 후 열려요」, 「새 세계관이 열렸어요 · EP.03 도서관」', () => {
  assert.equal(episodeLabel(3), 'EP.03')
  const [library] = mateWorldsForStage(3, { content: [{ episode: 3, place: '도서관' }] }).slice(2)
  assert.equal(worldLabel(library!), 'EP.03 · 도서관')
  assert.equal(worldStageUpLine(library!), '새 세계관이 열렸어요 · EP.03 도서관')
  assert.equal(worldLockedCaption(4), '4단계에서 열려요')
  assert.equal(worldLockedCaption(1), '첫 연결 후 열려요')
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
  // No name, introduction, story text or prompt on a placeholder (and never a prompt field at all).
  for (const key of ['title', 'outfit', 'summary', 'body', 'prompt']) assert.ok(!(key in worlds[0]!), key)
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
  assert.equal(worldStageUpLine(worldOpenedAt(3, undefined, sampleMateWorlds('chaerin'))!), '새 세계관이 열렸어요 · EP.03 주말 오후의 카페')
  assert.equal(worldStageUpLine(worldOpenedAt(2, undefined, sampleMateWorlds('dohyun'))!), '새 세계관이 열렸어요 · EP.02 나 알바 중인데')
  // 21 · 22 · 23 `unlocked[]` of the old kinds change nothing.
  assert.equal(worldOpenedAt(4, [{ type: 'EXPRESSION', title: '웃음', unlockStage: 4 }])?.placeholder, true)
  assert.equal(worldOpenedAt(0), null)
  assert.equal(worldOpenedAt(6), null)
})

test('세계관: a world name is its title (「EP.01 · 도서관에서」); without one, the place (「EP.03 · 도서관」)', () => {
  const [first, , third] = mateWorldsForStage(3, {
    content: [
      { episode: 1, title: ' 도서관에서 ', place: '도서관', outfit: '후드티', summary: '조용한 통화.' },
      { episode: 3, place: '도서관', title: '  ' },
    ],
  })
  assert.deepEqual([first!.title, first!.place, first!.outfit, first!.summary], ['도서관에서', '도서관', '후드티', '조용한 통화.'])
  assert.equal(worldLabel(first!), 'EP.01 · 도서관에서')
  assert.equal(worldStageUpLine(first!), '새 세계관이 열렸어요 · EP.01 도서관에서')
  assert.equal(worldName(first!), '도서관에서')
  assert.equal('title' in third!, false)
  assert.equal(worldLabel(third!), 'EP.03 · 도서관')
  // A name without a place is not a world: the placeholder, named by its episode alone.
  const [nameOnly] = mateWorldsForStage(1, { content: [{ episode: 1, title: '도서관에서', outfit: '후드티' }] })
  assert.deepEqual([nameOnly!.placeholder, 'title' in nameOnly!, 'outfit' in nameOnly!, worldLabel(nameOnly!)], [true, false, false, 'EP.01'])
})

test('세계관 adapter: an item with its own place makes `title` the name; without one `title` stays the place', () => {
  const named = worldContentFromServer(
    [item({ id: '21', title: '도서관에서', place: '도서관', outfit: '후드티', summary: '조용한 통화.' }), item({ id: '22', title: '편의점', unlockStage: 2 })],
    ['WORLD'],
  )
  assert.deepEqual(named, [
    { id: '21', episode: 1, unlockStage: 1, place: '도서관', title: '도서관에서', outfit: '후드티', summary: '조용한 통화.' },
    { id: '22', episode: 2, unlockStage: 2, place: '편의점' },
  ])
  assert.deepEqual(serverItemsFromUnlocked([{ type: 'WORLD', title: '도서관에서', unlockStage: 1, place: ' 도서관 ', outfit: 3, summary: '' }]), [
    { id: 'unlocked-0', type: 'WORLD', title: '도서관에서', unlockStage: 1, assetUrl: null, unlocked: true, unlockedAt: null, place: '도서관' },
  ])
})

test('세계관 examples (development only): 채린 and 서도현 follow their planning tables, each with its own places', () => {
  const chaerin = sampleMateWorlds('chaerin', { background: '/bg.webp', outfit: '/full.webp' })
  assert.deepEqual(chaerin.map((world) => [episodeLabel(world.episode), world.title, world.place, world.outfit, world.sampleLine]), [
    ['EP.01', '노을 진 방과 후 교실', '교실', '교복', '창밖 좀 봐. …노을 지네. 뭐, 그렇다고.'],
    ['EP.02', '단둘이 남은 야자실', '야자실', '체육복', '쉿, 감독 쌤 지나간다. …됐다, 갔어.'],
    ['EP.03', '주말 오후의 카페', '카페', '연회색 후드티, 연청 데님', '이 집 딸기라떼 진짜 맛있거든? …커피는 왜 마시는지 모르겠어. 써.'],
    ['EP.04', '불 켜진 학교 도서관', '학교 도서관', '트랙 져지', '쉿, 사서 쌤 쳐다본다. …너 때문에 웃음 참느라 죽는 줄.'],
    ['EP.05', '하얀 채린의 방', '채린의 방', '아이보리 긴팔티, 트레이닝 팬츠', '뭐 봐? 아, 저 선반…. 됐어, 다 봤으니까 어쩔 수 없지. 귀엽긴 하잖아.'],
  ])
  // EP.01 is still the classroom: the app's classroom background and her full still (uniform) stay on it alone.
  assert.deepEqual([chaerin[0]!.backgroundUrl, chaerin[0]!.outfitPreviewUrl, chaerin[1]!.backgroundUrl], ['/bg.webp', '/full.webp', undefined])

  const dohyun = sampleMateWorlds('dohyun', { background: '/bg.webp', outfit: '/full.webp' })
  assert.deepEqual(dohyun.map((world) => [episodeLabel(world.episode), world.title, world.place, world.outfit, world.sampleLine]), [
    ['EP.01', '도서관에서', '도서관', '후드티', '아, 이 부분 왜 이렇게 안 읽히냐.'],
    ['EP.02', '나 알바 중인데', '편의점', '편의점 유니폼 조끼, 검은 반팔', '이거 새로 들어온 건데 맛있으려나.'],
    ['EP.03', '커피 한 잔', '카페', '아이보리 니트, 사복', '여기 케이크 맛있어 보이는데. 하나 시킬까.'],
    ['EP.04', '한 판만 더', 'PC방', '검은 후드집업, 게이밍 헤드셋', '아니, 방금 그건 좀 억울한데. …라면이나 시킬까.'],
    ['EP.05', '서도현의 방', '서도현의 방', '편안한 잠옷', '아, 뒤에 침대 있으니까 자꾸 눕고 싶다.'],
  ])
  // His still is a school uniform and the call background a classroom: neither is one of his worlds.
  for (const world of dohyun) assert.deepEqual([world.backgroundUrl, world.outfitPreviewUrl], [undefined, undefined])
  for (const world of [...chaerin, ...dohyun]) {
    assert.ok(world.summary, `${world.title}: an introduction`)
    for (const key of ['prompt', 'mood', 'time']) assert.ok(!(key in world), key)
  }
  // EP.N opens at Lv.N.
  assert.deepEqual(mateWorldsForStage(2, { content: dohyun }).map((world) => world.unlocked), [true, true, false, false, false])
  // A mate without examples gets none (「준비 중」), never another mate's worlds.
  assert.deepEqual(sampleMateWorlds('someone-else'), [])
})
