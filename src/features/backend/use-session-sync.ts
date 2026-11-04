import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { api, ApiError } from '@/shared/api/client'
import type { EventResponse, ReactionResponse } from '@/shared/api/types'
import type { ActiveSession } from '../demo/types'
import type { Observation } from '../media/types'
import { sessionStudySeconds } from '../demo/reducer'
import { PresenceClock } from './presence-clock'
import type { StateEvent } from './presence-clock'
import { useBackend } from './backend-context'

export type SessionTotals = { studySeconds: number; presentSeconds: number }
const totalsBySession = new Map<string, () => SessionTotals>()
const queues = new Map<string, () => Promise<void>>()
const initialized = new Set<string>()
export function getSessionTotals(active: ActiveSession): SessionTotals {
  const getter = totalsBySession.get(active.id)
  if (!getter) throw new Error('공부 시간 동기화를 확인하지 못했어요.')
  return getter()
}
export async function flushSessionEvents(sessionId: string) { await queues.get(sessionId)?.() }

type Input = {
  active: ActiveSession | null; userId?: number; observation: Observation | null; camera: boolean
  onReaction: (result: ReactionResponse) => void; onEnded: () => void
}
type Runtime = {
  sessionId: string; signature: string; clock: PresenceClock; outbox: StateEvent[]; draining: Promise<void> | null
  heartbeat: boolean; revision: number; alive: boolean
  away: { eventId: number; at: number; intensity: number } | null
}

