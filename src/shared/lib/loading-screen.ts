export type LoadingStage = 'auth' | 'onboarding' | 'page'
export type SkeletonScreen = 'home' | 'onboarding' | 'room' | 'prepare' | 'study' | 'report' | 'capsule'

/** A screen preview is shown only after the server has resolved the account's destination. */
export function resolveLoadingScreen(destination: string | null, state: {
  status: 'loading' | 'ready' | 'error'
  loadingStage: LoadingStage
  loggedIn: boolean
  onboarded: boolean
}): SkeletonScreen | null {
  if (!destination?.startsWith('/') || destination.startsWith('//') || state.status === 'error') return null
  let url: URL
  try { url = new URL(destination, 'https://capsule.invalid') } catch { return null }
  if (url.origin !== 'https://capsule.invalid') return null
  const path = url.pathname.replace(/\/$/, '') || '/'
  if (['/login', '/oauth/kakao', '/password/reset', '/reset-password'].includes(path)) return null
  if (state.status === 'loading') {
    if (state.loadingStage === 'auth') return null
    if (state.loadingStage === 'onboarding') return 'onboarding'
  } else {
    if (!state.loggedIn) return null
    if (!state.onboarded) return 'onboarding'
  }
  if (path === '/' || path === '/mypage') return 'home'
  if (path === '/onboarding') return 'onboarding'
  if (/^\/rooms\/[^/]+\/prepare$/.test(path)) return 'prepare'
  if (/^\/rooms\/[^/]+$/.test(path)) return 'room'
  if (/^\/study\/[^/]+$/.test(path)) return 'study'
  if (/^\/reports\/[^/]+$/.test(path)) return 'report'
  if (/^\/capsules\/[^/]+$/.test(path)) return 'capsule'
  return null
}
