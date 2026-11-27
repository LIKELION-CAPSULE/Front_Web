import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import router from '../api/router.ts'
import {
  DEFAULT_OG,
  OG_END,
  OG_START,
  cleanNickname,
  escapeHtml,
  handleInvitePage,
  injectOg,
  inviteCodeFromPath,
  inviteCodeFromUrl,
  isInvitePageRequest,
  lookupInviter,
  parseInviteCode,
  renderOgBlock,
  resetOgIndexCache,
} from '../server/og-meta.ts'

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const meta = (html: string, key: string) => {
  const match = new RegExp(`<meta (?:property|name)="${key.replace(':', '\\:')}" content="([^"]*)"`).exec(html)
  return match?.[1]
}

/** Fake network: the deployed index.html and API 39. */
function fakeFetch(t: test.TestContext, backend: (url: string, init: RequestInit) => Response | Promise<Response>, index: () => Response = () => new Response(indexHtml)) {
  resetOgIndexCache()
  return t.mock.method(globalThis, 'fetch', async (input: URL | string, init: RequestInit = {}) => {
    const url = String(input)
    if (url.endsWith('/index.html')) return index()
    return backend(url, init)
  })
}

test('index.html carries exactly the default block (one source of truth for the tags)', () => {
  const start = indexHtml.indexOf(OG_START)
  const end = indexHtml.indexOf(OG_END)
  assert.ok(start > 0 && end > start)
  assert.equal(indexHtml.slice(start, end + OG_END.length), renderOgBlock(DEFAULT_OG))
  assert.equal(indexHtml.match(/<title>/g)?.length, 1)
  assert.equal(meta(indexHtml, 'og:image'), 'https://capsule.ai.kr/og/og-default.jpg')
  assert.equal(meta(indexHtml, 'twitter:card'), 'summary_large_image')
  assert.doesNotMatch(indexHtml, /함께 공부하기|공부하며/)
})

test('escapeHtml neutralises markup and attribute breakouts', () => {
  assert.equal(escapeHtml(`"><script>alert('x')</script>&`), '&quot;&gt;&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;&amp;')
  const html = injectOg(indexHtml, { ...DEFAULT_OG, title: '"><img src=x onerror=alert(1)>님이 CAPSULE에 초대했어요' })
  assert.doesNotMatch(html, /<img src=x/)
  assert.match(html, /<title>&quot;&gt;&lt;img src=x onerror=alert\(1\)&gt;님이/)
})

test('parseInviteCode accepts issued codes only', () => {
  assert.equal(parseInviteCode('cap-7k2q'), 'CAP-7K2Q')
  assert.equal(parseInviteCode('FRIEND1000'), 'FRIEND1000')
  assert.equal(parseInviteCode('A'), 'A')
  for (const bad of ['', '-CAP', 'CAP-', 'CAP 7K', 'CAP/7K', '<script>', 'CAP%2F7K', '%E0%A4%A', 'A'.repeat(21), null, undefined]) {
    assert.equal(parseInviteCode(bad), null, String(bad))
  }
  assert.equal(inviteCodeFromPath('/i/cap-7k2q'), 'CAP-7K2Q')
  assert.equal(inviteCodeFromPath('/i/CAP-7K2Q/'), 'CAP-7K2Q')
  assert.equal(inviteCodeFromPath('/i/CAP-7K2Q/extra'), null)
  assert.equal(inviteCodeFromPath('/invite'), null)
})

test('cleanNickname strips control and bidi characters and clamps', () => {
  assert.equal(cleanNickname('  민수 \n '), '민수')
  assert.equal(cleanNickname('a‮b\u0000c'), 'abc')
  assert.equal(cleanNickname('가'.repeat(25)), `${'가'.repeat(20)}…`)
  assert.equal(cleanNickname(''), null)
  assert.equal(cleanNickname(42), null)
})

test('invite link gets the inviter tags from API 39 (no auth, encoded code) and a short CDN cache', async t => {
  let lookup: { url: string; headers: Headers } | null = null
  fakeFetch(t, (url, init) => {
    lookup = { url, headers: new Headers(init.headers) }
    return Response.json({ success: true, data: { inviterNickname: '민수<b>', rewardOnFirstConnection: 1000 } })
  })
  const response = await handleInvitePage(new Request('https://capsule.ai.kr/i/cap-7k2q'), { BACKEND_API_ORIGIN: 'https://backend.example' })
  const html = await response.text()
  assert.equal(response.status, 200)
  assert.equal(lookup!.url, 'https://backend.example/api/referrals/CAP-7K2Q')
  assert.equal(lookup!.headers.has('authorization'), false)
  assert.equal(meta(html, 'og:title'), '민수&lt;b&gt;님이 CAPSULE에 초대했어요')
  assert.equal(meta(html, 'og:description'), '함께 가입하면 둘 다 1,000 크레딧')
  assert.equal(meta(html, 'og:url'), 'https://capsule.ai.kr/i/CAP-7K2Q')
  assert.equal(meta(html, 'og:image'), 'https://capsule.ai.kr/og/og-invite.jpg')
  assert.match(html, /<div id="root"><\/div>/)
  assert.match(response.headers.get('content-type')!, /text\/html/)
  assert.match(response.headers.get('cache-control')!, /s-maxage=300/)
})

