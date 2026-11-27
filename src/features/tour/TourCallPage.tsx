import { useRef, useState } from 'react'
import { Navigate, useLocation, useParams } from 'react-router'
import { useBackend } from '@/features/backend/backend-context'
import { useDemo } from '@/features/demo/demo-context'
import { availableMates } from '@/features/mates/catalog'
import { CALL_STAGE_GRADIENT, mateCallBackground, matePortrait } from '@/features/mates/artwork'
import { mateLine, mateLineForState } from '@/features/mates/mate-lines'
import { getDefaultLineForState } from '@/features/auth/login-backgrounds/desktop/mate-reactions'
import { CREDIT_PRICING } from '@/features/credits/credit-utils'
import { useCreditDisplay } from '@/features/attendance/use-credit-display'
import { CharacterSpeechBubble } from '@/features/session/components/CharacterSpeechBubble'
import { ChatComposer } from '@/features/session/components/ChatComposer'
import { GlassDock, type GlassDockItem } from '@/shared/ui/dock/GlassDock'
import { AnimatedClock } from '@/shared/ui/AnimatedClock'
import { Icon } from '@/shared/ui/Icon'
import { Brand } from '@/shared/ui/Brand'
import { TALK_OPTIONS } from '@/features/mates/connection-preferences'
import { clock } from '@/shared/lib/format'
import { withParticle } from '@/shared/lib/korean'
import '@/features/auth/login-backgrounds/desktop/desktop.css'
import '@/features/mates/mates.css'
import '@/features/mates/connections.css'
import './service-tour.css'

const NOOP = () => {}
/** A fixed, made-up call time for the practice screen. */
const PRACTICE_SECONDS = 12 * 60 + 34

/**
 * Practice call screen for the service tour (`/tour/call/:mateId?tour=…`). Same look as the real call screen
 * (ConnectionPage: the same classes and shared parts — titlebar, stage, 「나」 tile, glass dock, chat), but with fake
 * state only: no session is created, no credits are used, no camera or microphone is requested, no PIP window opens and
 * no event, reaction or message API is called. Every control is inert (the tour keeps the app inert anyway).
 * The mate is the still portrait. Outside the tour the address leads home.
 */
