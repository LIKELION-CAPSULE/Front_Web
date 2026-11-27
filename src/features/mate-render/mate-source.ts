/**
 * Pure format detection & engine URL allowlist for mate renderers.
 * Dependency-free so Node's `--experimental-strip-types` runner can test it directly.
 */

export type ResolvedMateSource =
  | { kind: 'cubism'; modelUrl: string }
  | { kind: 'aliving'; modelUrl: string; engineUrl: string; playerUrl: string; reactionsUrl?: string }
  | { kind: 'static' }

/** An exact origin and a path prefix (ending in `/`) under which engine scripts may be loaded. */
export type EngineSource = { origin: string; pathPrefix: string }

/**
 * The mates' v2 engine scripts on the asset storage (backend 2026-11-26: 채린 id 4, 서진 id 2 · 3). Exactly this
 * project's origin and only its public `live2d-model` bucket — never another Supabase project or bucket.
 * `VITE_ENGINE_ALLOWLIST` replaces it (engine-allowlist.ts).
 */
export const ENGINE_SOURCES: readonly EngineSource[] = [
  { origin: 'https://belbmclzeenlntgpekww.supabase.co', pathPrefix: '/storage/v1/object/public/live2d-model/' },
]

/**
 * `VITE_ENGINE_ALLOWLIST`: comma-separated `https://origin/path/prefix/` entries. A malformed entry (not https, a query,
 * a wildcard, no trailing slash, dot segments) is dropped; nothing valid left falls back to `ENGINE_SOURCES`.
 */
export function parseEngineSources(raw: string | null | undefined): readonly EngineSource[] {
  if (!raw || typeof raw !== 'string' || !raw.trim()) return ENGINE_SOURCES
  const sources: EngineSource[] = []
  for (const entry of raw.split(',').map(value => value.trim()).filter(Boolean)) {
    if (entry.includes('*') || entry.includes('\\') || /%(2e|2f|5c|25)/i.test(entry)) continue
    // Before `new URL`: the parser resolves `..` and `.` (`/engines/../other/` becomes `/other/`), so its pathname can
    // no longer show them.
    if (hasDotSegment(entry)) continue
    try {
      const url = new URL(entry)
      if (url.protocol !== 'https:' || url.search || url.hash || url.username || url.password) continue
      if (!url.pathname.endsWith('/') || url.pathname.includes('//')) continue
      sources.push({ origin: url.origin, pathPrefix: url.pathname })
    } catch { /* Dropped. */ }
  }
  return sources.length ? sources : ENGINE_SOURCES
}

/** A `.` or `..` path segment (also percent-encoded, `%2e`) in the path as written, before any URL parsing. */
function hasDotSegment(entry: string): boolean {
  const path = entry.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*/i, '').split(/[?#]/)[0] ?? ''
  return path.split('/').some(segment => /^(\.|%2e){1,2}$/i.test(segment))
}

/** Is `url` (already parsed) under one of `sources`: https, the exact origin, a clean path inside the prefix? */
function inEngineSource(url: URL, sources: readonly EngineSource[]): boolean {
  if (url.protocol !== 'https:' || url.username || url.password) return false
  // The parser has already resolved `..` and `%2e%2e`; anything still encoded (also double-encoded, `%25…`) or a doubled
  // slash is refused outright.
  if (/%(2e|2f|5c|25)/i.test(url.pathname) || url.pathname.includes('//')) return false
  return sources.some(source => url.origin === source.origin && url.pathname.startsWith(source.pathPrefix) && url.pathname.length > source.pathPrefix.length)
}

export interface AllowlistOptions {
  pageOrigin?: string
  apiBaseUrl?: string
  /** External engine storage (exact origin + path prefix). Default: none — `engineAllowlist()` passes `ENGINE_SOURCES`. */
  sources?: readonly EngineSource[]
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
 * Allows an external runtime engine script URL only if `new URL(url, pageOrigin)` resolves to `http:` or `https:`
 * whose origin matches `pageOrigin` or `VITE_API_BASE_URL`, or to `https:` under one of `options.sources` (exact
 * origin and path prefix, compared after the parser normalised the path).
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
  return Boolean(options.sources?.length) && inEngineSource(parsed, options.sources!)
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
  // Server enum (11-25 ModelInfo.format): `ALIVING2D_V2` · `CUBISM`.
  if (value === 'aliving2d' || value === 'aliving' || value === 'aliving2d_v2') return 'aliving2d'
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
