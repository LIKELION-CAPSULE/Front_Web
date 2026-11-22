import { Link, useNavigate, useParams } from 'react-router'
import { useEffect, useState, type MouseEvent } from 'react'
import { useBackend } from '@/features/backend/backend-context'
import { useDemo } from '@/features/demo/demo-context'
import { availableMates } from '@/features/mates/catalog'
import { ConnectMateButton } from '@/features/mates/components/ConnectMateButton'
import { MateCard } from '@/features/mates/components/MateCard'
import { matePortrait } from '@/features/mates/artwork'
import { HeaderAccount } from '@/app/components/HeaderAccount'
import { SiteHeader } from '@/app/components/SiteHeader'
import { Icon } from '@/shared/ui/Icon'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { MatePreview } from '@/features/mates/components/MatePreview'
import { VoiceSampleButton, type VoiceSampleStatus } from '@/features/mates/components/VoiceSampleButton'
import { MateMenu } from '@/features/mates/components/MateMenu'
import NotFoundPage from './NotFoundPage'
import '@/features/auth/login-backgrounds/desktop/desktop.css'
import '@/features/mates/mates.css'

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> }
}

export default function MateDetailPage() {
  const { mateId } = useParams()
  const navigate = useNavigate()
  const { home, mateDetails, loadMateDetail, mateContentVersion } = useBackend()
  const { state } = useDemo()
  const [resetting, setResetting] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null)
  const [ctaActive, setCtaActive] = useState(false)
  const [audioStatus, setAudioStatus] = useState<VoiceSampleStatus>('idle')

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
  const role = detail?.role ?? mate.role
  const intro = detail?.intro ?? mate.intro
  const tags = detail?.tags ?? mate.tags

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
      <main id="main-content" tabIndex={-1} className="page-container mate-detail focus:outline-none">
        <section
          className="mate-detail-window desktop-window desktop-window--active"
          aria-labelledby="mate-name"
        >
          <div className="desktop-window-titlebar mate-window-titlebar-static">
            <div className="desktop-window-title-left">
              <span className="desktop-mate-title">
                <span className="desktop-mate-dot" aria-hidden="true" />
                <span>{mate.name} · 연결 대기 중</span>
              </span>
            </div>
            <div className="desktop-window-title-right">
              <span className="desktop-mate-ai-badge">AI 캐릭터입니다</span>
              <MateMenu
                mateId={mate.id}
                revision={detail?.conversationRevision}
                onBusyChange={setResetting}
                onDialogChange={setDialogOpen}
              />
              <div className="desktop-window-controls" aria-hidden="true">
                <span className="desktop-window-dot" />
                <span className="desktop-window-dot" />
                <span className="desktop-window-dot" />
              </div>
            </div>
          </div>

          <div className="desktop-window-body mate-detail-window-body">
            <MatePreview
              mateId={mate.id}
              model={detail?.model}
              scope={key}
              image={matePortrait(mate.id, mate.image)}
              name={mate.name}
              paused={dialogOpen}
              ctaActive={ctaActive}
              audioStatus={audioStatus}
              suppressSpeech={Boolean(error) || Boolean(loadMateDetail && !detail)}
              controlBar={
                <VoiceSampleButton
                  url={detail?.voiceSampleUrl}
                  disabled={dialogOpen || resetting}
                  onStatusChange={setAudioStatus}
                />
              }
              onRetry={() => setAttempt((value) => value + 1)}
            />

            <div className="mate-detail-copy">
              <h1 id="mate-name">{mate.name}</h1>
              {introduction && <p className="mate-detail-introduction">{introduction}</p>}
              {tags.length > 0 && (
                <div className="mate-tags">
                  {tags.map((tag) => (
                    <span key={tag}>#{tag}</span>
                  ))}
                </div>
              )}

              <div
                className="mate-detail-cta"
                onMouseEnter={() => setCtaActive(true)}
                onMouseLeave={() => setCtaActive(false)}
                onFocus={() => setCtaActive(true)}
                onBlur={() => setCtaActive(false)}
              >
                <ConnectMateButton mate={mate} disabled={resetting} />
              </div>

              {loadMateDetail && !detail && !error && (
                <p role="status" className="mt-4 text-muted text-body-compact">
                  캐릭터를 불러오고 있어요.
                </p>
              )}
              {error && (
                <div className="mt-4">
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

              {(role || description || intro) && (
                <div className="mate-detail-story">
                  {role && (
                    <section>
                      <h2>내 역할</h2>
                      <p>{role}</p>
                    </section>
                  )}
                  {description && (
                    <section>
                      <h2>세계관</h2>
                      <p>{description}</p>
                    </section>
                  )}
                  {intro && (
                    <section className="mate-detail-intro-card" aria-label="첫 상황">
                      <span className="mate-detail-intro-label">첫 상황</span>
                      <p>{intro}</p>
                    </section>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {mates.length > 1 && (
          <section className="mate-section">
            <h2 className="type-section-title mate-section-title">다른 메이트도 만나 보세요</h2>
            <div className="mate-grid">
              {mates
                .filter((value) => value.id !== mate.id)
                .map((value) => (
                  <MateCard key={value.id} mate={value} />
                ))}
            </div>
          </section>
        )}
      </main>
    </>
  )
}
