import { useParams } from 'react-router'
import { useDemo } from '@/features/demo/demo-context'
import { getStudyRoom } from '@/features/rooms/services/room-service'
import { tierById } from '@/features/demo/catalog'
import { relationship } from '@/features/demo/selectors'
import { CharacterFigure } from '@/features/session/components/CharacterFigure'
import { FocusTimeline } from '@/features/reports/components/FocusTimeline'
import { dateLabel, duration, measuredDuration } from '@/shared/lib/format'
import { Badge } from '@/shared/ui/Badge'
import { ButtonLink } from '@/shared/ui/Button'
import { OverlayPage } from '@/shared/ui/OverlayPage'
import { StatCard } from '@/shared/ui/Panel'
import NotFoundPage from './NotFoundPage'
import { ProgressRing } from '@/shared/ui/ProgressRing'
import { withParticle } from '@/shared/lib/korean'
import { focusMeasuredSeconds, recordFocusPercent } from '@/features/session/focus'

export default function ReportPage() {
  const { recordId } = useParams()
  const { state } = useDemo()
  const record = state.records.find((item) => item.id === recordId)
  const room = record && getStudyRoom(record.roomId)
  if (!record || !room)
    return (
      <OverlayPage>
        <NotFoundPage />
      </OverlayPage>
    )
  const character = room.characters[0]!
  const relation = relationship(state, character.id)
  const formatMeasuredTime = record.observedSeconds === undefined ? duration : measuredDuration
  return (
    <OverlayPage className="grid max-w-[1088px] gap-7 p-6 sm:p-9 lg:grid-cols-[300px_minmax(0,1fr)]">
      <section className="report-character">
        <div className="report-speech">
          <p className="text-[13px] font-bold text-brand">{character.name}</p>
          <p className="mt-1 text-[17px] leading-[26px]">
            야, 내일도 까먹지 말고 와라.
            <br />
            기다릴 거니까.
          </p>
        </div>
        <CharacterFigure variant="report" characterId={character.id} pose="affection" />
        <Badge dark className="absolute bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
          {character.name} · Lv.{relation.level} 친구
        </Badge>
      </section>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-[13px] tracking-[2px] text-brand">CAPSULE</p>
          <p className="text-xs text-muted">
            {room.name} · {dateLabel(record.endedAt, true)} · {tierById(record.tier).name}
          </p>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[40px] leading-[1.3] font-black">공부를 마쳤어요</h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted">
              이번 공부
              <br />
              집중률
            </span>
            <ProgressRing
              value={recordFocusPercent(record)}
              label="이번 공부 집중률"
            />
          </div>
        </div>
        <p className="mt-3 text-[15px] leading-6 text-muted">
          {withParticle(character.name, '과', '와')} {formatMeasuredTime(record.studySeconds)} 공부했어요.
        </p>
        {record.targetSeconds && (
          <p className="mt-2 text-sm text-brand-strong">
            목표 {duration(record.targetSeconds)} ·{' '}
            {record.studySeconds >= record.targetSeconds
              ? '목표 달성'
              : `${Math.round((record.studySeconds / record.targetSeconds) * 100)}% 공부했어요`}
          </p>
        )}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <StatCard
            label="집중"
            value={formatMeasuredTime(record.focusSeconds)}
            dark
            size="compact"
          />
          <StatCard
            label={record.observedSeconds === undefined ? '딴짓' : '얼굴 미감지'}
            value={formatMeasuredTime(record.awaySeconds)}
            size="compact"
          />
          <StatCard
            label="복귀"
            value={`${record.returns}회`}
            size="compact"
          />
        </div>
        {record.observedSeconds === undefined ? <FocusTimeline seconds={record.studySeconds} /> : (
          <p className="my-4 text-xs leading-6 text-muted">
            얼굴 감지로 측정한 {measuredDuration(focusMeasuredSeconds(record))} 기준
            {record.studySeconds > focusMeasuredSeconds(record) && ` · 측정하지 않은 시간 ${measuredDuration(record.studySeconds - focusMeasuredSeconds(record))}`}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[16px] bg-brand-soft px-[18px] py-3">
          <div>
            <p className="text-sm font-bold">
              {withParticle(character.name, '과의', '와의')} 호감도 +
              {Math.floor(record.studySeconds / 60 / record.characterIds.length)}
            </p>
            <p className="mt-1 text-xs text-muted">
              Lv.{relation.level} 친구 · {relation.level >= 5 ? '가장 가까운 친구가 되었어요' : `Lv.${relation.level + 1}까지 ${relation.next}분`}
            </p>
          </div>
          <div className="h-2.5 min-w-24 flex-1 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-brand-solid"
              style={{ width: `${Math.max(10, relation.progress)}%` }}
            />
          </div>
          <Badge className="bg-panel">새 대사 1개 열림</Badge>
        </div>
        {record.observedSeconds === undefined && <p className="mt-2 text-[10px] text-subtle">데모 집중 흐름·관계 변화 예시예요.</p>}
        <div className="mt-5 grid gap-3 sm:grid-cols-[2fr_4.7fr]">
          <ButtonLink to="/" variant="secondary">
            홈으로
          </ButtonLink>
          <ButtonLink to={`/capsules/${record.id}`}>
            캡슐 카드 만들기
          </ButtonLink>
        </div>
      </div>
    </OverlayPage>
  )
}
