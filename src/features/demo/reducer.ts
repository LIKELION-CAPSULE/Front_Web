import { chargeProducts, products, tierById } from './catalog.ts'
import { createDemoState } from './seed.ts'
import { normalizeFocusTotals } from '../session/focus.ts'
import {
  DEFAULT_GOAL_MINUTES,
  normalizeGoalMinutes,
  studyGoalSeconds,
} from '../session/study-goal.ts'
import { businessDay } from '../../shared/lib/format.ts'
import { MIN_CALENDAR_DATE } from '../../shared/lib/date-limits.ts'
import { normalizeCameraBackground, type CameraBackgroundId } from '../media/camera-backgrounds.ts'
import type { AvatarSettings, DemoState, FocusTotals, LedgerEntry, Memory, TierId } from './types.ts'
import { MVP_CHARACTER_ID, MVP_GOAL_MINUTES, MVP_ROOM_ID } from '../mvp/policy.ts'
import { normalizeAffectionScore } from '../characters/affection.ts'

export const BREAK_SECONDS = 10 * 60

export type DemoAction =
  | { type: 'LOGIN'; preview?: boolean; nickname?: string }
  | { type: 'PROFILE'; name: string; avatar: AvatarSettings }
  | { type: 'LOGOUT' }
  | { type: 'RESET'; now: number }
  | { type: 'FIRST_VISIT'; value: boolean }
  | { type: 'SET_AFFECTION'; characterId: string; score: number }
  | { type: 'CAMERA'; enabled: boolean }
  | { type: 'CAMERA_BACKGROUND'; background: CameraBackgroundId }
  | { type: 'FACE_FOCUS'; sessionId: string; totals: FocusTotals; now: number }
  | { type: 'EXAM_PROMPTED'; roomId: string }
  | { type: 'SAVE_ROOM'; roomId: string }
  | { type: 'START_MVP'; now: number }
  | {
      type: 'START'
      now: number
      roomId: string
      characterIds: string[]
      tier: TierId
      camera: boolean
      targetMinutes?: number
    }
  | { type: 'TICK'; now: number }
  | { type: 'RESUME_SESSION'; now: number }
  | { type: 'TAKE_BREAK'; now: number }
  | { type: 'CONTINUE_STUDY'; now: number }
  | { type: 'FINISH'; now: number }
  | { type: 'UPGRADE'; tier: TierId; now: number }
  | {
      type: 'MESSAGE'
      characterId: string
      name: string
      text: string
      voice?: boolean
      /** 'llm' records only the user's message; the reply arrives later as CHARACTER_REPLY. */
      reply?: 'scripted' | 'llm'
      now: number
    }
  | { type: 'CHARACTER_REPLY'; sessionId: string; characterId: string; text: string; now: number }
  | { type: 'PURCHASE'; productId: string; method: string; now: number }
  | { type: 'GIFT'; characterId: string; characterName: string; productId: string; now: number }
  | { type: 'MEMORY'; memory: Memory }
  | { type: 'DELETE_MEMORY'; id: string }

export function sessionElapsed(state: DemoState['activeSession'], now: number) {
  return state
    ? Math.max(
        0,
        (state.elapsedMs +
          (state.runningSince === null ? 0 : Math.max(0, now - state.runningSince))) /
          1000,
      )
    : 0
}

/** Cumulative study time excludes rests and keeps counting beyond the goal. */
export function sessionStudySeconds(active: DemoState['activeSession'], now: number) {
  if (!active) return 0
  return active.phase === 'break' ? active.studySeconds : sessionElapsed(active, now)
}

function continueStudySession(active: NonNullable<DemoState['activeSession']>, now: number, overflowSeconds = 0) {
  return {
    ...active,
    phase: 'study' as const,
    elapsedMs: (active.studySeconds + overflowSeconds) * 1000,
    runningSince: now,
  }
}

