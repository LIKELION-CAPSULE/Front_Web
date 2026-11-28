/**
 * A recent row's height range (px) and the 1px line between rows. The rows share the room: as many as fit at the
 * smallest height, then each one as tall as the room allows (up to the largest), so no row-sized gap is left empty
 * under the list (2026-11-28: 1440 × ~930 showed one row and ~40px of nothing).
 */
export const RECENT_ROW = { min: 34, max: 48, rule: 1 } as const

/** How many rows fit in a room `height` px tall, and how tall each is (pure; the tests import it). */
export function fitRecentRows(height: number, max: number) {
  const rows = Math.max(1, Math.min(max, Math.floor((height + RECENT_ROW.rule) / (RECENT_ROW.min + RECENT_ROW.rule))))
  const each = Math.floor((height - (rows - 1) * RECENT_ROW.rule) / rows)
  return { rows, height: Math.max(RECENT_ROW.min, Math.min(RECENT_ROW.max, each)) }
}
