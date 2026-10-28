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
import { CharacterArtwork } from '@/features/characters/components/CharacterArtwork'

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
      <Link to={`/characters/${character.id}`} className="mb-3 inline-block text-sm text-muted">
        ← {character.name}
      </Link>
      <PageHeading title={`${character.name}에게 선물 · 보이스`}>
        크레딧으로 보내요 · 선물로 호감도는 오르지 않아요. 호감도는 공부 시간으로만 쌓여요.
      </PageHeading>
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
                    selected.id === product.id ? 'border-2 border-brand' : 'border-transparent',
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
                    <span className="gift-product-icon flex size-14 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand">
                      <Icon name={product.kind === '보이스' ? 'headphones' : 'gift'} size={26} />
                    </span>
                    <div>
                      <Badge className="px-2 py-0 text-[10px]">{product.kind}</Badge>
                      <h2 className="mt-1 text-[15px] font-bold">{product.name}</h2>
                    </div>
                  </div>
                  <p className="pointer-events-none mt-3 min-h-8 text-xs leading-5 text-muted">
                    {product.id === 'name'
                      ? `“${state.profile.name}야, 같이 하자.”`
                      : product.description}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <strong className="font-mono text-sm">{number(product.price)} 크레딧</strong>
                    {product.kind === '보이스' && (
                      <button
                        onClick={() => setPreview(product.reply)}
                        className="button-subtle relative z-10 rounded-full border border-transparent px-2 py-1 text-[10px]"
                      >
                        ▶ 미리 듣기
                      </button>
                    )}
                  </div>
                </article>
              ))}
          </div>
        </div>
        <aside className="rounded-card bg-brand-soft p-5">
          <div className="gift-recipient">
            <CharacterArtwork characterId={character.id} pose="affection" variant="card" />
            <span>{character.name}에게 전하는 작은 마음</span>
          </div>
          <h2 className="text-[17px] font-bold">
            {selected.name} · {selected.kind}
          </h2>
          <p className="mt-3 flex justify-between gap-3 text-sm">
            <strong className="font-mono">{number(selected.price)} 크레딧</strong>
            <span className="text-xs text-muted">보유 {number(state.credits)}</span>
          </p>
          <Button
            disabled={state.credits < selected.price || !!sent}
            onClick={() => sendGift(now)}
            className="mt-3 w-full"
          >
            {number(selected.price)} 크레딧으로 보내기
          </Button>
          {state.credits < selected.price && (
            <p role="alert" className="mt-3 text-xs text-brand-strong">
              크레딧이 부족해요.{' '}
              <Link
                to={`/credits/charge?returnTo=${encodeURIComponent(`/characters/${character.id}/shop`)}`}
                className="underline"
              >
                충전하기 →
              </Link>
            </p>
          )}
          {sent && (
            <p role="status" className="mt-3 text-xs leading-5 text-brand-strong">
              {sent}
            </p>
          )}
          <hr className="my-4 border-brand-line" />
          <h3 className="text-sm font-bold">받은 보이스 · 보낸 선물</h3>
          <div className="mt-3 space-y-3">
            {inbox.length ? (
              inbox.map((gift) => (
                <div
                  key={gift.id}
                  className="flex flex-wrap items-center gap-2 rounded-[10px] bg-panel px-3 py-2.5 text-xs"
                >
                  <span className="text-[10px] text-subtle">{dateLabel(gift.at)}</span>
                  <span className="min-w-20 flex-1">{gift.name}</span>
                  <button
                    onClick={() => setPreview(gift.reply)}
                    className="text-[10px] font-bold text-brand-strong"
                  >
                    {gift.voice ? '▶ 다시 듣기' : '답장 보기'}
                  </button>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted">첫 선물을 보내 보세요.</p>
            )}
          </div>
        </aside>
      </div>
      <Dialog open={!!preview} onClose={() => setPreview('')} title="보이스 · 답장 미리보기">
        <p className="rounded-[16px] bg-surface p-5 text-lg leading-8">“{preview}”</p>
        <p className="mt-4 text-xs leading-5 text-subtle">
          데모에서는 대사를 텍스트로 미리 보여 드려요. 실제 보이스와 모션은 추후 연결돼요.
        </p>
      </Dialog>
    </>
  )
}
