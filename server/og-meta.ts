/**
 * Link previews (KakaoTalk, Slack, X …): the Open Graph block of index.html, and its invite variant.
 *
 * index.html carries the default block between OG_START and OG_END. An invite link (`/i/<code>`, the `link` of API 35,
 * or `<path>?ref=<code>`) reaches api/router.ts instead of the static file (vercel.json); it fetches the deployed index.html, looks up who invited
 * (API 39, no login) and swaps only that block, so the browser still gets the same SPA.
 * tests/og-meta.test.ts keeps index.html's block equal to `renderOgBlock(DEFAULT_OG)`.
 */
import type { BackendEnv } from './backend-proxy.ts'

export const SITE_ORIGIN = 'https://capsule.ai.kr'
export const OG_START = '<!-- og:start -->'
export const OG_END = '<!-- og:end -->'
const DEFAULT_BACKEND_ORIGIN = 'https://api.capsule.ai.kr'
export const INVITER_LOOKUP_TIMEOUT_MS = 1500
const INDEX_CACHE_MS = 60_000
/** Longest nickname shown in a preview title (the backend's own limit is shorter). */
const NICKNAME_MAX = 20

export interface OgMeta {
  title: string
  description: string
  url: string
  image: string
  imageAlt: string
}

export const DEFAULT_OG: OgMeta = {
  title: 'CAPSULE · 나만의 AI 메이트',
  description: '노트북 앞에서 메이트와 함께하는 시간. 영상통화처럼 곁에 있고, 함께한 시간이 쌓여요.',
  url: `${SITE_ORIGIN}/`,
  image: `${SITE_ORIGIN}/og/og-default.jpg`,
  imageAlt: '노트북 앞에서 졸고 있는 채린과 CAPSULE 로고, 「나만의 메이트가 기다리고 있어요」',
}

export function inviteOg(code: string, nickname: string): OgMeta {
  return {
    title: `${nickname}님이 CAPSULE에 초대했어요`,
    description: '함께 가입하면 둘 다 1,000 크레딧',
    url: `${SITE_ORIGIN}/i/${encodeURIComponent(code)}`,
    image: `${SITE_ORIGIN}/og/og-invite.jpg`,
    imageAlt: '「친구 초대」 배지와 노트북 앞에서 졸고 있는 채린, 「나만의 메이트가 기다리고 있어요」',
  }
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!)
}

/**
 * An invite code as the backend issues it (`CAP-XXXX`): letters, digits and inner hyphens, at most 20 characters
 * (REFERRAL_CODE_MAX_LENGTH). Case is ignored like API 36. Anything else is not looked up.
 */
export function parseInviteCode(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null
  let decoded: string
  try { decoded = decodeURIComponent(raw) } catch { return null }
  const code = decoded.trim().toUpperCase()
  return /^[A-Z0-9](?:[A-Z0-9-]{0,18}[A-Z0-9])?$/.test(code) ? code : null
}

/** `/i/<code>` or `/i/<code>/`; null for any other path. */
export function inviteCodeFromPath(pathname: string): string | null {
  const match = /^\/i\/([^/]+)\/?$/.exec(pathname)
  return match ? parseInviteCode(match[1]) : null
}

/** The invite code of a page request: `/i/<code>`, else `?ref=<code>` on a non-API path. */
export function inviteCodeFromUrl(url: URL): string | null {
  if (url.pathname.startsWith('/i/')) return inviteCodeFromPath(url.pathname)
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return null
  return parseInviteCode(url.searchParams.get('ref'))
}

/** A page (GET / HEAD) that vercel.json sends here because it is an invite link. */
export function isInvitePageRequest(request: Request): boolean {
  if (!['GET', 'HEAD'].includes(request.method)) return false
  const { pathname, searchParams } = new URL(request.url)
  if (pathname.startsWith('/i/')) return true
  return pathname !== '/' && !pathname.startsWith('/api/') && pathname !== '/api' && searchParams.has('ref')
}

/** Display-safe nickname: no control or bidi-override characters, collapsed spaces, clamped. Escaping happens later. */
export function cleanNickname(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  // eslint-disable-next-line no-control-regex
  const text = raw.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '').replace(/\s+/g, ' ').trim()
  if (!text) return null
  const chars = Array.from(text)
  return chars.length > NICKNAME_MAX ? `${chars.slice(0, NICKNAME_MAX).join('')}…` : text
}

