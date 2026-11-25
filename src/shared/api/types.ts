// Matches the backend OpenAPI 2026-11-25 (docs/BACKEND_OPENAPI_2026-11-25.json) and Backend_lab@10a67d1.
// Field meanings and required-ness follow docs/BACKEND_API.md (schema dictionary) where OpenAPI is silent.
// OpenAPI name clashes are fixed by hand here: `Item` (34 credit item vs 43 notification), `Recent` (37 vs 38),
// and 30's request body (`JsonNode` → `UserSettingsPatch`).

/** Wire response. ApiClient returns the inner payload types below; empty completions resolve to null. */
export type ApiResponse<T> = {
  success?: boolean
  data?: T
}

// ── Common ────────────────────────────────────────────────────────────────────────────────

/** `CUBISM` (`.model3.json`) or `ALIVING2D_V2` (Aliving2D bundle `model.json`). */
export type ModelFormat = 'CUBISM' | 'ALIVING2D_V2' | (string & {})

/** 9 · 31 · 48 `model`. URLs are CDN + storage path (ContentMapper.model). */
export type ModelInfo = {
  format?: ModelFormat
  modelJsonUrl?: string
  scale?: number
  offsetX?: number
  offsetY?: number
  /** Aliving2D `engine.js`; null until registered (2026-11-25 production: all null). */
  engineUrl?: string | null
  playerUrl?: string | null
  reactionsUrl?: string | null
}

/** 16 · 17 `mate` · `avatar`: ModelInfo spread out with the figure's id, name and image. */
export type Figure = ModelInfo & {
  id?: number
  name?: string
  profileImageUrl?: string
}

/** 8 · 16 · 19 · 20 · 28 credit summary (api.md 33). */
export type Credits = {
  todayRemaining?: number
  attendanceRemaining?: number
  attendanceExpiresAt?: string
  inviteBalance?: number
  /** `todayRemaining` < 100. */
  low?: boolean
  /** `todayRemaining` = 0. */
  exhausted?: boolean
  /** Today's attendance credits were granted by this very request (once a day). */
  attendanceGrantedNow?: boolean
}

export type ConnectionMode = 'BASIC' | 'ADVANCED'
export type TalkFrequencySetting = 'QUIET' | 'SOMETIMES' | 'OFTEN'
export type VoiceSpeedSetting = 'SLOW' | 'NORMAL' | 'FAST'
export type PipSizeSetting = 'S' | 'M' | 'L'

/** 29 · 30 response, 16 `settings`. Keys never saved come back as defaults. */
export type UserSettings = {
  talkFrequency?: TalkFrequencySetting
  voiceEnabled?: boolean
  voiceVolume?: number
  voiceSpeed?: VoiceSpeedSetting
  pipBubble?: boolean
  defaultMode?: ConnectionMode
  pipSize?: PipSizeSetting
}
/** 30 request: only the keys to change; `null` restores the default. Unknown keys are 400 `INVALID_SETTINGS`. */
export type UserSettingsPatch = { [K in keyof UserSettings]?: UserSettings[K] | null }

// ── Auth (1–7, 24–26) ─────────────────────────────────────────────────────────────────────

export type TermVersion = {
  termVersionId?: number
  code?: string
  name?: string
  required?: boolean
  content?: string
}
export type TermsResponse = { terms?: TermVersion[] }

export type EmailRequest = { email: string }
export type ExpiresResponse = { expiresInSeconds?: number }
export type ConfirmRequest = { email: string; code: string }
export type VerificationResponse = { verificationToken?: string }

export type SignupRequest = {
  verificationToken: string
  password: string
  nickname: string
  agreedTermVersionIds: number[]
  /** `YYYY-MM-DD`, required. Under 14: 400 `UNDER_14`. */
  birthDate: string
  /** Device value, 1–64 chars, required (device-hash.ts). */
  deviceHash: string
}
export type LoginRequest = { email: string; password: string }
export type LoginResponse = {
  accessToken?: string
  userId?: number
  /** True when the avatar or the birth date is missing (always true right after signup). */
  onboardingRequired?: boolean
}

