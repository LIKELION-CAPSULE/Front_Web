export const REFERRAL_CODE_MAX_LENGTH = 20
export const REFERRAL_STORAGE_KEY = 'capsule-referral-link:v1'
export const REFERRAL_TTL_MS = 7 * 24 * 60 * 60 * 1000

export type ReferralValidationResult =
  | { valid: true; inviterNickname?: string }
  | { valid: false; reason: 'invalid' | 'self' | 'already_registered'; message: string }

export interface StoredReferralCode {
  code: string
  inviterNickname?: string
  expiresAt: number
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

type ReferralListener = (stored: { code: string; inviterNickname?: string }) => void
const referralListeners = new Set<ReferralListener>()
let memoryReferral: StoredReferralCode | null = null

/** Trim whitespace, uppercase ASCII letters, and clamp to max 20 characters. */
export function normalizeReferralCode(raw: string): string {
  return raw.trim().toUpperCase().slice(0, REFERRAL_CODE_MAX_LENGTH)
}

/** Never overwrite a referral value that the user has already typed or non-empty input. */
export function shouldApplyIncomingReferral(currentValue: string, userEdited: boolean): boolean {
  return !userEdited && currentValue.trim().length === 0
}

/**
 * Format Korean particle greeting for onboarding nickname reaction.
 * - Korean last syllable with batchim: "{name}이구나, 반가워!"
 * - Korean last syllable without batchim: "{name}구나, 반가워!"
 * - Non-Korean last character: "{name}, 반가워!"
 */
export function formatNicknameGreeting(rawNickname: string): string {
  const name = rawNickname.trim()
  if (!name) return '반가워!'
  const chars = Array.from(name)
  const lastChar = chars[chars.length - 1] ?? ''
  const code = lastChar.codePointAt(0) ?? 0
  if (code >= 0xac00 && code <= 0xd7a3) {
    const hasBatchim = (code - 0xac00) % 28 !== 0
    return hasBatchim ? `${name}이구나, 반가워!` : `${name}구나, 반가워!`
  }
  return `${name}, 반가워!`
}

function defaultStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function subscribeStoredReferralCode(listener: ReferralListener): () => void {
  referralListeners.add(listener)
  return () => {
    referralListeners.delete(listener)
  }
}

export function saveStoredReferralCode(
  rawCode: string,
  inviterNickname?: string,
  storage: StorageLike | null = defaultStorage(),
  now = Date.now(),
): boolean {
  const code = normalizeReferralCode(rawCode)
  if (!code) return false
  const payload: StoredReferralCode = {
    code,
    ...(inviterNickname ? { inviterNickname } : {}),
    expiresAt: now + REFERRAL_TTL_MS,
  }
  if (storage === defaultStorage()) {
    memoryReferral = payload
  }
  let saved = false
  if (storage) {
    try {
      storage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(payload))
      saved = true
    } catch {
      saved = false
    }
  }
  for (const listener of referralListeners) {
    try {
      listener({ code, ...(inviterNickname ? { inviterNickname } : {}) })
    } catch {
      // Never break caller
    }
  }
  return saved
}

export function readStoredReferralCode(
  now = Date.now(),
  storage: StorageLike | null = defaultStorage(),
): { code: string; inviterNickname?: string } | null {
  const useDefault = storage === defaultStorage()
  if (storage) {
    try {
      const raw = storage.getItem(REFERRAL_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StoredReferralCode> | null
        if (!parsed || typeof parsed.code !== 'string' || typeof parsed.expiresAt !== 'number') {
          storage.removeItem(REFERRAL_STORAGE_KEY)
        } else if (now >= parsed.expiresAt) {
          storage.removeItem(REFERRAL_STORAGE_KEY)
        } else {
          const code = normalizeReferralCode(parsed.code)
          if (code) {
            return {
              code,
              ...(typeof parsed.inviterNickname === 'string' && parsed.inviterNickname.trim()
                ? { inviterNickname: parsed.inviterNickname.trim() }
                : {}),
            }
          }
        }
      }
    } catch {
      // Fall through to in-memory copy if available
    }
  }
  if (useDefault && memoryReferral) {
    if (now >= memoryReferral.expiresAt) {
      memoryReferral = null
      return null
    }
    // Mirror into current storage (e.g. after local-demo scopes window.localStorage)
    if (storage) {
      try {
        storage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(memoryReferral))
      } catch {
        // Ignore
      }
    }
    return {
      code: memoryReferral.code,
      ...(memoryReferral.inviterNickname ? { inviterNickname: memoryReferral.inviterNickname } : {}),
    }
  }
  return null
}

