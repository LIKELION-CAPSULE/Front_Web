import type { BetaAccountDetails } from '../auth/beta-account.ts'
import type { BetaWallet } from '../credits/beta-types.ts'
import type { Message, StudyRecord } from '../demo/types.ts'
import type { ReportResponse, MeResponse, AffinityChange, ActiveConnectionSummary, ConnectionTotals, Credits, EndType, IntimacyView, UpdateMeRequest } from '../../shared/api/types.ts'
import { LOCAL_CACHE_PREFIX, LOCAL_PANEL_OPEN_KEY } from './storage.ts'
import { mateProfileByName } from '../mates/catalog.ts'
import { REFERRAL_STORAGE_KEY } from '../auth/referral-code.ts'
import { isPatternRecordId, isRecordPattern, PATTERN_ID_BASE, patternSessions, type RecordPattern } from './record-patterns.ts'
import { attendanceSource } from '../attendance/attendance-source.ts'
import { attendanceFromDays } from '../attendance/attendance-model.ts'
import { DAILY_ATTENDANCE_CREDIT } from '../attendance/attendance-config.ts'
import { businessDay } from '../../shared/lib/format.ts'

export {
  LOCAL_MODEL_URL,
  LOCAL_V2_ENGINE_URL,
  LOCAL_V2_MODEL_URL,
  LOCAL_V2_PLAYER_URL,
  LOCAL_V2_REACTIONS_URL,
} from './local-asset-urls.ts'

export const LOCAL_USER_ID = 990101
/** 11-25: the mate id is the character id (16 `mateId` = 20 `characterId`). */
export const LOCAL_CHARACTER_ID = 990301
/** 서도현 (second mate, model bundle `seojin`; server name 「서진」, mapped by catalog.ts `sourceNames`). */
export const LOCAL_DOHYUN_CHARACTER_ID = 990302
/** @deprecated 11-22 room ids; the app's room id is the mate id since 11-25. */
export const LOCAL_ROOM_ID = LOCAL_CHARACTER_ID
/** @deprecated see LOCAL_ROOM_ID. */
export const LOCAL_DOHYUN_ROOM_ID = LOCAL_DOHYUN_CHARACTER_ID
export const LOCAL_STORAGE_KEY = 'capsule-local-beta:v1'
/** 채린's local reply and closing line: her persona lines (mate-lines.ts), as 서도현's are his. */
export const LOCAL_REPLY = '…그거 나도 몰라. 같이 찾아보든가. 너 혼자 끙끙대는 거 보기 답답하니까.'
const CHAERIN_CLOSING_LINE = '다 했네? …뭐, 오늘은 좀 봐줄게. 수고했어.'

/**
 * The local mates, in the server's shape (mate id = character id, server name). `mateId` is the front-end catalog id.
 * The boy mate carries the production server name 「서진」 so the name mapping is exercised as against the real server.
 * Replies and closing lines are each mate's own (서도현's from his persona, mate-lines.ts), never mixed.
 */
export const LOCAL_MATES = [
  { characterId: LOCAL_CHARACTER_ID, name: '채린', mateId: 'chaerin', reply: LOCAL_REPLY, closingLine: CHAERIN_CLOSING_LINE, myRole: '함께 공부하는 학생' },
  { characterId: LOCAL_DOHYUN_CHARACTER_ID, name: '서진', mateId: 'dohyun',
    reply: '잠깐 봐봐. …아, 이거네. 여기부터 다시 해.', closingLine: '다 했네. 오늘 좀 열심히 했다? 수고했어.', myRole: '어릴 때부터 함께 자란 소꿉친구이자 공부 메이트' },
] as const
export type LocalMate = (typeof LOCAL_MATES)[number]
/** The local mate of a character id (채린 for unknown ids, as in data saved before 서도현 existed). */
export function localMate(characterId: number | string | undefined): LocalMate {
  return LOCAL_MATES.find(mate => String(mate.characterId) === String(characterId)) ?? LOCAL_MATES[0]
}
const HISTORY_MESSAGE_ID = 'local-history-1'
/**
 * Sample affinity the local mock reports (stage numbers and names as in affinity-stages.ts): 3단계 · 친구, 8.5 of the
 * 10 hours to 친한 친구, so the my-mates progress bar shows. Local mock only; never part of production builds.
 */
