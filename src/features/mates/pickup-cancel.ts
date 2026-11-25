/**
 * 「취소 Esc」 over the "picking up the phone" sequence (pickup-sequence.ts): a mis-click on a connect control can be
 * taken back while the phone rings, instead of being carried into the call (UX review 2-1).
 *
 * Plain DOM on <body> just above the pickup overlay (call-pickup.css z-index 10050), like the overlay itself, so the
 * sequence's own module stays as it is. Escape anywhere and the button both cancel. The button takes the focus while
 * shown (the control that started the call is disabled meanwhile); `remove` hands nothing back, the caller restores it.
 */
import './pickup-cancel.css'

export type PickupCancelHandle = { remove: () => void }

export function showPickupCancel(onCancel: () => void): PickupCancelHandle {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'call-pickup-cancel'
  button.setAttribute('aria-label', '연결 취소')
  button.innerHTML = '<span>취소</span><kbd aria-hidden="true">Esc</kbd>'
  let done = false
  const cancel = () => {
    if (done) return
    remove()
    onCancel()
  }
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || event.isComposing) return
    event.preventDefault()
    event.stopPropagation()
    cancel()
  }
  function remove() {
    if (done) return
    done = true
    window.removeEventListener('keydown', onKey, true)
    button.remove()
  }
  button.addEventListener('click', cancel)
  window.addEventListener('keydown', onKey, true)
  document.body.append(button)
  button.focus({ preventScroll: true })
  return { remove }
}
