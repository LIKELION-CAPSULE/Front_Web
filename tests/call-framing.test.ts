import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CALL_STAGE_IMAGE_LAYOUT,
  CALL_STAGE_LIVE2D_LAYOUT,
  computeStagePlacement,
} from '../src/features/live2d/call-framing.ts'

// Measured crown vertical ratio inside each asset's intrinsic height (Chaerin Live2D model vs chaerin-hero.webp 760x900).
const LIVE2D_CROWN_RATIO = 0.1458
const HERO_IMAGE_CROWN_RATIO = 0.1554

function crownTopPct(
  tileWidth: number,
  tileHeight: number,
  contentWidth: number,
  contentHeight: number,
  layout: typeof CALL_STAGE_LIVE2D_LAYOUT,
  crownRatio: number,
) {
  const placement = computeStagePlacement(tileWidth, tileHeight, contentWidth, contentHeight, layout, 'call-height')
  const crownY = placement.top + placement.height * crownRatio
  return (crownY / tileHeight) * 100
}

test('computeStagePlacement keeps crown top margin within 8-12% across 1440, 1280, and split call tiles', () => {
  const tiles = [
    { name: '1440 default mate', w: 1034, h: 824 },
    { name: '1280 default mate', w: 901, h: 824 },
    { name: '1440 split mate', w: 510, h: 824 },
    { name: '1280 split mate', w: 443, h: 824 },
  ]

  for (const tile of tiles) {
    const live2dPct = crownTopPct(tile.w, tile.h, 2048, 2048, CALL_STAGE_LIVE2D_LAYOUT, LIVE2D_CROWN_RATIO)
    const reviewPct = crownTopPct(tile.w, tile.h, 760, 900, CALL_STAGE_IMAGE_LAYOUT, HERO_IMAGE_CROWN_RATIO)
    const diffPct = Math.abs(live2dPct - reviewPct)

    assert.ok(live2dPct >= 8 && live2dPct <= 12, `${tile.name}: Live2D crown ${live2dPct.toFixed(2)}% out of 8-12%`)
    assert.ok(reviewPct >= 8 && reviewPct <= 12, `${tile.name}: Review crown ${reviewPct.toFixed(2)}% out of 8-12%`)
    assert.ok(diffPct <= 3, `${tile.name}: Review vs Live2D crown diff ${diffPct.toFixed(2)}% exceeds 3%`)
  }
})
