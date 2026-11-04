import { getRoomArtwork } from './artwork'
import { getSceneBackground, getSceneLayout, type SceneVariant } from './composition'
import { classroomClearRegions } from '../mvp/policy'

async function loadImage(src: string) {
  const image = new Image()
  image.src = src
  await image.decode()
  return image
}
/** Same independent layers as RoomArtwork, for PNG keepsake export. */
export async function loadRoomLayers(roomId: string, variant: SceneVariant = 'portrait') {
  const art = getRoomArtwork(roomId)
  const [background, subject] = await Promise.all([
    loadImage(getSceneBackground(art, variant)),
    loadImage(art.subject),
  ])
  return { art, background, subject, variant }
}
export function drawRoomLayers(
  ctx: CanvasRenderingContext2D,
  layers: Awaited<ReturnType<typeof loadRoomLayers>>,
  rect: { x: number; y: number; width: number; height: number },
  variant: SceneVariant = layers.variant,
) {
  const { x, y, width, height } = rect
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, width, height)
  ctx.clip()
  const backdropScale = Math.max(
    width / layers.background.naturalWidth,
    height / layers.background.naturalHeight,
  )
  const bw = layers.background.naturalWidth * backdropScale,
    bh = layers.background.naturalHeight * backdropScale
  ctx.drawImage(layers.background, x + (width - bw) / 2, y + (height - bh) / 2, bw, bh)
  const placement = getSceneLayout(layers.art, rect, variant)
  const foreground = placement.subject
  ctx.drawImage(layers.subject, foreground.x, foreground.y, foreground.width, foreground.height)
  if (layers.art.tone === 'classroom') {
    const [sw, sh] = layers.art.subjectSize
    const mask = document.createElement('canvas')
    const blurred = document.createElement('canvas')
    mask.width = blurred.width = sw
    mask.height = blurred.height = sh
    const maskCtx = mask.getContext('2d')!, blurCtx = blurred.getContext('2d')!
    maskCtx.fillStyle = '#fff'
    maskCtx.fillRect(0, 0, sw, sh)
    maskCtx.globalCompositeOperation = 'destination-out'
    maskCtx.filter = `blur(${sw * 0.012}px)`
    maskCtx.beginPath()
    classroomClearRegions.group.forEach(([px, py], index) => {
      if (index === 0) maskCtx.moveTo(px * sw, py * sh)
      else maskCtx.lineTo(px * sw, py * sh)
    })
    maskCtx.closePath()
    maskCtx.fill()
    blurCtx.filter = `blur(${sw * 0.016}px)`
    blurCtx.drawImage(layers.subject, 0, 0, sw, sh)
    blurCtx.filter = 'none'
    blurCtx.globalCompositeOperation = 'destination-in'
    blurCtx.drawImage(mask, 0, 0)
    ctx.drawImage(blurred, foreground.x, foreground.y, foreground.width, foreground.height)
  }
  ctx.restore()
}
