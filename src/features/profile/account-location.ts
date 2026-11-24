export type AccountRequest = { view: 'profile' | 'settings' }

export function accountRequest(search: string): AccountRequest | null {
  const params = new URLSearchParams(search)
  const view = params.get('account')
  return view === 'profile' || view === 'settings' || view === 'schedule'
    ? { view: view === 'schedule' ? 'settings' : view }
    : null
}

export function closeAccountRequest(search: string): string {
  const request = accountRequest(search)
  if (!request) return search
  const params = new URLSearchParams(search)
  params.delete('account')
  // Closing a modal the service tour opened ends the tour too; leaving `tour` would make the tour open it again.
  params.delete('tour')
  if (new URLSearchParams(search).get('account') === 'schedule') params.delete('add')
  return params.size ? `?${params}` : ''
}

/** Retired calendar links open settings without reviving schedule creation. */
export function legacyAccountDestination(search: string, hash: string): string {
  const add = new URLSearchParams(search).get('add') === '1'
  const params = new URLSearchParams({ account: add || hash === '#schedule' ? 'settings' : 'profile' })
  return `/?${params}`
}
