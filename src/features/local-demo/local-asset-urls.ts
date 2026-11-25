/**
 * Model and engine URLs served by the dev server from `local-assets/` (server/local-assets.ts). Development only:
 * production code reaches these constants only behind `import.meta.env.DEV`, so no `/__local-assets` path ends up
 * in a production bundle (checked by searching the build output).
 */
export const LOCAL_MODEL_URL = '/__local-assets/chaerin/model.model3.json'
/**
 * 채린's v2-format (Aliving2D) bundle. Since 2026-11-25 the local one is `chaerin-v3` (new top and neck art; same
 * parts, expressions, outfits, motions and engine as `chaerin-v2`). The `V2` in the names is the model format.
 */
export const LOCAL_V2_MODEL_URL = '/__local-assets/chaerin-v3/model/model.json'
export const LOCAL_V2_ENGINE_URL = '/__local-assets/chaerin-v3/engine/engine.js'
export const LOCAL_V2_PLAYER_URL = '/__local-assets/chaerin-v3/engine/player.js'
export const LOCAL_V2_REACTIONS_URL = '/__local-assets/chaerin-v3/engine/reactions.default.json'

/** 서도현's v2 bundle (model folder `seojin`; the engine files are byte-identical to chaerin-v2/v3's). */
export const LOCAL_DOHYUN_V2_MODEL_URL = '/__local-assets/seojin/model/model.json'
export const LOCAL_DOHYUN_V2_ENGINE_URL = '/__local-assets/seojin/engine/engine.js'
export const LOCAL_DOHYUN_V2_PLAYER_URL = '/__local-assets/seojin/engine/player.js'
export const LOCAL_DOHYUN_V2_REACTIONS_URL = '/__local-assets/seojin/engine/reactions.default.json'

/** The v2 model fields (docs/MATE_MODEL_V2_CONTRACT.md) of each local mate, by catalog id. */
export const LOCAL_V2_MODELS = {
  chaerin: { format: 'aliving2d', modelJsonUrl: LOCAL_V2_MODEL_URL, engineUrl: LOCAL_V2_ENGINE_URL, playerUrl: LOCAL_V2_PLAYER_URL, reactionsUrl: LOCAL_V2_REACTIONS_URL },
  dohyun: { format: 'aliving2d', modelJsonUrl: LOCAL_DOHYUN_V2_MODEL_URL, engineUrl: LOCAL_DOHYUN_V2_ENGINE_URL, playerUrl: LOCAL_DOHYUN_V2_PLAYER_URL, reactionsUrl: LOCAL_DOHYUN_V2_REACTIONS_URL },
} as const
