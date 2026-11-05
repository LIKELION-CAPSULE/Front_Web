import type { Character } from '@/features/characters/types'
import { useDemo } from '@/features/demo/demo-context'
import { studyLevel } from '@/features/demo/selectors'
import { duration } from '@/shared/lib/format'
import { Icon } from '@/shared/ui/Icon'
import { CharacterArtwork } from './CharacterArtwork'
import { characterTags } from '../character-tags'
import { MvpGate } from '@/features/mvp/MvpGate'
import { affectionScore } from '../affection'
import { useBackend } from '@/features/backend/backend-context'

export function CharacterCard({ character }: { character: Character }) {
  const { state } = useDemo()
  const { affinities } = useBackend()
  const calculated = studyLevel(state, character.id)
  const level = character.serverCharacter ? { level: character.relation?.level, minutes: (character.relation?.totalStudySeconds ?? 0) / 60 } : calculated
  const affection = character.serverCharacter ? affinities[character.id]?.points ?? character.relation?.points ?? null : affectionScore(state, character.id)
  return (
    <article className="friend-card">
      <div className="friend-card-portrait">
        {character.serverCharacter && character.avatarUrl
          ? <img src={character.avatarUrl} alt="" className="size-full object-cover" />
          : <CharacterArtwork characterId={character.artworkId ?? character.id} variant="card" />}
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
        <div className="friend-card-stats">
          <span className="friend-card-time"><Icon name="clock" size={16} />함께 {duration(level.minutes * 60)}</span>
          <div className="friend-card-progress">
            <span className="friend-card-level"><Icon name="book" size={16} />Lv.{level.level ?? '—'}</span>
            <span className="friend-card-affection"><Icon name="heart" size={16} fill="currentColor" className="text-affection" /><span className="sr-only">호감도 </span>{affection ?? '—'}</span>
          </div>
        </div>
      </div>
    </article>
  )
}
