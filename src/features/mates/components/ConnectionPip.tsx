import { useEffect } from 'react'
import type React from 'react'
import { createPortal } from 'react-dom'
import type { AvailableMate } from '../catalog'
import type { SessionModelStage } from '@/features/live2d/session-model'
import { Live2DFigure } from '@/features/live2d/components/Live2DFigure'
import { matePortrait } from '@/features/mates/artwork'
import { PUSH_TO_TALK_TEXT } from '@/features/mates/push-to-talk'
import { Button } from '@/shared/ui/Button'
import { Icon } from '@/shared/ui/Icon'
import '../connection-pip.css'

/** 「누르고 말하기」 from the PIP window: the same recognizer as the call screen's dock (use-push-to-talk.ts). */
export type PipTalk = {
  supported: boolean
  listening: boolean
  text: string
  notice: string
  disabled: boolean
  start: () => void
  end: () => void
  /** The first-use notice is due: shown here while the PIP window is where the user talks. */
  privacy?: boolean
  onPrivacyShown?: () => void
  /** The heard sentence could not go out: 다시 보내기. */
  unsent?: boolean
  retry?: () => void
}

function PipPrivacy({ onShown }: { onShown?: () => void }) {
  useEffect(() => { onShown?.() }, [onShown])
  return <p className="connection-pip-stt connection-pip-privacy" role="note">{PUSH_TO_TALK_TEXT.privacy}</p>
}

export function ConnectionPip({ target, mate, stage, speech, talk, onTapMate, onReturn }: {
  target: Window; mate: AvailableMate; stage: SessionModelStage | null; speech?: string; talk?: PipTalk
  /** A tap on the mate (the same short reaction as on the call screen). */
  onTapMate?: () => void
  onReturn: () => void
}) {
  // A press ends with its owner letting go — and also when the focus leaves the button or the pointer is lost.
  const hold = talk && talk.supported && !talk.disabled
    ? {
      onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture?.(event.pointerId); talk.start() },
      onPointerUp: () => talk.end(),
      onPointerCancel: () => talk.end(),
      onLostPointerCapture: () => talk.end(),
      onBlur: () => talk.end(),
      onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => { if (event.key !== ' ' && event.key !== 'Enter') return; event.preventDefault(); if (!event.repeat) talk.start() },
      onKeyUp: (event: React.KeyboardEvent<HTMLButtonElement>) => { if (event.key !== ' ' && event.key !== 'Enter') return; event.preventDefault(); talk.end() },
    }
    : {}
  return createPortal(<main className="connection-pip" aria-label={`${mate.name} 연결 중`}>
    <header><h1>{mate.name}</h1><Button variant="ghost" size="sm" onClick={onReturn} aria-label="전체화면으로 돌아가기"><Icon name="expand" size={18} /></Button></header>
    <div className="connection-pip-mate" onClick={onTapMate} data-tappable={onTapMate ? true : undefined}>
      {stage ? <Live2DFigure stage={stage} /> : <img src={matePortrait(mate.id, mate.image)} width={800} height={600} alt="" />}
      {/* The keyboard's way to tap the mate, like the call screen's (shows on focus only). */}
      {onTapMate && <button type="button" className="connection-mate-pet" onClick={(event) => { event.stopPropagation(); onTapMate() }}>{mate.name} 쓰다듬기</button>}
    </div>
    {speech && <p className="connection-pip-bubble" role="log" aria-live="polite">{speech}</p>}
    {talk?.privacy && <PipPrivacy onShown={talk.onPrivacyShown} />}
    {talk && (talk.listening || talk.text || talk.notice) && <p className="connection-pip-stt" role="status">{talk.notice || talk.text || '듣는 중…'}</p>}
    {talk?.unsent && talk.retry && <p className="connection-pip-stt"><button type="button" className="connection-stt-retry" onClick={talk.retry}>다시 보내기</button></p>}
    <footer>
      <Button variant="secondary" disabled={!talk?.supported || talk.disabled} data-listening={talk?.listening || undefined}
        title={talk && !talk.supported ? '이 브라우저는 음성 입력을 지원하지 않아요. Chrome이나 Edge를 써 주세요' : undefined} {...hold}>
        <Icon name="microphone" size={20} />{talk?.listening ? '듣는 중' : '누르고 말하기'}
      </Button>
    </footer>
  </main>, target.document.body)
}
