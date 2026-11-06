import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState, type ComponentType } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { PageNavigation } from '@/app/PageNavigation'
import { getStudyRoom } from '@/features/rooms/services/room-service'
import { CompletionPortrait } from '@/features/reports/components/CompletionPortrait'
import { CapsuleCardSurface } from '@/features/reports/components/CapsuleCardSurface'
import { RoomTitle } from '@/features/rooms/components/RoomTitle'
import { CapsuleCardBrand } from '@/features/reports/components/CapsuleCardBrand'
import { Tabs } from '@/shared/ui/Tabs'
import { downloadCard, exportCard } from '@/features/reports/export-card'
import { dateLabel, dayKey, duration, measuredDuration } from '@/shared/lib/format'
import { Button } from '@/shared/ui/Button'
import { cn } from '@/shared/lib/cn'
import { OverlayPage } from '@/shared/ui/OverlayPage'
import { FeedbackMessage, type FeedbackTone } from '@/shared/ui/FeedbackMessage'
import { DateTimeWheelField } from '@/shared/ui/DateTimeWheelField'
import { clampCalendarDate } from '@/shared/lib/date-limits'
import { useBackend } from '@/features/backend/backend-context'
import { useServerReport } from '@/features/backend/use-server-report'
import { PageSkeleton } from '@/shared/ui/PageSkeleton'
import { withParticle } from '@/shared/lib/korean'
import { capsuleCardCopy, capsuleFocusCopy } from '@/features/reports/card-copy'
import { capsuleCardColors } from '@/features/reports/capsule-card-layout'
import { getCapsuleRoomArtwork } from '@/features/reports/capsule-room-artwork'
import { loadStoryFont } from '@/shared/design/story-font'
import { fitCardQuote, previewMeasure } from '@/features/reports/card-quote'
import { isMvpCharacter, isMvpRoom } from '@/features/mvp/policy'
import MvpUnavailablePage from './MvpUnavailablePage'
import { CapsuleIntroFallback, type CapsuleIntroProps } from '@/features/reports/components/CapsuleIntroFallback'
import { capsuleCardQuad, revealCapsuleCard } from '@/features/reports/capsule-card-reveal'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'
import '@/features/reports/capsule-card-reveal.css'

// three.js stays out of the main bundle: it loads only when the intro plays.
// If the chunk fails to load, the card still flips in without the capsule.
const CapsuleIntro = lazy<ComponentType<CapsuleIntroProps>>(() => import('@/features/reports/components/CapsuleIntro').catch(() => ({ default: CapsuleIntroFallback })))

const colors = capsuleCardColors
const names = ['보라', '검정', '연보라', '라벤더']

/** Intro phases: the capsule shakes while loading, then bursts open and the card turns in. */
type IntroPhase = 'loading' | 'opening'

