/**
 * `deviceHash` for 4 signup, 6 Kakao and 36 referral (1–64 chars). The backend keeps it per signup device
 * (`signup_devices`) only to refuse a referral code entered from the inviter's own device (`REFERRAL_SAME_DEVICE`).
 *
 * Proposal: a random 128-bit id made once per browser profile and kept in localStorage (not per account, and kept
 * across logout and withdrawal, so the same device stays the same device), sent as its SHA-256 hex (64 chars). It is not
 * derived from any personal data or fingerprint; clearing site data makes a new one. Without storage the id lives in
 * memory for this page only.
 */
export const DEVICE_ID_KEY = 'capsule-device:v1'
const DEVICE_ID = /^[0-9a-f]{32}$/

let memoryId: string | null = null
let pending: Promise<string> | null = null

function randomId() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

/** The stored device id, created on first use. */
export function deviceId(storage: Pick<Storage, 'getItem' | 'setItem'> | null = defaultStorage()): string {
  try {
    const saved = storage?.getItem(DEVICE_ID_KEY)
    if (saved && DEVICE_ID.test(saved)) return saved
  } catch { /* Storage blocked: fall back to memory. */ }
  const id = randomId()
  try {
    if (storage) { storage.setItem(DEVICE_ID_KEY, id); return id }
  } catch { /* Memory only. */ }
  memoryId ??= id
  return memoryId
}

export async function hashDeviceId(id: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`capsule-device:${id}`))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

/** 64 lowercase hex characters. */
export function deviceHash(storage?: Pick<Storage, 'getItem' | 'setItem'> | null): Promise<string> {
  if (storage !== undefined) return hashDeviceId(deviceId(storage))
  pending ??= hashDeviceId(deviceId()).catch(error => { pending = null; throw error })
  return pending
}

function defaultStorage() {
  try { return globalThis.localStorage ?? null } catch { return null }
}