export function clearStoredReferralCode(storage: StorageLike | null = defaultStorage()): void {
  if (storage === defaultStorage()) {
    memoryReferral = null
  }
  if (!storage) return
  try {
    storage.removeItem(REFERRAL_STORAGE_KEY)
  } catch {
    // Ignore storage removal errors
  }
}

/** The invite link's own address (35 `link`: `https://capsule.ai.kr/i/<code>`) opens the invitation screen. */
export const INVITE_LINK_TARGET = '/invite'
const INVITE_LINK_PATH = /^\/i\/([^/]+)\/?$/

/**
 * Synchronously captures the invite link's code before React renders — `/i/<code>` (35 `link`) or `?ref=<code>` —
 * stores it for 7 days (whose code it is is checked with 39 where it is used: signup, onboarding, 친구 초대) and
 * cleans the browser URL via history.replaceState: `ref` is removed; `/i/<code>` becomes `/invite` (a guest signs in
 * or up first and comes back to it, post-auth.ts `isSharedLink`).
 */
export function captureReferralFromLocation(
  loc: Pick<Location, 'pathname' | 'search' | 'hash'> | undefined = typeof window !== 'undefined'
    ? window.location
    : undefined,
  hist: Pick<History, 'replaceState'> | undefined = typeof window !== 'undefined'
    ? window.history
    : undefined,
  storage: StorageLike | null = defaultStorage(),
  now = Date.now(),
): { code: string } | null {
  if (!loc) return null
  const linkPath = INVITE_LINK_PATH.exec(loc.pathname)
  if (linkPath) {
    let raw = linkPath[1]!
    try { raw = decodeURIComponent(raw) } catch { /* Kept as typed. */ }
    const code = normalizeReferralCode(raw)
    if (code) saveStoredReferralCode(code, undefined, storage, now)
    const rest = new URLSearchParams(loc.search)
    rest.delete('ref')
    try {
      hist?.replaceState(typeof window !== 'undefined' ? window.history.state : null, '', `${INVITE_LINK_TARGET}${rest.size ? `?${rest}` : ''}${loc.hash}`)
    } catch {
      // Ignore restricted history APIs
    }
    return code ? { code } : null
  }
  if (!loc.search) return null
  const params = new URLSearchParams(loc.search)
  const rawRef = params.get('ref')
  if (!rawRef) return null
  const code = normalizeReferralCode(rawRef)
  if (code) {
    saveStoredReferralCode(code, undefined, storage, now)
  }
  params.delete('ref')
  const nextUrl = `${loc.pathname}${params.size ? `?${params}` : ''}${loc.hash}`
  try {
    hist?.replaceState(typeof window !== 'undefined' ? window.history.state : null, '', nextUrl)
  } catch {
    // Ignore restricted history APIs
  }
  return code ? { code } : null
}

/** Shared mock referral validator used by local-demo & review ports (never called in api mode). */
export function simulateMockReferralValidation(
  rawCode: string,
  options: { alreadyRegistered?: boolean; ownCode?: string } = {},
): ReferralValidationResult {
  const code = normalizeReferralCode(rawCode)
  if (options.alreadyRegistered) {
    return { valid: false, reason: 'already_registered', message: '이미 초대 코드가 등록된 계정이에요.' }
  }
  if (!code) {
    return { valid: false, reason: 'invalid', message: '초대 코드를 확인해 주세요.' }
  }
  if (code === 'SELF' || (options.ownCode && code === normalizeReferralCode(options.ownCode))) {
    return { valid: false, reason: 'self', message: '내 초대 코드는 입력할 수 없어요.' }
  }
  if (code === 'FRIEND1000' || code === 'CAPSULE2026') {
    return { valid: true, inviterNickname: '민수' }
  }
  return { valid: false, reason: 'invalid', message: '확인할 수 없는 코드예요. 지우거나 고쳐 주세요' }
}
