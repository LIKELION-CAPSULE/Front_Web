import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

/** Development only. This folder is outside public/ and the production import graph. */
export function localAssetsPlugin(): Plugin {
  const root = new URL('../local-assets/chaerin/', import.meta.url)
  return {
    name: 'capsule-local-assets', apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__local-assets/chaerin', (req, res, next) => {
        const path = (req.url ?? '').split('?')[0]
        if (!/^\/(model\.model3\.json|files\/\d{3}\.(moc3|png|physics3\.json|cdi3\.json|exp3\.json))$/.test(path)) { res.statusCode = 404; res.end(); return }
        if (req.method !== 'GET' && req.method !== 'HEAD') return next()
        void readFile(fileURLToPath(new URL(path.slice(1), root))).then(bytes => {
          res.setHeader('Content-Type', path.endsWith('.json') ? 'application/json' : path.endsWith('.png') ? 'image/png' : 'application/octet-stream')
          res.setHeader('Cache-Control', 'no-cache')
          res.end(req.method === 'HEAD' ? undefined : bytes)
        }).catch(() => { res.statusCode = 404; res.end() })
      })
    },
  }
}
