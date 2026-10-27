import { getRoomArtwork } from './artwork'
import { getSceneBackground, getSceneLayout, hasSceneDesk, type SceneVariant } from './composition'

async function loadImage(src: string) {
  const image = new Image()
  image.src = src
  await image.decode()
  return image
}
/** Same independent layers as RoomArtwork, for PNG keepsake export. */
export async function loadRoomLayers(roomId: string, variant: SceneVariant = 'portrait') {
  const art = getRoomArtwork(roomId)
  const [background, subject, desk] = await Promise.all([
    loadImage(getSceneBackground(art, variant)),
    loadImage(art.subject),
    loadImage(art.desk),
  ])
  return { art, background, subject, desk, variant }
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
  const desk = placement.desk
  if (hasSceneDesk(variant)) ctx.drawImage(layers.desk, desk.x, desk.y, desk.width, desk.height)
  ctx.restore()
}