export type KakaoRequest = {
  code: string
  redirectUri: string
  /** Required for existing users too (AuthService.java:189); saved only on signup. */
  deviceHash: string
}
export type KakaoResponse = LoginResponse & { isNewUser?: boolean }

export type AccessTokenResponse = { accessToken?: string }
export type PasswordResetRequest = { token: string; newPassword: string }

// ── Me · home (8–11, 27, 29–31, 43–46, 48) ────────────────────────────────────────────────

/** 8 · 11 `activeConnection` (OpenAPI name `ActiveSessionSummary`). */
export type ActiveConnectionSummary = {
  connectionId?: number
  /** Mate id (= character id). */
  mateId?: number
  mateName?: string
  startedAt?: string
}

export type MeResponse = {
  userId?: number
  nickname?: string
  email?: string | null
  /** Avatar or birth date missing. */
  onboardingRequired?: boolean
  activeConnection?: ActiveConnectionSummary | null
  /** Avatar thumbnail; null before an avatar. */
  profileImage?: string | null
  birthDate?: string | null
  isMinor?: boolean
  honorific?: string | null
  aboutMe?: string | null
  referralCode?: string
  /** Reading /me grants the day's attendance credits. */
  credits?: Credits
  loginType?: 'EMAIL' | 'KAKAO' | (string & {})
  unreadNotifications?: number
  /** Not in the 11-25 response (backend request pending); kept for the profile when a server adds it. */
  avatarId?: number
}

/** 10: sends only the fields to change. */
export type UpdateMeRequest = {
  nickname?: string
  avatarId?: number
  /** Saved once, only while empty. */
  birthDate?: string
  /** 1–10 chars; empty string clears. Front-end name: `callName`. */
  honorific?: string
  /** 0–50 chars; empty string clears. */
  aboutMe?: string
}

export type AvatarItem = {
  id?: number
  name?: string
  thumbnailUrl?: string
  model?: ModelInfo
}
export type AvatarsResponse = { avatars?: AvatarItem[] }

/** 11 `mates[]`. */
export type MateCard = {
  id?: number
  name?: string
  oneLiner?: string | null
  ageRating?: 'ALL' | 'ADULT' | (string & {})
  hashtags?: string[]
  cardImageUrl?: string | null
  comingSoon?: boolean
}
export type LastMate = { id?: number; name?: string; illustrationUrl?: string | null }

export type HomeResponse = {
  /** Today (05:00 KST boundary), ended connections only. */
  todayPresentSeconds?: number
  todayConnectedSeconds?: number
  activeConnection?: ActiveConnectionSummary | null
  /** Null on a first visit. */
  lastMate?: LastMate | null
  mates?: MateCard[]
}

/** 31. */
export type MateDetailResponse = {
  /** Mate id = character id (20 `characterId`). */
  id?: number
  name?: string
  oneLiner?: string | null
  ageRating?: 'ALL' | 'ADULT' | (string & {})
  hashtags?: string[]
  illustrationUrl?: string | null
  voiceSampleUrl?: string | null
  world?: string | null
  myRole?: string | null
  intro?: string | null
  /** Null while coming soon. */
  model?: ModelInfo | null
  comingSoon?: boolean
  /** True → the chat room (32) has earlier messages. */
  hasConversation?: boolean
}

/** 48 `mates[]` (public, no login). `model` is the same value as 31's. */
export type LoginMate = {
  id?: number
  name?: string
  ageRating?: string
  cardImageUrl?: string | null
  model?: ModelInfo | null
}
export type LoginMatesResponse = { mates?: LoginMate[] }

/** 43 `items[]` (OpenAPI `Item`). */
export type NotificationItem = {
  id?: number
  type?: 'STAGE_UP' | 'ATTENDANCE' | 'REFERRAL_REWARD' | (string & {})
  title?: string
  body?: string | null
  /** `/mates/me` · `/credits` · `/credits/invite`. */
  link?: string | null
  read?: boolean
  createdAt?: string
}
export type NotificationList = { items?: NotificationItem[]; unreadCount?: number; nextBefore?: number | null }
export type ReadRequest = { ids?: number[] }
export type Unread = { unreadCount?: number }
export type WaitlistRequest = { email: string }

