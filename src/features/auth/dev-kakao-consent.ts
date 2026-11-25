/**
 * Local dev server only (reached from the `import.meta.env.DEV` branch of kakao-consent-mode.ts): the local mock
 * (`body[data-local-demo]`) and the UI review (`html[data-review-scenario]`) answer KAKAO_SIGNUP_REQUIRED like contract a′,
 * so they show the consent path by default. QA: `sessionStorage['capsule-local-kakao-consent'] = 'off'` shows the
 * current production welcome screen (with the notice) instead. Elsewhere (dev against the real API) the flag decides.
 */
export function devKakaoConsentScreen(): boolean | undefined {
  const mock = document.body?.dataset.localDemo === 'true' || Boolean(document.documentElement.dataset.reviewScenario)
  if (!mock) return undefined
  try { if (sessionStorage.getItem('capsule-local-kakao-consent') === 'off') return false } catch { /* Storage blocked. */ }
  return true
}
