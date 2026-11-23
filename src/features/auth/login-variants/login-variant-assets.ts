import { chaerinArtwork } from '@/features/mates/artwork'

/**
 * Optional assets for the login concepts. Drop files into `src/assets/login-variants/`:
 * - illustration.(webp|png|jpg|avif)     full-bleed illustration (16:9 or wider, ≥ 2560px wide)
 * Missing files fall back to the existing room background + Live2D render, so every concept renders today.
 */
const illustrationFiles = import.meta.glob('/src/assets/login-variants/illustration.{webp,png,jpg,jpeg,avif}', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>
function pick(files: Record<string, string>, order: readonly string[]): string | null {
  for (const ext of order) {
    const hit = Object.entries(files).find(([path]) => path.endsWith(`.${ext}`))
    if (hit) return hit[1]
  }
  return null
}

export const loginVariantAssets = {
  illustration: pick(illustrationFiles, ['avif', 'webp', 'png', 'jpg', 'jpeg']),
  /** Used when a concept's own asset has not been delivered yet. */
  fallbackBackground: chaerinArtwork.callBackground.landscape,
  fallbackMate: chaerinArtwork.hero,
} as const

export const LOGIN_VARIANT_ASSET_DIR = 'src/assets/login-variants/'
