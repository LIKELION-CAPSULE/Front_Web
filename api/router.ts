import { proxyBackend } from '../server/backend-proxy.ts'
import { handleChatRequest } from '../server/openai-chat.ts'

/** Shared Vercel function for /api/*; the platform preserves the original request URL. */
export default {
  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (pathname.startsWith('/api/backend/')) {
      return proxyBackend(request, { BACKEND_API_ORIGIN: process.env.BACKEND_API_ORIGIN })
    }
    if (pathname === '/api/chat') {
      return handleChatRequest(request, { OPENAI_API_KEY: process.env.OPENAI_API_KEY, OPENAI_MODEL: process.env.OPENAI_MODEL })
    }
    return Response.json({ message: '존재하지 않는 API 경로예요.' }, { status: 404, headers: { 'cache-control': 'no-store' } })
  },
}
