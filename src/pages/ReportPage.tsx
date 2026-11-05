import { useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { useDemo } from '@/features/demo/demo-context'
import { PageNavigation } from '@/app/PageNavigation'
import { getStudyRoom } from '@/features/rooms/services/room-service'
import { CompletionPortrait } from '@/features/reports/components/CompletionPortrait'
import { CompletionQuote } from '@/features/reports/components/CompletionQuote'
import { StudyLevelGain } from '@/features/reports/components/StudyLevelGain'
import { getCompletionArtwork } from '@/features/reports/completion-artwork'
import { reportStudyLevel } from '@/features/reports/report-study-level'
import { AffectionStatus } from '@/features/characters/components/AffectionStatus'
import { affectionScore } from '@/features/characters/affection'
import { dateLabel } from '@/shared/lib/format'
import { NumberCounter } from '@/shared/ui/number-counter/NumberCounter'
import { AnimatedDuration } from '@/shared/ui/number-counter/AnimatedDuration'
import { ButtonLink } from '@/shared/ui/Button'
import { OverlayPage } from '@/shared/ui/OverlayPage'
import { Tabs } from '@/shared/ui/Tabs'
import { Icon } from '@/shared/ui/Icon'
import { useServerReport } from '@/features/backend/use-server-report'
import { PageSkeleton } from '@/shared/ui/PageSkeleton'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { Button } from '@/shared/ui/Button'
import { ServerStudySettlement } from '@/features/reports/components/ServerStudySettlement'
import { ProgressRing } from '@/shared/ui/ProgressRing'
import { recordFocusPercent } from '@/features/session/focus'
import '@/features/reports/report-completion.css'
import { isMvpCharacter, isMvpRoom } from '@/features/mvp/policy'
import MvpUnavailablePage from './MvpUnavailablePage'

export default function ReportPage() {
  const { recordId } = useParams()
  const [params, setParams] = useSearchParams()
  const { state } = useDemo()
  const { record, error, retry } = useServerReport(recordId)
  const room = record && getStudyRoom(record.roomId)
  const gains = useMemo(() => record ? Object.fromEntries(record.characterIds.map(id => [id, reportStudyLevel(state.records, record, id)])) : {}, [record, state.records])
  if (!record || !room) return error ? <OverlayPage><FeedbackMessage tone="error">{error}</FeedbackMessage><Button onClick={retry}>다시 시도</Button></OverlayPage> : <PageSkeleton screen="report" />
  if (!room.serverRoom && !isMvpRoom(room.id)) return <OverlayPage><MvpUnavailablePage /></OverlayPage>
  const participants = room.characters.filter(character => (character.serverCharacter || isMvpCharacter(character.id)) && record.characterIds.includes(character.id))
  const friends = participants.length ? participants : [room.characters[0]!]
  const character = friends.find(friend => friend.id === params.get('friend')) ?? friends[0]!
  const measured = !!record.serverReport || record.observedSeconds !== undefined
  const focusPercent = recordFocusPercent(record)
  const art = getCompletionArtwork(character.artworkId ?? character.id, character.name)
  return (
    <main id="main-content" tabIndex={-1} className="report-scene focus:outline-none">
      <PageNavigation />
      <div className="report-scene-art">
        {/* Friends without a layered completion scene fill the screen with their completion image instead. */}
        {art?.backgroundSrc
          ? <img src={art.backgroundSrc} alt="" width={1672} height={941} decoding="async" fetchPriority="high" />
          : <CompletionPortrait characterId={character.artworkId ?? character.id} name={character.name} variant="report" />}
      </div>
      <div className="report-layout">
        <div className="report-companion">
          <div className="report-character-art">
            {art?.backgroundSrc && art.foregroundSrc && <img src={art.foregroundSrc} alt={`${character.name}의 밝게 웃는 공부 완료 모습`} width={1024} height={1536} decoding="async" fetchPriority="high" />}
          </div>
          <section className="report-dialogue report-glass" aria-label={`${character.name}의 한마디`}>
            {friends.length > 1 && <Tabs label="완료 이미지의 친구" options={friends.map(friend => ({ id: friend.id, label: friend.name }))} value={character.id} onChange={id => { const next = new URLSearchParams(params); next.set('friend', id); setParams(next, { replace: true }) }} size="sm" />}
            <p className="report-friend-name">{character.name}</p>
            <CompletionQuote id={`report-${record.id}-${character.id}`} text={record.serverReport ? record.serverReport.closingLine ?? '' : art?.quote ?? ''} />
          </section>
        </div>
        <section className="report-content report-glass" aria-labelledby="report-title">
          <header className="report-overview">
            <div className="report-summary">
              <h1 id="report-title" className="type-page-title">공부를 마쳤어요</h1>
              <p className="report-study-duration">함께 <strong><AnimatedDuration seconds={record.studySeconds} measured={measured} /></strong> 공부했어요.</p>
              {record.targetSeconds && <p className="report-goal-result">목표 <AnimatedDuration seconds={record.targetSeconds} /> · {record.studySeconds >= record.targetSeconds ? '목표 달성' : <><NumberCounter value={Math.round(record.studySeconds / record.targetSeconds * 100)} />% 공부했어요</>}</p>}
            </div>
            <div className="report-context">
              <p className="report-room-name">{room.name}</p>
              <div className="report-session-meta">
                {/* Conversation options can join this row when they return after MVP. */}
                <span><Icon name="clock" size={14} /><time dateTime={new Date(record.endedAt).toISOString()}>{dateLabel(record.endedAt, true)} 완료</time></span>
              </div>
              <div className="report-focus"><ProgressRing value={focusPercent} label="이번 공부 자리 지킴률"><strong>{focusPercent === null ? '—' : <><NumberCounter value={focusPercent} format={{ maximumFractionDigits: 1 }} /><small>%</small></>}</strong></ProgressRing><span>자리 지킴률</span></div>
            </div>
          </header>
          <dl className="report-stats">
            <div><dt>자리 지킴</dt><dd><AnimatedDuration seconds={record.focusSeconds} measured={measured} /></dd></div>
            <div><dt>자리 비움</dt><dd><AnimatedDuration seconds={record.awaySeconds} measured={measured} /></dd></div>
            <div><dt>복귀</dt><dd><NumberCounter value={record.returns} />회</dd></div>
          </dl>
          <div className="report-levels" aria-label="이번 공부의 레벨 진행">
            {record.serverReport ? record.serverReport.relation && <ServerStudySettlement relation={record.serverReport.relation} studySeconds={record.studySeconds} name={character.name} /> : friends.map(friend => gains[friend.id] && <StudyLevelGain key={`${record.id}:${friend.id}`} name={friend.name} gain={gains[friend.id]!} />)}
          </div>
          {!record.serverReport && <div className="report-affection">
            {friends.map(friend => <AffectionStatus key={friend.id} name={friend.name} score={affectionScore(state, friend.id)} current animate />)}
          </div>}
          <div className="report-actions"><ButtonLink to="/" variant="secondary">홈으로</ButtonLink><ButtonLink to={`/capsules/${record.id}?friend=${character.id}`} state={{ capsuleIntro: true }} className="report-capsule-cta"><span>캡슐 카드 만들기</span></ButtonLink></div>
        </section>
      </div>
    </main>
  )
}
