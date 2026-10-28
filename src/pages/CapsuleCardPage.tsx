import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { PageNavigation } from '@/app/PageNavigation'
import { useDemo } from '@/features/demo/demo-context'
import { getStudyRoom } from '@/features/rooms/services/room-service'
import { CompletionPortrait } from '@/features/reports/components/CompletionPortrait'
import { CapsuleCardSurface } from '@/features/reports/components/CapsuleCardSurface'
import { RoomTitle } from '@/features/rooms/components/RoomTitle'
import { CapsuleCardBrand } from '@/features/reports/components/CapsuleCardBrand'
import { Tabs } from '@/shared/ui/Tabs'
import { downloadCard, exportCard } from '@/features/reports/export-card'
import { dateLabel, dayKey, duration, measuredDuration } from '@/shared/lib/format'
import { Button } from '@/shared/ui/Button'
import { Badge } from '@/shared/ui/Badge'
import { cn } from '@/shared/lib/cn'
import { OverlayPage } from '@/shared/ui/OverlayPage'
import { DateTimeWheelField } from '@/shared/ui/DateTimeWheelField'
import NotFoundPage from './NotFoundPage'
import { withParticle } from '@/shared/lib/korean'
import { capsuleCardCopy, capsuleFocusCopy } from '@/features/reports/card-copy'

const colors = ['#8051cc', '#17171c', '#f5f0ff', '#d8c5ff']
const names = ['보라', '검정', '연보라', '라벤더']

export default function CapsuleCardPage() {
  const { recordId } = useParams()
  const [params, setParams] = useSearchParams()
  const { state, dispatch } = useDemo()
  const navigate = useNavigate()
  const [todayTimestamp] = useState(Date.now)
  const [color, setColor] = useState(0)
  const [date, setDate] = useState(() => dayKey(Date.now() + 86400000))
  const [time, setTime] = useState('20:00')
  const [openField, setOpenField] = useState<'date' | 'time' | null>(null)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [copyFallback, setCopyFallback] = useState(false)
  const record = state.records.find((item) => item.id === recordId)
  const room = record && getStudyRoom(record.roomId)
  if (!record || !room)
    return (
      <OverlayPage>
        <NotFoundPage />
      </OverlayPage>
    )
  const participants = room.characters.filter(character => record.characterIds.includes(character.id))
  const friends = participants.length ? participants : [room.characters[0]!]
  const character = friends.find(friend => friend.id === params.get('friend')) ?? friends[0]!
  async function save(share = false) {
    if (busy) return
    setBusy(true)
    try {
      const blob = await exportCard(
        record!,
        character.name,
        colors[color]!,
        character.id,
      )
      const file = new File([blob], 'capsule-study-card.png', { type: 'image/png' })
      if (share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: '캡슐 카드',
          text: '오늘도 캡슐에서 같이 공부했어요.',
        })
        setStatus('공유 화면을 열었어요.')
      } else {
        downloadCard(blob)
        setStatus(
          share
            ? '이미지를 저장했어요. 원하는 스토리에 올려 주세요.'
            : '캡슐 카드 이미지를 저장했어요.',
        )
      }
    } catch (error) {
      setStatus(
        error instanceof DOMException && error.name === 'AbortError'
          ? '공유를 취소했어요.'
          : '이미지를 저장하지 못했어요. 다시 시도해 주세요.',
      )
    } finally {
      setBusy(false)
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setStatus('링크를 복사했어요. 데모 기록은 이 브라우저에서만 볼 수 있어요.')
    } catch {
      setCopyFallback(true)
      setStatus('아래 주소를 직접 복사해 주세요.')
    }
  }
  function promise() {
    dispatch({
      type: 'MEMORY',
      memory: {
        id: `promise-${record!.id}`,
        kind: '약속',
        title: '같이 공부하기',
        date,
        time,
      },
    })
    navigate('/')
  }
  return (
    <main id="main-content" tabIndex={-1} className="capsule-share-page">
      <PageNavigation />
      <CapsuleCardSurface color={colors[color]!} light={color > 1}>
        <div className="capsule-card-header">
          <CapsuleCardBrand />
          <span>{dateLabel(record.endedAt)}</span>
        </div>
        <div className="share-portrait">
          <CompletionPortrait characterId={character.id} name={character.name} variant="share" />
          <div className="capsule-room-title"><RoomTitle roomId={room.id} eager /></div>
        </div>
        <p className="mt-4 text-[15px]">
          {withParticle(character.name, '과', '와')} 함께한 공부
        </p>
        <p className="capsule-study-amount">{(record.observedSeconds === undefined ? duration : measuredDuration)(record.studySeconds)}</p>
        <p className="mt-2 font-bold">
          {capsuleFocusCopy(record)}
        </p>
        <Badge dark className="mt-5 self-start bg-[#17171c]">
          {capsuleCardCopy.badge}
        </Badge>
        <p className="mt-auto pt-6 text-xs">{capsuleCardCopy.quote}</p>
      </CapsuleCardSurface>
      <section className="w-full max-w-[440px] rounded-3xl bg-panel p-7">
        <h1 className="text-[22px] font-bold">캡슐 카드</h1>
        {friends.length > 1 && <div className="mt-4"><Tabs label="카드의 친구" options={friends.map(friend => ({ id: friend.id, label: friend.name }))} value={character.id} onChange={id => { const next = new URLSearchParams(params); next.set('friend', id); setParams(next, { replace: true }) }} size="sm" /></div>}
        <p className="mt-4 text-[13px] font-bold text-muted">카드 색 · {names[color]}</p>
        <div className="relative mt-2 h-[30px] w-[150px]">
          {colors.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`${names[index]} 카드`}
              aria-pressed={color === index}
              onClick={() => setColor(index)}
              className={cn(
                'absolute top-0 size-[30px] rounded-full',
                color === index && 'outline-2 outline-offset-2 outline-brand',
              )}
              style={{ left: index * 40, background: colors[index] }}
            />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => void save()}
          >
            이미지 저장
          </Button>
          <Button
            size="sm"
            disabled={busy}
            onClick={() => void save(true)}
          >
            스토리 공유
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void copy()}
          >
            링크 복사
          </Button>
        </div>
        {(busy || status) && (
          <p role="status" className="mt-3 text-xs leading-5 text-brand-strong">
            {busy ? '캡슐 카드를 만들고 있어요…' : status}
          </p>
        )}
        {copyFallback && (
          <input
            aria-label="공유 링크"
            readOnly
            value={window.location.href}
            onFocus={(event) => event.target.select()}
            className="form-input mt-2 text-xs"
          />
        )}
        <hr className="my-4 border-line" />
        <h2 className="text-section-title font-semibold">다음 공부 약속</h2>
        <div className="mt-3 space-y-3">
          <DateTimeWheelField
            label="날짜 선택"
            mode="date"
            value={date}
            min={dayKey(todayTimestamp)}
            onChange={setDate}
            open={openField === 'date'}
            onOpenChange={(open) => setOpenField(open ? 'date' : null)}
          />
          <DateTimeWheelField
            label="시간"
            mode="time"
            value={time}
            onChange={setTime}
            open={openField === 'time'}
            onOpenChange={(open) => setOpenField(open ? 'time' : null)}
          />
        </div>
        <Button
          disabled={!date || !time}
          onClick={promise}
          className="mt-4 w-full"
        >
          {date.slice(5)} {time} 약속 저장하기
        </Button>
        <Link to="/" className="mt-3 inline-block text-sm text-muted underline">
          저장하지 않고 홈으로
        </Link>
      </section>
    </main>
  )
}
