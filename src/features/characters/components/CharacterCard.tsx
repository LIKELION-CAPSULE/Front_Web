import type { Character } from '@/features/characters/types'
import { useDemo } from '@/features/demo/demo-context'
import { relationship } from '@/features/demo/selectors'
import { duration } from '@/shared/lib/format'
import { Icon } from '@/shared/ui/Icon'
import { CharacterArtwork } from './CharacterArtwork'
import { characterTags } from '../character-tags'
import { MvpGate } from '@/features/mvp/MvpGate'

export function CharacterCard({ character }: { character: Character }) {
  const { state } = useDemo()
  const relation = relationship(state, character.id)
  return (
    <article className="friend-card">
      <div className="friend-card-portrait">
        <CharacterArtwork characterId={character.id} variant="card" />
        <span className="friend-card-time">
          <Icon name="clock" size={12} /> 함께 {duration(relation.minutes * 60)}
        </span>
        <span className="friend-card-level">
          <Icon name="heart" size={13} /> Lv.{relation.level}{' '}
          {relation.level > 1 ? '친구' : '아는 사이'}
        </span>
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between">
          <h3 className="type-card-title">
            {character.name}
          </h3>
          <MvpGate label={`${character.name} 친구 · 선물 · 보이스`} compact inline>
            <span className="text-caption text-muted">친구 · 선물 · 보이스 <Icon name="arrow" size={14} /></span>
          </MvpGate>
        </div>
        <ul className="friend-card-tags" aria-label={`${character.name} 소개`}>
          {characterTags(character.description).map((tag) => <li key={tag}>{tag}</li>)}
        </ul>
      </div>
    </article>
  )
}
