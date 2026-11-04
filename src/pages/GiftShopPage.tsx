import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useDemo } from '@/features/demo/demo-context'
import { useNow } from '@/features/session/use-now'
import { products } from '@/features/demo/catalog'
import { getStudyRooms } from '@/features/rooms/services/room-service'
import { dateLabel, number } from '@/shared/lib/format'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { PageHeading } from '@/shared/ui/PageHeading'
import { Tabs } from '@/shared/ui/Tabs'
import { cn } from '@/shared/lib/cn'
import NotFoundPage from './NotFoundPage'
import { Icon } from '@/shared/ui/Icon'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { CharacterArtwork } from '@/features/characters/components/CharacterArtwork'
import { withParticle } from '@/shared/lib/korean'
import { studyLevel } from '@/features/demo/selectors'
import { affectionScore } from '@/features/characters/affection'
import { AffectionStatus } from '@/features/characters/components/AffectionStatus'
import { StudyLevelProgress } from '@/features/characters/components/StudyLevelProgress'

export default function GiftShopPage() {
  const { characterId } = useParams()
  const { state, dispatch } = useDemo()
  const now = useNow()
  const [filter, setFilter] = useState('전체')
  const [selection, setSelection] = useState('name')
  const [preview, setPreview] = useState('')
  const [sent, setSent] = useState('')
  const character = getStudyRooms()
    .flatMap((room) => room.characters)
    .find((item) => item.id === characterId)
  if (!character) return <NotFoundPage />
  const level = studyLevel(state, character.id)
  const selected = products.find((product) => product.id === selection)!
  const inbox = state.gifts.filter((gift) => gift.characterId === character.id)
  function sendGift(now: number) {
    if (selected.price > state.credits) return
    dispatch({
      type: 'GIFT',
      characterId: character!.id,
      characterName: character!.name,
      productId: selected.id,
      now,
    })
    setSent(`${selected.name}을 보냈어요. ${character!.name}의 답장이 도착했어요.`)
  }
  return (
    <>
      <Link to={`/characters/${character.id}`} className="mb-3 inline-flex items-center gap-2 text-body-compact text-muted">
        <Icon name="arrow" size={16} className="rotate-180" /> {character.name}
      </Link>
      <PageHeading title={`${character.name}에게 선물 · 보이스`} eyebrow={null} />
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,784fr)_minmax(300px,400fr)]">
        <div>
          <Tabs
            value={filter}
            onChange={setFilter}
            label="상품 분류"
            options={['전체', '보이스', '선물'].map((value) => ({ id: value, label: value }))}
          />
          <div className="mt-3 grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            {products
              .filter((product) => filter === '전체' || product.kind === filter)
              .map((product) => (
                <article
                  key={product.id}
                  className={cn(
                    'relative min-h-[170px] rounded-[16px] border bg-panel p-3.5',
                    selected.id === product.id ? 'border-2 border-text-accent' : 'border-transparent',
                  )}
                >
                  <button
                    type="button"
                    aria-label={`${product.name} 선택`}
                    aria-pressed={selected.id === product.id}
                    onClick={() => {
                      setSelection(product.id)
                      setSent('')
                    }}
                    className="absolute inset-0 rounded-[16px]"
                  />
                  <div className="pointer-events-none flex items-center gap-3">
                    <span className="gift-product-icon flex size-14 shrink-0 items-center justify-center rounded-control bg-primary-soft text-text-accent">
                      <Icon name={product.kind === '보이스' ? 'headphones' : 'gift'} size={26} />
                    </span>
                    <div>
                      <Badge className="px-2 py-0 text-caption">{product.kind}</Badge>
                      <h2 className="mt-1 type-card-title">{product.name}</h2>
                    </div>
                  </div>
                  <p className="pointer-events-none mt-3 min-h-8 type-body-compact text-muted">
                    {product.id === 'name'
                      ? `“${withParticle(state.profile.name, '아', '야')}, 같이 하자.”`
                      : product.description}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <strong className="font-sans tabular-nums text-body-compact">{number(product.price)} 크레딧</strong>
                    {product.kind === '보이스' && (
                      <button
                        onClick={() => setPreview(product.reply)}
                        className="button-subtle relative z-10 inline-flex items-center gap-1.5 rounded-full border border-transparent px-2 py-1 text-caption"
                      >
                        <Icon name="play" size={12} /> 미리 듣기
                      </button>
                    )}
                  </div>
                </article>
              ))}
          </div>
        </div>
        <aside className="rounded-card bg-primary-soft p-5">
          <div className="gift-recipient">
            <CharacterArtwork characterId={character.id} pose="affection" variant="card" />
          </div>
          <section className="mb-6" aria-label={`${character.name}의 레벨과 호감도`}>
            <h2 className="type-card-title">{character.name}</h2>
            <StudyLevelProgress level={level.level} next={level.next} progress={level.progress} />
            <div className="mt-4"><AffectionStatus name={character.name} score={affectionScore(state, character.id)} /></div>
          </section>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="min-w-0 type-card-title">
              {selected.name} · {selected.kind}
            </h2>
            <span className="shrink-0 text-caption whitespace-nowrap text-muted">보유 {number(state.credits)}</span>
          </div>
          <Button
            disabled={state.credits < selected.price || !!sent}
            onClick={() => sendGift(now)}
            className="mt-3 w-full"
          >
            {number(selected.price)} 크레딧으로 보내기
          </Button>
          {state.credits < selected.price && (
            <FeedbackMessage tone="warning" className="mt-3">
              크레딧이 부족해요.{' '}
              <Link
                to={`/credits/charge?returnTo=${encodeURIComponent(`/characters/${character.id}/shop`)}`}
                className="text-text-accent underline"
              >
                충전하기
              </Link>
            </FeedbackMessage>
          )}
          {sent && (
            <FeedbackMessage tone="success" className="mt-3">
              {sent}
            </FeedbackMessage>
          )}
          <hr className="my-4 border-focus-ring" />
          <h3 className="type-card-title">받은 보이스 · 보낸 선물</h3>
          <div className="mt-3 space-y-3">
            {inbox.length ? (
              inbox.map((gift) => (
                <div
                  key={gift.id}
                  className="flex flex-wrap items-center gap-2 rounded-[10px] bg-panel px-3 py-2.5 text-caption"
                >
                  <span className="text-caption text-subtle">{dateLabel(gift.at)}</span>
                  <span className="min-w-20 flex-1 type-body-compact">{gift.name}</span>
                  <button
                    onClick={() => setPreview(gift.reply)}
                    className="inline-flex items-center gap-1.5 text-caption font-bold text-text-accent"
                  >
                    {gift.voice ? <><Icon name="play" size={12} /> 다시 듣기</> : '답장 보기'}
                  </button>
                </div>
              ))
            ) : (
              <p className="text-caption text-muted">첫 선물을 보내 보세요.</p>
            )}
          </div>
        </aside>
      </div>
      <Dialog open={!!preview} onClose={() => setPreview('')} title="보이스 · 답장 미리보기">
        <p className="rounded-[16px] bg-surface p-5 type-body">“{preview}”</p>
        <p className="mt-4 text-caption leading-5 text-subtle">
          지금은 보이스와 답장을 글로 미리 볼 수 있어요.
        </p>
      </Dialog>
    </>
  )
}
