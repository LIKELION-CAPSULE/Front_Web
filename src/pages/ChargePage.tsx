import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useDemo } from '@/features/demo/demo-context'
import { chargeProducts } from '@/features/demo/catalog'
import { dateLabel, number, safeReturnPath } from '@/shared/lib/format'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { AnimatedCheckbox } from '@/shared/ui/AnimatedCheckbox'
import { PageHeading } from '@/shared/ui/PageHeading'
import { RadioOption } from '@/shared/ui/RadioOption'
import { ChargeProductPicker, type ChargeProductKind } from '@/features/credits/components/ChargeProductPicker'
import { PaymentReceipt } from '@/features/credits/components/PaymentReceipt'
import '@/features/credits/charge-page.css'

type CheckoutStep = 'closed' | 'details' | 'success'

export default function ChargePage() {
  const { state, dispatch } = useDemo()
  const [params] = useSearchParams()
  const returnTo = safeReturnPath(params.get('returnTo'))
  const [now] = useState(Date.now)
  const [kind, setKind] = useState<ChargeProductKind>('pass')
  const [productId, setProductId] = useState('character-pass')
  const [method, setMethod] = useState('카드')
  const [agreed, setAgreed] = useState(false)
  const [checkout, setCheckout] = useState<CheckoutStep>('closed')
  const [paidAt, setPaidAt] = useState<number | null>(null)
  const selected = chargeProducts.find((product) => product.id === productId)!
  const pass = !!selected.days
  function openCheckout(id: string) {
    setProductId(id)
    setAgreed(false)
    setCheckout('details')
  }
  function closeCheckout() {
    setCheckout('closed')
  }
  function purchase() {
    if (checkout !== 'details' || !agreed) return
    const timestamp = Date.now()
    dispatch({ type: 'PURCHASE', productId, method, now: timestamp })
    setPaidAt(timestamp)
    setCheckout('success')
  }
  return (
    <div className="charge-page">
      <Link to="/credits" className="mb-3 inline-block text-sm text-muted">
        ← 내 크레딧
      </Link>
      <div className="charge-page-heading">
        <PageHeading title="크레딧 · 패스" eyebrow={null} />
      </div>
      <ChargeProductPicker
        kind={kind}
        onKindChange={setKind}
        onCheckout={openCheckout}
      />
      <Dialog
        open={checkout !== 'closed'}
        onClose={closeCheckout}
        title={checkout === 'success' ? '결제 완료' : '결제 정보'}
        className="charge-checkout-dialog max-w-[560px] bg-panel"
      >
        {checkout === 'details' && (
          <form
            className="charge-checkout"
            onSubmit={(event) => {
              event.preventDefault()
              purchase()
            }}
          >
            <div className="charge-checkout-summary">
              <dl className="space-y-3 text-sm">
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
            </div>
            <div className="charge-checkout-controls">
              <h3 className="mb-3 text-sm font-bold">결제 수단</h3>
              <div className="charge-payment-methods">
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
              <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-xs leading-5">
                <AnimatedCheckbox
                  checked={agreed}
                  onChange={(event) => setAgreed(event.target.checked)}
                />
                구매 조건 · 환불 규정에 동의해요
              </label>
              <Button
                type="submit"
                disabled={!agreed}
                className="mt-4 w-full"
              >
                {number(selected.amount)}원 결제하기
              </Button>
            </div>
          </form>
        )}
        {checkout === 'success' && (
          <>
            <PaymentReceipt
              product={selected}
              method={method}
              balance={state.credits}
              paidAt={paidAt ?? now}
              expiresAt={pass ? state.pass?.expiresAt : undefined}
            />
            <ButtonLink to={returnTo} className="mt-5 w-full" onClick={closeCheckout}>
              이전 화면으로 돌아가기
            </ButtonLink>
            <Link
              to="/credits"
              onClick={closeCheckout}
              className="mt-3 block text-center text-sm text-brand-strong underline"
            >
              내 크레딧 확인
            </Link>
          </>
        )}
      </Dialog>
    </div>
  )
}
