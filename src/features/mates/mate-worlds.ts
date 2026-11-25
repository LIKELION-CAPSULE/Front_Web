import { AFFINITY_STAGES } from './affinity-stages.ts'

/**
 * 세계관 (planning spec 2026-11-26; replaces the expression unlocks). Not a new story: the mate's character stays the
 * same, and each world is a place that changes the background, the outfit and the talk's context. Five per mate, opened
 * one by one with affinity Lv.1–5. The talk's prompt is the backend's alone and never reaches the screen.
 *
 * The API is not ready, so this module is the one boundary every screen goes through:
 * - The lock state of the five comes from the affinity stage alone (the server's stage in production).
 * - What the world is (place, background, outfit, sample line) comes from `MateWorldContent` by episode; a world
 *   without content shows the 「준비 중」 placeholder. Production has no content source yet; development and the local
 *   mock pass the planning examples (mate-world-samples.ts, never bundled in production).
 * - When the API arrives: name its unlock type in `WORLD_UNLOCK_TYPES` and map its fields in `worldContentFromServer`.
 * - 「고른 세계관으로 만나기」 (not decided): a choice would be a `MateWorld['id']` kept per mate; nothing stores it yet.
 *
 * Dependency-free (no React, no `import.meta`) so the unit tests import it directly.
 */

export type MateWorld = {
  id: string
  /** 1–5: 「EP.03」. */
  episode: number
  /** The place: 「도서관」 (「준비 중」 until there is content). */
  place: string
  /** Affinity stage that opens it (Lv.N). */
  unlockStage: number
  unlocked: boolean
  unlockedAt?: number
  /** The place's background picture. */
  backgroundUrl?: string
  /** A still of the mate in that place's outfit. */
  outfitPreviewUrl?: string
  /** One line the mate might say there. */
  sampleLine?: string
  /** No content yet: the place is the 「준비 중」 placeholder. */
  placeholder: boolean
}

/** What a source knows about one world; anything missing falls back to the placeholder. */
export type MateWorldContent = {
  episode: number
  id?: string
  place?: string
  unlockStage?: number
  backgroundUrl?: string
  outfitPreviewUrl?: string
  sampleLine?: string
  unlockedAt?: number
  /** The server's own lock state, when it sends one (otherwise the stage decides). */
  unlocked?: boolean
}

/** The raw 37 `unlocks[]` item as records-adapters.ts keeps it (type-agnostic). */
export type ServerUnlockItem = {
  id: string
  type: string
  title: string | null
  unlockStage: number | null
  assetUrl: string | null
  unlocked: boolean | null
  unlockedAt: number | null
}

export const WORLD_COUNT = AFFINITY_STAGES.length

/** The old unlock kinds the server may still send; never shown (the expression unlocks were removed). */
export const LEGACY_UNLOCK_TYPES: readonly string[] = ['EXPRESSION', 'VOICE_LINE']

/**
 * 37 `unlocks[].type` values that are worlds. Empty until the backend names it (then e.g. `['WORLD']`): until then
 * every server item is ignored and the worlds show the placeholder.
 */
export const WORLD_UNLOCK_TYPES: readonly string[] = []

export const WORLD_COPY = {
  title: '세계관',
  placeholderPlace: '준비 중',
  placeholderLine: '이 세계관은 준비하고 있어요.',
  previous: '이전 세계관',
  next: '다음 세계관',
  open: '세계관 자세히 보기',
  outfit: '이 장소의 의상',
  sampleLine: '이런 말을 해요',
  stageUp: '새 세계관이 열렸어요',
} as const

/** 「EP.03」 */
export const episodeLabel = (episode: number) => `EP.${String(episode).padStart(2, '0')}`

/** 「EP.03 · 도서관」 (the placeholder shows the episode alone). */
export function worldLabel(world: Pick<MateWorld, 'episode' | 'place' | 'placeholder'>, separator = ' · '): string {
  return world.placeholder ? episodeLabel(world.episode) : `${episodeLabel(world.episode)}${separator}${world.place}`
}

/** 「Lv.4에서 열려요」 */
export const worldLockedCaption = (unlockStage: number) => `Lv.${unlockStage}에서 열려요`

/**
 * The five worlds for an affinity stage. `met`: the user has connected with the mate at least once (a mate never met,
 * or no relation, has all five locked). A content item's own `unlocked` wins over the stage.
 */
