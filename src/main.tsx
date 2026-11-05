// Keep global CSS first in development; index.html also pins layer order before production CSS chunks.
import '@/styles/index.css'

const root = document.getElementById('root')

if (!root) throw new Error('CAPSULE root element was not found.')

// Review code and fixtures are excluded from production, including direct review URLs.
if (import.meta.env.DEV) {
  const query = new URLSearchParams(location.search).get('__review')
  const named = window.name.startsWith('capsule-ui-review:') ? window.name.slice('capsule-ui-review:'.length) : null
  if (location.pathname === '/__review' || query || named) {
    void import('@/features/review/bootstrap').then(module => module.mountReview(root, query || named))
  } else {
    void Promise.all([import('@/app/bootstrap'), import('@/features/review/ReviewLauncher')])
      .then(([app, review]) => app.mountApp(root, <review.ReviewLauncher />))
  }
} else {
  void import('@/app/bootstrap').then(module => module.mountApp(root))
}
