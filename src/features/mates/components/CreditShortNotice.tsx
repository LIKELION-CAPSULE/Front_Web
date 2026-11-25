import { Link } from 'react-router'
import { Button } from '@/shared/ui/Button'
import { Icon } from '@/shared/ui/Icon'
import { CREDIT_NOTICE_COPY } from '../credit-notice'
import '../reply-actions.css'
import { INVITE_PATH } from '@/features/credits/components/CreditsAppWindow'

/**
 * 고급 모드 short of credits (409 `CREDIT_INSUFFICIENT`), over the chat's composer: 「기본 모드로 계속」 switches the
 * connection to 기본 모드 and sends the same line again (the composer keeps it until it is sent); 「친구 초대로 받기」 opens
 * the invite screen.
 */
export function CreditShortNotice({ credits, busy, onBasic, onClose }: {
  credits: number | null
  busy: boolean
  onBasic: () => void
  onClose: () => void
}) {
  return (
    <div className="credit-short-notice" role="alert" data-credit-short>
      <div className="credit-short-notice-head">
        <p className="credit-short-notice-title">{CREDIT_NOTICE_COPY.title}</p>
        <button type="button" className="credit-short-notice-close" aria-label="닫기" onClick={onClose} disabled={busy}>
          <Icon name="close" size={14} />
        </button>
      </div>
      <p className="credit-short-notice-body">
        {CREDIT_NOTICE_COPY.body}
        {credits !== null && <span className="credit-short-notice-remaining"> {CREDIT_NOTICE_COPY.remaining(credits)}</span>}
      </p>
      <div className="credit-short-notice-actions">
        <Button size="sm" loading={busy} onClick={onBasic}>{CREDIT_NOTICE_COPY.basic}</Button>
        <Link to={INVITE_PATH} className="credit-short-notice-invite">{CREDIT_NOTICE_COPY.invite}</Link>
      </div>
    </div>
  )
}
