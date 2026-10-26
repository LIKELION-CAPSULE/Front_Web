import { useParams } from 'react-router'
import { useDemo } from '@/features/demo/demo-context'
import { getStudyRoom } from '@/features/rooms/services/room-service'
import { tierById } from '@/features/demo/catalog'
import { relationship } from '@/features/demo/selectors'
import { CharacterFigure } from '@/features/session/components/CharacterFigure'
import { FocusTimeline } from '@/features/reports/components/FocusTimeline'
import { dateLabel, duration } from '@/shared/lib/format'
import { Badge } from '@/shared/ui/Badge'
import { ButtonLink } from '@/shared/ui/Button'
import { OverlayPage } from '@/shared/ui/OverlayPage'
import { StatCard } from '@/shared/ui/Panel'
import NotFoundPage from './NotFoundPage'
import { ProgressRing } from '@/shared/ui/ProgressRing'

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
          <p className="font-mono text-[13px] tracking-[2px] text-brand">TODAY&apos;S CAPSULE</p>
          <p className="text-xs text-muted">
            {room.name} · {dateLabel(record.endedAt, true)} · {tierById(record.tier).name}
          </p>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[40px] leading-[1.3] font-black">
            {record.completed ? '1세트 완료' : '오늘의 공부 완료'}
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted">
              오늘의
              <br />
              집중률
            </span>
            <ProgressRing
              value={record.studySeconds ? (record.focusSeconds / record.studySeconds) * 100 : 0}
              label="오늘의 집중률"
            />
          </div>
        </div>
        <p className="mt-3 text-[15px] leading-6 text-muted">
          {duration(record.studySeconds)}의 공부를 {character.name}과 함께했어요.
        </p>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <StatCard
            label="집중"
            value={duration(record.focusSeconds)}
            dark
            className="px-3 sm:px-5 [&>p:last-child]:text-[22px] sm:[&>p:last-child]:text-[25px]"
          />
          <StatCard
            label="딴짓"
            value={duration(record.awaySeconds)}
            className="px-3 sm:px-5 [&>p:last-child]:text-[22px] sm:[&>p:last-child]:text-[25px]"
          />
          <StatCard
            label="복귀"
            value={`${record.returns}회`}
            className="px-3 sm:px-5 [&>p:last-child]:text-[22px] sm:[&>p:last-child]:text-[25px]"
          />
        </div>
        <FocusTimeline seconds={record.studySeconds} />
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[16px] bg-brand-soft px-[18px] py-3">
          <div>
            <p className="text-sm font-bold">
              {character.name}과 호감도 +
              {Math.floor(record.studySeconds / 60 / record.characterIds.length)}
            </p>
            <p className="mt-1 text-xs text-muted">
              Lv.{relation.level} 친구 · 다음 단계까지 {relation.next}분
            </p>
          </div>
          <div className="h-2.5 min-w-24 flex-1 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-brand-solid"
              style={{ width: `${Math.max(10, relation.progress)}%` }}
            />
          </div>
          <Badge className="border border-brand bg-panel">새 대사 1개 열림</Badge>
        </div>
        <p className="mt-2 text-[10px] text-subtle">데모 집중 흐름·관계 변화 예시예요.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-[2fr_4.7fr]">
          <ButtonLink to="/" variant="secondary" className="min-h-12 py-3 text-base">
            홈으로
          </ButtonLink>
          <ButtonLink to={`/capsules/${record.id}`} className="min-h-12 py-3 text-base">
            캡슐 카드 받기 →
          </ButtonLink>
        </div>
      </div>
    </OverlayPage>
  )
}
