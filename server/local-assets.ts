import { readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

type Mount = { prefix: string; dir: string; allow: RegExp }

/** Aliving2D mate bundle (chaerin-v3, seojin): model.json, its part PNGs and the engine scripts. Exported for tests. */
export const V2_MATE_ALLOW = /^\/(model\/model\.json|model\/parts\/\d{3}_[\w@-]+\.png|engine\/(engine|player)\.js|engine\/reactions\.default\.json)$/

/** Exported for tests: the avatar mount's allowlist (paths relative to `/__local-assets/avatars`). */
export const AVATAR_ALLOW =
  /^\/(?:(?:chitose_ja|haru_greeter_ja|natori_ko|wanko_ja|epsilon_ja\/epsilon_pro|hiyori_ko\/hiyori_pro)\/runtime\/(?:[A-Za-z0-9_][\w.-]*\/)?[A-Za-z0-9_][\w.-]*\.(?:json|moc3|png)|thumbnails\/[a-z]+\.png)$/

/**
 * Runtime files only. Names are restricted to [\w@.-] segments, so no path can leave the folder.
 * - chaerin: Cubism bundle (legacy)
 * - chaerin-v3 (current 채린), seojin: Aliving2D bundles (model.json + part PNGs) and their engine scripts. The
 *   previous chaerin-v2 mount was removed (2026-11-25 cleanup); its local-assets folder may stay, nothing serves it.
 * - avatars: the six Live2D sample avatars (Cubism). Only each model's `runtime/` folder (json, moc3, png; at most one
 *   sub-folder deep) and the generated thumbnails; never the editor sources (cmo3, can3, psd) next to it. Every segment
 *   starts with a letter, digit or `_`, so `.` and `..` cannot match.
 */
const MOUNTS: readonly Mount[] = [
  {
    prefix: '/__local-assets/chaerin',
    dir: '../local-assets/chaerin/',
    allow: /^\/(model\.model3\.json|files\/\d{3}\.(moc3|png|physics3\.json|cdi3\.json|exp3\.json))$/,
  },
  {
    prefix: '/__local-assets/chaerin-v3',
    dir: '../local-assets/chaerin-v3/',
    allow: V2_MATE_ALLOW,
  },
  {
    // 서진 (second mate): the same Aliving2D bundle layout and rule as chaerin-v3.
    prefix: '/__local-assets/seojin',
    dir: '../local-assets/seojin/',
    allow: V2_MATE_ALLOW,
  },
  {
    prefix: '/__local-assets/avatars',
    dir: '../local-assets/avatars/',
    allow: AVATAR_ALLOW,
  },
]

function contentType(path: string): string {
  if (path.endsWith('.json')) return 'application/json'
  if (path.endsWith('.png')) return 'image/png'
  if (path.endsWith('.js')) return 'text/javascript'
  return 'application/octet-stream'
}

/** Development only. This folder is outside public/ and the production import graph. */
export function localAssetsPlugin(): Plugin {
  return {
    name: 'capsule-local-assets', apply: 'serve',
    configureServer(server) {
      // Longer prefixes first so '/chaerin-v3' is not swallowed by '/chaerin'.
      for (const mount of [...MOUNTS].sort((a, b) => b.prefix.length - a.prefix.length)) {
        const root = new URL(mount.dir, import.meta.url)
        server.middlewares.use(mount.prefix, (req, res, next) => {
          const path = (req.url ?? '').split('?')[0]
          // connect strips the prefix; '/chaerin-v3/...' requests reaching the '/chaerin' mount start with '-v3', not
          // '/'.
          if (!path.startsWith('/')) return next()
          if (!mount.allow.test(path)) { res.statusCode = 404; res.end(); return }
          if (req.method !== 'GET' && req.method !== 'HEAD') return next()
          const file = fileURLToPath(new URL(path.slice(1), root))
          // `no-cache` with a validator, like a CDN: a changed file is seen at once, an unchanged one answers 304 (the
          // avatar picker's idle prefetch then saves the download; live2d/model-prefetch.ts).
          void stat(file).then(async info => {
            const etag = `W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`
            res.setHeader('Content-Type', contentType(path))
            res.setHeader('Cache-Control', 'no-cache')
            res.setHeader('ETag', etag)
            if (req.headers['if-none-match'] === etag) { res.statusCode = 304; res.end(); return }
            res.end(req.method === 'HEAD' ? undefined : await readFile(file))
          }).catch(() => { res.statusCode = 404; res.end() })
        })
      }
    },
  }
}