export default function TourCallPage() {
  const { mateId } = useParams()
  const location = useLocation()
  const backend = useBackend()
  const { state } = useDemo()
  const [draft, setDraft] = useState('')
  const [bgFailed, setBgFailed] = useState(false)
  const stageWrapRef = useRef<HTMLDivElement>(null)
  // The call screen's 「남은 크레딧」 chip, from the same balance (use-credit-display.ts); nothing is asked for here.
  const credits = useCreditDisplay().value
  const mate = availableMates(backend.home).find((value) => value.id === mateId)
  if (!new URLSearchParams(location.search).get('tour') || !mate) return <Navigate to="/" replace />

  const greet = mateLineForState(mate.id, 'greet', getDefaultLineForState) ?? '왔네! 오늘도 같이 하자.'
  const second = mateLine(mate.id, 'cheer') ?? '좋아, 천천히 같이 해 보자.'
  const messages = [
    { id: 'practice-1', sender: 'character' as const, text: greet },
    { id: 'practice-2', sender: 'user' as const, text: '오늘은 영어 단어 외울 거야' },
    { id: 'practice-3', sender: 'character' as const, text: second },
  ]
  // The call screen's dock groups (ConnectionPage): 대화 | 기기 | 화면 | 끊기.
  const dockItems: GlassDockItem[] = [
    { group: '대화', key: 'microphone', label: '누르고 말하기', tooltip: '누르고 말하기', icon: 'microphone', onAction: NOOP },
    { group: '대화', key: 'chat', label: '채팅 닫기', tooltip: '채팅 닫기', icon: 'chat', pressed: true, expanded: true, controls: 'tour-call-chat', onAction: NOOP },
    // 「메이트 음성」 shown as on the call screen (off, its default); nothing is asked for here.
    { group: '대화', key: 'voice', label: '메이트 음성 켜기', tooltip: '메이트 음성 켜기', icon: 'headphones', pressed: false, onAction: NOOP },
    { group: '기기', key: 'camera', label: '카메라 켜기', tooltip: '카메라 켜기', icon: 'videoOff', device: true, onAction: NOOP },
    { group: '화면', key: 'pip', label: 'PIP로 띄우기', tooltip: 'PIP로 띄우기 · 작은 창으로 곁에 두기', icon: 'pip', secondary: true, onAction: NOOP },
    { group: '화면', key: 'fullscreen', label: '전체화면 전환', tooltip: '전체화면', icon: 'expand', secondary: true, onAction: NOOP },
    { group: '화면', key: 'settings', label: '설정', tooltip: '설정', icon: 'sliders', secondary: true, onAction: NOOP },
    { group: '끊기', key: 'leave', label: '연결 끊기', tooltip: '연결 끊기', icon: 'phoneOff', tone: 'danger', onAction: NOOP },
  ]

  return (
    <main id="main-content" tabIndex={-1} className="connection-page tour-call focus:outline-none" data-tour-practice>
      <p className="tour-call-badge" role="note">
        <Icon name="info" size={15} />
        연습 화면이에요 · 실제로 연결되지 않아요
      </p>
      <div className="connection-screen">
        <header className="desktop-window-titlebar mate-window-titlebar-static connection-titlebar">
          <div className="connection-titlebar-left">
            <span className="connection-titlebar-brand"><Brand /></span>
            <span className="connection-titlebar-divider" aria-hidden="true" />
            <span className="desktop-mate-dot" aria-hidden="true" />
            <h1>{mate.name}<span className="sr-only"> · 연결 중</span></h1>
          </div>
          <div className="connection-titlebar-center">
            <div className="connection-mode-segment" role="group" aria-label="대화 모드" data-tour="call-mode">
              <button type="button" className="connection-mode-option" data-active aria-pressed onClick={NOOP}>기본 · 크레딧 없음</button>
              <button type="button" className="connection-mode-option" aria-pressed={false} onClick={NOOP}>고급 · 1턴 {CREDIT_PRICING.advanced}</button>
            </div>
          </div>
          <div className="connection-titlebar-right">
            {credits !== null && (
              <span className="connection-titlebar-chip connection-credit-chip">
                <Icon name="coin" size={14} className="credit-coin" />
                <span className="connection-chip-caption">남은</span>
                <span className="connection-chip-value">{credits.toLocaleString('ko-KR')}</span>
              </span>
            )}
            <time className="connection-timer" aria-label="연결 시간">
              <AnimatedClock value={clock(PRACTICE_SECONDS)} />
            </time>
          </div>
        </header>

        <div className="connection-content" data-chat>
          <div ref={stageWrapRef} className="connection-stage-wrap">
            <div className="connection-stage" data-layout="mate">
              <div className="connection-talk" role="radiogroup" aria-label="말 걸기 빈도" data-tour="call-talk">
                <span className="connection-talk-label" aria-hidden="true"><Icon name="chat" size={13} />말 걸기</span>
                {TALK_OPTIONS.map((option) => (
                  <button key={option.value} type="button" role="radio" aria-checked={option.value === 'sometimes'} title={option.description} className="connection-talk-option" onClick={NOOP}>
                    {option.label}
                  </button>
                ))}
              </div>
              <section className="connection-mate" aria-label={mate.name} style={{ background: CALL_STAGE_GRADIENT }} data-tour="call-mate">
                {!bgFailed && (
                  <img src={mateCallBackground(mate.id).landscape} alt="" aria-hidden="true" className="connection-mate-bg-img" draggable={false} onError={() => setBgFailed(true)} />
                )}
                <div className="connection-mate-figure">
                  <img src={matePortrait(mate.id, mate.image)} width={800} height={600} alt="" className="connection-mate-fallback-img" />
                </div>
                <div className="connection-speech-slot">
                  <CharacterSpeechBubble name={mate.name} text={greet} expanded variant="pill" />
                </div>
              </section>
              {/* `call-self`: kept clear by 채린's line (tour subjects, ServiceTour avoidAround). */}
              <section className="connection-self desktop-window" aria-label="내 화면" data-tour="call-self">
                <div className="connection-self-titlebar">
                  <span className="connection-self-title">나</span>
                  <span className="connection-self-camera-state" aria-hidden="true">
                    <span className="connection-self-camera-dot" />
                    <Icon name="camera" size={12} />
                  </span>
                </div>
                <div className="connection-self-body">
                  <div className="connection-avatar">
                    {state.profile.profileImage ? <img src={state.profile.profileImage} alt="내 아바타" /> : <Icon name="user" size={32} />}
                  </div>
                </div>
              </section>
            </div>
            <div className="tour-call-dock" data-tour="call-dock">
              <GlassDock className="connection-controls" ariaLabel="연결 컨트롤" containerRef={stageWrapRef} items={dockItems} moreLabel="추가 도구" moreMenuLabel="추가 연결 도구" />
            </div>
          </div>

          <aside id="tour-call-chat" className="connection-chat desktop-window" aria-labelledby="tour-call-chat-title">
            <header className="desktop-window-titlebar mate-window-titlebar-static">
              <div className="desktop-window-title-left">
                <h2 id="tour-call-chat-title">{withParticle(mate.name, '과', '와')} 대화</h2>
              </div>
            </header>
            <div className="connection-messages" role="log" aria-label={`${withParticle(mate.name, '과', '와')} 대화`}>
              {messages.map((message) => (
                <article key={message.id} data-sender={message.sender}>
                  <small>{message.sender === 'user' ? state.profile.name : mate.name}</small>
                  <p>{message.text}</p>
                </article>
              ))}
            </div>
            <div data-tour="call-composer">
              {/* Sending does nothing here: the practice never reaches the message API. */}
              <ChatComposer name={mate.name} text={draft} onChange={setDraft} onSend={async () => false} sendDisabled />
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
