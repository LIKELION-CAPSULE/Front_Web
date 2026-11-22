/**
 * Dev/review-only abstract user silhouette avatars.
 * Used exclusively by `review/fixtures.ts` and `local-demo/{ports,transport}.ts`
 * so the user's "나" tile never displays a mate character portrait.
 * Tree-shaken out of production builds (`import.meta.env.DEV` gated in `main.tsx`).
 */
function silhouetteAvatarSvg(bgTop: string, bgBottom: string, fg: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${bgTop}"/><stop offset="100%" stop-color="${bgBottom}"/></linearGradient></defs><rect width="120" height="120" rx="60" fill="url(#g)"/><circle cx="60" cy="46" r="20" fill="${fg}" fill-opacity="0.9"/><path d="M26 106c5-20 18-30 34-30s29 10 34 30" fill="${fg}" fill-opacity="0.9"/></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const AVATAR_PALETTES = [
  ['#4e3b8c', '#261f47', '#e6defc'],
  ['#335d7a', '#1b2f45', '#d7eefc'],
  ['#6a3d73', '#2e1d3b', '#f2d9f7'],
  ['#2f6b5f', '#183631', '#d2f4ec'],
  ['#7c5636', '#382619', '#fae3cd'],
  ['#4a4f86', '#232645', '#dfe2fb'],
  ['#7a3f55', '#381c28', '#fbd8e4'],
  ['#3f5e50', '#1d2f27', '#d8efe4'],
] as const

export const MOCK_AVATAR_URLS: readonly string[] = AVATAR_PALETTES.map(([top, bottom, fg]) =>
  silhouetteAvatarSvg(top, bottom, fg),
)

export function createMockAvatars(startId: number, count = MOCK_AVATAR_URLS.length) {
  return MOCK_AVATAR_URLS.slice(0, count).map((thumbnailUrl, index) => ({
    id: startId + index,
    name: `아바타 ${String(index + 1).padStart(2, '0')}`,
    thumbnailUrl,
  }))
}
