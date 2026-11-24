import { toV2ExpressionName, type V2ExpressionName } from '@/features/mate-render/expression-map'
import angry from '@/assets/characters/chaerin-v2/expressions/angry.webp'
import contempt from '@/assets/characters/chaerin-v2/expressions/contempt.webp'
import focus from '@/assets/characters/chaerin-v2/expressions/focus.webp'
import happy from '@/assets/characters/chaerin-v2/expressions/happy.webp'
import laugh from '@/assets/characters/chaerin-v2/expressions/laugh.webp'
import neutral from '@/assets/characters/chaerin-v2/expressions/neutral.webp'
import shy from '@/assets/characters/chaerin-v2/expressions/shy.webp'
import sulky from '@/assets/characters/chaerin-v2/expressions/sulky.webp'
import yawn from '@/assets/characters/chaerin-v2/expressions/yawn.webp'

/**
 * Face thumbnails of each expression, rendered from the real v2 model (see the README in the asset folder and
 * scripts/render-chaerin-expressions.mjs). Only 채린 has them for now; other mates show the label alone.
 */
const CHAERIN: Readonly<Record<V2ExpressionName | 'neutral', string>> = {
  angry,
  contempt,
  focus,
  happy,
  laugh,
  neutral,
  shy,
  sulky,
  yawn,
}

/** Thumbnail for an expression reference (Cubism file, v2 name or Korean label), or undefined. */
export function expressionThumbnail(mateId: string, expression: string | null): string | undefined {
  if (mateId !== 'chaerin') return undefined
  const name = toV2ExpressionName(expression)
  if (name === undefined) return undefined
  return CHAERIN[name ?? 'neutral']
}
