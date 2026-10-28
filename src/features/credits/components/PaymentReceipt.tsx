import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { chargeProducts } from '@/features/demo/catalog'
import { dayKey, number } from '@/shared/lib/format'
import { Icon } from '@/shared/ui/Icon'
import '../payment-receipt.css'

type ReceiptPhase = 'printing' | 'ready' | 'detached'

export function PaymentReceipt({
  product,
  method,
  balance,
  paidAt,
  expiresAt,
}: {
  product: (typeof chargeProducts)[number]
  method: string
  balance: number
  paidAt: number
  expiresAt?: number
}) {
  const [phase, setPhase] = useState<ReceiptPhase>(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'ready' : 'printing',
  )
  const [edition, setEdition] = useState(0)
  const [pull, setPull] = useState(0)
  const drag = useRef<{ pointer: number; y: number } | null>(null)
  useEffect(() => {
    if (phase !== 'printing') return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const timer = setTimeout(() => setPhase('ready'), media.matches ? 0 : 1800)
    const reduceMotion = () => { if (media.matches) setPhase('ready') }
    media.addEventListener('change', reduceMotion)
    return () => {
      clearTimeout(timer)
      media.removeEventListener('change', reduceMotion)
    }
  }, [phase])

  function detach() {
    drag.current = null
    setPull(0)
    setPhase('detached')
  }
  return (
    <div className="payment-receipt" data-phase={phase}>
      <div className="receipt-printer" aria-hidden="true">
        <span className="receipt-printer-light" />
        <span className="receipt-printer-slot" />
      </div>
      <div key={edition} className="receipt-output">
        <article
          className="receipt-paper"
          aria-label="결제 확인서"
          style={{ '--receipt-pull': `${pull}px` } as CSSProperties}
          onPointerDown={(event) => {
            if (phase !== 'ready' || event.button !== 0) return
            event.preventDefault()
            event.currentTarget.setPointerCapture(event.pointerId)
            drag.current = { pointer: event.pointerId, y: event.clientY }
          }}
          onPointerMove={(event) => {
            if (!drag.current || drag.current.pointer !== event.pointerId) return
            setPull(Math.min(100, Math.max(0, event.clientY - drag.current.y)))
          }}
          onPointerUp={(event) => {
            if (drag.current?.pointer !== event.pointerId) return
            if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
            drag.current = null
            if (pull >= 48) detach()
            else setPull(0)
          }}
          onPointerCancel={() => {
            drag.current = null
            setPull(0)
          }}
        >
          <div className="receipt-line receipt-heading">
            <strong>CAPSULE</strong>
            <Icon name="check" size={23} className="receipt-complete-symbol" />
            <span>결제 완료</span>
            <time dateTime={new Date(paidAt).toISOString()}>
              {new Intl.DateTimeFormat('ko-KR', {
                timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', hour12: false,
              }).format(paidAt)}
            </time>
          </div>
          <dl className="receipt-details">
            <div className="receipt-line"><dt>상품</dt><dd>{product.name}</dd></div>
            <div className="receipt-line"><dt>결제 수단</dt><dd>{method}</dd></div>
            {product.days ? (
              <div className="receipt-line"><dt>이용 기간</dt><dd>{product.days}일 · {expiresAt ? dayKey(expiresAt).replaceAll('-', '.') : ''}까지</dd></div>
            ) : (
              <>
                <div className="receipt-line"><dt>지급 크레딧</dt><dd>{number(product.credits + product.bonus)}</dd></div>
                {product.bonus > 0 && <div className="receipt-line"><dt>포함된 보너스</dt><dd>+{number(product.bonus)}</dd></div>}
              </>
            )}
            <div className="receipt-line receipt-total"><dt>결제 금액</dt><dd>{number(product.amount)}원</dd></div>
            <div className="receipt-line"><dt>보유 크레딧</dt><dd>{number(balance)}</dd></div>
          </dl>
        </article>
      </div>
      <div className="receipt-toolbar">
        <div>
          <button type="button" disabled={phase !== 'ready'} onClick={detach}>영수증 떼기</button>
          <button
            type="button"
            disabled={phase === 'printing'}
            onClick={() => {
              setPull(0)
              setEdition((current) => current + 1)
              setPhase(window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'ready' : 'printing')
            }}
          >
            다시 출력
          </button>
        </div>
      </div>
    </div>
  )
}