export const LOCAL_AFFINITY = {
  stage: 3,
  stageName: '친구',
  previousStageName: '아는 사이',
  nextStageName: '친한 친구',
  stageSeconds: 8.5 * 3600,
  stageTargetSeconds: 10 * 3600,
  nextLevelSeconds: 1.5 * 3600,
} as const
/** The same sample as 22 · 23 `relation` (IntimacyView; `stageProgress` 0–100). */
export function localIntimacy(stageUp = false): IntimacyView {
  return { stageBefore: LOCAL_AFFINITY.stage, stageAfter: LOCAL_AFFINITY.stage, stageName: LOCAL_AFFINITY.stageName, stageUp,
    creditedSeconds: 0, nextStageSeconds: LOCAL_AFFINITY.nextLevelSeconds,
    stageProgress: Math.round(LOCAL_AFFINITY.stageSeconds / LOCAL_AFFINITY.stageTargetSeconds * 100), unlocked: [] }
}
/**
 * The local server's invitation record (35): my code, the friends whose first connection rewarded me
 * (`invitedCount`, as 35 `rewardedCount`), friends who entered my code but have not finished a connection
 * (`joinedCount`), and whether I can still enter a received code (`canRedeem`).
 */
export type LocalInvitation = { code: string; url: string; invitedCount: number; rewardedCredits: number; canRedeem: boolean; joinedCount?: number }
const DAY_MS = 86_400_000
/** The local server's ledger lines, worded as the server writes them (docs/BACKEND_API.md 4.5). */
export const LOCAL_LEDGER_TITLES = {
  attendance: '출석',
  expiration: '출석분 소멸',
  invited: (nickname: string) => `친구 초대 · ${nickname}님 첫 연결`,
  inviteReceived: '친구 초대 · 초대 코드 보상',
  spend: (mate: string, voice: boolean, advanced: boolean) => `${[advanced ? '고급 모드' : '', voice ? '보이스 대화' : ''].filter(Boolean).join(' · ')} · ${mate}`,
} as const
/** Friends who used my code, in order (local sample nicknames). */
export const LOCAL_FRIEND_NAMES = ['민지', '하준', '서연', '도윤', '지우', '예준', '하은', '시우', '수아', '주원', '지호', '윤서'] as const
export const localScenarios = ['normal', 'empty', 'loading', 'failure', 'exhausted', 'guest'] as const
export type LocalScenario = typeof localScenarios[number]
/** A running connection; the totals are the last heartbeat's (API 21), as the server keeps them for 17. */
type Session = { id: number; startedAt: number; characterId?: number; studySeconds: number; presentSeconds: number; cameraOnSeconds?: number; pipSeconds?: number }
type LocalData = {
  version: 1; authenticated: boolean; nickname: string; onboardingRequired: boolean; avatarId?: number
  details: BetaAccountDetails; scenario: LocalScenario; nextSessionId: number; active: Session | null
  wallet: BetaWallet; invitation: LocalInvitation; messages: Message[]; records: StudyRecord[]
  points: number; settings: { voice: boolean; advanced: boolean }; rewardedCodes: string[]
  /** QA record pattern; absent in data saved before patterns existed. */
  recordPattern?: RecordPattern
}
type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>

/** Local 05:00 boundary; deliberately independent of a 24-hour interval and DST. */
export function nextAttendanceExpiry(now: number) {
  const boundary = new Date(now)
  boundary.setHours(5, 0, 0, 0)
  if (boundary.getTime() <= now) boundary.setDate(boundary.getDate() + 1)
  return boundary.getTime()
}

/**
 * Generated history: every third connection is with 서도현 (the second mate), so 내 기록 「전체」 shows two mate colours
 * and the mate filter, and 내 메이트 has capsules for both. (This replaced the 「가상 메이트(남학생 시안)」 QA switch.)
 */
