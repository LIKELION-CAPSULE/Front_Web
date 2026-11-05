import type { Location } from 'react-router'

export function prepareRoomId(pathname: string): string | null {
  return /^\/rooms\/([^/\\?#]+)\/prepare\/?$/.exec(pathname)?.[1] ?? null
}

/** Only real app screens can be kept behind the study preparation dialog. */
export function prepareBackground(state: unknown): Location | null {
  if (!state || typeof state !== 'object' || !('prepareBackground' in state)) return null
  const background = state.prepareBackground
  if (!background || typeof background !== 'object') return null
  const value = background as Partial<Location>
  if (typeof value.pathname !== 'string' || !/^(?:\/|\/rooms\/[^/\\?#]+|\/characters\/[^/\\?#]+)$/.test(value.pathname)) return null
  if (typeof value.search !== 'string' || (value.search !== '' && !value.search.startsWith('?'))) return null
  if (typeof value.hash !== 'string' || (value.hash !== '' && !value.hash.startsWith('#'))) return null
  if (typeof value.key !== 'string') return null
  return { pathname: value.pathname, search: value.search, hash: value.hash, state: value.state ?? null, key: value.key }
}
