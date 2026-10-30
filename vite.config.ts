import { fileURLToPath, URL } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { handleChatRequest, type ChatEnv } from './server/openai-chat'

/** Serves /api/chat during `vite dev` and `vite preview`; production uses server/worker.ts. */
function chatApi(env: ChatEnv): Plugin {
  async function middleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
    if (req.url?.split('?')[0] !== '/api/chat') return next()
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)
    const response = await handleChatRequest(
      new Request(new URL(req.url, 'http://localhost'), {
        method: req.method,
        headers: { 'content-type': req.headers['content-type'] ?? 'application/json' },
        body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
      }),
      env,
    )
    res.statusCode = response.status
    response.headers.forEach((value, key) => res.setHeader(key, value))
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
    plugins: [react(), tailwindcss(), chatApi({ OPENAI_API_KEY: env.OPENAI_API_KEY, OPENAI_MODEL: env.OPENAI_MODEL })],
    worker: { format: 'es' },
    build: {
      rolldownOptions: {
        output: { comments: { legal: true } },
      },
    },
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
  }
})
