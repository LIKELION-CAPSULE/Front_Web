import { worldLabel, type MateWorld } from './mate-worlds.ts'

/** What the call header needs of a world: 「EP.05 하얀 채린의 방」 (its name; 「EP.05 채린의 방」 by its place without one). */
export type CallWorld = Pick<MateWorld, 'episode' | 'place' | 'placeholder' | 'title'>

/**
 * The world the call is in, for the header chip (2026-11-28). The one place that decides it; null hides the chip.
 *
 * A wrong world is worse than none, so the chip shows only a world the call was started in:
 * - `selected`: the world chosen for this call (「고른 세계관으로 만나기」, not in the backend contract yet). When it
 *   arrives, pass it here and the header follows.
 * - The call's room picture is NOT a world. Every launch mate uses the same bundled picture (artwork.ts
 *   `sharedCallBackground`, 서도현 included, whose world is a study room); its manifest says 「학생 방 또는 공부 공간」,
 *   the code calls it the classroom, and the dev samples put it on 채린's EP.01 교실 only. None of these is a fixed mapping, and
 *   the server's 16 · 17 `background` code is not tied to a world either, so the background alone shows no chip.
 */
export function callWorld({ selected }: { selected?: CallWorld | null } = {}): CallWorld | null {
  if (!selected || selected.placeholder || !selected.place.trim()) return null
  if (!Number.isInteger(selected.episode) || selected.episode < 1) return null
  return selected
}

/** 「EP.05 하얀 채린의 방」 */
export const callWorldLabel = (world: CallWorld) => worldLabel(world, ' ')
