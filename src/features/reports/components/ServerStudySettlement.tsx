import type { StudySettlement } from '@/shared/api/types'
import { AnimatedDuration } from '@/shared/ui/number-counter/AnimatedDuration'
import { NumberCounter } from '@/shared/ui/number-counter/NumberCounter'

export function ServerStudySettlement({ relation, studySeconds, name }: { relation: StudySettlement; studySeconds: number; name: string }) {
  return <section className="report-study-level-gain">
    <div className="report-gain-heading"><h3>{name} · 이번 공부</h3><strong>+<AnimatedDuration seconds={studySeconds} measured /></strong></div>
    <div className="report-gain-details">
      <span>공부 레벨 Lv.{relation.levelBefore ?? '—'} → Lv.{relation.levelAfter ?? '—'}</span>
      {relation.nextLevelSeconds !== undefined && <span>다음 레벨까지 <AnimatedDuration seconds={relation.nextLevelSeconds} measured /></span>}
    </div>
    {relation.levelUp && <p className="report-gain-celebration">레벨이 올랐어요!</p>}
    {relation.stageName && <p className="mt-2 text-muted">{relation.stageName}</p>}
    {relation.pointsAfter !== undefined && <p className="mt-2">호감도 <NumberCounter value={relation.pointsAfter} />{relation.pointsBefore !== undefined && <> <span className="text-muted">({relation.pointsAfter - relation.pointsBefore >= 0 ? '+' : ''}<NumberCounter value={relation.pointsAfter - relation.pointsBefore} />)</span></>}</p>}
  </section>
}
