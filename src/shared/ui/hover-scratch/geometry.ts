export type Point = { x: number; y: number }

/** Count alpha rather than pointer distance: retracing a stroke adds no extra area. */
export function erasedFraction(pixels: Uint8ClampedArray) {
  if (pixels.length === 0) return 0
  let remaining = 0
  for (let i = 3; i < pixels.length; i += 4) remaining += pixels[i] ?? 0
  return 1 - remaining / ((pixels.length / 4) * 255)
}

export function farthestCorner(point: Point, width: number, height: number) {
  return Math.hypot(Math.max(point.x, width - point.x), Math.max(point.y, height - point.y))
}
