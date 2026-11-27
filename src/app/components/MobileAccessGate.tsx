import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { isMobileGateAllowedPath, isPhoneDevice, isReviewMobileNoticeForced } from '@/shared/lib/mobile-gate'

/** SCR-40 (design M2 「스크롤 소개」, src/features/mobile-gate). Its own chunk: PCs never download it. */
const MobileNoticeScreen = lazy(() => import('@/features/mobile-gate/MobileNoticeScreen'))

/** While the screen's chunk loads: the same canvas, so the phone never flashes the app or white. */
function MobileNoticeLoading() {
  return <div aria-hidden="true" style={{ minHeight: '100svh', background: 'var(--color-canvas)' }} />
}

export function MobileAccessGate({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [phone, setPhone] = useState(() => isPhoneDevice())

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(pointer: coarse) and (hover: none)')
    const update = () => setPhone(isPhoneDevice())
    mq.addEventListener('change', update)
    window.addEventListener('resize', update)
    return () => {
      mq.removeEventListener('change', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  const forced = isReviewMobileNoticeForced()
  if (forced || (phone && !isMobileGateAllowedPath(location.pathname))) {
    return (
      <Suspense fallback={<MobileNoticeLoading />}>
        <MobileNoticeScreen />
      </Suspense>
    )
  }

  return <>{children}</>
}
