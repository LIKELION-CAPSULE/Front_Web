import type { Character } from '@/features/characters/types'
import { Link } from 'react-router'
import { useDemo } from '@/features/demo/demo-context'
import { relationship } from '@/features/demo/selectors'
import { duration } from '@/shared/lib/format'
import { Icon } from '@/shared/ui/Icon'
import { CharacterArtwork } from './CharacterArtwork'

export function CharacterCard({ character }: { character: Character }) {
  const { state } = useDemo()
  const relation = relationship(state, character.id)
  return (
    <article className="friend-card">
      <div className="friend-card-portrait">
        <CharacterArtwork characterId={character.id} variant="card" />
        <span className="friend-card-level">
          <Icon name="heart" size={13} /> Lv.{relation.level}{' '}
          {relation.level > 1 ? '친구' : '아는 사이'}
        </span>
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold">
            <Link to={`/characters/${character.id}`} className="after:absolute after:inset-0">
              {character.name}
            </Link>
          </h3>
          <Icon name="arrow" size={18} className="text-subtle" />
        </div>
        <p className="mt-1.5 text-xs text-muted">{character.description}</p>
        <p className="mt-4 border-t border-line pt-3 text-xs text-subtle">
          함께 {duration(relation.minutes * 60)}
        </p>
      </div>
    </article>
  )
}
