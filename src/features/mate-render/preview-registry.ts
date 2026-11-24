import type { MateRenderer } from './types'

/**
 * Live mate preview renderers (v2 Aliving2D). The local dummy tool's expression picker drives them the same way it
 * drives the legacy Cubism stages it creates itself. Holds references only while a preview is mounted.
 */
const previewRenderers = new Set<MateRenderer>()

export function registerPreviewRenderer(renderer: MateRenderer): () => void {
  previewRenderers.add(renderer)
  return () => {
    previewRenderers.delete(renderer)
  }
}

export function forEachPreviewRenderer(callback: (renderer: MateRenderer) => void): void {
  for (const renderer of previewRenderers) callback(renderer)
}
