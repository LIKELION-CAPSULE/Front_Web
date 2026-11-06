import { useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react'
import { capturePreparePaper } from '../prepare-paper-snapshot'
import type { PrepareCapsulePhase, PrepareCapsuleScene } from '../prepare-capsule-scene'
import { QuarterRingSpinner } from '@/shared/ui/QuarterRingSpinner'
import { capsuleInscription, type CapsuleInscription, type PrepareCapsuleInput } from '../prepare-capsule-personalization'
import { travelToStudy } from '../prepare-capsule-journey'
import { loadPreparePoster } from '../prepare-poster'

export type PrepareDepartureHandle = { play: (plan: PrepareCapsuleInput) => Promise<void>; depart: (navigate: () => void) => Promise<void>; reset: () => void }
type SceneModule = typeof import('../prepare-capsule-scene')
type DepartureView = { active: boolean; phase: PrepareCapsulePhase | 'preparing' | 'waiting' | 'leaving'; renderer?: 'webgl' | 'fallback'; inscription?: CapsuleInscription }

export function PrepareDeparture({ ref, beforePlay }: {
  ref?: Ref<PrepareDepartureHandle>
  beforePlay: () => void
}) {
  const root = useRef<HTMLDivElement>(null)
  const canvasHost = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<DepartureView>({ active: false, phase: 'preparing' })
  const summaryId = useId()
  const sceneModule = useRef<Promise<SceneModule | null> | null>(null)
  const active = useRef<{ cancel: () => void; finished: Promise<void>; depart: (navigate: () => void) => Promise<void> } | null>(null)
  const warm = useCallback(() => sceneModule.current ??= import('../prepare-capsule-scene').catch(() => null), [])
  const cancel = useCallback(() => {
    active.current?.cancel()
    active.current = null
    const dialog = root.current?.closest('dialog')
    const folder = dialog?.querySelector<HTMLElement>('.prepare-folder-stage')
    if (folder) { folder.removeAttribute('data-departing'); folder.inert = false }
    dialog?.removeAttribute('aria-busy')
  }, [])
  const reset = useCallback(() => {
    cancel()
    setView(current => ({ ...current, active: false }))
  }, [cancel])
  useEffect(() => {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) void warm()
    return cancel
  }, [cancel, warm])
  useLayoutEffect(() => {
    if (!view.active) return
    const dialog = root.current?.closest('dialog')
    const folder = dialog?.querySelector<HTMLElement>('.prepare-folder-stage')
    if (folder) folder.inert = true
    root.current?.focus({ preventScroll: true })
  }, [view.active])

  useImperativeHandle(ref, () => ({ reset, depart(navigate) {
    if (active.current) return active.current.depart(navigate)
    navigate(); return Promise.resolve()
  }, play(plan) {
    if (active.current) return active.current.finished
    beforePlay()
    const overlay = root.current, host = canvasHost.current
    const element = overlay?.closest('dialog')?.querySelector<HTMLElement>('.prepare-folder-card')
    const folder = element?.closest<HTMLElement>('.prepare-folder-stage')
    if (!element || !overlay || !host) return Promise.resolve()
    const label = capsuleInscription(plan)
    setView({ active: true, phase: 'preparing', inscription: label })
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const posterLoading = new AbortController()
    let scene: PrepareCapsuleScene | null = null, cancelled = false, settled = false, handedOff = false
    let resolve = () => {}
    const finished = new Promise<void>(done => { resolve = done })
    if (folder) folder.inert = true
    element.closest('dialog')?.setAttribute('aria-busy', 'true')
    function waiting(fallback = false) {
      if (cancelled) return
      settled = true
      if (fallback) { posterLoading.abort(); scene?.dispose(); scene = null }
      if (folder) folder.dataset.departing = ''
      setView(current => ({ ...current, phase: 'waiting', renderer: fallback ? 'fallback' : current.renderer }))
      resolve()
    }
    function settle() { if (scene) scene.settle(); else waiting(true) }
    function preference() { if (media.matches) waiting(true) }
    function visibility() { if (document.hidden) settle() }
    window.addEventListener('resize', settle)
    media.addEventListener('change', preference)
    document.addEventListener('visibilitychange', visibility)
    function removeListeners() {
      window.removeEventListener('resize', settle)
      media.removeEventListener('change', preference)
      document.removeEventListener('visibilitychange', visibility)
    }
    active.current = { finished, depart(navigate) {
      if (cancelled || handedOff) return Promise.resolve()
      if (!scene || media.matches || document.hidden) { navigate(); return Promise.resolve() }
      handedOff = true
      removeListeners()
      setView(current => ({ ...current, phase: 'leaving' }))
      return travelToStudy(scene, navigate)
    }, cancel() {
      cancelled = true
      posterLoading.abort()
      if (!handedOff) scene?.dispose()
      resolve()
      removeListeners()
    } }
    if (media.matches) waiting(true)
    else {
      try {
        const paper = capturePreparePaper(element)
        void Promise.all([warm(), loadPreparePoster(plan.posterUrl, posterLoading.signal)]).then(([module, poster]) => {
          if (cancelled || settled) return
          if (!module) { waiting(true); return }
          try {
            scene = module.createPrepareCapsuleScene(host, paper, label, poster, phase => {
              if (!cancelled && !settled) setView(current => ({ ...current, phase }))
            })
            setView(current => ({ ...current, renderer: 'webgl', phase: 'dropping' }))
            if (folder) folder.dataset.departing = ''
            void scene.finished.then(() => waiting())
          } catch { waiting(true) }
        })
      } catch { waiting(true) }
    }
    return finished
  } }), [beforePlay, reset, warm])

  return <div ref={root} hidden={!view.active} data-phase={view.phase} data-renderer={view.renderer} tabIndex={-1} className="prepare-departure focus:outline-none" aria-label="공부를 준비하고 있어요" aria-describedby={summaryId}>
    <div ref={canvasHost} className="prepare-departure-scene" aria-hidden="true" />
    <div className="prepare-capsule-fallback" aria-hidden="true">
      <div className="prepare-capsule-info"><strong>{view.inscription?.nickname}</strong><span>{view.inscription?.detail}</span></div>
      <span className="prepare-capsule-date">{view.inscription?.date}</span>
      <span className="prepare-capsule-seam" />
    </div>
    <span id={summaryId} className="sr-only">{view.inscription?.summary}</span>
    <div className="prepare-departure-status" role="status"><QuarterRingSpinner /><span>공부를 준비하고 있어요.</span></div>
  </div>
}
