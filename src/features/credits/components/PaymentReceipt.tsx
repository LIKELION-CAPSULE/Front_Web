import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { chargeProducts } from '@/features/demo/catalog'
import { dayKey, number } from '@/shared/lib/format'
import { Icon } from '@/shared/ui/Icon'
import { ReceiptPrinter } from './ReceiptPrinter'
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
  const outlet = useRef<HTMLDivElement>(null)
  const drag = useRef<{ pointer: number; start: number; distance: number; vertical: boolean } | null>(null)
  useEffect(() => {
    if (phase !== 'printing') return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const timer = setTimeout(() => setPhase('ready'), media.matches ? 0 : 2100)
    const reduceMotion = () => { if (media.matches) setPhase('ready') }
    media.addEventListener('change', reduceMotion)
    return () => {
      clearTimeout(timer)
      media.removeEventListener('change', reduceMotion)
    }
  }, [phase])

  function detach() {
    drag.current = null
    setPhase('detached')
  }
  return (
    <div className="payment-receipt" data-phase={phase}>
      <div className="receipt-stage">
        <ReceiptPrinter printing={phase === 'printing'} outletRef={outlet} />
        <div ref={outlet} className="receipt-output">
          <article
            key={edition}
            className="receipt-paper"
            aria-label="결제 확인서"
            aria-busy={phase === 'printing'}
            aria-hidden={phase === 'detached' || undefined}
            style={{ '--receipt-pull': `${pull}px` } as CSSProperties}
            onPointerDown={(event) => {
              if (phase !== 'ready' || event.button !== 0 || !event.isPrimary) return
              event.preventDefault()
              event.currentTarget.setPointerCapture(event.pointerId)
              const vertical = window.matchMedia('(max-width: 699px)').matches
              drag.current = { pointer: event.pointerId, start: vertical ? event.clientY : event.clientX, distance: 0, vertical }
            }}
            onPointerMove={(event) => {
              if (!drag.current || drag.current.pointer !== event.pointerId) return
              const position = drag.current.vertical ? event.clientY : event.clientX
              drag.current.distance = Math.min(100, Math.max(0, position - drag.current.start))
              setPull(drag.current.distance)
            }}
            onPointerUp={(event) => {
              if (drag.current?.pointer !== event.pointerId) return
              const distance = drag.current.distance
              drag.current = null
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
              if (distance >= 48) detach()
              else setPull(0)
            }}
            onPointerCancel={() => {
              drag.current = null
              setPull(0)
            }}
            onLostPointerCapture={() => {
              if (!drag.current) return
              drag.current = null
              setPull(0)
            }}
          >
            <div className="receipt-line receipt-heading">
              <div className="receipt-brand"><strong>CAPSULE</strong><span>함께할 시간을 더했어요</span></div>
              <span className="receipt-complete"><Icon name="check" size={16} /> 결제 완료</span>
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
            <p className="receipt-note">오늘의 몰입도, 차곡차곡.</p>
          </article>
        </div>
      </div>
      <div className="receipt-toolbar">
        <p role="status" className="receipt-status">
          {phase === 'printing' ? '함께할 시간을 영수증에 담고 있어요.' : phase === 'detached' ? '영수증을 떼었어요. 언제든 다시 출력할 수 있어요.' : '출력이 완료됐어요. 영수증을 당겨 떼어 보세요.'}
        </p>
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
