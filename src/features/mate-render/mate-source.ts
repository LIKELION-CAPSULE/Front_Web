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

/**
 * Optional format hint from the server (`model.format`). When present it wins over the URL suffix, so hashed CDN
 * file names still work; unknown values fall back to suffix detection.
 */
export type MateModelFormat = 'aliving2d' | 'cubism'

function normalizeFormat(format: string | null | undefined): MateModelFormat | null {
  const value = format?.trim().toLowerCase()
  if (value === 'aliving2d' || value === 'aliving') return 'aliving2d'
  if (value === 'cubism' || value === 'live2d-cubism') return 'cubism'
  return null
}

/** Detects the model format from the optional hint, then the URL suffix (`.model3.json` / `/model.json`). */
export function detectModelFormat(
  modelUrl: string | null | undefined,
  format?: string | null,
): MateModelFormat | null {
  const url = modelUrl?.trim() ?? ''
  if (!url) return null
  const hinted = normalizeFormat(format)
  if (hinted) return hinted
  const clean = stripQueryAndHash(url)
  if (clean.endsWith('.model3.json')) return 'cubism'
  if (clean === 'model.json' || clean.endsWith('/model.json')) return 'aliving2d'
  return null
}

export function resolveMateSource(
  input: {
    modelUrl?: string | null
    engineUrl?: string | null
    playerUrl?: string | null
    reactionsUrl?: string | null
    format?: string | null
  },
  options: AllowlistOptions = {},
): ResolvedMateSource {
  const modelUrl = input.modelUrl?.trim() ?? ''
  if (!modelUrl) return { kind: 'static' }

  const format = detectModelFormat(modelUrl, input.format)
  if (format === 'cubism') {
    return { kind: 'cubism', modelUrl }
  }

  if (format === 'aliving2d') {
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

/**
 * Mate preview source (my mates / mate detail / connection record).
 * - `aliving`: v2 Aliving2D model + allowlisted engine scripts -> AlivingRenderer
 * - `legacy`: any other model URL -> the injected preview stage factory (Cubism `.model3.json`, or the review
 *   workbench's image stage). Kept as a compatibility path while the server can still hand out Cubism models.
 * - `static`: no model, or an Aliving2D model whose engine URL is missing / not allowlisted -> v2 still image
 */
export type PreviewMateSource =
  | Extract<ResolvedMateSource, { kind: 'aliving' }>
  | { kind: 'legacy'; modelUrl: string }
  | { kind: 'static' }

export function resolvePreviewSource(
  model:
    | {
        modelJsonUrl?: string | null
        engineUrl?: string | null
        playerUrl?: string | null
        reactionsUrl?: string | null
        format?: string | null
      }
    | null
    | undefined,
  options: AllowlistOptions = {},
): PreviewMateSource {
  const modelUrl = model?.modelJsonUrl?.trim() ?? ''
  if (!modelUrl) return { kind: 'static' }
  if (detectModelFormat(modelUrl, model?.format) !== 'aliving2d') return { kind: 'legacy', modelUrl }
  const resolved = resolveMateSource(
    {
      modelUrl,
      engineUrl: model?.engineUrl,
      playerUrl: model?.playerUrl,
      reactionsUrl: model?.reactionsUrl,
      format: 'aliving2d',
    },
    options,
  )
  return resolved.kind === 'aliving' ? resolved : { kind: 'static' }
}