// ── Connection (16–23, 28) ────────────────────────────────────────────────────────────────

export type StartRequest = { mateId: number }

/** 16 · 17 `me`. */
export type Me = { nickname?: string; honorific?: string | null; profileImageUrl?: string }

/** 16 `greeting`, 18 `reaction`. `expression` is a string here (an object in 19 · 20 · 28). */
export type ReactionView = {
  trigger?: 'GREETING' | 'AWAY' | 'RETURN' | 'IDLE' | (string & {})
  intensity?: number | null
  /** Always null for now; lines come from 19. */
  line?: string | null
  expression?: string | null
  audio?: unknown
}
/** 16 `relation`. */
export type RelationNow = { stage?: number; stageName?: string }
export type BackgroundView = { code?: string; name?: string; imageUrl?: string }

export type StartResponse = {
  connectionId?: number
  startedAt?: string
  mate?: Figure
  avatar?: Figure
  me?: Me
  settings?: UserSettings
  serverTime?: string
  firstMeet?: boolean
  greeting?: ReactionView | null
  minorRemainingSeconds?: number | null
  relation?: RelationNow
  credits?: Credits
  backgrounds?: BackgroundView[]
  background?: string | null
}

/** 17: the same figures plus the last heartbeat totals (no startedAt · greeting · settings · relation · credits). */
export type ResumeResponse = {
  connectionId?: number
  mate?: Figure
  avatar?: Figure
  me?: Me
  connectedSeconds?: number
  presentSeconds?: number
  cameraOnSeconds?: number
  pipSeconds?: number
  minorRemainingSeconds?: number | null
  serverTime?: string
  backgrounds?: BackgroundView[]
  background?: string | null
}

/** 18: `PRESENT` · `AWAY` · `RETURN` · `IDLE_TALK` only; anything else is 400 `INVALID_EVENT`. */
export type ConnectionEventType = 'PRESENT' | 'AWAY' | 'RETURN' | 'IDLE_TALK'
export type EventRequest = {
  type: ConnectionEventType
  /** AWAY: when the face stopped being seen. */
  occurredAt: string
}
export type EventResponse = {
  eventId?: number
  /** Null for PRESENT. */
  reaction?: ReactionView | null
}

export type MotionRef = { group?: string; file?: string }
export type ExpressionRef = { name?: string; file?: string | null }

export type ReactionRequest = {
  requestId: string
  /** AWAY only, 1–3. */
  intensity?: number
  tts?: boolean
}
export type ReactionCharacter = {
  characterId?: number
  content?: string
  emotion?: string
  motion?: MotionRef | null
  expression?: ExpressionRef | null
  fallback?: boolean
  audioBase64?: string | null
}
export type ReactionResponse = {
  requestId?: string
  characters?: ReactionCharacter[]
  charged?: number
  /** Only when sent with `tts: true`. */
  credits?: Credits | null
}

/** 21 · 22: all four are totals since the start, required, `0 ≤ present ≤ cameraOn ≤ connected ≤ elapsed`, `pip ≤ connected`. */
export type ConnectionTotals = {
  connectedSeconds: number
  presentSeconds: number
  cameraOnSeconds: number
  pipSeconds: number
}
export type HeartbeatRequest = ConnectionTotals

export type Unlocked = {
  type?: 'EXPRESSION' | 'VOICE_LINE' | (string & {})
  title?: string
  unlockStage?: number
  expressionName?: string | null
  assetUrl?: string | null
}
export type StageUp = { stage?: number; stageName?: string; unlocked?: Unlocked[] }
export type HeartbeatResponse = {
  /** Under 19: today's remaining connection seconds; 0 → end with `MINOR_LIMIT`. */
  minorRemainingSeconds?: number | null
  serverTime?: string
  /** Once per stage per connection; the real settlement is 22. */
  stageUp?: StageUp | null
}

export type EndType = 'NORMAL' | 'AUTO_AWAY' | 'MINOR_LIMIT'
export type EndRequest = ConnectionTotals & { endType?: EndType }

export type AffinityChange = {
  delta?: number
  points?: number
  level?: number
  /** @deprecated always false */
  levelUp?: boolean
  stage?: number
  stageName?: string
}