export function mateWorldsForStage(
  stage: number | null | undefined,
  { met = true, content = [] }: { met?: boolean; content?: readonly MateWorldContent[] } = {},
): MateWorld[] {
  const reached = met && typeof stage === 'number' && Number.isFinite(stage) ? stage : 0
  return AFFINITY_STAGES.map(({ stage: episode }) => {
    const item = content.find((value) => value.episode === episode)
    const unlockStage = item?.unlockStage ?? episode
    const unlocked = item?.unlocked ?? unlockStage <= reached
    const place = item?.place?.trim()
    return {
      id: item?.id ?? `world-${episode}`,
      episode,
      place: place || WORLD_COPY.placeholderPlace,
      unlockStage,
      unlocked,
      ...(unlocked && item?.unlockedAt !== undefined ? { unlockedAt: item.unlockedAt } : {}),
      ...(item?.backgroundUrl ? { backgroundUrl: item.backgroundUrl } : {}),
      ...(item?.outfitPreviewUrl ? { outfitPreviewUrl: item.outfitPreviewUrl } : {}),
      ...(item?.sampleLine ? { sampleLine: item.sampleLine } : {}),
      placeholder: !place,
    }
  })
}

/** The world shown first: the current stage's, or the first one when none is open. */
export function initialWorldIndex(worlds: readonly MateWorld[]): number {
  let index = -1
  worlds.forEach((world, at) => {
    if (world.unlocked) index = at
  })
  return Math.max(0, index)
}

export function worldCount(worlds: readonly MateWorld[]) {
  return { unlocked: worlds.filter((world) => world.unlocked).length, total: worlds.length }
}

/**
 * 37 `unlocks[]` → world content. EXPRESSION / VOICE_LINE (and anything not in `types`) is ignored, never an error.
 * The mapping is a guess until the API is fixed: `title` → place, `unlockStage` → episode and Lv, `assetUrl` →
 * background. The outfit still and the sample line have no field yet.
 */
export function worldContentFromServer(
  unlocks: readonly ServerUnlockItem[] | null | undefined,
  types: readonly string[] = WORLD_UNLOCK_TYPES,
): MateWorldContent[] {
  return (unlocks ?? []).flatMap((item) => {
    if (LEGACY_UNLOCK_TYPES.includes(item.type) || !types.includes(item.type)) return []
    if (item.unlockStage === null || item.unlockStage < 1 || item.unlockStage > WORLD_COUNT) return []
    return [{
      id: item.id,
      episode: item.unlockStage,
      unlockStage: item.unlockStage,
      ...(item.title ? { place: item.title } : {}),
      ...(item.assetUrl ? { backgroundUrl: item.assetUrl } : {}),
      ...(item.unlocked !== null ? { unlocked: item.unlocked } : {}),
      ...(item.unlockedAt !== null ? { unlockedAt: item.unlockedAt } : {}),
    }]
  })
}

/**
 * 21 `stageUp.unlocked[]` / 22 · 23 `relation.unlocked[]` (no ids) in the 37 item shape, for `worldContentFromServer`.
 */
export function serverItemsFromUnlocked(
  items: readonly { type?: string; title?: string; unlockStage?: number; assetUrl?: string | null }[] | null | undefined,
): ServerUnlockItem[] {
  return (Array.isArray(items) ? items : []).flatMap((item, index) =>
    typeof item?.type === 'string' && item.type
      ? [{
          id: `unlocked-${index}`,
          type: item.type,
          title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : null,
          unlockStage: typeof item.unlockStage === 'number' && Number.isInteger(item.unlockStage) ? item.unlockStage : null,
          assetUrl: typeof item.assetUrl === 'string' && item.assetUrl ? item.assetUrl : null,
          unlocked: true,
          unlockedAt: null,
        }]
      : [],
  )
}

/** The world a stage-up opened (`stage` is the new stage), with whatever the server said about it. */
export function worldOpenedAt(
  stage: number,
  unlocked?: Parameters<typeof serverItemsFromUnlocked>[0],
  content: readonly MateWorldContent[] = [],
): MateWorld | null {
  if (!Number.isInteger(stage) || stage < 1 || stage > WORLD_COUNT) return null
  const server = worldContentFromServer(serverItemsFromUnlocked(unlocked))
  return mateWorldsForStage(stage, { content: server.length ? server : content }).find((world) => world.unlockStage === stage) ?? null
}

/** 「새 세계관이 열렸어요 · EP.03 도서관」 */
export function worldStageUpLine(world: Pick<MateWorld, 'episode' | 'place' | 'placeholder'>): string {
  return `${WORLD_COPY.stageUp} · ${worldLabel(world, ' ')}`
}
