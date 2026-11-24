import { toV2ExpressionName } from '@/features/mate-render/expression-map'

/**
 * Upper-body stills of each expression in the exact view of each mate's hero still (`<bundle>-hero.webp`), rendered
 * from the real v2 model (`scripts/render-chaerin-expressions.mjs --bust` for 채린, `scripts/render-mate-stills.mjs`
 * for the others; README in the asset folders). The my-mates panel shows one when the live model is not drawn (reduced
 * motion) and an expression is picked. Each picture is its own file, fetched only when asked for (≈130–240 kB each),
 * never part of a bundle.
 */
const FILES = import.meta.glob<string>('../../assets/characters/{chaerin-v2,seojin}/expressions-bust/*.webp', {
  query: '?url',
  import: 'default',
})
/** Mate id → its model bundle's asset folder. */
const FOLDERS: Readonly<Record<string, string>> = { chaerin: 'chaerin-v2', dohyun: 'seojin' }

/** Still of an expression reference (Cubism file, v2 name or Korean label); undefined for the default face. */
export async function expressionBust(mateId: string, expression: string | null): Promise<string | undefined> {
  const folder = FOLDERS[mateId]
  if (!folder) return undefined
  const name = toV2ExpressionName(expression)
  if (!name) return undefined
  const load = FILES[`../../assets/characters/${folder}/expressions-bust/${name}.webp`]
  return load ? load() : undefined
}
