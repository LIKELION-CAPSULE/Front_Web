export type Character = {
  artworkId?: string
  serverCharacter?: boolean
  /** Retired 11-22 room relation; no longer sent (37 `relation` replaces it). */
  relation?: { level?: number; levelName?: string; totalStudySeconds?: number; points?: number; stage?: number; stageName?: string }
  id: string
  name: string
  description: string
  avatarUrl?: string
}
