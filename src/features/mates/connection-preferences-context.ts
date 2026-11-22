import { createContext, useContext } from 'react'

export const ConnectionPreferencesContext = createContext<{ showPipSpeech: boolean; setShowPipSpeech: (visible: boolean) => void } | null>(null)

export function useConnectionPreferences() {
  const value = useContext(ConnectionPreferencesContext)
  if (!value) throw new Error('ConnectionPreferencesProvider is missing')
  return value
}
