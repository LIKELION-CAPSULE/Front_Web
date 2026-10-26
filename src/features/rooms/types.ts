import type { Character } from '@/features/characters/types'

export type StudyRoom = {
  id: string
  name: string
  description: string
  introduction: string
  coverUrl?: string
  characters: readonly Character[]
  contentStatus: 'preview' | 'coming-soon'
}
