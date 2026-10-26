import { Link, useParams } from 'react-router'
import { CharacterCard } from '@/features/characters/components/CharacterCard'
import { getStudyRoom } from '@/features/rooms/services/room-service'
import { Button } from '@/shared/ui/Button'
import NotFoundPage from '@/pages/NotFoundPage'

export default function RoomDetailPage() {
  const { roomId } = useParams()
  const room = roomId ? getStudyRoom(roomId) : undefined

  if (!room || room.contentStatus === 'coming-soon') {
    return <div className="page-container py-7"><NotFoundPage /></div>
  }

  return (
    <>
      <header className="border-b border-divider">
        <nav aria-label="현재 위치" className="page-container flex min-h-16 items-center gap-5 text-base leading-6">
          <Link to="/" className="hover:text-brand-strong">← 홈</Link>
          <span aria-hidden="true" className="text-subtle">/</span>
          <span aria-current="page" className="font-bold">{room.name}</span>
        </nav>
      </header>
      <div className="page-container flex min-h-[735px] flex-col pt-6 pb-7">
        <section className="relative flex min-h-[200px] items-end overflow-hidden rounded-panel bg-placeholder p-6" aria-labelledby="room-title">
          {room.coverUrl && <img src={room.coverUrl} alt="" className="absolute inset-0 size-full object-cover" />}
          <div className="relative w-full max-w-[564px] rounded-[14px] bg-canvas/95 px-[22px] py-[18px]">
            <h1 id="room-title" className="text-[30px] leading-11 font-black">{room.name}</h1>
            <p className="mt-2 text-[15px] leading-6 text-muted">{room.introduction}</p>
          </div>
        </section>
        <section className="mt-4" aria-labelledby="room-characters">
          <h2 id="room-characters" className="text-xl leading-8 font-bold">
            함께 공부할 친구들 <span className="inline-block text-[15px] font-normal text-subtle">· 공부할 때 각자 자기 칸에 앉아요</span>
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-[18px] md:grid-cols-2 lg:grid-cols-3">
            {room.characters.map((character) => <CharacterCard key={character.id} character={character} />)}
          </div>
        </section>
        <div className="mt-auto pt-10">
          <div className="flex flex-col gap-4 rounded-card border border-line px-[22px] py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div>
              <p className="text-[15px] leading-6 text-muted">이 룸에 들어가면 {room.characters.map((character) => character.name).join(' · ')}와 각자 칸에서 함께 공부해요</p>
              <p id="session-availability" className="mt-1 text-xs leading-5 text-subtle">공부 세션은 준비 중이에요.</p>
            </div>
            <Button disabled aria-describedby="session-availability" className="shrink-0 sm:mr-10">이 룸에서 공부 시작</Button>
          </div>
        </div>
      </div>
    </>
  )
}
