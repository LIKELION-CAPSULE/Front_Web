import { CAPSULE_HORIZONTAL_VIEWBOX, CAPSULE_HORIZONTAL_WORDMARK_START, capsuleLogo } from '@/shared/design/brand-logo'
import { getCharacterArtwork } from '@/features/characters/artwork'
import { getRoomArtwork, type RoomArtwork } from '@/features/rooms/artwork'
import { loadRoomLayers, drawRoomLayers } from '@/features/rooms/draw-artwork'
import { dateLabel, duration, measuredDuration } from '@/shared/lib/format'
import type { StudyRecord } from '@/features/demo/types'
import { withParticle } from '@/shared/lib/korean'
import { capsuleCardCopy, capsuleFocusCopy } from './card-copy'
import { getCompletionArtwork } from './completion-artwork'
import { drawCenterHoverMaterial } from './capsule-card-material'
import { capsuleCardLayout as layout, isLightCapsule } from './capsule-card-layout'
import { designColors, designTypography } from '@/shared/design/tokens'
import { loadStoryFont } from '@/shared/design/story-font'
import { canvasMeasure, fitCardQuote } from './card-quote'

async function loadImage(src: string) {
  const image = new Image()
  image.src = src
  await image.decode()
  return image
}

/** Card output is drawn at 2× (720×1200 canvas for a 360×600 card). */
const EXPORT_SCALE = 2
/** The logo sits in a 108×36 box (same as `.capsule-card-brand`), fitted like `object-fit: contain`. */
const BRAND_BOX = { x: 28, y: 28, width: 108, height: 36 } as const

/**
 * The logo SVGs only have a viewBox. Give the root an explicit pixel size (the output size) before decoding, so every
 * browser rasterizes the vector at full resolution instead of a default 300×150 / blurry upscale, and Firefox can draw it.
 */
