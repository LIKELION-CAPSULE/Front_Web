// OpenAPI 3.1 snapshot: docs/BACKEND_OPENAPI_2026-11-05.json.
// Fields without required remain optional; adapters validate the fields needed by the UI.

export type StartRequest = {
  roomId: number
  characterId: number
  targetMinutes?: number
}

export type Figure = {
  id?: number
  name?: string
  profileImageUrl?: string
  modelJsonUrl?: string
  scale?: number
  offsetX?: number
  offsetY?: number
}

export type Me = {
  nickname?: string
  profileImageUrl?: string
}

export type RoomView = {
  id?: number
  name?: string
  backgroundImageUrl?: string
}

export type StartResponse = {
  sessionId?: number
  startedAt?: string
  targetMinutes?: number
  room?: RoomView
  character?: Figure
  avatar?: Figure
  me?: Me
  serverTime?: string
}

export type ResumeResponse = {
  sessionId?: number
  targetMinutes?: number
  room?: RoomView
  character?: Figure
  avatar?: Figure
  me?: Me
  studySeconds?: number
  breakSeconds?: number
  serverTime?: string
}

export type MessageRequest = {
  requestId: string
  characterId: number
  content: string
  inputType: "TEXT" | "QUICK"
  tts?: boolean
}

export type AffinityChange = {
  delta?: number
  points?: number
  level?: number
  /** @deprecated */
  levelUp?: boolean
  stage?: number
  stageName?: string
}

export type ExpressionRef = {
  name?: string
  file?: string
}

export type MessageResponse = {
  requestId?: string
  characterId?: number
  content?: string
  emotion?: string
  motion?: MotionRef
  expression?: ExpressionRef
  affinity?: AffinityChange
  fallback?: boolean
  audioBase64?: string
}

export type MotionRef = {
  group?: string
  file?: string
}

export type HeartbeatRequest = {
  studySeconds?: number
  presentSeconds?: number
}

export type EventRequest = {
  type?: string
  occurredAt?: string
}

export type EventCharacter = {
  characterId?: number
  motion?: MotionRef
  expression?: ExpressionRef
  affinity?: AffinityChange
}

export type EventResponse = {
  eventId?: number
  characters?: (EventCharacter)[]
}

export type ReactionRequest = {
  requestId: string
  intensity?: number
  tts?: boolean
}

export type ReactionCharacter = {
  characterId?: number
  content?: string
  emotion?: string
  motion?: MotionRef
  expression?: ExpressionRef
  fallback?: boolean
  audioBase64?: string
}

export type ReactionResponse = {
  requestId?: string
  characters?: (ReactionCharacter)[]
}

export type EndRequest = {
  studySeconds?: number
  presentSeconds?: number
}

export type CharacterRef = {
  id?: number
  name?: string
}

export type ReportResponse = {
  sessionId?: number
  roomName?: string
  startedAt?: string
  endedAt?: string
  endType?: string
  studySeconds?: number
  presentSeconds?: number
  awaySeconds?: number
  returnCount?: number
  character?: CharacterRef
  relation?: StudySettlement
  closingLine?: string
}

export type StudySettlement = {
  levelBefore?: number
  levelAfter?: number
  /** @deprecated */
  levelName?: string
  pointsBefore?: number
  pointsAfter?: number
  /** @deprecated */
  nextLevelPoints?: number
  levelUp?: boolean
  stage?: number
  stageName?: string
  nextLevelSeconds?: number
}

export type CreateMemoryRequest = {
  type?: string
  title?: string
  dueDate?: string
  dueTime?: string
}

export type MemoryResponse = {
  memoryId?: number
  type?: "EXAM" | "GOAL" | "PROMISE"
  title?: string
  dueDate?: string
  dueTime?: string
  dDay?: number
}

export type KakaoRequest = {
  code?: string
  redirectUri?: string
}

export type KakaoResponse = {
  accessToken?: string
  userId?: number
  isNewUser?: boolean
  onboardingRequired?: boolean
}

export type AccessTokenResponse = {
  accessToken?: string
}

export type PasswordResetRequest = {
  token?: string
  newPassword?: string
}

export type EmailRequest = {
  email?: string
}

export type ExpiresResponse = {
  expiresInSeconds?: number
}

export type ConfirmRequest = {
  email?: string
  code?: string
}

export type VerificationResponse = {
  verificationToken?: string
}

export type SignupRequest = {
  verificationToken?: string
  password?: string
  nickname?: string
  agreedTermVersionIds?: (number)[]
}

export type LoginResponse = {
  accessToken?: string
  userId?: number
  onboardingRequired?: boolean
}

export type LoginRequest = {
  email?: string
  password?: string
}

export type UpdateMeRequest = {
  nickname?: string
  avatarId?: number
}

export type ActiveSessionSummary = {
  sessionId?: number
  roomId?: number
  roomName?: string
  characterName?: string
  startedAt?: string
}

export type MeResponse = {
  userId?: number
  nickname?: string
  email?: string
  onboardingRequired?: boolean
  activeSession?: ActiveSessionSummary
  profileImage?: string
}

export type TermVersion = {
  termVersionId?: number
  code?: string
  name?: string
  required?: boolean
  content?: string
}

export type TermsResponse = {
  terms?: (TermVersion)[]
}

export type RelationBrief = {
  level?: number
  /** @deprecated */
  levelName?: string
  totalStudySeconds?: number
  points?: number
  stage?: number
  stageName?: string
}

export type RoomCharacter = {
  id?: number
  name?: string
  profileImageUrl?: string
  personality?: (string)[]
  relation?: RelationBrief
}

export type RoomDetail = {
  id?: number
  name?: string
  description?: string
  thumbnailUrl?: string
  bannerUrl?: string
  characters?: (RoomCharacter)[]
  activeSessionId?: number
}

export type MemoryList = {
  memories?: (MemoryResponse)[]
  datesWithMemories?: (string)[]
}

export type CharacterBrief = {
  id?: number
  name?: string
  profileImageUrl?: string
}

export type HomeResponse = {
  todayStudySeconds?: number
  activeSession?: ActiveSessionSummary
  rooms?: (HomeRoom)[]
}

export type HomeRoom = {
  id?: number
  name?: string
  thumbnailUrl?: string
  characters?: (CharacterBrief)[]
}

export type AvatarItem = {
  id?: number
  name?: string
  thumbnailUrl?: string
  model?: ModelInfo
}

export type AvatarsResponse = {
  avatars?: (AvatarItem)[]
}

export type ModelInfo = {
  modelJsonUrl?: string
  scale?: number
  offsetX?: number
  offsetY?: number
}
