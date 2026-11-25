import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { connectionInterval, isConnectionVisible } from '@/features/mates/document-pip'
import { api, ApiError } from '@/shared/api/client'
import type { EventRequest, EventResponse, HeartbeatRequest, ReactionRequest, ReactionResponse } from '@/shared/api/types'
import type { ActiveSession } from '../demo/types'
import type { Observation } from '../media/types'
import { sessionStudySeconds } from '../session/connection-time'
import { PresenceClock } from './presence-clock'
import type { StateEvent } from './presence-clock'
import { useBackend } from './backend-context'
import type { BehaviorMonitor } from '../media/behavior-monitor'
import type { ExpressionCue } from '../live2d/expression-scheduler'
import { pickMotionEvents, type MotionCooldowns, type MotionEventType, type TalkFrequency } from './motion-events'
import { escalateAway, eventQueued, takeHeldReaction, type EventFlow, type HeldReaction } from './session-event-flow'
import { IDLE_TALK_EVENT, IdleTalkTimer } from './idle-talk'
import { flushSessionOutbox } from './session-outbox'

export type SessionTotals = { studySeconds: number; presentSeconds: number }
const totalsBySession = new Map<string, () => SessionTotals>()
const queues = new Map<string, () => Promise<void>>()
const initialized = new Set<string>()
export function getSessionTotals(active: ActiveSession): SessionTotals {
  const getter = totalsBySession.get(active.id)
  if (!getter) throw new Error('연결 시간 동기화를 확인하지 못했어요.')
  return getter()
}
export async function flushSessionEvents(sessionId: string) { await queues.get(sessionId)?.() }

/** Study totals saved per device so resuming in a new tab or after a restart can continue the presence count. */
export const presenceKey = (userId: number | undefined, sessionId: string) => `capsule-presence:${userId}:${sessionId}`
/** Reads device storage, falling back to tab storage written before the move to localStorage. */
export function readSessionStorageItem(key: string) {
  try { return localStorage.getItem(key) ?? sessionStorage.getItem(key) } catch { return null }
}