export function useSessionSync(input: Input) {
  const { visuals, updateAffinity } = useBackend()
  const [error, setError] = useState('')
  const [presentSeconds, setPresentSeconds] = useState(0)
  const latest = useRef(input)
  const runtime = useRef<Runtime | null>(null)
  useLayoutEffect(() => { latest.current = input }, [input])
  const fail = useCallback((reason: unknown, current: Runtime) => {
    if (!current.alive) return
    if (reason instanceof ApiError && reason.code === 'SESSION_ENDED') latest.current.onEnded()
    else setError(reason instanceof Error ? reason.message : '상태 기록을 저장하지 못했어요.')
  }, [])
  const react = useCallback(async (current: Runtime, eventId: number, intensity = 1) => {
    const revision = current.revision
    const requestId = crypto.randomUUID()
    try {
      const result = await api.request<ReactionResponse>(`/sessions/${current.sessionId}/events/${eventId}/reaction`, {
        method: 'POST', body: { requestId, intensity, tts: false },
      })
      if (current.alive && runtime.current === current && current.revision === revision && result.requestId === requestId) latest.current.onReaction(result)
    } catch (reason) { fail(reason, current) }
  }, [fail])
  const drain = useCallback(async (current: Runtime) => {
    if (current.draining) return current.draining
    current.draining = (async () => {
      while (current.outbox.length) {
        const event = current.outbox[0]!
        const revision = current.revision
        const result = await api.request<EventResponse>(`/sessions/${current.sessionId}/events`, { method: 'POST', body: event })
        current.outbox.shift()
        if (current.alive) for (const character of result.characters ?? []) {
          if (character.characterId) updateAffinity(character.characterId, character.affinity)
        }
        if (current.alive && current.revision === revision && current.outbox.length === 0 && result.eventId) {
          if (event.type === 'AWAY') current.away = { eventId: result.eventId, at: Date.parse(event.occurredAt) - (latest.current.active?.serverOffsetMs ?? 0), intensity: 1 }
          void react(current, result.eventId)
        }
      }
      if (current.alive) setError('')
    })()
    try { await current.draining } finally { current.draining = null }
  }, [react, updateAffinity])
  const enqueue = useCallback((current: Runtime, event: StateEvent) => {
    current.revision++
    if (event.type !== 'AWAY') current.away = null
    current.outbox.push(event)
    void drain(current).catch(reason => fail(reason, current))
  }, [drain, fail])
  const totals = useCallback((current: Runtime) => {
    const active = latest.current.active
    if (!active || active.id !== current.sessionId) throw new Error('진행 세션이 변경됐어요.')
    return current.clock.totals(sessionStudySeconds(active, Date.now()))
  }, [])
  const tick = useCallback((current: Runtime) => {
    const { active, userId, observation, camera } = latest.current
    if (!active || active.id !== current.sessionId) return
    const now = Date.now()
    const study = sessionStudySeconds(active, now)
    const fresh = observation && now - (performance.timeOrigin + observation.at) < 1500
    const presence = !camera ? 'off' : !document.hidden && fresh ? observation.faceCount > 0 ? 'present' : 'absent' : 'unknown'
    for (const event of current.clock.sample(study, now, presence, active.phase)) {
      enqueue(current, { ...event, occurredAt: new Date(Date.parse(event.occurredAt) + (active.serverOffsetMs ?? 0)).toISOString() })
    }
    const count = current.clock.totals(study)
    setPresentSeconds(count.presentSeconds)
    try { sessionStorage.setItem(`capsule-presence:${userId}:${active.id}`, JSON.stringify({ ...count, known: active.presenceKnown !== false })) } catch { /* Timing still works in memory. */ }
    const away = current.away
    if (away && current.alive) {
      const intensity = now - away.at >= 300_000 ? 3 : now - away.at >= 60_000 ? 2 : 1
      if (intensity > away.intensity) { away.intensity = intensity; void react(current, away.eventId, intensity) }
    }
  }, [enqueue, react])
  const heartbeat = useCallback(async (current: Runtime) => {
    if (current.heartbeat) return
    current.heartbeat = true
    try {
      tick(current)
      await drain(current)
      const count = totals(current)
      await api.request(`/sessions/${current.sessionId}/heartbeat`, { method: 'POST', body: latest.current.active?.presenceKnown === false ? undefined : { studySeconds: count.studySeconds, presentSeconds: count.presentSeconds } })
      if (current.alive) setError('')
    } catch (reason) { fail(reason, current) }
    finally { current.heartbeat = false }
  }, [drain, fail, tick, totals])
  useLayoutEffect(() => {
    // Record rapid break/resume clicks before the periodic sampling tick.
    const current = runtime.current
    if (current?.alive) tick(current)
  }, [input.active?.phase, input.camera, tick])
  const sessionId = input.active?.id
  const userId = input.userId
  const resumed = !!visuals && 'studySeconds' in visuals
  const startedAt = visuals && 'startedAt' in visuals ? visuals.startedAt : undefined
  const signature = `${sessionId}:${visuals?.serverTime ?? ''}`
  useEffect(() => {
    const active = latest.current.active
    if (!active?.serverSession) return
    let current = runtime.current
    if (!current || current.signature !== signature) {
      const baseAway = active.initialAwaySeconds ?? 0
      current = { sessionId: active.id, signature, clock: new PresenceClock(baseAway), outbox: [], draining: null, heartbeat: false, revision: 0, alive: true, away: null }
      runtime.current = current
    }
    runtime.current!.alive = true
    const sync = current
    totalsBySession.set(active.id, () => { tick(sync); return totals(sync) })
    queues.set(active.id, async () => { tick(sync); await drain(sync) })
    const key = `${userId}:${active.id}`
    if (!resumed && startedAt && !initialized.has(key)) {
      initialized.add(key)
      enqueue(sync, { type: 'FOCUS', occurredAt: startedAt })
    }
    const timer = window.setInterval(() => tick(sync), 250)
    const pulse = window.setInterval(() => { void heartbeat(sync) }, 60_000)
    const visible = () => { tick(sync); if (!document.hidden) void heartbeat(sync) }
    document.addEventListener('visibilitychange', visible)
    return () => {
      sync.alive = false
      clearInterval(timer); clearInterval(pulse); document.removeEventListener('visibilitychange', visible)
      totalsBySession.delete(active.id); queues.delete(active.id)
    }
  }, [sessionId, signature, userId, resumed, startedAt, drain, enqueue, heartbeat, tick, totals])
  const retry = useCallback(async () => {
    if (runtime.current) await heartbeat(runtime.current)
  }, [heartbeat])
  const cancelReaction = useCallback(() => {
    if (runtime.current) runtime.current.revision++
  }, [])
  return { error, retry, presentSeconds, cancelReaction }
}
