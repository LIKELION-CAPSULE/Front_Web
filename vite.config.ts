import { fileURLToPath, URL } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { handleChatRequest, type ChatEnv } from './server/openai-chat'
import { proxyBackend, type BackendEnv } from './server/backend-proxy'
import { reviewCopyPlugin } from './server/review-copy.ts'

/** Local API gateway. Production uses api/router.ts on Vercel or server/worker.ts on Cloudflare. */
function chatApi(env: ChatEnv & BackendEnv): Plugin {
  async function middleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
    const backend = req.url?.startsWith('/api/backend/')
    if (!backend && req.url?.split('?')[0] !== '/api/chat') return next()
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)
    const response = await (backend ? proxyBackend : handleChatRequest)(
      new Request(new URL(req.url!, `http://${req.headers.host ?? 'localhost'}`), {
        method: req.method,
        headers: Object.fromEntries(Object.entries(req.headers).filter((entry): entry is [string, string] => typeof entry[1] === 'string')),
        body: ['GET', 'HEAD'].includes(req.method ?? 'GET') ? undefined : Buffer.concat(chunks),
      }),
      env,
    )
    res.statusCode = response.status
    response.headers.forEach((value, key) => { if (key !== 'set-cookie') res.setHeader(key, value) })
    const cookies = response.headers.getSetCookie()
    if (cookies.length) res.setHeader('set-cookie', cookies)
    res.end(await response.text())
  }
  return {
    name: 'capsule-chat-api',
    configureServer: (server) => { server.middlewares.use(middleware) },
    configurePreviewServer: (server) => { server.middlewares.use(middleware) },
  }
}

export default defineConfig(({ mode }) => {
  // Empty prefix loads OPENAI_* from .env.local without exposing it to client code (only VITE_* is exposed).
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss(), reviewCopyPlugin(), chatApi({ OPENAI_API_KEY: env.OPENAI_API_KEY, OPENAI_MODEL: env.OPENAI_MODEL, BACKEND_API_ORIGIN: env.BACKEND_API_ORIGIN })],
    server: { port: 3000, strictPort: true, headers: { 'Referrer-Policy': 'no-referrer' } },
    preview: { port: 3000, strictPort: true, headers: { 'Referrer-Policy': 'no-referrer' } },
    worker: { format: 'es' },
    build: {
      // The lazily loaded `live2d` chunk (PixiJS + Live2D engine, ~1.1 MB, study page only) is the only one above 500 kB.
      chunkSizeWarningLimit: 1200,
      rolldownOptions: {
        output: {
          comments: { legal: true },
          // PixiJS loads its renderers through internal dynamic imports; split across chunks, a renderer class can
          // evaluate before its base class. Keeping Pixi and the Live2D engine together (still lazy, study page only)
          // preserves their order.
          // Vite's preload helper is shared by every lazy route, so it must not be pulled into that chunk: the engine
          // module throws when it runs before the Cubism Core script, and the app entry imports the helper eagerly.
          codeSplitting: {
            groups: [
              { name: 'preload-helper', test: /vite[\\/]preload-helper/, priority: 2 },
              {
                name: 'live2d',
                priority: 1,
                test: /[\\/]node_modules[\\/](pixi\.js|@pixi[\\/]|untitled-pixi-live2d-engine|eventemitter3|earcut|tiny-lru|ismobilejs|parse-svg-path|@xmldom[\\/]|gifuct-js|js-binary-schema-parser)/,
              },
            ],
          },
        },
      },
    },
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
  }
})
