import { mateHeroPortrait } from '@/features/mates/artwork'
import { LOCAL_CHARACTER_ID, LOCAL_LEDGER_TITLES, LOCAL_MATES, LOCAL_USER_ID, LocalBetaStore } from '@/features/local-demo/store'
import { ATTENDANCE_SOURCE_QA_KEY } from '@/features/attendance/attendance-source'
import { businessDay } from '@/shared/lib/format'
import { createLocalTransport } from '@/features/local-demo/transport'
import type { ReviewScenario } from './catalog'

/**
 * UI review transport (dev only, `/__review`): the local mock server (local-demo/transport.ts — the 2026-11-25
 * contract: `/home.mates`, `/connections/*`, `/me/settings`, `/records` …) on an in-memory account seeded per scenario,
 * plus the review's own failures and pending requests on the same current paths. Every request is reported to the
 * workbench (`capsule-review:request`). The old room / session fixtures are gone.
 */
export const REVIEW_USER_ID = LOCAL_USER_ID
/** The connection a `session` scenario starts with. */
export const REVIEW_SESSION_ID = 9001

/** Failures that stay pending until aborted, by the request they hold. */
const PENDING: Partial<Record<NonNullable<ReviewScenario['fault']>, (method: string, path: string) => boolean>> = {
  'bootstrap-pending': (_, path) => path === '/auth/refresh',
  'kakao-pending': (_, path) => path === '/auth/social/KAKAO',
  'kakao-signup-pending': (_, path) => path === '/auth/social/KAKAO/signup',
  'home-pending': (_, path) => path === '/home',
  'avatars-pending': (_, path) => path === '/avatars',
  'report-pending': (method, path) => method === 'GET' && /^\/connections\/\d+$/.test(path),
  'withdraw-pending': (method, path) => method === 'DELETE' && path === '/me',
  'reset-request-pending': (_, path) => path === '/auth/password/reset-request',
  'start-pending': (method, path) => method === 'POST' && path === '/connections',
  'credits-pending': (method, path) => method === 'GET' && path === '/credits',
  'invite-pending': (method, path) => method === 'GET' && path === '/referrals/me',
}

/** 36 refusals the review shows on the code field (the code itself passes 39 first). */
const REFERRAL_FAULTS: Record<string, [string, number]> = {
  'referral-expired': ['REFERRAL_EXPIRED', 400],
  'referral-same-device': ['REFERRAL_SAME_DEVICE', 400],
  'referral-already': ['REFERRAL_ALREADY_ENTERED', 409],
}

/** The credits and invitation scenarios' server data (the local server's account, changed as the scenario needs). */
function seedCredits(store: LocalBetaStore, scenario: ReviewScenario) {
  const wallet = store.data.wallet, invitation = store.data.invitation
  if (scenario.id === 'credits-empty') wallet.entries = []
  if (scenario.id === 'credits-more') {
    // Three server pages (20 + 20 + 5): 「더 보기」 twice.
    const now = Date.now()
    wallet.entries = Array.from({ length: 45 }, (_, index) => {
      const use = index % 3 !== 2
      return { id: `review-more-${index}`, at: now - index * 5_400_000, kind: use ? 'use' as const : 'attendance' as const, change: use ? -20 : 1500,
        description: use ? LOCAL_LEDGER_TITLES.spend('채린', true, false) : LOCAL_LEDGER_TITLES.attendance, balance: 3500 - index * 10 }
    })
  }
  if (scenario.id === 'invite-full') { invitation.invitedCount = 10; invitation.rewardedCredits = 10000; invitation.joinedCount = 0; invitation.canRedeem = false; wallet.invitation = 10000 }
  if (scenario.id === 'invite-empty') { invitation.invitedCount = 0; invitation.rewardedCredits = 0; invitation.joinedCount = 0 }
  if (scenario.id === 'invite-three') { invitation.invitedCount = 3; invitation.rewardedCredits = 3000; wallet.invitation = 3000 }
  if (scenario.id === 'connection-record-credit-out') { wallet.attendance = 0; wallet.invitation = 0; wallet.entries = [] }
  // The home path, server as it is: today's 1,500 already granted; 「received」 already pressed in this browser.
  if (scenario.id === 'home-attendance-done') {
    try { localStorage.setItem(`capsule-attendance-received:${LOCAL_USER_ID}`, businessDay()) } catch { /* In-memory review storage. */ }
  }
}

