import { mateWorldsForStage, worldLabel, type MateWorld, type MateWorldContent } from './mate-worlds.ts'

/** What the call header needs of a world: 「EP.05 하얀 채린의 방」 (its name; 「EP.05 채린의 방」 by its place without one). */
export type CallWorld = Pick<MateWorld, 'episode' | 'place' | 'placeholder' | 'title'>

function shown(world: CallWorld | null | undefined): CallWorld | null {
  if (!world || world.placeholder || !world.place.trim()) return null
  if (!Number.isInteger(world.episode) || world.episode < 1) return null
  return { episode: world.episode, place: world.place, placeholder: false, ...(world.title?.trim() ? { title: world.title } : {}) }
}

/**
 * The world the call is in, for the header chip (2026-11-28 user request: 「채린 같은 반 짝꿍 EP.03 주말 오후의 카페」).
 * The one place that decides it; null hides the chip.
 * - `selected`: the world chosen for this call (「고른 세계관으로 만나기」, not in the backend contract yet) wins.
 * - Otherwise the newest world the mate's current intimacy stage has opened (Lv.N → EP.0N, mate-worlds.ts), with the same
 *   content as 내 메이트 (`content`: the server's, or the local mock's planning examples). The page passes the stage the
 *   titlebar's intimacy chip shows, so a 21 `stageUp` during the call moves the world chip with it.
 * - No content for that world (「준비 중」 placeholder: production until the server sends worlds), no stage, or nothing
 *   opened yet: no chip. The call's room picture is not a world (every launch mate shares it), so it never picks one.
 */
export function callWorld({ selected, stage, content = [] }: {
  selected?: CallWorld | null
  stage?: number | null
  content?: readonly MateWorldContent[]
} = {}): CallWorld | null {
  const chosen = shown(selected)
  if (chosen) return chosen
  if (typeof stage !== 'number' || stage < 1) return null
  const opened = mateWorldsForStage(stage, { content }).filter(world => world.unlocked)
  return shown(opened.at(-1))
}

/** 「EP.05 하얀 채린의 방」 */
export const callWorldLabel = (world: CallWorld) => worldLabel(world, ' ')
