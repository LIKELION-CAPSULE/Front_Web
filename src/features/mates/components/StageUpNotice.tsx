import { useEffect, useState } from 'react'
import { affinityStageLabel, normalizeAffinityStage } from '@/features/mates/affinity-stages'
import { worldOpenedAt, worldStageUpLine } from '@/features/mates/mate-worlds'
import { useMateWorldContent } from '@/features/mates/use-mate-worlds'
import type { StageUp } from '@/shared/api/types'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { PixelImage } from '@/shared/ui/pixel/PixelFrame'

/** How long the notice stays (it also goes with its close button). */
const STAGE_UP_NOTICE_MS = 12_000

/**
 * 통화 중 친밀도 단계 상승 (21 heartbeat `stageUp`): one quiet card among the call's floating notices — the new stage
 * (「친밀도 3단계 · 친구」, the words every other screen uses; the titlebar chip moves to it at once) and, with the
 * world feature, the world it opened (「새 세계관이 열렸어요 · EP.03 도서관」; seen in 내 메이트 after the call).
 * Shown once per stage. The call's own background and outfit do not change (not decided).
 *
 * `inLog` (the chat is open, 2026-11-28): the chat log carries the same news as its own line (`StageUpLine`), so the
 * card draws nothing — its timer still runs, so closing the chat a while later does not bring an old card back.
 */
export function StageUpNotice({ stageUp, world, mateId, mateName, inLog = false }: {
  stageUp: StageUp | null
  world: boolean
  mateId: string
  mateName: string
  inLog?: boolean
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
  if (!open || !stage || inLog) return null
  const opened = world ? worldOpenedAt(stage.stage, stageUp?.unlocked, samples ?? []) : null
  return (
    <div className="connection-notice-card connection-stage-up" data-stage={stage.stage}>
      <FeedbackMessage tone="success">
        <span className="connection-stage-up-copy">
          <strong>친밀도 {affinityStageLabel(stage.stage, stage.stageName)}</strong>
          {opened && <span>{worldStageUpLine(opened)}</span>}
        </span>
      </FeedbackMessage>
      <button type="button" className="connection-stage-up-close" aria-label="알림 닫기" onClick={() => setClosed(stage.stage)}>
        닫기
      </button>
    </div>
  )
}

/**
 * The stage-up line in the call's chat log (P1 「픽셀 대화 기록」 + P2's system line, 2026-11-28): 「♡ 친밀도가
 * 올랐어요 · 3단계 친구」 in the affection pink on a round pill with the pixel heart, and the world it opened under it (world feature).
 * Logged where the stage-up arrived (21 heartbeat `stageUp`); this browser's line, not the server's history.
 */
export function StageUpLine({ stage, stageName, unlocked, world, mateId, mateName }: {
  stage: number
  stageName: string
  unlocked?: StageUp['unlocked']
  world: boolean
  mateId: string
  mateName: string
}) {
  const samples = useMateWorldContent({ enabled: world, mateId, mateName })
  const opened = world ? worldOpenedAt(stage, unlocked, samples ?? []) : null
  return (
    <p className="chat-log-stage-up">
      <span className="chat-log-stage-up-main">
        <PixelImage name="heart" scale={2} />
        <span>친밀도가 올랐어요 · <strong>{stage}단계 {stageName}</strong></span>
      </span>
      {opened && <span className="chat-log-stage-up-world">{worldStageUpLine(opened)}</span>}
    </p>
  )
}
