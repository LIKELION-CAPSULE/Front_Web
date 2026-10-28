export const capsuleFoil = {
  angle: 118,
  scale: 2.6,
  stops: [[0, '#82f5d8'], [.12, '#96c9ff'], [.25, '#d5abff'], [.37, '#ffb7da'], [.5, '#ffe1a2'], [.62, '#9aead3'], [.75, '#9bc7ff'], [.88, '#eab6f7'], [1, '#82f5d8']],
  darkOpacity: .42,
  lightOpacity: .16,
  glitterOpacity: .2,
  glareOpacity: .4,
} as const

export const capsuleFoilGradient = `repeating-linear-gradient(${capsuleFoil.angle}deg, ${capsuleFoil.stops.map(([offset, color]) => `${color} ${offset * 100}%`).join(', ')})`

function createLayer(width: number, height: number, scale: number) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(width * scale)
  canvas.height = Math.ceil(height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('이미지 저장을 지원하지 않는 브라우저예요.')
  ctx.scale(scale, scale)
  return { canvas, ctx }
}

function ellipseGradient(ctx: CanvasRenderingContext2D, width: number, height: number, stops: [number, string][]) {
  // CSS radial-gradient's default farthest-corner ellipse at the card center.
  const rx = width / Math.SQRT2, ry = height / Math.SQRT2
  ctx.translate(width / 2, height / 2)
  ctx.scale(rx, ry)
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
  stops.forEach(([offset, color]) => gradient.addColorStop(offset, color))
  ctx.fillStyle = gradient
  ctx.fillRect(-width / 2 / rx, -height / 2 / ry, width / rx, height / ry)
}

/** Paint the CSS effect group's fixed 50% / 50% hover pose behind the card contents. */
export function drawCenterHoverMaterial(ctx: CanvasRenderingContext2D, width: number, height: number, light: boolean) {
  const scale = ctx.canvas.width / width
  const effect = createLayer(width, height, scale)
  const foilWidth = width * capsuleFoil.scale, foilHeight = height * capsuleFoil.scale
  const radians = capsuleFoil.angle * Math.PI / 180
  const dx = Math.sin(radians), dy = -Math.cos(radians)
  const length = Math.abs(foilWidth * dx) + Math.abs(foilHeight * dy)
  const gradient = effect.ctx.createLinearGradient(width / 2 - dx * length / 2, height / 2 - dy * length / 2, width / 2 + dx * length / 2, height / 2 + dy * length / 2)
  capsuleFoil.stops.forEach(([offset, color]) => gradient.addColorStop(offset, color))
  effect.ctx.fillStyle = gradient
  effect.ctx.globalAlpha = light ? capsuleFoil.lightOpacity : capsuleFoil.darkOpacity
  effect.ctx.globalCompositeOperation = light ? 'multiply' : 'soft-light'
  effect.ctx.fillRect(0, 0, width, height)

  const glitter = createLayer(width, height, scale)
  // CSS background layers are painted back to front, with their centered dot origins.
  const dots = [
    { w: 53, h: 43, x: 13, y: 0, inner: .55, outer: 1, color: '#ffefcb' },
    { w: 37, h: 31, x: 0, y: 9, inner: .8, outer: 1.35, color: '#d4eaff' },
    { w: 17, h: 23, x: 0, y: 0, inner: .65, outer: 1.1, color: '#ffffff' },
  ]
  for (const dot of dots) {
    for (let y = dot.y + dot.h / 2 - dot.h; y < height + dot.outer; y += dot.h) {
      for (let x = dot.x + dot.w / 2 - dot.w; x < width + dot.outer; x += dot.w) {
        const sparkle = glitter.ctx.createRadialGradient(x, y, 0, x, y, dot.outer)
        sparkle.addColorStop(0, dot.color)
        sparkle.addColorStop(dot.inner / dot.outer, dot.color)
        sparkle.addColorStop(1, `${dot.color}00`)
        glitter.ctx.fillStyle = sparkle
        glitter.ctx.fillRect(x - dot.outer, y - dot.outer, dot.outer * 2, dot.outer * 2)
      }
    }
  }
  glitter.ctx.save()
  glitter.ctx.globalCompositeOperation = 'destination-in'
  ellipseGradient(glitter.ctx, width, height, [[0, '#000000'], [.72, '#00000000']])
  glitter.ctx.restore()
  effect.ctx.globalAlpha = capsuleFoil.glitterOpacity
  effect.ctx.globalCompositeOperation = 'screen'
  effect.ctx.drawImage(glitter.canvas, 0, 0, width, height)

  effect.ctx.save()
  effect.ctx.globalAlpha = capsuleFoil.glareOpacity
  effect.ctx.globalCompositeOperation = 'soft-light'
  ellipseGradient(effect.ctx, width, height, [[0, '#ffffff85'], [.28, '#ffffff10'], [.65, '#ffffff00']])
  effect.ctx.restore()

  ctx.save()
  ctx.beginPath()
  ctx.roundRect(0, 0, width, height, 28)
  ctx.clip()
  ctx.drawImage(effect.canvas, 0, 0, width, height)
  ctx.restore()
}
