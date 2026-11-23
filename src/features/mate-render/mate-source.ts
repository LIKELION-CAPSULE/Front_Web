/**
 * Pure format detection & engine URL allowlist for mate renderers.
 * Dependency-free so Node's `--experimental-strip-types` runner can test it directly.
 */

export type ResolvedMateSource =
  | { kind: 'cubism'; modelUrl: string }
  | { kind: 'aliving'; modelUrl: string; engineUrl: string; playerUrl: string; reactionsUrl?: string }
  | { kind: 'static' }

export interface AllowlistOptions {
  pageOrigin?: string
  apiBaseUrl?: string
}

function tryParseOrigin(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const u = new URL(trimmed)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.origin
  } catch {
    return null
  }
}

/**
 * Allows an external runtime engine script URL only if `new URL(url, pageOrigin)` resolves
 * to `http:` or `https:` whose origin matches `pageOrigin` or `VITE_API_BASE_URL`.
 * Rejects backslashes (`\` / `%5C`), protocol-relative URLs, and foreign origins.
 */
export function isAllowedEngineUrl(
  url: string | null | undefined,
  options: AllowlistOptions = {},
): boolean {
  if (!url || typeof url !== 'string') return false
  const trimmed = url.trim()
  if (!trimmed) return false
  // Reject raw or percent-encoded backslashes (browsers/proxies may normalize /\host -> //host)
  if (trimmed.includes('\\') || /%5c/i.test(trimmed)) return false

  const pageOrigin =
    tryParseOrigin(
      options.pageOrigin ??
        (typeof window !== 'undefined' && window.location ? window.location.origin : ''),
    ) ?? null
  const apiOrigin = tryParseOrigin(options.apiBaseUrl)

  let parsed: URL
  try {
    parsed = pageOrigin ? new URL(trimmed, pageOrigin) : new URL(trimmed)
  } catch {
    return false
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
  if (pageOrigin && parsed.origin === pageOrigin) return true
  if (apiOrigin && parsed.origin === apiOrigin) return true
  return false
}

function deriveSiblingUrl(engineUrl: string, siblingFile: string): string {
  const clean = engineUrl.split('?')[0] ?? engineUrl
  const query = engineUrl.includes('?') ? engineUrl.slice(engineUrl.indexOf('?')) : ''
  const slashIdx = clean.lastIndexOf('/')
  const dir = slashIdx >= 0 ? clean.slice(0, slashIdx + 1) : ''
  return `${dir}${siblingFile}${query}`
}

function stripQueryAndHash(url: string): string {
  return (url.split(/[?#]/)[0] ?? '').toLowerCase()
}

export function resolveMateSource(
  input: {
    modelUrl?: string | null
    engineUrl?: string | null
    playerUrl?: string | null
    reactionsUrl?: string | null
  },
  options: AllowlistOptions = {},
): ResolvedMateSource {
  const modelUrl = input.modelUrl?.trim() ?? ''
  if (!modelUrl) return { kind: 'static' }

  const cleanModel = stripQueryAndHash(modelUrl)
  if (cleanModel.endsWith('.model3.json')) {
    return { kind: 'cubism', modelUrl }
  }

  const isAlivingModel = cleanModel === 'model.json' || cleanModel.endsWith('/model.json')
  if (isAlivingModel) {
    const engineUrl = input.engineUrl?.trim() ?? ''
    if (!engineUrl || !isAllowedEngineUrl(engineUrl, options)) {
      return { kind: 'static' }
    }
    const playerUrl = input.playerUrl?.trim() || deriveSiblingUrl(engineUrl, 'player.js')
    if (!isAllowedEngineUrl(playerUrl, options)) {
      return { kind: 'static' }
    }
    const reactionsUrl = input.reactionsUrl?.trim() || undefined
    if (reactionsUrl && !isAllowedEngineUrl(reactionsUrl, options)) {
      return { kind: 'aliving', modelUrl, engineUrl, playerUrl }
    }
    return { kind: 'aliving', modelUrl, engineUrl, playerUrl, reactionsUrl }
  }

  return { kind: 'static' }
}
