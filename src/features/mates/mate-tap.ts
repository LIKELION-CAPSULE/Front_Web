/**
 * Tapping the mate on the connection screen (and in the PIP window): a short local reaction — a face for a moment, a
 * small nod, and one of her own short lines — with no server call and no credits. Dependency-free (tests/mate-tap.test.ts).
 *
 * - The face goes in at the expression director's lowest priority ('motion', like a gesture): a line or a state change
 *   on screen is never replaced; it returns after `TAP_FACE_MS`.
 * - One reaction per `TAP_COOLDOWN_MS`: taps in between do nothing (they never pile up).
 * - While a chat reply is on its way or typing, a tap does nothing (the reply has the stage).
 */

export const TAP_COOLDOWN_MS = 1500
export const TAP_FACE_MS = 1800

type TapSet = { faces: readonly string[]; lines: readonly string[] }

/** Faces are v2 expression names (mate-render/expression-map.ts); 서도현's follow his unlock mapping (옅은 미소, 멋쩍음). */
const TAP_SETS: Readonly<Record<string, TapSet>> = {
  chaerin: { faces: ['happy', 'laugh', 'shy'], lines: ['히히, 간지러워!', '왜~ 할 말 있어?', '나 여기 있어!', '집중 잘 되고 있어?'] },
  dohyun: { faces: ['laugh', 'shy'], lines: ['…왜.', '할 말 있으면 해.', '건드리지 마. …딱히 싫은 건 아니고.'] },
}
const FALLBACK: TapSet = { faces: ['happy'], lines: ['응?'] }

export type TapReaction = { face: string; line: string }

export class MateTap {
  private lastAt = -Infinity
  private count = 0
  /** A reaction for a tap at `now`, or null (cooling down, or the mate is answering). */
  tap(mateId: string, busy: boolean, now: number = performance.now()): TapReaction | null {
    if (busy || now - this.lastAt < TAP_COOLDOWN_MS) return null
    this.lastAt = now
    const set = TAP_SETS[mateId] ?? FALLBACK
    const index = this.count++
    return { face: set.faces[index % set.faces.length]!, line: set.lines[index % set.lines.length]! }
  }
}

/**
 * Whether a point is on the mate (roughly her face and body): the middle 44% of the tile's width, from 8% down to the
 * bottom. The tile frames her the same way on every size (call framing), so a box in tile fractions is enough.
 */
export function onMate(rect: { left: number; top: number; width: number; height: number }, x: number, y: number) {
  const fx = (x - rect.left) / rect.width
  const fy = (y - rect.top) / rect.height
  return fx >= 0.28 && fx <= 0.72 && fy >= 0.08 && fy <= 1
}
