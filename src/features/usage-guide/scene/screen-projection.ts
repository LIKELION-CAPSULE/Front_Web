export type Point = readonly [number, number]
/** Four corners in order: top left, top right, bottom right, bottom left. */
export type Quad = readonly [Point, Point, Point, Point]

/**
 * The projective transform taking each `from` corner to the matching `to` corner, as the row-major 3×3 matrix
 * [a, b, c, d, e, f, g, h, 1]. A flat rectangle seen in perspective is exactly such a transform.
 */
export function homography(from: Quad, to: Quad) {
  // Eight equations in a..h: x' (g x + h y + 1) = a x + b y + c and the same for y'.
  const rows: number[][] = []
  for (let i = 0; i < 4; i++) {
    const [x, y] = from[i]!
    const [u, v] = to[i]!
    rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u])
    rows.push([0, 0, 0, x, y, 1, -v * x, -v * y, v])
  }
  for (let column = 0; column < 8; column++) {
    let pivot = column
    for (let row = column + 1; row < 8; row++)
      if (Math.abs(rows[row]![column]!) > Math.abs(rows[pivot]![column]!)) pivot = row
    if (Math.abs(rows[pivot]![column]!) < 1e-12) return null
    ;[rows[column], rows[pivot]] = [rows[pivot]!, rows[column]!]
    const lead = rows[column]!
    for (let row = 0; row < 8; row++) {
      if (row === column) continue
      const factor = rows[row]![column]! / lead[column]!
      if (factor) rows[row] = rows[row]!.map((value, k) => value - factor * lead[k]!)
    }
  }
  return [...rows.map((row, i) => row[8]! / row[i]!), 1]
}

/** Applies a homography to a point. */
export function project(matrix: readonly number[], [x, y]: Point): Point {
  const [a, b, c, d, e, f, g, h] = matrix as [number, number, number, number, number, number, number, number]
  const w = g * x + h * y + 1
  return [(a * x + b * y + c) / w, (d * x + e * y + f) / w]
}

/** CSS `matrix3d` for a 2D homography, applied with `transform-origin: 0 0`. */
export function toMatrix3d(matrix: readonly number[]) {
  const [a, b, c, d, e, f, g, h] = matrix as [number, number, number, number, number, number, number, number]
  return `matrix3d(${[a, d, 0, g, b, e, 0, h, 0, 0, 1, 0, c, f, 0, 1].map((value) => +value.toFixed(9)).join(',')})`
}

/** Corners of an axis-aligned rectangle. */
export function rectQuad(left: number, top: number, width: number, height: number): Quad {
  return [
    [left, top],
    [left + width, top],
    [left + width, top + height],
    [left, top + height],
  ]
}
