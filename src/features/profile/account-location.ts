export type AccountRequest = { view: 'profile' | 'schedule'; openEditor: boolean }

export function accountRequest(search: string): AccountRequest | null {
  const params = new URLSearchParams(search)
  const view = params.get('account')
  return view === 'profile' || view === 'schedule'
    ? { view, openEditor: view === 'schedule' && params.get('add') === '1' }
    : null
}

export function closeAccountRequest(search: string): string {
  const request = accountRequest(search)
  if (!request) return search
  const params = new URLSearchParams(search)
  params.delete('account')
  if (request.openEditor) params.delete('add')
  return params.size ? `?${params}` : ''
}

/** Preserve old profile/calendar links without keeping a separate account page. */
export function legacyAccountDestination(search: string, hash: string): string {
  const add = new URLSearchParams(search).get('add') === '1'
  const params = new URLSearchParams({ account: add || hash === '#schedule' ? 'schedule' : 'profile' })
  if (add) params.set('add', '1')
  return `/?${params}`
}
