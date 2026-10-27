import type { PointerEvent } from 'react'
import { chargeProducts } from '@/features/demo/catalog'
import { number } from '@/shared/lib/format'
import { Icon } from '@/shared/ui/Icon'

export type ChargeProductKind = 'pass' | 'credits'

function moveBorderGlow(event: PointerEvent<HTMLElement>) {
  if (event.pointerType === 'touch') return
  const card = event.currentTarget
  const { left, top, width, height } = card.getBoundingClientRect()
  const x = event.clientX - left
  const y = event.clientY - top
  const edgeDistance = Math.min(x, y, width - x, height - y)
  const proximity = 1 - Math.min(1, Math.max(0, edgeDistance) / (Math.min(width, height) / 2))
  card.style.setProperty('--charge-glow-x', `${x}px`)
  card.style.setProperty('--charge-glow-y', `${y}px`)
  card.style.setProperty('--charge-glow-strength', String(0.3 + proximity * 0.7))
}

export function ChargeProductPicker({
  kind,
  onKindChange,
  onCheckout,
}: {
  kind: ChargeProductKind
  onKindChange: (kind: ChargeProductKind) => void
  onCheckout: (id: string) => void
}) {
  const products = chargeProducts.filter((product) => kind === 'pass' ? product.days > 0 : !product.days)
  return (
    <section className="charge-offers" aria-label="패스 · 크레딧 상품">
      <div className="charge-kind-toggle" role="group" aria-label="상품 종류">
        <button
          type="button"
          aria-pressed={kind === 'pass'}
          onClick={() => onKindChange('pass')}
        >
          패스
        </button>
        <button
          type="button"
          role="switch"
          className="charge-kind-switch"
          aria-label="크레딧 상품 보기"
          aria-checked={kind === 'credits'}
          onClick={() => onKindChange(kind === 'pass' ? 'credits' : 'pass')}
        >
          <span aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-pressed={kind === 'credits'}
          onClick={() => onKindChange('credits')}
        >
          크레딧
        </button>
      </div>
      <div key={kind} className="charge-product-grid" data-kind={kind}>
        {products.map((product) => {
          const popular = product.id === 'charge-19900' || product.id === 'character-pass'
          const features = product.days
            ? [
                '스탠다드 무제한',
                '프리미엄 하루 1회',
                product.days === 14 ? 'D-day 응원 보이스' : '매일 보이스 메시지',
              ]
            : []
          return (
            <article
              key={product.id}
              className="charge-product-card"
              data-popular={popular || undefined}
              onPointerEnter={moveBorderGlow}
              onPointerMove={moveBorderGlow}
            >
              {popular && (
                <span className="charge-card-hologram" aria-hidden="true">
                  {Array.from({ length: 5 }, (_, index) => <i key={index} />)}
                </span>
              )}
              <div className="charge-product-card-heading">
                <h2>{product.name}</h2>
              </div>
              {!!(product.days || product.bonus) && (
                <p className="charge-product-period">
                  {product.days
                    ? `${product.days}일 이용권`
                    : `+5%(${number(product.bonus)}) 보너스`}
                </p>
              )}
              <p className="charge-product-price">
                <strong>{number(product.amount)}</strong><span>원</span>
              </p>
              <button
                type="button"
                className="charge-product-pay"
                aria-label={`${product.name} 결제하기`}
                aria-haspopup="dialog"
                onClick={() => onCheckout(product.id)}
              >
                결제하기
              </button>
              {features.length > 0 && (
                <ul className="charge-product-features">
                  {features.map((feature) => (
                    <li key={feature}><Icon name="check" size={15} /><span>{feature}</span></li>
                  ))}
                </ul>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