test('unknown code, backend error, timeout and bad JSON all fall back to the default tags', async t => {
  const cases: Array<[string, (url: string, init: RequestInit) => Response | Promise<Response>]> = [
    ['404', () => Response.json({ code: 'REFERRAL_CODE_NOT_FOUND' }, { status: 404 })],
    ['500', () => new Response('oops', { status: 500 })],
    ['network', () => { throw new Error('down') }],
    ['bad json', () => new Response('<html>', { status: 200 })],
    ['empty nickname', () => Response.json({ success: true, data: { inviterNickname: '  ' } })],
    ['timeout', (_url, init) => new Promise((_, reject) => init.signal!.addEventListener('abort', () => reject(init.signal!.reason)))],
  ]
  for (const [name, backend] of cases) {
    await t.test(name, async st => {
      fakeFetch(st, backend)
      const started = Date.now()
      const response = await handleInvitePage(new Request('https://capsule.ai.kr/i/CAP-7K2Q'), {})
      const html = await response.text()
      assert.equal(response.status, 200)
      assert.equal(meta(html, 'og:title'), DEFAULT_OG.title)
      assert.equal(meta(html, 'og:image'), DEFAULT_OG.image)
      assert.match(response.headers.get('cache-control')!, /s-maxage=60\b/)
      assert.ok(Date.now() - started < 2500)
    })
  }
})

test('lookupInviter gives up after its timeout', async t => {
  fakeFetch(t, (_url, init) => new Promise((_, reject) => init.signal!.addEventListener('abort', () => reject(init.signal!.reason))))
  const started = Date.now()
  assert.equal(await lookupInviter('CAP-7K2Q', {}, 50), null)
  assert.ok(Date.now() - started < 1000)
})

test('invalid code is never sent to the backend', async t => {
  const fetch = fakeFetch(t, () => { throw new Error('must not be called') })
  const response = await handleInvitePage(new Request('https://capsule.ai.kr/i/%3Cscript%3E'), {})
  assert.equal(meta(await response.text(), 'og:title'), DEFAULT_OG.title)
  assert.equal(fetch.mock.calls.filter(call => !String(call.arguments[0]).endsWith('/index.html')).length, 0)
})

test('without index.html the visitor still reaches the SPA with the code', async t => {
  fakeFetch(t, () => Response.json({ data: { inviterNickname: '민수' } }), () => new Response('nope', { status: 401 }))
  const response = await handleInvitePage(new Request('https://capsule.ai.kr/i/cap-7k2q'), {})
  assert.equal(response.status, 302)
  assert.equal(response.headers.get('location'), '/?ref=CAP-7K2Q')
  assert.equal(response.headers.get('cache-control'), 'no-store')
})

test('router sends /i/<code> to the invite page and keeps /api/* as before', async t => {
  fakeFetch(t, url => url.includes('/api/referrals/')
    ? Response.json({ data: { inviterNickname: '민수' } })
    : Response.json({ success: true, data: { terms: [] } }))
  const invite = await router.fetch(new Request('https://capsule.ai.kr/i/CAP-7K2Q?code=CAP-7K2Q'))
  assert.equal(meta(await invite.text(), 'og:title'), '민수님이 CAPSULE에 초대했어요')
  const head = await router.fetch(new Request('https://capsule.ai.kr/i/CAP-7K2Q', { method: 'HEAD' }))
  assert.equal(head.status, 200)
  assert.equal(await head.text(), '')
  const proxied = await router.fetch(new Request('https://capsule.ai.kr/api/backend/terms'))
  assert.deepEqual(await proxied.json(), { success: true, data: { terms: [] } })
  const post = await router.fetch(new Request('https://capsule.ai.kr/i/CAP-7K2Q', { method: 'POST' }))
  assert.equal(post.status, 404)
})

test('?ref=<code> on a page path is an invite link too; /?ref= is answered by the static file', async t => {
  const page = (path: string, method = 'GET') => isInvitePageRequest(new Request(`https://capsule.ai.kr${path}`, { method }))
  assert.equal(page('/invite?ref=CAP-7K2Q'), true)
  assert.equal(page('/login?mode=signup&ref=cap-7k2q'), true)
  assert.equal(page('/i/CAP-7K2Q'), true)
  assert.equal(page('/i/CAP-7K2Q', 'HEAD'), true)
  assert.equal(page('/?ref=CAP-7K2Q'), false)
  assert.equal(page('/invite'), false)
  assert.equal(page('/api/backend/terms?ref=CAP-7K2Q'), false)
  assert.equal(page('/invite?ref=CAP-7K2Q', 'POST'), false)
  assert.equal(inviteCodeFromUrl(new URL('https://capsule.ai.kr/invite?ref=cap-7k2q')), 'CAP-7K2Q')
  assert.equal(inviteCodeFromUrl(new URL('https://capsule.ai.kr/invite?ref=%3Cb%3E')), null)

  fakeFetch(t, () => Response.json({ data: { inviterNickname: '민수' } }))
  const response = await router.fetch(new Request('https://capsule.ai.kr/invite?ref=cap-7k2q'))
  const html = await response.text()
  assert.equal(meta(html, 'og:title'), '민수님이 CAPSULE에 초대했어요')
  assert.equal(meta(html, 'og:url'), 'https://capsule.ai.kr/i/CAP-7K2Q')
})

test('vercel.json routes only invite links to the function, before the SPA fallback', () => {
  type Rule = { source: string; destination: string; has?: { type: string; key: string }[] }
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as { rewrites: Rule[] }
  assert.deepEqual(config.rewrites.map(rule => rule.source), ['/api/(.*)', '/i/:code', '/((?!api(?:/|$)).+)', '/((?!api(?:/|$)).*)'])
  assert.equal(config.rewrites[1]!.destination, '/api/router')
  assert.equal(config.rewrites[2]!.destination, '/api/router')
  assert.deepEqual(config.rewrites[2]!.has, [{ type: 'query', key: 'ref' }])
  assert.equal(config.rewrites[3]!.destination, '/index.html')
})
