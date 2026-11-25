import { useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { rateMessage, reportMessage } from '@/features/backend/server-api'
import { api, ApiError } from '@/shared/api/client'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import {
  markReplyReported, nextRating, REPORT_DETAIL_MAX, REPORT_REASONS, reportRequest, setReplyRating,
  type ReplyRating, type ReportReason,
} from '../chat-room'
import '../reply-actions.css'

export const REPLY_ACTIONS_COPY = {
  up: '좋았어요',
  down: '아쉬웠어요',
  report: '신고',
  reportTitle: '이 답장을 신고할까요?',
  reportLead: '신고한 답장은 대화 기록에서 빠지고, 운영팀이 확인해요.',
  detailLabel: '자세한 내용',
  detailPlaceholder: '어떤 점이 문제였는지 적어 주세요.',
  submit: '신고하기',
  cancel: '취소',
  reported: '신고한 답장이에요.',
  show: '내용 보기',
  hide: '접기',
  alreadyReported: '이미 신고한 답장이에요.',
  rateFailed: '평가를 저장하지 못했어요.',
} as const

function Thumb({ down = false }: { down?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" style={down ? { transform: 'rotate(180deg)' } : undefined}>
      <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        d="M7 10v10H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3zm0 0 4-7a2 2 0 0 1 2.9 2.2L13 9h5.3a2 2 0 0 1 2 2.4l-1.4 7A2 2 0 0 1 17 20H7" />
    </svg>
  )
}

/**
 * A mate's reply in the call screen's chat: 👍 / 👎 (40, the same again cancels) and 「신고」 (41) — shown on hover and
 * keyboard focus of the reply (reply-actions.css), so the conversation stays clean. Not in the PIP window.
 */
export function ReplyActions({ userId, characterId, requestId, rating }: {
  userId: number
  characterId: string
  requestId: string
  rating: ReplyRating
}) {
  const [error, setError] = useState('')
  const [reportOpen, setReportOpen] = useState(false)
  const busy = useRef(false)

  async function rate(chosen: 'UP' | 'DOWN') {
    if (busy.current) return
    const next = nextRating(rating, chosen)
    busy.current = true
    setError('')
    setReplyRating(userId, characterId, requestId, next)
    try {
      await rateMessage(api, requestId, next)
    } catch {
      setReplyRating(userId, characterId, requestId, rating)
      setError(REPLY_ACTIONS_COPY.rateFailed)
    } finally { busy.current = false }
  }

  return (
    <div className="reply-actions" data-reply-actions>
      <button type="button" className="reply-action" aria-pressed={rating === 'UP'} aria-label={REPLY_ACTIONS_COPY.up} onClick={() => void rate('UP')}>
        <Thumb />
      </button>
      <button type="button" className="reply-action" aria-pressed={rating === 'DOWN'} aria-label={REPLY_ACTIONS_COPY.down} onClick={() => void rate('DOWN')}>
        <Thumb down />
      </button>
      <button type="button" className="reply-action reply-action--text" onClick={() => setReportOpen(true)}>{REPLY_ACTIONS_COPY.report}</button>
      {error && <span className="reply-action-error" role="status">{error}</span>}
      {/* Outside the chat's message (whose bubble styles would reach it). */}
      {reportOpen && createPortal(
        <ReportDialog userId={userId} characterId={characterId} requestId={requestId} onClose={() => setReportOpen(false)} />,
        document.body,
      )}
    </div>
  )
}

function ReportDialog({ userId, characterId, requestId, onClose }: { userId: number; characterId: string; requestId: string; onClose: () => void }) {
  const id = useId()
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [detail, setDetail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  // 「신고하기」 stays disabled until the report can be sent: a reason picked, and for 「기타」 the details written
  // (UX review 4-2: no live red button that only answers with an error).
  const ready = reportRequest(reason, detail).ok

  async function submit() {
    const request = reportRequest(reason, detail)
    if (!request.ok) { setError(request.message); return }
    if (pending.current) return
    pending.current = true
    setBusy(true); setError('')
    try {
      await reportMessage(api, requestId, request.body)
      markReplyReported(userId, characterId, requestId)
      onClose()
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === 'ALREADY_REPORTED') {
        markReplyReported(userId, characterId, requestId)
        onClose()
        return
      }
      setError(reason instanceof Error && reason.message ? reason.message : '신고하지 못했어요. 다시 시도해 주세요.')
    } finally { pending.current = false; setBusy(false) }
  }

  return (
    // 「취소」 is the way back (Esc and the backdrop do the same), so no X in the header (2026-11-26).
    <Dialog open title={REPLY_ACTIONS_COPY.reportTitle} tone="danger" onClose={onClose} dismissible={!busy} showCloseButton={false} className="reply-report-dialog">
      <form noValidate onSubmit={event => { event.preventDefault(); void submit() }}>
        <p className="text-body-compact text-muted">{REPLY_ACTIONS_COPY.reportLead}</p>
        <fieldset className="reply-report-reasons" disabled={busy}>
          <legend className="sr-only">신고 사유</legend>
          {REPORT_REASONS.map(item => (
            <label key={item.value} className="reply-report-reason" data-checked={reason === item.value || undefined}>
              <input type="radio" name={`${id}-reason`} value={item.value} checked={reason === item.value} onChange={() => { setReason(item.value); setError('') }} />
              <span>{item.label}</span>
            </label>
          ))}
        </fieldset>
        {reason === 'OTHER' && (
          <label className="reply-report-detail">
            <span className="field-label">{REPLY_ACTIONS_COPY.detailLabel}</span>
            <textarea
              className="form-input"
              rows={3}
              maxLength={REPORT_DETAIL_MAX}
              value={detail}
              placeholder={REPLY_ACTIONS_COPY.detailPlaceholder}
              readOnly={busy}
              onChange={event => { setDetail(event.target.value); setError('') }}
            />
            <span className="reply-report-count">{detail.length}/{REPORT_DETAIL_MAX}</span>
          </label>
        )}
        {error && <FeedbackMessage tone="error" className="mt-3">{error}</FeedbackMessage>}
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" disabled={busy} onClick={onClose} data-dialog-initial-focus>{REPLY_ACTIONS_COPY.cancel}</Button>
          <Button type="submit" variant="danger-solid" loading={busy} disabled={!ready}>{REPLY_ACTIONS_COPY.submit}</Button>
        </div>
      </form>
    </Dialog>
  )
}

/** A reported reply, folded: the note and a toggle to read it once more. */
export function ReportedReply({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="reply-reported" data-reply-reported>
      <span className="reply-reported-note">{REPLY_ACTIONS_COPY.reported}</span>
      <button type="button" className="reply-reported-toggle" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        {open ? REPLY_ACTIONS_COPY.hide : REPLY_ACTIONS_COPY.show}
      </button>
      {open && <span className="reply-reported-text">{text}</span>}
    </span>
  )
}
