import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

type Mount = { prefix: string; dir: string; allow: RegExp }

/** Exported for tests: the avatar mount's allowlist (paths relative to `/__local-assets/avatars`). */
export const AVATAR_ALLOW =
  /^\/(?:(?:chitose_ja|haru_greeter_ja|natori_ko|wanko_ja|epsilon_ja\/epsilon_pro|hiyori_ko\/hiyori_pro)\/runtime\/(?:[A-Za-z0-9_][\w.-]*\/)?[A-Za-z0-9_][\w.-]*\.(?:json|moc3|png)|thumbnails\/[a-z]+\.png)$/

/**
 * Runtime files only. Names are restricted to [\w@.-] segments, so no path can leave the folder.
 * - chaerin: Cubism bundle (legacy)
 * - chaerin-v2: Aliving2D bundle (model.json + part PNGs) and its engine scripts
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
    prefix: '/__local-assets/chaerin-v2',
    dir: '../local-assets/chaerin-v2/',
    allow: /^\/(model\/model\.json|model\/parts\/\d{3}_[\w@-]+\.png|engine\/(engine|player)\.js|engine\/reactions\.default\.json)$/,
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
      // Longer prefixes first so '/chaerin-v2' is not swallowed by '/chaerin'.
      for (const mount of [...MOUNTS].sort((a, b) => b.prefix.length - a.prefix.length)) {
        const root = new URL(mount.dir, import.meta.url)
        server.middlewares.use(mount.prefix, (req, res, next) => {
          const path = (req.url ?? '').split('?')[0]
          // connect strips the prefix; '/chaerin-v2/...' requests reaching the '/chaerin' mount start with '-v2'.
          if (!path.startsWith('/')) return next()
          if (!mount.allow.test(path)) { res.statusCode = 404; res.end(); return }
          if (req.method !== 'GET' && req.method !== 'HEAD') return next()
          void readFile(fileURLToPath(new URL(path.slice(1), root))).then(bytes => {
            res.setHeader('Content-Type', contentType(path))
            res.setHeader('Cache-Control', 'no-cache')
            res.end(req.method === 'HEAD' ? undefined : bytes)
          }).catch(() => { res.statusCode = 404; res.end() })
        })
      }
    },
  }
}
