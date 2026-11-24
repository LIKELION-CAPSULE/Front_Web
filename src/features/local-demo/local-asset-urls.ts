/**
 * Model and engine URLs served by the dev server from `local-assets/` (server/local-assets.ts). Development only:
 * production code reaches these constants only behind `import.meta.env.DEV`, so no `/__local-assets` path ends up
 * in a production bundle (checked by searching the build output).
 */
export const LOCAL_MODEL_URL = '/__local-assets/chaerin/model.model3.json'
export const LOCAL_V2_MODEL_URL = '/__local-assets/chaerin-v2/model/model.json'
export const LOCAL_V2_ENGINE_URL = '/__local-assets/chaerin-v2/engine/engine.js'
export const LOCAL_V2_PLAYER_URL = '/__local-assets/chaerin-v2/engine/player.js'
export const LOCAL_V2_REACTIONS_URL = '/__local-assets/chaerin-v2/engine/reactions.default.json'
