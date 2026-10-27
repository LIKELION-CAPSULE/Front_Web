import { useRef, useState } from 'react'
import { RoomCard } from '@/features/rooms/components/RoomCard'
import { StudyWelcomeBanner } from '@/features/rooms/components/StudyWelcomeBanner'
import { getStudyRooms } from '@/features/rooms/services/room-service'
import { useDemo } from '@/features/demo/demo-context'
import { Icon } from '@/shared/ui/Icon'
import { cn } from '@/shared/lib/cn'

export default function HomePage() {
  const rooms = getStudyRooms()
  const { state } = useDemo()
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const roomHeading = useRef<HTMLHeadingElement>(null)
  function exploreRooms() {
    setFilter('all')
    setQuery('')
    requestAnimationFrame(() => {
      roomHeading.current?.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      })
      roomHeading.current?.focus({ preventScroll: true })
    })
  }
  const search = query.trim().toLocaleLowerCase('ko-KR')
  const visible = rooms.filter(
    (room) =>
      (filter !== 'saved' || state.savedRooms.includes(room.id)) &&
      (!search ||
        `${room.name} ${room.description} ${room.characters.map((c) => c.name).join(' ')}`
          .toLocaleLowerCase('ko-KR')
          .includes(search)),
  )
  function resetFilters() {
    setFilter('all')
    setQuery('')
  }
  return (
    <>
      <StudyWelcomeBanner onExplore={exploreRooms} />
      <section className="rooms-section" aria-labelledby="rooms-heading">
        <div className="section-heading">
          <div>
            <h2
              ref={roomHeading}
              tabIndex={-1}
              id="rooms-heading"
              className="scroll-mt-6 text-[26px] font-bold tracking-tight"
            >
              오늘은 누구와 공부할까요?{' '}
              <span className="ml-1 text-base font-normal text-subtle">{rooms.length}</span>
            </h2>
          </div>
          <div className="room-toolbar">
            <div role="group" aria-label="스터디룸 필터" className="room-filters">
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
            <label className="room-search">
              <Icon name="search" size={18} />
              <input
                aria-label="스터디룸 검색"
                type="search"
                placeholder="룸·친구 이름으로 검색"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query && (
                <button aria-label="검색어 지우기" onClick={() => setQuery('')}>
                  <Icon name="close" size={15} />
                </button>
              )}
            </label>
          </div>
        </div>
        {search && filter !== 'saved' && (
          <p role="status" className="search-result-count">
            {visible.length}개의 공부 공간을 찾았어요
          </p>
        )}
        <div className="rooms-grid">
          {visible.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
        {!visible.length && (
          <div className="room-empty">
            <Icon
              name={filter === 'saved' && !search ? 'bookmark' : 'search'}
              size={30}
              className="mx-auto mb-4 text-brand"
            />
            <h3 className="text-lg font-semibold">
              {filter === 'saved' && !search
                ? '아직 저장한 룸이 없어요'
                : '아직 딱 맞는 자리를 찾지 못했어요'}
            </h3>
            <p className="mt-2 text-sm text-muted">
              {filter === 'saved' && !search
                ? '마음에 드는 룸의 저장 버튼을 눌러 모아 보세요.'
                : '검색어를 바꾸면 새로운 친구를 만날 수 있어요.'}
            </p>
            {filter !== 'saved' && (
              <button
                onClick={resetFilters}
                className="mt-5 rounded-full border border-brand-line bg-brand-soft px-5 py-2 text-sm text-brand-strong"
              >
                모든 룸 다시 보기
              </button>
            )}
          </div>
        )}
      </section>
    </>
  )
}
