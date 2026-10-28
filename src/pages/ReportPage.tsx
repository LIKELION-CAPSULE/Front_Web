import { useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { useDemo } from '@/features/demo/demo-context'
import { getStudyRoom } from '@/features/rooms/services/room-service'
import { tierById } from '@/features/demo/catalog'
import { FocusTimeline } from '@/features/reports/components/FocusTimeline'
import { CompletionPortrait } from '@/features/reports/components/CompletionPortrait'
import { RelationshipGain } from '@/features/reports/components/RelationshipGain'
import { completionArtwork } from '@/features/reports/completion-artwork'
import { reportRelationship } from '@/features/reports/report-relationship'
import { dateLabel, duration, measuredDuration } from '@/shared/lib/format'
import { ButtonLink } from '@/shared/ui/Button'
import { OverlayPage } from '@/shared/ui/OverlayPage'
import { StatCard } from '@/shared/ui/Panel'
import { Tabs } from '@/shared/ui/Tabs'
import { Icon } from '@/shared/ui/Icon'
import NotFoundPage from './NotFoundPage'
import { ProgressRing } from '@/shared/ui/ProgressRing'
import { recordFocusPercent } from '@/features/session/focus'
import '@/features/reports/report-completion.css'

export default function ReportPage() {
  const { recordId } = useParams()
  const [params, setParams] = useSearchParams()
  const { state } = useDemo()
  const record = state.records.find(item => item.id === recordId)
  const room = record && getStudyRoom(record.roomId)
  const gains = useMemo(() => record ? Object.fromEntries(record.characterIds.map(id => [id, reportRelationship(state.records, record, id)])) : {}, [record, state.records])
  if (!record || !room) return <OverlayPage><NotFoundPage /></OverlayPage>
  const participants = room.characters.filter(character => record.characterIds.includes(character.id))
  const friends = participants.length ? participants : [room.characters[0]!]
  const character = friends.find(friend => friend.id === params.get('friend')) ?? friends[0]!
  const formatMeasuredTime = record.observedSeconds === undefined ? duration : measuredDuration
  const art = completionArtwork[character.id]
  return (
    <OverlayPage className="report-completion max-w-[1160px] p-6 sm:p-9">
      <div className="report-visual">
        <section className="report-character">
          <CompletionPortrait characterId={character.id} name={character.name} variant="report" />
        </section>
        {friends.length > 1 && <Tabs label="완료 이미지의 친구" options={friends.map(friend => ({ id: friend.id, label: friend.name }))} value={character.id} onChange={id => { const next = new URLSearchParams(params); next.set('friend', id); setParams(next, { replace: true }) }} size="sm" />}
        <p className="report-friend-quote"><strong>{character.name}</strong>{art?.quote ?? '오늘도 같이 공부해서 좋았어. 다음에도 함께하자.'}</p>
      </div>
      <div className="report-content">
        <div className="report-heading">
          <div><h1 className="text-page-title font-bold tracking-tight">공부를 마쳤어요</h1><p className="report-room-name">{room.name}</p></div>
          <div className="report-focus"><ProgressRing value={recordFocusPercent(record)} label="이번 공부 집중률" /><span>집중률</span></div>
        </div>
        <div className="report-session-meta">
          <span><Icon name="clock" size={14} /><time dateTime={new Date(record.endedAt).toISOString()}>{dateLabel(record.endedAt, true)} 완료</time></span>
          <span><Icon name="chat" size={14} />대화 옵션 · {tierById(record.tier).name}</span>
        </div>
        <p className="report-study-duration">함께 <strong>{formatMeasuredTime(record.studySeconds)}</strong> 공부했어요.</p>
        {record.targetSeconds && <p className="report-goal-result">목표 {duration(record.targetSeconds)} · {record.studySeconds >= record.targetSeconds ? '목표 달성' : `${Math.round(record.studySeconds / record.targetSeconds * 100)}% 공부했어요`}</p>}
        <div className="report-stats">
          <StatCard label="집중" value={formatMeasuredTime(record.focusSeconds)} dark size="compact" />
          <StatCard label={record.observedSeconds === undefined ? '딴짓' : '얼굴 미감지'} value={formatMeasuredTime(record.awaySeconds)} size="compact" />
          <StatCard label="복귀" value={`${record.returns}회`} size="compact" />
        </div>
        {record.observedSeconds === undefined && <FocusTimeline seconds={record.studySeconds} />}
        <div className="report-relationships" aria-label="이번 공부로 가까워진 시간">
          {friends.map(friend => gains[friend.id] && <RelationshipGain key={`${record.id}:${friend.id}`} name={friend.name} gain={gains[friend.id]!} />)}
        </div>
        <div className="report-actions"><ButtonLink to="/" variant="secondary">홈으로</ButtonLink><ButtonLink to={`/capsules/${record.id}?friend=${character.id}`}>캡슐 카드 만들기</ButtonLink></div>
      </div>
    </OverlayPage>
  )
}
