/**
 * Pure parser for decorative Live2D-style `*.poly.svg` files.
 * Extracts the single `mesh-edges` path and groups vertex circles into 4 horizontal Y-bands
 * rendered as 4 compact dot paths (zero per-vertex DOM nodes) for smooth GPU animation.
 */

export interface ParsedPolyMesh {
  viewBox: string
  width: number
  height: number
  edgesD: string
  /** 4 top-to-bottom Y bands of vertex dot paths (`M x y h 0.01`) + base dot radius. */
  vertBands: readonly string[]
  vertRadius: number
}

const VIEWBOX_RE = /viewBox="([^"]+)"/
const EDGES_RE = /<path[^>]*class="mesh-edges"[^>]*d="([^"]+)"/
const CIRCLE_RE = /<circle\s+cx="([^"]+)"\s+cy="([^"]+)"\s+r="([^"]+)"\s*\/>/g

export function parsePolySvg(raw: string, bandCount = 4): ParsedPolyMesh {
  const vbMatch = VIEWBOX_RE.exec(raw)
  const viewBox = vbMatch?.[1] ?? '0 0 100 100'
  const vbParts = viewBox.split(/\s+/).map(Number)
  const width = vbParts[2] || 100
  const height = vbParts[3] || 100

  const edgesMatch = EDGES_RE.exec(raw)
  const edgesD = edgesMatch?.[1] ?? ''

  const bands: string[][] = Array.from({ length: bandCount }, () => [])
  let vertRadius = 4

  CIRCLE_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = CIRCLE_RE.exec(raw)) !== null) {
    const cx = Number(match[1])
    const cy = Number(match[2])
    const r = Number(match[3])
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue
    if (Number.isFinite(r) && r > 0) vertRadius = r
    const ratio = height > 0 ? Math.max(0, Math.min(0.9999, cy / height)) : 0
    const bandIdx = Math.floor(ratio * bandCount)
    bands[bandIdx]!.push(`M${cx} ${cy}h0.01`)
  }

  return {
    viewBox,
    width,
    height,
    edgesD,
    vertBands: bands.map((pts) => pts.join(' ')),
    vertRadius,
  }
}
