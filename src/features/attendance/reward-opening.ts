import capsuleArt from '@/assets/attendance/path/reward-capsule.webp'
import sequenceUrl from '@/assets/attendance/path/reward-opening.webp?url'

type Ref<T> = { current: T | null }
type RewardContext = {
  capsule: Ref<HTMLDivElement>
  capsuleImage: Ref<HTMLImageElement>
  burst: Ref<HTMLSpanElement>
  sparks: Ref<HTMLDivElement>
  play: (element: Element | null, frames: Keyframe[], options: KeyframeAnimationOptions) => Promise<void>
  isLive: () => boolean
  starOffsets: readonly { x: number; y: number }[]
}
const CAPSULE_MS = { out: 650, shake: 800, open: 450 }
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))
// This entire module and its image load only after the seventh check-in succeeds.
const rewardSequence = (async () => {
  const image = new Image()
  image.src = sequenceUrl
  try { await image.decode(); return sequenceUrl } catch { return null }
})()

export async function openRewardCapsule({ capsule, capsuleImage, burst, sparks, play, isLive, starOffsets }: RewardContext) {
  const box = capsule.current
  const image = capsuleImage.current
  if (!box || !image) return
  // The glow colour is the capsule's resolved `color` (attendance-path.css), so it follows the tokens.
  const glow = getComputedStyle(box).color
  // Aim the enlarged layer's centre at the flash, independent of its responsive size.
  const path = box.parentElement!
  const travelX = path.clientWidth * 0.666 - box.offsetLeft - box.offsetWidth / 2
  const travelY = path.clientHeight * 0.135 - box.offsetTop - box.offsetHeight / 2
  // Out from behind her into the open sky on her left, tilting as it goes.
  await play(box, [
    { transform: 'translate(0, 0) rotate(0deg)' },
    { transform: `translate(${travelX}px, ${travelY}px) rotate(-10deg)` },
  ], { duration: CAPSULE_MS.out, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' })
  if (!isLive()) return
  // Something inside wants out: it shakes, and light leaks around it.
  await play(image, [
    { transform: 'rotate(0deg) scale(1)', filter: 'brightness(1) drop-shadow(0 0 0 transparent)' },
    { transform: 'rotate(-7deg) scale(1.03)', filter: `brightness(1.1) drop-shadow(0 0 8px ${glow})`, offset: 0.2 },
    { transform: 'rotate(6deg) scale(1.05)', filter: `brightness(1.2) drop-shadow(0 0 12px ${glow})`, offset: 0.4 },
    { transform: 'rotate(-5deg) scale(1.07)', filter: `brightness(1.3) drop-shadow(0 0 16px ${glow})`, offset: 0.6 },
    { transform: 'rotate(4deg) scale(1.09)', filter: `brightness(1.4) drop-shadow(0 0 20px ${glow})`, offset: 0.8 },
    { transform: 'rotate(0deg) scale(1.1)', filter: `brightness(1.5) drop-shadow(0 0 24px ${glow})` },
  ], { duration: CAPSULE_MS.shake, easing: 'ease-in-out', fill: 'forwards' })
  if (!isLive()) return
  // It bursts open: a flash, stars flying out, and the capsule itself dissolving into the light.
  const sequence = await rewardSequence
  if (!isLive()) return
  if (sequence) image.src = sequence
  void play(burst.current, [
    { opacity: 0, transform: 'translate(-50%, -50%) scale(0.3)' },
    { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: 0.3 },
    { opacity: 0, transform: 'translate(-50%, -50%) scale(1.8)' },
  ], { duration: 1300, easing: 'ease-out' })
  for (const [index, star] of Array.from(sparks.current?.children ?? []).entries()) {
    const { x, y } = starOffsets[index]!
    void play(star, [
      { opacity: 0, transform: 'translate(-50%, -50%) scale(0.3) rotate(0deg)' },
      { opacity: 1, transform: `translate(calc(-50% + ${x * 0.4}cqw), calc(-50% + ${y * 0.4}cqw)) scale(1) rotate(40deg)`, offset: 0.25 },
      { opacity: 0, transform: `translate(calc(-50% + ${x}cqw), calc(-50% + ${y + 3}cqw)) scale(0.6) rotate(140deg)` },
    ], { duration: 1100 + (index % 3) * 150, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })
  }
  await play(image, [
    { transform: 'rotate(0deg) scale(1.1)', opacity: 1, filter: 'none' },
    { transform: 'rotate(0deg) scale(1.1)', opacity: 1, offset: 0.85, filter: 'none' },
    { transform: 'rotate(0deg) scale(1.1)', opacity: 0, filter: 'none' },
  ], { duration: sequence ? 1200 : CAPSULE_MS.open, easing: 'ease-out', fill: 'forwards' })
  if (!isLive()) return
  // Gone for the rest of the week: hide it, then drop the held frames so it is whole again next week.
  delete box.dataset.opening
  image.src = capsuleArt
  for (const animation of [...box.getAnimations(), ...image.getAnimations()]) {
    if (!(animation instanceof CSSAnimation)) animation.cancel()
  }
  await wait(350)
}

