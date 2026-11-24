/**
 * Single source of truth for v2 mate expression names across the two model formats. Every v2 mate model shares the
 * same eight `expressions[].name` (채린 `chaerin-v2`, 서도현 `seojin`, checked 2026-11-25), so one table serves all.
 * (History: the table started with 채린.)
 * Dependency-free so Node's `--experimental-strip-types` runner can test it directly.
 *
 * - Legacy Cubism model (`chaerin`, `model.model3.json`): expressions are files `files/004..011.exp3.json`
 *   (model names `expression1..8`). The my-mates expression collection, login reaction mapping
 *   (`DEFAULT_EXPRESSION_MAPPING`) and the local dummy tool still speak in these file names.
 * - Aliving2D model (`chaerin-v2`, `model/model.json`): expressions are `expressions[].name` (English) with a Korean
 *   `label`; the player accepts either (`setExpression('happy')` or `setExpression('행복')`).
 *
 * The v2 expressions were ported from the Cubism files one-to-one (same parameter values: eye smile/open, eye ball,
 * brows, mouth form/open and head angle), so every Cubism file has an exact v2 counterpart. Verified against
 * `local-assets/chaerin/files/*.exp3.json` and `local-assets/chaerin-v2/model/model.json` (2026-11-24).
 */

export const V2_EXPRESSIONS = [
  { name: 'sulky', label: '삐짐' },
  { name: 'happy', label: '행복' },
  { name: 'contempt', label: '경멸' },
  { name: 'yawn', label: '하품' },
  { name: 'angry', label: '화남' },
  { name: 'laugh', label: '웃음' },
  { name: 'shy', label: '수줍음' },
  { name: 'focus', label: '집중' },
] as const

export type V2ExpressionName = (typeof V2_EXPRESSIONS)[number]['name']

/** Cubism expression file -> v2 expression name (exact parameter match). */
export const CUBISM_TO_V2_EXPRESSION: Readonly<Record<string, V2ExpressionName>> = {
  'files/004.exp3.json': 'sulky',
  'files/005.exp3.json': 'happy',
  'files/006.exp3.json': 'contempt',
  'files/007.exp3.json': 'yawn',
  'files/008.exp3.json': 'angry',
  'files/009.exp3.json': 'laugh',
  'files/010.exp3.json': 'shy',
  'files/011.exp3.json': 'focus',
}

const V2_NAMES = new Set<string>(V2_EXPRESSIONS.map((item) => item.name))
/** Map lookup, so names like 'constructor' or 'toString' never hit `Object.prototype`. */
const CUBISM_FILES = new Map<string, V2ExpressionName>(Object.entries(CUBISM_TO_V2_EXPRESSION))
const V2_LABELS = new Map<string, V2ExpressionName>(V2_EXPRESSIONS.map((item) => [item.label, item.name]))

function normalizeCubismFile(value: string): string {
  // Accept 'files/009.exp3.json', '/files/009.exp3.json', '.../chaerin/files/009.exp3.json' and query strings.
  const clean = value.split(/[?#]/)[0] ?? value
  const match = /(?:^|\/)files\/(\d{3})\.exp3\.json$/i.exec(clean)
  return match ? `files/${match[1]}.exp3.json` : clean
}

/**
 * Converts any expression reference the app uses into a name the v2 player understands.
 * - `null` / empty -> `null` (neutral face)
 * - Cubism file (`files/009.exp3.json`) -> mapped v2 name (`laugh`)
 * - v2 name (`happy`) or Korean label (`행복`) -> v2 name
 * - anything else, including non-string server values -> `undefined` (unknown: the caller keeps the current face
 *   instead of guessing)
 */
export function toV2ExpressionName(value: unknown): V2ExpressionName | null | undefined {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed || trimmed === 'neutral') return null
  if (V2_NAMES.has(trimmed)) return trimmed as V2ExpressionName
  const byLabel = V2_LABELS.get(trimmed)
  if (byLabel) return byLabel
  return CUBISM_FILES.get(normalizeCubismFile(trimmed))
}
