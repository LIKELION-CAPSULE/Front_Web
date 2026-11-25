import { useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useDemo } from '@/features/demo/demo-context'
import { BackendContext } from '@/features/backend/backend-context'
import { getSettings, updateSettings as saveServerSettings } from '@/features/backend/server-api'
import { api } from '@/shared/api/client'
import { ConnectionSettingsStore, PipSpeechPreference, type ConnectionSettings } from './connection-preferences'
import { ConnectionPreferencesContext } from './connection-preferences-context'
import { fromServerSettings, toServerSettings } from './connection-settings-sync'
import { SettingsSaveQueue, type SettingsSaveStatus } from './settings-save-queue'

/**
 * T-1…T-10 per account. The browser copy shows at once; for a signed-in account the server copy (29) replaces the
 * server-owned fields the user has not changed since, and changes of those fields are saved (30) through one queue per
 * account (settings-save-queue.ts: in order, failures kept and retried, 「다시 저장」). Before signing out, what is still
 * waiting is saved at once; switching to another account drops the previous account's unsaved changes (their token is
 * gone), the browser copy keeps them.
 */
export function ConnectionPreferencesProvider({ children }: { children: ReactNode }) {
  const { state } = useDemo()
  const backend = useContext(BackendContext)
  const userId = state.profile.loggedIn ? state.profile.userId ?? null : null
  const synced = Boolean(userId && state.profile.onboarded && backend?.status === 'ready')
  const { preference, store } = useMemo(() => {
    let storage: Storage | null = null
    try { storage = localStorage } catch { /* Use the in-memory setting. */ }
    return { preference: new PipSpeechPreference(storage, userId), store: new ConnectionSettingsStore(storage, userId) }
  }, [userId])
  const showPipSpeech = useSyncExternalStore(preference.subscribe, preference.getSnapshot)
  const settings = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const [saveStatus, setSaveStatus] = useState<{ queue: SettingsSaveQueue | null; status: SettingsSaveStatus }>({ queue: null, status: 'idle' })
  // Bumped when the queue's `confirmed` may have changed (server copy read, a key changed by the user).
  const [, setConfirmedVersion] = useState(0)
  const queue = useMemo(() => synced ? new SettingsSaveQueue({
    save: body => saveServerSettings(api, body),
    load: () => getSettings(api),
    applyServer: value => {
      const server = fromServerSettings(value)
      store.update(server.settings)
      if (server.pipBubble !== undefined) preference.setVisible(server.pipBubble)
    },
    onStatus: status => setSaveStatus({ queue, status }),
    onConfirmed: () => setConfirmedVersion(version => version + 1),
  }) : null, [synced, store, preference])
  useEffect(() => {
    if (!queue) return
    void queue.load()
    return () => queue.dispose()
  }, [queue])
  const onBeforeSignOut = backend?.onBeforeSignOut
  useEffect(() => {
    if (!queue || !onBeforeSignOut) return
    return onBeforeSignOut(() => queue.flushNow())
  }, [queue, onBeforeSignOut])
  const updateSettings = useCallback((patch: Partial<ConnectionSettings>) => {
    const before = store.getSnapshot()
    store.update(patch)
    const after = store.getSnapshot()
    const changed = Object.fromEntries((Object.keys(after) as (keyof ConnectionSettings)[]).filter(key => after[key] !== before[key]).map(key => [key, after[key]])) as Partial<ConnectionSettings>
    queue?.change(toServerSettings(changed))
  }, [store, queue])
  const setShowPipSpeech = useCallback((visible: boolean) => {
    if (preference.getSnapshot() === visible) return
    preference.setVisible(visible)
    queue?.change(toServerSettings({}, visible))
  }, [preference, queue])
  const retrySave = useCallback(() => { void queue?.retry() }, [queue])
  const status = saveStatus.queue === queue ? saveStatus.status : 'idle'
  // Without a server copy (no signed-in account) the browser copy is all there is.
  const modeConfirmed = queue ? queue.confirmed('defaultMode') : !synced
  return (
    <ConnectionPreferencesContext value={{ showPipSpeech, setShowPipSpeech, settings, updateSettings, saveStatus: status, retrySave, modeConfirmed }}>
      {children}
    </ConnectionPreferencesContext>
  )
}
