import test from 'node:test'
import assert from 'node:assert/strict'
import { SCREEN_LABELS, TOUR_STEPS, nextScreenStep, readMs, stepPath, tourHref, tourSteps, type TourContext } from '../src/features/tour/tour-steps.ts'
import { SPOT_RADIUS, STRIP_PX, closedSpot, easeOutCubic, spotBetween, spotlightTransforms } from '../src/features/tour/tour-spotlight.ts'

const ALL_ON: TourContext = { mateId: 'chaerin', features: { affinity: true, world: true } }
const PRODUCTION: TourContext = { mateId: 'chaerin', features: { affinity: false, world: false } }

test('one pass over the whole service in 11 steps, screen by screen, ending with the outro', () => {
  const steps = tourSteps(ALL_ON)
  assert.equal(steps.length, 11)
  const screens = steps.map((step) => step.screen)
  // Each screen is one contiguous run (screens never interleave), in the order the user asked for.
  const order = screens.filter((screen, index) => screen !== screens[index - 1])
  assert.deepEqual(order, ['home', 'mate-detail', 'call', 'my-mates', 'records', 'account', 'outro'])
  const perScreen = Object.fromEntries(order.map((screen) => [screen, screens.filter((value) => value === screen).length]))
  assert.deepEqual(perScreen, { home: 2, 'mate-detail': 1, call: 3, 'my-mates': 2, records: 1, account: 1, outro: 1 })
  assert.equal(steps.at(-1)!.id, 'outro')
  assert.deepEqual(steps.at(-1)!.marks, [])
  for (const screen of order) assert.ok(SCREEN_LABELS[screen])
})

test('step ids are unique; every step but the outro has marks with targets, and arrow points off their words', () => {
  const ids = TOUR_STEPS.map((step) => step.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const step of TOUR_STEPS) {
    if (step.screen === 'outro') continue
    assert.ok(step.marks.length > 0, step.id)
    for (const mark of step.marks) {
      assert.ok(mark.targets.length > 0, step.id)
      // Typing goes to the field's centre; every other mark names where the arrow lands.
      if (mark.action === 'type') continue
      assert.ok(mark.at, step.id)
      assert.ok(mark.at!.x >= 0 && mark.at!.x <= 1 && mark.at!.y >= 0 && mark.at!.y <= 1, step.id)
    }
  }
})

test('feature-flagged marks go when the flag is off (production); the step keeps its place and speaks without them', () => {
  const production = tourSteps(PRODUCTION)
  assert.equal(production.length, 11)
  const capsules = production.find((step) => step.id === 'mates-capsules')!
  const recent = production.find((step) => step.id === 'mates-recent')!
  assert.ok(capsules.marks.every((mark) => mark.feature !== 'affinity'))
  assert.ok(recent.marks.every((mark) => mark.feature !== 'world'))
  assert.doesNotMatch(capsules.say, /친밀도|표정|세계관/)
  assert.doesNotMatch(recent.say, /표정|세계관|친밀도/)
  const development = tourSteps(ALL_ON)
  assert.match(development.find((step) => step.id === 'mates-capsules')!.say, /친밀도/)
  assert.match(development.find((step) => step.id === 'mates-recent')!.say, /세계관/)
  assert.ok(development.find((step) => step.id === 'mates-recent')!.marks.some((mark) => mark.targets.includes('[data-tour="my-mates-world"]')))
  // The expression unlocks are gone (2026-11-26): no line names them.
  for (const step of TOUR_STEPS) assert.doesNotMatch(`${step.say} ${step.sayWithout ?? ''}`, /표정/, step.id)
  const onlyAffinity = tourSteps({ ...PRODUCTION, features: { affinity: true, world: false } })
  assert.ok(onlyAffinity.find((step) => step.id === 'mates-capsules')!.marks.some((mark) => mark.feature === 'affinity'))
  assert.ok(onlyAffinity.find((step) => step.id === 'mates-recent')!.marks.every((mark) => mark.feature !== 'world'))
})

test('the cursor presses only where a press is harmless and types only into the practice chat', () => {
  const presses = TOUR_STEPS.flatMap((step) => step.marks.filter((mark) => mark.action === 'click').map((mark) => `${step.id}:${mark.targets[0]}`))
  assert.deepEqual(presses, [
    'home-mates:[data-tour="mate-card-connect"]',
    'mate-detail:[data-tour="mate-detail-voice"] button',
    'mate-detail:[data-tour="mate-detail-connect"] button',
    'call-end:[data-tour="call-dock"] [data-action="leave"]',
    'records:[data-tour="records-board"]',
  ])
  // Every press shows what it would do (a local preview), never doing it.
  for (const step of TOUR_STEPS) for (const mark of step.marks) if (mark.action === 'click') assert.ok(mark.preview?.length, step.id)
  const typing = TOUR_STEPS.flatMap((step) => step.marks.filter((mark) => mark.action === 'type').map((mark) => ({ step, mark })))
  assert.deepEqual(typing.map(({ step }) => step.id), ['call-talk'])
  assert.equal(typing[0]!.step.screen, 'call')
  assert.ok(typing[0]!.mark.text)
})

