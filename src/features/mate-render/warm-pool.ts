import { AlivingRenderer } from './AlivingRenderer'
import { createWarmPool } from './warm-renderer.ts'

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
