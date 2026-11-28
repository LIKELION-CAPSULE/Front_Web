// Keep global CSS first in development; index.html also pins layer order before production CSS chunks.
import '@/styles/index.css'
import { captureReferralFromLocation } from '@/features/auth/referral-code'
import { reviewIdFromWindowName } from '@/shared/lib/review-window-name'

// Capture ?ref=<code> synchronously before React renders so forms auto-fill on direct entry.
captureReferralFromLocation()

const root = document.getElementById('root')

if (!root) throw new Error('CAPSULE root element was not found.')

// Review code and fixtures are excluded from production, including direct review URLs.
if (import.meta.env.DEV) {
  const query = new URLSearchParams(location.search).get('__review')
  // Only inside the workbench's iframe: a top-level tab drops a name left by an earlier review address.
  const named = reviewIdFromWindowName()
  if (location.pathname === '/__review' || query || named) {
    void import('@/features/review/bootstrap').then(module => module.mountReview(root, query || named))
  } else if (import.meta.env.VITE_DATA_SOURCE !== 'api') {
    void import('@/features/local-demo/bootstrap').then(module => module.mountLocalDemo(root))
  } else {
    void Promise.all([import('@/app/bootstrap'), import('@/features/review/ReviewLauncher')])
      .then(([app, review]) => app.mountApp(root, <review.ReviewLauncher />))
  }
} else {
  void import('@/app/bootstrap').then(module => module.mountApp(root))
}