export function tierCost(state: DemoState, tier: TierId, now: number) {
  if (state.pass && state.pass.expiresAt > now) {
    if (tier === 'standard' || (tier === 'premium' && state.pass.premiumDay !== businessDay(now)))
      return 0
  }
  return tierById(tier).price
}

function transaction(state: DemoState, entry: Omit<LedgerEntry, 'balance'>): DemoState {
  const balance = state.credits + entry.change
  if (balance < 0) return state
  return { ...state, credits: balance, ledger: [{ ...entry, balance }, ...state.ledger] }
}

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case 'LOGIN':
      return {
        ...state,
        profile: {
          ...state.profile,
          name: action.nickname === undefined ? state.profile.name : resolveProfileName(action.nickname),
          loggedIn: true,
          onboarded: action.preview || state.profile.onboarded,
        },
      }
    case 'PROFILE':
      return {
        ...state,
        profile: {
          ...state.profile,
          name: resolveProfileName(action.name),
          avatar: action.avatar,
          onboarded: true,
        },
      }
    case 'LOGOUT':
      return { ...state, profile: { ...state.profile, loggedIn: false } }
    case 'RESET':
      return createDemoState(action.now)
    case 'FIRST_VISIT':
      return { ...state, firstVisit: action.value }
    case 'SET_AFFECTION': {
      const score = normalizeAffectionScore(action.score)
      if (!action.characterId.trim() || score === null || state.affection?.[action.characterId] === score) return state
      return { ...state, affection: { ...state.affection, [action.characterId]: score } }
    }
    case 'CAMERA_BACKGROUND':
      return { ...state, cameraBackground: normalizeCameraBackground(action.background) }
    case 'CAMERA':
      return {
        ...state,
        cameraChecked: true,
        cameraEnabled: action.enabled,
        activeSession: state.activeSession
          ? { ...state.activeSession, camera: action.enabled }
          : null,
      }
    case 'EXAM_PROMPTED':
      return {
        ...state,
        examPromptedRooms: [...new Set([...state.examPromptedRooms, action.roomId])],
      }
    case 'SAVE_ROOM':
      return {
        ...state,
        savedRooms: state.savedRooms.includes(action.roomId)
          ? state.savedRooms.filter((id) => id !== action.roomId)
          : [...state.savedRooms, action.roomId],
      }
    case 'START_MVP':
      return demoReducer(state, {
        type: 'START', now: action.now, roomId: MVP_ROOM_ID,
        characterIds: [MVP_CHARACTER_ID], tier: 'basic', targetMinutes: MVP_GOAL_MINUTES, camera: false,
      })
    case 'START': {
      if (state.activeSession) return state
      const cost = tierCost(state, action.tier, action.now)
      if (cost > state.credits) return state
      const next = cost
        ? transaction(state, {
            id: `start-${action.now}`,
            at: action.now,
            kind: 'use',
            description: `대화 옵션 · ${tierById(action.tier).name}`,
            change: -cost,
          })
        : state
      return {
        ...next,
        firstVisit: false,
        pass:
          state.pass && action.tier === 'premium' && !cost
            ? { ...state.pass, premiumDay: businessDay(action.now) }
            : state.pass,
        activeSession: {
          id: `session-${action.now}`,
          roomId: action.roomId,
          characterIds: action.characterIds,
          tier: action.tier,
          paidCredits: cost,
          phase: 'study',
          targetSeconds: normalizeGoalMinutes(action.targetMinutes ?? DEFAULT_GOAL_MINUTES) * 60,
          elapsedMs: 0,
          runningSince: action.now,
          studySeconds: 0,
          startedAt: action.now,
          camera: action.camera,
          focus: { observedMs: 0, focusedMs: 0, returns: 0 },
        },
      }
    }
    case 'FACE_FOCUS': {
      const active = state.activeSession
      if (!active || active.id !== action.sessionId || !Number.isFinite(action.now) || action.now < active.startedAt) return state
      const previous = normalizeFocusTotals(active.focus)
      const next = normalizeFocusTotals(action.totals)
      if (next.observedMs < previous.observedMs || next.focusedMs < previous.focusedMs || next.returns < previous.returns) return state
      const studyMs = sessionStudySeconds(active, action.now) * 1000
      const observedMs = Math.min(next.observedMs, Math.max(previous.observedMs, studyMs))
      const focus = { observedMs, focusedMs: Math.min(observedMs, next.focusedMs), returns: next.returns }
      if (previous.observedMs === focus.observedMs && previous.focusedMs === focus.focusedMs && previous.returns === focus.returns) return state
      return { ...state, activeSession: { ...active, focus } }
    }
    case 'TICK': {
      const active = state.activeSession
      if (!active || active.phase !== 'break') return state
      const elapsed = sessionElapsed(active, action.now)
      if (elapsed < BREAK_SECONDS) return state
      // Only the user's TAKE_BREAK starts a rest. A completed rest resumes study,
      // including study time after its end when a background tab delays this tick.
      return { ...state, activeSession: continueStudySession(active, action.now, elapsed - BREAK_SECONDS) }
    }
    case 'RESUME_SESSION': {
      // Older saves can contain a stopped timer. Resuming never pauses a running session
      // or restarts a completed break.
      const active = state.activeSession
      if (!active || active.runningSince !== null ||
        (active.phase === 'break' && sessionElapsed(active, action.now) >= BREAK_SECONDS)) return state
      return { ...state, activeSession: { ...active, runningSince: action.now } }
    }
    case 'TAKE_BREAK': {
      const active = state.activeSession
      if (!active || active.phase !== 'study') return state
      return {
        ...state,
        activeSession: {
          ...active,
          phase: 'break',
          studySeconds: sessionStudySeconds(active, action.now),
          elapsedMs: 0,
          runningSince: action.now,
        },
      }
    }
    case 'CONTINUE_STUDY': {
      const active = state.activeSession
      if (!active || active.phase !== 'break') return state
      return {
        ...state,
        activeSession: continueStudySession(active, action.now),
      }
    }
    case 'FINISH': {
      const active = state.activeSession
      if (!active) return state
      const total = sessionStudySeconds(active, action.now)
      const focus = normalizeFocusTotals(active.focus)
      const observedMs = Math.min(Math.round(total * 1000), Math.round(focus.observedMs))
      const focusedMs = Math.min(observedMs, Math.round(focus.focusedMs))
      const record = {
        id: active.id,
        roomId: active.roomId,
        characterIds: active.characterIds,
        tier: active.tier,
        targetSeconds: studyGoalSeconds(active),
        startedAt: active.startedAt,
        endedAt: action.now,
        studySeconds: total,
        observedSeconds: observedMs / 1000,
        focusSeconds: focusedMs / 1000,
        awaySeconds: (observedMs - focusedMs) / 1000,
        returns: focus.returns,
        completed: total >= studyGoalSeconds(active),
        automatic: false,
      }
      return {
        ...state,
        activeSession: null,
        latestRecordId: record.id,
        records: [record, ...state.records],
      }
    }
    case 'UPGRADE': {
      const active = state.activeSession
      if (!active || tierById(action.tier).price <= tierById(active.tier).price) return state
      const cost = Math.max(0, tierCost(state, action.tier, action.now) - active.paidCredits)
      if (cost > state.credits) return state
      const next = cost
        ? transaction(state, {
            id: `upgrade-${action.now}`,
            at: action.now,
            kind: 'use',
            description: `대화 옵션 변경 · ${tierById(active.tier).name} → ${tierById(action.tier).name} (차액)`,
            change: -cost,
          })
        : state
      return {
        ...next,
        pass:
          state.pass && action.tier === 'premium' && cost === 0
            ? { ...state.pass, premiumDay: businessDay(action.now) }
            : state.pass,
        activeSession: { ...active, tier: action.tier, paidCredits: active.paidCredits + cost },
      }
    }
    case 'MESSAGE': {
      const active = state.activeSession
      if (!active || !action.text.trim() || !active.characterIds.includes(action.characterId))
        return state
      const used = state.chatUsage.day === businessDay(action.now) ? state.chatUsage.used : 0
      const reply = /졸|피곤/.test(action.text)
        ? '나도 졸려. 5분만 더 버티고 쉬자.'
        : /시험|긴장/.test(action.text)
          ? '그동안 준비한 거 내가 봤잖아. 너무 걱정하지 마. 같이 조금만 더 해 보자.'
          : /어려|모르/.test(action.text)
            ? '어려운 부분은 잠깐 표시해 두고, 할 수 있는 것부터 같이 해 보자.'
            : `${state.profile.name}, 잘하고 있어. 나도 여기서 같이 할게.`
      const common = { sessionId: active.id, characterId: action.characterId, createdAt: action.now }
      return {
        ...state,
        chatUsage: {
          day: businessDay(action.now),
          used: active.tier === 'basic' ? used + 1 : used,
        },
        messages: [
          ...state.messages,
          {
            ...common,
            id: `user-${action.now}-${state.messages.length}`,
            sender: 'user',
            text: action.text.trim().slice(0, 500),
            voice: !!action.voice,
          },
          ...(action.reply === 'llm'
            ? []
            : [{
                ...common,
                id: `reply-${action.now}-${state.messages.length}`,
                sender: 'character' as const,
                text: reply,
                voice: false,
              }]),
        ],
      }
    }
    case 'CHARACTER_REPLY':
      if (!action.text.trim()) return state
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            id: `reply-${action.now}-${state.messages.length}`,
            createdAt: action.now,
            sessionId: action.sessionId,
            characterId: action.characterId,
            sender: 'character',
            text: action.text.trim().slice(0, 500),
            voice: false,
          },
        ],
      }
    case 'PURCHASE': {
      const product = chargeProducts.find((p) => p.id === action.productId)
      if (!product) return state
      const entry = {
        id: `purchase-${action.now}`,
        at: action.now,
        kind: product.days ? ('payment' as const) : ('charge' as const),
        change: product.credits + product.bonus,
        description: `${product.name} · ${action.method}${product.bonus ? ` (+보너스 ${product.bonus})` : ''}`,
        amount: product.amount,
      }
      if (state.ledger.some((row) => row.id === entry.id)) return state
      const next = transaction(state, entry)
      return product.days
        ? {
            ...next,
            pass: {
              name: product.name,
              expiresAt: Math.max(action.now, state.pass?.expiresAt ?? 0) + product.days * 86400000,
              premiumDay: state.pass?.premiumDay ?? null,
            },
          }
        : next
    }
    case 'GIFT': {
      const product = products.find((p) => p.id === action.productId)
      if (!product || product.price > state.credits) return state
      const id = `gift-${action.now}-${action.productId}`
      if (state.gifts.some((gift) => gift.id === id)) return state
      const next = transaction(state, {
        id,
        at: action.now,
        kind: 'use',
        description: `${product.kind} · ${action.characterName} · ${product.name}`,
        change: -product.price,
      })
      return {
        ...next,
        gifts: [
          {
            id,
            characterId: action.characterId,
            productId: product.id,
            name: product.name,
            at: action.now,
            reply: product.reply,
            voice: product.kind === '보이스',
          },
          ...state.gifts,
        ],
      }
    }
    case 'MEMORY':
      if (action.memory.date < MIN_CALENDAR_DATE) return state
      return {
        ...state,
        memories: state.memories.some((memory) => memory.id === action.memory.id)
          ? state.memories.map((memory) =>
              memory.id === action.memory.id ? action.memory : memory,
            )
          : [...state.memories, action.memory],
      }
    case 'DELETE_MEMORY':
      return { ...state, memories: state.memories.filter((memory) => memory.id !== action.id) }
  }
}
import { resolveProfileName } from './profile.ts'
