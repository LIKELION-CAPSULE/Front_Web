import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useBackend } from '@/features/backend/backend-context'
import { NotificationStack } from '@/shared/ui/NotificationStack'
import { enqueueNotification, type NotificationItem } from '@/shared/ui/notification-queue'
import { RoomCard } from '@/features/rooms/components/RoomCard'
import { StudyWelcomeBanner } from '@/features/rooms/components/StudyWelcomeBanner'
import { getStudyRooms } from '@/features/rooms/services/room-service'
import { useDemo } from '@/features/demo/demo-context'
import { Icon } from '@/shared/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { SearchField } from '@/shared/ui/SearchField'

export default function HomePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const rooms = getStudyRooms()
  const { state } = useDemo()
  const { refreshHome, reload, status, error, home } = useBackend()
  const [refreshError, setRefreshError] = useState('')
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  useEffect(() => {
    const content = location.state?.notice === 'page-not-found'
      ? { title: '페이지를 찾을 수 없어요', text: '홈으로 이동했어요. 주소를 다시 확인해 주세요.' }
      : location.state?.notice === 'study-not-found'
        ? { title: '진행 중인 공부가 없어요', text: '홈으로 이동했어요. 스터디룸을 골라 새로운 공부를 시작해 주세요.' }
        : null
    if (!content) return
    const frame = requestAnimationFrame(() => {
      const notice: NotificationItem = { id: crypto.randomUUID(), tone: 'warning', ...content }
      setNotifications(current => enqueueNotification(current, notice))
      navigate({ pathname: location.pathname, search: location.search, hash: location.hash }, { replace: true, state: null, preventScrollReset: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [location, navigate])
  const showConnectionError = useCallback((text: string) => {
    const item: NotificationItem = { id: crypto.randomUUID(), tone: 'error', title: '앱 연결 실패', text, action: { label: '다시 연결하기', onClick: () => { void reload() } } }
    setNotifications(current => enqueueNotification(current, item))
  }, [reload, setNotifications])
  useEffect(() => {
    if (status !== 'error') return
    const frame = requestAnimationFrame(() => showConnectionError(error || '앱에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.'))
    return () => cancelAnimationFrame(frame)
  }, [status, error, showConnectionError])
  useEffect(() => {
    // A failed bootstrap stays on home until the user explicitly retries.
    if (status !== 'ready') return
    let alive = true
    void refreshHome().catch(reason => {
      if (!alive) return
      const message = reason instanceof Error ? reason.message : '홈을 새로 불러오지 못했어요.'
      setRefreshError(message)
      showConnectionError(message)
    })
    return () => { alive = false }
  }, [refreshHome, status, showConnectionError])
  const connectionFailed = status === 'error' || !!refreshError
  const roomsUnavailable = connectionFailed && !home
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
  const emptyState = !rooms.length
    ? { icon: 'book' as const, title: '아직 등록된 스터디룸이 없어요', description: '스터디룸이 등록되면 이곳에 표시돼요.' }
    : filter === 'saved' && !search
      ? { icon: 'bookmark' as const, title: '아직 저장한 스터디룸이 없어요', description: '마음에 드는 스터디룸을 저장해 보세요.' }
      : { icon: 'search' as const, title: '검색 결과가 없어요', description: '스터디룸이나 친구 이름으로 다시 검색해 보세요.' }
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
              className="scroll-mt-6 type-section-title"
            >
              오늘은 어디서 공부할까요?{' '}
              {!roomsUnavailable && <span className="ml-1 text-label font-normal text-subtle">{rooms.length}</span>}
            </h2>
          </div>
          <div className="room-toolbar">
            <div role="group" aria-label="스터디룸 필터" className="room-filters">
              {[
                { id: 'all', label: '모든 스터디룸', icon: 'book' as const },
                { id: 'saved', label: '저장한 스터디룸', icon: 'bookmark' as const },
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
            <SearchField label="스터디룸 검색" placeholder="스터디룸·친구 이름 검색" value={query} onChange={setQuery} className="room-search" />
          </div>
        </div>
        {search && !roomsUnavailable && rooms.length > 0 && filter !== 'saved' && (
          <p role="status" className="search-result-count">
            스터디룸 {visible.length}개를 찾았어요.
          </p>
        )}
        <div className="rooms-grid">
          {visible.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
        {!roomsUnavailable && !visible.length && (
          <div className="room-empty">
            <Icon
              name={emptyState.icon}
              size={30}
              className="mx-auto mb-4 text-text-accent"
            />
            <h3 className="type-card-title">
              {emptyState.title}
            </h3>
            <p className="mt-2 text-body-compact text-muted">
              {emptyState.description}
            </p>
          </div>
        )}
      </section>
      <NotificationStack items={notifications} onDismiss={id => setNotifications(current => current.filter(item => item.id !== id))} />
    </>
  )
}