export function renderOgBlock(meta: OgMeta): string {
  const e = (value: string) => escapeHtml(value)
  return [
    OG_START,
    `<title>${e(meta.title)}</title>`,
    `<meta name="description" content="${e(meta.description)}" />`,
    '<meta property="og:type" content="website" />',
    '<meta property="og:site_name" content="CAPSULE" />',
    '<meta property="og:locale" content="ko_KR" />',
    `<meta property="og:title" content="${e(meta.title)}" />`,
    `<meta property="og:description" content="${e(meta.description)}" />`,
    `<meta property="og:url" content="${e(meta.url)}" />`,
    `<meta property="og:image" content="${e(meta.image)}" />`,
    '<meta property="og:image:type" content="image/jpeg" />',
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    `<meta property="og:image:alt" content="${e(meta.imageAlt)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${e(meta.title)}" />`,
    `<meta name="twitter:description" content="${e(meta.description)}" />`,
    `<meta name="twitter:image" content="${e(meta.image)}" />`,
    `<meta name="twitter:image:alt" content="${e(meta.imageAlt)}" />`,
    OG_END,
  ].join('\n    ')
}

/** Replaces the marked block; html without the markers is returned unchanged (never a broken page). */
export function injectOg(html: string, meta: OgMeta): string {
  const start = html.indexOf(OG_START)
  const end = html.indexOf(OG_END, start)
  if (start < 0 || end < 0) return html
  return html.slice(0, start) + renderOgBlock(meta) + html.slice(end + OG_END.length)
}

/** API 39 `GET /api/referrals/{code}` → `inviterNickname`, or null on any failure or after the timeout. */
export async function lookupInviter(code: string, env: BackendEnv, timeoutMs = INVITER_LOOKUP_TIMEOUT_MS): Promise<string | null> {
  try {
    const origin = new URL(env.BACKEND_API_ORIGIN || DEFAULT_BACKEND_ORIGIN).origin
    const response = await fetch(`${origin}/api/referrals/${encodeURIComponent(code)}`, {
      headers: { accept: 'application/json' },
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) return null
    const body = await response.json() as { data?: { inviterNickname?: unknown } } | null
    return cleanNickname(body?.data?.inviterNickname)
  } catch {
    return null
  }
}

let indexCache: { origin: string; html: string; at: number } | null = null

/** The deployed index.html of this deployment (a static file, so the request never comes back here). */
async function loadIndexHtml(origin: string, env: InviteEnv): Promise<string | null> {
  const now = Date.now()
  if (indexCache && indexCache.origin === origin && now - indexCache.at < INDEX_CACHE_MS) return indexCache.html
  try {
    const headers = new Headers({ accept: 'text/html' })
    // Preview deployments behind Vercel Authentication: the automation bypass, when the project has one.
    if (env.VERCEL_AUTOMATION_BYPASS_SECRET) headers.set('x-vercel-protection-bypass', env.VERCEL_AUTOMATION_BYPASS_SECRET)
    const response = await fetch(new URL('/index.html', origin), { headers, redirect: 'manual', signal: AbortSignal.timeout(3000) })
    if (!response.ok) return null
    const html = await response.text()
    if (!html.includes(OG_START)) return null
    indexCache = { origin, html, at: now }
    return html
  } catch {
    return null
  }
}

export function resetOgIndexCache() {
  indexCache = null
}

export type InviteEnv = BackendEnv & { VERCEL_AUTOMATION_BYPASS_SECRET?: string }

const HTML_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
}

/**
 * An invite link: the SPA's index.html with invite tags (the SPA then stores the code, src/features/auth/referral-code.ts). The nickname is per code, so the CDN may keep it a few minutes;
 * a fallback (unknown code, backend slow or down) is kept only briefly so a recovered backend shows up soon.
 * If even index.html cannot be read, the visitor goes to `/?ref=<code>` (the SPA stores the code from there).
 */
export async function handleInvitePage(request: Request, env: InviteEnv): Promise<Response> {
  const url = new URL(request.url)
  const code = inviteCodeFromUrl(url)
  const [html, nickname] = await Promise.all([
    loadIndexHtml(url.origin, env),
    code ? lookupInviter(code, env) : Promise.resolve(null),
  ])
  if (!html) {
    const target = code ? `/?ref=${encodeURIComponent(code)}` : '/'
    return new Response(null, { status: 302, headers: { location: target, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } })
  }
  const invited = code && nickname
  const body = injectOg(html, invited ? inviteOg(code, nickname) : DEFAULT_OG)
  return new Response(request.method === 'HEAD' ? null : body, {
    status: 200,
    headers: {
      ...HTML_HEADERS,
      'cache-control': invited
        ? 'public, max-age=0, s-maxage=300, stale-while-revalidate=600'
        : 'public, max-age=0, s-maxage=60',
    },
  })
}
