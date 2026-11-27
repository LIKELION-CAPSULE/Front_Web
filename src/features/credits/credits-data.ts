import { ApiError } from '../../shared/api/client.ts'
import type {
  CreditSummaryResponse, CreditTransaction, CreditTransactionFilter, CreditTransactionsResponse, ReferralEntered,
  ReferralStatus,
} from '../../shared/api/types.ts'
import { CREDIT_PRICING } from './credit-utils.ts'

/**
 * 내 크레딧 · 친구 초대 · 출석 from the server (docs/BACKEND_API.md 33 · 34 · 35 · 36 · 39). Every field is optional on
 * the wire (OpenAPI marks none required), so each adapter states what it cannot do without and what it fills in:
 * - 33 needs `todayRemaining` (the balance); the rest default to 0 / unknown.
 * - 34 needs `items[]`; an item without a numeric `change` or a readable `createdAt` is left out.
 * - 35 needs an object; a missing code shows 「준비 중」, counts default to 0, `canEnterCode` to false.
 * Server copy stays as sent except where the screen names things differently (`displayTitle`).
 */

export type CreditKind = 'attendance' | 'invite' | 'use' | 'expiration' | 'other'
export type CreditEntry = { id: string; at: number; title: string; kind: CreditKind; change: number; balance: number | null }
export type CreditSummary = {
  /** 「남은 크레딧」 = attendance + invitation part. */
  remaining: number
  attendance: number
  /** When today's attendance part disappears (next 05:00 KST); null when not sent. */
  attendanceExpiresAt: number | null
  invite: number
  todayUsed: number
  /** Invitation rewards received (33 `invitedFriends`). */
  invitedFriends: number
}
export type CreditPage = { entries: CreditEntry[]; nextCursor: string | null }
export type ReferralFriendView = { key: string; nickname: string | null; status: 'joined' | 'qualified' | 'other'; rewarded: boolean; joinedAt: number | null }
export type ReferralView = {
  code: string
  link: string
  rewardedCount: number
  maxRewards: number
  rewardedCredits: number
  friends: ReferralFriendView[]
  canEnterCode: boolean
  codeInputDeadline: number | null
}
export type ReferralOwner = { inviterNickname?: string; reward: number }

/** The screen's filter tabs are the server's filters (34 `filter`). */
export const CREDIT_FILTERS: readonly { id: CreditTransactionFilter; label: string }[] = [
  { id: 'ALL', label: '전체' },
  { id: 'ATTENDANCE', label: '출석' },
  { id: 'USE', label: '사용' },
  { id: 'INVITE', label: '초대' },
]

