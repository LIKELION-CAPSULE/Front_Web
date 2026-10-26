import { getCharacterArtwork } from '@/features/characters/artwork'
import { loadRoomLayers, drawRoomLayers } from '@/features/rooms/draw-artwork'
import { dateLabel, duration } from '@/shared/lib/format'
import type { StudyRecord } from '@/features/demo/types'

export async function exportCard(
  record: StudyRecord,
  room: string,
  character: string,
  color: string,
  characterId = 'chaerin',
) {
  await document.fonts.ready
  const canvas = document.createElement('canvas')
  canvas.width = 720
  canvas.height = 1200
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('이미지 저장을 지원하지 않는 브라우저예요.')
  const useLayers = ['chaerin', 'doyun', 'moru'].includes(characterId)
  const layers = useLayers ? await loadRoomLayers(record.roomId) : null
  const portrait = new Image()
  if (!layers) {
    portrait.src = getCharacterArtwork(characterId).affection
    await portrait.decode()
  }
  const foreground = color === '#f5f0ff' || color === '#d8c5ff' ? '#21182c' : '#fff'
  ctx.scale(2, 2)
  const rect = (
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number | number[],
    fill: string,
  ) => {
    ctx.fillStyle = fill
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, radius)
    ctx.fill()
  }
  rect(0, 0, 360, 600, 28, color)
  rect(28, 72, 304, 260, 20, '#251f35')
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(28, 72, 304, 260, 20)
  ctx.clip()
  if (layers) drawRoomLayers(ctx, layers, { x: 28, y: 72, width: 304, height: 260 })
  else {
    const scale = Math.max(304 / portrait.naturalWidth, 260 / portrait.naturalHeight)
    const width = portrait.naturalWidth * scale
    const height = portrait.naturalHeight * scale
    ctx.drawImage(portrait, 28 + (304 - width) / 2, 72 + (260 - height) * 0.35, width, height)
  }
  ctx.restore()
  ctx.fillStyle = foreground
  ctx.font = '700 14px "JetBrains Mono Variable"'
  ctx.fillText('CAPSULE', 28, 42)
  ctx.font = '700 13px "JetBrains Mono Variable"'
  ctx.textAlign = 'right'
  ctx.fillText(dateLabel(record.endedAt), 332, 42)
  ctx.textAlign = 'left'
  rect(80, 86, 200, 32, 14, '#141923ee')
  ctx.fillStyle = '#fff'
  ctx.font = '500 14px "Pretendard"'
  ctx.textAlign = 'center'
  ctx.fillText('다음엔 더 오래 버텨 봐.', 180, 107)
  ctx.textAlign = 'left'
  ctx.fillStyle = foreground
  ctx.font = '500 15px "Pretendard"'
  ctx.fillText(`${room} · ${character}과`, 28, 370)
  ctx.font = '800 64px "Pretendard"'
  ctx.fillText(duration(record.studySeconds), 28, 440, 304)
  ctx.font = '700 16px "Pretendard"'
  ctx.fillText(`집중 ${duration(record.focusSeconds)} · 복귀 ${record.returns}회`, 28, 482)
  rect(28, 500, 92, 28, 14, '#17171c')
  ctx.fillStyle = '#fff'
  ctx.font = '700 12px "Pretendard"'
  ctx.fillText('연속 5일째', 40, 519)
  ctx.fillStyle = foreground
  ctx.font = '400 12px "Pretendard"'
  ctx.fillText('캡슐에서 같이 공부해요 · CAPSULE', 28, 570)
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('이미지를 저장하지 못했어요.'))),
      'image/png',
    ),
  )
}

export function downloadCard(blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'capsule-study-card.png'
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
