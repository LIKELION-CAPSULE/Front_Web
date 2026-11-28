import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { findReviewScenario, reviewPreviewUrl } from './catalog'
import { createReviewTransport, REVIEW_SESSION_ID, REVIEW_USER_ID } from './fixtures'
import { createReviewStorage } from './storage'
import { createReviewImageStage } from './image-stage'
import { rememberReviewIdInWindowName } from '@/shared/lib/review-window-name'

/** Whether local-assets/ holds 채린's model engine (checked by the dev server when it serves this module; nothing loads). */
const hasLocalMateModel = Object.keys(import.meta.glob('/local-assets/chaerin-v3/engine/engine.js')).length > 0

export async function mountReview(root: HTMLElement, id: string | null) {
  if (!id) {
    const { ReviewWorkbench } = await import('./ReviewWorkbench')
    createRoot(root).render(<StrictMode><ReviewWorkbench /></StrictMode>)
    return
  }
  const scenario = findReviewScenario(id)
  if (id !== scenario.id) history.replaceState(null, '', reviewPreviewUrl(scenario, new URLSearchParams(location.search)))
  rememberReviewIdInWindowName(scenario.id)
  document.documentElement.dataset.reviewScenario = scenario.id
  // The login mate is a still (login-mate-source.ts) unless the scenario reviews its motion and the local model exists.
  if (!scenario.liveMate || !hasLocalMateModel) document.documentElement.dataset.reviewStillMates = 'true'
  // The shared component showcase (review only): the product's Dialog and NotificationStack on their own; no app.
  if (scenario.showcase) {
    const { ComponentShowcase } = await import('./ComponentShowcase')
    createRoot(root).render(<StrictMode><ComponentShowcase /></StrictMode>)
    parent.postMessage({ type: 'capsule-review:ready', id: scenario.id }, location.origin)
    return
  }
  const local = createReviewStorage(), session = createReviewStorage()
  Object.defineProperty(window, 'localStorage', { configurable: true, value: local })
  Object.defineProperty(window, 'sessionStorage', { configurable: true, value: session })
  if (scenario.mateHistory) local.setItem(`capsule-beta-cache:v1:${REVIEW_USER_ID}`, JSON.stringify({
    version: 1, userId: REVIEW_USER_ID, records: [], latestRecordId: null,
    // Reuse the workbench's existing reply; no new character dialogue is authored.
    messages: [201, 202].map(characterId => ({ id: `review-confirmed-${characterId}`, sessionId: String(REVIEW_SESSION_ID), characterId: String(characterId), sender: 'character', text: '좋아, 우리 조금만 더 집중해 보자!', voice: false, delivery: 'confirmed' })),
  }))
  session.setItem('capsule-kakao', JSON.stringify({ state: 'review-state', next: scenario.loginNext ?? '/', redirect: `${location.origin}/oauth/kakao` }))
  // The consent screen's entry (kakao-signup.ts): a ticket in this tab's session storage, as the callback leaves it.
  if (scenario.kakaoSignup) session.setItem('capsule-kakao-signup', JSON.stringify({
    signupToken: `local-signup.${Date.now() + 600_000}.review`,
    expiresAt: scenario.kakaoSignup === 'expired' ? Date.now() - 1000 : Date.now() + 600_000,
    next: scenario.loginNext ?? '/',
  }))
  if (scenario.id !== 'report-no-target') local.setItem(`capsule-session:${REVIEW_USER_ID}:${REVIEW_SESSION_ID}`, JSON.stringify({ targetSeconds: 1800, focus: scenario.cameraFocus }))
  const recordsScenarios = new Set(['records', 'records-two-mates', 'records-past-empty'])
  const recordsCamOffIds = new Set([9004, 9007])
  const recordsDurationsSec = [1500, 2100, 3000, 2400, 2700, 3600, 1800, 3000, 4500, 2400, 3300, 3900]
  for (const [index, id] of (scenario.reports ?? []).entries()) {
    const focus = scenario.cameraFocus
    if (recordsScenarios.has(scenario.id)) {
      if (recordsCamOffIds.has(id)) {
        local.setItem(`capsule-session:${REVIEW_USER_ID}:${id}`, JSON.stringify({}))
      } else {
        const studySec = recordsDurationsSec[index] ?? 1500
        const focusedSec = Math.round(studySec * 0.92)
        local.setItem(
          `capsule-session:${REVIEW_USER_ID}:${id}`,
          JSON.stringify({ focus: { observedMs: studySec * 1000, focusedMs: focusedSec * 1000, returns: 1 } }),
        )
      }
      continue
    }
    local.setItem(
      `capsule-session:${REVIEW_USER_ID}:${id}`,
      JSON.stringify({
        focus: focus
          ? { observedMs: focus.observedMs * (index + 1), focusedMs: focus.focusedMs * (index + 1), returns: focus.returns }
          : undefined,
      }),
    )
  }
  if (scenario.session !== 'unknown') local.setItem(`capsule-presence:${REVIEW_USER_ID}:${REVIEW_SESSION_ID}`, JSON.stringify({ studySeconds: 65, presentSeconds: 55, known: true }))
  // 친밀도 상승 바로 보기: the call's 60-second heartbeat (use-session-sync.ts) every 2.5 s in this preview only.
  if (scenario.fastHeartbeat) {
    const setInterval = window.setInterval.bind(window)
    window.setInterval = ((handler: TimerHandler, timeout?: number, ...rest: unknown[]) =>
      setInterval(handler, timeout === 60_000 ? 2_500 : timeout, ...rest)) as typeof window.setInterval
  }
  // Install before importing App: ApiClient captures fetch when its singleton is constructed.
  globalThis.fetch = createReviewTransport(scenario, globalThis.fetch.bind(globalThis))
  if (navigator.mediaDevices) Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
    configurable: true, value: () => Promise.reject(new DOMException('UI review uses no camera or microphone', 'NotAllowedError')),
  })
  // OAuth uses location.assign rather than fetch. Keep it inside the preview as well.
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target.closest('a, button') : null
    if ((target instanceof HTMLAnchorElement && target.origin !== location.origin) || target?.matches('button.kakao-button')) {
      event.preventDefault(); event.stopImmediatePropagation()
      parent.postMessage({ type: 'capsule-review:notice', text: '외부 이동은 미리보기에서 실행하지 않아요. 카카오 상태는 왼쪽 목록에서 선택해 주세요.' }, location.origin)
    }
  }, true)
  const [{ mountApp }, { ReviewSetup }, { ReviewStudyGate }] = await Promise.all([
    import('@/app/bootstrap'), import('./ReviewSetup'), import('./ReviewStudyGate'),
  ])
  const accountPort = scenario.accountContract ? (await import('./account-port')).createReviewAccountPort(scenario) : undefined
  const matePort = scenario.mateContract ? (await import('./mate-port')).createReviewMatePort(scenario) : undefined
  // Call screen / connection record previews only: their credit pre-checks still read the injected wallet
  // (backend-context.ts `wallet`). 내 크레딧 · 친구 초대 · 출석 read the review server (fixtures.ts) instead.
  const featurePort = (() => {
    const expiresAt = Date.now() + (3 * 3600 + 12 * 60 + 40) * 1000
    const port = (wallet: { attendance: number; invitation: number; usedToday: number }) => ({
      read: () => ({
        wallet: { ...wallet, attendanceExpiresAt: expiresAt, entries: [] },
        records: [],
        messages: [],
        affinities: {},
        settings: { voice: false, advanced: false },
      }),
      subscribe: () => () => {},
      setSettings: () => {},
    })
    if (scenario.id === 'connection-record-credit-out') return port({ attendance: 0, invitation: 0, usedToday: 300 })
    // The beta port as these screens were reviewed with (the worlds come from the stage, mate-worlds.ts).
    if (scenario.id === 'my-mates-full' || scenario.id === 'connection-record-levelup') return port({ attendance: 980, invitation: 200, usedToday: 320 })
    return undefined
  })()
  const extra = <ReviewSetup scenario={scenario} />
  mountApp(root, extra, scenario.session && scenario.session !== 'recover' ? <ReviewStudyGate /> : undefined, createReviewImageStage, accountPort, matePort, featurePort)
}
