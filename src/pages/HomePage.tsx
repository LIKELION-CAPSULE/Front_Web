import { useRef } from 'react'
import { RoomCard } from '@/features/rooms/components/RoomCard'
import { StudyWelcomeBanner } from '@/features/rooms/components/StudyWelcomeBanner'
import { getStudyRooms } from '@/features/rooms/services/room-service'

export default function HomePage() {
  const rooms = getStudyRooms()
  const roomHeading = useRef<HTMLHeadingElement>(null)

  function exploreRooms() {
    roomHeading.current?.scrollIntoView({ block: 'center' })
    roomHeading.current?.focus({ preventScroll: true })
  }

  return (
    <>
      <StudyWelcomeBanner onExplore={exploreRooms} />
      <section className="mt-5" aria-labelledby="rooms-heading">
        <div className="mb-6 flex items-baseline gap-2.5">
          <h2 ref={roomHeading} tabIndex={-1} id="rooms-heading" className="text-[22px] leading-9 font-bold">스터디룸</h2>
          <span className="text-sm text-subtle">{rooms.length}개</span>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => <RoomCard key={room.id} room={room} />)}
        </div>
      </section>
    </>
  )
}
