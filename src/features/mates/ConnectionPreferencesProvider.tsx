import { useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { useDemo } from '@/features/demo/demo-context'
import { BackendContext } from '@/features/backend/backend-context'
import { getSettings, updateSettings as saveServerSettings } from '@/features/backend/server-api'
import { api } from '@/shared/api/client'
import type { UserSettingsPatch } from '@/shared/api/types'
import { ConnectionSettingsStore, PipSpeechPreference, type ConnectionSettings } from './connection-preferences'
import { ConnectionPreferencesContext } from './connection-preferences-context'
import { fromServerSettings, toServerSettings } from './connection-settings-sync'

/** Changes are sent together after this pause (the volume slider moves in many small steps). */
const SAVE_DELAY_MS = 600

/**
 * T-1…T-10 per account. The browser copy shows at once; for a signed-in account the server copy (29) replaces the
 * server-owned fields once read, and later changes of those fields are saved (30). A failed save keeps the local value.
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
  const outgoing = useRef<{ body: UserSettingsPatch; timer: ReturnType<typeof setTimeout> | null; store: ConnectionSettingsStore | null }>({ body: {}, timer: null, store: null })
  useEffect(() => {
    if (!synced) return
    let current = true
    void getSettings(api).then(value => {
      if (!current) return
      const server = fromServerSettings(value)
      store.update(server.settings)
      if (server.pipBubble !== undefined) preference.setVisible(server.pipBubble)
    }).catch(() => { /* The browser copy stays. */ })
    return () => { current = false }
  }, [synced, store, preference])
  const save = useCallback((body: UserSettingsPatch) => {
    if (!synced || !Object.keys(body).length) return
    const pending = outgoing.current
    if (pending.store !== store) pending.body = {}
    pending.store = store
    pending.body = { ...pending.body, ...body }
    if (pending.timer) clearTimeout(pending.timer)
    pending.timer = setTimeout(() => {
      const next = pending.body
      pending.body = {}; pending.timer = null
      if (pending.store === store) void saveServerSettings(api, next).catch(() => { /* Kept locally; the next change retries. */ })
    }, SAVE_DELAY_MS)
  }, [synced, store])
  useEffect(() => () => { const pending = outgoing.current; if (pending.timer) clearTimeout(pending.timer); pending.timer = null; pending.body = {} }, [store])
  const updateSettings = useCallback((patch: Partial<ConnectionSettings>) => {
    const before = store.getSnapshot()
    store.update(patch)
    const after = store.getSnapshot()
    const changed = Object.fromEntries((Object.keys(after) as (keyof ConnectionSettings)[]).filter(key => after[key] !== before[key]).map(key => [key, after[key]])) as Partial<ConnectionSettings>
    save(toServerSettings(changed))
  }, [store, save])
  const setShowPipSpeech = useCallback((visible: boolean) => {
    if (preference.getSnapshot() === visible) return
    preference.setVisible(visible)
    save(toServerSettings({}, visible))
  }, [preference, save])
  return (
    <ConnectionPreferencesContext value={{ showPipSpeech, setShowPipSpeech, settings, updateSettings }}>
      {children}
    </ConnectionPreferencesContext>
  )
}
