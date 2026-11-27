import { useEffect, useRef, useState } from 'react'
import capsuleStill from '@/assets/capsule/capsule-upright.webp'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'
import { supportsWebGL } from '../capsule-board/capsule-board-view'
import type { EmptyJarSceneController } from './empty-jar-scene'
import './records-empty-jar.css'

/** `pending`: the still picture is painted while the scene's chunk loads; `webgl`: the scene draws; `fallback`: still. */
type RenderMode = 'pending' | 'webgl' | 'fallback'

/**
 * The empty records page's picture (「아직 함께한 기록이 없어요」): the bottom of an empty glass jar with one capsule
 * floating in it (WebGL, its own lazy chunk sharing three.js with the records board). `hop` going up makes the capsule
 * jump (the button below is pointed at). Without WebGL, after a lost context, and until the scene draws, it shows the
 * capsule's still render instead. Decorative.
 */
export function RecordsEmptyJar({ hop, forceFallback = false }: {
  /** Goes up by one each time the capsule should hop. */
  hop: number
  /** Still picture only (preview / tests). */
  forceFallback?: boolean
}) {
  const reducedMotion = useReducedMotion()
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<EmptyJarSceneController | null>(null)
  const reducedRef = useRef(reducedMotion)
  const [mode, setMode] = useState<RenderMode>(() => (forceFallback || !supportsWebGL() ? 'fallback' : 'pending'))

  useEffect(() => {
    reducedRef.current = reducedMotion
    sceneRef.current?.setReducedMotion(reducedMotion)
  }, [reducedMotion])

  useEffect(() => {
    if (hop > 0) sceneRef.current?.hop()
  }, [hop])

  const failed = mode === 'fallback'
  useEffect(() => {
    const host = hostRef.current
    if (failed || !host) return
    let cancelled = false
    let onScreen = true
    const updateRunning = () => sceneRef.current?.setRunning(onScreen && document.visibilityState === 'visible')
    const observer = new IntersectionObserver((entries) => {
      onScreen = entries.some((entry) => entry.isIntersecting)
      updateRunning()
    })
    observer.observe(host)
    document.addEventListener('visibilitychange', updateRunning)
    import('./empty-jar-scene')
      .then(({ createEmptyJarScene }) => {
        if (cancelled) return
        sceneRef.current = createEmptyJarScene({
          host,
          reducedMotion: reducedRef.current,
          onContextFailure: () => setMode('fallback'),
        })
        updateRunning()
        setMode('webgl')
      })
      .catch(() => {
        if (!cancelled) setMode('fallback')
      })
    return () => {
      cancelled = true
      observer.disconnect()
      document.removeEventListener('visibilitychange', updateRunning)
      sceneRef.current?.dispose()
      sceneRef.current = null
    }
  }, [failed])

  return (
    <div className="records-empty-jar" data-render={mode} aria-hidden="true">
      {mode !== 'webgl' && (
        <div className="records-empty-jar-still">
          <img src={capsuleStill} width={320} height={320} alt="" draggable={false} data-hop={hop % 2 ? 'a' : hop ? 'b' : undefined} />
        </div>
      )}
      <div ref={hostRef} className="records-empty-jar-host" />
    </div>
  )
}
