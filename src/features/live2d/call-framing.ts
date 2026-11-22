import { OFFSET_PERCENT } from './live2d-constants.ts'

export type CallStageLayout = {
  scale: number
  offsetX: number
  offsetY: number
}

/**
 * Unified upper-body call framing used across Login, Mate Detail, and Connection tiles.
 * - Live2D full-body models use `CALL_STAGE_LIVE2D_LAYOUT` with height-based fitting so crown
 *   top margin stays ~8–12% of tile height and the tie knot remains visible in every view.
 * - Review upper-body artwork (`chaerin-hero.webp`) uses `CALL_STAGE_IMAGE_LAYOUT` through the
 *   exact same `computeStagePlacement()` helper so Review and Local Mock match head position.
 */
export const CALL_STAGE_LIVE2D_LAYOUT: CallStageLayout = {
  scale: 1.54,
  offsetX: 0,
  offsetY: 14.5,
}

export const CALL_STAGE_IMAGE_LAYOUT: CallStageLayout = {
  scale: 1.08,
  offsetX: 0,
  offsetY: -1.5,
}

export type StagePlacement = {
  scale: number
  width: number
  height: number
  centerX: number
  centerY: number
  left: number
  top: number
}

export function computeStagePlacement(
  tileWidth: number,
  tileHeight: number,
  contentWidth: number,
  contentHeight: number,
  layout: CallStageLayout,
  mode: 'contain' | 'call-height' = 'contain',
): StagePlacement {
  const fit =
    mode === 'call-height'
      ? (tileHeight / contentHeight) * layout.scale
      : Math.min(tileWidth / contentWidth, tileHeight / contentHeight) * layout.scale
  const width = contentWidth * fit
  const height = contentHeight * fit
  const centerX = tileWidth / 2 + (layout.offsetX / OFFSET_PERCENT) * tileWidth
  const centerY = tileHeight / 2 + (layout.offsetY / OFFSET_PERCENT) * tileHeight
  return {
    scale: fit,
    width,
    height,
    centerX,
    centerY,
    left: centerX - width / 2,
    top: centerY - height / 2,
  }
}
