export type Character = {
  artworkId?: string
  serverCharacter?: boolean
  relation?: import('../../shared/api/types').RelationBrief
  id: string
  name: string
  description: string
  avatarUrl?: string
}
