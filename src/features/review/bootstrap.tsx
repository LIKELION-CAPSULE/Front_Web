import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { findReviewScenario } from './catalog'
import { createReviewTransport, REVIEW_SESSION_ID, REVIEW_USER_ID } from './fixtures'
import { createReviewStorage } from './storage'

export async function mountReview(root: HTMLElement, id: string | null) {
  if (!id) {
    const { ReviewWorkbench } = await import('./ReviewWorkbench')
    createRoot(root).render(<StrictMode><ReviewWorkbench /></StrictMode>)
    return
  }
  const scenario = findReviewScenario(id)
  window.name = `capsule-ui-review:${scenario.id}`
  const local = createReviewStorage(), session = createReviewStorage()
  Object.defineProperty(window, 'localStorage', { configurable: true, value: local })
  Object.defineProperty(window, 'sessionStorage', { configurable: true, value: session })
  session.setItem('capsule-kakao', JSON.stringify({ state: 'review-state', next: scenario.loginNext ?? '/', redirect: `${location.origin}/oauth/kakao` }))
  if (scenario.id !== 'report-no-target') local.setItem(`capsule-session:${REVIEW_USER_ID}:${REVIEW_SESSION_ID}`, JSON.stringify({ targetSeconds: 1800 }))
  if (scenario.session !== 'unknown') local.setItem(`capsule-presence:${REVIEW_USER_ID}:${REVIEW_SESSION_ID}`, JSON.stringify({ studySeconds: 65, presentSeconds: 55, known: true }))
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
  const [{ mountApp }, { ReviewSetup }, { ReviewDraftRoutes }] = await Promise.all([
    import('@/app/bootstrap'), import('./ReviewSetup'), import('./ReviewDraftRoutes'),
  ])
  mountApp(root, <ReviewSetup scenario={scenario} />, scenario.draft ? <ReviewDraftRoutes /> : undefined)
}
