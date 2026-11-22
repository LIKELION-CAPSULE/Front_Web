import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useBackend } from '@/features/backend/backend-context'
import { useSessionSync } from '@/features/backend/use-session-sync'
import { useDemo } from '@/features/demo/demo-context'
import { sessionStudySeconds } from '@/features/session/connection-time'
import { useMedia } from '@/features/media/media-context'
import { availableMates } from '@/features/mates/catalog'
import { selectLeaveQuote } from '@/features/mates/mate-contract'
import { ConnectionIdleClock } from '@/features/mates/connection-idle'
import { ConnectMateButton } from '@/features/mates/components/ConnectMateButton'
import { ConnectionPip } from '@/features/mates/components/ConnectionPip'
import { useDocumentPip } from '@/features/mates/use-document-pip'
import AccountSettingsDialog from '@/features/profile/components/AccountSettingsDialog'
import { CALL_STAGE_GRADIENT, chaerinArtwork, mateHeroPortrait, matePortrait } from '@/features/mates/artwork'
import { Live2DFigure } from '@/features/live2d/components/Live2DFigure'
import { useExpressionDirector } from '@/features/live2d/use-live2d'
import { useNow } from '@/features/session/use-now'
import { ChatComposer } from '@/features/session/components/ChatComposer'
import { TypingIndicator } from '@/features/session/components/TypingIndicator'
import { TypingMessage } from '@/features/session/components/TypingMessage'
import { CharacterSpeechBubble } from '@/features/session/components/CharacterSpeechBubble'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { GlassDock, type GlassDockItem } from '@/shared/ui/dock/GlassDock'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { Icon } from '@/shared/ui/Icon'
import { AnimatedClock } from '@/shared/ui/AnimatedClock'
import { clock } from '@/shared/lib/format'
import { ApiError } from '@/shared/api/client'
import { CREDIT_PRICING } from '@/features/credits/credit-utils'
import NotFoundPage from './NotFoundPage'
import '@/features/auth/login-backgrounds/desktop/desktop.css'
import '@/features/mates/mates.css'
import '@/features/mates/connections.css'
import { useConnectionPreferences } from '@/features/mates/connection-preferences-context'

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> }
}