export class CreditDataError extends ApiError {
  constructor(message: string) { super(message, 502, 'INVALID_RESPONSE') }
}

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const count = (value: unknown, fallback = 0) => finite(value) ? Math.max(0, Math.trunc(value)) : fallback
const time = (value: unknown) => {
  if (typeof value !== 'string' || !value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null

/** [33] → the summary card. Throws without a balance. */
export function creditSummary(dto: CreditSummaryResponse | null | undefined): CreditSummary {
  if (!object(dto) || !finite(dto.todayRemaining)) throw new CreditDataError('크레딧 정보를 확인하지 못했어요.')
  const remaining = Math.max(0, dto.todayRemaining)
  const attendance = count(dto.attendanceRemaining)
  const invite = finite(dto.inviteBalance) ? Math.max(0, dto.inviteBalance) : Math.max(0, remaining - attendance)
  return {
    remaining, attendance, invite, attendanceExpiresAt: time(dto.attendanceExpiresAt),
    todayUsed: count(dto.todayUsed), invitedFriends: count(dto.invitedFriends),
  }
}

const KINDS: Record<string, CreditKind> = { ATTENDANCE: 'attendance', INVITE: 'invite', USE: 'use', EXPIRE: 'expiration' }
const FALLBACK_TITLES: Record<CreditKind, string> = { attendance: '출석', invite: '친구 초대', use: '사용', expiration: '출석분 소멸', other: '크레딧 변동' }

/**
 * The server's ledger line as the screen names it. The server writes 「보이스 대화」 (4.5 `보이스 대화 · 채린`); the app
 * calls that feature 「메이트 음성」 everywhere, so only the display changes. Anything else is shown as sent.
 */
export function displayTitle(title: string | null | undefined, kind: CreditKind): string {
  const value = text(title)
  if (!value) return FALLBACK_TITLES[kind]
  return value.replaceAll('보이스 대화', '메이트 음성')
}

/** [34] one item, or null when it cannot be shown. */
export function creditEntry(item: CreditTransaction | null | undefined, index = 0): CreditEntry | null {
  if (!object(item) || !finite(item.change)) return null
  const at = time(item.createdAt)
  if (at === null) return null
  const kind = (typeof item.type === 'string' && KINDS[item.type]) || 'other'
  const id = finite(item.id) || (typeof item.id === 'string' && item.id) ? String(item.id) : `${at}-${index}`
  return { id, at, kind, title: displayTitle(item.title, kind), change: item.change, balance: finite(item.balanceAfter) ? item.balanceAfter : null }
}

/** [34] → one page of the activity list. Throws without `items`. */
export function creditPage(dto: CreditTransactionsResponse | null | undefined): CreditPage {
  if (!object(dto) || !Array.isArray(dto.items)) throw new CreditDataError('크레딧 내역을 확인하지 못했어요.')
  const entries = dto.items.flatMap((item, index) => { const entry = creditEntry(item, index); return entry ? [entry] : [] })
  return { entries, nextCursor: text(dto.nextCursor) }
}

/** Appends a further page; an entry already shown (same id) is not repeated. */
export function appendCreditPage(shown: readonly CreditEntry[], page: CreditPage): CreditEntry[] {
  const seen = new Set(shown.map(entry => entry.id))
  return [...shown, ...page.entries.filter(entry => !seen.has(entry.id))]
}

const FRIEND_STATUS: Record<string, ReferralFriendView['status']> = { JOINED: 'joined', QUALIFIED: 'qualified' }

/** [35] → the invitation screen. Throws without an object. */
export function referralView(dto: ReferralStatus | null | undefined): ReferralView {
  if (!object(dto)) throw new CreditDataError('초대 정보를 확인하지 못했어요.')
  const maxRewards = count(dto.maxRewards, CREDIT_PRICING.inviteMaxCount) || CREDIT_PRICING.inviteMaxCount
  const friends = (Array.isArray(dto.friends) ? dto.friends : []).flatMap((friend, index): ReferralFriendView[] => {
    if (!object(friend)) return []
    const joinedAt = time(friend.joinedAt)
    return [{
      key: `${index}-${joinedAt ?? ''}`, nickname: text(friend.nickname), joinedAt,
      status: (typeof friend.status === 'string' && FRIEND_STATUS[friend.status]) || 'other', rewarded: friend.rewarded === true,
    }]
  })
  return {
    code: text(dto.code) ?? '', link: text(dto.link) ?? '', rewardedCount: count(dto.rewardedCount), maxRewards,
    rewardedCredits: count(dto.rewardedCredits), friends, canEnterCode: dto.canEnterCode === true, codeInputDeadline: time(dto.codeInputDeadline),
  }
}

/** [36] · [39] → whose code it is and what entering it brings. */
export function referralOwner(dto: ReferralEntered | null | undefined): ReferralOwner {
  const value = object(dto) ? dto : {}
  const inviterNickname = text(value.inviterNickname)
  return { ...(inviterNickname ? { inviterNickname } : {}), reward: count(value.rewardOnFirstConnection, CREDIT_PRICING.inviteReward) || CREDIT_PRICING.inviteReward }
}

/** [36] · [39] refusals, by code. */
export const REFERRAL_ERRORS = {
  REFERRAL_CODE_NOT_FOUND: '확인할 수 없는 코드예요. 지우거나 고쳐 주세요',
  REFERRAL_SELF: '내 초대 코드는 입력할 수 없어요.',
  REFERRAL_EXPIRED: '초대 코드는 가입 후 7일 안에만 입력할 수 있어요.',
  REFERRAL_SAME_DEVICE: '같은 기기에서 가입한 계정의 코드는 입력할 수 없어요.',
  REFERRAL_ALREADY_ENTERED: '이미 초대 코드를 입력했어요.',
} as const
export type ReferralErrorCode = keyof typeof REFERRAL_ERRORS

/** The refusal of a code (its message for the field), or null for any other failure (network, server). */
export function referralRefusal(error: unknown): { code: ReferralErrorCode; message: string; closesForm: boolean } | null {
  if (!(error instanceof ApiError) || !error.code || !Object.hasOwn(REFERRAL_ERRORS, error.code)) return null
  const code = error.code as ReferralErrorCode
  // After these the field cannot be used again: 35 is read again and the form closes.
  return { code, message: REFERRAL_ERRORS[code], closesForm: code === 'REFERRAL_EXPIRED' || code === 'REFERRAL_ALREADY_ENTERED' }
}
