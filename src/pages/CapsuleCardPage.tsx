import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { PageNavigation } from '@/app/PageNavigation'
import { useDemo } from '@/features/demo/demo-context'
import { getStudyRoom } from '@/features/rooms/services/room-service'
import { CharacterFigure } from '@/features/session/components/CharacterFigure'
import { downloadCard, exportCard } from '@/features/reports/export-card'
import { dateLabel, dayKey, duration } from '@/shared/lib/format'
import { Button } from '@/shared/ui/Button'
import { Badge } from '@/shared/ui/Badge'
import { cn } from '@/shared/lib/cn'
import { OverlayPage } from '@/shared/ui/OverlayPage'
import { DateTimeWheelField } from '@/shared/ui/DateTimeWheelField'
import NotFoundPage from './NotFoundPage'

const colors = ['#8051cc', '#17171c', '#f5f0ff', '#d8c5ff']
const names = ['보라', '검정', '연보라', '라벤더']

export default function CapsuleCardPage() {
  const { recordId } = useParams()
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
  const character = room.characters[0]!
  async function save(share = false) {
    if (busy) return
    setBusy(true)
    try {
      const blob = await exportCard(
        record!,
        room!.name,
        character.name,
        colors[color]!,
        character.id,
      )
      const file = new File([blob], 'capsule-study-card.png', { type: 'image/png' })
      if (share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: '오늘의 캡슐',
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
      <div
        className={cn('capsule-share-card', color > 1 && 'share-light')}
        style={{ background: colors[color] }}
      >
        <div className="flex items-center justify-between font-mono text-[13px]">
          <span className="font-bold tracking-[3px]">CAPSULE</span>
          <span>{dateLabel(record.endedAt)}</span>
        </div>
        <div className="share-portrait">
          <CharacterFigure variant="share" characterId={character.id} pose="affection" />
          <span className="absolute top-3.5 left-1/2 -translate-x-1/2 rounded-[14px] bg-panel/90 px-3 py-2 text-sm whitespace-nowrap text-white">
            다음엔 더 오래 버텨 봐.
          </span>
        </div>
        <p className="mt-4 text-[15px]">
          {room.name} · {character.name}과
        </p>
        <p className="mt-1 text-[64px] leading-[1.3] font-black">{duration(record.studySeconds)}</p>
        <p className="mt-2 font-bold">
          집중 {duration(record.focusSeconds)} · 복귀 {record.returns}회
        </p>
        <Badge dark className="mt-5 self-start">
          연속 5일째
        </Badge>
        <p className="mt-auto pt-6 text-xs">캡슐에서 같이 공부해요 · CAPSULE</p>
      </div>
      <section className="w-full max-w-[440px] rounded-3xl bg-panel p-7">
        <h1 className="text-[22px] font-bold">오늘의 캡슐 카드</h1>
        <p className="mt-2 text-sm text-muted">사진처럼 저장하거나 스토리에 올려 보세요</p>
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
            {busy ? '캐릭터와 배경을 합쳐 이미지를 만들고 있어요…' : status}
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
        <p className="mt-2 text-sm text-muted">
          등록한 약속은 모든 캐릭터가 함께 기억해요
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {['오늘', '내일', '모레'].map((label, index) => {
            const value = dayKey(todayTimestamp + index * 86400000)
            return (
              <button
                key={label}
                onClick={() => setDate(value)}
                className={cn(
                  'rounded-full border px-3.5 py-2 text-sm',
                  date === value ? 'border-brand bg-brand-solid text-white' : 'button-subtle border-transparent',
                )}
              >
                {label}
              </button>
            )
          })}
        </div>
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
          {date.slice(5)} {time} 약속하고 마치기
        </Button>
        <Link to="/" className="mt-3 inline-block text-sm text-muted underline">
          약속 없이 홈으로
        </Link>
      </section>
    </main>
  )
}
