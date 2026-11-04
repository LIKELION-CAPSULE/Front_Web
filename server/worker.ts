import { handleChatRequest, type ChatEnv } from './openai-chat'
import { proxyBackend, type BackendEnv } from './backend-proxy'

type Env = ChatEnv & BackendEnv & { ASSETS: { fetch: (request: Request) => Promise<Response> } }

// Only /api/* runs here (see run_worker_first in wrangler.jsonc); everything else is served as static assets.
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (pathname.startsWith('/api/backend/')) return proxyBackend(request, env)
    if (pathname === '/api/chat') return handleChatRequest(request, env)
    return env.ASSETS.fetch(request)
  },
}
