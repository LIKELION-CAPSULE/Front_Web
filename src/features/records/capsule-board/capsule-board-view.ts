import { CAPSULE_ASPECT } from '../../mates/capsule-jar/capsule-jar-layout.ts'
import type { BoardMode, CapsuleBoardModel } from './capsule-board-layout.ts'
import type { BoardTransition } from './capsule-board-scene.ts'

/**
 * 2D / 2.5D view of the board (user decision 2026-11-25): pure rules, unit-tested.
 *
 * - 2.5D: the columns of capsules seen at an angle. 2D: seen from straight above, the same capsules lie in the tile as
 *   chips — **one chip = 30 minutes**, so the amount reads as a count (like tally marks), each chip keeping its
 *   connection's colour; the date sits at the tile's top-left like a wall calendar.
 * - Default: 2.5D on desktop, 2D under 960 px; the viewer's last choice wins (browser storage).
 */

export type BoardView = '2d' | '25d'

export const BOARD_VIEW_STORAGE_KEY = 'capsule-records-board-view:v1'
export const BOARD_VIEW_NARROW_WIDTH = 960

export function isBoardView(value: unknown): value is BoardView {
  return value === '2d' || value === '25d'
}

/** The stored choice, else 2D under 960 px and 2.5D above. */
export function defaultBoardView(viewportWidth: number, stored: unknown): BoardView {
  if (isBoardView(stored)) return stored
  return viewportWidth < BOARD_VIEW_NARROW_WIDTH ? '2d' : '25d'
}

export function readStoredBoardView(): BoardView | null {
  try {
    const value = window.localStorage.getItem(BOARD_VIEW_STORAGE_KEY)
    return isBoardView(value) ? value : null
  } catch {
    return null
  }
}

export function storeBoardView(view: BoardView) {
  try {
    window.localStorage.setItem(BOARD_VIEW_STORAGE_KEY, view)
  } catch {
    // Private mode / blocked storage: the choice lasts for this page only.
  }
}

/** Stage width (px) under which the board uses its narrow arrangement (year: 2 × 6 month boards). */
export const BOARD_NARROW_STAGE = 560

/** Month board columns of the year view. */
export function yearColumnsFor(stageWidth: number) {
  return stageWidth < BOARD_NARROW_STAGE ? 2 : 4
}

/** Width / height of the stage for a period and view (the board's own shape, so it fills the stage). */
export function boardStageAspect(mode: BoardMode, view: BoardView, narrow: boolean) {
  if (narrow) {
    if (mode === 'week') return view === '2d' ? 2.2 : 1.1
    if (mode === 'month') return view === '2d' ? 1.05 : 0.95
    // Twelve month boards in 2 × 6: a tall stage (the page scrolls) so each month stays readable.
    return view === '2d' ? 0.33 : 0.36
  }
  if (mode === 'week') return view === '2d' ? 3.4 : 2.4
  if (mode === 'month') return view === '2d' ? 1.3 : 2
  return view === '2d' ? 1.75 : 1.9
}

/** Chip area inside a tile (tile units, centre = 0): below the date, which sits at the top-left. */
const CHIP_AREA = { x0: -0.37, x1: 0.37, z0: -0.08, z1: 0.38 } as const

/**
 * Where a column's capsules lie in 2D: reading order (left → right, top → bottom), two to four per row so even a
 * long day fits the tile. `lengths` are the standing lengths (a keepsake is longer and stays a little longer).
 */
export function chipSlots(lengths: readonly number[]): { x: number; z: number; length: number }[] {
  const count = lengths.length
  if (count === 0) return []
  const cols = count <= 2 ? 1 : count <= 8 ? 2 : count <= 12 ? 3 : 4
  const rows = Math.ceil(count / cols)
  const width = CHIP_AREA.x1 - CHIP_AREA.x0
  const depth = CHIP_AREA.z1 - CHIP_AREA.z0
  const pitchX = width / cols
  const pitchZ = Math.min(depth / rows, 0.23)
  // As long as the column allows and as thick as the row allows.
  const base = Math.min(pitchX * 0.9, (pitchZ * 0.88) / CAPSULE_ASPECT)
  const smallest = Math.min(...lengths)
  return lengths.map((length, index) => {
    const col = index % cols
    const row = Math.floor(index / cols)
    return {
      x: CHIP_AREA.x0 + pitchX * (col + 0.5),
      z: CHIP_AREA.z0 + pitchZ * (row + 0.5),
      length: base * Math.min(1.15, length / smallest),
    }
  })
}

/** Whether this browser can draw the board (else the 2D capsule calendar stands in and the toggle hides). */
export function supportsWebGL() {
  try {
    const probe = document.createElement('canvas')
    const context = probe.getContext('webgl2') ?? probe.getContext('webgl')
    context?.getExtension('WEBGL_lose_context')?.loseContext()
    return Boolean(context)
  } catch {
    return false
  }
}

/** The comment's typing progress, forwarded to the scene (also when the scene is created later). */
export type BoardEmphasisControl = { setProgress: (progress: number, finished: boolean) => void }

/**
 * Transition between two consecutive models: a new period around the same days morphs; another mate, period or new
 * records rise; the same days re-laid out (e.g. the narrow arrangement) change at once.
 */
export function boardTransition(previous: CapsuleBoardModel | null, next: CapsuleBoardModel): BoardTransition {
  if (!previous) return 'rise'
  if (previous.rangeKey === next.rangeKey && previous.colorMode === next.colorMode && previous.yearColumns === next.yearColumns) {
    return previous.capsuleCount === next.capsuleCount ? 'none' : 'rise'
  }
  if (previous.rangeKey === next.rangeKey && previous.colorMode === next.colorMode) return 'none'
  if (previous.mode !== next.mode) return 'morph'
  return 'rise'
}