function patternRecords(pattern: RecordPattern, now: number): StudyRecord[] {
  return patternSessions(pattern, now).map((session, index) => {
    const mate = index % 3 === 1 ? LOCAL_MATES[1] : LOCAL_MATES[0]
    // 서도현's records get their own (still pattern) ids: the app keeps cached reports by id.
    const sessionId = mate.characterId === LOCAL_CHARACTER_ID ? session.id : PATTERN_ID_BASE + ((session.id - PATTERN_ID_BASE + 45_000_000) % 90_000_000)
    const report: ReportResponse = { connectionId: sessionId, mate: { id: mate.characterId, name: mate.name, myRole: mate.myRole },
      startedAt: new Date(session.startedAt).toISOString(), endedAt: new Date(session.endedAt).toISOString(), endType: 'NORMAL',
      connectedSeconds: session.seconds, presentSeconds: session.seconds - 60, cameraOnSeconds: session.seconds, awaySeconds: 60, returnCount: 1,
      messageCount: 3, relation: localIntimacy(), closingLine: mate.closingLine, referralReward: null, betaFeedbackAvailable: false }
    return toRecord(report)
  })
}

/** Pattern records are regenerated relative to today; locally finished connections are kept. */
function withPatternRecords(data: Pick<LocalData, 'records' | 'messages' | 'recordPattern'>, now: number): Pick<LocalData, 'records' | 'messages'> {
  const generated = patternRecords(data.recordPattern ?? 'none', now)
  const records = [...data.records.filter(record => !isPatternRecordId(record.id)), ...generated].sort((a, b) => b.endedAt - a.endedAt)
  const latest = generated[0]
  const messages = data.messages.filter(message => message.id !== HISTORY_MESSAGE_ID)
  if (latest) {
    const mate = localMate(latest.characterIds[0])
    messages.unshift({ id: HISTORY_MESSAGE_ID, sessionId: latest.id, characterId: String(mate.characterId), sender: 'character', text: mate.reply, voice: false, delivery: 'confirmed', createdAt: latest.endedAt })
  }
  return { records, messages }
}

function seed(now: number, recordPattern: RecordPattern = 'steady'): LocalData {
  const { records, messages } = withPatternRecords({ recordPattern, records: [], messages: [] }, now)
  return { version: 1, authenticated: true, nickname: '로컬 사용자', onboardingRequired: false, details: { birthDate: '2000-01-01', aboutMe: '' },
    scenario: 'normal', recordPattern, nextSessionId: 992001, active: null, points: 62, settings: { voice: false, advanced: false }, rewardedCodes: [], records, messages,
    wallet: { attendance: 1500, invitation: 2000, usedToday: 0, attendanceExpiresAt: nextAttendanceExpiry(now), entries: seedLedger(now) },
    invitation: { code: 'LOCALCAPSULE', url: '/i/LOCALCAPSULE', invitedCount: 2, rewardedCredits: 2000, canRedeem: true, joinedCount: 1 } }
}

/**
 * A plausible past for 34 (newest first): today's attendance, and over the previous six days attendance on four of
 * them (the home path's check marks), a few uses, the expiries at 05:00 and two invitation rewards. Balances are
 * worked out from the oldest line, ending at today's 3,500 (1,500 attendance + 2,000 invitation).
 */