export default function ConnectionPage() {
  const { mateId } = useParams()
  const navigate = useNavigate()
  const backend = useBackend()
  const { showPipSpeech } = useConnectionPreferences()
  const { state } = useDemo()
  const { devices, controller, observation, flushFocus } = useMedia()
  const mate = availableMates(backend.home).find(value => value.id === mateId)
  const active = state.activeSession?.mateId === mateId ? state.activeSession : null
  const now = useNow()
  const [chatOpen, setChatOpen] = useState(() => (typeof window !== 'undefined' ? window.innerWidth > 960 : true))
  const [infoMenuOpen, setInfoMenuOpen] = useState(false)
  const infoMenuRef = useRef<HTMLDivElement>(null)
  const stageWrapRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState('')
  const [error, setError] = useState('')
  const [speech, setSpeech] = useState({ id: 0, at: 0, text: '' })
  const [speakingMessages, setSpeakingMessages] = useState<ReadonlySet<string>>(new Set())
  const speaking = speakingMessages.size > 0
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [privacySeen, setPrivacySeen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [bgFailed, setBgFailed] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(() =>
    typeof document !== 'undefined' ? Boolean(document.fullscreenElement) : false,
  )
  const pip = useDocumentPip()
  const camera = devices.camera.stream
  const video = useRef<HTMLVideoElement>(null)
  const busy = useRef(false)
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])
  useEffect(() => {
    if (!infoMenuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!infoMenuRef.current?.contains(target)) setInfoMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setInfoMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [infoMenuOpen])
  useEffect(() => {
    if (!active) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return
      if (document.querySelector('dialog:modal')) return
      const target = event.target
      const editing = target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      if (editing) return
      const key = event.code === 'KeyC' ? 'c' : event.key.toLowerCase()
      if (key === 'c') {
        event.preventDefault()
        setChatOpen(value => !value)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active])
  const idle = useRef(new ConnectionIdleClock(0))
  const attemptedIdleEnd = useRef(false)
  const messageList = useRef<HTMLDivElement>(null)
  const followMessages = useRef(true)
  const seenMessages = useRef(new Set(state.messages.map(message => message.id)))
  const scrollLatest = useCallback(() => {
    if (followMessages.current && messageList.current) messageList.current.scrollTop = messageList.current.scrollHeight
  }, [])
  const reportTyping = useCallback((messageId: string, typing: boolean) => {
    setSpeakingMessages(current => {
      if (current.has(messageId) === typing) return current
      const next = new Set(current)
      if (typing) next.add(messageId)
      else next.delete(messageId)
      return next
    })
  }, [])
  const expressions = useExpressionDirector(backend.live2dStage)
  const cue = useCallback((input: Parameters<typeof expressions.cue>[0]) => expressions.cue(input), [expressions])
  const navigateToRecord = useCallback((recordId: string) => {
    const target = `/connections/${recordId}`
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const doc = document as ViewTransitionDocument
    const stageEl = stageWrapRef.current?.querySelector<HTMLElement>('.connection-mate')
    if (reduced || typeof doc.startViewTransition !== 'function' || !stageEl) {
      navigate(target, { replace: true })
      return
    }
    stageEl.style.viewTransitionName = 'connection-stage-to-record'
    const transition = doc.startViewTransition(() => {
      navigate(target, { replace: true })
    })
    void transition.finished.finally(() => {
      stageEl.style.viewTransitionName = ''
    })
  }, [navigate])
  const serverEnded = useCallback(() => {
    if (!mounted.current || !active || !state.profile.userId) return
    flushFocus()
    if (!backend.acknowledgeEndedSession(active.id, state.profile.userId)) return
    controller.stop()
    pip.close()
    navigateToRecord(active.id)
  }, [active, state.profile.userId, flushFocus, backend, controller, pip, navigateToRecord])
  const sync = useSessionSync({
    active, userId: state.profile.userId, observation, camera: !!camera, busy: sending || speaking,
    onExpression: cue,
    onReaction: (result, event) => {
      const reply = result.characters?.find(value => String(value.characterId) === mate?.characterId)
      const content = reply?.content
      if (content) setSpeech(previous => ({ id: previous.id + 1, at: Date.now(), text: content }))
      if (reply?.characterId) cue({ characterId: reply.characterId, expression: reply.expression, event, stage: 'speech', text: reply.content })
    },
    onEnded: serverEnded,
  })
  const messages = state.messages.filter(message => message.characterId === mate?.characterId && /^\d+$/.test(message.sessionId))
  const lastText = messages.at(-1)?.text
  const latestReply = messages.findLast(message => message.sender === 'character')
  useEffect(scrollLatest, [messages.length, lastText, chatOpen, scrollLatest])
  useEffect(() => {
    if (video.current) { video.current.srcObject = camera; if (camera) void video.current.play().catch(() => {}) }
  }, [camera, active?.id])
  useEffect(() => {
    const input = () => { idle.current.input(Date.now()); attemptedIdleEnd.current = false }
    const surfaces = pip.window ? [window, pip.window] : [window]
    for (const surface of surfaces) for (const type of ['pointerdown', 'keydown', 'wheel'] as const) surface.addEventListener(type, input, { passive: true })
    return () => { for (const surface of surfaces) for (const type of ['pointerdown', 'keydown', 'wheel'] as const) surface.removeEventListener(type, input) }
  }, [pip.window])
  const finish = useCallback(async (confirmed = false) => {
    if (busy.current || !active) return
    busy.current = true
    setFinishing(true)
    setFinishError('')
    try {
      flushFocus()
      const record = await backend.finishSession({ acceptUnknownPresence: confirmed })
      if (mounted.current) { controller.stop(); navigateToRecord(record.id) }
    } catch (reason) {
      if (!mounted.current) return
      if (reason instanceof ApiError && reason.code === 'SESSION_ENDED') serverEnded()
      else { setFinishError(reason instanceof Error ? reason.message : '요청을 처리하지 못했어요.'); setLeaveOpen(true) }
    }
    finally { busy.current = false; if (mounted.current) setFinishing(false) }
  }, [active, backend, controller, flushFocus, navigateToRecord, setLeaveOpen, serverEnded])
  useEffect(() => {
    if (!active || finishing) return
    const presence = observation && performance.now() - observation.at <= 1500 ? observation.faceCount > 0 ? 'present' : 'absent' : 'unknown'
    const remaining = idle.current.remaining(now, !!camera, presence)
    if (remaining <= 0 && !attemptedIdleEnd.current) {
      attemptedIdleEnd.current = true
      void finish()
    }
  }, [now, camera, observation, active, finishing, finish])
  async function send(text: string, inputType: 'TEXT' | 'QUICK' = 'TEXT') {
    if (!mate || sending || speaking || finishing || !text.trim()) return false
    followMessages.current = true
    setSending(true)
    setError('')
    try {
      const result = await backend.sendMessage(mate.characterId, text, inputType)
      if (!mounted.current) return false
      if (result.characterId) cue({ characterId: result.characterId, expression: result.expression, event: 'MESSAGE', stage: 'speech', text: result.content })
      setDraft('')
      return true
    } catch (reason) {
      if (mounted.current) {
        if (reason instanceof ApiError && reason.code === 'SESSION_ENDED') serverEnded()
        else setError(reason instanceof Error ? reason.message : '요청을 처리하지 못했어요.')
      }
      return false
    }
    finally { if (mounted.current) setSending(false) }
  }
  function toggleCamera() {
    if (camera) { flushFocus(); controller.stop('camera') }
    else if (!privacySeen) setPrivacyOpen(true)
    else void controller.request('camera')
  }
  function toggleFullscreen() {
    if (typeof document === 'undefined') return
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => {})
    } else {
      void document.documentElement.requestFullscreen?.().catch(() => {})
    }
  }
  if (!mate) return <NotFoundPage />
  if (!active) {
    const heroSrc = mateHeroPortrait(mate.id, mate.image)
    return (
      <main id="main-content" tabIndex={-1} className="connection-entry focus:outline-none">
        <section className="connection-entry-window desktop-window desktop-window--active" aria-labelledby="connection-entry-title">
          <header className="desktop-window-titlebar mate-window-titlebar-static">
            <div className="desktop-window-title-left">
              <span className="desktop-mate-title">
                <span className="desktop-mate-dot" aria-hidden="true" />
                <span>{mate.name} · 연결 준비 중</span>
              </span>
            </div>
            <div className="desktop-window-title-right">
              <span className="desktop-mate-ai-badge">AI 캐릭터입니다</span>
              <div className="desktop-window-controls" aria-hidden="true">
                <span className="desktop-window-dot" />
                <span className="desktop-window-dot" />
                <span className="desktop-window-dot" />
              </div>
            </div>
          </header>
          <div className="connection-entry-stage" style={{ background: CALL_STAGE_GRADIENT }}>
            {!bgFailed && (
              <img
                src={chaerinArtwork.callBackground.portrait}
                alt=""
                aria-hidden="true"
                className="desktop-mate-bg-img"
                draggable={false}
                onError={() => setBgFailed(true)}
              />
            )}
            {heroSrc && (
              <div className="connection-entry-portrait">
                <img src={heroSrc} alt={mate.name} draggable={false} />
              </div>
            )}
          </div>
          <div className="connection-entry-body">
            <h1 id="connection-entry-title">{backend.activeSummary ? `${mate.name}과 다시 연결할까요?` : mate.name}</h1>
            {backend.activeSummary && <p className="connection-entry-sub">하던 대화를 이어서 해요.</p>}
            <ConnectMateButton
              mate={mate}
              label={backend.activeSummary ? '다시 연결하기' : '연결하기'}
              errorPlacement="above"
            />
            <ButtonLink to="/" variant="ghost" size="sm">홈으로</ButtonLink>
          </div>
        </section>
      </main>
    )
  }

  const relation = backend.affinities[Number(mate.characterId)]
  const isAdvanced = Boolean(backend.betaSettings?.advanced)
  const canSwitchMode = Boolean(backend.featurePort)
  const creditInsufficient = Boolean(
    backend.wallet &&
    backend.betaSettings &&
    (backend.betaSettings.voice ? CREDIT_PRICING.voice : 0) +
      (backend.betaSettings.advanced ? CREDIT_PRICING.advanced : 0) >
      backend.wallet.attendance + backend.wallet.invitation,
  )
  const floatingErrors = [sync.error, devices.camera.error, pip.error].filter(Boolean)
  const leaveQuote = selectLeaveQuote(backend.mateDetails[mate.id], mate)
  const cameraBusy = devices.camera.status === 'requesting'
  const dockItems: GlassDockItem[] = [
    {
      key: 'microphone',
      label: '누르고 말하기',
      tooltip: '누르고 말하기',
      icon: 'microphone',
      disabled: true,
      onAction: () => {},
    },
    {
      key: 'camera',
      label: cameraBusy ? '카메라 연결 중' : camera ? '카메라 끄기' : '카메라 켜기',
      tooltip: cameraBusy ? '연결 중' : camera ? '카메라 끄기' : '카메라 켜기',
      icon: camera ? 'video' : 'videoOff',
      pressed: !!camera,
      device: true,
      disabled: cameraBusy,
      busy: cameraBusy,
      onAction: toggleCamera,
    },
    {
      key: 'chat',
      label: chatOpen ? '채팅 닫기' : '채팅 열기',
      tooltip: chatOpen ? '채팅 닫기' : '채팅 열기',
      icon: 'chat',
      pressed: chatOpen,
      expanded: chatOpen,
      shortcut: 'C',
      controls: 'connection-chat',
      onAction: () => setChatOpen(value => !value),
    },
    {
      key: 'pip',
      label: 'PIP로 띄우기',
      tooltip: 'PIP로 띄우기',
      icon: 'shrink',
      pressed: pip.status === 'open',
      disabled: pip.status === 'opening',
      busy: pip.status === 'opening',
      dividerBefore: true,
      secondary: true,
      onAction: () => { void pip.open() },
    },
    {
      key: 'settings',
      label: '설정',
      tooltip: '설정',
      icon: 'sliders',
      hasPopup: 'dialog',
      secondary: true,
      onAction: () => setSettingsOpen(true),
    },
    {
      key: 'leave',
      label: '연결 끊기',
      tooltip: '연결 끊기',
      icon: 'phoneOff',
      tone: 'danger',
      dividerBefore: true,
      disabled: finishing,
      busy: finishing,
      onAction: () => setLeaveOpen(true),
    },
  ]

  return (
    <main id="main-content" tabIndex={-1} className="connection-page focus:outline-none">
      <header className="desktop-window-titlebar mate-window-titlebar-static connection-titlebar">
        <div className="connection-titlebar-left">
          <span className="desktop-mate-dot" aria-hidden="true" />
          <h1>{mate.name} · 연결 중</h1>
          <time className="connection-timer" aria-label="연결 시간">
            <AnimatedClock value={clock(sessionStudySeconds(active, now))} />
          </time>
        </div>

        <div className="connection-titlebar-center">
          <div className="connection-mode-segment" role="group" aria-label="대화 모드">
            <button
              type="button"
              className="connection-mode-option"
              data-active={!isAdvanced || undefined}
              aria-pressed={!isAdvanced}
              disabled={!canSwitchMode}
              onClick={() => backend.featurePort?.setSettings({ advanced: false })}
            >
              기본 · 크레딧 없음
            </button>
            <button
              type="button"
              className="connection-mode-option"
              data-active={isAdvanced || undefined}
              aria-pressed={isAdvanced}
              disabled={!canSwitchMode}
              onClick={() => backend.featurePort?.setSettings({ advanced: true })}
            >
              고급 · 1턴 {CREDIT_PRICING.advanced}
            </button>
          </div>
        </div>

        <div className="connection-titlebar-right">
          <span className="connection-titlebar-chip">친밀도 {relation?.stageName || '—'}</span>
          {backend.wallet && (
            <span className="connection-titlebar-chip">
              오늘 남은 크레딧 {(backend.wallet.attendance + backend.wallet.invitation).toLocaleString('ko-KR')}
            </span>
          )}
          <div ref={infoMenuRef} className="connection-titlebar-more-wrap">
            <button
              type="button"
              className="mate-menu-trigger connection-titlebar-more"
              aria-label="연결 정보 더보기"
              aria-haspopup="menu"
              aria-expanded={infoMenuOpen}
              onClick={() => setInfoMenuOpen(open => !open)}
            >
              <Icon name="more" size={16} />
            </button>
            {infoMenuOpen && (
              <div role="menu" aria-label="연결 정보" className="mate-menu-panel connection-titlebar-more-menu">
                <div className="connection-titlebar-more-item">
                  <span>친밀도</span>
                  <strong>{relation?.stageName || '—'}</strong>
                </div>
                {backend.wallet && (
                  <div className="connection-titlebar-more-item">
                    <span>오늘 남은 크레딧</span>
                    <strong>{(backend.wallet.attendance + backend.wallet.invitation).toLocaleString('ko-KR')}</strong>
                  </div>
                )}
              </div>
            )}
          </div>
          <span className="desktop-mate-ai-badge">AI 캐릭터입니다</span>
          <div className="connection-window-dots">
            <button
              type="button"
              className="connection-dot connection-dot--red"
              aria-label="연결 끊기 창 열기"
              title="연결 끊기"
              disabled={finishing}
              onClick={() => setLeaveOpen(true)}
            />
            <button
              type="button"
              className="connection-dot connection-dot--yellow"
              aria-label="PIP 창으로 띄우기"
              title="PIP로 띄우기"
              disabled={pip.status === 'opening'}
              onClick={() => { void pip.open() }}
            />
            <button
              type="button"
              className="connection-dot connection-dot--green"
              aria-label={isFullscreen ? '전체화면 종료' : '전체화면 전환'}
              title={isFullscreen ? '전체화면 종료' : '전체화면 전환'}
              onClick={toggleFullscreen}
            />
          </div>
        </div>
      </header>

      <div className="connection-content" data-chat={chatOpen || undefined}>
        <div ref={stageWrapRef} className="connection-stage-wrap">
          <div className="connection-stage">
            <section
              className="connection-mate"
              aria-label={mate.name}
              data-speaking={speaking || undefined}
              style={{ background: CALL_STAGE_GRADIENT }}
            >
              {!bgFailed && (
                <img
                  src={chaerinArtwork.callBackground.landscape}
                  alt=""
                  aria-hidden="true"
                  className="connection-mate-bg-img"
                  draggable={false}
                  onError={() => setBgFailed(true)}
                />
              )}
              <div className="connection-mate-figure">
                {backend.live2dStage ? (
                  <>
                    {pip.window && <img src={matePortrait(mate.id, mate.image)} alt="" className="connection-mate-fallback-img" />}
                    <Live2DFigure stage={backend.live2dStage} />
                  </>
                ) : (
                  <img src={matePortrait(mate.id, mate.image)} alt="" className="connection-mate-fallback-img" />
                )}
              </div>
              {speech.text && (
                <div className="connection-speech-slot">
                  <CharacterSpeechBubble
                    key={speech.id}
                    name={mate.name}
                    text={speech.text}
                    expanded
                    variant="pill"
                  />
                </div>
              )}
            </section>

            <section className="connection-self desktop-window" aria-label="내 화면">
              <div className="connection-self-titlebar">
                <span className="connection-self-title">나</span>
                <span
                  className="connection-self-camera-state"
                  data-camera-on={Boolean(camera) || undefined}
                  aria-hidden="true"
                >
                  <span className="connection-self-camera-dot" />
                  <Icon name="camera" size={12} />
                </span>
              </div>
              <div className="connection-self-body">
                <video ref={video} muted autoPlay playsInline hidden={!camera} aria-label="내 카메라 미리보기" />
                {!camera && (
                  <div className="connection-avatar">
                    {state.profile.profileImage ? (
                      <img src={state.profile.profileImage} alt="내 아바타" />
                    ) : (
                      <Icon name="user" size={32} />
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>

          {(creditInsufficient || floatingErrors.length > 0) && (
            <div className="connection-floating-notices" aria-live="polite">
              {creditInsufficient && (
                <div className="connection-notice-card">
                  <FeedbackMessage tone="warning">크레딧이 부족해요. 기본 대화로 계속할 수 있어요.</FeedbackMessage>
                </div>
              )}
              {floatingErrors.map((message, index) => (
                <div key={`${index}:${message}`} className="connection-notice-card">
                  <FeedbackMessage tone="error">{message}</FeedbackMessage>
                </div>
              ))}
            </div>
          )}

          <GlassDock
            className="connection-controls"
            ariaLabel="연결 컨트롤"
            containerRef={stageWrapRef}
            items={dockItems}
            moreLabel="추가 도구"
            moreMenuLabel="추가 연결 도구"
          />
        </div>

        {chatOpen && (
          <aside id="connection-chat" className="connection-chat desktop-window" aria-labelledby="connection-chat-title">
            <header className="desktop-window-titlebar mate-window-titlebar-static">
              <div className="desktop-window-title-left">
                <h2 id="connection-chat-title">{mate.name}과 대화</h2>
              </div>
              <div className="desktop-window-title-right">
                <Button variant="ghost" size="sm" onClick={() => setChatOpen(false)} aria-label="대화창 닫기" className="connection-chat-close">
                  <Icon name="close" size={16} />
                </Button>
              </div>
            </header>
            <div
              ref={messageList}
              className="connection-messages"
              role="log"
              aria-label={`${mate.name}과 대화`}
              aria-live="polite"
              aria-relevant="additions"
              onScroll={() => {
                const node = messageList.current
                if (node) followMessages.current = node.scrollHeight - node.scrollTop - node.clientHeight < 64
              }}
            >
              {messages.map(message => (
                <article key={message.id} data-sender={message.sender}>
                  <small>{message.sender === 'user' ? state.profile.name : mate.name}</small>
                  <p>
                    {message.sender === 'character' ? (
                      <TypingMessage
                        id={message.id}
                        text={message.text}
                        seen={seenMessages}
                        onProgress={scrollLatest}
                        onTypingChange={reportTyping}
                      />
                    ) : (
                      message.text
                    )}
                  </p>
                </article>
              ))}
              {sending && messages.at(-1)?.sender !== 'character' && <TypingIndicator name={mate.name} />}
            </div>
            {error && (
              <div className="connection-chat-error">
                <FeedbackMessage tone="error">{error}</FeedbackMessage>
              </div>
            )}
            <ChatComposer name={mate.name} text={draft} onChange={setDraft} onSend={send} sendDisabled={sending || speaking || finishing} />
          </aside>
        )}
      </div>

      {pip.window && (
        <ConnectionPip
          target={pip.window}
          mate={mate}
          stage={backend.live2dStage}
          speech={showPipSpeech ? (latestReply && (latestReply.createdAt ?? 0) >= speech.at ? latestReply.text : speech.text) : undefined}
          onReturn={() => { window.focus(); pip.close() }}
        />
      )}
      {settingsOpen && <AccountSettingsDialog initialView="settings" onClose={() => setSettingsOpen(false)} />}

      <Dialog open={privacyOpen} onClose={() => setPrivacyOpen(false)} title="카메라 사용 안내">
        <p className="text-muted">카메라를 켜면 자리 비움·복귀에 메이트가 반응해요. 영상은 이 기기 안에서만 확인하고 저장하거나 보내지 않아요.</p>
        <div className="mt-6 flex gap-3">
          <Button onClick={() => { setPrivacySeen(true); setPrivacyOpen(false); void controller.request('camera') }}>카메라 켜기</Button>
          <Button variant="secondary" onClick={() => setPrivacyOpen(false)}>카메라 없이 하기</Button>
        </div>
      </Dialog>

      <Dialog
        open={leaveOpen}
        onClose={() => { if (!finishing) setLeaveOpen(false) }}
        dismissible={!finishing}
        showHeader={false}
        title={`${mate.name}과의 연결을 끊을까요?`}
        className="mate-reset-dialog mate-reset-dialog--desktop connection-leave-dialog"
      >
        <header className="desktop-window-titlebar mate-window-titlebar-static">
          <div className="desktop-window-title-left">연결 끊기</div>
          <div className="desktop-window-title-right">
            <div className="desktop-window-controls">
              <button
                type="button"
                className="desktop-window-dot desktop-window-dot--close"
                aria-label="닫기"
                disabled={finishing}
                onClick={() => setLeaveOpen(false)}
              >
                <span aria-hidden="true">×</span>
              </button>
              <span className="desktop-window-dot" aria-hidden="true" />
              <span className="desktop-window-dot" aria-hidden="true" />
            </div>
          </div>
        </header>
        <div className="mate-reset-dialog-body">
          <h2 className="mate-reset-dialog-heading">{mate.name}과의 연결을 끊을까요?</h2>
          {leaveQuote && (
            <div className="connection-leave-quote">
              <span className="connection-leave-quote-name">{mate.name}</span>
              <p>{leaveQuote}</p>
            </div>
          )}
          {finishError && <FeedbackMessage tone="error" className="mt-4">{finishError}</FeedbackMessage>}
          {active.presenceKnown === false && (
            <p className="mt-3 text-muted">
              이전 자리 지킴 시간을 불러오지 못했어요. 지금 끝내면 이어서 연결한 동안의 자리 지킴만 기록돼요.
            </p>
          )}
          <div className="mt-6 flex justify-end gap-3">
            <Button
              variant="secondary"
              disabled={finishing}
              onClick={() => setLeaveOpen(false)}
              data-dialog-initial-focus
            >
              계속하기
            </Button>
            <Button
              variant="danger-solid"
              loading={finishing}
              onClick={() => { void finish(true) }}
            >
              연결 끊기
            </Button>
          </div>
        </div>
      </Dialog>
    </main>
  )
}
