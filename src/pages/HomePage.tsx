import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useBackend } from '@/features/backend/backend-context'
import { availableMates } from '@/features/mates/catalog'
import { MateCard } from '@/features/mates/components/MateCard'
import { MateWelcome } from '@/features/mates/components/MateWelcome'
import { MateTutorial } from '@/features/mates/components/MateTutorial'
import { accountRequest } from '@/features/profile/account-location'
import { Button } from '@/shared/ui/Button'
import { NotificationStack } from '@/shared/ui/NotificationStack'
import { enqueueNotification, type NotificationItem } from '@/shared/ui/notification-queue'
import '@/features/mates/mates.css'

export default function HomePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { refreshHome, reload, status, error, home, homeContentVersion } = useBackend()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const heading = useRef<HTMLHeadingElement>(null)
  const tutorialTrigger = useRef<HTMLButtonElement>(null)
  const tutorialFocus = useRef<'trigger' | 'mates'>('trigger')
  const tutorialOpen = new URLSearchParams(location.search).get('tutorial') === '1' && !accountRequest(location.search)
  const tutorialWasOpen = useRef(false)
  const mates = availableMates(home)
  const explore = useCallback(() => {
    heading.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
    heading.current?.focus({ preventScroll: true })
  }, [])
  function showTutorial() {
    const params = new URLSearchParams(location.search)
    params.set('tutorial', '1')
    tutorialFocus.current = 'trigger'
    navigate({ pathname: '/', search: `?${params}`, hash: location.hash }, { preventScrollReset: true })
  }
  function closeTutorial(complete = false) {
    const params = new URLSearchParams(location.search)
    params.delete('tutorial')
    tutorialFocus.current = complete ? 'mates' : 'trigger'
    navigate({ pathname: '/', search: params.size ? `?${params}` : '', hash: location.hash }, { replace: true, preventScrollReset: true })
  }
  useEffect(() => {
    const wasOpen = tutorialWasOpen.current
    tutorialWasOpen.current = tutorialOpen
    if (!wasOpen || tutorialOpen) return
    const frame = requestAnimationFrame(() => { if (tutorialFocus.current === 'mates') explore(); else tutorialTrigger.current?.focus({ preventScroll: true }) })
    return () => cancelAnimationFrame(frame)
  }, [tutorialOpen, explore])
  const showError = useCallback((text: string) => {
    const notice: NotificationItem = { id: 'home-connection', tone: 'error', title: '앱 연결 실패', text }
    setNotifications(current => enqueueNotification(current, notice))
  }, [])
  useEffect(() => {
    const notice = location.state?.notice
    if (!notice) return
    const content = notice === 'study-not-found'
      ? { title: '진행 중인 연결이 없어요', text: '홈으로 이동했어요.' }
      : notice === 'report-not-found'
        ? { title: '연결 기록을 찾을 수 없어요', text: '이 계정에서 조회할 수 있는 완료 기록이 없어 홈으로 이동했어요.' }
        : { title: '페이지를 찾을 수 없어요', text: '홈으로 이동했어요. 주소를 다시 확인해 주세요.' }
    const frame = requestAnimationFrame(() => {
      setNotifications(current => enqueueNotification(current, { id: 'route-notice', tone: 'warning', ...content }))
      navigate({ pathname: location.pathname, search: location.search, hash: location.hash }, { replace: true, state: null, preventScrollReset: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [location, navigate])
  useEffect(() => {
    if (status !== 'error') return
    const frame = requestAnimationFrame(() => showError(error || '앱에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.'))
    return () => cancelAnimationFrame(frame)
  }, [status, error, showError])
  useEffect(() => {
    if (status !== 'ready') return
    let alive = true
    void refreshHome().catch(reason => { if (alive) showError(reason instanceof Error ? reason.message : '홈을 새로 불러오지 못했어요.') })
    return () => { alive = false }
  }, [status, homeContentVersion, refreshHome, showError])
  return <>
    <MateWelcome mates={mates} onExplore={explore} />
    <section className="mate-section" aria-labelledby="mates-heading">
      <div className="section-heading mate-section-heading">
        <div>
          <h2 ref={heading} tabIndex={-1} id="mates-heading" className="type-section-title mate-section-title">
            오늘은 누구와 함께할까요?
          </h2>
        </div>
        <Button ref={tutorialTrigger} variant="ghost" size="sm" className="mate-tutorial-trigger" aria-haspopup="dialog" onClick={showTutorial}>
          사용법 보기
        </Button>
      </div>
      {mates.length === 0 ? (
        <section className="app-panel mate-empty-window" aria-label="메이트 목록 비어 있음">
          <div className="mate-empty-window-body">
            <p className="mate-empty-title">메이트를 불러오지 못했어요</p>
            <Button variant="secondary" size="sm" onClick={() => { void reload() }}>다시 시도</Button>
          </div>
        </section>
      ) : (
        <div className="mate-grid">
          {mates.map(mate => <MateCard key={mate.id} mate={mate} />)}
          {mates.length === 1 && (
            <div className="mate-card mate-card--upcoming" aria-label="남학생 메이트 준비 중">
              <div className="mate-card-image mate-card-image--upcoming">
                <span className="mate-card-upcoming-pill">곧 만나요</span>
              </div>
              <div className="mate-card-copy">
                <div className="mate-card-heading"><h3 className="type-card-title">남학생</h3><span className="mate-card-status-label">준비 중</span></div>
                <span className="mate-age-badge">전연령</span>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
    <NotificationStack items={notifications} onDismiss={id => setNotifications(current => current.filter(item => item.id !== id))} />
    {tutorialOpen && <MateTutorial mates={mates} onClose={() => closeTutorial()} onComplete={() => closeTutorial(true)} />}
  </>
}