function seedLedger(now: number): BetaWallet['entries'] {
  const today = nextAttendanceExpiry(now) - DAY_MS
  type Line = { at: number; kind: BetaWallet['entries'][number]['kind']; change: number; description: string }
  const lines: Line[] = []
  const attendedDaysAgo = [1, 2, 4, 5]
  for (const ago of [5, 4, 2, 1]) {
    const start = today - ago * DAY_MS
    if (!attendedDaysAgo.includes(ago)) continue
    lines.push({ at: start + 3 * 3_600_000, kind: 'attendance', change: 1500, description: LOCAL_LEDGER_TITLES.attendance })
    lines.push({ at: start + 4 * 3_600_000, kind: 'use', change: -30, description: LOCAL_LEDGER_TITLES.spend('채린', false, true) })
    lines.push({ at: start + 4 * 3_600_000 + 600_000, kind: 'use', change: -20, description: LOCAL_LEDGER_TITLES.spend('채린', true, false) })
    if (ago === 4) lines.push({ at: start + 6 * 3_600_000, kind: 'invite', change: 1000, description: LOCAL_LEDGER_TITLES.invited(LOCAL_FRIEND_NAMES[0]) })
    if (ago === 2) lines.push({ at: start + 6 * 3_600_000, kind: 'invite', change: 1000, description: LOCAL_LEDGER_TITLES.invited(LOCAL_FRIEND_NAMES[1]) })
    // The rest of that day's attendance part goes at the next 05:00.
    lines.push({ at: start + DAY_MS, kind: 'expiration', change: -1450, description: LOCAL_LEDGER_TITLES.expiration })
  }
  lines.push({ at: Math.max(today, now - 60_000), kind: 'attendance', change: 1500, description: LOCAL_LEDGER_TITLES.attendance })
  lines.sort((a, b) => a.at - b.at)
  let balance = 3500 - lines.reduce((sum, line) => sum + line.change, 0)
  return lines.map((line, index) => {
    balance += line.change
    return { id: `local-seed-${index + 1}`, at: line.at, description: line.description, kind: line.kind, change: line.change, balance }
  }).reverse()
}

function toRecord(report: ReportResponse): StudyRecord {
  const seconds = report.connectedSeconds ?? 0
  const mate = localMate(report.mate?.id)
  // The display name, as the app's report adapter maps it (서진 → 서도현).
  const name = mateProfileByName(mate.name)?.name ?? mate.name
  return { id: String(report.connectionId), roomId: String(mate.characterId), characterIds: [String(mate.characterId)], tier: 'basic',
    roomName: name, characterName: name, serverReport: report, startedAt: Date.parse(report.startedAt!), endedAt: Date.parse(report.endedAt!),
    studySeconds: seconds, focusSeconds: report.presentSeconds ?? 0, awaySeconds: report.awaySeconds ?? 0, returns: report.returnCount ?? 0,
    cameraFocus: { observedMs: seconds * 1000, focusedMs: Math.floor(seconds * .8) * 1000, returns: 1 }, completed: false, automatic: false }
}

