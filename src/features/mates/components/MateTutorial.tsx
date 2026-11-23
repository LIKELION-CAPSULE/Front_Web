import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { Dialog } from '@/shared/ui/Dialog'
import { Button } from '@/shared/ui/Button'
import { Icon } from '@/shared/ui/Icon'
import { launchMates, type AvailableMate } from '../catalog'
import { chaerinArtwork, matePortrait } from '../artwork'
import '../mate-tutorial.css'

const steps = [
  { title: '메이트 고르기', text: '홈에서 메이트를 둘러보고, 마음에 드는 메이트를 골라요.' },
  { title: '연결하기', text: "'연결하기'를 누르면 메이트와 영상통화처럼 함께해요." },
  { title: '연결 기록', text: '연결 시간 · 함께한 시간(캠) · 나눈 대화 수' },
] as const

/** Final PRD H-3. Uses approved copy and illustrates currently connected features only. */
export function MateTutorial({ mates, onClose, onComplete }: { mates: readonly AvailableMate[]; onClose: () => void; onComplete: () => void }) {
  const [step, setStep] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)
  const focusHeading = useCallback(() => { heading.current?.focus({ preventScroll: true }) }, [])
  useLayoutEffect(focusHeading, [step, focusHeading])
  const current = steps[step]!
  const mate = mates[0] ?? launchMates[0]!
  const image = matePortrait(mate.id, mates[0]?.image)
  return (
    <Dialog open title="캡슐 사용법" onClose={onClose} onOpen={focusHeading} showHeader={false} className="mate-tutorial">
      <header className="mate-tutorial-header">
        <h2 className="type-dialog-title">캡슐 사용법</h2>
        <Button variant="ghost" size="sm" className="mate-tutorial-skip" onClick={onClose}>건너뛰기</Button>
      </header>
      <div className="mate-tutorial-body">
        <ol className="mate-tutorial-progress" aria-label="진행 단계">
          {steps.map((item, index) => (
            <li key={item.title} aria-current={index === step ? 'step' : undefined}>
              <span>{index + 1}</span>
              <span>{item.title}</span>
            </li>
          ))}
        </ol>
        <div className="mate-tutorial-art" aria-hidden="true">
          {step === 0 ? (
            <div className="mate-tutorial-mini-card">
              <div className="mate-tutorial-mini-titlebar">
                <span className="mate-card-status-dot mate-card-status-dot--online" />
                <span className="mate-tutorial-mini-name">{mate.name}</span>
                <span className="mate-tutorial-mini-badge">전연령</span>
              </div>
              <div className="mate-tutorial-mini-image">
                <img
                  src={chaerinArtwork.callBackground.landscape}
                  alt=""
                  aria-hidden="true"
                  className="mate-tutorial-mini-bg"
                  draggable={false}
                />
                {image ? (
                  <img src={image} width={800} height={600} alt="" className="mate-tutorial-mini-char" draggable={false} />
                ) : (
                  <Icon name="user" size={56} />
                )}
              </div>
            </div>
          ) : step === 1 ? (
            <>
              <div className="mate-tutorial-call">
                <span><Icon name="user" size={52} />메이트</span>
                <span><Icon name="camera" size={36} />나</span>
              </div>
              <div className="mate-tutorial-tools">
                <span>채팅</span>
                <span>카메라</span>
                <span>PIP로 띄우기</span>
              </div>
            </>
          ) : (
            <div className="mate-tutorial-record">
              <Icon name="chart" size={40} />
              <span>연결 기록</span>
              {['연결 시간', '함께한 시간(캠)', '나눈 대화 수'].map((label) => (
                <span key={label}>{label}<b>—</b></span>
              ))}
            </div>
          )}
        </div>
        <section className="mate-tutorial-copy" aria-live="polite" aria-atomic="true">
          <p>{step + 1}/3</p>
          <h3 ref={heading} tabIndex={-1}>{current.title}</h3>
          <p>{current.text}</p>
        </section>
        <footer className="mate-tutorial-actions">
          <Button variant="secondary" disabled={step === 0} onClick={() => setStep((value) => value - 1)}>이전</Button>
          <Button onClick={() => { if (step === steps.length - 1) onComplete(); else setStep((value) => value + 1) }}>
            {step === steps.length - 1 ? '메이트 만나러 가기' : '다음'}
          </Button>
        </footer>
      </div>
    </Dialog>
  )
}
