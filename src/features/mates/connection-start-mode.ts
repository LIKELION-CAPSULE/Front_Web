import type { ConnectionMode } from './connection-preferences.ts'

/**
 * T-7 on the call screen: which mode (if any) the account setting should apply to a connection.
 *
 * The connection starts in the mode its start / resume response gives (`settings.defaultMode`, DemoProvider). The
 * settings' mode replaces it only when it can be trusted over that response:
 * - `confirmed`: the server copy of the settings has been read (29), or the user changed the mode themselves (it is
 *   being saved, or was saved, in this session) — never a browser cache the server has not confirmed yet;
 * - once per connection, and never after the mode was chosen on the call screen (`applied` holds those connections too).
 * Until then it answers `null` and asks again when `confirmed` changes.
 */
export function startModeToApply(input: {
  connectionId: string | null | undefined
  applied: ReadonlySet<string>
  confirmed: boolean
  mode: ConnectionMode
}): ConnectionMode | null {
  if (!input.connectionId || input.applied.has(input.connectionId) || !input.confirmed) return null
  return input.mode
}