/** One isolated browser account. Passwords, production tokens and cookies are never stored. */
export class LocalBetaStore {
  data: LocalData
  previewExpression: string | null = null
  storageAvailable = true
  private listeners = new Set<() => void>()
  /**
   * The day's attendance was granted and no response has said so yet: the next credit summary carries
   * `attendanceGrantedNow` (4.5), as the server's first credit read of the day does. In memory only, like the server's
   * flag on a single response: a fresh account (or a new day) starts with it, a reload the same day does not.
   */
  private attendanceGrantPending = false
  /**
   * The proposed attendance API (attendance-source.ts `attendance-api`): no grant on reads; `POST /attendance/check-in`
   * grants the day's 1,500. Otherwise the server as it is: the day's first credit read grants it.
   */
  readonly attendanceApi: boolean
  private replies = new Map<string, { content: string; affinity: AffinityChange; charged: number }>()
  private storage: StoragePort | null
  private now: () => number
  constructor(storage: StoragePort | null, now = () => Date.now()) {
    this.storage = storage; this.now = now
    this.storageAvailable = storage !== null
    this.attendanceApi = attendanceSource() === 'attendance-api'
    this.data = seed(now())
    if (this.attendanceApi) this.withoutTodayAttendance()
    else this.attendanceGrantPending = true
    try {
      const value = JSON.parse(storage?.getItem(LOCAL_STORAGE_KEY) ?? 'null') as LocalData | null
      if (value?.version === 1 && localScenarios.includes(value.scenario) && Array.isArray(value.records) && Array.isArray(value.messages) &&
        typeof value.authenticated === 'boolean' && typeof value.nickname === 'string' && Number.isSafeInteger(value.nextSessionId) &&
        value.wallet && Number.isFinite(value.wallet.attendance) && Number.isFinite(value.wallet.invitation) && Array.isArray(value.wallet.entries) &&
        value.invitation && value.details && value.settings && Array.isArray(value.rewardedCodes)) { this.data = value; this.attendanceGrantPending = false }
    } catch { this.storageAvailable = false }
    if (!isRecordPattern(this.data.recordPattern)) this.data.recordPattern = this.data.scenario === 'empty' || this.data.scenario === 'guest' ? 'none' : 'steady'
    Object.assign(this.data, withPatternRecords(this.data, now()))
    this.expireAttendance()
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  changed() {
    try { this.storage?.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.data)) } catch { this.storageAvailable = false }
    for (const listener of this.listeners) listener()
  }
  private ledger(kind: BetaWallet['entries'][number]['kind'], change: number, description: string) {
    const wallet = this.data.wallet
    wallet.entries = [{ id: `local-${this.now()}-${wallet.entries.length}`, at: this.now(), description, kind, change, balance: wallet.attendance + wallet.invitation }, ...wallet.entries]
  }
  /** A fresh account under the attendance API: today's attendance is not granted until the check-in. */
  private withoutTodayAttendance() {
    const wallet = this.data.wallet, today = businessDay(this.now())
    wallet.entries = wallet.entries.filter(entry => !(entry.kind === 'attendance' && businessDay(entry.at) === today))
    wallet.attendance = 0
  }
  expireAttendance() {
    const wallet = this.data.wallet, now = this.now()
    if (now < wallet.attendanceExpiresAt) return
    const expired = wallet.attendance
    wallet.attendance = 0
    if (expired) this.ledger('expiration', -expired, LOCAL_LEDGER_TITLES.expiration)
    wallet.usedToday = 0
    wallet.attendanceExpiresAt = nextAttendanceExpiry(now)
    // Under the attendance API the new day's credits wait for the check-in.
    if (this.attendanceApi) { this.changed(); return }
    wallet.attendance = 1500
    wallet.attendanceExpiresAt = nextAttendanceExpiry(now)
    this.ledger('attendance', 1500, LOCAL_LEDGER_TITLES.attendance)
    this.attendanceGrantPending = true
    this.changed()
  }
  snapshot = () => ({ wallet: structuredClone(this.data.wallet), records: structuredClone(this.data.records),
    messages: structuredClone(this.data.messages), affinities: Object.fromEntries(LOCAL_MATES.map(mate => [mate.characterId, this.affinity()])), settings: { ...this.data.settings } })
  affinity = (): AffinityChange => ({ points: this.data.points, level: 3, stage: LOCAL_AFFINITY.stage, stageName: LOCAL_AFFINITY.stageName })
  /** 8 · 16 · 20 · 33 `credits` from the local wallet. The first summary after the day's grant says so, once. */
  credits = (): Credits => {
    const wallet = this.data.wallet, todayRemaining = wallet.attendance + wallet.invitation
    const attendanceGrantedNow = this.attendanceGrantPending
    this.attendanceGrantPending = false
    return { todayRemaining, attendanceRemaining: wallet.attendance, attendanceExpiresAt: new Date(wallet.attendanceExpiresAt).toISOString(),
      inviteBalance: wallet.invitation, low: todayRemaining < 100, exhausted: todayRemaining === 0, attendanceGrantedNow }
  }
  /** QA: as if the next day's 05:00 had passed — today's attendance part expires and the new day's is granted. */
  nextAttendanceDay() {
    this.data.wallet.attendanceExpiresAt = this.now() - 1
    this.expireAttendance()
  }
  /** The business days with an attendance grant. */
  private attendanceDays() {
    return this.data.wallet.entries.filter(entry => entry.kind === 'attendance').map(entry => businessDay(entry.at))
  }
  /** Proposed `GET /attendance`: today and the 7-day cycle, counted from the days attended. */
  attendanceStatus() {
    this.expireAttendance()
    const today = businessDay(this.now())
    const days = this.attendanceDays()
    const state = attendanceFromDays(days, today, { received: true })
    return { checkedToday: days.includes(today), cycleDay: state.cycleDay, totalDays: state.totalDays, rewardPerDay: DAILY_ATTENDANCE_CREDIT }
  }
  /** Proposed `POST /attendance/check-in`: grants today's 1,500 once (null: already checked in → 409). */
  checkInAttendance() {
    this.expireAttendance()
    const today = businessDay(this.now())
    if (this.attendanceDays().includes(today)) return null
    const wallet = this.data.wallet
    wallet.attendance = DAILY_ATTENDANCE_CREDIT
    wallet.attendanceExpiresAt = nextAttendanceExpiry(this.now())
    this.ledger('attendance', DAILY_ATTENDANCE_CREDIT, LOCAL_LEDGER_TITLES.attendance)
    this.changed()
    return { granted: DAILY_ATTENDANCE_CREDIT, cycleDay: this.attendanceStatus().cycleDay, credits: { ...this.credits(), todayUsed: wallet.usedToday, invitedFriends: this.data.invitation.invitedCount } }
  }
  /** 8 `/me`. The onboarding rule is the server's: avatar or birth date missing. */
  me = (image?: string): MeResponse => ({ userId: LOCAL_USER_ID, nickname: this.data.nickname, email: 'local@capsule.invalid',
    onboardingRequired: this.data.onboardingRequired || !this.data.details.birthDate, profileImage: image ?? null,
    activeConnection: this.summary(), birthDate: this.data.details.birthDate ?? null, isMinor: false,
    honorific: null, aboutMe: this.data.details.aboutMe || null, referralCode: this.data.invitation.code,
    credits: this.credits(), loginType: 'EMAIL', unreadNotifications: 0 })
  /** The mate of the running connection (채린 for sessions saved before 서도현 existed). */
  activeMate = () => localMate(this.data.active?.characterId)
  summary = (): ActiveConnectionSummary | null => {
    if (!this.data.active) return null
    const mate = this.activeMate()
    return { connectionId: this.data.active.id, mateId: mate.characterId, mateName: mate.name, startedAt: new Date(this.data.active.startedAt).toISOString() }
  }
  login() { this.data.authenticated = true; this.changed(); return { accessToken: 'local-beta-access', ...this.me() } }
  beginOnboarding() {
    this.reset('empty'); this.data.details = { aboutMe: '' }; this.data.onboardingRequired = true
    return this.login()
  }
  setPreviewExpression(value: string | null) { this.previewExpression = value }
  /** QA only: replaces the generated history with another pattern, keeping locally finished connections. */
  setRecordPattern(pattern: RecordPattern) {
    this.data.recordPattern = pattern
    Object.assign(this.data, withPatternRecords(this.data, this.now()))
    this.changed()
  }
  logout() { this.data.authenticated = false; this.changed() }
  profile(nickname: string, avatarId?: number) { this.data.nickname = nickname; if (avatarId !== undefined) this.data.avatarId = avatarId; this.data.onboardingRequired = false; this.changed(); return this.me() }
  /** API 10: only the fields sent; the birth date is saved once. */
  updateMe(body: UpdateMeRequest) {
    if (body.birthDate && !this.data.details.birthDate) this.data.details.birthDate = body.birthDate
    if (typeof body.aboutMe === 'string') this.data.details.aboutMe = body.aboutMe
    return this.profile(typeof body.nickname === 'string' ? body.nickname : this.data.nickname, body.avatarId)
  }
  /** API 36 (codes as simulateMockReferralValidation: FRIEND1000 · CAPSULE2026). Returns an error code or null. */
  enterReferral(raw: string): string | null {
    const code = raw.trim().toUpperCase()
    if (this.data.details.referralRegistered || !this.data.invitation.canRedeem) return 'REFERRAL_ALREADY_ENTERED'
    if (code === this.data.invitation.code || code === 'SELF') return 'REFERRAL_SELF'
    if (code !== 'FRIEND1000' && code !== 'CAPSULE2026') return 'REFERRAL_CODE_NOT_FOUND'
    this.data.details.referralRegistered = true; this.data.invitation.canRedeem = false
    if (!this.data.rewardedCodes.includes(code)) this.data.rewardedCodes.push(code)
    this.changed()
    return null
  }
  setSettings = (settings: Partial<LocalData['settings']>) => { this.data.settings = { ...this.data.settings, ...settings }; this.changed() }
  start(characterId: number = LOCAL_CHARACTER_ID) {
    if (this.data.active) return this.data.active
    this.data.active = { id: this.data.nextSessionId++, startedAt: this.now(), studySeconds: 0, presentSeconds: 0, cameraOnSeconds: 0, pipSeconds: 0, characterId }
    this.changed()
    return this.data.active
  }
  /** API 21: keeps the last totals (17 resumes from them). */
  heartbeat(totals: ConnectionTotals) {
    if (!this.data.active) return
    Object.assign(this.data.active, { studySeconds: totals.connectedSeconds, presentSeconds: totals.presentSeconds, cameraOnSeconds: totals.cameraOnSeconds, pipSeconds: totals.pipSeconds })
    this.changed()
  }
  /**
   * 20 · 28. `advanced`: the request's `mode: ADVANCED` (30); `voiceAsked`: `tts: true` with 「메이트 음성」 on (the
   * transport decides; the local voice switch otherwise), a voice turn (20). As on the server an ADVANCED turn without
   * 30 credits is refused (`null` → 409 `CREDIT_INSUFFICIENT`), a voice turn without credits just comes without voice.
   * A resend gets the stored reply without voice.
   */
  reply(requestId: string, content: string, advanced = this.data.settings.advanced, voiceAsked = this.data.settings.voice) {
    const old = this.replies.get(requestId)
    if (old) return { ...old, voice: false }
    const persisted = this.data.messages.find(message => message.id === `local-reply-${requestId}`)
    if (persisted) return { content: persisted.text, affinity: this.affinity(), charged: 0, voice: false }
    const wallet = this.data.wallet
    if (advanced && wallet.attendance + wallet.invitation < 30) return null
    const voice = voiceAsked && wallet.attendance + wallet.invitation >= (advanced ? 50 : 20)
    const cost = (voice ? 20 : 0) + (advanced ? 30 : 0)
    if (cost) {
      const attendance = Math.min(wallet.attendance, cost)
      wallet.attendance -= attendance; wallet.invitation -= cost - attendance; wallet.usedToday += cost
      this.ledger('use', -cost, LOCAL_LEDGER_TITLES.spend(this.activeMate().name, voice, advanced))
    }
    const mate = this.activeMate()
    const sessionId = String(this.data.active!.id), characterId = String(mate.characterId)
    this.data.messages.push({ id: `local-user-${requestId}`, requestId, sessionId, characterId, sender: 'user', text: content, voice: false, delivery: 'confirmed', createdAt: this.now() },
      { id: `local-reply-${requestId}`, requestId, sessionId, characterId, sender: 'character', text: mate.reply, voice: false, delivery: 'confirmed', createdAt: this.now() })
    const result = { content: mate.reply, affinity: this.affinity(), charged: cost, voice }
    this.replies.set(requestId, result); this.changed(); return result
  }
  /** 19 with `tts: true` and 「메이트 음성」 on: the line's voice costs 20; without 20 credits the line comes as text. */
  voiceLine(): boolean {
    this.expireAttendance()
    const wallet = this.data.wallet
    if (wallet.attendance + wallet.invitation < 20) return false
    const attendance = Math.min(wallet.attendance, 20)
    wallet.attendance -= attendance; wallet.invitation -= 20 - attendance; wallet.usedToday += 20
    this.ledger('use', -20, LOCAL_LEDGER_TITLES.spend(this.activeMate().name, true, false))
    this.changed()
    return true
  }
  /** API 22. */
  finish(totals: ConnectionTotals, endType: EndType = 'NORMAL') {
    const active = this.data.active!
    const mate = this.activeMate()
    const messageCount = this.data.messages.filter(message => message.sessionId === String(active.id) && message.sender === 'character').length
    const reward = this.rewardFirstConnection()
    const report: ReportResponse = { connectionId: active.id, mate: { id: mate.characterId, name: mate.name, myRole: mate.myRole }, startedAt: new Date(active.startedAt).toISOString(), endedAt: new Date(this.now()).toISOString(), endType,
      connectedSeconds: totals.connectedSeconds, presentSeconds: totals.presentSeconds, cameraOnSeconds: totals.cameraOnSeconds,
      awaySeconds: Math.max(0, totals.cameraOnSeconds - totals.presentSeconds), returnCount: 0, messageCount,
      relation: localIntimacy(), closingLine: mate.closingLine, referralReward: reward ? { amount: 1000 } : null, betaFeedbackAvailable: true }
    const record = toRecord(report)
    // New camera measurements belong to MediaProvider, never to a generated percentage.
    delete record.cameraFocus
    this.data.records.unshift(record); this.data.active = null; this.changed(); return report
  }
  /** The referral reward of the first connection ending after a code was entered; true when paid now. */
  rewardFirstConnection() {
    if (!this.data.rewardedCodes.some(code => !code.startsWith('__')) || this.data.rewardedCodes.includes('__rewarded__')) return false
    this.data.rewardedCodes.push('__rewarded__'); this.data.wallet.invitation += 1000
    this.ledger('invite', 1000, LOCAL_LEDGER_TITLES.inviteReceived); this.changed()
    return true
  }
  completeInvitedFriend(friendId: string) {
    const marker = `__friend:${friendId}__`
    if (this.data.rewardedCodes.includes(marker)) return
    if (this.data.invitation.invitedCount >= 10) throw new Error('초대 보상은 최대 10명까지 받을 수 있어요.')
    this.data.rewardedCodes.push(marker)
    const nickname = LOCAL_FRIEND_NAMES[this.data.invitation.invitedCount % LOCAL_FRIEND_NAMES.length]!
    this.data.invitation.invitedCount++; this.data.invitation.rewardedCredits += 1000
    if (this.data.invitation.joinedCount) this.data.invitation.joinedCount--
    this.data.wallet.invitation += 1000
    this.ledger('invite', 1000, LOCAL_LEDGER_TITLES.invited(nickname)); this.changed()
  }
  reset(scenario: LocalScenario) {
    // Clear only this mock user's auxiliary snapshots, preserving real accounts and user preferences.
    try {
      const keys = Array.from({ length: this.storage?.length ?? 0 }, (_, i) => this.storage!.key(i))
      for (const key of keys) {
        if (
          key?.startsWith(LOCAL_CACHE_PREFIX) &&
          !key.endsWith(REFERRAL_STORAGE_KEY) &&
          !key.endsWith(LOCAL_PANEL_OPEN_KEY)
        ) {
          this.storage?.removeItem(key)
        }
      }
    } catch { this.storageAvailable = false }
    this.data = seed(this.now(), scenario === 'empty' || scenario === 'guest' ? 'none' : 'steady'); this.data.scenario = scenario; this.replies.clear()
    if (this.attendanceApi) this.withoutTodayAttendance()
    else this.attendanceGrantPending = true
    if (scenario === 'empty' || scenario === 'guest') { this.data.records = []; this.data.messages = []; this.data.invitation.invitedCount = 0; this.data.invitation.rewardedCredits = 0; this.data.invitation.joinedCount = 0; this.data.wallet.invitation = 0; this.data.wallet.entries = this.data.wallet.entries.slice(0, this.attendanceApi ? 0 : 1).map(entry => ({ ...entry, balance: 1500 })) }
    if (scenario === 'exhausted') { this.data.wallet.attendance = 0; this.data.wallet.invitation = 0; this.data.wallet.entries = []; this.data.settings = { voice: true, advanced: true } }
    if (scenario === 'guest') this.data.authenticated = false
    this.changed()
  }
}
