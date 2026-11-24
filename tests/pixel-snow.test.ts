import assert from 'node:assert/strict'
import test from 'node:test'
import {
  KIND_MOTION,
  SNOW_MAX,
  SNOW_MIN,
  SNOW_STAGES,
  SPRITES,
  SPRITE_SIZE,
  particleLook,
  pickKind,
  seededRandom,
  snowMix,
  snowTarget,
  spawnParticle,
  stepParticle,
  type SnowKind,
} from '../src/features/mates/pixel-snow/pixel-snow-model.ts'

const free = { big: true, capsule: true }

test('pixel snow: stage mix — no stage or out of range falls back to the nearest stage', () => {
  assert.equal(snowMix(null).stage, 1)
  assert.equal(snowMix(undefined).stage, 1)
  assert.equal(snowMix(Number.NaN).stage, 1)
  assert.equal(snowMix(0).stage, 1)
  assert.equal(snowMix(9).stage, 5)
  assert.equal(snowMix(3).stage, 3)
})

test('pixel snow: richer with every stage — more particles, then hearts, twinkles, the big ones last', () => {
  const stages = [1, 2, 3, 4, 5].map((stage) => SNOW_STAGES[stage as 1 | 2 | 3 | 4 | 5])
  for (let index = 1; index < stages.length; index++) {
    assert.ok(stages[index]!.perUnit > stages[index - 1]!.perUnit, 'density grows')
    assert.ok(stages[index]!.heart >= stages[index - 1]!.heart, 'hearts never shrink')
  }
  assert.deepEqual(stages.map((mix) => mix.heart > 0), [false, false, true, true, true])
  assert.deepEqual(stages.map((mix) => mix.sparkle > 0), [false, false, false, true, true])
  assert.deepEqual(stages.map((mix) => mix.big + mix.capsule > 0), [false, false, false, false, true])
  assert.ok(stages[4]!.heart > 0.5, 'stage 5 is mostly hearts')
})

test('pixel snow: count follows the background size within the limits; reduced motion keeps a few', () => {
  assert.equal(snowTarget(1440, 817, SNOW_STAGES[1]), 16)
  assert.equal(snowTarget(1440, 817, SNOW_STAGES[3]), 33)
  assert.equal(snowTarget(1440, 817, SNOW_STAGES[5]), 47)
  assert.equal(snowTarget(200, 200, SNOW_STAGES[1]), SNOW_MIN)
  assert.equal(snowTarget(4000, 3000, SNOW_STAGES[5]), SNOW_MAX)
  assert.equal(snowTarget(0, 800, SNOW_STAGES[5]), 0)
  const still = snowTarget(1440, 817, SNOW_STAGES[5], true)
  assert.ok(still >= 3 && still < snowTarget(1440, 817, SNOW_STAGES[5]))
})

test('pixel snow: kinds — snow only before stage 3; the big heart and the capsule only when none is on screen', () => {
  const kinds = (stage: 1 | 2 | 3 | 4 | 5, available = free) => {
    const random = seededRandom(stage)
    const seen = new Map<SnowKind, number>()
    for (let index = 0; index < 4000; index++) {
      const kind = pickKind(SNOW_STAGES[stage], random(), random(), available)
      seen.set(kind, (seen.get(kind) ?? 0) + 1)
    }
    return seen
  }
  for (const stage of [1, 2] as const) assert.deepEqual([...kinds(stage).keys()].sort(), ['dot', 'flake'])
  const three = kinds(3)
  const threeHearts = (three.get('heart') ?? 0) + (three.get('heartSmall') ?? 0)
  assert.ok(threeHearts / 4000 > 0.12 && threeHearts / 4000 < 0.25, `stage 3 hearts now and then (${threeHearts})`)
  const five = kinds(5)
  assert.ok((five.get('heartBig') ?? 0) > 0 && (five.get('capsule') ?? 0) > 0)
  const fiveBusy = kinds(5, { big: false, capsule: false })
  assert.equal(fiveBusy.get('heartBig') ?? 0, 0)
  assert.equal(fiveBusy.get('capsule') ?? 0, 0)
})

test('pixel snow: particles fall slowly, sway a little, fade in, stay faint, and leave at the bottom', () => {
  const random = seededRandom(7)
  const particle = spawnParticle(SNOW_STAGES[4], 400, random, free, 10)
  const motion = KIND_MOTION[particle.kind]
  assert.ok(particle.speed >= motion.speed[0] && particle.speed <= motion.speed[1])
  assert.equal(particleLook(particle, 0).alpha, 0, 'a particle placed mid-screen fades in')
  stepParticle(particle, 2, 1000)
  const look = particleLook(particle, 2)
  assert.ok(look.alpha > 0.1 && look.alpha <= 0.42, `faint (${look.alpha})`)
  assert.ok(Math.abs(look.x - particle.x) <= particle.swayAmp + 1, 'sways a little')
  assert.equal(Number.isInteger(look.x) && Number.isInteger(look.y), true, 'drawn on whole art pixels')
  const fromTop = spawnParticle(SNOW_STAGES[1], 400, random, free)
  assert.ok(fromTop.y < 0, 'new particles start above the top')
  assert.equal(stepParticle(fromTop, 1000, 300), false, 'gone past the bottom')
})

test('pixel snow: sprites are small pixel grids (3–11 px) with rectangular rows', () => {
  for (const [kind, rows] of Object.entries(SPRITES)) {
    const width = rows[0]!.length
    assert.ok(rows.every((row) => row.length === width), `${kind} rows`)
    assert.ok(width >= 3 && width <= 11 && rows.length <= 11, `${kind} size`)
    assert.deepEqual(SPRITE_SIZE[kind as SnowKind], [width, rows.length])
    assert.ok(rows.every((row) => /^[.abw]+$/.test(row)))
  }
})
