import { useCallback, useEffect, useRef, useState } from 'react'
import { useDemo } from '@/features/demo/demo-context'
import { useBackend } from '@/features/backend/backend-context'
import { mateCallBackground, mateHeroPortrait } from '@/features/mates/artwork'
import { getDefaultLineForState, reactionBubbleDurationMs } from '@/features/auth/login-backgrounds/desktop/mate-reactions'
import { mateLineForState } from '../mate-lines'
import { Button } from '@/shared/ui/Button'
import { Icon } from '@/shared/ui/Icon'
import { withParticle } from '@/shared/lib/korean'
import { mateByName, type AvailableMate } from '../catalog'
import { ConnectMateButton } from './ConnectMateButton'

export function MateWelcome({ mates, onExplore }: { mates: readonly AvailableMate[]; onExplore: () => void }) {
  const { state } = useDemo()
  const { activeSummary } = useBackend()
  const active = mates.find((mate) => state.activeSession?.characterIds.includes(mate.characterId))
  const last = active ?? mateByName(activeSummary?.characterName, mates) ?? mateByName(state.records.find((record) => record.serverReport)?.characterName, mates)
  const heroMate = last ?? mates[0] ?? null

  return <section className={`mate-welcome${heroMate ? '' : ' mate-welcome--empty'}`} aria-labelledby="mate-welcome-title">
    <img src={mateCallBackground(heroMate?.id).landscape} alt="" className="mate-welcome-bg-img" draggable={false} />
    <div className="mate-welcome-body">
      <div className="mate-welcome-copy">
        <h1 id="mate-welcome-title">
          {last ? `${withParticle(last.name, '이', '가')} 기다리고 있었어요` : <>노트북 앞의 시간,<br /><span>함께 보낼 메이트를 골라요</span></>}
        </h1>
        {last && <p>{state.profile.name}님, 오늘도 옆에 있을게요.</p>}
        <div className="mate-welcome-cta" data-tour={last ? 'connect' : undefined}>
          {last ? <ConnectMateButton mate={last} label="다시 연결하기" /> : <Button onClick={onExplore}>메이트 둘러보기 <Icon name="arrow" size={18} className="rotate-90" /></Button>}
        </div>
      </div>
      {heroMate && <HeroMateStage key={heroMate.id} mateId={heroMate.id} image={mateHeroPortrait(heroMate.id, heroMate.image)} />}
    </div>
  </section>
}

/** Home deliberately uses a still image. The backend model remains exclusive to connection/preview screens. */
function HeroMateStage({ mateId, image }: { mateId: string; image?: string }) {
  const [speechBubble, setSpeechBubble] = useState<string | null>(null)
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const showLine = useCallback((state: 'greet' | 'idleLong') => {
    const line = mateLineForState(mateId, state, getDefaultLineForState)
    if (!line) return
    clearTimeout(bubbleTimer.current)
    setSpeechBubble(line)
    bubbleTimer.current = setTimeout(() => setSpeechBubble(null), reactionBubbleDurationMs(line))
  }, [mateId])
  useEffect(() => {
    const greet = setTimeout(() => showLine('greet'), 650)
    let idle: ReturnType<typeof setTimeout>
    const resetIdle = () => {
      clearTimeout(idle)
      idle = setTimeout(() => showLine('idleLong'), 20_000)
    }
    resetIdle()
    window.addEventListener('pointermove', resetIdle, { passive: true })
    window.addEventListener('keydown', resetIdle, { passive: true })
    window.addEventListener('pointerdown', resetIdle, { passive: true })
    return () => {
      clearTimeout(greet)
      clearTimeout(idle)
      clearTimeout(bubbleTimer.current)
      window.removeEventListener('pointermove', resetIdle)
      window.removeEventListener('keydown', resetIdle)
      window.removeEventListener('pointerdown', resetIdle)
    }
  }, [showLine])

  return <div className="mate-welcome-stage" data-mate-mode="static">
    {image && <img src={image} width={760} height={900} alt="" className="mate-welcome-fallback-img" draggable={false} />}
    <div className="mate-welcome-bubble-slot" aria-live="polite" aria-atomic="true">
      {speechBubble && <p className="mate-welcome-bubble" role="status">{speechBubble}</p>}
    </div>
    <span className="mate-welcome-ai-label">AI 캐릭터</span>
  </div>
}
