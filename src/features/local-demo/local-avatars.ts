import type { AvatarItem } from '../../shared/api/types.ts'
import { MOCK_AVATAR_URLS } from '../review/mock-avatars.ts'

/**
 * The six Live2D sample avatars (Cubism, "Live2D 오리지널 캐릭터" free material license) served by the dev server from
 * `local-assets/avatars/` (server/local-assets.ts). Development only: this module is reached only from the local demo
 * (`import.meta.env.DEV`), so neither the paths nor the model names end up in a production bundle. In production the
 * backend sends each avatar's `model` and `thumbnailUrl` (`GET /api/avatars`).
 *
 * Framing (`scale`, `offsetX`, `offsetY`) is read by the Live2D stage as: fit the whole model inside the preview
 * (contain), multiply by `scale`, then move its center by `offsetX`/`offsetY` percent of the preview's width/height.
 * The preview keeps a 4:5 frame everywhere (onboarding, account settings), so one set of values fits both. Values put
 * every face at the same height with the upper body down to the waist. docs/MY_PAGE.md keeps the same table for the
 * backend.
 */
export const LOCAL_AVATAR_BASE = '/__local-assets/avatars'
export const LOCAL_AVATAR_FIRST_ID = 990401

type LocalAvatar = { key: string; name: string; model: string; scale: number; offsetX: number; offsetY: number }

export const LOCAL_AVATARS: readonly LocalAvatar[] = [
  { key: 'hiyori', name: '히요리', model: 'hiyori_ko/hiyori_pro/runtime/hiyori_pro_t11.model3.json', scale: 2.35, offsetX: 0, offsetY: 60 },
  { key: 'haru', name: '하루', model: 'haru_greeter_ja/runtime/haru_greeter_t05.model3.json', scale: 2.64, offsetX: 0, offsetY: 81 },
  { key: 'natori', name: '나토리', model: 'natori_ko/runtime/natori_pro_t06.model3.json', scale: 3.3, offsetX: 0, offsetY: 107 },
  { key: 'chitose', name: '치토세', model: 'chitose_ja/runtime/chitose.model3.json', scale: 2.2, offsetX: 0, offsetY: 54 },
  { key: 'epsilon', name: '엡실론', model: 'epsilon_ja/epsilon_pro/runtime/Epsilon.model3.json', scale: 1.65, offsetX: 0, offsetY: 29 },
  { key: 'wanko', name: '완코', model: 'wanko_ja/runtime/wanko_touch.model3.json', scale: 1.56, offsetX: 0, offsetY: -8 },
]

const thumbnailPath = (key: string) => `${LOCAL_AVATAR_BASE}/thumbnails/${key}.png`
/** Silhouette used until `scripts/capture-avatar-thumbnails.mjs` has written the avatar's PNG. */
const silhouette = (index: number) => MOCK_AVATAR_URLS[index % MOCK_AVATAR_URLS.length]!

/** Keys whose generated thumbnail exists (filled by `resolveLocalAvatarThumbnails`). */
const found = new Set<string>()
let checked: Promise<void> | null = null

/** Checks once which thumbnails exist (HEAD through the page's real fetch); missing ones stay silhouettes. */
export function resolveLocalAvatarThumbnails(fetcher: typeof fetch, origin: string): Promise<void> {
  checked ??= Promise.all(LOCAL_AVATARS.map(async avatar => {
    try {
      const response = await fetcher(new URL(thumbnailPath(avatar.key), origin).href, { method: 'HEAD' })
      if (response.ok) found.add(avatar.key)
    } catch { /* Keep the silhouette. */ }
  })).then(() => undefined)
  return checked
}

export function localAvatarThumbnail(index: number): string {
  const avatar = LOCAL_AVATARS[index]
  return avatar && found.has(avatar.key) ? thumbnailPath(avatar.key) : silhouette(index)
}

/** `GET /avatars` in the backend's shape. */
export function localAvatarItems(): AvatarItem[] {
  return LOCAL_AVATARS.map((avatar, index) => ({
    id: LOCAL_AVATAR_FIRST_ID + index,
    name: avatar.name,
    thumbnailUrl: localAvatarThumbnail(index),
    model: { modelJsonUrl: `${LOCAL_AVATAR_BASE}/${avatar.model}`, scale: avatar.scale, offsetX: avatar.offsetX, offsetY: avatar.offsetY },
  }))
}

/** The profile image for an avatar id (the first avatar when the id is unknown). */
export function localAvatarImage(avatarId: number | undefined): string {
  const index = avatarId === undefined ? 0 : avatarId - LOCAL_AVATAR_FIRST_ID
  return localAvatarThumbnail(index >= 0 && index < LOCAL_AVATARS.length ? index : 0)
}
