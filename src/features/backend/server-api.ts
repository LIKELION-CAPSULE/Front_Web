import type { ApiClient } from '../../shared/api/client.ts'
import type {
  ChatRoomResponse, CreditSummaryResponse, CreditTransactionFilter, CreditTransactionsResponse, EnterReferralRequest,
  FeedbackCreated, FeedbackRequest, LoginMatesResponse, MateDetailResponse, MeResponse, MessageRatingRequest,
  MessageReportRequest, MessageReportResponse, MyMatesResponse, NotificationList, RecordsRange, RecordsResponse,
  ReferralEntered, ReferralStatus, Unread, UpdateMeRequest, UserSettings, UserSettingsPatch,
} from '../../shared/api/types.ts'

/**
 * Data functions for the 11-25 API (docs/BACKEND_API.md numbers in brackets). Thin wrappers: path, method and body only;
 * callers validate what they use. The local mock (local-demo/transport.ts) answers the same paths in the same shapes.
 */
type Client = Pick<ApiClient, 'request'>

function query(values: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  return search.size ? `?${search}` : ''
}
const segment = (value: string | number) => encodeURIComponent(String(value))

// ── Account ──
/** [8] Also grants the day's attendance credits. */
export const getMe = (client: Client) => client.request<MeResponse>('/me')
/** [10] Only the fields sent are changed. */
export const updateMe = (client: Client, body: UpdateMeRequest) => client.request<MeResponse>('/me', { method: 'PATCH', body })
/** [29] */
export const getSettings = (client: Client) => client.request<UserSettings>('/me/settings')
/** [30] Only the keys sent; `null` restores the default. Returns all seven. */
export const updateSettings = (client: Client, body: UserSettingsPatch) => client.request<UserSettings>('/me/settings', { method: 'PATCH', body })

// ── Mates ──
/** [31] */
export const getMateDetail = (client: Client, mateId: number) => client.request<MateDetailResponse>(`/mates/${segment(mateId)}`)
/** [48] Public (no login); 5-minute public cache upstream. */
export const getLoginMates = (client: Client) => client.request<LoginMatesResponse>('/login-mates', { auth: false })
/** [37] Mates connected at least once, last connected first. */
export const getMyMates = (client: Client) => client.request<MyMatesResponse>('/mates/me')
/** [46] '알림 받기' for a coming-soon mate (204). */
export const requestMateAlert = (client: Client, mateId: number) => client.request<null>(`/mates/${segment(mateId)}/alert`, { method: 'POST' })

// ── Chat room ──
/** [32] Newest first; `size` 1–50 (default 20). */
export const getChatRoom = (client: Client, mateId: number, page: { cursor?: string | null; size?: number } = {}) =>
  client.request<ChatRoomResponse>(`/mates/${segment(mateId)}/messages${query({ cursor: page.cursor, size: page.size })}`)
/** [47] 204. Hides the chat room and deletes memory; intimacy, unlocks and credits stay. 409 `CONNECTION_IN_PROGRESS`. */
export const resetConversation = (client: Client, mateId: number) => client.request<null>(`/mates/${segment(mateId)}/conversation/reset`, { method: 'POST' })
/** [40] `requestId` of the mate's reply. 204. `null` cancels. */
export const rateMessage = (client: Client, requestId: string, rating: MessageRatingRequest['rating']) =>
  client.request<null>(`/messages/${segment(requestId)}/rating`, { method: 'PUT', body: { rating } satisfies MessageRatingRequest })
/** [41] 201. `detail` is required for `OTHER` (≤ 300). 409 `ALREADY_REPORTED`. */
export const reportMessage = (client: Client, requestId: string, body: MessageReportRequest) =>
  client.request<MessageReportResponse>(`/messages/${segment(requestId)}/report`, { method: 'POST', body })

// ── Credits · referrals ──
/** [33] */
export const getCredits = (client: Client) => client.request<CreditSummaryResponse>('/credits')
/** [34] Newest first. */
export const getCreditTransactions = (client: Client, page: { filter?: CreditTransactionFilter; cursor?: string | null; size?: number } = {}) =>
  client.request<CreditTransactionsResponse>(`/credits/transactions${query({ filter: page.filter, cursor: page.cursor, size: page.size })}`)
/** [35] */
export const getMyReferral = (client: Client) => client.request<ReferralStatus>('/referrals/me')
/** [36] Within 7 days of signup, once. 201. */
export const enterReferral = (client: Client, body: EnterReferralRequest) => client.request<ReferralEntered>('/referrals', { method: 'POST', body })
/** [39] Public (no login). 404 `REFERRAL_CODE_NOT_FOUND`. Does not check own code, the 7 days or an earlier entry. */
export const checkReferral = (client: Client, code: string) => client.request<ReferralEntered>(`/referrals/${segment(code.trim())}`, { auth: false })

// ── Records ──
/** [38] `range` is required; `date` is `YYYY-MM-DD` (default: today from 05:00 KST). */
export const getRecords = (client: Client, input: { range: RecordsRange; date?: string; mateId?: number }) =>
  client.request<RecordsResponse>(`/records${query({ range: input.range, date: input.date, mateId: input.mateId })}`)

// ── Notifications · feedback · waitlist ──
/** [43] Newest first; `size` 1–50. */
export const getNotifications = (client: Client, page: { before?: number | null; size?: number } = {}) =>
  client.request<NotificationList>(`/notifications${query({ before: page.before, size: page.size })}`)
/** [44] Without ids: all. */
export const readNotifications = (client: Client, ids?: number[]) =>
  client.request<Unread>('/notifications/read', { method: 'POST', body: ids ? { ids } : {} })
/** [42] RATING once a day (409 `FEEDBACK_ALREADY_TODAY`). */
export const sendFeedback = (client: Client, body: FeedbackRequest) => client.request<FeedbackCreated>('/feedback', { method: 'POST', body })
/** [45] Public (no login). 204 even when already on the list. */
export const joinWaitlist = (client: Client, email: string) => client.request<null>('/beta/waitlist', { method: 'POST', auth: false, body: { email } })
