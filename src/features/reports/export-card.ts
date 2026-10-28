import logo from '@/assets/brand/logo.webp'
import { getCharacterArtwork } from '@/features/characters/artwork'
import { getRoomArtwork } from '@/features/rooms/artwork'
import { loadRoomLayers, drawRoomLayers } from '@/features/rooms/draw-artwork'
import { dateLabel, duration, measuredDuration } from '@/shared/lib/format'
import type { StudyRecord } from '@/features/demo/types'
import { withParticle } from '@/shared/lib/korean'
import { capsuleCardCopy, capsuleFocusCopy } from './card-copy'
import { completionArtwork } from './completion-artwork'
import { drawCenterHoverMaterial } from './capsule-card-material'

async function loadImage(src: string) {
  const image = new Image()
  image.src = src
  await image.decode()
  return image
}

export async function exportCard(record: StudyRecord, character: string, color: string, characterId = 'chaerin') {
  await document.fonts.ready
  const art = getCharacterArtwork(characterId)
  const completion = completionArtwork[characterId]
  const roomArt = getRoomArtwork(record.roomId)
  const layers = !completion && (characterId === 'chaerin' || !!art.sceneId) ? await loadRoomLayers(record.roomId) : null
  const [brand, title, portrait] = await Promise.all([
    loadImage(logo),
    loadImage(roomArt.titleImage),
    layers ? null : loadImage(completion?.src ?? art.affection),
  ])
  const canvas = document.createElement('canvas')
  canvas.width = 720
  canvas.height = 1200
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('이미지 저장을 지원하지 않는 브라우저예요.')
  const light = color === '#f5f0ff' || color === '#d8c5ff'
  const foreground = light ? '#21182c' : '#fff'
  ctx.scale(2, 2)
  function rect(x: number, y: number, w: number, h: number, radius: number, fill: string) {
    ctx!.fillStyle = fill
    ctx!.beginPath()
    ctx!.roundRect(x, y, w, h, radius)
    ctx!.fill()
  }
  rect(0, 0, 360, 600, 28, color)
  drawCenterHoverMaterial(ctx, 360, 600, light)
  const brandWidth = 36 * brand.naturalWidth / brand.naturalHeight
  const brandX = 28 + (108 - brandWidth) / 2
  ctx.save()
  ctx.shadowColor = light ? '#6b42a515' : '#0003'
  ctx.shadowOffsetY = 1
  ctx.shadowBlur = 1.5
  ctx.drawImage(brand, brandX, 28, brandWidth, 36)
  ctx.shadowColor = 'transparent'
  if (!light) {
    const wordmark = document.createElement('canvas')
    wordmark.width = brand.naturalWidth
    wordmark.height = brand.naturalHeight
    const mark = wordmark.getContext('2d')
    if (!mark) throw new Error('이미지 저장을 지원하지 않는 브라우저예요.')
    mark.drawImage(brand, 0, 0)
    mark.globalCompositeOperation = 'source-in'
    mark.fillStyle = '#f7f2ff'
    mark.fillRect(0, 0, wordmark.width, wordmark.height)
    ctx.beginPath()
    ctx.rect(28 + 108 * .27, 28, 108 * .73, 36)
    ctx.clip()
    ctx.drawImage(wordmark, brandX, 28, brandWidth, 36)
  }
  ctx.restore()
  ctx.fillStyle = foreground
  ctx.font = '500 12px "Pretendard"'
  ctx.textAlign = 'right'
  ctx.fillText(dateLabel(record.endedAt), 332, 50)
  ctx.textAlign = 'left'
  rect(28, 80, 304, 260, 18, '#251f35')
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(28, 80, 304, 260, 18)
  ctx.clip()
  if (layers) drawRoomLayers(ctx, layers, { x: 28, y: 80, width: 304, height: 260 })
  else if (portrait) {
    const scale = Math.max(304 / portrait.naturalWidth, 260 / portrait.naturalHeight)
    const width = portrait.naturalWidth * scale, height = portrait.naturalHeight * scale
    ctx.drawImage(portrait, 28 + (304 - width) / 2, 80 + (260 - height) * (completion ? 0.1 : 0.35), width, height)
  }
  const shade = ctx.createLinearGradient(28, 80, 28 + 304 * 0.7, 80)
  shade.addColorStop(0, '#14152380')
  shade.addColorStop(1, '#14152300')
  ctx.fillStyle = shade
  ctx.fillRect(28, 80, 304, 260)
  const titleWidth = 152
  ctx.shadowColor = '#00000066'
  ctx.shadowBlur = 8
  ctx.drawImage(title, 40, 92, titleWidth, titleWidth * title.naturalHeight / title.naturalWidth)
  ctx.restore()
  ctx.fillStyle = foreground
  ctx.font = '500 15px "Pretendard"'
  ctx.fillText(`${withParticle(character, '과', '와')} 함께한 공부`, 28, 374, 304)
  ctx.font = '800 52px "Pretendard"'
  ctx.fillText((record.observedSeconds === undefined ? duration : measuredDuration)(record.studySeconds), 28, 440, 304)
  ctx.font = '700 16px "Pretendard"'
  ctx.fillText(capsuleFocusCopy(record), 28, 482, 304)
  ctx.font = '700 12px "Pretendard"'
  rect(28, 500, ctx.measureText(capsuleCardCopy.badge).width + 24, 28, 14, '#17171c')
  ctx.fillStyle = '#fff'
  ctx.fillText(capsuleCardCopy.badge, 40, 519)
  ctx.fillStyle = foreground
  ctx.font = '400 12px "Pretendard"'
  ctx.fillText(capsuleCardCopy.quote, 28, 570)
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