async function loadSvgImage(src: string, width: number, height: number) {
  const markup = await (await fetch(src)).text()
  const sized = markup.replace(/<svg\b/, `<svg width="${Math.round(width)}" height="${Math.round(height)}"`)
  const url = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml' }))
  try {
    return await loadImage(url)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function exportCard(record: StudyRecord, character: string, color: string, characterId = 'chaerin', roomArt: RoomArtwork = getRoomArtwork(record.roomId)) {
  const [, storyFont] = await Promise.all([document.fonts.load('400 16px Pretendard'), loadStoryFont()])
  await document.fonts.ready
  const art = getCharacterArtwork(characterId)
  const completion = getCompletionArtwork(characterId, character)
  const layers = !completion && (characterId === 'chaerin' || !!art.sceneId) ? await loadRoomLayers(record.roomId) : null
  const brandRatio = CAPSULE_HORIZONTAL_VIEWBOX.width / CAPSULE_HORIZONTAL_VIEWBOX.height
  const brandWidth = Math.min(BRAND_BOX.width, BRAND_BOX.height * brandRatio)
  const brandHeight = brandWidth / brandRatio
  const brandX = BRAND_BOX.x + (BRAND_BOX.width - brandWidth) / 2
  const brandY = BRAND_BOX.y + (BRAND_BOX.height - brandHeight) / 2
  const light = isLightCapsule(color)
  const [brand, brandInk, title, portrait] = await Promise.all([
    loadSvgImage(capsuleLogo.horizontal.color, brandWidth * EXPORT_SCALE, brandHeight * EXPORT_SCALE),
    // Dark cards: the wordmark is drawn in white (on-solid) over the color lockup, as in the on-screen card.
    light ? null : loadSvgImage(capsuleLogo.horizontal.white, brandWidth * EXPORT_SCALE, brandHeight * EXPORT_SCALE),
    loadImage(roomArt.titleImage),
    layers ? null : loadImage(completion?.src ?? art.affection),
  ])
  const canvas = document.createElement('canvas')
  canvas.width = 360 * EXPORT_SCALE
  canvas.height = 600 * EXPORT_SCALE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('이미지 저장을 지원하지 않는 브라우저예요.')
  const foreground = light ? designColors.canvas : designColors['on-solid']
  ctx.scale(EXPORT_SCALE, EXPORT_SCALE)
  function rect(x: number, y: number, w: number, h: number, radius: number, fill: string) {
    ctx!.fillStyle = fill
    ctx!.beginPath()
    ctx!.roundRect(x, y, w, h, radius)
    ctx!.fill()
  }
  rect(0, 0, 360, 600, 28, color)
  drawCenterHoverMaterial(ctx, 360, 600, light)
  ctx.save()
  ctx.shadowColor = light ? '#6b42a515' : '#0003'
  ctx.shadowOffsetY = 1
  ctx.shadowBlur = 1.5
  ctx.drawImage(brand, brandX, brandY, brandWidth, brandHeight)
  ctx.shadowColor = 'transparent'
  if (brandInk) {
    const wordmarkX = brandX + brandWidth * CAPSULE_HORIZONTAL_WORDMARK_START
    ctx.beginPath()
    ctx.rect(wordmarkX, BRAND_BOX.y, brandX + brandWidth - wordmarkX, BRAND_BOX.height)
    ctx.clip()
    ctx.drawImage(brandInk, brandX, brandY, brandWidth, brandHeight)
  }
  ctx.restore()
  ctx.fillStyle = foreground
  ctx.font = '400 12px "Pretendard"'
  ctx.textAlign = 'right'
  ctx.fillText(dateLabel(record.endedAt), 332, 50)
  ctx.textAlign = 'left'
  const portraitHeight = layout.portrait.height
  rect(28, 80, 304, portraitHeight, 18, designColors.panel)
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(28, 80, 304, portraitHeight, 18)
  ctx.clip()
  if (layers) drawRoomLayers(ctx, layers, { x: 28, y: 80, width: 304, height: portraitHeight })
  else if (portrait) {
    const framing = completion?.cardFraming
    const scale = Math.max(304 / portrait.naturalWidth, portraitHeight / portrait.naturalHeight) * (framing?.scale ?? 1)
    const width = portrait.naturalWidth * scale, height = portrait.naturalHeight * scale
    ctx.drawImage(portrait, 28 + (304 - width) * (framing?.x ?? .5), 80 + (portraitHeight - height) * (framing?.y ?? (completion ? .1 : .35)), width, height)
  }
  const shade = ctx.createLinearGradient(28, 80, 28 + 304 * 0.7, 80)
  shade.addColorStop(0, '#14152380')
  shade.addColorStop(1, '#14152300')
  ctx.fillStyle = shade
  ctx.fillRect(28, 80, 304, portraitHeight)
  const titleWidth = layout.roomTitle.width
  ctx.shadowColor = '#00000066'
  ctx.shadowBlur = 8
  ctx.drawImage(title, layout.padding + layout.roomTitle.inset, layout.portrait.top + layout.roomTitle.inset, titleWidth, titleWidth * title.naturalHeight / title.naturalWidth)
  ctx.restore()
  function textLine(text: string, y: number, role: 'body' | 'stat' | 'body-compact' | 'caption', family = 'Pretendard', fill: string = foreground) {
    const type = designTypography[role]
    ctx!.font = `${type.fontWeight} ${type.fontSizePx}px "${family}"`
    ctx!.fillStyle = fill
    const metrics = ctx!.measureText(text)
    const ascent = metrics.fontBoundingBoxAscent ?? type.fontSizePx * .8
    const descent = metrics.fontBoundingBoxDescent ?? type.fontSizePx * .2
    ctx!.fillText(text, layout.padding, y + (type.lineHeightPx - ascent - descent) / 2 + ascent, layout.contentWidth)
  }
  textLine(`${withParticle(character, '과', '와')} 함께한 공부`, layout.intro.top, 'body')
  textLine((record.observedSeconds === undefined ? duration : measuredDuration)(record.studySeconds), layout.study.top, 'stat')
  textLine(capsuleFocusCopy(record), layout.focus.top, 'body-compact')
  ctx.font = '400 12px "Pretendard"'
  rect(28, layout.badge.top, ctx.measureText(capsuleCardCopy.badge).width + 20, 26, 13, designColors.canvas)
  ctx.save()
  ctx.translate(10, 4)
  textLine(capsuleCardCopy.badge, layout.badge.top, 'caption', 'Pretendard', designColors.ink)
  ctx.restore()
  const quote = fitCardQuote(record.serverReport?.closingLine ?? capsuleCardCopy.quote, canvasMeasure(ctx, storyFont))
  ctx.font = `${layout.quote.fontWeight} ${quote.fontSize}px "${storyFont}"`
  ctx.fillStyle = foreground
  quote.lines.forEach((text, index) => {
    const metrics = ctx.measureText(text)
    const ascent = metrics.fontBoundingBoxAscent ?? quote.fontSize * .8
    const descent = metrics.fontBoundingBoxDescent ?? quote.fontSize * .2
    ctx.fillText(text, layout.padding, quote.top + index * quote.lineHeight + (quote.lineHeight - ascent - descent) / 2 + ascent, layout.contentWidth)
  })
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('이미지를 저장하지 못했어요.')), 'image/png'))
}

export function downloadCard(blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'capsule-study-card.png'
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
