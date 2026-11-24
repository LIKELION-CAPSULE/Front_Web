import { useEffect } from 'react'
import { useBackend } from '@/features/backend/backend-context'
import { useDemo } from '@/features/demo/demo-context'
import { availableMates } from '@/features/mates/catalog'
import { resolvePreviewSource } from '@/features/mate-render/mate-source'
import { canPrewarm } from '@/features/mate-render/warm-renderer'
import { mateWarmPool, prewarmMateEngine } from '@/features/mate-render/warm-pool'

/** Lets the page's own work (entry motion, first data) finish before anything is warmed. */
const PREWARM_DELAY_MS = 1500

/**
 * Warms the first mate's v2 (Aliving2D) model while the browser is idle, so the first mate preview (내 메이트, 메이트
 * 상세) starts drawing at once instead of loading the engine and the model.
 *
 * - `engine` (onboarding): only the engine and player scripts. The avatar preview is using the GPU and the network.
 * - `model` (home and the other app screens): the engine, then the model offscreen in the shared warm pool.
 * Skipped on phones / touch-first devices, with Data Saver and under reduced motion (`canPrewarm`), and when the mate
 * has no v2 model. The mate detail it loads is the same cached request the mate screens make. Logging out drops the
 * warm model.
 */
export function useMatePrewarm(level: 'engine' | 'model') {
  const { home, loadMateDetail } = useBackend()
  const { state } = useDemo()
  const loggedIn = state.profile.loggedIn
  const mateId = availableMates(home)[0]?.id

  useEffect(() => {
    if (!loggedIn) mateWarmPool.discard()
  }, [loggedIn])

  useEffect(() => {
    if (!loggedIn || !mateId || !loadMateDetail || !canPrewarm()) return
    let cancelled = false
    let idle: number | undefined
    const run = () => {
      if (cancelled) return
      void loadMateDetail(mateId).then(detail => {
        if (cancelled || !detail.model) return
        const source = resolvePreviewSource(detail.model, {
          pageOrigin: window.location.origin,
          apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
        })
        if (source.kind !== 'aliving') return
        if (level === 'engine') void prewarmMateEngine(source)
        else mateWarmPool.prewarm(source)
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
  }, [level, loggedIn, mateId, loadMateDetail])
}
