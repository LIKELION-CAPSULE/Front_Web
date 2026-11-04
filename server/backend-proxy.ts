export type BackendEnv = { BACKEND_API_ORIGIN?: string }
const DEFAULT_ORIGIN = 'https://backendlab-production-3052.up.railway.app'
const PREFIX = '/api/backend'

/** Same-origin gateway: the browser keeps the backend refresh cookie HttpOnly. */
export async function proxyBackend(request: Request, env: BackendEnv): Promise<Response> {
  const source = new URL(request.url)
  const caller = request.headers.get('origin')
  if (!['GET', 'HEAD'].includes(request.method) && caller && caller !== source.origin) {
    return Response.json({ message: '잘못된 요청 출처예요.' }, { status: 403 })
  }
  const path = source.pathname.slice(PREFIX.length)
  if (!source.pathname.startsWith(`${PREFIX}/`) || !path.startsWith('/') || path.startsWith('//')) {
    return Response.json({ message: '잘못된 API 경로예요.' }, { status: 400 })
  }
  const origin = new URL(env.BACKEND_API_ORIGIN || DEFAULT_ORIGIN)
  const target = new URL(origin.origin)
  target.pathname = `/api${path}`
  target.search = source.search
  const headers = new Headers({ accept: 'application/json' })
  for (const name of ['authorization', 'content-type']) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }
  const cookie = request.headers.get('cookie')?.split(';').map(value => value.trim()).find(value => value.startsWith('refresh_token='))
  if (cookie) headers.set('cookie', cookie)
  try {
    const response = await fetch(target, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
      redirect: 'manual',
      signal: AbortSignal.timeout(60_000),
    })
    const output = new Headers({ 'cache-control': 'no-store' })
    const contentType = response.headers.get('content-type')
    if (contentType) output.set('content-type', contentType)
    for (const value of response.headers.getSetCookie()) {
      if (!value.startsWith('refresh_token=')) continue
      const parts = value.split(';').map(part => part.trim())
        .filter((part, index) => index === 0 || !/^(domain|path|samesite|secure|httponly)(=|$)/i.test(part))
      parts.push('Path=/api/backend', 'HttpOnly', 'SameSite=Lax')
      if (source.protocol === 'https:') parts.push('Secure')
      output.append('set-cookie', parts.join('; '))
    }
    return new Response(response.body, { status: response.status, headers: output })
  } catch {
    return Response.json({ message: '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 502 })
  }
}
