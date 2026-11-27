import { proxyBackend } from '../server/backend-proxy.ts'
import { handleChatRequest } from '../server/openai-chat.ts'
import { handleInvitePage, isInvitePageRequest } from '../server/og-meta.ts'

/** Shared Vercel function for /api/* and invite links (/i/*, ?ref=); the platform preserves the original request URL. */
export default {
  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (pathname.startsWith('/api/backend/')) {
      return proxyBackend(request, { BACKEND_API_ORIGIN: process.env.BACKEND_API_ORIGIN })
    }
    if (pathname === '/api/chat') {
      return handleChatRequest(request, { OPENAI_API_KEY: process.env.OPENAI_API_KEY, OPENAI_MODEL: process.env.OPENAI_MODEL })
    }
    // Invite links (API 35 `link` `/i/<code>`, and `<path>?ref=<code>`; vercel.json): the SPA's index.html with
    // link-preview tags for that invite. `/?ref=` itself never gets here: the static index.html answers first.
    if (isInvitePageRequest(request)) {
      return handleInvitePage(request, {
        BACKEND_API_ORIGIN: process.env.BACKEND_API_ORIGIN,
        VERCEL_AUTOMATION_BYPASS_SECRET: process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
      })
    }
    return Response.json({ message: '존재하지 않는 API 경로예요.' }, { status: 404, headers: { 'cache-control': 'no-store' } })
  },
}
