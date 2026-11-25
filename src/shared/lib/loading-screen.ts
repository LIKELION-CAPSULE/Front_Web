export type LoadingStage = 'auth' | 'onboarding' | 'page'
export type SkeletonScreen = 'home' | 'onboarding' | 'mate' | 'connection' | 'connection-record'

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
  if (path === '/' || path === '/mypage' || path === '/mates/me' || path.startsWith('/characters')) return 'home'
  if (path === '/onboarding') return 'onboarding'
  if (/^\/rooms\/[^/]+\/prepare$/.test(path)) return 'mate'
  if (/^\/rooms\/[^/]+$/.test(path)) return 'mate'
  if (/^\/study\/[^/]+$/.test(path)) return 'connection'
  if (/^\/reports\/[^/]+$/.test(path)) return 'connection-record'
  if (/^\/capsules\/[^/]+$/.test(path)) return 'connection-record'
  if (/^\/mates\/[^/]+$/.test(path)) return 'mate'
  if (/^\/connect\/[^/]+$/.test(path)) return 'connection'
  if (/^\/connections\/[^/]+$/.test(path)) return 'connection-record'
  return null
}
