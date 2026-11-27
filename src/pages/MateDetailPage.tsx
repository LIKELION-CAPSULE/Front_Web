import { Link, useNavigate, useParams } from 'react-router'
import { useEffect, useState, type CSSProperties, type MouseEvent } from 'react'
import { useBackend } from '@/features/backend/backend-context'
import { useDemo } from '@/features/demo/demo-context'
import { ageRatingLabel, availableMates, withComingSoon } from '@/features/mates/catalog'
import { ConnectMateButton } from '@/features/mates/components/ConnectMateButton'
import { AgeRatingMark, VoiceWaveIcon } from '@/features/mates/components/MateDetailMarks'
import { MateAlertButton } from '@/features/mates/components/MateAlertButton'
import { matePortrait } from '@/features/mates/artwork'
import { HeaderAccount } from '@/app/components/HeaderAccount'
import { SiteHeader } from '@/app/components/SiteHeader'
import { Icon } from '@/shared/ui/Icon'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { MatePreview } from '@/features/mates/components/MatePreview'
import { VoiceSampleButton } from '@/features/mates/components/VoiceSampleButton'
import NotFoundPage from './NotFoundPage'
import '@/features/auth/login-backgrounds/desktop/desktop.css'
import '@/features/mates/mates.css'
import '@/features/mates/mate-detail.css'

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> }
}

export default function MateDetailPage() {
  const { mateId } = useParams()
  const navigate = useNavigate()
  const { home, mateDetails, loadMateDetail, mateContentVersion } = useBackend()
  const { state } = useDemo()
  const [attempt, setAttempt] = useState(0)
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null)

  const mates = availableMates(home)
  const mate = mates.find((value) => value.id === mateId)
  const id = mate?.id
  const key = `${state.profile.userId}:${id}:${mateContentVersion}`
  const detail = id ? mateDetails[id] : undefined
  const error = failure?.key === key ? failure.message : ''

  useEffect(() => {
    if (!id || !loadMateDetail) return
    let alive = true
    void loadMateDetail(id, attempt > 0).catch((reason) => {
      if (alive) {
        setFailure({
          key,
          message: reason instanceof Error ? reason.message : '요청을 처리하지 못했어요.',
        })
      }
    })
    return () => {
      alive = false
    }
  }, [id, key, attempt, loadMateDetail])

  if (!mate) return <NotFoundPage />

  const introduction = detail?.introduction ?? mate.introduction
  const description = detail?.description ?? mate.description
  const intro = detail?.intro ?? mate.intro
  // 31 wins over the /home card (it is read for this page): coming soon closes the connection, the rating is the server's.
  // The connect button gets the same value (a card still marked coming soon must not stop a mate 31 says is open).
  const comingSoon = detail?.comingSoon ?? Boolean(mate.comingSoon)
  const ageRating = detail?.ageRating ?? mate.ageRating
  // The outline name behind the hero: one letter per step down a diagonal (채 / 린, 서 / 도 / 현), so letters never
  // sit on top of each other however long the name is. Longer names get smaller letters (mate-detail.css).
  const nameLetters = Array.from(mate.name)

  function handleBackToHome(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const doc = document as ViewTransitionDocument
    if (reduced || typeof doc.startViewTransition !== 'function') return
    event.preventDefault()
    doc.startViewTransition(() => {
      navigate('/')
    })
  }

  return (
    <>
      <SiteHeader
        sticky
        navigation={
          <nav aria-label="현재 위치" className="detail-breadcrumb">
            <Link to="/" onClick={handleBackToHome}>
              홈
            </Link>
            <Icon name="chevron" size={14} />
            <span aria-current="page">{mate.name}</span>
          </nav>
        }
        account={
          state.profile.loggedIn ? (
            <HeaderAccount />
          ) : (
            <ButtonLink to="/login" size="sm" variant="secondary">
              로그인
            </ButtonLink>
          )
        }
      />
      <main id="main-content" tabIndex={-1} className="mate-hero focus:outline-none">
        {/* Space backdrop: soft nebulae, faint stars, and the mate's name set huge in outline behind everything. */}
        <div className="mate-hero-backdrop" aria-hidden="true" style={{ '--outline-count': nameLetters.length } as CSSProperties}>
          {nameLetters.map((letter, index) => (
            <span
              key={index}
              className="mate-hero-outline"
              data-tone={index % 2 ? 'deep' : 'light'}
              style={{ '--outline-index': index } as CSSProperties}
            >
              {letter}
            </span>
          ))}
        </div>

        {/* The mate, large and floating: Live2D that only follows the cursor (still portrait until it loads). */}
        <div className="mate-hero-figure">
          <div className="mate-hero-glow" aria-hidden="true" />
          <svg className="mate-hero-capsules" viewBox="0 0 220 220" aria-hidden="true">
            <rect className="mate-hero-capsule mate-hero-capsule--a" x="62" y="20" width="96" height="180" rx="48" />
            <rect className="mate-hero-capsule mate-hero-capsule--b" x="62" y="20" width="96" height="180" rx="48" />
          </svg>
          <div className="mate-hero-stage">
            <MatePreview
              mateId={mate.id}
              model={detail?.model}
              scope={key}
              image={matePortrait(mate.id, mate.image)}
              name={mate.name}
              paused={false}
              suppressSpeech
              showAgeBadge={false}
              onRetry={() => setAttempt((value) => value + 1)}
            />
          </div>
        </div>

        <section className="mate-hero-info page-container" aria-labelledby="mate-name">
          <div className="mate-hero-copy">
            <h1 id="mate-name" className="mate-hero-name" data-tour="mate-detail-name">
              {mate.name}
            </h1>
            {introduction && <p className="mate-hero-tagline" data-tour="mate-detail-tagline">{introduction}</p>}
            {intro && <p className="mate-hero-situation" data-tour="mate-detail-intro">{intro}</p>}
            {mate.firstLine && <p className="mate-hero-description mate-hero-first-line">“{mate.firstLine}”</p>}
            {description && <p className="mate-hero-description">{description}</p>}

            <div className="mate-hero-tiles">
              <div className="mate-hero-tile-group" data-tour="mate-detail-age">
                <span className="mate-hero-tile-caption">연령 등급</span>
                <div className="mate-hero-tile">
                  <AgeRatingMark rating={ageRating} />
                  <strong>{ageRatingLabel(ageRating)}</strong>
                </div>
              </div>
              <div className="mate-hero-tile-group" data-tour="mate-detail-voice">
                <span className="mate-hero-tile-caption">목소리</span>
                <VoiceSampleButton
                  className="mate-hero-tile mate-hero-voice"
                  url={detail?.voiceSampleUrl}
                  disabled={false}
                  idleLabel="목소리 듣기"
                  idleArt={<VoiceWaveIcon size={38} />}
                  iconSize={30}
                />
              </div>
            </div>

            <div className="mate-hero-actions" data-tour="mate-detail-connect">
              {comingSoon ? <MateAlertButton mate={mate} /> : <ConnectMateButton mate={withComingSoon(mate, comingSoon)} pickup />}
            </div>

            {loadMateDetail && !detail && !error && (
              <p role="status" className="mate-hero-status">
                메이트를 불러오고 있어요.
              </p>
            )}
            {error && (
              <div className="mate-hero-status">
                <FeedbackMessage tone="error">{error}</FeedbackMessage>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-3"
                  onClick={() => {
                    setFailure(null)
                    setAttempt((value) => value + 1)
                  }}
                >
                  다시 시도
                </Button>
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  )
}