export type Background = { code?: string; name?: string; imageUrl?: string }

export type MessageRequest = {
  requestId: string
  /** The connected mate's id (= mateId). */
  characterId: number
  content: string
  inputType: 'TEXT' | 'QUICK' | 'VOICE'
  /** BASIC (default, 0 credits) · ADVANCED (30 per turn). */
  mode?: ConnectionMode
  /** 28 only. */
  tts?: boolean
}

/** 20 response, 28 `done`. */
export type MessageResponse = {
  requestId?: string
  characterId?: number
  content?: string
  emotion?: string
  motion?: MotionRef | null
  expression?: ExpressionRef | null
  affinity?: AffinityChange
  fallback?: boolean
  /** Always null (voice comes as 28 `audio` events). */
  audioBase64?: string | null
  mode?: ConnectionMode
  charged?: number
  credits?: Credits
  safety?: 'WARNING' | null
  background?: Background | null
  voice?: boolean
}

/** 28 `reply`: the whole reply so far — replace the bubble text, never append. */
export type MessageStreamReply = { content?: string }
/** 28 `audio`: an mp3 piece. */
export type MessageStreamAudio = { seq?: number; format?: 'mp3' | (string & {}); data?: string }
/** 28 `audio_end`. */
export type MessageStreamAudioEnd = { chunks?: number; complete?: boolean }

export type MateRef = { id?: number; name?: string; illustrationUrl?: string | null; myRole?: string | null }

/** 22 · 23 `relation` (intimacy, five stages). `stageProgress` is 0–100. */
export type IntimacyView = {
  stageBefore?: number
  stageAfter?: number
  stageName?: string
  stageUp?: boolean
  creditedSeconds?: number
  nextStageSeconds?: number | null
  stageProgress?: number
  unlocked?: Unlocked[]
}
export type ReferralRewardView = { amount?: number }

/** 22 · 23. */
export type ReportResponse = {
  connectionId?: number
  startedAt?: string
  endedAt?: string
  endType?: 'NORMAL' | 'AUTO_CLOSED' | 'AUTO_AWAY' | 'MINOR_LIMIT' | (string & {})
  connectedSeconds?: number
  presentSeconds?: number
  awaySeconds?: number
  cameraOnSeconds?: number
  /** Turns answered by the mate. */
  messageCount?: number
  returnCount?: number
  mate?: MateRef
  relation?: IntimacyView | null
  closingLine?: string | null
  referralReward?: ReferralRewardView | null
  betaFeedbackAvailable?: boolean
}

/**
 * Front-end projection of a settlement for the record screens (not a wire type): `stageProgress` is 0–1 here.
 * Built from `IntimacyView` (22 · 23) or 37 `relation` by `adapters.settlement`.
 */
export type StudySettlement = {
  stage?: number
  stageName?: string
  previousStageName?: string
  nextStageName?: string
  /** Seconds to the next stage (server `nextStageSeconds`). */
  nextLevelSeconds?: number
  /** 0–1. */
  stageProgress?: number
  stageSeconds?: number
  stageTargetSeconds?: number
  /** The stage went up in this connection (server `stageUp`). */
  levelUp?: boolean
  levelBefore?: number
  levelAfter?: number
  pointsBefore?: number
  pointsAfter?: number
}

export type FeedbackRequest = {
  kind: 'RATING' | 'BUG' | 'SUGGESTION'
  /** RATING: 1–4. */
  score?: number
  /** BUG · SUGGESTION: required, ≤ 1,000 chars. */
  text?: string
  connectionId?: number
}
export type FeedbackCreated = { feedbackId?: number }

// ── Chat room (32, 40, 41, 47) ────────────────────────────────────────────────────────────

