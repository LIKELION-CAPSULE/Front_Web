import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getSceneLayout,
  getSceneBackground,
  hasSceneDesk,
  type SceneComposition,
  type SceneVariant,
} from '../src/features/rooms/composition.ts'

const scenes: SceneComposition[] = [
  {
    subjectSize: [1536, 1024],
    subjectLayout: { width: 0.96, center: 0.5, anchor: 0.46, maxHeight: 1.3 },
    seatedLayout: { width: 1.3, center: 0.52, anchor: 997 / 1024, maxHeight: 0.86 },
    deskSurface: 209 / 724,
  },
  {
    subjectSize: [1024, 1536],
    subjectLayout: { width: 0.6, center: 0.65, anchor: 0.48, maxHeight: 1.3 },
    seatedLayout: { width: 0.6, center: 0.69, anchor: 1510 / 1536, maxHeight: 0.84 },
    deskSurface: 317 / 724,
  },
  {
    subjectSize: [1536, 1024],
    subjectLayout: { width: 0.86, center: 0.55, anchor: 0.9, maxHeight: 1.1 },
    seatedLayout: { width: 0.94, center: 0.56, anchor: 949 / 1024, maxHeight: 0.84, bottom: 0.99 },
    welcomeLayout: { width: 0.76, center: 0.65, maxHeight: 0.58, bottom: 0.69 },
    deskSurface: 209 / 724,
  },
]
const frames = [
  { x: 0, y: 0, width: 400, height: 285 },
  { x: 17, y: 31, width: 960, height: 300 },
  { x: 28, y: 72, width: 304, height: 260 },
  { x: 0, y: 0, width: 200, height: 480 },
]
const variants: SceneVariant[] = ['card', 'hero', 'backdrop', 'scene', 'portrait', 'thumb']

test('all character silhouettes fit horizontally and keep their heads inside the frame', () => {
  for (const art of scenes)
    for (const frame of frames)
      for (const variant of variants) {
        const { subject } = getSceneLayout(art, frame, variant)
        assert.ok(
          subject.x >= frame.x && subject.x + subject.width <= frame.x + frame.width + 0.001,
        )
        assert.ok(subject.y >= frame.y + frame.height * 0.02 - 0.001)
        assert.ok(
          Math.abs(subject.width / subject.height - art.subjectSize[0] / art.subjectSize[1]) <
            0.00001,
        )
      }
})

test('the character contact point and the opaque desk edge meet at the same surface', () => {
  for (const art of scenes)
    for (const frame of frames)
      for (const variant of variants) {
        const { subject, desk, surfaceY } = getSceneLayout(art, frame, variant)
        assert.ok(
          Math.abs(subject.y + subject.height * art.subjectLayout.anchor - surfaceY) < 0.001,
        )
        assert.ok(Math.abs(desk.y + desk.height * art.deskSurface - surfaceY) < 0.001)
        assert.equal(desk.x, frame.x)
        assert.equal(desk.width, frame.width)
        assert.ok(Math.abs(desk.y + desk.height - frame.y - frame.height) < 0.001)
      }
})

test('full-body inspection shows every figure including feet with a safe margin', () => {
  for (const art of scenes)
    for (const frame of frames) {
      const { subject } = getSceneLayout(art, frame, 'fullbody')
      assert.ok(subject.x > frame.x && subject.y > frame.y)
      assert.ok(subject.x + subject.width < frame.x + frame.width)
      assert.ok(subject.y + subject.height < frame.y + frame.height)
    }
})

test('main scenes sit at the lower right with only a small foot crop and no desk', () => {
  const backgrounds = { background: 'study.webp', seatedBackground: 'floor.webp' }
  assert.equal(getSceneBackground(backgrounds, 'seated'), 'floor.webp')
  assert.equal(hasSceneDesk('seated'), false)
  assert.equal(getSceneBackground(backgrounds, 'welcome'), 'floor.webp')
  assert.equal(hasSceneDesk('welcome'), false)
  assert.equal(getSceneBackground(backgrounds, 'portrait'), 'study.webp')
  assert.equal(hasSceneDesk('portrait'), true)
  for (const art of scenes)
    for (const frame of frames) {
      const { subject } = getSceneLayout(art, frame, 'seated')
      assert.ok(subject.y >= frame.y + frame.height * 0.19 - 0.001)
      assert.ok(subject.x + subject.width / 2 > frame.x + frame.width * 0.5)
      const footY = subject.y + subject.height * art.seatedLayout!.anchor
      const bottomCrop = (footY - frame.y - frame.height) / frame.height
      if (art.seatedLayout?.bottom) assert.ok(bottomCrop <= 0)
      else assert.ok(bottomCrop > 0.03 && bottomCrop < 0.04)
    }
  const square = { x: 0, y: 0, width: 400, height: 400 }
  const group = getSceneLayout(scenes[0]!, square, 'seated').subject
  const single = getSceneLayout(scenes[1]!, square, 'seated').subject
  assert.ok(Math.abs(group.height - single.height) < square.height * 0.03)
})

test('a low-lying face stays beside the welcome message without changing the main card', () => {
  const frame = { x: 0, y: 0, width: 400, height: 340 }
  const cat = scenes[2]!
  const welcome = getSceneLayout(cat, frame, 'welcome').subject
  const card = getSceneLayout(cat, frame, 'seated').subject
  assert.ok(welcome.y >= 0)
  const faceLeft = welcome.x + welcome.width * 0.58
  const messageRight = 28 + Math.min(280, frame.width * 0.6)
  assert.ok(faceLeft > messageRight)
  assert.ok(welcome.y + welcome.height > frame.height * 0.65)
  assert.ok(card.y + card.height > frame.height * 0.95)
})
