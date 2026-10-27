import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useDemo } from '@/features/demo/demo-context'
import { chargeProducts } from '@/features/demo/catalog'
import { dateLabel, number, safeReturnPath } from '@/shared/lib/format'
import { Badge } from '@/shared/ui/Badge'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { DemoNotice } from '@/shared/ui/DemoNotice'
import { PageHeading } from '@/shared/ui/PageHeading'
import { RadioOption } from '@/shared/ui/RadioOption'
import { cn } from '@/shared/lib/cn'

export default function ChargePage() {
  const { state, dispatch } = useDemo()
  const [params] = useSearchParams()
  const returnTo = safeReturnPath(params.get('returnTo'))
  const [now] = useState(Date.now)
  const [productId, setProductId] = useState('character-pass')
  const [method, setMethod] = useState('카드')
  const [agreed, setAgreed] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [success, setSuccess] = useState(false)
  const selected = chargeProducts.find((product) => product.id === productId)!
  const pass = !!selected.days
  function purchase() {
    dispatch({ type: 'PURCHASE', productId, method, now: Date.now() })
    setSuccess(true)
  }
  return (
    <>
      <Link to="/credits" className="mb-3 inline-block text-sm text-muted">
        ← 내 크레딧
      </Link>
      <PageHeading title="크레딧 충전 · 패스">
        공부는 무료예요. 크레딧은 쉬는 시간 대화를 더 하고 싶을 때만 써요.
      </PageHeading>
      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,780fr)_minmax(320px,408fr)]">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-bold">패스</h2>
            <Badge>자동 갱신 없음 · 웹 결제 우선</Badge>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {chargeProducts
              .filter((product) => product.days)
              .map((product) => (
                <button
                  key={product.id}
                  type="button"
                  aria-pressed={selected.id === product.id}
                  onClick={() => setProductId(product.id)}
                  className={cn(
                    'relative min-h-44 rounded-[16px] border p-[18px] text-left',
                    selected.id === product.id
                      ? 'border-2 border-brand bg-brand-soft'
                      : 'border-line',
                  )}
                >
                  <span className="flex items-start justify-between gap-2">
                    <strong>{product.name}</strong>
                    <strong className="text-xl whitespace-nowrap">
                      {number(product.amount)}원
                    </strong>
                  </span>
                  <span className="mt-1 block text-xs text-subtle">
                    {product.days === 14 ? '2주' : '30일'}
                  </span>
                  <span className="mt-3 block text-xs leading-6">
                    · 스탠다드 무제한
                    <br />· 프리미엄 하루 1회
                    <br />· {product.days === 14 ? 'D-day 응원 보이스' : '매일 보이스 메시지'}
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute right-4 bottom-4 size-[22px] rounded-full border-2',
                      selected.id === product.id ? 'border-brand bg-brand-solid' : 'border-line',
                    )}
                  />
                </button>
              ))}
          </div>
          <div className="mt-7 flex items-baseline gap-4">
            <h2 className="font-bold">크레딧 충전</h2>
            <p className="text-xs text-subtle">1크레딧 = 1원</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {chargeProducts
              .filter((product) => !product.days)
              .map((product) => (
                <button
                  key={product.id}
                  type="button"
                  aria-pressed={selected.id === product.id}
                  onClick={() => setProductId(product.id)}
                  className={cn(
                    'relative min-h-28 rounded-[16px] border p-4 text-left',
                    selected.id === product.id
                      ? 'border-2 border-brand bg-brand-soft'
                      : 'border-line',
                  )}
                >
                  <strong className="block font-mono text-[22px]">{number(product.credits)}</strong>
                  <span className="block text-xs text-subtle">크레딧</span>
                  <strong className="mt-2 block text-sm">{number(product.amount)}원</strong>
                  {product.bonus > 0 && (
                    <span className="mt-2 block text-[10px] text-brand-strong">
                      +5% 보너스 {number(product.bonus)}
                    </span>
                  )}
                </button>
              ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge className="border border-brand bg-panel">
              공부 옵션 · 스탠다드 200 · 프리미엄 500 · 스페셜 1,000
            </Badge>
            <Badge className="border border-brand bg-panel">
              보이스 메시지 · 선물 100~1,000 크레딧
            </Badge>
          </div>
          <p className="mt-3 text-[11px] leading-5 text-subtle">
            목표 시간은 시작할 때 직접 정해요 · 공부 중 딴짓 반응은 모든 등급 동일 · 결제로
            호감도·엔딩은 살 수 없음
          </p>
        </div>
        <aside className="rounded-card border border-line p-[22px]">
          <h2 className="text-lg font-bold">결제 정보</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">상품</dt>
              <dd className="text-right">
                {selected.name}
                {pass ? ` · ${selected.days}일` : ''}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">{pass ? '이용 기간' : '지급 크레딧'}</dt>
              <dd>
                {pass
                  ? `오늘 ~ ${dateLabel(Math.max(now, state.pass?.expiresAt ?? 0) + selected.days * 86400000)}`
                  : `${number(selected.credits + selected.bonus)} 크레딧`}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">결제 금액</dt>
              <dd className="text-lg font-bold">{number(selected.amount)}원</dd>
            </div>
          </dl>
          <h3 className="mt-4 mb-3 text-sm font-bold">결제 수단</h3>
          <div className="space-y-3">
            {['카드', '카카오페이', '토스페이'].map((value) => (
              <RadioOption
                key={value}
                name="payment"
                value={value}
                checked={method === value}
                onChange={() => setMethod(value)}
              >
                {value}
              </RadioOption>
            ))}
          </div>
          <label className="mt-4 flex items-center gap-2 text-xs leading-5">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              className="size-[18px] accent-brand"
            />
            구매 조건 · 환불 규정에 동의해요
          </label>
          <Button
            disabled={!agreed}
            onClick={() => {
              setConfirm(true)
              setSuccess(false)
            }}
            className="mt-4 min-h-12 w-full px-3 py-3 text-sm"
          >
            {number(selected.amount)}원 결제하기
          </Button>
          <p className="mt-3 text-[11px] leading-5 text-subtle">
            웹 결제 · 자동 갱신 없음
            <br />
            데모이므로 카드 정보를 입력하지 않아요.
          </p>
          <DemoNotice />
        </aside>
      </div>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={success ? '결제 완료 · 데모' : '데모 결제를 확인해 주세요'}
      >
        {success ? (
          <>
            <p className="text-sm leading-7">
              {selected.name}
              {pass ? '를 사용할 수 있어요.' : '이 지급되었어요.'}
              <br />
              보유 크레딧 <strong>{number(state.credits)}</strong>
            </p>
            <p className="mt-3 text-xs text-subtle">실제 청구가 발생하지 않았어요.</p>
            <ButtonLink to={returnTo} className="mt-5 w-full" onClick={() => setConfirm(false)}>
              이전 화면으로 돌아가기
            </ButtonLink>
            <Link
              to="/credits"
              onClick={() => setConfirm(false)}
              className="mt-3 block text-center text-sm text-brand-strong underline"
            >
              내 크레딧 확인
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm leading-7">
              {selected.name} · {number(selected.amount)}원<br />
              실제 결제 없이 더미 잔액 또는 패스만 업데이트해요.
            </p>
            <Button onClick={purchase} className="mt-5 w-full">
              데모 결제 확인
            </Button>
          </>
        )}
      </Dialog>
    </>
  )
}
