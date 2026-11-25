import { createContext, useContext } from 'react'
import { DEFAULT_CONNECTION_SETTINGS, type ConnectionSettings } from './connection-preferences'

export type ConnectionPreferencesValue = {
  showPipSpeech: boolean
  setShowPipSpeech: (visible: boolean) => void
  /** T-1…T-10 (connection-preferences.ts). */
  settings: ConnectionSettings
  updateSettings: (patch: Partial<ConnectionSettings>) => void
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
