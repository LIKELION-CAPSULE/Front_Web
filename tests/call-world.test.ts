import assert from 'node:assert/strict'
import test from 'node:test'
import { callWorld, callWorldLabel } from '../src/features/mates/call-world.ts'
import { launchMates } from '../src/features/mates/catalog.ts'

const samples = [
  { episode: 1, place: '교실', title: '노을 진 방과 후 교실' },
  { episode: 2, place: '야자실', title: '단둘이 남은 야자실' },
  { episode: 3, place: '카페', title: '주말 오후의 카페' },
  { episode: 4, place: '학교 도서관', title: '불 켜진 학교 도서관' },
  { episode: 5, place: '채린의 방', title: '하얀 채린의 방' },
]

test('no stage or nothing opened: no world chip (the room picture alone is not a world)', () => {
  assert.equal(callWorld(), null)
  assert.equal(callWorld({ selected: null }), null)
  assert.equal(callWorld({ stage: null, content: samples }), null)
  assert.equal(callWorld({ stage: 0, content: samples }), null)
})

test('the call is in the newest world its stage has opened: Lv.3 → 「EP.03 주말 오후의 카페」', () => {
  const world = callWorld({ stage: 3, content: samples })
  assert.ok(world)
  assert.equal(callWorldLabel(world), 'EP.03 주말 오후의 카페')
  assert.equal(callWorldLabel(callWorld({ stage: 1, content: samples })!), 'EP.01 노을 진 방과 후 교실')
  assert.equal(callWorldLabel(callWorld({ stage: 5, content: samples })!), 'EP.05 하얀 채린의 방')
})

test('a stage-up during the call moves the chip with the intimacy chip', () => {
  assert.equal(callWorldLabel(callWorld({ stage: 2, content: samples })!), 'EP.02 단둘이 남은 야자실')
  assert.equal(callWorldLabel(callWorld({ stage: 3, content: samples })!), 'EP.03 주말 오후의 카페')
})

test('the newest opened world without content (「준비 중」) hides the chip: production until the server sends worlds', () => {
  assert.equal(callWorld({ stage: 3 }), null)
  assert.equal(callWorld({ stage: 3, content: samples.slice(0, 2) }), null)
  // Only the world a stageUp opened (21 `unlocked`): that one shows.
  assert.equal(callWorldLabel(callWorld({ stage: 3, content: [{ episode: 3, place: '카페', title: '주말 오후의 카페' }] })!), 'EP.03 주말 오후의 카페')
})

test('the server\'s own lock state wins over the stage: the newest world it has opened', () => {
  const locked = samples.map(world => world.episode === 3 ? { ...world, unlocked: false } : world)
  assert.equal(callWorldLabel(callWorld({ stage: 3, content: locked })!), 'EP.02 단둘이 남은 야자실')
})

test('a chosen world wins over the stage', () => {
  const world = callWorld({ selected: { episode: 5, place: '채린의 방', title: '하얀 채린의 방', placeholder: false }, stage: 3, content: samples })
  assert.ok(world)
  assert.equal(callWorldLabel(world), 'EP.05 하얀 채린의 방')
})

test('a world with a name shows its name: 「EP.05 하얀 채린의 방」 (not the place)', () => {
  assert.equal(callWorldLabel({ episode: 5, place: '채린의 방', title: '하얀 채린의 방', placeholder: false }), 'EP.05 하얀 채린의 방')
  assert.equal(callWorldLabel({ episode: 4, place: 'PC방', title: '  ', placeholder: false }), 'EP.04 PC방')
})

test('a placeholder or broken chosen world is never shown', () => {
  assert.equal(callWorld({ selected: { episode: 3, place: '준비 중', placeholder: true } }), null)
  assert.equal(callWorld({ selected: { episode: 3, place: '  ', placeholder: false } }), null)
  assert.equal(callWorld({ selected: { episode: 0, place: '교실', placeholder: false } }), null)
})

test('each launch mate has a short call header relation line', () => {
  for (const mate of launchMates) {
    assert.ok(mate.callTag, mate.id)
    assert.ok(mate.callTag.length <= 10, `${mate.id}: ${mate.callTag}`)
  }
  assert.equal(launchMates.find(mate => mate.id === 'chaerin')?.callTag, '같은 반 짝꿍')
})
