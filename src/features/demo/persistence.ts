import { createDemoState } from './seed'
import { isTier } from './catalog'
import type { DemoState } from './types'
import { migrateDemoProfile } from './profile'
import { migrateSampleRecords } from './sample-records'

export const DEMO_STORAGE_KEY = 'capsule-wireframe-demo:v1'

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

function validState(value: unknown): value is DemoState {
  if (
    !object(value) ||
    value.version !== 1 ||
    !object(value.profile) ||
    !object(value.profile.avatar)
  )
    return false
  const profile = value.profile
  const avatar = value.profile.avatar
  if (
    typeof profile.name !== 'string' ||
    typeof profile.loggedIn !== 'boolean' ||
    typeof profile.onboarded !== 'boolean' ||
    !['hair', 'outfit', 'appearance', 'background'].every((key) => finite(avatar[key]))
  )
    return false
  if (
    !finite(value.credits) ||
    value.credits < 0 ||
    !Array.isArray(value.ledger) ||
    !value.ledger.every(
      (entry) =>
        object(entry) &&
        typeof entry.id === 'string' &&
        finite(entry.at) &&
        finite(entry.change) &&
        finite(entry.balance) &&
        typeof entry.description === 'string',
    )
  )
    return false
  if (
    !Array.isArray(value.records) ||
    !value.records.every(
      (record) =>
        object(record) &&
        typeof record.id === 'string' &&
        typeof record.roomId === 'string' &&
        strings(record.characterIds) &&
        isTier(record.tier) &&
        ['startedAt', 'endedAt', 'studySeconds', 'focusSeconds', 'awaySeconds', 'returns'].every(
          (key) => finite(record[key]),
        ),
    )
  )
    return false
  if (
    !Array.isArray(value.memories) ||
    !value.memories.every(
      (memory) =>
        object(memory) &&
        ['id', 'characterId', 'kind', 'title', 'date', 'time'].every(
          (key) => typeof memory[key] === 'string',
        ),
    )
  )
    return false
  if (
    !Array.isArray(value.messages) ||
    !value.messages.every(
      (message) =>
        object(message) &&
        ['id', 'sessionId', 'characterId', 'sender', 'text'].every(
          (key) => typeof message[key] === 'string',
        ),
    )
  )
    return false
  if (
    !Array.isArray(value.gifts) ||
    !value.gifts.every(
      (gift) =>
        object(gift) &&
        ['id', 'characterId', 'name', 'reply', 'productId'].every(
          (key) => typeof gift[key] === 'string',
        ) &&
        finite(gift.at),
    )
  )
    return false
  if (value.activeSession !== null) {
    const active = value.activeSession
    if (
      !object(active) ||
      typeof active.id !== 'string' ||
      typeof active.roomId !== 'string' ||
      !strings(active.characterIds) ||
      !isTier(active.tier) ||
      !['study', 'break'].includes(String(active.phase)) ||
      !['elapsedMs', 'studySeconds', 'startedAt', 'paidCredits'].every((key) =>
        finite(active[key]),
      ) ||
      !(active.runningSince === null || finite(active.runningSince))
    )
      return false
  }
  return (
    typeof value.firstVisit === 'boolean' &&
    typeof value.cameraChecked === 'boolean' &&
    typeof value.cameraEnabled === 'boolean' &&
    strings(value.examPromptedRooms) &&
    strings(value.savedRooms) &&
    object(value.chatUsage) &&
    typeof value.chatUsage.day === 'string' &&
    finite(value.chatUsage.used) &&
    (value.pass === null ||
      (object(value.pass) && typeof value.pass.name === 'string' && finite(value.pass.expiresAt)))
  )
}

export function loadDemoState(): DemoState {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY) ?? 'null')
    return validState(saved) ? migrateSampleRecords(migrateDemoProfile(saved)) : createDemoState()
  } catch {
    return createDemoState()
  }
}
