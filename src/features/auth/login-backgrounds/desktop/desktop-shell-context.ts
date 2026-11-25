import { createContext, useContext } from 'react'
import type { LegalDocumentId } from '@/features/auth/data/legal-documents'
import type { TermVersion } from '@/shared/api/types'
import type { MateReactionState } from './desktop-config'

export type DesktopShellMode = 'login' | 'onboarding' | 'password-reset'

export interface DesktopShellWindowConfig {
  windowKey: string
  windowTitle: string
  windowWidth: number
  mode: DesktopShellMode
  legalDocument: LegalDocumentId | null
  /** The terms the open document is read from, when the screen fetched its own (the Kakao consent screen). */
  legalTerms?: readonly TermVersion[]
  onCloseLegal: () => void
  hasErrorNotification: boolean
  scrollResetKey: string
}

export interface DesktopShellContextValue {
  setWindowConfig: (config: DesktopShellWindowConfig) => void
  setWindowClosing?: (closing: boolean) => void
  triggerReaction: (
    state: MateReactionState,
    options?: {
      line?: string | null
      force?: boolean
      revertAfterMs?: number
      queueAfter?: MateReactionState
      clearQueue?: boolean
    },
  ) => void
}

export const DesktopShellContext = createContext<DesktopShellContextValue | null>(null)

export function useDesktopShell(): DesktopShellContextValue | null {
  return useContext(DesktopShellContext)
}
