export type TierId = 'basic' | 'standard' | 'premium' | 'special'
export type AvatarSettings = {
  hair: number
  outfit: number
  appearance: number
  background: number
}
export type Profile = {
  name: string
  loggedIn: boolean
  onboarded: boolean
  avatar: AvatarSettings
}
export type LedgerEntry = {
  id: string
  at: number
  description: string
  kind: 'charge' | 'use' | 'bonus' | 'payment'
  change: number
  balance: number
  amount?: number
}
export type Pass = { name: string; expiresAt: number; premiumDay: string | null }
export type StudyRecord = {
  targetSeconds?: number
  id: string
  roomId: string
  characterIds: string[]
  tier: TierId
  startedAt: number
  endedAt: number
  studySeconds: number
  focusSeconds: number
  awaySeconds: number
  returns: number
  completed: boolean
  automatic: boolean
}
export type ActiveSession = {
  targetSeconds?: number
  id: string
  roomId: string
  characterIds: string[]
  tier: TierId
  paidCredits: number
  phase: 'study' | 'break'
  elapsedMs: number
  runningSince: number | null
  studySeconds: number
  startedAt: number
  camera: boolean
}
export type Memory = {
  id: string
  kind: '시험' | '목표' | '약속'
  title: string
  date: string
  time: string
}
export type Message = {
  id: string
  sessionId: string
  characterId: string
  sender: 'user' | 'character'
  text: string
  voice: boolean
}
export type Gift = {
  id: string
  characterId: string
  productId: string
  name: string
  at: number
  reply: string
  voice: boolean
}
export type DemoState = {
  version: 1
  profile: Profile
  firstVisit: boolean
  credits: number
  ledger: LedgerEntry[]
  pass: Pass | null
  cameraChecked: boolean
  cameraEnabled: boolean
  examPromptedRooms: string[]
  records: StudyRecord[]
  activeSession: ActiveSession | null
  latestRecordId: string | null
  memories: Memory[]
  scheduleSampleVersion?: number
  messages: Message[]
  gifts: Gift[]
  chatUsage: { day: string; used: number }
  savedRooms: string[]
}
