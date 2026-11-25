import { createContext, useContext } from 'react'
import { DEFAULT_CONNECTION_SETTINGS, type ConnectionSettings } from './connection-preferences'
import type { SettingsSaveStatus } from './settings-save-queue'

export type ConnectionPreferencesValue = {
  showPipSpeech: boolean
  setShowPipSpeech: (visible: boolean) => void
  /** T-1…T-10 (connection-preferences.ts). */
  settings: ConnectionSettings
  updateSettings: (patch: Partial<ConnectionSettings>) => void
  /** Saving the server copy (API 30): `error` keeps the unsaved changes for 「다시 저장」 (`retrySave`). */
  saveStatus?: SettingsSaveStatus
  retrySave?: () => void
  /**
   * T-7 can be trusted over a connection's start response: the server copy was read (29), or the user changed the mode
   * in this session. False while only an unconfirmed browser cache is known.
   */
  modeConfirmed?: boolean
}

export const ConnectionPreferencesContext = createContext<ConnectionPreferencesValue | null>(null)

export function useConnectionPreferences() {
  const value = useContext(ConnectionPreferencesContext)
  if (!value) throw new Error('ConnectionPreferencesProvider is missing')
  return value
}

/** The settings where a provider may be missing (review screens, isolated tests): defaults then. */
export function useConnectionSettings(): ConnectionSettings {
  return useContext(ConnectionPreferencesContext)?.settings ?? DEFAULT_CONNECTION_SETTINGS
}
