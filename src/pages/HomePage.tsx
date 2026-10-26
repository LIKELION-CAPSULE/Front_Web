import { useRef, useState } from 'react'
import { RoomCard } from '@/features/rooms/components/RoomCard'
import { StudyWelcomeBanner } from '@/features/rooms/components/StudyWelcomeBanner'
import { getStudyRooms } from '@/features/rooms/services/room-service'
import { getRoomArtwork } from '@/features/rooms/artwork'
import { useDemo } from '@/features/demo/demo-context'
import { Icon } from '@/shared/ui/Icon'
import { cn } from '@/shared/lib/cn'

const moods = [
  { id: 'all', label: '모든 분위기' },
  { id: 'classroom', label: '설레는 교실' },
  { id: 'night', label: '몰입하는 밤' },
  { id: 'cat', label: '포근한 힐링' },
]
export default function HomePage() {
  const rooms = getStudyRooms()
  const { state } = useDemo()
  const [filter, setFilter] = useState('all')
  const [mood, setMood] = useState('all')
  const [query, setQuery] = useState('')
  const roomHeading = useRef<HTMLHeadingElement>(null)
  function exploreRooms() {
    setFilter('all')
    setMood('all')
    setQuery('')
    roomHeading.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    roomHeading.current?.focus({ preventScroll: true })
  }
  const search = query.trim().toLocaleLowerCase('ko-KR')
  const visible = rooms.filter(
    (room) =>
      (filter !== 'saved' || state.savedRooms.includes(room.id)) &&
      (mood === 'all' || getRoomArtwork(room.id).tone === mood) &&
      (!search ||
        `${room.name} ${room.description} ${room.characters.map((c) => c.name).join(' ')} ${getRoomArtwork(room.id).mood}`
          .toLocaleLowerCase('ko-KR')
          .includes(search)),
  )
  function resetFilters() {
    setFilter('all')
    setMood('all')
    setQuery('')
  }
  return (
    <>
      <StudyWelcomeBanner onExplore={exploreRooms} />
      <section className="rooms-section" aria-labelledby="rooms-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow mb-2">FIND YOUR PLACE</p>
            <h2
              ref={roomHeading}
              tabIndex={-1}
              id="rooms-heading"
              className="text-[26px] font-bold tracking-tight"
            >
              오늘은 누구와 공부할까요?{' '}
              <span className="ml-1 text-base font-normal text-subtle">{rooms.length}</span>
            </h2>
          </div>
          <div aria-label="스터디룸 필터" className="room-filters">
            {[
              { id: 'all', label: '모든 스터디룸', icon: 'book' as const },
              { id: 'saved', label: '저장한 룸', icon: 'bookmark' as const },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setFilter(item.id)}
                aria-pressed={filter === item.id}
                className={cn(filter === item.id && 'is-active')}
              >
                <Icon name={item.icon} size={15} />
                {item.label}
                {item.id === 'saved' && (
                  <span className="filter-count" aria-hidden="true">
                    {state.savedRooms.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="room-discovery">
          <label className="room-search">
            <Icon name="search" size={18} />
            <input
              aria-label="스터디룸 검색"
              type="search"
              placeholder="룸 이름, 친구 이름으로 찾아보세요"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button aria-label="검색어 지우기" onClick={() => setQuery('')}>
                <Icon name="close" size={15} />
              </button>
            )}
          </label>
          <div role="group" aria-label="분위기 고르기" className="mood-filters">
            {moods.map((item) => (
              <button
                key={item.id}
                aria-pressed={mood === item.id}
                onClick={() => setMood(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <p role="status" className="search-result-count">
          {search || mood !== 'all' || filter === 'saved'
            ? `${visible.length}개의 공부 공간을 찾았어요`
            : '오늘의 기분에 맞는 자리를 골라 보세요'}
        </p>
        <div className="rooms-grid">
          {visible.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              index={rooms.findIndex((item) => item.id === room.id)}
            />
          ))}
        </div>
        {!visible.length && (
          <div className="room-empty">
            <Icon
              name={filter === 'saved' && !query && mood === 'all' ? 'bookmark' : 'search'}
              size={30}
              className="mx-auto mb-4 text-brand"
            />
            <h3 className="text-lg font-semibold">
              {filter === 'saved' && !query && mood === 'all'
                ? '아직 저장한 룸이 없어요'
                : '아직 딱 맞는 자리를 찾지 못했어요'}
            </h3>
            <p className="mt-2 text-sm text-muted">
              {filter === 'saved' && !query && mood === 'all'
                ? '마음에 드는 룸의 저장 버튼을 눌러 모아 보세요.'
                : '검색어나 분위기를 바꾸면 새로운 친구를 만날 수 있어요.'}
            </p>
            <button
              onClick={resetFilters}
              className="mt-5 rounded-full border border-brand-line bg-brand-soft px-5 py-2 text-sm text-brand-strong"
            >
              모든 룸 다시 보기
            </button>
          </div>
        )}
      </section>
      <section className="routine-note">
        <span className="routine-icon">
          <Icon name="moon" size={23} />
        </span>
        <div>
          <h2>대단한 하루보다, 꾸준한 우리.</h2>
          <p>공부한 시간만큼 기록이 쌓이고, 함께한 시간만큼 친구와 가까워져요.</p>
        </div>
        <span className="hidden text-xs tracking-widest text-subtle sm:block">
          A LITTLE EVERY DAY.
        </span>
      </section>
    </>
  )
}
