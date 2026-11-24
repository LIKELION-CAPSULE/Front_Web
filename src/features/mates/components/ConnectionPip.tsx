import { createPortal } from 'react-dom'
import type { AvailableMate } from '../catalog'
import type { SessionModelStage } from '@/features/live2d/session-model'
import { Live2DFigure } from '@/features/live2d/components/Live2DFigure'
import { matePortrait } from '@/features/mates/artwork'
import { Button } from '@/shared/ui/Button'
import { Icon } from '@/shared/ui/Icon'
import '../connection-pip.css'

export function ConnectionPip({ target, mate, stage, speech, onReturn }: {
  target: Window; mate: AvailableMate; stage: SessionModelStage | null; speech?: string; onReturn: () => void
}) {
  return createPortal(<main className="connection-pip" aria-label={`${mate.name} 연결 중`}>
    <header><h1>{mate.name}</h1><span>AI 캐릭터</span><Button variant="ghost" size="sm" onClick={onReturn} aria-label="전체화면으로 돌아가기"><Icon name="expand" size={18} /></Button></header>
    <div className="connection-pip-mate">{stage ? <Live2DFigure stage={stage} /> : <img src={matePortrait(mate.id, mate.image)} width={800} height={600} alt="" />}</div>
    {speech && <p className="connection-pip-bubble" role="log" aria-live="polite">{speech}</p>}
    <footer><Button variant="secondary" disabled><Icon name="microphone" size={20} />누르고 말하기</Button></footer>
  </main>, target.document.body)
}
