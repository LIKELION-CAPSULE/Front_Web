/**
 * Paths accessible on mobile phones even when SCR-40 (Mobile Access Notice) is active.
 * Password reset links may be opened from email on a phone.
 */
export const MOBILE_GATE_ALLOWED_PATHS = ['/password/reset', '/reset-password'] as const

function normalizePathname(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed || '/'
}

export function isMobileGateAllowedPath(pathname: string): boolean {
  const clean = normalizePathname(pathname)
  return (MOBILE_GATE_ALLOWED_PATHS as readonly string[]).includes(clean)
}

export interface PhoneDetectionInput {
  coarseNoHover: boolean
  shortSidePx: number
}

/**
 * Detects a mobile phone by pointer capability + short screen dimension, NEVER by viewport width alone.
 * A 640px desktop browser window has fine pointer / hover and shortSide >= 600, so it never triggers.
 */
export function isPhoneDevice(input?: PhoneDetectionInput): boolean {
  if (input) {
    return input.coarseNoHover && input.shortSidePx < 600
  }
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  const coarseNoHover = window.matchMedia('(pointer: coarse) and (hover: none)').matches
  if (!coarseNoHover) return false
  const screenW = window.screen?.width || window.innerWidth
  const screenH = window.screen?.height || window.innerHeight
  const shortSidePx = Math.min(window.innerWidth, window.innerHeight, screenW, screenH)
  return shortSidePx < 600
}

/** Review scenarios of the mobile notice: `mobile-notice` and its states (`mobile-notice-plain`, …). */
export function isMobileNoticeReviewId(id: string | null | undefined): boolean {
  return id === 'mobile-notice' || (typeof id === 'string' && id.startsWith('mobile-notice-'))
}

export function isReviewMobileNoticeForced(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false
  if (isMobileNoticeReviewId(document.documentElement.dataset.reviewScenario)) return true
  if (window.name.startsWith('capsule-ui-review:') && isMobileNoticeReviewId(window.name.slice('capsule-ui-review:'.length))) return true
  try {
    return isMobileNoticeReviewId(new URLSearchParams(window.location.search).get('__review'))
  } catch {
    return false
  }
}