type Input = {
  active: ActiveSession | null; userId?: number; observation: Observation | null; camera: boolean
  behavior?: BehaviorMonitor
  /** `event` is the API 18 type the line answers. */
  onReaction: (result: ReactionResponse, event: string) => void
  /** Immediate faces from API 18 (`stage: 'notice'`). Faces with lines arrive through `onReaction`. */
  onExpression?: (cue: ExpressionCue) => void
  onEnded: () => void
  /** DUMMY_API:reactions — local studies use scripted lines without numeric server IDs. */
  onDummyReaction?: (event: string) => void
  /** A chat reply is on its way or still typing. Reaction lines wait until it finishes so they never cut in ahead of it. */
  busy?: boolean
  /**
   * 「말 걸기 빈도」: how often the mate speaks up first — after a quiet spell when `idleTalk` is on (idle-talk.ts), and
   * the spacing of motion events where gestures are detected (motion-events.ts).
   */
  talk?: TalkFrequency
  /** 「먼저 말 걸기」 (idle-talk.ts): the connection screen's quiet-spell timer (API 18 IDLE_TALK → 19). */
  idleTalk?: boolean
  /** Also stops (and resets) that timer: the event line still typing, the user's voice being heard, the call ending. */
  holdIdleTalk?: boolean
}
type Pending = { result: ReactionResponse; event: string; revision: number; turn?: number }
type Runtime = {
  sessionId: string; signature: string; clock: PresenceClock; outbox: StateEvent[]; draining: Promise<void> | null
  heartbeat: boolean; lastHeartbeatAt: number; alive: boolean
  /** State-event ordering; motion events never change it. */
  flow: EventFlow
  motionSentAt: MotionCooldowns
  /** Only the latest motion event may show its reaction. */
  motionTurn: number
  /** Reaction lines waiting for the chat reply to finish, oldest first. */
  held: HeldReaction<Pending>[]
  /** API 19 requests on their way. */
  reactions: number
  idle: IdleTalkTimer
  /** An IDLE_TALK (18 → 19) is on its way. */
  idleInFlight: boolean
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
  /** A state change or a newer gesture since the request makes its line stale. */
  const stillCurrent = useCallback((current: Runtime, pending: Pending) =>
    current.alive && runtime.current === current && current.flow.revision === pending.revision
      && (pending.turn === undefined || current.motionTurn === pending.turn), [])
  /** `idle`: the mate's own 「먼저 말 걸기」 line — dropped (not held) when a talk started meanwhile, and best effort. */
  const react = useCallback(async (current: Runtime, eventId: number, event: string, intensity = 1, turn?: number, idle = false) => {
    const revision = current.flow.revision
    const requestId = crypto.randomUUID()
    current.reactions++
    try {
      const result = await api.request<ReactionResponse>(`/sessions/${current.sessionId}/events/${eventId}/reaction`, {
        method: 'POST', body: { requestId, intensity, tts: false } satisfies ReactionRequest,
      })
      const pending: Pending = { result, event, revision, turn }
      if (result.requestId !== requestId || !stillCurrent(current, pending)) return
      if (latest.current.busy || current.held.length) { if (!idle) current.held.push({ value: pending, heldAt: Date.now() }) }
      else latest.current.onReaction(result, event)
    } catch (reason) {
      if (!idle || (reason instanceof ApiError && reason.code === 'SESSION_ENDED')) fail(reason, current)
    } finally { current.reactions-- }
  }, [fail, stillCurrent])
  /** Shows the next held line once the chat reply has finished; the 250 ms tick lets each line start typing first. */
  const release = useCallback((current: Runtime) => {
    if (!current.held.length || latest.current.busy) return
    const { next, rest } = takeHeldReaction(current.held, Date.now(), value => stillCurrent(current, value))
    current.held = rest
    if (next) latest.current.onReaction(next.result, next.event)
  }, [stillCurrent])
  const notice = useCallback((result: EventResponse, event: string) => {
    for (const character of result.characters ?? []) {
      if (character.characterId) latest.current.onExpression?.({ characterId: character.characterId, expression: character.expression, event, stage: 'notice' })
    }
  }, [])
  const drain = useCallback(async (current: Runtime) => {
    if (!latest.current.active?.serverSession) return
    await flushSessionOutbox(current,
      event => api.request<EventResponse>(`/sessions/${current.sessionId}/events`, { method: 'POST', body: event satisfies EventRequest }),
      (result, event, revision) => {
        for (const character of result.characters ?? []) {
          if (character.characterId) updateAffinity(character.characterId, character.affinity)
        }
        if (current.flow.revision === revision && current.outbox.length === 0) {
          notice(result, event.type)
          if (result.eventId) {
            if (event.type === 'AWAY') current.flow = { ...current.flow, away: { eventId: result.eventId, at: Date.parse(event.occurredAt) - (latest.current.active?.serverOffsetMs ?? 0), intensity: 1 } }
            void react(current, result.eventId, event.type)
          }
        }
      },
    )
    if (current.alive) setError('')
  }, [notice, react, updateAffinity])
  const enqueue = useCallback((current: Runtime, event: StateEvent) => {
    current.flow = eventQueued(current.flow, event.type)
    if (!latest.current.active?.serverSession) { latest.current.onDummyReaction?.(event.type); return }
    current.outbox.push(event)
    void drain(current).catch(reason => fail(reason, current))
  }, [drain, fail])
  /** Motion events go out on their own so a gesture never interrupts the state-event queue or away escalation. */
  const sendMotion = useCallback(async (current: Runtime, type: MotionEventType, occurredAt: string) => {
    if (!latest.current.active?.serverSession) { latest.current.onDummyReaction?.(type); return }
    // Motion events leave the state flow as it is (no revision bump, the away escalation keeps running).
    current.flow = eventQueued(current.flow, type)
    const revision = current.flow.revision
    const turn = ++current.motionTurn
    try {
      const result = await api.request<EventResponse>(`/sessions/${current.sessionId}/events`, { method: 'POST', body: { type, occurredAt } satisfies EventRequest })
      if (!current.alive || runtime.current !== current) return
      for (const character of result.characters ?? []) {
        if (character.characterId) updateAffinity(character.characterId, character.affinity)
      }
      // A state change or a newer gesture since sending makes this reaction stale.
      if (current.flow.revision !== revision || current.motionTurn !== turn) return
      notice(result, type)
      if (result.eventId) void react(current, result.eventId, type, 1, turn)
    } catch (reason) {
      // Gestures are best effort; only a finished session needs handling here.
      if (reason instanceof ApiError && reason.code === 'SESSION_ENDED') fail(reason, current)
    }
  }, [fail, notice, react, updateAffinity])
  /** 「먼저 말 걸기」: API 18 IDLE_TALK, then its line (19) on the usual reaction path. Credits follow the server's rules. */
  const sendIdleTalk = useCallback(async (current: Runtime) => {
    const active = latest.current.active
    if (!active?.serverSession) return
    current.idleInFlight = true
    try {
      const occurredAt = new Date(Date.now() + (active.serverOffsetMs ?? 0)).toISOString()
      const result = await api.request<EventResponse>(`/sessions/${current.sessionId}/events`, { method: 'POST', body: { type: IDLE_TALK_EVENT, occurredAt } satisfies EventRequest })
      if (!current.alive || runtime.current !== current) return
      for (const character of result.characters ?? []) {
        if (character.characterId) updateAffinity(character.characterId, character.affinity)
      }
      // The user spoke or something happened meanwhile: the quiet is over, so is this line.
      if (latest.current.busy || current.held.length) return
      notice(result, IDLE_TALK_EVENT)
      if (result.eventId) await react(current, result.eventId, IDLE_TALK_EVENT, 1, undefined, true)
    } catch (reason) {
      // Best effort (a server without IDLE_TALK refuses it): only a finished session needs handling.
      if (reason instanceof ApiError && reason.code === 'SESSION_ENDED') fail(reason, current)
    } finally { current.idleInFlight = false }
  }, [fail, notice, react, updateAffinity])
  /** The quiet-spell timer (idle-talk.ts), stepped with the 250 ms tick. */
  const idleStep = useCallback((current: Runtime) => {
    const { active, idleTalk, talk, busy, holdIdleTalk, camera } = latest.current
    if (!idleTalk || !talk) { current.idle.clear(); return }
    const due = current.idle.step(Date.now(), {
      talk,
      live: current.alive && Boolean(active?.serverSession) && active?.id === current.sessionId && active.runningSince !== null,
      busy: Boolean(busy || holdIdleTalk) || current.held.length > 0 || current.reactions > 0 || current.idleInFlight
        || current.outbox.length > 0 || current.draining !== null,
      camera,
      away: current.flow.away !== null,
      visible: isConnectionVisible(),
    })
    if (due) void sendIdleTalk(current)
  }, [sendIdleTalk])
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
    const presence = !camera ? 'off' : isConnectionVisible() && fresh ? observation.faceCount > 0 ? 'present' : 'absent' : 'unknown'
    for (const event of current.clock.sample(study, now, presence, active.phase, active.runningSince !== null)) {
      enqueue(current, { ...event, occurredAt: new Date(Date.parse(event.occurredAt) + (active.serverOffsetMs ?? 0)).toISOString() })
    }
    const count = current.clock.totals(study)
    setPresentSeconds(count.presentSeconds)
    // An unknown baseline is already counted conservatively (earlier study as away), so these totals are safe to resume from.
    try { localStorage.setItem(presenceKey(userId, active.id), JSON.stringify({ ...count, known: true })) } catch { /* Timing still works in memory. */ }
    if (current.alive && active.runningSince !== null) {
      const next = escalateAway(current.flow, now)
      if (next.intensity !== null && next.flow.away) {
        current.flow = next.flow
        void react(current, next.flow.away.eventId, 'AWAY', next.intensity)
      }
    }
  }, [enqueue, react])
  const heartbeat = useCallback(async (current: Runtime) => {
    if (current.heartbeat || !latest.current.active?.serverSession) return
    current.heartbeat = true
    try {
      tick(current)
      await drain(current)
      if (!current.alive) return
      const count = totals(current)
      // An unknown restored baseline is already counted as away by installSession. Send the
      // conservative totals too: the current service rejects bodyless heartbeats with 400.
      const body: HeartbeatRequest = { studySeconds: count.studySeconds, presentSeconds: count.presentSeconds }
      await api.request(`/sessions/${current.sessionId}/heartbeat`, { method: 'POST', body })
      current.lastHeartbeatAt = Date.now()
      if (current.alive) setError('')
    } catch (reason) { fail(reason, current) }
    finally { current.heartbeat = false }
  }, [drain, fail, tick, totals])
  useLayoutEffect(() => {
    // Record phase and pause changes before the periodic sampling tick.
    const current = runtime.current
    if (current?.alive) {
      if (input.active?.runningSince === null) current.flow = { revision: current.flow.revision + 1, away: null }
      tick(current)
    }
  }, [input.active?.phase, input.active?.runningSince, input.camera, tick])
  const sessionId = input.active?.id
  const userId = input.userId
  const resumed = !!visuals && 'studySeconds' in visuals
  const startedAt = visuals && 'startedAt' in visuals ? visuals.startedAt : undefined
  const behavior = input.behavior
  const signature = `${sessionId}:${visuals?.serverTime ?? ''}`
  useEffect(() => {
    const active = latest.current.active
    if (!active) return
    let current = runtime.current
    if (!current || current.signature !== signature) {
      const baseAway = active.initialAwaySeconds ?? 0
      current = {
        sessionId: active.id, signature, clock: new PresenceClock(baseAway), outbox: [], draining: null, heartbeat: false, lastHeartbeatAt: Date.now(), alive: true,
        flow: { revision: 0, away: null }, motionSentAt: {}, motionTurn: 0, held: [],
        reactions: 0, idle: new IdleTalkTimer(), idleInFlight: false,
      }
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
    const stopBehavior = behavior?.onChange((change) => {
      const { active: now, camera } = latest.current
      if (!sync.alive || !now || now.id !== sync.sessionId) return
      const picked = pickMotionEvents(sync.motionSentAt, change.started, change.at, {
        camera, phase: now.phase, running: now.runningSince !== null, hidden: document.hidden, talk: latest.current.talk,
      })
      sync.motionSentAt = picked.sentAt
      const occurredAt = new Date(change.at + (now.serverOffsetMs ?? 0)).toISOString()
      for (const type of picked.types) void sendMotion(sync, type, occurredAt)
    })
    const stopTimer = connectionInterval(() => { tick(sync); release(sync); idleStep(sync) }, 250)
    const stopPulse = connectionInterval(() => { void heartbeat(sync) }, 60_000)
    const visible = () => { tick(sync); if (isConnectionVisible() && Date.now() - sync.lastHeartbeatAt >= 60_000) void heartbeat(sync) }
    document.addEventListener('visibilitychange', visible)
    return () => {
      sync.alive = false
      sync.idle.clear()
      stopBehavior?.()
      stopTimer(); stopPulse(); document.removeEventListener('visibilitychange', visible)
      totalsBySession.delete(active.id); queues.delete(active.id)
    }
  }, [sessionId, signature, userId, resumed, startedAt, behavior, drain, enqueue, heartbeat, idleStep, release, sendMotion, tick, totals])
  const retry = useCallback(async () => {
    if (runtime.current) await heartbeat(runtime.current)
  }, [heartbeat])
  const cancelReaction = useCallback(() => {
    const current = runtime.current
    if (current) { current.flow = { ...current.flow, revision: current.flow.revision + 1 }; current.held = [] }
  }, [])
  return { error, retry, presentSeconds, cancelReaction }
}
