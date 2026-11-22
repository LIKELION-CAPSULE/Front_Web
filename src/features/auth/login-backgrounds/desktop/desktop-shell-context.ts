import { createContext, useContext } from 'react'
import type { LegalDocumentId } from '@/features/auth/data/legal-documents'
import type { MateReactionState } from './desktop-config'

export type DesktopShellMode = 'login' | 'onboarding' | 'password-reset'

export interface DesktopShellWindowConfig {
  windowKey: string
  windowTitle: string
  windowWidth: number
  mode: DesktopShellMode
  legalDocument: LegalDocumentId | null
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