export type ChatMessage = {
  /** Same for the user's line and its reply; the path value of 40 · 41. */
  requestId?: string
  sender?: 'USER' | 'MATE'
  content?: string
  inputType?: 'TEXT' | 'QUICK' | 'VOICE' | null
  rating?: 'UP' | 'DOWN' | null
  createdAt?: string
  connectionId?: number
}
export type ChatRoomResponse = { messages?: ChatMessage[]; nextCursor?: string | null }
export type MessageRatingRequest = { rating: 'UP' | 'DOWN' | null }
export type MessageReportReason = 'INAPPROPRIATE' | 'VIOLENT' | 'OUT_OF_CHARACTER' | 'OTHER'
export type MessageReportRequest = { reason: MessageReportReason; detail?: string }
export type MessageReportResponse = { reportId?: number }

// ── Credits · referrals (33–36, 39) ───────────────────────────────────────────────────────

export type CreditSummaryResponse = Credits & {
  /** Used today (from 05:00). */
  todayUsed?: number
  /** Invitation rewards received. */
  invitedFriends?: number
}
export type CreditTransactionFilter = 'ALL' | 'ATTENDANCE' | 'USE' | 'INVITE'
/** 34 `items[]` — the real shape (credit/dto/CreditTransactionsResponse.java); OpenAPI shows the notification `Item`. */
export type CreditTransaction = {
  id?: number
  type?: 'ATTENDANCE' | 'INVITE' | 'USE' | 'EXPIRE' | (string & {})
  title?: string
  /** + granted, − used or expired. */
  change?: number
  balanceAfter?: number
  createdAt?: string
}
export type CreditTransactionsResponse = { items?: CreditTransaction[]; nextCursor?: string | null }

export type ReferralFriend = {
  nickname?: string | null
  status?: 'JOINED' | 'QUALIFIED' | (string & {})
  rewarded?: boolean
  joinedAt?: string
}
export type ReferralStatus = {
  code?: string
  /** `https://capsule.ai.kr/i/<code>` (server setting). */
  link?: string
  rewardedCount?: number
  maxRewards?: number
  rewardedCredits?: number
  friends?: ReferralFriend[]
  canEnterCode?: boolean
  codeInputDeadline?: string | null
}
export type EnterReferralRequest = { code: string; deviceHash: string }
/** 36 · 39. */
export type ReferralEntered = { inviterNickname?: string; rewardOnFirstConnection?: number }

// ── Records · my mates (37, 38) ───────────────────────────────────────────────────────────

export type MateRelation = {
  stage?: number
  stageName?: string
  nextStageName?: string | null
  nextStageSeconds?: number | null
  /** 0–100. */
  stageProgress?: number
}
export type MateUnlock = {
  id?: number
  type?: 'EXPRESSION' | 'VOICE_LINE' | (string & {})
  title?: string
  unlockStage?: number
  unlockStageName?: string
  expressionName?: string | null
  assetUrl?: string | null
  unlocked?: boolean
  /** Not in the 11-25 document; read when sent (세계관, mate-worlds.ts). */
  unlockedAt?: string | null
}
/** 37 `recent[]` (the real shape; OpenAPI merged it with 38's). */
export type MyMateRecent = { connectionId?: number; endedAt?: string; presentSeconds?: number; connectedSeconds?: number }
export type MyMate = {
  id?: number
  name?: string
  cardImageUrl?: string | null
  firstMetAt?: string
  lastConnectedAt?: string
  connectionCount?: number
  totalPresentSeconds?: number
  totalConnectedSeconds?: number
  relation?: MateRelation
  unlocks?: MateUnlock[]
  recent?: MyMateRecent[]
}
export type MyMatesResponse = { mates?: MyMate[] }

export type RecordsRange = 'WEEK' | 'MONTH' | 'YEAR'
export type RecordBucket = { key?: string; presentSeconds?: number; connectedSeconds?: number }
export type RecordMateSummary = {
  mateId?: number
  name?: string
  presentSeconds?: number
  connectedSeconds?: number
  connectionCount?: number
  stage?: number
}
/** 38 `recent[]` (OpenAPI `Recent`). */
export type RecordRecent = MyMateRecent & { mateId?: number; mateName?: string }
export type RecordsResponse = {
  from?: string
  to?: string
  totalPresentSeconds?: number
  totalConnectedSeconds?: number
  connectedDays?: number
  connectionCount?: number
  buckets?: RecordBucket[]
  mates?: RecordMateSummary[]
  recent?: RecordRecent[]
}
