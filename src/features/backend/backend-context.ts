import { createContext, useContext } from 'react'
import type { ActiveSession, Memory, StudyRecord } from '../demo/types'
import type { ActiveSessionSummary, AffinityChange, AvatarItem, HomeResponse, LoginResponse, MeResponse, MessageResponse, StartResponse, ResumeResponse, TermVersion } from '@/shared/api/types'

export type BackendContextValue = {
  status: 'loading' | 'ready' | 'error'
  error: string | null
  me: MeResponse | null
  home: HomeResponse | null
  activeSummary: ActiveSessionSummary | null
  avatars: AvatarItem[]
  terms: TermVersion[]
  visuals: StartResponse | ResumeResponse | null
  affinities: Record<string, AffinityChange>
  updateAffinity: (characterId: number, value?: AffinityChange) => void
  refreshHome: () => Promise<void>
  reload: () => Promise<void>
  authenticate: (result: LoginResponse) => Promise<MeResponse>
  logout: () => Promise<void>
  forgetAuthentication: () => void
  saveProfile: (nickname: string, avatarId?: number) => Promise<void>
  createMemory: (input: Omit<Memory, 'id'>) => Promise<Memory>
  startSession: (roomId: string, characterId: string, minutes: number) => Promise<ActiveSession>
  resumeSession: (sessionId: string) => Promise<ActiveSession>
  /** `acceptUnknownPresence`: the user confirmed ending although earlier presence could not be restored. */
  finishSession: (options?: { acceptUnknownPresence?: boolean }) => Promise<StudyRecord>
  sendMessage: (characterId: string, content: string, inputType?: 'TEXT' | 'QUICK') => Promise<MessageResponse>
  loadReport: (sessionId: string) => Promise<void>
}
export const BackendContext = createContext<BackendContextValue | null>(null)
export function useBackend() {
  const value = useContext(BackendContext)
  if (!value) throw new Error('BackendProvider is missing')
  return value
}
