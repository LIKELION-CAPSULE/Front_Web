import { getRoomArtwork } from './artwork'

async function loadImage(src: string) {
  const image = new Image()
  image.src = src
  await image.decode()
  return image
}
/** Same independent layers as RoomArtwork, for PNG keepsake export. */
export async function loadRoomLayers(roomId: string) {
  const art = getRoomArtwork(roomId)
  const [background, subject] = await Promise.all([
    loadImage(art.background),
    loadImage(art.subject),
  ])
  return { background, subject }
}
export function drawRoomLayers(
  ctx: CanvasRenderingContext2D,
  layers: Awaited<ReturnType<typeof loadRoomLayers>>,
  rect: { x: number; y: number; width: number; height: number },
) {
  const { x, y, width, height } = rect
  const backdropScale = Math.max(
    width / layers.background.naturalWidth,
    height / layers.background.naturalHeight,
  )
  const bw = layers.background.naturalWidth * backdropScale,
    bh = layers.background.naturalHeight * backdropScale
  ctx.drawImage(layers.background, x + (width - bw) / 2, y + (height - bh) / 2, bw, bh)
  const foregroundScale = Math.min(
    (width * 0.96) / layers.subject.naturalWidth,
    (height * 0.94) / layers.subject.naturalHeight,
  )
  const fw = layers.subject.naturalWidth * foregroundScale,
    fh = layers.subject.naturalHeight * foregroundScale
  ctx.drawImage(layers.subject, x + (width - fw) / 2, y + height - fh, fw, fh)
}
