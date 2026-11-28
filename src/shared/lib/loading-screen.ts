export type LoadingStage = 'auth' | 'onboarding' | 'page'
/** One per app screen (PageSkeleton.tsx draws each on that screen's own layout). */
export type SkeletonScreen =
  | 'home' | 'my-mates' | 'records' | 'credits' | 'invite' | 'onboarding' | 'mate' | 'connection' | 'connection-record'

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
  if (['/login', '/login/kakao-terms', '/oauth/kakao', '/password/reset', '/reset-password'].includes(path)) return null
  if (state.status === 'loading') {
    if (state.loadingStage === 'auth') return null
    if (state.loadingStage === 'onboarding') return 'onboarding'
  } else {
    if (!state.loggedIn) return null
    if (!state.onboarded) return 'onboarding'
  }
  // /mypage opens the account settings over home. The retired beta addresses (/rooms, /study, /reports, /capsules,
  // /characters) only redirect (BetaLegacyRedirect): the common loading screen, not a screen they never show.
  if (path === '/' || path === '/mypage') return 'home'
  if (path === '/mates/me') return 'my-mates'
  if (path === '/records') return 'records'
  if (path === '/credits') return 'credits'
  if (path === '/credits/invite' || path === '/credits/charge' || path === '/invite') return 'invite'
  if (path === '/onboarding') return 'onboarding'
  if (/^\/mates\/[^/]+$/.test(path)) return 'mate'
  if (/^\/connect\/[^/]+$/.test(path)) return 'connection'
  if (/^\/connections\/[^/]+$/.test(path)) return 'connection-record'
  return null
}
