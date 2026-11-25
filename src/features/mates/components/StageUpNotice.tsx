import { useEffect, useState } from 'react'
import { normalizeAffinityStage } from '@/features/mates/affinity-stages'
import { worldOpenedAt, worldStageUpLine } from '@/features/mates/mate-worlds'
import { useMateWorldContent } from '@/features/mates/use-mate-worlds'
import type { StageUp } from '@/shared/api/types'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'

/** How long the notice stays (it also goes with its close button). */
const STAGE_UP_NOTICE_MS = 12_000

/**
 * 통화 중 친밀도 단계 상승 (21 heartbeat `stageUp`): one quiet card among the call's floating notices — the new level
 * and, with the world feature, the world it opened (「새 세계관이 열렸어요 · EP.03 도서관」; seen in 내 메이트 after the
 * call). Shown once per stage. The call's own background and outfit do not change (not decided).
 */
export function StageUpNotice({ stageUp, world, mateId, mateName }: {
  stageUp: StageUp | null
  world: boolean
  mateId: string
  mateName: string
}) {
  const stage = stageUp ? normalizeAffinityStage(stageUp.stage, stageUp.stageName) : null
  const samples = useMateWorldContent({ enabled: world, mateId, mateName })
  const [closed, setClosed] = useState<number | null>(null)
  const stageNumber = stage?.stage ?? null
  const open = stageNumber !== null && closed !== stageNumber
  useEffect(() => {
    if (!open || stageNumber === null) return
    const timer = window.setTimeout(() => setClosed(stageNumber), STAGE_UP_NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [open, stageNumber])
  if (!open || !stage) return null
  const opened = world ? worldOpenedAt(stage.stage, stageUp?.unlocked, samples ?? []) : null
  return (
    <div className="connection-notice-card connection-stage-up" data-stage={stage.stage}>
      <FeedbackMessage tone="success">
        <span className="connection-stage-up-copy">
          <strong>친밀도 Lv.{stage.stage} · {stage.stageName}</strong>
          {opened && <span>{worldStageUpLine(opened)}</span>}
        </span>
      </FeedbackMessage>
      <button type="button" className="connection-stage-up-close" aria-label="알림 닫기" onClick={() => setClosed(stage.stage)}>
        닫기
      </button>
    </div>
  )
}
