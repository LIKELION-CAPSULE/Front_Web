import { toV2ExpressionName } from '@/features/mate-render/expression-map'

/**
 * Upper-body stills of each expression in the exact view of the hero still (`chaerin-v2-hero.webp`), rendered from
 * the real v2 model (`scripts/render-chaerin-expressions.mjs --bust`, README in the asset folder). The my-mates panel
 * shows one when the live model is not drawn (reduced motion) and an expression is picked.
 * Each picture is its own file, fetched only when asked for (≈240 kB each), never part of a bundle.
 */
const CHAERIN = import.meta.glob<string>('../../assets/characters/chaerin-v2/expressions-bust/*.webp', {
  query: '?url',
  import: 'default',
})

/** Still of an expression reference (Cubism file, v2 name or Korean label); undefined for the default face. */
export async function expressionBust(mateId: string, expression: string | null): Promise<string | undefined> {
  if (mateId !== 'chaerin') return undefined
  const name = toV2ExpressionName(expression)
  if (!name) return undefined
  const load = CHAERIN[`../../assets/characters/chaerin-v2/expressions-bust/${name}.webp`]
  return load ? load() : undefined
}
