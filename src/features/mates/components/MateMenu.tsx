import { useEffect, useId, useRef, useState } from 'react'
import { useBackend } from '@/features/backend/backend-context'
import { MATE_RESET_CLEARS, MATE_RESET_KEEPS, mateResetErrorMessage } from '@/features/mates/mate-contract'
import { Button } from '@/shared/ui/Button'
import { withParticle } from '@/shared/lib/korean'
import { Icon } from '@/shared/ui/Icon'
import { Dialog } from '@/shared/ui/Dialog'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import '@/features/auth/login-backgrounds/desktop/desktop.css'

/**
 * The mate's ⋯ menu (내 메이트): 「대화 초기화」 (47) behind a confirmation that says what goes (the chat and what the mate
 * remembered) and what stays (intimacy, opened expressions, records, credits), and that it cannot be undone. While this
 * mate is connected the reset is refused (409 `CONNECTION_IN_PROGRESS`): the dialog says to end the connection first.
 */
export function MateMenu({
  mateId,
  mateName,
  onBusyChange,
  onDialogChange,
  onReset,
}: {
  mateId: string
  mateName: string
  onBusyChange?: (busy: boolean) => void
  onDialogChange?: (open: boolean) => void
  /** After a reset went through (the page can say so). */
  onReset?: () => void
}) {
  const { resetMateConversation } = useBackend()
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const mounted = useRef(false)
  const wasConfirmOpen = useRef(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const id = useId()
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    // Dialog closes in a layout effect. Restore focus after that commit so the
    // trigger is no longer inert, including when React defers an async result.
    if (!confirm && wasConfirmOpen.current) trigger.current?.focus({ preventScroll: true })
    wasConfirmOpen.current = confirm
  }, [confirm])
  useEffect(() => {
    if (!menuOpen) return
    menu.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const pointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('pointerdown', pointer)
    return () => {
      document.removeEventListener('pointerdown', pointer)
    }
  }, [menuOpen])
  function close() {
    if (pending.current) return
    setConfirm(false)
    onDialogChange?.(false)
  }
  async function reset() {
    if (pending.current || !resetMateConversation) return
    pending.current = true
    setBusy(true)
    onBusyChange?.(true)
    setError('')
    try {
      await resetMateConversation(mateId)
      if (mounted.current) {
        setConfirm(false)
        onDialogChange?.(false)
        onReset?.()
      }
    } catch (reason) {
      if (mounted.current) setError(mateResetErrorMessage(reason))
    } finally {
      pending.current = false
      if (mounted.current) {
        setBusy(false)
        onBusyChange?.(false)
      }
    }
  }
  return (
    <div ref={root} className="mate-menu">
      <button
        ref={trigger}
        type="button"
        className="mate-menu-trigger"
        aria-label={`${mateName} 메뉴`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? id : undefined}
        onClick={() => setMenuOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setMenuOpen(true)
          }
        }}
      >
        <Icon name="more" size={16} />
      </button>
      {menuOpen && (
        <div
          ref={menu}
          id={id}
          role="menu"
          aria-label="메이트 메뉴"
          className="mate-menu-panel"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              setMenuOpen(false)
              trigger.current?.focus()
            }
            if (event.key === 'Tab') {
              setMenuOpen(false)
              trigger.current?.focus()
            }
            if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
              event.preventDefault()
              menu.current?.querySelector<HTMLButtonElement>('button')?.focus()
            }
          }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false)
              setError('')
              setConfirm(true)
              onDialogChange?.(true)
            }}
          >
            대화 초기화
          </button>
        </div>
      )}
      <Dialog
        open={confirm}
        title="대화 초기화"
        onClose={close}
        dismissible={!busy}
        showHeader={false}
        className="mate-reset-dialog mate-reset-dialog--desktop"
      >
        <header className="desktop-window-titlebar mate-window-titlebar-static">
          <div className="desktop-window-title-left">대화 초기화</div>
          <div className="desktop-window-title-right">
            <div className="desktop-window-controls">
              <button
                type="button"
                className="desktop-window-dot desktop-window-dot--close"
                aria-label="닫기"
                disabled={busy}
                onClick={close}
              >
                <span aria-hidden="true">×</span>
              </button>
              <span className="desktop-window-dot" aria-hidden="true" />
              <span className="desktop-window-dot" aria-hidden="true" />
            </div>
          </div>
        </header>
        <div className="mate-reset-dialog-body">
          <h2 className="mate-reset-dialog-heading">{withParticle(mateName, '과', '와')}의 대화를 초기화할까요?</h2>
          <dl className="mate-reset-scope">
            <div>
              <dt>지워지는 것</dt>
              <dd>{MATE_RESET_CLEARS.join(', ')}</dd>
            </div>
            <div>
              <dt>그대로 남는 것</dt>
              <dd>{MATE_RESET_KEEPS.join(', ')}</dd>
            </div>
          </dl>
          <p className="mt-3 text-danger">초기화한 대화는 되돌릴 수 없어요.</p>
          {error && <FeedbackMessage tone="error" className="mt-4">{error}</FeedbackMessage>}
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="secondary" disabled={busy} onClick={close} data-dialog-initial-focus>
              취소
            </Button>
            <Button
              variant="danger-solid"
              loading={busy}
              disabled={!resetMateConversation || busy}
              onClick={() => {
                void reset()
              }}
            >
              초기화하기
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
