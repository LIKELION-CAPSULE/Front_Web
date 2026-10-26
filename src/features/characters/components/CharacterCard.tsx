import type { Character } from '@/features/characters/types'
import { Avatar } from '@/shared/ui/Avatar'

export function CharacterCard({ character }: { character: Character }) {
  return (
    <article className="rounded-card border border-line p-[18px]">
      <div className="flex items-center gap-3.5">
        <Avatar src={character.avatarUrl} size="lg" />
        <div className="min-w-0">
          <h3 className="text-[19px] leading-7 font-bold">{character.name}</h3>
          <p className="mt-1 text-sm leading-6 text-muted">{character.description}</p>
        </div>
      </div>
      <div className="mt-3.5 rounded-control bg-surface px-3.5 py-3">
        <p className="text-[15px] leading-6 font-bold">아직 안 만났어요</p>
        <p className="mt-0.5 text-sm leading-5 text-muted">처음 만나면 인사부터 해요</p>
      </div>
    </article>
  )
}
