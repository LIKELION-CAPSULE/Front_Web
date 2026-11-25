import { useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { useDemo } from '@/features/demo/demo-context'
import { ConnectionSettingsStore, PipSpeechPreference } from './connection-preferences'
import { ConnectionPreferencesContext } from './connection-preferences-context'

export function ConnectionPreferencesProvider({ children }: { children: ReactNode }) {
  const { state } = useDemo()
  const userId = state.profile.loggedIn ? state.profile.userId ?? null : null
  const { preference, store } = useMemo(() => {
    let storage: Storage | null = null
    try { storage = localStorage } catch { /* Use the in-memory setting. */ }
    return { preference: new PipSpeechPreference(storage, userId), store: new ConnectionSettingsStore(storage, userId) }
  }, [userId])
  const showPipSpeech = useSyncExternalStore(preference.subscribe, preference.getSnapshot)
  const settings = useSyncExternalStore(store.subscribe, store.getSnapshot)
  return (
    <ConnectionPreferencesContext value={{ showPipSpeech, setShowPipSpeech: preference.setVisible, settings, updateSettings: store.update }}>
      {children}
    </ConnectionPreferencesContext>
  )
}
