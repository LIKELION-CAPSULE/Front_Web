import { useEffect } from 'react'
import { useBackend } from '@/features/backend/backend-context'
import { useDemo } from '@/features/demo/demo-context'
import { availableMates } from '@/features/mates/catalog'
import { resolvePreviewSource } from '@/features/mate-render/mate-source'
import { canPrewarm } from '@/features/mate-render/warm-renderer'
import { mateWarmPool } from '@/features/mate-render/warm-pool'
import { engineAllowlist } from '@/features/mate-render/engine-allowlist'

/** Lets the page's own work (entry motion, first data) finish before anything is warmed. */
const PREWARM_DELAY_MS = 1500

/**
 * Warms the first mate's v2 (Aliving2D) model while the browser is idle on the app screens (home and the others under
 * AppLayout), so the first mate preview (내 메이트, 메이트 상세) starts drawing at once. When the login screen's
 * wake-up renderer was handed over (DozeMateStage → warm pool) the pool already holds it and nothing loads.
 *
 * Skipped on phones / touch-first devices, with Data Saver and under reduced motion (`canPrewarm`), checked again right
 * before the idle run and right before loading (either may change meanwhile), and when the mate has no v2 model. The
 * mate detail it loads is the same cached request the mate screens make. Onboarding does not prewarm: the home data
 * (and so the mate) is not loaded there yet. Logging out drops the warm model (RequireDemo → `invalidate`).
 */
export function useMatePrewarm() {
  const { home, loadMateDetail } = useBackend()
  const { state } = useDemo()
  const loggedIn = state.profile.loggedIn
  const mateId = availableMates(home)[0]?.id

  useEffect(() => {
    if (!loggedIn || !mateId || !loadMateDetail || !canPrewarm()) return
    let cancelled = false
    let idle: number | undefined
    const run = () => {
      if (cancelled || !canPrewarm()) return
      void loadMateDetail(mateId).then(detail => {
        if (cancelled || !detail.model || !canPrewarm()) return
        const source = resolvePreviewSource(detail.model, engineAllowlist())
        if (source.kind === 'aliving') mateWarmPool.prewarm(source)
      }).catch(() => { /* The mate screens load it themselves. */ })
    }
    const timer = window.setTimeout(() => {
      if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(run, { timeout: 4000 })
      else run()
    }, PREWARM_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
      if (idle !== undefined) window.cancelIdleCallback?.(idle)
    }
  }, [loggedIn, mateId, loadMateDetail])
}
