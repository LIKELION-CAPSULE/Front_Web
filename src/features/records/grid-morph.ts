import type { GridMode } from './contribution-grid.ts'

/**
 * Motion of the 2D contribution grid between periods (user request 2026-11-26: bring back the board's morph). Pure,
 * unit-tested; ContributionGrid.tsx runs it with the Web Animations API.
 *
 * - Another period around the same days (week ↔ month ↔ year): a FLIP morph keyed by date — each day present before
 *   and after moves from its old box to its new one, new days fade in, days that leave fade out where they were, and
 *   the grid's height follows. Same length and curve as the 2.5D board's morph (`BOARD_MORPH_MS`, ease-in-out cubic).
 * - The same period moved (‹ ›): a short sideways slide in the direction of time.
 * - Anything else (another mate, new records): no motion.
 * - Reduced motion: never (the caller checks).
 */

/** Same as capsule-board-view.ts `BOARD_MORPH_MS` and its cubic ease-in-out. */
export const GRID_MORPH_MS = 850
export const GRID_MORPH_EASING = 'cubic-bezier(0.65, 0, 0.35, 1)'
export const GRID_SLIDE_MS = 240
export const GRID_SLIDE_PX = 28

export type GridSnapshot = { mode: GridMode; firstKey: string; lastKey: string }
export type GridMotion = 'none' | 'morph' | 'slide-next' | 'slide-previous'

export function gridMotion(previous: GridSnapshot | null, next: GridSnapshot): GridMotion {
  if (!previous || !previous.firstKey || !next.firstKey) return 'none'
  if (previous.mode !== next.mode) return 'morph'
  if (previous.firstKey === next.firstKey && previous.lastKey === next.lastKey) return 'none'
  return next.firstKey > previous.firstKey ? 'slide-next' : 'slide-previous'
}

export type Box = { x: number; y: number; w: number; h: number }

/** The inverted transform that puts a cell now at `next` back at `previous` (origin: the top-left corner). */
export function flipTransform(previous: Box, next: Box): string {
  const dx = previous.x - next.x
  const dy = previous.y - next.y
  const sx = next.w > 0 ? previous.w / next.w : 1
  const sy = next.h > 0 ? previous.h / next.h : 1
  const round = (value: number) => Math.round(value * 1000) / 1000
  return `translate(${round(dx)}px, ${round(dy)}px) scale(${round(sx)}, ${round(sy)})`
}

/** Corner radius a cell had in a period (ghosts of leaving days keep their old shape). */
export const GRID_CELL_RADIUS: Readonly<Record<GridMode, number>> = { year: 3, month: 10, week: 14 }
