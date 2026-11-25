import { parseEngineSources, type AllowlistOptions } from './mate-source'

/**
 * The one place the app builds its engine allowlist (DemoProvider, the mate prewarm, the login stage, mate previews):
 * the page's origin, `VITE_API_BASE_URL`, and the engine storage (`ENGINE_SOURCES`, or `VITE_ENGINE_ALLOWLIST`).
 */
export function engineAllowlist(): AllowlistOptions {
  return {
    pageOrigin: typeof window !== 'undefined' && window.location ? window.location.origin : '',
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
    sources: parseEngineSources(import.meta.env.VITE_ENGINE_ALLOWLIST),
  }
}
