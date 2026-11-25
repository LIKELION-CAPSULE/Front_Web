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

/**
 * The viewer's choices, kept apart for the year: week and month share one (the days read the same in both), the year
 * has its own and starts in 2D — twelve month boards read best from above, and a 2.5D choice made for a week should not
 * turn the year into a small forest. v1 stored one value for every period; it becomes the week/month choice.
 */
export const BOARD_VIEW_STORAGE_KEY = 'capsule-records-board-view:v2'
export const BOARD_VIEW_LEGACY_KEY = 'capsule-records-board-view:v1'
export const BOARD_VIEW_NARROW_WIDTH = 960

export type StoredBoardViews = { detail?: BoardView; year?: BoardView }

export function isBoardView(value: unknown): value is BoardView {
  return value === '2d' || value === '25d'
}

/** Which stored choice a period uses. */
export const boardViewSlot = (mode: BoardMode): keyof StoredBoardViews => (mode === 'year' ? 'year' : 'detail')

/** The stored choice for the period, else: year → 2D; week/month → 2D under 960 px and 2.5D above. */
export function defaultBoardView(viewportWidth: number, stored: StoredBoardViews | null | undefined, mode: BoardMode = 'week'): BoardView {
  const choice = stored?.[boardViewSlot(mode)]
  if (isBoardView(choice)) return choice
  if (mode === 'year') return '2d'
  return viewportWidth < BOARD_VIEW_NARROW_WIDTH ? '2d' : '25d'
}

/** Parses stored choices (v2 JSON, or the v1 single value as the week/month choice). */
export function parseStoredBoardViews(v2: string | null, v1: string | null): StoredBoardViews {
  if (v2) {
    try {
      const value = JSON.parse(v2) as Record<string, unknown>
      return {
        ...(isBoardView(value.detail) ? { detail: value.detail } : {}),
        ...(isBoardView(value.year) ? { year: value.year } : {}),
      }
    } catch {
      // Broken entry: start over.
    }
  }
  return isBoardView(v1) ? { detail: v1 } : {}
}

export function readStoredBoardViews(): StoredBoardViews {
  try {
    return parseStoredBoardViews(window.localStorage.getItem(BOARD_VIEW_STORAGE_KEY), window.localStorage.getItem(BOARD_VIEW_LEGACY_KEY))
  } catch {
    return {}
  }
}

export function storeBoardViews(views: StoredBoardViews) {
  try {
    window.localStorage.setItem(BOARD_VIEW_STORAGE_KEY, JSON.stringify(views))
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

/**
 * Period morph length (ms). The stage's height follows it: `--board-ratio` (capsule-board.css) transitions over the
 * same time with the morph's ease-in-out, so the block grows or shrinks with the board instead of jumping.
 */
export const BOARD_MORPH_MS = 850

/** Stage height limits (px), the same as capsule-board.css (`min-height`, `max-height`). */
export const BOARD_STAGE_LIMITS = { min: 200, max: 600, floor: 320, chrome: 380, narrowYearMax: 1100 } as const

/** Tallest the stage may be: under the page header and the block title, so the whole board shows at once. */
export function boardStageCap(viewportHeight: number, mode: BoardMode, narrow: boolean) {
  const { max, floor, chrome, narrowYearMax } = BOARD_STAGE_LIMITS
  if (narrow && mode === 'year') return narrowYearMax
  return Math.min(max, Math.max(floor, viewportHeight - chrome))
}

/**
 * Height / width of the stage as drawn (`--board-ratio`): the board's shape (`boardStageAspect`) within the height
 * limits. The stage's height is linear in it and it already holds the limits, so the transition eases the height the
 * viewer sees from the old one to the new one over the whole morph (not only until a limit is reached).
 */
export function boardStageRatio(
  mode: BoardMode,
  view: BoardView,
  narrow: boolean,
  size?: { width: number; viewportHeight: number },
) {
  const ratio = 1 / boardStageAspect(mode, view, narrow)
  if (!size || size.width <= 0 || size.viewportHeight <= 0) return ratio
  const cap = boardStageCap(size.viewportHeight, mode, narrow)
  const height = Math.max(BOARD_STAGE_LIMITS.min, Math.min(size.width * ratio, cap))
  return height / size.width
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
  // The year's 4 × 3 month boards fit one screen (the stage height is also capped by the viewport, capsule-board.css).
  return view === '2d' ? 1.9 : 2.2
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

/**
 * The view the viewer asked for vs. the view the scene shows. A request that arrives during a period morph waits
 * (the two never run together) and is applied when the morph ends — animated when the morph played out, at once when
 * the morph was cut short (new data, another period, a resize): the asked view is never lost.
 */
export type ViewRequestState = { applied: BoardView; requested: BoardView }
export type ViewApply = { view: BoardView; animate: boolean } | null

export function requestView(
  state: ViewRequestState,
  view: BoardView,
  { morphing, animate }: { morphing: boolean; animate: boolean },
): { state: ViewRequestState; apply: ViewApply } {
  if (morphing && animate) return { state: { ...state, requested: view }, apply: null }
  const apply = view === state.applied ? null : { view, animate }
  return { state: { applied: view, requested: view }, apply }
}

/** A morph is over: `interrupted` when it was cut short. Applies the waiting request, if any. */
export function settleViewRequest(state: ViewRequestState, { interrupted }: { interrupted: boolean }): { state: ViewRequestState; apply: ViewApply } {
  if (state.requested === state.applied) return { state, apply: null }
  return { state: { applied: state.requested, requested: state.requested }, apply: { view: state.requested, animate: !interrupted } }
}

/**
 * Keyboard move between the year's twelve month boards (←→ one, ↑↓ one row, Home/End), never past the last month
 * that has begun (`lastSelectable`). Null when the key does not move.
 */
export function yearMonthNeighbor(index: number, key: string, columns: number, lastSelectable: number): number | null {
  if (lastSelectable < 0) return null
  if (key === 'Home') return 0
  if (key === 'End') return lastSelectable
  const step = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns } as Record<string, number>)[key]
  if (step === undefined) return null
  const target = index + step
  return target < 0 || target > lastSelectable ? index : target
}