export default function CapsuleCardPage() {
  const { recordId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  // Only the report's button asks for the intro; a shared link or a reload shows the card right away.
  const [intro, setIntro] = useState<IntroPhase | null>(() => (location.state as { capsuleIntro?: unknown } | null)?.capsuleIntro === true ? 'loading' : null)
  const settled = useRef({ capsule: false, card: false })
  const [storyFont, setStoryFont] = useState('Pretendard')
  const [, setFontsReady] = useState(false)
  const { record, error, retry } = useServerReport(recordId)
  const room = record && getStudyRoom(record.roomId)
  const available = !!room && (!!room.serverRoom || isMvpRoom(room.id))
  // Without a card to open into (error, unknown or unavailable room), the usual screens show instead.
  const introPhase = intro && !reduced && !error && !(record && !available) ? intro : null
  const skipped = !!intro && reduced
  useEffect(() => {
    // A skipped intro forgets the request as well, so a reload after turning reduced motion off does not play it.
    if (skipped) navigate(`${window.location.pathname}${window.location.search}`, { replace: true, state: null })
  }, [skipped, navigate])
  useEffect(() => {
    let alive = true
    void loadStoryFont().then(font => { if (alive) setStoryFont(font) })
    // The quote is measured on a canvas, so measure again once every face has loaded.
    void document.fonts.ready.then(() => { if (alive) setFontsReady(true) })
    return () => { alive = false }
  }, [])
  function settle(part: 'capsule' | 'card') {
    settled.current[part] = true
    if (!settled.current.capsule || !settled.current.card) return
    setIntro(null)
    // Forget the request so a reload does not play the intro again.
    navigate(`${window.location.pathname}${window.location.search}`, { replace: true, state: null })
  }
  let content
  if (!record || !room) content = error ? <OverlayPage><FeedbackMessage tone="error">{error}</FeedbackMessage><Button onClick={retry}>다시 시도</Button></OverlayPage> : introPhase ? null : <PageSkeleton screen="capsule" />
  else if (!available) content = <OverlayPage><MvpUnavailablePage /></OverlayPage>
  else content = <CapsuleCardView record={record} room={room} storyFont={storyFont} intro={introPhase} onRevealed={() => settle('card')} />
  return (
    <>
      {content}
      {/* Rendered beside the content, not inside its branches, so the capsule keeps playing when the record arrives. */}
      {introPhase && (
        <>
          <p role="status" className="sr-only">{record ? '캡슐 카드를 열고 있어요…' : '캡슐 카드를 불러오고 있어요…'}</p>
          <Suspense fallback={null}>
            <CapsuleIntro ready={!!record} onOpen={() => setIntro('opening')} onDone={() => settle('capsule')} getCardQuad={capsuleCardQuad} />
          </Suspense>
        </>
      )}
    </>
  )
}

type Room = NonNullable<ReturnType<typeof getStudyRoom>>
type StudyRecord = NonNullable<ReturnType<typeof useServerReport>['record']>

function CapsuleCardView({ record, room, storyFont, intro, onRevealed }: { record: StudyRecord; room: Room; storyFont: string; intro: IntroPhase | null; onRevealed: () => void }) {
  const [params, setParams] = useSearchParams()
  const { createMemory } = useBackend()
  const navigate = useNavigate()
  const [todayTimestamp] = useState(Date.now)
  const [color, setColor] = useState(0)
  const [date, setDate] = useState(() => clampCalendarDate(dayKey(Date.now() + 86400000)))
  const [time, setTime] = useState('20:00')
  const [openField, setOpenField] = useState<'date' | 'time' | null>(null)
  const [status, setStatus] = useState<{ tone: FeedbackTone; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [copyFallback, setCopyFallback] = useState(false)
  const cardRoot = useRef<HTMLDivElement>(null)
  const flipper = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLElement>(null)
  const revealed = useRef(onRevealed)
  useLayoutEffect(() => { revealed.current = onRevealed })
  const opening = intro === 'opening'
  useLayoutEffect(() => {
    if (!opening) return
    const timeline = revealCapsuleCard({
      root: cardRoot.current!,
      flipper: flipper.current!,
      panel: panel.current,
      onComplete: () => revealed.current(),
    })
    return () => { timeline.kill() }
  }, [opening])
  const participants = room.characters.filter(character => (character.serverCharacter || isMvpCharacter(character.id)) && record.characterIds.includes(character.id))
  const friends = participants.length ? participants : [room.characters[0]!]
  const character = friends.find(friend => friend.id === params.get('friend')) ?? friends[0]!
  const roomArtwork = getCapsuleRoomArtwork(room)
  const quote = fitCardQuote(record.serverReport?.closingLine ?? capsuleCardCopy.quote, previewMeasure(storyFont))
  const studyAmount = record.observedSeconds === undefined ? duration : measuredDuration
  async function save(share = false) {
    if (busy) return
    setBusy(true)
    try {
      const blob = await exportCard(
        record,
        character.name,
        colors[color]!,
        character.artworkId ?? character.id,
        roomArtwork,
      )
      const file = new File([blob], 'capsule-study-card.png', { type: 'image/png' })
      if (share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: '캡슐 카드',
          text: '오늘도 캡슐에서 같이 공부했어요.',
        })
        setStatus({ tone: 'success', text: '공유 화면을 열었어요.' })
      } else {
        downloadCard(blob)
        setStatus({
          tone: 'success',
          text: share
            ? '이미지를 저장했어요. 원하는 스토리에 올려 주세요.'
            : '캡슐 카드 이미지를 저장했어요.',
        })
      }
    } catch (error) {
      const cancelled = error instanceof DOMException && error.name === 'AbortError'
      setStatus({
        tone: cancelled ? 'info' : 'error',
        text: cancelled
          ? '공유를 취소했어요.'
          : '이미지를 저장하지 못했어요. 다시 시도해 주세요.',
      })
    } finally {
      setBusy(false)
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setStatus({ tone: 'success', text: '링크를 복사했어요. 같은 계정으로 로그인하면 이 카드를 다시 볼 수 있어요.' })
    } catch {
      setCopyFallback(true)
      setStatus({ tone: 'warning', text: '아래 주소를 직접 복사해 주세요.' })
    }
  }
  async function promise() {
    if (busy) return
    setBusy(true)
    try { await createMemory({ kind: '약속', title: '같이 공부하기', date, time }); navigate('/') }
    catch (reason) { setStatus({ tone: 'error', text: reason instanceof Error ? reason.message : '약속을 저장하지 못했어요.' }) }
    finally { setBusy(false) }
  }
  return (
    <main id="main-content" tabIndex={-1} className="capsule-share-page" data-intro={intro ?? undefined}>
      <PageNavigation />
      <div className="capsule-card-scene" inert={!!intro}>
        <div ref={cardRoot} className="capsule-card-root">
          <div ref={flipper} className="capsule-card-flipper">
            <CapsuleCardSurface color={colors[color]!} light={color > 1}>
              <div className="capsule-card-header">
                <CapsuleCardBrand />
                <span>{dateLabel(record.endedAt)}</span>
              </div>
              <div className="share-portrait">
                <CompletionPortrait characterId={character.artworkId ?? character.id} name={character.name} variant="share" />
                <div className="capsule-room-title"><RoomTitle roomId={room.artworkId ?? room.id} artwork={roomArtwork} eager /></div>
              </div>
              <p className="capsule-card-intro type-body">
                {withParticle(character.name, '과', '와')} 함께한 공부
              </p>
              <p className="capsule-study-amount">{studyAmount(record.studySeconds)}</p>
              <p className="capsule-card-focus type-body-compact">
                {capsuleFocusCopy(record)}
              </p>
              <span className="badge capsule-card-badge inline-flex items-center rounded-full px-2.5 py-1">
                {capsuleCardCopy.badge}
              </span>
              <p className="capsule-card-quote" style={{ fontFamily: storyFont, top: quote.top, fontSize: quote.fontSize, lineHeight: `${quote.lineHeight}px` }}>
                {quote.lines.map((line, index) => <span key={index}>{line}</span>)}
              </p>
            </CapsuleCardSurface>
          </div>
        </div>
      </div>
      <section ref={panel} className="w-full max-w-[440px] rounded-3xl bg-panel p-7" inert={!!intro}>
        <h1 className="type-page-title">캡슐 카드</h1>
        {friends.length > 1 && <div className="mt-4"><Tabs label="카드의 친구" options={friends.map(friend => ({ id: friend.id, label: friend.name }))} value={character.id} onChange={id => { const next = new URLSearchParams(params); next.set('friend', id); setParams(next, { replace: true }) }} size="sm" /></div>}
        <p className="mt-4 text-body-compact font-bold text-muted">카드 색 · {names[color]}</p>
        <div className="relative mt-2 h-[30px] w-[150px]">
          {colors.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`${names[index]} 카드`}
              aria-pressed={color === index}
              onClick={() => setColor(index)}
              className={cn(
                'absolute top-0 size-[30px] rounded-full',
                color === index && 'outline-2 outline-offset-4 outline-text-accent',
              )}
              style={{ left: index * 40, background: colors[index] }}
            />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={busy}
            onClick={() => void save()}
          >
            이미지 저장
          </Button>
          <Button
            size="sm"
            loading={busy}
            onClick={() => void save(true)}
          >
            스토리 공유
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void copy()}
          >
            링크 복사
          </Button>
        </div>
        {(busy || status) && (
          <FeedbackMessage tone={busy ? 'info' : status!.tone} className="mt-3">
            {busy ? '캡슐 카드를 만들고 있어요…' : status!.text}
          </FeedbackMessage>
        )}
        {copyFallback && (
          <input
            aria-label="공유 링크"
            readOnly
            value={window.location.href}
            onFocus={(event) => event.target.select()}
            className="form-input mt-2 text-caption"
          />
        )}
        <hr className="my-4 border-divider" />
        <h2 className="type-section-title">다음 공부 약속</h2>
        <div className="mt-3 space-y-3">
          <DateTimeWheelField
            label="날짜 선택"
            mode="date"
            value={date}
            min={dayKey(todayTimestamp)}
            onChange={setDate}
            open={openField === 'date'}
            onOpenChange={(open) => setOpenField(open ? 'date' : null)}
          />
          <DateTimeWheelField
            label="시간"
            mode="time"
            value={time}
            onChange={setTime}
            open={openField === 'time'}
            onOpenChange={(open) => setOpenField(open ? 'time' : null)}
          />
        </div>
        <Button
          disabled={busy || !date || !time}
          onClick={() => { void promise() }}
          className="mt-4 w-full"
        >
          {date.slice(5)} {time} 약속 저장하기
        </Button>
        <Link to="/" className="mt-3 inline-block text-body-compact text-muted underline">
          저장하지 않고 홈으로
        </Link>
      </section>
    </main>
  )
}