test('each screen has its own address; the first mate is used for the detail and the practice call', () => {
  const byId = (id: string) => TOUR_STEPS.find((step) => step.id === id)!
  const context: TourContext = { ...PRODUCTION, mateId: 'dohyun' }
  assert.equal(stepPath(byId('home-mates'), context), '/')
  assert.equal(stepPath(byId('mate-detail'), context), '/mates/dohyun')
  assert.equal(stepPath(byId('call-mate'), context), '/tour/call/dohyun')
  assert.equal(stepPath(byId('mates-capsules'), context), '/mates/me?mate=dohyun')
  assert.equal(stepPath(byId('records'), context), '/records')
  assert.equal(stepPath(byId('account'), context), '/?account=profile')
  assert.equal(stepPath(byId('outro'), context), '/')
  assert.equal(tourHref(byId('home-mates'), context), '/?tour=home-mates')
  assert.equal(tourHref(byId('mates-recent'), context), '/mates/me?mate=dohyun&tour=mates-recent')
  assert.equal(tourHref(byId('account'), context), '/?account=profile&tour=account')
})

test('「이 화면 건너뛰기」 goes to the next screen’s first step; none from the last screen', () => {
  const steps = tourSteps(ALL_ON)
  const at = (id: string) => steps.findIndex((step) => step.id === id)
  assert.equal(nextScreenStep(steps, at('home-mates'))!.id, 'mate-detail')
  assert.equal(nextScreenStep(steps, at('call-mate'))!.id, 'mates-capsules')
  assert.equal(nextScreenStep(steps, at('call-talk'))!.id, 'mates-capsules')
  assert.equal(nextScreenStep(steps, at('mates-capsules'))!.id, 'records')
  assert.equal(nextScreenStep(steps, at('account'))!.id, 'outro')
  assert.equal(nextScreenStep(steps, at('outro')), null)
})

test('every line is one or two sentences in 채린’s 반말, read long enough, and names each feature of its step', () => {
  assert.equal(readMs('짧아'), 2600)
  assert.equal(readMs('가'.repeat(30)), 4200)
  const features: Record<string, readonly string[]> = {
    'home-mates': ['메이트', '카드', '연결', '음성', 'PIP'],
    'home-attendance': ['출석', '크레딧'],
    'mate-detail': ['소개', '연령 등급', '목소리', '연결하기'],
    'call-mate': ['반응', '말 거는 빈도'],
    'call-talk': ['채팅', '음성', '카메라', '기본 모드', '고급 모드', '크레딧'],
    'call-end': ['PIP', '끝낼', '연결 기록'],
    'mates-capsules': ['캡슐', '함께한 시간', '친밀도'],
    'mates-recent': ['최근 캡슐', '기록 카드', '친밀도', '세계관', '화살표'],
    records: ['기간', '보드', '날짜'],
    account: ['프로필', '설정', '보안'],
  }
  for (const step of TOUR_STEPS) {
    for (const line of [step.say, step.sayWithout].filter((value): value is string => Boolean(value))) {
      const sentences = line.split(/(?<=[.!?])\s+/).filter(Boolean)
      assert.ok(sentences.length >= 1 && sentences.length <= 2, `${step.id}: ${line}`)
      for (const sentence of sentences) assert.doesNotMatch(sentence, /(요|니다)[.!?]?$/, `${step.id}: ${sentence}`)
    }
    for (const word of features[step.id] ?? []) assert.ok(step.say.includes(word), `${step.id} names ${word}`)
  }
  assert.equal(TOUR_STEPS.at(-1)!.say, '이제 만나러 가 볼까?')
})

test('the light: four shades and four corner caps around the hole, moved by transform only, edges joined', () => {
  const width = 1440, height = 900
  const spot = { left: 100, top: 200, width: 300, height: 120 }
  const t = spotlightTransforms(spot, width, height)
  assert.equal(t.top, 'translate3d(0px, -700px, 0)', 'the top sheet ends at the hole’s top')
  assert.equal(t.bottom, 'translate3d(0px, 320px, 0)', 'the bottom sheet starts at the hole’s bottom')
  assert.equal(t.left, `translate3d(-1340px, 200px, 0) scaleY(${120 / STRIP_PX})`, 'the left strip ends at the hole’s left, as tall as the hole')
  assert.equal(t.right, `translate3d(400px, 200px, 0) scaleY(${120 / STRIP_PX})`)
  assert.equal(t.br, `translate3d(${400 - SPOT_RADIUS}px, ${320 - SPOT_RADIUS}px, 0)`)
  assert.equal(t.corners, true)
  assert.equal(spotlightTransforms({ ...spot, height: 20 }, width, height).corners, false, 'no caps on a hole too small for them')
  // No hole: the sheets meet in the middle and cover the screen.
  const closed = spotlightTransforms(closedSpot(width, height), width, height)
  assert.equal(closed.top, 'translate3d(0px, -450px, 0)')
  assert.equal(closed.bottom, 'translate3d(0px, 450px, 0)')
  assert.equal(closed.left, 'translate3d(-720px, 450px, 0) scaleY(0)')
})

test('a move is on whole pixels with the cursor’s ease-out, from where it is to where it goes', () => {
  const from = { left: 0, top: 0, width: 100, height: 100 }
  const to = { left: 101, top: 51, width: 301, height: 11 }
  assert.deepEqual(spotBetween(from, to, 0), from)
  assert.deepEqual(spotBetween(from, to, 1), to)
  const mid = spotBetween(from, to, easeOutCubic(0.5))
  for (const value of Object.values(mid)) assert.ok(Number.isInteger(value))
  assert.equal(easeOutCubic(0), 0)
  assert.equal(easeOutCubic(1), 1)
  assert.equal(easeOutCubic(0.5), 0.875)
})

// Safety (no real click, connectMate, session / message / event / reaction call, getUserMedia or PIP during the tour)
// is checked on the running app, not in the source: scripts/check-service-tour.mjs.
