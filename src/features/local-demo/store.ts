import type { BetaAccountDetails } from '../auth/beta-account.ts'
import type { BetaWallet, BetaInvitation } from '../credits/beta-types.ts'
import type { Message, StudyRecord } from '../demo/types.ts'
import type { ReportResponse, MeResponse, AffinityChange } from '../../shared/api/types.ts'
import { LOCAL_CACHE_PREFIX, LOCAL_PANEL_OPEN_KEY } from './storage.ts'
import { REFERRAL_STORAGE_KEY } from '../auth/referral-code.ts'
import { isPatternRecordId, isRecordPattern, patternSessions, type RecordPattern } from './record-patterns.ts'

export {
  LOCAL_MODEL_URL,
  LOCAL_V2_ENGINE_URL,
  LOCAL_V2_MODEL_URL,
  LOCAL_V2_PLAYER_URL,
  LOCAL_V2_REACTIONS_URL,
} from './local-asset-urls.ts'

export const LOCAL_USER_ID = 990101
export const LOCAL_ROOM_ID = 990201
export const LOCAL_CHARACTER_ID = 990301
export const LOCAL_STORAGE_KEY = 'capsule-local-beta:v1'
export const LOCAL_REPLY = '좋아, 우리 조금만 더 집중해 보자!'
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
export const localScenarios = ['normal', 'empty', 'loading', 'failure', 'exhausted', 'guest'] as const
export type LocalScenario = typeof localScenarios[number]
type Session = { id: number; startedAt: number; studySeconds: number; presentSeconds: number; targetMinutes: number }
type LocalData = {
  version: 1; authenticated: boolean; nickname: string; onboardingRequired: boolean; avatarId?: number
  details: BetaAccountDetails; scenario: LocalScenario; nextSessionId: number; active: Session | null
  wallet: BetaWallet; invitation: BetaInvitation; messages: Message[]; records: StudyRecord[]
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

function patternRecords(pattern: RecordPattern, now: number): StudyRecord[] {
  return patternSessions(pattern, now).map(session => {
    const report: ReportResponse = { sessionId: session.id, roomName: '채린', character: { id: LOCAL_CHARACTER_ID, name: '채린' },
      startedAt: new Date(session.startedAt).toISOString(), endedAt: new Date(session.endedAt).toISOString(), endType: 'USER',
      studySeconds: session.seconds, presentSeconds: session.seconds - 60, awaySeconds: 60, returnCount: 1,
      relation: { levelBefore: 3, levelAfter: 3, pointsBefore: 61, pointsAfter: 62, ...LOCAL_AFFINITY },
      closingLine: '오늘도 같이 있어서 좋았어. 다음에도 여기서 만나자.' }
    return toRecord(report)
  })
}

/** Pattern records are regenerated relative to today; locally finished connections are kept. */
function withPatternRecords(data: Pick<LocalData, 'records' | 'messages' | 'recordPattern'>, now: number): Pick<LocalData, 'records' | 'messages'> {
  const generated = patternRecords(data.recordPattern ?? 'none', now)
  const records = [...data.records.filter(record => !isPatternRecordId(record.id)), ...generated].sort((a, b) => b.endedAt - a.endedAt)
  const latest = generated[0]
  const messages = data.messages.filter(message => message.id !== HISTORY_MESSAGE_ID)
  if (latest) messages.unshift({ id: HISTORY_MESSAGE_ID, sessionId: latest.id, characterId: String(LOCAL_CHARACTER_ID), sender: 'character', text: LOCAL_REPLY, voice: false, delivery: 'confirmed', createdAt: latest.endedAt })
  return { records, messages }
}

function seed(now: number, recordPattern: RecordPattern = 'steady'): LocalData {
  const { records, messages } = withPatternRecords({ recordPattern, records: [], messages: [] }, now)
  return { version: 1, authenticated: true, nickname: '로컬 사용자', onboardingRequired: false, details: { birthDate: '2000-01-01', callName: '', aboutMe: '' },
    scenario: 'normal', recordPattern, nextSessionId: 992001, active: null, points: 62, settings: { voice: false, advanced: false }, rewardedCodes: [], records, messages,
    wallet: { attendance: 1500, invitation: 2000, usedToday: 0, attendanceExpiresAt: nextAttendanceExpiry(now), entries: [
      { id: 'local-attendance', at: now, description: '출석 크레딧', kind: 'attendance', change: 1500, balance: 3500 },
      { id: 'local-invite-2', at: now - 86_400_000, description: '친구 초대', kind: 'invite', change: 1000, balance: 2000 },
      { id: 'local-invite-1', at: now - 172_800_000, description: '친구 초대', kind: 'invite', change: 1000, balance: 1000 },
    ] }, invitation: { code: 'LOCALCAPSULE', url: '/login?invite=LOCALCAPSULE', invitedCount: 2, rewardedCredits: 2000, canRedeem: true } }
}

function toRecord(report: ReportResponse): StudyRecord {
  const seconds = report.studySeconds ?? 0
  return { id: String(report.sessionId), roomId: String(LOCAL_ROOM_ID), characterIds: [String(LOCAL_CHARACTER_ID)], tier: 'basic',
    roomName: '채린', characterName: '채린', serverReport: report, startedAt: Date.parse(report.startedAt!), endedAt: Date.parse(report.endedAt!),
    studySeconds: seconds, focusSeconds: report.presentSeconds ?? 0, awaySeconds: report.awaySeconds ?? 0, returns: report.returnCount ?? 0,
    cameraFocus: { observedMs: seconds * 1000, focusedMs: Math.floor(seconds * .8) * 1000, returns: 1 }, completed: false, automatic: false }
}

/** One isolated browser account. Passwords, production tokens and cookies are never stored. */
export class LocalBetaStore {
  data: LocalData
  previewExpression: string | null = null
  storageAvailable = true
  private listeners = new Set<() => void>()
  private replies = new Map<string, { content: string; affinity: AffinityChange }>()
  private storage: StoragePort | null
  private now: () => number
  constructor(storage: StoragePort | null, now = () => Date.now()) {
    this.storage = storage; this.now = now
    this.storageAvailable = storage !== null
    this.data = seed(now())
    try {
      const value = JSON.parse(storage?.getItem(LOCAL_STORAGE_KEY) ?? 'null') as LocalData | null
      if (value?.version === 1 && localScenarios.includes(value.scenario) && Array.isArray(value.records) && Array.isArray(value.messages) &&
        typeof value.authenticated === 'boolean' && typeof value.nickname === 'string' && Number.isSafeInteger(value.nextSessionId) &&
        value.wallet && Number.isFinite(value.wallet.attendance) && Number.isFinite(value.wallet.invitation) && Array.isArray(value.wallet.entries) &&
        value.invitation && value.details && value.settings && Array.isArray(value.rewardedCodes)) this.data = value
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
  expireAttendance() {
    const wallet = this.data.wallet, now = this.now()
    if (now < wallet.attendanceExpiresAt) return
    const expired = wallet.attendance
    wallet.attendance = 0
    if (expired) this.ledger('expiration', -expired, '출석 크레딧 만료')
    wallet.usedToday = 0
    wallet.attendance = 1500
    wallet.attendanceExpiresAt = nextAttendanceExpiry(now)
    this.ledger('attendance', 1500, '출석 크레딧')
    this.changed()
  }
  snapshot = () => ({ wallet: structuredClone(this.data.wallet), invitation: structuredClone(this.data.invitation), records: structuredClone(this.data.records),
    messages: structuredClone(this.data.messages), affinities: { [LOCAL_CHARACTER_ID]: this.affinity() }, settings: { ...this.data.settings } })
  affinity = (): AffinityChange => ({ points: this.data.points, level: 3, stage: LOCAL_AFFINITY.stage, stageName: LOCAL_AFFINITY.stageName })
  me = (image?: string): MeResponse => ({ userId: LOCAL_USER_ID, nickname: this.data.nickname, onboardingRequired: this.data.onboardingRequired, profileImage: image, activeSession: this.summary() ?? undefined })
  summary = () => this.data.active ? { sessionId: this.data.active.id, roomId: LOCAL_ROOM_ID, roomName: '채린', characterName: '채린', startedAt: new Date(this.data.active.startedAt).toISOString() } : null
  login() { this.data.authenticated = true; this.changed(); return { accessToken: 'local-beta-access', ...this.me() } }
  beginOnboarding() {
    this.reset('empty'); this.data.details = { callName: '', aboutMe: '' }; this.data.onboardingRequired = true
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
  profile(nickname: string, avatarId?: number) { this.data.nickname = nickname; this.data.avatarId = avatarId; this.data.onboardingRequired = false; this.changed(); return this.me() }
  setSettings = (settings: Partial<LocalData['settings']>) => { this.data.settings = { ...this.data.settings, ...settings }; this.changed() }
  start(targetMinutes: number) {
    if (this.data.active) return this.data.active
    this.data.active = { id: this.data.nextSessionId++, startedAt: this.now(), studySeconds: 0, presentSeconds: 0, targetMinutes }
    this.changed()
    return this.data.active
  }
  heartbeat(studySeconds: number, presentSeconds: number) {
    if (!this.data.active) return
    this.data.active.studySeconds = studySeconds; this.data.active.presentSeconds = presentSeconds; this.changed()
  }
  reply(requestId: string, content: string) {
    const old = this.replies.get(requestId)
    if (old) return old
    const persisted = this.data.messages.find(message => message.id === `local-reply-${requestId}`)
    if (persisted) return { content: persisted.text, affinity: this.affinity() }
    const wallet = this.data.wallet, cost = (this.data.settings.voice ? 20 : 0) + (this.data.settings.advanced ? 30 : 0)
    if (cost && wallet.attendance + wallet.invitation >= cost) {
      const attendance = Math.min(wallet.attendance, cost)
      wallet.attendance -= attendance; wallet.invitation -= cost - attendance; wallet.usedToday += cost
      this.ledger('use', -cost, this.data.settings.voice && this.data.settings.advanced ? '음성 · 고급 대화' : this.data.settings.voice ? '음성 대화' : '고급 대화')
    } else if (cost) this.data.settings = { voice: false, advanced: false }
    const sessionId = String(this.data.active!.id), characterId = String(LOCAL_CHARACTER_ID)
    this.data.messages.push({ id: `local-user-${requestId}`, requestId, sessionId, characterId, sender: 'user', text: content, voice: false, delivery: 'confirmed', createdAt: this.now() },
      { id: `local-reply-${requestId}`, requestId, sessionId, characterId, sender: 'character', text: LOCAL_REPLY, voice: false, delivery: 'confirmed', createdAt: this.now() })
    const result = { content: LOCAL_REPLY, affinity: this.affinity() }
    this.replies.set(requestId, result); this.changed(); return result
  }
  finish(studySeconds: number, presentSeconds: number) {
    const active = this.data.active!
    const report: ReportResponse = { sessionId: active.id, roomName: '채린', character: { id: LOCAL_CHARACTER_ID, name: '채린' }, startedAt: new Date(active.startedAt).toISOString(), endedAt: new Date(this.now()).toISOString(), endType: 'USER',
      studySeconds, presentSeconds, awaySeconds: Math.max(0, studySeconds - presentSeconds), returnCount: 0,
      relation: { levelBefore: 3, levelAfter: 3, pointsBefore: this.data.points, pointsAfter: this.data.points, ...LOCAL_AFFINITY },
      closingLine: '오늘도 같이 있어서 좋았어. 다음에도 여기서 만나자.' }
    const record = toRecord(report)
    // New camera measurements belong to MediaProvider, never to a generated percentage.
    delete record.cameraFocus
    this.data.records.unshift(record); this.data.active = null; this.changed(); return report
  }
  redeemInvitation = async (input: string) => {
    const code = input.trim().toUpperCase()
    if (!/^[A-Z0-9]{6,20}$/.test(code) || code === this.data.invitation.code) throw new Error('초대 코드를 확인해 주세요.')
    if (!this.data.invitation.canRedeem || this.data.rewardedCodes.includes(code)) throw new Error('이미 초대 코드를 입력했어요.')
    // Entering a code never pays early. The first completed connection triggers the local reward.
    this.data.rewardedCodes.push(code); this.data.invitation.canRedeem = false; this.changed()
  }
  rewardFirstConnection() {
    if (!this.data.rewardedCodes.some(code => !code.startsWith('__')) || this.data.rewardedCodes.includes('__rewarded__')) return
    this.data.rewardedCodes.push('__rewarded__'); this.data.wallet.invitation += 1000
    this.ledger('invite', 1000, '친구 초대'); this.changed()
  }
  completeInvitedFriend(friendId: string) {
    const marker = `__friend:${friendId}__`
    if (this.data.rewardedCodes.includes(marker)) return
    if (this.data.invitation.invitedCount >= 10) throw new Error('초대 보상은 최대 10명까지 받을 수 있어요.')
    this.data.rewardedCodes.push(marker)
    this.data.invitation.invitedCount++; this.data.invitation.rewardedCredits += 1000
    this.data.wallet.invitation += 1000
    this.ledger('invite', 1000, '친구 초대'); this.changed()
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
    if (scenario === 'empty' || scenario === 'guest') { this.data.records = []; this.data.messages = []; this.data.invitation.invitedCount = 0; this.data.invitation.rewardedCredits = 0; this.data.wallet.invitation = 0; this.data.wallet.entries = this.data.wallet.entries.filter(entry => entry.kind === 'attendance').map(entry => ({ ...entry, balance: 1500 })) }
    if (scenario === 'exhausted') { this.data.wallet.attendance = 0; this.data.wallet.invitation = 0; this.data.wallet.entries = []; this.data.settings = { voice: true, advanced: true } }
    if (scenario === 'guest') this.data.authenticated = false
    this.changed()
  }
}