export function createReviewTransport(scenario: ReviewScenario, original: typeof fetch): typeof fetch {
  // The proposed attendance API (attendance-source.ts), before the store reads the switch.
  if (scenario.fault === 'attendance-api') try { sessionStorage.setItem(ATTENDANCE_SOURCE_QA_KEY, 'attendance-api') } catch { /* In memory. */ }
  const store = new LocalBetaStore(null)
  if (scenario.guest) store.reset('guest')
  else if (scenario.empty) store.reset('empty')
  if (scenario.onboarding) { store.data.authenticated = true; store.data.onboardingRequired = true }
  if (!scenario.guest) store.data.authenticated = true
  // Connection records the scenario opens (`reports`): finished connections with those ids, oldest first.
  // …and the one its address opens (/connections/:id).
  const opened = Number(scenario.path.match(/^\/connections\/(\d+)/)?.[1])
  const recordIds = [...new Set([...(scenario.reports ?? []), ...(Number.isSafeInteger(opened) ? [opened] : [])])]
  for (const [index, id] of recordIds.entries()) {
    if (scenario.session && id === REVIEW_SESSION_ID) continue
    const seconds = 1500 * (index + 1)
    store.data.nextSessionId = id
    const started = store.start(LOCAL_CHARACTER_ID)
    started.startedAt = Date.now() - (index + 1) * 86_400_000 - seconds * 1000
    const camera = scenario.id.includes('nocam') ? 0 : Math.round(seconds * 0.92)
    store.finish({ connectedSeconds: seconds, presentSeconds: camera, cameraOnSeconds: camera, pipSeconds: 0 })
  }
  if (scenario.session) {
    store.data.nextSessionId = REVIEW_SESSION_ID
    store.start(LOCAL_CHARACTER_ID)
  }
  // The local mock's QA switches (local-demo/transport.ts): a full beta (4 · 6 → 403 BETA_FULL), a coming-soon 서도현,
  // the Kakao sign-up step's failures.
  try {
    if (scenario.fault === 'beta-full') sessionStorage.setItem('capsule-local-beta-full', '1')
    if (scenario.fault === 'coming-soon') sessionStorage.setItem('capsule-local-coming-soon', 'dohyun')
    if (scenario.fault === 'notifications-empty') sessionStorage.setItem('capsule-local-notifications', 'empty')
    if (scenario.fault === 'notifications-error') sessionStorage.setItem('capsule-local-notifications', 'error')
    if (scenario.fault === 'kakao-signup-invalid') sessionStorage.setItem('capsule-local-kakao-signup', 'invalid')
    if (scenario.fault === 'kakao-signup-terms') sessionStorage.setItem('capsule-local-kakao-signup', 'terms')
    if (scenario.fault === 'kakao-consent-off') sessionStorage.setItem('capsule-local-kakao-consent', 'off')
    // A slow 32 for checking the chat while older pages load (`?chatDelay=ms` on the preview address).
    const chatDelay = new URLSearchParams(location.search).get('chatDelay')
    if (chatDelay && /^\d+$/.test(chatDelay)) sessionStorage.setItem('capsule-local-chat-delay', chatDelay)
  } catch { /* The review storage is in memory; nothing to do without it. */ }
  // 32's history (`chat-history`): earlier turns with 채린 on a finished connection, more than one page. The lines are the
  // mock's existing ones; no new character dialogue is authored.
  if (scenario.fault === 'chat-history') {
    const mate = LOCAL_MATES.find(value => value.characterId === LOCAL_CHARACTER_ID)!
    const start = Date.now() - 2 * 86_400_000
    for (let turn = 0; turn < 14; turn++) {
      const requestId = `review-history-${turn + 1}`, createdAt = start + turn * 90_000
      store.data.messages.push(
        { id: `local-user-${requestId}`, requestId, sessionId: '9001', characterId: String(LOCAL_CHARACTER_ID), sender: 'user', text: `검토 메시지 ${turn + 1}`, voice: false, delivery: 'confirmed', createdAt },
        { id: `local-reply-${requestId}`, requestId, sessionId: '9001', characterId: String(LOCAL_CHARACTER_ID), sender: 'character', text: mate.reply, voice: false, delivery: 'confirmed', createdAt },
      )
    }
  }
  seedCredits(store, scenario)
  const local = createLocalTransport(store, original, location.origin)
  let syncFailures = scenario.fault === 'sync' ? 1 : 0
  let reportFailures = scenario.fault === 'server-ended-report' ? 1 : 0

  return async (input, options) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href)
    // Allow an explicitly opened Figma export to submit its design; app APIs remain mocked.
    if (url.origin === 'https://mcp.figma.com' && url.pathname.startsWith('/mcp/capture/')) return original(input, options)
    const method = (options?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    if (!url.pathname.startsWith('/api/')) {
      if (method !== 'GET' && method !== 'HEAD') throw new TypeError('Review mode blocks external mutations')
      return original(input, options)
    }
    const path = url.pathname.replace(/^\/api\/backend/, '')
    const log = (status: number) => parent.postMessage({ type: 'capsule-review:request', method, path, status }, location.origin)
    const fail = (status: number, code = 'REVIEW_FAILURE', detail: Record<string, unknown> = {}) => {
      log(status)
      return new Response(JSON.stringify({ success: false, code, message: code, detail }), { status, headers: { 'content-type': 'application/json' } })
    }
    const fault = scenario.fault
    if (fault && PENDING[fault]?.(method, path)) {
      log(0)
      return new Promise<Response>((_resolve, reject) => {
        const signal = options?.signal
        if (signal?.aborted) reject(signal.reason)
        else signal?.addEventListener('abort', () => reject(signal.reason), { once: true })
      })
    }
    const connection = path.match(/^\/connections\/(\d+)(?:\/(.+))?$/)
    const operation = connection ? connection[2] ?? '' : null
    const ended = () => { store.data.active = null; return fail(409, 'CONNECTION_ENDED') }

    // ── The review's failures, on the current paths ──
    if (path === '/auth/email/login' && (fault === 'login' || fault === 'locked')) return fault === 'locked' ? fail(429, 'LOGIN_LOCKED') : fail(401, 'INVALID_CREDENTIALS')
    if (path === '/auth/email/verification' && fault === 'verification-expired') { log(202); return new Response(JSON.stringify({ success: true, data: { expiresInSeconds: 1 } }), { status: 202, headers: { 'content-type': 'application/json' } }) }
    if (path === '/auth/email/verification/confirm' && fault === 'verification') return fail(400, 'INVALID_CODE', { remainingAttempts: 4 })
    if (path === '/auth/logout' && fault === 'logout') return fail(500)
    if (path === '/auth/password/reset-request' && fault === 'reset-request') return fail(500)
    if (path === '/auth/password/reset' && fault === 'reset') return fail(400, 'RESET_TOKEN_INVALID')
    if (path === '/me' && method === 'DELETE' && fault === 'withdraw-conflict') return fail(409, 'CONNECTION_IN_PROGRESS')
    if (path === '/me' && method === 'DELETE' && fault === 'withdraw') return fail(500)
    if (path === '/me' && method === 'PATCH' && fault === 'profile') return fail(500)
    if (path === '/me' && method === 'GET' && fault === 'bootstrap') return fail(500)
    if (path === '/connections' && method === 'POST' && fault === 'start') return fail(500)
    if (operation === 'resume' && fault === 'server-ended-resume') return ended()
    if (operation === 'events' && fault === 'server-ended-event') return ended()
    if (operation === 'events' && syncFailures > 0) { syncFailures--; return fail(500) }
    if ((operation === 'messages' || operation === 'messages/stream') && fault === 'server-ended-message') return ended()
    if ((operation === 'messages' || operation === 'messages/stream') && fault === 'message') return fail(500)
    // 고급 모드 short of credits: 409 CREDIT_INSUFFICIENT for an ADVANCED turn; BASIC goes through.
    if (operation === 'messages/stream' && fault === 'credit-short' && typeof options?.body === 'string' && options.body.includes('"mode":"ADVANCED"')) {
      return fail(409, 'CREDIT_INSUFFICIENT', { credits: { todayRemaining: 10 } })
    }
    // A voice turn short of credits: the server answers in text only (`done.voice` false), never an error.
    if (operation === 'messages/stream' && fault === 'voice-short' && typeof options?.body === 'string') {
      const response = await local(input, { ...options, body: options.body.replace('"tts":true', '"tts":false') })
      log(response.status)
      return response
    }
    if (operation === 'messages/stream' && fault === 'server-ended-stream') {
      store.data.active = null
      log(200)
      return new Response(`event: error\ndata: ${JSON.stringify({ code: 'CONNECTION_ENDED', message: 'CONNECTION_ENDED' })}\n\n`, { headers: { 'content-type': 'text/event-stream' } })
    }
    if (operation === 'heartbeat' && (fault === 'server-ended-heartbeat' || fault === 'server-ended-report')) return ended()
    if (operation === 'heartbeat' && fault === 'stage-up') {
      // 21 with a stage-up (아는 사이 → 친구) on the local heartbeat's answer.
      const response = await local(input, options)
      log(response.status)
      const body = await response.json() as { data?: Record<string, unknown> }
      if (body.data) body.data.stageUp = { stage: 3, stageName: '친구', unlocked: [] }
      return new Response(JSON.stringify(body), { status: response.status, headers: { 'content-type': 'application/json' } })
    }
    if (operation === 'end' && fault === 'server-ended-finish') return ended()
    if (operation === 'end' && fault === 'end') return fail(500)
    if (operation === '' && method === 'GET' && reportFailures > 0) { reportFailures--; return fail(503) }
    if (operation === '' && method === 'GET' && fault === 'report') return fail(500)
    // 내 크레딧 · 친구 초대: the summary, the activity list or the invitation unreadable; a code refused by 36.
    if (path === '/credits' && fault === 'credits-error') return fail(500)
    if (path === '/credits/transactions' && fault === 'credits-activity-error' && url.searchParams.get('filter') !== 'ATTENDANCE') return fail(500)
    if (path === '/referrals/me' && fault === 'invite-error') return fail(500)
    if (path === '/referrals' && method === 'POST' && fault && REFERRAL_FAULTS[fault]) return fail(REFERRAL_FAULTS[fault][1], REFERRAL_FAULTS[fault][0])

    const response = await local(input, options)
    log(response.status)
    // The call stage of the review is a still image (image-stage.ts), not the dev model bundle.
    if (method === 'POST' && path === '/connections' && response.ok || operation === 'resume' && response.ok) {
      const wire = await response.json() as { data: { mate?: { id: number; name: string; profileImageUrl?: string | null }; relation?: { stage?: number; stageName?: string | null } } }
      const mate = wire.data.mate
      // The stage-up preview starts the call at 16 `relation` 2단계 · 아는 사이 (name left out, as 37 sends it), so the
      // titlebar chip reads 「아는 사이」 and moves to 「친구」 with the heartbeat's stageUp.
      if (fault === 'stage-up' && wire.data.relation) wire.data.relation = { stage: 2, stageName: null }
      if (mate) {
        const id = LOCAL_MATES.find(value => value.characterId === mate.id)?.mateId ?? 'chaerin'
        const still = mateHeroPortrait(id)
        wire.data.mate = { id: mate.id, name: mate.name, profileImageUrl: mate.profileImageUrl ?? still,
          ...(fault === 'model-missing' ? {} : { modelJsonUrl: still }), ...(scenario.farewellLine ? { farewellLine: scenario.farewellLine } : {}) } as typeof mate
      }
      return new Response(JSON.stringify(wire), { status: response.status, headers: { 'content-type': 'application/json' } })
    }
    return response
  }
}
