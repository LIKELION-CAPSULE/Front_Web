/**
 * The state of one server read (use-server-data.ts), kept pure so the tests import it directly.
 *
 * `dataKey` is the read key the data came from. While a new key loads, or after it failed, the last good data of the
 * same scope stays (`data`) but keeps its own key: a screen shows sums only when `dataKey` is the key it asked for
 * (`isCurrentServerData`), and otherwise keeps the previous screen dimmed with loading / failed · retry.
 */
export type ServerData<T> =
  | { status: 'loading'; data: T | null; dataKey: string | null; error: null }
  | { status: 'ready'; data: T; dataKey: string; error: null }
  | { status: 'error'; data: T | null; dataKey: string | null; error: string }

type Settled<T> = { status: 'loading'; data: null; error: null } | { status: 'ready'; data: T; error: null } | { status: 'error'; data: null; error: string }

export type ServerDataInput<T> = {
  /** The key the screen asks for now (null: nothing to read yet). */
  key: string | null
  /** `key#attempt` of the read that is due. */
  token: string | null
  /** The last settled read and its token. */
  state: { token: string | null; value: Settled<T> }
  /** The last good data with its scope (the account) and key. */
  last: { scope: string | null; key: string; data: T } | null
  scope: string | null
}

export function resolveServerData<T>({ key, token, state, last, scope }: ServerDataInput<T>): ServerData<T> {
  const kept = last && last.scope === scope ? last : null
  const data = kept?.data ?? null
  const dataKey = kept?.key ?? null
  if (state.token !== token || state.value.status === 'loading') return { status: 'loading', data, dataKey, error: null }
  if (state.value.status === 'error') return { status: 'error', data, dataKey, error: state.value.error }
  return { status: 'ready', data: state.value.data, dataKey: key ?? '', error: null }
}

/** The data answers the key asked for now (not a previous filter's). */
export function isCurrentServerData(result: Pick<ServerData<unknown>, 'data' | 'dataKey'>, key: string | null): boolean {
  return key !== null && result.data !== null && result.dataKey === key
}
