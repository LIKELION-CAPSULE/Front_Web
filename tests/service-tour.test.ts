import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SCREEN_LABELS, TOUR_STEPS, readMs, stepPath, tourHref, tourSteps, type TourContext } from '../src/features/tour/tour-steps.ts'

const ALL_ON: TourContext = { mateId: 'chaerin', features: { affinity: true, expressions: true } }
const PRODUCTION: TourContext = { mateId: 'chaerin', features: { affinity: false, expressions: false } }

test('one pass over the whole service, screen by screen, ending with the outro', () => {
  const screens = tourSteps(ALL_ON).map((step) => step.screen)
  // Each screen is one contiguous run (screens never interleave), in the order the user asked for.
  const order = screens.filter((screen, index) => screen !== screens[index - 1])
  assert.deepEqual(order, ['home', 'mate-detail', 'call', 'my-mates', 'records', 'account', 'outro'])
  assert.equal(tourSteps(ALL_ON).at(-1)!.id, 'outro')
  assert.deepEqual(tourSteps(ALL_ON).at(-1)!.targets, [])
  for (const screen of order) assert.ok(SCREEN_LABELS[screen])
})

test('step ids are unique and every step but the outro has a target and an arrow point off its words', () => {
  const ids = TOUR_STEPS.map((step) => step.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const step of TOUR_STEPS) {
    if (step.screen === 'outro') continue
    assert.ok(step.targets.length > 0, step.id)
    assert.ok(step.at, step.id)
    assert.ok(step.at!.x >= 0 && step.at!.x <= 1 && step.at!.y >= 0 && step.at!.y <= 1, step.id)
  }
})

test('feature-flagged steps go when the flag is off (production)', () => {
  const production = tourSteps(PRODUCTION).map((step) => step.id)
  assert.ok(!production.includes('mates-affinity'))
  assert.ok(!production.includes('mates-expressions'))
  const development = tourSteps(ALL_ON).map((step) => step.id)
  assert.ok(development.includes('mates-affinity') && development.includes('mates-expressions'))
  assert.equal(development.length - production.length, 2)
  const onlyAffinity = tourSteps({ ...PRODUCTION, features: { affinity: true, expressions: false } }).map((step) => step.id)
  assert.ok(onlyAffinity.includes('mates-affinity') && !onlyAffinity.includes('mates-expressions'))
})

test('the cursor presses only where a press is harmless and types only into the practice chat', () => {
  const clicks = TOUR_STEPS.filter((step) => step.action === 'click').map((step) => step.id)
  assert.deepEqual(clicks, ['home-connect', 'detail-voice', 'detail-connect', 'call-leave', 'records-day'])
  const typing = TOUR_STEPS.filter((step) => step.action === 'type')
  assert.deepEqual(typing.map((step) => step.id), ['call-chat'])
  assert.equal(typing[0]!.screen, 'call')
  assert.ok(typing[0]!.text)
})

test('each screen has its own address; the first mate is used for the detail and the practice call', () => {
  const byId = (id: string) => TOUR_STEPS.find((step) => step.id === id)!
  const context: TourContext = { ...PRODUCTION, mateId: 'dohyun' }
  assert.equal(stepPath(byId('home-card'), context), '/')
  assert.equal(stepPath(byId('detail-intro'), context), '/mates/dohyun')
  assert.equal(stepPath(byId('call-mate'), context), '/tour/call/dohyun')
  assert.equal(stepPath(byId('mates-capsules'), context), '/mates/me?mate=dohyun')
  assert.equal(stepPath(byId('records-period'), context), '/records')
  assert.equal(stepPath(byId('account-profile'), context), '/?account=profile')
  assert.equal(stepPath(byId('account-settings'), context), '/?account=settings')
  assert.equal(stepPath(byId('account-security'), context), '/?account=settings')
  assert.equal(stepPath(byId('outro'), context), '/')
  assert.equal(tourHref(byId('home-card'), context), '/?tour=home-card')
  assert.equal(tourHref(byId('mates-total'), context), '/mates/me?mate=dohyun&tour=mates-total')
  assert.equal(tourHref(byId('account-profile'), context), '/?account=profile&tour=account-profile')
})

test('every line is read long enough and sounds like 채린 (반말), with the outro asking to go meet', () => {
  assert.equal(readMs('짧아'), 2600)
  assert.equal(readMs('가'.repeat(30)), 4200)
  for (const step of TOUR_STEPS) {
    assert.ok(step.say.length > 0 && step.say.length <= 60, step.id)
    assert.doesNotMatch(step.say, /(요|니다)[.!?]?$/, step.id)
  }
  assert.equal(TOUR_STEPS.at(-1)!.say, '이제 만나러 가 볼까?')
})

test('the practice call never reaches the session, media, PIP or message code', () => {
  const source = readFileSync(new URL('../src/features/tour/TourCallPage.tsx', import.meta.url), 'utf8')
  for (const forbidden of ['getUserMedia', 'documentPictureInPicture', 'requestPictureInPicture', 'startSession', 'createSession', 'useConnection', 'sendMessage', 'postEvent', 'fetch(']) {
    assert.ok(!source.includes(forbidden), forbidden)
  }
  assert.match(source, /연습 화면이에요 · 실제로 연결되지 않아요/)
  assert.match(source, /<Navigate to="\/" replace \/>/)
})

test('the cursor\'s press is visual: the controller never clicks or dispatches pointer events', () => {
  const source = readFileSync(new URL('../src/features/tour/ServiceTour.tsx', import.meta.url), 'utf8')
  assert.ok(!/\.click\(\)/.test(source))
  assert.ok(!/dispatchEvent/.test(source))
  assert.match(source, /onCursorPress=\{\(\) => setPreview\(step\.id\)\}/)
  assert.match(source, /onCycle=\{\(\) => setPreview\(null\)\}/)
})
