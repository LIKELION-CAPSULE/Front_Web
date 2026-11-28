import { normalizeAffinityStage } from './affinity-stages.ts'

type StageLike = { stage?: number | null; stageName?: string | null } | null | undefined
export type CallIntimacy = { stage: number; stageName: string }

/**
 * The call header's intimacy chip (친밀도 1–5, AFFINITY_STAGES; user decision A, 2026-11-28): the stage of 16
 * `relation` (this connection's start), raised by a 21 heartbeat `stageUp` the moment it comes, so the chip, the chat's
 * stage-up line and the stage's card show the same stage. Names go through `normalizeAffinityStage` (a missing name
 * takes the table's). 20 / 28 `affinity` (호감도, a different measure) never decides it. Null: no stage known (「—」).
 */
export function callIntimacy(start: StageLike, stageUp: StageLike): CallIntimacy | null {
  const base = start ? normalizeAffinityStage(start.stage, start.stageName) : null
  const reached = stageUp ? normalizeAffinityStage(stageUp.stage, stageUp.stageName) : null
  const best = reached && (!base || reached.stage > base.stage) ? reached : base
  return best ? { stage: best.stage, stageName: best.stageName } : null
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>
const key = (connectionId: string) => `capsule-call-intimacy:${connectionId}`

/**
 * 17 resume has no `relation`: the stage this tab last showed for the connection is kept in session storage, so a
 * reload mid-call keeps the chip instead of falling back to 「—」. Storage failures only lose that (never throw).
 */
export function rememberCallIntimacy(connectionId: string, value: CallIntimacy | null, storage: StorageLike | undefined = sessionStorageOrUndefined()) {
  if (!value || !storage) return
  try {
    const saved = recallCallIntimacy(connectionId, storage)
    if (saved && saved.stage >= value.stage) return
    storage.setItem(key(connectionId), JSON.stringify(value))
  } catch { /* The chip still works for this page. */ }
}

export function recallCallIntimacy(connectionId: string, storage: StorageLike | undefined = sessionStorageOrUndefined()): CallIntimacy | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(key(connectionId))
    const parsed = raw ? JSON.parse(raw) as StageLike : null
    return parsed ? callIntimacy(parsed, null) : null
  } catch {
    return null
  }
}

function sessionStorageOrUndefined(): StorageLike | undefined {
  try {
    return typeof sessionStorage === 'undefined' ? undefined : sessionStorage
  } catch {
    return undefined
  }
}
