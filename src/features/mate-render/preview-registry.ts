import type { MateRenderer } from './types'

/** Anything that shows a v2 face: preview renderers and the connection screen's v2 session stage. */
export type PreviewExpressionTarget = Pick<MateRenderer, 'setExpression'>

/**
 * Live v2 (Aliving2D) models on screen: mate previews and the connection screen's session stage. The local dummy
 * tool's expression picker drives them the same way it drives the legacy Cubism stages it creates itself.
 * Holds references only while a model is mounted.
 */
const previewRenderers = new Set<PreviewExpressionTarget>()

export function registerPreviewRenderer(renderer: PreviewExpressionTarget): () => void {
  previewRenderers.add(renderer)
  return () => {
    previewRenderers.delete(renderer)
  }
}

export function forEachPreviewRenderer(callback: (renderer: PreviewExpressionTarget) => void): void {
  for (const renderer of previewRenderers) callback(renderer)
}
