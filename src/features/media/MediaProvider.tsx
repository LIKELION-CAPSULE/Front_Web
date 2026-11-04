import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router'
import { useDemo } from '@/features/demo/demo-context'
import { getStudyRoom } from '@/features/rooms/services/room-service'
import { DeviceController } from './device-controller'
import { MediaContext } from './media-context'
import { SegmentationClient } from './segmentation-client'
import { BehaviorMonitor } from './behavior-monitor'
import { FACE_INTERVAL_MS, GESTURE_INTERVAL_MS, OBSERVATION_PUBLISH_MS, PHONE_INTERVAL_MS, PREPARE_FACE_INTERVAL_MS } from './behavior-constants'
import type { Observation, VisionMessage, VisionStatus, VisionTask } from './types'
import { useFaceFocus } from './use-face-focus'

/** Scheduler resolution; each model runs when its own interval is due. */
const TICK_MS = 1000 / 30

export function MediaProvider({ children }: { children: ReactNode }) {
  const [controller] = useState(() => new DeviceController(
    navigator.mediaDevices?.getUserMedia ? (constraints) => navigator.mediaDevices.getUserMedia(constraints) : null,
  ))
  const devices = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  const [vision, setVision] = useState<VisionStatus | null>(null)
  const [observation, setObservation] = useState<Observation | null>(null)
  const [attempt, setAttempt] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [behavior] = useState(() => new BehaviorMonitor())
  const studyDetection = useRef(false)
  const { pathname } = useLocation()
  const { state, dispatch } = useDemo()
  const [backgroundNotice, setBackgroundNotice] = useState<string | null>(null)
  const [segmentation] = useState(() => new SegmentationClient(new URL(import.meta.env.BASE_URL, location.href).href, () => {
    dispatch({ type: 'CAMERA_BACKGROUND', background: 'none' })
    setBackgroundNotice('배경을 불러오지 못해 기본 화면으로 돌렸어요.')
  }))
  const allowed = state.profile.loggedIn && !!state.activeSession &&
    !!getStudyRoom(state.activeSession.roomId) && pathname === `/study/${state.activeSession.id}`
  const stream = allowed ? devices.camera.stream : null
  const monitoring = allowed && state.activeSession?.phase === 'study' && state.activeSession.runningSince !== null
  const availableVision = stream && monitoring ? vision : null
  const availableObservation = availableVision?.status === 'ready' ? observation : null
  const focusEnabled = !!state.activeSession && pathname === `/study/${state.activeSession.id}` &&
    state.activeSession.phase === 'study' && state.activeSession.runningSince !== null &&
    state.activeSession.camera && !!stream && availableVision?.status === 'ready'
  const flushFocus = useFaceFocus({ session: state.activeSession, enabled: focusEnabled, observation: availableObservation, dispatch })
  // Behavior rules run only while the study timer runs; `monitoring` already stops the loop on pause and break.
  const detectBehavior = monitoring && !!state.activeSession && pathname === `/study/${state.activeSession.id}`

  useEffect(() => {
    // A ref keeps the worker alive from the prepare screen into the study screen.
    studyDetection.current = detectBehavior
    if (!detectBehavior) behavior.reset()
  }, [detectBehavior, behavior])

  useEffect(() => {
    if (!allowed) controller.stop()
  }, [allowed, controller])
  useEffect(() => () => controller.stop(), [controller])
  useEffect(() => () => segmentation.close(), [segmentation])
  useEffect(() => {
    if (!backgroundNotice) return
    const timeout = window.setTimeout(() => setBackgroundNotice(null), 4000)
    return () => clearTimeout(timeout)
  }, [backgroundNotice])
  useEffect(() => {
    const video = videoRef.current
    if (!stream || !video || !monitoring) return
    let active = true, busy = false, ready = false, sentAt = 0, startupTimeout = 0, publishedAt = -Infinity
    const ranAt: Record<VisionTask, number> = { face: -Infinity, gesture: -Infinity, phone: -Infinity }
    const unavailable = new Set<VisionTask>()
    let worker: Worker | null = null
    video.srcObject = stream
    const reset = () => { setObservation(null); setVision({ status: 'loading' }) }
    queueMicrotask(() => { if (active) reset() })
    const fail = (message?: unknown) => {
      if (!active) return
      ready = false
      busy = false
      clearTimeout(startupTimeout)
      worker?.terminate()
      worker = null
      setObservation(null)
      behavior.reset()
      setVision({ status: 'error', error: typeof message === 'string' ? message : '감지를 시작하지 못했어요. 다시 시도해 주세요.' })
    }
    try {
      startupTimeout = window.setTimeout(fail, 60000)
      worker = new Worker(new URL('./vision.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (event: MessageEvent<VisionMessage>) => {
        if (!active) return
        if (event.data.type === 'status') {
          if (event.data.value.status !== 'loading') clearTimeout(startupTimeout)
          if (event.data.value.status === 'error') { fail(event.data.value.error); return }
          ready = event.data.value.status === 'ready'
          setVision(event.data.value)
          if (!ready) setObservation(null)
        } else if (event.data.type === 'task-error') {
          unavailable.add(event.data.task)
        } else {
          busy = false
          if (document.hidden) return
          const { at, face, hand, phoneScore } = event.data.value
          if (face && at - publishedAt >= OBSERVATION_PUBLISH_MS - TICK_MS / 2) {
            publishedAt = at
            setObservation({ at, faceCount: face.faceCount, faceBox: face.faceBox })
          }
          if (studyDetection.current) behavior.observe({ face: face?.signal, hand, phoneScore }, at)
        }
      }
      worker.onerror = fail
      worker.onmessageerror = fail
      worker.postMessage({ type: 'init', baseUrl: new URL(import.meta.env.BASE_URL, location.href).href })
      void video.play().catch(fail)
    } catch { fail() }
    const timer = window.setInterval(() => {
      if (busy && performance.now() - sentAt > 15000) { fail(); return }
      if (!active || !worker || !ready || busy || document.hidden || video.readyState < 2) return
      const now = performance.now()
      const intervals: Partial<Record<VisionTask, number>> = studyDetection.current
        ? { face: FACE_INTERVAL_MS, gesture: GESTURE_INTERVAL_MS, phone: PHONE_INTERVAL_MS }
        : { face: PREPARE_FACE_INTERVAL_MS }
      const tasks = (Object.keys(intervals) as VisionTask[]).filter((task) =>
        !unavailable.has(task) && now - ranAt[task] >= intervals[task]! - TICK_MS / 2)
      if (!tasks.length) return
      for (const task of tasks) ranAt[task] = now
      busy = true
      sentAt = now
      void createImageBitmap(video).then((frame) => {
        if (!active || !worker || document.hidden) { frame.close(); busy = false; return }
        worker.postMessage({ type: 'frame', frame, at: performance.now(), tasks }, [frame])
      }).catch(fail)
    }, TICK_MS)
    const visibility = () => { if (document.hidden) { setObservation(null); behavior.reset() } }
    document.addEventListener('visibilitychange', visibility)
    return () => {
      active = false
      clearInterval(timer)
      clearTimeout(startupTimeout)
      document.removeEventListener('visibilitychange', visibility)
      worker?.terminate()
      behavior.reset()
      video.pause()
      video.srcObject = null
    }
  }, [stream, monitoring, attempt, behavior])
  return (
    <MediaContext value={{ devices, controller, vision: availableVision,
      observation: availableObservation, flushFocus, segmentation, backgroundNotice, behavior,
      retryVision: () => setAttempt((value) => value + 1) }}>
      <video ref={videoRef} muted playsInline aria-hidden="true" className="hidden" />
      {children}
    </MediaContext>
  )
}
