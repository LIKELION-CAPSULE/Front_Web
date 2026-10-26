import { Link } from 'react-router'
import type { StudyRoom } from '@/features/rooms/types'
import { Avatar } from '@/shared/ui/Avatar'

export function RoomCard({ room }: { room: StudyRoom }) {
  const comingSoon = room.contentStatus === 'coming-soon'

  return (
    <article className="relative overflow-hidden rounded-card border border-line bg-canvas">
      <div className="relative h-[150px] bg-placeholder">
        {room.coverUrl && <img src={room.coverUrl} alt="" className="size-full object-cover" />}
        {!comingSoon && (
          <button
            type="button"
            disabled
            title="스터디룸 저장은 추후 제공 예정이에요"
            className="absolute top-3 right-3 z-10 rounded-full border border-dashed border-subtle bg-canvas px-3 py-1 text-[13px] leading-5 text-muted disabled:cursor-not-allowed"
          >
            저장
          </button>
        )}
      </div>
      <div className="px-[18px] pt-3.5 pb-[18px]">
        <h3 className="text-lg leading-7 font-bold">
          {comingSoon ? room.name : (
            <Link to={`/rooms/${room.id}`} className="after:absolute after:inset-0 hover:text-brand-strong">
              {room.name}
            </Link>
          )}
        </h3>
        <p className="mt-2 text-sm leading-[22px] text-muted">{room.description}</p>
        <div className="mt-3 flex min-h-7 items-center gap-2.5">
          <span className="flex shrink-0 gap-1.5">
            {room.characters.map((character) => <Avatar key={character.id} src={character.avatarUrl} />)}
          </span>
          <p className="text-sm leading-5 text-ink">
            {comingSoon ? `${room.characters.length}명의 친구 · 준비 중` : room.characters.map((character) => character.name).join(' · ')}
          </p>
        </div>
      </div>
    </article>
  )
}
