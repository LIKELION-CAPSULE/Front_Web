import { AlivingRenderer } from './AlivingRenderer'
import { loadScriptOnce } from './script-loader.ts'
import { createWarmPool, type AlivingSource } from './warm-renderer.ts'

/** The page-wide pool (see `createWarmPool`): one warm v2 renderer shared by mate previews. */
export const mateWarmPool = createWarmPool({
  create: (source, pixelScale) => new AlivingRenderer({
    modelUrl: source.modelUrl,
    engineUrl: source.engineUrl,
    playerUrl: source.playerUrl,
    reactionsUrl: source.reactionsUrl,
    pixelScale,
    maxPixelRatio: pixelScale > 1 ? 3 : 2,
  }),
})

/**
 * Loads and runs the engine and player scripts only (no WebGL, no model). They stay for the life of the page and every
 * later renderer reuses them (`loadScriptOnce`). Failures are ignored: the screen that needs them retries.
 */
export function prewarmMateEngine(source: AlivingSource): Promise<void> {
  return loadScriptOnce(source.engineUrl).then(() => loadScriptOnce(source.playerUrl)).catch(() => {})
}
