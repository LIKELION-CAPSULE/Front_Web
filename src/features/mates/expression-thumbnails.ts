import { toV2ExpressionName } from '@/features/mate-render/expression-map'

/**
 * Face thumbnails of each expression, rendered from each mate's real v2 model (192×192, the same face crop for every
 * mate: scripts/render-chaerin-expressions.mjs for 채린, scripts/render-mate-stills.mjs for the others). Small files,
 * bundled eagerly. A mate without thumbnails shows the label alone.
 */
const FILES = import.meta.glob<string>('../../assets/characters/{chaerin-v2,seojin}/expressions/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
})
/** Mate id → its model bundle's asset folder. */
const FOLDERS: Readonly<Record<string, string>> = { chaerin: 'chaerin-v2', dohyun: 'seojin' }

/** Thumbnail for an expression reference (Cubism file, v2 name or Korean label), or undefined. */
export function expressionThumbnail(mateId: string, expression: string | null): string | undefined {
  const folder = FOLDERS[mateId]
  if (!folder) return undefined
  const name = toV2ExpressionName(expression)
  if (name === undefined) return undefined
  return FILES[`../../assets/characters/${folder}/expressions/${name ?? 'neutral'}.webp`]
}
