import type { Character } from '@/features/characters/types'
import { Link } from 'react-router'
import { useDemo } from '@/features/demo/demo-context'
import { getCharacterArtwork } from '@/features/characters/artwork'
import { relationship } from '@/features/demo/selectors'
import { duration } from '@/shared/lib/format'
import { Icon } from '@/shared/ui/Icon'
import { RoomArtwork } from '@/features/rooms/components/RoomArtwork'
import { characterRoom } from '@/features/rooms/artwork'

export function CharacterCard({ character }: { character: Character }) {
  const { state } = useDemo()
  const relation = relationship(state, character.id)
  const art = getCharacterArtwork(character.id)
  return (
    <article className="friend-card">
      <div className="friend-card-portrait">
        {character.id === 'doyun' || character.id === 'moru' ? (
          <RoomArtwork roomId={characterRoom[character.id]!} />
        ) : (
          <img
            src={art.study}
            alt={`${character.name}의 공부하는 모습`}
            loading="lazy"
            style={{ objectPosition: art.position }}
          />
        )}
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
          함께 {duration(relation.minutes * 60)}{' '}
          <span className="float-right text-brand-strong">다음 만남을 기다려요</span>
        </p>
      </div>
    </article>
  )
}
